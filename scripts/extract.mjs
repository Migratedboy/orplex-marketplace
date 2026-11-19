// extract.mjs — pull the app's live built-ins out of TypeScript constants.
//
// The marketplace must contain exactly what the app ships today, so this reads
// the source of truth (D:/orplex/src/lib) rather than a hand-written copy.
// Compiling is deliberate: the arrays are typed and computed (SKILL_CATEGORIES
// .flatMap, registry side effects), so regex-scraping them would silently drift.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

// Source of truth moved: these constants now live in the SDK (@orplex/sdk), and
// the app only re-exports them. Read the SDK so the marketplace tracks the package
// that actually ships, not a shim.
const SDK_LIB = "D:/orplex-sdk/src/lib";
const APP_LIB = SDK_LIB;
const WORK = "D:/orplex-marketplace/.tmp-extract";
const OUT = "D:/orplex-marketplace/.tmp-extract/out";
const TSC = "D:/orplex-sdk/node_modules/typescript/bin/tsc";
const NODE = process.env.NODE_BIN || "C:/Program Files/nodejs/node.exe";

const FILES = [
  "skills.ts",
  "mcp-catalog.ts",
  "plugin-library/types.ts",
  "plugin-library/quality.ts",
  "plugin-library/security.ts",
  "plugin-library/devops.ts",
  "plugin-library/domain.ts",
  "plugin-library/intelligence.ts",
];

fs.rmSync(WORK, { recursive: true, force: true });
// The marketplace package is "type": "module"; tsc emits CommonJS here, so the
// scratch dir needs its own package.json or every dump.cjs require() throws.
fs.mkdirSync(WORK, { recursive: true });
fs.writeFileSync(path.join(WORK, "package.json"), JSON.stringify({ type: "commonjs" }));
for (const rel of FILES) {
  const dst = path.join(WORK, "src/lib", rel);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(APP_LIB, rel), dst);
}

// next/server and next-auth are pulled in by plugin-library/domain.ts, which is
// data plus one demo route handler. Stub them rather than drag Next into the
// extractor — the bundle array is what we need, not the handler.
const stub = (name, source) => {
  const dir = path.join(WORK, "node_modules", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name, version: "0.0.0", main: "index.js" }));
  fs.writeFileSync(path.join(dir, "index.js"), source);
};
// zod is a real dependency; @types/node keeps \`process\` declared.
for (const pkg of ["zod", "@types/node"]) {
  const from = path.join("D:/orplex-sdk/node_modules", pkg);
  const to = path.join(WORK, "node_modules", pkg);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.cpSync(from, to, { recursive: true });
}

stub("next", "module.exports = {};");
stub("next-auth", "module.exports = { getServerSession: async () => null };");
fs.mkdirSync(path.join(WORK, "node_modules/next"), { recursive: true });
fs.writeFileSync(
  path.join(WORK, "node_modules/next/package.json"),
  JSON.stringify({ name: "next", version: "0.0.0", exports: { "./server": "./server.js" } }),
);
fs.writeFileSync(path.join(WORK, "node_modules/next/server.js"), "module.exports = { NextRequest: class {}, NextResponse: class {} };");

// "@/lib/auth" is an app alias; the extractor resolves it to a stub.
fs.mkdirSync(path.join(WORK, "src/lib"), { recursive: true });
fs.writeFileSync(path.join(WORK, "src/lib/auth.ts"), "export const jwtOnlyOptions = {};\nexport const authOptions = {};\n");

fs.writeFileSync(
  path.join(WORK, "tsconfig.json"),
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "CommonJS",
        moduleResolution: "Node10",
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
        outDir: "out",
        rootDir: "src",
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
        types: ["node"],
      },
      include: ["src/**/*.ts"],
    },
    null,
    2,
  ),
);

execFileSync(NODE, [TSC, "-p", path.join(WORK, "tsconfig.json")], { stdio: "inherit" });

// Report what really came out, so a silent zero-item extraction cannot pass.
const dump = `
const lib = "D:/orplex-marketplace/.tmp-extract/out/lib";
const skills = require(lib + "/skills.js");
const mcp = require(lib + "/mcp-catalog.js");
const cats = ["quality", "security", "devops", "domain", "intelligence"];
const bundles = cats.map((c) => {
  const mod = require(lib + "/plugin-library/" + c + ".js");
  const arr = Object.values(mod).find((v) => Array.isArray(v)) || [];
  return { category: c, bundles: arr };
});
console.log(JSON.stringify({
  skills: skills.ALL_SKILLS,
  skillCategories: skills.SKILL_CATEGORIES.map((c) => ({ id: c.id, name: c.name, icon: c.icon, count: c.skills.length })),
  mcp: mcp.MCP_CATALOG,
  mcpCategories: mcp.MCP_CATEGORIES,
  bundles,
}, null, 2));
`;
fs.writeFileSync(path.join(WORK, "dump.cjs"), dump);
const json = execFileSync(NODE, [path.join(WORK, "dump.cjs")], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(WORK, "extracted.json"), json);
const parsed = JSON.parse(json);
console.log(
  `extracted -> skills ${parsed.skills.length}, mcp ${parsed.mcp.length}, bundles ${parsed.bundles.reduce((n, b) => n + b.bundles.length, 0)}`,
);
