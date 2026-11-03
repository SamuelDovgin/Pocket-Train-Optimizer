import unittest,json,sys
from pathlib import Path
import numpy as np
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'analysis'))
import model_pocket_trains as m
from deep_search import changes,encode,FIXED,score

class DeepModelTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.report=json.loads((root/'analysis/deep_results.json').read_text())
 def test_all_new_metrics_reproduce(self):
  for name,p in self.report['profiles'].items():
   for penalty in (0,20,40,80):
    actual=m.paths(p['owner'],penalty);self.assertEqual(actual['pairs'],9591);self.assertEqual(actual['missing'],0)
    for k,v in p['summary'][str(penalty)].items():self.assertAlmostEqual(actual[k],v,places=9,msg=name+'/'+k)
 def test_profiles_preserve_coverage_and_respect_constraints(self):
  initial=set(m.D['base']+m.D['done'])
  for name,p in self.report['profiles'].items():
   self.assertEqual(set(p['owner']),set(m.ED));self.assertEqual(len(set(p['owner'].values())),p['line_count'])
   self.assertEqual(p['line_count'],38) if name!='consolidated' else self.assertTrue(15<=p['line_count']<38)
   for line in set(p['owner'].values()):
    self.assertTrue(m.connected_owner(p['owner'],line));self.assertLessEqual(sum(m.F(e) for e in m.EDGES if p['owner'][e['id']]==line),1100)
   expected={k for k in initial if p['owner'][k]!=m.ORIGINAL[k]};self.assertEqual(expected,{x['track'] for x in p['initial_changes']})
   if name=='searched':self.assertEqual(expected,set())
 def test_final_neighborhood_audits(self):
  for name,p in self.report['profiles'].items():
   self.assertTrue(p['search']['final_audit']['exhausted'],name)
   owner=encode(p['owner']);fixed=FIXED if name=='searched' else frozenset();current=score(owner);count=0
   for trial,move in changes(owner,fixed=fixed,maxgroup=6,swaps=3,merge=name=='consolidated'):
    self.assertGreaterEqual(score(trial),current-1e-7,name+'/'+str(move));count+=1
   self.assertEqual(count,p['search']['final_audit']['candidates_checked'])
 def test_all_scenarios_beat_prior_and_rework_is_no_worse_than_fixed(self):
  profiles=self.report['profiles']
  for p in profiles.values():self.assertLess(p['summary']['40']['mean_score'],self.report['previous_score'])
  self.assertLessEqual(profiles['rework']['summary']['40']['mean_score'],profiles['searched']['summary']['40']['mean_score'])
  self.assertLessEqual(profiles['consolidated']['summary']['40']['mean_score'],profiles['rework']['summary']['40']['mean_score'])
 def test_correction_timing_has_a_measured_positive_phase_gain(self):
  initial=set(m.D['base']+m.D['done'])
  for name in ('rework','consolidated'):
   p=self.report['profiles'][name];owner=p['owner'];current={**owner,**{k:m.ORIGINAL[k] for k in initial}}
   for group in sorted(p['correction_schedule'],key=lambda x:x['minimum_stage']):
    stage=group['minimum_stage'];allowed=initial|{x['id'] for x in m.D['steps'] if x['kind']=='track' and x['stage']<=stage}
    before=m.paths(current,40,allow_edges=allowed);current.update({k:owner[k] for k in group['track_ids']});after=m.paths(current,40,allow_edges=allowed)
    self.assertEqual(before['pairs'],after['pairs']);self.assertEqual(before['missing'],0);self.assertEqual(after['missing'],0)
    self.assertLess(after['mean_score'],before['mean_score'],name+'/'+str(group['track_ids']))
    self.assertEqual(set(group['requires']),{x['id'] for x in m.D['steps'] if x['stage']<=stage})
 def test_any_joint_deferrals_preserve_every_city_pair(self):
  from scipy.sparse.csgraph import dijkstra
  for p in self.report['profiles'].values():
   arrays=[]
   for allowed in (None,set(m.ED)-set(p['deferred_tracks'])):
    mat,_=m.build(p['owner'],40,allow_edges=allowed);arrays.append(dijkstra(mat,directed=True,indices=np.arange(m.N))[:,np.arange(m.N)+m.N])
   np.testing.assert_array_equal(arrays[0],arrays[1]);self.assertTrue(np.isfinite(arrays[1]).all())

if __name__=='__main__':unittest.main()
