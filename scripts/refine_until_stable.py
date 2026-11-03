"""Repeat merge/split cross-seeding until an entire cycle fails to improve.

A strict local-search stop, not a claim of global optimality. This never publishes.
"""
import json,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];sys.path.insert(0,str(root/'analysis'))
import deep_search as d
folder=root/'analysis';archive=folder/'search_campaigns';archive.mkdir(exist_ok=True)
trace=[]
def read(mode):return json.loads((folder/f'deep_{mode}.json').read_text())
def save_archive(mode,cycle):
 data=read(mode);(archive/f'{mode}-cross-cycle-{cycle}.json').write_text(json.dumps(data,indent=2))
def run(*args):subprocess.run([sys.executable,*args],cwd=root,check=True)
cycle=0
while True:
 cycle+=1;before={x:read(x)['score'] for x in ['rework','consolidated']}
 print('CROSS_CYCLE',cycle,'BEFORE',before,flush=True)
 run('scripts/expand_search_seed.py')
 expanded=json.loads((folder/'expanded_38_seed.json').read_text())
 if expanded['score']<before['rework']-1e-7:
  save_archive('rework',cycle)
  run('analysis/deep_search.py','--mode','rework','--stale','20','--seed',str(20261200+cycle),'--incumbent-only')
 # Independently re-merge the current strongest 38-line partition.
 start=d.encode(read('rework')['owner']);owner,moves,_=d.broad_descent(start,frozenset(),True)
 owner,extra,checked=d.search(owner,frozenset(),True,group=6,swaps=3);moves+=extra
 candidate={'owner':d.decode(d.minimize_rework_labels(owner)),'score':d.score(owner),'moves':moves}
 (folder/'merge_probe.json').write_text(json.dumps(candidate,indent=2))
 if candidate['score']<before['consolidated']-1e-7:
  save_archive('consolidated',cycle)
  run('analysis/deep_search.py','--mode','consolidated','--stale','20','--seed',str(20261300+cycle),'--incumbent-only')
 after={x:read(x)['score'] for x in ['rework','consolidated']}
 stable=all(after[x]>=before[x]-1e-7 for x in before)
 trace.append({'cycle':cycle,'before':before,'expanded_38_probe':expanded['score'],'merged_probe':candidate['score'],'after':after,'no_improvement':stable})
 (folder/'stability_trace.json').write_text(json.dumps({'cycles':trace,'stable':stable,'meaning':'No profile improved in the final merge/split cross-seeding cycle; each stored profile also has a completed local neighborhood audit.'},indent=2))
 print('CROSS_CYCLE',cycle,'AFTER',after,'STABLE',stable,flush=True)
 if stable:break
