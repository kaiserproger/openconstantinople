# Openfront Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished browser city-builder vertical slice with a deterministic random map, free construction, simulated population and economy, dynamic external threats, visible combat, local saves, and a verified 60 FPS large-raid stress scenario.

**Architecture:** Vue 3 owns UI only; PixiJS owns the isometric scene; a framework-free TypeScript simulation runs behind a typed command/snapshot boundary in a Web Worker. The simulation is deterministic from a seed, while the renderer consumes compact deltas, culls by chunk, batches sprites, and never places thousands of entities in Pinia.

**Tech Stack:** Node.js 20.19+; Vue 3; Vite 8; TypeScript; Pinia; PixiJS 8; Vitest 4; Playwright; Web Workers; IndexedDB; SVG game icons; ImageGen raster assets.

## Global Constraints

- No monospace typefaces, Unicode symbols, or emoji in user-facing UI.
- Alegreya is the display face and Alegreya Sans is the UI face; both must render Cyrillic.
- The world uses the approved “Земля и вереск” palette and natural medieval materials.
- The first vertical slice exposes all 11 building families from the design spec.
- External threats must be able to appear, evolve, retarget, withdraw, and disappear without a fixed wave timer.
- Simulation code must not import Vue, Pinia, PixiJS, browser DOM APIs, or frame timing.
- Pinia stores only UI state, aggregate metrics, and selected-entity projections.
- The large-raid stress scene must remain at or above 60 FPS at 1920×1080 with 2,000 residents, 300 combatants, 600 structures/fortification segments, and 20 active fires.
- Use TDD for deterministic logic and browser tests for visible behavior.
- Use the approved design at `docs/superpowers/specs/2026-07-20-openfront-city-builder-design.md` as the source of truth.
- Commit after every task once Git is initialized.

## File Map

```text
public/
  assets/
    fonts/                  # Self-hosted Alegreya/Alegreya Sans WOFF2 files
    buildings/              # Eleven generated isometric building sprites
    buildings-states/       # Construction, damaged, burning, and ruins overlays
    terrain/                # Ground, water, road, forest, and resource atlas
    units/                  # Villager, militia, retinue, and raider sprites
    ui/icons/               # Normalized Game-icons.net SVG files
    asset-manifest.json     # Dimensions, anchors, author/license metadata
src/
  app/
    App.vue                  # Full-screen composition and recovery shell
    main.ts                  # Vue/Pinia bootstrap
  assets/
    tokens.css               # Color, type, bevel, spacing, and layer tokens
    fonts.css                # Alegreya/Alegreya Sans font-face declarations
  game/
    core/types.ts            # Shared entity, command, snapshot, and ID types
    core/prng.ts             # Deterministic seeded random generator
    world/generateWorld.ts   # Terrain/resource generation
    world/worldQueries.ts    # Tile, occupancy, and placement queries
    simulation/createState.ts
    simulation/stepSimulation.ts
    simulation/worker.ts
    simulation/workerClient.ts
    construction/buildings.ts
    construction/placement.ts
    economy/stepEconomy.ts
    population/stepPopulation.ts
    politics/stepCrises.ts
    threats/stepThreatDirector.ts
    combat/stepCombat.ts
    persistence/saveGame.ts
  renderer/
    GameRenderer.ts          # Pixi lifecycle and snapshot application
    CameraController.ts
    ChunkLayer.ts
    EntityPool.ts
    AssetCatalog.ts
  stores/
    gameUi.ts                # Aggregates, selection, tools, speed, alerts
  ui/
    TopBar.vue
    ChroniclePanel.vue
    IntelPanel.vue
    SelectionPanel.vue
    CommandBar.vue
    EventDecision.vue
    components/GameButton.vue
    components/GameIcon.vue
  workers/simulation.worker.ts
tests/
  unit/                      # Framework-free deterministic tests
  e2e/                       # Playwright behavior and stress scenarios
scripts/
  validate-assets.mjs        # Asset/license/dimension checks
```

---

### Task 1: Produce the accepted visual concept and project-owned asset set

**Files:**
- Create: `docs/design/openfront-primary-screen.png`
- Create: `docs/design/openfront-primary-screen-prompt.md`
- Create: `docs/design/openfront-primary-screen-prompt.md`
- Create: `public/assets/buildings/*.webp`
- Create: `public/assets/buildings-states/*.webp`
- Create: `public/assets/terrain/world-atlas.webp`
- Create: `public/assets/units/unit-atlas.webp`
- Create: `public/assets/fonts/alegreya-roman.woff2`
- Create: `public/assets/fonts/alegreya-sans-regular.woff2`
- Create: `public/assets/fonts/alegreya-sans-semibold.woff2`
- Create: `public/assets/fonts/alegreya-sans-bold.woff2`
- Create: `public/assets/ui/icons/*.svg`
- Create: `public/assets/asset-manifest.json`
- Create: `public/assets/CREDITS.md`
- Create: `scripts/validate-assets.mjs`

