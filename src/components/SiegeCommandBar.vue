<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Anvil, CircleOff, Flame, Hammer, Package, Shield, ShieldAlert, Swords, TentTree, Undo2, Users } from '@lucide/vue'
import {
  CAMPAIGN_SAPPER_DAILY_COST,
  CAMPAIGN_SIEGE_TACTICS,
  campaignSiegeSupplyDays,
  type CampaignSiege,
  type CampaignSiegeTactic,
  type Province,
} from '../game/campaign'
import { FORMATION_SHAPE_LABELS } from '../game/tactics'

const props = defineProps<{
  siege: CampaignSiege
  target: Province
  attackerName: string
  defenderName: string
  localRole: 'attacker' | 'defender' | 'observer'
  treasury: number
  blockadeProgress: number
  sappersProgress: number
}>()

defineEmits<{
  tactic: [tactic: CampaignSiegeTactic]
  retreat: []
  sortie: []
  close: []
}>()

const tactics: CampaignSiegeTactic[] = ['blockade', 'sappers', 'assault']
const tacticIcons: Record<CampaignSiegeTactic, Component> = {
  blockade: CircleOff,
  sappers: Hammer,
  assault: Swords,
}
const roleLabel = computed(() => ({
  attacker: 'Ваш осадный лагерь',
  defender: 'Ваш гарнизон в осаде',
  observer: 'Чужая осада',
})[props.localRole])
const supplyDays = computed(() => campaignSiegeSupplyDays(props.siege))

function tacticDisabled(tactic: CampaignSiegeTactic): boolean {
  return props.localRole !== 'attacker'
    || props.siege.tactic === tactic
    || (tactic === 'sappers' && props.treasury < CAMPAIGN_SAPPER_DAILY_COST)
}
</script>

<template>
  <footer class="siege-dock period-frame" data-testid="siege-command-bar">
    <section class="siege-seat">
      <div class="siege-emblem"><TentTree :size="25" /></div>
      <div>
        <small>{{ roleLabel }}</small>
        <strong>{{ target.name }}</strong>
        <span>{{ attackerName }} против {{ defenderName }}</span>
      </div>
      <button class="siege-close" data-action="close-siege" title="Закрыть совет осады" @click="$emit('close')">
        <CircleOff :size="16" />
      </button>
    </section>

    <section class="siege-state">
      <header>
        <span><Anvil :size="14" /> Пролом</span>
        <b data-testid="siege-progress">{{ siege.progress }}%</b>
      </header>
      <i class="siege-progress"><b :style="{ width: `${siege.progress}%` }"></b></i>
      <div class="siege-forces">
        <span><TentTree :size="13" /><b>{{ siege.soldiers }}</b> осаждающих</span>
        <span><Shield :size="13" /><b>{{ target.levies }}</b> защитников</span>
        <span data-testid="siege-supplies"><Package :size="13" /><b>{{ siege.supplies ?? 0 }}</b> · {{ supplyDays }} дн.</span>
        <span data-testid="siege-engines"><Anvil :size="13" /><b>{{ siege.engines ?? 0 }}</b> маш.</span>
        <span><Users :size="13" /> стены {{ target.fortificationLevel }} · {{ FORMATION_SHAPE_LABELS[target.defenseFormation].toLowerCase() }}</span>
      </div>
    </section>

    <section v-if="localRole === 'attacker'" class="siege-orders">
      <span class="rail-title">Способ осады</span>
      <nav>
        <button
          v-for="tactic in tactics"
          :key="tactic"
          :class="{ active: siege.tactic === tactic, danger: tactic === 'assault' }"
          :data-siege-tactic="tactic"
          :disabled="tacticDisabled(tactic)"
          @click="$emit('tactic', tactic)"
        >
          <component :is="tacticIcons[tactic]" :size="16" />
          <span>{{ CAMPAIGN_SIEGE_TACTICS[tactic].label }}</span>
          <small v-if="tactic === 'blockade'">+{{ blockadeProgress }}% в день</small>
          <small v-else-if="tactic === 'sappers'">+{{ sappersProgress }}% · {{ CAMPAIGN_SAPPER_DAILY_COST }} в день</small>
          <small v-else>на рассвете<span v-if="(siege.engines ?? 0) > 0"> · машины +{{ (siege.engines ?? 0) * 15 }}%</span></small>
        </button>
      </nav>
      <button class="siege-retreat" data-action="retreat-siege" @click="$emit('retreat')">
        <Undo2 :size="17" /><span>Снять осаду</span><small>потери 25%</small>
      </button>
    </section>

    <section v-else-if="localRole === 'defender'" class="siege-defense">
      <ShieldAlert :size="22" />
      <div>
        <small>Решение гарнизона</small>
        <strong>{{ siege.tactic === 'assault' ? 'Штурм ожидается на рассвете' : 'Стены держат кольцо' }}</strong>
        <span>Вылазка использует половину гарнизона и текущий оборонный строй.</span>
      </div>
      <button
        class="siege-sortie"
        data-action="sortie-siege"
        :disabled="target.levies < 8"
        @click="$emit('sortie')"
      >
        <Flame :size="17" /><span>Вылазка</span><small>риск 50%</small>
      </button>
    </section>

    <section v-else class="siege-observer">
      <ShieldAlert :size="20" />
      <span>Приказы доступны только воюющим правителям.</span>
    </section>
  </footer>
</template>
