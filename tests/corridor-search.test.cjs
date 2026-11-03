const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const D=require('../assets/corridor-data.json'),R=require('../analysis/corridor-results.json'),C=require('../assets/operating-core.js'),MapCore=require('../assets/corridor-map-core.js');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
test('clean-corridor artifacts bind to exact core, search source and candidate data',()=>{
 assert.equal(R.data_sha256,sha(fs.readFileSync('assets/corridor-data.json')));assert.equal(R.core_sha256,sha(fs.readFileSync('assets/operating-core.js')));assert.equal(D.search_code_sha256,sha(fs.readFileSync('scripts/corridor_search.py')));
 assert.deepEqual(require('../analysis/corridor-results.json'),R);assert.equal(D.search.current_configuration_used,false);assert.deepEqual(D.search.protected_reference_tracks,[]);assert.deepEqual(D.search.fixed_spines,[]);
 assert.equal(new Set([...R.policy_seeds,...R.selection_seeds,...R.evaluation_seeds]).size,17);
 for(const p of Object.values(D.plans))C.compile(D,p);
});
test('recommendation and per-pressure finalists depend only on tuning episodes',()=>{
 const utility=id=>Math.exp(Object.keys(R.tuning[id]).reduce((sum,name)=>{const a=R.tuning[id][name],b=R.tuning.reference38[name];return sum+.65*Math.log(a.rewardPerTrain1000Time/b.rewardPerTrain1000Time)+.35*Math.log(a.rewardPerDispatch/b.rewardPerDispatch)},0)/Object.keys(R.tuning[id]).length);
 for(const id of Object.keys(D.plans))assert.ok(Math.abs(utility(id)-R.selection.utilities[id])<1e-10);
 const eligible=R.selection.finalists.filter(id=>!D.plans[id].pressure.full&&D.plans[id].cycles<=R.selection.maximum_recommendation_loops).sort((a,b)=>utility(b)-utility(a));assert.equal(R.selection.recommendation,eligible[0]);assert.deepEqual(D.default_targets,[eligible[0]]);
 assert.equal(R.evaluation_seeds.length,12);assert.equal(Object.keys(R.evaluation).length,8);
 const unique=R.selection.display_examples.map(id=>JSON.stringify(D.plans[id].owners));assert.equal(new Set(unique).size,unique.length);assert.ok(R.selection.display_examples.includes(R.selection.recommendation));
});
test('held-out selected-route service and curves reproduce',()=>{
 const id=R.selection.recommendation,e=R.examples[id],r=C.simulate(C.compile(D,D.plans[id]),e.settings);
 assert.deepEqual(r.curve,e.curve);assert.deepEqual(r.lines,e.lines);
 for(const line of D.plans[id].lines){const g=MapCore.geometry(D,line);if(line.kind!=='loop'){assert.ok(g.directness>=.85-1e-9);assert.ok(g.maxTurn<=100+1e-8)}}
});
test('every published example map contains all labels, exact selected tracks and matching raster assets',()=>{
 const manifest=require('../assets/corridor-maps/manifest.json');
 for(const id of R.selection.display_examples){const p=D.plans[id],svg=fs.readFileSync(`assets/corridor-maps/${id}.svg`,'utf8'),expected=MapCore.renderSVG(D,p,{title:(id===R.selection.recommendation?'RECOMMENDED TESTED CANDIDATE · ':'')+p.pressure.label});assert.equal(svg,expected);assert.equal([...svg.matchAll(/data-corridor-edge="/g)].length,p.tracks);assert.equal([...svg.matchAll(/data-corridor-city="/g)].length,139);for(const l of p.lines)assert.ok(svg.includes(l.color));}
 for(const [file,hash] of Object.entries(manifest.files)){const b=fs.readFileSync('assets/corridor-maps/'+file);assert.equal(sha(b),hash);if(file.endsWith('.png')){assert.equal(b.readUInt32BE(16),file.endsWith('-full.png')?5200:2600);assert.equal(b.readUInt32BE(20),file.endsWith('-full.png')?4400:2200)}}
});
