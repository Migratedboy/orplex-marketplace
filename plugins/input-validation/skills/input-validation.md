# Input validation

The boundary is where trust ends — validate everything crossing it.

---
## Rules

1. Parse request bodies with a schema (zod) and reject with 400 + flattened issues on failure.
2. Validate query params and route params too — ids, pagination, enums — not just bodies.
3. Never interpolate raw input into shell commands, SQL, or HTML. Use parameterized APIs exclusively.
4. Length-cap and type-check strings before storing or echoing them.
5. External API responses get the same treatment: parse into a typed shape, assume nothing.
