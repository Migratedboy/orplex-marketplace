# orplex-marketplace

The signed data catalog behind Orplex Code's skills, MCP servers and plugins.

`@orplex/sdk` fetches this repo at runtime (`loadCatalog`), verifies the index
signature, then verifies each item's sha256 before using it. **Nothing here is
executable** — a marketplace that ships code is a remote-code-execution channel
with extra steps, so the format is deliberately inert: Markdown, JSON and PNG
only.

```
catalog/index.json        the signed catalog the app downloads
catalog/public-key.txt    Ed25519 public key (base64url SPKI DER)
keys/marketplace-public.pem  same key, PEM (for the validator)
skills/<id>/SKILL.md      frontmatter + prompt body
mcp/<id>/manifest.json    stdio / remote / oauth spec
plugins/<slug>/plugin.json        bundle: hooks + skill index + mcp refs
plugins/<slug>/skills/<n>.md      the bundle's skill bodies
schemas/                  JSON Schema for each file type
scripts/                  extract → generate → parity → sign → validate
```

Current contents: **101 skills · 100 MCP servers · 40 plugins** (241 items).

## How the app consumes it

```ts
import { loadCatalog, createFileCache, DEFAULT_INDEX_URL } from "@orplex/sdk/marketplace";

const { items, source, verified } = await loadCatalog({
  appVersion: "0.1.1",
  url: DEFAULT_INDEX_URL,                       // this repo's catalog/index.json
  publicKey: process.env.ORPLEX_MARKETPLACE_PUBLIC_KEY,
  cache: createFileCache(cacheDir),
  seed: vendoredSeed,                           // offline fallback
});
```

Unsigned index → cached index → seed → empty. Untrusted items are dropped, never
"warned about".

## Integrity model

1. **Index signature.** Ed25519 over `canonicalJson(index minus signature)` —
   sorted keys, no whitespace. The key lives only in `.keys/` (gitignored);
   the public half is committed.
2. **Item digests.** `sha256(sortedFileNames.map(n => n + "\n" + content).join("\n"))`,
   computed over every file in the item directory. Editing one byte of one
   SKILL.md without rebuilding the index fails `npm run validate` *and* the app's
   `verifyItemFiles`.
3. **No code.** `validate.mjs` fails if any `.js/.ts/.sh/.py/.exe/.node/.wasm`
   appears under `skills/`, `mcp/` or `plugins/`.

## Working on it

```bash
npm run gen          # extract from the app, generate tree, parity check, re-sign
npm run validate     # schema + signature + digests + no-executables (CI gate)
npm run verify:sdk   # the published @orplex/sdk must accept the catalog
npm test             # validate + verify:sdk
```

`npm run gen` needs the app source at `D:/orplex` (override with
`APP_LIB=/path/to/src/lib`) and the signing key at `.keys/marketplace-private.pem`;
generate it once with `npm run keys`.

Adding an item by hand is fine — then run `npm run build:index` so its digest and
the signature are regenerated.

## Provenance

The skill bodies are prompt templates aggregated into the Orplex app from public
sources (Claude Code marketplace, Cursor community, awesome-agent-skills, vendor
docs). They are redistributed here under MIT as part of the app; if you are a
rights-holder and want an entry removed or attributed differently, open an issue
and it will be handled the same day.

## License

MIT
