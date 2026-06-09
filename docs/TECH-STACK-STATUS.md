# Tech-Stack Status — every tool in Report §9, how it's actually used

Honest mapping of the report's "Tech Stack (Full)" to what exists in this repo.

**Legend**
- ✅ **Live** — running code, exercised end-to-end, unit/integration tested.
- 🔬 **Benchmarked** — used in a research eval against a real dataset/benchmark.
- 📦 **Deployable artifact** — manifest/config that is syntactically valid and
  deploys on a cluster (validated locally; cloud-applied where noted).
- 🗺️ **Roadmap** — defined/typed but not yet wired; clear path documented.

---

## Frontend
| Tool | Status | How it's used |
|---|---|---|
| Next.js 14 (React) | ✅ | `frontend/` — dashboard, workspace, login/register, OAuth callback. |
| Monaco Editor | ✅ | `CollabEditor.tsx` — the editor surface. |
| Yjs + y-monaco + y-websocket | ✅ 🔬 | Live collab via `collab-server/`; B7 CRDT convergence eval in `benchmarks/b7_collab/`. |
| **xterm.js** + WebSocket → exec | ✅ | **NEW** `Terminal.tsx` ↔ `/workspaces/:id/terminal` WS ↔ `terminal_service.py` PTY shell rooted in the workspace dir. |
| TailwindCSS | ✅ | All UI styling. |

## Backend / API
| Tool | Status | How it's used |
|---|---|---|
| FastAPI | ✅ | `backend/app` — all REST + WS endpoints, OpenAPI docs. |
| Starlette WebSocket | ✅ | Terminal WS + Yjs relay. (socket.io not used — Starlette WS suffices.) |
| JWT | ✅ | `core/security.py`, all auth. |
| bcrypt | ⚠️→✅ | Swapped to **pbkdf2_sha256** — passlib + bcrypt-4.x crashes on its 72-byte self-test; pbkdf2_sha256 is salted + work-factored and pure-Python. Documented in `security.py`. |
| **Google OAuth** | ✅ | **NEW** `oauth_service.py` + `/auth/google/login|callback`; needs `GOOGLE_CLIENT_ID/SECRET` in `.env`. |
| PostgreSQL | ✅ | SQLAlchemy + `psycopg2`; `DATABASE_URL` secret in `k8s/`. Dev uses SQLite, prod Postgres. |
| **Redis** | ✅ | **NEW** `cache.py` — Redis-or-in-memory; carbon read-through cache / warm-pool registry. Falls back cleanly with no Redis. |
| **MinIO** | ✅ | **NEW** `object_store.py` — workspace tar.gz snapshots (`/snapshot`, `/restore`); graceful when MinIO is down. |

## Scheduler / AI
| Tool | Status | How it's used |
|---|---|---|
| Stable-Baselines3 (PPO) | ✅ 🔬 | B1 scheduler; `benchmarks/b1_*`. |
| Gymnasium (custom env) | ✅ | B1 RL environment. |
| PyTorch LSTM | ✅ 🔬 | B3 prewarming predictor; `benchmarks/b3_*`. |
| kubernetes-python-client | 🗺️ | Dev scheduling is simulated; `sandbox_runtime.py` builds + audits the real Pod manifests. Real submission is the prod path. |
| K8s Scheduler Plugin (Go) | 🗺️ | PPO decisions are served via API; a Go filter/score extender is future work. |

## Infrastructure / Orchestration
| Tool | Status | How it's used |
|---|---|---|
| Docker | ✅ | Dockerfiles for backend/frontend/collab; kind nodes on the GCP VM. |
| gVisor (runsc) — L2 | 📦 🔬 | `runtime-classes.yaml` + tier selection in B4; `RUNTIME_TESTING.md`. |
| Firecracker (Kata) — L3 | 📦 🔬 | Same tiering path; highest-risk tier. |
| k3s (local) | 🗺️ | We used **kind** on the VM instead (lighter for multi-cluster); k3s path documented. |
| GKE Autopilot (cloud) | 📦 | **NEW** `infra/terraform/` provisions the Autopilot cluster. |
| **Karmada** (multi-cluster) | ✅ 📦 | B5 propagation verified on the VM; `k8s/karmada/`. **NEW** `karmada-failover.sh` — Failover feature gate + NoExecute tolerations, kills a member and reschedules. |
| **KEDA** | 📦 | `keda-scaledobject.yaml` scales the backend on **NEW** `workspace_pending_queue_total` (now published by `/metrics`). |
| **Tetragon** (eBPF) + libbpf | ✅ 🔬 | `ebpf/` probes; **NEW** first-party 171k-event syscall corpus on the VM → B4 IDS (`eval_ids_tetragon.py`, acc 0.80 / FPR 0.10). |
| **Prometheus + Grafana** | ✅ 📦 | **NEW** `/metrics` (HTTP RED + domain series: workspaces, tier, scheduler, carbon, queue) + `ServiceMonitor` + Grafana dashboard JSON. |
| Alertmanager | 🗺️ | Ships with kube-prometheus-stack; SLA alert rules not yet authored. |
| Longhorn | 🗺️ | MinIO covers object storage; Longhorn (block) is future. |
| GitHub Actions (CI/CD) | ✅ | `.github/workflows/ci.yml` + `docker.yml`. |
| GHCR (registry) | 📦 | Image refs (`ghcr.io/...`) in manifests + `docker.yml`. |

## Development Tools
| Tool | Status | How it's used |
|---|---|---|
| Helm | ✅ 📦 | `k8s/helm/astra-ide/` chart; used to install Tetragon/Karmada deps on the VM. |
| **Terraform** | 📦 | **NEW** `infra/terraform/` GKE Autopilot IaC. |
| kubectl | ✅ | Cluster ops on the VM. |
| k9s | 🗺️ | Optional TUI; not required. |
| **Skaffold** | 📦 | **NEW** `skaffold.yaml` build+deploy+live-reload loop. |
| pytest | ✅ | 46 backend tests (run via unittest; pytest-compatible). |
| **locust** | 📦 | **NEW** `benchmarks/load/locustfile.py` load test of the hot API paths. |

---

### Net change this round
Newly wired/created: **xterm.js terminal, Google OAuth, Redis cache, MinIO
snapshots, Prometheus `/metrics` + Grafana dashboard + ServiceMonitor, KEDA
scale metric, first-party Tetragon corpus + IDS, Karmada failover, Terraform,
Skaffold, locust, `/system/status`.** What's left is deliberately roadmap:
kubernetes-python-client live submission, the Go scheduler plugin, Alertmanager
rules, Longhorn, k9s — none block the demo and each has a documented path.
