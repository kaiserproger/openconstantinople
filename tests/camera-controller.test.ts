import * as THREE from 'three'
import { CameraController } from '../src/renderer/CameraController'

it('rotates in exact quarter turns and clamps zoom', () => {
  const controller = new CameraController(new THREE.OrthographicCamera(), { width: 1600, height: 900 })
  controller.rotateQuarter(1)
  controller.zoomBy(100)
  expect(controller.snapshot()).toMatchObject({ quarter: 1, zoom: 2.2 })
})

it('normalizes negative quarter turns and preserves its target', () => {
  const controller = new CameraController(new THREE.OrthographicCamera(), { width: 1280, height: 720 })
  controller.pan(4, -3)
  controller.rotateQuarter(-1)
  expect(controller.snapshot()).toMatchObject({ quarter: 3, targetX: 36, targetZ: 29 })
})
