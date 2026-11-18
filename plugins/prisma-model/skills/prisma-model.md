# Prisma model scaffold

Conventions for new models in prisma/schema.prisma.

---
## Rules

1. Every model: id String @id @default(cuid()), createdAt DateTime @default(now()); add updatedAt when rows mutate.
2. Foreign keys get an @@index([fk]); every query path in the task gets an index — say which query motivated each one.
3. Map to snake_case plural tables: @@map("task_runs").
4. Json columns are for genuinely shape-flexible data; anything queried or filtered gets real columns.
5. After editing the schema: npx prisma generate (types) and npx prisma db push (local dev DB) — then run the typecheck lane.
