# ASTRA-IDE — Learning Path & Concrete Tasks for Udit & Yash

> **Read this first, in order.** It tells you (1) what's already built and how, (2) what you need to learn,
> (3) what to build next. Each section ends with concrete tickets.

---

## Part A — What's already built (so you don't redo it)

Everything in the repo right now is **functional and deployed** at
`http://34.47.224.18:3000`. Don't rewrite, **extend**.

### A.1 The seven research contributions — implementation status

| # | Contribution | Status | Where it lives |
|---|---|---|---|
| 1 | **DRL-PPO Scheduler** | Env + reward done, heuristic live, model not yet trained | `ml/scheduler/`, `backend/app/services/scheduler_service.py` |
| 2 | **eBPF Telemetry** | Simulator emitting events; Tetragon TracingPolicy committed | `backend/app/services/telemetry_loop.py`, `k8s/base/eBPF-tetragon-policy.yaml` |
| 3 | **Adaptive Sandboxing** | **fully working** — risk scorer assigns tier on every workspace create | `ml/risk_scorer/`, `backend/app/services/workspace_service.py:compute_risk_score` |
| 4 | **LSTM Prewarming** | Model defined, synthetic dataset generator works, not trained yet | `ml/prewarming/` |
| 5 | **Multi-Cluster Federation** | Karmada manifests committed; single-cluster for now | `k8s/karmada/propagation-policy.yaml` |
| 6 | **Carbon-Aware Scheduling** | **fully working** — live electricityMaps API in reward function | `backend/app/services/carbon_service.py`, `ml/scheduler/reward.py` |
| 7 | **Yjs CRDT Collaboration** | **fully working** — Monaco + Yjs + y-websocket relay | `frontend/src/components/CollabEditor.tsx`, `collab-server/server.js` |

### A.2 How each piece works — read these files

Spend 30 min reading each. **Do not skip this** — half the bugs in any project come from re-inventing
something that already exists.

#### Backend (FastAPI)
- `backend/app/main.py` — entry point. Mounts routes + the telemetry background task.
- `backend/app/api/__init__.py` — registers all routes. Look here first to find an endpoint.
- `backend/app/api/auth.py` — register / login / `/me`. Uses JWT (HS256).
- `backend/app/api/workspaces.py` — CRUD + share + execute.
- `backend/app/services/workspace_service.py` — creates a workspace, calls risk scorer + scheduler, records events.
- `backend/app/services/scheduler_service.py` — picks (cluster, node) for a new pod. Mirrors PPO's reward.
- `backend/app/services/cluster_state.py` — in-memory model of 2 clusters × 2 nodes with live drifting metrics.
- `backend/app/services/telemetry_loop.py` — background asyncio task that drifts node metrics + emits events.
- `backend/app/services/events_service.py` — writes/reads `SchedulerEvent` rows.
- `backend/app/services/carbon_service.py` — electricityMaps client with caching + fallback.

#### ML (Python, no FastAPI)
- `ml/risk_scorer/scorer.py` — pure function. Inputs: language, network, fs, user trust, code text. Output: `(risk_score, sandbox_tier)`. **7 unit tests.**
- `ml/scheduler/env.py` — Gymnasium environment that simulates the cluster for PPO training.
- `ml/scheduler/reward.py` — reward function (5 weighted dimensions + SLA penalty).
- `ml/scheduler/train.py` — Stable-Baselines3 training driver. Run once → saves `runs/ppo/model.zip`.
- `ml/prewarming/model.py` — PyTorch LSTM. Input: user session sequences. Output: P(next session in 15 min).
- `ml/prewarming/dataset.py` — synthetic session generator.
- `ml/prewarming/train.py` — training driver.

