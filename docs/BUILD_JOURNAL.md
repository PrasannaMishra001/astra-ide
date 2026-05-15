# ASTRA-IDE — Build Journal

> A chronological log of how the project was built and deployed.
> Source of truth for "what was decided and why" — supplements the README.

---

## Session: 2026-05-14 → 2026-05-15

### Outcome

A fully deployed cloud IDE prototype with the project's core research novelty
(adaptive risk-based sandboxing) verified working in production on a public IP.

- **Repository:** https://github.com/PrasannaMishra001/astra-ide (private)
- **Live deployment:** http://34.47.224.18 (frontend 3000, backend 8000, collab 1234)
- **Commits:** 15 atomic commits, no Claude/co-author attribution
- **Cost:** $0 (GCP $300 free trial covers the entire BTP timeline)

---

## Project Structure (Final)

```
astra-ide/
├── backend/                FastAPI service
│   ├── app/
│   │   ├── api/            auth.py, workspaces.py, carbon.py
│   │   ├── core/           config.py, security.py
│   │   ├── db/             session.py
│   │   ├── models/         user.py, workspace.py (SQLAlchemy)
│   │   ├── schemas/        Pydantic request/response shapes
│   │   ├── services/       workspace_service.py, carbon_service.py
│   │   └── main.py
│   ├── tests/              test_carbon_service.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/               Next.js 14 + TypeScript + Tailwind
│   ├── src/
│   │   ├── app/            App Router pages
│   │   │   ├── page.tsx                landing
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   ├── dashboard/page.tsx      workspace list
│   │   │   └── workspaces/[id]/page.tsx editor
│   │   ├── components/CollabEditor.tsx Monaco + Yjs binding
│   │   └── lib/            api.ts, auth.ts (Zustand store)
│   ├── public/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── Dockerfile
│
├── collab-server/          y-websocket relay (Node)
│   ├── server.js
│   ├── package.json
│   └── Dockerfile
│
├── ml/
│   ├── risk_scorer/        scorer.py + 7 unit tests
│   ├── scheduler/          PPO env + Gymnasium + reward + 7 unit tests
│   └── prewarming/         LSTM model + synthetic dataset + 6 unit tests
│
├── k8s/                    Manifests for future cluster deployment
│   ├── base/               namespace, deployments, services, RuntimeClasses,
│   │                       KEDA ScaledObject, eBPF Tetragon TracingPolicy
│   ├── helm/astra-ide/     Chart.yaml + values.yaml
│   └── karmada/            PropagationPolicy for multi-cluster
│
├── deploy/                 docker-compose.yml + docker-compose.dev.yml
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── ML.md
│   ├── DEPLOY.md
│   ├── DEVELOPMENT.md
│   └── BUILD_JOURNAL.md    (this file)
│
└── .github/workflows/
    ├── ci.yml              backend/ml/frontend/collab test pipeline
    └── docker.yml          builds + pushes images to GHCR on main
```

---

## Component Status (Verified)

| Component | State | Verification |
|-----------|-------|---|
| Backend API           | working | E2E test: register, login, /me, CRUD all return correct status codes |
| Frontend              | working | Landing + login/register/dashboard render, build succeeds |
| Collab server         | working | /healthz returns 200, /stats endpoint live |
| **Risk scorer**       | working | Three test workspaces created with correct tier assignment (see below) |
| PPO scheduler env     | tested  | 7 unit tests pass; not yet trained on real workloads (Phase 3) |
| LSTM prewarmer        | tested  | 6 unit tests pass on synthetic data; not yet trained (Phase 4) |
| Carbon API client     | working | Live electricityMaps integration; auto-fallback to historical avg |
| Docker Compose stack  | working | 6 services, all healthy on GCP VM |
| GitHub Actions CI     | configured | 4 jobs: backend / ml / frontend / collab |
| Kubernetes manifests  | drafted | Ready to apply once k3s cluster is provisioned (Phase 3+) |

---

