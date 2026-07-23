<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref, toRaw } from 'vue'
import { Crown, Flame, Hammer, Navigation, Shield, ShieldX, TentTree, Trash2, TrendingDown, TrendingUp, Wheat } from '@lucide/vue'
import BattleCommandBar from './components/BattleCommandBar.vue'
import CampaignCommandBar from './components/CampaignCommandBar.vue'
import DiplomacyPanel from './components/DiplomacyPanel.vue'
import EdgeDrawer from './components/EdgeDrawer.vue'
import GameWorld from './components/GameWorld.vue'
import ModeBar from './components/ModeBar.vue'
import MultiplayerLobby from './components/MultiplayerLobby.vue'
import ProvinceDevelopmentPanel from './components/ProvinceDevelopmentPanel.vue'
import SiegeCommandBar from './components/SiegeCommandBar.vue'
import TopHud from './components/TopHud.vue'
import {
  addressCrisis,
  advanceGame,
  createGame,
  demolishBuilding,
  dismissThreat,
  placeBuilding,
  placePath,
  recommendedCrisisResponse,
  repairBuilding,
  revealThreat,
  resolveRaid,
  settlementOutlook,
  type BuildingKind,
  type CrisisResponse,
  type Point,
} from './game/simulation'
import { decodeSave, encodeSave } from './game/persistence'
import {
  CAMPAIGN_GIFT_COST,
  CAMPAIGN_MUSTER_COST,
  CAMPAIGN_PEACE_DEMAND_SCORE,
  CAMPAIGN_WAR_LEGITIMACY_COST,
  allianceOfferBetween,
  answerPeaceOffer,
  beginCampaignMarch,
  breakAlliance,
  campaignMarchRoute,
  campaignRelation,
  campaignPeaceDemandCandidates,
  campaignPeaceOfferBetween,
  campaignSiegeAt,
  campaignSiegeProjectedDailyProgress,
  campaignWarScore,
  campaignSiegeMarchRole,
  campaignProvinceAt,
  declareWar,
  executeSiegeManeuver,
  formAlliance,
  musterProvince,
  openTradeRoute,
  offerTruce,
  proposePeace,
  provincesAreAdjacent,
  realmDailyIncome,
  realmEconomy,
  realmProvinceCount,
  realmStrength,
  reinforceAllianceProvince,
  resolveCampaignMarches,
  retreatSiege,
  sendAllianceSilver,
  sendGift,
  setSiegeTactic,
  setTradeEmbargo,
  setProvinceDefenseFormation,
  startProvinceProject,
  sortieSiege,
  tradeRouteBetweenRealms,
  tradeRouteIncome,
  withdrawPeaceOffer,
  type AllianceSilverAmount,
  type CampaignCommitment,
  type CampaignMarch,
  type CampaignMarchResolution,
  type CampaignSiegeTactic,
  type ProvinceProjectKind,
  type RealmId,
} from './game/campaign'
import {
  assessBattlePlan,
  createBattleFormations,
  FORMATION_SHAPE_LABELS,
  type FormationKind,
  type FormationShape,
} from './game/tactics'
import { NATIONS } from './game/nations'
import { MatchClient, type MatchConnectionStatus } from './multiplayer/MatchClient'
import type { MatchPhase, MatchPlayer, ServerMessage } from './multiplayer/protocol'
import { byzantineMacedonian } from './presets'

type Mode = 'streets' | 'quarters' | 'production' | 'defense'
type Drawer = 'chronicle' | 'court' | 'intel' | 'object' | 'diplomacy' | 'multiplayer' | 'domain'
const modeNames: Record<Mode, string> = { streets: 'Улицы', quarters: 'Кварталы', production: 'Производство', defense: 'Оборона' }
const OFFLINE_MARCH_LEG_MS = 3000

const game = reactive(createGame('heather-17'))
revealThreat(game, 'raiders', 85)
const selectedTool = ref<BuildingKind | null>(null)
const mode = ref<Mode>('quarters')
const activeDrawer = ref<Drawer | null>(null)
const selectedBuildingId = ref<number | null>(null)
const speed = ref<0 | 1 | 4>(1)
const notice = ref('Выберите раздел строительства или осмотрите город')
const battleVisible = ref(false)
const battleOutcome = ref<'victory' | 'defeat' | null>(null)
const burningBuildingIds = ref<number[]>([])
const tacticalCommand = ref(false)
const battleExecuting = ref(false)
const battleFormations = ref(createBattleFormations())
const selectedFormationId = ref<FormationKind>('militia')
const realmMode = ref(false)
const campaignSourceId = ref<number | null>(null)
const campaignTargetId = ref<number | null>(null)
const campaignEventProvinceId = ref<number | null>(null)
const campaignCommitment = ref<CampaignCommitment>(50)
const campaignFormation = ref<FormationShape>('line')
const activeSiegeId = ref<string | null>(null)
const selectedDiplomacyRealmId = ref<RealmId | null>(null)
const localNationId = ref<RealmId>(game.campaign.playerRealmId)
const matchStatus = ref<MatchConnectionStatus>('offline')
const matchRoomId = ref('')
const matchRevision = ref(0)
const matchPhase = ref<MatchPhase>('lobby')
const matchPlayerId = ref('')
const campaignNow = ref(Date.now())
const matchPlayers = ref<MatchPlayer[]>([])
const matchError = ref('')
const campaignResolutionMessages = ref<string[]>([])
const activeBattleThreatId = ref<number | null>(null)
const gameWorld = ref<InstanceType<typeof GameWorld> | null>(null)
const stressMode = new URLSearchParams(window.location.search).has('stress')
let worldCounter = 1
let battleTimer = 0
let campaignEventTimer = 0
let preMatchState: {
  campaign: typeof game.campaign
} | null = null
const matchClient = new MatchClient(handleMatchMessage, (status) => {
  matchStatus.value = status
})

const primaryThreat = computed(() => game.threats.find((threat) => threat.status !== 'disbanded'))
const selectedBuilding = computed(() => game.buildings.find((building) => building.id === selectedBuildingId.value) ?? null)
const outlook = computed(() => settlementOutlook(game))
const battleAssessment = computed(() => assessBattlePlan(battleFormations.value))
const campaignSource = computed(() => game.campaign.provinces.find((province) => province.id === campaignSourceId.value) ?? null)
const campaignTarget = computed(() => game.campaign.provinces.find((province) => province.id === campaignTargetId.value) ?? null)
const campaignTargetRealm = computed(() => game.campaign.realms.find((realm) => realm.id === campaignTarget.value?.owner) ?? null)
const campaignTargetRelation = computed(() => campaignTargetRealm.value
  ? campaignRelation(game.campaign, campaignTargetRealm.value.id, localNationId.value)
  : null)
