/* Live construction queue for a corridor target and the tracker's recorded map. */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TrainCorridorQueue = api;
})(typeof globalThis === 'undefined' ? this : globalThis, () => {
  'use strict';

  function holdingName(edge) {
    return `Holding · ${edge.a}–${edge.b}`;
  }

  function touches(edge, edges) {
    return edges.some(other =>
      other.a === edge.a || other.b === edge.a || other.a === edge.b || other.b === edge.b);
  }

  function connected(edges) {
    if (!edges.length) return true;
    const reached = new Set([edges[0].a]);
    let size;
    do {
      size = reached.size;
      for (const edge of edges) {
        if (reached.has(edge.a) || reached.has(edge.b)) {
          reached.add(edge.a);
          reached.add(edge.b);
        }
      }
    } while (reached.size > size);
    return edges.every(edge => reached.has(edge.a) && reached.has(edge.b));
  }

  function matchLabels(target, graph, state, actualOwner, style) {
    const byGoal = new Map();
    const ownedCounts = new Map();
    for (const edge of graph.edges) {
      const goal = target.owners[edge.id] || target.retained[edge.id];
      if (!state.done[edge.id]) continue;
      const actual = actualOwner(edge);
      ownedCounts.set(actual, (ownedCounts.get(actual) || 0) + 1);
      if (!goal) continue;
      if (!byGoal.has(goal)) byGoal.set(goal, new Map());
      const counts = byGoal.get(goal);
      counts.set(actual, (counts.get(actual) || 0) + 1);
    }
    const matches = [...byGoal].flatMap(([goal, counts]) =>
      [...counts].map(([actual, count]) => ({goal, actual, count})));
    const overlap = match => style === 'concentrated'
      ? match.count / ownedCounts.get(match.actual)
      : match.count;
    matches.sort((a, b) => overlap(b) - overlap(a) || b.count - a.count ||
      Number(b.goal === b.actual) - Number(a.goal === a.actual) ||
      a.goal.localeCompare(b.goal) || a.actual.localeCompare(b.actual));
    const goals = new Set([...Object.values(target.owners), ...Object.values(target.retained)]);
    const reserved = new Map([...goals].map(goal => [`${target.label} · ${goal}`, goal]));
    const used = new Set();
    const labels = {};
    for (const {goal, actual, count} of matches) {
      if (style === 'exact' && count !== ownedCounts.get(actual)) continue;
      if (used.has(actual) || Object.hasOwn(labels, goal) || !actual || actual==='Unverified owner' || actual.startsWith('Holding · ')) continue;
      if (reserved.has(actual) && reserved.get(actual) !== goal) continue;
      labels[goal] = actual;
      used.add(actual);
    }
    for (const goal of goals) {
      if (Object.hasOwn(labels, goal)) continue;
      // The generated label is plan-specific and also survives a backup reload.
      const name = used.has(goal) ? `${target.label} · ${goal}` : goal;
      labels[goal] = name;
      used.add(name);
    }
    return labels;
  }

  function actions(target, graph, state, actualOwner) {
    const built = graph.edges.filter(edge => state.done[edge.id]);
    const byOwner = new Map();
    for (const edge of built) {
      const owner = actualOwner(edge);
      if (!byOwner.has(owner)) byOwner.set(owner, []);
      byOwner.get(owner).push(edge);
    }
    const resolve = goal => state.corridorLabels?.[goal] || goal;
    const activeOwners = new Set(Object.values(target.owners).map(resolve));
    const retained = [];
    const next = [];
    const licenses = new Map(graph.licenses.map(license => [license.region, license]));
    const neededLicenses = new Set();
    const readyLicenses = new Set();
    for (const edge of graph.edges) {
      const owned = Boolean(state.done[edge.id]);
      const serviceGoal = target.owners[edge.id];
      let goal = serviceGoal || (owned ? target.retained[edge.id] : null);
      if (!goal && owned && activeOwners.has(actualOwner(edge))) goal = holdingName(edge);
      if (!serviceGoal && owned) retained.push(edge);
      if (!goal) continue;
      const to = resolve(goal);
      const from = owned ? actualOwner(edge) || 'Unverified owner' : null;
      if (from === to) continue;
      const blocked = [];
      const regions = new Set([graph.regions[edge.a], graph.regions[edge.b]]);
      const accessible = touches(edge, built);
      const recipient = byOwner.get(to) || [];
      for (const region of regions) {
        const license = licenses.get(region);
        if (license && !state.done[license.id]) {
          blocked.push(`Needs ${region} license`);
          neededLicenses.add(license);
          if (accessible && (!recipient.length || touches(edge, recipient))) readyLicenses.add(license);
        }
      }
      if (!owned && !accessible) blocked.push('Connect to a city in your built network first');
      if (recipient.length && !connected([...recipient, edge])) blocked.push(`Connect ${to} to this track first`);
      if (owned) {
        const left = (byOwner.get(from) || []).filter(other => other.id !== edge.id);
        if (!left.length) blocked.push(`Keep a connected track for ${from}, or review its engine reassignment in the game`);
        else if (!connected(left)) blocked.push(`Keep ${from} connected before reclaiming this track`);
      }
      next.push({...edge, kind: owned ? 'reassign' : 'track', owner: to, from, to,
        cost: owned ? null : edge.cost, trackId: edge.id, trackIds: [edge.id], needsEngine: recipient.length === 0,
        blocked, holding: !serviceGoal});
    }
    // Local construction can make later ownership changes feasible.
    const priority = {track: 0, reassign: 1, license: 2};
    for (const license of neededLicenses) {
      next.push({...license, blocked: readyLicenses.has(license) ? [] : ['Extend your network toward this region first']});
    }
    next.sort((a, b) => Number(Boolean(a.blocked.length)) - Number(Boolean(b.blocked.length)) ||
      priority[a.kind] - priority[b.kind] ||
      (a.fuel ?? Infinity) - (b.fuel ?? Infinity) || a.id.localeCompare(b.id));
    return {next, retained};
  }

  function chooseLabels(target, graph, state, actualOwner) {
    const goals = [...new Set([...Object.values(target.owners), ...Object.values(target.retained)])];
    const candidates = [
      matchLabels(target, graph, state, actualOwner, 'overlap'),
      Object.fromEntries(goals.map(goal => [goal, goal])),
      matchLabels(target, graph, state, actualOwner, 'concentrated'),
      matchLabels(target, graph, state, actualOwner, 'exact'),
    ];
    let best = candidates[0];
    let bestScore = Infinity;
    const tried = new Set();
    for (const labels of candidates) {
      const signature = JSON.stringify(goals.map(goal => labels[goal]));
      if (tried.has(signature)) continue;
      tried.add(signature);
      const forecast = {done: {...state.done}, owners: {...state.owners}, corridorLabels: labels};
      const owner = edge => forecast.owners[edge.id] || actualOwner(edge);
      let changes = 0;
      while (true) {
        const {next} = actions(target, graph, forecast, owner);
        const step = next.find(action => !action.blocked.length);
        if (!step) {
          const score = next.length * (graph.edges.length + 1) + changes;
          if (score < bestScore) { best = labels; bestScore = score; }
          break;
        }
        forecast.done[step.id] = true;
        if (step.kind !== 'license') forecast.owners[step.id] = step.owner;
        if (step.kind === 'reassign') changes++;
      }
    }
    return best;
  }

  return {actions, chooseLabels, holdingName};
});
