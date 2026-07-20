import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('Openfront shell', () => {
  it('renders the settlement and uses no emoji controls', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="game-shell"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Вересков Дол')
    expect(wrapper.text()).not.toMatch(/[▶⏸⚒⚔]/u)
  })

  it('selects a building tool and places it on the world', async () => {
    const wrapper = mount(App)
    expect(wrapper.findAll('[data-testid="placed-building"]')).toHaveLength(8)
    expect(wrapper.get('[data-testid="world"] img').attributes('src')).toContain('empty-valley')
    const house = wrapper.get('[data-kind="house"]')
    await house.trigger('click')
    expect(house.classes()).toContain('active')

    await wrapper.get('[data-testid="world"]').trigger('click', { clientX: 560, clientY: 360 })

    expect(wrapper.findAll('[data-testid="placed-building"]')).toHaveLength(9)
    expect(wrapper.findAll('[data-testid="placed-building"] svg')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="placed-building"]')[8].attributes('data-asset')).toBe('house')
    expect(wrapper.get('[data-resource="wood"]').text()).toContain('112')
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
    expect(wrapper.findAll('[data-testid="friendly-unit"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-testid="enemy-unit"]').length).toBeGreaterThan(0)
    expect(wrapper.findAll('[data-testid="friendly-unit"] svg')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="enemy-unit"] svg')).toHaveLength(0)
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
})
