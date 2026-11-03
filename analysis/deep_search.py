"""Broader deterministic local search plus seeded perturbation restarts.

No global-optimality claim: exhaustion is relative to the enumerated neighborhood.
Profiles compare fixed initial owners, rework with 38 lines, and consolidation.
"""
from collections import defaultdict
from functools import lru_cache
from itertools import combinations
from pathlib import Path
import argparse,json,random,time
import numpy as np
from scipy.optimize import linear_sum_assignment
import model_pocket_trains as m

ROOT=Path(__file__).resolve().parent
IDS=tuple(sorted(m.ED));INDEX={k:i for i,k in enumerate(IDS)}
NAMES=tuple(sorted(m.LINE_INFO));NI={x:i for i,x in enumerate(NAMES)}
ENDS=tuple((m.CI[m.ED[k]['a']],m.CI[m.ED[k]['b']]) for k in IDS)
FUEL=tuple(m.F(m.ED[k]) for k in IDS)
INITIAL=set(m.D['base']+m.D['done']);FIXED=frozenset(INDEX[k] for k in INITIAL)
ADJ=tuple(frozenset(j for j,(a,b) in enumerate(ENDS) if i!=j and (a in ENDS[i] or b in ENDS[i])) for i in range(len(IDS)))
ORIGINAL=tuple(NI[m.ORIGINAL[k]] for k in IDS)

def encode(owner):return tuple(NI[owner[k]] for k in IDS)
def decode(owner):return {k:NAMES[owner[i]] for i,k in enumerate(IDS)}
def connected(edges):
 if not edges:return False
 remaining=set(edges);stack=[remaining.pop()]
 while stack:
  e=stack.pop();found=remaining&ADJ[e];remaining-=found;stack.extend(found)
 return not remaining

def layout(owner):
 segments=defaultdict(set)
 for i,line in enumerate(owner):segments[line].add(i)
 nodes={l:{c for i in es for c in ENDS[i]} for l,es in segments.items()}
 lengths={l:sum(FUEL[i] for i in es) for l,es in segments.items()}
 return segments,nodes,lengths

def groups(edges,size,fixed=frozenset()):
 allowed=set(edges)-fixed
 current={(i,) for i in allowed};out=set(current)
 for _ in range(1,size):
  nxt=set()
  for group in current:
   attach=set().union(*(ADJ[i] for i in group))&allowed-set(group)
   for j in attach:nxt.add(tuple(sorted((*group,j))))
  out|=nxt;current=nxt
 return sorted(out,key=lambda x:(len(x),x))

def changes(owner,cap=1100,fixed=frozenset(),maxgroup=3,swaps=0,merge=False):
 segments,nodes,lengths=layout(owner);seen=set()
 gr={l:groups(es,max(maxgroup,swaps),fixed) for l,es in segments.items()}
 for line in sorted(segments):
  for group in gr[line]:
   if len(group)>maxgroup:continue
   left=segments[line]-set(group)
   if not left and not merge:continue
   if left and not connected(left):continue
   amount=sum(FUEL[i] for i in group);touch={c for i in group for c in ENDS[i]}
   for target in sorted(segments):
    if target==line or lengths[target]+amount>cap or not touch&nodes[target]:continue
    trial=list(owner)
    for i in group:trial[i]=target
    value=tuple(trial)
    if value not in seen:seen.add(value);yield value,{'kind':'merge' if not left else 'relocate','tracks':[IDS[i] for i in group],'from':NAMES[line],'to':NAMES[target]}
 # Whole railroad merges larger than maxgroup.
 if merge:
  for line in sorted(segments):
   if segments[line]&fixed or len(segments[line])<=maxgroup:continue
   for target in sorted(segments):
    if line==target or lengths[line]+lengths[target]>cap or not nodes[line]&nodes[target]:continue
    trial=tuple(target if x==line else x for x in owner)
    if trial not in seen:seen.add(trial);yield trial,{'kind':'merge','tracks':[IDS[i] for i in sorted(segments[line])],'from':NAMES[line],'to':NAMES[target]}
 if swaps:
  for a,b in combinations(sorted(segments),2):
   if not nodes[a]&nodes[b]:continue
   ag=[g for g in gr[a] if len(g)<=swaps and {c for i in g for c in ENDS[i]}&nodes[b]]
   bg=[g for g in gr[b] if len(g)<=swaps and {c for i in g for c in ENDS[i]}&nodes[a]]
   for ga in ag:
    sa=set(ga);fa=sum(FUEL[i] for i in ga)
    for gb in bg:
     sb=set(gb);fb=sum(FUEL[i] for i in gb)
     if max(lengths[a]-fa+fb,lengths[b]-fb+fa)>cap:continue
     if not connected((segments[a]-sa)|sb) or not connected((segments[b]-sb)|sa):continue
     trial=list(owner)
     for i in ga:trial[i]=b
     for i in gb:trial[i]=a
     value=tuple(trial)
     if value not in seen:
      seen.add(value);yield value,{'kind':'exchange','a':[IDS[i] for i in ga],'b':[IDS[i] for i in gb],'from':NAMES[a],'to':NAMES[b]}

@lru_cache(maxsize=150000)
def score(owner):return float(m.fast_score(decode(owner)))

def search(start,fixed,merge=False,group=3,swaps=0):
 owner=start;history=[]
 while True:
  before=score(owner);best=before;choice=None;count=0
  for trial,move in changes(owner,fixed=fixed,maxgroup=group,swaps=swaps,merge=merge):
   value=score(trial);count+=1
   if value<best-1e-7:best=value;choice=(trial,move)
  if choice is None:return owner,history,count
  owner,move=choice;history.append({**move,'before':before,'after':best})

