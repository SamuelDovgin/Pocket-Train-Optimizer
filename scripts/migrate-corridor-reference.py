"""Work backward only AFTER geometry selection; public reference, not a fresh save."""
from collections import defaultdict
import importlib.util
import json
from pathlib import Path

import networkx as nx

ROOT=Path(__file__).resolve().parents[1]
HELPER=ROOT/'.agents/skills/pocket-trains-route-coach/scripts/review_configuration.py'
spec=importlib.util.spec_from_file_location('route_coach',HELPER);coach=importlib.util.module_from_spec(spec);spec.loader.exec_module(coach)


def main():
    D=json.loads((ROOT/'assets/corridor-data.json').read_text());R=json.loads((ROOT/'analysis/corridor-results.json').read_text())
    key=R['selection']['recommendation'];plan=D['plans'][key]
    # This is intentionally the first stage that loads the reference starting state.
    H=json.loads((ROOT/'analysis/world_tracker_data.json').read_text());refs={e['id']:e for e in H['edges']}
    built={k:refs[k]['owner'] for k in H['base']+H['done']}
    snapshot={'schema':coach.SCHEMA,'coverage':'complete','licenses':['Europe'],
              'notes':'Public repository reference of 15 tracks, NOT a newly submitted player export.',
              'tracks':[{'a':refs[k]['a'],'b':refs[k]['b'],'railroad':owner} for k,owner in built.items()]}
    structural=coach.review(snapshot,D,H,[key])
    by_id={e['id']:e for e in D['edges']};extra=sorted(set(built)-set(plan['owners']))
    # Keep built-but-unused links on separate simple feeder/holding routes. Never delete them.
    feeders=[(by_id[k]['a'],by_id[k]['b']) for k in extra]
    merged=True
    while merged:
        merged=False
        for i,a in enumerate(feeders):
            for j,b in enumerate(feeders[:i]):
                common=set(a)&set(b)
                if len(common)!=1:continue
                c=next(iter(common))
                if c not in (a[0],a[-1]) or c not in (b[0],b[-1]):continue
                aa=a if a[-1]==c else a[::-1];bb=b if b[0]==c else b[::-1]
                feeders[j]=aa+bb[1:];feeders.pop(i);merged=True;break
            if merged:break
    goals=dict(plan['owners']);feeder_rows=[]
    for i,path in enumerate(feeders):
        name='F'+str(i+1).zfill(2)
        for a,b in zip(path,path[1:]):goals[coach.edge_id(a,b)]=name
        feeder_rows.append({'id':name,'path':path,'purpose':'Retained built link outside the optimized operating graph; extra feeder/holding engine may be needed'})
    tracks=[{**by_id[k],'railroad':owner} for k,owner in built.items()]
    aliases,_=coach.match_labels(tracks,{'owners':goals})
    goal_display={k:aliases.get(name,name) for k,name in goals.items()}
    owners=dict(built);licenses={'Europe'};steps=[]
    def mine(owner,omit=None):return [by_id[k] for k,v in owners.items() if v==owner and k!=omit]
    def attaches(edge,owner):
        current=mine(owner)
        return not current or bool({edge['a'],edge['b']} & set(coach.graph(current)))
    def available(edge):return {D['regions'][edge['a']],D['regions'][edge['b']]}<=licenses
    def check():
        for owner in set(owners.values()):
            if not coach.connected(mine(owner)):raise ValueError('Intermediate owner disconnected: '+owner)
    def reclaim_ok(k):
        left=mine(owners[k],k)
        return bool(left) and coach.connected(left) and attaches(by_id[k],goal_display[k]) and available(by_id[k])
    for _ in range(500):
        remaining=[k for k in goals if k not in owners]
        changes=[k for k in owners if owners[k]!=goal_display[k]]
        if not remaining and not changes:break
        nodes=set(coach.graph([by_id[k] for k in owners]))
        candidates=[k for k in remaining if {by_id[k]['a'],by_id[k]['b']} & nodes and attaches(by_id[k],goal_display[k])]
        purchases=[k for k in candidates if available(by_id[k])]
        if purchases:
            k=min(purchases,key=lambda k:(by_id[k]['fuel'],k));owner=goal_display[k]
            first=not mine(owner)
            steps.append({'kind':'BUILD','track':k,'owner':owner,'target_label':goals[k],
                          'needs_engine':first,'price_reference':by_id[k].get('cost'),
                          'checks':['Verify live build/claim prices, engine range and cash']})
            owners[k]=owner;check();continue
        ready=[k for k in changes if reclaim_ok(k)]
        if ready:
            k=min(ready);old=owners[k];new=goal_display[k]
            steps.append({'kind':'CORRECT OWNERSHIP','track':k,'from':old,'to':new,'target_label':goals[k],
                          'reason':'Target connectivity/alignment; no immediate partial-network earnings gain was established',
                          'checks':['Keep the physical track built','Park donor stationary on retained route','Have recipient engine ready','Verify live reclaim fee and cash']})
            owners[k]=new;check();continue
        missing=sorted({D['regions'][c] for k in candidates for c in (by_id[k]['a'],by_id[k]['b'])}-licenses)
        if missing:
            region=missing[0];steps.append({'kind':'LICENSE','region':region,'price_reference':50000,'checks':['Verify live license price and save enough cash']});licenses.add(region);continue
        break
    unresolved=[{'track':k,'current':owners.get(k),'target':goal_display[k]} for k in goals if owners.get(k)!=goal_display[k]]
    for i,step in enumerate(steps):step['order']=i+1
    final_audit=coach.audit([{**by_id[k],'railroad':v} for k,v in owners.items()],D['reward_geometry']['coordinates'])
    if not unresolved and any(row['branch_index'] or row['components']!=1 for row in final_audit):raise ValueError('Final migrated ownership is branched or disconnected')
    result={'version':1,'selection_was_frozen':True,'selected_target':key,
            'basis':'Public reference of 15 owned tracks only; does not read browser saves or assert this is the player’s current game',
            'operating_fleet':plan['fleet'],'starting_tracks':snapshot['tracks'],'extra_feeder_routes':feeder_rows,'target_labels_to_reference_trains':aliases,
            'unused_built_tracks_kept':extra,'steps':steps,'unresolved':unresolved,'structural_sequence_complete':not unresolved,
            'final_owner_audit':final_audit,'reference_review':structural,
            'limitations':'A dry-run connectivity sequence, not measured phase-by-phase profit or verified in-game execution. Prices are historical; fees, engines, positions and cash must be checked. Holding/feeder routes are additional to the optimized operating fleet and were not included in its simulated earnings.'}
    (ROOT/'analysis/corridor-reference-migration.json').write_text(json.dumps(result,indent=2))
    (ROOT/'assets/corridor-reference-migration.json').write_text(json.dumps(result,separators=(',',':')))
    print('Reference migration:',len(steps),'steps;',len(unresolved),'unresolved;',len(feeders),'extra feeder routes')


if __name__=='__main__':main()
