"""Bind the accepted revision-4 delta to retained current native readback.

This command reads JSON files and writes one new manifest; it never opens a
database, starts a process, or changes task state.
"""
import argparse
import hashlib
import json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--bindings', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
args = p.parse_args()
root = Path(__file__).resolve().parent
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda path: json.loads(path.read_text())
checks = read(root / 'checks.json')
for name, expected_hash in checks['files'].items():
    if sha((root / name).read_bytes()) != expected_hash:
        raise SystemExit('Reviewed file changed: ' + name)
plan = read(root / 'plan.json')
base = read(root.parent / 'revision-3/plan.json')
if sha((root.parent / 'revision-3/plan.json').read_bytes()) != plan['revision_4']['base_plan_sha256']:
    raise SystemExit('Accepted revision-3 plan changed')
expected = read(root / 'bindings.example.json')
bindings = read(args.bindings)
for name in ['format', 'store_uuid']:
    if bindings.get(name) != expected[name]:
        raise SystemExit('Binding identity mismatch: ' + name)
for name in ['base_materialization_confirmed', 'claiming_paused_for_changed_tasks', 'old_edges_verified', 'original_954_unchanged']:
    if bindings.get(name) is not True:
        raise SystemExit('Required native reconciliation missing: ' + name)
inventory_path = Path(bindings.get('current_inventory_path') or '')
if not inventory_path.is_absolute() or not inventory_path.is_file():
    raise SystemExit('An absolute current full native inventory file is required')
inventory_bytes = inventory_path.read_bytes()
if sha(inventory_bytes) != bindings.get('current_inventory_sha256'):
    raise SystemExit('Current inventory differs from its retained hash')
inventory = json.loads(inventory_bytes)
if not isinstance(inventory, list) or len(inventory) != 971:
    raise SystemExit('Reconcile a complete 971-record pre-delta inventory first')
by_id = {row['id']: row for row in inventory}
if len(by_id) != 971:
    raise SystemExit('Duplicate native IDs in the full inventory')
ids = plan['revision_4']['base_task_ids']
before = {t['key']: t for t in base['tasks']}
changed = set(plan['revision_4']['changed_existing_task_keys'])
if set(bindings.get('tasks', {})) != set(ids):
    raise SystemExit('All 17 existing task bindings are required')
for key, issue_id in ids.items():
    b = bindings['tasks'][key]
    row = by_id.get(issue_id)
    if not row or b.get('id') != issue_id:
        raise SystemExit('Actual materialized ID mismatch: ' + key)
    if b.get('unique_ref') != 'bead-edit-20261124:' + key or b.get('ref_matches') != [issue_id] or not b.get('record_source'):
        raise SystemExit('Current unique-reference readback required: ' + key)
    if row.get('description') != before[key]['description']:
        raise SystemExit('Live old description differs; reconcile before revision: ' + key)
    if sha(row['description'].encode()) != b.get('description_sha256'):
        raise SystemExit('Description binding hash mismatch: ' + key)
    if row.get('title') != before[key]['title']:
        raise SystemExit('Live task title differs: ' + key)
    if sorted(row.get('resource_keys', [])) != sorted(before[key]['resource_keys']):
        raise SystemExit('Existing resource declarations differ: ' + key)
    revision = row.get('revision')
    if isinstance(revision, bool) or not isinstance(revision, int) or revision < 1 or b.get('revision') != revision:
        raise SystemExit('Actual current positive revision required: ' + key)
    if key in changed and b.get('claim_released_or_absent') is not True:
        raise SystemExit('Legitimate claim reconciliation required: ' + key)
    if key in changed and row.get('status') == 'closed':
        raise SystemExit('Changed pending work is already closed; reconcile its result first: ' + key)

expected_edges = {(ids[e['blocked']], ids[e['blocker']], 'blocks') for e in base['blocking_edges']}
actual_edges = {(issue_id, d['blocker'], d['kind'])
                for issue_id in ids.values() for d in by_id[issue_id].get('dependencies', [])
                if d.get('kind') == 'blocks'}
if actual_edges != expected_edges:
    raise SystemExit('Current continuation blocking edges differ from accepted revision 3')
if set(bindings.get('new_unique_refs', {})) != set(expected['new_unique_refs']):
    raise SystemExit('Exactly the four new reference checks are required')
for ref, b in bindings['new_unique_refs'].items():
    if b.get('matches') != [] or not b.get('record_source'):
        raise SystemExit('New reference must be confirmed absent: ' + ref)

def bind(value):
    if isinstance(value, list):
        return [bind(item) for item in value]
    if isinstance(value, dict):
        return {key: bind(item) for key, item in value.items()}
    if isinstance(value, str) and value.startswith('@revision:'):
        return bindings['tasks'][value.removeprefix('@revision:')]['revision']
    return value

rendered = bind(read(root / 'delta-manifest.template.json'))
encoded = (json.dumps(rendered, indent=2, ensure_ascii=False) + '\n').encode()
if b'"@revision:' in encoded or b'"@id:' in encoded:
    raise SystemExit('An unresolved marker remains')
if sum(o['op'] == 'create' for o in rendered['operations']) != 4:
    raise SystemExit('Only the four accepted new tasks may be created')
with args.output.open('xb') as output:
    output.write(encoded)
print(json.dumps({'output': str(args.output.resolve()), 'sha256': sha(encoded),
    'operations': len(rendered['operations']), 'current_inventory_sha256': sha(inventory_bytes),
    'existing_tasks_preserved': 17, 'new_tasks': 4, 'database_access': False}, indent=2))
