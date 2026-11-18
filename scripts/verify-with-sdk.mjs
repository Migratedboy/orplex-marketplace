// verify-with-sdk.mjs — end-to-end proof that the published SDK accepts this
// catalog. Deliberately uses @orplex/sdk's own verifier (the exact code npm
// ships), not the same helpers build-index used, so a formula drift shows up
// here instead of in a user's app.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const SDK = process.env.SDK_ENTRY || "D:/orplex-sdk/dist/esm/marketplace.js";
const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const { loadCatalog } = await import("file:///" + SDK.replace(/\\/g, "/"));

const publicKey = fs.readFileSync(path.join(ROOT, "catalog/public-key.txt"), "utf8").trim();

const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  if (!fs.existsSync(file)) {
    res.writeHead(404).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": "application/json", etag: '"v1"' }).end(fs.readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}/catalog/index.json`;

try {
  const result = await loadCatalog({ url, publicKey, appVersion: "0.1.0" });
  const byKind = result.items.reduce((acc, item) => ({ ...acc, [item.kind]: (acc[item.kind] || 0) + 1 }), {});
  console.log(
    `sdk loadCatalog → source ${result.source}, verified ${result.verified}, ${result.items.length} items`,
    JSON.stringify(byKind),
  );
  if (!result.verified) throw new Error(`catalog rejected: ${result.error ?? "unknown"}`);
  if (result.items.length !== 241) throw new Error(`expected 241 items, got ${result.items.length}`);

  // Tamper test: flip one byte of an item digest and confirm the SDK rejects it.
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, "catalog/index.json"), "utf8"));
  const broken = { ...index, items: [{ ...index.items[0], sha256: "0".repeat(64) }, ...index.items.slice(1)] };
  const { verifyIndex } = await import("file:///" + SDK.replace(/\\/g, "/"));
  if (verifyIndex(broken, publicKey)) throw new Error("tampered index still verifies — signature is not covering items");
  console.log("tamper test → tampered index rejected");
} finally {
  server.close();
}
