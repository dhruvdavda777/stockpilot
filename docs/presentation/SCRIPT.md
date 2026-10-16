# StockPilot: Demo Video Script (about 3½ minutes)

The deck is `StockPilot-Capstone.pptx`, with a PDF copy alongside. Each slide's speaker notes contain the same text as below. Aim for roughly 25 seconds per slide.

**Slide 1: StockPilot**
Hi, I'm Dhruv. This is StockPilot, my DevOps capstone. It's an inventory management app, and the point of the project is the journey: how a single Git commit travels through testing, security scanning, a container registry and Terraform-built AWS infrastructure, into a monitored, autoscaling Kubernetes cluster.

**Slide 2: The application**
The app has a React frontend, a FastAPI backend with fourteen REST endpoints, and PostgreSQL with Alembic migrations. You can manage products and categories, and every stock change is written to an audit log. It also exposes health, readiness and Prometheus metrics endpoints. Thirty-two automated tests run on every push.

**Slide 3: From commit to cluster**
Here's the delivery path. A push to main triggers GitHub Actions: backend and frontend tests first, then both Docker images are built and scanned with Trivy. If a test fails or Trivy finds a fixable high or critical vulnerability, the pipeline stops and nothing ships. Images go to GitHub Container Registry, tagged with the commit SHA, and Helm deploys them to EKS. The deploy job logs in to AWS through OIDC, so no AWS keys are stored in GitHub.

**Slide 4: CI/CD and security**
This is a real run: all six jobs green, ending with the deploy to EKS. Trivy found zero high or critical vulnerabilities in both images, which run as non-root users. Every third-party GitHub Action is pinned to a commit SHA, which protects the pipeline against tampered action tags.

**Slide 5: Infrastructure as code**
All AWS infrastructure is Terraform: a VPC across two availability zones with public and private subnets and a NAT gateway, an EKS cluster with a managed node group, and the GitHub OIDC deploy role. Sixty-four resources from one command, and I destroyed all of it after recording to avoid cost.

**Slide 6: Autoscaling and monitoring**
Helm deploys the frontend, backend and PostgreSQL behind an Nginx Ingress. During a load test, the Horizontal Pod Autoscaler scaled the backend from two to eight pods. Prometheus scrapes each pod's metrics endpoint, and this Grafana dashboard shows about 350 requests per second, 96 milliseconds p95 latency and zero errors, along with the replicas climbing.

**Slide 7: Troubleshooting lab**
Finally, troubleshooting. I built five broken scenarios: a wrong image tag, a Service whose selector doesn't match, a bad readiness probe, a missing Secret and an out-of-memory limit. Here on EKS you can see the ImagePullBackOff and the empty endpoints, then both fixed. I also took the database down: readiness pulls pods out of traffic, and liveness keeps them from restarting.

**Slide 8: Every step automated and observable**
To sum up: thirty-two tests, zero critical vulnerabilities, autoscaling from two to eight pods, and five failure drills, all on a pipeline that goes from a Git push to a monitored Kubernetes cluster without manual steps. The code, Terraform, Helm chart and screenshots are all in the GitHub repo. Thank you.
