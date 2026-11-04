const fs=require('node:fs'),MapCore=require('../assets/corridor-map-core.js');
const D=require('../assets/corridor-data.json'),R=require('../assets/corridor-results.json');
fs.mkdirSync('assets/corridor-maps',{recursive:true});
const supplemental=new Set(['connected.svg','long-haul.svg','longer-average.svg','balanced-three.svg','final.svg','reference38.svg','reference28.svg']);
for(const file of fs.readdirSync('assets/corridor-maps'))if(/\.(svg|png)$/.test(file)&&!supplemental.has(file))fs.unlinkSync('assets/corridor-maps/'+file);
for(const id of R.selection.display_examples){const p=D.plans[id];fs.writeFileSync(`assets/corridor-maps/${id}.svg`,MapCore.renderSVG(D,p,{title:(id===R.selection.recommendation?'RECOMMENDED TESTED CANDIDATE · ':'')+p.pressure.label}));}
console.log('Built',R.selection.display_examples.length,'complete example maps');
