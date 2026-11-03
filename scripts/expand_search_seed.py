import sys,json,time,argparse
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'analysis'))
import deep_search as d
from model_pocket_trains import fast_score
root=Path(__file__).resolve().parents[1]/'analysis';parser=argparse.ArgumentParser();parser.add_argument('--source',default='deep_consolidated.json');parser.add_argument('--output',default='expanded_38_seed.json');args=parser.parse_args();data=json.loads((root/args.source).read_text());owner=d.encode(data['owner']);history=[];t0=time.monotonic()
while len(set(owner))<38:
 segments,nodes,lengths=d.layout(owner);unused=next(i for i in range(len(d.NAMES)) if i not in segments);best=None
 for source,edges in segments.items():
  for group in d.groups(edges,3):
   if len(group)==len(edges) or not d.connected(edges-set(group)):continue
   trial=list(owner)
   for i in group:trial[i]=unused
   trial=tuple(trial);value=d.score(trial)
   if best is None or value<best[0]-1e-7:best=(value,trial,group)
 if best is None:raise RuntimeError('No valid connected split')
 value,owner,group=best;history.append({'tracks':[d.IDS[i] for i in group],'score':value});print('SPLIT',len(set(owner)),value,flush=True)
owner,moves,checked=d.broad_descent(owner,frozenset(),False)
owner,extra,checked=d.search(owner,frozenset(),False,group=6,swaps=3);moves+=extra
owner=d.minimize_rework_labels(owner);value=d.score(owner)
result={'owner':d.decode(owner),'score':value,'splits':history,'descent':moves,'elapsed_seconds':time.monotonic()-t0}
(root/args.output).write_text(json.dumps(result,indent=2));print('EXPANDED_RESULT',value,'seconds',result['elapsed_seconds'],flush=True)
