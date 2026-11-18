# CI green

Pushing to 'see if CI passes' spends the team's time. Reproduce first.

---
## Rules

1. When CI fails, read the failing step's log and reproduce THAT exact command locally before changing any code.
2. Environment differences (env vars, DB, OS) are the first suspect — not the code.
3. Flaky tests get fixed or quarantined with an issue link, never ignored.
4. Never merge with a red pipeline; disabling a failing job is a team decision, not an agent decision.
5. After fixing, push and WATCH the pipeline to completion, then report the run link.
