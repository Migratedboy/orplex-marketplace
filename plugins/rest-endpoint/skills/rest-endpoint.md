# REST endpoint scaffold

Conventions for a new route handler under src/app/api.

---
## Shape

- export const dynamic = "force-dynamic" on every handler that reads state.
- Auth first: getServerSession(jwtOnlyOptions) → 401 before any work.
- Validate the body with a zod schema; return 400 with the flatten() output on failure.
- Wrap DB access in try/catch; return typed JSON errors, never raw exception text.
- Success responses: the created/updated row (or { ok: true }), status 200/201.

## Skeleton

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { jwtOnlyOptions } from "@/lib/auth";
import { z } from "zod";

const BodySchema = z.object({ name: z.string().min(1).max(200) });

export async function POST(request: NextRequest) {
  const session = await getServerSession(jwtOnlyOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid body", issues: parsed.error.flatten() }, { status: 400 });
  // ...do the work...
  return NextResponse.json({ ok: true });
}
```
