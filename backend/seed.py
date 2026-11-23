"""Load demo projects by scanning the files in sample_data/ against the real OSV.dev API.

Usage:  python seed.py          (skips demos that already exist)
        python seed.py --reset  (deletes all data first)
"""
import sys
from pathlib import Path

import parsers
from db import db, init_indexes
from service import scan_dependencies

DEMOS = [
    ("Demo - Python API", "requirements.txt"),
    ("Demo - Node Web App", "package.json"),
]


def main():
    init_indexes()
    if "--reset" in sys.argv:
        for c in ("projects", "dependencies", "vulnerabilities"):
            db[c].delete_many({})
        print("Cleared all collections.")
    for name, filename in DEMOS:
        if db.projects.find_one({"project_name": name}):
            print(f"{name}: already exists, skipping")
            continue
        raw = (Path(__file__).parent / "sample_data" / filename).read_bytes()
        _, text, deps, _ = parsers.parse_file(filename, raw)
        pid = scan_dependencies(name, filename, text, deps)
        vulnerable = db.dependencies.count_documents({"project_id": pid, "vulnerabilities.0": {"$exists": True}})
        print(f"{name}: scanned {len(deps)} packages, {vulnerable} vulnerable")


if __name__ == "__main__":
    main()
