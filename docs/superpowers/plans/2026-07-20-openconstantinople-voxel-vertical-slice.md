# OpenConstantinople Voxel Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the raster city scene with a polished, interactive orthographic voxel world driven by a reusable civilization-preset system, with a complete Byzantine Macedonian preset and a verified 60 FPS large raid.

**Architecture:** Vue 3 owns a compact HUD and drawers while a framework-independent game state remains the source of truth. Three.js owns the world through one `WorldRenderer` façade; pure TypeScript generators produce terrain, buildings, roads and units as compact voxel descriptors, which the renderer batches into instanced meshes. A typed `CivilizationPreset` maps generic simulation concepts to Byzantine presentation without putting culture-specific rules into the renderer or simulation core.

**Tech Stack:** Vue 3, Vite 8, TypeScript 5.9, Three.js, Vitest, Playwright Chromium, Lucide Vue for interface controls only.

## Global Constraints

- The world uses a strict orthographic isometric projection and occupies 85–90 percent of the viewport.
- No monospace typeface, emoji, Unicode icon substitute, raster building sprite, or SVG world entity may appear in the production scene.
- The first preset is `byzantine-macedonian`, representing a fictional procedural X–XI century Byzantine metropolis and principality.
- The common simulation must not contain Byzantine names, materials or heraldry.
- All random world and building variation is deterministic from a seed.
- Vue must not own deeply reactive voxel, resident or combatant arrays.
- Repeated voxels and unit parts use `THREE.InstancedMesh`; static meshes are grouped by material and chunk.
- Invalid placement never charges resources and keeps the active build tool.
- Target performance is at least 60 FPS at 1920×1080 during the 300-combatant raid scene.
- Every task follows red-green TDD for pure logic and browser verification for rendered behavior.

---

## File Map

```text
src/
  App.vue                              # composition only: game, renderer projection, HUD
  styles.css                           # tokens and shell-level layout
  components/
    GameWorld.vue                      # renderer lifecycle and pointer/keyboard bridge
    TopHud.vue                         # resources, city, time and utility controls
    ModeBar.vue                        # four primary modes and contextual tool rail
    EdgeDrawer.vue                     # chronicle/court/intel/selection container
  presets/
    types.ts                           # CivilizationPreset contract
    byzantineMacedonian.ts             # first complete preset
    index.ts                           # preset registry and lookup
  voxel/
    types.ts                           # voxel/model/material descriptors
    palette.ts                         # renderer-neutral material definitions
    prng.ts                            # deterministic seed helpers
    terrain.ts                         # height/biome generation
    buildings.ts                       # generic building-generator dispatch
    byzantineBuildings.ts              # Byzantine procedural generators
    units.ts                           # civilian/militia/raider voxel figures
  renderer/
    WorldRenderer.ts                   # public Three.js façade
    VoxelBatch.ts                      # instanced mesh batching
    CameraController.ts                # orthographic pan/zoom/rotation
    PickingController.ts               # raycast, placement preview, drag paths
    SceneMetrics.ts                    # FPS/draw-call/triangle sampling
  game/
    simulation.ts                      # existing state, generic names only
    persistence.ts                     # camera/preset-aware save envelope
tests/
  presets.test.ts
  voxel-buildings.test.ts
  voxel-terrain.test.ts
  camera-controller.test.ts
  persistence.test.ts
  app-shell.test.ts
  e2e/openfront.spec.ts
```

---

### Task 0: Produce and approve the complete voxel primary-screen concept

**Files:**
- Create: `docs/design/openconstantinople-voxel-primary.png`
- Create: `docs/design/openconstantinople-voxel-primary-prompt.md`

**Interfaces:**
- Consumes: the approved voxel/preset specification.
- Produces: the visual source of truth used for Tasks 3, 5, 7 and 10.

- [ ] **Step 1: Generate the complete screen concept**

Use the built-in ImageGen tool in `ui-mockup` mode with this brief:

```text
Use case: ui-mockup
Asset type: complete 1920x1080 browser strategy-game primary screen
Primary request: OpenConstantinople, a polished city-builder plus grand strategy game. Show a fictional prosperous Byzantine metropolis and principality inspired by the Macedonian dynasty era, rendered as a dense small-voxel 3D tabletop diorama in strict orthographic isometric projection. The world is the hero and occupies 88 percent of the screen. Show white stone and brick houses, red tiled roofs, domed civic buildings, arcaded market, palace of the strategos, granaries, workshops, walls, roads, gardens, dark blue coastal water, civilians and a distant approaching force.
UI layout: extremely thin top resource strip; narrow bottom strip with four modes and one contextual tool rail; small closed edge tabs for chronicle, court and intelligence; only one compact right drawer open. Preserve a large unobstructed center.
UI style: physical Byzantine PC strategy controls from the 1990s, square porphyry surfaces, thin gold inlay, marble dividers, bone text, crisp restrained functional icons. No modern dashboard cards.
Typography: expressive old-style serif headings and readable humanist sans body; no monospace.
Color palette: porphyry #24142F, deep purple #351A46, gold #D3AA55, marble #E8DFC9, brick #9B4C36, roof #8A392E, water #173D55, olive #667341, danger #B84E52.
Constraints: code-native Russian HUD text and controls will be implemented separately; no raster UI text needs to be copied. No Minecraft branding, no pixel-art sprites, no SVG entities, no glassmorphism, no pills, no watermark. Practical Vue plus Three.js implementation.
```

