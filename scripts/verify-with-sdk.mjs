// Exercise the SDK's real resolver with the repository's exact signed bytes, without a network listener.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = process.env.MARKETPLACE_ROOT || fileURLToPath(new URL('../', import.meta.url));
const SDK = process.env.SDK_ENTRY || path.join(ROOT, '../orplex-sdk/dist/esm/marketplace.js');
const { loadCatalog, satisfiesRange, verifyIndex } = await import(pathToFileURL(path.resolve(SDK)).href);
const publicKey = fs.readFileSync(path.join(ROOT, 'catalog/public-key.txt'), 'utf8').trim();
const raw = fs.readFileSync(path.join(ROOT, 'catalog/index.json'), 'utf8');
const index = JSON.parse(raw);
const appVersion = process.env.ORPLEX_TEST_APP_VERSION || index.minAppVersion || '0.1.0';
assert.ok(verifyIndex(index, publicKey), 'index must verify against the publisher key');
const options = { appVersion, publicKey, fetchImpl: async () => new Response(raw) };
const result = await loadCatalog(options);
assert.ok(result.verified, `catalog rejected: ${result.error ?? 'unknown'}`);
assert.equal(result.source, 'network', 'fixture response should win, not a fallback');
const eligible = index.items.filter(i => !index.revoked?.includes(i.id) && satisfiesRange(appVersion, i.engine) && (!index.minAppVersion || satisfiesRange(appVersion, `>=${index.minAppVersion}`)));
const ids = items => items.map(i => `${i.kind}:${i.id}`).sort();
assert.deepEqual(ids(result.items), ids(eligible), 'SDK must return the expected IDs, not a fixed catalog size');
const changed = { ...index, generatedAt: `${index.generatedAt}!` };
assert.equal(verifyIndex(changed, publicKey), false, 'changed signed data must be rejected');
const fallback = await loadCatalog({ ...options, fetchImpl: async () => new Response(JSON.stringify(changed)), cache: { read: async () => ({index, fetchedAt: 0, etag: null}), write: async () => { throw Error('rejected index must not be cached'); } }, ttlMs: 0 });
assert.equal(fallback.source, 'cache');
assert.equal(fallback.verified, true);
assert.deepEqual(ids(fallback.items), ids(eligible));
console.log(`SDK accepted ${eligible.length} eligible items from ${index.items.length}; tamper and verified-cache checks passed`);
