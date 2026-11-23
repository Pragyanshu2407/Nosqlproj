"""Scan workflow: OSV lookup -> MongoDB."""
from datetime import datetime, timezone

from pymongo import ReplaceOne

import osv
from db import db


def scan_dependencies(project_name, filename, content, deps):
    """Check deps against OSV.dev and store everything. Returns the new project id (ObjectId)."""
    # 1. Talk to OSV first, so a network failure leaves nothing half-saved in MongoDB.
    ids_per_dep = osv.query_ids(deps)
    records = osv.fetch_vulns([i for ids in ids_per_dep for i in ids])

    # 2. Build documents.
    now = datetime.now(timezone.utc)
    project_id = db.projects.insert_one({
        "project_name": project_name,
        "uploaded_file": {"filename": filename, "content": content},
        "created_at": now,
    }).inserted_id

    vuln_ops, dep_docs = [], []
    for dep, ids in zip(deps, ids_per_dep):
        refs = []
        for vid in dict.fromkeys(ids):  # unique, keep order
            if vid not in records:
                continue
            doc = osv.build_vuln_doc(records[vid], dep)
            key = {k: doc[k] for k in ("vulnerability_id", "package_name", "ecosystem")}
            vuln_ops.append(ReplaceOne(key, doc, upsert=True))
            # The dependency keeps a light reference; full details live in `vulnerabilities`.
            refs.append({
                "vulnerability_id": doc["vulnerability_id"],
                "severity": doc["severity"],
                "fixed_versions": doc["fixed_versions"],
            })
        dep_docs.append({
            "project_id": project_id,
            "package_name": dep["name"],
            "version": dep["version"],
            "ecosystem": dep["ecosystem"],
            "vulnerabilities": refs,
        })

    # 3. Save.
    if vuln_ops:
        db.vulnerabilities.bulk_write(vuln_ops, ordered=False)
    db.dependencies.insert_many(dep_docs)
    return project_id
