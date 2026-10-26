// Reusable native Panel HTTP/UI regression. No existing Docker resource or tenant is modified.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, rm, lstat } from 'node:fs/promises';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freemem, totalmem } from 'node:os';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '../..'), workspace = resolve(project, '../..');
const reportRoot = resolve(process.argv[2] || resolve(workspace, '.tmp/panel-security-http-' + randomUUID()));
assert(reportRoot.startsWith(resolve(workspace, '.tmp') + sep));
assert(freemem() > Math.max(1.5 * 1024 ** 3, totalmem() * .05) + 1.2 * 1024 ** 3, 'Insufficient memory for native Panel and one browser');
await mkdir(reportRoot, { recursive: true });
const run = resolve(reportRoot, 'runtime-' + randomUUID()); await mkdir(run);
await writeFile(resolve(run, 'owner.json'), JSON.stringify({ owner: 'panel-security-http', run, createdAt: new Date().toISOString() }));
const port = await new Promise(resolvePort => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(() => resolvePort(value)); }); });
const base = `http://127.0.0.1:${port}`, secret = randomBytes(30).toString('base64url');
await writeFile(resolve(run, 'deployment.json'), '{}');
const child = spawn('dotnet', [resolve(project, 'bin/Release/net10.0/Microi.Panel.dll')], { cwd: project, windowsHide: true,
  env: { ...process.env, ASPNETCORE_URLS: base, DOTNET_GCHeapHardLimit: '0x18000000', OPS_ADMIN_USERNAME: 'security-test', OPS_ADMIN_PASSWORD: secret,
    OPS_ADMIN_PASSWORD_FILE: '', OPS_PUBLIC_URL: base, OPS_DATA_DIR: resolve(run, 'data'), OPS_LOG_DIR: resolve(run, 'logs'), OPS_DEPLOYMENT_FILE: resolve(run, 'deployment.json'),
    OPS_TRUSTED_PROXY_IPS: '127.0.0.1', OPS_TLS_CERTIFICATE_FILE: '', OPS_TLS_PASSWORD_FILE: '', OPS_DOCKER_SOCKET: resolve(run, 'absent-docker.sock') } });
