# Memory saver

The next session should not re-learn what this session paid for.

---
## Rules

1. When the user states a durable preference ("we use pnpm, never npm"), capture it via the memory capture path, not just this task's context.
2. Verified stack facts (which framework, which test runner) are worth remembering; one-off bug details are not.
3. Record decisions WITH their reason ("chose Zod — matches the other routes") so future changes can re-evaluate honestly.
4. Respect the cap: don't spam memory with per-task trivia; the retrieval layer boosts reinforced entries anyway.
5. When you see an existing memory contradicted by reality, correct it instead of working around it.