#### Frontend (Next.js + TypeScript)
- `frontend/src/app/page.tsx` — landing page (logo, canvas text, globe, bento grid, team).
- `frontend/src/app/login/page.tsx`, `register/page.tsx` — auth pages.
- `frontend/src/app/dashboard/page.tsx` — workspaces list, create modal, summary stats.
- `frontend/src/app/workspaces/[id]/page.tsx` — opens the collaborative editor.
- `frontend/src/app/clusters/page.tsx` — live cluster topology + node metrics + activity feed.
- `frontend/src/app/benchmarks/page.tsx` — PPO vs baselines bar charts.
- `frontend/src/components/CollabEditor.tsx` — Monaco + Yjs + y-monaco binding. Has the toolbar (Run, Download, Share, language picker), status bar, keybindings.
- `frontend/src/components/ui/*` — Aceternity-style primitives (Spotlight, Aurora, Sparkles, BentoGrid, ThreeDCard, CanvasText, TextHoverEffect, InteractiveGlobe, AnimatedTerminal).
- `frontend/src/lib/api.ts` — Axios client + every backend endpoint typed.
- `frontend/src/lib/auth.ts` — Zustand store with localStorage persistence (the one that fixed our refresh-logout bug).

#### Collab server
- `collab-server/server.js` — Node + `y-websocket`. Relays Yjs CRDT updates per room.

#### Infrastructure
- `deploy/docker-compose.yml` — local dev stack (Postgres, Redis, MinIO, backend, frontend, collab).
- `k8s/base/*` — Kubernetes manifests with RuntimeClasses (runc/gvisor/firecracker), KEDA scaler, eBPF policy.
- `k8s/karmada/propagation-policy.yaml` — multi-cluster routing rule.
- `.github/workflows/ci.yml` — runs on every push: lint, build, test for all 4 services.
- `.github/workflows/docker.yml` — pushes images to GHCR on merge to main.

---

## Part B — Tech stack to learn (organized by role)

Don't try to learn everything. Learn the parts for **your role**, in order. Each topic lists the
minimum knowledge to be useful, plus the best free source.

### B.1 For Yash (Frontend + Backend API lead)

#### Week 1 (the basics — must know to read our code)
| Topic | Why | Source |
|---|---|---|
| **TypeScript fundamentals** | Frontend is 100% TS | https://www.typescriptlang.org/docs/handbook/2/basic-types.html (skim 1-3 hrs) |
| **React hooks** — `useState`, `useEffect`, `useRef`, `useContext` | Every component uses them | https://react.dev/learn (the "Quick Start") |
| **Next.js App Router** — server vs client components, `app/` directory | Our routing model | https://nextjs.org/learn (free official tutorial, 2 hours) |
| **TailwindCSS** — utility classes | All styling | https://tailwindcss.com/docs/utility-first |
| **Async / await + fetch** | API calls | already in every page.tsx |

#### Week 2 (the libraries we use)
| Topic | Why | What to learn |
|---|---|---|
| **Zustand** state management | `useAuth()` is the global store | docs section "Basic Use" — 20 min |
| **Framer Motion** | All page animations | `motion.div`, `initial`, `animate`, `transition` |
| **Axios + interceptors** | API client in `lib/api.ts` | how request interceptors attach JWT |
| **Monaco Editor** | Code editor | `onMount` API, `editor.IStandaloneCodeEditor` |
| **Yjs + y-monaco + y-websocket** | CRDT collaboration | https://docs.yjs.dev/getting-started/a-collaborative-editor |

#### Week 3 (backend Python)
| Topic | Why | Source |
|---|---|---|
| **FastAPI** | Backend framework | https://fastapi.tiangolo.com/tutorial/ (official) |
| **SQLAlchemy 2.0** (typed) | DB models | read our `app/models/*.py` then docs section "Working with Data" |
| **Pydantic v2** | Request/response shapes | read our `app/schemas/*.py` |
| **JWT** | Authentication | https://jwt.io/introduction (one page) |
| **asyncio basics** | The telemetry loop | `asyncio.create_task`, `await asyncio.sleep` |

#### Concrete tasks for Yash (next 4 weeks)

