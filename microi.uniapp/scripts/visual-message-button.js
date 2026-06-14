const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const h5Root = path.join(root, 'dist', 'build', 'h5');
const screenshotDir = path.join(root, 'dist', 'visual-check');
const visualTargets = [
  {
    label: 'message',
    route: '/#/pages/message/index',
    screenshot: 'message-login.png',
    headerSelector: '.msg-header',
    promptSelector: '.mci-auth-prompt__card',
    buttonSelector: '.mci-auth-prompt__button'
  },
  {
    label: 'workspace',
    route: '/#/pages/workspace/index',
    screenshot: 'workspace-login.png',
    headerSelector: '.ws-header',
    promptSelector: '.mci-auth-prompt__card',
    buttonSelector: '.mci-auth-prompt__button'
  }
];

function fail(message) {
  console.error(`Visual check failed: ${message}`);
  process.exitCode = 1;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  }[ext] || 'application/octet-stream';
}

function createStaticServer(staticRoot) {
  return http.createServer((req, res) => {
    const requestUrl = new URL(req.url, 'http://127.0.0.1');
    let pathname = decodeURIComponent(requestUrl.pathname);
    if (pathname === '/') pathname = '/index.html';

    let filePath = path.normalize(path.join(staticRoot, pathname));
    if (!filePath.startsWith(staticRoot)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(staticRoot, 'index.html');
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType(filePath) });
      res.end(data);
    });
  });
}

function httpJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForDebugger(port, timeoutMs = 15000) {
  const startedAt = Date.now();
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const targets = await httpJson(endpoint);
      const page = targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) {}
    await delay(250);
  }
  throw new Error('Browser debugger did not start in time.');
}

function findBrowser() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  for (const command of ['chrome', 'msedge', 'chromium']) {
    const found = spawnSync('where.exe', [command], { encoding: 'utf8' });
    if (found.status === 0) {
      const first = found.stdout.split(/\r?\n/).find(Boolean);
      if (first && fs.existsSync(first)) return first;
    }
  }

  return null;
}

function connectCdp(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();

    ws.addEventListener('open', () => {
      resolve({
        send(method, params = {}) {
          const messageId = ++id;
          ws.send(JSON.stringify({ id: messageId, method, params }));
          return new Promise((sendResolve, sendReject) => {
            pending.set(messageId, { resolve: sendResolve, reject: sendReject });
          });
        },
        close() {
          ws.close();
        }
      });
    });

    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (!message.id || !pending.has(message.id)) return;
      const waiter = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result || {});
    });

    ws.addEventListener('error', reject);
  });
}

function waitForProcessExit(child, timeoutMs = 2500) {
  if (!child || child.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, timeoutMs);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForButton(cdp, selector, label, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const result = await cdp.send('Runtime.evaluate', {
      expression: `Boolean(document.querySelector(${JSON.stringify(selector)}))`,
      returnByValue: true
    });
    if (result.result && result.result.value) return;
    await delay(250);
  }
  throw new Error(`${label} login button was not rendered.`);
}