**Interfaces:**
- Consumes: approved palette, UI layout, 11 building families, and typography from the design spec.
- Produces: `AssetManifest` consumed by `AssetCatalog.load('/assets/asset-manifest.json')` in Task 5.

- [ ] **Step 1: Generate the complete primary-screen production concept**

Use the built-in ImageGen tool with this exact brief and save the accepted result to `docs/design/openfront-primary-screen.png`:

```text
Use case: ui-mockup
Asset type: complete browser strategy-game primary screen, 16:9 desktop
Primary request: Design the complete in-game screen for Openfront, an original medieval northern-valley city builder with grand-strategy pressure. Show a thriving isometric settlement during a small raid: natural moss, dry grass, warm timber and cold stone; heather-purple dusk shadows; city remains the visual hero.
UI layout: slim resource/season bar at top; collapsible chronicle at left; intelligence and selected-building panels at right; construction/army command bar at bottom; large unobstructed center map. Include roads, farms, houses, town hall, granary, lumber camp, quarry, market, smithy, barracks, watchtower, walls, villagers, militia and distant raiders.
UI style: physical beveled PC strategy controls from the 1990s, restrained plum/heather panels, bone-colored text, crisp professional icon slots, no modern SaaS cards, no pills, no glassmorphism.
Typography: expressive old-style serif headings and readable humanist sans body; no monospace anywhere.
Color palette: #1C1323 #2A2035 #4A3F56 #805B87 #9E8EA3 #B7A9C4 #F3E9CF #657053 #D2A56F #B95F72.
Constraints: original art direction; no copied game logos or layouts; no emoji; no placeholder boxes; readable controls; practical implementation in Vue and PixiJS; 1920x1080 composition; no watermark.
```

- [ ] **Step 2: Generate coherent world assets**

Use the built-in ImageGen tool once per building and once per supporting asset group, preserving the primary-screen concept as the style reference:

```text
Building group: town hall, house, granary, farm, lumber camp, quarry, market, smithy, barracks, watchtower, wall with gate. One isolated building per output, identical 2:1 isometric camera, north-west light, transparent-ready flat #00ff00 background, no cast shadow beyond the footprint, no labels, no people, generous padding. Original northern medieval architecture, realistic readable silhouette, stylized painterly game sprite, approved earth-and-heather palette.

State overlays: timber scaffolding, cracked/damaged structure, animated-looking orange fire and smoke, and charred ruins. Isolated overlays aligned to the same 2:1 isometric camera on flat #00ff00, no text, no watermark.

Terrain atlas: seamless isometric ground, dry grass, fertile earth, road, shallow water, forest floor, stone deposit, and field textures. Consistent north-west light, approved palette, no buildings, no labels.

Unit atlas: villager, militia, retinue and raider, eight facing directions each, readable banners and silhouettes, small isometric painterly sprites, flat #00ff00 background, no labels.
```

Remove the chroma key with the installed imagegen helper, validate alpha corners, and encode final sprites as lossless WebP. Keep the final prompts in `docs/design/openfront-primary-screen-prompt.md`.

- [ ] **Step 3: Add licensed medieval UI icons**

Select Game-icons.net SVGs for `menu`, `road`, `house`, `industry`, `defense`, `militia`, `intel`, `tax`, `pause`, `play`, `speed`, `repair`, and `demolish`. Normalize each SVG to a `0 0 512 512` viewBox, remove baked backgrounds, use `currentColor`, and record each original author in `public/assets/CREDITS.md` under CC BY 3.0.

- [ ] **Step 4: Add self-hosted licensed fonts**

Download Alegreya variable Roman plus Alegreya Sans Regular, SemiBold, and Bold WOFF2 files from the official Google Fonts repository. Store them under `public/assets/fonts/`, retain their OFL license notice in `public/assets/CREDITS.md`, and verify each file contains Cyrillic glyphs for `Вересков Дол` before UI implementation.

- [ ] **Step 5: Write the asset manifest**

