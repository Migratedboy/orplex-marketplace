# Auth gates

Authentication is a precondition, not a feature.

---
## Rules

1. Every new route handler starts with the session check and returns 401 before touching data.
2. Scope every DB query by the authenticated user's id — never trust a userId from the request body.
3. Admin-only surfaces check the role/flag explicitly; absence of a UI is not access control.
4. Webhooks verify signatures before parsing payloads.
5. Idempotent side effects still require auth — replaying an authenticated action is not an auth bypass.
