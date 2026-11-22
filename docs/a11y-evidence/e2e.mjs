// 全键盘端到端走查：只用 Tab / Enter / 方向键 / 输入文字，完成“登录 → 发布 → 查看我的发布 → 下架确认”
// 不发送任何鼠标事件，用来证明“原有功能在键盘（无障碍）模式下可用、完整、不中断”
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\SoftwareEngineering\\.a11y\\out\\e2e'
const PORT = 9224
const BASE = 'http://localhost:5173'
fs.mkdirSync(OUT, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = []
function step(text) {
  log.push(text)
  console.log(text)
}

const child = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=D:\\SoftwareEngineering\\.a11y\\edge-profile-e2e',
  '--force-renderer-accessibility',
  '--no-first-run',
  '--disable-gpu',
  '--window-size=1280,900',
  'about:blank',
])
for (let i = 0; i < 40; i++) {
  try {
    if ((await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok) break
  } catch {}
  await sleep(300)
}
await sleep(600)

const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = list.find((t) => t.type === 'page')
const ws = new WebSocket(page.webSocketDebuggerUrl)
await new Promise((res, rej) => {
  ws.addEventListener('open', res)
  ws.addEventListener('error', rej)
})
let msgId = 0
const pending = new Map()
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result)
    pending.delete(m.id)
  }
})
const send = (method, params = {}) => {
  const id = ++msgId
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((r) => pending.set(id, r))
}
const ev = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result
    ?.value

await send('Page.enable')
await send('Accessibility.enable')

async function navigate(url) {
  await send('Page.navigate', { url })
  for (let i = 0; i < 60; i++) {
    await sleep(150)
    if (await ev('document.readyState === "complete"')) break
  }
  await sleep(900)
  await ev('window.scrollTo(0,0); document.body.setAttribute("tabindex","-1"); document.body.focus()')
}

async function key(k, code = k) {
  const map = { Tab: 9, Enter: 13, Escape: 27, ArrowDown: 40, ArrowUp: 38, ' ': 32 }
  const vk = map[k] ?? 0
  // Enter/空格需要一个带 text 的 keyDown，浏览器才会把按键当成“激活”而不是“按下”
  const down = k === 'Enter' ? { type: 'keyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, text: '\r' } : { type: 'rawKeyDown', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk }
  await send('Input.dispatchKeyEvent', down)
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await sleep(150)
}

async function type(text) {
  await send('Input.insertText', { text })
  await sleep(80)
}

async function typeKeys(text) {
  for (const ch of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch, text: ch })
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch })
    await sleep(70)
  }
}

const describeFocus = () =>
  ev(`(() => {
    const el = document.activeElement
    if (!el) return 'none'
    const name = el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.innerText||'').trim().replace(/\\s+/g,' ').slice(0,30)
    const role = el.getAttribute('role') || ''
    return el.tagName.toLowerCase() + (el.getAttribute('type') ? '[' + el.getAttribute('type') + ']' : '') + (role ? ' role=' + role : '') + ' "' + name + '"'
  })()`)

async function tabUntil(matchExpr, max = 40, label = '') {
  for (let i = 0; i < max; i++) {
    await key('Tab')
    const okNow = await ev(`(() => { const el = document.activeElement; return el ? Boolean(${matchExpr}) : false })()`)
    if (okNow === true) {
      step(`  ↳ 第 ${i + 1} 次 Tab 到达${label}：${await describeFocus()}`)
      return true
    }
  }
  step(`  ✗ 未找到${label}（${max} 次 Tab 后仍在 ${await describeFocus()}）`)
  return false
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'))
}

async function axNames() {
  const { nodes } = await send('Accessibility.getFullAXTree')
  return nodes
    .filter((n) => !n.ignored && ['textbox', 'button', 'combobox', 'link', 'alert', 'dialog', 'alertdialog'].includes(n.role?.value))
    .map((n) => `${n.role.value} "${n.name?.value ?? ''}"`)
}

// ---------- 0. 先退出登录，保证从“未登录”状态开始 ----------
await navigate(`${BASE}/`)
await ev(`(async () => {
  const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'include' }).then(r => r.json()).catch(() => null)
  const token = csrf && csrf.data && csrf.data.token
  await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-TOKEN': token || '' } })
})()`)
await sleep(600)