```json
{
  "version": 1,
  "buildings": {
    "townHall": { "src": "/assets/buildings/town-hall.webp", "anchor": [0.5, 0.82], "footprint": [4, 4] },
    "house": { "src": "/assets/buildings/house.webp", "anchor": [0.5, 0.82], "footprint": [2, 2] },
    "granary": { "src": "/assets/buildings/granary.webp", "anchor": [0.5, 0.82], "footprint": [3, 2] },
    "farm": { "src": "/assets/buildings/farm.webp", "anchor": [0.5, 0.82], "footprint": [4, 3] },
    "lumberCamp": { "src": "/assets/buildings/lumber-camp.webp", "anchor": [0.5, 0.82], "footprint": [3, 2] },
    "quarry": { "src": "/assets/buildings/quarry.webp", "anchor": [0.5, 0.82], "footprint": [3, 3] },
    "market": { "src": "/assets/buildings/market.webp", "anchor": [0.5, 0.82], "footprint": [3, 3] },
    "smithy": { "src": "/assets/buildings/smithy.webp", "anchor": [0.5, 0.82], "footprint": [3, 2] },
    "barracks": { "src": "/assets/buildings/barracks.webp", "anchor": [0.5, 0.82], "footprint": [4, 3] },
    "watchtower": { "src": "/assets/buildings/watchtower.webp", "anchor": [0.5, 0.9], "footprint": [2, 2] },
    "wallGate": { "src": "/assets/buildings/wall-gate.webp", "anchor": [0.5, 0.86], "footprint": [3, 1] }
  },
  "states": {
    "construction": "/assets/buildings-states/construction.webp",
    "damaged": "/assets/buildings-states/damaged.webp",
    "burning": "/assets/buildings-states/burning.webp",
    "ruins": "/assets/buildings-states/ruins.webp"
  },
  "terrainAtlas": "/assets/terrain/world-atlas.webp",
  "unitAtlas": "/assets/units/unit-atlas.webp"
}
```

- [ ] **Step 6: Validate all visible assets before coding**

Implement `scripts/validate-assets.mjs` to read the manifest, resolve every referenced file under `public`, assert every path exists, assert no filename contains `placeholder`, and assert `CREDITS.md` mentions `CC BY 3.0` and every selected icon author.

Run: `node scripts/validate-assets.mjs`  
Expected: `Validated 11 buildings, 4 state overlays, 13 icons, terrain atlas, and unit atlas.`

- [ ] **Step 7: Commit**

```bash
git init
git add docs public scripts
git commit -m "art: establish Openfront visual system and assets"
```

---

### Task 2: Scaffold Vue, PixiJS, Pinia, Vitest, and Playwright

**Files:**
- Create: `package.json`
- Create: `package-lock.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `playwright.config.ts`
- Create: `src/app/main.ts`
- Create: `src/app/App.vue`
- Create: `src/ui/components/GameIcon.vue`
- Create: `src/assets/tokens.css`
- Create: `src/assets/fonts.css`
- Create: `tests/unit/app-shell.test.ts`

**Interfaces:**
- Consumes: `docs/design/openfront-primary-screen.png` and asset manifest from Task 1.
- Produces: `npm run dev`, `npm run build`, `npm run typecheck`, `npm run test:unit`, and `npm run test:e2e` entrypoints.

- [ ] **Step 1: Write the failing shell test**

```ts
import { mount } from '@vue/test-utils'
import App from '../../src/app/App.vue'

it('renders the game shell without monospace or emoji controls', () => {
  const wrapper = mount(App)
  expect(wrapper.get('[data-testid="game-shell"]').exists()).toBe(true)
  expect(wrapper.text()).toContain('Вересков Дол')
  expect(wrapper.text()).not.toMatch(/[▶⏸⚒⚔]/u)
})
```

- [ ] **Step 2: Run the test and verify the expected failure**

Run: `npm run test:unit -- tests/unit/app-shell.test.ts`  
Expected: FAIL because `package.json` and `src/app/App.vue` do not exist.

- [ ] **Step 3: Create the runtime and quality configuration**

Use Node 20.19+ and install `vue`, `pinia`, `pixi.js`, `idb`; install `vite`, `@vitejs/plugin-vue`, `typescript`, `vue-tsc`, `vitest`, `happy-dom`, `@vue/test-utils`, and `@playwright/test` as development dependencies. Define scripts:

```json
{
  "dev": "vite",
  "build": "vue-tsc -b && vite build",
  "typecheck": "vue-tsc -b",
  "test:unit": "vitest run",
  "test:e2e": "playwright test",
  "test": "npm run test:unit && npm run typecheck && npm run build"
}
```

- [ ] **Step 4: Implement the minimal shell**

`src/app/App.vue` must mount one full-viewport `.game-shell`, include a `<canvas data-testid="world-canvas">`, display `Вересков Дол`, and render all controls through `GameIcon` SVGs rather than characters. `tokens.css` must define the ten approved colors and bevel tokens. `fonts.css` must load Alegreya and Alegreya Sans with `font-display: swap` and include Cyrillic weights 400, 600, and 700.

- [ ] **Step 5: Verify the shell**

Run: `npm run test`  
Expected: unit test PASS, typecheck PASS, and Vite production build PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json index.html vite.config.ts tsconfig.json playwright.config.ts src tests
git commit -m "build: scaffold Vue and Pixi game shell"
```

