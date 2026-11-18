---
name: "composition-patterns"
title: "Composition Patterns"
description: "Replace boolean props with compound components"
category: "refactoring"
icon: "🧱"
version: 1.0.0
license: MIT
---
[SKILL: composition-patterns] Refactor boolean prop hell into compound component patterns. Replace: <Component propA propB propC /> with: <Component><Component.Header /><Component.Body /><Component.Footer /></Component>. Use React context for shared state between compound parts.
