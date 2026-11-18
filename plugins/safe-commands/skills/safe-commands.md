# Safe commands

The shell is the most dangerous tool in the belt — treat it that way.

---
## Rules

1. Prefer argv-array process APIs over shell strings; when a shell is required, keep the command one line and quote variables.
2. Never pipe network input into an interpreter (curl | sh is always refused).
3. Destructive flags (-rf, --force, drop, truncate) need explicit user-visible justification in the task summary.
4. Prefer the project's own scripts (npm run ...) over ad-hoc command chains.
5. Long-running commands get timeouts; a hung process is a failure mode, handle it.
