"""Generate the public-reference checklist after the connected target is selected."""
import hashlib
from importlib import import_module
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    path = ROOT / 'assets/connected-corridors.json'
    study = json.loads(path.read_text())
    data = json.loads((ROOT / 'assets/corridor-data.json').read_text())
    target = study['winner']
    data['plans'][target] = study['plan']
    migration = import_module('migrate-corridor-reference').migration(data, target)
    if migration['unresolved']:
        raise ValueError(f"Unresolved public reference steps: {migration['unresolved']}")
    study['migration'] = migration
    study['checklist_hash'] = hashlib.sha256(
        json.dumps(migration['steps'], sort_keys=True).encode()
    ).hexdigest()
    path.write_text(json.dumps(study, separators=(',', ':')))
    print(f"Connected reference migration: {len(migration['steps'])} steps")


if __name__ == '__main__':
    main()