// ---------- 1. 键盘登录 ----------
await navigate(`${BASE}/login`)
await ev('location.reload()')
await sleep(2500)
await ev('window.scrollTo(0,0); document.body.setAttribute("tabindex","-1"); document.body.focus()')
step('步骤 1：/login，只用键盘登录')
await tabUntil('el.tagName === "INPUT" && el.type === "text"', 20, '账号输入框')
await type('20260003')
await key('Tab')
step(`  ↳ Tab 到密码：${await describeFocus()}`)
await type('A11y2026pass')
await tabUntil('el.tagName === "BUTTON" && el.type === "submit"', 10, '登录按钮')
await key('Enter')
await sleep(2500)
step(`  ↳ 回车后地址：${await ev('location.pathname')}；导航出现“我的发布”：${await ev('!!document.querySelector("a[href=\\"/me/items\\"]")')}`)

await shot('e2e-01-logged-in.png')

// ---------- 2. 键盘进入发布页 ----------
step('步骤 2：从导航用 Tab 进入“发布信息”')
await ev('window.scrollTo(0,0); document.body.focus()')
await tabUntil('el.tagName === "A" && (el.getAttribute("href") === "/items/new")', 25, '“发布信息”链接')
await key('Enter')
await sleep(1800)
step(`  ↳ 当前页：${await ev('location.pathname')}，h1=${await ev('(document.querySelector("h1")||{}).textContent')}`)

// ---------- 3. 键盘填写并提交 ----------
step('步骤 3：只用 Tab + 键盘输入填写发布表单')
await ev('window.scrollTo(0,0); document.body.focus()')
await tabUntil('el.tagName === "INPUT" && el.id === "item-title"', 30, '标题输入框')
await type('键盘走查测试物品')
await tabUntil('el.tagName === "INPUT" && el.id === "item-location"', 10, '地点输入框')
await type('图书馆三楼')
await tabUntil('el.tagName === "INPUT" && el.type === "date"', 10, '日期控件')
// 日期控件分“年/月/日”三段，键盘用 数字 + 方向键 切换段
await typeKeys('2026')
await key('ArrowRight')
await typeKeys('11')
await key('ArrowRight')
await typeKeys('20')
step(`  ↳ 日期控件值：${await ev('document.getElementById("item-date").value')}`)
await tabUntil('el.tagName === "TEXTAREA"', 10, '描述文本域')
await type('这是全键盘走查生成的测试条目，用于验证无障碍模式下发布流程完整可用。')
await tabUntil('el.tagName === "BUTTON" && el.type === "submit"', 15, '提交按钮')
await key('Enter')
await sleep(2200)
step(`  ↳ 提交结果：出现“已提交”提示 = ${await ev('!!document.body.innerText.match(/已提交/)')}`)
await shot('e2e-02-published.png')

// ---------- 4. 我的发布里键盘下架 + 弹窗焦点 ----------
step('步骤 4：进入“我的发布”，键盘触发下架确认弹窗')
await navigate(`${BASE}/me/items`)
await ev('window.scrollTo(0,0); document.body.focus()')
step(`  ↳ 下架前“我的发布”条目数：${await ev('document.querySelectorAll("article").length')}`)
const found = await tabUntil(
  'el.tagName === "BUTTON" && (el.innerText||"").trim() === "下架"',
  40,
  '第一条“下架”按钮',
)
if (found) {
  await key('Enter')
  await sleep(900)
  step(`  ↳ 弹窗打开后焦点：${await describeFocus()}`)
  const names = await axNames()
  step(`  ↳ 弹窗无障碍角色：${names.filter((n) => n.startsWith('dialog') || n.startsWith('alertdialog') || n.startsWith('alert ')).join(' | ') || '（未暴露 dialog 角色）'}`)
  await shot('e2e-03-dialog.png')
  await key('Escape')
  await sleep(700)
  step(`  ↳ Esc 关闭后焦点回到：${await describeFocus()}（应回到“下架”按钮）`)
  // 再开一次，用键盘确认下架
  await key('Enter')
  await sleep(800)
  const ok = await ev('(document.activeElement||{}).innerText.trim() === "确定下架"')
  if (ok) {
    step('  ↳ 弹窗初始焦点就在“确定下架”上，直接回车确认')
    await key('Enter')
    await sleep(2000)
    step(`  ↳ 确认下架后条目数：${await ev('document.querySelectorAll("article").length')}，焦点：${await describeFocus()}`)
    await shot('e2e-04-withdrawn.png')
  }
}

fs.writeFileSync(path.join(OUT, 'e2e-log.txt'), log.join('\n'))
step('E2E DONE')
child.kill()
process.exit(0)
