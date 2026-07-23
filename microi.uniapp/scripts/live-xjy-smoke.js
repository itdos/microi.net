const fs = require('fs')
const http = require('http')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')
const { findWorkspaceRoot } = require('./lib/workspace-paths')
const WebSocketClient = globalThis.WebSocket || require('ws')

const account = process.env.XJY_SMOKE_ACCOUNT || ''
const password = process.env.XJY_SMOKE_PASSWORD || ''
const baseUrl = process.env.XJY_SMOKE_URL || 'http://127.0.0.1:5198'
const workspaceRoot = findWorkspaceRoot(path.resolve(__dirname, '..'))
const outputRoot = path.join(workspaceRoot, '.tmp', 'xjy-live-smoke')

const pages = [
  { name: 'workspace', route: '/#/pages/workspace/index', root: '.home-page', ready: '.quick-grid', settled: '.metric-value:not(.metric-skeleton)', expectedText: ['合同订单'] },
  { name: 'customers', route: '/#/pages/business/list?key=customers', root: '.list-page', ready: '.data-card, .empty-state, .error-state', expectedText: ['去年'], checkTitle: true, checkPeriod: true, checkRefresh: true },
  { name: 'orders', route: '/#/pages/business/list?key=orders', root: '.list-page', ready: '.data-card, .empty-state, .error-state', expectedText: ['去年'], checkTitle: true },
  {
    name: 'tasks', route: '/#/pages/task/list', root: '.task-page', ready: '.task-card, .empty-state, .error-state',
    settledExpression: `[...document.querySelectorAll('.type-chip')].length > 1 && [...document.querySelectorAll('.period-chip__count')].every((item) => item.innerText.trim() !== '·') && [...document.querySelectorAll('.state-card__count')].every((item) => item.innerText.trim() !== '·')`,
    settledTimeout: 90000, expectedText: ['售后任务', '去年'], checkTitle: true, checkPeriod: true, checkRefresh: true, captureTaskStats: true
  },
  { name: 'devices', route: '/#/pages/business/list?key=devices', root: '.list-page', ready: '.data-card, .empty-state, .error-state', expectedText: ['去年'], checkTitle: true },
  { name: 'stores', route: '/#/pages/business/list?key=stores', root: '.list-page', ready: '.data-card, .empty-state, .error-state', expectedText: ['去年'], checkTitle: true },
  {
    name: 'merchant-detail', route: '/#/pages/business/detail?key=stores&id=439d5d12-628f-454c-a896-9e5aa7d433bf',
    root: '.detail-page', ready: '.hero-band, .error-state'
  },
  {
    name: 'native-current-user', dynamicRoute: 'currentUserForm', root: '.native-form-page',
    ready: '.form-section, .error-state', checkImages: true, forbiddenText: ['密码', 'Token', 'OpenId']
  },
  {
    name: 'profile', route: '/#/pages/profile/index', root: '.profile-page', ready: '.menu-group',
    allowedHttpErrors: ['/api/HDFS/OpenPrivateFile']
  }
]

function fail(message) { throw new Error(message) }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH, process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean)
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate
  for (const command of ['chrome', 'msedge', 'chromium']) {
    const result = spawnSync('where.exe', [command], { encoding: 'utf8' })
    if (result.status === 0) {
      const candidate = result.stdout.split(/\r?\n/).find(Boolean)
      if (candidate && fs.existsSync(candidate)) return candidate
    }
  }
  return ''
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(() => resolve(port))
    })
  })
}

function httpJson(url) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, (response) => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', (chunk) => { body += chunk })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) } catch (error) { reject(error) }
      })
    })
    request.once('error', reject)
  })
}

async function waitForDebugger(port, timeoutMs = 15000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const targets = await httpJson(`http://127.0.0.1:${port}/json/list`)
      const page = targets.find((item) => item.type === 'page' && item.webSocketDebuggerUrl)
      if (page) return page.webSocketDebuggerUrl
    } catch (error) {}
    await delay(250)
  }
  fail('Browser debugger did not start')
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocketClient(wsUrl)
    let id = 0
    const pending = new Map()
    const listeners = new Map()
    socket.addEventListener('open', () => resolve({
      send(method, params = {}) {
        const messageId = ++id
        socket.send(JSON.stringify({ id: messageId, method, params }))
        return new Promise((sendResolve, sendReject) => pending.set(messageId, { resolve: sendResolve, reject: sendReject }))
      },
      on(method, listener) {
        const items = listeners.get(method) || []
        items.push(listener)
        listeners.set(method, items)
      },
      close() { socket.close() }
    }))
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data)
      if (message.id && pending.has(message.id)) {
        const waiter = pending.get(message.id)
        pending.delete(message.id)
        if (message.error) waiter.reject(new Error(message.error.message))
        else waiter.resolve(message.result || {})
        return
      }
      if (message.method && listeners.has(message.method)) {
        listeners.get(message.method).forEach((listener) => listener(message.params || {}))
      }
    })
    socket.addEventListener('error', reject)
  })
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) fail(result.exceptionDetails.text || 'Browser evaluation failed')
  return result.result ? result.result.value : undefined
}

