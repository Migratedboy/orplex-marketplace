// generate.mjs — turn the extracted app data into the marketplace tree.
//
// Layout (one directory per item, data only — never executable code):
//   skills/<id>/SKILL.md           frontmatter + prompt body
//   mcp/<id>/manifest.json         stdio/remote/oauth spec, exactly as the app has it
//   plugins/<slug>/plugin.json     bundle: hooks + skills index + mcp refs
//   plugins/<slug>/skills/<n>.md   the bundle's skill bodies
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const data = JSON.parse(fs.readFileSync(path.join(ROOT, ".tmp-extract/extracted.json"), "utf8"));
const VERSION = "1.0.0";

const clean = (v) => (v === undefined || v === null ? "" : String(v));
const safe = (s) => clean(s).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "item";
const yamlStr = (s) => JSON.stringify(clean(s)); // JSON strings are valid YAML scalars

for (const dir of ["skills", "mcp", "plugins"]) {
  fs.rmSync(path.join(ROOT, dir), { recursive: true, force: true });
  fs.mkdirSync(path.join(ROOT, dir), { recursive: true });
}

/* --------------------------------- skills -------------------------------- */
let skillCount = 0;
for (const skill of data.skills) {
  const id = safe(skill.id);
  const dir = path.join(ROOT, "skills", id);
  fs.mkdirSync(dir, { recursive: true });
  const front = [
    "---",
    `name: ${yamlStr(id)}`,
    `title: ${yamlStr(skill.name)}`,
    `description: ${yamlStr(skill.description)}`,
    `category: ${yamlStr(skill.category)}`,
    `icon: ${yamlStr(skill.icon)}`,
    `version: ${VERSION}`,
    "license: MIT",
    "---",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(dir, "SKILL.md"), front + clean(skill.promptPrefix).trimEnd() + "\n", "utf8");
  skillCount++;
}

/* ----------------------------------- mcp --------------------------------- */
let mcpCount = 0;
for (const entry of data.mcp) {
  const id = safe(entry.id);
  const dir = path.join(ROOT, "mcp", id);
  fs.mkdirSync(dir, { recursive: true });
  const manifest = {
    schemaVersion: 1,
    id,
    name: entry.name,
    description: entry.description,
    category: entry.category,
    version: VERSION,
    license: "MIT",
    auth: entry.auth ?? "none",
    ...(entry.popular ? { popular: true } : {}),
    ...(entry.remote ? { remote: entry.remote } : {}),
    ...(entry.oauth !== undefined ? { oauth: entry.oauth } : {}),
    ...(entry.stdio ? { stdio: entry.stdio } : {}),
    ...(entry.docsUrl ? { docsUrl: entry.docsUrl } : {}),
  };
  fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n", "utf8");
  mcpCount++;
}

/* --------------------------------- plugins -------------------------------- */
let pluginCount = 0;
for (const group of data.bundles) {
  for (const bundle of group.bundles) {
    const slug = safe(bundle.slug);
    const dir = path.join(ROOT, "plugins", slug);
    fs.mkdirSync(path.join(dir, "skills"), { recursive: true });
    const skillRefs = [];
    for (const skill of bundle.skills ?? []) {
      const fileName = `${safe(skill.name || skill.slug || "skill")}.md`;
      fs.writeFileSync(path.join(dir, "skills", fileName), clean(skill.body).trimEnd() + "\n", "utf8");
      skillRefs.push({ name: skill.name, path: `skills/${fileName}` });
    }
    const plugin = {
      schemaVersion: 1,
      slug,
      name: bundle.name ?? bundle.slug,
      description: bundle.description,
      category: bundle.category ?? group.category,
      version: bundle.version ?? VERSION,
      license: "MIT",
      ...(bundle.hooks ? { hooks: bundle.hooks } : {}),
      ...(bundle.mcp ? { mcp: bundle.mcp } : {}),
      skills: skillRefs,
    };
    fs.writeFileSync(path.join(dir, "plugin.json"), JSON.stringify(plugin, null, 2) + "\n", "utf8");
    pluginCount++;
  }
}

console.log(`generated → ${skillCount} skills, ${mcpCount} mcp servers, ${pluginCount} plugins`);
