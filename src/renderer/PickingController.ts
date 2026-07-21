import * as THREE from 'three'

export class PickingController {
  private readonly raycaster = new THREE.Raycaster()
  private readonly pointer = new THREE.Vector2()
  private readonly ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)

  constructor(private readonly camera: THREE.Camera) {}

  private setRay(clientX: number, clientY: number, bounds: DOMRect): boolean {
    if (!bounds.width || !bounds.height) return false
    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return true
  }

  pick(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } | null {
    if (!this.setRay(clientX, clientY, bounds)) return null
    const hit = new THREE.Vector3()
    if (!this.raycaster.ray.intersectPlane(this.ground, hit)) return null
    return {
      x: THREE.MathUtils.clamp(Math.round(hit.x), 0, 63),
      y: THREE.MathUtils.clamp(Math.round(hit.z), 0, 63),
    }
  }

  pickObject(clientX: number, clientY: number, bounds: DOMRect, objects: THREE.Object3D[]): THREE.Object3D | null {
    if (!this.setRay(clientX, clientY, bounds)) return null
    return this.raycaster.intersectObjects(objects, false)[0]?.object ?? null
  }
}
