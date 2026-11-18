# Background jobs

Anything that can outlive a request needs durable state and a heartbeat.

---
## Rules

1. Job state lives in the DB (status + result columns), never only in process memory — restarts must not lose the trail.
2. Claiming uses atomic compare-and-swap leases so two workers cannot run one job.
3. Progress is written incrementally so the UI can show something honest while it runs.
4. Terminal states are explicit: completed, failed (with reason), cancelled — "stuck" is a bug to fix, not a status.
5. Startup reconciliation requeues jobs orphaned by a crash, bounded retries, then fails honestly.
