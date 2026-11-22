<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * 演示用的“朗读本页”按钮（页面自朗读）。
 *
 * 用途：录课程演示视频时，一键让页面按“标题 → 正文”的顺序念出来，并高亮正在朗读的段落，
 * 方便观众对照“读到哪里、屏幕上是什么”。
 *
 * 边界：这是 Web Speech API 的合成语音，不是屏幕阅读器（NVDA/讲述人读的是浏览器无障碍树）。
 * 它只在 npm run dev 或地址带 ?read=1 时挂载，正式构建里不会出现，因此不构成新增业务功能。
 */

const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
const speaking = ref(false)
const done = ref(0)
const total = ref(0)
const currentLabel = ref('')
const label = computed(() => (speaking.value ? '停止朗读' : '朗读本页'))

interface Block {
  el: HTMLElement
  text: string
}

let blocks: Block[] = []
let cursor = 0
let highlighted: HTMLElement | null = null

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

function isVisible(el: Element): boolean {
  const rect = el.getBoundingClientRect()
  const style = window.getComputedStyle(el)
  return (
    rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
  )
}

/** 收集主内容区里“该被读出来”的段落：标题、段落、列表项、术语/取值、按钮与链接、表单控件标签。 */
function collectBlocks(): Block[] {
  const root = document.getElementById('main-content') ?? document.body
  const selector = 'h1, h2, h3, h4, p, li, dt, dd, button, a, label, th, td'
  const result: Block[] = []
  const seen = new Set<string>()

  const push = (el: HTMLElement, raw: string) => {
    const text = raw.replace(/\s+/g, ' ').trim()
    if (!text || seen.has(text)) return
    seen.add(text)
    result.push({ el, text })
  }

  // 页面标题先读，读屏软件换页后也是先报标题
  push(root as HTMLElement, document.title.replace(' · ', '，'))

  for (const el of Array.from(root.querySelectorAll<HTMLElement>(selector))) {
    if (SKIP_TAGS.has(el.tagName) || el.closest('.visually-hidden, .skip-link')) continue
    if (!isVisible(el)) continue
    // 只取最外层匹配元素，避免 li 里套 p 时读两遍
    const outer = el.parentElement?.closest(selector)
    if (outer && root.contains(outer)) continue
    // 表单控件读它的可访问名；其余读文本
    if (el.tagName === 'BUTTON' || el.tagName === 'A')
      push(el, el.innerText || el.getAttribute('aria-label') || '')
    else if (el.tagName === 'LABEL') {
      const control = (el as HTMLLabelElement).control as HTMLInputElement | null
      push(el, el.innerText + (control?.value ? `，当前值 ${control.value}` : ''))
    } else push(el, el.innerText)
  }
  return result
}

function clearHighlight() {
  if (highlighted) {
    highlighted.style.outline = ''
    highlighted.style.outlineOffset = ''
    highlighted = null
  }
}

function highlight(el: HTMLElement) {
  clearHighlight()
  highlighted = el
  el.style.outline = '3px solid #1f5fbf'
  el.style.outlineOffset = '4px'
  el.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

function stop() {
  if (!supported) return
  window.speechSynthesis.cancel()
  speaking.value = false
  currentLabel.value = ''
  clearHighlight()
}

function speakNext() {
  if (cursor >= blocks.length) {
    speaking.value = false
    currentLabel.value = ''
    clearHighlight()
    return
  }
  const block = blocks[cursor]
  if (!block) return
  done.value = cursor + 1
  currentLabel.value = block.text.slice(0, 40)
  highlight(block.el)

  const utterance = new SpeechSynthesisUtterance(block.text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.95
  utterance.onend = () => {
    cursor += 1
    speakNext()
  }
  utterance.onerror = () => {
    cursor += 1
    speakNext()
  }
  window.speechSynthesis.speak(utterance)
}

function start() {
  if (!supported) return
  stop()
  blocks = collectBlocks()
  if (!blocks.length) return
  cursor = 0
  done.value = 0
  total.value = blocks.length
  speaking.value = true

  const intro = new SpeechSynthesisUtterance(
    `开始朗读本页，共 ${blocks.length} 段。按 Esc 或再次按“停止朗读”可以随时停止。`,
  )
  intro.lang = 'zh-CN'
  intro.rate = 0.95
  intro.onend = () => speakNext()
  window.speechSynthesis.speak(intro)
}

function toggle() {
  if (speaking.value) stop()
  else start()
}

function onKeydown(event: KeyboardEvent) {
  // Esc 停止；Alt+R 开始/停止（录屏时不用去找按钮）
  if (event.key === 'Escape' && speaking.value) {
    stop()
    return
  }
  if (event.altKey && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'r') {
    event.preventDefault()
    toggle()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  // 换页时停止朗读，避免上一页的文字还在念
  window.addEventListener('popstate', stop)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('popstate', stop)
  stop()
})
</script>

<template>
  <button
    v-if="supported"
    type="button"
    class="read-aloud"
    :aria-pressed="speaking"
    :aria-label="speaking ? '停止朗读本页（Alt+R）' : '朗读本页，演示用（Alt+R）'"
    aria-keyshortcuts="Alt+R"
    title="快捷键：Alt+R"
    @click="toggle"
  >
    <span aria-hidden="true">{{ speaking ? '⏹' : '🔊' }}</span>
    {{ label }}
    <span v-if="speaking" class="progress" aria-hidden="true">{{ done }}/{{ total }}</span>
  </button>
</template>

<style scoped>
.read-aloud {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2500;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: 2px solid #1f5fbf;
  border-radius: 999px;
  background: #fff;
  color: #1f5fbf;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 14px rgb(0 0 0 / 18%);
}

.read-aloud:hover {
  background: #eef4ff;
}

.read-aloud:focus-visible {
  outline: 3px solid #1f5fbf;
  outline-offset: 3px;
}

.progress {
  padding: 0 6px;
  border-radius: 999px;
  background: #1f5fbf;
  color: #fff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

@media (forced-colors: active) {
  .read-aloud {
    border: 2px solid ButtonText;
    color: ButtonText;
  }
}
</style>
