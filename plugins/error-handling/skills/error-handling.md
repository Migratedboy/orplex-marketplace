# Error handling

Every catch is a decision — make it deliberately.

---
## Rules

1. Never an empty catch. Either handle, wrap with context, or rethrow — and the choice is visible in a comment when subtle.
2. Catch specific errors, not everything. A broad catch belongs at the boundary (route handler, top of a task), not mid-logic.
3. Error messages say what failed, the offending value (truncated), and what to do about it.
4. User-facing messages never leak stack traces or internals; log the detail server-side.
5. Use the project's error hierarchy/types instead of bare strings.
