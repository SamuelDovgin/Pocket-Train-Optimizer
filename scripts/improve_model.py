"""Continue the supplied solution with corrected pair/triple search."""
import sys, json
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'analysis'))
import advanced_optimize as opt
from model_pocket_trains import fast_score
root=Path(opt.OUT)
base=json.loads((root/'advanced_pairs.json').read_text())
owner=base['owner']; history=base['history']; runs=[]
for size,budget in [(2,180),(3,180),(2,90)]:
 owner,moves=opt.best_greedy(owner,rounds=100,group=size,budget=budget)
 history+=moves;runs.append(dict(opt.LAST_SEARCH))
 result={'owner':owner,'history':history,'score':float(fast_score(owner)), 'search_runs':runs,'supplied_score':base['score']}
 (root/'improved_solution.json').write_text(json.dumps(result,indent=2))
 print('SAVED',result['score'],runs,flush=True)