| # | Task | File touch points | Difficulty |
|---|---|---|---|
| 1 | **xterm.js terminal panel** in the editor — a new tab alongside Output/Problems | `CollabEditor.tsx`, `BottomPanel.tsx`, install `xterm` + `@xterm/addon-fit` | medium |
| 2 | **File explorer** — left sidebar listing files in a multi-file workspace. Add a `WorkspaceFile` model on the backend, GET/POST endpoints. | new component + new backend table | hard |
| 3 | **LSP autocomplete** — Monaco completion provider that asks the backend, backend forwards to a `pylsp` subprocess | `executor_service.py` extension + new `lsp_service.py` | hard |
| 4 | **MinIO workspace persistence** — on workspace stop, dump buffer to `minio:9000/workspaces/{id}/main.{ext}`. On open, restore. | new `storage_service.py` using `boto3` | medium |
| 5 | **User profile page** at `/profile` — show stats (workspaces, runs, languages used) | new page + backend stats endpoint | easy |
| 6 | **Workspace settings page** with members + sandbox tier preview + danger-zone delete | new page reusing ShareModal logic | easy |

### B.2 For Udit (AI / ML lead)

#### Week 1 (the basics — must know to read our code)
| Topic | Why | Source |
|---|---|---|
| **Python type hints + dataclasses** | Every ML module uses them | https://docs.python.org/3/library/typing.html (skim) |
| **NumPy** — arrays, broadcasting, `np.random` | The PPO state vector is an `np.ndarray` | https://numpy.org/learn/ |
| **Markov Decision Process** — state, action, reward, policy | RL foundation | https://spinningup.openai.com/en/latest/spinningup/rl_intro.html |
| **PyTorch basics** | LSTM model is pure PyTorch | https://pytorch.org/tutorials/beginner/basics/intro.html (1 hour) |

