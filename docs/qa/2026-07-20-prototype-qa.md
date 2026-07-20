# Openfront prototype QA — 2026-07-20

## Browser and interaction

- Browser plugin was unavailable, so QA used Playwright Chromium at native browser viewports.
- Verified at 1280×720, 1672×941, and 1920×1080.
- Build placement, resource charge, new seeded valley, save/load, speed controls, and visible raid combat were exercised in the rendered app.
- No browser console errors were observed during the end-to-end interaction path.

## Large raid performance

- Stress route: `/?stress=1`.
- Scene: 150 friendly and 150 enemy combatants rendered simultaneously.
- Measurement: 180 consecutive `requestAnimationFrame` samples after the raid became visible.
- Latest Chromium result: **60.0 FPS average**, **16.8 ms slowest sampled frame**.
- The browser test fails below 59 FPS to allow for timer quantization around a 60 Hz cadence.

## Concept comparison

The accepted concept is `docs/design/openfront-primary-screen.png`; the latest implementation capture is `docs/qa/openfront-1672x941.png`.

1. Hierarchy: resource bar, chronicle, intelligence, selection, construction, and army regions follow the same screen hierarchy.
2. Palette: deep plum panels, muted heather borders, bone text, ochre highlights, moss success, and dusty-red danger states match the approved direction.
3. Typography: Alegreya and Alegreya Sans replace the concept lettering while preserving the old-style strategy-game character; no monospace face is used.
4. Controls: all actionable controls use code-native beveled 1990s PC-game styling and Lucide SVG icons; there are no emoji or Unicode icon substitutes.
5. World: the generated medieval town remains the visual hero; aggressive center cropping prevents the concept's embedded English interface from leaking behind the live UI.
6. Responsiveness: at 1280×720, low-priority construction tools and the selected-building panel collapse to keep the map and raid controls usable.

## Intentional prototype deviations

- The first slice uses the accepted raster city concept rather than a complete individual sprite atlas.
- The framework-free simulation runs on the main thread; PixiJS and Worker extraction remain the next renderer milestone.
- Saves use a checksummed, versioned `localStorage` envelope rather than IndexedDB.
