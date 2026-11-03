"""Personal-map intake and correction safety, independent of the author's start."""
import copy
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import unittest

import networkx as nx

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / '.agents/skills/pocket-trains-route-coach/scripts/review_configuration.py'
spec = importlib.util.spec_from_file_location('configuration_coach', SCRIPT)
coach = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coach)


def fixture(pairs, actual, wanted):
    cities = sorted({c for pair in pairs for c in pair})
    edges = [{'id': '|'.join(sorted(pair)), 'a': pair[0], 'b': pair[1], 'fuel': 10, 'cost': None} for pair in pairs]
    target = {'label': 'Test corridor target', 'owners': wanted,
              'fleet': len(set(wanted.values())), 'tracks': len(wanted), 'branches': 0}
    world = {'cities': cities, 'edges': edges, 'regions': {c: 'Europe' for c in cities},
             'reward_geometry': {'coordinates': {c: [i * 10, 0] for i, c in enumerate(cities)}},
             'plans': {'test': target}}
    historical = {'edges': [{**e, 'owner': 'Reference'} for e in edges], 'base': list(wanted),
                  'done': list(wanted), 'licenses': []}
    raw = {'schema': coach.SCHEMA, 'coverage': 'complete', 'licenses': ['Europe'],
           'tracks': [{'a': e['a'], 'b': e['b'], 'railroad': actual[e['id']]} for e in edges if e['id'] in actual]}
    return raw, world, historical


