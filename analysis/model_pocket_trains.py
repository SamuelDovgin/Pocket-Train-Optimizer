"""Pocket Trains cargo routing proxy; no unsupported assumptions about job spawn rates.
Input: locally curated 139-city / 190-connection map from prior user's tracker.
Objective: same origin/destination pairs, compare fuel burned, line transfers, and path efficiency.
"""
from collections import defaultdict, Counter
from pathlib import Path
import json, math, heapq, time
import networkx as nx
import numpy as np
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

D=json.loads(Path(__file__).with_name('world_tracker_data.json').read_text())
CITIES=sorted(D['regions']); N=len(CITIES); CI={c:i for i,c in enumerate(CITIES)}
EDGES=D['edges']; ED={e['id']:e for e in EDGES}
ORIGINAL={e['id']:e['owner'] for e in EDGES}
LINE_INFO={e['name']:e for e in D['lines']}
IMPUTED={
'Rome|Tripoli':80,'Helsinki|Stockholm':70,'Antananarivo|Zanzibar':130,
'Antananarivo|Harare':115,'Cairns|Port Moresby':70,'Amman|Athens':95,
'Easter Island|Lima':220,'Cape Town|Porto Alegre':350}
assert sorted(x['id'] for x in EDGES if x['fuel'] is None)==sorted(IMPUTED)
def F(e):return e['fuel'] if e['fuel'] is not None else IMPUTED[e['id']]

physical=nx.Graph()
for e in EDGES:physical.add_edge(e['a'],e['b'],weight=F(e),id=e['id'])
assert nx.is_connected(physical)
physical_shortest=np.zeros((N,N),float)
for i,a in enumerate(CITIES):
 d=nx.single_source_dijkstra_path_length(physical,a,weight='weight')
 for b,cost in d.items():physical_shortest[i,CI[b]]=cost

# Bounds on owner line connectivity after local reassignment.
def connected_owner(owner, line):
 eds=[e for e in EDGES if owner[e['id']]==line]
 if len(eds)<1:return False
 g=nx.Graph()
 for e in eds:g.add_edge(e['a'],e['b'])
 return nx.is_connected(g)

def build(owner,transfer_penalty=40, allow_edges=None, tie_break=False):
 if not math.isfinite(transfer_penalty) or transfer_penalty < 0: raise ValueError("Transfer penalty must be finite and nonnegative")
 permitted=[e for e in EDGES if allow_edges is None or e['id'] in allow_edges]
 incid=defaultdict(set)
 for e in permitted:
  line=owner[e['id']];incid[e['a']].add(line);incid[e['b']].add(line)
 states={}
 for city in CITIES:
  for line in sorted(incid.get(city,set())):states[(city,line)]=2*N+len(states)
 rr=[];cc=[];vv=[]
 # source -> city/line; city/line -> destination
 for (city,line),idx in states.items():
  rr.extend([CI[city],idx]);cc.extend([idx,CI[city]+N]);vv.extend([0.0,0.0])
 for e in permitted:
  ia=states[(e['a'],owner[e['id']])];ib=states[(e['b'],owner[e['id']])];val=F(e)
  rr.extend([ia,ib]);cc.extend([ib,ia]);vv.extend([val,val])
 for city,ls in incid.items():
  if len(ls)>1:
   for la in ls:
    for lb in ls:
     if la!=lb:
      rr.append(states[(city,la)]);cc.append(states[(city,lb)]);vv.append(transfer_penalty)
 # prevent zero weight non-physical edges lost in sparse graph; keep zeros as explicit csr data
 if tie_break:
  # Integer objective first, fewer handoffs second; a simple path has < states transfers.
  if transfer_penalty != int(transfer_penalty): raise ValueError("Tie-break routing requires an integer penalty")
  scale = 2*N+len(states)+1
  node_city = {i:c for (c,l),i in states.items()}
  vv = [value*scale + int(row in node_city and col in node_city and node_city[row] == node_city[col]) for row,col,value in zip(rr,cc,vv)]
 matrix=csr_matrix((np.array(vv), (rr,cc)),shape=(2*N+len(states),)*2)
 return matrix,states

