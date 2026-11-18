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

const readFiles = (dir, base = dir, out = {}) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readFiles(full, base, out);
    else out[path.relative(base, full).replace(/\\/g, "/")] = fs.readFileSync(full, "utf8");
  }
  return out;
};

const digest = (files) => {
  const names = Object.keys(files).sort();
  return crypto.createHash("sha256").update(names.map((n) => `${n}\n${files[n]}`).join("\n")).digest("hex");
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

const index = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
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
