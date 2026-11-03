from model_pocket_trains import *
from collections import defaultdict
from pathlib import Path

def hubopt(owner,penalty=40,limit=16,region=None):
 hist=[];t0=time.perf_counter()
 for it in range(limit):
  before=fast_score(owner,penalty,region)
  proposals=[]
  line_nodes=defaultdict(set);line_tracks=defaultdict(list)
  for e in EDGES:
   line_nodes[owner[e['id']]].update((e['a'],e['b']));line_tracks[owner[e['id']]].append(e)
  for e in EDGES:
   old=owner[e['id']];key=e['id']
   if key in set(D['base']+D['done']):continue
   if len(line_tracks[old])<=2:continue
   proposed_removal={**owner,key:'__removed__'}
   if not connected_owner(proposed_removal,old):continue
   neighbor_lines={owner[other['id']] for city in (e['a'],e['b']) for other in EDGES if other['id']!=key and city in (other['a'],other['b'])}
   for new in sorted(neighbor_lines-{old}):
    if sum(F(x) for x in line_tracks[new])+F(e)>1100:continue
    proposal={**owner,key:new}
    if not connected_owner(proposal,new):continue
    z=fast_score(proposal,penalty,region)
    proposals.append((z,key,old,new))
  proposals.sort()
  if not proposals or proposals[0][0]>=before-.00001:break
  score,key,old,new=proposals[0];owner[key]=new
  hist.append({'track':key,'from':old,'to':new,'score_before':round(before,3),'score_after':round(score,3)})
  print(it+1,key,old,'->',new,'score',round(score,2),'seconds',round(time.perf_counter()-t0,1),flush=True)
 return owner,hist

if __name__=='__main__':
 owner,hist=hubopt(ORIGINAL.copy(),limit=25)
 results={}
 for p in (0,20,40,80):
  results[str(p)]={'baseline':{k:v for k,v in paths(ORIGINAL,p).items() if k!='items'},'refined':{k:v for k,v in paths(owner,p).items() if k!='items'}}
 # example jobs: fixed pairs city-world
 pairs=[('London','Rome'),('Lisbon','New York'),('Berlin','Beijing'),('Paris','Shanghai'),('New York','Tokyo'),('Sydney','Paris'),('Cape Town','Sydney'),('New Delhi','Milan'),('Kolkata','Rome'),('Casablanca','Dakar'),('Kyiv','Moscow'),('Volgograd','Shanghai')]
 ex=[]
 for own,label in [(ORIGINAL,'baseline'),(owner,'refined')]:
  z=paths(own,40,return_detail=True)
  lookup={(a,b):(tf,t,lb,seq) for a,b,tf,t,lb,seq in z['items']}
  for a,b in pairs:
   swapped=a>b; aa,bb=sorted([a,b]);v=lookup[(aa,bb)];
   seq=v[3] if not swapped else [(d,c,l) for c,d,l in v[3][::-1]]
   seg=[]
   for src,dst,line in seq:
    if seg and seg[-1]['line']==line:
     seg[-1]['route'].append(dst)
    else:seg.append({'line':line,'route':[src,dst]})
   ex.append({'scenario':label,'a':a,'b':b,'fuel':v[0],'transfers':v[1],'shortest_fuel':v[2],'sections':seg})
 print('selected examples',json.dumps(ex[:4],indent=2))
 out={'model_version':'2026-11-02-a','method':'All 9,591 unordered city pairs, compare identical hypothetical city-to-city cargo jobs. Routing uses fuel units per segment + transfer penalty, cheapest generalized path. 8 unverified fuel lengths imputed. Simple 1-edge local track ownership changes constrained to preserve 38 connected lines and original 15 completed tracks. This is a lower-bound cargo itinerary, not a discrete-event train fleet simulator.','assumptions':{'city_pair_sampling':'Uniform across 139 cities, not verified in-game job spawn distribution','transfer_cost':'Equivalent to 40 fuel units per transfer (sensitivity 0/20/40/80)','fuel_unverified':IMPUTED,'line_max_fuel_sum':1100,'preserve_existing_tracks':True,'line_count':len(LINE_INFO)},'baseline':ORIGINAL,'optimized':owner,'history':hist,'results':results,'sample_jobs':ex}
 Path(__file__).with_name('pocket_trains_efficiency_results.json').write_text(json.dumps(out,indent=2))
 print('FINAL',json.dumps(results,indent=2))
