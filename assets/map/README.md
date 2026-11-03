# Historical routing map: input audit

This 190-link image omits Nairobi–Zanzibar. It is retained as a historical routing target, not a verified complete game map or profit recommendation. The Operating simulator uses a separate 191-link input and experimental service maps.

# Completed target map

`proposed-completed-world.png` (5200 × 3900) and the scalable SVG show every connection in `analysis/deep_results.json` → `profiles.consolidated.owner`. The SVG is generated from the same renderer used by the site's **World map** tab. No purchased-track flag is inferred from the image.

- All 139 city markers and 190 unique main-world track segments are drawn. Europe has a second enlarged view; its labels appear there to avoid duplicating dense labels in the main world.
- Track colors come directly from the tracker railroad palette. Numbered owner badges and a full legend distinguish similar shades. Dashed connections are the supplied sea-crossing links.
- `cities.json` contains approximate geographic longitude/latitude positions prepared for display. They are not exact game map pixel coordinates and never determine model distances, prices, or scores.
- `land.json` is the Natural Earth 1:110m land dataset, downloaded from https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson. Natural Earth places its data in the public domain: https://www.naturalearthdata.com/about/terms-of-use/.
- The active browser map includes selected-plan assignments and saved owner edits. It can therefore differ from the verified reference download. Selecting or highlighting a map never marks a track purchased or records a correction.

To rebuild after changing the target or renderer:

```sh
npm run map:svg
# Optional authoring dependency, outside website runtime:
python3 -m pip install cairosvg
python3 scripts/render-world-map.py
```

CairoSVG also needs Cairo on the authoring machine. The website ships the PNG/SVG and requires neither Python nor Cairo. Node tests verify the complete assignments, colors, city-label coverage, deterministic SVG, PNG dimensions and matching image hashes. `image-metadata.json` records the PNG/SVG pair.
