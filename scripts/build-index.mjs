// build-index.mjs — walk the tree, hash every item, sign the catalog.
//
// The digest is defined by @orplex/sdk/marketplace verifyItemFiles():
//   sha256( join("\n", sortedFileNames.map(n => name + "\n" + content)) )
// This script and the SDK must agree byte for byte, or every item is rejected
// by the app — so the formula is duplicated here on purpose and checked by
// `npm run validate` (which runs the SDK's own verifier).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const PRIVATE_KEY = process.env.ORPLEX_MARKETPLACE_PRIVATE_KEY || path.join(ROOT, ".keys/marketplace-private.pem");
const MIN_APP_VERSION = "0.1.0";
const SCHEMA_VERSION = 2;
/** An index is advisory after this long; the app re-fetches instead of trusting it. */
const VALID_FOR_DAYS = 30;
const KEY_ID = process.env.ORPLEX_MARKETPLACE_KEY_ID || "mk-2025-a";

const readFiles = (dir, base = dir, out = {}) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readFiles(full, base, out);
    else out[path.relative(base, full).replace(/\\/g, "/")] = fs.readFileSync(full, "utf8");
  }
  return out;
};

// Digest v2 (index schemaVersion 2). @orplex/sdk/marketplace itemDigest() with
// version "v2" — per-file sha256 of `name NUL content`, joined by "\n".
//
// v1 hashed `names.map(n => n + "\n" + content).join("\n")`, which is ambiguous:
// a file whose CONTENT begins with `another-file.txt\n…` produced the same byte
// stream as a genuine two-file tree, so two different item trees could carry the
// same digest. The NUL in v2 cannot occur in a path, so the boundary between a
// name and its content is never attacker-controlled.
const fileDigest = (name, content) =>
  crypto.createHash("sha256").update(`${name}\u0000${content}`).digest("hex");

const digest = (files) => {
  const names = Object.keys(files).sort();
  return crypto.createHash("sha256").update(names.map((n) => fileDigest(n, files[n])).join("\n")).digest("hex");
};

const sizeOf = (files) => Object.values(files).reduce((n, c) => n + Buffer.byteLength(c), 0);

const frontmatter = (text) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  const out = {};
  if (!match) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    const key = line.slice(0, at).trim();
    let value = line.slice(at + 1).trim();
    try {
      if (value.startsWith('"')) value = JSON.parse(value);
    } catch {
      /* plain scalar */
    }
    out[key] = value;
  }
  return out;
};

const items = [];

for (const id of fs.readdirSync(path.join(ROOT, "skills")).sort()) {
  const dir = path.join(ROOT, "skills", id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const files = readFiles(dir);
  const skill = files["SKILL.md"] ? frontmatter(files["SKILL.md"]) : {};
  items.push({
    id,
    kind: "skill",
    version: skill.version || "1.0.0",
    engine: ">=0.1.0",
    path: `skills/${id}`,
    sha256: digest(files),
    digest: "v2",
    size: sizeOf(files),
    tags: [skill.category].filter(Boolean),
    description: skill.description || "",
    title: skill.title || id,
  });
}

for (const id of fs.readdirSync(path.join(ROOT, "mcp")).sort()) {
  const dir = path.join(ROOT, "mcp", id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const files = readFiles(dir);
  const manifest = JSON.parse(files["manifest.json"]);
  items.push({
    id,
    kind: "mcp",
    version: manifest.version || "1.0.0",
    engine: ">=0.1.0",
    path: `mcp/${id}`,
    sha256: digest(files),
    digest: "v2",
    size: sizeOf(files),
    tags: [manifest.category].filter(Boolean),
    auth: manifest.auth || "none",
    description: manifest.description || "",
    title: manifest.name || id,
  });
}

for (const slug of fs.readdirSync(path.join(ROOT, "plugins")).sort()) {
  const dir = path.join(ROOT, "plugins", slug);
  if (!fs.statSync(dir).isDirectory()) continue;
  const files = readFiles(dir);
  const plugin = JSON.parse(files["plugin.json"]);
  items.push({
    id: slug,
    kind: "plugin",
    version: plugin.version || "1.0.0",
    engine: ">=0.1.0",
    path: `plugins/${slug}`,
    sha256: digest(files),
    digest: "v2",
    size: sizeOf(files),
    tags: [plugin.category].filter(Boolean),
    description: plugin.description || "",
    title: plugin.name || slug,
    skillCount: (plugin.skills || []).length,
  });
}

items.sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind.localeCompare(b.kind)));

const canonicalJson = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
};

const revokedPath = path.join(ROOT, "catalog/revoked.json");
const revoked = fs.existsSync(revokedPath) ? JSON.parse(fs.readFileSync(revokedPath, "utf8")) : [];
const seq = Number(process.env.ORPLEX_MARKETPLACE_SEQ || Math.floor(Date.now() / 1000));

const index = {
  schemaVersion: SCHEMA_VERSION,
  // seq + expiresAt close the replay window: a validly signed OLD index must be
  // distinguishable from the current one, otherwise an attacker who can serve
  // the raw file can pin installs to a withdrawn item.
  seq,
  generatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + VALID_FOR_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  keyId: KEY_ID,
  revoked: Array.isArray(revoked) ? revoked : [],
  minAppVersion: MIN_APP_VERSION,
  counts: {
    skill: items.filter((i) => i.kind === "skill").length,
    mcp: items.filter((i) => i.kind === "mcp").length,
    plugin: items.filter((i) => i.kind === "plugin").length,
  },
  items,
};

let signature = null;
if (fs.existsSync(PRIVATE_KEY)) {
  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY, "utf8"));
  signature = crypto.sign(null, Buffer.from(canonicalJson(index), "utf8"), privateKey).toString("base64url");
} else {
  console.warn(`[build-index] no private key at ${PRIVATE_KEY} — index written UNSIGNED (validate will fail)`);
}

const signed = { ...index, signature };
fs.mkdirSync(path.join(ROOT, "catalog"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "catalog/index.json"), JSON.stringify(signed, null, 2) + "\n", "utf8");
console.log(
  `index → ${items.length} items (skills ${index.counts.skill}, mcp ${index.counts.mcp}, plugins ${index.counts.plugin}), signature: ${signature ? signature.slice(0, 16) + "…" : "none"}`,
);
