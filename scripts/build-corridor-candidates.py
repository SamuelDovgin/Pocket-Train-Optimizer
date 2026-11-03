"""Export clean-slate search candidates; no label matching to current owners."""
from pathlib import Path
import colorsys
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


def export_plans(edges, candidates, city_count):
    by_id = {e['id']: e for e in edges}
    plans = {}
    for key, item in candidates.items():
        owners, lines = {}, []
        for i, path in enumerate(sorted(item['paths'])):
            name = 'R'+str(i+1).zfill(2)
            ids = ['|'.join(sorted((a,b))) for a,b in zip(path,path[1:])]
            for track in ids:
                owners[track] = name
            loop = path[0] == path[-1]
            r,g,b = colorsys.hls_to_rgb((i*.61803398875) % 1,.66,.70)
            lines.append({'name':name,'color':'#%02x%02x%02x' % (round(r*255),round(g*255),round(b*255)),
                          'kind':'loop' if loop else 'path','path':path,
                          'patrol':path if loop else path+path[-2::-1],
                          'tracks':len(ids),'length':sum(by_id[t]['fuel'] for t in ids),
                          'branches':0,'cycles':int(loop)})
        plans[key] = {'label':item['pressure']['label']+(' · variant A' if key.endswith('_a') else ' · variant B'),
                      'owners':owners,'lines':lines,'fleet':len(lines),'tracks':len(owners),'cities':city_count,
                      'branches':0,'cycles':sum(l['cycles'] for l in lines),
                      'unused_tracks':sorted(set(by_id)-set(owners)), 'initial_changes':[],
                      'pressure':item['pressure'],'metrics':item['metrics'],
                      'notes':'Clean-slate geometry: no initial ownership, protected starting links or preassigned long spines. Loop exceptions are standalone compact cycles only.'}
    return plans


def main():
    base = json.loads((ROOT/'assets/operating-data.json').read_text())
    search = json.loads((ROOT/'analysis/corridor-search.json').read_text())
    edges = [{k: e.get(k) for k in ('id','a','b','fuel','water','cost')} for e in base['edges']]
    plans = export_plans(edges, search['candidates'], len(base['cities']))
    out = {k:base[k] for k in ('cities','regions','coordinates','reward_geometry')}
    out.update({'version':1,'edges':edges,'plans':plans,'search':search,
                'search_code_sha256':hashlib.sha256((ROOT/'scripts/corridor_search.py').read_bytes()).hexdigest(),
                'default_targets':['balanced_a'],
                'interpretation':'Search-pressure candidates on one common 139-city map. Surrogate scores are preference units, not coin payouts. Current configuration excluded from topology selection.'})
    (ROOT/'assets/corridor-data.json').write_text(json.dumps(out,separators=(',',':')))
    print('Exported',len(plans),'clean-slate candidates')


if __name__ == '__main__':main()
