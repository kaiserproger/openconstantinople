import * as THREE from 'three'
import type { Building } from '../game/simulation'
import { byzantineMacedonian } from '../presets'
import { generateBuilding } from '../voxel/buildings'
import { generateTerrain } from '../voxel/terrain'
import type { VoxelModel } from '../voxel/types'
import { CameraController } from './CameraController'
import { PickingController } from './PickingController'
import { VoxelBatch } from './VoxelBatch'

const MAX_PIXEL_RATIO = 1.5

function terrainModel(seed: string): VoxelModel {
  const terrain = generateTerrain(seed)
  const voxels: VoxelModel['voxels'] = []
  for (const tile of terrain.tiles) {
    const material = tile.biome === 'stone' ? 'marble' : tile.biome === 'forest' ? 'grass' : tile.biome
    const height = tile.biome === 'water' ? 0.28 : Math.max(0.75, tile.height)
    voxels.push({ x: tile.x, y: height / 2 - 0.5, z: tile.z, material, scale: [1.02, height, 1.02] })
    if (tile.biome === 'forest' && (tile.x + tile.z) % 2 === 0) {
      voxels.push({ x: tile.x, y: tile.height + 0.45, z: tile.z, material: 'timber', scale: [0.35, 1.9, 0.35] })
      voxels.push({ x: tile.x, y: tile.height + 1.9, z: tile.z, material: 'foliage', scale: [1.7, 1.4, 1.7] })
      voxels.push({ x: tile.x, y: tile.height + 2.85, z: tile.z, material: 'foliage', scale: [1.15, 1.1, 1.15] })
    }
  }
  return { id: `terrain:${seed}`, footprint: [64, 64], anchor: [32, 0, 32], voxels }
}

function unitModel(side: 'friendly' | 'enemy', count: number): VoxelModel {
  const material = side === 'friendly' ? 'porphyry' : 'iron'
  const originX = side === 'friendly' ? 35 : 47
  const originZ = side === 'friendly' ? 24 : 16
  const voxels: VoxelModel['voxels'] = []
  for (let index = 0; index < count; index += 1) {
    const column = index % 25
    const row = Math.floor(index / 25)
    const x = originX + column * 0.52
    const z = originZ + row * 0.58
    voxels.push({ x, y: 2.25, z, material, scale: [0.28, 1.25, 0.28] })
    voxels.push({ x, y: 3.05, z, material: side === 'friendly' ? 'gold' : 'roof', scale: [0.38, 0.38, 0.38] })
  }
  return { id: `army:${side}`, footprint: [1, 1], anchor: [0, 0, 0], voxels }
}

export class WorldRenderer {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera()
  private readonly renderer: THREE.WebGLRenderer
  private readonly cameraController: CameraController
  private readonly picking: PickingController
  private worldMeshes: THREE.InstancedMesh[] = []
  private readonly preview: THREE.Mesh
  private animationFrame = 0
  private seed = ''
  private buildings: Building[] = []
  private battleVisible = false
  private stressMode = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x8f805f, 1)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.scene.background = new THREE.Color(0x8d805f)
    this.scene.fog = new THREE.FogExp2(0xa99a75, 0.011)

    const hemisphere = new THREE.HemisphereLight(0xffe9c3, 0x30243c, 2.2)
    this.scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(0xffd59b, 3.7)
    sun.position.set(-32, 70, -24)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -50
    sun.shadow.camera.right = 50
    sun.shadow.camera.top = 50
    sun.shadow.camera.bottom = -50
    this.scene.add(sun)

    this.cameraController = new CameraController(this.camera, { width: 1, height: 1 })
    this.picking = new PickingController(this.camera)
    this.preview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xd3aa55, transparent: true, opacity: 0.48, depthWrite: false }),
    )
    this.preview.visible = false
    this.preview.renderOrder = 20
    this.scene.add(this.preview)
    this.resize()
    this.animate()
  }

  setWorld(seed: string, buildings: Building[], battleVisible: boolean, stressMode: boolean): void {
    const buildingsChanged = this.buildings.length !== buildings.length
      || this.buildings.some((building, index) => building.id !== buildings[index]?.id)
    if (this.seed === seed && !buildingsChanged && this.battleVisible === battleVisible && this.stressMode === stressMode) return
    this.seed = seed
    this.buildings = buildings.map((building) => ({ ...building }))
    this.battleVisible = battleVisible
    this.stressMode = stressMode
    this.rebuild()
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1)
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 1)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO))
    this.renderer.setSize(width, height, false)
    this.cameraController.resize({ width, height })
  }

  pickGrid(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } | null {
    return this.picking.pick(clientX, clientY, bounds)
  }

  showPreview(kind: Building['kind'], point: { x: number; y: number }): boolean {
    const valid = !this.buildings.some((building) => building.x === point.x && building.y === point.y)
    const model = generateBuilding(kind, `preview:${kind}`, byzantineMacedonian)
    const height = Math.max(0.22, ...model.voxels.map((voxel) => voxel.y + (voxel.scale?.[1] ?? 1) / 2))
    this.preview.position.set(point.x, 1.5 + height / 2, point.y)
    this.preview.scale.set(Math.max(1, model.footprint[0] - 0.35), height, Math.max(1, model.footprint[1] - 0.35))
    const material = this.preview.material as THREE.MeshBasicMaterial
    material.color.setHex(valid ? 0xd3aa55 : 0xb84e52)
    material.opacity = valid ? 0.32 : 0.45
    this.preview.visible = true
    return valid
  }

  hidePreview(): void {
    this.preview.visible = false
  }

  pan(deltaX: number, deltaZ: number): void {
    this.cameraController.pan(deltaX, deltaZ)
  }

  zoom(delta: number): void {
    this.cameraController.zoomBy(delta)
  }

  rotateQuarter(delta: number): void {
    this.cameraController.rotateQuarter(delta)
  }

  cameraSnapshot() {
    return this.cameraController.snapshot()
  }

  restoreCamera(snapshot: ReturnType<CameraController['snapshot']>): void {
    this.cameraController.restore(snapshot)
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame)
    this.disposeWorld()
    this.preview.geometry.dispose()
    ;(this.preview.material as THREE.Material).dispose()
    this.renderer.dispose()
  }

  private rebuild(): void {
    this.disposeWorld()
    const batch = new VoxelBatch()
    batch.add(terrainModel(this.seed))
    for (const building of this.buildings) {
      const model = generateBuilding(building.kind, `${this.seed}:${building.id}`, byzantineMacedonian)
      batch.add(model, new THREE.Vector3(building.x - model.anchor[0], 1.5, building.y - model.anchor[2]))
    }
    if (this.battleVisible) {
      const count = this.stressMode ? 150 : 18
      batch.add(unitModel('friendly', count))
      batch.add(unitModel('enemy', count))
    }
    this.worldMeshes = batch.commit(this.scene)
  }

  private disposeWorld(): void {
    for (const mesh of this.worldMeshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => material.dispose())
    }
    this.worldMeshes = []
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate)
    this.renderer.render(this.scene, this.camera)
  }
}