---

### Task 3: Add deterministic procedural world generation

**Files:**
- Create: `src/game/core/types.ts`
- Create: `src/game/core/prng.ts`
- Create: `src/game/world/generateWorld.ts`
- Create: `src/game/world/worldQueries.ts`
- Create: `tests/unit/world-generation.test.ts`

**Interfaces:**
- Produces: `generateWorld(config: WorldConfig): WorldState`, `tileAt(world, x, y): Tile | undefined`, and `canPlaceFootprint(world, origin, footprint): boolean`.
- `WorldConfig`: `{ seed: string; width: 128; height: 128 }`.
- `WorldState`: `{ seed; width; height; tiles: Uint8Array; fertility: Uint8Array; resources: Uint8Array; occupied: Uint8Array }`.

- [ ] **Step 1: Write deterministic generation tests**

```ts
import { generateWorld } from '../../src/game/world/generateWorld'

it('replays the same valley from the same seed', () => {
  const a = generateWorld({ seed: 'heather-17', width: 128, height: 128 })
  const b = generateWorld({ seed: 'heather-17', width: 128, height: 128 })
  expect(Array.from(a.tiles)).toEqual(Array.from(b.tiles))
  expect(Array.from(a.resources)).toEqual(Array.from(b.resources))
})

it('creates water, forest, fertile soil, and stone', () => {
  const world = generateWorld({ seed: 'acceptance', width: 128, height: 128 })
  const kinds = new Set(world.tiles)
  expect([0, 1, 2, 3].every((kind) => kinds.has(kind))).toBe(true)
  expect(Math.max(...world.fertility)).toBeGreaterThan(180)
  expect(world.resources.some((value) => value === 2)).toBe(true)
})
```

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/world-generation.test.ts`  
Expected: FAIL because `generateWorld` does not exist.

- [ ] **Step 3: Implement seeded generation**

Implement xmur3 + mulberry32 in `prng.ts`. In `generateWorld`, combine four octaves of deterministic value noise, reserve a connected river corridor, classify height/moisture into grass/forest/water/stone, derive fertility near water, and populate stone deposits only on non-water tiles. Do not call `Math.random()`.

- [ ] **Step 4: Verify world behavior**

Run: `npm run test:unit -- tests/unit/world-generation.test.ts`  
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/core src/game/world tests/unit/world-generation.test.ts
git commit -m "feat: generate deterministic playable valleys"
```

---

### Task 4: Establish the Worker simulation protocol and fixed tick

**Files:**
- Create: `src/game/simulation/createState.ts`
- Create: `src/game/simulation/stepSimulation.ts`
- Create: `src/game/simulation/worker.ts`
- Create: `src/game/simulation/workerClient.ts`
- Create: `src/workers/simulation.worker.ts`
- Create: `tests/unit/simulation-clock.test.ts`

**Interfaces:**
- Consumes: `WorldState` from Task 3.
- Produces: `GameCommand`, `GameSnapshot`, `SimulationWorkerClient`, and `stepSimulation(state, ticks): void`.

```ts
export type GameCommand =
  | { type: 'setSpeed'; speed: 0 | 1 | 2 | 4 }
  | { type: 'placeBuilding'; building: BuildingKind; x: number; y: number }
  | { type: 'drawRoad'; points: GridPoint[] }
  | { type: 'repairBuilding'; buildingId: EntityId }
  | { type: 'demolishBuilding'; buildingId: EntityId }
  | { type: 'orderUnit'; unitIds: EntityId[]; target: GridPoint; stance: 'move' | 'attack' | 'hold' }
  | { type: 'chooseEvent'; eventId: EntityId; choiceId: string }

export interface GameSnapshot {
  tick: number
  season: 'spring' | 'summer' | 'autumn' | 'winter'
  aggregates: CityAggregates
  changed: EntityProjection[]
  removed: EntityId[]
  events: GameEventProjection[]
}
```

- [ ] **Step 1: Write the fixed-tick tests**

Assert that 240 simulation ticks advance one in-game day, paused speed applies zero steps, and snapshot sequence numbers never decrease when commands and ticks interleave.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/simulation-clock.test.ts`  
Expected: FAIL because the simulation modules do not exist.

- [ ] **Step 3: Implement the framework-free clock and protocol**

Use a 10 Hz simulation tick. The Worker loop accumulates elapsed wall time but caps catch-up at five ticks per message. Speed multiplies ticks, not renderer delta. Publish at most one visual snapshot per animation frame; retain every authoritative simulation tick.

- [ ] **Step 4: Verify the protocol**

Run: `npm run test:unit -- tests/unit/simulation-clock.test.ts`  
Expected: all fixed-tick and monotonic-sequence tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/simulation src/workers tests/unit/simulation-clock.test.ts
git commit -m "feat: run deterministic simulation behind a worker boundary"
```

