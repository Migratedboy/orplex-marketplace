# Docker hygiene

Images are deployed artifacts — every layer is a liability you ship.

---
## Rules

1. Pin base images by digest or specific version tag — never :latest in anything deployed.
2. Order layers least→most volatile; copy lockfiles and install deps before copying source so builds cache.
3. One concern per container; multi-stage builds keep build tools out of the runtime image.
4. Run as a non-root user; expose only the ports actually used.
5. Healthchecks reflect real readiness (the app's own endpoint), not "process exists".
