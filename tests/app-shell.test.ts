import { mount } from '@vue/test-utils'
import { vi } from 'vitest'
import App from '../src/App.vue'
import GameWorld from '../src/components/GameWorld.vue'

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

  it('lets the militia fight a visible raid on the city map', async () => {
    const wrapper = mount(App)

    await wrapper.get('[data-action="attack"]').trigger('click')

    expect(wrapper.get('[data-testid="notice"]').text()).toContain('Налёт отбит')
    expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle')).toBe('true')
    expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-battle-outcome')).toBe('victory')
    expect(wrapper.get('[data-testid="voxel-world"]').attributes('data-fires')).toBe('1')
    expect(wrapper.get('[data-testid="battle-report"]').text()).toContain('Схватка у Северных ворот')
    expect(wrapper.get('[data-action="attack"]').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('[data-testid="friendly-unit"]')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="enemy-unit"]')).toHaveLength(0)
  })

  it('removes a defeated external threat after the visible retreat', async () => {
    vi.useFakeTimers()
    const wrapper = mount(App)
    try {
      await wrapper.get('[data-action="attack"]').trigger('click')
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
})
