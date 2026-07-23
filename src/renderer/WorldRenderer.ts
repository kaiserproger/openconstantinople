import * as THREE from 'three'
import { campaignProvinceCenter, type CampaignMarch, type CampaignState, type Province } from '../game/campaign'
import { canPlaceAt, type Building } from '../game/simulation'
import { createBattleFormations, type BattleFormation, type FormationKind, type FormationShape } from '../game/tactics'
import { byzantineMacedonian } from '../presets'
import { generateBuilding } from '../voxel/buildings'
import { generateTerrain } from '../voxel/terrain'
import type { VoxelModel } from '../voxel/types'
import { generateUnitModel, type UnitKind } from '../voxel/units'
import { CameraController } from './CameraController'
import { PickingController } from './PickingController'
import { SceneMetrics } from './SceneMetrics'
import { VoxelBatch } from './VoxelBatch'

const MAX_PIXEL_RATIO = 1.5
const BATTLE_PIXEL_RATIO = 1
const STRESS_BATTLE_PIXEL_RATIO = 0.36
const MAX_PATH_PREVIEW = 64
const BATTLE_DURATION_MS = 4600

const REALM_MATERIAL: Record<string, 'porphyry' | 'brick' | 'grass'> = {
  imperial: 'porphyry',
  steppe: 'brick',
  danubian: 'grass',
}

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