- [ ] **Step 2: Inspect and obtain approval**

Use `view_image` on the generated concept. Reject it if the world occupies less than 85 percent, the projection is perspective rather than orthographic, the architecture reads as northern Gothic, or the HUD resembles a modern dashboard. Save the accepted result and exact prompt in the files above, then obtain explicit user approval before Task 1.

- [ ] **Step 3: Commit the accepted visual specification**

```bash
git add docs/design/openconstantinople-voxel-primary.png docs/design/openconstantinople-voxel-primary-prompt.md
git commit -m "art: establish OpenConstantinople voxel direction"
```

---

### Task 1: Add Three.js and the civilization-preset contract

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/presets/types.ts`
- Create: `src/presets/byzantineMacedonian.ts`
- Create: `src/presets/index.ts`
- Create: `tests/presets.test.ts`

**Interfaces:**
- Consumes: existing generic `BuildingKind` from `src/game/simulation.ts`.
- Produces: `CivilizationPreset`, `byzantineMacedonian`, `getPreset(id)` and the stable id `byzantine-macedonian`.

- [ ] **Step 1: Install the renderer dependency**

Run:

```bash
npm install three
npm install -D @types/three
npm uninstall pixi.js
```

Expected: `three` and `@types/three` are present in the lock file; `pixi.js` is absent from dependencies.

- [ ] **Step 2: Write the failing preset tests**

Create `tests/presets.test.ts`:

```ts
import { byzantineMacedonian, getPreset } from '../src/presets'

describe('civilization presets', () => {
  it('maps generic simulation concepts to the Byzantine presentation', () => {
    expect(byzantineMacedonian.id).toBe('byzantine-macedonian')
    expect(byzantineMacedonian.resources.silver).toBe('Номисмы')
    expect(byzantineMacedonian.buildings.townHall).toBe('Дворец стратега')
    expect(byzantineMacedonian.units.retinue).toBe('Тагма')
    expect(byzantineMacedonian.threats).toEqual(expect.arrayContaining([
      'Сельджукский бейлик',
      'Славянский союз',
      'Арабский эмират',
      'Персидская держава',
    ]))
  })

  it('rejects unknown preset ids instead of silently changing culture', () => {
    expect(() => getPreset('missing')).toThrow('Unknown civilization preset: missing')
  })
})
```

- [ ] **Step 3: Run the test and verify the red state**

Run: `npm test -- --run tests/presets.test.ts`  
Expected: FAIL because `../src/presets` does not exist.

- [ ] **Step 4: Implement the preset contract and first preset**

Create `src/presets/types.ts`:

```ts
import type { BuildingKind } from '../game/simulation'

export interface CivilizationPalette {
  porphyry: number
  gold: number
  marble: number
  brick: number
  roof: number
  water: number
  olive: number
  danger: number
}

export interface CivilizationPreset {
  id: string
  cityName: string
  rulerTitle: string
  resources: Record<'silver' | 'food' | 'wood' | 'stone', string>
  buildings: Record<BuildingKind, string>
  units: Record<'militia' | 'retinue' | 'raider', string>
  threats: string[]
  palette: CivilizationPalette
}
```

Create `src/presets/byzantineMacedonian.ts` with the exact public values:

```ts
import type { CivilizationPreset } from './types'

export const byzantineMacedonian: CivilizationPreset = {
  id: 'byzantine-macedonian',
  cityName: 'Порфирополис',
  rulerTitle: 'Стратег фемы',
  resources: { silver: 'Номисмы', food: 'Зерно', wood: 'Древесина', stone: 'Камень' },
  buildings: {
    road: 'Месса', house: 'Инсула', farm: 'Проастий', lumberCamp: 'Лесной двор',
    quarry: 'Каменоломня', granary: 'Зерновой фонд', market: 'Агора',
    smithy: 'Эргастирий', barracks: 'Казармы тагмы', watchtower: 'Фриктория',
    wall: 'Феодосиева стена', townHall: 'Дворец стратега',
  },
  units: { militia: 'Городское ополчение', retinue: 'Тагма', raider: 'Налётчики' },
  threats: ['Сельджукский бейлик', 'Славянский союз', 'Арабский эмират', 'Персидская держава'],
  palette: {
    porphyry: 0x351a46, gold: 0xd3aa55, marble: 0xd8cfb8, brick: 0x9b4c36,
    roof: 0x8a392e, water: 0x173d55, olive: 0x667341, danger: 0xb84e52,
  },
}
```

Create `src/presets/index.ts`:

```ts
import { byzantineMacedonian } from './byzantineMacedonian'

