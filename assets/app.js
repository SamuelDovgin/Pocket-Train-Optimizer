
(()=>{'use strict';
const MC=JSON.parse(document.getElementById('monte-carlo-data').textContent);const DEEP=JSON.parse(document.getElementById('deep-data').textContent);const GT=JSON.parse(document.getElementById('graph-data').textContent);const EFF=JSON.parse(document.getElementById('efficiency-data').textContent);const D=JSON.parse(document.getElementById('world-data').textContent);const KEY='pocket-trains-global-v3';const OLD='pocket-trains-europe-expansion-v1';const $=id=>document.getElementById(id);const fmt=n=>Number(n||0).toLocaleString('en-US');const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const emdash='—';
const lineMap=new Map(D.lines.map(x=>[x.name,x]));const edgeMap=new Map(D.edges.map(x=>[x.id,x]));const licenseIds=D.licenses.map(l=>l.id);const requiredAll=[...D.steps];
const corridorData=window.TrainCorridorTargets;
if(!corridorData||!window.TrainCorridorQueue){
 $('mainView').textContent='Plan data could not load. Reload this page to retry.';
 return;
}
const corridorTargets=corridorData.targets;
const saveEdges=corridorData.edges.map(edge=>({...edge,...edgeMap.get(edge.id),fuel:edge.fuel}));
const corridorNames=new Set(['Unverified owner']);
for(const target of Object.values(corridorTargets)){
 for(const name of [...Object.values(target.owners),...Object.values(target.retained)]){
  corridorNames.add(name);
  corridorNames.add(`${target.label} · ${name}`);
 }
}
for(const edge of saveEdges)corridorNames.add(TrainCorridorQueue.holdingName(edge));
const saveGraph={...D,edges:saveEdges,lines:[...D.lines,...[...corridorNames].map(name=>({name}))]};
const corridorPrefix='corridor:';
const getCorridor=value=>typeof value==='string'&&value.startsWith(corridorPrefix)
 ? Object.hasOwn(corridorTargets,value.slice(corridorPrefix.length))&&corridorTargets[value.slice(corridorPrefix.length)]
 : null;
const allDoneDefaults={};D.base.concat(D.done).forEach(id=>allDoneDefaults[id]=true);
let state={done:{...allDoneDefaults},balance:7961,owners:{},costs:{},notes:{},plan:'consolidated',corrections:[]};let UI={view:location.hash==='#operations'?'operations':location.hash==='#map'?'map':'queue',stage:'all',region:'all',line:'all',mode:'all',query:'',showAll:false,citySearch:'',cityRegion:'all',lineRegion:'all',edit:null,labFrom:'London',labTo:'Kyiv',labScope:'actual',labPenalty:40,labSensitivity:40,graphPenalty:40,graphRegion:'all'};
const trackDone=id=>state.done[id]===true;
const actualOwner=e=>state.owners[e.id]||e.owner||'Unverified owner';
const planMap=()=>DEEP.profiles[state.plan]?.owner||(state.plan==='advanced'?GT.owners.global_heuristic:state.plan==='refined'?EFF.optimized:Object.fromEntries(D.edges.map(e=>[e.id,e.owner])));
const allowsCorrections=()=>state.plan==='rework'||state.plan==='consolidated';
const plannedOwner=e=>trackDone(e.id)?(allowsCorrections()?(planMap()[e.id]||actualOwner(e)):actualOwner(e)):(state.owners[e.id]||planMap()[e.id]||e.owner);
const owner=e=>trackDone(e.id)?actualOwner(e):plannedOwner(e);
const activeCorridor=()=>getCorridor(state.corridorTarget);
const planSelector=()=>TrainPlans.selector(state,corridorTargets);
const corridorActions=()=>TrainCorridorQueue.actions(activeCorridor(),saveGraph,state,actualOwner);
function restoreSave(raw){
 const restored=TrainCore.sanitizeSave(raw,saveGraph,'original');
 const target=getCorridor(raw.corridorTarget);
 if(target){
  restored.corridorTarget=raw.corridorTarget;
  const labels=raw.corridorLabels;
  const validNames=new Set(saveGraph.lines.map(line=>line.name));
  const keys=new Set([...Object.values(target.owners),...Object.values(target.retained)]);
  const values=[...keys].map(key=>labels?.[key]);
  if(values.every(name=>validNames.has(name)&&!name.startsWith('Holding · ')&&name!=='Unverified owner')&&new Set(values).size===keys.size){
   restored.corridorLabels=Object.fromEntries([...keys].map(key=>[key,labels[key]]));
  }else{
   restored.corridorLabels=TrainCorridorQueue.chooseLabels(target,saveGraph,restored,
    edge=>restored.owners[edge.id]||edge.owner||'Unverified owner');
  }
 }
 return restored;
}
function selectPlan(value){
 const target=getCorridor(value);
 if(target){
  if(value!==state.corridorTarget){
   state.corridorTarget=value;
   state.corridorLabels=TrainCorridorQueue.chooseLabels(target,saveGraph,state,actualOwner);
  }
 }else{
  delete state.corridorTarget;
  delete state.corridorLabels;
  state.plan=value;
 }
 UI.showAll=false;
}
const price=s=>Object.hasOwn(state.costs,s.id)?state.costs[s.id]:s.cost;
const finished=s=>trackDone(s.id);const purchasedEdges=()=>saveGraph.edges.filter(e=>trackDone(e.id));const reached=()=>new Set(purchasedEdges().flatMap(e=>[e.a,e.b]));
const pending=()=>activeCorridor()?corridorActions().next:TrainCore.buildQueue(D,state,owner,allowsCorrections()?Object.fromEntries(D.edges.map(e=>[e.id,plannedOwner(e)])):null,DEEP.profiles[state.plan]?.correction_schedule||[]);
function toast(text){const e=$('toast');e.textContent=text;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',1900)}
function save(){try{localStorage.setItem(KEY,JSON.stringify({version:5,corridorTarget:state.corridorTarget,corridorLabels:state.corridorLabels,lastCheckoff:state.lastCheckoff,corrections:state.corrections,done:state.done,balance:state.balance,owners:state.owners,costs:state.costs,notes:state.notes,plan:state.plan}));$('saveStatus').textContent='✓ Progress saved in this browser';}catch(e){$('saveStatus').textContent='Browser save unavailable—export a JSON backup.'}}
function oldId(s){return s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function load(){try{const value=localStorage.getItem(KEY);if(value){const v=JSON.parse(value);state=restoreSave(v);if((v.version||0)<5&&state.plan==='advanced')state.plan='consolidated';return}const old=localStorage.getItem(OLD);if(old){const v=JSON.parse(old);if(v.done)for(const s of D.steps){if(s.kind==='license'){if(s.region==='Asia'&&v.done['asia-license'])state.done[s.id]=true;continue}let prev=oldId(s.a+'-'+s.b),alt=oldId(s.b+'-'+s.a);if(v.done[prev]||v.done[alt])state.done[s.id]=true;}if(Number.isFinite(v.coins))state.balance=v.coins;}}catch(e){console.warn('Could not restore existing save.',e)}}
function getCostStatus(s){return price(s)===null?'Price unverified':`${fmt(price(s))} coins`}
function lockStageName(s){if(s.kind==='reassign')return 'Ownership correction';const st=s.stage;return ['Existing','Finish Europe','Asia gateway','Asia core + Nordic','Africa','Oceania','North America','South America','Global endgame'][st]||'Endgame'}
function mark(id,checked){
 const edge=edgeMap.get(id);
 if(!TrainCore.recordCompletion(state,id,checked,edge?owner(edge):undefined))return;
 save();
 render();
 if(checked)toast('Completed — use Undo last checkoff to reverse it');
}
function renderUndo(){
 const last=state.lastCheckoff;
 $('undoCheckoff').disabled=!last;
 if(last?.kind==='completion'){
  const edge=saveGraph.edges.find(edge=>edge.id===last.id);
  const label=edge?`${edge.a} ↔ ${edge.b}`:D.licenses.find(license=>license.id===last.id)?.name;
  $('undoCheckoffStatus').textContent=`${last.afterDone?'Recorded':'Restored to queue'}: ${label}`;
 }else if(last?.kind==='correction'){
  const group=state.corrections.filter(item=>item.batchId===last.batchId);
  const track=group[0]?.trackId.replace('|',' ↔ ');
  $('undoCheckoffStatus').textContent=group.length===1?`Recorded reclaim: ${track}`:`Recorded reclaims on ${group.length} tracks`;
 }else{
  $('undoCheckoffStatus').textContent='For older builds or licenses, open Completed and choose Restore.';
 }
}
function undoCheckoff(){
 try{
  const undone=TrainCore.undoLastCheckoff(state);
  if(!undone)delete state.lastCheckoff;
  save();
  render();
  toast(undone?'Last checkoff undone':'That record has changed. Review Completed or Recorded ownership corrections.');
 }catch(error){toast(error.message)}
}
function lineChip(name){const x=lineMap.get(name);return `<span class="dot" style="background:${x?.color||'#99adc0'}"></span>${esc(name)}`}
function rowHtml(s,rank){if(s.kind==='reassign')return TrainPlans.correctionHtml(s,rank);const lic=s.kind==='license';const assigned=lic?s.region:owner(s);const info=lic?null:lineMap.get(assigned);const edge=lic?null:edgeMap.get(s.id);const color=lic?'#f2c878':info?.color||'#7bc5d0';const title=lic?s.name:`${s.a} → ${s.b}`;const edit=UI.edit===s.id;return `<div class="task ${rank===1&&UI.stage==='all'&&UI.region==='all'&&UI.line==='all'&&!UI.query&&UI.mode==='all'?'next':''}" style="--rail:${color}"><div class="rank">${rank}</div><input class="check" type="checkbox" data-check="${esc(s.id)}" aria-label="Complete ${esc(title)}"><div class="taskbody"><div class="ttitle">${esc(title)}</div><div class="tags">${lic?'<span class="tag">🌐 License</span>':`<span>${lineChip(assigned)}</span><span class="tag">${s.water?'Sea':'Land'} · ${s.fuel??'?'} fuel</span>`}<span class="tag">${esc(lockStageName(s))}</span>${!lic&&s.tier!=='Network expansion'?`<span class="tag">${esc(s.tier)}</span>`:''}</div><div class="detail">${lic?esc(s.region==='Asia'?'After the Volgograd and Moscow gateways, when train range and cash permit.':s.why):`Reference priority #${s.rank} · ${s.tier==='Network expansion'?'Expands your network or opens a new station':'Optional / completionist connection'}`}</div><div class="queue-status small" style="margin-top:5px">${s.blocked?.length?esc(s.blocked.join(' · ')):'✓ Ready to build · check after purchasing in game'}</div><div class="actions">${!lic?`<button class="tinybtn" data-edit="${esc(s.id)}">${edit?'Close editor':'Edit railroad / cost / note'}</button>`:''}</div>${edit&&!lic?`<div class="taskedit"><label>Owning railroad<select data-owner="${esc(s.id)}">${D.lines.map(l=>`<option ${assigned===l.name?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label><label>Actual total coins<input type="number" min="0" step="1" placeholder="Unknown" data-cost="${esc(s.id)}" value="${price(s)??''}"></label></div><label class="small muted" style="display:block;margin-top:9px">Personal notes<input type="text" data-note="${esc(s.id)}" style="margin-top:5px" placeholder="Engine, fuel car, next steps…" value="${esc(state.notes[s.id]||'')}"></label>`:''}${state.notes[s.id]&&!edit?`<div class="detail" style="color:#d2b98e">Note: ${esc(state.notes[s.id])}</div>`:''}</div><div class="price">${price(s)===null?'<span style="color:#edc37b">Verify</span>':fmt(price(s))}<div class="small muted2">${price(s)===null?'cost':'coins'}</div></div></div>`}
function renderStats(){const target=activeCorridor(),edgeCount=target||trackDone('Nairobi|Zanzibar')?saveGraph.edges.length:D.edges.length;const ow=purchasedEdges().length;const city=reached().size;const lic=1+licenseIds.filter(trackDone).length;const remain=pending();const known=remain.reduce((sum,x)=>sum+(price(x)||0),0);$('metricTracks').textContent=`${ow} / ${edgeCount}`;$('trackPct').textContent=`${Math.round(ow*100/edgeCount)}% of map`;$('metricCities').textContent=`${city} / ${Object.keys(D.regions).length}`;$('metricQueue').textContent=fmt(remain.length);$('metricLines').textContent=target?.fleet??new Set(D.edges.map(plannedOwner)).size;$('ownedMetric').textContent=`${ow} / ${edgeCount}`;$('licMetric').textContent=`${lic} / 6`;$('worldBar').style.width=`${Math.round((ow+lic)*100/(edgeCount+6))}%`;$('costRemain').textContent=fmt(known);$('nextName').textContent=remain[0]?(remain[0].kind==='license'?remain[0].name:remain[0].kind==='reassign'?'Correct '+remain[0].from+' → '+remain[0].to:remain[0].a+'–'+remain[0].b):'Completed!';$('licenseGap').textContent=fmt(Math.max(0,50000-state.balance));$('balance').value=state.balance;renderMilestones();}
function renderMilestones(){const milestones=[['Volgograd gateway built',trackDone('Kyiv|Volgograd')],['Moscow gateway built',trackDone('Minsk|Moscow')],['50,000 coins available',state.balance>=50000],['Asia license bought',trackDone('license-asia')]];$('milestones').innerHTML=milestones.map(([t,done])=>`<div class="milestone"><i>${done?'✓':'○'}</i><div><b>${esc(t)}</b><small>${done?'Ready / complete':'Still to do'}</small></div></div>`).join('')}
function filters(s){if(UI.mode==='corrections'&&s.kind!=='reassign')return false;if(UI.stage!=='all'&&String(s.stage)!==UI.stage)return false;if(UI.region!=='all'&&!(s.kind==='license'?s.region===UI.region:(D.regions[s.a]===UI.region||D.regions[s.b]===UI.region)))return false;if(UI.line!=='all'&&(s.kind==='license'||owner(s)!==UI.line))return false;if(UI.mode==='core'&&(s.kind!=='license'&&s.kind!=='reassign'&&s.tier!=='Network expansion'))return false;if(UI.mode==='optional'&&(s.kind==='license'||s.kind==='reassign'||s.tier==='Network expansion'))return false;if(UI.mode==='unknown'&&(price(s)!==null))return false;const q=UI.query.trim().toLowerCase();if(q&&!`${s.kind==='license'?s.name:s.a+' '+s.b+' '+(s.tracks||[]).map(e=>e.a+' '+e.b).join(' ')+' '+owner(s)} ${lockStageName(s)}`.toLowerCase().includes(q))return false;return true}
function renderCorridorQueue(){
 const target=activeCorridor();
 const {next,retained}=corridorActions();
 const ready=next.filter(step=>!step.blocked.length);
 const completed=Object.keys(target.owners).filter(trackDone).length;
 const corrections=next.filter(step=>step.kind==='reassign');
 const reviewingCorrections=UI.mode==='corrections';
 const filtered=reviewingCorrections?corrections:next;
 const visible=UI.showAll?filtered:filtered.slice(0,22);
 $('mainView').innerHTML=`<div class="sectionhead"><div>
 <h2>Build toward ${esc(target.label)}</h2>
 <p class="note">${completed} / ${target.tracks} target tracks built · ${next.length} remaining actions · ${ready.length} ready</p>
 </div></div>${planSelector()}
 <p><button type="button" data-view="map">Preview selected plan</button></p>
 <p class="note">${target.fleet} service railroads · ${target.cities} cities · ${target.hubs} shared stations · ${target.short} short duties</p>
 <p class="hint">The queue uses completed tracks and recorded owners from this browser. Check a step after finishing it in the game. Each check recalculates the available builds, licenses and owner changes.</p>
 ${retained.length?`<details><summary>${retained.length} built tracks kept outside the service plan</summary>
 <p class="note">${retained.map(edge=>esc(edge.a+' ↔ '+edge.b)).join(' · ')}</p>
 <p class="note">A retained track may need a separate holding railroad if its current train serves a main route.</p></details>`:''}
 ${TrainPlans.completedCorrections(state,saveGraph)}
 ${!ready.length&&next.length?'<p class="warning">The current recorded owners block the remaining actions. Review the prerequisites below before making a reclaim in the game.</p>':''}
 <div class="segment" role="group" aria-label="Filter corridor actions">
   <button type="button" data-mode="all" aria-pressed="${!reviewingCorrections}" class="${!reviewingCorrections?'active':''}">All actions</button>
   <button type="button" data-mode="corrections" aria-pressed="${reviewingCorrections}" class="${reviewingCorrections?'active':''}">Existing-track corrections (${corrections.length})</button>
 </div>
 <div class="queue">${visible.map(corridorRow).join('')||`<p class="empty">${reviewingCorrections?'No existing-track corrections remain.':'All actions for this target are recorded.'}</p>`}</div>
 ${filtered.length>22?`<button id="toggleMore">${UI.showAll?'Show first 22 actions':`Show all ${filtered.length} actions`}</button>`:''}`;
}
function corridorRow(step,index){
 const license=step.kind==='license';
 const correction=step.kind==='reassign';
 const kind=license?'LICENSE':correction?'CORRECT EXISTING OWNERSHIP':'BUILD';
 const title=license?step.region:`${step.a} ↔ ${step.b}`;
 const detail=license?'Buy this regional license in the game before claiming tracks there. Check the live price and your coin balance.':correction
  ? `${step.from} → ${step.to}. Keep the physical track built. Park the donor on a retained track. ${step.needsEngine?'Have a train available for the receiving railroad. ':''}Verify the live reclaim fee.`
  : `Owner: ${step.owner}. ${step.needsEngine?'A train is needed for this railroad. ':''}Verify range and the live build price.`;
 return `<div class="task ${correction?'correction-task':''} ${index===0&&!step.blocked.length?'next':''}">
  <div class="rank">${index+1}</div>
  <input class="check" type="checkbox" data-corridor-action="${esc(step.id)}"
   aria-label="Record ${esc(kind+' '+title)}" ${step.blocked.length?'disabled':''}>
  <div class="taskbody"><div class="ttitle">${kind} · ${esc(title)}</div>
  <div class="detail">${esc(detail)}</div>
  <div class="queue-status small">${step.blocked.length?step.blocked.map(esc).join(' · '):'Ready · check after completing in game'}</div>
  ${correction&&step.blocked.length?`<button type="button" class="tinybtn" data-verify-corridor-owner="${esc(step.id)}">Record an already completed reclaim</button>`:''}</div>
  <div class="price">${correction||price(step)==null?'Verify':fmt(price(step))+' coins'}</div>
 </div>`;
}
function renderCorridorMap(){
 const target=activeCorridor();
 const averageDistance=target.lines.reduce((total,line)=>total+line.length,0)/target.lines.length;
 const fewestStops=Math.min(...target.lines.map(line=>new Set(line.path).size));
 $('mainView').innerHTML=`<h2>${esc(target.label)} · finished layout</h2>
 ${planSelector()}<p class="note">${target.cities} stations served · ${averageDistance.toFixed(1)} average track-distance · at least ${fewestStops} stops per train</p>
 ${target.alaska_exception?'<p class="note">Fairbanks–Anchorage–Nome is a local exception to the straightness rule.</p>':''}
 <div class="btnrow">
 <button type="button" data-view="queue">Back to build queue</button>
 <a href="${esc(target.map)}" target="_blank" rel="noopener">Open full-size map</a>
 <a href="${esc(target.map)}" download>Download SVG</a></div>
 <img class="corr-hero-map" src="${esc(target.map)}" width="2600" height="2200"
 alt="Color-coded finished ${esc(target.label)} rail network">
 <div class="labscroll"><table class="labtable"><thead><tr><th>Map route</th><th>Queue owner</th><th>Track-distance</th><th>Stations</th></tr></thead>
 <tbody>${target.lines.map(line=>`<tr><td><span class="dot" style="background:${esc(line.color)}"></span>${esc(line.id)}</td>
 <td>${esc(state.corridorLabels[line.name])}</td><td>${line.length}</td><td>${line.path.map(esc).join(' → ')}</td></tr>`).join('')}</tbody>
 </table></div>`;
}
function recordCorridorAction(id, verifiedOwner=false){
 if(!activeCorridor())return;
 const step=corridorActions().next.find(action=>action.id===id&&
  (!action.blocked.length||(verifiedOwner&&action.kind==='reassign')));
 if(!step){render();return}
 if(verifiedOwner&&!confirm(`Have you already verified in Pocket Trains that ${step.to} owns ${step.a}–${step.b}? This updates the tracker record.`))return;
 if(step.kind==='reassign')TrainCore.applyCorrection(state,step);
 else TrainCore.recordCompletion(state,id,true,step.kind==='track'?step.owner:undefined);
 save();
 render();
 toast(step.kind==='reassign'?'Recorded owner correction':'Recorded completed action');
}
function renderQueue(){if(activeCorridor()){renderCorridorQueue();return}const p=pending();const issues=TrainCore.auditOwners(D,plannedOwner,EFF.imputed,{allowEmpty:state.plan==='consolidated'});const filtered=p.filter(filters);const shown=UI.showAll?filtered:filtered.slice(0,22);const regopts=['all',...Object.keys({'Europe':1,'Asia':1,'Africa':1,'Oceania':1,'North America':1,'South America':1})];const stageNames=['Finish Europe','Asia gateway','Asia core + Nordic','Africa','Oceania','North America','South America','Global endgame'];const stages=[1,2,3,4,5,6,7,8];$('mainView').innerHTML=`<div class="sectionhead"><div><h2>Ranked action queue <span class="counthead">${fmt(p.length)} remaining</span></h2><div class="small muted" style="margin-top:4px">Follow the first ready purchase, then check it off. Later purchases show their current prerequisites.</div></div><span class="floatmark">World map: ${D.edges.length} tracks</span></div>${planSelector()}<p><button type="button" data-view="map">Preview selected plan</button></p>${TrainPlans.review(DEEP,state,p)}${TrainPlans.completedCorrections(state,D)}<p class="plan-summary">Owned tracks retain their recorded owner until you confirm an explicit correction batch. Manual edits on unbuilt tracks stay fixed. Coin balance is a reference; checkoff does not deduct coins.</p>${issues.length?`<div class="warning">Your saved ownership edits need review: ${issues.map(esc).join('; ')}. Route comparison statistics describe the supplied scenarios, not these custom edits.</div>`:''}<div class="stages"><button class="stage ${UI.stage==='all'?'active':''}" data-stage="all"><strong>Every stage</strong><span>${p.length} remaining</span></button>${stages.map((st,i)=>`<button data-stage="${st}" class="stage ${UI.stage===String(st)?'active':''}"><strong>${esc(stageNames[i])}</strong><span>${p.filter(s=>s.stage===st).length} left</span></button>`).join('')}</div><div class="filters"><input id="search" type="text" placeholder="Search cities, routes, railroads…" value="${esc(UI.query)}" aria-label="Search tracks"><select id="regionSelect" aria-label="Filter by region">${regopts.map(x=>`<option value="${esc(x)}" ${UI.region===x?'selected':''}>${x==='all'?'All regions':esc(x)}</option>`).join('')}</select><select id="lineSelect" aria-label="Filter by owning railroad"><option value="all">Every railroad</option>${D.lines.map(l=>`<option ${UI.line===l.name?'selected':''}>${esc(l.name)}</option>`).join('')}</select></div><div class="segment">${[['all','All actions'],['corrections','Existing-track corrections'],['core','Core network'],['optional','Optional & infill'],['unknown','Prices to verify']].map(([a,b])=>`<button data-mode="${a}" class="${UI.mode===a?'active':''}">${b}</button>`).join('')}</div><div class="hint"><b>Follow the recomputed sequence:</b> complete any ready, explicitly marked owner corrections, then your European gateway connections and continent licenses. Later claims move forward when their network prerequisites are ready. The core filter hides infill; some infill can still be needed to extend a chosen railroad. Follow the current owner labels and prerequisite notes.</div><div class="resultinfo">Showing ${shown.length} of ${filtered.length} matching unfinished actions · ${p.length} total unfinished</div><div class="queue">${shown.length?shown.map((s,i)=>rowHtml(s,p.indexOf(s)+1)).join(''):'<div class="empty">Nothing left in this filter. Select another stage or clear your search.</div>'}</div>${filtered.length>22?`<button id="toggleMore" style="width:100%;margin-top:12px">${UI.showAll?'Show only first 22':'Show all '+fmt(filtered.length)+' matching actions'}</button>`:''}`}
function renderLines(){const all=D.lines.filter(l=>UI.lineRegion==='all'||D.edges.some(e=>plannedOwner(e)===l.name&&(D.regions[e.a]===UI.lineRegion||D.regions[e.b]===UI.lineRegion))).filter(l=>!UI.query||l.name.toLowerCase().includes(UI.query.toLowerCase())||D.edges.some(e=>plannedOwner(e)===l.name&&(e.a+' '+e.b).toLowerCase().includes(UI.query.toLowerCase())));$('mainView').innerHTML=`<div class="sectionhead"><div><h2>Railroad ownership plan</h2><p class="note">The ${D.lines.length} planning labels below reflect your active assignments. Pending owner changes are listed explicitly in the action queue.</p></div><select id="lineRegion" style="width:170px"><option value="all">All line regions</option>${['Europe','Asia','Africa','Oceania','North America','South America','Global'].map(x=>`<option ${UI.lineRegion===x?'selected':''}>${esc(x)}</option>`).join('')}</select></div><div class="hint">The first five are existing / planned European railroads. New line names are <b>planning labels</b>, not specific in-game colors or train models. A label such as China North can be reused elsewhere; the assigned stations below determine its location. An edge can be reassigned through the Build queue editor. A few endgame lines intentionally include branches rather than a perfectly straight route.</div><div class="linegrid">${all.map(l=>{const edges=D.edges.filter(e=>plannedOwner(e)===l.name);const dn=edges.filter(e=>trackDone(e.id)).length;const stops=[...new Set(edges.flatMap(e=>[e.a,e.b]))].sort();return `<details class="linecard"><summary><div class="linehead"><i class="routetag" style="background:${l.color}"></i><div class="lineflex"><b>${esc(l.name)}</b><div class="linepath">${esc(stops.length?stops.join(' · '):'Unused in this target · no train sale instructed')}</div></div><div class="linecounts"><b>${dn}/${edges.length}</b><div class="small muted2">tracks owned</div></div></div><div class="pbar" style="margin-top:9px"><span style="width:${edges.length?dn*100/edges.length:0}%"></span></div></summary><div class="linebody"><p class="note">Choose a suitable service train for the assigned stations and branches. Stations and tracks below reflect your active plan and edits.</p>${edges.map(e=>`<div class="lineitem"><input class="check" type="checkbox" ${trackDone(e.id)?'checked':''} data-check="${esc(e.id)}" aria-label="Mark ${esc(e.a)} to ${esc(e.b)} owned"><div><b>${esc(e.a)} ↔ ${esc(e.b)}</b><div><em>${trackDone(e.id)?(actualOwner(e)!==plannedOwner(e)?'Correction pending · currently '+esc(actualOwner(e)):'Purchased'):esc(lockStageName(e))}${e.tier?' · '+esc(e.tier):''}</em></div></div><span class="small muted2 num">${price(e)===null?'Verify':fmt(price(e))}</span></div>`).join('')}</div></details>`}).join('')||'<div class="empty">No railroads match this selection.</div>'}</div>`}
function renderCities(){const reachedSet=reached();const cities=Object.keys(D.regions).sort().filter(c=>(UI.cityRegion==='all'||D.regions[c]===UI.cityRegion)&&c.toLowerCase().includes(UI.citySearch.toLowerCase()));$('mainView').innerHTML=`<div class="sectionhead"><div><h2>Every city · ${Object.keys(D.regions).length} total</h2><p class="note">A city is reached once at least one connected track is purchased. Browse all the connections that serve it.</p></div></div><div class="filters" style="grid-template-columns:1fr 200px"><input type="text" id="citySearch" placeholder="Search city…" value="${esc(UI.citySearch)}"><select id="cityRegion"><option value="all">All continents</option>${['Europe','Asia','Africa','Oceania','North America','South America'].map(r=>`<option ${UI.cityRegion===r?'selected':''}>${r}</option>`).join('')}</select></div><div class="resultinfo">${cities.filter(c=>reachedSet.has(c)).length} reached of ${cities.length} shown · ${reachedSet.size} worldwide</div><div class="citygrid">${cities.map(city=>{const tracks=D.edges.filter(e=>e.a===city||e.b===city);const built=tracks.filter(e=>trackDone(e.id)).length;const id=encodeURIComponent(city);return `<div class="citycard ${reachedSet.has(city)?'open':''}"><strong>${esc(city)}</strong><small>${D.regions[city]} · ${built}/${tracks.length} tracks</small><button data-city="${esc(city)}">View connections</button><div id="city-${esc(id)}" hidden class="city-detail-list">${tracks.map(e=>`<div>${trackDone(e.id)?'✓':'○'} ${esc(e.a===city?e.b:e.a)} <span class="muted2">(${esc(owner(e))})</span></div>`).join('')}</div></div>`}).join('')||'<div class="empty">No cities match your search.</div>'}</div>`}
function renderCompleted(){const e=saveGraph.edges.filter(x=>trackDone(x.id));const l=D.licenses.filter(x=>trackDone(x.id));$('completeSummary').textContent=`✓ Completed (${e.length} tracks + ${l.length} new licenses) — click to inspect / restore`;$('completeList').innerHTML=[...l,...e].map(s=>{const lic=!s.a;const title=lic?s.name:s.a+' ↔ '+s.b;return `<div class="completed-item"><div><strong>${esc(title)}</strong><div class="mini muted2">${lic?'License':esc(owner(s))} · ${price(s)===null?'price unverified':fmt(price(s))+' coins'}${D.base.includes(s.id)?' · original network':D.done.includes(s.id)?' · your completed expansion':''}</div></div><button data-restore="${esc(s.id)}">↶ Restore</button></div>`}).join('')}

// The numerical overview is precomputed from the Python routing model. Job planner below
// runs offline on the current edges and owner overrides without any external services.
function labMetric(value,label){return `<div class="labmetric"><div class="value">${value}</div><small>${esc(label)}</small></div>`}
function labCase(a,b){return `<button data-labcase="${esc(a)}|${esc(b)}">${esc(a)} → ${esc(b)}</button>`}
function labOwner(e,scope){if(scope==='target')return plannedOwner(e);return scope==='advanced'?(GT.owners.global_heuristic[e.id]||e.owner):scope==='refined'?(EFF.optimized[e.id]||e.owner):scope==='all'?e.owner:owner(e)}
function computeJourney(a,b,scope,penalty){
 const target=activeCorridor();
 if(scope==='actual')return TrainCore.journey(saveGraph,EFF.imputed,a,b,actualOwner,e=>trackDone(e.id),penalty);
 if(scope==='target'&&target)return TrainCore.journey(saveGraph,EFF.imputed,a,b,
  edge=>state.corridorLabels[target.owners[edge.id]],edge=>Boolean(target.owners[edge.id]),penalty);
 return TrainCore.journey(D,EFF.imputed,a,b,e=>labOwner(e,scope),()=>true,penalty);
}
function renderLab(){
 const penalty=UI.labSensitivity;const base=EFF.results[String(penalty)].baseline,ref=EFF.results[String(penalty)].refined;
 const change=100*(base.mean_score-ref.mean_score)/base.mean_score;
 const transferred=100*(base.mean_transfers-ref.mean_transfers)/base.mean_transfers;
 const phaseRows=EFF.phases.map(p=>`<tr><td>${esc(p.title)}</td><td>${p.cities}</td><td>${p.direct_pct}%</td><td>${p.avg_transfers}</td></tr>`).join('');
 const cities=Object.keys(D.regions).sort();const scope=UI.labScope;const journey=computeJourney(UI.labFrom,UI.labTo,scope,UI.labPenalty);
 const options=cities.map(c=>`<option value="${esc(c)}"`).join('');
 const caseButtons=[['London','Kyiv'],['London','Rome'],['New York','Tokyo'],['Paris','Shanghai'],['Kolkata','Rome'],['Sydney','Paris']].map(([a,b])=>labCase(a,b)).join('');
 const moved=EFF.history.map((r,i)=>{const owned=trackDone(r.track);return `<tr><td>${i+1}</td><td>${esc(r.track.replace('|',' ↔ '))}</td><td>${esc(r.from)}</td><td>${esc(r.to)}</td><td>${owned?'<span class="muted">Already owned</span>':'Future assignment'}</td></tr>`}).join('');
 const tableMetric=(stat,fmtx='number')=>`<td>${fmtx==='num'?stat.toFixed(2):fmtx==='percent'?(stat*100).toFixed(1)+'%':stat.toFixed(1)}</td>`;
 $('mainView').innerHTML=`
 <div class="sectionhead"><div><h2>Cargo efficiency laboratory</h2><p class="note">A reproducible routing proxy on your complete 139-city network. No invented coin/hour claims.</p></div><span class="floatmark">9,591 city pairs compared</span></div>
 <div class="hint"><b>What is actually tested?</b> For every city pair, find the least costly way to move a hypothetical job across owned tracks. Count fuel burned and railroad handoffs. Compare the original 38-line map with a local-search refinement preserving all 15 of your original/completed segments and 38 connected railroads.</div>
 <h3>Historical comparison · earlier 25-move refinement</h3>
 <div class="labmetrics">${labMetric(transferred.toFixed(1)+'%','Fewer transfers per job')}${labMetric(change.toFixed(1)+'%','Lower modeled routing effort')}${labMetric(''+((ref.share_max_one)*100).toFixed(1)+'%','Jobs needing at most 1 transfer (refined)')}</div>
 <div class="labcard" style="margin-bottom:14px"><label class="small muted" for="labSensitivity">Handling cost: <b style="color:#b9f6e9">${penalty} fuel-equivalent units per transfer</b></label><select id="labSensitivity" style="margin-top:8px">${[0,20,40,80].map(p=>`<option value="${p}" ${penalty===p?'selected':''}>${p} fuel-equivalent units</option>`).join('')}</select><div class="labrow"><span>Assumption</span><b>0 = ignore handoffs · 80 = cumbersome handoffs</b></div><div class="labscroll"><table class="labtable"><thead><tr><th>Metric</th><th>Original</th><th>Refined</th></tr></thead><tbody>
 <tr><td>Average line transfers</td>${tableMetric(base.mean_transfers,'num')}${tableMetric(ref.mean_transfers,'num')}</tr>
 <tr><td>Average fuel per job</td>${tableMetric(base.mean_fuel)}${tableMetric(ref.mean_fuel)}</tr>
 <tr><td>Average route detour over shortest physical path</td><td>${(base.mean_detour).toFixed(3)}×</td><td>${(ref.mean_detour).toFixed(3)}×</td></tr>
 <tr><td>Jobs with ≤ 1 transfer</td>${tableMetric(base.share_max_one,'percent')}${tableMetric(ref.share_max_one,'percent')}</tr>
 <tr><td>Jobs needing ≥ 3 transfers</td>${tableMetric(base.pct_3plus,'percent')}${tableMetric(ref.pct_3plus,'percent')}</tr>
 <tr><td>Mean routing effort (fuel + transfers × cost)</td>${tableMetric(base.mean_score)}${tableMetric(ref.mean_score)}</tr></tbody></table></div>
 <div class="labnote"><b>Interpretation:</b> Routing effort is NOT coins, actual profit, an observed average, or earnings per hour. The same job reward is assumed under both maps. Fuel is known for 182 links and provisionally estimated for 8 late-game links. We do not simulate train waiting, cargo spawn likelihood, capacities, yard overflow, repairs, or player attention.</div></div>
 <h3>Try a real origin → destination job</h3>
 <p class="note">This calculator reads your saved track ownership and completion status. It finds a route through one or more operating railroads and marks transfers explicitly.</p>
 <div class="labselects"><label>Origin station<select id="labFrom">${cities.map(c=>`<option ${UI.labFrom===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Destination station<select id="labTo">${cities.map(c=>`<option ${UI.labTo===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label>Network to route on<select id="labScope"><option value="actual" ${scope==='actual'?'selected':''}>Purchased tracks only · your progress</option><option value="target" ${scope==='target'?'selected':''}>Full target · after listed corrections</option><option value="planned" ${scope==='planned'?'selected':''}>Full current plan · corrections pending</option><option value="all" ${scope==='all'?'selected':''}>Full original 38-line plan</option><option value="refined" ${scope==='refined'?'selected':''}>Full previous 38-line refinement</option><option value="advanced" ${scope==='advanced'?'selected':''}>Previous published 38-line scenario</option></select></label><label>Transfer handling cost<select id="labPenalty">${[0,20,40,80].map(p=>`<option value="${p}" ${UI.labPenalty===p?'selected':''}>${p} fuel-equivalent units</option>`).join('')}</select></label></div>
 <div class="labcta">${caseButtons}</div>
 ${journey?`<div class="labmetrics">${labMetric(journey.fuel.toLocaleString(),'Track-distance fuel proxy')}${labMetric(journey.transfers+'','Stockyard transfers required')}${labMetric(journey.sections.length+'','Different railroad legs')}</div><div class="labroute">${journey.sections.length?journey.sections.map((s,i)=>`<div class="labstep" style="--rail:${lineMap.get(s.line)?.color||'#67c8ab'}"><b>${i+1}. ${esc(s.line)}</b><span class="small muted" style="float:right">${fmt(s.fuel)} fuel${s.estimated?' · estimate':''}</span><div class="cityroute">${s.stops.map(esc).join(' → ')}</div></div>`).join(''):'<div class="hint">Origin and destination are the same station.</div>'}</div><div class="labnote">Every railroad change requires unloading into the connecting city's stockyard, then loading the next train. This route is a shortest generalized-cost path, not a timetable or a guarantee that all cargo can fit in the next train.</div>`:'<div class="warning" style="margin-top:13px">No route is currently available between these stations on the selected built-only network. Build the missing connections or select the full future plan.</div>'}
 <div class="labgrid"><div class="labcard"><h3>Progressive development</h3><p class="note">Uniform possible jobs among unlocked cities (a larger world is not directly comparable to a smaller one).</p><div class="labscroll"><table class="labtable"><thead><tr><th>Stage</th><th>Cities</th><th>Direct</th><th>Avg transfers</th></tr></thead><tbody>${phaseRows}</tbody></table></div></div><div class="labcard"><h3>Where refinements help</h3><p class="note">Identical hypothetical trips, whole world unlocked; all numbers are transfer counts per trip.</p><div class="labscroll"><table class="labtable"><thead><tr><th>Job category</th><th>Original</th><th>Refined</th></tr></thead><tbody>${EFF.groups.map(g=>`<tr><td>${esc(g.name)}</td><td>${g.before_t}</td><td>${g.after_t}</td></tr>`).join('')}</tbody></table></div></div></div>
 <details class="linecard" style="margin-top:15px"><summary><b>Historical 25-move experiment · reference only</b><div class="note">Earlier experiment; follow the current action queue for your construction and correction steps.</div></summary><div class="linebody"><div class="labnote">Suggestions came from greedy one-track-at-a-time optimization, not a global optimality proof. They preserve original completed segments and connectedness, but some produce branches or long-distance train requirements. Review before claiming a track; don't pay to reassign already-owned segments solely for this model.</div><div class="labscroll"><table class="labtable"><thead><tr><th>#</th><th>Track</th><th>Original owner</th><th>Proposed owner</th><th>Status</th></tr></thead><tbody>${moved}</tbody></table></div></div></details>
 <div class="labnote" style="margin-top:15px"><b>How to interpret the model:</b> A direct job can travel on one railroad. At a line boundary, it needs one stockyard handoff. When a longer but single-line route avoids transfers, the route planner trades detour fuel against a user-selected transfer penalty. The model tests all unordered pairs exactly once, equally weighted. Real job offers are not necessarily uniform and can include different car counts, payouts and Bux/crate priorities. The simulation does not demonstrate which layout earns more real-world coins per hour.</div>
 <div class="sources">Mechanics: <a href="https://pocket-trains.fandom.com/wiki/Jobs" target="_blank" rel="noopener">Job lists and stockyards</a> · <a href="https://pocket-trains.fandom.com/wiki/Fuel" target="_blank" rel="noopener">Fuel</a> · <a href="https://pocket-trains.fandom.com/wiki/Train" target="_blank" rel="noopener">Train capabilities</a> · Reddit: <a href="https://www.reddit.com/r/pockettrains/comments/11ybkrj" target="_blank" rel="noopener">Interchange efficiency discussion</a>.</div>`;
}


function exportGraphPlan(){
 const report={purpose:'Engine-agnostic target ownership and explicit existing-track correction batches',plan:state.plan,objective:DEEP.objective,target_owners:Object.fromEntries(D.edges.map(e=>[e.id,plannedOwner(e)])),pending_corrections:pending().filter(s=>s.kind==='reassign'),recorded_corrections:state.corrections,limitations:'Route model only. Verify live claim fees, trains, positions, capacity and fuel. No physical track deletion or train sale is instructed.'};
 const file=new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),u=URL.createObjectURL(file),a=document.createElement('a');a.href=u;a.download='pocket-trains-target-and-corrections.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);
}
function renderGraph(){$('mainView').innerHTML=TrainPlans.graphHtml(DEEP,GT,UI.graphPenalty);}
function renderWorldMap(){
 if(activeCorridor()){renderCorridorMap();return}
 const targets=Object.fromEntries(D.edges.map(e=>[e.id,plannedOwner(e)])),issues=TrainCore.auditOwners(D,e=>targets[e.id],EFF.imputed,{allowEmpty:state.plan==='consolidated'});
 const warning=issues.length?`<div class="warning">Your saved ownership differs from a connected reference target: ${issues.map(esc).join('; ')}. The map shows these recorded assignments and edits; use the recommended reference image for the verified default.</div>`:'';
 $('mainView').innerHTML=TrainWorldMap.html().replace('<div class="map-toolbar">',planSelector()+warning+'<div class="map-toolbar">');
 TrainWorldMap.mount(D,targets,DEEP.profiles[state.plan]?.label||'Active completed target');
}
function render(){if((location.protocol==='http:'||location.protocol==='https:')&&(['map','operations'].includes(UI.view)||['#map','#operations'].includes(location.hash)))history.replaceState(null,'',location.pathname+location.search+(UI.view==='map'?'#map':UI.view==='operations'?'#operations':''));TrainMonteCarlo.cancel();TrainOperating.cancel();document.body.classList.toggle('map-wide',['map','operations'].includes(UI.view));renderStats();renderUndo();document.querySelector('.viewtabs [data-view="map"]').textContent=activeCorridor()?'Target map':'Historical map';document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===UI.view));if(UI.view==='queue')renderQueue();if(UI.view==='railroads')activeCorridor()?renderCorridorMap():renderLines();if(UI.view==='cities')renderCities();if(UI.view==='lab')renderLab();if(UI.view==='graph')renderGraph();if(UI.view==='mc')$('mainView').innerHTML=TrainMonteCarlo.render(MC);if(UI.view==='map')renderWorldMap();if(UI.view==='operations'){$('mainView').innerHTML=TrainOperating.html();TrainOperating.mount();}$('completedBlock').style.display=UI.view==='queue'?'':'none';if(UI.view==='queue')renderCompleted();}
function exportBackup(){const snapshot={product:'Pocket Trains World Tracker',version:5,plan:state.plan,corridorTarget:state.corridorTarget,corridorLabels:state.corridorLabels,lastCheckoff:state.lastCheckoff,corrections:state.corrections,exported:new Date().toISOString(),done:state.done,balance:state.balance,owners:state.owners,costs:state.costs,notes:state.notes};const blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='pocket-trains-world-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function importBackup(file){
 const reader=new FileReader();
 reader.onload=()=>{try{
  const next=restoreSave(JSON.parse(reader.result));
  state=next;save();render();toast('Backup imported successfully');
 }catch(e){alert('Could not import this file: '+e.message)}};
 reader.onerror=()=>alert('Could not read this backup file. Please try again.');
 reader.readAsText(file);
}
document.addEventListener('click',e=>{if(e.target.closest('#openOperatingAudit')){e.preventDefault();UI.view='operations';render();return}const t=e.target.closest('button');if(!t)return;
if(t.dataset.verifyCorridorOwner){recordCorridorAction(t.dataset.verifyCorridorOwner,true);return}
if(t.dataset.usePlan){selectPlan(t.dataset.usePlan);UI.view='queue';UI.mode='all';save();render();return}if(t.dataset.undoCorrection!==undefined){try{TrainCore.undoCorrection(state,Number(t.dataset.undoCorrection));save();render();toast('Correction batch record undone; physical tracks remain checked')}catch(error){alert(error.message)}return}if(t.dataset.view){UI.view=t.dataset.view;render();return}
if(t.dataset.goTrack){UI.view='queue';UI.query=t.dataset.goTrack.split('|')[0];UI.mode='all';UI.stage='all';UI.region='all';UI.line='all';UI.showAll=true;render();return}
if(t.id==='previewGraph'){UI.view='lab';UI.labScope='advanced';UI.labFrom='New York';UI.labTo='Tokyo';render();return}
if(t.id==='graphExport'){exportGraphPlan();return}
if(t.dataset.labcase){const [a,b]=t.dataset.labcase.split('|');UI.labFrom=a;UI.labTo=b;render();return}
if(t.dataset.stage){UI.stage=t.dataset.stage;UI.showAll=false;render();return}
if(t.dataset.mode){UI.mode=t.dataset.mode;UI.showAll=false;render();return}
if(t.dataset.edit){UI.edit=UI.edit===t.dataset.edit?null:t.dataset.edit;render();return}
if(t.dataset.restore){mark(t.dataset.restore,false);return}
if(t.dataset.city){const node=document.getElementById('city-'+encodeURIComponent(t.dataset.city));if(node){node.hidden=!node.hidden;t.textContent=node.hidden?'View connections':'Hide connections'}return}
if(t.id==='toggleMore'){UI.showAll=!UI.showAll;render();return}
if(t.id==='undoCheckoff'){undoCheckoff();return}
if(t.id==='exportBtn'){exportBackup();return}
if(t.id==='importBtn'){$('importFile').click();return}
if(t.id==='resetBtn'){if(confirm('Reset all progress to the 10 original tracks and the 5 expansions you completed? This also resets owner overrides, costs, notes and coin balance. Export a backup first if needed.')){state={done:{...allDoneDefaults},balance:7961,owners:{},costs:{},notes:{},plan:'consolidated',corrections:[]};UI.edit=null;save();render();toast('Reset to initial completed purchases')}return}
});
document.addEventListener('change',e=>{const t=e.target;if(t.dataset.corridorAction){if(t.checked)recordCorridorAction(t.dataset.corridorAction);return}if(t.dataset.correction){const step=pending().find(s=>s.id===t.dataset.correction);if(step){TrainCore.applyCorrection(state,step);save();render();toast('Recorded entire correction batch; tracks remain built')}return}if(t.id==='activePlan'){selectPlan(t.value);save();render();return}if(t.dataset.check){mark(t.dataset.check,t.checked);return}if(t.dataset.owner){state.owners[t.dataset.owner]=t.value;save();render();return}if(t.dataset.cost){state.costs[t.dataset.cost]=t.value===''?null:Math.max(0,Math.round(Number(t.value)));if(t.value==='')delete state.costs[t.dataset.cost];save();render();return}if(t.dataset.note){state.notes[t.dataset.note]=t.value;save();render();return}if(t.id==='graphPenalty'){UI.graphPenalty=Number(t.value);render();return}if(t.id==='graphRegion'){UI.graphRegion=t.value;render();return}if(t.id==='labFrom'){UI.labFrom=t.value;render();return}if(t.id==='labTo'){UI.labTo=t.value;render();return}if(t.id==='labScope'){UI.labScope=t.value;render();return}if(t.id==='labPenalty'){UI.labPenalty=Number(t.value);render();return}if(t.id==='labSensitivity'){UI.labSensitivity=Number(t.value);render();return}if(t.id==='regionSelect'){UI.region=t.value;render();return}if(t.id==='lineSelect'){UI.line=t.value;render();return}if(t.id==='lineRegion'){UI.lineRegion=t.value;render();return}if(t.id==='cityRegion'){UI.cityRegion=t.value;render();return}if(t.id==='balance'){state.balance=Math.max(0,Number(t.value)||0);save();renderStats();return}if(t.id==='importFile'&&t.files[0]){importBackup(t.files[0]);t.value='';return}});
document.addEventListener('input',e=>{const t=e.target;if(t.id==='search'){UI.query=t.value;const pos=t.selectionStart;renderQueue();const f=$('search');f.focus();f.setSelectionRange(pos,pos);return}if(t.id==='citySearch'){UI.citySearch=t.value;const pos=t.selectionStart;renderCities();const f=$('citySearch');f.focus();f.setSelectionRange(pos,pos);return}if(t.id==='balance'){state.balance=Math.max(0,Number(t.value)||0);renderStats();return}});
window.addEventListener('storage',e=>{if(e.key===KEY){state={done:{...allDoneDefaults},balance:7961,owners:{},costs:{},notes:{},plan:'consolidated',corrections:[]};load();render()}});
load();
const requested=new URLSearchParams(location.search).get('target');
if(getCorridor(corridorPrefix+requested)){
 selectPlan(corridorPrefix+requested);
 const url=new URL(location.href);
 url.searchParams.delete('target');
 history.replaceState(null,'',url);
 save();
}
render();
})();
