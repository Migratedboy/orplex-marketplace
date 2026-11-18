# Conventional Commits

A commit message is addressed to the person bisecting a regression at 2am.

---
## Rules

1. Format: type(scope): subject — types: feat, fix, refactor, test, docs, chore, perf, build, ci.
2. Subject in imperative mood, ≤72 chars, no trailing period ("fix(auth): reject empty session tokens").
3. The body explains WHY the change exists and what tradeoffs were made; the diff already shows what.
4. Breaking changes get a "BREAKING CHANGE:" footer describing the migration.
5. One logical change per commit — if the subject needs "and", it wants to be two commits.
