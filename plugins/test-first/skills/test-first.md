# Test-first

A bug you can't reproduce in a test isn't fixed — it's postponed.

---
## Rules

1. For every bug fix, first write the smallest test that fails on the current code. Watch it fail. Then fix.
2. New features ship with at least one test per acceptance criterion.
3. Refactors run the existing suite before and after — green to green, no snapshot drift.
4. Never weaken an assertion to make a test pass. If the test is wrong, change the test and say why.
5. Prefer testing observable behavior over private internals.