const presets = new Map([[byzantineMacedonian.id, byzantineMacedonian]])

export { byzantineMacedonian }
export type { CivilizationPreset } from './types'

export function getPreset(id: string) {
  const preset = presets.get(id)
  if (!preset) throw new Error(`Unknown civilization preset: ${id}`)
  return preset
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/presets.test.ts && npm run typecheck`  
Expected: 2 tests pass and typecheck exits 0.

```bash
git add package.json package-lock.json src/presets tests/presets.test.ts
git commit -m "feat: add Byzantine civilization preset"
```

---

### Task 2: Create deterministic voxel descriptors and batching

**Files:**
- Create: `src/voxel/types.ts`
- Create: `src/voxel/prng.ts`
- Create: `src/voxel/palette.ts`
- Create: `src/renderer/VoxelBatch.ts`
- Create: `tests/voxel-buildings.test.ts`

**Interfaces:**
- Produces: `Voxel`, `VoxelModel`, `MaterialKey`, `createSeededRandom(seed)`, `VoxelBatch.add(model, origin)` and `VoxelBatch.commit(scene)`.
- `VoxelModel` is renderer-neutral and may be tested without WebGL.

- [ ] **Step 1: Write a failing determinism test**

Add the first block to `tests/voxel-buildings.test.ts`:

```ts
import { createSeededRandom } from '../src/voxel/prng'

it('replays a voxel seed exactly', () => {
  const first = createSeededRandom('porphyry')
  const second = createSeededRandom('porphyry')
  expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second))
})
```

- [ ] **Step 2: Confirm the missing-module failure**

Run: `npm test -- --run tests/voxel-buildings.test.ts`  
Expected: FAIL resolving `src/voxel/prng`.

- [ ] **Step 3: Implement renderer-neutral voxel types**

Create `src/voxel/types.ts`:

```ts
export type MaterialKey =
  | 'earth' | 'grass' | 'water' | 'marble' | 'brick' | 'roof'
  | 'timber' | 'gold' | 'porphyry' | 'iron' | 'foliage' | 'fire'

export interface Voxel {
  x: number
  y: number
  z: number
  material: MaterialKey
  scale?: [number, number, number]
}

export interface VoxelModel {
  id: string
  footprint: [number, number]
  voxels: Voxel[]
  anchor: [number, number, number]
}

export interface WorldPoint { x: number; z: number }
```

Create `src/voxel/prng.ts` using FNV-1a plus Mulberry32:

```ts
export function createSeededRandom(seed: string): () => number {
  let hash = 2166136261
  for (const character of seed) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }
  return () => {
    hash += 0x6d2b79f5
    let value = hash
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
```

Create `src/voxel/palette.ts` with one `THREE.MeshStandardMaterial` factory per material key. Use flat shading, roughness between `0.72` and `0.96`, metalness only for `gold` and `iron`, and no texture maps.

- [ ] **Step 4: Implement one instanced mesh per material**

Create `src/renderer/VoxelBatch.ts`:

```ts
import * as THREE from 'three'
import type { MaterialKey, VoxelModel } from '../voxel/types'
import { createMaterial } from '../voxel/palette'

export class VoxelBatch {
  private readonly entries = new Map<MaterialKey, THREE.Matrix4[]>()
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1)

  add(model: VoxelModel, origin = new THREE.Vector3()): void {
    for (const voxel of model.voxels) {
      const matrices = this.entries.get(voxel.material) ?? []
      const scale = voxel.scale ?? [1, 1, 1]
      matrices.push(new THREE.Matrix4().compose(
        new THREE.Vector3(origin.x + voxel.x, origin.y + voxel.y, origin.z + voxel.z),
        new THREE.Quaternion(),
        new THREE.Vector3(...scale),
      ))
      this.entries.set(voxel.material, matrices)
    }
  }

  commit(scene: THREE.Scene): THREE.InstancedMesh[] {
    return [...this.entries].map(([key, matrices]) => {
      const mesh = new THREE.InstancedMesh(this.geometry, createMaterial(key), matrices.length)
      matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix))
      mesh.instanceMatrix.needsUpdate = true
      mesh.castShadow = key !== 'water'
      mesh.receiveShadow = true
      scene.add(mesh)
      return mesh
    })
  }
}
```

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/voxel-buildings.test.ts && npm run typecheck`  
Expected: determinism test passes and Three.js types compile.

```bash
git add src/voxel src/renderer/VoxelBatch.ts tests/voxel-buildings.test.ts
git commit -m "feat: add deterministic voxel primitives and batching"
```

---

### Task 3: Generate readable Byzantine buildings without raster assets

**Files:**
- Create: `src/voxel/byzantineBuildings.ts`
- Create: `src/voxel/buildings.ts`
- Modify: `tests/voxel-buildings.test.ts`

**Interfaces:**
- Consumes: `BuildingKind`, `VoxelModel`, `createSeededRandom` and `CivilizationPreset`.
- Produces: `generateBuilding(kind, seed, preset): VoxelModel` for all 12 current building kinds.

