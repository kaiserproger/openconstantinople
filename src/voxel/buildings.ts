import type { BuildingKind } from '../game/simulation'
import type { CivilizationPreset } from '../presets'
import { generateByzantineBuilding } from './byzantineBuildings'
import type { VoxelModel } from './types'

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
