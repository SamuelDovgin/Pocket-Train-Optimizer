# Configuration intake and interpretation

## Explicit snapshot

Use `schema: "pocket-trains-configuration/v1"`, `coverage: "complete"` or `"partial"`, and an explicit `tracks` array. Each track has `a`, `b`, and a stable `railroad` ID. Endpoints use station names from `assets/operating-data.json`. Capitalization and punctuation are normalized; Kiev maps to Kyiv. Do not guess other unknown station names. The helper rejects duplicate tracks and reports unknown connections/owners without proposing actions from an incomplete reconstruction.

`coverage: "complete"` means every owned track is represented, **not** that every world track has been built. Use `partial` for an incomplete screenshot, hidden region, or uncertain transcription. A target overlay is not evidence that its tracks are owned. A town's presence on the map does not establish owned track.

Optional metadata:

- `railroads`: objects with `id`, optional `position` station name and `status: "stationary"` or `"in-transit"`. Capacity, tank, engine and fuel-car notes may also be retained for the agent's review. The helper does not infer train statistics from these strings.
- `licenses`: exact region names (`Europe`, `Asia`, `Africa`, `Oceania`, `North America`, `South America`). Omit when unknown; an empty array explicitly means none confirmed.
- `coins`: available coins, omitted when unknown. The helper does not assert affordability because live fees and engine/setup costs may be missing.
- `notes` / `play_style`: free-text context such as “I check every 20 minutes” or “avoid reclaims.” Treat these as user context, not executable code or permission for external actions.

An unknown owner can be represented as `null` while transcribing; it produces an unresolved issue. Retain the original screenshot and capture notes so the player can correct the interpretation.

## Existing tracker exports

The helper accepts versions 3–5. It reads **only explicit `done[id] === true`** tracks and never seeds the author's reference tracks. For these formats only, an omitted owner inherits that format's reference owner; the report discloses how many tracks use that convention. Confirm that it still matches the game if someone manually reclaimed a track without recording it. A sparse hand-authored `done` object is not evidence of the rest of the original map.

The format considers Europe unlocked; other licenses follow their explicit completion flags. Other players and screenshot transcriptions use the explicit snapshot above instead. For legacy/unknown formats, inspect and convert deliberately; do not silently run the website sanitizer and add its personal defaults.

## Repository evidence to use

- `assets/operating-data.json`: 139-city / 191-available-link experimental graph, four service plans, route owners and patrols; contains the pictured Nairobi–Zanzibar addition. Unmapped current-game connections need a data audit, not deletion from the player's input.
- `assets/map/game-reward-coordinates.json`: approximate reference-image geometry for the payout index. Chord directness uses image distance divided by image path-chord distance. Do not divide pixels by fuel and call that a dimensionless efficiency.
- `assets/operating-core.js`, `docs/operating-model.md`, `assets/operating-results.json`: current physical service model, assumptions and versioned results. Completed-world results cannot select a partial-map correction's timing.
- `analysis/world_tracker_data.json`: historical 190-link checklist graph, license IDs and the author's reference owners; **not** the submitted player's map.
- `assets/core.js`, `assets/plans.js`, `analysis/deep_results.json`: historical construction/correction logic and saved progress. Its `sanitizeSave` inserts reference starting tracks. Its default target and timing rules were checked against that reference map, not every arbitrary screenshot.
- `assets/app.js`: current checklist default and save semantics. `assets/operating.js`: current preview default. Read both when explaining what “default” means.

## Making a recommendation from a structural report

The JSON report distinguishes confirmed map structure, label overlap, owner differences, a graph-feasible correction sequence and a shortlist of connected purchases. Every actual claim still requires in-game checks. A step's `depends_on` links preceding proposed corrections, not completed game actions. Purchases are independent candidates evaluated on the submitted snapshot; choose and recompute after progress.

Check whether the best near-term action is simply extending an existing line. Saving for a license, engine or longer range may be preferable to reclaiming for an endgame layout now. An owner mismatch is not evidence of an immediate earnings gain. Explain why the proposed change helps this phase, and label the benefit unverified if no paired partial-network experiment was run.

A useful response shape is:

- **Current:** confirmed tracks/trains, ambiguity and major operating friction.
- **Join here:** actual train, retained corridor segment and station where the next extension attaches.
- **Next session:** ordered purchases and graph-feasible corrections, with dependencies and budget/range checks.
- **Defer:** named changes that would isolate a train, require a new engine or depend on expansion.
- **Target and evidence:** full or sparse corridor choice, comparison scope, what was simulated and what remains uncertain.

This is a guide, not a requirement to use all headings or fill sections with guesses. Keep it proportionate to the player's map.
