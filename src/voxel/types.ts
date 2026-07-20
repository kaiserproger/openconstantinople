export type MaterialKey =
  | 'earth'
  | 'grass'
  | 'water'
  | 'marble'
  | 'brick'
  | 'roof'
  | 'timber'
  | 'gold'
  | 'porphyry'
  | 'iron'
  | 'foliage'
  | 'fire'

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

export interface WorldPoint {
  x: number
  z: number
}
