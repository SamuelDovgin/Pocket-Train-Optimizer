/* Discrete-event, one-train-per-line service model shared by Node and Worker. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainOperatingCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
class Heap{constructor(){this.a=[]}push(x){const a=this.a;a.push(x);let i=a.length-1;while(i){const p=(i-1)>>1;if(compare(a[p],x)<=0)break;a[i]=a[p];i=p}a[i]=x}pop(){const a=this.a;if(!a.length)return null;const out=a[0],last=a.pop();if(a.length){let i=0;while(2*i+1<a.length){let j=2*i+1;if(j+1<a.length&&compare(a[j+1],a[j])<0)j++;if(compare(last,a[j])<=0)break;a[i]=a[j];i=j}a[i]=last}return out}get length(){return this.a.length}}
function compare(a,b){return a.t-b.t||(a.kind??0)-(b.kind??0)||(a.order??0)-(b.order??0)}
function hash(...values){let h=2166136261;for(const value of values)for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0}
function random(seed){let x=seed>>>0;return ()=>{x=(x+0x6D2B79F5)>>>0;let z=x;z=Math.imul(z^(z>>>15),z|1);z^=z+Math.imul(z^(z>>>7),z|61);return ((z^(z>>>14))>>>0)/4294967296}}
function shortest(adj,start,excludeTransferCity=null,nodeCity=[]){const n=adj.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1),queue=new Heap();dist[start]=0;queue.push({t:0,node:start});while(queue.length){const x=queue.pop();if(x.t!==dist[x.node])continue;for(const e of adj[x.node]){if(e.transfer&&nodeCity[x.node]===excludeTransferCity)continue;const v=x.t+e.d;if(v<dist[e.to]-1e-9){dist[e.to]=v;prev[e.to]=x.node;queue.push({t:v,node:e.to})}}}return {dist,prev}}
function projected([lon,lat]){return [lon,180/Math.PI*Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))]}
function compile(data,plan){
 const cities=data.cities,ci=new Map(cities.map((c,i)=>[c,i])),edges=data.edges.filter(e=>Object.hasOwn(plan.owners,e.id));
 if(cities.length<2||new Set(cities).size!==cities.length)throw Error('Invalid city list');
 const ordered=[...plan.lines].sort((a,b)=>edges.filter(e=>plan.owners[e.id]===a.name).map(e=>e.id).sort()[0].localeCompare(edges.filter(e=>plan.owners[e.id]===b.name).map(e=>e.id).sort()[0]));
 const names=ordered.map(l=>l.name),li=new Map(names.map((x,i)=>[x,i])),lines=ordered.map((l,i)=>({...l,index:i,adj:Array.from({length:cities.length},()=>[])})),nodes=[],nodeCity=[],nodeLine=[],states=Array.from({length:cities.length},()=>[]),stateId=new Map(),edgeMap=new Map();
 function state(city,line){const key=city+'|'+line;if(!stateId.has(key)){const id=nodes.length;stateId.set(key,id);nodes.push([]);nodeCity.push(city);nodeLine.push(line);states[city].push(id)}return stateId.get(key)}
 for(const e of edges){if(!ci.has(e.a)||!ci.has(e.b)||!li.has(plan.owners[e.id])||!Number.isFinite(e.fuel)||e.fuel<=0)throw Error('Invalid operating track');const a=ci.get(e.a),b=ci.get(e.b),l=li.get(plan.owners[e.id]),u=state(a,l),v=state(b,l);nodes[u].push({to:v,d:e.fuel});nodes[v].push({to:u,d:e.fuel});lines[l].adj[a].push({to:b,d:e.fuel});lines[l].adj[b].push({to:a,d:e.fuel});edgeMap.set(a+'|'+b,e.fuel);edgeMap.set(b+'|'+a,e.fuel)}
 if(states.some(x=>!x.length))throw Error('Every city must be served');
 for(const ids of states)for(const a of ids)for(const b of ids)if(a!==b)nodes[a].push({to:b,d:40,transfer:true});
 for(const line of lines){line.walk=line.patrol.map(c=>ci.get(c));if(line.walk.length<3||line.walk[0]!==line.walk.at(-1))throw Error('Patrol must be a closed physical walk');line.cycle=0;
  for(let i=1;i<line.walk.length;i++){const edge=line.adj[line.walk[i-1]].find(e=>e.to===line.walk[i]);if(!edge)throw Error('Patrol leaves its railroad');line.cycle+=edge.d}
  const covered=new Set(line.walk.slice(1).map((c,i)=>[c,line.walk[i]].sort((a,b)=>a-b).join('|'))),mine=edges.filter(e=>li.get(plan.owners[e.id])===line.index);if(covered.size!==mine.length)throw Error('Patrol does not cover every assigned edge');
  line.routes=new Map();for(const c of new Set(line.walk))line.routes.set(c,shortest(line.adj,c));
 }
 const reach=shortest(nodes,0);if([...reach.dist].some(x=>!Number.isFinite(x)))throw Error('Disconnected world');
 const sourceCache=new Map(),routeCache=new Map();
 function route(origin,destination,line){const key=origin+','+destination+','+line;if(routeCache.has(key))return routeCache.get(key);const start=stateId.get(origin+'|'+line);if(start===undefined)throw Error('Train is not at origin');const sk=origin+'|'+line;let tree=sourceCache.get(sk);if(!tree){tree=shortest(nodes,start,origin,nodeCity);sourceCache.set(sk,tree)}let end=states[destination].reduce((a,b)=>tree.dist[a]<=tree.dist[b]?a:b);if(!Number.isFinite(tree.dist[end])){routeCache.set(key,null);return null;}const walk=[];while(end!==start){const prev=tree.prev[end];if(prev<0)throw Error('Broken cargo route');if(nodeCity[prev]!==nodeCity[end])walk.push({line:nodeLine[prev],from:nodeCity[prev],to:nodeCity[end]});end=prev}walk.reverse();const stages=[];for(const hop of walk){const last=stages.at(-1);if(last&&last.line===hop.line)last.end=hop.to;else stages.push({line:hop.line,end:hop.to})}if(!stages.length||stages[0].line!==line||stages.some((s,i)=>i<stages.length-1&&s.end===origin))throw Error('Invalid origin transfer');routeCache.set(key,stages);return stages}
 const points=cities.map(c=>projected(data.coordinates[c])),rewards=points.map(a=>points.map(b=>Math.hypot(a[0]-b[0],a[1]-b[1])));
 // Scenario CDFs are hypothetical destination priors, not recovered app probabilities.
 function cdf(origin,scenario){let total=0;const list=[];for(let d=0;d<cities.length;d++){if(d===origin)continue;const same=data.regions[cities[d]]===data.regions[cities[origin]],w=scenario==='local'?(same?5:1):scenario==='global'?(same?1:5):scenario==='longhaul'?Math.max(.1,rewards[origin][d]):1;total+=w;list.push([d,total])}return {list,total}}
 return {data,plan,cities,ci,li,lines,edges,edgeMap,route,rewards,cdf};
}
function settings(input={}){const s={seed:20261103,horizon:16000,warmup:4000,capacity:12,reserveSlots:1,offers:12,yardCapacity:20,checkInterval:100,serviceTime:5,policy:'patrol',scenario:'uniform',tank:0,refuelRate:1,detourLimit:1.6,...input};
 for(const k of ['seed','horizon','warmup','capacity','offers','yardCapacity','checkInterval','serviceTime','tank'])if(!Number.isFinite(s[k])||s[k]<0)throw Error('Invalid '+k);
 if(!Number.isInteger(s.seed)||s.seed>4294967295||s.horizon<=s.warmup||s.horizon>100000||s.capacity<1||s.capacity>100||!Number.isInteger(s.reserveSlots)||s.reserveSlots<0||s.reserveSlots>=s.capacity||!Number.isInteger(s.capacity)||!Number.isInteger(s.offers)||s.offers>100||!Number.isInteger(s.yardCapacity)||s.yardCapacity>10000||!['patrol','cargo'].includes(s.policy)||!['uniform','local','global','longhaul'].includes(s.scenario)||!Number.isFinite(s.refuelRate)||s.refuelRate<=0||!Number.isFinite(s.detourLimit)||s.detourLimit<1)throw Error('Invalid simulation settings');return s}
function simulate(model,input={},onProgress=()=>{}){
 const s=settings(input),{lines,cities,edgeMap}=model,n=cities.length,events=new Heap(),yards=Array.from({length:n},()=>[]),visits=new Int32Array(n),cdfs=Array.from({length:n},(_,c)=>model.cdf(c,s.scenario));
 const trains=lines.map((line,i)=>{const index=hash(s.seed,':phase:',i)%(line.walk.length-1);return {line,index,city:line.walk[index],cargo:[],board:[],fuel:s.tank||Infinity,at:0,moving:null,previous:null,stationaryFrom:0,idleUntil:0,arrivals:0,distance:0,empty:0,loaded:0,idle:0,refuelWait:0,departures:0,blocked:0}});
 if(s.tank&&model.edges.some(e=>e.fuel>s.tank))throw Error('A track exceeds the assumed generic fuel tank');
 const stats={offered:0,discarded:0,delivered:0,deliveredAll:0,unroutable:0,reward:0,transfers:0,deliveryAge:[],yardWait:0,carriedDistance:0,originUnloads:0,events:0,dispatches:0,offeredMeasured:0},trace=[],curve=[],interval=s.horizon/40;let nextCurve=0,carId=0;
 const overlap=(a,b)=>Math.max(0,Math.min(b,s.horizon)-Math.max(a,s.warmup));
 function log(time,type,t,extra={}){if(input.trace&&trace.length<2000)trace.push({time,type,line:t.line.name,city:cities[t.city],...extra})}
 function board(t,time){const origin=t.city,ordinal=visits[origin]++,rng=random(hash(s.seed,':',origin,':',ordinal)),cdf=cdfs[origin];const out=[];for(let j=0;j<s.offers;j++){const draw=rng()*cdf.total;let lo=0,hi=cdf.list.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(cdf.list[mid][1]<draw)lo=mid+1;else hi=mid}const destination=cdf.list[lo][0],multiplier=1+Math.floor(rng()*4);out.push({id:carId++,origin,destination,reward:model.rewards[origin][destination]*multiplier,stages:null,stage:0,spawn:time,travelled:0,yardWait:0,transfers:0});stats.offered++;if(time>=s.warmup)stats.offeredMeasured++}return out}
 function transit(t,a,b,start,end){const distance=edgeMap.get(a+'|'+b),ratio=overlap(start,end)/(end-start);t.distance+=distance*ratio;t.loaded+=distance*ratio*t.cargo.length;if(!t.cargo.length)t.empty+=distance*ratio;for(const car of t.cargo)car.travelled+=distance}
 function arrival(t,time){
  if(t.moving){const m=t.moving;transit(t,m.from,m.to,m.start,time);t.previous=m.from;t.city=m.to;t.moving=null}
  t.at=time;t.stationaryFrom=time;t.arrivals++;const keep=[];
  for(const car of t.cargo){if(car.destination===t.city){stats.deliveredAll++;if(time>=s.warmup){stats.delivered++;stats.reward+=car.reward;stats.deliveryAge.push(time-car.spawn);stats.yardWait+=car.yardWait;stats.carriedDistance+=car.travelled}log(time,'deliver',t,{car:car.id,destination:cities[car.destination]})}else keep.push(car)}
  t.cargo=keep;t.board=board(t,time);log(time,'arrive',t,{board:t.board.length,onboard:t.cargo.length});let ready=time+s.serviceTime;if(s.checkInterval)ready=Math.ceil(ready/s.checkInterval-1e-10)*s.checkInterval;t.idleUntil=ready;events.push({t:ready,kind:1,order:t.line.index,train:t});
 }
 function service(t,time){
  const pendingDrops=[],keep=[];let count=t.cargo.length;
  for(const car of t.cargo){const stage=car.stages[car.stage];if(stage.end===t.city&&car.stage+1<car.stages.length)pendingDrops.push(car);else keep.push(car)}
  for(const car of pendingDrops){
   if(t.city===car.origin)throw Error('Attempted origin yard unload');
   if(yards[t.city].length>=s.yardCapacity&&count<s.capacity){const index=yards[t.city].findIndex(c=>c.stages[c.stage].line===t.line.index);if(index>=0){const pickup=yards[t.city].splice(index,1)[0];pickup.yardWait+=time-pickup.queued;keep.push(pickup);count++;log(time,'yard-exchange-pickup',t,{car:pickup.id})}}
   if(yards[t.city].length<s.yardCapacity){car.stage++;car.transfers++;car.queued=time;yards[t.city].push(car);count--;if(time>=s.warmup)stats.transfers++;log(time,'yard-drop',t,{car:car.id,nextLine:lines[car.stages[car.stage].line].name})}
   else{t.blocked++;keep.push(car);log(time,'yard-full',t,{car:car.id})}
  }
  t.cargo=keep;events.push({t:time,kind:2,order:t.line.index,train:t});
 }
 function lineDistance(t,target){return t.line.routes.get(t.city).dist[target]}
 function patrolDistance(t,target){let distance=0;const walk=t.line.walk;for(let k=1;k<walk.length;k++){const a=walk[(t.index+k-1)%(walk.length-1)],b=walk[(t.index+k)%(walk.length-1)];distance+=edgeMap.get(a+'|'+b);if(b===target)return distance}return Infinity}
 function nextToward(t,target){const tree=t.line.routes.get(target);return t.line.adj[t.city].reduce((a,b)=>a.d+tree.dist[a.to]<=b.d+tree.dist[b.to]?a:b).to}
 function dispatch(t,time){
  const candidates=[];for(const car of yards[t.city])if(car.stages[car.stage].line===t.line.index)candidates.push({car,yard:true});for(const car of t.board){car.stages=model.route(t.city,car.destination,t.line.index);if(car.stages)candidates.push({car,yard:false});else stats.unroutable++}
  const priority=car=>car.reward*(1+(time-car.spawn)/3000)/Math.max(1,lineDistance(t,car.stages[car.stage].end));
  let next=t.line.walk[(t.index+1)%(t.line.walk.length-1)];if(s.policy==='cargo'){const useful=t.cargo.filter(c=>c.stages[c.stage].end!==t.city);const targets=useful.length?useful:candidates.map(x=>x.car);if(targets.length){const car=targets.reduce((a,b)=>priority(a)>=priority(b)?a:b);next=nextToward(t,car.stages[car.stage].end)}}
  const distanceTo=target=>s.policy==='patrol'?patrolDistance(t,target):lineDistance(t,target);
  const eligible=candidates.filter(({car})=>{const target=car.stages[car.stage].end,dist=lineDistance(t,target);return s.policy==='patrol'?distanceTo(target)<=s.detourLimit*dist+1e-9:t.line.routes.get(target).dist[next]<dist-1e-9});
  eligible.sort((a,b)=>{const value=x=>x.car.reward*(1+(time-x.car.spawn)/3000)/Math.max(1,distanceTo(x.car.stages[x.car.stage].end))+(x.yard?1000000:0);return value(b)-value(a)||a.car.id-b.car.id});
  for(const item of eligible){if(t.cargo.length>=s.capacity-s.reserveSlots)break;const car=item.car;if(item.yard){yards[t.city].splice(yards[t.city].indexOf(car),1);car.yardWait+=time-car.queued;log(time,'yard-pickup',t,{car:car.id})}else t.board.splice(t.board.indexOf(car),1);t.cargo.push(car)}
  const d=edgeMap.get(t.city+'|'+next);let departure=time;if(s.tank){t.fuel=Math.min(s.tank,t.fuel+(time-t.at)*s.refuelRate);if(t.fuel<d){departure+=(d-t.fuel)/s.refuelRate;if(s.checkInterval)departure=Math.ceil(departure/s.checkInterval-1e-10)*s.checkInterval;t.refuelWait+=overlap(time,departure);t.fuel=Math.min(s.tank,t.fuel+(departure-time)*s.refuelRate)}}
  t.idleUntil=departure;events.push({t:departure,kind:3,order:t.line.index,train:t,next,d});
 }
 function depart(t,time,next,d){
  t.idle+=overlap(t.stationaryFrom,time);if(s.tank)t.fuel-=d;if(t.fuel<-.000001)throw Error('Negative fuel');stats.discarded+=t.board.length;t.board=[];if(time>=s.warmup){t.departures++;stats.dispatches++}
  log(time,'depart',t,{to:cities[next],onboard:t.cargo.length,fuel:s.tank?t.fuel:null});
  if(s.policy==='patrol')t.index=(t.index+1)%(t.line.walk.length-1);else{const index=t.line.walk.slice(0,-1).findIndex((c,i)=>c===next&&t.line.walk[(i-1+t.line.walk.length-1)%(t.line.walk.length-1)]===t.city);t.index=index>=0?index:t.line.walk.slice(0,-1).indexOf(next)}
  t.moving={from:t.city,to:next,start:time,end:time+d};events.push({t:time+d,kind:0,order:t.line.index,train:t});
 }
 for(const t of trains)events.push({t:0,kind:0,order:t.line.index,train:t});
 while(events.length){const e=events.pop();if(e.t>s.horizon)break;const t=e.train;if(e.kind===0)arrival(t,e.t);else if(e.kind===1)service(t,e.t);else if(e.kind===2)dispatch(t,e.t);else depart(t,e.t,e.next,e.d);stats.events++;if(e.t>=nextCurve){curve.push({time:e.t,reward:stats.reward,delivered:stats.delivered});nextCurve+=interval}if(stats.events%2000===0)onProgress({time:e.t,total:s.horizon,events:stats.events});if(stats.events>3000000)throw Error('Simulation event limit exceeded')}
 for(const t of trains){if(t.moving){const m=t.moving,d=edgeMap.get(m.from+'|'+m.to),ratio=overlap(m.start,s.horizon)/d;t.distance+=d*ratio;t.loaded+=d*ratio*t.cargo.length;if(!t.cargo.length)t.empty+=d*ratio;for(const car of t.cargo)car.travelled+=Math.max(0,s.horizon-m.start)}else t.idle+=overlap(t.stationaryFrom,s.horizon)}
 // Finish the chart after all events at the horizon, including simultaneous deliveries.
 const endpoint={time:s.horizon,reward:stats.reward,delivered:stats.delivered};
 if(curve.at(-1)?.time===s.horizon)curve[curve.length-1]=endpoint;else curve.push(endpoint);
 const elapsed=s.horizon-s.warmup,distance=trains.reduce((a,t)=>a+t.distance,0),loaded=trains.reduce((a,t)=>a+t.loaded,0),empty=trains.reduce((a,t)=>a+t.empty,0),idle=trains.reduce((a,t)=>a+t.idle,0),onboard=trains.reduce((a,t)=>a+t.cargo.length,0),inYards=yards.reduce((a,y)=>a+y.length,0),onBoards=trains.reduce((a,t)=>a+t.board.length,0),deliveredAll=stats.deliveredAll;
 const ages=[...stats.deliveryAge].sort((a,b)=>a-b),mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
 // Count all deliveries independently for conservation, including warmup.
 const result={settings:s,plan:model.plan.label,fleet:lines.length,elapsed,reward:stats.reward,deliveredCars:stats.delivered,rewardPer1000Time:stats.reward*1000/elapsed,rewardPerTrain1000Time:stats.reward*1000/elapsed/lines.length,carsPer1000Time:stats.delivered*1000/elapsed,loadFactor:distance?loaded/(distance*s.capacity):0,emptyDistanceShare:distance?empty/distance:0,stationaryShare:idle/(elapsed*lines.length),meanDeliveryTime:mean(ages),p95DeliveryTime:ages.length?ages[Math.floor((ages.length-1)*.95)]:null,meanYardWait:stats.delivered?stats.yardWait/stats.delivered:null,meanCarriedDistance:stats.delivered?stats.carriedDistance/stats.delivered:null,dispatches:stats.dispatches,transfers:stats.transfers,blockedYardEvents:trains.reduce((a,t)=>a+t.blocked,0),distance,loadedCarDistance:loaded,emptyDistance:empty,offeredCars:stats.offered,unroutableOffers:stats.unroutable,discardedOffers:stats.discarded,deliveredAll,onboardCars:onboard,yardCars:inYards,boardCars:onBoards,inventory:trains.flatMap(t=>t.cargo).concat(yards.flat()).map(c=>({id:c.id,origin:cities[c.origin],destination:cities[c.destination],age:s.horizon-c.spawn})),curve,lines:trains.map(t=>({name:t.line.name,distance:t.distance,empty:t.empty,loadedCarDistance:t.loaded,stationaryTime:t.idle,refuelWait:t.refuelWait,departures:t.departures,blockedYardEvents:t.blocked,onboard:t.cargo.length,city:cities[t.city],inTransit:!!t.moving})),trace:input.trace?trace:undefined};
 for(const t of result.lines)if(Math.abs(t.distance+t.stationaryTime-elapsed)>1e-6)throw Error('Train time conservation failed: '+t.name);
 if(stats.offered!==deliveredAll+stats.discarded+onboard+inYards+onBoards||deliveredAll<stats.delivered||!Number.isInteger(deliveredAll)||result.loadFactor>1+1e-9)throw Error('Cargo/capacity conservation failed');return result;
}
return {Heap,hash,random,settings,compile,simulate};
});
