import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import App from '@/App.vue'
import { announce, focusMainContent, routeAnnouncement } from '@/utils/a11y'

/**
 * 无障碍语义的回归测试。
 * 这些断言不是样式检查，而是“屏幕阅读器能读到什么、键盘能到哪里”的最低保证，
 * 后续改动如果把跳过导航、播报区或焦点落点弄丢，测试会直接失败。
 */

const RouterViewStub = {
  template: '<main id="main-content" tabindex="-1"><h1>页面标题</h1></main>',
}

describe('应用外壳的无障碍结构', () => {
  it('第一个可聚焦元素是“跳到主内容”，且指向主内容区', () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: RouterViewStub } } })
    const firstLink = wrapper.element.querySelector('a')
    expect(firstLink?.textContent?.trim()).toBe('跳到主内容')
    expect(firstLink?.getAttribute('href')).toBe('#main-content')
    // 页面里必须有对应落点，否则跳过链接点了没反应
    expect(wrapper.element.querySelector('#main-content')).not.toBeNull()
  })

  it('存在给屏幕阅读器的路由播报区（role=status + aria-live）', () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: RouterViewStub } } })
    const announcer = wrapper.element.querySelector('[role="status"][aria-live="polite"]')
    expect(announcer).not.toBeNull()
    expect(announcer?.textContent?.trim()).toBe('')
  })
})

describe('路由播报与焦点落点', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    routeAnnouncement.value = ''
    document.body.innerHTML = ''
  })

  it('播报内容先清空再写入，重复的同一句话也会再次朗读', async () => {
    announce('浏览物品页面已加载')
    vi.advanceTimersByTime(200)
    expect(routeAnnouncement.value).toBe('浏览物品页面已加载')

    announce('浏览物品页面已加载')
    // 立即读到的是空串：主动清空，读屏软件才会把重复文本当成一次新变化
    expect(routeAnnouncement.value).toBe('')
    vi.advanceTimersByTime(200)
    expect(routeAnnouncement.value).toBe('浏览物品页面已加载')
  })

  it('focusMainContent 把焦点交给 #main-content，键盘可从正文继续', () => {
    document.body.innerHTML = '<main id="main-content" tabindex="-1"></main>'
    const main = document.getElementById('main-content') as HTMLElement
    focusMainContent()
    expect(document.activeElement).toBe(main)
  })

  it('没有主内容区时静默返回，不抛错', () => {
    document.body.innerHTML = '<div></div>'
    expect(() => focusMainContent()).not.toThrow()
  })
})

describe('页面级语义', () => {
  it('主内容区可被程序聚焦（tabindex=-1），且当次聚焦不显示焦点框由样式处理', async () => {
    const wrapper = mount(App, { global: { stubs: { RouterView: RouterViewStub } } })
    await nextTick()
    const main = wrapper.element.querySelector('#main-content') as HTMLElement
    expect(main.getAttribute('tabindex')).toBe('-1')
    expect(main.tagName.toLowerCase()).toBe('main')
  })
})