---

### Task 5: Render the isometric world with a camera, chunks, and pools

**Files:**
- Create: `src/renderer/GameRenderer.ts`
- Create: `src/renderer/CameraController.ts`
- Create: `src/renderer/ChunkLayer.ts`
- Create: `src/renderer/EntityPool.ts`
- Create: `src/renderer/AssetCatalog.ts`
- Create: `tests/unit/camera.test.ts`

**Interfaces:**
- Consumes: `AssetManifest`, `WorldState`, and `GameSnapshot`.
- Produces: `GameRenderer.mount(canvas)`, `setWorld(world)`, `applySnapshot(snapshot)`, `screenToGrid(point)`, `focus(gridPoint)`, and `destroy()`.

- [ ] **Step 1: Write camera math tests**

Test round-trips for grid-to-screen-to-grid at zoom `0.6`, `1`, and `1.8`, clamp zoom to that range, and verify a 32×32 chunk outside the camera bounds is excluded from `visibleChunks()`.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/camera.test.ts`  
Expected: FAIL because `CameraController` does not exist.

- [ ] **Step 3: Implement Pixi initialization and asset loading**

Initialize Pixi asynchronously with antialias disabled, resolution capped at `min(devicePixelRatio, 2)`, background `#657053`, and explicit `requestAnimationFrame`. Load the manifest once, then preload atlases and building sprites. Failures return the diagnostic texture and emit `asset:error` without throwing from the frame loop.

- [ ] **Step 4: Implement chunk culling and entity reuse**

Create 32×32 tile chunks, cache static terrain into render textures, sort dynamic entities by `x + y`, and reuse sprites from pools keyed by projection kind. Disable `interactiveChildren` on non-interactive world layers and assign rectangular hit areas to interactive sprites.

- [ ] **Step 5: Verify camera and build**

Run: `npm run test:unit -- tests/unit/camera.test.ts && npm run build`  
Expected: camera tests PASS and build PASS.

- [ ] **Step 6: Commit**

```bash
git add src/renderer tests/unit/camera.test.ts
git commit -m "feat: render a culled isometric world"
```

---

### Task 6: Build the approved 1990s strategy UI in Vue

**Files:**
- Create: `src/stores/gameUi.ts`
- Create: `src/ui/TopBar.vue`
- Create: `src/ui/ChroniclePanel.vue`
- Create: `src/ui/IntelPanel.vue`
- Create: `src/ui/SelectionPanel.vue`
- Create: `src/ui/CommandBar.vue`
- Create: `src/ui/EventDecision.vue`
- Create: `src/ui/components/GameButton.vue`
- Modify: `src/ui/components/GameIcon.vue`
- Modify: `src/app/App.vue`
- Create: `tests/unit/game-ui.test.ts`

**Interfaces:**
- Consumes: `GameSnapshot.aggregates`, `events`, selection projections, and Worker commands.
- Produces: `useGameUiStore()` with `speed`, `activeTool`, `selection`, `aggregates`, `chronicle`, and `intel`.

- [ ] **Step 1: Write the UI behavior tests**

Mount `TopBar` and `CommandBar` with a testing Pinia. Assert that speed buttons emit `setSpeed`, active tool is singular, resource values have Russian labels, panels are collapsible, every button contains an inline `<svg>`, and rendered text contains neither emoji nor monospace classes.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/game-ui.test.ts`  
Expected: FAIL because the UI components do not exist.

- [ ] **Step 3: Implement reusable physical controls**

`GameButton` must expose `pressed`, `selected`, `disabled`, and focus-visible states; use layered borders and inset shadows without gradients that resemble glass. `GameIcon` loads only named local SVGs and renders accessible labels through the parent button.

- [ ] **Step 4: Implement the full screen composition**

Match the accepted layout: resources and time at top, chronicle at left, intelligence/selection at right, commands at bottom, and no opaque panel over the central combat area. At 1280×720, collapse side panels to tab buttons; at 1920×1080, show both. No card grid.

- [ ] **Step 5: Verify UI and type safety**

Run: `npm run test:unit -- tests/unit/game-ui.test.ts && npm run typecheck`  
Expected: UI tests PASS and typecheck PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores src/ui src/app/App.vue tests/unit/game-ui.test.ts
git commit -m "feat: add the Openfront strategy interface"
```

---

### Task 7: Add roads, placement, construction, repair, and demolition

**Files:**
- Create: `src/game/construction/buildings.ts`
- Create: `src/game/construction/placement.ts`
- Modify: `src/game/simulation/stepSimulation.ts`
- Modify: `src/renderer/GameRenderer.ts`
- Create: `tests/unit/construction.test.ts`
- Create: `tests/e2e/building.spec.ts`

