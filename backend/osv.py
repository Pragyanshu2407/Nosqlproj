"""Small client for the free OSV.dev API (https://google.github.io/osv.dev/api/)."""
import math
import time
from concurrent.futures import ThreadPoolExecutor

import requests

BASE = "https://api.osv.dev/v1"
TIMEOUT = 20


class OSVError(Exception):
    """OSV.dev could not be reached or returned an error."""


def _call(method, path, **kwargs):
    last = None
    for attempt in range(3):
        try:
            r = requests.request(method, BASE + path, timeout=TIMEOUT, **kwargs)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError) as e:
            last = e
            time.sleep(0.7 * (attempt + 1))
    raise OSVError(f"OSV.dev request failed: {last}")


def query_ids(deps):
    """For each dependency return the list of OSV ids that affect that exact version."""
    ids = [[] for _ in deps]
    for start in range(0, len(deps), 500):  # API limit is 1000 per batch
        chunk = deps[start:start + 500]
        queries = [
            {"package": {"name": d["name"], "ecosystem": d["ecosystem"]}, "version": d["version"]}
            for d in chunk
        ]
        results = _call("POST", "/querybatch", json={"queries": queries})["results"]
        for i, res in enumerate(results):
            idx = start + i
            ids[idx] += [v["id"] for v in res.get("vulns", [])]
            token = res.get("next_page_token")
            while token:  # very large result sets are paginated
                page = _call("POST", "/query", json={**queries[i], "page_token": token})
                ids[idx] += [v["id"] for v in page.get("vulns", [])]
                token = page.get("next_page_token")
    return ids


def fetch_vulns(vuln_ids):
    """Fetch full records for a set of ids -> {id: record}."""
    vuln_ids = sorted(set(vuln_ids))
    with ThreadPoolExecutor(max_workers=8) as pool:
        records = list(pool.map(lambda i: _call("GET", f"/vulns/{i}"), vuln_ids))
    return {i: r for i, r in zip(vuln_ids, records) if r}


# ---------- turning an OSV record into the fields we store ----------

def _round_up(x):
    i = round(x * 100000)
    return i / 100000.0 if i % 10000 == 0 else (math.floor(i / 10000) + 1) / 10.0


def cvss3_score(vector):
    """Base score from a CVSS v3.x vector string (None if it cannot be parsed)."""
    try:
        p = dict(part.split(":") for part in vector.split("/")[1:])
        changed = p["S"] == "C"
        av = {"N": 0.85, "A": 0.62, "L": 0.55, "P": 0.2}[p["AV"]]
        ac = {"L": 0.77, "H": 0.44}[p["AC"]]
        pr = {"N": 0.85, "L": 0.68 if changed else 0.62, "H": 0.5 if changed else 0.27}[p["PR"]]
        ui = {"N": 0.85, "R": 0.62}[p["UI"]]
        c, i, a = [{"H": 0.56, "L": 0.22, "N": 0}[p[k]] for k in "CIA"]
    except (KeyError, ValueError, AttributeError):
        return None
    iss = 1 - (1 - c) * (1 - i) * (1 - a)
    impact = 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02) ** 15 if changed else 6.42 * iss
    if impact <= 0:
        return 0.0
    expl = 8.22 * av * ac * pr * ui
    return _round_up(min((1.08 if changed else 1) * (impact + expl), 10))


def _bucket(score):
    if score >= 9.0:
        return "CRITICAL"
    if score >= 7.0:
        return "HIGH"
    if score >= 4.0:
        return "MEDIUM"
    return "LOW" if score > 0 else "UNKNOWN"


def _normalize_label(value):
    v = str(value or "").upper()
    v = "MEDIUM" if v == "MODERATE" else v
    return v if v in ("CRITICAL", "HIGH", "MEDIUM", "LOW") else None


def get_severity(vuln):
    """Return (label, cvss_score, cvss_vector) using only data present in the OSV record."""
    score = vector = None
    for s in vuln.get("severity", []):
        if str(s.get("type", "")).startswith("CVSS_V3") and str(s.get("score", "")).startswith("CVSS:3"):
            vector, score = s["score"], cvss3_score(s["score"])
            break
    label = _normalize_label(vuln.get("database_specific", {}).get("severity"))
    if not label and score is not None:
        label = _bucket(score)
    if not label:
        for a in vuln.get("affected", []):
            label = _normalize_label(a.get("ecosystem_specific", {}).get("severity"))
            if label:
                break
    return label or "UNKNOWN", score, vector


def _matching_affected(vuln, dep):
    name = dep["name"].lower().replace("_", "-") if dep["ecosystem"] == "PyPI" else dep["name"]
    out = []
    for a in vuln.get("affected", []):
        pkg = a.get("package", {})
        pname = str(pkg.get("name", ""))
        pname = pname.lower().replace("_", "-") if dep["ecosystem"] == "PyPI" else pname
        if pname == name and str(pkg.get("ecosystem", "")).startswith(dep["ecosystem"]):
            out.append(a)
    return out or vuln.get("affected", [])


def affected_and_fixed(vuln, dep):
    """Human-readable affected ranges and the list of fixed versions from the record."""
    ranges, fixed, versions = [], [], []
    for a in _matching_affected(vuln, dep):
        versions += a.get("versions", [])
        for r in a.get("ranges", []):
            if r.get("type") == "GIT":
                continue
            lower = None
            for ev in r.get("events", []):
                if "introduced" in ev:
                    lower = ev["introduced"]
                elif "fixed" in ev:
                    ranges.append(f">= {lower or '0'}, < {ev['fixed']}")
                    if ev["fixed"] not in fixed:
                        fixed.append(ev["fixed"])
                    lower = None
                elif "last_affected" in ev:
                    ranges.append(f">= {lower or '0'}, <= {ev['last_affected']}")
                    lower = None
            if lower is not None:
                ranges.append(f">= {lower} (no fix listed)")
    if not ranges and versions:
        shown = ", ".join(versions[:15]) + (" …" if len(versions) > 15 else "")
        ranges.append(f"Listed versions: {shown}")
    return ranges, fixed


def build_vuln_doc(vuln, dep):
    """Document stored in the `vulnerabilities` collection."""
    severity, score, vector = get_severity(vuln)
    ranges, fixed = affected_and_fixed(vuln, dep)
    return {
        "vulnerability_id": vuln["id"],
        "package_name": dep["name"],
        "ecosystem": dep["ecosystem"],
        "severity": severity,
        "cvss_score": score,
        "cvss_vector": vector,
        "summary": vuln.get("summary", ""),
        "description": vuln.get("details") or vuln.get("summary") or "No description provided.",
        "aliases": vuln.get("aliases", []),
        "affected_versions": ranges,
        "fixed_versions": fixed,
        "references": [r["url"] for r in vuln.get("references", []) if r.get("url")][:6],
        "published": vuln.get("published"),
        "modified": vuln.get("modified"),
    }
