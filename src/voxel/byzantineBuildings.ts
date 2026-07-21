import { BUILDING_FOOTPRINTS, type BuildingKind } from '../game/simulation'
import { createSeededRandom } from './prng'
import type { MaterialKey, VoxelModel } from './types'

function createModel(kind: BuildingKind): VoxelModel {
  const footprint = [...BUILDING_FOOTPRINTS[kind]] as [number, number]
  return { id: kind, footprint, anchor: [(footprint[0] - 1) / 2, 0, (footprint[1] - 1) / 2], voxels: [] }
}

function addVoxel(
  model: VoxelModel,
  x: number,
  y: number,
  z: number,
  material: MaterialKey,
  scale?: [number, number, number],
): void {
  model.voxels.push({ x, y, z, material, ...(scale ? { scale } : {}) })
}

function addBox(
  model: VoxelModel,
  origin: [number, number, number],
  size: [number, number, number],
  material: MaterialKey,
): void {
  for (let x = 0; x < size[0]; x += 1) {
    for (let y = 0; y < size[1]; y += 1) {
      for (let z = 0; z < size[2]; z += 1) {
        addVoxel(model, origin[0] + x, origin[1] + y, origin[2] + z, material)
      }
    }
  }
}

export function addFloor(
  model: VoxelModel,
  width: number,
  depth: number,
  y: number,
  material: MaterialKey,
): void {
  addBox(model, [0, y, 0], [width, 1, depth], material)
}

export function addPerimeter(
  model: VoxelModel,
  width: number,
  depth: number,
  fromY: number,
  height: number,
  material: MaterialKey,
): void {
  for (let y = fromY; y < fromY + height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      addVoxel(model, x, y, 0, material)
      addVoxel(model, x, y, depth - 1, material)
    }
    for (let z = 1; z < depth - 1; z += 1) {
      addVoxel(model, 0, y, z, material)
      addVoxel(model, width - 1, y, z, material)
    }
  }
}

export function addGabledRoof(
  model: VoxelModel,
  width: number,
  depth: number,
  fromY: number,
  originX = 0,
  originZ = 0,
): void {
  const layers = Math.ceil(width / 2)
  for (let layer = 0; layer < layers; layer += 1) {
    const left = layer
    const right = width - 1 - layer
    for (let z = 0; z < depth; z += 1) {
      addVoxel(model, originX + left, fromY + layer, originZ + z, 'roof')
      if (right !== left) addVoxel(model, originX + right, fromY + layer, originZ + z, 'roof')
    }
  }
}

function addGabledRoofAlongDepth(model: VoxelModel, width: number, depth: number, fromY: number): void {
  const layers = Math.ceil(depth / 2)
  for (let layer = 0; layer < layers; layer += 1) {
    const near = layer
    const far = depth - 1 - layer
    for (let x = 0; x < width; x += 1) {
      addVoxel(model, x, fromY + layer, near, 'roof')
      if (far !== near) addVoxel(model, x, fromY + layer, far, 'roof')
    }
  }
}

export function addDome(
  model: VoxelModel,
  centerX: number,
  centerZ: number,
  fromY: number,
  radius: number,
): void {
  for (let layer = 0; layer < radius; layer += 1) {
    const extent = radius - layer
    for (let x = -extent; x <= extent; x += 1) {
      for (let z = -extent; z <= extent; z += 1) {
        if (Math.abs(x) + Math.abs(z) <= extent + 1) {
          addVoxel(model, centerX + x, fromY + layer, centerZ + z, 'roof')
        }
      }
    }
  }
  addVoxel(model, centerX, fromY + radius, centerZ, 'gold', [0.6, 1.4, 0.6])
}

export function addArcade(
  model: VoxelModel,
  length: number,
  originX: number,
  originZ: number,
  fromY: number,
): void {
  for (let x = 0; x < length; x += 2) {
    addVoxel(model, originX + x, fromY, originZ, 'marble')
    addVoxel(model, originX + x, fromY + 1, originZ, 'marble')
  }
  for (let x = 0; x < length; x += 1) addVoxel(model, originX + x, fromY + 2, originZ, 'marble')
}

function addCrenellations(model: VoxelModel, width: number, depth: number, y: number): void {
  for (let x = 0; x < width; x += 2) {
    addVoxel(model, x, y, 0, 'marble')
    addVoxel(model, x, y, depth - 1, 'marble')
  }
  for (let z = 2; z < depth - 1; z += 2) {
    addVoxel(model, 0, y, z, 'marble')
    addVoxel(model, width - 1, y, z, 'marble')
  }
}