**Interfaces:**
- Consumes: `placeBuilding`, `drawRoad`, `repairBuilding`, and `demolishBuilding` commands.
- Produces: `BuildingEntity`, `RoadEntity`, `validatePlacement()`, and construction progress projections.

- [ ] **Step 1: Write placement tests**

Assert that water, occupied cells, map bounds, missing road access for production buildings, and insufficient resources reject placement with typed reason codes. Assert that valid placement reserves the footprint and deducts the exact building cost once.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/construction.test.ts`  
Expected: FAIL because construction rules do not exist.

- [ ] **Step 3: Define all 11 building families**

Each definition includes kind, Russian name, footprint, wood/stone/silver cost, worker capacity, road requirement, construction ticks, hit points, and asset key. Use one authoritative `BUILDINGS` record; UI and simulation must not duplicate costs.

- [ ] **Step 4: Implement construction states**

Transitions are `blueprint → construction → working → damaged → burning → ruins`. Repair returns damaged buildings to working after consuming resources; demolition returns no resources for ruins and 25% of remaining material for intact buildings.

- [ ] **Step 5: Add the browser building flow**

The Playwright test starts seed `e2e-building`, selects Road, draws three segments, selects House, places it beside the road, advances time until complete, selects the house, and verifies `Жилой дом` plus its working state in the selection panel.

- [ ] **Step 6: Verify construction**

Run: `npm run test:unit -- tests/unit/construction.test.ts && npm run test:e2e -- tests/e2e/building.spec.ts`  
Expected: unit and browser building flows PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/construction src/game/simulation src/renderer tests
git commit -m "feat: construct roads and medieval buildings"
```

---

### Task 8: Simulate population, economy, seasons, hunger, rebellion, and coups

**Files:**
- Create: `src/game/economy/stepEconomy.ts`
- Create: `src/game/population/stepPopulation.ts`
- Create: `src/game/politics/stepCrises.ts`
- Modify: `src/game/simulation/stepSimulation.ts`
- Create: `tests/unit/economy.test.ts`
- Create: `tests/unit/crises.test.ts`

**Interfaces:**
- Consumes: buildings, residents, inventories, season, tax policy, and event choices.
- Produces: `CityAggregates`, resident assignments, production transfers, and crisis events.

- [ ] **Step 1: Write economy conservation tests**

Test that a staffed lumber camp creates wood only after a work cycle, a full granary blocks incoming food, winter raises food/fuel demand, and transfers never create negative inventory.

- [ ] **Step 2: Write crisis causality tests**

Test that seven hungry days trigger famine risk, order below 25 plus unmet needs can create rebellion, and legitimacy below 20 plus a disloyal armed faction can create a coup. Verify that a one-off food distribution changes hunger but does not repair production capacity.

- [ ] **Step 3: Verify failure**

Run: `npm run test:unit -- tests/unit/economy.test.ts tests/unit/crises.test.ts`  
Expected: FAIL because economy and crisis steppers do not exist.

- [ ] **Step 4: Implement deterministic population and economy steps**

Run production every 10 simulation ticks, needs every 60 ticks, and seasonal transitions every 90 in-game days. Assign workers by explicit building priority and distance. Store inventories as integer units; do not use floating-point currency fractions.

- [ ] **Step 5: Implement causal crisis state machines**

Crises accumulate pressure, publish warnings, become active, and resolve or escalate from simulated conditions. Every random branch draws from the state PRNG and records the chosen roll in the event log for replay.

- [ ] **Step 6: Verify systems**