## Live Demo Evidence (Risk Scorer Working)

The project's core research novelty is **adaptive sandboxing via real-time risk
scoring**. Verified on 2026-05-15 against the live deployment:

```
Workspace 1: safe-python-project
  inputs:  language=python, network=false, fs_write=false
  result:  risk_score=0.00 → sandbox_tier=runc          ✓

Workspace 2: web-scraper
  inputs:  language=python, network=true,  fs_write=true
  result:  risk_score=0.40 → sandbox_tier=gvisor        ✓

Workspace 3: shell-sandbox
  inputs:  language=bash, network=true, fs_write=true,
           initial_code contains "subprocess" + "rm -rf"
  result:  risk_score=0.80 → sandbox_tier=firecracker   ✓
```

All three tier transitions (0.0→runc, 0.4→gvisor, 0.8→firecracker) match the
spec thresholds (< 0.30, < 0.70, ≥ 0.70).

---

## Carbon API Live Evidence (2026-05-15)

```
GET /carbon/intensity?zone=DK-DK1
  → 52 gCO2eq/kWh   source: api   is_fallback: false

GET /carbon/intensity?zone=IN-NO
  → 373 gCO2eq/kWh  source: api   is_fallback: false
```

Token: stored in `backend/.env` (gitignored). Sandbox key permits multiple
zones, not only Denmark as the docs suggested.

---

## Commit Log (Order, Reasoning)