- [ ] **Step 1: Write failing silhouette and coverage tests**

Append to `tests/voxel-buildings.test.ts`:

```ts
import { generateBuilding } from '../src/voxel/buildings'
import { byzantineMacedonian } from '../src/presets'
import type { BuildingKind } from '../src/game/simulation'

const kinds: BuildingKind[] = [
  'road', 'house', 'farm', 'lumberCamp', 'quarry', 'granary',
  'market', 'smithy', 'barracks', 'watchtower', 'wall', 'townHall',
]

it.each(kinds)('generates a non-empty deterministic %s', (kind) => {
  const first = generateBuilding(kind, 'building-17', byzantineMacedonian)
  const second = generateBuilding(kind, 'building-17', byzantineMacedonian)
  expect(first).toEqual(second)
  expect(first.voxels.length).toBeGreaterThan(kind === 'road' ? 3 : 18)
  expect(first.voxels.every((voxel) => Number.isFinite(voxel.x + voxel.y + voxel.z))).toBe(true)
})

it('gives civic architecture a stronger silhouette than housing', () => {
  const palace = generateBuilding('townHall', 'same', byzantineMacedonian)
  const house = generateBuilding('house', 'same', byzantineMacedonian)
  expect(Math.max(...palace.voxels.map((voxel) => voxel.y))).toBeGreaterThan(
    Math.max(...house.voxels.map((voxel) => voxel.y)),
  )
  expect(palace.voxels.filter((voxel) => voxel.material === 'gold').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Verify the red state**

Run: `npm test -- --run tests/voxel-buildings.test.ts`  
Expected: FAIL because `generateBuilding` is missing.

- [ ] **Step 3: Implement reusable architectural operations**

In `src/voxel/byzantineBuildings.ts`, implement pure helpers with these exact signatures:

```ts
export function addFloor(model: VoxelModel, width: number, depth: number, y: number, material: MaterialKey): void
export function addPerimeter(model: VoxelModel, width: number, depth: number, fromY: number, height: number, material: MaterialKey): void
export function addGabledRoof(model: VoxelModel, width: number, depth: number, fromY: number): void
export function addDome(model: VoxelModel, centerX: number, centerZ: number, fromY: number, radius: number): void
export function addArcade(model: VoxelModel, length: number, originX: number, originZ: number, fromY: number): void
```

`addDome` uses stepped square rings of roof voxels ending in one gold cap. `addArcade` alternates marble columns and lintels so openings remain visible. Door openings are made by omitting voxels, never by transparent materials.

- [ ] **Step 4: Implement the 12 dispatch cases**

Create `src/voxel/buildings.ts`:

```ts
import type { BuildingKind } from '../game/simulation'
import type { CivilizationPreset } from '../presets'
import type { VoxelModel } from './types'
import { generateByzantineBuilding } from './byzantineBuildings'

export function generateBuilding(
  kind: BuildingKind,
  seed: string,
  preset: CivilizationPreset,
): VoxelModel {
  if (preset.id !== 'byzantine-macedonian') {
    throw new Error(`No voxel architecture generator for preset: ${preset.id}`)
  }
  return generateByzantineBuilding(kind, seed)
}
```

Implement `generateByzantineBuilding` with these silhouette rules:

- `road`: flat 4×2 marble/earth paving;
- `house`: 5×4 brick shell, red stepped gable and tiny courtyard;
- `farm`: 7×6 earth rows, low brick shed and olive border;
- `lumberCamp`: 6×5 timber yard, open canopy and stacked logs;
- `quarry`: descending stone steps, crane frame and rubble;
- `granary`: raised 6×4 brick store with arcade vents;
- `market`: 7×6 paved court, colonnade and porphyry awnings;
- `smithy`: 5×4 brick workshop, chimney and fire voxel;
- `barracks`: 8×6 courtyard complex with two roofed wings;
- `watchtower`: 4×4 stone base, four tall levels and beacon;
- `wall`: 8×2 marble/brick curtain with crenellations;
- `townHall`: 10×8 palace with courtyard, arcade, central dome and gold cap.

Variation may change window rhythm, roof height and courtyard decoration by at most one voxel. It must never change footprint or remove the defining silhouette feature.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/voxel-buildings.test.ts`  
Expected: all 14 building tests pass.

```bash
git add src/voxel/byzantineBuildings.ts src/voxel/buildings.ts tests/voxel-buildings.test.ts
git commit -m "feat: generate Byzantine voxel architecture"
```

---

### Task 4: Generate a procedural coastal terrain and orthographic camera

**Files:**
- Create: `src/voxel/terrain.ts`
- Create: `src/renderer/CameraController.ts`
- Create: `tests/voxel-terrain.test.ts`
- Create: `tests/camera-controller.test.ts`

**Interfaces:**
- Produces: `generateTerrain(seed, size): TerrainSnapshot` and `CameraController` with `pan`, `zoomBy`, `rotateQuarter`, `snapshot`, `restore`.

- [ ] **Step 1: Write terrain and camera tests**

