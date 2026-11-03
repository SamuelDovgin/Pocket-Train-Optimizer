# Pocket Train Optimizer

[Open the live planner](https://samueldovgin.github.io/Pocket-Train-Optimizer/)

An engine-agnostic route-efficiency model and persistent Pocket Trains expansion checklist. The supplied map contains 139 cities, 190 connections, and 38 available planning labels. New checklists start with the user's 10 original tracks and five completed expansions.

The default **Lowest routing score · fewer railroads** target has **28 active railroads**. Two alternatives keep 38 railroads: one permits explicit initial-owner corrections; the other preserves all 15 initial owners. The lowest route score is not proof of highest earnings or shortest waiting time. The site displays branch complexity so this tradeoff is visible.

## Current verified results

Every score compares the same 9,591 unordered city pairs at fuel + 40 per railroad handoff. Lower is better.

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Original | 38 | 848.70 | 3.483 | 988.02 | 0 |
| Previous published search | 38 | 844.98 | 2.033 | 926.31 | 0 |
| Monte Carlo · keep starting owners | 38 | 841.17 | 1.727 | 910.23 | 0 |
| Monte Carlo · explicit starting corrections | 38 | 840.98 | 1.670 | 907.79 | 5 |
| Monte Carlo · fewer railroads | 28 | 841.15 | 1.637 | 906.62 | 4 |

## Explicit corrections to existing tracks

The default target proposes these changes:

- Berlin ↔ Munich: **Green → Africa Cross**.
- Budapest ↔ Munich: **Pink → Green**.
- Milan ↔ Rome: **Blue → North America East**.
- Munich ↔ Paris: **Pink → Blue**.

These are track-owner changes, not instructions to demolish/rebuild tracks. Connected claims are grouped into an ordered batch. Park the donor train safely and have the recipient railroad ready; complete every listed claim in game before confirming the batch in the tracker. Claimed tracks remain checked. Completed correction batches have a separate history and undo control. Undo edits the tracker record only.

Correction timing is tested separately from the final-world score. A change that helps the endgame can hurt the starting phase. The queue measures changes on executable partial networks and records purchase and earlier-correction dependencies. Positive standalone changes run when they help. Remaining joint-target alignment changes wait until endgame and explicitly show any individual increase in routing effort:

- Berlin ↔ Munich: stage 1; partial-network effort 188.596 → 187.478. Positive standalone gain.
- Munich ↔ Paris: stage 1; partial-network effort 187.478 → 187.154. Positive standalone gain.
- Budapest ↔ Munich: stage 3; partial-network effort 520.436 → 519.846. Positive standalone gain.
- Milan ↔ Rome: stage 4; partial-network effort 601.387 → 600.900. Positive standalone gain.

Reassignment fees, train setup and positioning costs are not verified. Original claim-price references are labeled historical references; the queue does not invent a live fee or count it as a build cost. It does not sell trains, shut down railroads, or change anything in your game automatically.

## Earlier deterministic search evidence

The checked reports retain 368 starts and 1,997,013 scored layout evaluations across saved campaigns. These counts include overlap across campaign caches. Search uses connected group relocations, connected exchanges, whole-railroad merges in the variable-count scenario, seeded perturbation restarts, cross-seeding, and merge/split seed construction. Each earlier deterministic campaign stops after 20 consecutive non-improving starts, then exhausts connected relocation groups through six tracks and exchanges through three tracks each way. This is a neighborhood-local optimum, not a global proof. The absolute fuel-distance-only lower bound is 838.80; that bound need not be attainable with the modeled railroad constraints.

All active railroads remain connected and have at most 1,100 total assigned fuel units. This is a common planning bound used for comparisons, not an in-game fuel-tank specification. Labels are matched to initial colors to avoid gratuitous renaming/reclaims. The 38-line scenario with rework also tests a seed obtained by splitting the variable-count solution back into 38 connected railroads. A final merge/split cross-seeding cycle found no improvement to either incumbent; its trace is stored in `analysis/stability_trace.json`.

A joint deferral test tries removing future tracks while preserving every city-pair routing cost, every city, and connected owners. No such removals were found in the selected targets. Smaller worlds are never scored as improvements by dropping unreachable jobs.

## Full completed-world map

The **World map** tab shows all 139 cities and all 190 physical tracks colored by the active completed target, with a Europe inset, numbered owner legend, zoom, owner highlighting and city-label toggle. It includes proposed initial-owner corrections and saved edits without marking purchases or recording claims. Invalid custom ownership is flagged.

[Download the recommended full PNG (5200 × 3900)](https://samueldovgin.github.io/Pocket-Train-Optimizer/assets/map/proposed-completed-world.png) or [open the scalable SVG](https://samueldovgin.github.io/Pocket-Train-Optimizer/assets/map/proposed-completed-world.svg). The prebuilt image is the verified recommended reference; browser exports use the active plan and edits and always include the full target, even when the on-screen view is highlighted or labels are hidden. Follow staged correction cards before changing built-track owners.

This is an approximate geographic diagram, not an exact game screenshot or distance scale. [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/) provides public-domain land outlines. Display coordinates never enter routing calculations. See `assets/map/README.md` for rebuilding; image consistency checks catch a stale image after a target change.

## Monte Carlo search and independent simulation

The latest search evaluated 1,588,500 valid randomized proposals in 24 completed profile campaigns, with 1,411,163 exact scored layouts and 388,422 accepted uphill moves. Counts include repeated layouts across separate campaign caches. Five temperature replicas explore connected track moves, exchanges, random-spanning-tree repartitions of neighboring lines, and variable-count splits/merges. Asymmetric proposal probabilities make this a heuristic optimizer, not a stationary posterior sampler.

Each profile campaign requires at least 50,000 valid proposals and 25 consecutive non-improving annealing rounds, then exhausts connected relocation groups through six tracks and exchanges through three tracks each way (plus whole-line merges when allowed). A further independent seeded campaign repeats across all profiles until none improves. The final of 7 follow-up campaigns made no gain. A separate final merge/split cross-seed audit also completed. These are explicit search plateaus, not proof that no better global layout exists.

| Profile | Before this Monte Carlo search | Current exact score | Synthetic uniform mean gain |
| --- | ---: | ---: | ---: |
| fixed | 915.622146 | 910.231988 | 5.440 |
| rework | 912.192472 | 907.793244 | 4.316 |
| consolidated | 910.369617 | 906.623293 | 3.694 |

Independent evaluation used seed 773194, 5,000 synthetic job batches and 5,002,805 jobs across five demand mixes. Every plan sees identical sampled jobs. Poisson batch size, lognormal city hotspots and Gamma pair variation are assumptions, not measured Pocket Trains spawning rules. The 90% simulation intervals and lower-cost fractions describe these synthetic draws, not confidence intervals or success probabilities for real play.

A further 400 shared distance draws vary only the eight provisional lengths between 70% and 130% of their estimates, then recompute all routes. The site reports how often each line exceeds the nominal planning bound under those assumptions; it does not interpret that bound as a fuel-tank specification. Peak handoff-station counts are workload indicators, not simulated congestion or yard limits.

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

- [Pocket Planes optimization · Evan Diewald](https://github.com/evandiewald/pocket-planes-optimization): Optimizes trips, fleets and airport portfolios using calibrated observations, value iteration and a constrained portfolio model. Inspected the README, portfolio model, value iteration and toy MDP at commit 6f661d1eac4932ca51e9f8450255cd8ff09cee31. Applied reproducible random experiments and separate evaluation seeds. Pocket Planes profit, airport population and delivery bonuses are not assumed to apply to Pocket Trains.
- [Pocket Planes agent simulation · kcelebi](https://github.com/kcelebi/pocket-planes): An agent-based Processing simulation separating agents, game state and actions. Inspected its implementation: several optimizer classes are placeholders and flight time is hardcoded, so it is not a verified global optimizer. Useful separation of jobs, vehicles and time for future calibrated simulation; the present tool makes no vehicle-dispatch or earnings claim.
- [Pocket Planes 2.0 route calculator](https://github.com/veN1ce7/Pocket-Planes-2.0): A route-calculator project derived from earlier community calculators. Its route utilities check range, distance and airport eligibility; this is not a complete network-layout solver. Applied the principle that feasibility must be checked independently of the score. Train choice remains separate from this engine-agnostic ownership model.
- [Pocket Planes distance calculations](https://github.com/daft7/Pocket_Planes_calcs): Documents wraparound distance calculations for a changed Pocket Planes map. Geometry and version assumptions can change preferred routes. Stress-tested the eight provisional Pocket Trains distances. No free-flight or wraparound connections were added to the fixed rail map.
- [Recombination: spanning trees and connected partitions](https://arxiv.org/abs/1911.05725): ReCom explores connected partitions by merging neighboring regions and cutting a random spanning tree. Inspired connected two- and three-railroad repartitions on the track line graph, with a weighted planning cap. Our asymmetric annealing proposals are heuristic optimization, not stationary posterior sampling.
- [Pocket Trains game implementations inspected](https://github.com/JoeyHinckley34/PocketTrains): Search also found this game project and TheIceCreamBear/PocketTrains, a clone. Neither was verified as a complete global track-layout solver. No external project code was copied or executed. Layouts and scores here are independently computed from the supplied tracker map.
- [Pocket Trains official App Store version history](https://apps.apple.com/us/app/pocket-trains-railroad-tycoon/id635931971): Version 1.9 introduced Metro Electric and Petabyte Electric with electrified tracks and zero-fuel operation. Later notes describe engine/fuel-car management fixes. This version history does not independently validate the supplied map or its prices. Kept track distance as an explicit routing proxy instead of claiming literal fuel consumption for every engine. Vehicle speed, capacity, electrification and operating costs remain outside the engine-agnostic objective.

No external project code was copied or executed. These sources inform experimental design; Pocket Planes airport/population rules, bonuses and flight economics are not imported into Pocket Trains. Direct Pocket Trains repository searches found game implementations but did not establish an existing complete global layout solver. Research observations refer to the inspected versions, not a claim that these projects can never improve.

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
