# Team Collaboration Guide — ASTRA-IDE

> For Prasanna Mishra (lead), Udit Srivastava, Yash Wani.
> Use this as the one source of truth for "what am I doing this week?"

---

## 1. Roles (matching the BTP report)

| Person | Role | Primary domains |
|---|---|---|
| **Prasanna Mishra** (lead) | Infrastructure & Scheduler | Kubernetes, DRL-PPO scheduler, eBPF, multi-cluster, Karmada, Helm, CI/CD |
| **Udit Srivastava** | AI / ML | DRL training, LSTM prewarming model, reward engineering, benchmarks, experiment notebooks |
| **Yash Wani** | IDE Frontend + Backend API | Next.js, Monaco, Yjs CRDT, FastAPI, WebSocket, xterm.js, MinIO storage |

Code ownership boundaries (so PRs don't collide):

```
backend/app/api/scheduler.*      Prasanna
backend/app/services/scheduler_* Prasanna
backend/app/services/telemetry_* Prasanna
backend/app/services/cluster_*   Prasanna
ml/scheduler/                    Udit
ml/prewarming/                   Udit
ml/risk_scorer/                  Udit + Prasanna
k8s/                             Prasanna
collab-server/                   Yash
frontend/                        Yash
backend/app/api/auth.py          Yash
backend/app/api/workspaces.py    Yash + Prasanna
backend/app/services/executor*   Yash
docs/                            Everyone (low-conflict)
```

When in doubt: whoever opens the PR first owns the file. Resolve in the PR review.

---

## 2. First-day setup for Udit and Yash

Send them this exact onboarding (it's already valid because the repo is private):

```
1. Make sure you have a GitHub account.
2. Send your GitHub username to Prasanna.
3. Wait for the repo invite email → accept it.
4. Install: git, Python 3.12, Node 20+, Docker Desktop.
5. Clone:
     git clone https://github.com/PrasannaMishra001/astra-ide.git
     cd astra-ide
6. Local dev (no cluster needed):
     cd deploy && docker compose -f docker-compose.dev.yml up -d   # Postgres + Redis + MinIO + collab
     cd ../backend && python -m venv venv && venv\Scripts\activate
     pip install -r requirements.txt
     copy .env.example .env       # then edit the carbon token line
     uvicorn app.main:app --reload
     # In another shell:
     cd frontend && npm install --legacy-peer-deps && npm run dev
7. Open http://localhost:3000 — register an account, click around.
8. Read docs/ARCHITECTURE.md, docs/API.md, and the relevant BTP report section
   for your role.
```

---

## 3. Adding teammates to the GitHub repo

On Prasanna's laptop, one-time setup:

```bash
gh api repos/PrasannaMishra001/astra-ide/collaborators/UDIT_GITHUB_USERNAME -X PUT -f permission=push
gh api repos/PrasannaMishra001/astra-ide/collaborators/YASH_GITHUB_USERNAME -X PUT -f permission=push
```

Replace the usernames with their actual GitHub handles. They'll get an email
invite. Permissions:

- `push` → can clone, branch, push, open PRs (what we want)
- `maintain` → above + manage settings (only Prasanna for now)

Or simpler — via the web UI:
1. https://github.com/PrasannaMishra001/astra-ide → **Settings** → **Collaborators**
2. **Add people** → paste their GitHub username → role: **Write**

---

## 4. Branching strategy

Trunk-based, lightweight. Two long-lived branches:

```
main      always green, always deployable
develop   integration branch (created on demand if main becomes too risky)
```

Day-to-day: short-lived feature branches off `main`.

Naming convention:

```
prasanna/scheduler-eviction-policy
udit/lstm-train-job
yash/file-explorer-monaco
```

Workflow:

```bash
git switch main && git pull
git switch -c your-name/feature-name
# … work …
git add -A && git commit -m "Short imperative subject"
git push -u origin your-name/feature-name
gh pr create --base main --fill          # opens a PR via gh CLI
# OR open via web UI
```

Merge rules:
- At least 1 reviewer (the lead, Prasanna)
- CI must pass
- No commits directly to `main` once everyone is onboarded (set this via
  repo Settings → Branches → Add rule for `main`)

---

## 5. Communication channels

| Channel | Purpose | Who |
|---|---|---|
| Daily standup (15 min, ~10am IST) | Sync blockers | All 3 |
| GitHub Issues | Tasks, bugs, decisions | All 3 — open one for any non-trivial work |
| GitHub Discussions | Research/design debate | All 3 |
| WhatsApp group | Quick "is the server up?" pings | All 3 |
| `docs/BUILD_JOURNAL.md` | Decisions worth keeping permanently | Anyone who made the decision |

Issues should follow this template:

```
Title: [Component] Short description
Body:
  ## Goal
  ## Approach
  ## Acceptance criteria
  ## Out of scope
```

---

## 6. Sharing access to the GCP VM

The VM at `34.47.224.18` should stay one person's billable resource
(Prasanna's). To let Udit and Yash deploy + test on it, give them SSH access
without sharing the gcloud account:

```bash
# On Prasanna's laptop:
gcloud compute os-login describe-profile             # ensures OS-Login is enabled

# Add Udit's public SSH key to the project (he creates it on his laptop with:
#   ssh-keygen -t ed25519 -C "udit@imt-iiitm")
# He sends Prasanna the contents of ~/.ssh/id_ed25519.pub.

gcloud compute os-login ssh-keys add --key-file=udit_ed25519.pub
gcloud compute os-login ssh-keys add --key-file=yash_ed25519.pub
```

Or simpler (GCP IAM):
1. https://console.cloud.google.com/iam-admin/iam
2. Grant role: **Compute OS Login** to their Google account email
3. They can now `gcloud compute ssh astra-cluster-a` using their own Google account

Once SSH'd in, the deploy flow stays the same:

```bash
cd ~/astra-ide
git pull origin main
cd deploy
export PUBLIC_HOST=34.47.224.18
docker compose build --no-cache backend frontend
docker compose up -d
```

---

## 7. Sharing secrets between teammates

**Never put secrets in the repo.** The two secrets right now:

- `JWT_SECRET` — backend signing key
- `ELECTRICITY_MAPS_TOKEN` — carbon API key

Distribution options, in order of preference:

1. **GitHub Secrets** (best for CI) — settings → secrets → actions. Add
   `ELECTRICITY_MAPS_TOKEN` so the Docker image build can use it. Already
   set up to be readable by `.github/workflows/docker.yml`.
2. **Shared Bitwarden / 1Password vault** (best for human use) — free tier
   supports a 3-person org.
3. **Encrypted message in WhatsApp** (acceptable for short-lived dev keys
   only, not production).
4. Each teammate generates their own electricityMaps free key (5 min) and
   stores it in their own `.env` — no sharing required.

---

## 8. Week-by-week task split (rest of the 7-week plan)

The BTP report's Section 11 already has this. Restating concretely for now:

### Week 2 (May 13–19) — currently here-ish

| Person | Concrete tickets |
|---|---|
| Prasanna | Wire eBPF probes (Tetragon helm chart on local k3s). Write the gRPC schema for telemetry → PPO state. |
| Udit     | Run `python -m ml.scheduler.train --timesteps 100000` against the simulated env, save the model, write a brief evaluation note. |
| Yash     | Add xterm.js terminal in the editor. Build the file tree component (multi-file workspaces). |

### Week 3 — Sandboxing + scheduler skeleton

| Person | Concrete tickets |
|---|---|
| Prasanna | Install gVisor + Kata on a local k3s node. Validate `kubectl apply` with each `runtimeClassName`. |
| Udit     | Tune PPO hyperparameters. Add carbon to the reward function. Generate the first comparison chart for the report. |
| Yash     | Workspace persistence: save buffer state to MinIO on shutdown, restore on start. |

### Week 4 — eBPF live + PPO online

| Person | Concrete tickets |
|---|---|
| Prasanna | Custom libbpf probe for `sched_switch`. Go DaemonSet aggregator → gRPC server. |
| Udit     | Online fine-tuning loop: feed real telemetry into PPO via the gRPC client. |
| Yash     | LSP sidecars (pylsp for Python, clangd for C++). Monaco autocomplete integration. |

### Week 5 — LSTM + multi-cluster

| Person | Concrete tickets |
|---|---|
| Prasanna | Provision the second GCP VM (or Oracle if your card now works). Install k3s, install Karmada, register both clusters. |
| Udit     | Train LSTM on the synthetic dataset. Wire prediction into the warm-pool controller. |
| Yash     | Workspace sharing UX polish (already started). User profile page. |

### Week 6 — Energy + integration

| Person | Concrete tickets |
|---|---|
| Prasanna | KEDA ScaledObject for the workspace queue. Carbon dimension in the deployed scheduler. |
| Udit     | Ablation study: PPO with/without carbon, with/without eBPF. Write the comparison section of the paper. |
| Yash     | End-to-end demo recording: register → create → collab → run → share. Polish error states. |

### Week 7 — Testing + paper

| Person | Concrete tickets |
|---|---|
| Prasanna | Locust load test, security probe in gVisor tier. |
| Udit     | Final PPO benchmark, all charts for the paper. |
| Yash     | CRDT stress test (10 simulated clients). Demo video edit. |

---

## 9. Code review checklist

When reviewing a teammate's PR, check:

- [ ] Does it build? (CI should auto-check)
- [ ] Are there tests for the new behavior?
- [ ] Does it touch shared state (cluster_state, models)?
  If yes — does it lock or use a session correctly?
- [ ] Any secrets accidentally committed? (Search for `ghp_`, `sk-`, `password`)
- [ ] New env var? — added to `.env.example` + `docker-compose.yml`?
- [ ] Does it match the BTP report section it's implementing?
- [ ] Is the commit message under 7 words and imperative? ("Add LSTM warm pool")

---

## 10. If something is broken on prod

```bash
ssh into the VM (or via Compute Engine → SSH)
cd ~/astra-ide/deploy
docker compose ps                       # which container is unhealthy?
docker compose logs --tail=80 backend   # see recent errors
docker compose restart backend          # quick recovery
```

If a deploy regression: revert with `git revert HEAD && git push`, then
re-pull and re-`docker compose up -d` on the VM.
