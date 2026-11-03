const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const C=require('../assets/operating-core.js'),D=require('../assets/operating-data.json'),R=require('../analysis/operating-results.json');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
test('published operating results bind to the exact simulation core and input',()=>{
 assert.deepEqual(require('../assets/operating-results.json'),R);
 assert.equal(R.core_sha256,sha('assets/operating-core.js'));assert.equal(R.data_sha256,sha('assets/operating-data.json'));
 assert.equal(R.run_count,1488);assert.equal(R.scenario_count,15);
 assert.equal(R.evaluation_seeds.length,12);assert.equal(new Set([...R.training_seeds,...R.evaluation_seeds]).size,14);
 assert.equal(R.training.length,4);for(const t of R.training)assert.equal(t.trials.length,48);
 for(const s of Object.values(R.scenarios)){assert.equal(Object.keys(s.results).length,4);for(const r of Object.values(s.results)){for(const key of ['rewardPer1000Time','carsPer1000Time','meanDeliveryTime'])assert.ok(Number.isFinite(r[key]));for(const key of ['loadFactor','emptyDistanceShare','stationaryShare'])assert.ok(r[key]>=0&&r[key]<=1)}for(const p of Object.values(s.paired)){assert.ok(p.min<=p.mean&&p.mean<=p.max);assert.deepEqual(p.observed_range,[p.min,p.max]);assert.ok(p.fraction_positive>=0&&p.fraction_positive<=1)}}
});
test('held-out example curves and physical train statistics reproduce from their settings',()=>{
 for(const [id,example] of Object.entries(R.examples)){const r=C.simulate(C.compile(D,D.plans[id]),example.settings);assert.deepEqual(r.curve,example.curve);assert.deepEqual(r.lines,example.lines);assert.equal(r.settings.seed,R.evaluation_seeds[0])}
});
test('operating audit preserves the historical graph and publishes rendered model notes',()=>{
 const historical=require('../analysis/world_tracker_data.json');assert.equal(historical.edges.length,190);assert.ok(!historical.edges.some(e=>e.id==='Nairobi|Zanzibar'));assert.equal(D.edges.find(e=>e.id==='Nairobi|Zanzibar').fuel,35);
 assert.equal(Object.keys(D.reward_geometry.coordinates).length,139);assert.deepEqual(D.reward_geometry,require('../assets/map/game-reward-coordinates.json'));
 const notes=fs.readFileSync('docs/operating-model.html','utf8');assert.ok(notes.includes('href="https://samueldovgin.github.io/Pocket-Train-Optimizer/#operations"'));assert.ok(!notes.includes('[Open the operating simulator]'));assert.ok(notes.includes('not calibrated coins/hour or net profit'));
});
