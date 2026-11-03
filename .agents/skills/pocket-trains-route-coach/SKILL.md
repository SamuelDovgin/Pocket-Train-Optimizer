---
name: pocket-trains-route-coach
description: Review a player's current Pocket Trains network from map screenshots, train-route lists or tracker exports; find where to join a corridor plan and stage explicit ownership corrections. Use for personalized route planning and resuming progress, rather than generic Pocket Planes advice.
---

# Pocket Trains Route Coach

Turn the player's **actual owned network** into a practical next-session plan: what to retain, which corridor to extend, and which owner changes to perform or defer. Treat “optimal” as best under stated operating and progression assumptions; do not imply a proven game-profit optimum.

## Establish the current map

Accept a tracker JSON export, map screenshots, a station-by-station route list, or a combination. Read [intake-and-review.md](references/intake-and-review.md) for the supported snapshot format and the distinctions that matter when interpreting screenshots and exports. Use [the example snapshot](assets/current-configuration.example.json) when transcribing a map.

- Record only confirmed owned connections and their actual train/railroad IDs. The repo author's original 15 tracks are **not** another player's starting configuration. Do not call the browser save sanitizer to initialize an unrelated player's map; it adds those defaults.
- A line color is evidence, not a unique train identity: colors can repeat. Distinguish claimed colored track from unclaimed/grey track and from a target overlay. Record ambiguous owners or unseen regions as unknown, not as empty.
- Preserve current labels, built tracks, manual edits and confirmed progress. Make screenshot transcriptions reviewable. Ask only focused questions needed to resolve consequential ambiguity; continue auditing confirmed portions while waiting.
- Use coins, licenses, available engines, positions and play frequency when provided. Unknown engines do not prevent a structural review, but do prevent claiming that a reclaim, trip or purchase is operationally ready.

## Review the submitted configuration

Locate the Pocket Train Optimizer checkout and read `docs/operating-model.md` plus the relevant current data. The helper locates a checkout from the working directory or accepts `--repo`:

```sh
python .agents/skills/pocket-trains-route-coach/scripts/review_configuration.py /path/to/current.json --repo /path/to/Pocket-Train-Optimizer
```

Install the checkout's `requirements.txt` if its Python dependencies are missing. The command writes a structural review to stdout only. Put any redirected output or player-specific transcription outside tracked files unless the user asks to save it in the repo. The default comparison includes `corridors38` and `corridors28`; `--target published28` or `--target published38` adds a historical operating baseline when useful.

Use the result as evidence, not an automatic action queue:

1. Check unknown connections, disconnected train duties, branching, loops, licenses and the provenance of inherited tracker owners. An incomplete map cannot justify definitive owner changes.
2. Match target labels to the player's existing trains before counting reclaims. Labels are reusable names, not mandated geography. The helper maximizes unchanged built tracks under a one-to-one label match.
3. Identify an **entry corridor and anchor station(s)** from the confirmed overlap. Pick the next connected extension based on the player's current needs, budget, train range and attention—not the lowest unchecked row or a whole-world stage number. The helper's purchase shortlist is alphabetically tie-broken structural feasibility, not an earnings ranking.
4. Separate **KEEP**, **BUILD NEXT**, **CORRECT OWNERSHIP**, **DEFER**, and **VERIFY**. Name each affected connection, actual donor, actual/new recipient, reason and prerequisite. Do not prescribe demolition for a built link absent from a sparse service plan.
5. Inspect corrections on the actual partial map. The helper only schedules single claims that keep both owner graphs connected and leave the donor a retained route. It can miss a valid multi-step batch. Deferred changes need a bridge purchase, different sequence or separately checked batch; do not present the target's end state as an immediately executable sequence.
6. Verify train parking, recipient-engine availability, range, live reclaim fees and cash before calling any change ready. A graph-feasible sequence is still conditional. Recompute after actual purchases/claims; the purchase shortlist is based on the original submitted state, not the hypothetical correction sequence.

## Compare operating strategies honestly

Use direct origin–destination payout, actual traveled distance, express pass-through deliveries, capacity, yards, return travel and check-ins. Favor long, direct, unbranched duties and low-handoff loading as practical candidates. Do not add a distance exponent or layout-specific reward bonus merely to guarantee a preferred layout wins.

Full-world reports in `assets/operating-results.json` are not earnings predictions for a partial map. If simulating personalized candidates, adapt `assets/operating-core.js` to the **same served cities and available geography**, use paired demand seeds, keep evaluation seeds separate from tuning, and report fleet and setup-cost differences. Do not make an unreachable job disappear from one candidate's denominator. Test frequent play and long check-in intervals when that choice matters; retain uncertainty about spawn probabilities, approximate map geometry and coin scaling.

## Deliver a usable handoff

Lead with the current configuration and recommended next action. Give an ordered, conditional sequence with explicit prerequisites; show already-built ownership changes prominently and include “not yet” steps where expansion must come first. Identify what can be resumed or checked off in the existing tracker, and what remains an experimental service plan without tracker adoption.

A current-map overlay or final colored route map helps when colors and handoffs are hard to follow. Mark current versus proposed ownership separately. A map is a review artifact, not proof of a feasible reclaim order.

State the default distinction accurately: the current Operating simulator previews **38 unbranched corridors** by default, inspired by the submitted Reddit-style spines. The construction checklist still starts with the historical **branched 28-line** routing target. Check code and data before repeating these numbers if the repo changes. Neither default is an exact transcription of the human screenshots or a proven profit optimum.

Reviewing a configuration does not itself authorize publishing the player's save/screenshots, uploading them to GitHub, changing browser progress or editing the game. Apply any requested tracker edits only after the player reports the corresponding real progress; keep the original export recoverable.
