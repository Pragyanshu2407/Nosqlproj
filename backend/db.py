"""MongoDB connection and index creation."""
import os

from pymongo import ASCENDING, DESCENDING, MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGO_DB", "depguard")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client[DB_NAME]


def init_indexes():
    """Create indexes (safe to call on every start-up)."""
    # projects: newest first for the "recent scans" list
    db.projects.create_index([("created_at", DESCENDING)])

    # dependencies: reference to the project + fast lookup by package
    db.dependencies.create_index("project_id")
    db.dependencies.create_index([("package_name", ASCENDING), ("ecosystem", ASCENDING)])

    # vulnerabilities: one document per (advisory, package); filter by severity
    db.vulnerabilities.create_index(
        [("vulnerability_id", ASCENDING), ("package_name", ASCENDING), ("ecosystem", ASCENDING)],
        unique=True,
    )
    db.vulnerabilities.create_index("severity")
