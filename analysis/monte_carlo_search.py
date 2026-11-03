"""Seeded randomized optimization with replica exchange and structural proposals.

This is an optimization heuristic, not a posterior sampler. Proposal probabilities
are asymmetric. Every incumbent is promoted only by its exact all-city-pair score.
"""
from collections import Counter
from functools import lru_cache
from itertools import permutations
from pathlib import Path
import argparse,json,math,random,time
import numpy as np
from scipy.sparse.csgraph import dijkstra
import deep_search as d
import model_pocket_trains as m

ROOT=Path(__file__).resolve().parent
PAIRS=np.triu_indices(m.N,1)

def canonical(owner):
 labels={};out=[]
 for label in owner:
  if label not in labels:labels[label]=len(labels)
  out.append(labels[label])
 return tuple(out)

class ExactScorer:
 def __init__(self,cache_size=60000):
  @lru_cache(maxsize=cache_size)
  def evaluate(owner):
   mat,_=m.build(d.decode(owner),40)
   costs=dijkstra(mat,directed=True,indices=np.arange(m.N))[:,np.arange(m.N)+m.N]
   selected=costs[PAIRS]
   if not np.isfinite(selected).all():raise ValueError('A candidate lost a city pair')
   return float(np.mean(selected))
  self.cached=evaluate
 def __call__(self,owner):return self.cached(canonical(owner))
 def cache_info(self):return self.cached.cache_info()

def metropolis(delta,temperature,u):
 if delta<=0:return True
 return temperature>0 and math.log(max(u,1e-300)) < -delta/temperature

def exchange_log_ratio(a,b,ta,tb):return (a-b)*(1/ta-1/tb)

def valid(owner,fixed=frozenset(),required_count=None,cap=1100):
 if len(owner)!=len(d.IDS) or any(x<0 or x>=len(d.NAMES) for x in owner):return False
 if any(owner[i]!=d.ORIGINAL[i] for i in fixed):return False
 segments,nodes,lengths=d.layout(owner)
 if required_count is not None and len(segments)!=required_count:return False
 return all(lengths[line]<=cap and d.connected(edges) for line,edges in segments.items())

def grow(edges,rng,size,fixed=frozenset()):
 available=set(edges)-fixed
 if not available:return None
 group={rng.choice(sorted(available))}
 while len(group)<size:
  options=set().union(*(d.ADJ[i] for i in group))&available-group
  if not options:break
  group.add(rng.choice(sorted(options)))
 return group

def wilson_tree(edges,rng):
 """Uniform spanning tree of the connected edge-adjacency graph."""
 nodes=set(edges);root=min(nodes);tree={root};links=[]
 while tree!=nodes:
  start=min(nodes-tree);walk=[start];positions={start:0}
  while walk[-1] not in tree:
   nxt=rng.choice(sorted(d.ADJ[walk[-1]]&nodes))
   if nxt in positions:
    keep=positions[nxt]+1
    for erased in walk[keep:]:positions.pop(erased,None)
    walk=walk[:keep]
   else:positions[nxt]=len(walk);walk.append(nxt)
  links.extend(zip(walk,walk[1:]));tree.update(walk)
 return links

def cut_components(edges,tree,cuts):
 adj={i:set() for i in edges}
 for index,(a,b) in enumerate(tree):
  if index not in cuts:adj[a].add(b);adj[b].add(a)
 unseen=set(edges);parts=[]
 while unseen:
  start=min(unseen);unseen.remove(start);part={start};stack=[start]
  while stack:
   a=stack.pop();new=unseen&adj[a];unseen-=new;part|=new;stack.extend(new)
  parts.append(part)
 return parts

def choose_touching_lines(owner,segments,nodes,rng,count=2):
 # Include proposals centered on interchange hubs, rather than only leaves.
 start=rng.choice(sorted(segments));chosen={start}
 while len(chosen)<count:
  cities=set().union(*(nodes[x] for x in chosen))
  options=[x for x in sorted(segments) if x not in chosen and nodes[x]&cities]
  if not options:return None
  chosen.add(rng.choice(options))
 return sorted(chosen)

