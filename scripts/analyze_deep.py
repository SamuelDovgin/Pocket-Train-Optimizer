"""Build traceable comparisons, starting-layout changes, and joint deferral tests."""
import sys,json,math
from pathlib import Path
from collections import Counter
import numpy as np
from scipy.sparse.csgraph import dijkstra
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'analysis'))
import model_pocket_trains as m
from deep_search import encode,changes
initial=set(m.D['base']+m.D['done'])

def matrix(owner,allowed=None,penalty=40):
 mat,_=m.build(owner,penalty,allow_edges=allowed)
 result=dijkstra(mat,directed=True,indices=np.arange(m.N))[:,np.arange(m.N)+m.N]
 return result[np.triu_indices(m.N,1)]

def complexity(owner):
 lines=[]
 for name in sorted(set(owner.values())):
  edges=[e for e in m.EDGES if owner[e['id']]==name];degree=Counter(c for e in edges for c in (e['a'],e['b']))
  lines.append({'name':name,'tracks':len(edges),'fuel':sum(m.F(e) for e in edges),'stops':len(degree),'branches':sum(max(0,v-2) for v in degree.values())})
 return {'lines':lines,'branches':sum(x['branches'] for x in lines)}

def correction_schedule(owner):
 """Find executable phase timing on the actual partial network.

 Positive standalone changes run when they help. Remaining target-alignment
 changes run at endgame, with their signed effect and all earlier dependencies
 recorded. Never require a purchase that itself needs the pending correction.
 """
 import networkx as nx
 pending={k for k in initial if owner[k]!=m.ORIGINAL[k]};groups=[]
 while pending:
  key=min(pending);source=m.ORIGINAL[key];target=owner[key];group={key};pending.remove(key);changed=True
  while changed:
   changed=False;nodes={c for k in group for c in (m.ED[k]['a'],m.ED[k]['b'])}
   for k in sorted(pending):
    e=m.ED[k]
    if m.ORIGINAL[k]==source and owner[k]==target and ({e['a'],e['b']}&nodes):group.add(k);pending.remove(k);changed=True
  groups.append({'track_ids':sorted(group),'from':source,'to':target})
 current={**owner,**{k:m.ORIGINAL[k] for k in initial}};built=set(initial);licenses={'Europe'};bought=set();scheduled=[];previous={}
 def nodes(line):return {c for k in built if current[k]==line for c in (m.ED[k]['a'],m.ED[k]['b'])}
 def feasible(g):
  target_nodes=nodes(g['to']);endpoints={c for k in g['track_ids'] for c in (m.ED[k]['a'],m.ED[k]['b'])}
  if target_nodes and not target_nodes&endpoints:return False
  left=[m.ED[k] for k in built if current[k]==g['from'] and k not in g['track_ids']]
  if not left:return True
  graph=nx.Graph();graph.add_edges_from((e['a'],e['b']) for e in left)
  return nx.is_connected(graph)
 def build_available(stage):
  changed=True
  while changed:
   changed=False
   for step in m.D['steps']:
    if step['stage']>stage or step['id'] in bought:continue
    if step['kind']=='license':licenses.add(step['region']);bought.add(step['id']);changed=True;continue
    e=m.ED[step['id']];endpoints={e['a'],e['b']}
    if not {m.D['regions'][e['a']],m.D['regions'][e['b']]}<=licenses:continue
    network={c for k in built for c in (m.ED[k]['a'],m.ED[k]['b'])}
    if not network&endpoints:continue
    target_nodes=nodes(owner[e['id']])
    if target_nodes and not target_nodes&endpoints:continue
    built.add(e['id']);bought.add(e['id']);changed=True
 for stage in range(9):
  while True:
   build_available(stage)
   if not groups:break
   before=m.paths(current,40,allow_edges=built);candidates=[]
   for g in groups:
    if not feasible(g):continue
    trial={**current,**{k:g['to'] for k in g['track_ids']}};after=m.paths(trial,40,allow_edges=built)
    if before['missing'] or after['missing'] or before['pairs']!=after['pairs']:raise ValueError('A phase lost jobs')
    gain=before['mean_score']-after['mean_score']
    if gain>1e-8 or stage==8:candidates.append((gain,g,after,trial))
   if not candidates:break
   gain,g,after,trial=max(candidates,key=lambda x:(x[0],x[1]['track_ids']))
   effect={'stage':stage,'pairs':before['pairs'],'before':before['mean_score'],'after':after['mean_score'],'gain':gain}
   positive=gain>1e-8
   scheduled.append({**g,'minimum_stage':stage,'requires':[x['id'] for x in m.D['steps'] if x['id'] in bought],'owner_prerequisites':dict(previous),'phase_effects':[effect],'scheduled_effect':effect,'positive_phase_gain':positive,'timing_reason':'Measured positive routing gain on the executable partial network, including earlier scheduled corrections; fees are excluded.' if positive else 'Endgame target alignment. No standalone routing gain: this step may raise partial-network cost while enabling the jointly optimized ownership layout. Fees are excluded.'})
   current=trial;previous.update({k:g['to'] for k in g['track_ids']});groups.remove(g)
 if groups or len(built)!=len(m.ED):raise ValueError('Target has no verified construction/correction sequence')
 return scheduled

