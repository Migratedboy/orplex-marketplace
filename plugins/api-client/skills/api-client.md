# API client conventions

One fetch wrapper, typed responses, no ad-hoc fetch spaghetti.

---
## Rules

1. Use the project's apiFetch (it resolves the API base and same-origin semantics) — never bare fetch to relative paths.
2. Responses are parsed into declared interfaces; unknown shapes fail loudly at the parse, not three screens later.
3. Requests tied to unmounted components carry an AbortSignal; races on rapid input are cancelled, not debounced into mush.
4. Error UI states are explicit: loading, empty, error, retry — never an infinite spinner.
5. Polling intervals clean up on unmount and pause when the tab is hidden where practical.
