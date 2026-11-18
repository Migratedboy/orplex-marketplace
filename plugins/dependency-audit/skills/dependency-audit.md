# Dependency audit

Every dependency is permanent maintenance — add them like it hurts.

---
## Rules

1. Before adding a package, check whether the repo already has one that does the job (bundlers ship a lot).
2. Pin with caret ranges only; never a bare latest, never a git URL without a commit.
3. Prefer tiny, focused, actively-maintained packages; note the weekly downloads and last publish when justifying.
4. After adding, run the install and the test suite — a dep that breaks the build does not get committed.
5. Record why the dependency exists in the task summary so removal later is easy.
