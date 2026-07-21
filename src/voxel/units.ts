import type { VoxelModel } from './types'

export type UnitKind = 'militia' | 'retinue' | 'raider'
export type UnitFaction = 'friendly' | 'enemy'

export function generateUnitModel(kind: UnitKind, faction: UnitFaction, distant = false): VoxelModel {
  const accent = faction === 'friendly' ? 'porphyry' : 'brick'
  const metal = kind === 'retinue' ? 'gold' : 'iron'
  if (distant) {
    return {
      id: `${kind}:${faction}:distant`,
      footprint: [1, 1],
      anchor: [0, 0, 0],
      voxels: [{ x: 0, y: 0.9, z: 0, material: accent, scale: [0.62, 1.8, 0.62] }],
    }
  }
  const voxels: VoxelModel['voxels'] = [
    { x: -0.16, y: 0.35, z: 0, material: 'timber', scale: [0.22, 0.7, 0.24] },
    { x: 0.16, y: 0.35, z: 0, material: 'timber', scale: [0.22, 0.7, 0.24] },
    { x: 0, y: 1.05, z: 0, material: accent, scale: [0.62, 0.78, 0.38] },
    { x: 0, y: 1.64, z: 0, material: 'marble', scale: [0.42, 0.42, 0.42] },
    { x: 0, y: 1.91, z: 0, material: metal, scale: [0.48, 0.18, 0.48] },
  ]
  if (kind === 'militia') {
    voxels.push(
      { x: -0.46, y: 1.05, z: 0, material: 'timber', scale: [0.14, 0.8, 0.14] },
      { x: 0.46, y: 1.05, z: 0, material: 'marble', scale: [0.18, 0.74, 0.72] },
      { x: -0.52, y: 1.85, z: 0, material: 'iron', scale: [0.1, 2.4, 0.1] },
    )
  } else if (kind === 'retinue') {
    voxels.push(
      { x: -0.43, y: 1.15, z: 0, material: 'gold', scale: [0.18, 0.82, 0.18] },
      { x: 0.43, y: 1.12, z: 0, material: 'porphyry', scale: [0.16, 0.84, 0.76] },
      { x: -0.5, y: 1.82, z: 0, material: 'iron', scale: [0.1, 2.7, 0.1] },
      { x: 0, y: 1.36, z: -0.24, material: 'gold', scale: [0.16, 0.28, 0.12] },
    )
  } else {
    voxels.push(
      { x: -0.44, y: 1.08, z: 0, material: 'timber', scale: [0.15, 0.82, 0.15] },
      { x: 0.44, y: 1.1, z: 0, material: 'iron', scale: [0.13, 1.28, 0.13] },
      { x: 0.61, y: 1.58, z: 0, material: 'iron', scale: [0.42, 0.14, 0.14] },
      { x: 0, y: 2.08, z: 0, material: 'brick', scale: [0.18, 0.36, 0.18] },
    )
  }
  return { id: `${kind}:${faction}`, footprint: [1, 1], anchor: [0, 0, 0], voxels }
}
