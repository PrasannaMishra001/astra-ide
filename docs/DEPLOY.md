# Deployment Guide

Three deployment modes, all at $0 cost.

---

## Mode 1: Local dev with Docker Compose

Fastest path. No Kubernetes required.

```bash
cd deploy
docker compose -f docker-compose.yml up --build
```

Then:
- Frontend: http://localhost:3000
- Backend:  http://localhost:8000
- API docs: http://localhost:8000/api/v1/docs
- Collab:   ws://localhost:1234
- MinIO console: http://localhost:9001  (admin / admin12345)

Stop with `docker compose down`. Volumes are preserved unless you add `-v`.

---

## Mode 2: Local dev WITHOUT containers (fast iteration)

Run data plane in Docker, app code natively:

```bash
# Terminal 1 — data plane
docker compose -f deploy/docker-compose.dev.yml up -d

# Terminal 2 — backend (hot reload)
cd backend
python -m venv venv && source venv/bin/activate   # (Windows: venv\Scripts\activate)
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend (hot reload)
cd frontend
npm install
npm run dev
```

---

## Mode 3: Production-like on Kubernetes

### 3.1  Single-node k3s on Oracle Cloud Always-Free

1. Create one ARM Ampere A1 VM (4 OCPU, 24 GB RAM — free)
2. SSH in, install k3s:
   ```bash
   curl -sfL https://get.k3s.io | sh -
   ```
3. Build & push images (CI does this automatically on push to main):
   ```bash
   docker build -t ghcr.io/prasannamishra001/astra-ide-backend:latest backend
   docker push ghcr.io/prasannamishra001/astra-ide-backend:latest
   # Repeat for frontend, collab-server
   ```
4. Apply manifests:
   ```bash
   kubectl apply -k k8s/base
   ```
5. Install supporting charts:
   ```bash
   helm repo add bitnami https://charts.bitnami.com/bitnami
   helm install postgres bitnami/postgresql -n astra-ide
   helm install redis    bitnami/redis      -n astra-ide
   helm install minio    bitnami/minio      -n astra-ide
   ```

### 3.2  Multi-cluster with Karmada

After two clusters are running:

```bash
helm repo add karmada-charts https://raw.githubusercontent.com/karmada-io/karmada/master/charts
helm install karmada karmada-charts/karmada -n karmada-system --create-namespace

# Join each cluster
karmadactl join cluster-a --cluster-kubeconfig=cluster-a.kubeconfig
karmadactl join cluster-b --cluster-kubeconfig=cluster-b.kubeconfig

# Apply propagation policy
kubectl apply -f k8s/karmada/propagation-policy.yaml
```

### 3.3  Sandbox runtimes

On each worker node:

```bash
# gVisor (runsc)
curl -fsSL https://gvisor.dev/archive.key | sudo gpg --dearmor -o /usr/share/keyrings/gvisor-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/gvisor-archive-keyring.gpg] https://storage.googleapis.com/gvisor/releases release main" | sudo tee /etc/apt/sources.list.d/gvisor.list > /dev/null
sudo apt-get update && sudo apt-get install -y runsc

# Kata Containers (Firecracker backend)
sudo bash -c "$(curl -fsSL https://raw.githubusercontent.com/kata-containers/kata-containers/main/utils/kata-manager.sh) install-packages-from-tag"

# Label the nodes
kubectl label node <node> sandbox.astra-ide.io/gvisor=true
kubectl label node <node> sandbox.astra-ide.io/firecracker=true

# Apply the runtime classes
kubectl apply -f k8s/base/runtime-classes.yaml
```

### 3.4  Observability stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install kube-prometheus-stack prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

helm repo add cilium https://helm.cilium.io
helm install tetragon cilium/tetragon -n kube-system
kubectl apply -f k8s/base/eBPF-tetragon-policy.yaml
```

### 3.5  KEDA autoscaling

```bash
helm repo add kedacore https://kedacore.github.io/charts
helm install keda kedacore/keda -n keda-system --create-namespace

kubectl apply -f k8s/base/keda-scaledobject.yaml
```

---

## Free resources used

| Service | Provider | Free tier |
|---|---|---|
| Compute | Oracle Cloud Always-Free | 4 OCPU + 24GB ARM, forever |
| Container registry | GitHub GHCR | Unlimited public |
| CI | GitHub Actions | 2000 min/mo private, ∞ public |
| TLS certificates | cert-manager + Let's Encrypt | Free |
| DNS | Cloudflare | Free |
| Carbon API | electricityMaps | 1000 req/mo free |

**Total monthly cost: $0**
