import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import App from '../src/App.vue'
import CampaignCommandBar from '../src/components/CampaignCommandBar.vue'
import GameWorld from '../src/components/GameWorld.vue'
import MultiplayerLobby from '../src/components/MultiplayerLobby.vue'
import ProvinceDevelopmentPanel from '../src/components/ProvinceDevelopmentPanel.vue'
import SiegeCommandBar from '../src/components/SiegeCommandBar.vue'
import { createCampaign } from '../src/game/campaign'
import { NATIONS } from '../src/game/nations'
import { encodeSave } from '../src/game/persistence'
import { createGame } from '../src/game/simulation'
import { createFinalCampaign } from './fixtures/finalCampaign'

describe('Openfront shell', () => {
  it('renders the settlement and uses no emoji controls', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="game-shell"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Порфирополис')
    expect(wrapper.text()).not.toMatch(/[▶⏸⚒⚔]/u)
    expect(wrapper.get('[data-testid="realm-outlook"]').text()).toContain('+16 в день')
  })

  it('keeps Byzantine chrome compact and opens one edge drawer on demand', async () => {
    const wrapper = mount(App)

    expect(wrapper.get('[data-testid="top-hud"]').classes()).toContain('top-hud')
    expect(wrapper.findAll('[data-testid="edge-drawer"]')).toHaveLength(0)
    expect(wrapper.text()).toContain('Порфирополис')
    expect(wrapper.text()).toContain('Номисмы')

    await wrapper.get('[data-action="toggle-intel"]').trigger('click')

    expect(wrapper.findAll('[data-testid="edge-drawer"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Разведка')

    await wrapper.get('[data-action="toggle-court"]').trigger('click')

    expect(wrapper.findAll('[data-testid="edge-drawer"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Двор стратега')
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Кризисов нет')
  })

  it('selects a building tool and places it on the world', async () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="voxel-world"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="world"] > img').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="placed-building"]')).toHaveLength(0)
    const house = wrapper.get('[data-kind="house"]')
    await house.trigger('click')
    expect(house.classes()).toContain('active')

    await wrapper.get('[data-testid="voxel-world"]').trigger('click', { clientX: 500, clientY: 100 })

    expect(wrapper.get('[data-resource="wood"]').text()).toContain('112')
  })

  it('starts in navigation mode and explains line construction before a drag can build', async () => {
    const wrapper = mount(App)

    expect(wrapper.find('[data-testid="construction-hint"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-tool')).toBe('none')

    await wrapper.get('[data-mode="streets"]').trigger('click')
    await wrapper.get('[data-kind="road"]').trigger('click')

    expect(wrapper.get('[data-testid="construction-hint"]').text()).toContain('Тяните ЛКМ по прямой')
    expect(wrapper.get('[data-testid="construction-hint"]').text()).toContain('Месса')

    const canvas = wrapper.get('[data-testid="voxel-world"]')
    await canvas.trigger('pointerdown', { clientX: 100, clientY: 100, pointerId: 1 })
    expect(canvas.classes()).toContain('line-building')
    await canvas.trigger('pointercancel')
    expect(canvas.classes()).not.toContain('line-building')
  })

  it('opens a real building card and applies object commands to the simulation', async () => {
    const wrapper = mount(App)
    const world = wrapper.getComponent(GameWorld)

    world.vm.$emit('select', 1)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="object-card"]').text()).toContain('Состояние100%')
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Дворец стратега')
    expect(wrapper.get('[data-action="demolish-building"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('неразбираемый центр')

    world.vm.$emit('select', 5)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Инсула')
    expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Жильё горожан')

    await wrapper.get('[data-action="demolish-building"]').trigger('click')

    expect(wrapper.find('[data-testid="object-card"]').exists()).toBe(false)
    expect(wrapper.get('[data-resource="wood"]').text()).toContain('122')
    expect(wrapper.get('[data-testid="notice"]').text()).toContain('Участок расчищен')
  })

  it('changes time speed through SVG controls', async () => {
    const wrapper = mount(App)
    const fast = wrapper.get('[data-speed="4"]')

    await fast.trigger('click')

    expect(fast.classes()).toContain('active')
    expect(wrapper.get('[data-testid="speed-label"]').text()).toContain('4×')
  })

  it('opens the strategic realm map and resolves a timed province march with committed levies', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="toggle-realm"]').trigger('click')

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-map-mode')).toBe('realm')
      expect(wrapper.get('[data-testid="campaign-command-bar"]').text()).toContain('Фема Порфирополиса')
      expect(wrapper.get('[data-testid="top-hud"]').text()).toContain('Порфирополис')
      expect(wrapper.get('[data-testid="top-hud"]').text()).toContain('Стратегическая карта')
      expect(wrapper.find('[data-testid="mode-bar"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="campaign-title"]').text()).toContain('15 провинций')

      wrapper.getComponent(GameWorld).vm.$emit('campaignSelect', { x: 28, y: 44 })
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-testid="campaign-target"]').text()).toContain('Маршрут: 1 переход')
      const source = wrapper.getComponent(CampaignCommandBar).props('source')
      if (!source) throw new Error('Expected selected campaign source')
      source.levies = 30
      await wrapper.get('[data-field="campaign-commitment"]').setValue('90')
      expect(wrapper.get('[data-action="campaign-attack"]').attributes('disabled')).toBeDefined()
      await wrapper.get('[data-field="campaign-commitment"]').setValue('65')
      expect(wrapper.get('[data-testid="campaign-commitment-value"]').text()).toBe('65%')
      expect(wrapper.get('[data-action="campaign-attack"]').attributes('disabled')).toBeUndefined()
      await wrapper.get('[data-action="campaign-attack"]').trigger('click')

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-campaign-marches')).toBe('1')
      await vi.advanceTimersByTimeAsync(3250)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-testid="campaign-title"]').text()).toContain('16 провинций')
      expect(wrapper.get('[data-testid="notice"]').text()).toContain('захватывает')
      await wrapper.get('[data-action="return-city"]').trigger('click')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-map-mode')).toBe('city')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('uses the national treasury to muster the selected province', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-action="toggle-realm"]').trigger('click')
    const before = wrapper.get('[data-testid="campaign-source"]').text()

    expect(wrapper.get('[data-testid="campaign-income"]').text()).toContain('казна 92')
    expect(wrapper.get('[data-action="campaign-muster"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-action="campaign-muster"]').trigger('click')

    expect(wrapper.get('[data-testid="campaign-income"]').text()).toContain('казна 68')
    expect(wrapper.get('[data-testid="campaign-source"]').text()).not.toBe(before)
    expect(wrapper.get('[data-testid="notice"]').text()).toContain('собрано')
  })

  it('opens the selected holding and starts a delayed development project', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="toggle-realm"]').trigger('click')
      await wrapper.get('[data-action="open-domain"]').trigger('click')

      expect(wrapper.get('[data-testid="province-development"]').text()).toContain('Уровень 2/2')
      expect(wrapper.get('[data-testid="province-development"]').text()).toContain('Уровень 1/2')
      expect(wrapper.get('[data-action="develop-market"]').attributes('disabled')).toBeUndefined()

      await wrapper.get('[data-action="develop-market"]').trigger('click')

      expect(wrapper.get('[data-testid="campaign-income"]').text()).toContain('казна 50')
      expect(wrapper.get('[data-testid="province-project"]').text()).toContain('Учредить торг')
      expect(wrapper.get('[data-testid="province-project"]').text()).toContain('2 дн.')
      expect(wrapper.get('[data-action="develop-fortification"]').attributes('disabled')).toBeDefined()

      await vi.advanceTimersByTimeAsync(7000)
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="province-project"]').exists()).toBe(false)
      await wrapper.get('[aria-label="Закрыть"]').trigger('click')
      await wrapper.get('[data-action="toggle-chronicle"]').trigger('click')
      expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Стройка завершена')
      expect(wrapper.get('[data-testid="edge-drawer"]').text()).not.toContain('Срок перемирия истёк')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('keeps a foreign holding read-only even if its drawer state is stale', () => {
    const campaign = createGame('foreign-domain').campaign
    const province = campaign.provinces.find((item) => item.owner === 'seljuk')!
    const wrapper = mount(ProvinceDevelopmentPanel, {
      props: {
        province,
        campaignDay: campaign.tick,
        treasury: 999,
        canManage: false,
      },
    })

    expect(wrapper.findAll('.domain-projects button')).toHaveLength(4)
    expect(wrapper.findAll('.domain-projects button').every((button) => (
      button.attributes('disabled') !== undefined
    ))).toBe(true)
  })

  it('sets separate defensive and marching formations on the strategic map', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-action="toggle-realm"]').trigger('click')
    expect(wrapper.get('[data-defense-formation="shieldwall"]').classes()).toContain('active')

    await wrapper.get('[data-defense-formation="wedge"]').trigger('click')
    expect(wrapper.get('[data-defense-formation="wedge"]').classes()).toContain('active')
    expect(wrapper.get('[data-testid="notice"]').text()).toContain('перестроен')

    await wrapper.get('[data-march-formation="wedge"]').trigger('click')
    expect(wrapper.get('[data-march-formation="wedge"]').classes()).toContain('active')
    expect(wrapper.get('[data-defense-formation="wedge"]').classes()).toContain('active')
  })

  it('shows the authoritative campaign result and removes command controls after victory', async () => {
    const state = createGame('finished-campaign')
    state.campaign = createFinalCampaign('finished-campaign')
    state.campaign.provinces.find((province) => province.owner === 'seljuk')!.owner = 'porphyry'
    state.campaign.realms.find((realm) => realm.id === 'seljuk')!.status = 'defeated'
    state.campaign.realms.find((realm) => realm.id === 'seljuk')!.defeatedAt = 0
    state.campaign.realms.find((realm) => realm.id === 'seljuk')!.defeatedBy = 'porphyry'
    state.campaign.winnerRealmId = 'porphyry'
    localStorage.setItem('openfront:autosave', encodeSave(state))
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="load"]').trigger('click')
      await wrapper.get('[data-action="toggle-realm"]').trigger('click')

      expect(wrapper.get('[data-testid="campaign-outcome"]').attributes('data-outcome')).toBe('victory')
      expect(wrapper.get('[data-testid="campaign-outcome"]').text()).toContain('Победа в войне держав')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-campaign-winner')).toBe('porphyry')
      expect(wrapper.find('[data-testid="campaign-command-bar"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="mode-bar"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
      localStorage.removeItem('openfront:autosave')
    }
  })

  it('resolves a pending peace offer after loading it offline', async () => {
    const state = createGame('offline-peace')
    state.campaign.peaceOffers.push({
      fromRealmId: 'seljuk',
      toRealmId: 'porphyry',
      demandedProvinceId: null,
      offeredAt: 0,
    })
    localStorage.setItem('openfront:autosave', encodeSave(state))
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="load"]').trigger('click')
      await wrapper.get('[data-action="toggle-realm"]').trigger('click')
      await wrapper.get('[data-realm="seljuk"]').trigger('click')

      expect(wrapper.get('[data-testid="peace-offer"]').text()).toContain('Входящие условия')
      await wrapper.get('[data-action="accept-peace"]').trigger('click')
      expect(wrapper.get('[data-testid="diplomacy-panel"]').text()).toContain('Перемирие')
      expect(wrapper.find('[data-testid="peace-offer"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
      localStorage.removeItem('openfront:autosave')
    }
  })

  it('renders shared lobby readiness before the server starts a match', async () => {
    const wrapper = mount(MultiplayerLobby, {
      props: {
        status: 'online',
        phase: 'lobby',
        roomId: 'march-room',
        localNationId: 'seljuk',
        selfReady: false,
        nations: NATIONS,
        players: [
          { id: 'one', name: 'Alexios', nationId: 'porphyry', ready: true },
          { id: 'two', name: 'Kutlug', nationId: 'seljuk', ready: false },
        ],
        error: '',
      },
    })

    expect(wrapper.text()).toContain('1/2 правителей готовы')
    expect(wrapper.get('[data-player-nation="porphyry"]').text()).toContain('готов')
    expect(wrapper.get('[data-player-nation="seljuk"]').text()).toContain('ожидает')
    await wrapper.get('[data-action="match-ready"]').trigger('click')
    expect(wrapper.emitted('ready')).toHaveLength(1)
  })

  it('negotiates a ruler-backed alliance through the strategic ledger', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-action="toggle-realm"]').trigger('click')
    await wrapper.get('[data-realm="bulgar"]').trigger('click')

    expect(wrapper.get('[data-testid="diplomacy-panel"]').text()).toContain('Дом Дуло')
    expect(wrapper.get('[data-testid="diplomacy-panel"]').text()).toContain('Верный клятве')
    expect(wrapper.get('[data-action="form-alliance"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-action="send-gift"]').trigger('click')
    await wrapper.get('[data-action="send-gift"]').trigger('click')

    expect(wrapper.get('[data-testid="diplomatic-opinion"]').text()).toBe('+60')
    expect(wrapper.get('[data-resource="silver"]').text()).toContain('32')
    expect(wrapper.get('[data-action="form-alliance"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-action="form-alliance"]').trigger('click')

    expect(wrapper.get('[data-testid="diplomacy-panel"]').text()).toContain('Союз')
    expect(wrapper.get('[data-realm="bulgar"]').text()).toContain('союз')
  })

  it('shows deterministic rival expansion after a four-day strategic turn', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="toggle-realm"]').trigger('click')
      expect(wrapper.get('[data-realm="seljuk"]').text()).toContain('12 земель')
      expect(wrapper.get('[data-realm="bulgar"]').text()).toContain('9 земель')

      await wrapper.get('[data-speed="4"]').trigger('click')
      await vi.advanceTimersByTimeAsync(3500)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('[data-realm="seljuk"]').text()).toContain('12 земель')
      expect(wrapper.get('[data-realm="bulgar"]').text()).toContain('9 земель')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-campaign-marches')).toBe('2')
      expect(wrapper.get('[data-testid="notice"]').text()).toContain('выступили')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-campaign-event-province')).not.toBe('none')

      await vi.advanceTimersByTimeAsync(3250)
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-realm="seljuk"]').text()).toContain('13 земель')
      expect(wrapper.get('[data-realm="bulgar"]').text()).toContain('10 земель')
      expect(wrapper.get('[data-testid="notice"]').text()).toContain('захватывает')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-campaign-marches')).toBe('0')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('deploys four formations before executing a visible battle plan', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="attack"]').trigger('click')

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle')).toBe('true')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-outcome')).toBe('none')
      expect(wrapper.get('[data-testid="battle-report"]').text()).toContain('Боевой порядок: 0/4')
      expect(wrapper.find('[data-testid="mode-bar"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-formation]')).toHaveLength(4)

      await wrapper.get('[data-formation="militia"]').trigger('click')
      await wrapper.get('[data-shape="shieldwall"]').trigger('click')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-tactical')).toBe('true')
      wrapper.getComponent(GameWorld).vm.$emit('battleCommand', { x: 34, y: 22 })
      await wrapper.get('[data-formation="spears"]').trigger('click')
      await wrapper.get('[data-shape="shieldwall"]').trigger('click')
      wrapper.getComponent(GameWorld).vm.$emit('battleCommand', { x: 38, y: 24 })
      await wrapper.get('[data-formation="archers"]').trigger('click')
      wrapper.getComponent(GameWorld).vm.$emit('battleCommand', { x: 32, y: 35 })
      await wrapper.get('[data-formation="retinue"]').trigger('click')
      await wrapper.get('[data-shape="wedge"]').trigger('click')
      wrapper.getComponent(GameWorld).vm.$emit('battleCommand', { x: 45, y: 28 })
      await wrapper.vm.$nextTick()

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-orders')).toBe('4')
      expect(wrapper.get('[data-testid="battle-command-bar"]').text()).toContain('строй +31')
      const firstOrder = wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-command')
      await wrapper.get('[data-formation="retinue"]').trigger('click')
      wrapper.getComponent(GameWorld).vm.$emit('battleCommand', { x: 48, y: 26 })
      await wrapper.vm.$nextTick()
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-command')).not.toBe(firstOrder)
      expect(wrapper.get('[data-action="execute-battle-plan"]').attributes('disabled')).toBeUndefined()
      await wrapper.get('[data-action="execute-battle-plan"]').trigger('click')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-executing')).toBe('true')

      await vi.advanceTimersByTimeAsync(2400)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('[data-testid="notice"]').text()).toContain('Налёт отбит по вашему плану')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-outcome')).toBe('victory')
      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-fires')).toBe('1')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('removes a defeated external threat after the visible retreat', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="attack"]').trigger('click')
      await wrapper.get('[data-formation="militia"]').trigger('click')
      for (const point of [{ x: 34, y: 22 }, { x: 38, y: 24 }, { x: 32, y: 35 }, { x: 45, y: 28 }]) {
        wrapper.getComponent(GameWorld).vm.$emit('battleCommand', point)
      }
      await wrapper.vm.$nextTick()
      await wrapper.get('[data-action="execute-battle-plan"]').trigger('click')
      await vi.advanceTimersByTimeAsync(2400)
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.raid-marker').exists()).toBe(true)

      await vi.advanceTimersByTimeAsync(4800)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle')).toBe('false')
      expect(wrapper.find('.raid-marker').exists()).toBe(false)
      expect(wrapper.get('[data-action="attack"]').text()).toContain('Угроз нет')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('does not resolve combat before the player completes and executes a plan', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="attack"]').trigger('click')
      await vi.advanceTimersByTimeAsync(3200)
      await wrapper.vm.$nextTick()

      expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-outcome')).toBe('none')
      expect(wrapper.get('[data-action="execute-battle-plan"]').attributes('disabled')).toBeDefined()
      expect(wrapper.get('[data-testid="battle-report"]').text()).toContain('Боевой порядок: 0/4')
    } finally {
      wrapper.unmount()
      vi.useRealTimers()
    }
  })

  it('creates a new procedural valley and keeps a local save', async () => {
    localStorage.clear()
    const wrapper = mount(App)
    const oldSeed = wrapper.get('[data-testid="seed"]').text()

    await wrapper.get('[data-action="save"]').trigger('click')
    expect(localStorage.getItem('openfront:autosave')).toContain('heather-17')

    await wrapper.get('[data-action="new-world"]').trigger('click')
    expect(wrapper.get('[data-testid="seed"]').text()).not.toBe(oldSeed)
  })

  it('offers an in-place recovery when the WebGL context is lost', async () => {
    const wrapper = mount(App)
    const canvas = wrapper.get('[data-testid="voxel-world"]')
    const event = new Event('webglcontextlost', { cancelable: true })

    canvas.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()

    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.get('[data-testid="renderer-recovery"]').text()).toContain('Рендер мира приостановлен')
  })

  it('shows a compact attacker siege council with explicit tactics and retreat', async () => {
    const campaign = createCampaign('siege-council')
    const source = campaign.provinces.find((province) => province.column === 2 && province.row === 4)!
    const target = campaign.provinces.find((province) => province.column === 3 && province.row === 4)!
    target.owner = 'seljuk'
    target.fortificationLevel = 1
    const siege = {
      id: 'siege-council',
      attackerId: 'porphyry',
      defenderId: 'seljuk',
      sourceId: source.id,
      targetId: target.id,
      soldiers: 72,
      formation: 'wedge' as const,
      tactic: 'blockade' as const,
      progress: 34,
      startedAt: 1,
      lastResolvedAt: 2,
    }
    const wrapper = mount(SiegeCommandBar, {
      props: {
        siege,
        target,
        attackerName: 'Порфирополис',
        defenderName: 'Сельджуки',
        localRole: 'attacker',
        treasury: 92,
        blockadeProgress: 18,
        sappersProgress: 32,
      },
    })

    expect(wrapper.text()).toContain('Пролом')
    expect(wrapper.get('[data-testid="siege-progress"]').text()).toBe('34%')
    expect(wrapper.text()).toContain('Блокада')
    expect(wrapper.text()).toContain('Подкоп')
    expect(wrapper.text()).toContain('Штурм')
    expect(wrapper.get('[data-siege-tactic="blockade"]').text()).toContain('+18% в день')
    expect(wrapper.get('[data-siege-tactic="sappers"]').text()).toContain('+32% · 12 в день')
    expect(wrapper.text()).not.toMatch(/[⚔⛺🔥]/u)
    await wrapper.get('[data-siege-tactic="sappers"]').trigger('click')
    await wrapper.get('[data-action="retreat-siege"]').trigger('click')
    expect(wrapper.emitted('tactic')).toEqual([['sappers']])
    expect(wrapper.emitted('retreat')).toHaveLength(1)
  })
})
