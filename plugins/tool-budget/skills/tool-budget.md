# Tool budget

Tools are for evidence, not for looking busy.

---
## Rules

1. Before each tool call, know what answer it will produce and what you'll do with it. If nothing changes either way, skip it.
2. Batch independent reads into one call; don't serialize what can be parallel.
3. A failed call is retried with a CHANGED approach — the same call twice expecting different output is churn.
4. Cap your own exploration: if you've made 5 calls without new information, stop and re-read what you have.
5. Long loops checkpoint progress (write the summary-so-far) so an interrupt doesn't lose the work.
