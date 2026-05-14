# ASTRA-IDE

**Adaptive Scheduling & Telemetry-driven Resource-aware Cloud IDE**

A research-first cloud development environment combining DRL-PPO scheduling, eBPF observability,
adaptive sandboxing, LSTM-based predictive prewarming, multi-cluster federation, and CRDT collaboration.

> BTech Final Year Project — 2025–26. 3-person team. Deadline: end of June 2026.

---

## Repository Layout

```
astra-ide/
├── backend/            FastAPI service: auth, workspace API, scheduler client
├── frontend/           Next.js 14 + Monaco Editor + Yjs CRDT + xterm.js
├── collab-server/      y-websocket relay for collaborative editing
├── ml/
│   ├── scheduler/      PPO agent + Gymnasium env + reward functions
│   ├── prewarming/     LSTM session-start predictor
│   └── risk_scorer/    Code/workload risk → sandbox tier selector
├── ebpf/               libbpf probes + Go telemetry aggregator
├── k8s/                Helm charts, manifests, Karmada policies, RuntimeClasses
├── deploy/             docker-compose, build scripts, deploy automation
├── docs/               Architecture diagrams, API spec, design decisions
└── scripts/            One-shot setup, dev helpers, data generators
```

---

## Quick Start (local dev, no Kubernetes)

```bash
docker compose -f deploy/docker-compose.yml up
```

Then:
- Frontend: http://localhost:3000
- Backend:  http://localhost:8000
- API docs: http://localhost:8000/docs
- Collab:   ws://localhost:1234

---

## Component Status

| Component        | State                                          |
|------------------|------------------------------------------------|
| Backend API      | working — auth + workspace CRUD + JWT          |
| Frontend         | working — login / register / dashboard / editor|
| Collab server    | working — y-websocket relay + per-room stats   |
| PPO scheduler    | Gymnasium env + reward + training script (7 tests passing) |
| LSTM prewarming  | model + dataset generator + train script (6 tests passing) |
| Risk scorer      | full implementation (7 tests passing)          |
| K8s manifests    | base + Helm chart + Karmada policy             |
| eBPF probes      | Tetragon TracingPolicy committed; custom probes planned |
| GitHub Actions   | CI for all components + Docker image push      |

---

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system overview, data flow
- [docs/API.md](docs/API.md) — REST endpoints
- [docs/ML.md](docs/ML.md) — PPO state/action/reward spec, LSTM training
- [docs/DEPLOY.md](docs/DEPLOY.md) — local + Oracle Cloud + Karmada
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — first-time setup, conventions

---

## Tech Stack

**Frontend:** Next.js 14, TypeScript, Monaco Editor, Yjs, y-monaco, y-websocket, xterm.js, TailwindCSS

**Backend:** FastAPI, SQLAlchemy, PostgreSQL (prod) / SQLite (dev), Redis, JWT, WebSocket

**ML:** PyTorch, Stable-Baselines3 (PPO), Gymnasium, NumPy, pandas

**Infra:** Docker, k3s, Karmada, Helm, KEDA, Prometheus, Grafana, MinIO, Tetragon (eBPF)

**Runtimes:** runc, gVisor (runsc), Firecracker (via Kata)

**CI:** GitHub Actions, GHCR

---

## License

Research project — license TBD before final submission.