#### Week 2 (RL specifically)
| Topic | Why | Source |
|---|---|---|
| **Policy gradient methods** (REINFORCE → PPO) | What our scheduler does | Spinning Up: PPO page (https://spinningup.openai.com/en/latest/algorithms/ppo.html) |
| **Stable-Baselines3** | Our PPO implementation | https://stable-baselines3.readthedocs.io/en/master/guide/quickstart.html |
| **Gymnasium** (formerly OpenAI Gym) | Env interface | https://gymnasium.farama.org/introduction/basic_usage/ |
| **TensorBoard** | Visualize training | `tensorboard --logdir runs/ppo/tensorboard` |

#### Week 3 (LSTM + neural net basics)
| Topic | Why | Source |
|---|---|---|
| **RNN → LSTM** intuition | Prewarming model | https://colah.github.io/posts/2015-08-Understanding-LSTMs/ (best blog post on LSTMs) |
| **Binary cross-entropy loss** | What our LSTM minimizes | PyTorch `nn.BCELoss` docs |
| **Adam optimizer** | What we use | one paragraph in any PyTorch tutorial |
| **Precision / recall / F1** | Evaluation metrics | https://scikit-learn.org/stable/modules/model_evaluation.html#precision-recall-and-f-measures |

#### Concrete tasks for Udit (next 4 weeks)

| # | Task | Difficulty | What you'll learn |
|---|---|---|---|
| 1 | **Train the PPO model end-to-end.** Run `python -m ml.scheduler.train --timesteps 200000 --out runs/ppo_v1`. Open TensorBoard. Write a 1-page eval note in `ml/scheduler/EVAL.md` with: reward curve screenshot, hyperparameters, final mean reward. | easy | PPO training, hyperparameter logging |
| 2 | **Tune the reward weights.** Try (α=0.5, β=0.2, γ=0.1, δ=0.2) vs the default. Compare final eval reward. Document in EVAL.md. | medium | Reward engineering — the most impactful research lever |
| 3 | **Train the LSTM prewarmer.** Run `python -m ml.prewarming.train --users 100 --days 30 --epochs 20`. Target F1 > 0.75. Save model. | easy | LSTM training, classification metrics |
| 4 | **Wire the trained PPO into the backend.** In `scheduler_service.decide_placement()`, if `runs/ppo/model.zip` exists, load it and call `model.predict(obs)` instead of the heuristic. | medium | Bridging RL → production code |
| 5 | **Ablation study.** Re-train PPO without the carbon dimension. Compare the latency / utilization charts. Write up in EVAL.md — this is paper-worthy. | hard | Research methodology |
| 6 | **Benchmarks: replace synthetic latency with model prediction.** Improve `backend/app/api/benchmarks.py` to use the trained PPO for the "ppo" row instead of the heuristic. | medium | Putting the model in the demo loop |

### B.3 Shared (everyone)
| Topic | Why | Source |
|---|---|---|
| **Git branching + PRs** | Workflow | https://docs.github.com/en/get-started/using-git |
| **Docker basics** — image, container, compose | Local dev | https://docs.docker.com/get-started/ |
| **Linux command line** — `cd`, `ls`, `grep`, `tail`, `vim/nano` | VM work | any "Linux for beginners" cheatsheet |
| **HTTP + REST** — methods, status codes, JSON | Backend API | Mozilla Web Docs |

---

## Part C — What's left vs. the BTP report

Here's exactly which Week's deliverables are open. Take any task you fancy — open a GitHub Issue first.

### Week 2 deliverables (per BTP report Section 10)
- [x] Two users collaborating on same file in real-time (Yjs)
- [x] Cursors visible for all collaborators (awareness)
- [ ] **LSP autocomplete working (at least Python)** — Yash
- [ ] **Terminal working inside workspace** — Yash (xterm.js)
- [ ] **Workspace saved to MinIO on teardown** — Yash

### Week 3 deliverables
- [ ] **gVisor RuntimeClass actually working on a k3s node** — Prasanna
- [x] Risk scorer assigning tiers correctly
- [ ] Workspace pods launching with different sandboxing tiers (we have manifests but no live k3s)
- [x] PPO environment defined and training on synthetic data
- [ ] **Basic scheduling plugin routing pods via risk tier in K8s** — Prasanna

### Week 4 deliverables
- [ ] **Tetragon deployed, events streaming** — Prasanna
- [ ] **Custom eBPF probe loading and capturing sched events** — Prasanna
- [ ] Telemetry daemon aggregating 500ms windows
- [ ] PPO agent consuming real eBPF-enriched state
- [ ] First comparison: PPO vs. default kube-scheduler (we have synthetic — need real)

### Week 5 deliverables
- [ ] **LSTM model trained, predicting session starts > 70% accuracy** — Udit
- [ ] **Warm pod pool controller** — Udit
- [ ] Two Kubernetes clusters federated via Karmada — Prasanna
- [ ] PPO scheduling across both clusters

### Week 6 deliverables
- [x] Carbon intensity integrated into PPO reward
- [ ] Batch workload deferral working — Udit
- [ ] KEDA autoscaling responding to workspace queue — Prasanna
- [ ] Full E2E user journey working without bugs (mostly there)

### Week 7 deliverables
- [ ] **Benchmark results: PPO vs. 3 baselines** (partial — the page exists, needs real model) — Udit
- [ ] Load test results: 50 concurrent users handled
- [ ] CRDT convergence proof: 10 users, verified correct
- [ ] Sandbox overhead table with numbers
- [ ] **LSTM accuracy: F1 score > 0.75** — Udit
- [ ] **Final technical report (IEEE format, 8–10 pages)** — All 3
- [ ] **Video demo (5 min)** — All 3

---

## Part D — Areas where the existing implementation can be improved

Read these critically — these are good "PR opportunities" to learn the codebase.

### D.1 Risk scorer (`ml/risk_scorer/scorer.py`)
**Current:** 5 hand-tuned weights. Static thresholds.

**Improvements possible:**
- Use a small classifier trained on real (workload, escape-attempt) pairs.
- Use AST analysis instead of substring matching for `_scan_code`. Substring scan flags `subprocess` even in a comment.
- Adjust thresholds based on user history (a user who's never escaped → lower threshold).

### D.2 PPO reward function (`ml/scheduler/reward.py`)
**Current:** Linear combination of 6 terms + SLA penalty.

**Improvements possible:**
- Non-linear shaping: penalty for utilization > 0.85 should be exponential, not linear (real K8s users do this).
- Co-location bonus is hard-coded at 0 — could compute "same-language pods on same node = better page cache hit".
- Add a queue-time term: punishes leaving the workload pending too long.

### D.3 LSTM prewarming (`ml/prewarming/model.py`)
**Current:** 2-layer LSTM, 4 input features, BCE loss.

**Improvements possible:**
- Add user-embedding layer (currently we treat user_id as a one-hot lookup; better as a learned embedding).
- Try a Transformer encoder instead — small datasets benefit from attention.
- Use ROC-AUC as the eval metric (better than F1 for ranking).

### D.4 Scheduler heuristic (`backend/app/services/scheduler_service.py`)
**Current:** Same weighted-sum as PPO's reward function.

**Improvements possible:**
- Sort by score AND respect a "node affinity" hint (some users always want their workspace on the same node for caching).
- Add a hysteresis term to avoid bouncing a workload between two equally good nodes.

### D.5 Activity feed (`backend/app/services/telemetry_loop.py`)
**Current:** Synthesized eBPF / carbon / prewarm events.

**Improvements possible:**
- When PPO is trained, emit the actual confidence + action probabilities, not random numbers.
- Add a "decision audit log" — for every workspace creation, log every node's score so we can debug the choice.

### D.6 Frontend collab editor (`frontend/src/components/CollabEditor.tsx`)
**Current:** Single-file Monaco buffer per workspace.

**Improvements possible:**
- Multiple Yjs sub-documents → multiple files in one workspace.
- Persist the Yjs doc to MinIO on disconnect (already in the BTP report's Week 2 plan).
- Add the LSP language client (Monaco supports it natively).

### D.7 Risk scorer integration in `compute_risk_score`
**Currently:** the backend has its own duplicate copy of the scorer (intentional, to avoid importing the ml package).

**Improvement:** publish `ml/risk_scorer` as an installable package (`pip install -e ml/`), import it cleanly in the backend. This is one of the patterns from Section 6.4 of the report.

---

## Part E — How the two of you (Udit, Yash) can start TODAY

### Right now (30 min)
1. Accept the GitHub invite (check your email — the repo invite link).
2. Clone the repo: `git clone https://github.com/PrasannaMishra001/astra-ide.git`
3. Open `docs/TEAM_GUIDE.md` and `docs/LEARNING_AND_TASKS.md` (this file).
4. Read Part A above. Click the file paths to skim each one.

### This week (3-4 hours)
- **Yash:** follow Section B.1 Week 1 (TS / React / Next.js basics). Run the dev stack locally per `docs/DEVELOPMENT.md`.
- **Udit:** follow Section B.2 Week 1. Install Python + PyTorch + Stable-Baselines3. Run the existing tests: `python -m unittest ml.risk_scorer.test_scorer ml.scheduler.test_env ml.prewarming.test_dataset -v`.

### By next week
- **Yash:** open your first PR with the xterm.js terminal panel. Pattern after `BottomPanel.tsx`.
- **Udit:** train PPO once. Save the model. Commit a 1-page `ml/scheduler/EVAL.md`.

---

## Part F — Working agreement (the 5 rules)

1. **No commits to `main`.** Always use a branch. Branch protection now enforces this.
2. **Every PR needs 1 review.** Reviewer must be one of the OTHER two team members.
3. **Don't break CI.** Run the relevant tests locally before pushing.
4. **Open an Issue first** for anything bigger than 30 minutes of work.
5. **Read before writing.** If you're about to touch a file you've never opened, read it top-to-bottom first.
