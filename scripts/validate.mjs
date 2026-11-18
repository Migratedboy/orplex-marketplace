// validate.mjs — the gate CI runs on every push.
//
// Three things can go wrong in a data catalog like this, and each one has a
// concrete check here:
//   1. someone edits an item and forgets to rebuild the index → digest mismatch
//   2. someone smuggles executable code into an item  → file-type ban
//   3. the index is unsigned or signed by an unknown key → signature check
//
// Exit code is non-zero on any failure, so a bad PR cannot land.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const PUBLIC_KEY = path.join(ROOT, "keys/marketplace-public.pem");

const errors = [];
const fail = (msg) => errors.push(msg);

const canonicalJson = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
};

const digest = (files) => {
  const names = Object.keys(files).sort();
  return crypto.createHash("sha256").update(names.map((n) => `${n}\n${files[n]}`).join("\n")).digest("hex");
};

const readFiles = (dir, base = dir, out = {}) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) readFiles(full, base, out);
    else out[path.relative(base, full).replace(/\\/g, "/")] = fs.readFileSync(full, "utf8");
  }
  return out;
};

/* ------------------------------ index + signature ------------------------- */
const indexPath = path.join(ROOT, "catalog/index.json");
if (!fs.existsSync(indexPath)) {
  fail("catalog/index.json is missing — run npm run build:index");
} else {
  const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));

  if (index.schemaVersion !== 1) fail(`schemaVersion must be 1, got ${index.schemaVersion}`);
  if (!Array.isArray(index.items)) fail("items must be an array");
  if (!index.signature) fail("index is not signed");
  if (!index.generatedAt || Number.isNaN(Date.parse(index.generatedAt))) fail("generatedAt must be an ISO date");

  if (index.signature) {
    try {
      const { signature, ...payload } = index;
      const key = crypto.createPublicKey(fs.readFileSync(PUBLIC_KEY, "utf8"));
      const ok = crypto.verify(null, Buffer.from(canonicalJson(payload), "utf8"), key, Buffer.from(signature, "base64url"));
      if (!ok) fail("index signature does not verify against keys/marketplace-public.pem");
    } catch (err) {
      fail(`signature check threw: ${err.message}`);
    }
  }

  /* --------------------------- per-item integrity -------------------------- */
  const seen = new Set();
  for (const item of index.items || []) {
    const where = `${item.kind}/${item.id}`;
    if (!item.id || !item.kind || !item.path) {
      fail(`${where}: id, kind and path are required`);
      continue;
    }
    if (!["skill", "mcp", "plugin"].includes(item.kind)) fail(`${where}: unknown kind ${item.kind}`);
    if (seen.has(`${item.kind}:${item.id}`)) fail(`${where}: duplicate id`);
    seen.add(`${item.kind}:${item.id}`);
    if (!/^[a-f0-9]{64}$/.test(item.sha256 || "")) fail(`${where}: sha256 must be 64 lowercase hex chars`);

    const abs = path.join(ROOT, item.path);
    if (!fs.existsSync(abs)) {
      fail(`${where}: path ${item.path} does not exist`);
      continue;
    }
    const files = readFiles(abs);
    if (Object.keys(files).length === 0) fail(`${where}: item directory is empty`);
    const actual = digest(files);
    if (actual !== item.sha256) fail(`${where}: digest mismatch (index ${item.sha256.slice(0, 12)}…, files ${actual.slice(0, 12)}…)`);
    if (typeof item.size === "number") {
      const size = Object.values(files).reduce((n, c) => n + Buffer.byteLength(c), 0);
      if (size !== item.size) fail(`${where}: size mismatch (index ${item.size}, files ${size})`);
    }
  }

  /* ------------------------- nothing on disk is orphaned ------------------- */
  for (const kind of ["skills", "mcp", "plugins"]) {
    if (!fs.existsSync(path.join(ROOT, kind))) continue;
    for (const dir of fs.readdirSync(path.join(ROOT, kind))) {
      const abs = path.join(ROOT, kind, dir);
      if (!fs.statSync(abs).isDirectory()) continue;
      const expected = kind === "skills" ? "skill" : kind === "mcp" ? "mcp" : "plugin";
      if (!seen.has(`${expected}:${dir}`)) fail(`${kind}/${dir} exists on disk but has no index entry — run npm run build:index`);
    }
  }
}

/* ------------------------ no executable code in items --------------------- */
const BANNED = /\.(js|mjs|cjs|ts|tsx|jsx|sh|bat|ps1|exe|dll|node|py|rb|jar|wasm)$/i;
for (const kind of ["skills", "mcp", "plugins"]) {
  const base = path.join(ROOT, kind);
  if (!fs.existsSync(base)) continue;
  for (const rel of Object.keys(readFiles(base))) {
    if (BANNED.test(rel)) fail(`${kind}/${rel}: executable files are never fetched from the marketplace`);
  }
}

/* ------------------------------ plugin shape ------------------------------ */
const pluginDir = path.join(ROOT, "plugins");
if (fs.existsSync(pluginDir)) {
  for (const slug of fs.readdirSync(pluginDir)) {
    const manifestPath = path.join(pluginDir, slug, "plugin.json");
    if (!fs.existsSync(manifestPath)) {
      fail(`plugins/${slug}: plugin.json is missing`);
      continue;
    }
    const plugin = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const skill of plugin.skills || []) {
      if (!fs.existsSync(path.join(pluginDir, slug, skill.path))) {
        fail(`plugins/${slug}: referenced skill ${skill.path} is missing`);
      }
    }
    if (!plugin.description) fail(`plugins/${slug}: description is required`);
  }
}

/* ---------------------------------- report -------------------------------- */
if (errors.length) {
  console.error(`validate: ${errors.length} problem(s)\n`);
  for (const err of errors.slice(0, 40)) console.error("  ✖ " + err);
  if (errors.length > 40) console.error(`  … and ${errors.length - 40} more`);
  process.exit(1);
}

const index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
console.log(
  `validate: OK — ${index.items.length} items (skills ${index.counts.skill}, mcp ${index.counts.mcp}, plugins ${index.counts.plugin}), signature verified, no executable files`,
);
