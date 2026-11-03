"""Render user-facing verification notes from the checked model output."""
from pathlib import Path
from html import escape
import json,re
root=Path(__file__).resolve().parents[1];r=json.loads((root/'analysis/deep_results.json').read_text());profiles=r['profiles'];best=profiles['consolidated']
rows=[]
for name,p in profiles.items():
 s=p['summary']['40'];rows.append(f"| {p['label']} | {p['line_count']} | {s['mean_fuel']:.2f} | {s['mean_transfers']:.3f} | {s['mean_score']:.2f} | {len(p['initial_changes'])} |")
comparison='\n'.join(rows)
corrections='\n'.join(f"- {x['track'].replace('|',' ↔ ')}: **{x['from']} → {x['to']}**." for x in best['initial_changes'])
timing='\n'.join(f"- {', '.join(k.replace('|',' ↔ ') for k in g['track_ids'])}: stage {g['minimum_stage']}; partial-network effort {g['scheduled_effect']['before']:.3f} → {g['scheduled_effect']['after']:.3f}. {'Positive standalone gain.' if g['positive_phase_gain'] else 'Endgame target alignment; no standalone gain. This is part of completing the joint target.'}" for g in best['correction_schedule'])
counts={k:p['campaign_totals'] for k,p in profiles.items()};starts=sum(x['starts'] for x in counts.values());evaluations=sum(x['scored_layout_evaluations'] for x in counts.values())
readme=f'''# Pocket Train Optimizer

[Open the live planner](https://samueldovgin.github.io/Pocket-Train-Optimizer/)

An engine-agnostic route-efficiency model and persistent Pocket Trains expansion checklist. The supplied map contains 139 cities, 190 connections, and 38 available planning labels. New checklists start with the user's 10 original tracks and five completed expansions.

The default **Lowest routing score · fewer railroads** target has **{best['line_count']} active railroads**. Two alternatives keep 38 railroads: one permits explicit initial-owner corrections; the other preserves all 15 initial owners. The lowest route score is not proof of highest earnings or shortest waiting time. The site displays branch complexity so this tradeoff is visible.

## Current verified results

Every score compares the same 9,591 unordered city pairs at fuel + 40 per railroad handoff. Lower is better.

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 38 | 848.70 | 3.483 | 988.02 | 0 |
| Previous published search | 38 | 844.98 | 2.033 | 926.31 | 0 |
{comparison}

## Explicit corrections to existing tracks

The default target proposes these changes:

{corrections}

These are track-owner changes, not instructions to demolish/rebuild tracks. Connected claims are grouped into an ordered batch. Park the donor train safely and have the recipient railroad ready; complete every listed claim in game before confirming the batch in the tracker. Claimed tracks remain checked. Completed correction batches have a separate history and undo control. Undo edits the tracker record only.

Correction timing is tested separately from the final-world score. A change that helps the endgame can hurt the starting phase. The queue measures changes on executable partial networks and records purchase and earlier-correction dependencies. Positive standalone changes run when they help. Remaining joint-target alignment changes wait until endgame and explicitly show any individual increase in routing effort:

{timing}

Reassignment fees, train setup and positioning costs are not verified. Original claim-price references are labeled historical references; the queue does not invent a live fee or count it as a build cost. It does not sell trains, shut down railroads, or change anything in your game automatically.

## Search and stopping criteria

The checked reports retain {starts} starts and {evaluations:,} scored layout evaluations across saved campaigns. These counts include overlap across campaign caches. Search uses connected group relocations, connected exchanges, whole-railroad merges in the variable-count scenario, seeded perturbation restarts, cross-seeding, and merge/split seed construction. Each final campaign stops after 20 consecutive non-improving starts, then exhausts connected relocation groups through six tracks and exchanges through three tracks each way. This is a neighborhood-local optimum, not a global proof. The absolute fuel-distance-only lower bound is {r['physical_lower_bound']:.2f}; that bound need not be attainable with the modeled railroad constraints.

All active railroads remain connected and have at most 1,100 total assigned fuel units. This is a common planning bound used for comparisons, not an in-game fuel-tank specification. Labels are matched to initial colors to avoid gratuitous renaming/reclaims. The 38-line scenario with rework also tests a seed obtained by splitting the variable-count solution back into 38 connected railroads. A final merge/split cross-seeding cycle found no improvement to either incumbent; its trace is stored in `analysis/stability_trace.json`.

A joint deferral test tries removing future tracks while preserving every city-pair routing cost, every city, and connected owners. No such removals were found in the selected targets. Smaller worlds are never scored as improvements by dropping unreachable jobs.

## Trains and progression

Train models remain outside the route objective. The regular progression reported by the [Wiki train table](https://pocket-trains.fandom.com/wiki/Train) and [community progression discussion](https://www.reddit.com/r/pockettrains/comments/g1yviw/) is Steamers around levels 1–4, Express 5–8, Standard 9–12, Zephyr 13–16, Freighter 17–20, Hybrid 21–24. These are part-pool unlocks, not guaranteed engines. Special trains use different availability. Fuel cars extend capacity; speed, cargo capacity, stockyards and check-in cadence still affect operation. Long routes need a suitable train when you reach them.

## Save and use

Follow the first ready action and check purchases off after buying them in game. Selecting a plan only proposes existing-owner changes; it never silently applies those corrections. Manual future owner edits are retained. Read the orange correction cards before reclaiming any owned connection.

Progress stays in this browser's local storage, not GitHub. Export/import JSON to move devices or transfer from the downloaded tracker. Backups from versions 1, 3, 4 and 5 are supported. Schema 5 also preserves correction-batch history. The coin balance is a reference; checkoff does not deduct coins.

## Run and verify

The website has no npm dependencies and makes no runtime API calls.

```sh
python3 -m pip install -r requirements.txt
npm test
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm run build
npm start
```

Open http://127.0.0.1:8765. Use Node 20+ and Python 3.11+. Regression checks recompute all published metrics, independently compare routes, exhaust the final neighborhoods, test executable phase timing and signed gains, simulate every construction/correction action, and compare all 9,591 browser routes with Python for each new target.

## Continue or reproduce research

```sh
python3 analysis/deep_search.py --mode fixed --stale 20 --seed 20261104
python3 analysis/deep_search.py --mode rework --stale 20 --seed 20261106 --incumbent-only
python3 analysis/deep_search.py --mode consolidated --stale 20 --seed 20261106 --incumbent-only
python3 scripts/expand_search_seed.py
python3 analysis/deep_search.py --mode rework --stale 20 --seed 20261107 --incumbent-only
python3 scripts/refine_until_stable.py
python3 scripts/analyze_deep.py
python3 scripts/document_results.py
```

Search resumes from stored incumbents; outcomes may improve with additional campaigns. Saved campaign reports and final assignments are in `analysis/`. The historical `improved_solution.json` and `graph_theory_results.json` preserve the previous result for comparison. `analyze_deep.py` refuses to embed unfinished searches. Every push to `main` runs checks and deploys the static `dist/` artifact through GitHub Pages. Pull requests verify without deployment.

The game map/prices are inherited, not independently measured in the latest game. Eight fuel values and eight prices are provisional. The model does not predict coins/hour or simulate cargo spawning, train positions, capacity, waiting, congestion or fuel regeneration. This unofficial fan tool is not affiliated with NimbleBit. See [verification notes](docs/verification.md).
'''
# Write after adding the completed randomized campaign report below.
notes=f'''# Verification and iterative search — November 3, 2026

The original bundle and previously published scores were reproduced before the broader search. The previous published target scored 926.3084141382546. The lowest current routing-score target scores **{best['summary']['40']['mean_score']:.12f}** with **{best['line_count']}** railroads. All 9,591 city pairs remain reachable.

## Comparison at transfer penalty 40

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
{comparison}

The smaller-railroad result trades lower transfer cost against more demanding train duties. Every active railroad is connected, and assigned track-fuel totals stay at or below 1,100. Total assigned fuel is not tank capacity, speed, waiting time or earnings. The plans remain engine-agnostic as requested.

## Changes to your starting configuration

{corrections}

The queue shows each current owner and target owner, groups connected claims into ordered batches, preserves all physical purchase flags, and records completed batches separately. Nothing in your game changes automatically. Undo restores only the tracker record; reverse a game claim separately if you intend to undo it in game.

{timing}

Timing is based on matched jobs on the physical network actually buildable before the correction, with earlier scheduled corrections included. Not every individual step improves routing: endgame alignment steps explicitly show their signed effect and can enable the stronger joint layout. Prerequisites never include a purchase that needs the pending correction first. Live claim fees and train availability are additional considerations. No track demolition/rebuild, engine sale, or railroad shutdown is assumed. Historical claim prices are references, not asserted live reassignment fees.

## Evidence and stop rule

Saved campaigns contain {starts} starts and {evaluations:,} scored layout evaluations, with separate caches and possible overlap across campaigns. The search includes larger connected relocations, paired exchanges, seeded perturbations, multiple supplied starts, different railroad counts, and merge/split cross-seeding. Final campaigns stop after 20 consecutive non-improving starts, followed by exhaustive scoring of the final connected relocation groups through size six and exchanges through size three each way. Full-line merges are also checked in the variable-count scenario. The larger tested neighborhood contains no improving move at the recorded endpoint. The final merge/split cross-seeding cycle also left both incumbents unchanged.

This is a local-search stopping criterion, not a proof of global optimality. The fuel-only distance lower bound is {r['physical_lower_bound']:.6f}; it ignores transfers and may not be attainable under connected capped ownership. Search scripts, seeds, incumbents, and campaign reports remain in the repository for continuation.

## Track choices and tests

The joint deferral audit preserves all 139 cities and all 9,591 city-pair costs at handoff penalty 40, along with connected railroad ownership. It found no removable future tracks for these targets. The audit does not treat dropping a city or ignoring unreachable jobs as a benefit.

Python tests reproduce every new metric at penalties 0, 20, 40 and 80, check line constraints, re-enumerate the final move neighborhoods, and reproduce signed effects and prerequisites at scheduled correction stages. JavaScript tests compare every route against Python at penalty 40 for all three targets and simulate all 180 remaining purchases plus every correction batch. Tests also cover batch undo, backup migration/history, invalid imports, restored initial tracks, same-station/disconnected routes, tie-breaking, and route symmetry.

Browser QA verifies that recording a correction leaves the physical track count unchanged, saves across reload, and supports whole-batch undo. It checks plan selection, current versus target route scopes, scenario comparisons and narrow-screen layout. The previous browser file-picker/download automation limit remains: backup parsing/migration is tested in JavaScript, while transferring a save from a downloaded HTML tracker may require manual Export/Import.

## Progression research

The [Wiki train table](https://pocket-trains.fandom.com/wiki/Train) and [Reddit progression discussion](https://www.reddit.com/r/pockettrains/comments/g1yviw/) report regular part pools in roughly four-level groups: Steamers 1–4, Express 5–8, Standard 9–12, Zephyr 13–16, Freighter 17–20, Hybrid 21–24. Special availability differs. The [Wiki fuel page](https://pocket-trains.fandom.com/wiki/Fuel) describes fuel-car upgrades; [community straight-line discussion](https://www.reddit.com/r/pockettrains/comments/1rb5ajb/why_straight_lines/) explains why long branched routes can be awkward in practice. These are guidance sources, not a measured simulator or a promise of parts at a given level.

## Remaining limits

Map and costs come from the supplied tracker. Eight fuel lengths and eight prices are unverified. Job probabilities, transfer friction and the 1,100-unit bound are assumptions. Real operation depends on engines, train positions, speed, cargo, yards, refueling and player attention. Lower modeled effort does not prove higher profit. Progress is browser-local and needs a JSON backup to transfer.
'''
mc=json.loads((root/'analysis/monte_carlo_validation.json').read_text());total=mc['search_totals']
random_rows='\n'.join(f"| {name} | {mc['nominal_scores']['before_'+name]:.6f} | {mc['nominal_scores']['after_'+name]:.6f} | {mc['demand']['scenarios']['uniform']['paired_gains'][name]['mean_gain']:.3f} |" for name in ['fixed','rework','consolidated'])
research='\n'.join(f"- [{x['title']}]({x['url']}): {x['finding']} {x['applied']}" for x in mc['research'])
extra=f'''## Monte Carlo search and independent simulation

The latest search evaluated {total['valid_proposals']:,} valid randomized proposals in {total['campaigns']} completed profile campaigns, with {total['exact_evaluations']:,} exact scored layouts and {total['uphill_accepted']:,} accepted uphill moves. Counts include repeated layouts across separate campaign caches. Five temperature replicas explore connected track moves, exchanges, random-spanning-tree repartitions of neighboring lines, and variable-count splits/merges. Asymmetric proposal probabilities make this a heuristic optimizer, not a stationary posterior sampler.

Each profile campaign requires at least 50,000 valid proposals and 25 consecutive non-improving annealing rounds, then exhausts connected relocation groups through six tracks and exchanges through three tracks each way (plus whole-line merges when allowed). A further independent seeded campaign repeats across all profiles until none improves. The final of {len(mc['stability']['campaigns'])} follow-up campaigns made no gain. A separate final merge/split cross-seed audit also completed. These are explicit search plateaus, not proof that no better global layout exists.

| Profile | Before this Monte Carlo search | Current exact score | Synthetic uniform mean gain |
| --- | ---: | ---: | ---: |
{random_rows}

Independent evaluation used seed {mc['demand']['seed']}, {mc['demand']['virtual_days']:,} synthetic job batches and {mc['demand']['sampled_jobs']:,} jobs across five demand mixes. Every plan sees identical sampled jobs. Poisson batch size, lognormal city hotspots and Gamma pair variation are assumptions, not measured Pocket Trains spawning rules. The 90% simulation intervals and lower-cost fractions describe these synthetic draws, not confidence intervals or success probabilities for real play.

A further {mc['uncertain_distances']['draws']} shared distance draws vary only the eight provisional lengths between 70% and 130% of their estimates, then recompute all routes. The site reports how often each line exceeds the nominal planning bound under those assumptions; it does not interpret that bound as a fuel-tank specification. Peak handoff-station counts are workload indicators, not simulated congestion or yard limits.

The **Monte Carlo** tab includes the stored experiment results, convergence plot, and a seeded browser worker for fresh paired job batches. The lighter browser version uses fixed job counts and city hotspots, without Gamma pair variation. It compares the published reference plans, not custom tracker edits, and does not write to tracker progress. Engine choice remains outside the objective; actual waiting, capacity, positions, dispatch policy and earnings need measured data before credible simulation.

Reproduce the added work after installing requirements:

```sh
python3 scripts/monte_carlo_until_stable.py
python3 scripts/promote_monte_carlo.py
python3 scripts/refine_until_stable.py
python3 scripts/analyze_deep.py
python3 analysis/monte_carlo_validation.py
python3 scripts/document_results.py
```

If deterministic refinement finds a better endpoint, repeat the randomized campaign from that incumbent before republishing. Promotion refuses unfinished or infeasible searches. Independent Python and browser checks verify the exact scores, full coverage, connected lines, construction/correction sequence, saved ownership and seeded sampling behavior.

## Related projects inspected

{research}

No external project code was copied or executed. These sources inform experimental design; Pocket Planes airport/population rules, bonuses and flight economics are not imported into Pocket Trains. Direct Pocket Trains repository searches found game implementations but did not establish an existing complete global layout solver. Research observations refer to the inspected versions, not a claim that these projects can never improve.
'''
# Distinguish earlier deterministic evidence from the latest MC stopping rule.
readme=readme.replace('## Search and stopping criteria','## Earlier deterministic search evidence').replace('Each final campaign stops after 20','Each earlier deterministic campaign stops after 20')
notes=notes.replace('## Evidence and stop rule','## Earlier deterministic search evidence').replace('Final campaigns stop after 20','Earlier deterministic campaigns stop after 20')
map_notes='''## Full completed-world map

The **World map** tab shows all 139 cities and all 190 physical tracks colored by the active completed target, with a Europe inset, numbered owner legend, zoom, owner highlighting and city-label toggle. It includes proposed initial-owner corrections and saved edits without marking purchases or recording claims. Invalid custom ownership is flagged.

[Download the recommended full PNG (5200 × 3900)](https://samueldovgin.github.io/Pocket-Train-Optimizer/assets/map/proposed-completed-world.png) or [open the scalable SVG](https://samueldovgin.github.io/Pocket-Train-Optimizer/assets/map/proposed-completed-world.svg). The prebuilt image is the verified recommended reference; browser exports use the active plan and edits and always include the full target, even when the on-screen view is highlighted or labels are hidden. Follow staged correction cards before changing built-track owners.

This is an approximate geographic diagram, not an exact game screenshot or distance scale. [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) provides public-domain land outlines. Display coordinates never enter routing calculations. See `assets/map/README.md` for rebuilding; image consistency checks catch a stale image after a target change.
'''
readme=readme.replace('## Trains and progression',map_notes+'\n'+extra+'\n## Trains and progression')
notes=notes.replace('## Progression research',map_notes+'\n'+extra+'\n## Progression research')
(root/'README.md').write_text(readme)
(root/'docs/verification.md').write_text(notes)
def inline(s):
 s=escape(s)
 s=re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)',r'<a href="\2">\1</a>',s)
 s=re.sub(r'\*\*(.+?)\*\*',r'<strong>\1</strong>',s)
 return s