async function main() {
  if (!fs.existsSync(path.join(h5Root, 'index.html'))) {
    fail('dist/build/h5/index.html is missing. Run npm run build:h5 before visual checks.');
    return;
  }

  const browserPath = findBrowser();
  if (!browserPath) {
    fail('Chrome or Edge was not found. Set CHROME_PATH or EDGE_PATH for visual checks.');
    return;
  }

  const appPort = await getFreePort();
  const debugPort = await getFreePort();
  const server = createStaticServer(h5Root);
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'microi-visual-'));
  let browser;
  let cdp;

  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(appPort, '127.0.0.1', resolve);
    });

    browser = spawn(browserPath, [
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--window-size=390,844',
      'about:blank'
    ], { stdio: 'ignore' });

    const wsUrl = await waitForDebugger(debugPort);
    cdp = await connectCdp(wsUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
      screenWidth: 390,
      screenHeight: 844
    });

    fs.mkdirSync(screenshotDir, { recursive: true });
    for (const target of visualTargets) {
      const pageUrl = `http://127.0.0.1:${appPort}${target.route}`;
      const screenshotPath = path.join(screenshotDir, target.screenshot);
      await cdp.send('Page.navigate', { url: pageUrl });
      await waitForButton(cdp, target.buttonSelector, target.label);
      await delay(800);

      const screenshot = await cdp.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false
      });
      fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));

      const metricsResult = await cdp.send('Runtime.evaluate', {
        returnByValue: true,
        expression: `(() => {
          const selector = ${JSON.stringify(target.buttonSelector)};
          const promptSelector = ${JSON.stringify(target.promptSelector)};
          const headerSelector = ${JSON.stringify(target.headerSelector)};
          const btn = document.querySelector(selector);
          if (!btn) return { ok: false, reason: 'missing ' + selector };
          const prompt = document.querySelector(promptSelector);
          if (!prompt) return { ok: false, reason: 'missing ' + promptSelector };
          const header = document.querySelector(headerSelector);
          if (!header) return { ok: false, reason: 'missing ' + headerSelector };
          const tabbar = document.querySelector('uni-tabbar, .uni-tabbar');
          const textCandidates = Array.from(btn.querySelectorAll('span, uni-text, text, *'))
            .filter((el) => (el.textContent || '').trim().length > 0);
          const text = textCandidates.find((el) => el.children.length === 0) || textCandidates[0] || btn;
          const btnRect = btn.getBoundingClientRect();
          const textRect = text.getBoundingClientRect();
          const promptRect = prompt.getBoundingClientRect();
          const headerRect = header.getBoundingClientRect();
          const tabbarRect = tabbar ? tabbar.getBoundingClientRect() : null;
          const btnStyle = getComputedStyle(btn);
          const textStyle = getComputedStyle(text);
          const btnCenterY = btnRect.top + btnRect.height / 2;
          const textCenterY = textRect.top + textRect.height / 2;
          const btnCenterX = btnRect.left + btnRect.width / 2;
          const textCenterX = textRect.left + textRect.width / 2;
          const promptCenterY = promptRect.top + promptRect.height / 2;
          const availableTop = Math.max(0, headerRect.bottom);
          const availableBottom = tabbarRect && tabbarRect.top > availableTop ? tabbarRect.top : window.innerHeight;
          const availableCenterY = availableTop + (availableBottom - availableTop) / 2;
          const centerDeltaY = Math.abs(btnCenterY - textCenterY);
          const centerDeltaX = Math.abs(btnCenterX - textCenterX);
          const promptCenterDeltaY = Math.abs(promptCenterY - availableCenterY);
          const maxDeltaY = Math.max(2, btnRect.height * 0.06);
          const maxDeltaX = Math.max(2, btnRect.width * 0.06);
          const maxPromptDeltaY = Math.max(16, (availableBottom - availableTop) * 0.08);
          const cssOk = (btnStyle.display === 'flex' || btnStyle.display === 'inline-flex') &&
            btnStyle.alignItems === 'center' &&
            btnStyle.justifyContent === 'center' &&
            textStyle.lineHeight !== 'normal';
          return {
            ok: cssOk && centerDeltaY <= maxDeltaY && centerDeltaX <= maxDeltaX && promptCenterDeltaY <= maxPromptDeltaY,
            cssOk,
            centerDeltaY,
            centerDeltaX,
            promptCenterDeltaY,
            maxDeltaY,
            maxDeltaX,
            maxPromptDeltaY,
            availableTop,
            availableBottom,
            availableCenterY,
            button: { left: btnRect.left, top: btnRect.top, width: btnRect.width, height: btnRect.height },
            prompt: { left: promptRect.left, top: promptRect.top, width: promptRect.width, height: promptRect.height },
            text: { left: textRect.left, top: textRect.top, width: textRect.width, height: textRect.height, value: (text.textContent || '').trim() },
            display: btnStyle.display,
            alignItems: btnStyle.alignItems,
            justifyContent: btnStyle.justifyContent,
            textLineHeight: textStyle.lineHeight
          };
        })()`
      });

      const metrics = metricsResult.result.value;
      if (!metrics || !metrics.ok) {
        console.error(JSON.stringify(metrics, null, 2));
        fail(`${target.label} auth prompt or login button is not centered. Screenshot: ${screenshotPath}`);
        return;
      }

      console.log(`Visual check passed: ${target.label} auth prompt and login button centered. Screenshot: ${screenshotPath}`);
    }
  } finally {
    if (cdp) cdp.close();
    if (browser && !browser.killed) browser.kill();
    await waitForProcessExit(browser);
    server.close();
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch((error) => {
  fail(error.message || String(error));
});
