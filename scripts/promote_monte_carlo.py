"""Promote only complete, feasible, independently audited MC incumbents."""
import json,sys,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];folder=root/'analysis';sys.path.insert(0,str(folder))
import model_pocket_trains as m
import deep_search as d
from monte_carlo_search import valid
stability=json.loads((folder/'monte_carlo_stability.json').read_text())
if not stability['stable']:raise RuntimeError('Finish a whole non-improving campaign before promotion')
archive=folder/'search_campaigns';archive.mkdir(exist_ok=True)
for mode in ['fixed','rework','consolidated']:
 candidate=json.loads((folder/f'monte_carlo_{mode}.json').read_text());owner=d.encode(candidate['owner'])
 if not candidate['complete'] or not candidate['final_audit']['exhausted']:raise ValueError('Unfinished profile')
 if not valid(owner,d.FIXED if mode=='fixed' else frozenset(),38 if mode!='consolidated' else None):raise ValueError('Infeasible profile')
 value=d.score(owner)
 if abs(value-candidate['score'])>1e-8:raise ValueError('Score mismatch')
 count=0
 for trial,_ in d.changes(owner,fixed=d.FIXED if mode=='fixed' else frozenset(),maxgroup=6,swaps=3,merge=mode=='consolidated'):
  if d.score(trial)<value-1e-7:raise ValueError('Incomplete final neighborhood')
  count+=1
 if count!=candidate['final_audit']['candidates_checked']:raise ValueError('Audit candidate count mismatch')
 p=folder/f'deep_{mode}.json';old=json.loads(p.read_text())
 if value>old['score']+1e-8:raise ValueError('Refusing a worse incumbent')
 fingerprint=hashlib.sha256(json.dumps(old,sort_keys=True).encode()).hexdigest()[:12]
 (archive/f'{mode}-before-monte-carlo-{fingerprint}.json').write_text(json.dumps(old,indent=2))
 data={**candidate,'restarts':[],'best_history':[],'evaluations':candidate['cache'],'fixed_initial_owners':mode=='fixed','initial_score':candidate['baseline_score'],'randomized_search':True,'stopping_rule':{**candidate['stopping_rule'],'unit':'annealing epochs'},'initial_owner_changes':[{'track':k,'from':m.ORIGINAL[k],'to':candidate['owner'][k],'original_claim_reference':m.ED[k]['claim']} for k in sorted(set(m.D['base']+m.D['done'])) if candidate['owner'][k]!=m.ORIGINAL[k]]}
 p.write_text(json.dumps(data,indent=2));print('PROMOTED',mode,value,count)
