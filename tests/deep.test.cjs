const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const Core=require('../assets/core.js'),Plans=require('../assets/plans.js');
const D=JSON.parse(fs.readFileSync('analysis/world_tracker_data.json')),R=JSON.parse(fs.readFileSync('analysis/deep_results.json'));
const imputed={'Rome|Tripoli':80,'Helsinki|Stockholm':70,'Antananarivo|Zanzibar':130,'Antananarivo|Harare':115,'Cairns|Port Moresby':70,'Amman|Athens':95,'Easter Island|Lima':220,'Cape Town|Porto Alegre':350};
for(const [name,p] of Object.entries(R.profiles))test('full build and correction sequence reaches target: '+name,()=>{
 const state=Core.sanitizeSave({done:{},plan:name},D),actual=e=>state.owners[e.id]||e.owner;
 const owner=e=>state.done[e.id]?actual(e):p.owner[e.id];let purchases=0,changes=0,batches=0;
 assert.deepEqual(Core.auditOwners(D,e=>p.owner[e.id],imputed,{allowEmpty:name==='consolidated'}),[]);
 while(true){const q=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule||[]);if(!q.length)break;const next=q[0];assert.deepEqual(next.blocked,[],JSON.stringify({profile:name,next:next.id,blocked:next.blocked}));
  if(next.kind==='reassign'){const before=D.edges.filter(e=>state.done[e.id]).length;Core.applyCorrection(state,next);assert.equal(D.edges.filter(e=>state.done[e.id]).length,before);changes+=next.trackIds.length;batches++}
  else{if(next.kind==='track')state.owners[next.id]=p.owner[next.id];state.done[next.id]=true;purchases++}
  assert.ok(purchases+batches<210,'queue must terminate');
 }
 assert.equal(purchases,180);assert.equal(changes,p.initial_changes.length);for(const e of D.edges)assert.equal(actual(e),p.owner[e.id],e.id);
});
test('correction batch has a connected claim order and keeps the donor train connected at completion',()=>{
 const p=R.profiles.rework,state=Core.sanitizeSave({done:{}},D),owner=e=>state.done[e.id]?e.owner:p.owner[e.id];
 const q=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule||[]);const batches=q.filter(s=>s.kind==='reassign');assert.ok(batches.length);
 for(const batch of batches){
  const nodes=new Set(D.edges.filter(e=>state.done[e.id]&&e.owner===batch.to).flatMap(e=>[e.a,e.b]));
  for(const e of batch.tracks){if(nodes.size)assert.ok(nodes.has(e.a)||nodes.has(e.b),e.id+' attaches to target');nodes.add(e.a);nodes.add(e.b)}
  assert.match(Plans.correctionHtml(batch,1),/Keep physical tracks built/);assert.match(Plans.correctionHtml(batch,1),/Finish all claims/);
 }
});
test('correction can be undone as a whole without restoring purchases',()=>{
 const historical=JSON.parse(fs.readFileSync('analysis/monte_carlo_baseline.json')).profiles.rework;
 const p={...historical,correction_schedule:[]},state=Core.sanitizeSave({done:{}},D),owner=e=>state.done[e.id]?(state.owners[e.id]||e.owner):p.owner[e.id];
 const batch=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule||[]).find(x=>x.kind==='reassign'&&x.trackIds.length>1);assert.ok(batch);
 const before=JSON.stringify(state.done);Core.applyCorrection(state,batch);for(const id of batch.trackIds)assert.equal(state.owners[id],batch.to);
 Core.undoCorrection(state,0);for(const id of batch.trackIds)assert.equal(state.owners[id],batch.from);
 assert.equal(JSON.stringify(state.done),before);assert.equal(state.corrections.length,0);
});
test('saved correction history and selected rework plan survive export/import',()=>{
 const p=R.profiles.rework,state=Core.sanitizeSave({done:{},plan:'rework'},D),owner=e=>state.done[e.id]?(state.owners[e.id]||e.owner):p.owner[e.id];
 const batch=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule||[]).find(x=>x.kind==='reassign');Core.applyCorrection(state,batch);
 const restored=Core.sanitizeSave(JSON.parse(JSON.stringify({version:5,...state})),D);assert.deepEqual(restored,state);
 assert.equal(Core.buildQueue(D,restored,e=>restored.done[e.id]?(restored.owners[e.id]||e.owner):p.owner[e.id],p.owner).some(x=>x.id===batch.id),false);
});
test('unbuilt tracks never become ownership correction steps',()=>{
 const state=Core.sanitizeSave({done:{}},D);state.done['Berlin|Munich']=false;const p=R.profiles.rework;
 const q=Core.buildQueue(D,state,e=>e.owner,p.owner);assert.ok(q.some(x=>x.kind==='track'&&x.id==='Berlin|Munich'));assert.ok(q.filter(x=>x.kind==='reassign').every(x=>!x.trackIds.includes('Berlin|Munich')));
});
test('all 9,591 routes for each new target match Python results',()=>{
 const cities=Object.keys(D.regions).sort();for(const [name,p] of Object.entries(R.profiles)){
  const sums={fuel:0,transfers:0,score:0};let count=0;
  for(let i=0;i<cities.length;i++)for(let j=i+1;j<cities.length;j++){const r=Core.journey(D,imputed,cities[i],cities[j],e=>p.owner[e.id],()=>true,40);assert.ok(r);count++;for(const k in sums)sums[k]+=r[k]}
  assert.equal(count,9591);for(const k in sums)assert.ok(Math.abs(sums[k]/count-p.summary['40']['mean_'+k])<1e-9,name+'/'+k);
 }
});
test('proposing a plan never mutates recorded ownership or completion',()=>{
 const state=Core.sanitizeSave({done:{},plan:'consolidated'},D);const before=JSON.stringify(state);const target=R.profiles.consolidated;
 const queue=Core.buildQueue(D,state,e=>state.owners[e.id]||e.owner,target.owner,target.correction_schedule);
 assert.ok(queue.some(x=>x.kind==='reassign'));assert.equal(JSON.stringify(state),before);
});
test('gateway corrections stay deferred until their purchase prerequisites are recorded',()=>{
 const p=R.profiles.consolidated,state=Core.sanitizeSave({done:{}},D),owner=e=>state.done[e.id]?(state.owners[e.id]||e.owner):p.owner[e.id];
 let queue=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule);let delayed=queue.find(x=>x.kind==='reassign'&&x.requires.length);
 assert.ok(delayed);assert.ok(delayed.blocked.some(s=>s.startsWith('Timing:')));assert.equal(delayed.cost,null);
 for(const id of delayed.requires){state.done[id]=true;if(p.owner[id])state.owners[id]=p.owner[id]}for(const [id,line] of Object.entries(delayed.ownerPrerequisites||{}))state.owners[id]=line;
 queue=Core.buildQueue(D,state,owner,p.owner,p.correction_schedule);delayed=queue.find(x=>x.id===delayed.id);assert.ok(delayed);assert.ok(delayed.blocked.every(s=>!s.startsWith('Timing:')));
});
test('published deep results match the source and finish a stable cross-seeding cycle',()=>{
 const html=fs.readFileSync('index.html','utf8');const embedded=JSON.parse(html.match(/<script id="deep-data" type="application\/json">(.*?)<\/script>/s)[1]);assert.deepEqual(embedded,R);
 assert.equal(R.cross_seed_audit.stable,true);assert.equal(R.cross_seed_audit.cycles.at(-1).no_improvement,true);
 for(const key of ['rework','consolidated'])assert.equal(R.cross_seed_audit.cycles.at(-1).after[key],R.profiles[key].summary['40'].mean_score);
});
