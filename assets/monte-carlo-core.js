/* Deterministic paired job-batch resampling; no progress or game state is changed. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TrainMonteCarloCore=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
function random(seed){let state=seed>>>0;return ()=>{state=(state+0x6D2B79F5)>>>0;let x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);return ((x^(x>>>14))>>>0)/4294967296}}
function normal(rng){return Math.sqrt(-2*Math.log(Math.max(rng(),1e-12)))*Math.cos(2*Math.PI*rng())}
function quantile(sorted,p){const x=(sorted.length-1)*p,i=Math.floor(x);return sorted[i]+(sorted[Math.min(i+1,sorted.length-1)]-sorted[i])*(x-i)}
function summarize(values){const sorted=[...values].sort((a,b)=>a-b),mean=values.reduce((a,b)=>a+b,0)/values.length;return {mean_gain:mean,median_gain:quantile(sorted,.5),simulation_interval_90:[quantile(sorted,.05),quantile(sorted,.95)],fraction_lower_cost:values.filter(x=>x>1e-10).length/values.length,fraction_tied:values.filter(x=>Math.abs(x)<=1e-10).length/values.length}}
function sampleDemand(data,options,onProgress=()=>{}){
 const {seed=20261103,batches=200,jobs=500,scenario='uniform',sigma=.75}=options;
 if(!Number.isInteger(seed)||seed<0||seed>4294967295||!Number.isInteger(batches)||batches<10||batches>1000||!Number.isInteger(jobs)||jobs<20||jobs>2000||![0,.75,1.5].includes(sigma)||!['uniform','local','global','shorthaul','longhaul'].includes(scenario))throw Error('Invalid simulation settings');
 const rng=random(seed),pairs=data.pair_a.length,n=data.city_regions.length,profiles=Object.keys(data.comparisons),gains=Object.fromEntries(profiles.map(p=>[p,[]]));
 const cdf=new Float64Array(pairs),popularity=new Float64Array(n),prior=new Float64Array(pairs);
 for(let i=0;i<pairs;i++){
  const same=data.city_regions[data.pair_a[i]]===data.city_regions[data.pair_b[i]],distance=data.shortest[i];
  prior[i]=scenario==='local'?(same?5:1):scenario==='global'?(same?1:5):scenario==='shorthaul'?(distance<=450?4:1):scenario==='longhaul'?(distance>=1100?4:1):1;
 }
 for(let batch=0;batch<batches;batch++){
  for(let i=0;i<n;i++)popularity[i]=Math.exp(-.5*sigma*sigma+sigma*normal(rng));
  let total=0;for(let i=0;i<pairs;i++){total+=prior[i]*popularity[data.pair_a[i]]*popularity[data.pair_b[i]];cdf[i]=total}
  const sums=Object.fromEntries(profiles.map(p=>[p,0]));
  for(let job=0;job<jobs;job++){
   const draw=rng()*total;let lo=0,hi=pairs-1;while(lo<hi){const mid=(lo+hi)>>>1;if(cdf[mid]<draw)lo=mid+1;else hi=mid}
   for(const profile of profiles){const comparison=data.comparisons[profile];sums[profile]+=data.costs[comparison.before][lo]-data.costs[comparison.after][lo]}
  }
  for(const profile of profiles)gains[profile].push(sums[profile]/jobs);
  if(batch%10===0)onProgress({completed:batch+1,total:batches});
 }
 return {seed,batches,jobs,scenario,sigma,sampled_jobs:batches*jobs,results:Object.fromEntries(profiles.map(p=>[p,summarize(gains[p])])),interpretation:'Paired synthetic fixed-size job batches with exchangeable city hotspot weights. Positive gain means lower route cost than the pre-Monte-Carlo plan. These intervals are not predictions of actual game profits.'};
}
return {random,summarize,sampleDemand};
});
