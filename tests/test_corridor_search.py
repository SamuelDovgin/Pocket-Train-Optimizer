"""Independent feasibility and current-configuration isolation for clean search."""
import copy
import importlib.util
import json
import math
from pathlib import Path
import random
import sys
import unittest

import networkx as nx

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('clean_corridor_search',ROOT/'scripts/corridor_search.py')
module=importlib.util.module_from_spec(spec);sys.modules[spec.name]=module;spec.loader.exec_module(module)


class CorridorSearchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data=json.loads((ROOT/'assets/corridor-data.json').read_text())

    def test_starting_owners_and_completed_tracks_cannot_change_the_search(self):
        other=copy.deepcopy(self.data);other['plans']={'fake':{'owners':{'Paris|Munich':'Changed'}}};other['base']=['Changed'];other['done']=['Changed']
        for e in other['edges']:e.update(owner='Changed',status='done',stage=999)
        a,b=module.CorridorSearch(self.data),module.CorridorSearch(other)
        self.assertEqual(a.input_hash,b.input_hash)
        p1,log1=a.search(module.PRESSURES[0],9011,0,proposals=250)
        p2,log2=b.search(module.PRESSURES[0],9011,0,proposals=250)
        self.assertEqual(p1,p2);self.assertEqual(log1,log2)

    def test_every_exported_owner_is_a_simple_path_or_bounded_standalone_loop(self):
        D=self.data;edges={e['id']:e for e in D['edges']};xy=D['reward_geometry']['coordinates']
        for plan in D['plans'].values():
            all_ids=[];whole=nx.Graph()
            for line in plan['lines']:
                path=line['path'];ids=['|'.join(sorted((a,b))) for a,b in zip(path,path[1:])]
                self.assertEqual(len(ids),len(set(ids)));all_ids.extend(ids)
                g=nx.Graph(tuple(k.split('|')) for k in ids);whole.add_edges_from(g.edges)
                self.assertTrue(nx.is_connected(g));self.assertLessEqual(max(dict(g.degree).values()),2)
                self.assertLessEqual(sum(edges[k]['fuel'] for k in ids),2400)
                if path[0]==path[-1]:
                    self.assertEqual(set(dict(g.degree).values()),{2});self.assertIn(len(g),(3,4))
                    self.assertLessEqual(sum(edges[k]['fuel'] for k in ids),260)
                    self.assertLessEqual(max(math.dist(xy[a],xy[b]) for a in g for b in g),170)
                else:
                    self.assertEqual(len(path),len(set(path)));self.assertTrue(nx.is_tree(g))
                    length=sum(math.dist(xy[a],xy[b]) for a,b in zip(path,path[1:]))
                    self.assertGreaterEqual(math.dist(xy[path[0]],xy[path[-1]])/length,.85-1e-9)
                    for a,b,c in zip(path,path[1:],path[2:]):
                        u=[xy[b][i]-xy[a][i] for i in range(2)];v=[xy[c][i]-xy[b][i] for i in range(2)]
                        cosine=sum(u[i]*v[i] for i in range(2))/(math.hypot(*u)*math.hypot(*v))
                        self.assertLessEqual(math.degrees(math.acos(max(-1,min(1,cosine)))),100+1e-8)
                for key in ids:self.assertEqual(plan['owners'][key],line['name'])
            self.assertEqual(len(all_ids),len(set(all_ids)));self.assertEqual(set(whole),set(D['cities']));self.assertTrue(nx.is_connected(whole))
            self.assertEqual(plan['tracks'],len(all_ids));self.assertEqual(plan['fleet'],len(plan['lines']))
            if plan['pressure']['full']:self.assertEqual(set(all_ids),set(edges))

    def test_randomized_moves_preserve_coverage_and_shape(self):
        search=module.CorridorSearch(self.data);w=next(p for p in module.PRESSURES if p.key=='network_long');rng=random.Random(189)
        paths=search.initial(w,rng,1);valid=0
        for _ in range(450):
            _,members=search.score(paths,w);candidate=search.mutate(paths,members,w,rng)
            if candidate:
                self.assertTrue(search.validate(candidate,w.full,w.loops));paths=candidate;valid+=1
        self.assertGreater(valid,50)

    def test_reference_migration_preserves_tracks_and_checks_every_intermediate_owner(self):
        M=json.loads((ROOT/'assets/corridor-reference-migration.json').read_text());H=json.loads((ROOT/'analysis/world_tracker_data.json').read_text());D=self.data
        refs={e['id']:e for e in H['edges']};edges={e['id']:e for e in D['edges']};owners={k:refs[k]['owner'] for k in H['base']+H['done']};initial=set(owners);licenses={'Europe'}
        self.assertEqual({('|'.join(sorted((t['a'],t['b']))),t['railroad']) for t in M['starting_tracks']},set(owners.items()))
        self.assertTrue(M['selection_was_frozen']);self.assertTrue(M['structural_sequence_complete']);self.assertEqual(M['unresolved'],[])
        for step in M['steps']:
            if step['kind']=='LICENSE':licenses.add(step['region']);continue
            key=step['track'];edge=edges[key]
            self.assertTrue({D['regions'][edge['a']],D['regions'][edge['b']]}<=licenses)
            if step['kind']=='BUILD':
                self.assertNotIn(key,owners);old_nodes={c for k in owners for c in k.split('|')};self.assertTrue({edge['a'],edge['b']}&old_nodes);owner=step['owner']
            else:
                self.assertIn(key,owners);self.assertEqual(owners[key],step['from']);owner=step['to']
            received=[k for k,v in owners.items() if v==owner]
            if received:self.assertTrue({edge['a'],edge['b']} & {c for k in received for c in k.split('|')})
            owners[key]=owner
            for name in set(owners.values()):
                g=nx.Graph(tuple(k.split('|')) for k,v in owners.items() if v==name);self.assertTrue(nx.is_connected(g))
        self.assertTrue(initial<=set(owners))
        plan=D['plans'][M['selected_target']]
        for key,name in plan['owners'].items():self.assertEqual(owners[key],M['target_labels_to_reference_trains'].get(name,name))
        for name in set(owners.values()):
            g=nx.Graph(tuple(k.split('|')) for k,v in owners.items() if v==name);self.assertLessEqual(max(dict(g.degree).values()),2)


if __name__=='__main__':unittest.main()
