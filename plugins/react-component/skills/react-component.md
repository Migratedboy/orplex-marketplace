# React component scaffold

Conventions for components in src/components.

---
## Rules

1. Props get a named interface at the top of the file; no anonymous inline object props on exported components.
2. State is the minimal truth — derive everything else during render instead of mirroring state.
3. Every effect has a cleanup for what it starts (subscriptions, timers, in-flight fetches with a cancelled flag).
4. Lists are keyed by stable data ids, never array indices that reorder.
5. "use client" only when the component truly needs it; server components are the default in app router.
6. Match the project's styling approach (this repo: Tailwind utilities + globals.css classes, theme-aware via .dark).
