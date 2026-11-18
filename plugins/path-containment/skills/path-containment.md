# Path containment

A path from outside the workspace is untrusted input.

---
## Rules

1. Resolve every user-supplied path and verify it is inside the workspace root before reading or writing.
2. Reject ".." traversal explicitly even after resolution — depth of defense, not cleverness.
3. Never follow symlinks out of the root; treat a symlinked escape as a hard error.
4. Relative paths in agent tools are resolved against the workspace, never the process cwd.
5. Log the refused path (truncated) when a containment check fails — it is a signal, not noise.
