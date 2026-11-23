"""Extract (package, version) pairs from requirements.txt and package.json."""
import json
import re

MAX_BYTES = 1_000_000


class ParseError(ValueError):
    """Raised when an uploaded file cannot be understood."""


def decode(raw: bytes) -> str:
    if len(raw) > MAX_BYTES:
        raise ParseError("File is too large (max 1 MB).")
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):  # `pip freeze` on Windows PowerShell
        return raw.decode("utf-16")
    try:
        return raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ParseError("File is not valid text (expected UTF-8).")


def detect_type(filename: str) -> str:
    name = (filename or "").lower()
    if name.endswith(".json"):
        return "package.json"
    if name.endswith(".txt"):
        return "requirements.txt"
    raise ParseError("Unsupported file. Upload a requirements.txt or package.json file.")


def normalize_pypi(name: str) -> str:
    return re.sub(r"[-_.]+", "-", name).lower()


_REQ = re.compile(r"^([A-Za-z0-9][A-Za-z0-9._-]*)\s*(\[[^\]]*\])?\s*(.*)$")
_PINNED = re.compile(r"^===?\s*([A-Za-z0-9][A-Za-z0-9.!+_-]*)\s*(,|$)")


def parse_requirements(text: str):
    deps, skipped, seen = [], [], set()
    for line in text.splitlines():
        line = line.split(" #")[0].split(";")[0].strip()
        if not line or line.startswith(("#", "-", "http://", "https://", "git+")):
            continue
        m = _REQ.match(line)
        if not m:
            skipped.append({"name": line, "reason": "Unrecognised line"})
            continue
        name, spec = m.group(1), m.group(3).strip()
        pin = _PINNED.match(spec)
        if not pin:
            skipped.append({"name": name, "reason": "Version is not pinned with == (cannot check)"})
            continue
        key = (normalize_pypi(name), pin.group(1))
        if key not in seen:
            seen.add(key)
            deps.append({"name": key[0], "version": key[1], "ecosystem": "PyPI"})
    return deps, skipped


_EXACT = re.compile(r"^[\^~=v\s]*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+[0-9A-Za-z.-]+)?$")


def parse_package_json(text: str):
    try:
        data = json.loads(text)
    except json.JSONDecodeError as e:
        raise ParseError(f"Invalid JSON: {e.msg} (line {e.lineno}).")
    if not isinstance(data, dict):
        raise ParseError("package.json must contain a JSON object.")

    sections = [data.get(k) for k in ("dependencies", "devDependencies", "optionalDependencies")]
    if not any(isinstance(s, dict) for s in sections):
        raise ParseError("No dependencies found in package.json.")

    deps, skipped, seen = [], [], set()
    for section in sections:
        if not isinstance(section, dict):
            continue
        for name, spec in section.items():
            m = _EXACT.match(str(spec))
            if not m:
                skipped.append({"name": name, "reason": f"Cannot read a version from '{spec}'"})
                continue
            key = (name, m.group(1))
            if key not in seen:
                seen.add(key)
                deps.append({"name": name, "version": m.group(1), "ecosystem": "npm"})
    return deps, skipped


def parse_file(filename: str, raw: bytes):
    """Return (file_type, text, dependencies, skipped)."""
    file_type = detect_type(filename)
    text = decode(raw)
    if file_type == "package.json":
        deps, skipped = parse_package_json(text)
    else:
        deps, skipped = parse_requirements(text)
    if not deps:
        raise ParseError("No checkable dependencies found. Versions must be pinned (e.g. flask==2.0.1).")
    return file_type, text, deps, skipped
