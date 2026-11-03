# Pocket Train Optimizer

[Open the live planner](https://samueldovgin.github.io/Pocket-Train-Optimizer/)

A browser-based Pocket Trains world expansion checklist and reproducible cargo routing model. The supplied dataset has 139 cities, 190 connections, and 38 planning railroads. New checklists begin with the user's 10 original tracks and five completed expansions.

Choose **Recommended · improved graph search** in the Build queue. Complete a purchase in the game, then check it off. The queue recomputes priorities around continent licenses, physical connections, and each railroad's connected track ownership. You can edit an owner, cost, or note and compare routes on purchased tracks or the full active plan. Checked track owners stay fixed when you switch plans.

Progress stays in this browser's local storage. It is not uploaded to GitHub or synced across devices. To move from the downloaded tracker, export its JSON backup and import it on the live site. Versions 1, 3, and 4 are supported. A new origin such as GitHub Pages cannot automatically read saves from a local HTML file. Export backups regularly.

## Verified improvement

With a hypothetical transfer penalty of 40 fuel-equivalent units and all 9,591 city pairs equally weighted:

| Layout | Mean fuel | Transfers/job | Mean effort |
| --- | ---: | ---: | ---: |
| Original | 848.70 | 3.483 | 988.02 |
| Earlier 25-move refinement | 847.87 | 2.751 | 957.89 |
| Supplied advanced solution | 845.17 | 2.069 | 927.91 |
| Improved solution | 844.98 | 2.033 | 926.31 |

The corrected search uses current line lengths and deterministically enumerates connected one-, two-, and three-track moves. It preserves all 15 initially completed owners, all 38 connected railroads, and the model's 1,100 total-track-fuel bound per line. It exhausts its tested move neighborhoods; this is a local optimum, not a global proof. The improved assignment differs on 91 tracks from the original layout.

This optimizes fuel plus synthetic handoff friction, not coins/hour or a train timetable. Eight fuel lengths and eight prices remain unverified. The line-fuel bound is a modeling constraint, not an engine tank specification. Real profitability depends on trains, jobs, capacity, waiting, yards, and play cadence. The inherited game map/prices were checked for consistency, not independently remeasured in the current game.

## Run and verify

The website has no npm dependencies or runtime API calls.

```sh
npm test
python3 -m pip install -r requirements.txt
python3 -m unittest discover -s tests -p 'test_*.py' -v
npm run build
npm start
```

Open http://127.0.0.1:8765. Node 20+ and Python 3.11+ are suitable. Python analysis uses NumPy, SciPy, and NetworkX; the tests recompute every published comparison and compare selected routes against an independent NetworkX graph. Browser-core tests check construction sequences, save validation, and routing edge cases.

## Reproduce the improved analysis

```sh
python3 scripts/improve_model.py
python3 analysis/graph_theory_analysis.py
python3 scripts/sync_data.py
npm test
```

`improve_model.py` starts from `analysis/advanced_pairs.json`; it writes `analysis/improved_solution.json`. Time-limited runs report their termination reason and never claim neighborhood exhaustion if interrupted. `graph_theory_analysis.py` uses the improved solution when present. The source HTML embeds the resulting data for fast, fetch-free loading. The `analysis/` folder also retains the original inputs and historical search results.

## GitHub Pages

The **Verify and publish Pages** workflow runs JavaScript and Python regression tests, packages only the website into `dist/`, and deploys it. In repository **Settings → Pages**, the source is **GitHub Actions**. Push changes to `main` to test and publish. Pull requests run verification without deployment. No private credentials or repository secrets are needed.

This is an unofficial fan tool, not affiliated with NimbleBit. See the source links in the app and [verification notes](docs/verification.md).