Create `tests/voxel-terrain.test.ts`:

```ts
import { generateTerrain } from '../src/voxel/terrain'

it('generates the same coastal terrain from the same seed', () => {
  expect(generateTerrain('coast-17', 48)).toEqual(generateTerrain('coast-17', 48))
})

it('keeps a buildable center and water on an outer edge', () => {
  const terrain = generateTerrain('coast-17', 48)
  expect(terrain.tiles.filter((tile) => tile.buildable).length).toBeGreaterThan(900)
  expect(terrain.tiles.some((tile) => tile.biome === 'water' && (tile.x < 5 || tile.z < 5))).toBe(true)
})
```

Create `tests/camera-controller.test.ts`:

```ts
import * as THREE from 'three'
import { CameraController } from '../src/renderer/CameraController'

it('rotates in exact quarter turns and clamps zoom', () => {
  const controller = new CameraController(new THREE.OrthographicCamera(), { width: 1600, height: 900 })
  controller.rotateQuarter(1)
  controller.zoomBy(100)
  expect(controller.snapshot()).toMatchObject({ quarter: 1, zoom: 2.2 })
})
```

- [ ] **Step 2: Verify both suites fail**

Run: `npm test -- --run tests/voxel-terrain.test.ts tests/camera-controller.test.ts`  
Expected: FAIL resolving both modules.

- [ ] **Step 3: Implement terrain generation**

`TerrainSnapshot` contains `size`, `seed` and flat `tiles`; each tile has `x`, `z`, `height`, `biome: 'water' | 'earth' | 'grass' | 'forest' | 'stone'`, and `buildable`. Generate height from three deterministic sine/noise bands. Reserve the center 24×24 as buildable with height variation no greater than one. Put water along either west or south based on the first seeded random value.

- [ ] **Step 4: Implement camera math**

`CameraController` uses an orthographic camera with a default azimuth of 45 degrees, elevation of 35.264 degrees, zoom `1`, and target at the map center. Clamp zoom to `0.65…2.2`. `rotateQuarter(delta)` changes only an integer `quarter` modulo four and recomputes camera position, avoiding accumulated floating-point rotation drift.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run tests/voxel-terrain.test.ts tests/camera-controller.test.ts && npm run typecheck`  
Expected: all tests pass.

```bash
git add src/voxel/terrain.ts src/renderer/CameraController.ts tests/voxel-terrain.test.ts tests/camera-controller.test.ts
git commit -m "feat: add voxel terrain and isometric camera"
```

---

### Task 5: Mount the Three.js world and remove raster scene dependencies

**Files:**
- Create: `src/renderer/WorldRenderer.ts`
- Create: `src/renderer/PickingController.ts`
- Create: `src/components/GameWorld.vue`
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Modify: `tests/app-shell.test.ts`

**Interfaces:**
- `GameWorld.vue` props: `seed`, `buildings`, `selectedTool`, `battleVisible`, `stressMode`.
- `GameWorld.vue` emits: `build`, `select`, `notice`, `camera-change`.
- `WorldRenderer` methods: `mount`, `resize`, `setWorld`, `setBuildings`, `setBuildTool`, `setBattle`, `render`, `dispose`.

- [ ] **Step 1: Replace raster assertions with a failing canvas contract**

Update `tests/app-shell.test.ts`:

```ts
expect(wrapper.find('[data-testid="voxel-world"]').exists()).toBe(true)
expect(wrapper.find('[data-testid="world"] > img').exists()).toBe(false)
expect(wrapper.findAll('[data-testid="placed-building"]')).toHaveLength(0)
```

Mock `HTMLCanvasElement.prototype.getContext` only at the component boundary; do not mock pure generators.

- [ ] **Step 2: Verify the shell test fails**

Run: `npm test -- --run tests/app-shell.test.ts`  
Expected: FAIL because the current template contains the raster terrain image and DOM buildings.

- [ ] **Step 3: Implement `WorldRenderer` lifecycle**

`mount(canvas)` creates:

- `THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })`;
- one scene with fog, hemisphere light and one shadow-casting directional light;
- `CameraController` and `PickingController`;
- one terrain batch and one building batch;
- a `ResizeObserver` owned by `GameWorld.vue`, not by the renderer.

Use `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`, `SRGBColorSpace`, ACES filmic tone mapping, and a shadow map no larger than 2048². `dispose()` cancels RAF, removes listeners and disposes every geometry, material and renderer resource.

- [ ] **Step 4: Create the Vue renderer bridge**

`GameWorld.vue` renders exactly one canvas:

```vue
<template>
  <canvas ref="canvas" class="voxel-world" data-testid="voxel-world" aria-label="Изометрическая карта княжества" />
