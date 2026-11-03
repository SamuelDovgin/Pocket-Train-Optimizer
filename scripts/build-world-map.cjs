const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),Map=require('../assets/world-map-core.js');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));
const D=read('analysis/world_tracker_data.json'),report=read('analysis/deep_results.json'),p=report.profiles.consolidated;
const svg=Map.renderSVG(D,read('assets/map/cities.json'),read('assets/map/land.json'),p.owner,{subtitle:`139 cities · 190 tracks · ${p.line_count} active railroad owners · ${p.summary['40'].mean_score.toFixed(3)} modeled routing effort`});
fs.writeFileSync(path.join(root,'assets/map/proposed-completed-world.svg'),svg);console.log('Built recommended completed-world SVG:',p.line_count,'owners');
