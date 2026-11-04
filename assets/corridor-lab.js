(async()=>{
'use strict';
const root=document.getElementById('corridorRoot'),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),num=x=>Number(x).toLocaleString('en-US',{maximumFractionDigits:1}),pct=x=>(x*100).toFixed(1)+'%';
try{
 const [D,R,sparseMigration,connected,longHaul,average]=await Promise.all(['corridor-data','corridor-results','corridor-reference-migration','connected-corridors','long-haul-corridors','average-corridors'].map(f=>fetch(`../assets/${f}.json?v=${f==='average-corridors'?'average1':f==='connected-corridors'?'connected1':'clean2'}`).then(r=>{if(!r.ok)throw Error('Could not load '+f);return r.json()})));
 const sparse=R.selection.recommendation;
 const targetPreferenceKey='pocket-trains-corridor-build-target';
 const requestedTarget=new URLSearchParams(location.search).get('target');
 let preferredTarget='connected';
 try{preferredTarget=localStorage.getItem(targetPreferenceKey)||preferredTarget}catch{}
 const useConnected=(requestedTarget||preferredTarget)!=='sparse';
 const rec=useConnected?connected.winner:sparse;
 const M=useConnected?connected.migration:sparseMigration;
 const selectionHash=useConnected?connected.checklist_hash:R.data_sha256;
 D.plans[connected.winner]=connected.plan;
 D.plans[longHaul.winner]=longHaul.plan;
 D.plans[average.winner]=average.plan;
 D.plans[average.balanced.id]=average.balanced.plan;
 const selected=D.plans[rec],examples=R.selection.display_examples,scenarioNames={uniform:'Uniform destinations',local:'Same-region weighted',global:'Cross-region weighted',light:'Light demand',infrequent:'Infrequent check-ins',long_run:'Long run · 64,000 time',refueling:'Generic fuel tank · 600',high_capacity:'High-capacity sensitivity · 28 cars'};
 const allPlans={...D.plans,...D.benchmarks},snapshot=M.reference_review,steps=M.steps,storageKey='pocket-trains-corridor-reference-v1:'+rec+':'+selectionHash.slice(0,12);
 let progress={ack:false,count:0};try{const saved=JSON.parse(localStorage.getItem(storageKey)||'null');if(saved&&typeof saved.ack==='boolean'&&Number.isInteger(saved.count)&&saved.count>=0&&saved.count<=steps.length)progress=saved}catch{}
 const save=()=>{try{localStorage.setItem(storageKey,JSON.stringify(progress));return true}catch{document.getElementById('corrProgressStatus').textContent='Browser storage unavailable; export your progress before leaving.';return false}};
 const targetLabel=useConnected?'Connected long routes':'Original 27-route plan';
 const corridorMapUrl=id=>id===average.balanced.id?'../assets/corridor-maps/balanced-three.svg':id===average.winner?'../assets/corridor-maps/longer-average.svg':id===longHaul.winner?'../assets/corridor-maps/long-haul.svg':id===connected.winner
   ? '../assets/corridor-maps/connected.svg?v=connected1'
   : `../assets/corridor-maps/${id}.svg?v=clean2`;
 const selectedMap=useConnected?corridorMapUrl(rec):`../assets/corridor-maps/${sparse}-full.png?v=clean2`;
 const previewMap=useConnected?selectedMap:`../assets/corridor-maps/${sparse}.png?v=clean2`;
 const shape=connected.rows[rec];
 const proposed=connected.rows[connected.winner], original=connected.rows[sparse];
 const longShape=longHaul.shapes[longHaul.winner];
 const headline=useConnected?`Connected long routes · ${selected.fleet} trains`:`${selected.fleet}-train long-route recommendation`;
 const reportIds=[connected.winner,sparse,'network_hubs_b','all_tracks_a'];
 const reportLabel=id=>id===average.balanced.id?'Balanced · 3+ stops':id===average.winner?'Longer average routes':id===connected.winner?'Connected long routes':id===sparse?'Original 27 routes':D.plans[id].pressure.label;
 root.removeAttribute('aria-live');
 root.innerHTML=`<section class="panel pad" id="build-target">
   <h2>Build using your saved tracks</h2>
   <p>Choose a corridor plan in the main build queue to work from your recorded purchases and owners.</p>
   <p class="note">Long-haul hubs serves ${longShape.cities} cities with ${longShape.fleet} trains and ${longShape.tracks} links. It has ${longShape.hubs} shared stations and ${longShape.short} short duties. A short duty has fewer than five stops or is a compact loop.</p>
   <p class="note">Both new alternatives serve all ${D.cities.length} cities with at least three stops per train. Fairbanks–Anchorage–Nome uses a local exception to the straightness rule.</p>
   <p><a href="../?target=balanced-three">Build toward Balanced · 3+ stops</a> · <a href="../?target=longer-average">Build toward Longer average routes</a> · <a href="../?target=long-haul">Build toward Long-haul hubs</a> · <a href="../?target=connected">Build toward Connected Long Routes</a> · <a href="../?target=sparse">Build toward Original 27 routes</a></p>
   <h3>Reference checklists</h3>
   <label for="corrBuildTarget">Build target</label>
   <select id="corrBuildTarget">
     <option value="connected" ${useConnected?'selected':''}>Connected long routes · ${proposed.tracks} links</option>
     <option value="sparse" ${useConnected?'':'selected'}>Original 27 routes · ${original.tracks} links</option>
   </select>
   <p class="note">These two checklists use the published 15-track starting map and track their progress separately from the main queue.</p>
   <p><a href="#build-checklist">Open ${esc(targetLabel)} checklist</a> · <a href="#corrInspector" data-inspect="${rec}">Preview build target map</a> · <a href="#connected-results">Compare operating results</a></p>
 </section><div class="warning">The recommendations compare simulated deliveries using assumed job boards, payout geometry and generic trains. Target selection used the world map and froze before testing on fresh seeds. The build checklist was generated afterward from the public starting map.</div><section class="panel pad"><div class="sectionhead"><div><h2>${esc(headline)}</h2><p class="note">${selected.tracks} of ${D.edges.length} links · all ${D.cities.length} cities · zero branches · ${selected.cycles} loops. ${D.edges.length-selected.tracks} available connections are unused.</p></div><a href="${selectedMap}" download>Download full map ${useConnected?'SVG':'PNG'}</a></div><div class="metrics"><div class="metric"><span>Trains</span><strong>${selected.fleet}</strong></div><div class="metric"><span>Cities served</span><strong>${D.cities.length}</strong></div><div class="metric"><span>Chord directness</span><strong>${pct(selected.metrics.weighted_directness)}</strong></div><div class="metric"><span>Branches</span><strong>0</strong></div></div><p class="note">${useConnected?`Through service at ${shape.throughCities} cities. ${shape.hubs} shared stations. ${shape.citiesOnFiveStopRoutes} cities have a train route with at least five stops. A few short connectors cover local gaps. A shared station can be a route endpoint or a through stop.`:`Long main spines take priority. This shortlist conservatively allows at most ${R.selection.maximum_recommendation_loops} small regional collectors; loops that fragment the main routes remain comparisons. Selection favors delivered reward per train (65%) and reward per dispatch command (35%), averaged geometrically across eight tuning settings. The tuning preference index relative to the older 38-corridor reference is ${R.selection.utilities[rec].toFixed(3)} (reference = 1). These are explicit attention/fleet preferences, not extra payouts. Compare total rate too: fewer trains can earn less in total while doing more work per train.`}</p><a href="${selectedMap}"><img class="corr-hero-map" src="${previewMap}" alt="Complete ${selected.fleet}-train recommendation, colored by railroad, with all cities and a Europe inset"></a></section><section class="panel pad"><h2>Different pressures, complete examples</h2><p class="note">${D.search.runs.length} seeded campaigns, ${num(D.search.runs.reduce((a,x)=>a+x.proposals,0))} attempted proposals and ${num(D.search.runs.reduce((a,x)=>a+x.valid_proposals,0))} valid candidates. Each pressure has three starts plus cross-seeding. A bounded search plateau does not certify a global optimum. Some pressures converged to the same geometry; identical maps are grouped below.</p><div class="corr-gallery">${examples.map(id=>{const p=D.plans[id];return `<article><img src="../assets/corridor-maps/${id}.png?v=clean2" alt="${esc(p.pressure.label)}: ${p.fleet} branch-free railroad duties" loading="lazy"><h3>${esc(p.pressure.label)}</h3><p class="note">${p.fleet} trains · ${p.tracks} links · ${pct(p.metrics.weighted_directness)} chord directness · ${p.cycles} compact loops</p><div class="btnrow"><button data-inspect="${id}">Preview map and routes</button><a href="../assets/corridor-maps/${id}.svg?v=clean2" download>SVG</a><a href="../assets/corridor-maps/${id}.png?v=clean2" download>PNG</a></div></article>`}).join('')}</div><details><summary>All pressure settings and their tuning-selected variants</summary><div class="labscroll"><table class="labtable"><thead><tr><th>Preference</th><th>Trains</th><th>Links</th><th>Directness</th><th>Bend / turn</th><th>Fleet / short-line</th><th>Hub / endpoint</th><th>Track / span</th><th>Shortcut access</th></tr></thead><tbody>${R.selection.finalists.map(id=>{const p=D.plans[id],w=p.pressure;return `<tr><td>${esc(w.label)}</td><td>${p.fleet}</td><td>${p.tracks}</td><td>${pct(p.metrics.weighted_directness)}</td><td>${w.bend} / ${w.turn}</td><td>${w.fleet} / ${w.short}</td><td>${w.hub} / ${w.endpoint}</td><td>${w.track} / ${w.span}</td><td>${w.access||0}</td></tr>`}).join('')}</tbody></table></div><p class="note">Surrogate cost includes a missing-shortcut term based on full-map edge betweenness × track-distance, then adds bend loss, turning, fleet size, short lines, off-hub interchanges, endpoint placement and track-distance, and subtracts an endpoint-span term. These weights are search preferences in mixed proxy units, not coin prices. Every open route must reach at least 85% chord directness with no turn over 100°. Only simple paths or standalone loops of at most 4 stations, 260 track-distance and 170 image-pixel diameter are allowed. The 2,400 route-length bound is a search bound, not a fuel tank.</p><p class="note">Directness = sum of open-route endpoint spans / sum of their track-chord lengths in the reference game-map image. Loops are excluded from this ratio. Actual curved track/fuel distances are distinct. A very high directness score can require many extra short railroads.</p></details></section><section class="panel pad" id="corrInspector"><h2>Preview the finished layout</h2><label for="corrPlan">Example layout</label><select id="corrPlan">${[...new Set([average.balanced.id,average.winner,longHaul.winner,connected.winner,...examples])].map(id=>`<option value="${id}" ${id===rec?'selected':''}>${esc(reportLabel(id))} · ${D.plans[id].fleet} trains</option>`).join('')}</select><div id="corrPlanDetails"></div></section><section class="panel pad"><h2>Original corridor study results</h2><p class="note">${num(R.run_count)} simulations including policy tuning, geometry selection and held-out tests. The held-out table averages 12 new seeds per setting. Every plan serves the same 139-city world, with the same demand assumptions. Fleets differ; neither total nor per-train rates alone establish net profit. Legacy references are the earlier 38- and 28-corridor experiments, not your saved configuration.</p><label for="corrScenario">Operating setting</label><select id="corrScenario">${Object.keys(R.evaluation).map(id=>`<option value="${id}">${scenarioNames[id]||id}</option>`).join('')}</select><div id="corrResults"></div></section><section class="panel pad" id="connected-results">
   <h2>Connected routes comparison</h2>
   <p class="note">${num(connected.runs.reduce((total,run)=>total+run.proposals,0))} new route proposals and ${num(connected.simulations)} simulations. New candidates prioritize longer duties, through service and useful shortcuts. Eligible plans add links and maintain through service, with at most two compact loops. The ranking uses 45% total reward rate, 25% reward per train and 30% reward per command across six tuning settings, with separate through-service and long-route coverage preferences. The table uses eight fresh seeds per setting and synthetic job boards.</p>
   <label for="corrConnectedScenario">Connected comparison setting</label>
   <select id="corrConnectedScenario">${Object.keys(connected.scenarios).map(id=>`<option value="${id}">${scenarioNames[id]}</option>`).join('')}</select>
   <div id="corrConnectedResults"></div>
 </section><section class="panel pad" id="build-checklist"><h2>${esc(targetLabel)} build checklist</h2><div class="warning"><b>This sequence starts from the public 15-track reference.</b> It does not read your browser save or assert that your game matches it. For a different map, use <a href="https://github.com/SamuelDovgin/Pocket-Train-Optimizer/blob/main/.agents/skills/pocket-trains-route-coach/SKILL.md">Pocket Trains Route Coach</a> with your actual export and the selected target data. To get your backup, open the <a href="../#queue">main tracker</a> and use <b>Save &amp; transfer → Export JSON backup</b>. <button id="corrTargetExport" type="button">Download selected target data</button></div><p class="note">${M.extra_feeder_routes.length?`Keeping the reference’s unused built links separate from the main spines needs ${M.extra_feeder_routes.length} additional feeder/holding railroads beyond the ${selected.fleet} modeled operating trains. `:''}${steps.length} graph-checked steps: ${steps.filter(s=>s.kind==='BUILD').length} builds, ${steps.filter(s=>s.kind==='LICENSE').length} licenses, ${steps.filter(s=>s.kind==='CORRECT OWNERSHIP').length} owner corrections. ${M.unresolved.length} unresolved graph steps. The target geometry was frozen before this reference was loaded. Purchases are staged to connect current and recipient networks; reclaims wait until needed or until target completion. No phase-specific earnings gain is claimed for a correction.</p><details><summary>Starting tracks, preserved train labels and explicit owner corrections</summary><p class="note">Reference labels are matched after selection to minimize unnecessary reclaims. New R-labels need usable engines; route-distance totals do not specify tank sizes.</p><div class="labscroll"><table class="labtable"><thead><tr><th>Reference built connection</th><th>Actual reference owner</th></tr></thead><tbody>${M.starting_tracks.map(t=>`<tr><td>${esc(t.a)} ↔ ${esc(t.b)}</td><td>${esc(t.railroad)}</td></tr>`).join('')}</tbody></table></div><div class="labscroll"><table class="labtable"><thead><tr><th>Target route</th><th>Reference train label</th></tr></thead><tbody>${Object.entries(M.target_labels_to_reference_trains).map(([target,actual])=>`<tr><td>${esc(target)}</td><td>${esc(actual)}</td></tr>`).join('')}</tbody></table></div><p class="note">${Object.keys(snapshot.target_reviews[rec].corridor_anchors).map(k=>`${esc(k)}: ${snapshot.target_reviews[rec].corridor_anchors[k].map(e=>esc(e.replace('|',' ↔ '))).join(' · ')}`).join('<br>')}</p>${steps.filter(s=>s.kind==='CORRECT OWNERSHIP').map(s=>`<div class="warning"><b>Step ${s.order}: CORRECT ${esc(s.track.replace('|',' ↔ '))}</b> · ${esc(s.from)} → ${esc(s.to)}. Keep the track built. Verify parking, recipient engine and live reclaim fee.</div>`).join('')}<p class="note">Built reference links outside the service graph: ${M.unused_built_tracks_kept.length?M.unused_built_tracks_kept.map(esc).join(', '):'none'}. Extra feeder/holding routes: ${M.extra_feeder_routes.length}. Such extra engines are excluded from the operating experiment and would need separate budgeting.</p></details><label class="corr-ack"><input type="checkbox" id="corrReferenceAck" ${progress.ack?'checked':''}> I checked that my starting map matches the 15-track reference above.</label><p id="corrProgressStatus" class="note" role="status"></p><button id="corrProgressExport">Export reference-checklist progress</button><details id="corrChecklistDetails"><summary>Ordered build and correction checklist · ${steps.length} steps</summary><div id="corrSteps"></div></details></section><section class="panel pad"><h2>Method and evidence</h2><p class="note">The supplied Reddit excerpt by u/Wroberts19 distinguishes all-track coverage from maximizing money on long lines. Its replies suggest Paris and Moscow hubs and extended continental spines. Those are hypotheses, not automatic proof. This study tests map-derived hub candidates and a separate community-nominated hub set, with no fixed long spines or starting-owner constraints.</p><p class="note">The excerpt’s historical Port Moresby fuel comment differs from the current provisional input. It is recorded as an unresolved source discrepancy; no live distance is asserted from that comment. Nine pictured/provisional track distances and exact payout/spawn probabilities remain unverified. High-capacity and tank settings are generic sensitivities, not actual train specifications.</p><p><a href="../assets/corridor-data.json" download>All candidate routes and search trace</a> · <a href="../assets/corridor-results.json" download>Seeded simulation report</a> · <a href="../assets/connected-corridors.json" download>Connected study data and simulation results</a> · <a href="../assets/long-haul-corridors.json" download>Long-haul search and held-out results</a> · <a href="./operating-model.html">Operating-model assumptions</a></p></section>`;
 function inspect(id){
   const plan=D.plans[id];
   const title=reportLabel(id);
   const mapUrl=corridorMapUrl(id);
   document.getElementById('corrPlan').value=id;
   document.getElementById('corrPlanDetails').innerHTML=`
     <h3>${esc(title)}</h3>
     <p class="note">${plan.fleet} trains · ${plan.tracks} links · ${plan.cycles} loops · ${plan.metrics.interchanges} shared stations</p>
     <p class="note">Each color represents a railroad. Faint lines show available connections outside this service plan. Ringed cities mark selected hubs.</p>
     <div class="btnrow">
       <a href="${mapUrl}" target="_blank" rel="noopener">Open full-size map</a>
       <a href="${mapUrl}" download>Download SVG</a>
     </div>
     <img class="corr-hero-map" src="${mapUrl}" width="2600" height="2200" loading="lazy"
       alt="Finished ${esc(title)} network with color-coded routes, city labels and a Europe inset">
     <p class="note"><b>Crossing points:</b> ${TrainCorridorMap.hubs(D,plan).slice(0,12).map(h=>`${esc(h.city)} (${h.lines} lines)`).join(' · ')}.</p>
     <div class="labscroll"><table class="labtable"><thead><tr><th>Route</th><th>Track-distance</th><th>Duty</th><th>Directness / largest turn</th><th>Ordered stations</th></tr></thead><tbody>${plan.lines.map(l=>`<tr><td><span style="color:${l.color}">●</span> ${esc(l.name)}</td><td>${l.length}</td><td>${l.kind==='loop'?'Compact loop':'End-to-end shuttle'}</td><td>${l.kind==='loop'?'Loop exception':pct(TrainCorridorMap.geometry(D,l).directness)+' / '+num(TrainCorridorMap.geometry(D,l).maxTurn)+'°'}</td><td>${l.path.map(esc).join(' → ')}</td></tr>`).join('')}</tbody></table></div>`;
 }
 function results(name){const rows=R.evaluation[name].plans;document.getElementById('corrResults').innerHTML=`<div class="labscroll"><table class="labtable"><thead><tr><th>Layout</th><th>Trains / links</th><th>Total reward / 1,000 time</th><th>Per train</th><th>Per command</th><th>Per track-distance</th><th>Transfers / delivered car</th><th>Delivery age</th></tr></thead><tbody>${[...examples,'reference38','reference28'].map(id=>{const p=allPlans[id],m=rows[id].mean;return `<tr ${id===sparse?'class="corr-recommended"':''}><td>${esc(D.plans[id]?.pressure.label||p.label)}${id===sparse?' · ORIGINAL PICK':''}</td><td>${p.fleet} / ${p.tracks}</td><td>${num(m.rewardPer1000Time)}</td><td>${num(m.rewardPerTrain1000Time)}</td><td>${num(m.rewardPerDispatch)}</td><td>${num(m.rewardPerDistance)}</td><td>${num(m.meanTransfers)}</td><td>${num(m.meanDeliveryTime)}</td></tr>`}).join('')}</tbody></table></div><p class="note">Reward index is credited only on completed deliveries. Unfinished cargo earns no credit. Fleet purchases, repairs, Bux/events and a finite player-action budget remain outside the model.</p>`}
 function checklist(){document.getElementById('corrSteps').innerHTML=steps.map((s,i)=>`<article class="corr-step ${i<progress.count?'done':''}"><input type="checkbox" data-corr-step="${i}" aria-label="Record step ${s.order}: ${esc(s.kind)}" ${i<progress.count?'checked':''} ${!progress.ack||(i!==progress.count&&i!==progress.count-1)?'disabled':''}><div><b>${s.order}. ${esc(s.kind)} · ${esc(s.track?.replace('|',' ↔ ')||s.region)}</b><p class="note">${s.kind==='BUILD'?`Owner: ${esc(s.owner)} (${esc(s.target_label)})${s.needs_engine?' · engine required for new railroad':''}`:s.kind==='CORRECT OWNERSHIP'?`${esc(s.from)} → ${esc(s.to)} · KEEP PHYSICAL TRACK`:'Unlock region before the following purchases'}. ${s.price_reference!==undefined?`Historical price reference: ${s.price_reference===null?'verify':num(s.price_reference)}. `:''}${s.checks.map(esc).join(' · ')}.</p></div></article>`).join('');document.getElementById('corrProgressStatus').textContent=progress.ack?`${progress.count} / ${steps.length} steps recorded. Check the next step only after completing it in game; undo the last record first.`:'Read-only until you verify the reference starting map. Your existing tracker save is untouched.'}
 function connectedResults(name){
   const rows=reportIds.map(id=>{
     const row=connected.rows[id], metrics=connected.heldout[id][name];
     return `<tr ${id===rec?'class="corr-recommended"':''}>
       <td>${esc(reportLabel(id))}</td><td>${row.fleet} / ${row.tracks}</td>
       <td>${row.throughCities} / ${row.hubs}</td>
       <td>${num(metrics.rewardPer1000Time)}</td><td>${num(metrics.rewardPerTrain1000Time)}</td>
       <td>${num(metrics.rewardPerDispatch)}</td><td>${num(metrics.meanTransfers)}</td></tr>`;
   });
   document.getElementById('corrConnectedResults').innerHTML=`<div class="labscroll"><table class="labtable">
     <thead><tr><th>Layout</th><th>Trains / links</th><th>Through cities / hubs</th>
     <th>Total reward / 1,000 time</th><th>Per train</th><th>Per command</th><th>Transfers per car</th></tr></thead>
     <tbody>${rows.join('')}</tbody></table></div>`;
 }
 function downloadJSON(file,data){
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
   const link=document.createElement('a');
   link.href=url;
   link.download=file;
   link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 document.getElementById('corrBuildTarget').addEventListener('change',event=>{
   try{localStorage.setItem(targetPreferenceKey,event.target.value)}catch{}
   const url=new URL(location.href);
   url.searchParams.set('target',event.target.value);
   url.hash='build-target';
   location.assign(url);
 });
 document.getElementById('corrTargetExport').addEventListener('click',()=>{
   const {cities,edges,regions,reward_geometry,coordinates}=D;
   downloadJSON('pocket-trains-selected-target.json',{cities,edges,regions,reward_geometry,coordinates,
     plans:{[rec]:selected},default_targets:[rec]});
 });
 document.getElementById('corrConnectedScenario').addEventListener('change',event=>connectedResults(event.target.value));
 const revealChecklist=()=>{
   if(location.hash==='#build-checklist') document.getElementById('corrChecklistDetails').open=true;
 };
 window.addEventListener('hashchange',revealChecklist);
 revealChecklist();
 connectedResults('uniform');
 inspect(rec);results('uniform');checklist();
 const hashTarget=document.getElementById(location.hash.slice(1));
 if(hashTarget)hashTarget.scrollIntoView();
 document.getElementById('corrPlan').addEventListener('change',e=>inspect(e.target.value));document.getElementById('corrScenario').addEventListener('change',e=>results(e.target.value));
 root.addEventListener('click',e=>{
   const trigger=e.target.closest('[data-inspect]');
   if(!trigger)return;
   inspect(trigger.dataset.inspect);
   if(trigger.matches('button'))document.getElementById('corrInspector').scrollIntoView({block:'start'});
 });
 document.getElementById('corrReferenceAck').addEventListener('change',e=>{progress.ack=e.target.checked;save();checklist()});
 root.addEventListener('change',e=>{if(!e.target.matches('[data-corr-step]'))return;const index=Number(e.target.dataset.corrStep);if(progress.ack&&e.target.checked&&index===progress.count)progress.count++;else if(progress.ack&&!e.target.checked&&index===progress.count-1)progress.count--;save();checklist()});
 document.getElementById('corrProgressExport').addEventListener('click',()=>{const blob=new Blob([JSON.stringify({product:'Pocket Trains clean-slate reference checklist',version:1,target:rec,source_hash:selectionHash,reference:'Public 15-track starting map',...progress},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='pocket-trains-corridor-progress.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000)});
}catch(error){root.textContent=error.message}
})();
