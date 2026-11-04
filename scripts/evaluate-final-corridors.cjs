/* Successive simulation screening with fresh, paired validation seeds. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {Worker, isMainThread, parentPort} = require('node:worker_threads');
const C = require('../assets/operating-core.js');
const data = require('../assets/corridor-data.json');
const prior = require('../assets/average-corridors.json');
const comparison = require('../assets/corridor-comparison.json');
const longHaul = require('../assets/long-haul-corridors.json');

const baseline = 'balanced_reference';
const metrics = ['rewardPer1000Time', 'rewardPerTrain1000Time', 'rewardPerDispatch'];
const mean = values => values.reduce((total, value) => total + value, 0) / values.length;
const policy = longHaul.policy;
const scenarios = comparison.scenarios;
const stress = {
  basic_trains: {...scenarios.uniform, capacity: 8, yardCapacity: 5},
  small_yards: {...scenarios.local, yardCapacity: 5},
  distance_weighted_jobs: {...scenarios.uniform, scenario: 'longhaul'},
  cargo_dispatch: {...scenarios.infrequent, policy: 'cargo'},
};
const seedSet = (start, count) => Array.from({length: count}, (_, i) => start + 7297 * i);
const weights = {total: .25, perTrain: .15, perDispatch: .25, distance: .15, hubs: .08, through: .05, short: .07};

function evaluate(plan, settings, seeds) {
  const model = C.compile(data, plan);
  return Object.fromEntries(Object.entries(settings).map(([id, options]) => [
    id, seeds.map(seed => {
      const row = C.simulate(model, {...policy, ...options, seed});
      return metrics.map(metric => row[metric]);
    }),
  ]));
}

function geometry(plan) {
  const lengths = plan.lines.map(line => line.length).sort((a, b) => a - b);
  return {trains: lengths.length, links: plan.tracks, cities: plan.cities, hubs: plan.metrics.interchanges,
    through: new Set(plan.lines.flatMap(line => line.path.slice(1, -1))).size,
    short: plan.lines.filter(line => line.path.length < 5).length, twoStop: plan.lines.filter(line => line.path.length === 2).length,
    meanDistance: mean(lengths), medianDistance: mean([lengths[Math.floor((lengths.length - 1) / 2)], lengths[Math.floor(lengths.length / 2)]])};
}

function ratios(runs, base, indices = null) {
  return Object.fromEntries(['total', 'perTrain', 'perDispatch'].map((key, column) => {
    const log = mean(Object.keys(runs).map(id => {
      const subset = indices || runs[id].map((_, i) => i);
      const avg = rows => mean(subset.map(i => rows[i][column]));
      return Math.log(avg(runs[id]) / avg(base[id]));
    }));
    return [key, Math.exp(log)];
  }));
}

function mix(relative, shape, base) {
  const ratios = {...relative, distance: shape.meanDistance / base.meanDistance, hubs: shape.hubs / base.hubs,
    through: shape.through / base.through, short: (base.short + 1) / (shape.short + 1)};
  return Math.exp(Object.entries(weights).reduce((total, [metric, weight]) => total + weight * Math.log(ratios[metric]), 0));
}

function bounds(runs, base, shape, baseShape) {
  let seed = 9276817;
  const count = Object.values(runs)[0].length;
  const samples = [];
  for (let i = 0; i < 2000; i++) {
    const indices = Array.from({length: count}, () => {
      seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
      return Math.floor(seed * count / 4294967296);
    });
    const relative = ratios(runs, base, indices);
    samples.push({...relative, mix: mix(relative, shape, baseShape)});
  }
  return Object.fromEntries(Object.keys(samples[0]).map(key => {
    const sorted = samples.map(row => row[key]).sort((a,b) => a-b);
    return [key, [sorted[50], sorted[1949]]];
  }));
}

function makePool(size) {
  const workers = Array.from({length: size}, () => new Worker(__filename));
  return {
    async map(items) {
      const results = {};
      let index = 0, completed = 0;
      await Promise.all(workers.map(async worker => {
        while (index < items.length) {
          const task = items[index++];
          results[task.id] = await new Promise((resolve, reject) => {
            function failure(error) { worker.off('message', success); reject(error); }
            function success(result) { worker.off('error', failure); resolve(result); }
            worker.once('message', success);
            worker.once('error', failure);
            worker.postMessage(task);
          });
          completed++;
          if (completed % 16 === 0) console.log('  evaluated layouts', completed, '/', items.length);
        }
      }));
      return results;
    },
    async close() { await Promise.all(workers.map(worker => worker.terminate())); },
  };
}

async function main() {
  const source = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const workers = makePool(Number(process.argv[3] || 6));
  const plans = {[baseline]: prior.balanced.plan, ...source.plans};
  const known = new Set(Object.values(plans).map(plan => JSON.stringify(plan.owners)));
  const shapes = {};
  const shape = id => shapes[id] ||= geometry(plans[id]);
  const baseShape = shape(baseline);
  const stages = [];
  let simulations = 0;

  async function stage(name, ids, settings, seeds) {
    ids = [...new Set([baseline, ...ids])];
    console.log(name, ids.length, 'layouts ×', Object.keys(settings).length, 'settings ×', seeds.length, 'seeds');
    const results = await workers.map(ids.map(id => ({id, plan: plans[id], settings, seeds})));
    const count = ids.length * Object.keys(settings).length * seeds.length;
    simulations += count;
    const summary = ids.map(id => {
      const relative = ratios(results[id], results[baseline]);
      const score = mix(relative, shape(id), baseShape);
      // Prefer operationally useful maps during screening. A final gate is evaluated separately.
      const rank = score * Math.min(1, relative.total / .97) * Math.min(1, relative.perDispatch / .98);
      return {id, ...relative, score, rank};
    }).sort((a,b) => b.rank - a.rank || a.id.localeCompare(b.id));
    stages.push({name, settings, seeds, simulations: count, summary});
    console.log('  leaders:', JSON.stringify(summary.slice(0, 4)));
    return {summary, results};
  }

  const bestIds = (summary, count) => summary.filter(row => row.id !== baseline).slice(0, count).map(row => row.id);
  try {
    const quick = Object.fromEntries(['uniform', 'local', 'infrequent', 'refueling'].map(name => [name, scenarios[name]]));
    const screenSeeds = seedSet(3411111, 3);
    const first = await stage('Broad screening', Object.keys(source.plans), quick, screenSeeds);
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pocket-final-'));
    const input = path.join(work, 'seeds.json'), output = path.join(work, 'neighbors.json');
    let refined;
    try {
      fs.writeFileSync(input, JSON.stringify(Object.fromEntries(bestIds(first.summary, 5).map(id => [id, plans[id]]))));
      execFileSync('python3', ['scripts/search-final-corridors.py', '--refine', input, output], {stdio: 'inherit'});
      refined = JSON.parse(fs.readFileSync(output, 'utf8'));
    } finally { fs.rmSync(work, {recursive: true}); }
    const neighbors = [];
    for (const [id, plan] of Object.entries(refined.plans)) {
      const key = JSON.stringify(plan.owners);
      if (known.has(key)) continue;
      known.add(key);
      plans[id] = plan;
      neighbors.push(id);
    }
    const second = await stage('Screen neighbors of the simulation leaders', neighbors, quick, screenSeeds);
    const combined = [...first.summary, ...second.summary].sort((a,b) => b.rank - a.rank || a.id.localeCompare(b.id));
    const third = await stage('All-setting shortlist', bestIds(combined, 30), scenarios, seedSet(4558321, 8));
    const fourth = await stage('Final tuning', bestIds(third.summary, 10), scenarios, seedSet(5138183, 16));

    // Freeze one challenger. Test results may retain the baseline but cannot promote another candidate.
    const challenger = bestIds(fourth.summary, 1)[0];
    const finalists = [...new Set([challenger, bestIds(fourth.summary, 2)[1], 'long_haul_reference', 'longest_reference'].filter(Boolean))];
    plans.long_haul_reference = longHaul.plan;
    plans.longest_reference = prior.plan;
    console.log('Frozen challenger:', challenger);
    const validation = await stage('Fresh paired validation', finalists, scenarios, seedSet(6262787, 40));
    const sensitivity = await stage('Additional stress settings', [challenger, 'long_haul_reference'], stress, seedSet(7541671, 24));
    const check = validation.summary.find(row => row.id === challenger);
    const stressCheck = sensitivity.summary.find(row => row.id === challenger);
    const uncertainty = bounds(validation.results[challenger], validation.results[baseline], shape(challenger), baseShape);
    const gate = {mix: 1.015, total: .97, perDispatch: 1, perDispatchLower: .99, stressPerDispatch: .95};
    const accepted = check.score >= gate.mix && check.total >= gate.total && check.perDispatch >= gate.perDispatch &&
      uncertainty.perDispatch[0] >= gate.perDispatchLower && stressCheck.perDispatch >= gate.stressPerDispatch;
    const winner = accepted ? challenger : baseline;
    const report = {version: 1, winner, challenger, accepted, plan: plans[winner], challengerPlan: plans[challenger],
      shapes, weights, gate, uncertainty, policy, stages, simulations, uniqueCandidates: known.size - 1,
      search: {runs: source.runs, localProposals: source.local_proposals, refinedProposals: refined.local_proposals},
      validation: validation.results, stress: sensitivity.results};
    fs.writeFileSync('assets/final-corridors.json', JSON.stringify(report) + '\n');
    console.log('Final verdict:', JSON.stringify({winner, challenger, accepted, check, stressCheck, uncertainty, simulations}));
  } finally {
    await workers.close();
  }
}

if (isMainThread) main().catch(error => {console.error(error); process.exitCode = 1;});
else parentPort.on('message', ({plan, settings, seeds}) => parentPort.postMessage(evaluate(plan, settings, seeds)));
