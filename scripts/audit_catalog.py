#!/usr/bin/env python3
"""Offline publisher checks. Catalog entries are data; never execute or contact them."""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
GROUP = {'skill': 'skills', 'mcp': 'mcp', 'plugin': 'plugins'}
ID = re.compile(r'[a-z0-9][a-z0-9._-]{0,79}')


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def pinned(spec):
    command, args = spec.get('command'), list(spec.get('args', []))
    if command == 'npx':
        if args[:1] in (['-y'], ['--yes']):
            args = args[1:]
        return bool(args and re.fullmatch(r'(?:@[\w.-]+/)?[\w.-]+@\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?', args[0]))
    if command == 'uvx':
        if args[:1] == ['--from']:
            args = args[1:]
        return bool(args and re.fullmatch(r'[\w.-]+==\d+(?:\.\d+)+(?:[a-z]+\d+)?', args[0]))
    return None  # Manual review, not evidence that the launcher is pinned.


def markdown(text):
    text = text.replace('\r\n', '\n')
    if not text.startswith('---\n'):
        return {}, text.strip()
    head, sep, body = text[4:].partition('\n---\n')
    if not sep:
        raise ValueError('incomplete frontmatter')
    meta = {}
    for line in head.splitlines():
        key, colon, value = line.partition(':')
        if colon:
            value = value.strip()
            meta[key.strip()] = json.loads(value) if value.startswith('"') else value
    return meta, body.strip()