async function waitFor(cdp, expression, timeoutMs = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(cdp, expression)) return
    await delay(250)
  }
  fail(`Timed out waiting for: ${expression}`)
}

async function main() {
  if (!account || !password) fail('Set XJY_SMOKE_ACCOUNT and XJY_SMOKE_PASSWORD')
  const browserPath = findBrowser()
  if (!browserPath) fail('Chrome or Edge was not found')
  fs.mkdirSync(outputRoot, { recursive: true })

  const debugPort = await getFreePort()
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xjy-live-smoke-'))
  const browser = spawn(browserPath, [
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profileDir}`,
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--hide-scrollbars', 'about:blank'
  ], { stdio: 'ignore' })
  let cdp
  const consoleErrors = []
  const httpErrors = []
  const apiRequests = []
  const report = []
  let context = 'login'

  try {
    cdp = await connectCdp(await waitForDebugger(debugPort))
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Network.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true, screenWidth: 390, screenHeight: 844
    })
    cdp.on('Runtime.exceptionThrown', (event) => {
      consoleErrors.push({ context, text: (event.exceptionDetails && event.exceptionDetails.text) || 'Uncaught exception' })
    })
    cdp.on('Runtime.consoleAPICalled', (event) => {
      if (!['error', 'assert'].includes(event.type)) return
      const text = (event.args || []).map((item) => item.value || item.description || '').filter(Boolean).join(' ')
      consoleErrors.push({ context, text })
    })
    cdp.on('Network.responseReceived', (event) => {
      const response = event.response || {}
      if (/api\.jifulii\.com/i.test(response.url || '') && Number(response.status) >= 400) {
        httpErrors.push({ context, status: response.status, url: String(response.url).split('?')[0] })
      }
    })
    cdp.on('Network.requestWillBeSent', (event) => {
      const request = event.request || {}
      if (/api\.jifulii\.com/i.test(request.url || '')) apiRequests.push({ context, url: request.url, postData: request.postData || '' })
    })

    await cdp.send('Page.navigate', { url: `${baseUrl}/#/pages/login/index?logout=1` })
    await waitFor(cdp, "Boolean(document.querySelector('.account-login-btn'))")
    const captchaRequired = await evaluate(cdp, "Boolean(document.querySelector('.captcha-input'))")
    if (captchaRequired) fail('Live tenant requires captcha; automated credential smoke stopped without bypassing it')

    const loginState = await evaluate(cdp, `(async () => {
      const inputs = Array.from(document.querySelectorAll('input'));
      if (inputs.length < 2) return { ok: false, reason: 'login inputs missing' };
      const setValue = (element, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        setter.call(element, value);
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue(inputs[0], ${JSON.stringify(account)});
      setValue(inputs[1], ${JSON.stringify(password)});
      const privacy = document.querySelector('.privacy-check');
      if (privacy && !document.querySelector('.check-box.checked')) privacy.click();
      await new Promise((resolve) => setTimeout(resolve, 100));
      document.querySelector('.account-login-btn').click();
      return { ok: true };
    })()`)
    if (!loginState || !loginState.ok) fail((loginState && loginState.reason) || 'Login form could not be submitted')
    await waitFor(cdp, "Boolean(localStorage.getItem('microi_token'))", 25000)
    const tokenLength = await evaluate(cdp, "String(localStorage.getItem('microi_token') || '').length")
    if (!tokenLength) fail('Login returned no token')
    const avatarDiagnostic = await evaluate(cdp, `(() => {
      try {
        const user = JSON.parse(localStorage.getItem('microi_user') || '{}');
        const value = String(user.Avatar || user.HeadImg || '').trim();
        return { present: Boolean(value), length: value.length, literalNull: /^(null|undefined|\[\]|\{\})$/i.test(value), absolute: /^(https?:|data:|blob:)/i.test(value) };
      } catch (error) { return { parseError: true }; }
    })()`)
    const currentUser = await evaluate(cdp, `(() => { try { return JSON.parse(localStorage.getItem('microi_user') || '{}'); } catch (error) { return {}; } })()`)

    for (const page of pages) {
      context = page.name
      const consoleStart = consoleErrors.length
      const httpStart = httpErrors.length
      let pageRoute = page.route || ''
      if (page.dynamicRoute === 'currentUserForm') {
        const userId = await evaluate(cdp, `(() => { try { return JSON.parse(localStorage.getItem('microi_user') || '{}').Id || ''; } catch (error) { return ''; } })()`)
        if (!userId) fail('Current user Id is missing for native form smoke')
        pageRoute = `/#/pages/native-form/index?table=Sys_User&id=${encodeURIComponent(userId)}&mode=View&title=${encodeURIComponent('个人资料')}`
      }
      const route = pageRoute.startsWith('/#') ? pageRoute.slice(1) : pageRoute
      await cdp.send('Page.navigate', { url: `${baseUrl}/?liveSmoke=${Date.now()}${route}` })
      await waitFor(cdp, `Boolean(document.querySelector(${JSON.stringify(page.root)}))`)
      await waitFor(cdp, `Boolean(document.querySelector(${JSON.stringify(page.ready)}))`)
      if (page.settled) await waitFor(cdp, `Boolean(document.querySelector(${JSON.stringify(page.settled)}))`, 25000)
      if (page.settledExpression) await waitFor(cdp, page.settledExpression, page.settledTimeout || 25000)
      await delay(800)
      let interaction = null
      if (page.checkPeriod || page.checkRefresh) {
        const requestStart = apiRequests.length
        interaction = await evaluate(cdp, `(async () => {
          const root = document.querySelector(${JSON.stringify(page.root)});
          let component = root && root.__vueParentComponent;
          while (component && !(component.proxy && typeof component.proxy.refresh === 'function')) component = component.parent;
          const periods = [...document.querySelectorAll('.period-item, .period-chip')];
          const lastYearVisible = periods.some((item) => item.innerText.includes('去年'));
          let periodActivated = true;
          if (${JSON.stringify(Boolean(page.checkPeriod))}) {
            const today = periods.find((item) => item.innerText.includes('本日'));
            if (!today) periodActivated = false;
            else {
              today.click();
              await new Promise((resolve) => setTimeout(resolve, 900));
              periodActivated = today.classList.contains('active');
            }
          }
          if (${JSON.stringify(Boolean(page.captureTaskStats))}) {
            const all = periods.find((item) => item.innerText.trim().startsWith('全部'));
            if (!all) periodActivated = false;
            else {
              all.click();
              await new Promise((resolve) => setTimeout(resolve, 900));
              periodActivated = periodActivated && all.classList.contains('active');
            }
          }
          let refreshFinished = true;
          if (${JSON.stringify(Boolean(page.checkRefresh))}) {
            if (!component || !component.proxy) refreshFinished = false;
            else {
              await component.proxy.refresh();
              refreshFinished = !component.proxy.refreshing && !component.proxy.loading;
            }
          }
          return { lastYearVisible, periodActivated, refreshFinished };
        })()`)
        interaction.apiRequests = apiRequests.length - requestStart
      }
      if (page.captureTaskStats) {
        await waitFor(cdp, `(() => {
          const root = document.querySelector(${JSON.stringify(page.root)});
          let component = root && root.__vueParentComponent;
          while (component && !(component.proxy && component.proxy.typeCounts)) component = component.parent;
          const proxy = component && component.proxy;
          if (!proxy || proxy.period !== 'all' || Number(proxy.count || 0) <= 0) return false;
          const typeTotal = Object.values(proxy.typeCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
          const stateTotal = Object.values(proxy.stateCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
          return Object.keys(proxy.periodCounts || {}).length >= 7 && typeTotal === Number(proxy.count) && stateTotal === Number(proxy.count);
        })()`, 25000)
      }
      const state = await evaluate(cdp, `(() => {
        const bodyText = (document.body.innerText || '').trim();
        const forbidden = [...['[object Object]', '["浙江省"', '["宁波市"', '"CreateTime":', '<p>', '</p>'], ...${JSON.stringify(page.forbiddenText || [])}].filter((text) => bodyText.includes(text));
        const root = document.querySelector(${JSON.stringify(page.root)});
        const failedImages = ${JSON.stringify(Boolean(page.checkImages))} && root
          ? [...root.querySelectorAll('img')].filter((image) => image.src && image.complete && image.naturalWidth === 0).map((image) => image.src)
          : [];
        const expectedTextMissing = ${JSON.stringify(page.expectedText || [])}.filter((text) => !bodyText.includes(text));
        const title = ${JSON.stringify(Boolean(page.checkTitle))} ? document.querySelector('.mci-page-shell__title, .nav-title') : null;
        const titleState = title ? { text: title.innerText, clipped: title.scrollWidth > title.clientWidth + 1, width: title.clientWidth, scrollWidth: title.scrollWidth } : null;
        const metrics = Object.fromEntries([...document.querySelectorAll('.metric')].map((item) => {
          const label = (item.querySelector('.metric-label') || {}).innerText || '';
          const value = (item.querySelector('.metric-value') || {}).innerText || '';
          return [label, value];
        }));
        let taskStats = null;
        if (${JSON.stringify(Boolean(page.captureTaskStats))}) {
          let component = root && root.__vueParentComponent;
          while (component && !(component.proxy && component.proxy.typeCounts)) component = component.parent;
          const proxy = component && component.proxy;
          taskStats = proxy ? {
            count: Number(proxy.count || 0),
            typeTotal: Object.values(proxy.typeCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0),
            typeKeys: Object.keys(proxy.typeCounts || {}).length,
            stateTotal: Object.values(proxy.stateCounts || {}).reduce((sum, value) => sum + Number(value || 0), 0),
            stateKeys: Object.keys(proxy.stateCounts || {}).length,
            periodKeys: Object.keys(proxy.periodCounts || {}).length
          } : null;
        }
        return {
          textLength: bodyText.length, taskStats,
          forbidden, expectedTextMissing, titleState, metrics,
          failedImages,
          errorState: Boolean(document.querySelector('.error-state')),
          loginVisible: Boolean(document.querySelector('.login-container')),
          avatarFallback: Boolean(document.querySelector('.avatar')) && !document.querySelector('.avatar image')
        };
      })()`)
      const pageConsoleErrors = consoleErrors.slice(consoleStart)
      const pageHttpErrors = httpErrors.slice(httpStart)
      const allowedHttpErrors = page.allowedHttpErrors || []
      const expectedHttpErrors = pageHttpErrors.filter((item) =>
        state.avatarFallback && allowedHttpErrors.some((pattern) => item.url.includes(pattern))
      )
      const unexpectedHttpErrors = pageHttpErrors.filter((item) => !expectedHttpErrors.includes(item))
      report.push({
        name: page.name, ...state, interaction, consoleErrors: pageConsoleErrors,
        httpErrors: unexpectedHttpErrors, expectedHttpErrors
      })
      const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false })
      fs.writeFileSync(path.join(outputRoot, `${page.name}.png`), Buffer.from(shot.data, 'base64'))
      if (state.errorState || state.loginVisible || state.textLength < 20 || state.forbidden.length || state.failedImages.length || state.expectedTextMissing.length || (state.titleState && state.titleState.clipped)) {
        fail(`Live page failed: ${page.name} ${JSON.stringify(state)}`)
      }
      if (interaction && (!interaction.lastYearVisible || !interaction.periodActivated || !interaction.refreshFinished || interaction.apiRequests < 1)) {
        fail(`Live interaction failed: ${page.name} ${JSON.stringify(interaction)}`)
      }
      if (page.captureTaskStats && (!state.taskStats || state.taskStats.typeKeys < 1 || state.taskStats.stateKeys < 7 || state.taskStats.periodKeys < 7 || state.taskStats.typeTotal !== state.taskStats.count || state.taskStats.stateTotal !== state.taskStats.count)) {
        fail(`Live task statistics are inconsistent: ${JSON.stringify(state.taskStats)}`)
      }
      if (page.name === 'workspace' && String(currentUser.Account || '') === '13575718658') {
        const orderCount = Number(String(state.metrics['合同订单'] || '').replace(/[^\d.]/g, ''))
        if (!(orderCount > 0)) fail(`Manager contract statistics should be greater than zero: ${JSON.stringify(state.metrics)}`)
      }
      if (pageConsoleErrors.length || unexpectedHttpErrors.length) {
        fail(`Live page emitted errors: ${page.name} ${JSON.stringify({ consoleErrors: pageConsoleErrors, httpErrors: unexpectedHttpErrors, avatarDiagnostic })}`)
      }
    }

    const result = { generatedAt: new Date().toISOString(), authenticated: true, tokenStored: true, pages: report }
    fs.writeFileSync(path.join(outputRoot, 'report.json'), JSON.stringify(result, null, 2))
    console.log(`Live read-only smoke passed: ${report.length} authenticated pages with screenshots.`)
  } finally {
    if (cdp) cdp.close()
    if (!browser.killed) browser.kill()
    try { fs.rmSync(profileDir, { recursive: true, force: true }) } catch (error) {}
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error)
  process.exitCode = 1
})