def propose(owner,rng,fixed=frozenset(),variable=False,force_kind=None):
 segments,nodes,lengths=d.layout(owner)
 kinds=['relocate','swap','repartition']+(['split','merge'] if variable else [])
 weights=[.40,.23,.37] if not variable else [.32,.19,.29,.12,.08]
 kind=force_kind or rng.choices(kinds,weights,k=1)[0]
 trial=list(owner)
 if kind=='relocate':
  source=rng.choice(sorted(segments));size=rng.choices([1,2,3,5,8],[.50,.23,.15,.08,.04],k=1)[0]
  group=grow(segments[source],rng,size,fixed)
  if not group:return None,kind
  left=segments[source]-group
  if not left and not variable:return None,kind
  if left and not d.connected(left):return None,kind
  touch={c for i in group for c in d.ENDS[i]};amount=sum(d.FUEL[i] for i in group)
  targets=[x for x in sorted(segments) if x!=source and lengths[x]+amount<=1100 and nodes[x]&touch]
  if not targets:return None,kind
  target=rng.choice(targets)
  for i in group:trial[i]=target
 elif kind=='swap':
  labels=choose_touching_lines(owner,segments,nodes,rng,2)
  if not labels:return None,kind
  a,b=labels;ga=grow(segments[a],rng,rng.randint(1,4),fixed);gb=grow(segments[b],rng,rng.randint(1,4),fixed)
  if not ga or not gb:return None,kind
  fa=sum(d.FUEL[i] for i in ga);fb=sum(d.FUEL[i] for i in gb)
  if max(lengths[a]-fa+fb,lengths[b]-fb+fa)>1100:return None,kind
  if not d.connected((segments[a]-ga)|gb) or not d.connected((segments[b]-gb)|ga):return None,kind
  for i in ga:trial[i]=b
  for i in gb:trial[i]=a
 elif kind=='repartition':
  count=3 if rng.random()<.25 else 2;labels=choose_touching_lines(owner,segments,nodes,rng,count)
  if not labels:return None,kind
  union=set().union(*(segments[x] for x in labels));tree=wilson_tree(union,rng)
  found=False
  for _ in range(16):
   parts=cut_components(union,tree,set(rng.sample(range(len(tree)),count-1)))
   if any(sum(d.FUEL[i] for i in part)>1100 for part in parts):continue
   assignments=list(permutations(labels));rng.shuffle(assignments)
   for assigned in assignments:
    if any(owner[i]!=label for part,label in zip(parts,assigned) for i in part&fixed):continue
    for part,label in zip(parts,assigned):
     for i in part:trial[i]=label
    found=True;break
   if found:break
  if not found:return None,kind
 elif kind=='split':
  unused=sorted(set(range(len(d.NAMES)))-set(segments))
  if not variable or not unused:return None,kind
  source=rng.choice(sorted(segments));group=grow(segments[source],rng,rng.randint(1,max(1,min(8,len(segments[source])-1))),fixed)
  if not group or not segments[source]-group or not d.connected(segments[source]-group):return None,kind
  for i in group:trial[i]=unused[0]
 elif kind=='merge':
  if not variable:return None,kind
  labels=choose_touching_lines(owner,segments,nodes,rng,2)
  if not labels:return None,kind
  a,b=labels
  if lengths[a]+lengths[b]>1100 or segments[a]&fixed:return None,kind
  for i in segments[a]:trial[i]=b
 else:raise ValueError('Unknown proposal kind')
 result=tuple(trial)
 if result==owner or canonical(result)==canonical(owner):return None,kind
 # A complete invariant check deliberately separates move generation from scoring.
 if not valid(result,fixed,38 if not variable else None):return None,kind
 return result,kind

def snapshot(path,data):
 tmp=path.with_suffix('.tmp');tmp.write_text(json.dumps(data,indent=2));tmp.replace(path)

