<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowRight, Ban, Check, Coins, Crown, Flag, Handshake, Navigation, RotateCcw, Scale, ScrollText, Shield, Store, Swords, Users, X } from '@lucide/vue'
import {
  ALLIANCE_SILVER_AMOUNTS,
  type AllianceSilverAmount,
  type CampaignCommitment,
  type DiplomaticRelation,
  type Province,
  type Realm,
} from '../game/campaign'

const props = defineProps<{
  realm: Realm
  relation: DiplomaticRelation
  provinceCount: number
  strength: number
  silver: number
  targetSilver: number
  legitimacy: number
  allianceOffer: 'incoming' | 'outgoing' | null
  warScore: number
  peaceOffer: 'incoming' | 'outgoing' | null
  peaceDemandName: string | null
  peaceDemandCandidates: Province[]
  peaceDemandThreshold: number
  networked: boolean
  targetPlayerAvailable: boolean
  supportSource: Province | null
  supportTarget: Province | null
  supportCommitment: CampaignCommitment
  supportReason: string | null
  tradeSource: Province | null
  tradeTarget: Province | null
  tradeActive: boolean
  tradeIncome: number
  tradeEmbargo: 'none' | 'self' | 'target' | 'both'
  tradeReason: string | null
}>()

defineEmits<{
  gift: []
  allianceSilver: [amount: AllianceSilverAmount]
  allianceSupport: []
  openTrade: []
  embargoTrade: []
  resumeTrade: []
  alliance: []
  acceptAlliance: []
  declineAlliance: []
  war: []
  truce: []
  demandPeace: [provinceId: number]
  acceptPeace: []
  rejectPeace: []
  withdrawPeace: []
  breakAlliance: []
}>()

const statusLabel = computed(() => ({
  war: 'Война',
  neutral: 'Нейтралитет',
  truce: 'Перемирие',
  alliance: 'Союз',
}[props.relation.status]))
const supportSoldiers = computed(() => (
  props.supportSource
    ? Math.floor(props.supportSource.levies * props.supportCommitment / 100)
    : 0
))
const supportButtonLabel = computed(() => (
  props.supportReason === 'Из этой провинции уже выступило войско'
    ? 'Подкрепление в пути'
    : props.supportReason
      ? 'Подкрепление недоступно'
      : `Отправить ${supportSoldiers.value}`
))
const cooperationTab = ref<'support' | 'trade'>('support')
</script>

