<script setup lang="ts">
import {
  Castle,
  Coins,
  Eye,
  FastForward,
  Hammer,
  House,
  Pause,
  Play,
  ScrollText,
  Shield,
  TreePine,
  Users,
  Warehouse,
  Wheat,
} from '@lucide/vue'

const resources = [
  { label: 'Серебро', value: '2 134', gain: '+38', icon: Coins },
  { label: 'Древесина', value: '1 589', gain: '+27', icon: TreePine },
  { label: 'Камень', value: '1 276', gain: '+19', icon: Castle },
  { label: 'Пища', value: '2 845', gain: '+46', icon: Wheat },
  { label: 'Жители', value: '98 / 120', gain: '+1', icon: Users },
]

const chronicle = [
  ['Налётчики замечены', 'Враги появились к северу от долины.', '17 день', Shield],
  ['Башня завершена', 'Северная башня приступила к дозору.', '16 день', Castle],
  ['Торговля завершена', 'Купцы из Железного брода отбыли.', '15 день', Coins],
  ['Ополчение обучено', 'Восемь ратников вошли в гарнизон.', '14 день', Shield],
  ['Урожай собран', 'Поля принесли 612 мер зерна.', '13 день', Wheat],
]

const buildings = [
  ['Дорога', TreePine],
  ['Дом', House],
  ['Ферма', Wheat],
  ['Лесопилка', TreePine],
  ['Каменоломня', Hammer],
  ['Амбар', Warehouse],
  ['Рынок', Coins],
  ['Кузница', Hammer],
  ['Казарма', Shield],
  ['Башня', Castle],
  ['Стена', Shield],
  ['Ратуша', Castle],
]
</script>

<template>
  <main class="game-shell" data-testid="game-shell">
    <header class="topbar game-frame">
      <div class="resource-strip">
        <div v-for="resource in resources" :key="resource.label" class="resource" :title="resource.label">
          <component :is="resource.icon" :size="20" :stroke-width="1.8" aria-hidden="true" />
          <div><strong>{{ resource.value }}</strong><span>{{ resource.gain }}</span></div>
        </div>
      </div>
      <div class="settlement-mark">
        <span class="crest"><Castle :size="27" :stroke-width="1.7" /></span>
        <div><h1>Вересков Дол</h1><p>Осень · Сумерки · 4 год, 17 день</p></div>
      </div>
      <div class="time-controls" aria-label="Скорость времени">
        <button class="square-button"><Pause :size="18" /><span class="sr-only">Пауза</span></button>
        <button class="square-button active"><Play :size="18" /><span class="sr-only">Обычная скорость</span></button>
        <button class="square-button"><FastForward :size="18" /><span class="sr-only">Быстро</span></button>
      </div>
    </header>

    <section class="world" aria-label="Карта поселения">
      <img src="/assets/concepts/openfront-primary-screen.png" alt="Средневековый город Вересков Дол" />
      <div class="world-vignette"></div>
      <div class="raid-marker">
        <Shield :size="20" />
        <div><strong>Северный дозор</strong><span>Всадники · примерно 85</span></div>
      </div>
      <div class="town-label"><span>Нижний посад</span><i>Порядок 72</i></div>
    </section>

    <aside class="chronicle game-frame">
      <div class="panel-heading"><ScrollText :size="18" /><h2>Летопись</h2><button aria-label="Свернуть">—</button></div>
      <article v-for="entry in chronicle" :key="entry[0] as string" class="chronicle-entry">
        <component :is="entry[3]" :size="24" :stroke-width="1.6" />
        <div><strong>{{ entry[0] }}</strong><p>{{ entry[1] }}</p></div>
        <time>{{ entry[2] }}</time>
      </article>
      <button class="wide-button">Показать старые записи</button>
    </aside>

    <aside class="intel game-frame">
      <div class="panel-heading"><Eye :size="18" /><h2>Разведка</h2><button aria-label="Свернуть">—</button></div>
      <div class="threat-row">
        <div class="threat critical"><Shield :size="24" /><strong>85</strong><span>Север</span></div>
        <div class="threat"><Shield :size="24" /><strong>?</strong><span>Восток</span></div>
        <div class="threat muted"><Shield :size="24" /><strong>0</strong><span>Юг</span></div>
      </div>
      <h3>Донесения</h3>
      <ul class="messages">
        <li class="danger">Вражеский отряд движется к Северным воротам.</li>
        <li>Небольшая группа замечена у реки.</li>
        <li class="safe">Наши купцы вне опасности.</li>
      </ul>
    </aside>

    <aside class="selection game-frame">
      <div class="panel-heading"><Warehouse :size="18" /><h2>Амбар</h2><span>II ранг</span></div>
      <div class="selected-building">
        <div class="building-portrait"><Warehouse :size="44" :stroke-width="1.3" /></div>
        <div><strong>1 200 / 1 200</strong><div class="meter"><i style="width: 100%"></i></div></div>
      </div>
      <p>Хранит зерно и припасы. Снижает порчу продуктов поблизости.</p>
      <dl><div><dt>Запасы</dt><dd>2 845 / 3 600</dd></div><div><dt>Работники</dt><dd>5 / 5</dd></div></dl>
      <div class="selection-actions"><button class="square-button"><Users :size="18" /></button><button class="square-button"><Hammer :size="18" /></button><button class="square-button danger-button"><Shield :size="18" /></button></div>
    </aside>

    <footer class="commandbar game-frame">
      <section class="build-menu">
        <div class="panel-heading"><Hammer :size="18" /><h2>Строительство</h2></div>
        <div class="building-tools">
          <button v-for="(building, index) in buildings" :key="building[0] as string" :class="['build-button', { active: index === 0 }]">
            <component :is="building[1]" :size="29" :stroke-width="1.45" /><span>{{ building[0] }}</span>
          </button>
        </div>
      </section>
      <section class="army-menu">
        <div class="panel-heading"><Shield :size="18" /><h2>Приказы дружине</h2></div>
        <div class="army-actions"><button><Shield :size="23" />Держать строй</button><button class="attack"><Hammer :size="23" />Атаковать</button></div>
      </section>
    </footer>
  </main>
</template>
