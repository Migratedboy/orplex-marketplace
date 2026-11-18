# Notification events

Notifications are user-facing UI — write them like product copy, not logs.

---
## Rules

1. Long-running outcomes (run completed/failed, approval needed) emit into the notification center, not just console state.
2. Copy is specific: "Deploy of api-service failed — image build exited 1", never "Something went wrong".
3. Every notification carries a route/link target so clicking it lands somewhere useful.
4. Deduplicate repeat events for the same entity; aggregate storms ("3 files updated") instead of spamming.
5. Failure notifications include the first actionable fix, not just the error class.
