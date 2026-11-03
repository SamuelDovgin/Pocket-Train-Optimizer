(async () => {
  'use strict';

  const panel = document.getElementById('compare-plans');
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[char]));
  const number = value => new Intl.NumberFormat('en-US', {maximumFractionDigits: 1}).format(value);
  const percent = value => `${number(value * 100)}%`;
  const mean = values => values.reduce((sum, value) => sum + value, 0) / values.length;
  const settings = {
    uniform: 'Uniform destinations', local: 'Mostly local jobs', global: 'Mostly cross-region jobs',
    light: 'Light demand', infrequent: 'Infrequent check-ins', long_run: 'Long simulation',
    refueling: 'Generic fuel limit', high_capacity: 'High capacity',
  };
  const goals = {
    medianDistance: {title: 'Longest typical route', value: v => `${number(v)} track-distance median`},
    longest: {title: 'Longest single route', value: v => `${number(v)} track-distance`},
    throughHubs: {title: 'Most long-route hubs', value: v => `${v} shared cities on long through routes`},
    hubs: {title: 'Most shared stations', value: v => `${v} transfer points`},
    through: {title: 'Most through service', value: v => `${v} cities with through service`},
    short: {title: 'Fewest short duties', value: v => `${v} short duties`, lower: true},
    links: {title: 'Most links used', value: v => `${v} active links`},
    trains: {title: 'Fewest trains', value: v => `${v} trains`, lower: true},
    directness: {title: 'Straightest routes', value: v => `${percent(v)} chord directness`},
    total: {title: 'Highest total reward', value: v => `${number(v)} reward index`, operating: true},
    perTrain: {title: 'Best reward per train', value: v => `${number(v)} reward index`, operating: true},
    perDispatch: {title: 'Best reward per dispatch', value: v => `${number(v)} reward index`, operating: true},
    transfers: {title: 'Fewest handoffs', value: v => `${number(v)} handoffs per delivered car`, lower: true, operating: true},
  };
  const spotlight = ['medianDistance', 'throughHubs', 'short', 'links', 'trains',
    'total', 'perTrain', 'perDispatch', 'transfers'];
  const tableMetrics = {
    network: [
      ['trains', 'Trains'], ['links', 'Links'], ['cities', 'Cities'], ['hubs', 'Shared cities'],
      ['throughHubs', 'Long-route hubs'], ['through', 'Through cities'], ['short', 'Short duties'],
      ['loops', 'Loops'], ['medianDistance', 'Median distance'], ['longest', 'Longest route'], ['directness', 'Directness'],
    ],
    operating: [
      ['trains', 'Trains'], ['total', 'Total index'], ['perTrain', 'Per train index'],
      ['perDispatch', 'Per dispatch index'], ['transfers', 'Handoffs per car'],
    ],
  };

  try {
    const response = await fetch('../assets/corridor-comparison.json?v=compare1');
    if (!response.ok) throw Error('Comparison data is unavailable.');
    const report = await response.json();
    const baseline = report.plans.find(plan => plan.id === report.baseline);
    const scenarioKeys = Object.keys(report.scenarios);
    const mapLink = plan => `<a href="../assets/corridor-maps/${escape(plan.map)}.svg" target="_blank" rel="noopener">Map<span class="compare-sr"> for ${escape(plan.label)}</span></a>`;
    const buildLink = plan => plan.build
      ? `<a href="../?target=${escape(plan.build)}">Build<span class="compare-sr"> toward ${escape(plan.label)}</span></a>`
      : '';
    const index = (plan, key, scenario) => {
      const ratio = name => plan.results[name][key] / baseline.results[name][key];
      return 100 * (scenario === 'all'
        ? Math.exp(mean(scenarioKeys.map(name => Math.log(ratio(name)))))
        : ratio(scenario));
    };
    const value = (plan, key, scenario) => {
      if (key === 'longest') return plan.shape.longest.distance;
      if (key === 'transfers') return scenario === 'all'
        ? mean(scenarioKeys.map(name => plan.results[name].transfers))
        : plan.results[scenario].transfers;
      return goals[key]?.operating ? index(plan, key, scenario) : plan.shape[key];
    };
    // Fix the recommendation to a cross-setting mix even when the user inspects one setting.
    const weights = {short: .20, medianDistance: .15, throughHubs: .15, through: .10,
      links: .10, perTrain: .15, perDispatch: .15};
    const mixScore = plan => Math.exp(Object.entries(weights).reduce((score, [key, weight]) => {
      const ratio = key === 'short'
        ? (baseline.shape.short + 1) / (plan.shape.short + 1)
        : value(plan, key, 'all') / value(baseline, key, 'all');
      return score + weight * Math.log(ratio);
    }, 0)) * 100;
    const eligible = report.plans.filter(({shape}) =>
      shape.cities === baseline.shape.cities && shape.links >= 165 && shape.hubs >= 50 && shape.loops <= 2);
    const ranked = eligible.map(plan => ({plan, score: mixScore(plan)})).sort((a, b) => b.score - a.score);
    const pick = ranked[0].plan;
    const shape = pick.shape;

    panel.innerHTML = `
      <h2>Compare the proposed layouts</h2>
      <p>Compare ${report.plans.length} published layouts and benchmarks under the same settings and dispatch rules.</p>
      <article class="labcard compare-pick">
        <div class="eyebrow">My pick for your priorities</div>
        <h3>${escape(pick.label)}</h3>
        <p>${shape.cities} cities · ${shape.trains} trains · ${shape.links} active links · ${shape.hubs} shared stations · ${shape.short} short duties</p>
        <p class="note">Compared with ${escape(baseline.label)}, see the tradeoffs across route length, transfers and workload.</p>
        <ul class="compare-deltas">
          <li><b>${number(shape.medianDistance)}</b> median track-distance <span>vs ${number(baseline.shape.medianDistance)}</span></li>
          <li><b>${shape.throughHubs}</b> long-route hubs <span>vs ${baseline.shape.throughHubs}</span></li>
          <li><b>${shape.through}</b> through cities <span>vs ${baseline.shape.through}</span></li>
          <li><b>${number(index(pick, 'perDispatch', 'all'))}</b> reward per dispatch index <span>vs 100</span></li>
        </ul>
        <div class="btnrow">${mapLink(pick)} ${buildLink(pick)}</div>
        <details><summary>How I chose the mix</summary>
          <p class="note">I limited the shortlist to all cities served, at least 165 links, at least 50 shared stations and at most two compact loops. I used a weighted geometric mean relative to Connected Long Routes.</p>
          <p class="note">Few short duties 20%, median route distance 15%, long-route hubs 15%, through cities 10%, active links 10%, reward per train 15% and reward per dispatch 15%. The short-duty term uses the inverse ratio of counts plus one. The mix stays fixed when you explore a different operating setting below.</p>
        </details>
      </article>
      <div class="labselects compare-controls">
        <label>Operating setting
          <select id="compare-setting">
            <option value="all">Across all settings</option>
            ${scenarioKeys.map(key => `<option value="${escape(key)}">${escape(settings[key] || key)}</option>`).join('')}
          </select>
        </label>
        <label>Rank by
          <select id="compare-rank">
            <option value="mix">Fit for your priorities</option>
            ${Object.entries(goals).map(([key, goal]) => `<option value="${key}">${escape(goal.title)}</option>`).join('')}
          </select>
        </label>
      </div>
      <h3>Best at each priority</h3>
      <div class="compare-leaders"></div>
      <h3 id="compare-table-heading">All layouts</h3>
      <p class="note">A reward index of 100 matches Connected Long Routes in the chosen setting. 110 means 10% higher simulated reward for that metric.</p>
      <div class="segment" role="group" aria-label="Comparison table metrics">
        <button type="button" data-compare-view="network" aria-pressed="true">Network layout</button>
        <button type="button" data-compare-view="operating" aria-pressed="false">Simulated operation</button>
      </div>
      <div id="compare-table" class="labscroll"></div>
      <details class="compare-method"><summary>Definitions and simulation settings</summary>
        <p class="note">A short duty serves fewer than five stops or runs a compact loop. A through city is an interior stop on a path or a stop on a loop. A long-route hub is shared by multiple trains and is an interior stop on a path with at least five stops. Median distance measures track-distance, while directness compares straight endpoint span with summed map chords on open paths.</p>
        <p class="note">${report.simulations} runs. Each layout uses the same ${scenarioKeys.length} settings, ${report.seeds.length} fresh seeds per setting, and the same patrol and express-loading rules. Reward indices are relative to Connected Long Routes, which equals 100 in each setting. The across-settings view gives equal weight to each setting's ratio via a geometric mean. Handoffs use the arithmetic mean. The model uses synthetic jobs and generic trains, so reward is a simulation index rather than net in-game coins.</p>
        <p><a href="../assets/corridor-comparison.json" download>Download data and scenario settings</a></p>
      </details>`;

    const setting = panel.querySelector('#compare-setting');
    const rank = panel.querySelector('#compare-rank');
    let tableView = 'network';
    function render() {
      const scenario = setting.value;
      const goal = rank.value;
      const sorted = key => [...report.plans].sort((a, b) => {
        const diff = key === 'mix'
          ? (ranked.find(row => row.plan === b)?.score || 0) - (ranked.find(row => row.plan === a)?.score || 0)
          : (value(b, key, scenario) - value(a, key, scenario)) * (goals[key].lower ? -1 : 1);
        return diff || a.label.localeCompare(b.label);
      });
      panel.querySelector('.compare-leaders').innerHTML = spotlight.map(key => {
        const best = sorted(key);
        const v = value(best[0], key, scenario);
        const leaders = best.filter(plan => Math.abs(value(plan, key, scenario) - v) < 1e-8);
        return `<article class="labcard">
          <button type="button" class="tinybtn" data-compare-rank="${key}">${escape(goals[key].title)}</button>
          <p><b>${escape(leaders.map(plan => plan.label).join(' / '))}</b></p>
          <p class="note">${escape(goals[key].value(v))}</p>
        </article>`;
      }).join('');
      for (const button of panel.querySelectorAll('[data-compare-view]')) {
        const active = button.dataset.compareView === tableView;
        button.setAttribute('aria-pressed', String(active));
        button.classList.toggle('active', active);
      }
      const columns = tableMetrics[tableView];
      panel.querySelector('#compare-table').innerHTML = `<table class="labtable compare-table" aria-labelledby="compare-table-heading">
        <thead><tr><th scope="col">Plan</th>${columns.map(([key, label]) =>
          `<th scope="col"${key === goal ? ` aria-sort="${goals[key].lower ? 'ascending' : 'descending'}"` : ''}>${label}</th>`
        ).join('')}<th scope="col">Open</th></tr></thead>
        <tbody>${sorted(goal).map(plan => `<tr ${plan === pick ? 'class="corr-recommended"' : ''}>
          <th scope="row">${escape(plan.label)}${plan === pick ? ' <span class="tag">Your mix</span>' : ''}${plan.benchmark ? ' <span class="tag">Benchmark</span>' : ''}</th>
          ${columns.map(([key]) => {
            const v = value(plan, key, scenario);
            if (key === 'longest') {
              const {from, to} = plan.shape.longest;
              return `<td>${number(v)}<br><small>${escape(from)} → ${escape(to)}</small></td>`;
            }
            return `<td>${key === 'directness' ? percent(v) : number(v)}</td>`;
          }).join('')}
          <td><div class="btnrow">${mapLink(plan)} ${buildLink(plan)}</div></td>
        </tr>`).join('')}</tbody></table>`;
    }
    function changeRank(key) {
      rank.value = key;
      tableView = goals[key]?.operating ? 'operating' : 'network';
      render();
    }
    setting.addEventListener('change', render);
    rank.addEventListener('change', () => changeRank(rank.value));
    panel.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (button?.dataset.compareRank) {
        changeRank(button.dataset.compareRank);
        rank.focus({preventScroll: true});
        panel.querySelector('#compare-table-heading').scrollIntoView({block: 'start'});
      }
      if (button?.dataset.compareView) {
        tableView = button.dataset.compareView;
        render();
      }
    });
    render();
  } catch (error) {
    panel.innerHTML = '<h2>Compare the proposed layouts</h2><p class="note" role="status">The plan comparison could not load. Reload the page to retry.</p>';
    console.error(error);
  }
})();
