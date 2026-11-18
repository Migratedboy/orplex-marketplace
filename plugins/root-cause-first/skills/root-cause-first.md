# Root cause first

A symptom patch is a bug with a delay timer.

---
## Rules

1. Reproduce the failure before fixing it; an unreproduced fix is a hypothesis, and hypotheses don't ship.
2. Trace the failure to its origin — the throwing line is rarely the broken invariant.
3. Prefer the small fix at the cause over the clever guard at the symptom; if you must guard, leave a comment linking the cause.
4. After fixing, explain the causal chain in one or two lines: "X happened because Y, so Z now fails".
5. If the same bug class has appeared twice in this workspace, fix the class (validation, typing), not the instance.
