#!/usr/bin/env python3
"""Offline publisher checks. Catalog entries are data; never execute or contact them."""
import argparse
import json
import re
import sys
from collections import Counter
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parents[1]
GROUP = {'skill': 'skills', 'mcp': 'mcp', 'plugin': 'plugins'}
ID = re.compile(r'[a-z0-9][a-z0-9._-]{0,79}')
SCHEME = re.compile(r'^[A-Za-z][A-Za-z0-9+.-]*:')
RFC3339 = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$')


def valid_date_time(value):
    if not isinstance(value, str) or not RFC3339.fullmatch(value):
        return False
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False


def valid_uri(value):
    if not isinstance(value, str) or not SCHEME.match(value) or any(c.isspace() for c in value):
        return False
    try:
        parts = urlsplit(value)
        parts.port
    except ValueError:
        return False
    return bool(parts.netloc or parts.path)


# FormatChecker skips optional third-party format packages when they are absent.
# Register the two formats this catalog uses with stdlib-only checks instead.
FORMAT_CHECKER = FormatChecker()
FORMAT_CHECKER.checks('date-time')(valid_date_time)
FORMAT_CHECKER.checks('uri')(valid_uri)


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

    schema_root = Path(schema_dir) if schema_dir else ROOT / 'schemas'
    schemas = {
        k: Draft202012Validator(load(schema_root / (k + '.schema.json')), format_checker=FORMAT_CHECKER)
        for k in ('index', 'mcp', 'plugin')
    }
    hard, review, rows = set(), set(), []

    def schema(kind, item, data):
        for error in schemas[kind].iter_errors(data):
            # Never include values in logs (invalid data can contain credentials).
            hard.add((item, 'schema:' + str(error.validator) + ':' + '/'.join(map(str, error.absolute_schema_path))))

    idx, bundle = [load(safe('catalog/' + name + '.json')) for name in ('index', 'bundle')]
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
        for entry in entries:
            id_ = entry[key]
            if not isinstance(id_, str) or not ID.fullmatch(id_):
                hard.add((kind, 'invalid-id'))
                continue
            tag = f'{kind}/{id_}'
            item = indexed.get((kind, id_))
            if not item:
                continue
            folder = f'{group}/{id_}'
            if item['path'] != folder:
                hard.add((tag, 'index-path'))
            if item.get('title') != entry.get('name') or item.get('description') != entry.get('description'):
                hard.add((tag, 'index-display-drift'))
            source = safe(folder)
            if any(p.is_symlink() or (p.is_file() and p.suffix.lower() not in {'.json', '.md', '.png'}) for p in source.rglob('*')):
                hard.add((tag, 'unexpected-file'))
            row = {'item': tag, 'category': entry.get('category'), 'transport': [], 'auth': None, 'access': 'not-reviewed'}
            if kind == 'skill':
                meta, body = markdown(safe(folder + '/SKILL.md').read_text(encoding='utf-8'))
                if not body or body != entry['promptPrefix'] or any(meta.get(a) != entry.get(b) for a, b in [('title', 'name'), ('category', 'category'), ('description', 'description')]):
                    hard.add((tag, 'skill-bundle-drift'))
            elif kind == 'plugin':
                plugin = load(safe(folder + '/plugin.json'))
                schema(kind, tag, plugin)
                if any(plugin.get(f) != entry.get(f) for f in ('slug', 'hooks', 'mcp', 'description', 'version')) or item['version'] != plugin['version']:
                    hard.add((tag, 'plugin-bundle-drift'))
                expected = []
                for ref in plugin['skills']:
                    if not re.fullmatch(r'skills/[A-Za-z0-9._-]+\.md', ref['path']):
                        hard.add((tag, 'skill-path'))
                        continue
                    meta, body = markdown(safe(folder + '/' + ref['path']).read_text(encoding='utf-8'))
                    expected.append({'name': ref['name'], 'title': meta.get('title') or ref['name'], 'body': body})
                    if not body:
                        hard.add((tag, 'empty-plugin-skill'))
                if expected != entry['skills'] or len(expected) != item.get('skillCount'):
                    hard.add((tag, 'plugin-skill-drift'))
                if any(('mcp', dep) not in indexed for dep in plugin.get('mcp', {})):
                    hard.add((tag, 'unknown-mcp-reference'))
            else:
                manifest = load(safe(folder + '/manifest.json'))
                schema(kind, tag, manifest)
                if manifest != entry or manifest.get('auth') != item.get('auth') or manifest.get('version') != item['version']:
                    hard.add((tag, 'manifest-bundle-drift'))
                row.update(auth=manifest.get('auth'), transport=[t for t in ('remote', 'stdio') if t in manifest])
                if not manifest.get('docsUrl'):
                    review.add((tag, 'missing-docs'))
                if 'stdio' in manifest and pinned(manifest['stdio']) is not True:
                    review.add((tag, 'review-local-package-pin'))
                if 'remote' in manifest:
                    url = urlsplit(manifest['remote']['url'])
                    if url.scheme != 'https' or not url.hostname or url.username is not None or url.password is not None:
                        hard.add((tag, 'invalid-remote-origin'))
                if len({v['name'] for v in manifest.get('stdio', {}).get('env', [])}) != len(manifest.get('stdio', {}).get('env', [])):
                    hard.add((tag, 'duplicate-env-name'))
            rows.append(row)
    return sorted(hard), sorted(review), rows


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--against', type=Path, help='Fail newly introduced documentation or package-pin warnings versus this checkout')
    parser.add_argument('--json', action='store_true')
    parser.add_argument('--list', action='store_true', help='List matching entries; no external connections')
    parser.add_argument('--kind', choices=GROUP)
    parser.add_argument('--category')
    parser.add_argument('--auth')
    parser.add_argument('--transport', choices=('stdio', 'remote'))
    args = parser.parse_args()
    hard, review, rows = audit(args.root)
    new = sorted(set(review) - set(audit(args.against)[1])) if args.against else []
    selected = [r for r in rows if (not args.kind or r['item'].startswith(args.kind + '/')) and (not args.category or r['category'] == args.category) and (not args.auth or r['auth'] == args.auth) and (not args.transport or args.transport in r['transport'])]
    report = {'scanned': len(rows), 'errors': hard, 'review': review, 'newWarnings': new}
    if args.list:
        report['listings'] = selected
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f'{len(rows)} entries; {len(hard)} errors; {len(review)} review findings; {len(new)} new warnings')
        for code, count in sorted(Counter(v for _, v in review).items()):
            print(f'{code}: {count}')
        for entry, code in hard + new:
            print(entry, code)
        if args.list:
            for row in selected:
                print(json.dumps(row))
    return int(bool(hard or new))


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, KeyError, ValueError, TypeError, AttributeError) as err:
        sys.exit('Catalog audit could not complete (' + type(err).__name__ + '); check input files. No field values logged.')
