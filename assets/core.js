/* Pure routing, queue and save logic, shared by browser and regression tests. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const record=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function sanitizeSave(v,D,defaultPlan='advanced'){
 if(!record(v)||!record(v.done))throw Error('Missing valid completion flags');
 const ids=new Set([...D.edges,...D.licenses].map(x=>x.id)),lines=new Set(D.lines.map(x=>x.name));
 const done=Object.fromEntries([...D.base,...D.done].map(id=>[id,true]));
 for(const [id,value] of Object.entries(v.done))if(ids.has(id)&&typeof value==='boolean')done[id]=value;
 if(v.version===1||(!v.version&&v.coins!==undefined)){
  const legacy=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  for(const e of D.edges)if(v.done[legacy(e.a+'-'+e.b)]===true||v.done[legacy(e.b+'-'+e.a)]===true)done[e.id]=true;
  if(v.done['asia-license']===true)done['license-asia']=true;
 }
 const owners={},costs={},notes={};
 for(const [id,value] of Object.entries(record(v.owners)?v.owners:{}))if(ids.has(id)&&lines.has(value))owners[id]=value;
 for(const [id,value] of Object.entries(record(v.costs)?v.costs:{}))if(ids.has(id)&&Number.isFinite(value)&&value>=0&&value<=Number.MAX_SAFE_INTEGER)costs[id]=Math.round(value);
 for(const [id,value] of Object.entries(record(v.notes)?v.notes:{}))if(ids.has(id)&&typeof value==='string')notes[id]=value.slice(0,500);
 const amount=v.balance??v.coins;
 const restored={done,balance:Number.isFinite(amount)&&amount>=0?Math.round(amount):7961,owners,costs,notes,plan:['searched','rework','consolidated','advanced','original','refined'].includes(v.plan)?v.plan:defaultPlan,corrections:Array.isArray(v.corrections)?v.corrections.filter(x=>record(x)&&D.edges.some(e=>e.id===x.trackId)&&lines.has(x.from)&&lines.has(x.to)&&x.from!==x.to).map(x=>({trackId:x.trackId,from:x.from,to:x.to,at:typeof x.at==='string'?x.at:'',batchId:typeof x.batchId==='string'?x.batchId:'',cost:Number.isFinite(x.cost)&&x.cost>=0?Math.round(x.cost):null})):[]};
 const last=v.lastCheckoff;
 if(record(last)&&last.kind==='completion'&&ids.has(last.id)&&
   [null,true,false].includes(last.beforeDone)&&typeof last.afterDone==='boolean'&&
   [last.beforeOwner,last.afterOwner].every(name=>name===null||lines.has(name))){
  restored.lastCheckoff={kind:'completion',id:last.id,beforeDone:last.beforeDone,
   afterDone:last.afterDone,beforeOwner:last.beforeOwner,afterOwner:last.afterOwner};
 }else if(record(last)&&last.kind==='correction'&&typeof last.batchId==='string'&&last.batchId&&
          restored.corrections.some(item=>item.batchId===last.batchId)){
  restored.lastCheckoff={kind:'correction',batchId:last.batchId};
 }
 return restored;
}
function journey(D,imputed,a,b,owner,eligible,penalty){
 if(!Object.hasOwn(D.regions,a)||!Object.hasOwn(D.regions,b)||!Number.isFinite(penalty)||penalty<0)return null;
 if(a===b)return {fuel:0,transfers:0,sections:[],score:0};
 const adj=new Map(),cityLines=new Map(),key=(c,l)=>JSON.stringify([c,l]);
 const add=(u,v,c,kind,fuel=0,estimated=false)=>{if(!adj.has(u))adj.set(u,[]);adj.get(u).push({to:v,c,kind,fuel,estimated})};
 for(const e of D.edges.filter(eligible)){
  const line=owner(e),fuel=e.fuel??imputed[e.id];
  if(!Number.isFinite(fuel)||fuel<=0)throw Error('Missing positive fuel length: '+e.id);
  const x=key(e.a,line),y=key(e.b,line);
  add(x,y,fuel,'track',fuel,e.fuel==null);add(y,x,fuel,'track',fuel,e.fuel==null);
  for(const c of [e.a,e.b]){if(!cityLines.has(c))cityLines.set(c,new Set());cityLines.get(c).add(line)}
 }
 if(!cityLines.has(a)||!cityLines.has(b))return null;
 for(const [city,lines] of cityLines)for(const x of [...lines].sort())for(const y of [...lines].sort())if(x!==y)add(key(city,x),key(city,y),penalty,'transfer');
 const src='START',dest='END';
 for(const line of [...cityLines.get(a)].sort())add(src,key(a,line),0,'enter');
 for(const line of [...cityLines.get(b)].sort())add(key(b,line),dest,0,'exit');
 // Lexicographic Dijkstra: minimum generalized cost, then minimum transfers.
 const dist=new Map([[src,[0,0]]]),prev=new Map(),used=new Set();
 const better=(x,y)=>!y||x[0]<y[0]-1e-8||(Math.abs(x[0]-y[0])<1e-8&&x[1]<y[1]);
 while(true){
  let u=null,best=null;
  for(const [id,value] of dist)if(!used.has(id)&&better(value,best)){u=id;best=value}
  if(u===null||u===dest)break;used.add(u);
  for(const edge of adj.get(u)||[]){const alt=[best[0]+edge.c,best[1]+(edge.kind==='transfer'?1:0)];
   if(!used.has(edge.to)&&better(alt,dist.get(edge.to))){dist.set(edge.to,alt);prev.set(edge.to,{from:u,...edge})}
  }
 }
 if(!dist.has(dest))return null;
 const legs=[];let cur=dest,fuel=0;
 while(cur!==src){const p=prev.get(cur);if(!p)throw Error('Broken route');if(p.kind==='track'){const [city,line]=JSON.parse(p.from),[to]=JSON.parse(cur);fuel+=p.fuel;legs.push({a:city,b:to,line,fuel:p.fuel,estimated:p.estimated})}cur=p.from}
 const sections=[];
 for(const leg of legs.reverse()){const last=sections.at(-1);if(last&&last.line===leg.line){last.stops.push(leg.b);last.fuel+=leg.fuel;last.estimated||=leg.estimated}else sections.push({line:leg.line,stops:[leg.a,leg.b],fuel:leg.fuel,estimated:leg.estimated})}
 return {fuel,transfers:dist.get(dest)[1],sections,score:dist.get(dest)[0]};
}
function buildQueue(D,state,owner,targets=null,correctionRules=[]){
 const complete=new Set(Object.keys(state.done).filter(id=>state.done[id]===true));
 const edgeById=new Map(D.edges.map(e=>[e.id,e]));
 const goal=e=>targets?.[e.id]||owner(e);
 const simOwner=new Map(D.edges.map(e=>[e.id,complete.has(e.id)?owner(e):goal(e)]));
 const steps=D.steps.map(s=>({...s}));
 const listed=new Set(steps.map(s=>s.id));
 for(const e of D.edges)if(!listed.has(e.id)&&!complete.has(e.id))steps.push({...e,kind:'track',rank:0,stage:0,tier:'Restored track'});
 if(targets){
  const changes=D.edges.filter(e=>complete.has(e.id)&&owner(e)!==goal(e));
  const remainingChanges=new Set(changes.map(e=>e.id));
  while(remainingChanges.size){
   const first=edgeById.get(remainingChanges.values().next().value),from=owner(first),to=goal(first);
   const batch=[first];remainingChanges.delete(first.id);let added=true;
   while(added){added=false;const nodes=new Set(batch.flatMap(e=>[e.a,e.b]));
    for(const e of changes)if(remainingChanges.has(e.id)&&owner(e)===from&&goal(e)===to&&(nodes.has(e.a)||nodes.has(e.b))){batch.push(e);remainingChanges.delete(e.id);added=true}
   }
   const ids=batch.map(e=>e.id).sort();
   const rule=correctionRules.find(r=>ids.length===r.track_ids.length&&ids.every(id=>r.track_ids.includes(id))&&r.to===to&&r.from===from);
   steps.push({id:'reassign:'+from+':'+to+':'+ids.join(';'),trackId:first.id,trackIds:ids,tracks:batch,
    a:first.a,b:first.b,kind:'reassign',from,to,owner:to,rank:-1,stage:rule?.minimum_stage||0,requires:rule?.requires||[],ownerPrerequisites:rule?.owner_prerequisites||{},timing:rule||{minimum_stage:null,timing_reason:'Your saved owner differs from the reference starting map. No phase-specific gain was measured for this exact change; verify its timing.'},cost:null,
    tier:'CORRECT EXISTING OWNERSHIP',why:'Reclaim these built connections together for the target railroad. Keep the physical tracks built; verify the live fees and park the donor train safely first.'});
  }
 }
 const remaining=steps.filter(s=>s.kind==='reassign'||!complete.has(s.id)).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
 const licenses=new Set(['Europe']);for(const l of D.licenses)if(complete.has(l.id))licenses.add(l.region);
 const nodesFor=line=>new Set(D.edges.filter(e=>complete.has(e.id)&&simOwner.get(e.id)===line).flatMap(e=>[e.a,e.b]));
 const connected=edges=>{
  if(!edges.length)return true;
  const seen=new Set([edges[0].a]);let changed=true;
  while(changed){changed=false;for(const e of edges)if(seen.has(e.a)||seen.has(e.b))for(const c of [e.a,e.b])if(!seen.has(c)){seen.add(c);changed=true}}
  return edges.every(e=>seen.has(e.a)&&seen.has(e.b));
 };
 const reasons=s=>{
  if(s.kind==='license')return [];
  const why=[],missing=[...new Set([D.regions[s.a],D.regions[s.b]])].filter(r=>!licenses.has(r));
  if(missing.length)why.push('Needs '+missing.join(' + ')+' license');
  const built=D.edges.filter(e=>complete.has(e.id));
  if(!built.some(e=>[e.a,e.b].some(c=>c===s.a||c===s.b)))why.push('Connect to your network first');
  const target=s.kind==='reassign'?s.to:simOwner.get(s.id),nodes=nodesFor(target);
  const endpoints=s.kind==='reassign'?s.tracks.flatMap(e=>[e.a,e.b]):[s.a,s.b];
  if(nodes.size&&!endpoints.some(c=>nodes.has(c)))why.push('Extend '+target+' to an endpoint first');
  if(s.kind==='reassign'){
   const needed=(s.requires||[]).filter(id=>!complete.has(id));
   if(needed.length)why.push('Timing: finish '+needed.length+' purchase prerequisite'+(needed.length===1?'':'s')+' first');
   const prior=Object.entries(s.ownerPrerequisites||{}).filter(([id,line])=>simOwner.get(id)!==line);if(prior.length)why.push('Timing: record '+prior.length+' earlier ownership correction'+(prior.length===1?'':'s')+' first');
   const old=simOwner.get(s.trackId),left=built.filter(e=>!s.trackIds.includes(e.id)&&simOwner.get(e.id)===old);
   if(!connected(left))why.push('Build an alternate connection for '+old+' first');
  }
  return why;
 };
 const now=new Map(remaining.map(s=>[s.id,reasons(s)])),ordered=[];
 while(remaining.length){
  const i=remaining.findIndex(s=>reasons(s).length===0);
  if(i<0){ordered.push(...remaining);break}
  const [s]=remaining.splice(i,1);ordered.push(s);
  if(s.kind==='license')licenses.add(s.region);
  else if(s.kind==='reassign'){for(const id of s.trackIds)simOwner.set(id,s.to);}
  else complete.add(s.id);
 }
 return ordered.map(s=>{
  if(s.kind==='reassign'){
   const nodes=new Set(D.edges.filter(e=>state.done[e.id]===true&&owner(e)===s.to).flatMap(e=>[e.a,e.b]));
   const left=[...s.tracks],claimOrder=[];
   while(left.length){let i=left.findIndex(e=>nodes.has(e.a)||nodes.has(e.b));if(i<0)i=0;const [e]=left.splice(i,1);claimOrder.push(e);nodes.add(e.a);nodes.add(e.b)}
   s={...s,tracks:claimOrder};
  }
  return {...s,blocked:now.get(s.id)||[]};
 });
}
function recordCompletion(state,id,checked,assignedOwner){
 if((state.done[id]===true)===checked)return false;
 const beforeDone=state.done[id]??null,beforeOwner=state.owners[id]??null;
 state.done[id]=checked;
 if(checked&&assignedOwner!==undefined)state.owners[id]=assignedOwner;
 state.lastCheckoff={kind:'completion',id,beforeDone,afterDone:checked,
  beforeOwner,afterOwner:state.owners[id]??null};
 return true;
}
function undoLastCheckoff(state){
 const last=state.lastCheckoff;
 if(!last)return false;
 if(last.kind==='correction'){
  const index=state.corrections.findIndex(item=>item.batchId===last.batchId);
  if(index<0)return false;
  undoCorrection(state,index);
  return true;
 }
 if(state.done[last.id]!==last.afterDone||(state.owners[last.id]??null)!==last.afterOwner)return false;
 if(last.beforeDone===null)delete state.done[last.id];
 else state.done[last.id]=last.beforeDone;
 if(last.beforeOwner===null)delete state.owners[last.id];
 else state.owners[last.id]=last.beforeOwner;
 delete state.lastCheckoff;
 return true;
}
function applyCorrection(state,step){
 const ids=step.trackIds||[step.trackId];
 if(step.kind!=='reassign'||ids.some(id=>state.done[id]!==true))throw Error('Only built tracks can be reassigned');
 state.corrections??=[];
 const at=new Date().toISOString(),batchId=step.id+':'+at;
 for(const trackId of ids){state.owners[trackId]=step.to;state.corrections.push({trackId,from:step.from,to:step.to,at,batchId,cost:null});}
 state.lastCheckoff={kind:'correction',batchId};
}
function undoCorrection(state,index){
 const step=state.corrections?.[index];if(!step)throw Error('Correction not found');
 const group=state.corrections.map((x,i)=>({...x,index:i})).filter((x,i)=>step.batchId?x.batchId===step.batchId:i===index);
 for(const item of group){
  if(state.owners[item.trackId]!==item.to||state.corrections.slice(item.index+1).some(x=>x.trackId===item.trackId&&x.batchId!==item.batchId))throw Error('Undo the later correction for this track first');
 }
 const indexes=new Set(group.map(x=>x.index));
 for(const item of group)state.owners[item.trackId]=item.from;
 state.corrections=state.corrections.filter((x,i)=>!indexes.has(i));
 if(state.lastCheckoff?.kind==='correction'&&state.lastCheckoff.batchId===step.batchId)delete state.lastCheckoff;
}
function auditOwners(D,owner,imputed,{allowEmpty=false}={}){
 const issues=[];
 for(const line of D.lines){const edges=D.edges.filter(e=>owner(e)===line.name);if(!edges.length){if(!allowEmpty)issues.push(line.name+': no tracks assigned');continue}
  const visited=new Set([edges[0].a]);let more=true;while(more){more=false;for(const e of edges)if(visited.has(e.a)||visited.has(e.b))for(const c of [e.a,e.b])if(!visited.has(c)){visited.add(c);more=true}}
  if(edges.some(e=>!visited.has(e.a)||!visited.has(e.b)))issues.push(line.name+': planned tracks are disconnected');
  const fuel=edges.reduce((sum,e)=>sum+(e.fuel??imputed[e.id]),0);if(fuel>1100)issues.push(line.name+': exceeds the model’s 1,100 total-track-fuel limit');
 }
 return issues;
}
return {sanitizeSave,journey,buildQueue,auditOwners,recordCompletion,undoLastCheckoff,applyCorrection,undoCorrection};
});