</template>
```

Instantiate `WorldRenderer` in `onMounted`, forward shallow prop changes through explicit methods, and call `dispose` in `onUnmounted`. Do not put the renderer instance inside `reactive()`.

- [ ] **Step 5: Replace the DOM world in `App.vue`**

Remove the `<img>`, resource-zone divs, DOM building sprites and DOM battle sprites. Bind the existing build action to the `build` event from `GameWorld`. Keep the threat callout as code-native UI anchored to the top-right world edge until world-space labels are introduced.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run tests/app-shell.test.ts && npm run typecheck && npm run build`  
Expected: shell test passes, no production reference to `building-atlas.png`, `combatants.png` or `empty-valley.png` remains.

```bash
git add src/renderer src/components/GameWorld.vue src/App.vue src/styles.css tests/app-shell.test.ts
git commit -m "feat: replace raster map with voxel world"
```

---

### Task 6: Add real placement preview, picking, roads and camera controls

**Files:**
- Modify: `src/renderer/PickingController.ts`
- Modify: `src/renderer/WorldRenderer.ts`
- Modify: `src/components/GameWorld.vue`
- Modify: `src/App.vue`
- Modify: `src/game/simulation.ts`
- Modify: `tests/simulation.test.ts`
- Modify: `tests/e2e/openfront.spec.ts`

**Interfaces:**
- Produces: `PlacementRequest { kind, x, z }`, `PathPlacementRequest { kind: 'road' | 'wall', points }` and `CameraSnapshot` persisted by Task 8.

- [ ] **Step 1: Write failing path-placement tests**

Add to `tests/simulation.test.ts`:

```ts
import { placePath } from '../src/game/simulation'

it('places a dragged road atomically and charges only accepted cells', () => {
  const state = createGame('road')
  const result = placePath(state, 'road', [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 12, y: 10 }])
  expect(result).toEqual({ ok: true, placed: 3 })
  expect(state.buildings.filter((building) => building.kind === 'road')).toHaveLength(3)
})
```

- [ ] **Step 2: Confirm red and implement atomic placement**

Run: `npm test -- --run tests/simulation.test.ts`  
Expected: FAIL because `placePath` is missing.

Implement `placePath` by deduplicating points, pre-validating all cells and total resource cost, then applying the complete path. If any cell is occupied or resources are insufficient, return `{ ok: false, reason }` without mutation.

- [ ] **Step 3: Implement raycast and ghost preview**

`PickingController` raycasts against one invisible ground plane, converts intersections to integer grid coordinates, and returns no result outside `0…63`. Preview uses a dedicated translucent `VoxelBatch`: valid material is gold at `0.48` opacity, invalid material is danger red at `0.55`. Preview geometry is rebuilt only when cell, kind or validity changes.

- [ ] **Step 4: Implement camera input**

- pointer drag on empty ground pans;
- wheel zooms with `preventDefault` only over the canvas;
- `Q/E` rotate one quarter;
- `Escape` cancels the active tool;
- drag with `road` or `wall` emits a Bresenham grid path;
- a click that moved fewer than four CSS pixels remains a placement or selection click.

- [ ] **Step 5: Expand Playwright behavior**

In `tests/e2e/openfront.spec.ts`, assert:

```ts
await page.locator('[data-kind="house"]').click()
await page.getByTestId('voxel-world').click({ position: { x: 820, y: 430 } })
await expect(page.getByTestId('notice')).toContainText('Инсула заложена')

const before = await page.getByTestId('camera-state').getAttribute('data-quarter')
await page.keyboard.press('KeyE')
await expect(page.getByTestId('camera-state')).not.toHaveAttribute('data-quarter', before ?? '0')
```

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run test:e2e`  
Expected: unit and browser interaction suites pass.

```bash
git add src/renderer src/components/GameWorld.vue src/App.vue src/game/simulation.ts tests
git commit -m "feat: add voxel placement and isometric controls"
```

---

### Task 7: Replace the large chrome with the compact Byzantine HUD

**Files:**
- Create: `src/components/TopHud.vue`
- Create: `src/components/ModeBar.vue`
- Create: `src/components/EdgeDrawer.vue`
- Modify: `src/App.vue`
- Modify: `src/styles.css`
- Modify: `tests/app-shell.test.ts`
- Modify: `tests/e2e/openfront.spec.ts`

**Interfaces:**
- `TopHud` emits `speed`, `new-world`, `save`, `load`, `toggle-drawer`.
- `ModeBar` emits `mode`, `tool`, `attack`; it consumes preset building labels.
- `EdgeDrawer` owns no game state and emits only `close` and explicit contextual actions.

- [ ] **Step 1: Write failing compact-layout assertions**

Add to `tests/app-shell.test.ts`:

```ts
expect(wrapper.get('[data-testid="top-hud"]').classes()).toContain('top-hud')
expect(wrapper.findAll('[data-testid="edge-drawer"]')).toHaveLength(0)
await wrapper.get('[data-action="toggle-intel"]').trigger('click')
expect(wrapper.findAll('[data-testid="edge-drawer"]')).toHaveLength(1)
expect(wrapper.text()).toContain('Порфирополис')
expect(wrapper.text()).toContain('Номисмы')
```

- [ ] **Step 2: Verify the red state**

Run: `npm test -- --run tests/app-shell.test.ts`  
Expected: FAIL because the monolithic panels are always visible and generic copy remains.

- [ ] **Step 3: Build the three focused components**

Use these fixed dimensions at 1920×1080:

- top HUD: 46px;
- bottom mode bar: 82px collapsed, 132px with a tool rail;
- edge drawer: 286px wide, maximum `calc(100vh - 152px)` tall;
- world canvas: full viewport behind all chrome.

Mode buttons are `Улицы`, `Кварталы`, `Производство`, `Оборона`. Only the active mode's tools render. A selected tool gets an inset border, gold lower rule and darker pressed surface. Drawers use square corners, 1px gold/marble rules and no nested cards.

- [ ] **Step 4: Apply the Byzantine copy and palette**

Replace `Вересков Дол` with `Порфирополис`, `Серебро` with `Номисмы`, `Ратуша` with `Дворец стратега`, `Казарма` with `Казармы тагмы`, and generic northern threat copy with preset-provided political actors. Keep body type in Alegreya Sans and headings/numerals in Alegreya; add no monospace fallback.

- [ ] **Step 5: Browser-check open/close and responsive behavior**

At 1280×720, assert the world canvas remains at least 560 CSS pixels tall, only one drawer is open, all four primary modes remain accessible, and tool labels do not wrap to three lines.

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run typecheck && npm run test:e2e`  
Expected: all checks pass and the rendered world owns at least 85 percent of the screen before drawers open.

