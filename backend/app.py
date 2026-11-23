"""DepGuard - Flask API."""
from bson import ObjectId
from bson.errors import InvalidId
from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo.errors import PyMongoError

import parsers
from db import db, init_indexes
from osv import OSVError
from service import scan_dependencies

app = Flask(__name__)
CORS(app)

SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "UNKNOWN"]


# ---------- helpers & error handling ----------

class ApiError(Exception):
    def __init__(self, message, status=400):
        self.message, self.status = message, status


@app.errorhandler(ApiError)
def _api_error(e):
    return jsonify(error=e.message), e.status


@app.errorhandler(parsers.ParseError)
def _parse_error(e):
    return jsonify(error=str(e)), 400


@app.errorhandler(OSVError)
def _osv_error(e):
    return jsonify(error=f"Could not reach OSV.dev. {e}"), 502


@app.errorhandler(PyMongoError)
def _mongo_error(e):
    return jsonify(error="Database error. Is MongoDB running?"), 503


def oid(value):
    try:
        return ObjectId(value)
    except (InvalidId, TypeError):
        raise ApiError("Invalid project id.")


def project_counts():
    """{project_id: {total, vulnerable}} using one aggregation."""
    rows = db.dependencies.aggregate([
        {"$group": {
            "_id": "$project_id",
            "total": {"$sum": 1},
            "vulnerable": {"$sum": {"$cond": [{"$gt": [{"$size": "$vulnerabilities"}, 0]}, 1, 0]}},
        }}
    ])
    return {r["_id"]: r for r in rows}


# ---------- routes ----------

@app.get("/api/health")
def health():
    db.command("ping")
    return jsonify(status="ok")


@app.post("/api/parse")
def parse_upload():
    """Read an uploaded file and return the extracted packages (nothing is saved)."""
    f = request.files.get("file")
    if not f or not f.filename:
        raise ApiError("Please choose a requirements.txt or package.json file.")
    file_type, _, deps, skipped = parsers.parse_file(f.filename, f.read())
    return jsonify(filename=f.filename, file_type=file_type, dependencies=deps, skipped=skipped)


@app.post("/api/scan")
def scan():
    body = request.get_json(silent=True) or {}
    name = str(body.get("project_name", "")).strip()
    deps = body.get("dependencies")
    if not name:
        raise ApiError("Project name is required.")
    if not isinstance(deps, list) or not deps:
        raise ApiError("No dependencies to scan.")
    if len(deps) > 1000:
        raise ApiError("Too many dependencies (max 1000 per scan).")

    clean = []
    for d in deps:
        try:
            item = {"name": str(d["name"]).strip(), "version": str(d["version"]).strip(),
                    "ecosystem": d["ecosystem"]}
        except (KeyError, TypeError):
            raise ApiError("Each dependency needs name, version and ecosystem.")
        if not item["name"] or not item["version"] or item["ecosystem"] not in ("PyPI", "npm"):
            raise ApiError(f"Invalid dependency entry: {d}")
        clean.append(item)

    project_id = scan_dependencies(
        name[:100], str(body.get("filename", "unknown"))[:200], str(body.get("file_content", ""))[:200_000], clean
    )
    counts = project_counts().get(project_id, {"total": 0, "vulnerable": 0})
    return jsonify(project_id=str(project_id), total=counts["total"], vulnerable=counts["vulnerable"]), 201


@app.get("/api/projects")
def list_projects():
    counts = project_counts()
    out = []
    for p in db.projects.find({}, {"uploaded_file.content": 0}).sort("created_at", -1):
        c = counts.get(p["_id"], {"total": 0, "vulnerable": 0})
        out.append({
            "id": str(p["_id"]),
            "project_name": p["project_name"],
            "filename": p.get("uploaded_file", {}).get("filename"),
            "created_at": p["created_at"].isoformat() + "Z",
            "total": c["total"],
            "vulnerable": c["vulnerable"],
        })
    return jsonify(out)


@app.delete("/api/projects/<project_id>")
def delete_project(project_id):
    pid = oid(project_id)
    db.dependencies.delete_many({"project_id": pid})
    db.projects.delete_one({"_id": pid})
    return jsonify(deleted=True)


@app.get("/api/dashboard")
def dashboard():
    """All numbers are computed from MongoDB with aggregations (optionally for one project)."""
    match = {"project_id": oid(request.args["project_id"])} if request.args.get("project_id") else {}

    total = db.dependencies.count_documents(match)
    vulnerable = db.dependencies.count_documents({**match, "vulnerabilities.0": {"$exists": True}})
    dist = {s: 0 for s in SEVERITIES}
    for r in db.dependencies.aggregate([
        {"$match": match},
        {"$unwind": "$vulnerabilities"},
        {"$group": {"_id": "$vulnerabilities.severity", "count": {"$sum": 1}}},
    ]):
        dist[r["_id"] if r["_id"] in dist else "UNKNOWN"] += r["count"]

    return jsonify(
        total_dependencies=total,
        vulnerable_dependencies=vulnerable,
        safe_dependencies=total - vulnerable,
        critical_vulnerabilities=dist["CRITICAL"],
        total_vulnerabilities=sum(dist.values()),
        severity_distribution=dist,
    )


@app.get("/api/results")
def results():
    """One row per vulnerability; safe packages get a single 'Safe' row."""
    project_id = request.args.get("project_id")
    if not project_id:
        latest = db.projects.find_one({}, sort=[("created_at", -1)])
        if not latest:
            return jsonify(project=None, rows=[])
        project_id = str(latest["_id"])
    pid = oid(project_id)
    project = db.projects.find_one({"_id": pid}, {"uploaded_file.content": 0})
    if not project:
        raise ApiError("Project not found.", 404)

    rows = []
    for d in db.dependencies.find({"project_id": pid}).sort("package_name", 1):
        base = {"package_name": d["package_name"], "version": d["version"], "ecosystem": d["ecosystem"]}
        if not d["vulnerabilities"]:
            rows.append({**base, "vulnerability_id": None, "severity": None,
                         "fixed_versions": [], "status": "Safe"})
        for v in d["vulnerabilities"]:
            rows.append({**base, **v, "status": "Vulnerable"})
    order = {s: i for i, s in enumerate(SEVERITIES)}
    rows.sort(key=lambda r: (order.get(r["severity"], 99), r["package_name"]))
    return jsonify(
        project={"id": str(project["_id"]), "project_name": project["project_name"]}, rows=rows
    )


@app.get("/api/vulnerabilities/<vuln_id>")
def vulnerability_detail(vuln_id):
    query = {"vulnerability_id": vuln_id}
    if request.args.get("package"):
        query["package_name"] = request.args["package"]
    if request.args.get("ecosystem"):
        query["ecosystem"] = request.args["ecosystem"]
    doc = db.vulnerabilities.find_one(query, {"_id": 0})
    if not doc:
        raise ApiError("Vulnerability not found.", 404)
    return jsonify(doc)


if __name__ == "__main__":
    init_indexes()
    app.run(port=5001, debug=True)
