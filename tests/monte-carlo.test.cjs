const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const MC=require('../assets/monte-carlo-core.js'),Core=require('../assets/core.js');
const data=JSON.parse(fs.readFileSync('assets/monte-carlo-costs.json')),report=JSON.parse(fs.readFileSync('analysis/monte_carlo_validation.json'));
test('browser Monte Carlo is reproducible, paired and read-only',()=>{
 const before=JSON.stringify(data),options={seed:103,batches:15,jobs:100,scenario:'global',sigma:1.5};let ticks=0;
 const a=MC.sampleDemand(data,options,()=>ticks++),b=MC.sampleDemand(data,options);
 assert.deepEqual(a,b);assert.ok(ticks>0);assert.equal(JSON.stringify(data),before);assert.equal(a.sampled_jobs,1500);
 for(const v of Object.values(a.results)){assert.ok(Number.isFinite(v.mean_gain));assert.ok(v.simulation_interval_90[0]<=v.median_gain);assert.ok(v.simulation_interval_90[1]>=v.median_gain)}
});
test('identical plans give zero paired gain under every demand mix',()=>{
 const copy={...data,comparisons:{same:{before:'after_fixed',after:'after_fixed'}}};
 for(const scenario of ['uniform','local','global','shorthaul','longhaul']){const r=MC.sampleDemand(copy,{seed:1,batches:10,jobs:20,scenario,sigma:.75}).results.same;assert.equal(r.mean_gain,0);assert.equal(r.fraction_tied,1);assert.equal(r.fraction_lower_cost,0)}
});
test('invalid Monte Carlo settings fail before sampling',()=>{
 for(const options of [{seed:-1},{seed:1.5},{batches:0},{jobs:2001},{scenario:'bad'},{sigma:2}])assert.throws(()=>MC.sampleDemand(data,options),/Invalid/);
});
test('every browser cost vector matches the published nominal score',()=>{
 assert.equal(data.pair_a.length,9591);assert.equal(data.pair_b.length,9591);assert.equal(data.city_regions.length,139);
 for(const [name,costs] of Object.entries(data.costs)){assert.equal(costs.length,9591);assert.ok(costs.every(Number.isFinite));assert.ok(Math.abs(costs.reduce((a,b)=>a+b,0)/9591-report.nominal_scores[name])<1e-9)}
 const html=fs.readFileSync('index.html','utf8');assert.deepEqual(JSON.parse(html.match(/<script id="monte-carlo-data" type="application\/json">(.*?)<\/script>/s)[1]),report);
 assert.equal(report.stability.stable,true);assert.equal(report.stability.campaigns.at(-1).no_improvement,true);
});
test('changed saved ownership does not inherit a reference-owner timing benefit',()=>{
 const D=JSON.parse(fs.readFileSync('analysis/world_tracker_data.json')),R=JSON.parse(fs.readFileSync('analysis/deep_results.json')),p=R.profiles.consolidated;
 const rule=p.correction_schedule[0];assert.ok(rule);const state=Core.sanitizeSave({done:{},owners:{}},D);
 // Use an actual saved owner other than either the reference or target.
 const different=D.lines.find(l=>l.name!==rule.from&&l.name!==rule.to).name;
 for(const id of rule.track_ids)state.owners[id]=different;
 const q=Core.buildQueue(D,state,e=>state.owners[e.id]||e.owner,p.owner,p.correction_schedule),step=q.find(x=>x.kind==='reassign'&&x.trackIds.includes(rule.track_ids[0]));
 assert.ok(step);assert.equal(step.timing.minimum_stage,null);assert.match(step.timing.timing_reason,/saved|reference|unverified/i);
});
