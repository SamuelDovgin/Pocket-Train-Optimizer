import unittest,sys,json,random,math
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'analysis'))
import monte_carlo_search as mc
import monte_carlo_validation as sim
import deep_search as d
import model_pocket_trains as m

class MonteCarloTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.base=json.loads((root/'analysis/monte_carlo_baseline.json').read_text())['profiles']
 def test_acceptance_and_replica_exchange_direction(self):
  self.assertTrue(mc.metropolis(-2,0,.99));self.assertFalse(mc.metropolis(1,0,.001));self.assertTrue(mc.metropolis(1,1,.1));self.assertFalse(mc.metropolis(1,1,.9))
  self.assertLess(mc.exchange_log_ratio(1,3,1,10),0);self.assertGreater(mc.exchange_log_ratio(3,1,1,10),0)
 def test_wilson_tree_and_cut_certify_connected_parts(self):
  edges=set(range(len(d.IDS)));tree=mc.wilson_tree(edges,random.Random(71));self.assertEqual(len(tree),len(edges)-1)
  parts=mc.cut_components(edges,tree,{0,5});self.assertEqual(len(parts),3);self.assertEqual(set().union(*parts),edges)
  self.assertEqual(sum(map(len,parts)),len(edges));self.assertTrue(all(d.connected(p) for p in parts))
 def test_each_random_proposal_preserves_independent_constraints(self):
  rng=random.Random(102)
  for mode in ['fixed','rework','consolidated']:
   owner=d.encode(self.base[mode]['owner']);fixed=d.FIXED if mode=='fixed' else frozenset();variable=mode=='consolidated';found=set()
   kinds=['relocate','swap','repartition']+(['split','merge'] if variable else [])
   for kind in kinds:
    for _ in range(120):
     proposal,_=mc.propose(owner,rng,fixed,variable,kind)
     if proposal is None:continue
     found.add(kind);decoded=d.decode(proposal)
     if not variable:self.assertEqual(len(set(decoded.values())),38)
     for i in fixed:self.assertEqual(proposal[i],d.ORIGINAL[i])
     for line in set(decoded.values()):
      self.assertTrue(m.connected_owner(decoded,line));self.assertLessEqual(sum(m.F(e) for e in m.EDGES if decoded[e['id']]==line),1100)
     owner=proposal
   self.assertIn('relocate',found);self.assertIn('repartition',found)
 def test_exact_scorer_and_label_symmetry(self):
  owner=d.encode(self.base['consolidated']['owner']);scorer=mc.ExactScorer(cache_size=10);value=scorer(owner);self.assertAlmostEqual(value,m.fast_score(d.decode(owner)),places=10)
  permuted=tuple((x+7)%len(d.NAMES) for x in owner);self.assertEqual(scorer(permuted),value);self.assertEqual(scorer.cache_info().misses,1)
 def test_cost_vector_and_handoff_extraction(self):
  owner=self.base['consolidated']['owner'];costs=sim.cost_vector(owner);self.assertEqual(len(costs),9591);self.assertAlmostEqual(costs.mean(),self.base['consolidated']['score'],places=10)
  hubs=sim.transfer_matrix(owner);self.assertEqual(hubs.shape,(9591,139));self.assertAlmostEqual(hubs.sum()/9591,m.paths(owner)['mean_transfers'],places=10)
 def test_uncertain_distances_are_validated(self):
  owner=self.base['consolidated']['owner']
  for override in [{next(iter(m.IMPUTED)):-1},{next(iter(m.IMPUTED)):math.inf},{'London|Paris':33}]:
   with self.assertRaises(ValueError):sim.cost_vector(owner,40,override)
 def test_paired_demand_draws_are_reproducible_and_identical_plans_tie(self):
  costs=sim.cost_vector(self.base['consolidated']['owner']);matrix=np.stack([costs,costs]);pairs={'same':('a','b')}
  a=sim.demand_trials(matrix,['a','b'],pairs,seed=62,days_per_mode=12,jobs_per_day=100)
  b=sim.demand_trials(matrix,['a','b'],pairs,seed=62,days_per_mode=12,jobs_per_day=100);self.assertEqual(a,b);self.assertEqual(a['virtual_days'],60)
  for value in a['scenarios'].values():self.assertEqual(value['paired_gains']['same']['fraction_tied'],1);self.assertEqual(value['paired_gains']['same']['mean_gain'],0)
 def test_paired_length_draws_leave_known_distances_unchanged(self):
  owner=self.base['consolidated']['owner'];out=sim.length_trials({'a':owner,'b':owner},['a','b'],{'same':('a','b')},seed=9,draws=8)
  self.assertEqual(out['paired_gains']['same']['mean_gain'],0);self.assertEqual(out['paired_gains']['same']['fraction_tied'],1)

if __name__=='__main__':unittest.main()