blocks=[]
for block in notes.split('\n\n'):
 if block.startswith('# '):blocks.append('<h1>'+inline(block[2:])+'</h1>')
 elif block.startswith('## '):blocks.append('<h2>'+inline(block[3:])+'</h2>')
 elif block.startswith('- '):blocks.append('<ul>'+''.join('<li>'+inline(line[2:])+'</li>' for line in block.splitlines())+'</ul>')
 elif block.startswith('| '):
  lines=block.splitlines();head=[x.strip() for x in lines[0].strip('|').split('|')];body=[[x.strip() for x in row.strip('|').split('|')] for row in lines[2:]]
  blocks.append('<div class="labscroll"><table class="labtable"><thead><tr>'+''.join('<th>'+inline(x)+'</th>' for x in head)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+inline(x)+'</td>' for x in row)+'</tr>' for row in body)+'</tbody></table></div>')
 else:blocks.append('<p>'+inline(block)+'</p>')
(root/'docs/verification.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Verification · Pocket Train Optimizer</title><link rel="icon" href="../assets/favicon.svg"><link rel="stylesheet" href="../assets/app.css"></head><body><main class="wrap" style="max-width:960px"><a href="../">← Back to your checklist</a>'+''.join(blocks)+'</main></body></html>')
print('Documented',starts,'starts and',evaluations,'scored evaluations')
