from model_pocket_trains import *
from collections import defaultdict
import json,random,time,sys
OUT=str(Path(__file__).resolve().parent)
old=json.load(open(OUT+'/pocket_trains_efficiency_results.json'))
start=old['optimized']
FIXED=set(D['base']+D['done']); EIDS=list(ED); LINE_NAMES=sorted({x['owner'] for x in EDGES})
line_trackcounts={l:sum(v==l for v in start.values()) for l in LINE_NAMES}
line_sum={l:sum(F(ED[k]) for k,v in start.items() if v==l) for l in LINE_NAMES}

def possible(owner,groupsize=1,cap=1100):
    # generate single-edge moves and multi-edge connected pairs
    nodes=defaultdict(set); segments=defaultdict(list); es_at_node=defaultdict(list)
    for k,l in owner.items():
        e=ED[k]
        for c in (e['a'],e['b']):nodes[l].add(c);es_at_node[c].append(k)
        segments[l].append(k)
    for l in LINE_NAMES:
        segs=[k for k in segments[l] if k not in FIXED]
        group_set=set((k,) for k in segs)
        if groupsize>=2:
            for k in segs:
                ee=ED[k]
                for c in (ee['a'],ee['b']):
                    for kk in es_at_node[c]:
                        if kk in FIXED or owner[kk]!=l or kk==k:continue
                        group_set.add(tuple(sorted([k,kk])))
        if groupsize>=3:
            # only endpoint-attached connected triples. Limit candidates
            valid2=[g for g in group_set if len(g)==2]
            for g in valid2:
                n2=set()
                for k in g:n2|={ED[k]['a'],ED[k]['b']}
                for c in n2:
                    for kk in es_at_node[c]:
                        if kk in FIXED or owner[kk]!=l or kk in g:continue
                        group_set.add(tuple(sorted([*g,kk])))
        for g in sorted(group_set, key=lambda a:(len(a),a)):
            if len(segments[l])-len(g)<1:continue
            gsum=sum(F(ED[k]) for k in g)
            trial={**owner,**{k:'__removed__' for k in g}}
            if not connected_owner(trial,l):continue
            endpoints=set()
            for k in g:endpoints.update((ED[k]['a'],ED[k]['b']))
            target=set(owner[k] for c in endpoints for k in es_at_node[c])- {l}
            for new in sorted(target):
                # precompute length from input owner, not start
                if sum(F(ED[k]) for k in segments[new])+gsum>cap:continue
                proposal={**owner,**{k:new for k in g}}
                if connected_owner(proposal,new):yield g,l,new,proposal

LAST_SEARCH = {}

def best_greedy(owner, rounds=35, group=1, budget=110):
    """Deterministic improving moves; report whether the neighborhood was exhausted."""
    global LAST_SEARCH
    owner = owner.copy()
    t0 = time.monotonic()
    hist = []
    reason = 'round_limit'
    for it in range(rounds):
        before = fast_score(owner, 40)
        best = (before, None)
        tested = 0
        exhausted = True
        for g, old, new, prop in possible(owner, groupsize=group):
            if time.monotonic() - t0 >= budget:
                exhausted = False
                break
            score = fast_score(prop, 40)
            tested += 1
            if score < best[0] - 1e-6:
                best = (score, (g, old, new, prop))
        if best[1] is None:
            reason = 'local_optimum' if exhausted else 'time_budget'
            print(reason.upper(), group, it, round(before, 5), 'proposals', tested, flush=True)
            break
        score, (g, old, new, owner) = best
        hist.append({'track_ids': list(g), 'from': old, 'to': new,
                     'before': float(before), 'after': float(score), 'neighborhood_complete': exhausted})
        print('ITER', it + 1, 'score', round(score, 4), 'edges', g, old, '=>', new,
              'proposals', tested, 'seconds', round(time.monotonic() - t0, 1), flush=True)
        if not exhausted:
            reason = 'time_budget'
            break
    LAST_SEARCH.update({'termination': reason, 'group_size': group, 'moves': len(hist),
                        'elapsed_seconds': round(time.monotonic() - t0, 2)})
    return owner, hist

if __name__=='__main__':
    print('START',fast_score(start,40),flush=True)
    o,h=best_greedy(start,rounds=60,group=1,budget=65)
    with open(OUT+'/advanced_greedy.json','w') as f:json.dump({'owner':o,'history':h,'score':fast_score(o)},f,indent=2)
