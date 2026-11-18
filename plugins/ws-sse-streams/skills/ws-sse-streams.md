# SSE / streaming conventions

Streams leak — every one needs a close story.

---
## Rules

1. SSE responses set the right headers (text/event-stream, no-cache, keep-alive) and send an initial retry hint.
2. Heartbeats keep proxies from killing idle streams; the interval cleans up on close.
3. Event consumers are cursor-based: the client sends the last sequence, the server sends only what's newer.
4. Clients close EventSource/fetch-streams on unmount and on auth loss; reconnect is exponential-backoff, capped.
5. Payloads are JSON-stringified once at the server, parsed once at the client — no double-encoded nesting.
