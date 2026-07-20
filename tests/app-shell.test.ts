import { mount } from '@vue/test-utils'
import App from '../src/App.vue'

describe('Openfront shell', () => {
  it('renders the settlement and uses no emoji controls', () => {
    const wrapper = mount(App)
    expect(wrapper.find('[data-testid="game-shell"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Вересков Дол')
    expect(wrapper.text()).not.toMatch(/[▶⏸⚒⚔]/u)
  })
})
