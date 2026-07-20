# OpenConstantinople voxel prototype QA — 2026-07-20

## Browser and interaction

- Browser plugin was unavailable, so QA used Playwright Chromium at native 1280×720 and 1920×1080 viewports.
- Verified voxel placement, atomic dragged roads, Q/E camera rotation, save/load with camera metadata, speed controls, drawer exclusivity and raid combat.
- Production source contains no raster world image, raster building atlas, raster combatants, DOM world entity or SVG world entity.
- WebGL context loss pauses only the renderer and presents a code-native recovery action without resetting simulation state.
- No browser console errors were observed on the tested interaction path.

## Large raid performance

- Stress route: `/?stress=1`.
- Scene: 150 friendly and 150 enemy voxel combatants, plus the complete city and terrain.
- Latest Chromium result: **60.0 FPS average**, **16.8 ms p95**, **12 draw calls**, **300 visible units**.
- The test fails below 59 FPS, above 24 draw calls or unless all 300 units are reported.
- Root optimization: the static city uses a demand-driven render loop; terrain, architecture and force parts are batched by material.

## Concept comparison

The accepted concept is `docs/design/openconstantinople-voxel-primary.png`. Current captures:

- `docs/qa/openconstantinople-voxel-1920x1080.png`
- `docs/qa/openconstantinople-voxel-1280x720.png`
- `docs/qa/openconstantinople-voxel-raid-1920x1080.png`

1. World hierarchy: the world fills the viewport behind a 46 px top strip and 122 px bottom dock; the unobstructed center remains dominant.
2. Projection: the renderer uses a strict orthographic isometric camera with quarter-turn rotation.
3. Architecture: stepped red roofs, marble and brick masses, a domed palace, crenellated walls, towers, arcades and an editable 33-building urban nucleus provide the first Byzantine silhouette set.
4. Palette: porphyry UI and backdrop, gold rules, marble walls, red roofs, olive terrain and coastal blue follow the accepted direction.
5. Controls: square, beveled 1990s PC-game controls use Lucide only in the interface; no emoji, Unicode substitutes or monospace type are present.
6. Responsiveness: at 1280×720, all four modes, the contextual tool rail, threat action and at least 560 CSS pixels of world height remain visible.
7. Combat: friendly tagma/militia and hostile raiders are real voxel formations batched into the world scene, not overlays.

## Prototype boundary

- Simulation remains on the main thread; the renderer contract and shallow Vue bridge leave room for Worker extraction if later simulation volume requires it.
- Water is static in this slice to preserve the demand-driven 60 FPS budget.
- The preset registry currently ships one complete culture, `byzantine-macedonian`; common simulation and rendering contracts are culture-neutral.