def paths(owner,transfer_penalty=40, allow_edges=None, return_detail=False):
 mat,states=build(owner,transfer_penalty,allow_edges,tie_break=True)
 reachable=sorted({c for (c,_) in states})
 origins=np.array([CI[x] for x in reachable],dtype=int);dests=np.array([CI[x]+N for x in reachable],dtype=int);
 if not reachable:return {"pairs":0,"missing":0,**{k:None for k in ("mean_fuel","mean_transfers","mean_detour","share_direct","share_max_one","pct_3plus","mean_score")},"items":[]}
 dist,pred=dijkstra(mat,directed=True,indices=origins,return_predecessors=True)
 selected=dist[:,dests]
 fvals=[];trvals=[];detours=[];unreachable=0;items=[]
 node_map={v:k for k,v in states.items()}
 for i,a in enumerate(reachable):
  for j,b in enumerate(reachable):
   if j<=i:continue
   v=float(selected[i,j]);
   if not np.isfinite(v):unreachable+=1;continue
   node=CI[b]+N;steps=[];tf=0;t=0;seq=[]
   while node!=CI[a]:
    prev=int(pred[i,node]);
    if prev<0:raise ValueError('broken predecessor')
    if prev in node_map and node in node_map:
     c,l=node_map[prev];d,ll=node_map[node]
     if c==d:
      t+=1
     else:
      ef=physical[c][d]['weight'];tf+=ef;seq.append((c,d,l))
    node=prev
   fvals.append(tf);trvals.append(t)
   lb=physical_shortest[CI[a],CI[b]];detours.append(tf/lb if lb>0 else 1.)
   if return_detail:items.append((a,b,tf,t,lb,seq[::-1]))
 out={'pairs':len(fvals),'missing':unreachable,'mean_fuel':float(np.mean(fvals)) if fvals else None,'mean_transfers':float(np.mean(trvals)) if fvals else None,'mean_detour':float(np.mean(detours)) if fvals else None,'share_direct':float(np.mean(np.array(trvals)==0)) if fvals else None,'share_max_one':float(np.mean(np.array(trvals)<=1)) if fvals else None,'pct_3plus':float(np.mean(np.array(trvals)>=3)) if fvals else None,'mean_score':float(np.mean(np.array(fvals)+np.array(trvals)*transfer_penalty)) if fvals else None,'items':items}
 return out

def fast_score(owner,penalty=40,city_filter=None):
 mat,states=build(owner,penalty)
 reached=[city for city in CITIES if any(c==city for c,_ in states)]
 if city_filter:reached=[city for city in reached if city in city_filter]
 if len(reached)<2:return float('inf')
 origins=np.array([CI[x] for x in reached],dtype=int);dests=np.array([CI[x]+N for x in reached],dtype=int);
 dist=dijkstra(mat,directed=True,indices=origins,return_predecessors=False)[:,dests]
 return np.nanmean(dist[np.triu_indices(len(reached),1)])

if __name__=='__main__':
 t0=time.perf_counter()
 for p in (0,20,40,80):
  z=paths(ORIGINAL,p)
  print('BASELINE',p,{k:round(v,4) if isinstance(v,float) else v for k,v in z.items() if k!='items'},'t',round(time.perf_counter()-t0,1))
 print('Benchmark candidate assignment...')
 print('Baseline score',fast_score(ORIGINAL,40),'time',time.perf_counter()-t0)
 # Greedy hill-climb: moves single edges between geographically adjacent lines.
 owner=ORIGINAL.copy()
 history=[]
 for it in range(6):
  before=fast_score(owner,40)
  if not history: print('start',before)
  proposals=[]
  line_nodes=defaultdict(set)
  for e in EDGES:
   line_nodes[owner[e['id']]].update((e['a'],e['b']))
  for e in EDGES:
   old=owner[e['id']]
   candidates={owner[other['id']] for city in (e['a'],e['b']) for other in EDGES if other['id']!=e['id'] and city in (other['a'],other['b'])}
   # do not move core fixed edges: preserve user's already built and existing line identities
   if e['id'] in set(D['base']+D['done']):continue
   if not connected_owner({**owner,e['id']:'__removed__'},old):continue
   for new in sorted(candidates-{old}):
    proposal={**owner,e['id']:new}
    if not connected_owner(proposal,new):continue
    z=fast_score(proposal,40)
    proposals.append((z,e['id'],old,new))
  proposals.sort()
  if not proposals or proposals[0][0]>=before-.001:
   print('no improvement',it);break
  best=proposals[0]
  owner[best[1]]=best[3];history.append({'step':it+1,'edge':best[1],'from':best[2],'to':best[3],'before':before,'after':best[0]})
  print('ITER',it+1,'candidates',len(proposals),'best',best,'elapsed',round(time.perf_counter()-t0,1))
 print('HISTORY',json.dumps(history,indent=2))
 results={}
 for pen in (0,20,40,80):
  results[str(pen)]={'before':{k:v for k,v in paths(ORIGINAL,pen).items() if k!='items'},'after':{k:v for k,v in paths(owner,pen).items() if k!='items'}}
 print('RESULTS',json.dumps(results,indent=2))
 report={'description':'Relative cargo routing proxy, matched all city pairs, uniform pairs','transfers_penalty_in_fuel_equivalents':40,'data':{'cities':N,'tracks':len(EDGES),'imputed_fuel_connections':IMPUTED},'move_history':history,'results':results,'optimized_owner':owner}
 Path(__file__).with_name('pocket_train_model.json').write_text(json.dumps(report,indent=2))
 print('TIME',time.perf_counter()-t0)
