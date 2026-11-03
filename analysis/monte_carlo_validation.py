"""Paired synthetic demand and uncertain-distance experiments.

These are uncalibrated stress scenarios, not predictions of game earnings.
Optimization uses no evaluation draws; every plan sees identical sampled jobs.
"""
from pathlib import Path
from collections import Counter
import argparse,json,math
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra
import model_pocket_trains as m

ROOT=Path(__file__).resolve().parent
PAIRS=np.triu_indices(m.N,1)
MODES=('uniform','local','global','shorthaul','longhaul')

def cost_vector(owner,penalty=40,imputed_override=None):
 mat,states=m.build(owner,penalty)
 for key,value in (imputed_override or {}).items():
  if key not in m.IMPUTED or not math.isfinite(value) or value<=0:raise ValueError('Only positive provisional distances may be varied')
  e=m.ED[key];a=states[(e['a'],owner[key])];b=states[(e['b'],owner[key])]
  mat[a,b]=value;mat[b,a]=value
 distances=dijkstra(mat,directed=True,indices=np.arange(m.N))[:,np.arange(m.N)+m.N]
 out=distances[PAIRS]
 if len(out)!=9591 or not np.isfinite(out).all():raise ValueError('Incomplete world coverage')
 return out

def transfer_matrix(owner):
 detail=m.paths(owner,40,return_detail=True);rows=[];cols=[];values=[]
 for row,(a,b,f,t,lb,legs) in enumerate(detail['items']):
  hubs=Counter(legs[i][0] for i in range(1,len(legs)) if legs[i-1][2]!=legs[i][2])
  for city,value in hubs.items():rows.append(row);cols.append(m.CI[city]);values.append(value)
 out=csr_matrix((values,(rows,cols)),shape=(9591,m.N),dtype=float)
 expected=np.array([item[3] for item in detail['items']])
 if not np.array_equal(np.asarray(out.sum(axis=1)).ravel(),expected):raise ValueError('Handoff extraction disagrees with routing')
 return out

def scenario_weights(mode):
 same=np.array([m.D['regions'][m.CITIES[a]]==m.D['regions'][m.CITIES[b]] for a,b in zip(*PAIRS)])
 shortest=m.physical_shortest[PAIRS]
 if mode=='uniform':return np.ones(9591)
 if mode=='local':return np.where(same,5.,1.)
 if mode=='global':return np.where(same,1.,5.)
 if mode=='shorthaul':return np.where(shortest<=450,4.,1.)
 if mode=='longhaul':return np.where(shortest>=1100,4.,1.)
 raise ValueError('Unknown demand mode')

def paired_summary(values):
 values=np.asarray(values,dtype=float)
 return {'mean_gain':float(np.mean(values)),'median_gain':float(np.median(values)),
         'simulation_interval_90':[float(x) for x in np.quantile(values,[.05,.95])],
         'fraction_lower_cost':float(np.mean(values>1e-10)),
         'fraction_tied':float(np.mean(np.abs(values)<=1e-10)),
         'mc_standard_error':float(np.std(values,ddof=1)/math.sqrt(len(values))) if len(values)>1 else 0.}

def demand_trials(costs,models,pairs,seed=773194,days_per_mode=1000,jobs_per_day=1000,hubs=None):
 rng=np.random.default_rng(seed);results={};total_jobs=0
 for mode in MODES:
  prior=scenario_weights(mode);daily=[];peaks=[]
  for day in range(days_per_mode):
   # Unknown station popularity is exchangeable synthetic variation, not census data.
   popularity=rng.lognormal(mean=-.5*.75**2,sigma=.75,size=m.N)
   weights=prior*popularity[PAIRS[0]]*popularity[PAIRS[1]]*rng.gamma(shape=.8,scale=1.25,size=9591)
   probabilities=weights/weights.sum();count=max(1,int(rng.poisson(jobs_per_day)));jobs=rng.multinomial(count,probabilities);total_jobs+=count
   daily.append(costs@jobs/count)
   if hubs is not None:peaks.append([float(np.max(np.asarray(jobs@matrix).ravel())*1000/count) for matrix in hubs])
  daily=np.asarray(daily);peaks=np.asarray(peaks)
  results[mode]={'days':days_per_mode,'mean_costs':{name:float(daily[:,i].mean()) for i,name in enumerate(models)},
    'paired_gains':{name:paired_summary(daily[:,models.index(old)]-daily[:,models.index(new)]) for name,(old,new) in pairs.items()}}
  if hubs is not None:results[mode]['mean_peak_handoffs_per_1000_jobs']={name:float(peaks[:,i].mean()) for i,name in enumerate(models)}
 return {'seed':seed,'days_per_mode':days_per_mode,'virtual_days':days_per_mode*len(MODES),'jobs_per_day_mean':jobs_per_day,'sampled_jobs':total_jobs,'scenarios':results,
   'assumptions':{'penalty':40,'station_popularity':'Independent exchangeable lognormal weights, sigma 0.75; not measured population','od_variation':'Independent Gamma(shape=0.8, scale=1.25) factors','job_batch':'Poisson jobs per virtual day, multinomial destinations','demand_modes':'Same-region ×5; cross-region ×5; short/long-distance ×4; uniform','paired_draws':True},
   'interpretation':'90% intervals describe these synthetic scenario draws. They are not confidence intervals for real gameplay. Lower-cost fractions are not probabilities of real-world success.'}

