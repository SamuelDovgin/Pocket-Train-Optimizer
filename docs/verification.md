# Verification and changes — November 3, 2026

The original bundle's all-pairs scores were reproduced before editing: original 988.0159524554269; earlier refinement 957.889792513815; supplied advanced assignment 927.9087686372641 at transfer penalty 40.

The improved assignment scores **926.3084141382546**, a **6.2456%** reduction from the original and **0.1725%** from the supplied advanced assignment. Its mean transfer count is **2.033260348243145**, compared with **3.482848503805651** originally. Every comparison uses the same 9,591 unordered city pairs.

## Fixes

- Removed a stale, start-of-search line-length check that incorrectly discarded valid ownership moves. Capacity checks now use the current candidate layout.
- Sorted candidate targets for deterministic search and distinguished time/round limits from fully exhausted local neighborhoods. Continued the supplied solution with connected pair and triple moves.
- Routes minimize fuel plus transfer friction, then handoffs to resolve equal-score ties. JavaScript and Python use the same rule.
- Fixed the same-station route return shape, which previously crashed rendering.
- Replaced a sensitivity slider offering unsupported 60-unit results with the four computed penalties: 0, 20, 40, 80.
- Connected the recommended owner plan to the checklist and added routing on the full active plan with manual edits.
- Added construction ordering that checks licenses, physical reachability, and connected ownership. Each next purchase is re-evaluated after checkoff. The order is feasible in this model; it is not an optimized investment/payback schedule.
- Freeze completed owners when switching plans. Warn when manual edits leave a disconnected or overlong future railroad.
- Put restored initial tracks back into the unfinished queue; they were previously absent from the step dataset.
- Validate imported/autosaved values and preserve old backups. Correct the city connection panel's hidden behavior and display current assigned stations instead of obsolete original route text.
- Add automated verification and GitHub Pages publication.

## Checks

JavaScript tests simulate every remaining purchase in all three layouts, check save validation, restored tracks, same-station/disconnected routing, zero-penalty ties, reverse-route symmetry, built-only routing, and model data synchronization. A full 9,591-pair browser-core evaluation is compared with the Python optimized result.

Python tests reproduce all published metrics for every layout and penalty, independently check routes with NetworkX, verify all 15 fixed owners and 38 connected railroads, enforce the 1,100-unit bound, cover the stale-capacity regression, and confirm there is no improving move in the final connected one/two/three-track neighborhood.

Manual browser checks cover checkoff/reload/restore, all views, supported sensitivity values, same-station routing, route scopes, plan selection, export/import, and a narrow viewport. Check the repository's Actions tab for automated run results.

## Limits

The map and prices are inherited from the supplied tracker, not independently measured in the current game. Eight fuel lengths and eight prices are provisional. Transfer friction and job-demand scenarios are assumptions. Branches and long railroads can be awkward to operate. The model does not simulate engine positions, train speed, fuel capacity/regeneration, cargo arrivals, capacity, yard congestion, setup costs, or earnings. A lower modeled routing score does not establish better coins/hour. Browser progress is local; moving devices or origins requires a JSON backup.
