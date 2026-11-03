# Verification and iterative search — November 3, 2026

The original bundle and previously published scores were reproduced before the broader search. The previous published target scored 926.3084141382546. The lowest current routing-score target scores **906.623292670212** with **28** railroads. All 9,591 city pairs remain reachable.

The inherited 190-track input omits Nairobi–Zanzibar, visible in both supplied human layouts. Historical routing scores below apply only to that input; they do not establish game-map completeness or practical profit. The new [operating model](https://samueldovgin.github.io/Pocket-Train-Optimizer/#operations) adds the pictured link in a separate 191-track experiment with one physical train per railroad. Its job and reward distributions remain assumptions. No experimental ownership plan is automatically applied to the checklist.

## Comparison at transfer penalty 40

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Monte Carlo · keep starting owners | 38 | 841.17 | 1.727 | 910.23 | 0 |
| Monte Carlo · explicit starting corrections | 38 | 840.98 | 1.670 | 907.79 | 5 |
| Monte Carlo · fewer railroads | 28 | 841.15 | 1.637 | 906.62 | 4 |

The smaller-railroad result trades lower transfer cost against more demanding train duties. Every active railroad is connected, and assigned track-fuel totals stay at or below 1,100. Total assigned fuel is not tank capacity, speed, waiting time or earnings. The plans remain engine-agnostic as requested.

## Changes to your starting configuration

- Berlin ↔ Munich: **Green → Africa Cross**.
- Budapest ↔ Munich: **Pink → Green**.
- Milan ↔ Rome: **Blue → North America East**.
- Munich ↔ Paris: **Pink → Blue**.

The queue shows each current owner and target owner, groups connected claims into ordered batches, preserves all physical purchase flags, and records completed batches separately. Nothing in your game changes automatically. Undo restores only the tracker record; reverse a game claim separately if you intend to undo it in game.

- Berlin ↔ Munich: stage 1; partial-network effort 188.596 → 187.478. Positive standalone gain.
- Munich ↔ Paris: stage 1; partial-network effort 187.478 → 187.154. Positive standalone gain.
- Budapest ↔ Munich: stage 3; partial-network effort 520.436 → 519.846. Positive standalone gain.
- Milan ↔ Rome: stage 4; partial-network effort 601.387 → 600.900. Positive standalone gain.

Timing is based on matched jobs on the physical network actually buildable before the correction, with earlier scheduled corrections included. Not every individual step improves routing: endgame alignment steps explicitly show their signed effect and can enable the stronger joint layout. Prerequisites never include a purchase that needs the pending correction first. Live claim fees and train availability are additional considerations. No track demolition/rebuild, engine sale, or railroad shutdown is assumed. Historical claim prices are references, not asserted live reassignment fees.

## Earlier deterministic search evidence

Saved campaigns contain 368 starts and 1,997,013 scored layout evaluations, with separate caches and possible overlap across campaigns. The search includes larger connected relocations, paired exchanges, seeded perturbations, multiple supplied starts, different railroad counts, and merge/split cross-seeding. Earlier deterministic campaigns stop after 20 consecutive non-improving starts, followed by exhaustive scoring of the final connected relocation groups through size six and exchanges through size three each way. Full-line merges are also checked in the variable-count scenario. The larger tested neighborhood contains no improving move at the recorded endpoint. The final merge/split cross-seeding cycle also left both incumbents unchanged.

This is a local-search stopping criterion, not a proof of global optimality. The fuel-only distance lower bound is 838.796789; it ignores transfers and may not be attainable under connected capped ownership. Search scripts, seeds, incumbents, and campaign reports remain in the repository for continuation.

## Track choices and tests

The joint deferral audit preserves all 139 cities and all 9,591 city-pair costs at handoff penalty 40, along with connected railroad ownership. It found no removable future tracks for these targets. The audit does not treat dropping a city or ignoring unreachable jobs as a benefit.

Python tests reproduce every new metric at penalties 0, 20, 40 and 80, check line constraints, re-enumerate the final move neighborhoods, and reproduce signed effects and prerequisites at scheduled correction stages. JavaScript tests compare every route against Python at penalty 40 for all three targets and simulate all 180 remaining purchases plus every correction batch. Tests also cover batch undo, backup migration/history, invalid imports, restored initial tracks, same-station/disconnected routes, tie-breaking, and route symmetry.

Browser QA verifies that recording a correction leaves the physical track count unchanged, saves across reload, and supports whole-batch undo. It checks plan selection, current versus target route scopes, scenario comparisons and narrow-screen layout. The previous browser file-picker/download automation limit remains: backup parsing/migration is tested in JavaScript, while transferring a save from a downloaded HTML tracker may require manual Export/Import.

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

## Progression research

The [Wiki train table](https://pocket-trains.fandom.com/wiki/Train) and [Reddit progression discussion](https://www.reddit.com/r/pockettrains/comments/g1yviw/) report regular part pools in roughly four-level groups: Steamers 1–4, Express 5–8, Standard 9–12, Zephyr 13–16, Freighter 17–20, Hybrid 21–24. Special availability differs. The [Wiki fuel page](https://pocket-trains.fandom.com/wiki/Fuel) describes fuel-car upgrades; [community straight-line discussion](https://www.reddit.com/r/pockettrains/comments/1rb5ajb/why_straight_lines/) explains why long branched routes can be awkward in practice. These are guidance sources, not a measured simulator or a promise of parts at a given level.

## Remaining limits

Map and costs come from the supplied tracker. Eight fuel lengths and eight prices are unverified. Job probabilities, transfer friction and the 1,100-unit bound are assumptions. Real operation depends on engines, train positions, speed, cargo, yards, refueling and player attention. Lower modeled effort does not prove higher profit. Progress is browser-local and needs a JSON backup to transfer.