def run(mode,seed=20261110,valid_per_epoch=1500,minimum_valid=50000,stale_limit=25,fresh=False):
 fixed=d.FIXED if mode=='fixed' else frozenset();variable=mode=='consolidated';rng=random.Random(seed)
 reference=json.loads((ROOT/'monte_carlo_baseline.json').read_text())['profiles'][mode]
 incumbent=reference if fresh else json.loads((ROOT/f'deep_{mode}.json').read_text())
 existing=ROOT/f'monte_carlo_{mode}.json'
 if not fresh and existing.exists():
  prior=json.loads(existing.read_text())
  archive=ROOT/'monte_carlo_campaigns';archive.mkdir(exist_ok=True)
  suffix='' if prior.get('complete') else '-partial'
  snapshot(archive/f'{mode}-seed-{prior["seed"]}{suffix}.json',prior)
  if valid(d.encode(prior['owner']),fixed,38 if not variable else None) and prior['score']<incumbent['score']:incumbent=prior
 best=d.encode(incumbent['owner'])
 scorer=ExactScorer();old_score=d.score;d.score=scorer
 try:
  initial=scorer(best);reference_score=reference['score'];best_score=initial;start=time.monotonic();history=[];counts=Counter();kinds=Counter();uphill=0;swaps=0;epoch=0;stale=0
  seeds=[best,d.encode(m.ORIGINAL)]
  if mode=='rework' and (ROOT/'monte_carlo_expanded_38.json').exists():seeds.append(d.encode(json.loads((ROOT/'monte_carlo_expanded_38.json').read_text())['owner']))
  if mode=='consolidated' and (ROOT/'monte_carlo_rework.json').exists():
   prior_rework=json.loads((ROOT/'monte_carlo_rework.json').read_text())
   if prior_rework.get('complete'):seeds.append(d.encode(prior_rework['owner']))
  if mode!='fixed':seeds.append(d.encode(json.loads((ROOT/'deep_fixed.json').read_text())['owner']))
  seed_best=min(seeds,key=scorer)
  if scorer(seed_best)<best_score:best=seed_best;best_score=scorer(best)
  states=[best]+[seeds[i%len(seeds)] for i in range(4)];energies=[scorer(x) for x in states];temperatures=[.02,.12,.6,2.5,8.0]
  output=ROOT/f'monte_carlo_{mode}.json';audit=None
  def persist(complete=False):
   chosen=best if fixed else d.minimize_rework_labels(best)
   data={'profile':mode,'method':'Replica-exchange annealing with uniform-spanning-tree repartition, split/merge moves and exact all-pairs scoring','seed':seed,'starting_partitions':seeds,'partition_encoding':'Edge order IDS and label order NAMES from deep_search; arrays retain every supplied starting layout','baseline_score':reference_score,'campaign_start_score':initial,'score':scorer(chosen),'owner':d.decode(chosen),'line_count':len(set(chosen)),'counts':dict(counts),'proposal_kinds':dict(kinds),'uphill_accepted':uphill,'replica_exchanges':swaps,'temperatures':temperatures,'epochs':history,'stopping_rule':{'minimum_valid_proposals':minimum_valid,'consecutive_nonimproving_epochs':stale_limit,'valid_proposals_per_epoch':valid_per_epoch},'cache':scorer.cache_info()._asdict(),'final_audit':audit,'complete':complete,'elapsed_seconds':round(time.monotonic()-start,2),'interpretation':'Heuristic optimization, not posterior sampling or proof of global optimality. Asymmetric proposals are not claimed to sample a stationary target distribution.'}
   snapshot(output,data)
  while True:
   epoch+=1;epoch_before=best_score;made=0;states[0]=best;energies[0]=best_score
   # Reheated hot replicas retain exploratory states; cold replica tracks the incumbent.
   heat=1+min(stale,15)/15
   while made<valid_per_epoch:
    index=made%len(states);proposal,kind=propose(states[index],rng,fixed,variable);counts['attempts']+=1
    if proposal is None:counts['invalid_or_unchanged']+=1;continue
    made+=1;counts['valid_proposals']+=1;kinds[kind]+=1
    value=scorer(proposal);delta=value-energies[index];temperature=temperatures[index]*(heat if index>=2 else 1)
    if metropolis(delta,temperature,rng.random()):
     states[index]=proposal;energies[index]=value;counts['accepted']+=1
     if delta>0:uphill+=1
    if value<best_score-1e-7:best=proposal;best_score=value
    if made%25==0:
     for a in range((made//25)%2,len(states)-1,2):
      b=a+1;ta=temperatures[a]*(heat if a>=2 else 1);tb=temperatures[b]*(heat if b>=2 else 1)
      if math.log(max(rng.random(),1e-300))<min(0,exchange_log_ratio(energies[a],energies[b],ta,tb)):
       states[a],states[b]=states[b],states[a];energies[a],energies[b]=energies[b],energies[a];swaps+=1
   # Exact deterministic polishing prevents noisy or transient candidates being promoted.
   if best_score<epoch_before-1e-7 or epoch%5==0:
    candidate,moves,_=d.broad_descent(best,fixed,variable)
    if scorer(candidate)<best_score-1e-7:best=candidate;best_score=scorer(candidate)
   improved=best_score<epoch_before-1e-7;stale=0 if improved else stale+1
   history.append({'epoch':epoch,'score':best_score,'improved':improved,'stale_epochs':stale,'valid_proposals':counts['valid_proposals'],'exact_evaluations':scorer.cache_info().misses})
   persist();print(mode,'EPOCH',epoch,'best',round(best_score,7),'stale',stale,'valid',counts['valid_proposals'],'exact',scorer.cache_info().misses,'uphill',uphill,'seconds',round(time.monotonic()-start,1),flush=True)
   if counts['valid_proposals']>=minimum_valid and stale>=stale_limit:
    candidate,moves,checked=d.search(best,fixed,variable,group=6,swaps=3)
    if scorer(candidate)<best_score-1e-7:
     best=candidate;best_score=scorer(candidate);stale=0;continue
    audit={'exhausted':True,'candidates_checked':checked,'score':best_score,'group_size':6,'swap_size':3};break
  persist(True);print('FINISHED',mode,'score',best_score,'baseline',initial,'valid',counts['valid_proposals'],flush=True)
  return json.loads(output.read_text())
 finally:d.score=old_score

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--mode',choices=['fixed','rework','consolidated'],required=True);p.add_argument('--seed',type=int,default=20261110);p.add_argument('--valid-per-epoch',type=int,default=1500);p.add_argument('--minimum-valid',type=int,default=50000);p.add_argument('--stale',type=int,default=25);p.add_argument('--fresh',action='store_true');a=p.parse_args();run(a.mode,a.seed,a.valid_per_epoch,a.minimum_valid,a.stale,a.fresh)
