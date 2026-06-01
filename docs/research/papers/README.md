# Research Paper Corpus

PDFs are **gitignored** (too big for the repo). Each contributor downloads them
locally. The script below pulls every arXiv paper in seconds. Paywalled papers
(Springer, Elsevier, IEEE) must be pulled on the campus LAN.

---

## arXiv — open access, one-shot download

```bash
cd docs/research/papers

declare -a IDS=(
  "2601.13579:B1-SDQN-K8s-scheduler"
  "2603.12031:B1-AGMARL-DKS"
  "2403.07905:B1-Xu-DL-RL-K8s"
  "2509.09879:B2-eHashPipe-eBPF"
  "2505.13160:B2-eBPF-diagnosis-instrumentation"
  "2510.10126:B2-FedMon-distributed-eBPF"
  "2508.02736:B2-AgentSight-eBPF"
  "2504.11338:B3-Transformer-cold-start"
  "2508.07640:B3-MPC-cold-start"
  "2512.12806:B4-Fault-Tolerant-Agent-Sandbox"
  "2603.02277:B4-LLM-container-escape"
  "2306.14750:B4-Ensemble-Forest-Container-IDS"
  "2512.24914:B5-AI-multi-cluster"
  "2501.15504:B5-Geo-distributed-survey"
  "2511.00117:B5-DCcluster-Opt"
  "2508.05949:B6-Carbon-Aware-Container-Survey"
  "2510.03970:B6-Federated-Carbon-Prediction"
  "2502.09717:B6-Carbon-Precedence-Scheduling"
  "2410.21510:B6-Probabilistic-Carbon"
  "2409.14252:B7-Egwalker-EuroSys2025"
)
for entry in "${IDS[@]}"; do
  id="${entry%%:*}"; name="${entry##*:}"
  curl -fsSL -o "${name}.pdf" "https://arxiv.org/pdf/${id}.pdf"
done
```

---

## Paywalled — fetch on the campus LAN

These are NOT on arXiv. Use your IIITM library access (IEEE Xplore /
ScienceDirect / SpringerLink should all be authenticated on the IIT-M LAN):

| Suggested filename | Paper | Source |
|---|---|---|
| `B1-PF-MPPO-FGCS-2025.pdf` | PF-MPPO: Task-dependent workflow scheduling in dynamic heterogeneous cloud | *Future Generation Computer Systems*, Elsevier 2025. DOI: 10.1016/j.future.2025.108083 — https://www.sciencedirect.com/science/article/abs/pii/S0167739X25005308 |
| `B3-Hu-Springer-Computing-2025.pdf` | Mitigating cold start problem in serverless using predictive pre-warming with ML | *Computing*, Springer 2025. DOI: 10.1007/s00607-024-01382-y — https://link.springer.com/article/10.1007/s00607-024-01382-y |
| `B4-Springer-RunC-gVisor-Kata-2022.pdf` | Performance and isolation analysis of RunC, gVisor and Kata Containers runtimes | *Cluster Computing*, Springer 2022. DOI: 10.1007/s10586-021-03517-8 — https://link.springer.com/article/10.1007/s10586-021-03517-8 |
| `B4-Firecracker-NSDI-2020.pdf` | Agache et al., *Firecracker: Lightweight Virtualization for Serverless Applications* | USENIX NSDI 2020 (**open access**) — https://www.usenix.org/conference/nsdi20/presentation/agache |

The Firecracker paper is the only USENIX one and is free; the other three need
your library login.

---

## What's stored here right now

(Everything below was pulled via the script above. Update this list when you
add the paywalled ones.)

```
B1-AGMARL-DKS.pdf                          4.1M
B1-SDQN-K8s-scheduler.pdf                  685K
B1-Xu-DL-RL-K8s.pdf                        395K
B2-AgentSight-eBPF.pdf                     462K
B2-FedMon-distributed-eBPF.pdf             1.1M
B2-eBPF-diagnosis-instrumentation.pdf      1.4M
B2-eHashPipe-eBPF.pdf                      842K
B3-MPC-cold-start.pdf                      1.2M
B3-Transformer-cold-start.pdf              1.4M
B4-Ensemble-Forest-Container-IDS.pdf       380K
B4-Fault-Tolerant-Agent-Sandbox.pdf        184K
B4-LLM-container-escape.pdf                2.0M
B5-AI-multi-cluster.pdf                    205K
B5-DCcluster-Opt.pdf                       4.4M
B5-Geo-distributed-survey.pdf              716K
B6-Carbon-Aware-Container-Survey.pdf       1.1M
B6-Carbon-Precedence-Scheduling.pdf        4.6M
B6-Federated-Carbon-Prediction.pdf         1.4M
B6-Probabilistic-Carbon.pdf                4.8M
B7-Egwalker-EuroSys2025.pdf                875K
```

Pair this corpus with `docs/research/02-literature-survey-2024-onward.md` for
the per-paper "what / how it maps to ASTRA" summaries.