def broad_descent(start,fixed,merge):
 owner=start;hist=[]
 while True:
  owner,moves,_=search(owner,fixed,merge,group=3);hist+=moves
  owner,moves,checked=search(owner,fixed,merge,group=4,swaps=2);hist+=moves
  if not moves:return owner,hist,checked

def minimize_rework_labels(owner):
 # Railroad labels are interchangeable mathematically. Match labels to existing
 # train colors to avoid asking for gratuitous renames/reclaims.
 active=sorted(set(owner));matrix=np.zeros((len(active),len(NAMES)),dtype=float)
 for row,l in enumerate(active):
  for i in FIXED:
   if owner[i]==l:matrix[row,ORIGINAL[i]]-=100000+m.ED[IDS[i]].get('claim',0)
  matrix[row,l]-=.01
 rows,cols=linear_sum_assignment(matrix)
 rename={active[r]:int(c) for r,c in zip(rows,cols)}
 return tuple(rename[x] for x in owner)

def run(mode,stale_limit=16,seed=20261103,incumbent_only=False):
 fixed=FIXED if mode=='fixed' else frozenset();merge=mode=='consolidated'
 rng=random.Random(seed);t0=time.monotonic();base=json.loads((ROOT/'improved_solution.json').read_text())
 seeds=[] if incumbent_only else [encode(base['owner']),encode(m.ORIGINAL),encode(json.loads((ROOT/'pocket_trains_efficiency_results.json').read_text())['optimized'])]
 if mode=='consolidated' and (ROOT/'merge_probe.json').exists():seeds.append(encode(json.loads((ROOT/'merge_probe.json').read_text())['owner']))
 if mode=='rework' and (ROOT/'expanded_38_seed.json').exists():seeds.append(encode(json.loads((ROOT/'expanded_38_seed.json').read_text())['owner']))
 for previous in [ROOT/f'deep_{mode}.json',ROOT/'deep_fixed.json' if mode!='fixed' else ROOT/f'deep_{mode}.json']:
  if previous.exists():seeds.insert(0,encode(json.loads(previous.read_text())['owner']))
 if mode=='consolidated' and (ROOT/'deep_rework.json').exists():seeds.insert(0,encode(json.loads((ROOT/'deep_rework.json').read_text())['owner']))
 best=seeds[0];best_value=score(best);runs=[];stale=0;attempt=0;history=[]
 output=ROOT/f'deep_{mode}.json'
 def persist(final=None):
  chosen=best if fixed else minimize_rework_labels(best)
  data={'profile':mode,'owner':decode(chosen),'score':score(chosen),'initial_score':base['score'],'line_count':len(set(chosen)),'fixed_initial_owners':bool(fixed),'initial_owner_changes':[{'track':IDS[i],'from':NAMES[ORIGINAL[i]],'to':NAMES[chosen[i]],'original_claim_reference':m.ED[IDS[i]].get('claim')} for i in sorted(FIXED) if chosen[i]!=ORIGINAL[i]],'restarts':runs,'best_history':history,'stopping_rule':{'consecutive_nonimproving_restarts':stale_limit,'final_neighborhood':'connected relocations through 6 tracks, connected exchanges through 3 tracks each way, and full-line merges where enabled'},'final_audit':final,'evaluations':score.cache_info()._asdict(),'elapsed_seconds':round(time.monotonic()-t0,2),'seed':seed}
  temporary=output.with_suffix('.tmp');temporary.write_text(json.dumps(data,indent=2));temporary.replace(output)
 while seeds or stale<stale_limit:
  if seeds:start=seeds.pop(0);source='supplied_seed'
  else:
   start=best;source='perturbation'
   for _ in range(rng.randint(2,10)):
    options=list(changes(start,fixed=fixed,maxgroup=2,swaps=1,merge=merge))
    if options:start=rng.choice(options)[0]
  candidate,moves,checked=broad_descent(start,fixed,merge);value=score(candidate);attempt+=1
  improved=value<best_value-1e-7
  if improved:best=candidate;best_value=value;history=moves;stale=0
  else:stale+=1
  runs.append({'attempt':attempt,'source':source,'score':value,'improved':improved,'moves':len(moves),'stale':stale})
  persist();print(mode,attempt,'score',round(value,6),'best',round(best_value,6),'stale',stale,'evaluations',score.cache_info().misses,'sec',round(time.monotonic()-t0,1),flush=True)
 # Audit a larger neighborhood. Any discovered improvement resets the plateau.
 while True:
  candidate,moves,checked=search(best,fixed,merge,group=6,swaps=3)
  if not moves:
   persist({'exhausted':True,'candidates_checked':checked,'score':score(best),'group_size':6,'swap_size':3});break
  best=candidate;best_value=score(best);history+=moves
  print(mode,'LARGE_NEIGHBORHOOD_GAIN',round(best_value,6),'moves',len(moves),flush=True)
  best,moves,_=broad_descent(best,fixed,merge);history+=moves;best_value=score(best)
  persist()
 print('FINISHED',mode,score(best),'lines',len(set(best)),'seconds',round(time.monotonic()-t0,1),flush=True)
 return json.loads(output.read_text())

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--mode',choices=['fixed','rework','consolidated'],required=True);p.add_argument('--stale',type=int,default=16);p.add_argument('--seed',type=int,default=20261103);p.add_argument('--incumbent-only',action='store_true');args=p.parse_args();run(args.mode,args.stale,args.seed,args.incumbent_only)
