'use strict';
importScripts('./monte-carlo-core.js?v=mc1');
let dataset;
self.onmessage=async event=>{
 try{
  dataset??=await fetch('./monte-carlo-costs.json?v=mc1').then(response=>{if(!response.ok)throw Error('Could not load route data');return response.json()});
  const result=TrainMonteCarloCore.sampleDemand(dataset,event.data,progress=>self.postMessage({type:'progress',data:progress}));self.postMessage({type:'result',data:result});
 }catch(error){self.postMessage({type:'error',message:error.message})}
};
