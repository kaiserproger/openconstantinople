import * as THREE from 'three'
import { VoxelBatch } from '../src/renderer/VoxelBatch'
import { createSeededRandom } from '../src/voxel/prng'
import type { VoxelModel } from '../src/voxel/types'

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
