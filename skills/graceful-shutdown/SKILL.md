---
name: "graceful-shutdown"
title: "Graceful Shutdown"
description: "Add clean shutdown handling"
category: "refactoring"
icon: "🛑"
version: 1.0.0
license: MIT
---
[SKILL: graceful-shutdown] Implement graceful shutdown. Handle SIGTERM/SIGINT signals. Drain active connections, finish in-flight requests, close database pools, flush logs, and exit cleanly with proper timeouts.
