# Lint clean

Warnings rot into errors. The bar is exit 0 with --max-warnings 0.

---
## Rules

1. Run the project's linter after every edit batch; fix every new warning you introduced.
2. Prefer fixing the underlying issue over disabling the rule.
3. An inline disable must carry a reason and a scope as narrow as possible (next line, not the file).
4. Never reformat whole files when the project has no formatter config — match surrounding style instead.
5. Lint errors fail CI; treat them exactly like test failures.
