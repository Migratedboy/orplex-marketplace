# Log hygiene

Logs outlive the request and travel further than you think.

---
## Rules

1. Never log tokens, keys, passwords, cookies, or full authorization headers — log their presence, not their value.
2. Personal data (emails, names) is logged as ids unless debugging specifically requires it.
3. Truncate payloads to a bounded length; log shape ("received 42-item array") over content.
4. Use the project's logger with levels — console.log in committed code is a smell.
5. Errors log the stack server-side and a sanitized message to the client.
