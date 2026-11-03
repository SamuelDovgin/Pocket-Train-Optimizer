from advanced_optimize import *
base=json.load(open(str(Path(__file__).resolve().parent)+'/advanced_greedy.json'))
print('BASE',base['score'],flush=True)
o,h=best_greedy(base['owner'],rounds=30,group=2,budget=55)
json.dump({'owner':o,'history':base['history']+h,'score':fast_score(o,40),'extra_moves':len(h)},open(str(Path(__file__).resolve().parent)+'/advanced_pairs.json','w'),indent=2)
print('FINAL',fast_score(o,40),flush=True)