const campaignTargetSiege = computed(() => (
  campaignTarget.value ? campaignSiegeAt(game.campaign, campaignTarget.value.id) : null
))
const selectedCampaignRoute = computed(() => (
  campaignSource.value && campaignTarget.value
    ? campaignMarchRoute(
        game.campaign,
        campaignSource.value.id,
        campaignTarget.value.id,
        localNationId.value,
      )
    : null
))
const selectedCampaignRouteLegs = computed(() => (
  campaignTargetSiege.value && campaignSource.value && campaignTarget.value
    ? provincesAreAdjacent(campaignSource.value, campaignTarget.value) ? 1 : 0
    : Math.max(0, (selectedCampaignRoute.value?.length ?? 1) - 1)
))
const campaignSiegeOrderRole = computed(() => (
  campaignTargetSiege.value
    ? campaignSiegeMarchRole(game.campaign, campaignTargetSiege.value, localNationId.value)
    : null
))
const campaignOrderKind = computed<'attack' | 'siege-reinforce' | 'siege-relief'>(() => (
  campaignSiegeOrderRole.value === 'reinforce'
    ? 'siege-reinforce'
    : campaignSiegeOrderRole.value === 'relief'
      ? 'siege-relief'
      : 'attack'
))
const selectedDiplomacyRealm = computed(() => game.campaign.realms.find((realm) => realm.id === selectedDiplomacyRealmId.value) ?? null)
const selectedDiplomacyRelation = computed(() => selectedDiplomacyRealm.value
  ? campaignRelation(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  : null)
const selectedDiplomacyOffer = computed(() => selectedDiplomacyRealm.value
  ? allianceOfferBetween(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  : null)
const selectedDiplomacyOfferDirection = computed(() => {
  if (!selectedDiplomacyOffer.value) return null
  return selectedDiplomacyOffer.value.toRealmId === localNationId.value ? 'incoming' : 'outgoing'
})
const selectedPeaceOffer = computed(() => selectedDiplomacyRealm.value
  ? campaignPeaceOfferBetween(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  : null)
const selectedPeaceOfferDirection = computed(() => {
  if (!selectedPeaceOffer.value) return null
  return selectedPeaceOffer.value.toRealmId === localNationId.value ? 'incoming' : 'outgoing'
})
const selectedPeaceDemand = computed(() => (
  selectedPeaceOffer.value?.demandedProvinceId === null
    ? null
    : game.campaign.provinces.find((province) => province.id === selectedPeaceOffer.value?.demandedProvinceId) ?? null
))
const selectedWarScore = computed(() => (
  selectedDiplomacyRealm.value
    ? campaignWarScore(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
    : 0
))
const selectedPeaceDemandCandidates = computed(() => (
  selectedDiplomacyRealm.value
    ? campaignPeaceDemandCandidates(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
    : []
))
const selectedDiplomacyTargetAvailable = computed(() => (
  matchStatus.value !== 'online'
  || matchPlayers.value.some((player) => player.nationId === selectedDiplomacyRealm.value?.id)
))
const selectedDiplomacyEconomy = computed(() => selectedDiplomacyRealm.value
  ? realmEconomy(game.campaign, selectedDiplomacyRealm.value.id)
  : null)
const allianceSupportTarget = computed(() => (
  campaignTarget.value?.owner === selectedDiplomacyRealm.value?.id
    ? campaignTarget.value
    : null
))
const localNation = computed(() => game.campaign.realms.find((realm) => realm.id === localNationId.value) ?? game.campaign.realms[0])
const campaignWinner = computed(() => game.campaign.realms.find((realm) => realm.id === game.campaign.winnerRealmId) ?? null)
const localMatchPlayer = computed(() => matchPlayers.value.find((player) => player.id === matchPlayerId.value) ?? null)
const campaignOutcome = computed(() => {
  if (campaignWinner.value) {
    const victory = campaignWinner.value.id === localNationId.value
    return {
      kind: victory ? 'victory' : 'defeat',
      title: victory ? 'Победа в войне держав' : 'Матч завершён',
      text: victory
        ? `${campaignWinner.value.name} остаётся единственной державой на карте`
        : `${campaignWinner.value.name} подчинила остальных правителей`,
    } as const
  }
  if (localNation.value?.status === 'defeated') {
    return {
      kind: 'defeat',
      title: 'Держава разгромлена',
      text: 'Последняя земля потеряна; матч продолжается в режиме наблюдения',
    } as const
  }
  return null
})
const localNationEconomy = computed(() => realmEconomy(game.campaign, localNationId.value))
const localNationIncome = computed(() => realmDailyIncome(game.campaign, localNationId.value))
const selectedSourceMarch = computed(() => game.campaign.marches.find((march) => (
  march.actorId === localNationId.value && march.sourceId === campaignSourceId.value
)) ?? null)
const activeSiege = computed(() => (
  game.campaign.sieges.find((siege) => siege.id === activeSiegeId.value) ?? null
))
const activeSiegeTarget = computed(() => (
  activeSiege.value
    ? game.campaign.provinces.find((province) => province.id === activeSiege.value!.targetId) ?? null
    : null
))
const activeSiegeAttacker = computed(() => (
  activeSiege.value
    ? game.campaign.realms.find((realm) => realm.id === activeSiege.value!.attackerId) ?? null
    : null
))
const activeSiegeDefender = computed(() => (
  activeSiege.value
    ? game.campaign.realms.find((realm) => realm.id === activeSiege.value!.defenderId) ?? null
    : null
))
const activeSiegeRole = computed<'attacker' | 'defender' | 'observer'>(() => (
  activeSiege.value?.attackerId === localNationId.value
    ? 'attacker'
    : activeSiege.value?.defenderId === localNationId.value
      ? 'defender'
      : 'observer'
))
const activeSiegeProgressRates = computed(() => ({
  blockade: activeSiege.value
    ? campaignSiegeProjectedDailyProgress(game.campaign, activeSiege.value, 'blockade')
    : 0,
  sappers: activeSiege.value
    ? campaignSiegeProjectedDailyProgress(game.campaign, activeSiege.value, 'sappers')
    : 0,
}))
const campaignSieges = computed(() => game.campaign.sieges.map((siege) => ({
  ...siege,
  target: game.campaign.provinces.find((province) => province.id === siege.targetId)?.name ?? 'неизвестная крепость',
  attacker: game.campaign.realms.find((realm) => realm.id === siege.attackerId)?.shortName ?? siege.attackerId,
})))
const allianceSupportReason = computed(() => {
  if (selectedDiplomacyRelation.value?.status !== 'alliance') return null
  if (matchStatus.value === 'online' && !selectedDiplomacyTargetAvailable.value) {
    return 'У союзной державы нет правителя в матче'
  }
  if (!campaignSource.value || !allianceSupportTarget.value) {
    return 'Выберите свою провинцию и соседнюю землю союзника'
  }
  if (!provincesAreAdjacent(campaignSource.value, allianceSupportTarget.value)) {
    return 'Подкреплению нужна общая граница провинций'
  }
  if (selectedSourceMarch.value) return 'Из этой провинции уже выступило войско'
  const committed = Math.floor(campaignSource.value.levies * campaignCommitment.value / 100)
  if (campaignSource.value.levies - committed < 4) return 'В провинции должен остаться гарнизон'
  if (allianceSupportTarget.value.levies >= 300) return 'Союзный гарнизон уже достиг предела'
  return null
})
const selectedTradeRoute = computed(() => (
  selectedDiplomacyRealm.value
    ? tradeRouteBetweenRealms(game.campaign, localNationId.value, selectedDiplomacyRealm.value.id)
    : null
))
const tradeRouteSource = computed(() => {
  if (!selectedTradeRoute.value) return campaignSource.value
  const localIndex = selectedTradeRoute.value.realmIds.indexOf(localNationId.value)
  return game.campaign.provinces.find((province) => (
    province.id === selectedTradeRoute.value!.provinceIds[localIndex]
  )) ?? null
})
const tradeRouteTarget = computed(() => {
  if (!selectedTradeRoute.value) return allianceSupportTarget.value
  const localIndex = selectedTradeRoute.value.realmIds.indexOf(localNationId.value)
  return game.campaign.provinces.find((province) => (
    province.id === selectedTradeRoute.value!.provinceIds[localIndex === 0 ? 1 : 0]
  )) ?? null
})
const tradeEmbargoStatus = computed<'none' | 'self' | 'target' | 'both'>(() => {
  const embargoes = selectedDiplomacyRelation.value?.tradeEmbargoes ?? []
  const self = embargoes.includes(localNationId.value)
  const target = selectedDiplomacyRealm.value ? embargoes.includes(selectedDiplomacyRealm.value.id) : false
  return self && target ? 'both' : self ? 'self' : target ? 'target' : 'none'
})
const selectedTradeIncome = computed(() => (
  selectedTradeRoute.value ? tradeRouteIncome(game.campaign, selectedTradeRoute.value) : 0
))
const tradeRouteReason = computed(() => {
  if (!selectedDiplomacyRelation.value) return 'Держава не найдена'
  if (selectedDiplomacyRelation.value.status === 'war') return 'Во время войны торговля закрыта'
  if (matchStatus.value === 'online' && !selectedDiplomacyTargetAvailable.value) {
    return 'У соседней державы нет правителя в матче'
  }
  if (tradeEmbargoStatus.value !== 'none') return 'Торговлю блокирует эмбарго'
  if (selectedTradeRoute.value) return null
  if (!campaignSource.value || !allianceSupportTarget.value) {
    return 'Выберите свою провинцию и соседний рынок'
  }
  if (!provincesAreAdjacent(campaignSource.value, allianceSupportTarget.value)) {
    return 'Караванам нужна общая граница провинций'
  }
  if (campaignSource.value.marketLevel < 1) return 'В своей провинции сначала учредите торг'
  if (allianceSupportTarget.value.marketLevel < 1) return 'В соседней провинции нет торга'
  return null
})
const campaignCanAttack = computed(() => {
  if (campaignOutcome.value) return false
  if (!campaignSource.value || !campaignTarget.value) return false
  if (campaignSource.value.owner !== localNationId.value || campaignSource.value.id === campaignTarget.value.id) return false
  const committed = Math.floor(campaignSource.value.levies * campaignCommitment.value / 100)
  if (campaignSource.value.levies - committed < 4) return false
  if (selectedSourceMarch.value) return false
  if (campaignSiegeAt(game.campaign, campaignSource.value.id)) return false
  if (campaignTargetSiege.value) {
    return provincesAreAdjacent(campaignSource.value, campaignTarget.value)
      && campaignSiegeOrderRole.value !== null
  }
  if (!selectedCampaignRoute.value) return false
  if (!campaignTarget.value.owner) return true
  return campaignRelation(game.campaign, campaignTarget.value.owner, localNationId.value)?.status === 'war'
})
const campaignCanMuster = computed(() => Boolean(
  !campaignOutcome.value
  && campaignSource.value
  &&
  campaignSource.value?.owner === localNationId.value
  && !campaignSiegeAt(game.campaign, campaignSource.value.id)
  && (localNationEconomy.value?.silver ?? 0) >= CAMPAIGN_MUSTER_COST
  && campaignSource.value.levies < 180,
))
const campaignCanManage = computed(() => Boolean(
  !campaignOutcome.value
  && campaignSource.value
  && campaignSource.value.owner === localNationId.value
  && !campaignSiegeAt(game.campaign, campaignSource.value.id),
))
const campaignDefenseLocked = computed(() => Boolean(
  campaignSource.value
  && (
    Boolean(campaignSiegeAt(game.campaign, campaignSource.value.id))
    || game.campaign.marches.some((march) => (
      march.targetId === campaignSource.value!.id && march.actorId !== localNationId.value
    ))
  ),
))
const playerProvinceCount = computed(() => realmProvinceCount(game.campaign, localNationId.value))
const playerCampaignLevies = computed(() => realmStrength(game.campaign, localNationId.value))
const campaignMarches = computed(() => game.campaign.marches.map((march) => ({
  ...march,
  actor: game.campaign.realms.find((realm) => realm.id === march.actorId)?.shortName ?? march.actorId,
  target: game.campaign.provinces.find((province) => province.id === march.targetId)?.name ?? 'неизвестная земля',
  formationLabel: FORMATION_SHAPE_LABELS[march.formation],
  routeLegs: march.route.length - 1,
  purposeLabel: march.siegeId
    ? march.kind === 'support' ? 'деблокада' : 'усиление осады'
    : march.kind === 'support' ? 'подкрепление' : 'поход',
})))
const campaignMarchSummaryTitle = computed(() => {
  const supports = campaignMarches.value.filter((march) => march.kind === 'support').length
  if (supports === campaignMarches.value.length) {
    return supports === 1 ? '1 подкрепление в пути' : `${supports} подкрепления в пути`
  }
  return campaignMarches.value.length === 1
    ? '1 поход в пути'
    : `${campaignMarches.value.length} похода в пути`
})
const campaignRivals = computed(() => game.campaign.realms
  .filter((realm) => realm.id !== localNationId.value)
  .flatMap((realm) => {
    const relation = campaignRelation(game.campaign, realm.id, localNationId.value)
    if (!relation) return []
    const allianceOffer = allianceOfferBetween(game.campaign, realm.id, localNationId.value)
    const offerDirection = allianceOffer
      ? allianceOffer.toRealmId === localNationId.value ? 'incoming' : 'outgoing'
      : null
    const peaceOffer = campaignPeaceOfferBetween(game.campaign, realm.id, localNationId.value)
    const peaceDirection = peaceOffer
      ? peaceOffer.toRealmId === localNationId.value ? 'incoming' : 'outgoing'
      : null
    const tradeActive = Boolean(tradeRouteBetweenRealms(game.campaign, localNationId.value, realm.id))
    const tradeBlocked = relation.tradeEmbargoes.length > 0
    const baseStatusLabel = {
      war: 'война',
      neutral: 'нейтралитет',
      truce: 'перемирие',
      alliance: 'союз',
    }[relation.status]
    return [{
      realm,
      relation,
      provinceCount: realmProvinceCount(game.campaign, realm.id),
      strength: realmStrength(game.campaign, realm.id),
      shortName: realm.shortName,
      offerDirection,
      tradeActive,
      defeated: realm.status === 'defeated',
      statusLabel: realm.status === 'defeated'
        ? 'разгромлена'
        : offerDirection === 'incoming'
          ? 'предлагает союз'
          : offerDirection === 'outgoing'
            ? 'ждёт ответа'
            : peaceDirection === 'incoming'
              ? 'предлагает мир'
              : peaceDirection === 'outgoing'
                ? 'мирные гонцы в пути'
            : tradeActive
              ? `${baseStatusLabel} · торг`
              : tradeBlocked
                ? `${baseStatusLabel} · эмбарго`
                : baseStatusLabel,
    }]
  }))
const threatStatus = computed(() => ({
  forming: 'собирает силы',
  approaching: 'движется к городу',
  raiding: 'штурмует посад',
  withdrawing: 'отступает',
  disbanded: 'рассеян',
}[primaryThreat.value?.status ?? 'forming']))
const constructionHint = computed(() => {
  if (!selectedTool.value) return null
  const name = byzantineMacedonian.buildings[selectedTool.value]
  return selectedTool.value === 'road' || selectedTool.value === 'wall'
    ? `${name} · Тяните ЛКМ по прямой, отпустите для строительства · Esc отмена`
    : `${name} · ЛКМ поставить · перетаскивание перемещает карту · Esc отмена`
})
const topResources = computed(() => ({
  ...game.resources,
  silver: realmMode.value ? localNationEconomy.value?.silver ?? 0 : game.resources.silver,
  people: game.people,
  capacity: game.capacity,
}))

function matchServerUrl(): string {
  return import.meta.env.VITE_MATCH_URL ?? `ws://${window.location.hostname}:5175`
}

function handleMatchMessage(message: ServerMessage): void {
  if (message.type === 'rejected') {
    matchError.value = message.reason
    if (matchStatus.value === 'connecting') {
      matchStatus.value = 'error'
      preMatchState = null
    }
    notice.value = message.reason
    return
  }
  const enteringMatch = matchRoomId.value !== message.roomId
  const previousPhase = matchPhase.value
  const previousRevision = matchRevision.value
  const previousOwners = new Map(game.campaign.provinces.map((province) => [province.id, province.owner]))
  const self = message.players.find((player) => player.id === message.self.playerId)
  if (self) {
    localNationId.value = self.nationId
  }
  matchPlayerId.value = message.self.playerId
  matchRoomId.value = message.roomId
  matchRevision.value = message.revision
  matchPhase.value = message.phase
  matchPlayers.value = message.players
  matchError.value = ''
  const localClockShift = Date.now() - message.serverNow
  const campaignSnapshot = structuredClone(message.campaign)
  campaignSnapshot.marches = campaignSnapshot.marches.map((march) => ({
    ...march,
    departedAt: march.departedAt + localClockShift,
    arrivesAt: march.arrivesAt + localClockShift,
  }))
  Object.assign(game.campaign, campaignSnapshot)
  if (activeSiegeId.value && !game.campaign.sieges.some((siege) => siege.id === activeSiegeId.value)) {
    activeSiegeId.value = null
  }
  const changedProvince = game.campaign.provinces.find((province) => previousOwners.get(province.id) !== province.owner)
  if (changedProvince) {
    if (campaignTargetId.value === changedProvince.id) {
      campaignSourceId.value = changedProvince.owner === localNationId.value ? changedProvince.id : campaignSourceId.value
      campaignTargetId.value = null
    }
    if (campaignSourceId.value === changedProvince.id && changedProvince.owner !== localNationId.value) {
      campaignSourceId.value = null
      campaignTargetId.value = null
      if (activeDrawer.value === 'domain') activeDrawer.value = null
    }
    campaignEventProvinceId.value = changedProvince.id
    window.clearTimeout(campaignEventTimer)
    campaignEventTimer = window.setTimeout(() => {
      campaignEventProvinceId.value = null
      campaignEventTimer = 0
    }, 3200)
  }
  const unseenEvents = message.events.filter((event) => event.revision > previousRevision)
  const resolvedEvents = unseenEvents.filter((event) => (
    event.kind === 'march-resolved'
    || event.kind === 'siege-resolved'
    || event.kind === 'siege-lifted'
    || event.kind === 'realm-defeated'
    || event.kind === 'match-finished'
  ))
  const latestEventProvinceId = [...unseenEvents].reverse().find((event) => event.provinceId !== null)?.provinceId ?? null
  if (resolvedEvents.length > 0) {
    campaignResolutionMessages.value = resolvedEvents.map((event) => event.message)
  }
  const startedSiegeEvent = [...unseenEvents].reverse().find((event) => event.kind === 'siege-started')
  if (startedSiegeEvent?.provinceId !== null && startedSiegeEvent?.provinceId !== undefined) {
    const siege = campaignSiegeAt(game.campaign, startedSiegeEvent.provinceId)
    if (siege && [siege.attackerId, siege.defenderId].includes(localNationId.value)) {
      activeSiegeId.value = siege.id
    }
  }
  if (latestEventProvinceId !== null) {
    campaignEventProvinceId.value = latestEventProvinceId
    window.clearTimeout(campaignEventTimer)
    campaignEventTimer = window.setTimeout(() => {
      campaignEventProvinceId.value = null
      campaignResolutionMessages.value = []
      campaignEventTimer = 0
    }, 3200)
  }
  const matchStarted = previousPhase === 'lobby' && message.phase === 'running'
  if (enteringMatch && message.phase === 'lobby') {
    realmMode.value = false
    campaignSourceId.value = null
    campaignTargetId.value = null
    activeDrawer.value = 'multiplayer'
  } else if ((enteringMatch || matchStarted) && message.phase !== 'lobby' && !realmMode.value) {
    toggleRealmMode()
  }
  if (matchStarted) activeDrawer.value = null
  const incomingAllianceOffer = game.campaign.allianceOffers.find((offer) => (
    offer.toRealmId === localNationId.value
  ))
  if (incomingAllianceOffer && unseenEvents.some((event) => event.kind === 'alliance-offered')) {
    selectedDiplomacyRealmId.value = incomingAllianceOffer.fromRealmId
    activeDrawer.value = 'diplomacy'
  }
  const incomingPeaceOffer = game.campaign.peaceOffers.find((offer) => (
    offer.toRealmId === localNationId.value
  ))
  if (incomingPeaceOffer && unseenEvents.some((event) => event.kind === 'peace-offered')) {
    selectedDiplomacyRealmId.value = incomingPeaceOffer.fromRealmId
    activeDrawer.value = 'diplomacy'
  }
  if (matchStarted) {
    notice.value = 'Все правители готовы · война держав началась'
  } else if (unseenEvents.length > 0) {
    notice.value = unseenEvents.at(-1)!.message
  } else if (changedProvince) {
    notice.value = `${changedProvince.name} · граница обновлена сервером`
  } else if (enteringMatch) {
    notice.value = `Матч ${message.roomId} · ${message.players.length} правителей`
  }
}

function marchEta(march: CampaignMarch): number {
  return Math.max(0, Math.ceil((march.arrivesAt - campaignNow.value) / 1000))
}

function presentLocalMarchResolutions(reports: CampaignMarchResolution[]): void {
  if (reports.length === 0) return
  campaignResolutionMessages.value = reports.map((report) => report.message)
  notice.value = reports.at(-1)!.message
  const latest = reports.at(-1)!
  campaignEventProvinceId.value = latest.targetId
  window.clearTimeout(campaignEventTimer)
  campaignEventTimer = window.setTimeout(() => {
    campaignEventProvinceId.value = null
    campaignResolutionMessages.value = []
    campaignEventTimer = 0
  }, 3200)
  for (const report of reports) {
    const province = game.campaign.provinces.find((item) => item.id === report.targetId)
    game.events.push({
      id: game.nextId++,
      day: game.day,
      title: report.outcome === 'captured'
        ? report.actorId === localNationId.value
          ? 'Провинция присоединена'
          : report.previousOwner === localNationId.value
            ? 'Пограничное поражение'
            : 'Чужое завоевание'
        : report.outcome === 'besieged'
          ? 'Началась осада'
          : report.outcome === 'intercepted'
            ? 'Встречный бой'
            : 'Поход завершён',
      text: report.message,
      tone: report.outcome === 'captured' && report.actorId === localNationId.value
        ? 'good'
        : report.previousOwner === localNationId.value
          ? 'danger'
          : report.outcome === 'reinforced' && report.actorId === localNationId.value
            ? 'good'
            : 'warning',
    })
    if (report.actorId !== localNationId.value) continue
    if (report.outcome === 'captured') {
      campaignSourceId.value = report.targetId
      campaignTargetId.value = null
    } else if (report.outcome === 'besieged') {
      activeSiegeId.value = province ? campaignSiegeAt(game.campaign, province.id)?.id ?? null : null
    }
  }
}

function joinMatch(details: { roomId: string; playerName: string; nationId: string }): void {
  if (!preMatchState) {
    preMatchState = {
      campaign: structuredClone(toRaw(game.campaign)),
    }
  }
  matchError.value = ''
  campaignResolutionMessages.value = []
  matchClient.connect(matchServerUrl(), details.roomId, details.playerName, details.nationId)
}

function leaveMatch(): void {
  matchClient.disconnect()
  if (preMatchState) {
    Object.assign(game.campaign, preMatchState.campaign)
    localNationId.value = game.campaign.playerRealmId
    preMatchState = null
  }
  matchRoomId.value = ''
  matchRevision.value = 0
  matchPhase.value = 'lobby'
  matchPlayerId.value = ''
  matchPlayers.value = []
  matchError.value = ''
  campaignResolutionMessages.value = []
  activeSiegeId.value = null
  activeDrawer.value = null
  notice.value = 'Сетевой матч покинут'
}

function setMatchReady(): void {
  const ready = !(localMatchPlayer.value?.ready ?? false)
  const sent = matchClient.command({ type: 'lobby.ready', ready })
  notice.value = sent
    ? ready ? 'Готовность отправлена серверу' : 'Готовность снята'
    : 'Нет связи с сервером матча'
}

function chooseSpeed(value: 0 | 1 | 4): void {
  speed.value = value
  notice.value = value === 0 ? 'Время остановлено' : `Скорость времени: ${value}×`
}

function chooseMode(value: Mode): void {
  mode.value = value
  selectedTool.value = null
  closeDrawer()
  notice.value = `${modeNames[value]} · выберите инструмент`
}

function chooseTool(kind: BuildingKind): void {
  selectedTool.value = kind
  closeDrawer()
  notice.value = ''
}

function toggleRealmMode(): void {
  if (matchStatus.value === 'online' && matchPhase.value === 'lobby') {
    activeDrawer.value = 'multiplayer'
    notice.value = 'Стратегическая карта откроется после готовности всех правителей'
    return
  }
  if (battleVisible.value) {
    notice.value = 'Стратегическая карта недоступна во время сражения'
    return
  }
  realmMode.value = !realmMode.value
  selectedTool.value = null
  closeDrawer()
  campaignTargetId.value = null
  activeSiegeId.value = null
  window.clearTimeout(campaignEventTimer)
  campaignEventTimer = 0
  campaignEventProvinceId.value = null
  selectedDiplomacyRealmId.value = null
  if (realmMode.value) {
    const capital = game.campaign.provinces.find((province) => (
      province.owner === localNationId.value && province.capitalOf === localNationId.value
    ))
    campaignSourceId.value = capital?.id ?? null
    notice.value = 'Карта державы · выберите исходную провинцию, затем цель за своим рубежом'
  } else {
    campaignSourceId.value = null
    notice.value = 'Возвращение в Порфирополис'
  }
}

function selectCampaignProvince(point: Point): void {
  const province = campaignProvinceAt(game.campaign, point)
  if (!province) return
  const siege = campaignSiegeAt(game.campaign, province.id)
  const siegeRole = siege ? campaignSiegeMarchRole(game.campaign, siege, localNationId.value) : null
  if (
    siege
    && siegeRole
    && campaignSource.value
    && campaignSource.value.id !== province.id
    && provincesAreAdjacent(campaignSource.value, province)
  ) {
    campaignTargetId.value = province.id
    activeSiegeId.value = null
    notice.value = siegeRole === 'reinforce'
      ? `${province.name} · выберите долю и строй подкрепления лагеря`
      : `${province.name} · выберите долю и строй армии деблокады`
    return
  }
  activeSiegeId.value = siege?.id ?? null
  if (province.owner === localNationId.value) {
    campaignSourceId.value = province.id
    campaignTargetId.value = null
    notice.value = siege
      ? `${province.name} в осаде · открыт совет гарнизона`
      : `${province.name} · доступно ${province.levies} ополченцев`
    return
  }
  if (!campaignSource.value) {
    notice.value = 'Сначала выберите свою исходную провинцию'
    return
  }
  campaignTargetId.value = province.id
  const realm = province.owner ? game.campaign.realms.find((item) => item.id === province.owner)?.name : 'вольная земля'
  const route = campaignMarchRoute(game.campaign, campaignSource.value.id, province.id, localNationId.value)
  if (!route) {
    notice.value = `${province.name} · ${realm} · нет пути через ваши земли`
    return
  }
  notice.value = `${province.name} · ${realm} · ${route.length - 1} перехода · защита ${province.levies}`
}

function openCampaignDiplomacy(realmId: RealmId | null = campaignTargetRealm.value?.id ?? null): void {
  if (!realmId || realmId === localNationId.value || !campaignRelation(game.campaign, realmId, localNationId.value)) return
  if (game.campaign.realms.find((realm) => realm.id === realmId)?.status === 'defeated') return
  selectedDiplomacyRealmId.value = realmId
  activeDrawer.value = 'diplomacy'
  const realm = game.campaign.realms.find((item) => item.id === realmId)
  notice.value = `${realm?.name ?? 'Соседняя держава'} · открыто посольство`
}

function recordDiplomaticEvent(title: string, text: string, tone: 'neutral' | 'good' | 'warning' | 'danger'): void {
  game.events.push({ id: game.nextId++, day: game.day, title, text, tone })
  notice.value = text
}

function sendNetworkDiplomacy(
  action:
    | 'gift'
    | 'alliance-offer'
    | 'alliance-accept'
    | 'alliance-decline'
    | 'war'
    | 'truce'
    | 'peace-demand'
    | 'peace-accept'
    | 'peace-reject'
    | 'peace-withdraw'
    | 'break-alliance',
  provinceId?: number,
): boolean {
  if (matchStatus.value !== 'online' || !selectedDiplomacyRealm.value) return false
  const sent = matchClient.command({
    type: 'campaign.diplomacy',
    targetNationId: selectedDiplomacyRealm.value.id,
    action,
    provinceId,
  })
  if (sent) notice.value = 'Дипломатический приказ отправлен серверу'
  return sent
}

function sendDiplomaticGift(): void {
  if (!selectedDiplomacyRealm.value || (localNationEconomy.value?.silver ?? 0) < CAMPAIGN_GIFT_COST) {
    notice.value = `Для даров нужно ${CAMPAIGN_GIFT_COST} номисм`
    return
  }
  if (sendNetworkDiplomacy('gift')) {
    return
  }
  const result = sendGift(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Дары соседям', result.message, 'good')
}

function transferAllianceSilver(amount: AllianceSilverAmount): void {
  if (!selectedDiplomacyRealm.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.transfer',
      targetNationId: selectedDiplomacyRealm.value.id,
      amount,
    })
    notice.value = sent ? 'Приказ казначею отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = sendAllianceSilver(
    game.campaign,
    selectedDiplomacyRealm.value.id,
    amount,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Союзная помощь', result.message, 'good')
}

function sendAllianceReinforcement(): void {
  if (!campaignSource.value || !allianceSupportTarget.value || allianceSupportReason.value) {
    notice.value = allianceSupportReason.value ?? 'Союзный рубеж не выбран'
    return
  }
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.support',
      sourceId: campaignSource.value.id,
      targetId: allianceSupportTarget.value.id,
      commitment: campaignCommitment.value,
      formation: campaignFormation.value,
    })
    notice.value = sent ? 'Подкрепление отправлено серверным приказом' : 'Нет связи с сервером матча'
    return
  }
  const result = reinforceAllianceProvince(
    game.campaign,
    campaignSource.value.id,
    allianceSupportTarget.value.id,
    campaignCommitment.value,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Союзное подкрепление', result.message, 'good')
}

function establishTradeRoute(): void {
  if (!campaignSource.value || !allianceSupportTarget.value || tradeRouteReason.value) {
    notice.value = tradeRouteReason.value ?? 'Торговые рынки не выбраны'
    return
  }
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.trade-route',
      sourceId: campaignSource.value.id,
      targetId: allianceSupportTarget.value.id,
    })
    notice.value = sent ? 'Караванная грамота отправлена серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = openTradeRoute(
    game.campaign,
    campaignSource.value.id,
    allianceSupportTarget.value.id,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Караванный путь', result.message, 'good')
}

function updateTradePolicy(embargoed: boolean): void {
  if (!selectedDiplomacyRealm.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.trade-policy',
      targetNationId: selectedDiplomacyRealm.value.id,
      embargoed,
    })
    notice.value = sent ? 'Торговый указ отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = setTradeEmbargo(
    game.campaign,
    selectedDiplomacyRealm.value.id,
    embargoed,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent(
    embargoed ? 'Торговля остановлена' : 'Торговля возобновлена',
    result.message,
    embargoed ? 'warning' : 'good',
  )
}