Run: `npm run test:unit -- tests/unit/economy.test.ts tests/unit/crises.test.ts`  
Expected: all economy and crisis tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/economy src/game/population src/game/politics src/game/simulation tests/unit
git commit -m "feat: simulate city economy and political crises"
```

---

### Task 9: Implement dynamic external threats and imperfect intelligence

**Files:**
- Create: `src/game/threats/stepThreatDirector.ts`
- Modify: `src/game/simulation/stepSimulation.ts`
- Modify: `src/ui/IntelPanel.vue`
- Create: `tests/unit/threat-director.test.ts`

**Interfaces:**
- Produces: `ThreatEntity`, `IntelReport`, and `stepThreatDirector(state): void`.

```ts
export type ThreatState = 'forming' | 'traveling' | 'scouting' | 'raiding' | 'withdrawing' | 'disbanded'
export interface ThreatEntity {
  id: EntityId
  kind: 'scouts' | 'raiders' | 'invasion'
  state: ThreatState
  strength: number
  supplies: number
  target: GridPoint | null
  route: GridPoint[]
  attitude: number
  intelConfidence: 0 | 1 | 2 | 3
}
```

- [ ] **Step 1: Write lifecycle tests**

Cover appearance from regional pressure, strength growth from supplies, target change after a defended crossing, withdrawal after morale loss, disappearance after zero supplies, and conflict between two external forces. Assert there is no fixed `nextWaveAt` field.

- [ ] **Step 2: Write intelligence tests**

Confidence 0 yields no report; confidence 1 yields a broad direction and rumor; confidence 2 yields approximate strength; confidence 3 yields position and estimated arrival interval. Reports can become stale after target changes.

- [ ] **Step 3: Verify failure**

Run: `npm run test:unit -- tests/unit/threat-director.test.ts`  
Expected: FAIL because the director does not exist.

- [ ] **Step 4: Implement the regional director**

Evaluate regional pressure once per in-game day. Threat transitions depend on supplies, city wealth, known defenses, losses, competing targets, and deterministic PRNG. Remove only `disbanded` threats after their final chronicle event is published.

- [ ] **Step 5: Render uncertainty honestly**

`IntelPanel` must say `слух`, `примерно`, or `подтверждено` based on confidence. Never display an exact countdown before confidence 3.

- [ ] **Step 6: Verify dynamic threats**

Run: `npm run test:unit -- tests/unit/threat-director.test.ts && npm run typecheck`  
Expected: director tests PASS and typecheck PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/threats src/game/simulation src/ui/IntelPanel.vue tests/unit/threat-director.test.ts
git commit -m "feat: add a living external threat director"
```

---

### Task 10: Add visible squads, morale, raiding, fires, and destruction

**Files:**
- Create: `src/game/combat/stepCombat.ts`
- Modify: `src/game/simulation/stepSimulation.ts`
- Modify: `src/renderer/GameRenderer.ts`
- Modify: `src/ui/CommandBar.vue`
- Create: `tests/unit/combat.test.ts`
- Create: `tests/e2e/raid.spec.ts`

**Interfaces:**
- Consumes: `orderUnit` commands, building hit points, roads, walls, and Threat Director raid entries.
- Produces: unit projections, morale transitions, loot transfers, fires, ruins, and retreat events.

- [ ] **Step 1: Write combat system tests**

