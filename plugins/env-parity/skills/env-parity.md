# Env parity

Works on my machine is a configuration bug wearing a disguise.

---
## Rules

1. New env vars get: a safe local default, a .env.example entry with a comment, and a mention in the task summary.
2. Required-at-runtime vars fail loudly at startup with the variable NAME in the error — never a mysterious undefined downstream.
3. Secrets live only in secret stores/CI secrets — .env files with real values never get committed.
4. Prefer fewer, well-named variables over overlapping flags that can contradict each other.
5. Behavior differences between dev/prod are called out in the summary, not discovered later.
