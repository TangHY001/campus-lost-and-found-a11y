import { ref } from 'vue'

/**
 * 无障碍辅助：路由切换后的“页面已加载”播报与焦点落点。
 * 视觉隐藏的播报区在 App.vue，读屏软件对 role="status" 区域的内容变化会自动朗读。
 */

/** 播报文本；空串表示没有播报。清空/写入分两步，保证同一句话重复出现时也会重新朗读。 */
export const routeAnnouncement = ref('')

let announceTimer: ReturnType<typeof setTimeout> | undefined

export function announce(message: string): void {
  routeAnnouncement.value = ''
  clearTimeout(announceTimer)
  announceTimer = setTimeout(() => {
    routeAnnouncement.value = message
  }, 120)
}

/** 主内容区的 id，跳过导航链接和路由切换都指向它。 */
export const MAIN_CONTENT_ID = 'main-content'

/**
 * 把焦点移到主内容区：读屏软件随后从 h1 开始朗读，键盘用户按 Tab 也从正文继续。
 * preventScroll 避免浏览器为了显示焦点而跳动，滚动位置由调用方决定。
 */
export function focusMainContent(): void {
  const main = document.getElementById(MAIN_CONTENT_ID)
  main?.focus({ preventScroll: true })
}
