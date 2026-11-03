/* Compare coverage candidates on tuning seeds before running a separate validation set. */
const fs = require('node:fs');
const C = require('../assets/operating-core.js');
const maps = require('../assets/corridor-map-core.js');
const data = require('../assets/corridor-data.json');
const previous = require('../assets/corridor-results.json');
const search = JSON.parse(fs.readFileSync(0, 'utf8'));
const sparse = previous.selection.recommendation;
const plans = {...search.plans};
for (const id of [sparse, 'network_long_b', 'network_hubs_b', 'network_dense_b', 'all_tracks_a']) {
  plans[id] = data.plans[id];
}
const scenarios = Object.fromEntries(
  ['uniform', 'local', 'global', 'infrequent', 'refueling', 'high_capacity']
    .map(name => [name, previous.evaluation[name].options])
);
const tuningSeeds = [986421, 986697, 987149];
const heldoutSeeds = [988093, 988661, 989089, 989647, 990179, 990809, 991327, 991723];
const metrics = ['rewardPer1000Time', 'rewardPerTrain1000Time', 'rewardPerDispatch', 'meanTransfers'];
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const models = Object.fromEntries(Object.entries(plans).map(([id, plan]) => [id, C.compile(data, plan)]));
const policy = Object.fromEntries(Object.keys(plans).map(id => [id, previous.trained[id] || previous.trained[sparse]]));
let simulations = 0;
function evaluate(ids, seeds) {
  return Object.fromEntries(ids.map(id => {
    const rows = Object.entries(scenarios).map(([name, options]) => {
      const runs = seeds.map(seed => {
        simulations++;
        return C.simulate(models[id], {...policy[id], ...options, seed});
      });
      return [name, Object.fromEntries(metrics.map(key => [key, mean(runs.map(run => run[key]))]))];
    });
    return [id, Object.fromEntries(rows)];
  }));
}
function shape(plan) {
  const through = new Set();
  const onLongRoute = new Set();
  let shortRoutes = 0;
  for (const line of plan.lines) {
    const path = line.kind === 'loop' ? line.path.slice(0, -1) : line.path;
    for (const city of line.kind === 'loop' ? path : path.slice(1, -1)) through.add(city);
    if (line.kind === 'path' && path.length >= 5) {
      for (const city of path) onLongRoute.add(city);
    } else {
      shortRoutes++;
    }
  }
  return {throughCities: through.size, citiesOnFiveStopRoutes: onLongRoute.size,
    shortRoutes, hubs: plan.metrics.interchanges};
}
const structures = Object.fromEntries(Object.entries(plans).map(([id, plan]) => [id, shape(plan)]));
const tuning = evaluate(Object.keys(plans), tuningSeeds);
const weights = [.45, .25, .30];
function score(id) {
  const demandScore = mean(Object.keys(scenarios).map(name =>
    weights.reduce((sum, weight, index) => {
      const key = metrics[index];
      return sum + weight * Math.log(tuning[id][name][key] / tuning[sparse][name][key]);
    }, 0)
  ));
  const structure = structures[id];
  const base = structures[sparse];
  return Math.exp(demandScore + .5 * (structure.throughCities - base.throughCities) / data.cities.length
    + .5 * (structure.citiesOnFiveStopRoutes - base.citiesOnFiveStopRoutes) / data.cities.length
    - .01 * plans[id].cycles);
}
const scores = Object.fromEntries(Object.keys(plans).map(id => [id, score(id)]));
const eligible = Object.keys(plans).filter(id => {
  const plan = plans[id];
  return plan.tracks > plans[sparse].tracks && !plan.pressure.full && plan.cycles <= 2
    && structures[id].throughCities >= structures[sparse].throughCities;
});
const winner = eligible.sort((a, b) => scores[b] - scores[a])[0];
if (!winner || scores[winner] <= 1) throw Error('No denser layout improved on the sparse tuning score');
const heldout = evaluate([...new Set([winner, sparse, 'network_hubs_b', 'all_tracks_a'])], heldoutSeeds);
const plan = plans[winner];
const rows = Object.fromEntries(Object.entries(plans).map(([id, p]) => [id,
  {tracks: p.tracks, fleet: p.fleet, loops: p.cycles, ...structures[id], score: scores[id]}]));
const output = {winner, sparse, plan, rows, tuning, heldout, tuningSeeds, heldoutSeeds, weights,
  scenarios, policy, simulations, runs: search.runs};
fs.writeFileSync('assets/connected-corridors.json', JSON.stringify(output));
fs.writeFileSync('assets/corridor-maps/connected.svg', maps.renderSVG(data, plan,
  {title: 'CONNECTED LONG ROUTES'}));
console.log(JSON.stringify({winner, simulations, rows, heldout}, null, 2));
