import unittest,json,sys,math
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'analysis'))
import model_pocket_trains as m
import advanced_optimize as opt
import networkx as nx

class ModelTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.results=json.loads((Path(m.__file__).parent/'graph_theory_results.json').read_text())
 def test_map_and_frozen_owners(self):
  self.assertEqual((m.N,len(m.EDGES)),(139,190));self.assertEqual(len(m.ED),190)
  for own in self.results['owners'].values():
   self.assertEqual(set(own),set(m.ED));self.assertEqual(set(own.values()),set(m.LINE_INFO))
   for k in m.D['base']+m.D['done']:self.assertEqual(own[k],m.ORIGINAL[k])
   for line in m.LINE_INFO:
    self.assertTrue(m.connected_owner(own,line));self.assertLessEqual(sum(m.F(m.ED[k]) for k in own if own[k]==line),1100)
 def test_all_published_statistics_reproduce(self):
  for name,own in self.results['owners'].items():
   for penalty in (0,20,40,80):
    actual=m.paths(own,penalty);self.assertEqual(actual['pairs'],9591);self.assertEqual(actual['missing'],0)
    for k,v in self.results['summary'][name][str(penalty)].items():self.assertAlmostEqual(actual[k],v,places=9,msg=f'{name}/{penalty}/{k}')
 def test_independent_networkx_paths(self):
  owner=self.results['owners']['global_heuristic']
  for penalty in (0,20,40,80):
   graph=nx.Graph()
   for e in m.EDGES:graph.add_edge((e['a'],owner[e['id']]),(e['b'],owner[e['id']]),weight=m.F(e))
   for city in m.CITIES:
    lines=sorted({owner[e['id']] for e in m.EDGES if city in (e['a'],e['b'])})
    for a in lines:
     for b in lines:
      if a!=b:graph.add_edge((city,a),(city,b),weight=penalty)
   detail={(a,b):f+t*penalty for a,b,f,t,lb,legs in m.paths(owner,penalty,return_detail=True)['items']}
   for a,b in [('London','Tokyo'),('Paris','Sydney'),('Cape Town','New York'),('Kyiv','Moscow')]:
    aa,bb=sorted([a,b]);starts=[x for x in graph if x[0]==aa];cost=nx.multi_source_dijkstra_path_length(graph,starts,weight='weight');expected=min(v for x,v in cost.items() if x[0]==bb)
    self.assertEqual(detail[aa,bb],expected)
 def test_improvement_and_search_exhaustion(self):
  solution=json.loads((Path(m.__file__).parent/'improved_solution.json').read_text());self.assertLess(solution['score'],solution['supplied_score'])
  self.assertEqual(solution['search_runs'][-1]['termination'],'local_optimum')
  self.assertFalse(any(m.fast_score(p)<solution['score']-1e-6 for g,a,b,p in opt.possible(solution['owner'],groupsize=3)))
 def test_capacity_uses_current_ownership(self):
  supplied=json.loads((Path(m.__file__).parent/'advanced_pairs.json').read_text())['owner']
  moves=list(opt.possible(supplied,groupsize=2))
  newly_allowed=[(g,target) for g,old,target,p in moves if opt.line_sum.get(target,0)+sum(m.F(m.ED[k]) for k in g)>1100]
  self.assertTrue(newly_allowed,'Regression fixture must expose stale-capacity bug')
 def test_invalid_penalties_and_empty_network(self):
  for penalty in (-1,math.inf,math.nan):
   with self.assertRaises(ValueError):m.build(m.ORIGINAL,penalty)
  self.assertEqual(m.paths(m.ORIGINAL,allow_edges=set())['pairs'],0)

if __name__=='__main__':unittest.main()
