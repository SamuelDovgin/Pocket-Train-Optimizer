# Verification and iterative search — November 3, 2026

The original bundle and previously published scores were reproduced before the broader search. The previous published target scored 926.3084141382546. The lowest current routing-score target scores **910.369617349599** with **20** railroads. All 9,591 city pairs remain reachable.

## Comparison at transfer penalty 40

| Scenario | Railroads | Fuel/job | Transfers/job | Effort/job | Initial owner changes |
| --- | ---: | ---: | ---: | ---: | ---: |
| Deeper search · keep starting owners | 38 | 843.70 | 1.798 | 915.62 | 0 |
| Deeper search · allow starting corrections | 38 | 846.07 | 1.653 | 912.19 | 4 |
| Experimental · fewer railroads | 20 | 844.33 | 1.651 | 910.37 | 2 |

The smaller-railroad result trades lower transfer cost against more demanding train duties. Every active railroad is connected, and assigned track-fuel totals stay at or below 1,100. Total assigned fuel is not tank capacity, speed, waiting time or earnings. The plans remain engine-agnostic as requested.

## Changes to your starting configuration

- Berlin ↔ Munich: **Green → Purple**.
- Milan ↔ Rome: **Blue → Green**.

The queue shows each current owner and target owner, groups connected claims into ordered batches, preserves all physical purchase flags, and records completed batches separately. Nothing in your game changes automatically. Undo restores only the tracker record; reverse a game claim separately if you intend to undo it in game.

- Berlin ↔ Munich: after stage 1 gateway prerequisites.
- Milan ↔ Rome: starting network.

Timing is based on matched jobs within the same stage's physical network, with earlier scheduled corrections included. Live claim fees and train availability are additional considerations. No track demolition/rebuild, engine sale, or railroad shutdown is assumed. Historical claim prices are references, not asserted live reassignment fees.

## Evidence and stop rule

Saved campaigns contain 368 starts and 585,850 scored layout evaluations, with separate caches and possible overlap across campaigns. The search includes larger connected relocations, paired exchanges, seeded perturbations, multiple supplied starts, different railroad counts, and merge/split cross-seeding. Final campaigns stop after 20 consecutive non-improving starts, followed by exhaustive scoring of the final connected relocation groups through size six and exchanges through size three each way. Full-line merges are also checked in the variable-count scenario. The larger tested neighborhood contains no improving move at the recorded endpoint. The final merge/split cross-seeding cycle also left both incumbents unchanged.

This is a local-search stopping criterion, not a proof of global optimality. The fuel-only distance lower bound is 838.796789; it ignores transfers and may not be attainable under connected capped ownership. Search scripts, seeds, incumbents, and campaign reports remain in the repository for continuation.

## Track choices and tests

The joint deferral audit preserves all 139 cities and all 9,591 city-pair costs at handoff penalty 40, along with connected railroad ownership. It found no removable future tracks for these targets. The audit does not treat dropping a city or ignoring unreachable jobs as a benefit.

Python tests reproduce every new metric at penalties 0, 20, 40 and 80, check line constraints, re-enumerate the final move neighborhoods, and verify positive phase gains at scheduled correction stages. JavaScript tests compare every route against Python at penalty 40 for all three targets and simulate all 180 remaining purchases plus every correction batch. Tests also cover batch undo, backup migration/history, invalid imports, restored initial tracks, same-station/disconnected routes, tie-breaking, and route symmetry.

Browser QA verifies that recording a correction leaves the physical track count unchanged, saves across reload, and supports whole-batch undo. It checks plan selection, current versus target route scopes, scenario comparisons and narrow-screen layout. The previous browser file-picker/download automation limit remains: backup parsing/migration is tested in JavaScript, while transferring a save from a downloaded HTML tracker may require manual Export/Import.

## Progression research

The [Wiki train table](https://pocket-trains.fandom.com/wiki/Train) and [Reddit progression discussion](https://www.reddit.com/r/pockettrains/comments/g1yviw/) report regular part pools in roughly four-level groups: Steamers 1–4, Express 5–8, Standard 9–12, Zephyr 13–16, Freighter 17–20, Hybrid 21–24. Special availability differs. The [Wiki fuel page](https://pocket-trains.fandom.com/wiki/Fuel) describes fuel-car upgrades; [community straight-line discussion](https://www.reddit.com/r/pockettrains/comments/1rb5ajb/why_straight_lines/) explains why long branched routes can be awkward in practice. These are guidance sources, not a measured simulator or a promise of parts at a given level.

## Remaining limits

Map and costs come from the supplied tracker. Eight fuel lengths and eight prices are unverified. Job probabilities, transfer friction and the 1,100-unit bound are assumptions. Real operation depends on engines, train positions, speed, cargo, yards, refueling and player attention. Lower modeled effort does not prove higher profit. Progress is browser-local and needs a JSON backup to transfer.
