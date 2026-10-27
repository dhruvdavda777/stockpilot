# Demo

| | File |
|---|---|
| 🎬 **Presentation video** (MP4, 3 min 46 s) | [StockPilot-Demo.mp4](StockPilot-Demo.mp4) |
| 🎬 Same video on Google Drive | [Watch on Google Drive](https://drive.google.com/file/d/1MRrkSgHbS4kNqbPPks5cNOxYc1aLxwCi/view?usp=sharing) |
| 📊 **Slide deck** (PowerPoint) | [StockPilot-Capstone.pptx](StockPilot-Capstone.pptx) |
| 📊 Slide deck (PDF) | [StockPilot-Capstone.pdf](StockPilot-Capstone.pdf) |

The video walks through the full delivery path, using screenshots captured from the live AWS deployment:

1. The application: React, FastAPI, PostgreSQL, 32 automated tests
2. CI/CD: tests, Docker build, Trivy scan, GHCR push and Helm deploy, with images tagged by commit SHA
3. Infrastructure: Terraform-built VPC and EKS, with a keyless GitHub OIDC deploy role
4. Operations: Ingress, autoscaling from 2 to 8 pods under load, Prometheus and Grafana
5. Troubleshooting: broken image, broken Service, probe, config and memory failures

More screenshots are in [`docs/screenshots`](../docs/screenshots), and the step-by-step live demo runbook is in [`docs/DEMO.md`](../docs/DEMO.md).
