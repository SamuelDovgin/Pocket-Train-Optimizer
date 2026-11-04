/* Pick a second no-two-stop target that preserves operating performance. */
const fs = require('node:fs');
const C = require('../assets/operating-core.js');
const data = require('../assets/corridor-data.json');
const longHaul = require('../assets/long-haul-corridors.json');
const reportPath = 'assets/average-corridors.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const pool = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const settings = ['uniform', 'local', 'infrequent', 'refueling'];
const seeds = [287439, 288761];
const metrics = ['rewardPer1000Time', 'rewardPerTrain1000Time', 'rewardPerDispatch'];
const mean = values => values.reduce((total, value) => total + value, 0) / values.length;

function rates(plan) {
  const model = C.compile(data, plan);
  return settings.map(name => {
    const runs = seeds.map(seed => C.simulate(model, {...longHaul.policy, ...longHaul.scenarios[name], seed}));
    return metrics.map(metric => mean(runs.map(run => run[metric])));
  });
}

const base = rates(longHaul.plan);
const baseDistance = longHaul.plan.metrics.total_track_distance / longHaul.plan.fleet;
const candidates = Object.entries(pool).filter(([id, plan]) =>
  id !== report.winner && plan.metrics.total_track_distance / plan.fleet >= baseDistance - 1e-8);
const rows = candidates.map(([id, plan]) => {
  const observations = rates(plan);
  const gains = metrics.map((_, column) => mean(observations.map((row, index) =>
    Math.log(row[column] / base[index][column]))));
  const distance = plan.metrics.total_track_distance / plan.fleet;
  const score = .25 * Math.log(distance / baseDistance) + .25 * gains[0] + .25 * gains[1] + .25 * gains[2];
  return {id, distance, score, ratios: Object.fromEntries(metrics.map((metric, i) => [metric, Math.exp(gains[i])]))};
}).sort((a, b) => b.score - a.score);
if (!rows.length) throw Error('No operating alternative met the distance floor');
report.balanced = {id: rows[0].id, plan: pool[rows[0].id], settings, seeds, candidates: rows};
fs.writeFileSync(reportPath, JSON.stringify(report) + '\n');
console.log('Selected balanced candidate', rows[0]);
