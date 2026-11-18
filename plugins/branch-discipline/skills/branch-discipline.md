# Branch discipline

main is releasable at all times; all agent work happens on branches.

---
## Rules

1. Check git status and the current branch before the first write. If the tree is dirty or you are on main, create/switch to a feature branch first (feat/<topic>, fix/<topic>).
2. One logical change per commit; rebase-style cleanups beat interleaved mega-commits.
3. Never push to main/master — open a branch and let the human merge after review.
4. If the repo has no remote, commit locally and say so; do not invent push commands.
