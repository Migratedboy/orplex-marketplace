# Clean imports

The import graph is the architecture — keep it honest.

---
## Rules

1. Remove imports you no longer use in the same edit that stops using them.
2. Prefer the project's path alias (@/...) over fragile relative chains like ../../../.
3. Never introduce a circular dependency; if two modules need each other, extract the shared piece.
4. Type-only imports use "import type" where the bundler supports it.
5. Heavy optional dependencies load via dynamic import inside functions, not at module top-level.
