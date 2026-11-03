"""Read-only, structural route review. Never adopts a plan or edits a save."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import unicodedata

import networkx as nx
import numpy as np
from scipy.optimize import linear_sum_assignment

SCHEMA = 'pocket-trains-configuration/v1'


def folded(value):
    return ''.join(c for c in unicodedata.normalize('NFKD', str(value)).casefold() if c.isalnum())


def edge_id(a, b):
    return '|'.join(sorted((a, b)))


def graph(tracks):
    g = nx.Graph()
    g.add_edges_from((e['a'], e['b']) for e in tracks)
    return g


def connected(tracks):
    return not tracks or nx.is_connected(graph(tracks))


def normalize(raw, world, historical):
    """Read explicit owned tracks only. Do not seed the author's starting map."""
    if not isinstance(raw, dict):
        raise ValueError('Configuration must be a JSON object')
    edges = {e['id']: e for e in world['edges']}
    cities = {folded(c): c for c in world['cities']}
    if 'Kyiv' in world['cities']:
        cities['kiev'] = 'Kyiv'
    issues, notes, tracks = [], [], []
    metadata = {}
    for train in raw.get('railroads', []):
        if not isinstance(train, dict) or not isinstance(train.get('id'), str):
            raise ValueError('Each railroad needs a string id')
        train_id = train['id'].strip()
        if not train_id:
            raise ValueError('Railroad id cannot be empty')
        if train_id in metadata:
            raise ValueError('Duplicate railroad id: ' + train_id)
        metadata[train_id] = {**train, 'id': train_id}
    if raw.get('schema') == SCHEMA:
        rows = raw.get('tracks')
        if not isinstance(rows, list):
            raise ValueError('Configuration needs an explicit tracks array')
        coverage = raw.get('coverage', 'partial')
        if coverage not in ('complete', 'partial'):
            raise ValueError('coverage must be complete or partial')
        licenses = raw.get('licenses')  # absent means unknown, not Europe by default
        coins = raw.get('coins')
        source = 'explicit-configuration'
    elif raw.get('version') in (3, 4, 5) and isinstance(raw.get('done'), dict):
        refs = {e['id']: e for e in historical['edges']}
        rows = []
        overrides = raw.get('owners', {})
        if not isinstance(overrides, dict):
            raise ValueError('Backup owners must be an object')
        inherited = []
        for key, done in raw['done'].items():
            if done is not True:
                continue
            if key in edges:
                owner = overrides.get(key)
                if owner is None and key in refs:
                    owner = refs[key]['owner']
                    inherited.append(key)
                rows.append({'a': edges[key]['a'], 'b': edges[key]['b'], 'railroad': owner})
            elif key not in {x['id'] for x in historical['licenses']}:
                issues.append('Unmapped completed backup item: ' + key)
        if inherited:
            notes.append('Tracker-format owners inherit that format’s reference defaults on ' + str(len(inherited)) + ' explicit owned tracks; verify if the game differs.')
        # Europe is an invariant of this tracker format, not of arbitrary screenshots.
        licenses = ['Europe'] + [x['region'] for x in historical['licenses'] if raw['done'].get(x['id']) is True]
        coins = raw.get('balance')
        coverage, source = 'complete', 'tracker-backup'
        notes.append('Backup omissions are treated as unowned; no original/completed reference tracks were added.')
    else:
        raise ValueError('Use an explicit ' + SCHEMA + ' configuration or a version 3–5 tracker export; transcribe other formats without inventing tracks.')
    if licenses is not None:
        if not isinstance(licenses, list) or any(x not in set(world['regions'].values()) for x in licenses):
            raise ValueError('licenses must list recognized region names, or be omitted when unknown')
        licenses = sorted(set(licenses))
    if coins is not None and (isinstance(coins, bool) or not isinstance(coins, (int, float)) or not math.isfinite(coins) or coins < 0):
        raise ValueError('coins must be a nonnegative finite number, or omitted')
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError('Each track must be an object')
        a, b = cities.get(folded(row.get('a'))), cities.get(folded(row.get('b')))
        if not a or not b or edge_id(a, b) not in edges:
            issues.append('Unmapped track: ' + str(row.get('a')) + ' ↔ ' + str(row.get('b')))
            continue
        key = edge_id(a, b)
        if key in seen:
            raise ValueError('Duplicate track, possibly conflicting owners: ' + key)
        seen.add(key)
        owner = row.get('railroad')
        if not isinstance(owner, str) or not owner.strip():
            issues.append('Unknown railroad for ' + key)
            continue
        owner = owner.strip()
        tracks.append({**edges[key], 'railroad': owner})
        metadata.setdefault(owner, {'id': owner})
    for owner, info in metadata.items():
        if info.get('position') is not None:
            position = cities.get(folded(info['position']))
            if not position:
                notes.append('Unknown reported train position for ' + owner + '; verify parking before any claim')
            info['position'] = position
    if coverage != 'complete':
        issues.append('Partial map: unseen tracks/owners can change connectivity and the proposed entry point.')
    return {'tracks': tracks, 'railroads': metadata, 'licenses': licenses, 'coins': coins,
            'coverage': coverage, 'source': source, 'issues': issues, 'notes': notes}


