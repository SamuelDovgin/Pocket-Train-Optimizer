"""Explicit one/two-collector illustrations, still independent of starting owners."""
from dataclasses import asdict
import json
from pathlib import Path
import random
from corridor_search import CorridorSearch, Pressure

root=Path(__file__).resolve().parents[1]
raw=json.loads((root/'analysis/corridor-search.json').read_text());world=json.loads((root/'assets/operating-data.json').read_text());search=CorridorSearch(world)
loops=[('Copenhagen','Oslo','Stockholm','Copenhagen'),('Alice Springs','Broome','Darwin','Alice Springs')]
for count in (1,2):
    key='nordic_loop' if count==1 else 'two_loops'
    w=Pressure(key,'One Nordic collector loop' if count==1 else 'Nordic and Australia collector loops',3.5,22,175,75,30,18,.10,loops=True,access=20)
    for index,base_key in enumerate(('hubs_a','long_runs_b')):
        paths=[tuple(p) for p in raw['candidates'][base_key]['paths']]
        for cycle in loops[:count]:
            paths=search.extract_loop(paths,search.canonical(cycle))
            repaired=[]
            for p in paths:
                if search.valid(p,True):repaired.append(p)
                else:repaired.extend(search.canonical((a,b)) for a,b in zip(p,p[1:]))
            paths=list(search.coalesce(repaired,w,random.Random(261105000+count*10+index)))
        search.validate(paths,False,True)
        cid=key+('_a' if index==0 else '_b')
        raw['candidates'][cid]={'pressure':asdict(w),'paths':paths,'metrics':search.metrics(paths,w),'illustration_base':base_key,'required_local_loops':loops[:count]}
raw['loop_illustrations']='One/two standalone collectors are explicit comparison variants; no starting owners or long spines were used.'
(root/'analysis/corridor-search.json').write_text(json.dumps(raw,indent=2))
print('Added four one/two-loop illustrations')
