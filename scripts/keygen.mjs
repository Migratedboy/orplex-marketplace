// keygen.mjs — Ed25519 signing key for the catalog.
//
// The private key never enters the repo (.keys/ is gitignored). The public key
// is committed twice: PEM for the validator and base64url SPKI DER for the app,
// which is the same encoding Orplex already uses for ORPLEX_SESSION_PUBLIC_KEY.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.env.MARKETPLACE_ROOT || "D:/orplex-marketplace";
const privateDir = path.join(ROOT, ".keys");
const privatePath = path.join(privateDir, "marketplace-private.pem");
const publicPem = path.join(ROOT, "keys/marketplace-public.pem");
const publicRaw = path.join(ROOT, "catalog/public-key.txt");

if (fs.existsSync(privatePath) && !process.argv.includes("--force")) {
  console.log("key exists — pass --force to rotate (this invalidates every shipped app build)");
  process.exit(0);
}

fs.mkdirSync(privateDir, { recursive: true });
fs.mkdirSync(path.join(ROOT, "keys"), { recursive: true });

const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
fs.writeFileSync(privatePath, privateKey.export({ format: "pem", type: "pkcs8" }), { mode: 0o600 });
fs.writeFileSync(publicPem, publicKey.export({ format: "pem", type: "spki" }));
const der = publicKey.export({ format: "der", type: "spki" });
fs.writeFileSync(publicRaw, der.toString("base64url") + "\n");

console.log("wrote .keys/marketplace-private.pem (gitignored), keys/marketplace-public.pem, catalog/public-key.txt");
console.log("public key (base64url, ship this in the app as ORPLEX_MARKETPLACE_PUBLIC_KEY):");
console.log("  " + der.toString("base64url"));
