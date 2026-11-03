/* Freeze a long-route recommendation before fresh-seed simulation. */
const fs = require('node:fs');
const C = require('../assets/operating-core.js');
const MapCore = require('../assets/corridor-map-core.js');
const data = require('../assets/corridor-data.json');
const prior = require('../assets/connected-corridors.json');
const search = JSON.parse(fs.readFileSync(0, 'utf8'));
const plans = {...search.plans, connected: prior.plan};
const metrics = ['rewardPer1000Time', 'rewardPerTrain1000Time', 'rewardPerDispatch'];
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const tuneSeeds = [1842191, 1842397, 1842691];
const testSeeds = [1843711, 1843939, 1844141, 1844381, 1844609, 1844809, 1845037, 1845271];
const policy = prior.policy[prior.winner];
let simulations = 0;
function evaluate(plan, seeds) {
  const model = C.compile(data, plan);
  return Object.fromEntries(Object.entries(prior.scenarios).map(([name, options]) => {
    const rows = seeds.map(seed => {
      simulations++;
      return C.simulate(model, {...policy, ...options, seed});
    });
    return [name, Object.fromEntries(metrics.map(key => [key, mean(rows.map(row => row[key]))]))];
  }));
}
function shape(plan) {
  const through = new Set();
  const longThrough = new Set();
  const longCities = new Set();
  let short = 0;
  for (const line of plan.lines) {
    const loop = line.kind === 'loop';
    const interior = loop ? line.path.slice(0, -1) : line.path.slice(1, -1);
    for (const city of interior) through.add(city);
    if (loop || line.path.length < 5) short++;
    else {
      for (const city of interior) longThrough.add(city);
      for (const city of line.path) longCities.add(city);
    }
  }
  return {cities: plan.cities, fleet: plan.fleet, tracks: plan.tracks, short,
    hubs: plan.metrics.interchanges, through: through.size,
    throughHubs: plan.metrics.hubs.filter(hub => longThrough.has(hub.city)).length,
    longCities: longCities.size, meanSpan: plan.metrics.mean_span,
    meanDistance: mean(plan.lines.map(line => line.length))};
}
const shapes = Object.fromEntries(Object.entries(plans).map(([id, plan]) => [id, shape(plan)]));
const tuned = Object.fromEntries(Object.entries(plans).map(([id, plan]) => [id, evaluate(plan, tuneSeeds)]));
const base = shapes.connected;
const eligible = Object.entries(shapes).filter(([id, row]) => id !== 'connected' &&
  row.cities === base.cities && row.tracks >= base.tracks && row.through >= base.through - 2 &&
  row.throughHubs > base.throughHubs && row.short < base.short && row.meanSpan >= base.meanSpan);
function score(id, row) {
  const performance = mean(Object.keys(prior.scenarios).map(name =>
    .30 * Math.log(tuned[id][name].rewardPer1000Time / tuned.connected[name].rewardPer1000Time) +
    .30 * Math.log(tuned[id][name].rewardPerTrain1000Time / tuned.connected[name].rewardPerTrain1000Time) +
    .40 * Math.log(tuned[id][name].rewardPerDispatch / tuned.connected[name].rewardPerDispatch)
  ));
  return performance + .5 * Math.log(row.meanSpan / base.meanSpan) +
    .4 * Math.log(row.throughHubs / base.throughHubs) + .4 * Math.log(base.short / row.short);
}
const ranking = eligible.map(([id, row]) => ({id, score: score(id, row)})).sort((a,b) => b.score - a.score);
if (!ranking.length) throw Error('No candidate met the long-route constraints');
const winner = ranking[0].id;
const plan = plans[winner];
const heldout = {[winner]: evaluate(plan, testSeeds), connected: evaluate(prior.plan, testSeeds)};
const output = {winner, plan, shapes, ranking, runs: search.runs, tuned, heldout, policy,
  scenarios: prior.scenarios, tuneSeeds, testSeeds, simulations};
fs.writeFileSync('assets/long-haul-corridors.json', JSON.stringify(output));
fs.writeFileSync('assets/corridor-maps/long-haul.svg', MapCore.renderSVG(data, plan, {title: 'LONG-HAUL HUBS'}));
console.log(JSON.stringify({winner, ranking, shapes, heldout, simulations}, null, 2));
