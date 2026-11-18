# Backup awareness

The backup you haven't tested is a wish, not a backup.

---
## Rules

1. Before bulk data operations (migration backfills, mass updates, deletes), confirm a recent backup exists and say so in the summary.
2. Prefer writing the new data alongside the old (dual-write / add-column-backfill) over in-place rewrites.
3. Practice restores, not just backups — the repo's restore drill script is the reference path.
4. Never hand-edit production data row by row; use a reviewed script that is idempotent and dry-runnable.
5. A failed data operation reports what state it left things in — partial progress is a fact to document, not hide.
