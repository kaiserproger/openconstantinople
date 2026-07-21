import * as THREE from 'three'
import { PickingController } from '../src/renderer/PickingController'

describe('PickingController', () => {
  it('raycasts invisible building volumes without adding visible geometry', () => {
    const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100)
    camera.position.set(0, 10, 0)
    camera.lookAt(0, 0, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const material = new THREE.MeshBasicMaterial({ visible: false })
    const building = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material)
    building.userData.buildingId = 42
    building.updateMatrixWorld()

    const hit = new PickingController(camera).pickObject(50, 50, new DOMRect(0, 0, 100, 100), [building])

    expect(hit?.userData.buildingId).toBe(42)
    expect(material.visible).toBe(false)
  })
})