| # | Commit | Why |
|---|---|---|
| 1 | `Initial project scaffold` | Empty repo + .gitignore + README |
| 2 | `Add backend FastAPI with auth and workspaces` | Core API: models, auth, workspace CRUD, risk-tier assignment |
| 3 | `Add risk scorer and sandbox selector` | ml/risk_scorer/ with 7 tests passing |
| 4 | `Add PPO scheduler env and training` | ml/scheduler/ Gymnasium env + reward + 7 tests |
| 5 | `Add LSTM prewarming model and dataset` | ml/prewarming/ model + synthetic data + 6 tests |
| 6 | `Add y-websocket collab server` | Node service for Yjs CRDT relay |
| 7 | `Add Next.js frontend with Monaco and Yjs` | UI: landing, login, register, dashboard, editor |
| 8 | `Add Docker Compose dev stack` | Local one-command bring-up of all 6 services |
| 9 | `Add Kubernetes manifests and Helm chart` | k8s/base/, k8s/helm/, k8s/karmada/ for future cluster deploy |
| 10 | `Add GitHub Actions CI and image build` | 4 CI jobs + Docker image push to GHCR |
| 11 | `Add project documentation` | docs/ARCHITECTURE, API, ML, DEPLOY, DEVELOPMENT |
| 12 | `Add carbon intensity service and API` | electricityMaps client with caching + fallback |
| 13 | `Fix frontend Dockerfile peer-deps` | Add `--legacy-peer-deps` for monaco/y-monaco conflict |
| 14 | `Fix tsconfig baseUrl for path aliases` | Path resolution attempt (didn't solve real issue) |
| 15 | `Fix webpack path alias for production` | Webpack alias in next.config.js (didn't solve real issue) |
| 16 | `Use relative imports instead of path alias` | Switched all imports off `@/` (didn't solve real issue) |
| 17 | `Fix gitignore blocking frontend lib files` | **Root cause:** `lib/` in .gitignore was blocking `frontend/src/lib/` |
| 18 | `Add public dir with robots.txt` | Next.js build required `public/` directory |
| 19 | `Add psycopg2 for Postgres driver` | Missing dependency for production Postgres |
| 20 | `Pin bcrypt to fix passlib compatibility` | passlib 1.7.4 fails on bcrypt 4.x internal check |
| 21 | `Wire carbon API token via env_file` | Carbon API token wasn't reaching backend container |

---

## Deployment Path

### Final architecture used

- **Provider:** Google Cloud Platform Free Trial ($300 credits, 90 days)
- **VM:** `e2-standard-2` (2 vCPU, 8 GB RAM)
- **Region:** `asia-south1` (Mumbai) — lowest latency from India
- **Disk:** 30 GB Balanced Persistent (resized from 10 GB after running out)
- **Runtime:** Docker Engine + Docker Compose
- **Monthly cost:** ~$59 list price → $0 against trial credits → ~5 months runway

### Public access

- **External IP:** 34.47.224.18 (static for now; can promote to reserved later)
- **Firewall rule:** `astra-allow-app-ports` — TCP 3000, 8000, 1234, 30000-32767 from 0.0.0.0/0
- **Public URLs:**
  - http://34.47.224.18:3000           Frontend
  - http://34.47.224.18:8000           Backend
  - http://34.47.224.18:8000/api/v1/docs Swagger UI
  - http://34.47.224.18:1234/healthz   Collab server

### Why this provider was chosen

Earlier attempts on **Microsoft Azure for Students** failed with
`RequestDisallowedByAzure: This policy maintains a set of best available regions
where your subscription can deploy resources`. The Student-tier subscription
rejects VM deployments in Southeast Asia, North Europe, Central India, and
South India — only some US regions remained available, which made the latency
unacceptable for an interactive IDE demo.

GCP's free trial had no such restrictions, allowed Mumbai region, and the $300
credit is more generous. Trade-off: GCP requires a card for verification (a
small ₹2 hold), but no charge occurs during the trial; auto-upgrade is opt-in,
so the user is never billed unless they explicitly continue past 90 days.

---

## Bugs Encountered and Resolved

### 1. Frontend Docker build: peer-dep conflicts
**Symptom:** `npm install --frozen-lockfile` failed inside Docker because
Monaco-editor and y-monaco have peer-dep conflicts that npm's strict resolver
refuses.

**Fix:** Added `frontend/.npmrc` with `legacy-peer-deps=true`, and updated the
Dockerfile to `COPY .npmrc` before `npm install`.

### 2. Frontend Docker build: missing `frontend/src/lib/` files
**Symptom:** `Module not found: Can't resolve '../../lib/api'` during `next build`
in Docker.

**Root cause:** The repo's root `.gitignore` had `lib/` (intended for Python
virtualenvs) — which silently matched and excluded `frontend/src/lib/api.ts`
and `frontend/src/lib/auth.ts` from git. They existed locally but were never
committed. Every "fix" I attempted before this (webpack alias, tsconfig
baseUrl, relative imports) was correct in theory but irrelevant because the
files literally weren't in the cloned repo on the VM.

**Fix:** Rewrote the .gitignore patterns to be Python-specific (e.g.
`backend/lib/`, `**/__pycache__/`) instead of the broad `lib/`.

### 3. Backend container crash: missing psycopg2
**Symptom:** `ModuleNotFoundError: No module named 'psycopg2'` on backend
startup against the Postgres DSN.

**Fix:** Added `psycopg2-binary==2.9.10` to `backend/requirements.txt`. The
binary distribution avoids needing pg dev headers at build time.

### 4. Backend register endpoint: passlib + bcrypt 4.x
**Symptom:** `ValueError: password cannot be longer than 72 bytes` raised
*before* the user's password was even hashed — triggered by passlib's internal
`detect_wrap_bug` sanity check at first call.

**Root cause:** `passlib 1.7.4` (released 2020) predates `bcrypt 4.x`'s
stricter length validation; the sanity-check sample > 72 bytes is rejected by
the new bcrypt.

**Fix:** Pinned `bcrypt==4.0.1` (last 4.x version compatible with passlib's
sanity check). Long-term fix is to migrate to argon2-cffi.

### 5. Carbon API not reaching container
**Symptom:** Carbon endpoint returned `source: "fallback"` instead of `"api"`
even though the token was set.

**Root cause:** Backend's `Dockerfile` only copies `app/` — not `.env`. The
docker-compose `environment:` block had several vars but not
`ELECTRICITY_MAPS_TOKEN`. The Pydantic `Settings` class read from `os.environ`
which had no value.

**Fix:** Added `env_file: ../backend/.env` to the backend service in
`docker-compose.yml`. `.env` stays gitignored; values not duplicated in the
inline `environment:` block fall through from the file.

### 6. GCP disk full mid-build
**Symptom:** `write /tmp/.tmp-compose-build-metadataFile-...: no space left on
device` after the frontend build succeeded but before compose could write the
image manifest.

**Root cause:** Default GCP VM came with 10 GB disk; node_modules + 5 Docker
images + intermediate build layers consumed most of it.

**Fix:** Stopped VM, resized boot disk to 30 GB via `gcloud compute disks
resize`, restarted, ran `growpart /dev/sda 1` (which on this distro was a
no-op — GCP auto-resized the partition on boot) and confirmed 30 GB available.
Then `docker system prune -af --volumes` cleared the old failed-build cache,
and `docker compose up -d` (no rebuild) brought the previously-built images
online.

### 7. Boot disk detached
**Symptom:** Editing the VM in console showed the boot disk slot empty with
"Configure boot disk" prompting to create a new Debian disk.

**Fix:** In the boot-disk dialog → switched from "Public images" tab to
"Existing Disks" tab and selected the pre-existing Ubuntu disk. All work
preserved.

---

## Secret Hygiene

- Repository is **private**.
- `.env`, `.env.local`, and `*.pem` are gitignored.
- One accidental token paste in chat was treated as compromised and revoked.
- For CI deployment, secrets should be stored as GitHub Actions encrypted
  secrets (`ELECTRICITY_MAPS_TOKEN`, `JWT_SECRET`), never inlined in YAML.

---

## What Comes Next (Phase 3 onwards)

The codebase is complete enough that future phases can be developed against
the existing scaffold:

- **Phase 3 (eBPF telemetry):** Write the libbpf probes in `ebpf/probes/`,
  build the Go aggregator in `ebpf/aggregator/`, connect the gRPC server to
  the PPO agent's state vector.
- **Phase 4 (LSTM training):** Run `python -m ml.prewarming.train` against
  collected session data, save model, wire prediction into a warm-pool
  controller microservice.
- **Phase 5 (multi-cluster):** Provision a second k3s cluster (likely another
  GCP region or Oracle Cloud Always-Free if the user can pass card
  verification), install Karmada control plane, apply
  `k8s/karmada/propagation-policy.yaml`.
- **Phase 6 (benchmarks):** Build the load tester with Locust; run PPO vs
  baselines (kube-scheduler, FIFO, random); generate paper figures.

The actual workspace pods (with code-server) are not yet provisioned by the
backend — currently `Workspace.status` transitions are mocked. To make
workspaces *actually run* code-server, the next step is to point the backend's
`workspace_service.create_workspace_for_user()` at the Kubernetes API, render
`k8s/base/workspace-template.yaml` with the chosen `runtimeClassName`, and
submit it. That work is gated on having a real k3s cluster (Phase 3+).

---

## How to Reproduce This Deployment

From a fresh GCP account:

1. Create `e2-standard-2` VM in `asia-south1`, Ubuntu 24.04, 30 GB disk.
2. Open firewall ports 3000, 8000, 1234, 30000-32767.
3. SSH in, install Docker via `curl -fsSL https://get.docker.com | sudo sh`.
4. Generate a fresh GitHub PAT (scope: `repo`, 30-day expiry).
5. `git clone https://TOKEN@github.com/PrasannaMishra001/astra-ide.git`
6. Create `backend/.env` with `ELECTRICITY_MAPS_TOKEN`, `JWT_SECRET`, etc. (see `.env.example`).
7. `cd deploy && docker compose up -d --build`.
8. Visit `http://<VM_IP>:3000` and register.

Total time: ~15 minutes (most of it Docker layer downloads on first run).

---

*Journal end: 2026-05-15.*
