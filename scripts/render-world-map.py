"""Optional image authoring dependency: pip install cairosvg.

The site ships the resulting static files and has no runtime Python dependency.
Run build-world-map.cjs first whenever the target or renderer changes.
"""
from pathlib import Path
import hashlib,json
import cairosvg
root=Path(__file__).resolve().parents[1];folder=root/'assets/map';svg=folder/'proposed-completed-world.svg';png=folder/'proposed-completed-world.png'
cairosvg.svg2png(bytestring=svg.read_bytes(),write_to=str(png),output_width=5200,output_height=3900)
metadata={'svg_sha256':hashlib.sha256(svg.read_bytes()).hexdigest(),'png_sha256':hashlib.sha256(png.read_bytes()).hexdigest(),'width':5200,'height':3900,'purpose':'Full proposed completed layout, using the verified consolidated reference owners','geography':'Approximate city locations for display; never used for route distance or optimization','land_source':'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson','land_license':'https://www.naturalearthdata.com/about/terms-of-use/'}
(folder/'image-metadata.json').write_text(json.dumps(metadata,indent=2)+'\n');print('Rendered',png,metadata['width'],metadata['height'])