class ConfigurationCoachTests(unittest.TestCase):
    def test_empty_and_sparse_input_do_not_inherit_the_reference_start(self):
        raw, world, historical = fixture([('A', 'B'), ('B', 'C')], {}, {'A|B': 'X', 'B|C': 'X'})
        report = coach.review(raw, world, historical, ['test'])
        self.assertEqual(report['confirmed_owned_tracks'], 0)
        self.assertEqual(report['target_reviews']['test']['next_connected_purchase_candidates'], [])
        backup = {'version': 5, 'done': {'A|B': True, 'B|C': False}, 'owners': {}}
        before = copy.deepcopy(backup)
        r = coach.review(backup, world, historical, ['test'])
        self.assertEqual(r['confirmed_owned_tracks'], 1)
        self.assertEqual(backup, before)
        self.assertTrue(any('reference defaults' in n for n in r['notes']))

    def test_label_matching_keeps_a_permuted_players_actual_trains(self):
        raw, world, historical = fixture([('A', 'B'), ('B', 'C'), ('C', 'D')],
                                         {'A|B': 'My Orange', 'B|C': 'My Orange', 'C|D': 'My Teal'},
                                         {'A|B': 'Blue', 'B|C': 'Blue', 'C|D': 'Pink'})
        r = coach.review(raw, world, historical, ['test'])['target_reviews']['test']
        self.assertEqual(r['matching_built_tracks'], 3)
        self.assertEqual(r['owner_differences'], [])
        self.assertEqual(r['player_train_for_target'], {'Blue': 'My Orange', 'Pink': 'My Teal'})

    def test_matching_is_maximum_preservation_among_one_to_one_assignments(self):
        raw, world, _ = fixture([('A', 'B'), ('B', 'C'), ('C', 'D'), ('D', 'E'), ('E', 'F')],
                                {'A|B': 'T1', 'B|C': 'T1', 'C|D': 'T2', 'D|E': 'T3', 'E|F': 'T3'},
                                {'A|B': 'X', 'B|C': 'Y', 'C|D': 'Y', 'D|E': 'X', 'E|F': 'X'})
        tracks = [{**e, 'railroad': next(t['railroad'] for t in raw['tracks'] if coach.edge_id(t['a'], t['b']) == e['id'])} for e in world['edges']]
        target = world['plans']['test']
        mapping, _ = coach.match_labels(tracks, target)
        kept = lambda m: sum(m.get(target['owners'][e['id']]) == e['railroad'] for e in tracks)
        best = max(kept(dict(zip(['X', 'Y'], p))) for p in itertools.permutations(['T1', 'T2', 'T3'], 2))
        self.assertEqual(kept(mapping), best)

    def test_bridge_reclaim_defers_until_an_alternate_retained_route_exists(self):
        pairs = [('A', 'B'), ('B', 'C'), ('C', 'D'), ('B', 'E'), ('A', 'D')]
        actual = {'A|B': 'Donor', 'B|C': 'Donor', 'C|D': 'Donor', 'B|E': 'Recipient'}
        target = {'A|B': 'X', 'A|D': 'X', 'C|D': 'X', 'B|C': 'Y', 'B|E': 'Y'}
        raw, world, historical = fixture(pairs, actual, target)
        p = coach.review(raw, world, historical, ['test'])['target_reviews']['test']
        self.assertFalse(p['graph_feasible_corrections'])
        self.assertIn('disconnect', p['deferred_corrections'][0]['reasons'][0])
        self.assertIn('A|D', [e['track'] for e in p['next_connected_purchase_candidates']])
        raw['tracks'].append({'a': 'A', 'b': 'D', 'railroad': 'Donor'})
        before = copy.deepcopy((raw, world, historical))
        p = coach.review(raw, world, historical, ['test'])['target_reviews']['test']
        self.assertEqual([x['track'] for x in p['graph_feasible_corrections']], ['B|C'])
        owners = {coach.edge_id(t['a'], t['b']): t['railroad'] for t in raw['tracks']}
        for step in p['graph_feasible_corrections']:
            owners[step['track']] = step['to']
            for owner in set(owners.values()):
                g = nx.Graph([tuple(key.split('|')) for key, value in owners.items() if value == owner])
                self.assertTrue(nx.is_connected(g))
            self.assertTrue(step['checks'])
            self.assertEqual(step['classification'], 'GRAPH-FEASIBLE, VERIFY IN GAME')
        self.assertEqual((raw, world, historical), before)

    def test_recipient_must_be_connected_and_final_donor_track_is_retained(self):
        raw, world, historical = fixture([('A', 'B'), ('B', 'C'), ('C', 'E'), ('E', 'F')],
                                         {'A|B': 'Donor', 'B|C': 'Donor', 'E|F': 'Recipient'},
                                         {'A|B': 'X', 'B|C': 'Y', 'C|E': 'Y', 'E|F': 'Y'})
        p = coach.review(raw, world, historical, ['test'])['target_reviews']['test']
        self.assertTrue(any('Recipient must reach' in why for d in p['deferred_corrections'] for why in d['reasons']))
        tracks = [{'id': 'A|B', 'a': 'A', 'b': 'B', 'railroad': 'Only train'}]
        order, deferred = coach.correction_order(tracks, {'owners': {'A|B': 'New label'}}, {}, {})
        self.assertFalse(order)
        self.assertIn('final track', deferred[0]['reasons'][0])

    def test_ambiguous_partial_unknown_or_disconnected_input_produces_no_actions(self):
        raw, world, historical = fixture([('A', 'B'), ('B', 'C'), ('C', 'D')],
                                         {'A|B': 'T1', 'B|C': 'T1'}, {'A|B': 'X', 'B|C': 'X', 'C|D': 'X'})
        variants = [dict(raw, coverage='partial'), dict(raw, tracks=raw['tracks'] + [{'a': 'Mystery', 'b': 'D', 'railroad': 'T1'}]),
                    dict(raw, tracks=[dict(raw['tracks'][0], railroad=None)]),
                    dict(raw, tracks=[{'a': 'A', 'b': 'B', 'railroad': 'T1'}, {'a': 'C', 'b': 'D', 'railroad': 'T1'}])]
        for item in variants:
            p = coach.review(item, world, historical, ['test'])['target_reviews']['test']
            self.assertEqual(p['graph_feasible_corrections'], [])
            self.assertEqual(p['next_connected_purchase_candidates'], [])
            self.assertIn('RESOLVE', p['recommendation_status'])
        with self.assertRaises(ValueError):
            coach.review(dict(raw, tracks=raw['tracks'] + [raw['tracks'][0]]), world, historical, ['test'])

    def test_example_cli_is_read_only_and_handles_the_real_repository(self):
        example = SCRIPT.parents[1] / 'assets/current-configuration.example.json'
        before = example.read_bytes()
        proc = subprocess.run(['python3', str(SCRIPT), str(example), '--repo', str(ROOT)], check=True, capture_output=True, text=True)
        r = json.loads(proc.stdout)
        self.assertEqual(r['confirmed_owned_tracks'], 3)
        self.assertEqual(set(r['target_reviews']), {'corridors38', 'corridors28'})
        self.assertEqual(example.read_bytes(), before)
        self.assertEqual(r['issues'], [])


if __name__ == '__main__':
    unittest.main()
