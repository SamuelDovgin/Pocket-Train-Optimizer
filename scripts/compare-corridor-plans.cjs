/* Compare every layout shown on the corridor page under the same experiment. */
const fs = require('node:fs');
const C = require('../assets/operating-core.js');
const MapCore = require('../assets/corridor-map-core.js');
const data = require('../assets/corridor-data.json');
const original = require('../assets/corridor-results.json');
const connected = require('../assets/connected-corridors.json');
const longHaul = require('../assets/long-haul-corridors.json');
const average = require('../assets/average-corridors.json');

const alaskaNote = 'One local exception: Fairbanks–Anchorage–Nome falls below 85% directness. All routes have at least three stops.';
const layouts = original.selection.display_examples.map(id => ({id, plan: data.plans[id],
  label: id === original.selection.recommendation ? 'Original 27 routes' : data.plans[id].pressure.label,
  map: id, build: id === original.selection.recommendation ? 'sparse' : null}));
layouts.push(
  {id: connected.winner, plan: connected.plan, label: 'Connected Long Routes', map: 'connected', build: 'connected'},
  {id: longHaul.winner, plan: longHaul.plan, label: 'Long-haul hubs', map: 'long-haul', build: 'long-haul'},
  {id: average.winner, plan: average.plan, label: 'Longer average routes', map: 'longer-average',
    build: 'longer-average', shapeNote: alaskaNote},
  {id: average.balanced.id, plan: average.balanced.plan, label: 'Balanced · 3+ stops', map: 'balanced-three',
    build: 'balanced-three', shapeNote: alaskaNote},
  ...Object.entries(data.benchmarks).map(([id, plan]) => ({
    id, plan, label: id === 'reference38' ? 'Earlier 38 corridors' : 'Earlier 28 corridors', map: id, benchmark: true,
  }))
);

const seeds = [2043019, 2043521, 2044117, 2044631, 2045233, 2045827, 2046361, 2046983];
const scenarios = Object.fromEntries(Object.entries(original.evaluation).map(([name, row]) => [name, row.options]));
const policy = longHaul.policy;
const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
const metrics = {total: 'rewardPer1000Time', perTrain: 'rewardPerTrain1000Time',
  perDispatch: 'rewardPerDispatch', transfers: 'meanTransfers'};

function geometry(plan, model) {
  const atCity = new Map();
  const through = new Set();
  const longThrough = new Set();
  const stats = [];
  const lines = model.lines.map(line => {
    const cities = line.adj.flatMap((neighbors, index) => neighbors.length ? [index] : []);
    if (cities.some(city => line.adj[city].length > 2)) throw Error('Comparison expects branch-free duties');
    const ends = cities.filter(city => line.adj[city].length === 1);
    const kind = ends.length ? 'path' : 'loop';
    const ordered = [ends[0] ?? cities[0]];
    while (ordered.length < cities.length) {
      const next = line.adj[ordered.at(-1)].find(edge => edge.to !== ordered.at(-2));
      ordered.push(next.to);
    }
    const path = ordered.map(index => data.cities[index]);
    const interior = kind === 'loop' ? path : path.slice(1, -1);
    for (const city of path) atCity.set(city, (atCity.get(city) || 0) + 1);
    for (const city of interior) {
      through.add(city);
      if (kind === 'path' && path.length >= 5) longThrough.add(city);
    }
    if (kind === 'loop') path.push(path[0]);
    const {name, color, length, tracks} = line;
    const normalized = {name, color, length, tracks, kind, path};
    stats.push(MapCore.geometry(data, normalized));
    return normalized;
  });
  const hubs = [...atCity].filter(([, count]) => count > 1)
    .map(([city, count]) => ({city, lines: count, designated: false}));
  const lengths = lines.map(line => line.length).sort((a, b) => a - b);
  const longest = lines.reduce((a, b) => a.length >= b.length ? a : b);
  const paths = stats.filter(row => row.directness !== null);
  return {
    mapPlan: {...plan, lines, metrics: {hubs}},
    shape: {
      cities: atCity.size, trains: lines.length, links: model.edges.length, hubs: hubs.length,
      through: through.size, throughHubs: hubs.filter(hub => longThrough.has(hub.city)).length,
      short: lines.filter(line => line.kind === 'loop' || line.path.length < 5).length,
      loops: lines.filter(line => line.kind === 'loop').length,
      twoStop: lines.filter(line => line.path.length === 2).length,
      medianDistance: mean([lengths[Math.floor((lengths.length - 1) / 2)], lengths[Math.floor(lengths.length / 2)]]),
      meanDistance: mean(lengths),
      directness: paths.reduce((sum, row) => sum + row.span, 0) / paths.reduce((sum, row) => sum + row.chordLength, 0),
      longest: {from: longest.path[0], to: longest.path.at(-1), distance: longest.length},
    },
  };
}

const plans = layouts.map(({id, plan, label, map, build, benchmark, shapeNote}) => {
  const model = C.compile(data, plan);
  const {shape, mapPlan} = geometry(plan, model);
  if (benchmark || shapeNote) {
    fs.writeFileSync(`assets/corridor-maps/${map}.svg`, MapCore.renderSVG(data, mapPlan, {
      title: label.toUpperCase(),
      shapeNote: shapeNote || 'Earlier corridor benchmark. Geometry predates the later path directness and turn limits.',
    }));
  }
  const results = Object.fromEntries(Object.entries(scenarios).map(([name, options]) => {
    const trials = seeds.map(seed => C.simulate(model, {...policy, ...options, seed}));
    return [name, Object.fromEntries(Object.entries(metrics)
      .map(([key, metric]) => [key, mean(trials.map(row => row[metric]))]))];
  }));
  console.log('Compared', label);
  return {id, label, map, build, benchmark: Boolean(benchmark), shape, results};
});

fs.writeFileSync('assets/corridor-comparison.json', JSON.stringify({
  version: 1, plans, scenarios, policy, seeds, baseline: connected.winner,
  simulations: plans.length * Object.keys(scenarios).length * seeds.length,
}));