function proposeCampaignAlliance(): void {
  if (!selectedDiplomacyRealm.value) return
  if (sendNetworkDiplomacy('alliance-offer')) return
  const result = formAlliance(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Союзные клятвы', `${selectedDiplomacyRealm.value.name}: ${result.message.toLowerCase()}`, 'good')
}

function answerCampaignAlliance(accept: boolean): void {
  if (!selectedDiplomacyRealm.value || matchStatus.value !== 'online') return
  sendNetworkDiplomacy(accept ? 'alliance-accept' : 'alliance-decline')
}

function declareCampaignWar(): void {
  if (!selectedDiplomacyRealm.value || (localNationEconomy.value?.legitimacy ?? 0) < CAMPAIGN_WAR_LEGITIMACY_COST) {
    notice.value = `Для объявления войны нужно ${CAMPAIGN_WAR_LEGITIMACY_COST} легитимности`
    return
  }
  if (sendNetworkDiplomacy('war')) {
    return
  }
  const result = declareWar(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Объявлена война', `${selectedDiplomacyRealm.value.name}: ${result.message.toLowerCase()}`, 'danger')
}

function offerCampaignTruce(): void {
  if (!selectedDiplomacyRealm.value) return
  if (sendNetworkDiplomacy('truce')) return
  const result = offerTruce(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Заключено перемирие', `${selectedDiplomacyRealm.value.name}: ${result.message.toLowerCase()}`, 'good')
}

function demandCampaignPeace(provinceId: number): void {
  if (!selectedDiplomacyRealm.value) return
  if (sendNetworkDiplomacy('peace-demand', provinceId)) return
  const proposed = proposePeace(
    game.campaign,
    selectedDiplomacyRealm.value.id,
    provinceId,
    localNationId.value,
  )
  if (!proposed.ok) {
    notice.value = proposed.reason
    return
  }
  const accepted = answerPeaceOffer(
    game.campaign,
    localNationId.value,
    true,
    selectedDiplomacyRealm.value.id,
  )
  if (!accepted.ok) {
    notice.value = accepted.reason
    return
  }
  recordDiplomaticEvent('Мирный договор', accepted.message, 'good')
}

function answerCampaignPeace(accept: boolean): void {
  if (!selectedDiplomacyRealm.value) return
  if (matchStatus.value === 'online') {
    sendNetworkDiplomacy(accept ? 'peace-accept' : 'peace-reject')
    return
  }
  const result = answerPeaceOffer(
    game.campaign,
    selectedDiplomacyRealm.value.id,
    accept,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent(
    accept ? 'Мирный договор' : 'Мир отклонён',
    result.message,
    accept ? 'good' : 'warning',
  )
}

function withdrawCampaignPeace(): void {
  if (!selectedDiplomacyRealm.value) return
  if (sendNetworkDiplomacy('peace-withdraw')) return
  const result = withdrawPeaceOffer(
    game.campaign,
    selectedDiplomacyRealm.value.id,
    localNationId.value,
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Посольство отозвано', result.message, 'neutral')
}

function breakCampaignAlliance(): void {
  if (!selectedDiplomacyRealm.value) return
  if (sendNetworkDiplomacy('break-alliance')) return
  const result = breakAlliance(game.campaign, selectedDiplomacyRealm.value.id, localNationId.value)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  recordDiplomaticEvent('Союз разорван', `${selectedDiplomacyRealm.value.name}: ${result.message.toLowerCase()}`, 'warning')
}

function launchCampaignAttack(): void {
  if (!campaignSource.value || !campaignTarget.value) return
  const sourceName = campaignSource.value.name
  const targetName = campaignTarget.value.name
  if (campaignTargetSiege.value && campaignSiegeOrderRole.value) {
    const siegeId = campaignTargetSiege.value.id
    if (matchStatus.value === 'online') {
      const sent = matchClient.command({
        type: 'campaign.siege-march',
        siegeId,
        sourceId: campaignSource.value.id,
        commitment: campaignCommitment.value,
        formation: campaignFormation.value,
      })
      notice.value = sent
        ? campaignSiegeOrderRole.value === 'reinforce'
          ? 'Подкрепление осады отправлено серверным приказом'
          : 'Армия деблокады отправлена серверным приказом'
        : 'Нет связи с сервером матча'
      return
    }
    const result = executeSiegeManeuver(
      game.campaign,
      campaignSource.value.id,
      siegeId,
      campaignCommitment.value,
      localNationId.value,
      campaignFormation.value,
    )
    if ('ok' in result) {
      notice.value = result.reason
      return
    }
    notice.value = result.message
    activeSiegeId.value = game.campaign.sieges.some((siege) => siege.id === siegeId) ? siegeId : null
    campaignTargetId.value = null
    return
  }
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.attack',
      sourceId: campaignSource.value.id,
      targetId: campaignTarget.value.id,
      commitment: campaignCommitment.value,
      formation: campaignFormation.value,
    })
    notice.value = sent ? 'Приказ к походу отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const departedAt = Date.now()
  const result = beginCampaignMarch(
    game.campaign,
    {
      id: `local-march:${game.nextId++}`,
      actorId: localNationId.value,
      sourceId: campaignSource.value.id,
      targetId: campaignTarget.value.id,
      commitmentPercent: campaignCommitment.value,
      formation: campaignFormation.value,
      departedAt,
      arrivesAt: departedAt + OFFLINE_MARCH_LEG_MS,
    },
  )
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  campaignNow.value = departedAt
  notice.value = `${sourceName} → ${targetName} · ${result.march.route.length - 1} перехода`
}

function recallSelectedCampaignMarch(): void {
  if (!selectedSourceMarch.value) return
  if (matchStatus.value !== 'online') {
    notice.value = 'Отзыв похода доступен в общем сетевом мире'
    return
  }
  const sent = matchClient.command({
    type: 'campaign.recall',
    marchId: selectedSourceMarch.value.id,
  })
  notice.value = sent ? 'Гонец отправлен возвращать рать' : 'Нет связи с сервером матча'
}

function chooseSiegeTactic(tactic: CampaignSiegeTactic): void {
  if (!activeSiege.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.siege-tactic',
      siegeId: activeSiege.value.id,
      tactic,
    })
    notice.value = sent ? 'Осадный приказ отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = setSiegeTactic(game.campaign, activeSiege.value.id, tactic, localNationId.value)
  notice.value = result.ok ? result.message : result.reason
}

function retreatActiveSiege(): void {
  if (!activeSiege.value) return
  const siegeId = activeSiege.value.id
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({ type: 'campaign.siege-retreat', siegeId })
    notice.value = sent ? 'Приказ об отходе отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = retreatSiege(game.campaign, siegeId, localNationId.value)
  notice.value = result.ok ? result.message : result.reason
  if (result.ok) activeSiegeId.value = null
}

function sortieActiveSiege(): void {
  if (!activeSiege.value) return
  const siegeId = activeSiege.value.id
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({ type: 'campaign.siege-sortie', siegeId })
    notice.value = sent ? 'Приказ о вылазке отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = sortieSiege(game.campaign, siegeId, localNationId.value)
  notice.value = result.ok ? result.message : result.reason
  if (result.ok && !game.campaign.sieges.some((siege) => siege.id === siegeId)) activeSiegeId.value = null
}

function focusSiege(siegeId: string): void {
  const siege = game.campaign.sieges.find((item) => item.id === siegeId)
  if (!siege) return
  activeSiegeId.value = siege.id
  const target = game.campaign.provinces.find((province) => province.id === siege.targetId)
  if (target?.owner === localNationId.value) {
    campaignSourceId.value = target.id
    campaignTargetId.value = null
  } else {
    campaignTargetId.value = target?.id ?? null
  }
  notice.value = `${target?.name ?? 'Крепость'} · открыт осадный совет`
}

function musterCampaignProvince(): void {
  if (!campaignSource.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({ type: 'campaign.muster', provinceId: campaignSource.value.id })
    notice.value = sent ? 'Приказ наместнику отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = musterProvince(game.campaign, campaignSource.value.id, localNationId.value)
  notice.value = result.ok ? result.message : result.reason
  if (!result.ok) return
  campaignEventProvinceId.value = campaignSource.value.id
  window.clearTimeout(campaignEventTimer)
  campaignEventTimer = window.setTimeout(() => {
    campaignEventProvinceId.value = null
    campaignEventTimer = 0
  }, 2200)
}

function openProvinceDevelopment(): void {
  if (!campaignCanManage.value) return
  activeDrawer.value = 'domain'
  notice.value = `${campaignSource.value?.name ?? 'Владение'} · открыт совет наместника`
}

function developCampaignProvince(project: ProvinceProjectKind): void {
  if (!campaignSource.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.develop',
      provinceId: campaignSource.value.id,
      project,
    })
    notice.value = sent ? 'Строительный приказ отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = startProvinceProject(
    game.campaign,
    campaignSource.value.id,
    project,
    localNationId.value,
  )
  notice.value = result.ok ? result.message : result.reason
  if (!result.ok) return
  campaignEventProvinceId.value = campaignSource.value.id
}

function setCampaignDefense(formation: FormationShape): void {
  if (!campaignSource.value) return
  if (matchStatus.value === 'online') {
    const sent = matchClient.command({
      type: 'campaign.defense',
      provinceId: campaignSource.value.id,
      formation,
    })
    notice.value = sent ? 'Оборонный приказ отправлен серверу' : 'Нет связи с сервером матча'
    return
  }
  const result = setProvinceDefenseFormation(
    game.campaign,
    campaignSource.value.id,
    formation,
    localNationId.value,
  )
  notice.value = result.ok ? result.message : result.reason
}

function buildAt(point: { x: number; y: number }): void {
  if (!selectedTool.value) return
  if (selectedTool.value === 'road' || selectedTool.value === 'wall') {
    buildPath([point])
    return
  }
  const kind = selectedTool.value
  const result = placeBuilding(game, kind, point)
  notice.value = result.ok ? `${byzantineMacedonian.buildings[kind]} заложена` : result.reason
}

function buildPath(points: Array<{ x: number; y: number }>): void {
  if (selectedTool.value !== 'road' && selectedTool.value !== 'wall') return
  const result = placePath(game, selectedTool.value, points)
  notice.value = result.ok
    ? selectedTool.value === 'road'
      ? `Проложено клеток улицы: ${result.placed}`
      : `Возведено секций стены: ${result.placed}`
    : result.reason
}

function defendCity(): void {
  if (!primaryThreat.value) {
    notice.value = 'Разведка не видит доступных целей'
    return
  }
  if (battleVisible.value || primaryThreat.value.status === 'withdrawing') {
    notice.value = 'Сражение уже идёт'
    return
  }
  window.clearTimeout(battleTimer)
  battleVisible.value = true
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleExecuting.value = false
  battleFormations.value = createBattleFormations()
  selectedFormationId.value = 'militia'
  realmMode.value = false
  campaignSourceId.value = null
  campaignTargetId.value = null
  activeSiegeId.value = null
  campaignEventProvinceId.value = null
  selectedDiplomacyRealmId.value = null
  activeBattleThreatId.value = primaryThreat.value.id
  notice.value = 'Разверните четыре построения и отдайте приказ к бою'
}

function selectFormation(formationId: FormationKind): void {
  if (!battleVisible.value || battleOutcome.value || battleExecuting.value) return
  selectedFormationId.value = formationId
  tacticalCommand.value = true
  selectedTool.value = null
  closeDrawer()
  const formation = battleFormations.value.find((item) => item.id === formationId)
  notice.value = `${formation?.soldiers ?? 0} ратников выбраны · укажите точку построения на карте`
}

function setFormationShape(shape: FormationShape): void {
  if (!battleVisible.value || battleOutcome.value || battleExecuting.value) return
  battleFormations.value = battleFormations.value.map((formation) => (
    formation.id === selectedFormationId.value ? { ...formation, shape } : formation
  ))
  tacticalCommand.value = true
  notice.value = 'Построение выбрано · укажите позицию на карте'
}

function commandFormation(point: Point): void {
  if (!tacticalCommand.value || !battleVisible.value || battleOutcome.value || battleExecuting.value) return
  battleFormations.value = battleFormations.value.map((formation) => (
    formation.id === selectedFormationId.value ? { ...formation, target: { ...point } } : formation
  ))
  const next = battleFormations.value.find((formation) => !formation.target)
  if (next) {
    selectedFormationId.value = next.id
    tacticalCommand.value = true
    notice.value = `Приказ принят · теперь разверните ещё ${battleFormations.value.filter((formation) => !formation.target).length} построения`
  } else {
    tacticalCommand.value = false
    notice.value = `Боевой порядок готов · расчётная сила ${battleAssessment.value.defenseStrength}`
  }
}

function executeBattlePlan(): void {
  if (!battleAssessment.value.ready || battleExecuting.value || battleOutcome.value) return
  battleExecuting.value = true
  tacticalCommand.value = false
  notice.value = 'Знамёна подняты · построения исполняют приказ'
  window.clearTimeout(battleTimer)
  battleTimer = window.setTimeout(resolveActiveRaid, stressMode ? 1600 : 2400)
}

function resolveActiveRaid(): void {
  if (!battleVisible.value || battleOutcome.value || activeBattleThreatId.value === null) return
  window.clearTimeout(battleTimer)
  battleTimer = 0
  const threatId = activeBattleThreatId.value
  const result = resolveRaid(game, threatId, battleAssessment.value.defenseStrength)
  battleOutcome.value = result.outcome
  burningBuildingIds.value = result.burningBuildingIds
  notice.value = result.outcome === 'victory'
    ? `Налёт отбит по вашему плану · враг потерял ${result.enemyLosses}, город — ${result.cityLosses}`
    : `Боевой порядок прорван · потери города ${result.cityLosses}`
  battleTimer = window.setTimeout(() => {
    battleTimer = 0
    battleVisible.value = false
    tacticalCommand.value = false
    battleExecuting.value = false
    battleFormations.value = createBattleFormations()
    activeBattleThreatId.value = null
    burningBuildingIds.value = []
    if (result.outcome === 'victory') dismissThreat(game, threatId, 'defeat')
  }, stressMode ? 8000 : 4800)
}

function toggleDrawer(drawer: Drawer): void {
  if (activeDrawer.value === 'object') selectedBuildingId.value = null
  activeDrawer.value = activeDrawer.value === drawer ? null : drawer
}

function closeObjectDrawer(): void {
  if (activeDrawer.value === 'object') activeDrawer.value = null
  selectedBuildingId.value = null
}

function closeDrawer(): void {
  closeObjectDrawer()
  activeDrawer.value = null
}

function selectBuilding(buildingId: number): void {
  const building = game.buildings.find((item) => item.id === buildingId)
  if (!building) return
  selectedTool.value = null
  selectedBuildingId.value = buildingId
  activeDrawer.value = 'object'
  notice.value = `${byzantineMacedonian.buildings[building.kind]} · объект выбран`
}

function cancelInteraction(): void {
  if (tacticalCommand.value) {
    tacticalCommand.value = false
    notice.value = 'Выбор построения снят · выданные приказы сохранены'
    return
  }
  const hadObject = selectedBuildingId.value !== null
  selectedTool.value = null
  closeObjectDrawer()
  notice.value = hadObject ? 'Выбор объекта снят' : 'Строительство отменено'
}

function repairSelected(): void {
  if (!selectedBuilding.value) return
  const result = repairBuilding(game, selectedBuilding.value.id)
  notice.value = result.ok ? 'Ремонт завершён' : result.reason
}

function demolishSelected(): void {
  if (!selectedBuilding.value) return
  const result = demolishBuilding(game, selectedBuilding.value.id)
  notice.value = result.ok ? 'Участок расчищен, пригодные материалы возвращены' : result.reason
  if (result.ok) closeObjectDrawer()
}

function handleCrisis(crisisId: number, response: CrisisResponse = 'fund'): void {
  const result = addressCrisis(game, crisisId, response)
  notice.value = result.ok ? result.summary : result.reason
}

function saveSettlement(): void {
  localStorage.setItem('openfront:autosave', encodeSave(game, {
    presetId: byzantineMacedonian.id,
    camera: gameWorld.value?.snapshotCamera() ?? { targetX: 32, targetZ: 32, zoom: 1, quarter: 0 },
  }))
  notice.value = 'Княжество сохранено'
}

function loadSettlement(): void {
  const saved = localStorage.getItem('openfront:autosave')
  if (!saved) {
    notice.value = 'Сохранение не найдено'
    return
  }
  const result = decodeSave(saved)
  if (!result.ok) {
    notice.value = result.reason
    return
  }
  Object.assign(game, result.state)
  if (matchStatus.value === 'offline') localNationId.value = game.campaign.playerRealmId
  window.clearTimeout(battleTimer)
  battleTimer = 0
  closeDrawer()
  battleVisible.value = false
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleExecuting.value = false
  battleFormations.value = createBattleFormations()
  selectedFormationId.value = 'militia'
  realmMode.value = false
  campaignSourceId.value = null
  campaignTargetId.value = null
  activeSiegeId.value = null
  campaignEventProvinceId.value = null
  selectedDiplomacyRealmId.value = null
  activeBattleThreatId.value = null
  notice.value = 'Летопись княжества восстановлена'
  void nextTick(() => gameWorld.value?.restoreCamera(result.meta.camera))
}

function newWorld(): void {
  window.clearTimeout(battleTimer)
  battleTimer = 0
  const next = createGame(`porphyry-${17 + worldCounter}`)
  worldCounter += 1
  Object.assign(game, next)
  if (matchStatus.value === 'offline') localNationId.value = game.campaign.playerRealmId
  closeDrawer()
  revealThreat(game, worldCounter % 2 === 0 ? 'scouts' : 'raiders', 34 + worldCounter * 7)
  battleVisible.value = false
  battleOutcome.value = null
  burningBuildingIds.value = []
  tacticalCommand.value = false
  battleExecuting.value = false
  battleFormations.value = createBattleFormations()
  selectedFormationId.value = 'militia'
  realmMode.value = false
  campaignSourceId.value = null
  campaignTargetId.value = null
  campaignEventProvinceId.value = null
  selectedDiplomacyRealmId.value = null
  activeBattleThreatId.value = null
  notice.value = `Открыта новая фема · ${game.map.seed}`
}

const timer = window.setInterval(() => {
  if (speed.value === 0 || matchStatus.value === 'online') return
  const departedAt = Date.now()
  const reports = advanceGame(game, speed.value, {
    campaignMarchTiming: {
      departedAt,
      legDurationMs: OFFLINE_MARCH_LEG_MS,
    },
  })
  campaignNow.value = departedAt
  if (activeSiegeId.value && !game.campaign.sieges.some((siege) => siege.id === activeSiegeId.value)) {
    activeSiegeId.value = null
  }
  if (!realmMode.value || reports.length === 0) return
  const latestReport = reports.at(-1)!
  notice.value = latestReport.message
  const campaignEvent = [...reports].reverse().find((report) => (
    (report.kind === 'conquest' || report.kind === 'march-started') && report.provinceId !== null
  ))
  if (!campaignEvent) return
  campaignEventProvinceId.value = campaignEvent.provinceId
  window.clearTimeout(campaignEventTimer)
  campaignEventTimer = window.setTimeout(() => {
    campaignEventProvinceId.value = null
    campaignEventTimer = 0
  }, 3200)
}, 3500)
const marchClockTimer = window.setInterval(() => {
  if (game.campaign.marches.length === 0) return
  campaignNow.value = Date.now()
  if (matchStatus.value !== 'online') {
    presentLocalMarchResolutions(resolveCampaignMarches(game.campaign, campaignNow.value))
  }
}, 250)
onUnmounted(() => {
  matchClient.disconnect()
  window.clearInterval(timer)
  window.clearInterval(marchClockTimer)
  window.clearTimeout(battleTimer)
  window.clearTimeout(campaignEventTimer)
})
</script>

<template>
  <main :class="['game-shell', { 'stress-mode': stressMode }]" data-testid="game-shell">
    <section class="world" aria-label="Карта княжества" data-testid="world">
      <GameWorld
        ref="gameWorld"
        :seed="game.map.seed"
        :buildings="game.buildings"
        :campaign="game.campaign"
        :campaign-mode="realmMode"
        :campaign-source-province-id="campaignSourceId"
        :campaign-target-province-id="campaignTargetId"
        :campaign-event-province-id="campaignEventProvinceId"
        :selected-tool="selectedTool"
        :selected-building-id="selectedBuildingId"
        :building-names="byzantineMacedonian.buildings"
        :building-details="byzantineMacedonian.buildingDetails"
        :battle-visible="battleVisible"
        :battle-outcome="battleOutcome"
        :tactical-command="tacticalCommand"
        :battle-formations="battleFormations"
        :selected-formation-id="selectedFormationId"
        :battle-executing="battleExecuting"
        :burning-building-ids="burningBuildingIds"
        :stress-mode="stressMode"
        @build="buildAt"
        @build-path="buildPath"
        @select="selectBuilding"
        @campaign-select="selectCampaignProvince"
        @battle-command="commandFormation"
        @cancel="cancelInteraction"
      />
      <div class="world-vignette"></div>
      <div v-if="primaryThreat" class="raid-marker">
        <Shield :size="18" />
        <div><strong>{{ byzantineMacedonian.threats[0] }}</strong><span>{{ threatStatus }} · сила около {{ primaryThreat.strength }}</span></div>
      </div>
      <div v-if="!realmMode" :class="['realm-outlook', outlook.level]" data-testid="realm-outlook">
        <Wheat :size="17" />
        <div><strong>Амбары</strong><span v-if="outlook.reserveDays === null"><TrendingUp :size="12" /> +{{ outlook.dailyFood }} в день</span><span v-else><TrendingDown :size="12" /> {{ outlook.reserveDays }} дн. · {{ outlook.dailyFood }} в день</span></div>
      </div>
      <div v-if="realmMode && (campaignMarches.length || campaignResolutionMessages.length)" class="campaign-march-summary" data-testid="campaign-march-summary">
        <Navigation :size="18" />
        <div>
          <strong v-if="campaignMarches.length">{{ campaignMarchSummaryTitle }}</strong>
          <strong v-else>Исходы походов</strong>
          <span v-for="march in campaignMarches.slice(0, 3)" :key="march.id" :data-march="march.id">
            {{ march.actor }} → {{ march.target }} · {{ march.purposeLabel }} · маршрут {{ march.routeLegs }} · {{ march.formationLabel }} · {{ march.soldiers }} · {{ marchEta(march) }} с
          </span>
          <span v-for="message in campaignResolutionMessages" :key="message">{{ message }}</span>
        </div>
      </div>
      <div v-if="realmMode && campaignSieges.length" class="campaign-siege-summary" data-testid="campaign-siege-summary">
        <TentTree :size="18" />
        <div>
          <strong>{{ campaignSieges.length === 1 ? 'Осада на карте' : `Осады на карте: ${campaignSieges.length}` }}</strong>
          <button
            v-for="siege in campaignSieges"
            :key="siege.id"
            :class="{ active: siege.id === activeSiegeId }"
            :data-siege="siege.id"
            @click="focusSiege(siege.id)"
          >
            {{ siege.attacker }} → {{ siege.target }} · {{ siege.progress }}%
          </button>
        </div>
      </div>
      <div v-if="battleVisible" class="battle-report" data-testid="battle-report">
        <Flame :size="17" />
        <div>
          <strong>Схватка у Северных ворот</strong>
          <span>{{ battleOutcome === 'victory' ? 'Враг дрогнул и отходит' : battleOutcome === 'defeat' ? 'Налётчики рвутся к амбарам' : battleExecuting ? 'Построения сошлись с противником' : `Боевой порядок: ${battleAssessment.orderedFormations}/4 · 60 налётчиков` }}</span>
        </div>
      </div>
      <div v-if="!realmMode" class="town-label"><span>{{ byzantineMacedonian.cityName }}</span><i>Порядок {{ game.order }} · легитимность {{ game.legitimacy }}</i></div>
      <div v-else class="campaign-title" data-testid="campaign-title">
        <span>{{ localNation?.name }}</span>
        <i>{{ playerProvinceCount }} провинций · {{ playerCampaignLevies }} ратников<b v-if="localNation?.status === 'defeated'" class="realm-defeated-label"> · держава разгромлена</b></i>
        <i class="campaign-income" data-testid="campaign-income">День {{ game.campaign.tick }} · казна {{ localNationEconomy?.silver ?? 0 }} · +{{ localNationIncome }} в день</i>
        <i v-if="matchStatus === 'online'" class="match-revision" data-testid="match-revision">Матч {{ matchRoomId }} · ревизия {{ matchRevision }}</i>
        <nav class="campaign-ledger" data-testid="campaign-ledger" aria-label="Соседние державы">
          <button
            v-for="rival in campaignRivals"
            :key="rival.realm.id"
            :class="[
              `realm-${rival.realm.id}`,
              `status-${rival.relation.status}`,
              rival.offerDirection ? `offer-${rival.offerDirection}` : '',
              { defeated: rival.defeated, 'trade-active': rival.tradeActive },
            ]"
            :data-realm="rival.realm.id"
            :disabled="rival.defeated"
            @click="openCampaignDiplomacy(rival.realm.id)"
          >
            <b>{{ rival.shortName }}</b><small>{{ rival.provinceCount }} земель · {{ rival.statusLabel }}</small>
          </button>
        </nav>
      </div>
      <section
        v-if="realmMode && campaignOutcome"
        :class="['campaign-outcome', campaignOutcome.kind]"
        :data-outcome="campaignOutcome.kind"
        data-testid="campaign-outcome"
      >
        <Crown v-if="campaignOutcome.kind === 'victory'" :size="28" />
        <ShieldX v-else :size="28" />
        <div>
          <strong>{{ campaignOutcome.title }}</strong>
          <span>{{ campaignOutcome.text }}</span>
          <small>{{ matchStatus === 'online' ? 'Общая карта остаётся доступна для наблюдения' : 'Итог сохранится вместе с летописью кампании' }}</small>
        </div>
      </section>
      <div v-if="constructionHint" class="construction-hint" data-testid="construction-hint">{{ constructionHint }}</div>
      <div v-if="notice" class="notice" data-testid="notice">{{ notice }}</div>
    </section>

    <TopHud
      :city-name="realmMode ? localNation?.shortName ?? 'Держава' : byzantineMacedonian.cityName"
      :seed="game.map.seed"
      :season="game.season"
      :year="game.year"
      :day="game.day"
      :campaign-day="game.campaign.tick"
      :speed="speed"
      :resources="topResources"
      :realm-mode="realmMode"
      :match-status="matchStatus"
      @speed="chooseSpeed"
      @new-world="newWorld"
      @save="saveSettlement"
      @load="loadSettlement"
      @toggle-drawer="toggleDrawer"
      @toggle-realm="toggleRealmMode"
    />

    <EdgeDrawer v-if="activeDrawer === 'multiplayer'" title="Сетевой матч" @close="closeDrawer">
      <MultiplayerLobby
        :status="matchStatus"
        :phase="matchPhase"
        :room-id="matchRoomId"
        :local-nation-id="localNationId"
        :self-ready="localMatchPlayer?.ready ?? false"
        :nations="NATIONS"
        :players="matchPlayers"
        :error="matchError"
        @join="joinMatch"
        @ready="setMatchReady"
        @leave="leaveMatch"
      />
    </EdgeDrawer>

    <EdgeDrawer v-if="activeDrawer === 'chronicle'" title="Летопись" @close="closeDrawer">
      <article v-for="event in [...game.events].reverse().slice(0, 8)" :key="event.id" :class="['drawer-entry', event.tone]">
        <time>{{ event.day }} день</time><strong>{{ event.title }}</strong><p>{{ event.text }}</p>
      </article>
    </EdgeDrawer>

    <EdgeDrawer v-if="activeDrawer === 'intel'" title="Разведка" @close="closeDrawer">
      <div class="threat-summary"><Shield :size="28" /><strong>{{ primaryThreat?.strength ?? 0 }}</strong><span>Северо-восток</span></div>
      <h3>{{ byzantineMacedonian.threats[0] }}</h3>
      <p>Передовые разъезды движутся к дороге на Порфирополис. Состав войска уточняется.</p>
      <ul class="political-actors"><li v-for="actor in byzantineMacedonian.threats" :key="actor">{{ actor }}</li></ul>
    </EdgeDrawer>

    <EdgeDrawer v-if="activeDrawer === 'court'" title="Двор стратега" @close="closeDrawer">
      <div class="court-balance">
        <div><span>Порядок</span><strong>{{ game.order }}</strong><i><b :style="{ width: `${game.order}%` }"></b></i></div>
        <div><span>Легитимность</span><strong>{{ game.legitimacy }}</strong><i><b :style="{ width: `${game.legitimacy}%` }"></b></i></div>
      </div>
      <p v-if="game.crises.length === 0" class="court-calm">Кризисов нет. Двор сохраняет хрупкое равновесие.</p>
      <article v-for="crisis in game.crises" :key="crisis.id" class="crisis-card" :data-crisis="crisis.kind">
        <header><strong>{{ byzantineMacedonian.crises[crisis.kind].title }}</strong><span>{{ crisis.pressure }}</span></header>
        <div class="crisis-pressure"><i :style="{ width: `${crisis.pressure}%` }"></i></div>
        <div class="crisis-actions">
          <button :class="{ recommended: recommendedCrisisResponse(game, crisis) === 'fund' }" data-action="address-crisis" @click="handleCrisis(crisis.id, 'fund')"><span>{{ byzantineMacedonian.crises[crisis.kind].action }}</span><small>{{ byzantineMacedonian.crises[crisis.kind].cost }}</small><b v-if="recommendedCrisisResponse(game, crisis) === 'fund'">Совет Двора</b></button>
          <button :class="{ recommended: recommendedCrisisResponse(game, crisis) === 'hardline' }" data-action="address-crisis-hardline" @click="handleCrisis(crisis.id, 'hardline')"><span>{{ byzantineMacedonian.crises[crisis.kind].alternative }}</span><small>{{ byzantineMacedonian.crises[crisis.kind].alternativeCost }}</small><b v-if="recommendedCrisisResponse(game, crisis) === 'hardline'">Совет Двора</b></button>
        </div>
      </article>
    </EdgeDrawer>

    <EdgeDrawer
      v-if="activeDrawer === 'domain' && campaignSource"
      title="Управление владением"
      @close="closeDrawer"
    >
      <ProvinceDevelopmentPanel
        :province="campaignSource"
        :campaign-day="game.campaign.tick"
        :treasury="localNationEconomy?.silver ?? 0"
        :can-manage="campaignCanManage"
        @develop="developCampaignProvince"
      />
    </EdgeDrawer>

    <EdgeDrawer
      v-if="activeDrawer === 'diplomacy' && selectedDiplomacyRealm && selectedDiplomacyRelation"
      title="Посольство"
      @close="closeDrawer"
    >
      <DiplomacyPanel
        :realm="selectedDiplomacyRealm"
        :relation="selectedDiplomacyRelation"
        :province-count="realmProvinceCount(game.campaign, selectedDiplomacyRealm.id)"
        :strength="realmStrength(game.campaign, selectedDiplomacyRealm.id)"
        :silver="localNationEconomy?.silver ?? 0"
        :target-silver="selectedDiplomacyEconomy?.silver ?? 0"
        :legitimacy="localNationEconomy?.legitimacy ?? 0"
        :alliance-offer="selectedDiplomacyOfferDirection"
        :war-score="selectedWarScore"
        :peace-offer="selectedPeaceOfferDirection"
        :peace-demand-name="selectedPeaceDemand?.name ?? null"
        :peace-demand-candidates="selectedPeaceDemandCandidates"
        :peace-demand-threshold="CAMPAIGN_PEACE_DEMAND_SCORE"
        :networked="matchStatus === 'online'"
        :target-player-available="selectedDiplomacyTargetAvailable"
        :support-source="campaignSource"
        :support-target="allianceSupportTarget"
        :support-commitment="campaignCommitment"
        :support-reason="allianceSupportReason"
        :trade-source="tradeRouteSource"
        :trade-target="tradeRouteTarget"
        :trade-active="selectedTradeRoute !== null"
        :trade-income="selectedTradeIncome"
        :trade-embargo="tradeEmbargoStatus"
        :trade-reason="tradeRouteReason"
        @gift="sendDiplomaticGift"
        @alliance-silver="transferAllianceSilver"
        @alliance-support="sendAllianceReinforcement"
        @open-trade="establishTradeRoute"
        @embargo-trade="updateTradePolicy(true)"
        @resume-trade="updateTradePolicy(false)"
        @alliance="proposeCampaignAlliance"
        @accept-alliance="answerCampaignAlliance(true)"
        @decline-alliance="answerCampaignAlliance(false)"
        @war="declareCampaignWar"
        @truce="offerCampaignTruce"
        @demand-peace="demandCampaignPeace"
        @accept-peace="answerCampaignPeace(true)"
        @reject-peace="answerCampaignPeace(false)"
        @withdraw-peace="withdrawCampaignPeace"
        @break-alliance="breakCampaignAlliance"
      />
    </EdgeDrawer>

    <EdgeDrawer
      v-if="activeDrawer === 'object' && selectedBuilding"
      :title="byzantineMacedonian.buildings[selectedBuilding.kind]"
      @close="closeDrawer"
    >
      <section class="object-card" data-testid="object-card">
        <div class="object-seal"><span>{{ selectedBuilding.id }}</span><small>участок</small></div>
        <dl>
          <div><dt>Состояние</dt><dd>{{ selectedBuilding.health }}%</dd></div>
          <div><dt>Готовность</dt><dd>{{ Math.round(selectedBuilding.progress * 100) }}%</dd></div>
          <div><dt>Координаты</dt><dd>{{ selectedBuilding.x }} · {{ selectedBuilding.y }}</dd></div>
        </dl>
        <div class="condition-track"><i :style="{ width: `${selectedBuilding.health}%` }"></i></div>
        <div class="object-purpose"><strong>{{ byzantineMacedonian.buildingDetails[selectedBuilding.kind].role }}</strong><span>{{ byzantineMacedonian.buildingDetails[selectedBuilding.kind].effect }}</span></div>
        <p>Расход ремонта зависит от повреждений. При разборе четверть пригодных материалов возвращается на склад.</p>
        <div class="object-actions">
          <button data-action="repair-building" :disabled="selectedBuilding.health >= 100" @click="repairSelected">
            <Hammer :size="17" /><span>Ремонтировать</span>
          </button>
          <button data-action="demolish-building" :disabled="selectedBuilding.kind === 'townHall'" @click="demolishSelected">
            <Trash2 :size="17" /><span>Разобрать</span>
          </button>
        </div>
        <small v-if="selectedBuilding.kind === 'townHall'" class="protected-note">Дворец — неразбираемый центр управления.</small>
      </section>
    </EdgeDrawer>

    <BattleCommandBar
      v-if="battleVisible"
      :formations="battleFormations"
      :selected-formation-id="selectedFormationId"
      :assessment="battleAssessment"
      :executing="battleExecuting"
      :outcome="battleOutcome"
      @select="selectFormation"
      @shape="setFormationShape"
      @execute="executeBattlePlan"
    />

    <SiegeCommandBar
      v-else-if="realmMode && !campaignOutcome && activeSiege && activeSiegeTarget && activeSiegeAttacker && activeSiegeDefender"
      :siege="activeSiege"
      :target="activeSiegeTarget"
      :attacker-name="activeSiegeAttacker.shortName"
      :defender-name="activeSiegeDefender.shortName"
      :local-role="activeSiegeRole"
      :treasury="localNationEconomy?.silver ?? 0"
      :blockade-progress="activeSiegeProgressRates.blockade"
      :sappers-progress="activeSiegeProgressRates.sappers"
      @tactic="chooseSiegeTactic"
      @retreat="retreatActiveSiege"
      @sortie="sortieActiveSiege"
      @close="activeSiegeId = null"
    />

    <CampaignCommandBar
      v-else-if="realmMode && !campaignOutcome"
      :source="campaignSource"
      :target="campaignTarget"
      :target-realm="campaignTargetRealm"
      :relation="campaignTargetRelation"
      :realm-name="localNation?.name ?? 'Держава'"
      :active-march="selectedSourceMarch"
      :now="campaignNow"
      :order-kind="campaignOrderKind"
      :can-attack="campaignCanAttack"
      :route-legs="selectedCampaignRouteLegs"
      :commitment="campaignCommitment"
      :formation="campaignFormation"
      :province-count="playerProvinceCount"
      :total-levies="playerCampaignLevies"
      :treasury="localNationEconomy?.silver ?? 0"
      :daily-income="localNationIncome"
      :can-muster="campaignCanMuster"
      :can-manage="campaignCanManage"
      :defense-locked="campaignDefenseLocked"
      @commitment="campaignCommitment = $event"
      @formation="campaignFormation = $event"
      @defense="setCampaignDefense"
      @attack="launchCampaignAttack"
      @recall="recallSelectedCampaignMarch"
      @muster="musterCampaignProvince"
      @domain="openProvinceDevelopment"
      @diplomacy="openCampaignDiplomacy()"
      @return-city="toggleRealmMode"
    />

    <ModeBar
      v-else-if="!realmMode"
      :mode="mode"
      :selected-tool="selectedTool"
      :attack-state="battleVisible || primaryThreat?.status === 'withdrawing' ? 'battle' : primaryThreat ? 'ready' : 'none'"
      :preset="byzantineMacedonian"
      @mode="chooseMode"
      @tool="chooseTool"
      @attack="defendCity"
    />
  </main>
</template>
