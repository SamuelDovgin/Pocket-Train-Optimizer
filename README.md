# Pocket Train Optimizer

[Open the live planner](https://samueldovgin.github.io/Pocket-Train-Optimizer/)

An engine-agnostic route-efficiency model and persistent Pocket Trains expansion checklist. The supplied map contains 139 cities, 190 connections, and 38 available planning labels. New checklists start with the user's 10 original tracks and five completed expansions.

The default **Lowest routing score · fewer railroads** target has **20 active railroads**. Two alternatives keep 38 railroads: one permits explicit initial-owner corrections; the other preserves all 15 initial owners. The lowest route score is not proof of highest earnings or shortest waiting time. The site displays branch complexity so this tradeoff is visible.

## Current verified results

Every score compares the same 9,591 unordered city pairs at fuel + 40 per railroad handoff. Lower is better.

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 38 | 848.70 | 3.483 | 988.02 | 0 |
| Previous published search | 38 | 844.98 | 2.033 | 926.31 | 0 |
| Deeper search · keep starting owners | 38 | 843.70 | 1.798 | 915.62 | 0 |
| Deeper search · allow starting corrections | 38 | 846.07 | 1.653 | 912.19 | 4 |
| Experimental · fewer railroads | 20 | 844.33 | 1.651 | 910.37 | 2 |

## Explicit corrections to existing tracks

The default target proposes these changes:

- Berlin ↔ Munich: **Green → Purple**.
- Milan ↔ Rome: **Blue → Green**.

These are track-owner changes, not instructions to demolish/rebuild tracks. Connected claims are grouped into an ordered batch. Park the donor train safely and have the recipient railroad ready; complete every listed claim in game before confirming the batch in the tracker. Claimed tracks remain checked. Completed correction batches have a separate history and undo control. Undo edits the tracker record only.

Correction timing is tested separately from the final-world score. A change that helps the endgame can hurt the starting phase. The queue delays it until the first tested gateway stage with a positive matched-job routing benefit:

- Berlin ↔ Munich: after stage 1 gateway prerequisites.
- Milan ↔ Rome: starting network.

Reassignment fees, train setup and positioning costs are not verified. Original claim-price references are labeled historical references; the queue does not invent a live fee or count it as a build cost. It does not sell trains, shut down railroads, or change anything in your game automatically.

## Search and stopping criteria

The checked reports retain 368 starts and 585,850 scored layout evaluations across saved campaigns. These counts include overlap across campaign caches. Search uses connected group relocations, connected exchanges, whole-railroad merges in the variable-count scenario, seeded perturbation restarts, cross-seeding, and merge/split seed construction. Each final campaign stops after 20 consecutive non-improving starts, then exhausts connected relocation groups through six tracks and exchanges through three tracks each way. This is a neighborhood-local optimum, not a global proof. The absolute fuel-distance-only lower bound is 838.80; that bound need not be attainable with the modeled railroad constraints.

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

Open http://127.0.0.1:8765. Use Node 20+ and Python 3.11+. Regression checks recompute all published metrics, independently compare routes, exhaust the final neighborhoods, test phase timing, simulate every construction/correction action, and compare all 9,591 browser routes with Python for each new target.

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