```bash
git add src/components src/App.vue src/styles.css tests
git commit -m "feat: add compact Byzantine strategy HUD"
```

---

### Task 8: Persist preset and camera state without breaking existing saves

**Files:**
- Modify: `src/game/persistence.ts`
- Modify: `src/App.vue`
- Modify: `tests/persistence.test.ts`

**Interfaces:**
- Save schema version 2 adds `presetId` and `camera` while decoding version 1 into safe defaults.

- [ ] **Step 1: Write migration tests**

Add to `tests/persistence.test.ts`:

```ts
it('round-trips the active preset and orthographic camera', () => {
  const payload = encodeSave(createGame('camera'), {
    presetId: 'byzantine-macedonian',
    camera: { targetX: 32, targetZ: 32, zoom: 1.25, quarter: 3 },
  })
  expect(decodeSave(payload)).toMatchObject({
    ok: true,
    meta: { presetId: 'byzantine-macedonian', camera: { zoom: 1.25, quarter: 3 } },
  })
})

it('migrates version one saves to the Byzantine preset and default camera', () => {
  const old = encodeVersionOneFixture(createGame('old'))
  expect(decodeSave(old)).toMatchObject({
    ok: true,
    meta: { presetId: 'byzantine-macedonian', camera: { zoom: 1, quarter: 0 } },
  })
})
```

- [ ] **Step 2: Verify red and implement schema version 2**

Run: `npm test -- --run tests/persistence.test.ts`  
Expected: FAIL because save metadata arguments and migration do not exist.

Add strict finite/range validation for camera values. Unknown presets return `{ ok: false, reason: 'Неизвестный культурный пресет' }`; invalid camera data falls back to the default camera without discarding valid game state.

- [ ] **Step 3: Wire save/load to `GameWorld`**

Before saving, call `worldRef.snapshotCamera()`. After loading, update the preset projection first, then state, then call `worldRef.restoreCamera(camera)` on the next Vue tick.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run tests/persistence.test.ts && npm run test:e2e`  
Expected: migration and browser save/load scenarios pass.

```bash
git add src/game/persistence.ts src/App.vue tests/persistence.test.ts tests/e2e/openfront.spec.ts
git commit -m "feat: persist voxel camera and civilization preset"
```

---

### Task 9: Render voxel forces, raids and the 300-unit stress scene

**Files:**
- Create: `src/voxel/units.ts`
- Create: `src/renderer/SceneMetrics.ts`
- Modify: `src/renderer/WorldRenderer.ts`
- Modify: `tests/e2e/openfront.spec.ts`

**Interfaces:**
- Produces: `generateUnitModel(kind, faction): VoxelModel`, `WorldRenderer.setBattle(snapshot)` and `SceneMetrics.sample()`.

Use these shared renderer-only types in `src/renderer/WorldRenderer.ts`:

```ts
export interface BattleRenderUnit {
  id: number
  kind: 'militia' | 'retinue' | 'raider'
  faction: 'friendly' | 'enemy'
  x: number
  z: number
  morale: number
}

export interface BattleRenderSnapshot {
  units: BattleRenderUnit[]
}

declare global {
  interface Window {
    __OPENFRONT_METRICS__?: {
      averageFps: number
      p95FrameMs: number
      drawCalls: number
      triangles: number
      visibleUnits: number
    }
  }
}
```

- [ ] **Step 1: Write pure unit-model tests**

Add to `tests/voxel-buildings.test.ts`:

```ts
import { generateUnitModel } from '../src/voxel/units'

