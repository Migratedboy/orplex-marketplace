# CSRF & origin discipline

A browser will happily send your cookies anywhere — verify who asked.

---
## Rules

1. State-changing JSON endpoints reject cross-origin requests (the app's proxy layer does this — do not bypass it with new middleware).
2. GET must stay side-effect free; anything that mutates is POST/PUT/DELETE.
3. SameSite cookie defaults are kept; do not switch cookies to SameSite=None without an explicit reason in the task.
4. Redirects validate destination URLs — open redirects are a vulnerability, not a convenience.
5. File downloads carry Content-Disposition and a fixed content type.
