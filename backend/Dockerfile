FROM python:3.12-slim

WORKDIR /app

# System deps:
#   - build-essential, libpq-dev: needed by bcrypt + psycopg2 pip wheels
#   - g++, gcc: code executor compiles & runs C++ snippets
#   - nodejs:   code executor runs JavaScript snippets
#   - bash:     code executor runs shell snippets (already in slim, but explicit)
#   - git:      "Import a repository" (workspace_files.import_repo)
#   - curl:     used by container healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev g++ gcc bash git curl ca-certificates gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Docker CLI only (no daemon) — lets the backend manage real per-workspace
# containers through the host's mounted /var/run/docker.sock.
RUN curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.3.1.tgz \
      -o /tmp/docker.tgz \
    && tar -xzf /tmp/docker.tgz -C /tmp \
    && mv /tmp/docker/docker /usr/local/bin/docker \
    && rm -rf /tmp/docker /tmp/docker.tgz \
    && docker --version

# kubectl — the backend drives workspaces that live on OTHER clusters through it
# (pod_service / remote_files): creating the pod, exec'ing the terminal in, and
# reading files inside it. Pinned to the k3s server version the fleet runs.
RUN curl -fsSL https://dl.k8s.io/release/v1.31.4/bin/linux/amd64/kubectl \
      -o /usr/local/bin/kubectl \
    && chmod +x /usr/local/bin/kubectl \
    && kubectl version --client=true

# Build context is the REPO ROOT (see docker-compose / CI) so the ml/ package is
# reachable. This is required for real model serving: pfmppo_inference and
# cp_ppo_inference import ml.scheduler.pfmppo.* at runtime.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/app/ ./app/
COPY ml/ ./ml/

ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
