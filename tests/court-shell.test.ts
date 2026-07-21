import { mount } from '@vue/test-utils'
import { vi } from 'vitest'

vi.mock('../src/game/simulation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/game/simulation')>()
  return {
    ...actual,
    createGame(seed: string) {
      const state = actual.createGame(seed)
      state.crises.push({ id: 500, kind: 'coup', pressure: 20 })
      return state
    },
  }
})

import App from '../src/App.vue'

it('applies a court decision through Vue and removes a resolved crisis', async () => {
  const wrapper = mount(App)

  await wrapper.get('[data-action="toggle-court"]').trigger('click')
  expect(wrapper.get('[data-crisis="coup"]').text()).toContain('Заговор знати')
  expect(wrapper.get('[data-resource="silver"]').text()).toContain('92')

  await wrapper.get('[data-action="address-crisis"]').trigger('click')

  expect(wrapper.find('[data-crisis="coup"]').exists()).toBe(false)
  expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('Кризисов нет')
  expect(wrapper.get('[data-testid="edge-drawer"]').text()).toContain('78')
  expect(wrapper.get('[data-resource="silver"]').text()).toContain('64')
  expect(wrapper.get('[data-testid="notice"]').text()).toContain('Знать принесла новые клятвы стратегу')
})
