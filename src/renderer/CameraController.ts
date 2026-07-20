import * as THREE from 'three'

export interface CameraViewport {
  width: number
  height: number
}

export interface CameraSnapshot {
  targetX: number
  targetZ: number
  zoom: number
  quarter: number
}

const MIN_ZOOM = 0.65
const MAX_ZOOM = 2.2
const ELEVATION = THREE.MathUtils.degToRad(35.264)
const DISTANCE = 86

export class CameraController {
  private targetX = 32
  private targetZ = 32
  private zoom = 1
  private quarter = 0
  private viewport: CameraViewport

  constructor(
    private readonly camera: THREE.OrthographicCamera,
    viewport: CameraViewport,
  ) {
    this.viewport = viewport
    this.updateProjection()
    this.updateTransform()
  }

  pan(deltaX: number, deltaZ: number): void {
    this.targetX += deltaX
    this.targetZ += deltaZ
    this.updateTransform()
  }

  zoomBy(delta: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom + delta * 0.02, MIN_ZOOM, MAX_ZOOM)
    this.updateProjection()
  }

  rotateQuarter(delta: number): void {
    this.quarter = ((this.quarter + delta) % 4 + 4) % 4
    this.updateTransform()
  }

  resize(viewport: CameraViewport): void {
    this.viewport = viewport
    this.updateProjection()
  }

  snapshot(): CameraSnapshot {
    return { targetX: this.targetX, targetZ: this.targetZ, zoom: this.zoom, quarter: this.quarter }
  }

  restore(snapshot: CameraSnapshot): void {
    this.targetX = snapshot.targetX
    this.targetZ = snapshot.targetZ
    this.zoom = THREE.MathUtils.clamp(snapshot.zoom, MIN_ZOOM, MAX_ZOOM)
    this.quarter = ((snapshot.quarter % 4) + 4) % 4
    this.updateProjection()
    this.updateTransform()
  }

  private updateProjection(): void {
    const aspect = Math.max(1, this.viewport.width) / Math.max(1, this.viewport.height)
    const halfHeight = 28 / this.zoom
    this.camera.left = -halfHeight * aspect
    this.camera.right = halfHeight * aspect
    this.camera.top = halfHeight
    this.camera.bottom = -halfHeight
    this.camera.near = 0.1
    this.camera.far = 300
    this.camera.updateProjectionMatrix()
  }

  private updateTransform(): void {
    const azimuth = THREE.MathUtils.degToRad(45 + this.quarter * 90)
    const horizontal = Math.cos(ELEVATION) * DISTANCE
    this.camera.position.set(
      this.targetX + Math.cos(azimuth) * horizontal,
      Math.sin(ELEVATION) * DISTANCE,
      this.targetZ + Math.sin(azimuth) * horizontal,
    )
    this.camera.lookAt(this.targetX, 0, this.targetZ)
  }
}
