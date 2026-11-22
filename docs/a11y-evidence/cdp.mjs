// 无障碍验证驱动：Edge + CDP 采集无障碍树、键盘走查、截图（含强制颜色）
// 用法：node cdp.mjs <label> all        未登录页 + 学生页 + 管理页
//       node cdp.mjs <label> detail     物品详情页（需先有已发布物品）
//       node cdp.mjs <label> keys       只做键盘走查
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const OUT = 'D:\\SoftwareEngineering\\.a11y'
const BASE = 'http://localhost:5173'
const PORT = 9222
const label = process.argv[2] || 'run'
const mode = process.argv[3] || 'all'
const dir = path.join(OUT, 'out', label)
fs.mkdirSync(dir, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function launch() {
  const profile = path.join(OUT, 'edge-profile')
  const child = spawn(
    EDGE,
    [
      '--headless=new',
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      '--force-renderer-accessibility',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (r.ok) {
        await sleep(600)
        return child
      }
    } catch {
      /* not up yet */
    }
    await sleep(300)
  }
  throw new Error('Edge CDP 未就绪')
}

class Conn {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(e.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }
  send(method, params = {}, timeout = 60000) {
    const id = ++this.id
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`timeout ${method}`))
        }
      }, timeout)
    })
  }
}

async function connect() {
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
  const page = list.find((t) => t.type === 'page')
  if (!page) throw new Error('没有 page target')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => {
    ws.addEventListener('open', res)
    ws.addEventListener('error', rej)
  })
  return new Conn(ws)
}

const ev = (c, expression) =>
  c.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }).then((r) => {
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 300))
    return r.result.value
  })

async function goto(c, url) {
  await c.send('Page.navigate', { url })
  for (let i = 0; i < 80; i++) {
    await sleep(150)
    const ok = await ev(c, 'document.readyState === "complete"').catch(() => false)
    if (ok) break
  }
  await sleep(1000)
}

async function axTree(c) {
  const { nodes } = await c.send('Accessibility.getFullAXTree')
  const byId = new Map(nodes.map((n) => [n.nodeId, n]))
  const root = nodes.find((n) => n.role?.value === 'RootWebArea') ?? nodes[0]
  const lines = []
  const walk = (node, depth) => {
    if (!node) return
    let d = depth
    if (!node.ignored) {
      const role = node.role?.value ?? ''
      const name = node.name?.value ?? ''
      const value = node.value?.value
      const desc = node.description?.value
      const props = {}
      for (const p of node.properties ?? []) {
        if (
          ['focusable', 'focused', 'level', 'checked', 'selected', 'expanded', 'required', 'invalid', 'readonly', 'disabled', 'current', 'live', 'atomic', 'hasPopup', 'modal'].includes(
            p.name,
          )
        ) {
          props[p.name] = p.value?.value
        }
      }
      const propStr = Object.entries(props)
        .map(([k, v]) => `${k}=${v}`)
        .join(' ')
      lines.push(
        `${'  '.repeat(d)}${role}${name ? ` "${name}"` : ''}${value !== undefined ? ` [value=${JSON.stringify(value)}]` : ''}${desc ? ` (desc=${JSON.stringify(desc)})` : ''}${propStr ? ` {${propStr}}` : ''}`,
      )
      d = depth + 1
    }
    for (const cid of node.childIds ?? []) walk(byId.get(cid), d)
  }
  walk(root, 0)
  return lines.join('\n')
}

async function shot(c, file, forced) {
  await c.send('Emulation.setEmulatedMedia', {
    features: forced
      ? [
          { name: 'forced-colors', value: 'active' },
          { name: 'prefers-color-scheme', value: 'dark' },
        ]
      : [],
  })
  await sleep(500)
  const { data } = await c.send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  fs.writeFileSync(path.join(dir, file), Buffer.from(data, 'base64'))
}

async function keyboardWalk(c, steps = 24) {
  await ev(c, 'window.scrollTo(0,0); document.body.setAttribute("tabindex","-1"); document.body.focus()')
  const rows = []
  for (let i = 0; i < steps; i++) {
    await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await sleep(110)
    const info = await ev(
      c,
      `(() => {
        const el = document.activeElement
        if (!el || el === document.body) return { tag: 'BODY(焦点丢失)' }
        const text = (el.innerText || el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 36)
        const cs = getComputedStyle(el)
        return {
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || '',
          name: el.getAttribute('aria-label') || el.getAttribute('title') || text,
          id: el.id || '',
          role: el.getAttribute('role') || '',
          outline: cs.outlineStyle + '/' + cs.outlineWidth,
        }
      })()`,
    )
    rows.push(
      `${String(i + 1).padStart(2)}. ${info.tag}${info.type ? '[' + info.type + ']' : ''} role=${info.role || '-'} name="${info.name}" outline=${info.outline}${info.id ? ' #' + info.id : ''}`,
    )
  }
  return rows.join('\n')
}

