# One-train operating model — November 3, 2026

[Open the operating simulator](https://samueldovgin.github.io/Pocket-Train-Optimizer/#operations).

This model tracks one identical physical train per active railroad. The outcome is completed synthetic reward per 1,000 normalized time units. It is not calibrated coins/hour or net profit. Construction, engine and repair costs are excluded. None of the experimental scenarios is adopted into the construction checklist automatically.

## Direct-distance payout and corridor strategy · version 2

Payout index = straight origin-to-destination separation in the supplied game-map image × cargo multiplier. Track distance is the travel/time cost, not an extra source of payout. This rewards direct routing and lets long runs amortize stop and player check-in overhead. There is no fitted distance exponent or layout-specific payout factor.

The previous version used approximate geographic Mercator coordinates, stopped at every station and prioritized payout divided by the first hop to a transfer hub. Version 2 replaces that geometry with 139 manually digitized station centers, supports express pass-through deliveries, and compares a direct-first full-trip loading rule with the earlier loading rule. Existing candidate layouts are retained so every operating procedure can be compared on the same graphs.

Community observations support the direct-distance incentive: https://www.reddit.com/r/pockettrains/comments/131mrb8. Players also describe automatic intermediate deliveries: https://www.reddit.com/r/pockettrains/comments/ks8rlt. These are player observations, not an official recovered payout algorithm. A community formula proposed an affine relation to hypothetical straight-line fuel, but replies dispute that conversion; version 2 retains an uncalibrated linear distance index instead of treating that coefficient or intercept as established: https://www.reddit.com/r/pockettrains/comments/gm496q.

## Map and fair comparisons

The inherited 190-track graph omits Nairobi–Zanzibar, visible as a 35-unit connection in both user-supplied human layouts. The operating input adds that link to make 191 available connections and keeps 139 cities. Its current in-game status and nine approximate/image-derived lengths remain to be verified. Historical routing reports retain their original input and are explicitly labeled historical.

There are 68 odd-degree stations in the 191-link graph. Every simple path contributes two endpoints, so an edge-covering partition into unbranched non-looping railroads needs at least 34 lines. A fully covered, branch-free 28-line partition is impossible on this input. The 38-corridor scenario covers every available edge; the 28-corridor scenario uses 140 connections but still serves every city and retains all 15 starting tracks. Unused connections are not instructions to sell or demolish track.

Each corridor candidate is constructed from randomized path mergers with a 1,100-unit line-length construction bound and five human-inspired spines. This bound is not a train tank. Labels are matched to preserve reference starting ownership where possible. Candidate construction is geometric, not an optimization over held-out simulation results. These are adaptations of the images, not exact digitizations: the source images reuse colors and have some uncolored routes. The second image also contains Scandinavian and Australian loops.

Comparison groups match 28 trains against 28 trains and 38 against 38. Every scenario offers destinations in the same 139-city world and starts empty with seed-randomized patrol phases. The early 4,000 units of each 16,000-unit default run are warmup. Reports also show per-train rates when comparing different fleets.

## Event model and documented mechanics

NimbleBit documents private per-engine job boards, refresh on station entry, shared yard cargo, and the restriction against unloading cargo at its origin: https://support.nimblebit.com/support/solutions/articles/150000013209-refreshing-sharing-and-laying-over-jobs.

Each physical arrival or pass-through completes the preceding track leg and delivers carried cars destined for that station. Only a planned stop creates an accessible private fresh board. Passing trains cannot load, unload into yards or refuel, and do not wait for a player check-in. Offers at passed stations are not accessible and therefore are not generated in this model. Handoffs wait until stop handling and the next player check-in; ready trains unload before the pickup phase at a shared tick. A finite-capacity yard can reject an unload; rejected cars remain physically onboard. With a spare train slot, the train can first collect a waiting car for its line and then unload an inbound car, preserving both capacities after each action. A fresh private board is generated exactly once per planned stop, and persists unchanged while waiting. Unselected fresh offers expire on departure. Yard cars persist until collected.

Dispatch occurs after stop handling and the next shared check-in tick. Cargo is chosen from the current train's private board and appropriate shared-yard cars. The chosen loading rule decides cargo priority. A dispatch command can specify a multi-track express trip. Every leg is still traveled physically, and the train receives only one command/check-in for the planned run. Transfers require planned stops. Trips take their supplied track-distance in model-time at generic speed 1. Another railroad's train does not teleport or instantly accept a transfer. Jobs earn credit only on final delivery. Cargo still waiting at the horizon earns no reward.

Fresh offers are one-car units, not game job batches. Origin-conditioned shortest routing disallows transfers at that car's origin throughout its journey; an offer impossible for the receiving train to take anywhere useful is counted as an unroutable offer and is not magically shared with another train. Its expiry is still included in car conservation.

## Dispatch procedures

Patrol uses a minimum-distance undirected route-inspection tour: shortest-path matching of odd-degree stations duplicates necessary edges, followed by an Euler tour. For a simple corridor this is an end-to-end shuttle and return. Branches introduce physical revisits; cycles remain explicitly traveled. Loading favors cars deliverable within an assumed bound on forward travel detour.

Cargo-directed dispatch chooses a useful onboard leg endpoint and follows a shortest path toward it, using physical adjacent legs. If there is no useful onboard endpoint, it considers available offers or falls back to patrol. This policy can behave worse than patrol and is not described as globally optimal. Neither policy has perfect future demand knowledge. Shared check-ins assume enough player actions to dispatch every ready train, without a finite attention budget.

Express patrol commands continue along a shortest, non-repeating section of the inspection walk, stopping for required onboard transfers, visible waiting-yard pickups with available capacity, a turnaround, a route that would cease to be shortest, or a tank-distance limit. Pickup plans use yard contents visible when the command is issued. Future arrivals do not reroute a train in motion. An every-station stop strategy is retained as a control. Automatic intermediate deliveries do not refill the train. Skipping stations reduces board access as well as player actions.

Corridor loading first favors cars that can finish their remaining journey on the current train, then ranks by payout divided by estimated whole-trip burden. That burden includes actual forward patrol distance for the first leg, shortest remaining legs, stop handling and half a check-in interval, plus half the next train's patrol cycle and another check-in/handling allowance at each transfer. This is an explicit loading heuristic, not extra payout. Aging weights avoid always choosing new cargo. The earlier rule instead prioritizes yard cargo and payout divided by the first hub hop. Both rules are trained and scored by actual completed reward per time.

Optional generic fuel tanks subtract distance on departure and regenerate only during stationary time. The entire commanded express run must fit the tank; the planner shortens it into separate stops if necessary. If insufficient fuel for the planned run is available, departure waits for regeneration and a check-in. Tracks longer than the assumed tank are rejected, not silently skipped. These are proxy units and generic constraints, not specifications for an actual starter or late-game train.

## Assumed demand and reward

Offers per arrival, cargo capacity, yard capacity, check-in interval, handling time, spare slots and optional refueling are configurable. Destination priors include uniform, same-region weighted, cross-region weighted, and approximate-distance weighted. No city population distribution is inferred from Pocket Planes.

Reward index equals Euclidean separation between the original source and destination in the 2,571 × 1,286 reference image, multiplied by an assumed uniform 1–4 multiplier. The station centers are approximate manual readings of nb9jc27v1ey41.jpg, not values extracted from the game. Alice Springs and Pretoria are specifically marked as estimated. The geometry, source and an approximate pixel reading error are published in assets/map/game-reward-coordinates.json. Close stations and overlapping markers are particularly uncertain. A global pixel-to-coin scale has not been calibrated. Geographic map display coordinates are now separate from payout coordinates. Track geometry does not increase that reward. This is an engine-agnostic analogue of direct-distance incentives, not a recovered coin-price formula. Exact destination probabilities, job-count distributions and multiplier probabilities have not been recovered from the game.

Bux, crates, events, grouped jobs and partial job loads, real train speeds, repairs, electrification, actual fuel economics and setup costs are absent. Real boards must be recorded and used for calibration before these outcomes can support profit predictions.

## Training and held-out results

1488 runs completed: 48 configurations per layout × 2 training seeds × 2 demand mixes × 4 layouts = 768 training runs; 15 scenarios × 12 separate evaluation seeds × 4 layouts = 720 held-out runs. New training and evaluation seeds are separate from version 1. Training can select patrol/cargo dispatch, 0/1/2 reserved slots, a 1.25/1.75 forward detour limit, express/every-station stops, and corridor/earlier loading. The long-run sensitivity scenario uses 48,000 time units with a 12,000-unit warmup; other scenarios use 16,000/4,000. Longer runs help reveal delayed long-haul deliveries that a shorter horizon may miss. Layout geometry was not selected using held-out outcomes. Raw results retain seeds, options, rates and example cumulative reward curves.

| Synthetic scenario | 28 corridors vs 28-line baseline | 38 corridors vs 38-line baseline |
| --- | ---: | ---: |
| uniform | -8.6% | 74.9% |
| local | -3.0% | 97.5% |
| global | -9.8% | 60.8% |
| longhaul | -7.0% | 54.2% |
| light | -6.6% | 96.2% |
| heavy | 3.1% | 94.8% |
| continuous | -4.4% | 74.3% |
| infrequent | 0.5% | 82.7% |
| small_yards | -12.5% | 107.0% |
| large_yards | -5.4% | 121.2% |
| refueling | -16.0% | 106.6% |
| smaller_capacity | 1.8% | 80.5% |
| all_stops | -11.2% | 89.5% |
| legacy_loading | -13.4% | 22.2% |
| long_run | 19.4% | 32.9% |

The full-coverage 38-corridor candidate has higher mean reward index in 15 of 15 tested scenarios. The sparse 28-corridor candidate has higher mean reward index in 4 of 15. These are conditional results for the implemented demand and dispatch policies, not proof that either human image or any game layout is universally optimal. Paired ranges describe the observed synthetic seeds only, not confidence intervals for real earnings.

## Accounting and verification

Independent counters enforce offered cars = delivered + discarded offers + onboard + yard + still-visible fresh-board cars. Reports additionally expose reward per dispatch command, reward per actual track-distance, mean delivered direct span and the share of deliveries needing no train transfers. Direct span uses reference-image pixels, while track-distance/fuel uses the supplied track lengths; these two units are not interchangeable. These operating and geometric changes supersede the previous operating percentages and absolute index rates. Both full-run and post-warmup deliveries are counted. Rates, load and time shares use only the post-warmup observation window; displayed remaining inventories are end-of-run counts. Offer, blocked-yard and unroutable-offer counters describe the whole run. Every train's measured movement time plus stationary time equals the observation window. In-flight travel at the horizon is clipped, physical cargo capacity is respected, and reward is never awarded to unfinished cargo.

Tests use tiny hand-calculable networks for exact delivery times, non-refreshing stationary boards, shared-yard handoffs, forbidden origin transfers, fuel waits, finite-yard blocking, horizon accounting, express intermediate delivery without loading or check-ins, full-run tank limits and payout invariance to track detours. World tests check connectivity, fleet matching, physical patrol coverage, original-track retention, reproducibility and capacity/time/car conservation. Report tests bind the results to the exact operating-core and input hashes.

## Reproduce

Use the repository's Python requirements for construction, then run:

    python3 scripts/build-operating-data.py
    node scripts/evaluate-operating.cjs
    node scripts/document-operating.cjs
    npm test
    npm run build

Operating data and results are versioned separately from historical routing files. The browser uses the same JavaScript simulation core in a worker. Existing local saves and ownership records are not rewritten.
