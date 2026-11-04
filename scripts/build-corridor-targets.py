"""Package selected service plans for the main tracker's live construction queue."""
from importlib import import_module
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'


def read(name):
    return json.loads((ASSETS / f'{name}.json').read_text())


def main():
    data = read('corridor-data')
    connected = read('connected-corridors')
    long_haul = read('long-haul-corridors')
    average = read('average-corridors')
    original = read('corridor-reference-migration')
    final_path = ASSETS / 'final-corridors.json'
    final = read('final-corridors') if final_path.exists() else None
    sparse_id = original['selected_target']
    data['plans'][long_haul['winner']] = long_haul['plan']
    data['plans'][average['winner']] = average['plan']
    balanced = average['balanced']
    data['plans'][balanced['id']] = balanced['plan']
    migrate = import_module('migrate-corridor-reference').migration
    migration = migrate(data, long_haul['winner'])
    average_migration = migrate(data, average['winner'])
    balanced_migration = migrate(data, balanced['id'])
    profiles = [
        ('long-haul', 'Long-haul hubs', long_haul['plan'], migration, 'long-haul'),
        ('balanced-three', 'Balanced · 3+ stops', balanced['plan'], balanced_migration, 'balanced-three'),
        ('longer-average', 'Longer average routes', average['plan'], average_migration, 'longer-average'),
        ('connected', 'Connected Long Routes', connected['plan'], connected['migration'], 'connected'),
        ('sparse', 'Original 27 routes', data['plans'][sparse_id], original, sparse_id),
    ]
    if final and final['accepted']:
        data['plans'][final['winner']] = final['plan']
        profiles.insert(0, ('final', 'Final · 3+ stops', final['plan'],
                            migrate(data, final['winner']), 'final'))
    targets = {}
    for key, label, plan, review, map_id in profiles:
        aliases = review['target_labels_to_reference_trains']
        names = {line['name']: aliases.get(line['name'], f"{label} {line['name']}")
                 for line in plan['lines']}
        retained = {}
        for line in review['extra_feeder_routes']:
            name = aliases.get(line['id'], f"{label} {line['id']}")
            for a, b in zip(line['path'], line['path'][1:]):
                retained['|'.join(sorted((a, b)))] = name
        targets[key] = {
            'label': label,
            'final': bool(final and key == ('final' if final['accepted'] else 'balanced-three')),
            'alaska_exception': key in ('final', 'balanced-three', 'longer-average'),
            'map': f'./assets/corridor-maps/{map_id}.svg',
            'owners': {edge: names[owner] for edge, owner in plan['owners'].items()},
            'retained': retained, 'lines': [{'id': line['name'], 'name': names[line['name']],
                    'path': line['path'], 'length': line['length'], 'color': line['color']} for line in plan['lines']],
            'fleet': plan['fleet'],
            'cities': plan['cities'], 'tracks': plan['tracks'], 'hubs': plan['metrics']['interchanges'],
            'short': sum(line['kind'] == 'loop' or len(line['path']) < 5 for line in plan['lines']),
        }
    (ASSETS / 'corridor-targets.js').write_text(
        'window.TrainCorridorTargets = ' + json.dumps({'targets': targets, 'edges': data['edges']},
                                                    ensure_ascii=False, separators=(',', ':')) + ';\n')


if __name__ == '__main__':
    main()
