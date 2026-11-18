# Secret hygiene

Credentials never belong in source, logs, or command output.

---
## Rules

1. Read secrets from environment variables or a secrets manager — never hardcode them, even "temporarily".
2. If you see a credential-shaped string in a diff or a file you are editing, stop and flag it to the user instead of preserving it.
3. Example/env files use placeholders (your-key-here), never real-looking values.
4. When a command might echo secrets (env, printenv, config dumps), prefer the narrow command that shows only what you need.