def audit(root, schema_dir=None):
    root = Path(root).resolve()
    def safe(path):
        p = root / path
        if p.resolve() != p or not p.resolve().is_relative_to(root):
            raise ValueError('unsafe catalog path')
        return p
    schemas = {k: Draft202012Validator(load((schema_dir or ROOT / 'schemas') / (k + '.schema.json')), format_checker=FormatChecker()) for k in ('index', 'mcp', 'plugin')}
    hard, review, rows = set(), set(), []
    def schema(kind, item, data):
        for e in schemas[kind].iter_errors(data):
            # Never include values in logs (invalid data can contain credentials).
            hard.add((item, 'schema:' + str(e.validator) + ':' + '/'.join(map(str, e.absolute_schema_path))))
    idx, bundle = [load(safe('catalog/' + n + '.json')) for n in ('index', 'bundle')]
    schema('index', 'index', idx)
    indexed = {(x['kind'], x['id']): x for x in idx['items']}
    if len(indexed) != len(idx['items']):
        hard.add(('index', 'duplicate-id'))
    for kind, group in GROUP.items():
        entries = bundle[group]
        key = 'slug' if kind == 'plugin' else 'id'
        ids = [e[key] for e in entries]
        disk = {p.name for p in safe(group).iterdir() if p.is_dir()}
        want = {id_ for k, id_ in indexed if k == kind}
        if len(set(ids)) != len(ids) or set(ids) != want or disk != want:
            hard.add((kind, 'id-set-mismatch'))
        if any(c.get(kind) != len(ids) for c in (idx['counts'], bundle['counts'])):
            hard.add((kind, 'count-mismatch'))
        for e in entries:
            id_ = e[key]
            if not isinstance(id_, str) or not ID.fullmatch(id_):
                hard.add((kind, 'invalid-id')); continue
            tag = f'{kind}/{id_}'
            x = indexed.get((kind, id_))
            if not x:
                continue
            folder = f'{group}/{id_}'
            if x['path'] != folder:
                hard.add((tag, 'index-path'))
            if x.get('title') != e.get('name') or x.get('description') != e.get('description'):
                hard.add((tag, 'index-display-drift'))
            source = safe(folder)
            if any(p.is_symlink() or (p.is_file() and p.suffix.lower() not in {'.json', '.md', '.png'}) for p in source.rglob('*')):
                hard.add((tag, 'unexpected-file'))
            row = {'item': tag, 'category': e.get('category'), 'transport': [], 'auth': None, 'access': 'not-reviewed'}
            if kind == 'skill':
                meta, body = markdown(safe(folder + '/SKILL.md').read_text(encoding='utf-8'))
                if not body or body != e['promptPrefix'] or any(meta.get(a) != e.get(b) for a,b in [('title','name'),('category','category'),('description','description')]):
                    hard.add((tag, 'skill-bundle-drift'))
            elif kind == 'plugin':
                p = load(safe(folder + '/plugin.json')); schema(kind, tag, p)
                if any(p.get(f) != e.get(f) for f in ('slug','hooks','mcp','description','version')) or x['version'] != p['version']:
                    hard.add((tag, 'plugin-bundle-drift'))
                expected = []
                for ref in p['skills']:
                    if not re.fullmatch(r'skills/[A-Za-z0-9._-]+\.md', ref['path']):
                        hard.add((tag, 'skill-path')); continue
                    meta, body = markdown(safe(folder + '/' + ref['path']).read_text(encoding='utf-8'))
                    expected.append({'name': ref['name'], 'title': meta.get('title') or ref['name'], 'body': body})
                    if not body:
                        hard.add((tag, 'empty-plugin-skill'))
                if expected != e['skills'] or len(expected) != x.get('skillCount'):
                    hard.add((tag, 'plugin-skill-drift'))
                if any(('mcp', dep) not in indexed for dep in p.get('mcp', {})):
                    hard.add((tag, 'unknown-mcp-reference'))
            else:
                m = load(safe(folder + '/manifest.json')); schema(kind, tag, m)
                if m != e or m.get('auth') != x.get('auth') or m.get('version') != x['version']:
                    hard.add((tag, 'manifest-bundle-drift'))
                row.update(auth=m.get('auth'), transport=[t for t in ('remote','stdio') if t in m])
                if not m.get('docsUrl'):
                    review.add((tag, 'missing-docs'))
                if 'stdio' in m and pinned(m['stdio']) is not True:
                    review.add((tag, 'review-local-package-pin'))
                if 'remote' in m:
                    u = urlsplit(m['remote']['url'])
                    if u.scheme != 'https' or not u.hostname or u.username is not None or u.password is not None:
                        hard.add((tag, 'invalid-remote-origin'))
                if len({v['name'] for v in m.get('stdio', {}).get('env', [])}) != len(m.get('stdio', {}).get('env', [])):
                    hard.add((tag, 'duplicate-env-name'))
            rows.append(row)
    return sorted(hard), sorted(review), rows


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--root', type=Path, default=ROOT)
    ap.add_argument('--against', type=Path, help='Fail newly introduced documentation or package-pin warnings versus this checkout')
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--list', action='store_true', help='List matching entries; no external connections')
    ap.add_argument('--kind', choices=GROUP); ap.add_argument('--category'); ap.add_argument('--auth'); ap.add_argument('--transport', choices=('stdio','remote'))
    args = ap.parse_args()
    hard, review, rows = audit(args.root)
    new = sorted(set(review) - set(audit(args.against)[1])) if args.against else []
    selected = [r for r in rows if (not args.kind or r['item'].startswith(args.kind+'/')) and (not args.category or r['category']==args.category) and (not args.auth or r['auth']==args.auth) and (not args.transport or args.transport in r['transport'])]
    report = {'scanned':len(rows), 'errors':hard, 'review':review, 'newWarnings':new}
    if args.list:
        report['listings'] = selected
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f'{len(rows)} entries; {len(hard)} errors; {len(review)} review findings; {len(new)} new warnings')
        for code, count in sorted(Counter(v for _, v in review).items()): print(f'{code}: {count}')
        for entry, code in hard + new: print(entry, code)
        if args.list:
            for row in selected: print(json.dumps(row))
    return int(bool(hard or new))


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, KeyError, ValueError, TypeError, AttributeError) as err:
        sys.exit('Catalog audit could not complete (' + type(err).__name__ + '); check input files. No field values logged.')
