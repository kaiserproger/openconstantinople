import * as THREE from 'three'

export class PickingController {
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  constructor(private readonly camera: THREE.Camera) {}

  pick(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } | null {
    if (!bounds.width || !bounds.height) return null
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null
    return {
      x: THREE.MathUtils.clamp(Math.round(hit.x), 0, 63),
      y: THREE.MathUtils.clamp(Math.round(hit.z), 0, 63),
    }
  }
}
