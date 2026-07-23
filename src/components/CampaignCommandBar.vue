<script setup lang="ts">
import { ArrowRight, Castle, ChevronsRight, Coins, Crown, Flag, Handshake, Landmark, MapPinned, Shield, Swords, Target, Undo2, Users } from '@lucide/vue'
import type { Component } from 'vue'
import {
  CAMPAIGN_COMMITMENT_MAX,
  CAMPAIGN_COMMITMENT_MIN,
  CAMPAIGN_COMMITMENT_STEP,
  CAMPAIGN_MUSTER_COST,
  isCampaignCommitment,
  type CampaignCommitment,
  type CampaignMarch,
  type DiplomaticRelation,
  type Province,
  type Realm,
} from '../game/campaign'
import {
  FORMATION_SHAPE_LABELS,
  FORMATION_SHAPES,
  type FormationShape,
} from '../game/tactics'

defineProps<{
  source: Province | null
  target: Province | null
  targetRealm: Realm | null
  relation: DiplomaticRelation | null
  realmName: string
  activeMarch: CampaignMarch | null
  now: number
  orderKind: 'attack' | 'siege-reinforce' | 'siege-relief'
  canAttack: boolean
  routeLegs: number
  commitment: CampaignCommitment
  formation: FormationShape
  provinceCount: number
  totalLevies: number
  treasury: number
  dailyIncome: number
  canMuster: boolean
  canManage: boolean
  defenseLocked: boolean
}>()

const emit = defineEmits<{
  commitment: [value: CampaignCommitment]
  formation: [value: FormationShape]
  defense: [value: FormationShape]
  attack: []
  recall: []
  diplomacy: []
  muster: []
  domain: []
  returnCity: []
}>()

const formationIcons: Record<FormationShape, Component> = {
  line: ChevronsRight,
  shieldwall: Shield,
  wedge: Target,
}
const formationShortLabels: Record<FormationShape, string> = {
  line: 'Линия',
  shieldwall: 'Щиты',
  wedge: 'Клин',
}
const relationLabels = {
  war: 'война',
  neutral: 'нейтралитет',
  truce: 'перемирие',
  alliance: 'союз',
}
const orderLabels = {
  attack: 'Начать поход',
  'siege-reinforce': 'Усилить осаду',
  'siege-relief': 'Деблокировать',
}

function updateCommitment(event: Event): void {
  const value = Number((event.currentTarget as HTMLInputElement).value)
  if (isCampaignCommitment(value)) emit('commitment', value)
}
</script>