def length_trials(owners,models,pairs,seed=883205,draws=400):
 rng=np.random.default_rng(seed);daily=[];cap=Counter();keys=sorted(m.IMPUTED)
 for _ in range(draws):
  overrides={key:int(max(1,round(m.IMPUTED[key]*rng.uniform(.7,1.3)))) for key in keys}
  daily.append([float(np.mean(cost_vector(owners[name],40,overrides))) for name in models])
  for name in models:
   totals=Counter()
   for e in m.EDGES:totals[owners[name][e['id']]]+=overrides.get(e['id'],m.F(e))
   if max(totals.values())>1100:cap[name]+=1
 daily=np.asarray(daily)
 return {'seed':seed,'draws':draws,'prior':'Each of the 8 provisional track distances independently uniform between 70% and 130% of its current estimate, rounded to positive integers','penalty':40,
  'mean_costs':{name:float(daily[:,i].mean()) for i,name in enumerate(models)},
  'paired_gains':{name:paired_summary(daily[:,models.index(old)]-daily[:,models.index(new)]) for name,(old,new) in pairs.items()},
  'planning_cap_exceedance_fraction':{name:cap[name]/draws for name in models},
  'interpretation':'Distance priors are assumptions. Cap exceedance concerns the arbitrary planning bound, not an engine fuel tank. Known distances stay fixed; no city pair is dropped.'}

def run(days=1000,length_draws=400):
 baseline=json.loads((ROOT/'monte_carlo_baseline.json').read_text())['profiles'];owners={};pairs={};search={}
 for mode in ['fixed','rework','consolidated']:
  candidate=json.loads((ROOT/f'monte_carlo_{mode}.json').read_text())
  if not candidate['complete'] or not candidate['final_audit']:raise ValueError('Finish every randomized search before stress testing')
  owners['before_'+mode]=baseline[mode]['owner'];owners['after_'+mode]=json.loads((ROOT/f'deep_{mode}.json').read_text())['owner'];pairs[mode]=('before_'+mode,'after_'+mode);search[mode]={k:v for k,v in candidate.items() if k not in ('owner','epochs')}
 models=list(owners);costs=np.stack([cost_vector(owners[x]) for x in models]);hubs=[transfer_matrix(owners[x]) for x in models]
 nominal={x:float(np.mean(costs[i])) for i,x in enumerate(models)}
 demand=demand_trials(costs,models,pairs,days_per_mode=days,hubs=hubs);lengths=length_trials(owners,models,pairs,draws=length_draws)
 nominal_hubs={name:[{'city':m.CITIES[i],'handoffs':int(value)} for i,value in sorted(enumerate(np.asarray(hubs[j].sum(axis=0)).ravel()),key=lambda x:-x[1])[:8]] for j,name in enumerate(models)}
 campaigns={}
 for path in sorted((ROOT/'monte_carlo_campaigns').glob('*.json'))+list(ROOT.glob('monte_carlo_*.json')):
  try: item=json.loads(path.read_text())
  except (ValueError,OSError):continue
  if item.get('complete') and 'seed' in item and 'counts' in item:campaigns[(item['profile'],item['seed'])]=item
 totals={'campaigns':len(campaigns),'valid_proposals':sum(v['counts']['valid_proposals'] for v in campaigns.values()),'exact_evaluations':sum(v['cache']['misses'] for v in campaigns.values()),'uphill_accepted':sum(v['uphill_accepted'] for v in campaigns.values())}
 out={'version':1,'search_totals':totals,'stability':json.loads((ROOT/'monte_carlo_stability.json').read_text()),'research':json.loads((ROOT/'related_projects.json').read_text()),'search':search,'nominal_scores':nominal,'demand':demand,'uncertain_distances':lengths,'nominal_hubs':nominal_hubs,
  'promotion_rule':'Nominal improvements must be verified on all 9,591 pairs, meet ownership constraints and pass construction/correction scheduling checks. Synthetic demand results do not establish actual profits.',
  'limitations':'Engine-agnostic route and handoff stress tests. No empirically calibrated Pocket Trains job generator, train positions, capacity, dispatch policy or earnings simulator.'}
 dataset={'pair_a':PAIRS[0].tolist(),'pair_b':PAIRS[1].tolist(),'city_regions':[m.D['regions'][c] for c in m.CITIES],'shortest':m.physical_shortest[PAIRS].tolist(),'costs':{name:costs[i].tolist() for i,name in enumerate(models)},'comparisons':{k:{'before':a,'after':b} for k,(a,b) in pairs.items()}}
 (ROOT.parent/'assets/monte-carlo-costs.json').write_text(json.dumps(dataset,separators=(',',':')))
 import re
 page=ROOT.parent/'index.html';html=page.read_text();payload=json.dumps(out,separators=(',',':')).replace('<','\\u003c')
 block='<script id="monte-carlo-data" type="application/json">'+payload+'</script>'
 if '<script id="monte-carlo-data"' in html:html=re.sub(r'<script id="monte-carlo-data" type="application/json">.*?</script>',lambda _:block,html,flags=re.S)
 else:html=html.replace('<script src="./assets/core.js',block+'\n<script src="./assets/core.js')
 page.write_text(html)
 (ROOT/'monte_carlo_validation.json').write_text(json.dumps(out,indent=2));print('MONTE_CARLO_VALIDATION',nominal,'days',demand['virtual_days'],'jobs',demand['sampled_jobs'],'distance_draws',length_draws,flush=True)
 return out

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--days',type=int,default=1000);p.add_argument('--length-draws',type=int,default=400);a=p.parse_args();run(a.days,a.length_draws)