Test that wall cover reduces incoming damage, flank pressure reduces morale, broken squads flee, raiders prefer reachable granaries over houses, loot leaves city inventory, fire spreads only within range, and destroyed buildings become ruins.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/combat.test.ts`  
Expected: FAIL because combat does not exist.

- [ ] **Step 3: Implement budgeted pathfinding and combat**

Use hierarchical A* across chunks and a per-tick path request queue. Cache paths until occupancy changes on the traversed chunks. Resolve attacks at 10 Hz, interpolate movement in Pixi, and update distant non-engaged units at 2 Hz.

- [ ] **Step 4: Implement morale, looting, fire, and retreat**

Morale is clamped 0–100. Below 20, a squad enters `routing` and rejects attack commands. Raiders carry finite loot, withdraw when capacity is full or morale breaks, and can disappear through a map edge. Fire evaluates adjacent flammable structures once per second and uses pooled sprite effects.

- [ ] **Step 5: Add the complete browser raid flow**

Seed `e2e-raid` starts with a defensible settlement and a confidence-3 raid. The test pauses, selects militia, issues hold near the northern road, resumes, waits for combat, asserts at least one enemy retreats, asserts either damage or stolen resources, repairs one damaged structure, and confirms the simulation continues.

- [ ] **Step 6: Verify combat**

Run: `npm run test:unit -- tests/unit/combat.test.ts && npm run test:e2e -- tests/e2e/raid.spec.ts`  
Expected: combat unit tests and raid browser flow PASS.

- [ ] **Step 7: Commit**

```bash
git add src/game/combat src/game/simulation src/renderer src/ui/CommandBar.vue tests
git commit -m "feat: fight raids on the city map"
```

---

### Task 11: Add versioned local saves and recovery

**Files:**
- Create: `src/game/persistence/saveGame.ts`
- Modify: `src/app/App.vue`
- Create: `tests/unit/persistence.test.ts`
- Create: `tests/e2e/recovery.spec.ts`

**Interfaces:**
- Produces: `saveGame(state): Promise<void>`, `loadGame(): Promise<LoadResult>`, `exportBrokenSave(): Promise<Blob>`, and `recoverRenderer(): Promise<void>`.

- [ ] **Step 1: Write persistence tests**

Test round-trip of seed, tick, threats, entity IDs, and event choices; atomic swap from pending to confirmed slot; rejection of a bad checksum; migration from schema 1 to current schema; and preservation of the last confirmed save after an interrupted write.

- [ ] **Step 2: Verify failure**

Run: `npm run test:unit -- tests/unit/persistence.test.ts`  
Expected: FAIL because persistence does not exist.

- [ ] **Step 3: Implement IndexedDB persistence**

Use database `openfront`, store `saves`, keys `autosave:pending` and `autosave:confirmed`, schema version 1, and a SHA-256 checksum over canonical JSON. Save every five in-game minutes and after event decisions, never on every render snapshot.

- [ ] **Step 4: Add recovery UI**

On invalid save, show Russian actions `Новая долина` and `Экспортировать сохранение`; do not blank the app. On `webglcontextlost`, pause visual updates, preserve Worker state, and show `Восстановить изображение`.

- [ ] **Step 5: Verify persistence and recovery**

Run: `npm run test:unit -- tests/unit/persistence.test.ts && npm run test:e2e -- tests/e2e/recovery.spec.ts`  
Expected: persistence tests and corrupt-save recovery flow PASS.

- [ ] **Step 6: Commit**

```bash
git add src/game/persistence src/app/App.vue tests
git commit -m "feat: persist and recover endless settlements"
```

---

### Task 12: Prove visual fidelity, complete gameplay, and 60 FPS raids

**Files:**
- Create: `tests/e2e/vertical-slice.spec.ts`
- Create: `tests/e2e/performance.spec.ts`
- Create: `tests/e2e/no-placeholders.spec.ts`
- Create: `docs/qa/performance-report.md`
- Create: `docs/qa/final-implementation.png`
- Modify: any source files needed to resolve measured failures.

**Interfaces:**
- Consumes: every prior task.
- Produces: a production build and evidence for functional, visual, and performance acceptance.

- [ ] **Step 1: Write the vertical-slice acceptance flow**

The Playwright test must generate seed `vertical-slice`, build roads and a stable settlement, advance through a winter shortage, inspect imperfect intelligence, form militia, repel a raid, repair damage, save, reload, and verify the same seed/tick/threat IDs are restored.

- [ ] **Step 2: Write content-quality guards**

Search the rendered DOM and asset manifest for `placeholder`, `TODO`, emoji, and CSS font families containing `monospace`. Assert 11 building asset keys load, every visible button contains an SVG, and no request returns 404.

- [ ] **Step 3: Write the 60 FPS raid harness**

Expose a development-only command `window.__OPENFRONT_QA__.loadStressRaid()` that loads exactly 2,000 residents, 300 combatants, 600 structures/segments, and 20 fires. Sample 600 consecutive animation frames after a 120-frame warmup. The test fails if p95 frame time exceeds 16.67 ms or any 120-frame rolling average falls below 60 FPS.

- [ ] **Step 4: Run the complete quality gate**

Run: `npm test`  
Expected: all unit tests, typecheck, and production build PASS.

Run: `npm run test:e2e`  
Expected: Chromium and Firefox functional suites PASS; performance suite PASS in headed Chromium at 1920×1080.

- [ ] **Step 5: Compare design and implementation visually**

Capture the native-size 1920×1080 game screen to `docs/qa/final-implementation.png`. Use `view_image` on both `docs/design/openfront-primary-screen.png` and the final screenshot. Inspect and record at least these points in the report: central map area, top resource hierarchy, left chronicle, right intelligence/selection panels, bottom command bar, typography, icon consistency, building asset quality, raid readability, and purple/earth color balance.

- [ ] **Step 6: Fix every material mismatch and rerun evidence**

Repeat production build, E2E, stress sampling, screenshot capture, and `view_image` comparison until there are no placeholder assets, no monospace text, no broken icons, no layout obstruction of combat, and no frame-budget failure.

- [ ] **Step 7: Record exact performance evidence**

`docs/qa/performance-report.md` must contain date, OS, browser version, CPU/GPU if available, viewport, entity counts, p50/p95/p99 frame time, minimum rolling FPS, draw calls, main-thread time, Worker tick time, and path queue maximum. Do not write `60 FPS achieved` unless the recorded minimum rolling FPS is at least 60.

- [ ] **Step 8: Final commit**

```bash
git add src tests docs public package.json package-lock.json
git commit -m "feat: deliver the Openfront city-builder vertical slice"
```

## Reference Documentation

- Vue recommends Vite for new Vue projects and Vitest for Vite-based unit tests: https://vuejs.org/guide/scaling-up/tooling
- Vite 8 requires Node.js 20.19+ or 22.12+: https://vite.dev/guide/
- PixiJS 8 application setup and asynchronous initialization: https://pixijs.com/8.x/guides/components/application
- PixiJS batching, spritesheets, text, events, and culling guidance: https://pixijs.com/8.x/guides/concepts/performance-tips
- Playwright supports Chromium and Firefox projects: https://playwright.dev/docs/browsers
