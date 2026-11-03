from model_pocket_trains import *
from collections import Counter,defaultdict
import json, math, itertools, statistics
R=json.load(open(str(Path(__file__).resolve().parent)+'/pocket_trains_efficiency_results.json'))
solution=Path(__file__).resolve().parent/'improved_solution.json'
A=json.loads((solution if solution.exists() else solution.with_name('advanced_pairs.json')).read_text())
owners={'original':R['baseline'],'refined':R['optimized'],'global_heuristic':A['owner']}

def sample_pairs(O, H=40):
    z=paths(O,H,return_detail=True)
    paircosts=[]
    for a,b,f,t,lb,legs in z['items']:
        ra,rb=D['regions'][a],D['regions'][b]
        same=ra==rb
        paircosts.append((a,b,float(f+t*H),float(f),t,lb,same))
    return paircosts

def score_weighted(p,mode):
    if mode=='uniform':return 1.
    if mode=='local':return 5.0 if p[6] else 1.0
    if mode=='global':return 1.0 if p[6] else 5.0
    if mode=='longhaul':return 4.0 if p[5]>=1100 else 1.0
    if mode=='shorthaul':return 4.0 if p[5]<=450 else 1.0

def group_hubs(O,H=40):
    mat,states=build(O,H,tie_break=True)
    cities=list(CITIES)
    origins=np.array([CI[x] for x in cities]);dests=np.array([CI[x]+N for x in cities]);
    dist,preds=dijkstra(mat,directed=True,indices=origins,return_predecessors=True)
    lookup={v:k for k,v in states.items()};counter=Counter();traffic=Counter()
    for i in range(len(cities)):
        for j in range(i+1,len(cities)):
            node=CI[cities[j]]+N
            while node!=CI[cities[i]]:
                prev=int(preds[i,node]);
                if prev<0:break
                if prev in lookup and node in lookup:
                    c,l=lookup[prev];d,ll=lookup[node]
                    if c==d and l!=ll:counter[c]+=1
                    elif c!=d:traffic[tuple(sorted([c,d]))]+=1
                node=prev
    return counter,traffic

weights={};summary={};hub={};hottracks={};
for name,O in owners.items():
    pairs=sample_pairs(O)
    weights[name]={}
    for mode in ('uniform','local','global','longhaul','shorthaul'):
        w=np.array([score_weighted(p,mode) for p in pairs]);cost=np.array([p[2] for p in pairs]);tf=np.array([p[4] for p in pairs]);fuel=np.array([p[3] for p in pairs])
        weights[name][mode]={'effort':float(np.average(cost,weights=w)),'transfers':float(np.average(tf,weights=w)),'fuel':float(np.average(fuel,weights=w))}
    hs,es=group_hubs(O)
    hub[name]=hs.most_common(35)
    hottracks[name]=[{'id':'|'.join(k), 'jobs':v} for k,v in es.most_common(35)]
    summary[name]={p:{k:v for k,v in paths(O,p).items() if k!='items'} for p in (0,20,40,80)}
    print(name,'weighted',weights[name],flush=True)

# weighted regional ODI recommendations and betweenness physical topology
bet=nx.edge_betweenness_centrality(physical,weight='weight',normalized=True)
centrality=sorted(([{'id':'|'.join(sorted([a,b])),'betweenness':v,'fuel':physical[a][b]['weight']} for (a,b),v in bet.items()]),key=lambda x:x['betweenness'],reverse=True)
art=list(nx.articulation_points(physical))
bridges=['|'.join(sorted(x)) for x in nx.bridges(physical)]
# Which central cities should you give more interchange capacity, based on 9591 hypothetical cargo pairs? hubs visited for handoffs
regions=defaultdict(dict)
for name, h in hub.items():
    for region in set(D['regions'].values()):regions[name][region]=[(c,x) for c,x in h if D['regions'].get(c)==region][:7]
# number of branches as proxy to practical time
complexity={}
for name,O in owners.items():
    lines=[]
    for l in sorted(set(O.values())):
        edges=[ED[k] for k,v in O.items() if v==l]
        degree=Counter()
        for e in edges:degree[e['a']]+=1;degree[e['b']]+=1
        excess=sum(max(0,d-2) for d in degree.values())
        lines.append({'name':l,'length':sum(F(e) for e in edges),'stops':len(degree),'branches':excess,'regions':sorted({D['regions'][c] for c in degree}),'tracks':len(edges)})
    complexity[name]={'total_branch_excess':sum(l['branches'] for l in lines),'n_branched':sum(l['branches']>0 for l in lines),'lines':lines}

out={'meta':{'city_count':N,'track_count':len(EDGES),'pairs':N*(N-1)//2,'fixed_track_count':len(D['base']+D['done']),'max_total_line_fuel':1100,'transfer_cost':40},'owners':owners,'summary':summary,'weights':weights,'hubs':hub,'hottracks':hottracks,'regions':regions,'physical_edge_betweenness':centrality,'articulation_cities':art,'bridge_tracks':bridges,'complexity':complexity,'history':A['history'],'search_runs':A.get('search_runs',[]),'supplied_score':A.get('supplied_score')}
json.dump(out,open(str(Path(__file__).resolve().parent)+'/graph_theory_results.json','w'),indent=2)
print('\nTOP HUB ORIGINAL',hub['original'][:12]);print('TOP HUB ADVANCED',hub['global_heuristic'][:12]);print('TOP CENTRAL TRACKS',centrality[:12]);print('STATS',len(bridges),'physical bridges',len(art),'articulations',flush=True)
