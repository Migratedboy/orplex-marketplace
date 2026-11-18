// parity.mjs — prove the generated tree is byte-faithful to the app's constants.
//
// generate.mjs writes the files; this reads them back and compares against
// .tmp-extract/extracted.json field by field. Without it, "the marketplace has
// the same content as the app" is an assumption, and a silent generate bug
// (dropped env var, truncated prompt) would ship to users.
import fs from "node:fs";
import path from "node:path";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const data = JSON.parse(fs.readFileSync(path.join(ROOT, ".tmp-extract/extracted.json"), "utf8"));

const problems = [];
const fail = (msg) => problems.push(msg);

const frontmatter = (text) => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!match) return { meta: {}, body: text };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const at = line.indexOf(":");
    if (at === -1) continue;
    let value = line.slice(at + 1).trim();
    try {
      if (value.startsWith('"')) value = JSON.parse(value);
    } catch {
      /* plain scalar */
    }
    meta[line.slice(0, at).trim()] = value;
  }
  return { meta, body: text.slice(match[0].length) };
};

/* --------------------------------- skills --------------------------------- */
let skillsChecked = 0;
for (const skill of data.skills) {
  const id = String(skill.id).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const file = path.join(ROOT, "skills", id, "SKILL.md");
  if (!fs.existsSync(file)) {
    fail(`skill ${skill.id}: SKILL.md missing`);
    continue;
  }
  const { meta, body } = frontmatter(fs.readFileSync(file, "utf8"));
  if (meta.name !== id) fail(`skill ${skill.id}: frontmatter name ${meta.name} != ${id}`);
  if (meta.title !== skill.name) fail(`skill ${skill.id}: title mismatch (${meta.title} != ${skill.name})`);
  if (meta.description !== skill.description) fail(`skill ${skill.id}: description mismatch`);
  if (meta.category !== skill.category) fail(`skill ${skill.id}: category mismatch`);
  if (meta.icon !== skill.icon) fail(`skill ${skill.id}: icon mismatch`);
  if (body.trimEnd() !== String(skill.promptPrefix ?? "").trimEnd()) fail(`skill ${skill.id}: prompt body differs from promptPrefix`);
  skillsChecked++;
}

/* ----------------------------------- mcp ---------------------------------- */
let mcpChecked = 0;
for (const entry of data.mcp) {
  const id = String(entry.id).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const file = path.join(ROOT, "mcp", id, "manifest.json");
  if (!fs.existsSync(file)) {
    fail(`mcp ${entry.id}: manifest.json missing`);
    continue;
  }
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.name !== entry.name) fail(`mcp ${entry.id}: name mismatch`);
  if (manifest.description !== entry.description) fail(`mcp ${entry.id}: description mismatch`);
  if (manifest.category !== entry.category) fail(`mcp ${entry.id}: category mismatch`);
  if ((manifest.auth ?? "none") !== (entry.auth ?? "none")) fail(`mcp ${entry.id}: auth mismatch`);
  if (JSON.stringify(manifest.stdio ?? null) !== JSON.stringify(entry.stdio ?? null)) fail(`mcp ${entry.id}: stdio spec differs`);
  if (JSON.stringify(manifest.remote ?? null) !== JSON.stringify(entry.remote ?? null)) fail(`mcp ${entry.id}: remote spec differs`);
  if (JSON.stringify(manifest.oauth ?? null) !== JSON.stringify(entry.oauth ?? null)) fail(`mcp ${entry.id}: oauth hints differ`);
  mcpChecked++;
}

/* --------------------------------- plugins -------------------------------- */
let pluginsChecked = 0;
let bundleSkillsChecked = 0;
for (const group of data.bundles) {
  for (const bundle of group.bundles) {
    const slug = String(bundle.slug).toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
    const dir = path.join(ROOT, "plugins", slug);
    const file = path.join(dir, "plugin.json");
    if (!fs.existsSync(file)) {
      fail(`plugin ${bundle.slug}: plugin.json missing`);
      continue;
    }
    const plugin = JSON.parse(fs.readFileSync(file, "utf8"));
    if (plugin.description !== bundle.description) fail(`plugin ${slug}: description mismatch`);
    if ((plugin.category ?? "") !== (bundle.category ?? group.category)) fail(`plugin ${slug}: category mismatch`);
    if (JSON.stringify(plugin.hooks ?? null) !== JSON.stringify(bundle.hooks ?? null)) fail(`plugin ${slug}: hooks differ`);
    if ((plugin.skills || []).length !== (bundle.skills || []).length) fail(`plugin ${slug}: skill count ${(plugin.skills || []).length} != ${(bundle.skills || []).length}`);
    for (let i = 0; i < (bundle.skills || []).length; i++) {
      const ref = plugin.skills[i];
      const body = fs.readFileSync(path.join(dir, ref.path), "utf8");
      if (body.trimEnd() !== String(bundle.skills[i].body ?? "").trimEnd()) fail(`plugin ${slug}: skill ${ref.name} body differs`);
      if (ref.name !== bundle.skills[i].name) fail(`plugin ${slug}: skill name mismatch`);
      bundleSkillsChecked++;
    }
    pluginsChecked++;
  }
}

/* ---------------------------------- report -------------------------------- */
if (problems.length) {
  console.error(`parity: ${problems.length} mismatch(es)\n`);
  for (const p of problems.slice(0, 40)) console.error("  ✖ " + p);
  process.exit(1);
}
console.log(
  `parity: OK — ${skillsChecked} skills, ${mcpChecked} mcp servers, ${pluginsChecked} plugins (${bundleSkillsChecked} bundle skills) match the app constants field by field`,
);
