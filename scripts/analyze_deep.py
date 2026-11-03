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
 pending={k for k in initial if owner[k]!=m.ORIGINAL[k]};groups=[]
 while pending:
  key=sorted(pending)[0];source=m.ORIGINAL[key];target=owner[key];group={key};pending.remove(key);changed=True
  while changed:
   changed=False;nodes={c for k in group for c in (m.ED[k]['a'],m.ED[k]['b'])}
   for k in sorted(pending):
    e=m.ED[k]
    if m.ORIGINAL[k]==source and owner[k]==target and ({e['a'],e['b']}&nodes):group.add(k);pending.remove(k);changed=True
  hybrid={**owner,**{k:m.ORIGINAL[k] for k in initial}};after={**hybrid,**{k:owner[k] for k in group}};effects=[]
  for stage in range(9):
   allowed=initial|{x['id'] for x in m.D['steps'] if x['kind']=='track' and x['stage']<=stage}
   a=m.paths(hybrid,40,allow_edges=allowed);b=m.paths(after,40,allow_edges=allowed)
   if a['missing'] or b['missing']:continue
   effects.append({'stage':stage,'pairs':a['pairs'],'before':a['mean_score'],'after':b['mean_score'],'gain':a['mean_score']-b['mean_score']})
  improving=next((x for x in effects if x['gain']>1e-8),None)
  stage=improving['stage'] if improving else 8
  groups.append({'track_ids':sorted(group),'from':source,'to':target,'minimum_stage':stage,'requires':[x['id'] for x in m.D['steps'] if x['stage']<=stage], 'phase_effects':effects,'timing_reason':'First tested construction stage with a positive matched-job routing benefit; claim fees are not included.' if improving else 'Endgame ownership change; no standalone phase benefit established.'})
 return groups

stability=json.loads((root/'analysis/stability_trace.json').read_text()) if (root/'analysis/stability_trace.json').exists() else None
if stability is not None and not stability['stable']:raise RuntimeError('Finish merge/split stability testing before publication')
profiles={}
for key,file,label in [('searched','deep_fixed.json','Deeper search · keep starting owners'),('rework','deep_rework.json','Deeper search · allow starting corrections'),('consolidated','deep_consolidated.json','Experimental · fewer railroads')]:
 p=root/'analysis'/file
 if not p.exists():continue
 data=json.loads(p.read_text());
 if not data.get('final_audit',{}):raise RuntimeError(f'{file}: finish the search before publishing results')
 owner=data['owner']
 mode=data['profile'];campaigns=[data];seen={json.dumps(data,sort_keys=True)}
 for archive in sorted((root/'analysis/search_campaigns').glob(mode+'-*.json')):
  prior=json.loads(archive.read_text());fingerprint=json.dumps(prior,sort_keys=True)
  if fingerprint not in seen:campaigns.append(prior);seen.add(fingerprint)
 totals={'campaigns':len(campaigns),'starts':sum(len(x['restarts']) for x in campaigns),'scored_layout_evaluations':sum(x['evaluations']['misses'] for x in campaigns)}
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
