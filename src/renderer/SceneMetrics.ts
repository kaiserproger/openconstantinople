import type * as THREE from 'three'

export interface SceneMetricsSnapshot {
  averageFps: number
  p95FrameMs: number
  drawCalls: number
  triangles: number
  visibleUnits: number
}

declare global {
  interface Window {
    __OPENFRONT_METRICS__?: SceneMetricsSnapshot
  }
}

export class SceneMetrics {
  private readonly samples: number[] = []
  private previous = performance.now()

  constructor(private readonly renderer: THREE.WebGLRenderer) {}

  sample(now: number, visibleUnits: number): SceneMetricsSnapshot {
    const delta = Math.max(0.1, now - this.previous)
    this.previous = now
    this.samples.push(delta)
    if (this.samples.length > 180) this.samples.shift()
    const sorted = [...this.samples].sort((a, b) => a - b)
    const mean = this.samples.reduce((sum, item) => sum + item, 0) / this.samples.length
    return {
      averageFps: 1000 / mean,
      p95FrameMs: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? delta,
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles,
      visibleUnits,
    }
  }
}
