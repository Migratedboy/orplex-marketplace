import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_catalog import FORMAT_CHECKER, audit, load, pinned


def validator(name):
    schema = load(ROOT / 'schemas' / (name + '.schema.json'))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FORMAT_CHECKER)


class Contracts(unittest.TestCase):
    def test_v1_does_not_require_v2_metadata(self):
        data = dict(schemaVersion=1, generatedAt='2026-01-01T00:00:00Z', items=[], signature='fixture')
        self.assertTrue(validator('index').is_valid(data))

    def test_v2_metadata_rules(self):
        schema = validator('index')
        data = dict(schemaVersion=2, generatedAt='2026-01-01T00:00:00Z', items=[], signature='fixture', seq=1, expiresAt='2026-02-01T00:00:00Z', keyId='test')
        self.assertTrue(schema.is_valid(data))
        for key, bad in [('seq', 0), ('seq', 1.5), ('expiresAt', 'not-a-date'), ('keyId', '')]:
            with self.subTest(field=key, value=bad):
                self.assertFalse(schema.is_valid({**data, key: bad}))
                self.assertFalse(schema.is_valid({item: value for item, value in data.items() if item != key}))

    def test_v1_bad_timestamp_is_rejected(self):
        data = dict(schemaVersion=1, generatedAt='not-a-date', items=[], signature='fixture')
        self.assertFalse(validator('index').is_valid(data))

    def test_valid_local_hosted_and_dual(self):
        schema = validator('mcp')
        data = dict(schemaVersion=1, id='example', name='Example', description='A synthetic test server.', auth='none', version='1.0.0')
        local = {'stdio': {'command': 'node', 'args': []}}
        hosted = {'remote': {'url': 'https://example.invalid/mcp', 'transport': 'streamable-http'}}
        self.assertFalse(schema.is_valid(data))
        for extra in [local, hosted, {**local, **hosted}]:
            self.assertTrue(schema.is_valid({**data, **extra}))
        self.assertFalse(schema.is_valid({**data, **hosted, 'oauth': {'clientSecret': 'fixture'}}))
        self.assertFalse(schema.is_valid({**data, 'remote': {'url': 'not a url', 'transport': 'sse'}}))

    def test_package_pins(self):
        cases = [('npx', ['-y', '@example/server@1.2.3'], True), ('npx', ['-y', '@example/server@latest'], False), ('npx', ['server', '1.2.3'], False), ('uvx', ['example==2.1.0'], True), ('uvx', ['example'], False), ('custom', [], None)]
        for command, args, expected in cases:
            with self.subTest(command=command, args=args):
                self.assertIs(pinned({'command': command, 'args': args}), expected)

    def test_published_catalog_has_no_structural_errors(self):
        errors, _, rows = audit(ROOT)
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), len(load(ROOT / 'catalog/index.json')['items']))

    def test_payload_drift_detected_without_count_or_id_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for directory in ['catalog', 'skills', 'plugins', 'mcp']:
                shutil.copytree(ROOT / directory, root / directory)
            bundle = load(root / 'catalog/bundle.json')
            plugin = next(entry for entry in bundle['plugins'] if entry.get('skills'))
            plugin['skills'][0]['body'] += ' fixture'
            mcp = bundle['mcp'][0]
            mcp['description'] += ' fixture'
            skill = bundle['skills'][0]
            skill['promptPrefix'] += ' fixture'
            (root / 'catalog/bundle.json').write_text(json.dumps(bundle), encoding='utf-8')
            errors, _, _ = audit(root)
            expected = [('plugin/' + plugin['slug'], 'plugin-skill-drift'), ('mcp/' + mcp['id'], 'manifest-bundle-drift'), ('skill/' + skill['id'], 'skill-bundle-drift')]
            for finding in expected:
                self.assertIn(finding, errors)


if __name__ == '__main__':
    unittest.main()
