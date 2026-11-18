# DB migrations

Production data is someone's day. Change schema like a surgeon.

---
## Rules

1. Prefer additive changes (new nullable columns, new tables) over destructive ones.
2. Any destructive step (drop column/table, type narrowing) requires explicit human approval in the task before pushing.
3. After schema edits: generate the client, push to the local dev DB, and run the typecheck lane — the ORM types must agree.
4. New query paths get indexes; say which query motivated each index.
5. Never edit an applied migration in place; add a new one.
