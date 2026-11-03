> Historical README from the supplied bundle. The current corrected model, results, and reproduction commands are documented in [the repository README](../README.md) and [verification notes](../docs/verification.md).

# Pocket Trains — graph-theory ownership model (3 Nov 2026)

This is an **offline, reproducible route-efficiency experiment**, not a copy of NimbleBit's job simulator and not a prediction of actual coins/hour.

## Inputs and fixed assumptions

- Curated world map from the prior tracker: 139 cities and 190 distinct connections; **8 track fuel lengths are provisional**.
- 38 named railroad assignments. All 15 originally owned/completed track ownerships are frozen.
- Each railroad is one connected subgraph of the full map. Each advanced candidate railroad's sum of assigned track-fuel lengths must be <=1,100. The 1,100 bound is a planning constraint **not an in-game fuel-tank specification**.
- Each of the **9,591** unordered pairs of distinct cities is treated as a potential origin–destination job. In the main scenario each has equal weight.
- The mathematical score for any job is **track fuel used + H × number of railroad changes**, where H is a made-up transfer-friction parameter (0, 20, 40 or 80). A Dijkstra shortest path search on an expanded `(city, railroad)` state graph selects the least-cost route. This does not include train positioning, speed, capacity, car size, yard limits, job refresh, or fuel regeneration.

## Optimization method

1. Previous local-search owner assignment with 25 single-track reassignment steps: transfers/job ~2.751 at H=40, routing effort ~957.89.
2. Greedy single-edge reassignment search continued until no improving connected ownership changes remained, retaining 38 railroads and the fixed 15 tracks. This reached ~932.29 routing effort.
3. A second greedy search allowed connected two-track moves (plus single-track moves). This reached **927.91** routing effort.

This is a constrained **local optimum**, not a global integer-programming proof. The solution changes the planned owner of 88 future links relative to the original, with the existing 15 links unchanged.

## Main world comparison (H=40)

| Statistic | Original | Previous 25-step | New local search |
|---|---:|---:|---:|
| Mean fuel units per possible job | 848.70 | 847.87 | 845.17 |
| Mean train-to-train transfers | 3.483 | 2.751 | 2.069 |
| Mean generalized effort | 988.02 | 957.89 | 927.91 |
| Share jobs requiring <=1 transfer | 18.63% | 23.41% | 33.58% |
| Share jobs requiring >=3 transfers | 66.01% | 54.74% | 34.46% |
| Total branching index (sum of max(0, station degree − 2), per line) | 27 | 29 | 35 |

The advanced assignment improves modeled effort by 6.1% compared with the original (3.1% versus the earlier locally refined owner assignment), and reduces transfers by 40.6% from the original. It does **not** prove higher actual earnings/hour. Increased branching can require costly train repositioning that this model ignores.

## Demand bias robustness

At H=40, relative to the previous 25-step layout, additional modeled effort reduction is roughly:

- All origin-destination pairs equally weighted: 3.13%.
- Same-continent jobs 5x weight: 2.83%.
- Cross-continent jobs 5x weight: 3.21%.
- Pairs with physical shortest route >=1100 fuel 4x weight: 3.23%.
- Pairs <=450 fuel 4x weight: 2.88%.

Again these are *synthetic scenario weights*. The actual job distribution is unknown.

## Bottlenecks

Weighted physical edge betweenness is calculated on the all-track network with fuel as edge length; with no railroad transfer cost. Some high-use links in this hypothetical all-pairs traffic: Baghdad–Tehran ~26.0%, Budapest–Munich ~25.8% (already owned), Tehran–Kabul ~23.5%, Kabul–New Delhi ~22.9%. High betweenness alone is **not** a recommended construction order, because continent license availability and additional engines are not included.

The selected cheapest generalized itineraries on the 15 already purchased European tracks (14 connected cities, 91 unordered potential jobs) incur transfers most often at Paris (26), Munich (15), Milan (12), and Madrid (7). Do not confuse these counts with observed station demand or car stockyard occupancy.

## Files

- `pocket_trains_graph_optimized_tracker.html`: main interactive offline app, preserving prior progress through same local storage key when accessible; supports JSON import/export of progress.
- `world_tracker_data.json`: map and initial build-order dataset.
- `pocket_trains_efficiency_results.json`: earlier baseline and local refinement results.
- `graph_theory_results.json`: 3-scenario numerical comparisons, line-ownership assignments, OD-demand robustness, hub counts, betweenness, and topology complexity.
- `model_pocket_trains.py`: state-expanded graph / Dijkstra routing evaluator.
- `optimize_pocket_trains.py`: earlier 25-step single-edge heuristic.
- `advanced_optimize.py`: expanded greedy reassignment heuristic.
- `advanced_pairs_run.py`: connected two-track move heuristic.
- `graph_theory_analysis.py`: alternative job-mix tests and bottleneck analysis.
- `advanced_greedy.json`, `advanced_pairs.json`: steps and solutions.

To reproduce the analysis, install Python 3 with `networkx`, `numpy`, and `scipy` and run `python graph_theory_analysis.py` from this folder. For the optimization progression from scratch, first run `python optimize_pocket_trains.py`, then `python advanced_optimize.py`, then `python advanced_pairs_run.py`. Scripts use the contained input data and heuristic choices; performance may vary. Nothing uses live data or the internet.

## Where a real-world/operational model should go next

The biggest missing quantities are observed job arrival probabilities by destination; car counts and rewards; actual train speeds/capacities/fuel tanks; fuel regeneration; train positions; stockyard capacity; and user check-in cadence. With gameplay logs, a discrete-event simulator could optimize **coins or Bux per real hour** and compare line count, yard upgrades, and locomotive assignments, with confidence intervals over randomized scenarios.

Sources: https://www.reddit.com/r/pockettrains/comments/1o7viej ; https://www.reddit.com/r/pockettrains/comments/1q8cif3/ ; https://pocket-trains.fandom.com/wiki/Jobs ; https://apps.apple.com/us/app/pocket-trains-railroad-tycoon/id635931971
