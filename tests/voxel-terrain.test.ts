import { generateTerrain } from '../src/voxel/terrain'

it('generates the same coastal terrain from the same seed', () => {
  expect(generateTerrain('coast-17', 48)).toEqual(generateTerrain('coast-17', 48))
})

it('keeps a buildable center and water on an outer edge', () => {
  const terrain = generateTerrain('coast-17', 48)
  expect(terrain.tiles.filter((tile) => tile.buildable).length).toBeGreaterThan(900)
  expect(terrain.tiles.some((tile) => tile.biome === 'water' && (tile.x < 5 || tile.z < 5))).toBe(true)
})
