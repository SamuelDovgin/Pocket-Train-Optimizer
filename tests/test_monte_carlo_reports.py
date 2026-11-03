import json,sys,unittest
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'analysis'))
import model_pocket_trains as m
import monte_carlo_search as mc
import monte_carlo_validation as sim
import deep_search as d
class PublishedMonteCarloTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.report=json.loads((root/'analysis/monte_carlo_validation.json').read_text())
 def test_completed_search_has_audited_plateaus_and_feasible_owners(self):
  stability=self.report['stability'];self.assertTrue(stability['stable']);self.assertTrue(stability['campaigns'][-1]['no_improvement'])
  for mode in ['fixed','rework','consolidated']:
   p=json.loads((root/f'analysis/monte_carlo_{mode}.json').read_text());self.assertTrue(p['complete']);self.assertTrue(p['final_audit']['exhausted']);self.assertGreaterEqual(p['counts']['valid_proposals'],50000);self.assertGreaterEqual(p['epochs'][-1]['stale_epochs'],25)
   self.assertTrue(mc.valid(d.encode(p['owner']),d.FIXED if mode=='fixed' else frozenset(),38 if mode!='consolidated' else None));self.assertAlmostEqual(sim.cost_vector(p['owner']).mean(),p['score'],places=9)
   self.assertAlmostEqual(stability['campaigns'][-1]['after'][mode],p['score'],places=9)
 def test_published_scores_and_browser_vectors_match_final_targets(self):
  vectors=json.loads((root/'assets/monte-carlo-costs.json').read_text())['costs']
  for mode in ['fixed','rework','consolidated']:
   owner=json.loads((root/f'analysis/deep_{mode}.json').read_text())['owner'];cost=sim.cost_vector(owner);np.testing.assert_array_equal(cost,vectors['after_'+mode]);self.assertAlmostEqual(cost.mean(),self.report['nominal_scores']['after_'+mode],places=9)
   self.assertLess(cost.mean(),self.report['nominal_scores']['before_'+mode])
 def test_stress_report_counts_intervals_and_pairs_are_valid(self):
  demand=self.report['demand'];self.assertEqual(demand['virtual_days'],5000);self.assertGreater(demand['sampled_jobs'],4900000);self.assertLess(demand['sampled_jobs'],5100000)
  for group in list(demand['scenarios'].values())+[self.report['uncertain_distances']]:
   for v in group['paired_gains'].values():
    self.assertTrue(np.isfinite(v['mean_gain']));self.assertLessEqual(v['simulation_interval_90'][0],v['median_gain']);self.assertGreaterEqual(v['simulation_interval_90'][1],v['median_gain']);self.assertTrue(0<=v['fraction_lower_cost']<=1)
  self.assertEqual(self.report['uncertain_distances']['draws'],400)
if __name__=='__main__':unittest.main()
