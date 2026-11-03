const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const Map=require('../assets/world-map-core.js'),read=p=>JSON.parse(fs.readFileSync(p));
const D=read('analysis/world_tracker_data.json'),R=read('analysis/deep_results.json'),cities=read('assets/map/cities.json'),land=read('assets/map/land.json');
function svg(profile='consolidated',options={}){return Map.renderSVG(D,cities,land,R.profiles[profile].owner,options)}
const unescape=s=>s.replace(/&amp;/g,'&').replace(/&apos;|&#39;/g,"'").replace(/&quot;/g,'"');
test('every supplied station has a finite geographic display position',()=>{
 assert.deepEqual(Object.keys(cities).sort(),Object.keys(D.regions).sort());
 const project=Map.projection({x:0,y:0,w:100,h:100},[-180,-58,180,76]);
 for(const position of Object.values(cities)){assert.equal(position.length,2);assert.ok(position.every(Number.isFinite));const [x,y]=project(position);assert.ok(x>=0&&x<=100&&y>=0&&y<=100)}
});
test('each complete target draws all 190 unique physical tracks with its exact owner and color',()=>{
 for(const [name,p] of Object.entries(R.profiles)){
  const output=svg(name),tracks=[...output.matchAll(/data-map-edge="([^"]+)" data-map-owner="([^"]+)"/g)].map(m=>[unescape(m[1]),unescape(m[2])]);
  assert.equal(tracks.length,190);assert.equal(new Set(tracks.map(x=>x[0])).size,190);assert.deepEqual(Object.fromEntries(tracks),p.owner);
  const legend=[...output.matchAll(/data-legend-owner="([^"]+)"/g)].map(m=>unescape(m[1]));assert.equal(legend.length,p.line_count);assert.deepEqual(new Set(legend),new Set(Object.values(p.owner)));
  for(const line of D.lines.filter(l=>legend.includes(l.name)))assert.ok(output.includes('stroke="'+line.color+'"'));
 }
});
test('all 139 city labels appear once, with European labels in the enlarged inset',()=>{
 const output=svg(),labels=[...output.matchAll(/data-city-label="([^"]+)"/g)].map(m=>unescape(m[1]));assert.deepEqual(labels.sort(),Object.keys(cities).sort());
 assert.equal((output.match(/data-map-city=/g)||[]).length,139);
 const world=output.slice(0,output.indexOf('<g clip-path="url(#europe-clip)"'));
 assert.equal((world.match(/data-city-label=/g)||[]).length,Object.values(D.regions).filter(r=>r!=='Europe').length);
 assert.ok(!/NaN|Infinity|undefined/.test(output));
});
test('recommended image stays in sync with the optimized owner assignments',()=>{
 const p=R.profiles.consolidated,expected=Map.renderSVG(D,cities,land,p.owner,{subtitle:`139 cities · 190 tracks · ${p.line_count} active railroad owners · ${p.summary['40'].mean_score.toFixed(3)} modeled routing effort`}),actual=fs.readFileSync('assets/map/proposed-completed-world.svg','utf8');assert.equal(actual,expected);
 const meta=read('assets/map/image-metadata.json'),png=fs.readFileSync('assets/map/proposed-completed-world.png'),sha=data=>crypto.createHash('sha256').update(data).digest('hex');
 assert.equal(sha(actual),meta.svg_sha256);assert.equal(sha(png),meta.png_sha256);assert.equal(png.readUInt32BE(16),5200);assert.equal(png.readUInt32BE(20),3900);
});
test('highlighting preserves every track, city and stored assignment',()=>{
 const p=R.profiles.consolidated,before=JSON.stringify(p.owner),output=svg('consolidated',{focus:'Blue',labels:false,title:'A & B <target>'});assert.equal((output.match(/data-map-edge=/g)||[]).length,190);assert.equal((output.match(/data-map-city=/g)||[]).length,139);assert.equal((output.match(/data-city-label=/g)||[]).length,0);assert.ok(output.includes('A &amp; B &lt;target&gt;'));assert.equal(JSON.stringify(p.owner),before);
 assert.throws(()=>Map.renderSVG(D,{...cities,Paris:null},land,p.owner),/Missing map position/);assert.throws(()=>Map.renderSVG(D,cities,land,{...p.owner,'Milan|Rome':'not a railroad'}),/Missing map owner/);
});