async function pageInfo(c) {
  return ev(
    c,
    `({ title: document.title, h1: (document.querySelector('h1')||{}).textContent?.trim() || '', lang: document.documentElement.lang, path: location.pathname, focus: (document.activeElement||{}).tagName || '' })`,
  )
}

async function post(c, p, body, headers = {}) {
  return ev(
    c,
    `(async () => {
      const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'include' }).then(r => r.json()).catch(() => null)
      const token = csrf && csrf.data && csrf.data.token
      const res = await fetch('/api/v1${p}', {
        method: 'POST', credentials: 'include',
        headers: Object.assign({ 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token || '' }, ${JSON.stringify(headers)}),
        body: ${body === undefined ? 'undefined' : JSON.stringify(JSON.stringify(body))}
      })
      return { status: res.status, text: (await res.text()).slice(0, 600) }
    })()`,
  )
}

async function loginAs(c, account, password) {
  await goto(c, `${BASE}/`)
  const r = await post(c, '/auth/login', { account, password })
  return r.status === 200
}

async function logout(c) {
  await goto(c, `${BASE}/`)
  await post(c, '/auth/logout')
}

function latestMailCode() {
  const mailDir = 'D:\\SoftwareEngineering\\campus-lost-and-found\\runtime\\dev-mail'
  const files = fs
    .readdirSync(mailDir)
    .map((f) => ({ f, t: fs.statSync(path.join(mailDir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  const content = fs.readFileSync(path.join(mailDir, files[0].f), 'utf8')
  const m = content.match(/验证码：(\d+)/)
  return m ? m[1] : null
}

async function ensureAccount(c, { studentId, realName, campusCardNo, email, password }) {
  await goto(c, `${BASE}/`)
  const login = await post(c, '/auth/login', { account: studentId, password })
  if (login.status === 200) return { ok: true, how: '已有账号直接登录' }
  const send = await post(c, '/auth/email-codes', { email })
  await sleep(1200)
  const code = latestMailCode()
  if (!code) return { ok: false, step: 'code', send }
  const reg = await post(c, '/auth/register', {
    studentId,
    realName,
    campusCardNo,
    email,
    emailCode: code,
    password,
  })
  if (reg.status !== 201) return { ok: false, step: 'register', reg, send }
  const login2 = await post(c, '/auth/login', { account: studentId, password })
  return { ok: login2.status === 200, how: '注册后登录', login2 }
}

async function capture(c, name, route, opts = {}) {
  await goto(c, BASE + route)
  const info = await pageInfo(c)
  const tree = await axTree(c)
  fs.writeFileSync(path.join(dir, `${name}.ax.txt`), tree)
  await shot(c, `${name}.png`)
  if (opts.forced !== false) await shot(c, `${name}.forced.png`, true)
  await c.send('Emulation.setEmulatedMedia', { features: [] })
  let kb = ''
  if (opts.keys) {
    kb = await keyboardWalk(c, opts.steps || 24)
    fs.writeFileSync(path.join(dir, `${name}.keyboard.txt`), kb)
  }
  console.log(`PAGE ${name} | ${route} | title="${info.title}" h1="${info.h1}" lang=${info.lang}`)
  return `${name.padEnd(14)} ${route.padEnd(16)} title="${info.title}" h1="${info.h1}" lang=${info.lang}`
}

async function main() {
  const child = await launch()
  const c = await connect()
  await c.send('Page.enable')
  await c.send('Runtime.enable')
  await c.send('Accessibility.enable')

  const summary = []

  if (mode === 'all') {
    // 1) 未登录状态
    await logout(c)
    summary.push(await capture(c, 'login', '/login', { keys: true, steps: 14 }))
    summary.push(await capture(c, 'register', '/register', { keys: true, steps: 26 }))
    summary.push(await capture(c, 'home-guest', '/'))
    summary.push(await capture(c, 'items-guest', '/items', { keys: true, steps: 22 }))
    summary.push(await capture(c, 'not-found', '/no-such-page'))

    // 2) 学生账号
    const acc = await ensureAccount(c, {
      studentId: '20260003',
      realName: '测试丙',
      campusCardNo: '90000003',
      email: 'a11y20260003@example.com',
      password: 'A11y2026pass',
    })
    console.log('ACCOUNT', JSON.stringify(acc))
    summary.push(await capture(c, 'home-student', '/'))
    summary.push(await capture(c, 'items-student', '/items', { keys: true, steps: 22 }))
    summary.push(await capture(c, 'publish', '/items/new', { keys: true, steps: 40 }))
    summary.push(await capture(c, 'my-items', '/me/items', { keys: true, steps: 24 }))
    summary.push(await capture(c, 'profile', '/me/profile', { keys: true, steps: 30 }))

    // 3) 发布一条物品，供详情页使用
    const created = await post(
      c,
      '/items',
      {
        type: 'LOST',
        category: 'DOCUMENT',
        title: '校园卡（测试数据）',
        location: '图书馆一楼',
        occurredDate: '2026-11-20',
        description: '无障碍测试用物品，请勿认领。',
      },
      { 'Idempotency-Key': crypto.randomUUID() },
    )
    const m = created.text.match(/"id":"?(\d+)"?/)
    fs.writeFileSync(path.join(OUT, 'item.json'), JSON.stringify({ created, id: m ? m[1] : null }, null, 2))
    console.log('ITEM_CREATED', created.status, m ? m[1] : created.text.slice(0, 200))

    // 4) 管理员
    const adminPassword = process.env.A11Y_ADMIN_PASSWORD || ''
    const adminOk = await loginAs(c, 'admin', adminPassword)
    console.log('ADMIN_LOGIN', adminOk)
    summary.push(await capture(c, 'admin', '/admin', { keys: true, steps: 14 }))
  } else if (mode === 'makeitem') {
    await ensureAccount(c, {
      studentId: '20260003',
      realName: '测试丙',
      campusCardNo: '90000003',
      email: 'a11y20260003@example.com',
      password: 'A11y2026pass',
    })
    const created = await post(
      c,
      '/items',
      {
        type: 'LOST',
        category: 'DOCUMENT',
        title: '校园卡（无障碍测试数据）',
        location: '图书馆一楼大厅',
        occurredDate: '2026-11-20',
        description: '这是无障碍适配验证用的测试物品，描述包含多行文字。\n第二行用于验证 alt 与描述朗读。',
      },
      { 'Idempotency-Key': crypto.randomUUID() },
    )
    const m = created.text.match(/"id":"?(\d+)"?/)
    console.log('ITEM_CREATED', created.status, m ? m[1] : created.text.slice(0, 300))
    fs.writeFileSync(path.join(OUT, 'item.json'), JSON.stringify({ created, id: m ? m[1] : null }, null, 2))
  } else if (mode === 'skip') {
    // 键盘用户按一次 Tab 应该停在“跳到主内容”上，这里截图留证
    await goto(c, `${BASE}/items`)
    await ev(c, 'window.scrollTo(0,0); document.body.setAttribute("tabindex","-1"); document.body.focus()')
    await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
    await sleep(400)
    const first = await ev(c, '(() => { const el = document.activeElement; return el.tagName + " | " + (el.textContent||"").trim() + " | " + (el.getAttribute("href")||"") })()')
    console.log('FIRST_TAB_STOP', first)
    await shot(c, 'skip-link-focused.png')
    await c.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    await sleep(600)
    const after = await ev(c, '(() => { const el = document.activeElement; return el.tagName + "#" + el.id + " h1=" + ((document.querySelector("h1")||{}).textContent||"").trim() })()')
    console.log('AFTER_ENTER', after)
  } else if (mode === 'detail') {
    const id = process.argv[4]
    summary.push(await capture(c, 'item-detail', `/items/${id}`, { keys: true, steps: 20 }))
  } else if (mode === 'student') {
    await ensureAccount(c, {
      studentId: '20260003',
      realName: '测试丙',
      campusCardNo: '90000003',
      email: 'a11y20260003@example.com',
      password: 'A11y2026pass',
    })
    for (const [name, route, steps] of [
      ['home-student', '/', 0],
      ['items-student', '/items', 22],
      ['publish', '/items/new', 40],
      ['my-items', '/me/items', 24],
      ['profile', '/me/profile', 30],
    ]) {
      summary.push(await capture(c, name, route, steps ? { keys: true, steps } : {}))
    }
    const id = process.argv[4]
    if (id) summary.push(await capture(c, 'item-detail', `/items/${id}`, { keys: true, steps: 20 }))
  }

  fs.writeFileSync(path.join(dir, '_summary.txt'), summary.join('\n'))
  console.log('DONE', dir)
  child.kill()
  process.exit(0)
}

main().catch((e) => {
  console.error('FAILED', e)
  process.exit(1)
})
