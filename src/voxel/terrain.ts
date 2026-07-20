import { createSeededRandom } from './prng'

export type TerrainBiome = 'water' | 'earth' | 'grass' | 'forest' | 'stone'

export interface TerrainTile {
  x: number
  z: number
  height: number
  biome: TerrainBiome
  buildable: boolean
}

export interface TerrainSnapshot {
  seed: string
  size: number
  tiles: TerrainTile[]
}

export function generateTerrain(seed: string, size = 64): TerrainSnapshot {
  const random = createSeededRandom(`terrain:${seed}`)
  const waterOnWest = random() >= 0.5
  const centerMin = Math.floor(size / 2) - 16
  const centerMax = centerMin + 31
  const tiles: TerrainTile[] = []

  for (let z = 0; z < size; z += 1) {
    for (let x = 0; x < size; x += 1) {
      const inCenter = x >= centerMin && x <= centerMax && z >= centerMin && z <= centerMax
      const wave = Math.sin((x + 7) * 0.23) + Math.cos((z - 3) * 0.19) + Math.sin((x + z) * 0.11)
      const height = inCenter ? Math.max(1, Math.min(2, Math.round(1.5 + wave * 0.12))) : Math.max(0, Math.round(2 + wave * 0.72))
      const water = waterOnWest
        ? x < 8 + Math.round(Math.sin(z * 0.22) * 2)
        : z < 8 + Math.round(Math.sin(x * 0.22) * 2)
      const roll = random()
      const biome: TerrainBiome = water
        ? 'water'
        : roll > 0.965
          ? 'stone'
          : roll > 0.88 && !inCenter
            ? 'forest'
            : roll > 0.22
              ? 'grass'
              : 'earth'

      tiles.push({
        x,
        z,
        height: water ? 0 : height,
        biome,
        buildable: !water && (inCenter || (biome !== 'forest' && biome !== 'stone' && height <= 3)),
      })
    }
  }

  return { seed, size, tiles }
}