await writeFile(resolve(run, 'process.json'), JSON.stringify({ pid: child.pid, startedAt: new Date().toISOString(), port, owner: 'panel-security-http' }));
let output = '', browser, code; const passes = [];
child.stdout.on('data', b => { output = (output + b).slice(-30000); }); child.stderr.on('data', b => { output = (output + b).slice(-30000); });
child.on('exit', value => { code = value; });
function passed(name) { passes.push(name); console.log('PASS ' + name); }
function client(localAddress, forwarded) {
  const cookies = new Map(); let csrf = '';
  return { cookies,
    async call(path, data, { method = data === undefined ? 'GET' : 'POST', noCsrf = false, extra = {} } = {}) {
      const body = data === undefined ? '' : JSON.stringify(data);
      const result = await new Promise((ok, fail) => {
        const request = httpRequest(base + path, { method, localAddress, headers: { 'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}), Cookie: [...cookies].map(([k,v]) => `${k}=${v}`).join('; '),
          ...(!noCsrf && csrf ? { 'X-Ops-CSRF': csrf } : {}), ...(forwarded ? { 'X-Forwarded-For': forwarded } : {}), ...extra } }, response => {
          let value = ''; response.setEncoding('utf8'); response.on('data', part => { value += part; }); response.on('end', () => {
            for (const cookie of response.headers['set-cookie'] || []) { const [pair] = cookie.split(';'); const i = pair.indexOf('='); cookies.set(pair.slice(0,i), pair.slice(i+1)); }
            let json; try { json = JSON.parse(value); } catch { json = null; }
            if (json?.csrfToken) csrf = json.csrfToken;
            ok({ status: response.statusCode, json, text: value });
          });
        }); request.setTimeout(8000, () => request.destroy(new Error('HTTP deadline'))); request.on('error', fail); request.end(body);
      }); return result;
    }
  };
}
try {
  const a = client('127.0.0.1', '192.0.2.11'), b = client('127.0.0.2', '192.0.2.11');
  for (let i = 0; i < 60; i++) {
    try { if ((await a.call('/health')).status === 200) break; } catch { }
    if (code !== undefined) throw new Error('Panel exited: ' + output.replaceAll(secret, '***'));
    await new Promise(r => setTimeout(r, 250));
    if (i === 59) throw new Error('Panel startup deadline');
  }
  assert.equal((await a.call('/ops-api/session')).status, 200);
  assert.equal((await b.call('/ops-api/session')).status, 200);
  for (let i = 0; i < 12; i++) assert.equal((await a.call('/ops-api/login', { account: 'security-test', password: 'wrong' }, { noCsrf: true })).status, 400);
  passed('invalid CSRF requests do not consume password failures or a shared login quota');
  for (const expected of [401, 401, 429]) assert.equal((await a.call('/ops-api/login', { account: 'security-test', password: 'wrong' })).status, expected);
  assert.equal((await a.call('/ops-api/login', { account: 'security-test', password: secret })).status, 429);
  passed('trusted proxy source reaches exact three-failure lockout; correct password cannot bypass ban');
  assert.equal((await b.call('/ops-api/login', { account: 'security-test', password: secret })).status, 200);
  await b.call('/ops-api/session');
  passed('untrusted forwarded header is ignored and a second IP can still log in');
  const state = (await b.call('/ops-api/panel/security')).json;
  assert.equal(state.currentIp, '127.0.0.2'); assert.equal(state.host, null);
  assert(state.panel.entries.some(x => x.ip === '192.0.2.11' && x.banned));
  passed('operator reads real persisted ban and distinguishes missing host service');
  const policy = { ...state.panel.policy, scope: 'panel', expectedRevision: state.panel.policy.revision, banSeconds: 60 };
  assert.equal((await b.call('/ops-api/panel/security/policy', policy, { method: 'PUT' })).status, 200);
  assert.equal((await b.call('/ops-api/panel/security/policy', policy, { method: 'PUT' })).status, 409);
  passed('policy write reads back and stale editor cannot overwrite newer revision');
  assert.equal((await b.call('/ops-api/panel/security/unban', { ip: '192.0.2.11', confirm: '192.0.2.11', scope: 'panel' })).status, 200);
  assert.equal((await a.call('/ops-api/login', { account: 'security-test', password: secret })).status, 200);
  await a.call('/ops-api/session');
  const copied = new Map(a.cookies);
  assert.equal((await a.call('/ops-api/logout', {})).status, 200);
  a.cookies.clear(); for (const [k,v] of copied) a.cookies.set(k,v);
  assert.equal((await a.call('/ops-api/panel/security')).status, 401);
  passed('manual unban restores login and logout invalidates an actual copied cookie');
  assert.equal((await b.call('/ready')).status, 503);
  passed('liveness is distinct from ledger/Docker/firewall readiness');

  const { chromium } = createRequire(resolve(workspace, 'Microi.Client/package.json'))('@playwright/test');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.getByLabel('运维账号').fill('security-test'); await page.getByLabel('运维密码').fill(secret);
  await page.getByRole('button', { name: '登录运维中心', exact: true }).click();
  await page.getByRole('button', { name: '安全防护', exact: true }).click();
  await page.getByRole('heading', { name: '密码防暴力破解' }).waitFor();
  assert(await page.getByText('主机防护服务未连接。', { exact: false }).isVisible());
  await page.getByLabel('错误次数', { exact: true }).fill('4');
  await page.getByRole('button', { name: '保存策略', exact: true }).click();
  await page.getByRole('button', { name: '知道了', exact: true }).click();
  assert.equal((await b.call('/ops-api/panel/security')).json.panel.policy.maxFailures, 4);
  passed('security page saves actual policy through authenticated CSRF-protected API');
  for (const width of [1440, 390]) for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const controls = await page.getByRole('button', { name: '刷新防护状态', exact: true }).evaluate(el => { const style = getComputedStyle(el); return { color: style.color, background: style.backgroundColor, width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height }; });
    assert(controls.width > 70 && controls.height >= 36 && controls.color !== controls.background);
    await page.screenshot({ path: resolve(reportRoot, `security-${width}-${theme}.png`), fullPage: true });
  }
  assert.deepEqual(errors, []); passed('desktop/mobile and light/dark security page has usable controls, no horizontal page overflow or runtime errors');
  await writeFile(resolve(reportRoot, 'http-ui-report.json'), JSON.stringify({ completed: true, passes, nativeOnly: true, productionHostTest: false, at: new Date().toISOString() }, null, 2));
} catch (error) {
  await writeFile(resolve(reportRoot, 'http-ui-failure.txt'), String(error.stack).replaceAll(secret, '***') + '\n' + output.replaceAll(secret, '***'));
  throw error;
} finally {
  await browser?.close(); child.kill();
  await Promise.race([new Promise(r => child.once('exit', r)), new Promise(r => setTimeout(r, 4000))]);
  if (code === undefined) throw new Error('Owned native Panel process did not stop; retain runtime evidence');
  const identity = JSON.parse(await readFile(resolve(run, 'owner.json'), 'utf8'));
  assert.equal(identity.run, run); assert(!(await lstat(run)).isSymbolicLink());
  await rm(run, { recursive: true });
  assert(!output.includes(secret), 'Test credential was exposed by runtime logs');
}
