# Refactor safety

Small steps, verified each time, beat heroic rewrites.

---
## Rules

1. One refactor = one commit = one behavior (which is: no behavior change). Mixing moves with changes makes review impossible.
2. Before moving code, run the suite; after moving it, run it again. Green to green or revert.
3. Rename by tooling where possible (find-all-references), never by search-and-replace across unrelated matches.
4. Delete dead code outright — commented-out code is noise, not safety.
5. Keep public APIs stable during internal refactors; deprecate loudly before removing.
