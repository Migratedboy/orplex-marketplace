# Strict types

Types are the cheapest test you will ever write.

---
## Rules

1. No new "any" — including any[] and Record<string, any>. Use unknown and narrow.
2. Prefer type guards and discriminated unions over "as" assertions. Every "as" is a lie the compiler can't check.
3. Public function signatures are explicit — no inferred object soup on exports.
4. After edits run tsc --noEmit; zero new errors is the bar, not "it mostly compiles".
5. Null/undefined are handled at the boundary (validate input, then carry non-optional types inward).
