"""Optional authoring step: needs CairoSVG; shipped website needs no Python."""
import hashlib,json
from pathlib import Path
import cairosvg

root=Path(__file__).resolve().parents[1]
report=json.loads((root/'assets/corridor-results.json').read_text())
folder=root/'assets/corridor-maps'
manifest={'width':2600,'height':2200,'full_width':5200,'full_height':4400,'recommendation':report['selection']['recommendation'],'files':{}}
for key in report['selection']['display_examples']:
    svg=folder/(key+'.svg');png=svg.with_suffix('.png')
    cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=2600,output_height=2200)
    for p in (svg,png):manifest['files'][p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
key=report['selection']['recommendation'];svg=folder/(key+'.svg');png=folder/(key+'-full.png')
cairosvg.svg2png(url=str(svg),write_to=str(png),output_width=5200,output_height=4400)
manifest['files'][png.name]=hashlib.sha256(png.read_bytes()).hexdigest()
(folder/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print('Rendered',len(report['selection']['display_examples']),'example maps and a full-resolution recommendation')
