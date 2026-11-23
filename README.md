# DepGuard – Software Dependency & Vulnerability Analyzer

DepGuard is a small NoSQL college project. You upload a `requirements.txt` or `package.json`, and it checks every
pinned package against the free [OSV.dev](https://osv.dev) vulnerability database. Scan results are stored in
MongoDB and shown in a dashboard and a filterable results table.

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind CSS 4, Lucide icons, Vite |
| Backend | Python Flask |
| Database | MongoDB (via PyMongo) |
| Vulnerability data | OSV.dev public API (no API key needed) |

## Table of contents
1. [Features](#features)
2. [Project structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Installation and running](#installation-and-running)
5. [How to use the app](#how-to-use-the-app)
6. [How it works](#how-it-works)
7. [MongoDB design](#mongodb-design)
8. [API reference](#api-reference)
9. [Supported file formats](#supported-file-formats)
10. [Configuration](#configuration)
11. [Demo data](#demo-data)
12. [Troubleshooting](#troubleshooting)
13. [Viva / explanation notes](#viva--explanation-notes)

## Features
- **Dashboard** – total dependencies scanned, vulnerable dependencies, critical vulnerabilities, safe dependencies and a
  severity distribution chart. Every number is computed from MongoDB with aggregation queries (nothing hardcoded).
  A dropdown switches between all projects and a single project.
- **Project scanner** – enter a project name, upload a file, preview the extracted packages, click *Scan Dependencies*.
- **Vulnerability detection** – real OSV.dev responses: vulnerability IDs, severity, affected version ranges and fixed
  versions. Nothing is invented; if OSV has no data, the app shows *Unknown* or *None listed*.
- **Results page** – table with package, installed version, vulnerability ID, severity, fixed version and status;
  severity filters (with counts), a search bar, and a detail pop-up with the description and affected versions.
- **Error handling** – invalid or unsupported files, malformed JSON, OSV.dev being unreachable and MongoDB being down all
  produce a readable message instead of a crash.

## Project structure
```
.
├── README.md
├── backend/
│   ├── app.py            Flask routes and error handlers
│   ├── parsers.py        reads requirements.txt / package.json
│   ├── osv.py            OSV.dev client + severity / affected / fixed-version extraction
│   ├── service.py        the scan workflow: OSV lookup, then save to MongoDB
│   ├── db.py             MongoDB connection and index creation
│   ├── seed.py           loads demo projects
│   ├── requirements.txt  Python dependencies
│   └── sample_data/      requirements.txt and package.json used for the demo
└── frontend/
    ├── index.html
    ├── vite.config.js    dev server + proxy of /api to Flask
    └── src/
        ├── main.jsx, App.jsx, api.js, index.css
        ├── pages/        Dashboard.jsx, ScanProject.jsx, Results.jsx
        └── components/   Sidebar.jsx, VulnModal.jsx, ui.jsx (shared pieces)
```

## Prerequisites
- **Python 3.10+** (Windows: tick *Add python.exe to PATH* in the installer; the launcher command is `py`)
- **Node.js 18+** and npm
- **MongoDB** running locally on the default port (27017) – [install guide](https://www.mongodb.com/docs/manual/installation/)
- **Internet access** (the backend calls `https://api.osv.dev`)

## Installation and running
You need three things running: MongoDB, the Flask backend and the React frontend. Use three terminal windows.

### 1. Start MongoDB

**macOS (Homebrew)**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Windows**
1. Download *MongoDB Community Server* (MSI) from https://www.mongodb.com/try/download/community and run the installer.
   Keep *Install MongoDB as a Service* ticked. It then starts automatically and listens on port 27017.
2. Check the service is running (PowerShell):
   ```powershell
   Get-Service MongoDB
   ```
   If it says *Stopped*, start it from an **Administrator** PowerShell with `net start MongoDB`.
3. Optional: install *MongoDB Shell (mongosh)* from the same site to test the connection.

**Linux / any OS, running it manually**
```bash
mkdir -p ~/depguard-data
mongod --dbpath ~/depguard-data
```
On Windows the manual equivalent is `mkdir C:\depguard-data` then `mongod --dbpath C:\depguard-data`
(add MongoDB's `bin` folder to PATH first, usually `C:\Program Files\MongoDB\Server\<version>\bin`).

Check it works: `mongosh --eval "db.runCommand({ping:1})"` should print `ok: 1`.

### 2. Start the backend (Flask, port 5001)

**macOS / Linux**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python seed.py                     # optional: load demo data (needs internet)
python app.py
```

**Windows (PowerShell)**
```powershell
cd backend
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python seed.py                     # optional: load demo data (needs internet)
python app.py
```
If PowerShell blocks the activate script ("running scripts is disabled"), run this once and try again:
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Windows (Command Prompt)**
```bat
cd backend
py -m venv .venv
.venv\Scripts\activate.bat
pip install -r requirements.txt
python seed.py
python app.py
```

The API is now at http://localhost:5001. Check http://localhost:5001/api/health – it should return `{"status":"ok"}`.
Indexes are created automatically when the server starts. Leave this window open.

### 3. Start the frontend (React, port 5173)
Open a **new** terminal window (any OS – the commands are the same):
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The dev server forwards every `/api` request to Flask, so no extra configuration is needed.

### Controls cheat sheet
| Action | macOS / Linux | Windows (PowerShell) |
|---|---|---|
| Create virtual environment | `python3 -m venv .venv` | `py -m venv .venv` |
| Activate it | `source .venv/bin/activate` | `.venv\Scripts\Activate.ps1` |
| Leave it | `deactivate` | `deactivate` |
| Start MongoDB | `brew services start mongodb-community` | `net start MongoDB` (Administrator) |
| Stop MongoDB | `brew services stop mongodb-community` | `net stop MongoDB` (Administrator) |
| Stop Flask / Vite | `Ctrl + C` in its terminal | `Ctrl + C` in its terminal |
| Set an env variable for one run | `MONGO_DB=test python app.py` | `$env:MONGO_DB="test"; python app.py` |
| Find what uses a port | `lsof -i :5001` | `netstat -ano \| findstr :5001` |
| Stop that process | `kill <PID>` | `taskkill /PID <PID> /F` |
| Reset demo data | `python seed.py --reset` | `python seed.py --reset` |

> Port 5001 is used because macOS reserves port 5000 for AirPlay (it works the same on Windows).

### Production build (optional)
```bash
cd frontend && npm run build        # output in frontend/dist
```

## How to use the app
1. **Dashboard** – the home page. If the database is empty it asks you to scan a project.
2. **Scan Project** (sidebar)
   1. Type a project name.
   2. Click the upload box (or drag a file onto it) and choose a `requirements.txt` or `package.json`.
      The extracted packages appear in a table. Anything that could not be read is listed under *skipped*.
   3. Click **Scan Dependencies**. The scan takes a few seconds because every package is checked on OSV.dev.
3. **Vulnerability Results** – you land here after the scan.
   - Use the segmented control to filter by *Critical / High / Medium / Low / Unknown / Safe* (numbers show how many rows).
   - Type in the search bar to filter by package name or vulnerability ID.
   - Click any vulnerability row to open the detail view (description, CVSS score, affected versions, fixed versions,
     link to the OSV.dev page). Press `Esc` or click outside to close it.
   - Use the dropdown at the top right to look at another project.
4. Go back to **Dashboard** to see the updated totals and the *Recent scans* list.

## How it works
1. **Parse** – the chosen file is sent to `POST /api/parse`. `parsers.py` extracts package names and exact versions.
   The browser shows the result as a preview; nothing is saved yet.
2. **Scan** – the extracted list is sent to `POST /api/scan` as JSON.
3. **Lookup** – `osv.py` sends all packages in one `POST /v1/querybatch` request to OSV.dev. OSV returns the IDs of the
   advisories that affect each *exact* version. Then each advisory is downloaded with `GET /v1/vulns/{id}` (8 in parallel).
4. **Extract** – for each advisory the backend reads only what OSV provides:
   - *Severity*: the advisory's own rating (`database_specific.severity`); otherwise it is computed from the CVSS v3
     vector in the record; otherwise `UNKNOWN`.
   - *Affected versions*: built from the `introduced` / `fixed` / `last_affected` events in the OSV ranges.
   - *Fixed versions*: every `fixed` event. If an advisory lists several (one per release branch), all are shown.
5. **Save** – `service.py` writes the project, the dependencies and the vulnerabilities to MongoDB. OSV is contacted
   *before* anything is written, so a network failure never leaves a half-saved project.
6. **Display** – the dashboard and results pages read from MongoDB through the API.

## MongoDB design
Database name: `depguard`. Three collections:

**`projects`**
| Field | Description |
|---|---|
| `project_name` | name typed by the user |
| `uploaded_file` | `{ filename, content }` – the original file |
| `created_at` | scan time |

**`dependencies`**
| Field | Description |
|---|---|
| `project_id` | reference (ObjectId) to `projects._id` |
| `package_name`, `version`, `ecosystem` | `PyPI` or `npm` |
| `vulnerabilities` | embedded list of `{ vulnerability_id, severity, fixed_versions }` (empty = safe) |

**`vulnerabilities`**
| Field | Description |
|---|---|
| `vulnerability_id` | e.g. `GHSA-…`, `PYSEC-…` |
| `package_name`, `ecosystem` | affected package |
| `severity` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` or `UNKNOWN` |
| `description` | full text from OSV |
| `affected_versions` | list of readable ranges, e.g. `>= 5.1, < 5.2` |
| `fixed_versions` | list of fixed versions |
| extra | `summary`, `aliases` (CVE ids), `cvss_score`, `cvss_vector`, `references`, `published`, `modified` |

**Indexes**
| Collection | Index | Purpose |
|---|---|---|
| `projects` | `created_at` descending | newest scans first |
| `dependencies` | `project_id` | load all packages of a project |
| `dependencies` | `package_name + ecosystem` | package lookups |
| `vulnerabilities` | unique `vulnerability_id + package_name + ecosystem` | one document per advisory and package; makes re-scans update instead of duplicate |
| `vulnerabilities` | `severity` | severity queries |

**Design choice (embedding vs referencing):** each dependency *embeds* a short summary of its vulnerabilities, so the
results table needs a single query. The full advisory text lives in `vulnerabilities` and is *referenced* by
`vulnerability_id` – it is only loaded when you open the detail view, and it is stored once even if many projects use
the same package. Projects and dependencies are linked by reference (`project_id`).

**Dashboard aggregations** (in `app.py`): `$group` counts dependencies per project; `$unwind` on
`vulnerabilities` followed by `$group` on severity produces the distribution chart.

## API reference
Base URL: `http://localhost:5001/api`

| Method | Path | Description |
|---|---|---|
| GET | `/health` | pings MongoDB |
| POST | `/parse` | multipart upload (`file`) → extracted dependencies and skipped entries (saves nothing) |
| POST | `/scan` | JSON `{project_name, filename, file_content, dependencies:[{name, version, ecosystem}]}` → scans and saves; returns `project_id`, `total`, `vulnerable` |
| GET | `/projects` | all projects with their totals, newest first |
| DELETE | `/projects/<id>` | delete a project and its dependencies |
| GET | `/dashboard?project_id=` | dashboard numbers (omit `project_id` for all projects) |
| GET | `/results?project_id=` | result rows for a project (default: latest) |
| GET | `/vulnerabilities/<id>?package=&ecosystem=` | full vulnerability details |

Errors are returned as `{"error": "message"}` with status 400 (bad input), 404, 502 (OSV.dev failed) or 503 (MongoDB down).

Quick test without the UI (on Windows use `curl.exe`, because plain `curl` in PowerShell is an alias for another command):
```bash
curl -F file=@backend/sample_data/requirements.txt http://localhost:5001/api/parse
curl http://localhost:5001/api/dashboard
```
```powershell
curl.exe -F file=@backend/sample_data/requirements.txt http://localhost:5001/api/parse
curl.exe http://localhost:5001/api/dashboard
```

## Supported file formats
**requirements.txt** – lines like `flask==2.0.1` (the `==` pin is required). Extras (`pkg[extra]==1.0`), comments and
environment markers are handled. Lines with `>=`, `~=`, no version, URLs or `-r` options are skipped, because OSV needs
an exact version. UTF-8 and UTF-16 (Windows `pip freeze`) files are accepted.

**package.json** – reads `dependencies`, `devDependencies` and `optionalDependencies`. `4.17.15`, `^4.17.15` and
`~4.17.15` are checked as version `4.17.15` (the declared version – not necessarily what `npm install` resolved; for
exact results use pinned versions). Ranges like `>=1.0.0`, `*`, `latest`, git URLs and partial versions like `^4` are skipped.

Maximum file size is 1 MB and maximum 1000 packages per scan.

## Configuration
Environment variables for the backend (all optional):

| Variable | Default |
|---|---|
| `MONGO_URI` | `mongodb://localhost:27017` |
| `MONGO_DB` | `depguard` |

Examples:
```bash
MONGO_DB=depguard_test python app.py              # macOS / Linux
```
```powershell
$env:MONGO_DB="depguard_test"; python app.py      # Windows PowerShell
```
```bat
set MONGO_DB=depguard_test && python app.py       :: Windows Command Prompt
```

## Demo data
`backend/sample_data/` contains a deliberately outdated Python project and Node project.
```bash
cd backend
python seed.py            # scans both with the real OSV.dev API (skips ones that already exist)
python seed.py --reset    # wipes all three collections first
```
This creates the projects *Demo - Python API* and *Demo - Node Web App*. You can also upload the same files from the
Scan Project page. Because OSV.dev is a live database, the exact numbers change over time as new advisories are published.

## Troubleshooting
| Problem | Fix |
|---|---|
| "Cannot reach the backend" in the UI | Start `python app.py` in `backend/`; it must run on port 5001. |
| "Database error. Is MongoDB running?" | Start MongoDB (step 1). Check `MONGO_URI` if it is not on localhost. |
| "Could not reach OSV.dev" | Check your internet connection / firewall, then retry. |
| "No checkable dependencies found" | Pin your versions (`name==1.2.3`) or use a `package.json` with exact versions. |
| `Address already in use` | Another program uses the port – stop it (see the cheat sheet above), or change the port in `backend/app.py` and `frontend/vite.config.js`. |
| `python` / `py` not found (Windows) | Reinstall Python with *Add python.exe to PATH* ticked, or use `py` instead of `python3`. |
| `Activate.ps1 cannot be loaded` (Windows) | Run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or use Command Prompt and `activate.bat`. |
| MongoDB service will not start (Windows) | Open PowerShell as Administrator and run `net start MongoDB`; check `Get-Service MongoDB`. |
| Dashboard is empty | Run `python seed.py` or scan a file. |
| Seed fails | It needs internet access to OSV.dev. |

## Viva / explanation notes
- **Why MongoDB?** Advisories have a flexible shape (different ranges, aliases, references). Documents store them as-is,
  and a dependency can embed its list of vulnerabilities without join tables.
- **Why embed *and* reference?** Embedding gives fast table reads; referencing avoids copying long descriptions and keeps
  details in one place.
- **Why OSV.dev?** It is free, needs no key, aggregates GitHub Advisories, PyPI and npm data, and supports querying by
  exact version, so only advisories that affect the installed version are returned.
- **Why one `querybatch` call?** One HTTP request for all packages instead of one request per package.
- **No made-up data:** severity, ranges and fixes are copied from OSV; missing data is displayed as *Unknown* / *None listed*.
- **Security note:** uploaded file contents are only parsed as text/JSON and never executed.
# Nosqlproj
