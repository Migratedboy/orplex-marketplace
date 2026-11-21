# Catalog quality checks

The marketplace catalog is signed data. The checks in this guide inspect files and synthetic protocol fixtures; they do not execute catalog launch commands or contact listed providers.

## Run the offline audit

The audit requires Python 3 and the `jsonschema` package with its format-checking extras:

```sh
python3 -m pip install 'jsonschema[format]'
python3 -m unittest discover -s tests -p 'test_*.py' -v
python3 scripts/audit_catalog.py
python3 scripts/audit_catalog.py --json
```

The audit checks schema validity, index/bundle/on-disk identity and content consistency, plugin references, MCP URLs, duplicate environment variable names, documentation coverage, and whether local package versions are explicit. `--against PATH` compares review findings with another checkout so existing review debt can be reported without blocking unrelated work. New review findings fail the quality workflow; existing findings remain visible for deliberate cleanup.

Review warnings need human verification. A package that cannot be pinned by the audit's supported `npx` or `uvx` patterns is flagged for review, not automatically proven unsafe. Confirm package identity and exact versions from the upstream publisher before changing a manifest. Add a documentation URL only after checking that it is the official or maintained project documentation.

## Safe MCP protocol smoke check

Start a test MCP server yourself and bind it to loopback. Then run:

```sh
python3 scripts/mcp_smoke.py http://127.0.0.1:PORT/mcp
```

This opt-in check only accepts a literal loopback HTTP address. It performs `initialize` and `tools/list`, validates advertised input-schema definitions, follows a bounded number of pages, and never invokes a tool. It currently checks JSON-response Streamable HTTP only; it does not verify OAuth, SSE-only responses, stdio startup, permissions, or tool behavior. Those require a separately reviewed test setup and, when needed, a safe test account.

## Publishing safeguards

- Never put a credential or OAuth client secret in a public manifest. Provide the name and label of a secret the user must enter through the host's protected setup flow.
- Treat remote URLs, package launch commands, permissions, write effects, and provider claims as review items. Do not infer safety from a signature: signatures verify publisher integrity, not an upstream provider's behavior.
- Keep the existing signature, item digests, bundle, and SDK compatibility checks. Re-signing is not part of the automated quality audit.
- Use synthetic fixtures for regression tests. Do not run destructive tools or use production credentials as part of CI.

## Checks in CI

The `Catalog quality` workflow runs contract and drift tests, compares review warnings against the pull request base, builds a pinned `@orplex/sdk` revision, verifies the signed catalog and fallback behavior, and exercises plugin-hook cases with synthetic inputs. It does not have a marketplace signing key and does not publish or rewrite catalog files.