<template>
  <footer class="campaign-dock period-frame" data-testid="campaign-command-bar">
    <section class="realm-summary">
      <MapPinned :size="21" />
      <div>
        <strong>{{ realmName }}</strong>
        <span>{{ provinceCount }} провинций · {{ totalLevies }} ратников</span>
        <span class="realm-treasury"><Coins :size="11" /> {{ treasury }} · +{{ dailyIncome }} в день</span>
      </div>
      <nav class="realm-management" aria-label="Управление провинцией">
        <button data-action="return-city" title="Вернуться в столицу" @click="$emit('returnCity')"><Castle :size="16" /><span>Столица</span></button>
        <button data-action="campaign-muster" :disabled="!canMuster" :title="`Собрать ополчение за ${CAMPAIGN_MUSTER_COST} номисм`" @click="$emit('muster')"><Users :size="16" /><span>Сбор {{ CAMPAIGN_MUSTER_COST }}</span></button>
        <button data-action="open-domain" :disabled="!canManage" title="Управлять посадом, торгом и укреплениями" @click="$emit('domain')"><Landmark :size="16" /><span>Владение</span></button>
      </nav>
    </section>

    <section class="front-command">
      <article :class="['province-order', { selected: source }]" data-testid="campaign-source">
        <Shield :size="20" />
        <div>
          <small>Исходная провинция</small>
          <strong>{{ source?.name ?? 'Выберите свою землю' }}</strong>
          <span v-if="source"><Users :size="12" /> {{ source.levies }} ополчения · посад {{ source.cityLevel }} · торг {{ source.marketLevel }} · стены {{ source.fortificationLevel }}</span>
          <nav v-if="source" class="province-defense" aria-label="Оборонный строй">
            <span>Оборона</span>
            <button
              v-for="shape in FORMATION_SHAPES"
              :key="shape"
              :class="{ active: source.defenseFormation === shape }"
              :data-defense-formation="shape"
              :disabled="defenseLocked"
              :title="FORMATION_SHAPE_LABELS[shape]"
              @click="$emit('defense', shape)"
            ><component :is="formationIcons[shape]" :size="12" /></button>
          </nav>
        </div>
      </article>
      <ArrowRight class="front-arrow" :size="20" />
      <article :class="['province-order target', { selected: target }]" data-testid="campaign-target">
        <Flag :size="20" />
        <div>
          <small>Цель похода</small>
          <strong>{{ target?.name ?? 'Выберите цель похода' }}</strong>
          <span v-if="target"><Users :size="12" /> {{ target.levies }} защитников · {{ FORMATION_SHAPE_LABELS[target.defenseFormation].toLowerCase() }} · стены {{ target.fortificationLevel }}</span>
          <span v-if="target && routeLegs > 0"><MapPinned :size="12" /> Маршрут: {{ routeLegs }} {{ routeLegs === 1 ? 'переход' : routeLegs < 5 ? 'перехода' : 'переходов' }}</span>
          <b v-if="target?.owner && target.capitalOf === target.owner" class="capital-seat"><Crown :size="12" /> Столица державы</b>
          <button v-if="targetRealm && relation" class="open-diplomacy" data-action="open-diplomacy" @click="$emit('diplomacy')">
            <Handshake :size="13" /><span>Посольство · {{ relationLabels[relation.status] }}</span>
          </button>
        </div>
      </article>
    </section>

    <section class="levy-command">
      <span class="rail-title">Доля и походный строй</span>
      <div class="campaign-order-options">
        <label class="commitment-control">
          <span>Рать <output data-testid="campaign-commitment-value">{{ commitment }}%</output></span>
          <input
            type="range"
            data-field="campaign-commitment"
            aria-label="Доля войска в походе"
            :min="CAMPAIGN_COMMITMENT_MIN"
            :max="CAMPAIGN_COMMITMENT_MAX"
            :step="CAMPAIGN_COMMITMENT_STEP"
            :value="commitment"
            @input="updateCommitment"
          />
        </label>
        <div class="march-formation-options" aria-label="Походный строй">
          <button
            v-for="shape in FORMATION_SHAPES"
            :key="shape"
            :class="{ active: formation === shape }"
            :data-march-formation="shape"
            :title="FORMATION_SHAPE_LABELS[shape]"
            @click="$emit('formation', shape)"
          ><component :is="formationIcons[shape]" :size="14" /><span>{{ formationShortLabels[shape] }}</span></button>
        </div>
      </div>
      <button
        :class="['campaign-attack', orderKind, { recall: activeMarch }]"
        :data-action="activeMarch ? 'campaign-recall' : 'campaign-attack'"
        :data-order-kind="orderKind"
        :disabled="!activeMarch && !canAttack"
        @click="activeMarch ? $emit('recall') : $emit('attack')"
      >
        <Undo2 v-if="activeMarch" :size="20" />
        <Users v-else-if="orderKind === 'siege-reinforce'" :size="20" />
        <Shield v-else-if="orderKind === 'siege-relief'" :size="20" />
        <Swords v-else :size="20" />
        <span>{{ activeMarch ? 'Отозвать поход' : orderLabels[orderKind] }}</span>
        <small v-if="activeMarch">маршрут {{ activeMarch.route.length - 1 }} · потери 25% · {{ Math.max(0, Math.ceil((activeMarch.arrivesAt - now) / 1000)) }} с</small>
        <small v-else-if="source">
          {{ orderKind === 'siege-relief' ? 'к стенам' : orderKind === 'siege-reinforce' ? 'в лагерь' : 'отправить' }}
          {{ Math.floor(source.levies * commitment / 100) }}<template v-if="routeLegs > 0"> · {{ routeLegs }} пер.</template>
        </small>
      </button>
    </section>
  </footer>
</template>
