// build-bundle.mjs — one signed file with the full catalogue payloads.
//
// catalog/index.json carries only metadata + checksums: enough to verify what
// exists, not enough to render a skill picker or configure an MCP client. The
// alternative is 241 per-item HTTP requests on app boot, which raw.githubusercontent
// rate-limits and users notice.
//
// So the bundle ships the resolved payloads in a single fetch, signed with the
// same Ed25519 key. It is derived data: index.json stays the source of truth for
// what is published and what its digest is, and `validate` cross-checks them.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const PRIVATE_KEY = process.env.ORPLEX_MARKETPLACE_PRIVATE_KEY || path.join(ROOT, ".keys/marketplace-private.pem");
const EXTRACT = path.join(ROOT, ".tmp-extract/extracted.json");

const frontmatter = (text) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const out = {};
  if (!match) return { meta: out, body: text };
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
  return { meta: out, body: text.slice(match[0].length) };
};

const canonicalJson = (value) => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
};

const dirs = (sub) => {
  const full = path.join(ROOT, sub);
  return fs.existsSync(full) ? fs.readdirSync(full).filter((n) => fs.statSync(path.join(full, n)).isDirectory()).sort() : [];
};

// Display metadata (category names/icons) is authored in the app constants, not
// in per-item frontmatter, so it rides along in the bundle.
let extracted = { skillCategories: [], mcpCategories: [] };
if (fs.existsSync(EXTRACT)) extracted = JSON.parse(fs.readFileSync(EXTRACT, "utf8"));

const skills = [];
for (const id of dirs("skills")) {
  const { meta, body } = frontmatter(fs.readFileSync(path.join(ROOT, "skills", id, "SKILL.md"), "utf8"));
  skills.push({
    id,
    name: meta.title || id,
    icon: meta.icon || "✨",
    category: meta.category || "general",
    description: meta.description || "",
    promptPrefix: body.trim(),
  });
}

const mcp = [];
for (const id of dirs("mcp")) {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "mcp", id, "manifest.json"), "utf8"));
  mcp.push(manifest);
}

const plugins = [];
for (const slug of dirs("plugins")) {
  const dir = path.join(ROOT, "plugins", slug);
  const plugin = JSON.parse(fs.readFileSync(path.join(dir, "plugin.json"), "utf8"));
  const skillsOut = (plugin.skills || []).map((entry) => {
    const file = path.join(dir, entry.path);
    const { meta, body } = fs.existsSync(file) ? frontmatter(fs.readFileSync(file, "utf8")) : { meta: {}, body: "" };
    return { name: entry.name || meta.name || "", title: meta.title || entry.name || "", body: body.trim() };
  });
  plugins.push({
    slug: plugin.slug || slug,
    name: plugin.name || slug,
    description: plugin.description || "",
    category: plugin.category || "general",
    version: plugin.version || "1.0.0",
    skills: skillsOut,
  });
}

const bundle = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  counts: { skill: skills.length, mcp: mcp.length, plugin: plugins.length },
  skillCategories: extracted.skillCategories || [],
  mcpCategories: extracted.mcpCategories || [],
  skills,
  mcp,
  plugins,
};

let signature = null;
if (fs.existsSync(PRIVATE_KEY)) {
  const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY, "utf8"));
  signature = crypto.sign(null, Buffer.from(canonicalJson(bundle), "utf8"), privateKey).toString("base64url");
} else {
  console.warn(`[build-bundle] no private key at ${PRIVATE_KEY} — bundle written UNSIGNED (the app will reject it)`);
}

fs.mkdirSync(path.join(ROOT, "catalog"), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, "catalog/bundle.json"),
  JSON.stringify({ ...bundle, signature }, null, 2) + "\n",
  "utf8",
);
console.log(
  `bundle → skills ${skills.length}, mcp ${mcp.length}, plugins ${plugins.length}, ` +
    `categories ${bundle.skillCategories.length}, signature: ${signature ? signature.slice(0, 16) + "…" : "none"}`,
);
