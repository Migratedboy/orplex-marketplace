import copy
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from audit_catalog import audit, load, pinned


def validator(name):
    schema = load(ROOT / 'schemas' / (name + '.schema.json'))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


class Contracts(unittest.TestCase):
    def test_v1_does_not_require_v2_metadata(self):
        data = dict(schemaVersion=1, generatedAt='2026-01-01T00:00:00Z', items=[], signature='fixture')
        self.assertTrue(validator('index').is_valid(data))

    def test_v2_metadata_rules(self):
        s = validator('index'); data = dict(schemaVersion=2, generatedAt='2026-01-01T00:00:00Z', items=[], signature='fixture', seq=1, expiresAt='2026-02-01T00:00:00Z', keyId='test')
        self.assertTrue(s.is_valid(data))
        for k, bad in [('seq',0),('seq',1.5),('expiresAt','not-a-date'),('keyId','')]:
            with self.subTest(field=k,value=bad):
                self.assertFalse(s.is_valid({**data,k:bad})); self.assertFalse(s.is_valid({i:v for i,v in data.items() if i!=k}))

    def test_valid_local_hosted_and_dual(self):
        s = validator('mcp'); data = dict(schemaVersion=1,id='example',name='Example',description='A synthetic test server.',auth='none',version='1.0.0')
        local = {'stdio':{'command':'node','args':[]}}; hosted = {'remote':{'url':'https://example.invalid/mcp','transport':'streamable-http'}}
        self.assertFalse(s.is_valid(data))
        for extra in [local,hosted,{**local,**hosted}]: self.assertTrue(s.is_valid({**data,**extra}))
        self.assertFalse(s.is_valid({**data,**hosted,'oauth':{'clientSecret':'fixture'}}))

    def test_package_pins(self):
        for cmd,args,expected in [('npx',['-y','@example/server@1.2.3'],True),('npx',['-y','@example/server@latest'],False),('npx',['server','1.2.3'],False),('uvx',['example==2.1.0'],True),('uvx',['example'],False),('custom',[],None)]:
            with self.subTest(cmd=cmd,args=args): self.assertIs(pinned({'command':cmd,'args':args}),expected)

    def test_published_catalog_has_no_structural_errors(self):
        errors,_,rows = audit(ROOT)
        self.assertEqual(errors,[]); self.assertEqual(len(rows),len(load(ROOT/'catalog/index.json')['items']))

    def test_payload_drift_detected_without_count_or_id_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            for d in ['catalog','skills','plugins','mcp']: shutil.copytree(ROOT/d,root/d)
            bundle=load(root/'catalog/bundle.json')
            p=next(x for x in bundle['plugins'] if x.get('skills')); p['skills'][0]['body']+=' fixture'
            m=bundle['mcp'][0]; m['description']+=' fixture'
            s=bundle['skills'][0]; s['promptPrefix']+=' fixture'
            (root/'catalog/bundle.json').write_text(json.dumps(bundle),encoding='utf-8')
            errors,_,_=audit(root)
            for tag,code in [('plugin/'+p['slug'],'plugin-skill-drift'),('mcp/'+m['id'],'manifest-bundle-drift'),('skill/'+s['id'],'skill-bundle-drift')]: self.assertIn((tag,code),errors)

if __name__ == '__main__': unittest.main()
