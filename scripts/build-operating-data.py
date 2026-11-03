"""Versioned operating experiment: preserve historical routing inputs verbatim."""
import json,random,math,hashlib
from pathlib import Path
from collections import Counter
from scipy.optimize import linear_sum_assignment
import numpy as np
import networkx as nx
root=Path(__file__).resolve().parents[1]
D=json.loads((root/'analysis/world_tracker_data.json').read_text());R=json.loads((root/'analysis/deep_results.json').read_text())
imputed={'Rome|Tripoli':80,'Helsinki|Stockholm':70,'Antananarivo|Zanzibar':130,'Antananarivo|Harare':115,'Cairns|Port Moresby':70,'Amman|Athens':95,'Easter Island|Lima':220,'Cape Town|Porto Alegre':350}
edges=[{**e,'fuel':e['fuel'] if e['fuel'] is not None else imputed[e['id']]} for e in D['edges']]
edges.append({'id':'Nairobi|Zanzibar','a':'Nairobi','b':'Zanzibar','fuel':35,'water':False,'region':'Africa','cost':None})
ED={e['id']:e for e in edges};cities=sorted(D['regions']);geo=json.loads((root/'assets/map/cities.json').read_text());G=nx.Graph();G.add_weighted_edges_from((e['a'],e['b'],e['fuel']) for e in edges)
def eid(a,b):return '|'.join(sorted((a,b)))
def length(p):return sum(ED[eid(a,b)]['fuel'] for a,b in zip(p,p[1:]))
def xy(c):
 lon,lat=geo[c];return lon,math.degrees(math.log(math.tan(math.pi/4+math.radians(lat)/2)))
def direct(p):
 a,b=xy(p[0]),xy(p[-1]);return math.hypot(a[0]-b[0],a[1]-b[1])
spines=[['Paris','Munich','Budapest','Kyiv','Volgograd','Urumqi','Beijing'],['Dakar','Casablanca','Algiers','Tripoli','Cairo','Amman','Baghdad'],['Cairo','Khartoum','Nairobi','Zanzibar','Harare','Pretoria','Cape Town'],['Tehran','Kabul','New Delhi','Kolkata','Bangkok'],['Nome','Anchorage','Vancouver','San Francisco','Los Angeles']]
# Human-inspired spines, not a claim to have disambiguated every reused image color.
def partition(allowed,rng):
 paths=[];used=set()
 for p in spines:
  ids={eid(a,b) for a,b in zip(p,p[1:])}
  if ids<=allowed and not ids&used:paths.append(p[:]);used|=ids
 paths += [[ED[k]['a'],ED[k]['b']] for k in sorted(allowed-used)]
 while True:
  choices=[]
  for i,a in enumerate(paths):
   for j in range(i):
    b=paths[j];common=set(a)&set(b)
    if len(common)!=1:continue
    c=next(iter(common))
    if c not in (a[0],a[-1]) or c not in (b[0],b[-1]):continue
    aa=a if a[-1]==c else a[::-1];bb=b if b[0]==c else b[::-1];p=aa+bb[1:]
    if length(p)>1100:continue
    # Favor a long useful span and avoid consuming a junction in a sharp turn.
    benefit=direct(p)-direct(a)-direct(b)+.003*length(p)
    choices.append((benefit+rng.uniform(-9,9),i,j,p))
  if not choices:break
  _,i,j,p=max(choices);paths[j]=p;paths.pop(i)
 return paths

def make_corridors(count,sparse,seed):
 rng=random.Random(seed);best=None;attempt=0
 protected={eid(a,b) for p in spines for a,b in zip(p,p[1:])}|set(D['base']+D['done'])
 for attempt in range(1,1201):
  allowed=set(ED)
  if sparse:
   # Connected spanning network with every city; retain the five clear human spines.
   tree=nx.Graph();tree.add_nodes_from(cities);tree.add_edges_from((ED[k]['a'],ED[k]['b']) for k in sorted(protected))
   remaining=sorted(set(ED)-protected);rng.shuffle(remaining)
   remaining.sort(key=lambda k:ED[k]['fuel']*rng.uniform(.4,1.8)+70*sum(max(0,tree.degree(c)-1) for c in (ED[k]['a'],ED[k]['b'])))
   for k in remaining:
    a,b=ED[k]['a'],ED[k]['b']
    if not nx.has_path(tree,a,b):tree.add_edge(a,b)
   allowed={eid(a,b) for a,b in tree.edges}
  paths=partition(allowed,rng)
  if len(paths)>count:continue
  while len(paths)<count:
   index=max(range(len(paths)),key=lambda i:len(paths[i]));p=paths.pop(index)
   if len(p)<3:raise ValueError('Cannot split to requested fleet')
   middle=len(p)//2;paths.extend([p[:middle+1],p[middle:]])
  quality=sum(direct(p) for p in paths)-.00001*sum(length(p)**2 for p in paths)
  if best is None or quality>best[0]:best=(quality,paths,allowed)
  if attempt>=200 and best:break
 if best is None:raise ValueError('No feasible corridor partition at requested fleet count')
 print('CORRIDOR',count,'sparse',sparse,'attempts',attempt,'tracks',len(best[2]),flush=True)
 return best[1],best[2],attempt

