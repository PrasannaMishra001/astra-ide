# Diagrams

Editable source diagrams for the architecture and local setup, in draw.io (diagrams.net) format.

## Files

- `architecture.drawio`, the full system: browser, Caddy, the three services, the control-plane
  decisions (risk scoring B4, PPO scheduler B1, carbon B6), the data plane, per-workspace
  containers, eBPF telemetry (B2), the anomaly IDS (B4), pre-warming (B3), and the
  Kubernetes/Karmada federation layer (B5).
- `local-setup.drawio`, the `docker compose up` boot flow: which services start, their ports,
  and how a developer reaches each one.

## How to open and edit

1. Go to https://app.diagrams.net (no account needed) or use the draw.io desktop app or the
   VS Code "Draw.io Integration" extension.
2. File → Open, and select the `.drawio` file. It is plain XML and version-controls cleanly.
3. Edit as normal. Save back to the same file to keep the change under version control.

## How to export for slides or the README

In draw.io: File → Export as → PNG (set a 2x scale and a transparent or white background for
crisp slides), or SVG for infinitely scalable vector output.

Suggested exports for the presentation:

- `architecture.png` at 2x for the system-overview slide.
- `local-setup.png` for the "run it locally" slide.

Keep the `.drawio` sources in version control; treat exported PNG/SVG as build artifacts you
regenerate when the diagram changes.

## Color legend

- Blue: application services (frontend, backend, collaboration).
- Green: stateful and external data (PostgreSQL, Redis, MinIO, carbon data).
- Orange: workspace containers and the Docker socket.
- Red: security and observability (risk scoring, eBPF telemetry, intrusion detection).
- Purple: machine-learning components (PPO scheduler, LSTM pre-warming).
- Yellow, dashed: the Kubernetes and Karmada scale-out layer.