def audit(tracks, coordinates):
    result = []
    for owner in sorted({e['railroad'] for e in tracks}):
        mine = [e for e in tracks if e['railroad'] == owner]
        g = graph(mine)
        endpoints = sorted(c for c, degree in g.degree if degree == 1)
        branches = sum(max(0, degree - 2) for _, degree in g.degree)
        cycles = g.number_of_edges() - g.number_of_nodes() + nx.number_connected_components(g)
        directness = None
        if nx.is_connected(g) and not branches and not cycles and len(endpoints) == 2:
            chord_sum = sum(math.dist(coordinates[e['a']], coordinates[e['b']]) for e in mine)
            directness = math.dist(coordinates[endpoints[0]], coordinates[endpoints[1]]) / chord_sum if chord_sum else None
        result.append({'railroad': owner, 'tracks': len(mine), 'cities': len(g),
                       'components': nx.number_connected_components(g), 'branch_index': branches,
                       'cycles': cycles, 'endpoints': endpoints,
                       'track_distance': sum(e['fuel'] for e in mine),
                       'image_chord_directness': directness})
    return result


def match_labels(tracks, target):
    """Maximize unchanged built tracks, allowing arbitrary player train labels."""
    actual = sorted({e['railroad'] for e in tracks})
    wanted = sorted(set(target['owners'].values()))
    if not actual:
        return {}, {}
    overlap = Counter((e['railroad'], target['owners'][e['id']]) for e in tracks if e['id'] in target['owners'])
    weight = np.zeros((len(actual), len(wanted)), dtype=np.int64)
    multiplier = max(len(actual), len(wanted)) + 1
    for i, owner in enumerate(actual):
        for j, name in enumerate(wanted):
            weight[i, j] = overlap[owner, name] * multiplier + int(owner == name)
    rows, cols = linear_sum_assignment(weight, maximize=True)
    # Zero-overlap matches are new assignments, not evidence of a corresponding train.
    mapping = {wanted[j]: actual[i] for i, j in zip(rows, cols) if overlap[actual[i], wanted[j]]}
    anchors = {name: sorted(e['id'] for e in tracks if e['railroad'] == owner and target['owners'].get(e['id']) == name)
               for name, owner in mapping.items()}
    return mapping, anchors


def correction_order(tracks, target, mapping, metadata):
    """Only single claims preserving both owner graphs; defer anything harder."""
    owners = {e['id']: e['railroad'] for e in tracks}
    by_id = {e['id']: e for e in tracks}
    goals = {e['id']: mapping.get(target['owners'][e['id']], 'NEW TRAIN: ' + target['owners'][e['id']])
             for e in tracks if e['id'] in target['owners']}
    pending = sorted(key for key in goals if goals[key] != owners[key])
    sequence, deferred = [], []

    def reasons(key):
        donor, recipient, edge = owners[key], goals[key], by_id[key]
        kept = [e for e in tracks if owners[e['id']] == donor and e['id'] != key]
        received = [e for e in tracks if owners[e['id']] == recipient]
        why = []
        if not kept:
            why.append('Would remove the donor’s final track; establish its retained route/train arrangement first')
        elif not connected(kept):
            why.append('Would disconnect the donor; needs an alternate retained connection or a separately verified batch')
        if received and not connected(received + [edge]):
            why.append('Recipient must reach an endpoint first')
        return why

    while pending:
        ready = next((key for key in pending if not reasons(key)), None)
        if ready is None:
            break
        donor, recipient = owners[ready], goals[ready]
        kept = [e for e in tracks if owners[e['id']] == donor and e['id'] != ready]
        checks = ['Verify current reclaim fee, available coins, recipient engine and both train positions in game']
        info = metadata.get(donor, {})
        nodes = set(graph(kept))
        if info.get('position') not in nodes or info.get('status') != 'stationary':
            checks.append('Park ' + donor + ' stationary on its retained connected route before reclaiming')
        if recipient.startswith('NEW TRAIN: '):
            checks.append('Provide a usable engine for ' + recipient + '; first claim creates its route')
        sequence.append({'order': len(sequence) + 1, 'track': ready, 'from': donor, 'to': recipient,
                         'classification': 'GRAPH-FEASIBLE, VERIFY IN GAME',
                         'depends_on': sequence[-1]['track'] if sequence else None, 'checks': checks})
        owners[ready] = recipient
        pending.remove(ready)
    for key in pending:
        deferred.append({'track': key, 'from': owners[key], 'to': goals[key], 'reasons': reasons(key)})
    return sequence, deferred


