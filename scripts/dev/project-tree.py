#!/usr/bin/env python3
"""Regenerate docs/project-tree.md from git-tracked files: python3 scripts/dev/project-tree.py"""
import os, subprocess

def git(*a): return subprocess.run(['git', *a], capture_output=True, text=True, check=True).stdout.splitlines()

files = [f for f in git('ls-files') if f]
subs = {l.split()[1] for l in git('submodule', 'status')}
DEPTH = {'products': 4, 'apps': 4, 'docs': 4, 'scripts': 4, 'infrastructure': 4, 'tests': 4, 'packages': 3, '.github': 3, '.agents': 3}
COLLAPSE = {'.agents/skills/': 'vendored agent skills'}

tree = {}
for f in files:
    parts = f.split('/')
    d = DEPTH.get(parts[0], 2)
    for c, _ in COLLAPSE.items():
        if f.startswith(c): parts, d = c.rstrip('/').split('/'), 99
    node = tree
    for i, p in enumerate(parts[:d]):
        is_dir = i < len(parts[:d]) - 1 or len(parts) > d or f.startswith(tuple(COLLAPSE))
        node = node.setdefault(p + ('/' if is_dir else ''), {})

out = ['Zolexora_Platform/']
def walk(node, prefix, path):
    items = sorted(node.items(), key=lambda kv: (not kv[0].endswith('/'), kv[0].lower()))
    for i, (k, v) in enumerate(items):
        full, last = path + k, i == len(items) - 1
        label = k
        if os.path.islink(full.rstrip('/')): label = f'{k} -> {os.readlink(full.rstrip("/"))}'
        elif k.endswith('/') and not v:
            n = sum(f.startswith(full) for f in files)
            note = COLLAPSE.get(full, '')
            label += f'  ({n} files{", " + note if note else ""})' + ('  [contains git submodules]' if any(s.startswith(full) for s in subs) else '')
        out.append(prefix + ('└── ' if last else '├── ') + label)
        if v: walk(v, prefix + ('    ' if last else '│   '), full)
walk(tree, '', '')

doc = f'''# Project Tree

Generated from `git ls-files` by `python3 scripts/dev/project-tree.py`; rerun it after moving or adding folders. Deep folders are collapsed to a file count. Layout rules: [architecture.md](architecture.md#product-layout).

| Path | Holds |
| --- | --- |
| `products/zolexora-<product>/` | One product each: `apps/` (frontends, mobile), `services/` (backends), `packages/` (product-local libs), `scripts/docker-start.sh`, `docs/`, `compose.yaml`, `.infisical.json` |
| `apps/` | Cross-product apps: `zolexora-auth-service` (identity, :3081), `zolexora-platform-admin` (:3095) |
| `packages/` | Shared libraries, published as `@zolexora/<folder>` |
| `infrastructure/` | Shared Dockerfiles, nginx gateway image, database schemas/migrations, Supabase, Render spec |
| `scripts/` | Repo-wide dev / setup / docker / ports scripts ([README](../scripts/README.md)) |
| `tests/e2e/` | Cross-product E2E suites (auth-service, TMS) |
| `docs/` | Architecture, ADRs, ports, secrets, this tree |
| `.agents/` | AI agent rules, skills, MCP config |
| `.github/` | Workflows (`zolexora-<product>-<purpose>.yml`), composite actions, templates |

```text
{chr(10).join(out)}
```
'''
open(os.path.join(git('rev-parse', '--show-toplevel')[0], 'docs/project-tree.md'), 'w').write(doc)
print('wrote docs/project-tree.md,', len(out), 'lines')
