/* Select on tuning episodes, then freeze geometry before fresh held-out tests. */
const fs=require('node:fs'),crypto=require('node:crypto'),C=require('../assets/operating-core.js');
const D=JSON.parse(fs.readFileSync('assets/corridor-data.json')),legacy=require('../assets/operating-data.json');
const references={reference38:legacy.plans.corridors38,reference28:legacy.plans.corridors28};
D.benchmarks=references;
const all={...D.plans,...references},models=Object.fromEntries(Object.entries(all).map(([id,p])=>[id,C.compile(D,p)]));
const policySeeds=[971011,971209],selectionSeeds=[972001,972087,972177],heldoutSeeds=Array.from({length:12},(_,i)=>973017+i*1997);
const configs=[];for(const policy of ['patrol','cargo'])for(const reserveSlots of [1,2])configs.push({policy,reserveSlots,detourLimit:1.75,loadingRule:'corridor',stopPolicy:'express'});
const scenarios={uniform:{horizon:24000,warmup:6000},local:{horizon:24000,warmup:6000,scenario:'local'},global:{horizon:24000,warmup:6000,scenario:'global'},light:{horizon:24000,warmup:6000,offers:4},infrequent:{horizon:24000,warmup:6000,checkInterval:400},long_run:{horizon:64000,warmup:16000},refueling:{horizon:24000,warmup:6000,tank:600,refuelRate:.5},high_capacity:{horizon:24000,warmup:6000,capacity:28}};
const metricKeys=['rewardPer1000Time','rewardPerTrain1000Time','rewardPerDispatch','rewardPerDistance','directDeliveryShare','meanDeliverySpan','meanDeliveryTime','meanTransfers','loadFactor','stationaryShare','emptyDistanceShare','yardCars','dispatches'];
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const summarize=rs=>Object.fromEntries(metricKeys.map(k=>[k,mean(rs.map(r=>r[k]??0))]));
let runCount=0;const trained={},policyTrials={};
for(const [id,m] of Object.entries(models)){
 const trials=configs.map(config=>{const rates=[];for(const seed of policySeeds)for(const scenario of ['uniform','local']){rates.push(C.simulate(m,{...config,seed,scenario}).rewardPer1000Time);runCount++}return {config,mean:mean(rates)}}).sort((a,b)=>b.mean-a.mean);
 trained[id]=trials[0].config;policyTrials[id]=trials;console.log('POLICY',id,JSON.stringify(trained[id]));
}
const tuning={};
for(const id of Object.keys(all)){
 tuning[id]={};for(const [name,options] of Object.entries(scenarios)){const rs=selectionSeeds.map(seed=>{runCount++;return C.simulate(models[id],{...trained[id],...options,seed})});tuning[id][name]=summarize(rs)}
 console.log('TUNED',id);
}
function utility(id){const terms=Object.keys(scenarios).map(name=>{const a=tuning[id][name],b=tuning.reference38[name];return .65*Math.log(Math.max(1e-9,a.rewardPerTrain1000Time/b.rewardPerTrain1000Time))+.35*Math.log(Math.max(1e-9,a.rewardPerDispatch/b.rewardPerDispatch))});return Math.exp(mean(terms))}
const utilities=Object.fromEntries(Object.keys(all).map(id=>[id,utility(id)]));
const pressureKeys=[...new Set(Object.values(D.plans).map(p=>p.pressure.key))];
const finalists=pressureKeys.map(key=>Object.keys(D.plans).filter(id=>D.plans[id].pressure.key===key).sort((a,b)=>utilities[b]-utilities[a])[0]);
const loopExample=Object.keys(D.plans).filter(id=>D.plans[id].cycles>0&&!D.plans[id].pressure.full).sort((a,b)=>utilities[b]-utilities[a])[0];
if(loopExample&&!finalists.includes(loopExample))finalists.push(loopExample);
const recommendation=finalists.filter(id=>!D.plans[id].pressure.full&&D.plans[id].cycles<=2).sort((a,b)=>utilities[b]-utilities[a])[0];
const topologyGroups={};for(const id of finalists){const key=JSON.stringify(D.plans[id].owners);(topologyGroups[key]??=[]).push(id)}
const displayExamples=Object.values(topologyGroups).map(ids=>ids.includes(recommendation)?recommendation:ids[0]);
const selection={maximum_recommendation_loops:2,loop_preference:'Rare small-collector exceptions for the primary recommendation; loop-rich comparisons remain visible',display_examples:displayExamples,topology_groups:Object.values(topologyGroups),stage:'tuning only; frozen before held-out episodes',utility:'Geometric mean across eight settings of (reward per train / reference)^0.65 × (reward per command / reference)^0.35',utility_weights:{per_train:.65,per_command:.35},utilities,finalists,loop_example:loopExample,recommendation};
D.default_targets=[recommendation];D.selection=selection;
const bytes=Buffer.from(JSON.stringify(D));fs.writeFileSync('assets/corridor-data.json',bytes);
console.log('FROZEN',JSON.stringify(selection));
const evaluation={},examples={};
for(const [name,options] of Object.entries(scenarios)){
 const rows={};for(const id of [...finalists,'reference38','reference28']){const rs=heldoutSeeds.map(seed=>{const r=C.simulate(models[id],{...trained[id],...options,seed});runCount++;if(name==='uniform'&&seed===heldoutSeeds[0])examples[id]={settings:r.settings,curve:r.curve,lines:r.lines};return r});rows[id]={mean:summarize(rs),seeds:rs.map(r=>({seed:r.settings.seed,...Object.fromEntries(metricKeys.map(k=>[k,r[k]]))}))}}
 evaluation[name]={options,plans:rows};console.log('HELDOUT',name);
}
const result={version:1,core_sha256:crypto.createHash('sha256').update(fs.readFileSync('assets/operating-core.js')).digest('hex'),data_sha256:crypto.createHash('sha256').update(bytes).digest('hex'),run_count:runCount,policy_seeds:policySeeds,selection_seeds:selectionSeeds,evaluation_seeds:heldoutSeeds,trained,policy_trials:policyTrials,selection,tuning,evaluation,examples,
 interpretation:'Current configuration excluded until topology selection is frozen. Synthetic demand, generic identical trains and approximate game-map payout geometry; preference utility is not a coin bonus or measured net profit. Fleets differ: report total, per-train and per-command rates separately. Held-out results never select the recommendation.'};
fs.writeFileSync('analysis/corridor-results.json',JSON.stringify(result,null,2));fs.writeFileSync('assets/corridor-results.json',JSON.stringify(result));console.log('COMPLETE',runCount,'simulations; selected',recommendation);