def patrol(graph):
 # Undirected route inspection / Chinese postman: minimum matching of odd nodes,
 # duplicate shortest connecting paths, then an Euler tour. No train teleports.
 g=nx.MultiGraph();g.add_nodes_from(graph.nodes);g.add_edges_from((a,b,{'weight':d['weight']}) for a,b,d in graph.edges(data=True));odd=[c for c,d in graph.degree if d%2]
 if odd:
  complete=nx.Graph()
  for i,a in enumerate(odd):
   for b in odd[:i]:complete.add_edge(a,b,weight=nx.shortest_path_length(graph,a,b,weight='weight'))
  matching=nx.min_weight_matching(complete,weight='weight')
  for a,b in sorted(tuple(sorted(pair)) for pair in matching):
   p=nx.shortest_path(graph,a,b,weight='weight')
   for x,y in zip(p,p[1:]):g.add_edge(x,y,weight=graph[x][y]['weight'])
 source=min(graph.nodes);walk=list(nx.eulerian_circuit(g,source=source));return [source]+[b for a,b in walk]

plans={};palette=[l['color'] for l in D['lines']]
def store(key,label,owners,notes):
 if key.startswith('corridors'):
  active=sorted(set(owners.values()));names=[l['name'] for l in D['lines']];weights=np.zeros((len(active),len(names)))
  for i,old in enumerate(active):
   for k in D['base']+D['done']:
    if owners.get(k)==old:
     ref=next(e for e in D['edges'] if e['id']==k);weights[i,names.index(ref['owner'])]-=100000+(ref.get('claim') or 0)
  rows,cols=linear_sum_assignment(weights);rename={active[int(i)]:names[int(j)] for i,j in zip(rows,cols)};owners={k:rename[v] for k,v in owners.items()}
 lines=[]
 for i,name in enumerate(sorted(set(owners.values()))):
  es=[e for e in edges if owners.get(e['id'])==name];g=nx.Graph();g.add_weighted_edges_from((e['a'],e['b'],e['fuel']) for e in es)
  if not nx.is_connected(g):raise ValueError(name+' disconnected')
  branch=sum(max(0,d-2) for _,d in g.degree);cycle=g.number_of_edges()-g.number_of_nodes()+1;walk=patrol(g)
  lines.append({'name':name,'color':next(l['color'] for l in D['lines'] if l['name']==name),'tracks':len(es),'length':sum(e['fuel'] for e in es),'branches':branch,'cycles':cycle,'patrol':walk})
 used=[e for e in edges if e['id'] in owners];physical=nx.Graph();physical.add_edges_from((e['a'],e['b']) for e in used)
 if set(physical)!=set(cities) or not nx.is_connected(physical):raise ValueError('Lost a city or connectivity')
 initialchanges=[{'track':k,'from':next(e['owner'] for e in D['edges'] if e['id']==k),'to':owners[k]} for k in D['base']+D['done'] if owners[k]!=next(e['owner'] for e in D['edges'] if e['id']==k)]
 plans[key]={'label':label,'owners':owners,'lines':lines,'fleet':len(lines),'tracks':len(used),'cities':len(cities),'branches':sum(x['branches'] for x in lines),'cycles':sum(x['cycles'] for x in lines),'unused_tracks':sorted(set(ED)-set(owners)),'initial_changes':initialchanges,'notes':notes}
for k,profile in [('published28','consolidated'),('published38','rework')]:
 owners=R['profiles'][profile]['owner'].copy()
 # Join the missing link to an adjacent owner, preserving the exact old labels elsewhere.
 choices=sorted({owners[e['id']] for e in D['edges'] if {'Nairobi','Zanzibar'}&{e['a'],e['b']}})
 best=min(choices,key=lambda name:sum(e['fuel'] for e in edges if owners.get(e['id'])==name))
 owners['Nairobi|Zanzibar']=best
 store(k,f'Published {len(set(owners.values()))}-line target + missing link',owners,'Historical owners with Nairobi–Zanzibar added to '+best+'. Old 190-edge scores are not reused here; no 1,100 cap is asserted for this diagnostic adaptation.')
for key,count,sparse,seed in [('corridors38',38,False,202611031),('corridors28',28,True,202611032)]:
 paths,allowed,attempts=make_corridors(count,sparse,seed);owners={}
 paths.sort(key=lambda p:tuple(p))
 for i,p in enumerate(paths):
  for a,b in zip(p,p[1:]):owners[eid(a,b)]=f'C{i+1:02d}'
 store(key,f'{count} unbranched corridors · '+('all cities, selected links' if sparse else 'all 191 links'),owners,'Human-inspired route construction, not an exact transcription of either image. Geometric construction seeds are independent of simulation evaluation seeds. Search attempts: '+str(attempts))
 for l in plans[key]['lines']:
  assert l['branches']==0 and l['cycles']==0 and l['length']<=1100
out={'version':1,'cities':cities,'regions':D['regions'],'coordinates':geo,'edges':edges,'plans':plans,'audit':{'historical_tracks':190,'operating_tracks':191,'added_track':{'id':'Nairobi|Zanzibar','fuel':35,'basis':'Visible in both supplied human layout images; verify against current game. Price is not inferred.'},'odd_degree_stations':sum(d%2 for _,d in G.degree),'minimum_unbranched_full_coverage_lines':sum(d%2 for _,d in G.degree)//2,'unverified_distances':imputed,'historical_targets_recomputed':False},'sources':[{'title':'NimbleBit: per-engine jobs, arrival refresh, shared yards and origin restriction','url':'https://support.nimblebit.com/support/solutions/articles/150000013209-refreshing-sharing-and-laying-over-jobs'}],'interpretation':'Operating experiments with assumed demand and generic identical trains; not calibrated coins/hour, an exact game recreation or a construction recommendation.'}
out['reward_geometry']=json.loads((root/'assets/map/game-reward-coordinates.json').read_text())
(root/'assets/operating-data.json').write_text(json.dumps(out,separators=(',',':')))
print('WROTE operating-data.json',[(k,p['fleet'],p['tracks'],p['branches']) for k,p in plans.items()])
