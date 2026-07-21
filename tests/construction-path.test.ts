import { straightPath } from '../src/game/constructionPath'

describe('straightPath', () => {
  it('locks a drag to its dominant axis', () => {
    expect(straightPath({ x: 10, y: 10 }, { x: 14, y: 12 })).toEqual([
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 10 },
      { x: 13, y: 10 },
      { x: 14, y: 10 },
    ])
  })

  it('builds a vertical section in either drag direction', () => {
    expect(straightPath({ x: 8, y: 12 }, { x: 7, y: 9 })).toEqual([
      { x: 8, y: 12 },
      { x: 8, y: 11 },
      { x: 8, y: 10 },
      { x: 8, y: 9 },
    ])
  })
})
