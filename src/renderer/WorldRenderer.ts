import * as THREE from 'three'
import { canPlaceAt, type Building } from '../game/simulation'
import { byzantineMacedonian } from '../presets'
import { generateBuilding } from '../voxel/buildings'
import { generateTerrain } from '../voxel/terrain'
import type { VoxelModel } from '../voxel/types'
import { generateUnitModel } from '../voxel/units'
import { CameraController } from './CameraController'
import { PickingController } from './PickingController'
import { SceneMetrics } from './SceneMetrics'
import { VoxelBatch } from './VoxelBatch'

const MAX_PIXEL_RATIO = 1.5
const BATTLE_PIXEL_RATIO = 1
const STRESS_BATTLE_PIXEL_RATIO = 0.36
const MAX_PATH_PREVIEW = 64
const BATTLE_DURATION_MS = 4600

function terrainModel(seed: string, tactical = false): VoxelModel {
  const terrain = generateTerrain(seed)
  if (tactical) {
    const water = terrain.tiles
      .filter((tile) => tile.biome === 'water')
      .map((tile) => ({ x: tile.x, y: -0.02, z: tile.z, material: 'water' as const, scale: [1.04, 0.34, 1.04] as [number, number, number] }))
    return {
      id: `terrain:${seed}:tactical`,
      footprint: [64, 64],
      anchor: [32, 0, 32],
      voxels: [
        { x: 31.5, y: -0.48, z: 31.5, material: 'grass', scale: [64, 1, 64] },
        ...water,
      ],
    }
  }
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

function fireModel(seed: number): VoxelModel {
  const offset = (seed % 3) * 0.12
  return {
    id: `fire:${seed}`,
    footprint: [1, 1],
    anchor: [0, 0, 0],
    voxels: [
      { x: -0.22, y: 0.42, z: 0.12, material: 'fire', scale: [0.42, 0.84, 0.42] },
      { x: 0.2, y: 0.58 + offset, z: -0.1, material: 'fire', scale: [0.36, 1.15, 0.36] },
      { x: 0, y: 1.08, z: 0, material: 'gold', scale: [0.22, 0.72, 0.22] },
    ],
  }
}

function tacticalBuildingModel(kind: Building['kind'], source: VoxelModel): VoxelModel {
  const [width, depth] = source.footprint
  const x = (width - 1) / 2
  const z = (depth - 1) / 2
  const model = (voxels: VoxelModel['voxels']): VoxelModel => ({ ...source, voxels })
  if (kind === 'road') return model([{ x, y: 0, z, material: 'marble', scale: [0.92, 0.16, 0.92] }])
  if (kind === 'wall') return model([{ x, y: 1.7, z, material: 'marble', scale: [0.96, 3.4, 0.96] }])
  if (kind === 'farm') return model([
    { x, y: 0, z, material: 'earth', scale: [width - 0.3, 0.18, depth - 0.3] },
    { x: 1.5, y: 0.35, z, material: 'gold', scale: [0.65, 0.45, depth - 1] },
    { x: width - 1.5, y: 1.25, z: depth - 1.4, material: 'roof', scale: [2.2, 2.4, 1.8] },
  ])
  if (kind === 'watchtower') return model([
    { x, y: 3.8, z, material: 'marble', scale: [3.3, 7.6, 3.3] },
    { x, y: 8.1, z, material: 'gold', scale: [3.7, 0.7, 3.7] },
  ])
  if (kind === 'townHall') return model([
    { x, y: 1.7, z, material: 'brick', scale: [width - 0.8, 3.4, depth - 0.8] },
    { x, y: 4.4, z, material: 'marble', scale: [4.8, 5.2, 4.5] },
    { x, y: 7.5, z, material: 'porphyry', scale: [4.2, 1.7, 4.2] },
    { x, y: 8.6, z, material: 'gold', scale: [1.1, 1.1, 1.1] },
  ])
  const bodyMaterial = kind === 'lumberCamp' ? 'timber' : kind === 'quarry' || kind === 'granary' ? 'marble' : 'brick'
  const accentMaterial = kind === 'granary' ? 'gold' : kind === 'smithy' ? 'iron' : kind === 'market' || kind === 'barracks' ? 'porphyry' : 'roof'
  const bodyHeight = kind === 'barracks' || kind === 'granary' ? 3.8 : 3
  return model([
    { x, y: bodyHeight / 2, z, material: bodyMaterial, scale: [Math.max(2, width - 1.2), bodyHeight, Math.max(2, depth - 1.2)] },
    { x, y: bodyHeight + 0.7, z, material: accentMaterial, scale: [Math.max(2.2, width - 0.8), 1.15, Math.max(2.2, depth - 0.8)] },
    { x: x + width * 0.25, y: bodyHeight + 1.8, z, material: accentMaterial, scale: [0.5, 2.4, 0.5] },
  ])
}

export interface BattleRenderUnit {
  id: number
  kind: 'militia' | 'retinue' | 'raider'
  faction: 'friendly' | 'enemy'
  x: number
  z: number
  morale: number
}

export interface BattleRenderSnapshot { units: BattleRenderUnit[] }

export class WorldRenderer {
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.OrthographicCamera()
  private readonly renderer: THREE.WebGLRenderer
  private readonly cameraController: CameraController
  private readonly picking: PickingController
  private readonly metrics: SceneMetrics
  private worldMeshes: THREE.InstancedMesh[] = []
  private battleMeshes: THREE.InstancedMesh[] = []
  private friendlyFormation: THREE.Group | null = null
  private enemyFormation: THREE.Group | null = null
  private readonly preview: THREE.Mesh
  private readonly pathPreview: THREE.InstancedMesh
  private readonly commandMarker: THREE.Mesh
  private readonly pickerGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly pickerMaterial = new THREE.MeshBasicMaterial({ visible: false })
  private readonly selectionOutline: THREE.LineSegments
  private buildingPickers: THREE.Mesh[] = []
  private selectedBuildingId: number | null = null
  private animationFrame = 0
  private needsRender = true
  private seed = ''
  private buildings: Building[] = []
  private battleVisible = false
  private battleOutcome: 'victory' | 'defeat' | null = null
  private battleStartedAt = 0
  private battleCommandPoint: { x: number; y: number } | null = null
  private burningBuildingIds: number[] = []
  private stressMode = false
  private visibleUnits = 0
  private paused = false

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x4b3d4f, 1)
    this.renderer.shadowMap.enabled = false
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.08
    this.scene.background = new THREE.Color(0x4b3d4f)
    this.scene.fog = new THREE.FogExp2(0x75677a, 0.0022)

    const hemisphere = new THREE.HemisphereLight(0xffecd0, 0x281a34, 1.45)
    this.scene.add(hemisphere)
    const sun = new THREE.DirectionalLight(0xffd3a0, 4.8)
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
    this.metrics = new SceneMetrics(this.renderer)
    this.preview = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xd3aa55, transparent: true, opacity: 0.48, depthWrite: false }),
    )
    this.preview.visible = false
    this.preview.renderOrder = 20
    this.scene.add(this.preview)
    this.pathPreview = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xffd66b, transparent: true, opacity: 0.84, depthTest: false, depthWrite: false }),
      MAX_PATH_PREVIEW,
    )
    this.pathPreview.count = 0
    this.pathPreview.visible = false
    this.pathPreview.renderOrder = 21
    this.scene.add(this.pathPreview)
    this.commandMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.05, 20),
      new THREE.MeshBasicMaterial({ color: 0xf2c65d, transparent: true, opacity: 0.92, depthTest: false, side: THREE.DoubleSide }),
    )
    this.commandMarker.rotation.x = -Math.PI / 2
    this.commandMarker.visible = false
    this.commandMarker.renderOrder = 25
    this.scene.add(this.commandMarker)
    const outlineSource = new THREE.BoxGeometry(1, 1, 1)
    this.selectionOutline = new THREE.LineSegments(
      new THREE.EdgesGeometry(outlineSource),
      new THREE.LineBasicMaterial({ color: 0xf2c65d, depthTest: false, transparent: true, opacity: 0.95 }),
    )
    outlineSource.dispose()
    this.selectionOutline.visible = false
    this.selectionOutline.renderOrder = 30
    this.scene.add(this.selectionOutline)
    this.resize()
    this.animate()
  }

  setWorld(
    seed: string,
    buildings: Building[],
    battleVisible: boolean,
    stressMode: boolean,
    battleOutcome: 'victory' | 'defeat' | null,
    burningBuildingIds: number[],
  ): void {
    const buildingsChanged = this.buildings.length !== buildings.length
      || this.buildings.some((building, index) => {
        const next = buildings[index]
        return building.id !== next?.id || building.health !== next.health || building.progress !== next.progress
      })
    const firesChanged = this.burningBuildingIds.join(',') !== burningBuildingIds.join(',')
    if (this.seed === seed && !buildingsChanged && this.battleVisible === battleVisible && this.stressMode === stressMode
      && this.battleOutcome === battleOutcome && !firesChanged) return
    const battleVisibilityChanged = battleVisible !== this.battleVisible
    const battleStarted = battleVisible && !this.battleVisible
    this.seed = seed
    this.buildings = buildings.map((building) => ({ ...building }))
    this.battleVisible = battleVisible
    this.stressMode = stressMode
    this.battleOutcome = battleOutcome
    this.burningBuildingIds = [...burningBuildingIds]
    if (battleStarted) this.battleStartedAt = performance.now()
    if (battleVisibilityChanged) this.resize()
    this.rebuild()
    this.invalidate()
  }

  resize(): void {
    const width = Math.max(1, this.canvas.clientWidth || this.canvas.width || 1)
    const height = Math.max(1, this.canvas.clientHeight || this.canvas.height || 1)
    const pixelRatioCap = this.battleVisible
      ? this.stressMode ? STRESS_BATTLE_PIXEL_RATIO : BATTLE_PIXEL_RATIO
      : MAX_PIXEL_RATIO
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap))
    this.renderer.setSize(width, height, false)
    this.cameraController.resize({ width, height })
    this.invalidate()
  }

  pickGrid(clientX: number, clientY: number, bounds: DOMRect): { x: number; y: number } | null {
    return this.picking.pick(clientX, clientY, bounds)
  }

  pickBuilding(clientX: number, clientY: number, bounds: DOMRect): number | null {
    const hit = this.picking.pickObject(clientX, clientY, bounds, this.buildingPickers)
    return typeof hit?.userData.buildingId === 'number' ? hit.userData.buildingId : null
  }

  setSelectedBuilding(buildingId: number | null): void {
    this.selectedBuildingId = buildingId
    const picker = buildingId === null
      ? undefined
      : this.buildingPickers.find((item) => item.userData.buildingId === buildingId)
    if (!picker) {
      this.selectionOutline.visible = false
      this.invalidate()
      return
    }
    this.selectionOutline.position.copy(picker.position)
    this.selectionOutline.scale.copy(picker.scale).multiplyScalar(1.04)
    this.selectionOutline.visible = true
    this.selectionOutline.updateMatrixWorld()
    this.invalidate()
  }

  commandBattle(point: { x: number; y: number } | null): void {
    this.battleCommandPoint = point ? { ...point } : null
    this.commandMarker.visible = Boolean(point) && this.battleVisible
    if (point) this.commandMarker.position.set(point.x, 2.05, point.y)
    this.invalidate()
  }

  showPreview(kind: Building['kind'], point: { x: number; y: number }): boolean {
    this.pathPreview.visible = false
    const valid = this.canPlace(kind, point)
    const model = generateBuilding(kind, `preview:${kind}`, byzantineMacedonian)
    const height = Math.max(0.22, ...model.voxels.map((voxel) => voxel.y + (voxel.scale?.[1] ?? 1) / 2))
    this.preview.position.set(point.x, 1.5 + height / 2, point.y)
    this.preview.scale.set(Math.max(1, model.footprint[0] - 0.35), height, Math.max(1, model.footprint[1] - 0.35))
    const material = this.preview.material as THREE.MeshBasicMaterial
    material.color.setHex(valid ? 0xd3aa55 : 0xb84e52)
    material.opacity = valid ? 0.32 : 0.45
    this.preview.visible = true
    this.invalidate()
    return valid
  }

  showPathPreview(kind: 'road' | 'wall', points: Array<{ x: number; y: number }>): boolean {
    this.preview.visible = false
    const visiblePoints = points.slice(0, MAX_PATH_PREVIEW)
    const valid = visiblePoints.every((point) => this.canPlace(kind, point))
    const model = generateBuilding(kind, `path-preview:${kind}`, byzantineMacedonian)
    const height = Math.max(0.16, ...model.voxels.map((voxel) => voxel.y + (voxel.scale?.[1] ?? 1) / 2))
    const matrix = new THREE.Matrix4()
    const quaternion = new THREE.Quaternion()
    const scale = new THREE.Vector3(0.78, Math.max(0.28, height), 0.78)
    visiblePoints.forEach((point, index) => {
      matrix.compose(new THREE.Vector3(point.x, 1.5 + height / 2, point.y), quaternion, scale)
      this.pathPreview.setMatrixAt(index, matrix)
    })
    this.pathPreview.count = visiblePoints.length
    this.pathPreview.instanceMatrix.needsUpdate = true
    this.pathPreview.computeBoundingSphere()
    ;(this.pathPreview.material as THREE.MeshBasicMaterial).color.setHex(valid ? 0xffd66b : 0xff6470)
    this.pathPreview.visible = visiblePoints.length > 0
    this.invalidate()
    return valid
  }

  hidePreview(): void {
    this.preview.visible = false
    this.pathPreview.visible = false
    this.invalidate()
  }

  pan(deltaX: number, deltaZ: number): void {
    this.cameraController.pan(deltaX, deltaZ)
    this.invalidate()
  }

  zoom(delta: number): void {
    this.cameraController.zoomBy(delta)
    this.invalidate()
  }

  rotateQuarter(delta: number): void {
    this.cameraController.rotateQuarter(delta)
    this.invalidate()
  }

  cameraSnapshot() {
    return this.cameraController.snapshot()
  }

  restoreCamera(snapshot: ReturnType<CameraController['snapshot']>): void {
    this.cameraController.restore(snapshot)
    this.invalidate()
  }

  pause(): void {
    this.paused = true
  }

  requestRecovery(): void {
    this.renderer.forceContextRestore()
  }

  recover(): void {
    this.paused = false
    this.rebuild()
    this.invalidate()
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrame)
    this.disposeWorld()
    this.preview.geometry.dispose()
    ;(this.preview.material as THREE.Material).dispose()
    this.pathPreview.geometry.dispose()
    ;(this.pathPreview.material as THREE.Material).dispose()
    this.commandMarker.geometry.dispose()
    ;(this.commandMarker.material as THREE.Material).dispose()
    this.pickerGeometry.dispose()
    this.pickerMaterial.dispose()
    this.selectionOutline.geometry.dispose()
    ;(this.selectionOutline.material as THREE.Material).dispose()
    this.renderer.dispose()
  }

  private rebuild(): void {
    this.disposeWorld()
    const batch = new VoxelBatch()
    batch.add(terrainModel(this.seed, this.battleVisible && this.stressMode))
    for (const building of this.buildings) {
      const detailedModel = generateBuilding(building.kind, `${this.seed}:${building.id}`, byzantineMacedonian)
      const model = this.battleVisible && this.stressMode
        ? tacticalBuildingModel(building.kind, detailedModel)
        : detailedModel
      batch.add(model, new THREE.Vector3(building.x - model.anchor[0], 1.5, building.y - model.anchor[2]))
      const height = Math.max(0.22, ...model.voxels.map((voxel) => voxel.y + (voxel.scale?.[1] ?? 1) / 2))
      if (this.burningBuildingIds.includes(building.id)) {
        batch.add(fireModel(building.id), new THREE.Vector3(building.x, 1.5 + height, building.y))
      }
      const picker = new THREE.Mesh(this.pickerGeometry, this.pickerMaterial)
      picker.position.set(building.x, 1.5 + height / 2, building.y)
      picker.scale.set(Math.max(0.8, model.footprint[0]), height, Math.max(0.8, model.footprint[1]))
      picker.userData.buildingId = building.id
      picker.updateMatrixWorld()
      this.buildingPickers.push(picker)
      this.scene.add(picker)
    }
    this.worldMeshes = this.battleVisible ? batch.commitBattle(this.scene) : batch.commit(this.scene)
    if (this.battleVisible) this.rebuildBattle()
    else this.visibleUnits = 0
    this.setSelectedBuilding(this.selectedBuildingId)
  }

  private rebuildBattle(): void {
    const count = this.stressMode ? 150 : 24
    const columns = this.stressMode ? 15 : 6
    const spacing = this.stressMode ? 0.7 : 1.05
    const rows = Math.ceil(count / columns)
    const friendlyBatch = new VoxelBatch()
    const enemyBatch = new VoxelBatch()
    for (let index = 0; index < count; index += 1) {
      const column = index % columns
      const row = Math.floor(index / columns)
      const origin = new THREE.Vector3(column * spacing, 0, (row - (rows - 1) / 2) * spacing)
      friendlyBatch.add(generateUnitModel(index % 5 === 0 ? 'retinue' : 'militia', 'friendly', this.stressMode), origin)
      enemyBatch.add(generateUnitModel('raider', 'enemy', this.stressMode), origin)
    }
    this.friendlyFormation = new THREE.Group()
    this.enemyFormation = new THREE.Group()
    this.battleMeshes = [
      ...friendlyBatch.commitBattle(this.friendlyFormation, 'porphyry'),
      ...enemyBatch.commitBattle(this.enemyFormation, 'fire'),
    ]
    this.scene.add(this.friendlyFormation, this.enemyFormation)
    this.visibleUnits = count * 2
    this.updateBattle(performance.now())
  }

  private updateBattle(now: number): void {
    if (!this.battleVisible || !this.friendlyFormation || !this.enemyFormation) return
    const duration = this.stressMode ? 7600 : BATTLE_DURATION_MS
    const progress = THREE.MathUtils.clamp((now - this.battleStartedAt) / duration, 0, 1)
    const approach = THREE.MathUtils.smoothstep(progress, 0, 0.5)
    const aftermath = this.battleOutcome ? THREE.MathUtils.smoothstep(progress, 0.68, 1) : 0
    const clash = progress > 0.42 && progress < 0.72 ? Math.sin(progress * 95) * 0.16 : 0

    const targetX = this.battleCommandPoint ? this.battleCommandPoint.x - 2.5 : 33
    const targetZ = this.battleCommandPoint?.y ?? 36
    this.friendlyFormation.position.set(
      THREE.MathUtils.lerp(20, targetX, approach) + aftermath * 2,
      1.5 + Math.abs(clash),
      THREE.MathUtils.lerp(36, targetZ, approach),
    )
    const enemyRetreatX = this.battleOutcome === 'victory' ? 13 : -10
    this.enemyFormation.position.set(48 - approach * 12 + aftermath * enemyRetreatX, 1.5 + Math.abs(clash), 36)
    if (this.commandMarker.visible) {
      const pulse = 1 + Math.sin(now * 0.009) * 0.12
      this.commandMarker.scale.setScalar(pulse)
    }
    if (progress < 1) this.needsRender = true
  }

  private disposeWorld(): void {
    for (const mesh of this.worldMeshes) {
      this.scene.remove(mesh)
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => material.dispose())
    }
    this.worldMeshes = []
    if (this.friendlyFormation) this.scene.remove(this.friendlyFormation)
    if (this.enemyFormation) this.scene.remove(this.enemyFormation)
    for (const mesh of this.battleMeshes) {
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => material.dispose())
    }
    this.battleMeshes = []
    this.friendlyFormation = null
    this.enemyFormation = null
    for (const picker of this.buildingPickers) this.scene.remove(picker)
    this.buildingPickers = []
  }

  private canPlace(kind: Building['kind'], point: { x: number; y: number }): boolean {
    return canPlaceAt(this.buildings, kind, point)
  }

  private invalidate(): void {
    this.needsRender = true
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate)
    if (this.battleVisible) this.updateBattle(performance.now())
    if (this.needsRender && !this.paused) {
      this.renderer.render(this.scene, this.camera)
      this.needsRender = false
    }
    const snapshot = this.metrics.sample(performance.now(), this.visibleUnits)
    if (this.stressMode) window.__OPENFRONT_METRICS__ = snapshot
  }
}
