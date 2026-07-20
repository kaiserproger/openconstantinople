import * as THREE from 'three'
import type { BuildingKind } from '../src/game/simulation'
import { byzantineMacedonian } from '../src/presets'
import { VoxelBatch } from '../src/renderer/VoxelBatch'
import { generateBuilding } from '../src/voxel/buildings'
import { createSeededRandom } from '../src/voxel/prng'
import type { VoxelModel } from '../src/voxel/types'
import { generateUnitModel } from '../src/voxel/units'

it('replays a voxel seed exactly', () => {
  const first = createSeededRandom('porphyry')
  const second = createSeededRandom('porphyry')
  expect(Array.from({ length: 8 }, first)).toEqual(Array.from({ length: 8 }, second))
})

it('batches repeated voxels into one instanced mesh per material', () => {
  const model: VoxelModel = {
    id: 'test',
    footprint: [2, 1],
    anchor: [0, 0, 0],
    voxels: [
      { x: 0, y: 0, z: 0, material: 'marble' },
      { x: 1, y: 0, z: 0, material: 'marble' },
      { x: 0, y: 1, z: 0, material: 'brick' },
    ],
  }
  const scene = new THREE.Scene()
  const batch = new VoxelBatch()

  batch.add(model, new THREE.Vector3(4, 0, 7))
  const meshes = batch.commit(scene)

  expect(meshes).toHaveLength(2)
  expect(meshes.map((mesh) => mesh.count).sort()).toEqual([1, 2])
  expect(scene.children).toHaveLength(2)
})

const buildingKinds: BuildingKind[] = [
  'road',
  'house',
  'farm',
  'lumberCamp',
  'quarry',
  'granary',
  'market',
  'smithy',
  'barracks',
  'watchtower',
  'wall',
  'townHall',
]

it.each(buildingKinds)('generates a non-empty deterministic %s', (kind) => {
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

it('distinguishes tagma and raider by silhouette and faction material', () => {
  const tagma = generateUnitModel('retinue', 'friendly')
  const raider = generateUnitModel('raider', 'enemy')

  expect(tagma.voxels).not.toEqual(raider.voxels)
  expect(tagma.voxels.some((voxel) => voxel.material === 'porphyry')).toBe(true)
  expect(raider.voxels.some((voxel) => voxel.material === 'brick')).toBe(true)
  expect(tagma.voxels.length).toBeLessThanOrEqual(18)
  expect(raider.voxels.length).toBeLessThanOrEqual(18)
})
