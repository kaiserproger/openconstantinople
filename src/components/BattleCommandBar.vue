<script setup lang="ts">
import { BowArrow, ChevronsRight, Play, Shield, ShieldCheck, Swords, Target, Users } from '@lucide/vue'
import type { Component } from 'vue'
import type { BattleFormation, BattlePlanAssessment, FormationKind, FormationShape } from '../game/tactics'

const props = defineProps<{
  formations: BattleFormation[]
  selectedFormationId: FormationKind
  assessment: BattlePlanAssessment
  executing: boolean
  outcome: 'victory' | 'defeat' | null
}>()

defineEmits<{
  select: [formationId: FormationKind]
  shape: [shape: FormationShape]
  execute: []
}>()

const formationMeta: Record<FormationKind, { label: string; role: string; icon: Component }> = {
  militia: { label: 'Ополчение', role: 'держит ворота', icon: Users },
  spears: { label: 'Копейщики', role: 'ломают натиск', icon: ShieldCheck },
  archers: { label: 'Лучники', role: 'бьют из тыла', icon: BowArrow },
  retinue: { label: 'Дружина', role: 'обходит фланг', icon: Swords },
}

const shapeMeta: Array<{ id: FormationShape; label: string; icon: Component }> = [
  { id: 'line', label: 'Линия', icon: ChevronsRight },
  { id: 'shieldwall', label: 'Стена щитов', icon: Shield },
  { id: 'wedge', label: 'Клин', icon: Target },
]

function selectedFormation(): BattleFormation {
  return props.formations.find((formation) => formation.id === props.selectedFormationId) ?? props.formations[0]!
}

function selectedAssessment() {
  return props.assessment.formations[props.selectedFormationId]
}
</script>

<template>
  <footer class="battle-dock period-frame" data-testid="battle-command-bar">
    <div class="formation-rail">
      <span class="rail-title">Боевые построения · приказов {{ assessment.orderedFormations }}/{{ formations.length }}</span>
      <button
        v-for="formation in formations"
        :key="formation.id"
        :class="['formation-card', { active: selectedFormationId === formation.id, ordered: formation.target }]"
        :data-formation="formation.id"
        :disabled="executing || Boolean(outcome)"
        @click="$emit('select', formation.id)"
      >
        <component :is="formationMeta[formation.kind].icon" :size="20" />
        <span><strong>{{ formationMeta[formation.kind].label }}</strong><small>{{ formation.soldiers }} ратников · сила {{ assessment.formations[formation.id].total }}</small></span>
        <i><b :style="{ width: `${formation.morale}%` }"></b></i>
        <Target v-if="formation.target" class="order-mark" :size="13" />
      </button>
    </div>

    <div class="doctrine-panel">
      <div class="doctrine-heading">
        <span>{{ formationMeta[selectedFormation().kind].label }}</span>
        <small>{{ formationMeta[selectedFormation().kind].role }} · строй +{{ selectedAssessment().doctrineBonus }} · позиция +{{ selectedAssessment().positionBonus }}</small>
      </div>
      <div class="shape-orders" aria-label="Выбор построения">
        <button
          v-for="shape in shapeMeta"
          :key="shape.id"
          :class="{ active: selectedFormation().shape === shape.id }"
          :data-shape="shape.id"
          :disabled="executing || Boolean(outcome)"
          @click="$emit('shape', shape.id)"
        ><component :is="shape.icon" :size="16" /><span>{{ shape.label }}</span></button>
      </div>
      <button
        class="execute-plan"
        data-action="execute-battle-plan"
        :disabled="!assessment.ready || executing || Boolean(outcome)"
        @click="$emit('execute')"
      ><Play :size="18" /><span>{{ outcome ? 'Бой завершён' : executing ? 'Приказ исполняется' : 'Начать сражение' }}</span><small>строй +{{ assessment.doctrineBonus }} · позиция +{{ assessment.positionBonus }}</small></button>
    </div>
  </footer>
</template>
