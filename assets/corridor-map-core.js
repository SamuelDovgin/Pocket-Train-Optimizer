/* Reference-game-map geometry; geographic display coordinates are intentionally unused. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./world-map-core.js'):root.TrainWorldMapCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainCorridorMap=api})(typeof globalThis!=='undefined'?globalThis:this,(layout)=>{
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n.toFixed(2)),W=2600,H=2200;
function geometry(data,line){
 const p=line.path,xy=data.reward_geometry.coordinates,loop=p[0]===p.at(-1);let length=0,maxTurn=0;
 for(let i=1;i<p.length;i++)length+=Math.hypot(xy[p[i]][0]-xy[p[i-1]][0],xy[p[i]][1]-xy[p[i-1]][1]);
 for(let i=1;i<p.length-1;i++){const a=xy[p[i-1]],b=xy[p[i]],c=xy[p[i+1]],u=[b[0]-a[0],b[1]-a[1]],v=[c[0]-b[0],c[1]-b[1]],cos=(u[0]*v[0]+u[1]*v[1])/Math.max(1e-9,Math.hypot(...u)*Math.hypot(...v));maxTurn=Math.max(maxTurn,Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI)}
 const a=xy[p[0]],b=xy[p.at(-1)],span=Math.hypot(a[0]-b[0],a[1]-b[1]);return {directness:loop?null:span/length,maxTurn,span,chordLength:length};
}
function renderSVG(data,plan,options={}){
 const coordinates=data.reward_geometry.coordinates,cities=data.cities,eu=cities.filter(c=>data.regions[c]==='Europe'),scale=2470/data.reward_geometry.width;
 const worldPoints=Object.fromEntries(cities.map(c=>[c,[65+coordinates[c][0]*scale,175+coordinates[c][1]*scale]]));
 const xs=eu.map(c=>coordinates[c][0]),ys=eu.map(c=>coordinates[c][1]),minX=Math.min(...xs)-12,minY=Math.min(...ys)-12,dx=Math.max(...xs)-minX+12,dy=Math.max(...ys)-minY+12,s=Math.min(1080/dx,440/dy);
 const euPoints=Object.fromEntries(eu.map(c=>[c,[90+(1080-dx*s)/2+(coordinates[c][0]-minX)*s,1540+(440-dy*s)/2+(coordinates[c][1]-minY)*s]]));
 const lineMap=new Map(plan.lines.map(l=>[l.name,l])),hubCities=new Set((plan.metrics.hubs||[]).filter(h=>h.lines>=3||h.designated).slice(0,12).map(h=>h.city));
 const title=options.title||plan.label,subtitle=`${plan.fleet} trains · ${plan.tracks} selected links · all ${cities.length} cities · no branches · ${plan.cycles} compact loops`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="corridorTitle corridorDesc"><title id="corridorTitle">${esc(title)}</title><desc id="corridorDesc">Clean-slate candidate drawn in approximate reference-game-map geometry. Colored lines are railroad owners; faint lines are available unused connections. Ringed stations are selected multi-line intersections. No current ownership was used to select the routes.</desc><style>text{font-family:Arial,Helvetica,sans-serif;fill:#e6f0f4} .track{stroke-linecap:round;stroke-linejoin:round}</style><rect width="2600" height="2200" fill="#091521"/><text x="65" y="74" font-size="39" font-weight="700">${esc(title)}</text><text x="65" y="120" font-size="23">${esc(subtitle)}</text><rect x="45" y="150" width="2510" height="1270" rx="18" fill="#102432" stroke="#304e5d"/><text x="80" y="205" font-size="19" fill="#9db7c7">REFERENCE GAME-MAP POSITIONS · SCHEMATIC, NOT A GAME SCREENSHOT</text>`;
 function panel(points,names,box,inset){
  const available=data.edges.filter(e=>points[e.a]&&points[e.b]),labels=layout.labelLayout(names.filter(c=>inset||data.regions[c]!=='Europe'),points,box,inset?19:17),badges=[];
  let out='';
  for(const e of available){const a=points[e.a],b=points[e.b],owner=plan.owners[e.id];if(!owner){out+=`<path d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" stroke="#49606c" stroke-width="2" opacity=".28" fill="none"/>`;continue}const l=lineMap.get(owner);out+=`<g ${inset?'data-inset-edge':'data-corridor-edge'}="${esc(e.id)}" data-owner="${esc(owner)}"><title>${esc(e.a)} ↔ ${esc(e.b)} · ${esc(owner)} · ${e.fuel} track-distance</title><path class="track" d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" stroke="#091521" stroke-width="12" fill="none"/><path class="track" d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" stroke="${l.color}" stroke-width="${inset?7:6}" fill="none" ${e.water?'stroke-dasharray="15 8"':''}/></g>`}
  for(const c of names){const [x,y]=points[c];if(hubCities.has(c))out+=`<circle data-hub="${esc(c)}" cx="${f(x)}" cy="${f(y)}" r="11" fill="#102432" stroke="#fff0a5" stroke-width="2.5"/>`;out+=`<circle cx="${f(x)}" cy="${f(y)}" r="4" fill="#091521" stroke="#e4edf2" stroke-width="2"/>`}
  for(const r of labels){const x=f(r.x+3),y=f(r.y+(inset?19:17)),size=inset?19:17;out+=`<path d="M${f(r.cx)},${f(r.cy)}L${f(r.x)},${f(r.y+r.h/2)}" stroke="#627f8e" stroke-width="1"/><text aria-hidden="true" x="${x}" y="${y}" font-size="${size}" style="fill:none;stroke:#102432;stroke-width:4">${esc(r.name)}</text><text data-corridor-city="${esc(r.name)}" x="${x}" y="${y}" font-size="${size}" style="stroke:none">${esc(r.name)}</text>`}

  for(const l of plan.lines){const mine=available.filter(e=>plan.owners[e.id]===l.name);if(!mine.length||(!inset&&mine.every(e=>euPoints[e.a]&&euPoints[e.b])))continue;const candidates=mine.map(e=>({x:(points[e.a][0]+points[e.b][0])/2,y:(points[e.a][1]+points[e.b][1])/2}));const score=p=>labels.filter(r=>Math.abs(p.x-r.x-r.w/2)<r.w/2+18&&Math.abs(p.y-r.y-r.h/2)<r.h/2+15).length*10+badges.filter(r=>Math.hypot(r.x-p.x,r.y-p.y)<40).length*20;const b=candidates.reduce((a,b)=>score(a)<=score(b)?a:b);badges.push(b);out+=`<rect x="${f(b.x-22)}" y="${f(b.y-13)}" width="44" height="26" rx="7" fill="#091521" stroke="${l.color}" stroke-width="2"/><text x="${f(b.x)}" y="${f(b.y+5)}" font-size="16" font-weight="700" text-anchor="middle">${esc(l.name)}</text>`}
  return out;
 }
 svg+=panel(worldPoints,cities,{x:65,y:220,w:2470,h:1170},false);
 svg+=`<rect x="45" y="1450" width="1170" height="600" rx="18" fill="#102432" stroke="#304e5d"/><text x="75" y="1500" font-size="28" font-weight="700">EUROPE · ENLARGED</text>`+panel(euPoints,eu,{x:70,y:1530,w:1120,h:490},true);
 svg+=`<rect x="1240" y="1450" width="1315" height="600" rx="18" fill="#102432" stroke="#304e5d"/><text x="1275" y="1500" font-size="28" font-weight="700">SERVICE ROUTES · ${plan.fleet}</text>`;
 const rows=Math.ceil(plan.lines.length/4),spacing=Math.min(65,430/rows);
 plan.lines.forEach((l,i)=>{const col=Math.floor(i/rows),row=i%rows,x=1275+col*312,y=1540+row*spacing,full=l.kind==='loop'?`${l.path.length-1}-station local loop`:`${l.path[0]} → ${l.path.at(-1)}`,short=full.length>29?full.slice(0,27)+'…':full;svg+=`<path d="M${x},${y}h36" stroke="${l.color}" stroke-width="7"/><text x="${x+46}" y="${y+5}" font-size="18" font-weight="700">${esc(l.name)} · ${l.length}</text><text x="${x+46}" y="${y+25}" font-size="14">${esc(short)}</text>`});
 svg+=`<text x="65" y="2100" font-size="20">Bright rings: selected multi-line intersections. Faint gray: unused links, not demolition instructions. Numbers beside routes: track-distance sum.</text><text x="65" y="2137" font-size="19">Paths ≥85% chord directness, ≤100° turns; optional standalone loops ≤4 stations, ≤260 track-distance, ≤170 reference-image pixels in diameter.</text><text x="65" y="2174" font-size="18" fill="#acc3cf">Approximate diagram geometry and synthetic demand. No verified coin conversion or global optimum. Review migration steps separately.</text></svg>`;
 return svg;
}
return {renderSVG,geometry,WIDTH:W,HEIGHT:H};
});