export function generateByzantineBuilding(kind: BuildingKind, seed: string): VoxelModel {
  const random = createSeededRandom(`${kind}:${seed}`)

  if (kind === 'road') {
    const model = createModel(kind)
    for (const x of [-0.24, 0.24]) for (const z of [-0.24, 0.24]) {
      addVoxel(model, x, 0, z, random() > 0.18 ? 'marble' : 'earth', [0.44, 0.16, 0.44])
    }
    return model
  }

  if (kind === 'farm') {
    const model = createModel(kind)
    addFloor(model, 7, 6, 0, 'earth')
    for (let x = 0; x < 7; x += 2) for (let z = 0; z < 4; z += 1) {
      addVoxel(model, x, 0.58, z, z % 2 === 0 ? 'gold' : 'grass', [0.28, 0.72, 0.28])
    }
    addBox(model, [4, 1, 4], [3, 2, 2], 'brick')
    addGabledRoof(model, 3, 2, 3, 4, 4)
    addVoxel(model, 5, 1, 3.42, 'timber', [0.7, 1.45, 0.22])
    return model
  }

  if (kind === 'quarry') {
    const model = createModel(kind)
    addFloor(model, 6, 5, 0, 'earth')
    for (let step = 0; step < 4; step += 1) addBox(model, [step, 1 + step, 0], [6 - step, 1, 3], 'marble')
    addBox(model, [4, 1, 3], [1, 4, 1], 'timber')
    addVoxel(model, 3, 4, 3, 'timber', [3, 0.5, 0.5])
    addVoxel(model, 1.2, 1.6, 3.7, 'iron', [0.22, 2.4, 0.22])
    return model
  }

  if (kind === 'lumberCamp') {
    const model = createModel(kind)
    addFloor(model, 6, 5, 0, 'earth')
    for (let z = 0; z < 4; z += 1) addVoxel(model, 1, 1 + z * 0.32, z, 'timber', [2.6, 0.45, 0.45])
    addBox(model, [3, 1, 1], [3, 3, 3], 'timber')
    addGabledRoof(model, 3, 3, 4, 3, 1)
    addVoxel(model, 4, 1.1, 0.42, 'gold', [0.52, 0.52, 0.18])
    return model
  }

  if (kind === 'wall') {
    const model = createModel(kind)
    addVoxel(model, 0, 0.45, 0, 'brick', [1.04, 0.9, 1.04])
    addVoxel(model, 0, 2, 0, 'marble', [0.96, 2.2, 0.96])
    addVoxel(model, 0, 3.18, 0, 'brick', [1.03, 0.18, 1.03])
    addVoxel(model, 0, 3.36, 0, 'marble', [1.02, 0.18, 1.02])
    for (const x of [-0.31, 0.31]) for (const z of [-0.31, 0.31]) {
      addVoxel(model, x, 3.72, z, 'marble', [0.29, 0.62, 0.29])
    }
    return model
  }

  if (kind === 'watchtower') {
    const model = createModel(kind)
    addFloor(model, 4, 4, 0, 'marble')
    addPerimeter(model, 4, 4, 1, 8, 'marble')
    addCrenellations(model, 4, 4, 9)
    for (let y = 2; y <= 7; y += 2) {
      addVoxel(model, 1.5, y, -0.43, 'porphyry', [0.34, 0.72, 0.18])
      addVoxel(model, 1.5, y, 3.43, 'porphyry', [0.34, 0.72, 0.18])
    }
    addVoxel(model, 1.5, 10, 1.5, 'fire', [1.2, 1.1, 1.2])
    return model
  }

  if (kind === 'market') {
    const model = createModel(kind)
    addFloor(model, 7, 6, 0, 'marble')
    addArcade(model, 7, 0, 0, 1)
    addArcade(model, 7, 0, 5, 1)
    for (let x = 1; x < 7; x += 2) {
      addVoxel(model, x, 1.25, 2 + (x % 3), x % 4 === 1 ? 'porphyry' : 'gold', [1.4, 0.24, 1.4])
      addVoxel(model, x, 0.72, 2 + (x % 3), 'timber', [0.18, 1.15, 0.18])
    }
    addVoxel(model, 3, 0.62, 2.5, 'water', [1.25, 0.22, 1.25])
    addVoxel(model, 3, 1.25, 2.5, 'marble', [0.35, 1.05, 0.35])
    return model
  }

  if (kind === 'smithy') {
    const model = createModel(kind)
    addFloor(model, 5, 4, 0, 'marble')
    addPerimeter(model, 5, 4, 1, 3, 'brick')
    addGabledRoof(model, 5, 4, 4)
    addBox(model, [4, 4, 2], [1, 4, 1], 'brick')
    addVoxel(model, 1, 1, 1, 'fire')
    addVoxel(model, 2.2, 1.05, -0.42, 'iron', [1.35, 0.28, 0.52])
    addVoxel(model, 2.2, 0.66, -0.42, 'iron', [0.38, 0.62, 0.38])
    addVoxel(model, 1, 1.6, -0.43, 'gold', [0.45, 0.45, 0.2])
    return model
  }

  if (kind === 'granary') {
    const model = createModel(kind)
    for (let x = 0; x < 6; x += 2) for (let z = 0; z < 4; z += 3) addBox(model, [x, 0, z], [1, 2, 1], 'marble')
    addFloor(model, 6, 4, 2, 'timber')
    addPerimeter(model, 6, 4, 3, 3, 'brick')
    addGabledRoof(model, 6, 4, 6)
    for (const x of [1, 3, 5]) addVoxel(model, x, 3.7, -0.43, 'gold', [0.42, 0.62, 0.22])
    addVoxel(model, 2.5, 3.7, -0.46, 'timber', [0.72, 1.55, 0.22])
    return model
  }

  if (kind === 'house') {
    const model = createModel(kind)
    const brickFacade = random() > 0.5
    const roofAlongDepth = random() > 0.5
    addFloor(model, 5, 4, 0, 'marble')
    addPerimeter(model, 5, 4, 1, 2, brickFacade ? 'brick' : 'marble')
    if (roofAlongDepth) addGabledRoofAlongDepth(model, 5, 4, 3)
    else addGabledRoof(model, 5, 4, 3)
    addVoxel(model, 2, 1.15, -0.43, 'timber', [0.72, 1.65, 0.22])
    for (const x of [0.9, 3.1]) addVoxel(model, x, 1.6, -0.45, 'gold', [0.48, 0.52, 0.2])
    addVoxel(model, 4, 4.5, 2.5, 'brick', [0.62, 2.1, 0.62])
    if (random() > 0.5) addVoxel(model, 2, 2.75, -0.48, 'timber', [3.2, 0.22, 0.3])
    return model
  }

  if (kind === 'barracks') {
    const model = createModel(kind)
    addFloor(model, 8, 6, 0, 'marble')
    addBox(model, [0, 1, 0], [3, 3, 6], 'brick')
    addBox(model, [5, 1, 0], [3, 3, 6], 'brick')
    addGabledRoof(model, 3, 6, 4)
    for (let z = 0; z < 6; z += 1) addVoxel(model, 5 + (z % 3), 4 + Math.min(z % 3, 2), z, 'roof')
    addArcade(model, 4, 2, 0, 1)
    addVoxel(model, 3.5, 3.8, -0.45, 'porphyry', [0.22, 2.4, 0.22])
    addVoxel(model, 4.15, 4.45, -0.45, 'gold', [1.3, 0.68, 0.18])
    for (const x of [2.7, 4.3]) addVoxel(model, x, 0.85, 3.6, 'iron', [0.18, 1.7, 0.18])
    return model
  }

  const model = createModel(kind)
  addFloor(model, 10, 8, 0, 'marble')
  addBox(model, [0, 1, 1], [3, 3, 5], 'brick')
  addBox(model, [7, 1, 1], [3, 3, 5], 'brick')
  addGabledRoof(model, 3, 5, 4, 0, 1)
  addGabledRoof(model, 3, 5, 4, 7, 1)
  const basilicaStart = model.voxels.length
  addPerimeter(model, 4, 4, 1, 5, 'marble')
  for (const voxel of model.voxels.slice(basilicaStart)) {
    voxel.x += 3
    voxel.z += 2
  }
  addDome(model, 4.5, 3.5, 6, 2)
  addArcade(model, 10, 0, 0, 1)
  addVoxel(model, 4.5, 0.65, 6, 'water', [2.1, 0.2, 1.25])
  addVoxel(model, 4.5, 1.2, 6, 'marble', [0.42, 1.1, 0.42])
  addVoxel(model, 1, 4.8, 0.55, 'porphyry', [0.72, 2.6, 0.2])
  addVoxel(model, 8, 4.8, 0.55, 'porphyry', [0.72, 2.6, 0.2])
  return model
}
