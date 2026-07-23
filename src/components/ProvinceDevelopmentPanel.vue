<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Anvil, Castle, Clock3, Coins, Hammer, House, Landmark, Shield, Users } from '@lucide/vue'
import {
  PROVINCE_PROJECTS,
  provinceLevyCap,
  provinceProjectLevel,
  type Province,
  type ProvinceProjectKind,
} from '../game/campaign'

const props = defineProps<{
  province: Province
  campaignDay: number
  treasury: number
  canManage: boolean
}>()

defineEmits<{
  develop: [kind: ProvinceProjectKind]
}>()

const projectKinds: ProvinceProjectKind[] = ['settlement', 'market', 'fortification', 'workshop']
const projectIcons: Record<ProvinceProjectKind, Component> = {
  settlement: House,
  market: Landmark,
  fortification: Shield,
  workshop: Anvil,
}
const projectNames: Record<ProvinceProjectKind, string> = {
  settlement: 'Посад',
  market: 'Торг',
  fortification: 'Укрепления',
  workshop: 'Осадный двор',
}
const project = computed(() => props.province.project)
const remainingDays = computed(() => Math.max(0, (project.value?.completesAt ?? props.campaignDay) - props.campaignDay))
const projectProgress = computed(() => {
  if (!project.value) return 0
  const duration = project.value.completesAt - project.value.startedAt
  return Math.max(0, Math.min(100, Math.round((props.campaignDay - project.value.startedAt) / duration * 100)))
})

function canStart(kind: ProvinceProjectKind): boolean {
  return props.canManage
    && !project.value
    && provinceProjectLevel(props.province, kind) < 2
    && props.treasury >= PROVINCE_PROJECTS[kind].cost
}
</script>

<template>
  <section class="province-development" data-testid="province-development">
    <header class="domain-seat">
      <Castle :size="25" />
      <div>
        <small>{{ province.capitalOf === province.owner ? 'Столица державы' : 'Владение' }}</small>
        <strong>{{ province.name }}</strong>
        <span><Users :size="12" /> {{ province.levies }}/{{ provinceLevyCap(province) }} ратников</span>
      </div>
    </header>

    <div class="domain-yield">
      <span><Coins :size="14" /><b>+{{ 1 + province.cityLevel + province.marketLevel * 2 }}</b> в день</span>
      <span><Shield :size="14" /><b>+{{ province.fortificationLevel * 25 }}%</b> к обороне</span>
    </div>

    <article v-if="project" class="domain-project" data-testid="province-project">
      <Hammer :size="19" />
      <div>
        <small>Строится</small>
        <strong>{{ PROVINCE_PROJECTS[project.kind].label }}</strong>
        <span><Clock3 :size="12" /> {{ remainingDays }} дн. до завершения</span>
      </div>
      <i><b :style="{ width: `${projectProgress}%` }"></b></i>
    </article>

    <div class="domain-projects">
      <article
        v-for="kind in projectKinds"
        :key="kind"
        :class="{ maxed: provinceProjectLevel(province, kind) >= 2 }"
        :data-project-kind="kind"
      >
        <component :is="projectIcons[kind]" :size="20" />
        <div>
          <strong>{{ projectNames[kind] }}</strong>
          <span>Уровень {{ provinceProjectLevel(province, kind) }}/2</span>
        </div>
        <p>{{ PROVINCE_PROJECTS[kind].effect }}</p>
        <button
          :data-action="`develop-${kind}`"
          :disabled="!canStart(kind)"
          @click="$emit('develop', kind)"
        >
          <Hammer :size="14" />
          <span v-if="provinceProjectLevel(province, kind) >= 2">Предел достигнут</span>
          <span v-else-if="project">Очередь занята</span>
          <span v-else>Начать · {{ PROVINCE_PROJECTS[kind].cost }}</span>
        </button>
      </article>
    </div>
  </section>
</template>
