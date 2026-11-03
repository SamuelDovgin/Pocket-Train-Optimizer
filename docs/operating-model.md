# One-train operating model — November 3, 2026

[Open the operating simulator](https://samueldovgin.github.io/Pocket-Train-Optimizer/#operations).

This model tracks one identical physical train per active railroad. The outcome is completed synthetic reward per 1,000 normalized time units. It is not calibrated coins/hour or net profit. Construction, engine and repair costs are excluded. None of the experimental scenarios is adopted into the construction checklist automatically.

## Map and fair comparisons

The inherited 190-track graph omits Nairobi–Zanzibar, visible as a 35-unit connection in both user-supplied human layouts. The operating input adds that link to make 191 available connections and keeps 139 cities. Its current in-game status and nine approximate/image-derived lengths remain to be verified. Historical routing reports retain their original input and are explicitly labeled historical.

There are 68 odd-degree stations in the 191-link graph. Every simple path contributes two endpoints, so an edge-covering partition into unbranched non-looping railroads needs at least 34 lines. A fully covered, branch-free 28-line partition is impossible on this input. The 38-corridor scenario covers every available edge; the 28-corridor scenario uses 140 connections but still serves every city and retains all 15 starting tracks. Unused connections are not instructions to sell or demolish track.

Each corridor candidate is constructed from randomized path mergers with a 1,100-unit line-length construction bound and five human-inspired spines. This bound is not a train tank. Labels are matched to preserve reference starting ownership where possible. Candidate construction is geometric, not an optimization over held-out simulation results. These are adaptations of the images, not exact digitizations: the source images reuse colors and have some uncolored routes. The second image also contains Scandinavian and Australian loops.

Comparison groups match 28 trains against 28 trains and 38 against 38. Every scenario offers destinations in the same 139-city world and starts empty with seed-randomized patrol phases. The early 4,000 units of each 16,000-unit default run are warmup. Reports also show per-train rates when comparing different fleets.

## Event model and documented mechanics

NimbleBit documents private per-engine job boards, refresh on station entry, shared yard cargo, and the restriction against unloading cargo at its origin: https://support.nimblebit.com/support/solutions/articles/150000013209-refreshing-sharing-and-laying-over-jobs.

An arrival completes the previous physical leg, delivers any carried cars destined for the station, and creates its private fresh board. Handoffs wait until stop handling and the next player check-in; ready trains unload before the pickup phase at a shared tick. A finite-capacity yard can reject an unload; rejected cars remain physically onboard. With a spare train slot, the train can first collect a waiting car for its line and then unload an inbound car, preserving both capacities after each action. A fresh private board is generated exactly once at arrival, and persists unchanged while waiting. Unselected fresh offers expire on departure. Yard cars persist until collected.

Dispatch occurs after stop handling and the next shared check-in tick. Cargo is chosen from the current train's private board and appropriate shared-yard cars. Yard cars have priority. Every departure specifies one actual neighboring station on that train's railroad. Trips take their supplied track-distance in model-time at generic speed 1. Another railroad's train does not teleport or instantly accept a transfer. Jobs earn credit only on final delivery. Cargo still waiting at the horizon earns no reward.

Fresh offers are one-car units, not game job batches. Origin-conditioned shortest routing disallows transfers at that car's origin throughout its journey; an offer impossible for the receiving train to take anywhere useful is counted as an unroutable offer and is not magically shared with another train. Its expiry is still included in car conservation.

## Dispatch procedures

Patrol uses a minimum-distance undirected route-inspection tour: shortest-path matching of odd-degree stations duplicates necessary edges, followed by an Euler tour. For a simple corridor this is an end-to-end shuttle and return. Branches introduce physical revisits; cycles remain explicitly traveled. Loading favors cars deliverable within an assumed bound on forward travel detour.

Cargo-directed dispatch chooses a useful onboard leg endpoint and takes one adjacent step toward it. If there is no useful onboard endpoint, it considers available offers or falls back to patrol. This policy can behave worse than patrol and is not described as globally optimal. Neither policy has perfect future demand knowledge. Shared check-ins assume enough player actions to dispatch every ready train, without a finite attention budget.

Optional generic fuel tanks subtract distance on departure and regenerate only during stationary time. If insufficient fuel is available, departure waits for regeneration and a check-in. Tracks longer than the assumed tank are rejected, not silently skipped. These are proxy units and generic constraints, not specifications for an actual starter or late-game train.

## Assumed demand and reward

Offers per arrival, cargo capacity, yard capacity, check-in interval, handling time, spare slots and optional refueling are configurable. Destination priors include uniform, same-region weighted, cross-region weighted, and approximate-distance weighted. No city population distribution is inferred from Pocket Planes.

Reward index equals approximate Mercator-coordinate straight-line separation between the original source and destination, multiplied by an assumed uniform 1–4 multiplier. Track geometry does not increase that reward. This is an engine-agnostic analogue of direct-distance incentives, not a recovered coin-price formula. Exact destination probabilities, job-count distributions and multiplier probabilities have not been recovered from the game.

Bux, crates, events, grouped jobs and partial job loads, real train speeds, repairs, electrification, actual fuel economics and setup costs are absent. Real boards must be recorded and used for calibration before these outcomes can support profit predictions.

## Training and held-out results

768 runs completed: 12 dispatch configurations per layout × 2 training seeds × 2 demand mixes = 192 training runs; 12 scenarios × 12 separate evaluation seeds × 4 layouts = 576 held-out runs. Training can select patrol/cargo dispatch, 0/1/2 reserved slots, and a 1.25/1.75 forward detour limit. Layout geometry was not selected using held-out outcomes. Raw results retain seeds, options, rates and example cumulative reward curves.

| Synthetic scenario | 28 corridors vs 28-line baseline | 38 corridors vs 38-line baseline |
| --- | ---: | ---: |
| uniform | -19.6% | 45.1% |
| local | -10.3% | 56.8% |
| global | -18.1% | 53.9% |
| longhaul | -20.9% | 36.2% |
| light | -22.9% | 110.0% |
| heavy | -19.2% | 19.1% |
| continuous | -16.6% | 14.0% |
| infrequent | -8.7% | 140.5% |
| small_yards | -22.2% | 85.4% |
| large_yards | -15.1% | 156.4% |
| refueling | -26.4% | 64.2% |
| smaller_capacity | -21.2% | 34.7% |

The full-coverage 38-corridor candidate has higher mean reward index in 12 of 12 tested scenarios. The sparse 28-corridor candidate has higher mean reward index in 0 of 12. These are conditional results for the implemented demand and dispatch policies, not proof that either human image or any game layout is universally optimal. Paired ranges describe the observed synthetic seeds only, not confidence intervals for real earnings.

## Accounting and verification

Independent counters enforce offered cars = delivered + discarded offers + onboard + yard + still-visible fresh-board cars. Both full-run and post-warmup deliveries are counted. Rates, load and time shares use only the post-warmup observation window; displayed remaining inventories are end-of-run counts. Offer, blocked-yard and unroutable-offer counters describe the whole run. Every train's measured movement time plus stationary time equals the observation window. In-flight travel at the horizon is clipped, physical cargo capacity is respected, and reward is never awarded to unfinished cargo.

Tests use tiny hand-calculable networks for exact delivery times, non-refreshing stationary boards, shared-yard handoffs, forbidden origin transfers, fuel waits, finite-yard blocking, and horizon accounting. World tests check connectivity, fleet matching, physical patrol coverage, original-track retention, reproducibility and capacity/time/car conservation. Report tests bind the results to the exact operating-core and input hashes.

## Reproduce

Use the repository's Python requirements for construction, then run:

    python3 scripts/build-operating-data.py
    node scripts/evaluate-operating.cjs
    node scripts/document-operating.cjs
    npm test
    npm run build

Operating data and results are versioned separately from historical routing files. The browser uses the same JavaScript simulation core in a worker. Existing local saves and ownership records are not rewritten.
