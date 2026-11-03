/* Exact track connectivity; approximate geographic positions are visual only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainWorldMapCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const WIDTH=2600,HEIGHT=1950;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const f=n=>Number(n.toFixed(2));
function projection(box,bounds){const [west,south,east,north]=bounds,merc=lat=>Math.log(Math.tan(Math.PI/4+Math.max(-84,Math.min(84,lat))*Math.PI/360)),top=merc(north),bottom=merc(south);return ([lon,lat])=>[box.x+(lon-west)/(east-west)*box.w,box.y+(top-merc(lat))/(top-bottom)*box.h]}
function landPath(land,project){let result='';for(const feature of land.features){const geometry=feature.geometry,polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];for(const polygon of polygons)for(const ring of polygon){result+=ring.map((p,i)=>{const [x,y]=project(p);return (i?'L':'M')+f(x)+','+f(y)}).join('')+'Z'}}return result}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function labelLayout(names,points,box,size){
 const taken=[],nodeBoxes=Object.values(points).map(([x,y])=>({x:x-7,y:y-7,w:14,h:14})),out=[];
 // Dense stations go first; the deterministic greedy pass keeps all labels.
 const ordered=[...names].sort((a,b)=>{const density=c=>Object.values(points).filter(([x,y])=>Math.hypot(x-points[c][0],y-points[c][1])<90).length;return density(b)-density(a)||a.localeCompare(b)});
 for(const name of ordered){const [cx,cy]=points[name],w=name.length*size*.57+7,h=size+5,candidates=[];
  for(const radius of [11,26,44,66,90,120])for(const side of [1,-1])for(const dy of [-.65,.65,-1.8,1.8]){const x=side===1?cx+radius:cx-radius-w,y=cy+dy*radius-h*.5;candidates.push({x,y,w,h,cost:radius+Math.abs(dy)*2})}
  for(const rect of candidates){rect.cost+=taken.filter(t=>overlap(rect,t)).length*100000;rect.cost+=nodeBoxes.filter(t=>overlap(rect,t)).length*10000;if(rect.x<box.x+4||rect.x+w>box.x+box.w-4||rect.y<box.y+3||rect.y+h>box.y+box.h-3)rect.cost+=1000000}
  const rect=candidates.reduce((a,b)=>a.cost<=b.cost?a:b);taken.push(rect);out.push({name,cx,cy,...rect});
 }
 return out;
}
function renderSVG(D,cities,land,owners,options={}){
 const allCities=Object.keys(D.regions).sort();for(const city of allCities)if(!cities[city]||cities[city].length!==2||!cities[city].every(Number.isFinite))throw Error('Missing map position: '+city);
 const lineNames=new Set(D.lines.map(l=>l.name));for(const e of D.edges)if(!lineNames.has(owners[e.id]))throw Error('Missing map owner: '+e.id);
 const lines=D.lines.filter(l=>D.edges.some(e=>owners[e.id]===l.name)),ids=new Map(lines.map((l,i)=>[l.name,String(i+1).padStart(2,'0')])),colors=new Map(lines.map(l=>[l.name,l.color]));
 const world={x:65,y:170,w:2470,h:1020},eu={x:75,y:1350,w:1110,h:465},worldProject=projection(world,[-180,-58,180,76]),euProject=projection(eu,[-26,35,49,68]);
 const worldPoints=Object.fromEntries(allCities.map(c=>[c,worldProject(cities[c])])),euNames=allCities.filter(c=>D.regions[c]==='Europe'),euPoints=Object.fromEntries(euNames.map(c=>[c,euProject(cities[c])]));
 const title=options.title||(D.edges.length===190?'HISTORICAL ROUTING TARGET · 190 LINKS':'EXPERIMENTAL TRAIN SERVICE PLAN'),subtitle=options.subtitle||`${allCities.length} cities · ${D.edges.length} tracks · ${lines.length} active railroad owners`;
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" role="img" aria-labelledby="map-title map-desc"><title id="map-title">${esc(title)}</title><desc id="map-desc">Every supplied city and track, colored by final proposed railroad owner. Europe is enlarged below. Geographic positions are approximate; track distances come from the optimizer, not this drawing.</desc><defs><clipPath id="world-clip"><rect x="45" y="155" width="2510" height="1055" rx="20"/></clipPath><clipPath id="europe-clip"><rect x="45" y="1240" width="1170" height="620" rx="20"/></clipPath></defs><style>text{font-family:Arial,Helvetica,sans-serif;fill:#e7eff4}.station-label{stroke:none;fill:#e7eff4;font-weight:500}.map-track{stroke-linecap:round;stroke-linejoin:round}.leader{stroke:#728b99;stroke-width:1;opacity:.7}.badge{font-weight:700;text-anchor:middle;dominant-baseline:central}</style><rect width="2600" height="1950" fill="#08131e"/><text x="65" y="77" font-size="42" font-weight="700">${esc(title)}</text><text x="67" y="118" font-size="23" fill="#a9c0cf">${esc(subtitle)}</text><rect x="45" y="155" width="2510" height="1055" rx="20" fill="#0c1d2b" stroke="#294553" stroke-width="2"/>`;
 function panel(project,points,names,box,inset){
  const clip=inset?'europe-clip':'world-clip',size=inset?19:17;
  let s=`<g clip-path="url(#${clip})"><path d="${landPath(land,project)}" fill="#19313c" stroke="#36525d" stroke-width="1" fill-rule="evenodd"/>`;
  if(!inset){for(const [name,lon,lat] of [['NORTH AMERICA',-110,43],['SOUTH AMERICA',-59,-19],['AFRICA',19,8],['ASIA',88,49],['OCEANIA',136,-26]]){const [x,y]=project([lon,lat]);s+=`<text x="${f(x)}" y="${f(y)}" text-anchor="middle" font-size="28" font-weight="700" opacity=".18" letter-spacing="5">${name}</text>`}}
  const edges=D.edges.filter(e=>!inset||(euPoints[e.a]&&euPoints[e.b]));
  for(const e of edges){const a=points[e.a],b=points[e.b],name=owners[e.id],dim=options.focus&&options.focus!==name,attribute=inset?'data-map-mirror':'data-map-edge';s+=`<g ${attribute}="${esc(e.id)}" data-map-owner="${esc(name)}" opacity="${dim ? .13 : 1}"><title>${esc(e.a)} ↔ ${esc(e.b)} · ${ids.get(name)} ${esc(name)}${e.water?' · sea crossing':''}</title><path d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" fill="none" stroke="#08131e" stroke-width="${inset?13:10}"/><path class="map-track" d="M${f(a[0])},${f(a[1])}L${f(b[0])},${f(b[1])}" fill="none" stroke="${colors.get(name)}" stroke-width="${inset?7:5.5}" ${e.water?'stroke-dasharray="13 8"':''}/></g>`}
  for(const name of names){const [x,y]=points[name];s+=`<circle ${inset?'data-inset-city':'data-map-city'}="${esc(name)}" cx="${f(x)}" cy="${f(y)}" r="${inset?5.5:4.5}" fill="#0a1824" stroke="#ebf4f8" stroke-width="2"><title>${esc(name)}</title></circle>`}
  const labels=labelLayout(names.filter(c=>inset||D.regions[c]!=='Europe'),points,box,size);
  if(options.labels!==false)for(const l of labels){const tx=l.x+3,ty=l.y+size,nearX=Math.max(l.x,Math.min(l.cx,l.x+l.w)),nearY=Math.max(l.y,Math.min(l.cy,l.y+l.h));s+=`<path class="leader" d="M${f(l.cx)},${f(l.cy)}L${f(nearX)},${f(nearY)}"/><text aria-hidden="true" x="${f(tx)}" y="${f(ty)}" font-size="${size}" style="fill:#0b1824;stroke:#0b1824;stroke-width:5px;stroke-linejoin:round">${esc(l.name)}</text><text class="station-label" data-city-label="${esc(l.name)}" x="${f(tx)}" y="${f(ty)}" font-size="${size}">${esc(l.name)}</text>`}
  // Number each owner as well as coloring it, so similar shades remain identifiable.
  for(const l of lines){const mine=edges.filter(e=>owners[e.id]===l.name);if(!mine.length)continue;if(!inset&&mine.every(e=>euPoints[e.a]&&euPoints[e.b]))continue;
   const candidates=mine.map(e=>({x:(points[e.a][0]+points[e.b][0])/2,y:(points[e.a][1]+points[e.b][1])/2}));
   const candidate=candidates.reduce((a,b)=>{const score=p=>labels.filter(r=>overlap({x:p.x-14,y:p.y-11,w:28,h:22},r)).length;return score(a)<=score(b)?a:b});
   s+=`<g opacity="${options.focus&&options.focus!==l.name ? .15 : 1}"><rect x="${f(candidate.x-15)}" y="${f(candidate.y-11)}" width="30" height="23" rx="7" fill="#091521" stroke="${l.color}" stroke-width="2"/><text class="badge" x="${f(candidate.x)}" y="${f(candidate.y+1)}" font-size="14">${ids.get(l.name)}</text></g>`;
  }
  return s+'</g>';
 }
 svg+=panel(worldProject,worldPoints,allCities,world,false);
 const cornerA=worldProject([-26,68]),cornerB=worldProject([49,35]);svg+=`<rect x="${f(cornerA[0]-10)}" y="${f(cornerA[1]-10)}" width="${f(cornerB[0]-cornerA[0]+20)}" height="${f(cornerB[1]-cornerA[1]+20)}" rx="12" fill="none" stroke="#9ab9c5" stroke-dasharray="5 7" opacity=".7"/><text x="${f(cornerA[0]+5)}" y="${f(cornerB[1]+35)}" font-size="17" fill="#aec8d1">Europe detail below ↓</text><rect x="45" y="1240" width="1170" height="620" rx="20" fill="#0c1d2b" stroke="#294553" stroke-width="2"/>`;
 svg+=panel(euProject,euPoints,euNames,eu,true)+`<text x="75" y="1293" font-size="28" font-weight="700">EUROPE · ENLARGED</text><text x="75" y="1324" font-size="17" fill="#abc2cd">Same final colors and connections; all European station labels appear here.</text><rect x="1240" y="1240" width="1315" height="620" rx="20" fill="#101f2c" stroke="#294553" stroke-width="2"/><text x="1275" y="1293" font-size="28" font-weight="700">FINAL RAILROAD OWNERS · ${lines.length}</text><text x="1275" y="1324" font-size="17" fill="#abc2cd">Colors match your tracker. Numbers identify similar shades. Names are reusable labels.</text>`;
 const rows=Math.ceil(lines.length/4),spacing=Math.min(64,420/rows);
 lines.forEach((l,i)=>{const col=Math.floor(i/rows),row=i%rows,x=1275+col*312,y=1370+row*spacing,count=D.edges.filter(e=>owners[e.id]===l.name).length;svg+=`<g data-legend-owner="${esc(l.name)}"><path d="M${x},${y}h39" stroke="${l.color}" stroke-width="7" stroke-linecap="round"/><text x="${x+50}" y="${y+6}" font-size="19" font-weight="600">${ids.get(l.name)} ${esc(l.name)}</text><text x="${x+50}" y="${y+29}" font-size="15" fill="#a7bdc8">${count} track${count===1?'':'s'}</text></g>`});
 svg+=`<path d="M1278,1813h52" stroke="#a9d5e5" stroke-width="5"/><text x="1343" y="1819" font-size="17">Land</text><path d="M1440,1813h64" stroke="#a9d5e5" stroke-width="5" stroke-dasharray="13 8"/><text x="1519" y="1819" font-size="17">Sea crossing</text><circle cx="1775" cy="1813" r="5" fill="#0a1824" stroke="#ebf4f8" stroke-width="2"/><text x="1790" y="1819" font-size="17">Station</text><text x="65" y="1900" font-size="18" fill="#b6cbd5">${D.edges.length===190?'Input audit: this historical 190-link map omits Nairobi–Zanzibar. See Operating simulator for the 191-link experiment; this is not a profit recommendation.':'Experimental service routes: colors show modeled train assignments, not current purchases or verified construction instructions.'}</text><text x="65" y="1929" font-size="16" fill="#8faab8">Approximate geographic diagram, not the game screenshot or a distance scale. Land: Natural Earth (public domain). samueldovgin.github.io/Pocket-Train-Optimizer/</text></svg>`;
 return svg;
}
return {WIDTH,HEIGHT,projection,labelLayout,renderSVG};
});
