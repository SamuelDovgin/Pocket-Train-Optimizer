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
 return {done,balance:Number.isFinite(amount)&&amount>=0?Math.round(amount):7961,owners,costs,notes,plan:['advanced','original','refined'].includes(v.plan)?v.plan:defaultPlan};
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
function buildQueue(D,state,owner){
 const complete=new Set(Object.keys(state.done).filter(id=>state.done[id]===true));
 const edgeById=new Map(D.edges.map(e=>[e.id,e]));
 const steps=D.steps.map(s=>({...s}));
 const listed=new Set(steps.map(s=>s.id));
 // Restoring any originally completed track must put it back in the queue.
 for(const e of D.edges)if(!listed.has(e.id)&&!complete.has(e.id))steps.push({...e,kind:'track',rank:0,stage:0,tier:'Restored track'});
 const remaining=steps.filter(s=>!complete.has(s.id)).sort((a,b)=>a.rank-b.rank||a.id.localeCompare(b.id));
 const reached=new Set(),lineNodes=new Map(),licenses=new Set(['Europe']);
 const add=e=>{for(const c of [e.a,e.b]){reached.add(c);const l=owner(e);if(!lineNodes.has(l))lineNodes.set(l,new Set());lineNodes.get(l).add(c)}};
 for(const e of D.edges)if(complete.has(e.id))add(e);
 for(const l of D.licenses)if(complete.has(l.id))licenses.add(l.region);
 const reasons=s=>{
  if(s.kind==='license')return [];
  const why=[],regions=[...new Set([D.regions[s.a],D.regions[s.b]])];
  const missing=regions.filter(r=>!licenses.has(r));if(missing.length)why.push('Needs '+missing.join(' + ')+' license');
  if(!reached.has(s.a)&&!reached.has(s.b))why.push('Connect to your network first');
  const nodes=lineNodes.get(owner(edgeById.get(s.id)||s));
  if(nodes&&!nodes.has(s.a)&&!nodes.has(s.b))why.push('Extend this railroad to an endpoint first');
  return why;
 };
 const now=new Map(remaining.map(s=>[s.id,reasons(s)])),ordered=[];
 while(remaining.length){let i=remaining.findIndex(s=>reasons(s).length===0);if(i<0){ordered.push(...remaining);break}const [s]=remaining.splice(i,1);ordered.push(s);if(s.kind==='license')licenses.add(s.region);else add(edgeById.get(s.id)||s)}
 return ordered.map(s=>({...s,blocked:now.get(s.id)||[]}));
}
function auditOwners(D,owner,imputed){
 const issues=[];
 for(const line of D.lines){const edges=D.edges.filter(e=>owner(e)===line.name);if(!edges.length){issues.push(line.name+': no tracks assigned');continue}
  const visited=new Set([edges[0].a]);let more=true;while(more){more=false;for(const e of edges)if(visited.has(e.a)||visited.has(e.b))for(const c of [e.a,e.b])if(!visited.has(c)){visited.add(c);more=true}}
  if(edges.some(e=>!visited.has(e.a)||!visited.has(e.b)))issues.push(line.name+': planned tracks are disconnected');
  const fuel=edges.reduce((sum,e)=>sum+(e.fuel??imputed[e.id]),0);if(fuel>1100)issues.push(line.name+': exceeds the model’s 1,100 total-track-fuel limit');
 }
 return issues;
}
return {sanitizeSave,journey,buildQueue,auditOwners};
});
