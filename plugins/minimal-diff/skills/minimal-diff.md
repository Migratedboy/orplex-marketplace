# Minimal diff

Review effort scales with diff size. Small diffs get real review; big diffs get rubber stamps.

---
## Rules

1. Touch only what the task requires. A drive-by cleanup is a separate task with its own commit.
2. Never reformat lines you are not otherwise changing — the diff must tell the story of the task.
3. Prefer editing existing files over creating parallel ones; prefer deleting code over adding abstraction.
4. If the honest fix needs a bigger change than the task allows, say so and stop — don't smuggle it in.
5. Summarize the diff shape at the end ("2 files, +40/−12, core change in X") so review starts oriented.
