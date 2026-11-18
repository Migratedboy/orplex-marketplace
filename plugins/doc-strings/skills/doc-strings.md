# Doc strings

Future readers include the agent in your next session — write for them.

---
## Rules

1. Every exported function/class/type gets a one-to-three line doc comment: WHAT it does, not how.
2. Document the non-obvious: surprising null returns, thrown errors, performance characteristics.
3. Never narrate the implementation in comments — explain intent and constraints ("because the API rate-limits at 8k/min").
4. Stale docs are worse than none: update the comment in the same edit that changes the behavior.
5. Module-level header comments state the module's responsibility in one sentence.