<template>
  <section class="diplomacy-sheet" data-testid="diplomacy-panel">
    <header class="ruler-banner">
      <Crown :size="27" />
      <div>
        <small>{{ realm.name }}</small>
        <strong>{{ realm.ruler.name }}</strong>
        <span>Дом {{ realm.ruler.dynasty }} · {{ realm.ruler.age }} лет</span>
      </div>
    </header>

    <div class="diplomatic-state" :data-status="relation.status">
      <Shield :size="18" />
      <div><small>Отношения</small><strong>{{ statusLabel }}</strong></div>
      <b data-testid="diplomatic-opinion">{{ relation.opinion > 0 ? '+' : '' }}{{ relation.opinion }}</b>
    </div>

    <section
      v-if="allianceOffer"
      :class="['alliance-offer', allianceOffer]"
      data-testid="alliance-offer"
    >
      <Handshake :size="21" />
      <div>
        <small>{{ allianceOffer === 'incoming' ? 'Входящее посольство' : 'Гонцы в пути' }}</small>
        <strong>{{ allianceOffer === 'incoming' ? 'Предложение союза' : 'Ожидается ответ правителя' }}</strong>
      </div>
      <nav v-if="allianceOffer === 'incoming'" aria-label="Ответ на предложение союза">
        <button data-action="accept-alliance" @click="$emit('acceptAlliance')">
          <Check :size="15" /><span>Принять</span>
        </button>
        <button class="danger" data-action="decline-alliance" @click="$emit('declineAlliance')">
          <X :size="15" /><span>Отклонить</span>
        </button>
      </nav>
    </section>

    <section v-if="relation.status === 'war'" class="peace-council" data-testid="peace-council">
      <header>
        <Scale :size="20" />
        <div>
          <small>Исход войны</small>
          <strong>Военный счёт {{ warScore > 0 ? '+' : '' }}{{ warScore }}</strong>
        </div>
        <b :class="{ losing: warScore < 0 }">{{ warScore >= 0 ? 'перевес' : 'отступление' }}</b>
      </header>
      <i class="war-score-track">
        <b :style="{ width: `${Math.abs(warScore) / 2}%`, left: warScore >= 0 ? '50%' : `${50 - Math.abs(warScore) / 2}%` }"></b>
      </i>

      <article v-if="peaceOffer" :class="['peace-offer', peaceOffer]" data-testid="peace-offer">
        <Flag :size="18" />
        <div>
          <small>{{ peaceOffer === 'incoming' ? 'Входящие условия' : 'Посольство отправлено' }}</small>
          <strong>{{ peaceDemandName ? `Уступить ${peaceDemandName}` : 'Белый мир' }}</strong>
          <span>{{ peaceOffer === 'incoming' ? 'Решение завершит войну и начнёт перемирие.' : 'Ожидается решение второго правителя.' }}</span>
        </div>
        <nav v-if="peaceOffer === 'incoming'">
          <button data-action="accept-peace" @click="$emit('acceptPeace')"><Check :size="14" />Принять</button>
          <button class="danger" data-action="reject-peace" @click="$emit('rejectPeace')"><X :size="14" />Отклонить</button>
        </nav>
        <nav v-else>
          <button data-action="withdraw-peace" @click="$emit('withdrawPeace')">
            <RotateCcw :size="14" />Отозвать условия
          </button>
        </nav>
      </article>

      <div v-else class="peace-terms">
        <button
          data-action="offer-truce"
          :disabled="networked && !targetPlayerAvailable"
          @click="$emit('truce')"
        >
          <Handshake :size="15" /><span>Белый мир</span><small>границы без изменений</small>
        </button>
        <div class="peace-demands">
          <small>Территориальные требования · нужно {{ peaceDemandThreshold }}</small>
          <button
            v-for="province in peaceDemandCandidates"
            :key="province.id"
            :data-peace-demand="province.id"
            :disabled="warScore < peaceDemandThreshold || (networked && !targetPlayerAvailable)"
            @click="$emit('demandPeace', province.id)"
          >
            <Flag :size="14" /><span>{{ province.name }}</span><small>пограничная провинция</small>
          </button>
          <span v-if="peaceDemandCandidates.length === 0">Нет доступных приграничных требований.</span>
        </div>
      </div>
    </section>

    <section
      v-if="relation.status === 'alliance'"
      class="cooperation-tabs"
      aria-label="Союзные действия"
    >
      <button :class="{ active: cooperationTab === 'support' }" data-cooperation-tab="support" @click="cooperationTab = 'support'">
        <Handshake :size="13" /><span>Помощь</span>
      </button>
      <button :class="{ active: cooperationTab === 'trade' }" data-cooperation-tab="trade" @click="cooperationTab = 'trade'">
        <Store :size="13" /><span>Торг</span>
      </button>
    </section>

    <section
      v-if="relation.status === 'alliance' && cooperationTab === 'support'"
      class="alliance-support"
      data-testid="alliance-support"
    >
      <header>
        <Handshake :size="18" />
        <div><small>Союзная помощь</small><strong>Казна и подкрепления</strong></div>
      </header>
      <dl class="alliance-treasuries">
        <div><dt>Ваша казна</dt><dd>{{ silver }}</dd></div>
        <ArrowRight :size="15" />
        <div><dt>Казна союзника</dt><dd data-testid="allied-treasury">{{ targetSilver }}</dd></div>
      </dl>
      <nav class="alliance-silver-options" aria-label="Передать номисмы союзнику">
        <button
          v-for="amount in ALLIANCE_SILVER_AMOUNTS"
          :key="amount"
          :data-alliance-silver="amount"
          :disabled="silver < amount || (networked && !targetPlayerAvailable)"
          @click="$emit('allianceSilver', amount)"
        ><Coins :size="13" /><span>{{ amount }}</span></button>
      </nav>
      <article class="alliance-reinforcement">
        <Navigation :size="17" />
        <div>
          <small>Поход подкреплений</small>
          <strong v-if="supportSource && supportTarget">
            {{ supportSource.name }} → {{ supportTarget.name }}
          </strong>
          <strong v-else>Выберите союзный рубеж</strong>
          <span>{{ supportReason ?? `В путь выступят ${supportSoldiers} ратников` }}</span>
        </div>
        <button
          data-action="send-alliance-support"
          :disabled="supportReason !== null"
          @click="$emit('allianceSupport')"
        ><Users :size="14" /><span>{{ supportButtonLabel }}</span></button>
      </article>
    </section>

    <section
      v-if="relation.status !== 'war' && (relation.status !== 'alliance' || cooperationTab === 'trade')"
      class="realm-trade"
      data-testid="realm-trade"
    >
      <header>
        <Store :size="18" />
        <div><small>Торговая политика</small><strong>Караванный путь</strong></div>
      </header>
      <article v-if="tradeActive" class="trade-route-active">
        <Navigation :size="17" />
        <div>
          <small>Действующий маршрут</small>
          <strong>{{ tradeSource?.name }} — {{ tradeTarget?.name }}</strong>
          <span data-testid="trade-income">Обе казны получают +{{ tradeIncome }} в день</span>
        </div>
        <button class="warning" data-action="embargo-trade" @click="$emit('embargoTrade')">
          <Ban :size="14" /><span>Остановить торговлю</span>
        </button>
      </article>
      <article v-else-if="tradeEmbargo === 'self' || tradeEmbargo === 'both'" class="trade-embargo">
        <Ban :size="17" />
        <div>
          <small>Ваш торговый указ</small>
          <strong>Торговля остановлена</strong>
          <span>{{ tradeEmbargo === 'both' ? 'Обе державы держат эмбарго' : 'Снять эмбарго можно немедленно' }}</span>
        </div>
        <button data-action="resume-trade" @click="$emit('resumeTrade')">
          <RotateCcw :size="14" /><span>Снять своё эмбарго</span>
        </button>
      </article>
      <article v-else-if="tradeEmbargo === 'target'" class="trade-embargo foreign">
        <Ban :size="17" />
        <div>
          <small>Указ соседней державы</small>
          <strong>Торговля закрыта соседом</strong>
          <span>Открыть путь сможет только другой правитель</span>
        </div>
      </article>
      <article v-else class="trade-route-plan">
        <Navigation :size="17" />
        <div>
          <small>Новый маршрут</small>
          <strong v-if="tradeSource && tradeTarget">{{ tradeSource.name }} — {{ tradeTarget.name }}</strong>
          <strong v-else>Выберите два рынка</strong>
          <span>{{ tradeReason ?? 'Маршрут даст доход обеим державам' }}</span>
        </div>
        <dl v-if="tradeSource && tradeTarget">
          <div><dt>Свой торг</dt><dd>{{ tradeSource.marketLevel }}</dd></div>
          <ArrowRight :size="14" />
          <div><dt>Соседний торг</dt><dd>{{ tradeTarget.marketLevel }}</dd></div>
        </dl>
        <button
          data-action="open-trade-route"
          :disabled="tradeReason !== null"
          @click="$emit('openTrade')"
        ><Store :size="14" /><span>{{ tradeReason ? 'Маршрут недоступен' : 'Учредить торговлю' }}</span></button>
      </article>
    </section>

    <dl class="ruler-abilities">
      <div><dt>Военное дело</dt><dd>{{ realm.ruler.martial }}</dd></div>
      <div><dt>Дипломатия</dt><dd>{{ realm.ruler.diplomacy }}</dd></div>
      <div><dt>Управление</dt><dd>{{ realm.ruler.stewardship }}</dd></div>
    </dl>

    <p class="ruler-trait"><ScrollText :size="15" /><span><strong>{{ realm.ruler.trait }}</strong>Черта правителя влияет на рост ополчения и самостоятельные походы.</span></p>

    <div class="realm-muster">
      <span><Users :size="15" /><b>{{ provinceCount }}</b> провинций</span>
      <span><Swords :size="15" /><b>{{ strength }}</b> ратников</span>
    </div>

    <section class="diplomatic-actions">
      <button
        v-if="relation.status !== 'war' && relation.status !== 'alliance'"
        data-action="send-gift"
        :disabled="silver < 30"
        @click="$emit('gift')"
      >
        <Coins :size="17" /><span>Отправить дары</span><small>30 номисм</small>
      </button>
      <button
        v-if="relation.status === 'neutral' && !allianceOffer"
        data-action="form-alliance"
        :disabled="relation.opinion < 50 || (networked && !targetPlayerAvailable)"
        @click="$emit('alliance')"
      >
        <Handshake :size="17" /><span>Предложить союз</span>
        <small>{{ networked && !targetPlayerAvailable ? 'нет правителя в этом матче' : 'нужно отношение 50' }}</small>
      </button>
      <button
        v-if="relation.status === 'neutral'"
        class="danger"
        data-action="declare-war"
        :disabled="legitimacy < 8"
        @click="$emit('war')"
      >
        <Swords :size="17" /><span>Объявить войну</span><small>8 легитимности</small>
      </button>
      <button
        v-if="relation.status === 'alliance'"
        class="danger"
        data-action="break-alliance"
        @click="$emit('breakAlliance')"
      >
        <Swords :size="17" /><span>Разорвать союз</span><small>отношение −40</small>
      </button>
    </section>
  </section>
</template>
