"""Embed reproducible model output; no runtime fetches needed on GitHub Pages."""
import json,re,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'analysis'))
from model_pocket_trains import paths
p=root/'index.html';html=p.read_text()
graph=json.loads((root/'analysis/graph_theory_results.json').read_text())
eff=json.loads(re.search(r'<script id="efficiency-data" type="application/json">(.*?)</script>',html,re.S).group(1))
for penalty in (0,20,40,80):
 for old,new in [('baseline','original'),('refined','refined')]:eff['results'][str(penalty)][old]=graph['summary'][new][str(penalty)]
for id,data in [('graph-data',graph),('efficiency-data',eff),('world-data',json.loads((root/'analysis/world_tracker_data.json').read_text()))]:
 payload=json.dumps(data,separators=(',',':')).replace('<','\\u003c')
 html=re.sub(r'(<script id="'+id+r'" type="application/json">).*?(</script>)',lambda m:m[1]+payload+m[2],html,flags=re.S)
p.write_text(html)