function campaignModel(campaign: CampaignState): VoxelModel {
  const voxels: VoxelModel['voxels'] = [
    { x: 31.5, y: -0.45, z: 31.5, material: 'earth', scale: [66, 0.8, 66] },
  ]
  for (const province of campaign.provinces) {
    const center = campaignProvinceCenter(province)
    const mapStyle = campaign.realms.find((realm) => realm.id === province.owner)?.mapStyle
    const material = mapStyle ? REALM_MATERIAL[mapStyle] ?? 'porphyry' : 'earth'
    const height = 0.9 + province.cityLevel * 0.16 + (province.id % 3) * 0.06
    const isCapital = province.owner !== null && province.capitalOf === province.owner
    voxels.push({ x: center.x, y: height / 2, z: center.y, material, scale: [7.55, height, 7.55] })
    if (province.cityLevel > 0) {
      voxels.push(
        { x: center.x, y: height + 0.7, z: center.y, material: 'marble', scale: [1.8, 1.4, 1.8] },
        { x: center.x, y: height + 1.65, z: center.y, material: 'gold', scale: [2.2, 0.5, 2.2] },
      )
    }
    if (isCapital) {
      voxels.push(
        { x: center.x, y: height + 2.25, z: center.y, material: 'marble', scale: [1.05, 3.1, 1.05] },
        { x: center.x, y: height + 4.05, z: center.y, material: 'gold', scale: [1.65, 0.5, 1.65] },
        { x: center.x, y: height + 4.65, z: center.y, material: 'gold', scale: [0.36, 1.2, 0.36] },
      )
    }
    if (province.marketLevel > 0) {
      voxels.push(
        { x: center.x - 2.05, y: height + 0.42, z: center.y + 1.9, material: 'timber', scale: [1.9, 0.18, 1.5] },
        { x: center.x - 2.05, y: height + 0.72, z: center.y + 1.9, material: 'gold', scale: [2.1, 0.28, 1.7] },
      )
      if (province.marketLevel > 1) {
        voxels.push(
          { x: center.x - 2.72, y: height + 0.25, z: center.y + 1.9, material: 'timber', scale: [0.16, 0.72, 0.16] },
          { x: center.x - 1.38, y: height + 0.25, z: center.y + 1.9, material: 'timber', scale: [0.16, 0.72, 0.16] },
        )
      }
    }
    if (province.workshopLevel > 0) {
      voxels.push(
        { x: center.x + 2.05, y: height + 0.22, z: center.y + 1.9, material: 'timber', scale: [2.2, 0.24, 1.55] },
        { x: center.x + 2.05, y: height + 0.78, z: center.y + 1.9, material: 'iron', scale: [0.24, 1.25, 0.24] },
        { x: center.x + 2.05, y: height + 1.32, z: center.y + 1.9, material: 'timber', scale: [1.85, 0.2, 0.2] },
      )
      if (province.workshopLevel > 1) {
        voxels.push(
          { x: center.x + 1.35, y: height + 0.62, z: center.y + 1.9, material: 'iron', scale: [0.45, 0.45, 0.45] },
          { x: center.x + 2.75, y: height + 0.62, z: center.y + 1.9, material: 'iron', scale: [0.45, 0.45, 0.45] },
        )
      }
    }
    if (province.fortificationLevel > 0) {
      const wallHeight = 0.42 + province.fortificationLevel * 0.24
      for (const [offsetX, offsetZ] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
        voxels.push({
          x: center.x + offsetX,
          y: height + wallHeight / 2,
          z: center.y + offsetZ,
          material: 'marble',
          scale: [0.58, wallHeight, 0.58],
        })
      }
    }
    if (province.project) {
      voxels.push(
        { x: center.x - 1.25, y: height + 0.75, z: center.y - 1.25, material: 'timber', scale: [0.18, 1.5, 0.18] },
        { x: center.x + 1.25, y: height + 0.75, z: center.y - 1.25, material: 'timber', scale: [0.18, 1.5, 0.18] },
        { x: center.x, y: height + 1.35, z: center.y - 1.25, material: 'timber', scale: [2.7, 0.16, 0.16] },
      )
    }
    const levyHeight = Math.min(3.2, 0.35 + province.levies / 45)
    voxels.push({ x: center.x + 2.3, y: height + levyHeight / 2, z: center.y - 2.3, material: province.owner ? material : 'iron', scale: [0.35, levyHeight, 0.35] })
  }
  for (const route of campaign.tradeRoutes) {
    const source = campaign.provinces.find((province) => province.id === route.provinceIds[0])
    const target = campaign.provinces.find((province) => province.id === route.provinceIds[1])
    if (!source || !target) continue
    const start = campaignProvinceCenter(source)
    const end = campaignProvinceCenter(target)
    for (let step = 1; step <= 5; step += 1) {
      const progress = step / 6
      const x = THREE.MathUtils.lerp(start.x, end.x, progress)
      const z = THREE.MathUtils.lerp(start.y, end.y, progress)
      voxels.push(
        { x, y: 1.23, z, material: 'timber', scale: [0.72, 0.18, 0.72] },
        { x, y: 1.42, z, material: 'gold', scale: [0.38, 0.2, 0.38] },
      )
    }
  }
  for (const march of campaign.marches) {
    for (let index = 1; index < march.route.length; index += 1) {
      const source = campaign.provinces.find((province) => province.id === march.route[index - 1])
      const target = campaign.provinces.find((province) => province.id === march.route[index])
      if (!source || !target) continue
      const start = campaignProvinceCenter(source)
      const end = campaignProvinceCenter(target)
      const width = Math.max(0.24, Math.abs(end.x - start.x))
      const depth = Math.max(0.24, Math.abs(end.y - start.y))
      voxels.push(
        {
          x: (start.x + end.x) / 2,
          y: 1.34,
          z: (start.y + end.y) / 2,
          material: 'iron',
          scale: [width, 0.12, depth],
        },
        {
          x: (start.x + end.x) / 2,
          y: 1.43,
          z: (start.y + end.y) / 2,
          material: 'gold',
          scale: [Math.max(0.12, width - 0.08), 0.08, Math.max(0.12, depth - 0.08)],
        },
      )
    }
    for (const provinceId of march.route.slice(1, -1)) {
      const province = campaign.provinces.find((candidate) => candidate.id === provinceId)
      if (!province) continue
      const center = campaignProvinceCenter(province)
      voxels.push(
        { x: center.x, y: 1.56, z: center.y, material: 'iron', scale: [0.9, 0.18, 0.9] },
        { x: center.x, y: 1.72, z: center.y, material: 'gold', scale: [0.58, 0.14, 0.58] },
      )
    }
  }
  for (const siege of campaign.sieges) {
    const target = campaign.provinces.find((province) => province.id === siege.targetId)
    if (!target) continue
    const center = campaignProvinceCenter(target)
    const mapStyle = campaign.realms.find((realm) => realm.id === siege.attackerId)?.mapStyle
    const bannerMaterial = mapStyle ? REALM_MATERIAL[mapStyle] ?? 'porphyry' : 'porphyry'
    for (const [offsetX, offsetZ, turn] of [
      [-3.25, -0.9, 1],
      [3.25, 0.9, -1],
      [-0.9, 3.25, -1],
      [0.9, -3.25, 1],
    ] as const) {
      voxels.push(
        { x: center.x + offsetX, y: 1.02, z: center.y + offsetZ, material: 'timber', scale: [1.25, 0.22, 1.05] },
        { x: center.x + offsetX, y: 1.48, z: center.y + offsetZ, material: 'roof', scale: [1.05, 0.72, 0.85] },
        { x: center.x + offsetX + turn * 0.7, y: 1.45, z: center.y + offsetZ, material: bannerMaterial, scale: [0.16, 1.45, 0.16] },
      )
    }
    const progressHeight = 0.45 + siege.progress / 38
    voxels.push(
      { x: center.x + 2.55, y: 1.02, z: center.y - 2.55, material: 'fire', scale: [0.42, 0.78, 0.42] },
      { x: center.x + 2.55, y: 1.72, z: center.y - 2.55, material: 'gold', scale: [0.24, 0.52, 0.24] },
      { x: center.x - 2.55, y: progressHeight / 2 + 0.62, z: center.y + 2.55, material: 'gold', scale: [0.3, progressHeight, 0.3] },
    )
    for (let engine = 0; engine < (siege.engines ?? 0); engine += 1) {
      const engineX = center.x + (engine === 0 ? 1.35 : -1.35)
      voxels.push(
        { x: engineX, y: 1.02, z: center.y + 3.05, material: 'timber', scale: [1.45, 0.28, 0.55] },
        { x: engineX, y: 1.34, z: center.y + 3.05, material: 'iron', scale: [0.26, 0.72, 0.26] },
        { x: engineX - 0.45, y: 0.82, z: center.y + 3.05, material: 'iron', scale: [0.34, 0.34, 0.72] },
        { x: engineX + 0.45, y: 0.82, z: center.y + 3.05, material: 'iron', scale: [0.34, 0.34, 0.72] },
      )
    }
  }
  return { id: `campaign:${campaign.tick}`, footprint: [64, 64], anchor: [32, 0, 32], voxels }
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
  kind: UnitKind
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
  private campaignMarchMeshes: THREE.InstancedMesh[] = []
  private readonly campaignMarchGroups = new Map<string, THREE.Group>()
  private readonly friendlyFormations = new Map<FormationKind, THREE.Group>()
  private enemyFormation: THREE.Group | null = null
  private readonly preview: THREE.Mesh
  private readonly pathPreview: THREE.InstancedMesh
  private readonly commandMarker: THREE.Mesh
  private readonly pickerGeometry = new THREE.BoxGeometry(1, 1, 1)
  private readonly pickerMaterial = new THREE.MeshBasicMaterial({ visible: false })
  private readonly selectionOutline: THREE.LineSegments
  private readonly campaignSourceOutline: THREE.LineSegments
  private readonly campaignTargetOutline: THREE.LineSegments
  private readonly campaignEventOutline: THREE.LineSegments
  private buildingPickers: THREE.Mesh[] = []
  private selectedBuildingId: number | null = null
  private campaignSourceProvinceId: number | null = null
  private campaignTargetProvinceId: number | null = null
  private campaignEventProvinceId: number | null = null
  private animationFrame = 0
  private needsRender = true
  private seed = ''
  private buildings: Building[] = []
  private campaignMode = false
  private campaign: CampaignState | null = null
  private campaignSignature = ''
  private battleVisible = false
  private battleOutcome: 'victory' | 'defeat' | null = null
  private battleStartedAt = 0
  private battleFormations: BattleFormation[] = createBattleFormations()
  private selectedFormationId: FormationKind = 'militia'
  private battleExecuting = false
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
    const campaignOutlineSource = new THREE.BoxGeometry(1, 1, 1)
    const campaignOutlineGeometry = new THREE.EdgesGeometry(campaignOutlineSource)
    campaignOutlineSource.dispose()
    this.campaignSourceOutline = new THREE.LineSegments(
      campaignOutlineGeometry,
      new THREE.LineBasicMaterial({ color: 0xf2c65d, depthTest: false, transparent: true, opacity: 0.95 }),
    )
    this.campaignTargetOutline = new THREE.LineSegments(
      campaignOutlineGeometry.clone(),
      new THREE.LineBasicMaterial({ color: 0xff8b76, depthTest: false, transparent: true, opacity: 0.98 }),
    )
    this.campaignEventOutline = new THREE.LineSegments(
      campaignOutlineGeometry.clone(),
      new THREE.LineBasicMaterial({ color: 0xffef9a, depthTest: false, transparent: true, opacity: 1 }),
    )
    for (const outline of [this.campaignSourceOutline, this.campaignTargetOutline, this.campaignEventOutline]) {
      outline.visible = false
      outline.renderOrder = outline === this.campaignEventOutline ? 32 : 31
      this.scene.add(outline)
    }
    this.resize()
    this.animate()
  }

  setWorld(
    seed: string,
    buildings: Building[],
    campaignMode: boolean,
    campaign: CampaignState,
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
    const campaignSignature = [
      campaign.winnerRealmId ?? 'active',
      campaign.realms.map((realm) => `${realm.id}:${realm.status}`).join('|'),
      campaign.provinces.map((province) => (
        `${province.id}:${province.owner ?? 'free'}:${province.levies}:${province.cityLevel}:${province.marketLevel}`
        + `:${province.fortificationLevel}:${province.workshopLevel}:${province.project?.kind ?? 'idle'}:${province.defenseFormation}:${province.capitalOf ?? 'none'}`
      )).join('|'),
      campaign.marches.map((march) => (
        `${march.id}:${march.kind}:${march.siegeId ?? 'field'}:${march.route.join('-')}:${march.soldiers}:${march.formation}:${march.supplies ?? 0}:${march.engines ?? 0}:${march.departedAt}:${march.arrivesAt}`
      )).join('|'),
      campaign.relations.map((relation) => (
        `${relation.realmIds.join('-')}:${relation.status}:${relation.tradeEmbargoes.join(',')}`
      )).join('|'),
      campaign.tradeRoutes.map((route) => `${route.id}:${route.provinceIds.join('-')}`).join('|'),
      campaign.sieges.map((siege) => (
        `${siege.id}:${siege.targetId}:${siege.soldiers}:${siege.formation}:${siege.tactic}:${siege.progress}:${siege.supplies ?? 0}:${siege.engines ?? 0}`
      )).join('|'),
    ].join('::')
    const campaignChanged = campaignSignature !== this.campaignSignature
    if (this.seed === seed && !buildingsChanged && this.campaignMode === campaignMode && !campaignChanged
      && this.battleVisible === battleVisible && this.stressMode === stressMode && this.battleOutcome === battleOutcome && !firesChanged) return
    const battleVisibilityChanged = battleVisible !== this.battleVisible
    this.seed = seed
    this.buildings = buildings.map((building) => ({ ...building }))
    this.campaignMode = campaignMode
    this.campaign = {
      ...campaign,
      realms: campaign.realms.map((realm) => ({ ...realm, ruler: { ...realm.ruler } })),
      economies: campaign.economies.map((economy) => ({ ...economy })),
      relations: campaign.relations.map((relation) => ({
        ...relation,
        tradeEmbargoes: [...relation.tradeEmbargoes],
      })),
      allianceOffers: campaign.allianceOffers.map((offer) => ({ ...offer })),
      tradeRoutes: campaign.tradeRoutes.map((route) => ({
        ...route,
        realmIds: [route.realmIds[0], route.realmIds[1]],
        provinceIds: [route.provinceIds[0], route.provinceIds[1]],
      })),
      sieges: campaign.sieges.map((siege) => ({ ...siege })),
      provinces: campaign.provinces.map((province) => ({
        ...province,
        project: province.project ? { ...province.project } : null,
      })),
      marches: campaign.marches.map((march) => ({ ...march, route: [...march.route] })),
    }
    this.campaignSignature = campaignSignature
    this.battleVisible = battleVisible
    this.stressMode = stressMode
    this.battleOutcome = battleOutcome
    this.burningBuildingIds = [...burningBuildingIds]
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

  setCampaignSelection(source: Province | null, target: Province | null, eventProvince: Province | null): void {
    this.campaignSourceProvinceId = source?.id ?? null
    this.campaignTargetProvinceId = target?.id ?? null
    this.campaignEventProvinceId = eventProvince?.id ?? null
    this.selectionOutline.visible = false
    for (const [outline, province] of [
      [this.campaignSourceOutline, source],
      [this.campaignTargetOutline, target],
      [this.campaignEventOutline, eventProvince],
    ] as const) {
      outline.visible = this.campaignMode && Boolean(province)
      if (!this.campaignMode || !province) continue
      const center = campaignProvinceCenter(province)
      const isEvent = outline === this.campaignEventOutline
      outline.position.set(center.x, isEvent ? 0.95 : 0.75, center.y)
      outline.scale.set(isEvent ? 8.05 : 7.7, isEvent ? 1.75 : 1.35, isEvent ? 8.05 : 7.7)
      outline.updateMatrixWorld()
    }
    this.invalidate()
  }

  setBattlePlan(formations: readonly BattleFormation[], selectedFormationId: FormationKind, executing: boolean): void {
    const previousShapeSignature = this.battleFormations.map((formation) => `${formation.id}:${formation.shape}`).join('|')
    const nextShapeSignature = formations.map((formation) => `${formation.id}:${formation.shape}`).join('|')
    const executionStarted = executing && !this.battleExecuting
    this.battleFormations = formations.map((formation) => ({
      ...formation,
      start: { ...formation.start },
      target: formation.target ? { ...formation.target } : null,
    }))
    this.selectedFormationId = selectedFormationId
    this.battleExecuting = executing
    if (executionStarted) this.battleStartedAt = performance.now()
    const selected = this.battleFormations.find((formation) => formation.id === selectedFormationId)
    this.commandMarker.visible = Boolean(selected?.target) && this.battleVisible && !executing
    if (selected?.target) this.commandMarker.position.set(selected.target.x, 2.05, selected.target.y)
    if (previousShapeSignature !== nextShapeSignature && this.battleVisible) this.rebuild()
    else if (this.battleVisible) this.updateBattle(performance.now())
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
    this.campaignSourceOutline.geometry.dispose()
    ;(this.campaignSourceOutline.material as THREE.Material).dispose()
    this.campaignTargetOutline.geometry.dispose()
    ;(this.campaignTargetOutline.material as THREE.Material).dispose()
    this.campaignEventOutline.geometry.dispose()
    ;(this.campaignEventOutline.material as THREE.Material).dispose()
    this.renderer.dispose()
  }

  private rebuild(): void {
    this.disposeWorld()
    const batch = new VoxelBatch()
    if (this.campaignMode && this.campaign) {
      batch.add(campaignModel(this.campaign))
      this.worldMeshes = batch.commit(this.scene)
      this.rebuildCampaignMarches(this.campaign.marches)
      this.visibleUnits = this.campaign.marches.length * 6
      const source = this.campaign.provinces.find((province) => province.id === this.campaignSourceProvinceId) ?? null
      const target = this.campaign.provinces.find((province) => province.id === this.campaignTargetProvinceId) ?? null
      const eventProvince = this.campaign.provinces.find((province) => province.id === this.campaignEventProvinceId) ?? null
      this.setCampaignSelection(source, target, eventProvince)
      return
    }
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
    const enemyCount = this.stressMode ? 150 : 60
    const enemyBatch = new VoxelBatch()
    const enemyColumns = this.stressMode ? 15 : 10
    const enemySpacing = this.stressMode ? 0.7 : 0.82
    const enemyRows = Math.ceil(enemyCount / enemyColumns)
    for (let index = 0; index < enemyCount; index += 1) {
      const column = index % enemyColumns
      const row = Math.floor(index / enemyColumns)
      const origin = new THREE.Vector3(column * enemySpacing, 0, (row - (enemyRows - 1) / 2) * enemySpacing)
      enemyBatch.add(generateUnitModel('raider', 'enemy', this.stressMode), origin)
    }
    this.enemyFormation = new THREE.Group()
    this.battleMeshes = [...enemyBatch.commitBattle(this.enemyFormation, 'fire')]
    this.scene.add(this.enemyFormation)

    if (this.stressMode) {
      const group = new THREE.Group()
      const batch = new VoxelBatch()
      for (let index = 0; index < 150; index += 1) {
        const column = index % 15
        const row = Math.floor(index / 15)
        batch.add(generateUnitModel(index % 5 === 0 ? 'retinue' : 'militia', 'friendly', true), new THREE.Vector3(column * 0.7, 0, (row - 4.5) * 0.7))
      }
      this.friendlyFormations.set('militia', group)
      this.battleMeshes.push(...batch.commitBattle(group, 'porphyry'))
      this.scene.add(group)
      this.visibleUnits = 300
    } else {
      let friendlyCount = 0
      for (const formation of this.battleFormations) {
        const group = new THREE.Group()
        const batch = new VoxelBatch()
        for (let index = 0; index < formation.soldiers; index += 1) {
          batch.add(
            generateUnitModel(formation.kind, 'friendly'),
            this.formationOffset(index, formation.soldiers, formation.shape),
          )
        }
        this.friendlyFormations.set(formation.id, group)
        this.battleMeshes.push(...batch.commitBattle(group, 'porphyry'))
        this.scene.add(group)
        friendlyCount += formation.soldiers
      }
      this.visibleUnits = friendlyCount + enemyCount
    }
    this.updateBattle(performance.now())
  }

  private rebuildCampaignMarches(marches: readonly CampaignMarch[]): void {
    for (const march of marches) {
      const group = new THREE.Group()
      const batch = new VoxelBatch()
      for (let index = 0; index < 6; index += 1) {
        batch.add(
          generateUnitModel(index >= 3 ? 'spears' : 'militia', 'friendly'),
          this.campaignFormationOffset(index, march.formation),
        )
      }
      const mapStyle = this.campaign?.realms.find((realm) => realm.id === march.actorId)?.mapStyle
      const tint = mapStyle ? REALM_MATERIAL[mapStyle] ?? 'porphyry' : 'porphyry'
      this.campaignMarchMeshes.push(...batch.commitBattle(group, tint))
      group.scale.setScalar(1.02)
      this.campaignMarchGroups.set(march.id, group)
      this.scene.add(group)
    }
    this.updateCampaignMarches(Date.now())
  }

  private updateCampaignMarches(now: number): void {
    if (!this.campaignMode || !this.campaign) return
    for (const march of this.campaign.marches) {
      const group = this.campaignMarchGroups.get(march.id)
      const route = march.route
        .map((provinceId) => this.campaign!.provinces.find((province) => province.id === provinceId))
        .filter((province): province is Province => Boolean(province))
      if (!group || route.length < 2) continue
      const duration = Math.max(1, march.arrivesAt - march.departedAt)
      const progress = THREE.MathUtils.clamp((now - march.departedAt) / duration, 0, 1)
      const legProgress = Math.min(route.length - 1, progress * (route.length - 1))
      const legIndex = Math.min(route.length - 2, Math.floor(legProgress))
      const start = campaignProvinceCenter(route[legIndex])
      const end = campaignProvinceCenter(route[legIndex + 1])
      const eased = THREE.MathUtils.smoothstep(legProgress - legIndex, 0, 1)
      group.position.set(
        THREE.MathUtils.lerp(start.x, end.x, eased),
        2.05 + Math.abs(Math.sin(legProgress * Math.PI * 2)) * 0.22,
        THREE.MathUtils.lerp(start.y, end.y, eased),
      )
      group.rotation.y = Math.atan2(end.x - start.x, end.y - start.y)
    }
  }

  private formationOffset(index: number, count: number, shape: FormationShape): THREE.Vector3 {
    const spacing = 0.72
    if (shape === 'wedge') {
      const row = Math.floor(Math.sqrt(index))
      const rowStart = row * row
      const position = index - rowStart
      return new THREE.Vector3(row * spacing, 0, (position - row) * spacing)
    }
    const rows = shape === 'line' ? 2 : Math.max(2, Math.ceil(count / 7))
    const columns = Math.ceil(count / rows)
    const column = index % columns
    const row = Math.floor(index / columns)
    const depthSpacing = shape === 'shieldwall' ? 0.5 : spacing
    return new THREE.Vector3((column - (columns - 1) / 2) * spacing, 0, (row - (rows - 1) / 2) * depthSpacing)
  }

  private campaignFormationOffset(index: number, shape: FormationShape): THREE.Vector3 {
    if (shape === 'wedge') {
      return [
        new THREE.Vector3(0, 0, -1.3),
        new THREE.Vector3(-0.62, 0, -0.22),
        new THREE.Vector3(0.62, 0, -0.22),
        new THREE.Vector3(-1.22, 0, 0.88),
        new THREE.Vector3(0, 0, 0.88),
        new THREE.Vector3(1.22, 0, 0.88),
      ][index]!
    }
    const spacing = shape === 'shieldwall' ? 0.42 : 0.62
    return new THREE.Vector3((index - 2.5) * spacing, 0, 0)
  }

  private updateBattle(now: number): void {
    if (!this.battleVisible || !this.enemyFormation || this.friendlyFormations.size === 0) return
    if (!this.battleExecuting) {
      if (this.stressMode) {
        this.friendlyFormations.get('militia')?.position.set(20, 1.5, 36)
      } else {
        for (const formation of this.battleFormations) {
          const point = formation.target ?? formation.start
          this.friendlyFormations.get(formation.id)?.position.set(point.x, 1.5, point.y)
        }
      }
      this.enemyFormation.position.set(48, 1.5, 36)
      return
    }
    const duration = this.stressMode ? 7600 : BATTLE_DURATION_MS
    const progress = THREE.MathUtils.clamp((now - this.battleStartedAt) / duration, 0, 1)
    const approach = THREE.MathUtils.smoothstep(progress, 0, 0.5)
    const aftermath = this.battleOutcome ? THREE.MathUtils.smoothstep(progress, 0.68, 1) : 0
    const clash = progress > 0.42 && progress < 0.72 ? Math.sin(progress * 95) * 0.16 : 0

    if (this.stressMode) {
      this.friendlyFormations.get('militia')?.position.set(20 + approach * 13 + aftermath * 2, 1.5 + Math.abs(clash), 36)
    } else {
      for (const formation of this.battleFormations) {
        const point = formation.target ?? formation.start
        const advance = formation.kind === 'archers' ? 1.5 : formation.kind === 'retinue' ? 7 : 4
        const defeatedRetreat = this.battleOutcome === 'defeat' ? -aftermath * 8 : aftermath * 1.5
        this.friendlyFormations.get(formation.id)?.position.set(
          point.x + approach * advance + defeatedRetreat,
          1.5 + Math.abs(clash),
          point.y,
        )
      }
    }
    const enemyRetreatX = this.battleOutcome === 'victory' ? 13 : -10
    this.enemyFormation.position.set(48 - approach * 12 + aftermath * enemyRetreatX, 1.5 + Math.abs(clash), 36)
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
    for (const formation of this.friendlyFormations.values()) this.scene.remove(formation)
    if (this.enemyFormation) this.scene.remove(this.enemyFormation)
    for (const mesh of this.battleMeshes) {
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => material.dispose())
    }
    this.battleMeshes = []
    for (const group of this.campaignMarchGroups.values()) this.scene.remove(group)
    for (const mesh of this.campaignMarchMeshes) {
      mesh.geometry.dispose()
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      materials.forEach((material) => material.dispose())
    }
    this.campaignMarchMeshes = []
    this.campaignMarchGroups.clear()
    this.friendlyFormations.clear()
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
    if (this.campaignMode && this.campaign?.marches.length) {
      this.updateCampaignMarches(Date.now())
      this.needsRender = true
    }
    if (this.needsRender && !this.paused) {
      this.renderer.render(this.scene, this.camera)
      this.needsRender = false
    }
    const snapshot = this.metrics.sample(performance.now(), this.visibleUnits)
    if (this.stressMode) window.__OPENFRONT_METRICS__ = snapshot
  }
}