stability=json.loads((root/'analysis/stability_trace.json').read_text()) if (root/'analysis/stability_trace.json').exists() else None
if stability is not None and not stability['stable']:raise RuntimeError('Finish merge/split stability testing before publication')
profiles={}
for key,file,label in [('searched','deep_fixed.json','Monte Carlo · keep starting owners'),('rework','deep_rework.json','Monte Carlo · explicit starting corrections'),('consolidated','deep_consolidated.json','Monte Carlo · fewer railroads')]:
 p=root/'analysis'/file
 if not p.exists():continue
 data=json.loads(p.read_text());
 if not data.get('final_audit',{}):raise RuntimeError(f'{file}: finish the search before publishing results')
 owner=data['owner']
 mode=data['profile'];campaigns=[data];seen={json.dumps(data,sort_keys=True)}
 for archive in sorted((root/'analysis/search_campaigns').glob(mode+'-*.json')):
  prior=json.loads(archive.read_text());fingerprint=json.dumps(prior,sort_keys=True)
  if fingerprint not in seen:campaigns.append(prior);seen.add(fingerprint)
 legacy=[x for x in campaigns if not x.get('randomized_search')];randomized={}
 for q in sorted((root/'analysis/monte_carlo_campaigns').glob(mode+'-*.json'))+[root/'analysis'/f'monte_carlo_{mode}.json']:
  if not q.exists():continue
  item=json.loads(q.read_text())
  if item.get('complete'):randomized[item['seed']]=item
 totals={'campaigns':len(legacy)+len(randomized),'starts':sum(len(x['restarts']) for x in legacy),'annealing_epochs':sum(len(x['epochs']) for x in randomized.values()),'valid_randomized_proposals':sum(x['counts']['valid_proposals'] for x in randomized.values()),'scored_layout_evaluations':sum(x['evaluations']['misses'] for x in legacy)+sum(x['cache']['misses'] for x in randomized.values())}
 full=matrix(owner);allowed=set(m.ED);deferred=[]
 for e in sorted(m.EDGES,key=lambda e:-(e['cost'] or 0)):
  if e['id'] in initial:continue
  candidate=allowed-{e['id']};mine=[x for x in m.EDGES if x['id'] in candidate and owner[x['id']]==owner[e['id']]]
  if not mine:continue
  # Remaining owner subgraph must stay connected, including all its stations.
  import networkx as nx
  graph=nx.Graph();graph.add_edges_from((x['a'],x['b']) for x in mine)
  if not nx.is_connected(graph):continue
  costs=matrix(owner,candidate)
  if np.array_equal(costs,full):allowed=candidate;deferred.append(e['id'])
 stats={str(p):{k:v for k,v in m.paths(owner,p).items() if k!='items'} for p in [0,20,40,80]}
 changes_initial=[{'track':k,'from':m.ORIGINAL[k],'to':owner[k],'original_claim_reference':m.ED[k]['claim']} for k in sorted(initial) if owner[k]!=m.ORIGINAL[k]]
 starting={k:v for k,v in m.paths(owner,40,allow_edges=initial).items() if k!='items'}
 profiles[key]={'label':label,'owner':owner,'line_count':len(set(owner.values())),'summary':stats,'initial_changes':changes_initial,'correction_schedule':correction_schedule(owner),'starting_summary':starting,'complexity':complexity(owner),'campaign_totals':totals,'search':{k:v for k,v in data.items() if k not in ['owner','best_history','initial_owner_changes']},'deferred_tracks':deferred,'deferral_known_cost':sum(m.ED[k]['cost'] or 0 for k in deferred),'deferral_penalties':{str(p):float(np.mean(matrix(owner,allowed,p))) for p in [0,20,40,80]},'retained_track_count':len(allowed)}
 print(key,data['score'],'lines',len(set(owner.values())),'initial changes',len(changes_initial),'jointly deferred',len(deferred),flush=True)
base={k:v for k,v in m.paths(m.ORIGINAL,40,allow_edges=initial).items() if k!='items'}
out={'version':2,'cross_seed_audit':stability,'physical_lower_bound':float(np.mean(m.physical_shortest[np.triu_indices(m.N,1)])),'objective':'Mean fuel + 40 × transfers across all 9,591 equally weighted city pairs','cap':1100,'cap_is_engine_specification':False,'starting_reference':base,'profiles':profiles,'previous_score':json.loads((root/'analysis/improved_solution.json').read_text())['score'],'starting_track_count':len(initial),'mechanics_sources':[{'title':'Track claiming and ownership guide','url':'https://gamefaqs.gamespot.com/iphone/733057-pocket-trains/faqs/68009'},{'title':'Community FAQ: claim/switch track ownership','url':'https://www.reddit.com/r/pockettrains/comments/ihk8yc/'}]}
(root/'analysis/deep_results.json').write_text(json.dumps(out,indent=2))
# Embed separately from the historical comparison; browser never needs a fetch.
p=root/'index.html';html=p.read_text();import re
payload=json.dumps(out,separators=(',',':')).replace('<','\\u003c')
if '<script id="deep-data"' in html:html=re.sub(r'(<script id="deep-data" type="application/json">).*?(</script>)',lambda x:x[1]+payload+x[2],html,flags=re.S)
else:html=html.replace('<script src="./assets/core.js">','<script id="deep-data" type="application/json">'+payload+'</script>\n<script src="./assets/core.js">')
p.write_text(html)