it('distinguishes tagma and raider by silhouette and faction material', () => {
  const tagma = generateUnitModel('retinue', 'friendly')
  const raider = generateUnitModel('raider', 'enemy')
  expect(tagma.voxels).not.toEqual(raider.voxels)
  expect(tagma.voxels.some((voxel) => voxel.material === 'porphyry')).toBe(true)
  expect(raider.voxels.some((voxel) => voxel.material === 'brick')).toBe(true)
})
```

- [ ] **Step 2: Implement compact unit models**

Each near unit uses at most 18 voxels: legs, torso, arms, head, equipment and one faction accent. Distant units use five voxels. Equipment differentiates spear-and-shield militia, armored tagma and axe/bow raiders. All identical parts across the formation share instanced batches.

- [ ] **Step 3: Render live combat state**

`setBattle` receives flat positions and morale values, updates matrices in existing pools, hides unused instances by zero scale, and never allocates a new mesh during an active raid. Morale below 25 percent changes formation movement to retreat and uses the danger/faded faction accent; it does not delete the unit immediately.

- [ ] **Step 4: Add metrics and stress instrumentation**

`SceneMetrics` records the latest 180 RAF deltas plus renderer info. Expose a read-only development snapshot at `window.__OPENFRONT_METRICS__` only when the URL contains `?stress=1`. Record average FPS, p95 frame time, draw calls, triangles and visible units.

- [ ] **Step 5: Replace the old DOM stress assertion**

The Playwright stress test must assert:

```ts
await page.goto('/?stress=1')
await page.locator('[data-action="attack"]').click()
await expect.poll(async () => page.evaluate(() => window.__OPENFRONT_METRICS__?.visibleUnits)).toBe(300)
const metrics = await page.evaluate(() => window.__OPENFRONT_METRICS__!)
expect(metrics.averageFps).toBeGreaterThanOrEqual(59)
expect(metrics.drawCalls).toBeLessThanOrEqual(24)
```

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run test:e2e`  
Expected: unit tests pass; Chromium reports 300 visible units, at least 59 measured FPS and at most 24 draw calls.

```bash
git add src/voxel/units.ts src/renderer src tests
git commit -m "feat: render instanced voxel raids"
```

---

### Task 10: Final visual polish, recovery and migration cleanup

**Files:**
- Modify: `src/renderer/WorldRenderer.ts`
- Modify: `src/components/GameWorld.vue`
- Modify: `src/styles.css`
- Modify: `src/App.vue`
- Modify: `README.md`
- Modify: `docs/qa/2026-07-20-prototype-qa.md`
- Create: `docs/qa/openconstantinople-voxel-1920x1080.png`
- Create: `docs/qa/openconstantinople-voxel-1280x720.png`
- Create: `docs/qa/openconstantinople-voxel-raid-1920x1080.png`

**Interfaces:**
- Produces the final verified voxel vertical slice and updated handoff evidence.

- [ ] **Step 1: Add WebGL recovery behavior**

Listen for `webglcontextlost`, call `preventDefault`, pause only the renderer loop and show a code-native overlay: `Рендер мира приостановлен` with a `Восстановить` button. On `webglcontextrestored`, rebuild batches from the latest snapshot without resetting the simulation.

- [ ] **Step 2: Polish the world and UI as one composition**

Tune only these approved elements:

- a three-stop daylight rig with restrained warm key and cool ambient;
- contact shadows under buildings and units;
- subtle water movement through vertex displacement or material time, not a video texture;
- 140–180ms drawer and pressed-control motion;
- porphyry `#24142f` surfaces, gold `#d3aa55`, marble text `#e8dfc9`, danger `#b84e52`;
- world-space selection outline and placement preview;
- no permanent tooltip over the center of the world.

- [ ] **Step 3: Remove active raster-world dependencies**

Run:

```bash
rg -n "empty-valley|building-atlas|combatants\.png|<img" src
```

Expected: no matches. Keep generated historical files only if referenced by design documentation; otherwise remove them from the active public asset tree in a separate explicit commit.

- [ ] **Step 4: Run native viewport visual QA**

Browser/IAB is preferred. If unavailable, record Playwright Chromium fallback and capture 1920×1080, 1280×720 and raid state. Use `view_image` on the approved voxel concept and each latest implementation capture. Check at least:

1. world occupies 85–90 percent;
2. orthographic projection and camera angle are consistent;
3. Byzantine silhouettes read without labels;
4. UI chrome is compact and porphyry/gold;
5. build preview and selected state are clear;
6. no raster or SVG entity substitutes remain;
7. no clipping at 1280×720;
8. raid remains legible at 1920×1080.

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

Expected: all commands exit 0; stress output records at least 59 FPS and no more than 24 draw calls.

- [ ] **Step 6: Update documentation and commit**

README must describe Three.js controls, the Byzantine preset and the stress URL. QA report must include browser, viewport, average FPS, p95 frame time, draw calls, triangles, visible-unit count, the fidelity ledger and any remaining intentional deviation.

```bash
git add src README.md docs/qa tests
git commit -m "feat: finish OpenConstantinople voxel vertical slice"
```
