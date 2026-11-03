const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Q = require('../assets/corridor-queue.js');
const C = require('../assets/core.js');
const historical = require('../analysis/world_tracker_data.json');
const data = vm.runInNewContext(
  fs.readFileSync('assets/corridor-targets.js', 'utf8') + 'window.TrainCorridorTargets',
  {window: {}}
);
const oldEdges = new Map(historical.edges.map(edge => [edge.id, edge]));
const graph = {...historical, edges: data.edges.map(edge => ({...edge, ...oldEdges.get(edge.id), fuel: edge.fuel}))};
function reference() {
  return {done: Object.fromEntries([...historical.base, ...historical.done].map(id => [id, true])),
    owners: {}, corrections: []};
}
function apply(state, step) {
  if (step.kind === 'reassign') C.applyCorrection(state, step);
  else {
    state.done[step.id] = true;
    if (step.kind === 'track') state.owners[step.id] = step.owner;
  }
}
function connected(edges) {
  if (!edges.length) return true;
  const cities = new Set([edges[0].a]);
  for (let pass = 0; pass < edges.length; pass++) {
    for (const edge of edges) if (cities.has(edge.a) || cities.has(edge.b)) {
      cities.add(edge.a);
      cities.add(edge.b);
    }
  }
  return edges.every(edge => cities.has(edge.a) && cities.has(edge.b));
}

for (const [id, target] of Object.entries(data.targets)) test(`live ${id} queue reaches the target from the public reference`, () => {
  const state = reference();
  const owner = edge => state.owners[edge.id] || edge.owner;
  state.corridorLabels = Q.chooseLabels(target, graph, state, owner);
  assert.deepEqual(state.owners, {});
  const licenseIds = new Set(graph.licenses.map(license => license.id));
  const licenses = Q.actions(target, graph, state, owner).next.filter(step => licenseIds.has(step.id));
  assert.equal(licenses.length, graph.licenses.length);
  for (const license of licenses) {
    assert.equal(license.kind, 'license', license.id);
    assert.ok(license.region);
    assert.equal(license.owner, undefined);
  }
  const original = new Set(Object.keys(state.done));
  const preview = fs.readFileSync(target.map, 'utf8');
  assert.equal((preview.match(/data-corridor-edge=/g) || []).length, target.tracks);
  assert.equal((preview.match(/data-corridor-city=/g) || []).length, target.cities);
  for (let count = 0; count < graph.edges.length * 2; count++) {
    const {next} = Q.actions(target, graph, state, owner);
    if (!next.length) break;
    const step = next[0];
    assert.deepEqual(step.blocked, [], step.id);
    if (step.kind === 'track') assert.ok(target.owners[step.id], step.id);
    apply(state, step);
    const byOwner = new Map();
    for (const edge of graph.edges.filter(edge => state.done[edge.id])) {
      const label = owner(edge);
      if (!byOwner.has(label)) byOwner.set(label, []);
      byOwner.get(label).push(edge);
    }
    for (const edges of byOwner.values()) assert.ok(connected(edges), step.id);
  }
  for (const edge of graph.edges) {
    if (original.has(edge.id)) assert.ok(state.done[edge.id]);
    if (target.owners[edge.id]) {
      assert.ok(state.done[edge.id], edge.id);
      assert.equal(owner(edge), state.corridorLabels[target.owners[edge.id]], edge.id);
    }
  }
  assert.equal(Q.actions(target, graph, state, owner).next.length, 0);
  for (const license of licenses) {
    assert.equal(state.done[license.id], true);
    assert.equal(Object.hasOwn(state.owners, license.id), false);
  }
});

test('switching corridor targets reuses compatible owners and preserves recorded purchases', () => {
  const state = reference();
  const connectedTarget = data.targets.connected;
  const nextTarget = data.targets['long-haul'];
  const owner = edge => state.owners[edge.id] || edge.owner;
  state.corridorLabels = Q.chooseLabels(connectedTarget, graph, state, owner);
  for (let count = 0; count < 35; count++) apply(state, Q.actions(connectedTarget, graph, state, owner).next[0]);
  const snapshot = JSON.stringify({done: state.done, owners: state.owners, corrections: state.corrections});
  state.corridorLabels = Q.chooseLabels(nextTarget, graph, state, owner);
  assert.equal(snapshot, JSON.stringify({done: state.done, owners: state.owners, corrections: state.corrections}));
  const ready = Q.actions(nextTarget, graph, state, owner).next.filter(step => !step.blocked.length);
  assert.ok(ready.length > 0);
  assert.ok(ready.every(step => step.kind !== 'track' || !state.done[step.id]));
  const used = Object.values(state.corridorLabels);
  assert.equal(new Set(used).size, used.length);
});
