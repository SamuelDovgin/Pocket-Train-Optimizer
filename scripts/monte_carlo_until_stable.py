"""Independent multi-profile MC campaigns until a whole campaign makes no gain."""
import json,subprocess,sys,time
from pathlib import Path
root=Path(__file__).resolve().parents[1];folder=root/'analysis';history=folder/'monte_carlo_stability.json';trace=json.loads(history.read_text())['campaigns'] if history.exists() else [];modes=['fixed','rework','consolidated']
def results():return {x:json.loads((folder/f'monte_carlo_{x}.json').read_text())['score'] for x in modes}
cycle=max((x['campaign'] for x in trace),default=0)
while True:
 cycle+=1;before=results();print('MC_CAMPAIGN',cycle,'BEFORE',before,flush=True)
 subprocess.run([sys.executable,'scripts/expand_search_seed.py','--source','monte_carlo_consolidated.json','--output','monte_carlo_expanded_38.json'],cwd=root,check=True)
 processes=[]
 for index,mode in enumerate(modes):
  processes.append(subprocess.Popen([sys.executable,'analysis/monte_carlo_search.py','--mode',mode,'--seed',str(20262000+cycle*10+index)],cwd=root))
 codes=[p.wait() for p in processes]
 if any(c!=0 for c in codes):raise RuntimeError('A randomized search failed; do not publish partial results')
 after=results();stable=all(after[x]>=before[x]-1e-7 for x in modes)
 trace.append({'campaign':cycle,'before':before,'after':after,'no_improvement':stable})
 tmp=folder/'monte_carlo_stability.tmp';tmp.write_text(json.dumps({'stable':stable,'campaigns':trace,'stop':'A complete independent seeded campaign across every profile made no nominal improvement; every profile also stopped after at least 50,000 valid proposals and 25 non-improving epochs plus exact neighborhood audit.'},indent=2));tmp.replace(folder/'monte_carlo_stability.json')
 print('MC_CAMPAIGN',cycle,'AFTER',after,'STABLE',stable,flush=True)
 if stable:break
