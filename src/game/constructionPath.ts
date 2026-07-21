import type { Point } from './simulation'

export function straightPath(from: Point, to: Point): Point[] {
  const horizontal = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y)
  const end = horizontal ? { x: to.x, y: from.y } : { x: from.x, y: to.y }
  const stepX = Math.sign(end.x - from.x)
  const stepY = Math.sign(end.y - from.y)
  const length = Math.max(Math.abs(end.x - from.x), Math.abs(end.y - from.y))

  return Array.from({ length: length + 1 }, (_, index) => ({
    x: from.x + stepX * index,
    y: from.y + stepY * index,
  }))
}
