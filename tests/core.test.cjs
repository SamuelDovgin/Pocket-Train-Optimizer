const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const Core=require('../assets/core.js');
const D=JSON.parse(fs.readFileSync('analysis/world_tracker_data.json'));
const GT=JSON.parse(fs.readFileSync('analysis/graph_theory_results.json'));
const imputed={'Rome|Tripoli':80,'Helsinki|Stockholm':70,'Antananarivo|Zanzibar':130,'Antananarivo|Harare':115,'Cairns|Port Moresby':70,'Amman|Athens':95,'Easter Island|Lima':220,'Cape Town|Porto Alegre':350};
const initial=()=>Core.sanitizeSave({done:{}},D);
for(const plan of ['original','refined','global_heuristic'])test('complete dependency-safe checklist: '+plan,()=>{
 const state=initial(),owner=e=>state.owners[e.id]||GT.owners[plan][e.id];
 assert.deepEqual(Core.auditOwners(D,owner,imputed),[]);
 let count=0;
 while(true){const queue=Core.buildQueue(D,state,owner);if(!queue.length)break;const next=queue[0];assert.deepEqual(next.blocked,[],next.id);if(next.kind==='track')state.owners[next.id]=owner(next);state.done[next.id]=true;assert.ok(++count<=195)}
 assert.equal(count,180);assert.equal(D.edges.filter(e=>state.done[e.id]).length,190);
});
test('restored initial track returns to queue',()=>{const s=initial();s.done[D.base[0]]=false;const q=Core.buildQueue(D,s,e=>e.owner);assert.equal(q.length,181);assert.ok(q.some(x=>x.id===D.base[0]));});
test('invalid imports are sanitized and unknown IDs rejected',()=>{
 const s=Core.sanitizeSave({done:{[D.base[0]]:false,unknown:true},balance:-20,owners:{[D.base[0]]:'invalid'},costs:{[D.base[0]]:-5},notes:{[D.base[0]]:42}},D);
 assert.equal(s.balance,7961);assert.equal(s.done[D.base[0]],false);assert.equal(s.done.unknown,undefined);assert.deepEqual(s.owners,{});assert.deepEqual(s.costs,{});assert.deepEqual(s.notes,{});
 assert.throws(()=>Core.sanitizeSave({done:[]},D));assert.throws(()=>Core.sanitizeSave(null,D));
});
test('same-station route has sections and zero cost',()=>assert.deepEqual(Core.journey(D,imputed,'London','London',e=>e.owner,()=>false,40),{fuel:0,transfers:0,sections:[],score:0}));
test('disconnected or invalid stations and penalties return no route',()=>{
 for(const [a,b,p] of [['London','Tokyo',40],['Invalid','London',40],['London','Rome',-1],['London','Rome',Infinity]])assert.equal(Core.journey(D,imputed,a,b,e=>e.owner,()=>false,p),null);
});
test('zero-penalty ties choose fewer transfers',()=>{
 const d={regions:{A:'X',B:'X',C:'X'},edges:[{id:'ab',a:'A',b:'B',fuel:1,owner:'R'},{id:'bc',a:'B',b:'C',fuel:1,owner:'S'},{id:'ac',a:'A',b:'C',fuel:2,owner:'T'}]};
 const r=Core.journey(d,{},'A','C',e=>e.owner,()=>true,0);assert.equal(r.score,2);assert.equal(r.transfers,0);
});
test('built-only routing obeys progress and manual ownership',()=>{
 const done=new Set([...D.base,...D.done]);const r=Core.journey(D,imputed,'London','Rome',()=> 'custom',e=>done.has(e.id),40);assert.equal(r.transfers,0);assert.equal(r.sections[0].line,'custom');assert.equal(Core.journey(D,imputed,'London','Tokyo',e=>e.owner,e=>done.has(e.id),40),null);
});
test('route reversals preserve scores at each supported penalty',()=>{
 for(const penalty of [0,20,40,80])for(const [a,b] of [['London','Tokyo'],['Sydney','Paris'],['Cape Town','New York']]){
  const owner=e=>GT.owners.global_heuristic[e.id];const r=Core.journey(D,imputed,a,b,owner,()=>true,penalty),rev=Core.journey(D,imputed,b,a,owner,()=>true,penalty);
  assert.equal(r.score,rev.score);assert.equal(r.transfers,rev.transfers);assert.equal(r.score,r.fuel+penalty*r.transfers);
 }
});
test('embedded data matches checked-in model results',()=>{
 const html=fs.readFileSync('index.html','utf8');const embedded=JSON.parse(html.match(/<script id="graph-data" type="application\/json">(.*?)<\/script>/s)[1]);assert.deepEqual(embedded,GT);
});
test('all 9,591 optimized browser-core routes match Python statistics',()=>{
 const cities=Object.keys(D.regions).sort(),totals={score:0,fuel:0,transfers:0};let pairs=0;
 for(let i=0;i<cities.length;i++)for(let j=i+1;j<cities.length;j++){
  const r=Core.journey(D,imputed,cities[i],cities[j],e=>GT.owners.global_heuristic[e.id],()=>true,40);
  assert.ok(r,cities[i]+' to '+cities[j]);pairs++;for(const key of Object.keys(totals))totals[key]+=r[key];
 }
 assert.equal(pairs,9591);const expected=GT.summary.global_heuristic['40'];
 for(const key of Object.keys(totals))assert.ok(Math.abs(totals[key]/pairs-expected['mean_'+key])<1e-9,key);
});
test('version 1 backups migrate legacy city IDs, license and coins',()=>{
 const state=Core.sanitizeSave({version:1,done:{'kyiv-volgograd':true,'asia-license':true},coins:12345},D,'original');
 assert.equal(state.done['Kyiv|Volgograd'],true);assert.equal(state.done['license-asia'],true);assert.equal(state.balance,12345);assert.equal(state.plan,'original');
});
test('version 3 and 4 round-trip preserves progress, owner edits and plan',()=>{
 const legacy=JSON.parse(fs.readFileSync('tests/fixtures/progress-v3.json'));const state=Core.sanitizeSave(legacy,D,'original');assert.equal(state.done['Kyiv|Volgograd'],true);assert.equal(state.balance,12345);
 state.plan='advanced';state.owners['Kyiv|Volgograd']='Pink';state.costs['Kyiv|Volgograd']=5900;state.notes['Kyiv|Volgograd']='Check fuel';
 assert.deepEqual(Core.sanitizeSave(JSON.parse(JSON.stringify({version:4,...state})),D),state);
});