def compare(current, world, target):
    tracks = current['tracks']
    mapping, anchors = match_labels(tracks, target)
    changes = [e for e in tracks if e['id'] in target['owners'] and
               mapping.get(target['owners'][e['id']]) != e['railroad']]
    unused = sorted(e['id'] for e in tracks if e['id'] not in target['owners'])
    sequence, deferred = correction_order(tracks, target, mapping, current['railroads']) if not current['issues'] else ([], [])
    complete = {e['id'] for e in tracks}
    nodes = set(graph(tracks))
    frontier = []
    for edge in world['edges']:
        key = edge['id']
        if key in complete or key not in target['owners'] or not ({edge['a'], edge['b']} & nodes):
            continue
        label = target['owners'][key]
        recipient = mapping.get(label)
        owned_nodes = set(graph([e for e in tracks if e['railroad'] == recipient])) if recipient else set()
        if owned_nodes and not ({edge['a'], edge['b']} & owned_nodes):
            continue
        regions = {world['regions'][edge['a']], world['regions'][edge['b']]}
        missing = sorted(regions - set(current['licenses'])) if current['licenses'] is not None else None
        checks = ['Verify live build/claim prices and train range; this is a structural frontier, not a profit ranking']
        if missing is None:
            checks.append('Confirm unlocked licenses')
        elif missing:
            checks.append('Unlock ' + ', '.join(missing) + ' first')
        if recipient is None:
            checks.append('Provide an engine for a new railroad before its first claim')
        frontier.append({'track': key, 'target_label': label, 'player_railroad': recipient,
                         'extends_existing_train': recipient is not None,
                         'missing_licenses': missing, 'historical_build_claim_reference': edge.get('cost'),
                         'checks': checks})
    frontier.sort(key=lambda e: (e['missing_licenses'] is None or bool(e['missing_licenses']),
                                 not e['extends_existing_train'], e['track']))
    safe = not current['issues'] and all(x['components'] == 1 for x in audit(tracks, world['reward_geometry']['coordinates']))
    if not safe:
        sequence, deferred, frontier = [], [], []
    return {'label': target['label'], 'fleet': target['fleet'], 'service_links': target['tracks'],
            'branch_index': target['branches'], 'player_train_for_target': mapping, 'corridor_anchors': anchors,
            'matching_built_tracks': len(tracks) - len(changes) - len(unused),
            'owner_differences': [{'track': e['id'], 'from': e['railroad'], 'target_label': target['owners'][e['id']]} for e in changes],
            'built_links_outside_service_plan': unused,
            'graph_feasible_corrections': sequence, 'deferred_corrections': deferred,
            'next_connected_purchase_candidates': frontier[:8],
            'purchase_candidate_basis': 'Original submitted snapshot; recompute after purchases or corrections',
            'recommendation_status': 'STRUCTURAL REVIEW ONLY' if safe else 'RESOLVE INCOMPLETE OR DISCONNECTED INPUT FIRST',
            'operational_readiness': 'Unverified: engine availability, actual fees, train positions and phase-specific earnings need review',
            'unused_link_instruction': 'Keep existing physical tracks; unused by this target does not mean sell or demolish'}


def review(raw, world, historical, targets):
    current = normalize(raw, world, historical)
    return {'schema': 'pocket-trains-configuration-review/v1', 'input_source': current['source'],
            'scope': current['coverage'], 'confirmed_owned_tracks': len(current['tracks']),
            'physical_network_components': nx.number_connected_components(graph(current['tracks'])),
            'cities_reached': len(graph(current['tracks'])), 'coins': current['coins'],
            'licenses': current['licenses'], 'issues': current['issues'], 'notes': current['notes'],
            'current_lines': audit(current['tracks'], world['reward_geometry']['coordinates']),
            'target_reviews': {key: compare(current, world, world['plans'][key]) for key in targets},
            'limitations': ['Structural candidates, not a demonstrated profit optimum or a game action',
                            'Image directness uses chord lengths in the reference image; actual track curves and measured payouts are not recovered',
                            'Full-world operating results do not establish gains for this partial configuration',
                            'No save, tracker state, game configuration or repository data was modified']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('configuration', type=Path)
    parser.add_argument('--repo', type=Path, default=None)
    parser.add_argument('--data', type=Path, default=Path('assets/operating-data.json'), help='Versioned graph/plan JSON, relative to --repo unless absolute')
    parser.add_argument('--target', action='append', help='Plan ID in the selected dataset; repeat to compare several')
    args = parser.parse_args()
    repo = args.repo or next((p for p in [Path.cwd(), *Path.cwd().parents, *Path(__file__).resolve().parents]
                             if (p / 'assets/operating-data.json').exists()), None)
    if repo is None:
        parser.error('Pass --repo pointing to a Pocket Train Optimizer checkout')
    try:
        raw = json.loads(args.configuration.read_text())
        world = json.loads((repo / args.data).read_text())
        historical = json.loads((repo / 'analysis/world_tracker_data.json').read_text())
        targets = args.target or world.get('default_targets') or ['corridors38', 'corridors28']
        unknown = sorted(set(targets) - set(world['plans']))
        if unknown:
            raise ValueError('Unknown target plan: ' + ', '.join(unknown))
        result = review(raw, world, historical, targets)
    except (OSError, ValueError, TypeError, KeyError) as exc:
        parser.exit(2, 'Configuration could not be reviewed: ' + str(exc) + '\n')
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == '__main__':
    main()
