import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID } from 'node:crypto';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium, request } = createRequire(resolve(root, 'Microi.Client/package.json'))('@playwright/test');
const work = resolve(root, legacy.work);
const names = { ops: legacy.names.ops, api: legacy.names.api, web: legacy.names.web };
const label = legacy.label;
function docker(args, options = {}) {
  try { return execFileSync('docker', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...options }).trim(); }
  catch (e) { throw new Error(`Docker ${args[0]} failed: ${(e.stderr || '').toString().slice(-1800)}`); }
}
function inspect(name) { return JSON.parse(docker(['inspect', name]))[0]; }
function safeRemove(name) {
  let container; try { container = inspect(name); } catch { return; }
  assert.equal(container.Config.Labels?.['io.microi.ops.test'], legacy.run, 'refuse removing unowned container');
  docker(['rm', '-f', name]);
}
async function until(fn, message, seconds = 40) {
  const end = Date.now() + seconds * 1000;
  let last;
  while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { last = e; } await new Promise(r => setTimeout(r, 400)); }
  throw new Error(message + (last ? ': ' + last.message : ''));
}
await mkdir(work, { recursive: true });
const password = randomBytes(24).toString('base64url');
await writeFile(resolve(work, 'ops-test.env'), `OPS_ADMIN_USERNAME=ops-test\nOPS_ADMIN_PASSWORD=${password}\nOPS_PUBLIC_URL=http://localhost:61880\nOPS_ALLOWED_FRAME_ORIGINS=http://localhost:61500\nOPS_DEPLOYMENT_FILE=/etc/microi-ops/deployment.json\n`);
const deployment = { id: 'ops-e2e', name: '吾码运维自动化测试', platformApiBase: '', platformOsClient: '', allowedImageRepositories: [legacy.fixtureRepository], services: Object.entries(names).filter(([r]) => r !== 'ops').map(([role, name]) => ({ name, role, repository: legacy.fixtureRepository, tag: 'v2', requireDockerHealth: true, allowAutomatic: true, imageRollbackCompatible: true, readyTimeoutSeconds: 12, stopTimeoutSeconds: 2 })) };
await writeFile(resolve(work, 'deployment.json'), JSON.stringify(deployment));
for (const name of Object.values(names)) safeRemove(name);
for (const [version, health] of [['v1', 'ready'], ['v2', 'ready'], ['bad', 'broken']]) docker(['build', '-t', legacy.fixtureRepository + ':' + version, '--build-arg', 'RELEASE=' + version, '--build-arg', 'HEALTH=' + health, 'Microi.Server/Microi.Panel/Tests/fixture']);
try { docker(['network', 'inspect', legacy.network]); } catch { docker(['network', 'create', '--label', label, legacy.network]); }
for (const [role, port] of [['api', 61881], ['web', 61882]]) docker(['run', '-d', '--name', names[role], '--label', label, '--memory', '128m', '--cpus', '0.5', '--network', legacy.network, '--restart', 'unless-stopped', '-p', `127.0.0.1:${port}:80`, legacy.fixtureImage('v1')]);
docker(['exec', names.api, 'sh', '-c', 'echo persistent-value > /data/probe.txt']);
const oldVolume = inspect(names.api).Mounts.find(x => x.Destination === '/data').Name;
const startOps = () => docker(['run', '-d', '--name', names.ops, '--label', label, '--memory', '512m', '--cpus', '1', '--env-file', resolve(work, 'ops-test.env'), '--network', legacy.network, '-p', '127.0.0.1:61880:8080', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${resolve(work, 'deployment.json')}:/etc/microi-ops/deployment.json:ro`, '-v', `${resolve(work, 'data')}:/microi/ops/data`, '-v', `${resolve(work, 'logs')}:/microi/logs/ops`, legacy.image]);
startOps();
const context = await request.newContext({ baseURL: 'http://localhost:61880' });
let csrf;
async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await context.fetch('/ops-api/' + path, { method, data: body, headers: { 'X-Ops-CSRF': csrf || '', Origin: 'http://localhost:61880' } });
  if (response.status() >= 400) throw new Error(`${path}: ${response.status()} ${await response.text()}`);
  const text = await response.text(); return text ? JSON.parse(text) : {};
}
const passed = [];
function pass(name) { passed.push(name); console.log('PASS ' + name); }
let browser;
try {
  await until(async () => (await context.get('/health')).ok(), 'Ops failed to start');
  assert.equal((await context.get('/ops-api/snapshot')).status(), 401); pass('anonymous Docker access rejected');
  csrf = (await api('session')).csrfToken;
  const rejected = await context.post('/ops-api/login', { data: { account: 'ops-test', password } });
  assert.equal(rejected.status(), 400); pass('CSRF required on login');
  await api('login', { account: 'ops-test', password }); csrf = (await api('session')).csrfToken;
  await api('policy', { mode: 'Manual', intervalSeconds: 60, timeZone: 'Asia/Shanghai', windowStartHour: 2, windowEndHour: 5 }, 'PUT');
  const plan = await api('plans', { services: [names.api, names.web], targets: {}, localOnly: true });
  assert.equal(plan.services.filter(x => x.changed).length, 2);
  assert(!JSON.stringify(plan).includes('snapshotCipher')); pass('plan pins image and conceals container secrets');
  const command = { planId: plan.id, fingerprint: plan.fingerprint, requestId: randomUUID(), confirmInterruption: true };
  const first = await api('tasks', command), retry = await api('tasks', command);
  assert.equal(first.id, retry.id); pass('duplicate request returns one durable task');
  const finished = await until(async () => { const t = await api('tasks/' + first.id); if (['Failed','NeedsAttention','RolledBack'].includes(t.state)) throw new Error(JSON.stringify(t)); return t.state === 'Succeeded' && t; }, 'update failed', 60);
  assert.equal(finished.progress, 100);
  assert.equal(await (await fetch('http://localhost:61881')).text(), 'microi-ops-fixture-v2');
  assert.equal(await (await fetch('http://localhost:61882')).text(), 'microi-ops-fixture-v2');
  assert.equal(inspect(names.api).Mounts.find(x => x.Destination === '/data').Name, oldVolume);
  assert.equal(docker(['exec', names.api, 'cat', '/data/probe.txt']), 'persistent-value'); pass('real API/Web replacement preserves anonymous volume');
  const repeated = await api('plans', { services: [names.api, names.web], targets: {}, localOnly: true });
  assert.equal(repeated.services.filter(x => x.changed).length, 0); pass('same image is not upgraded again');
  docker(['restart', names.ops]);
  await until(async () => (await context.get('/health')).ok(), 'Ops restart failed');
  assert.equal((await api('snapshot')).policy.mode, 'Manual');
  assert.equal((await api('tasks', command)).id, first.id); pass('restart retains policy, session and task idempotency');
  docker(['stop', names.web]);
  const stopped = await api('plans', { services: [names.web], targets: { [names.web]: legacy.fixtureImage('v1') }, localOnly: true, includeStopped: true });
  const st = await api('tasks', { planId: stopped.id, fingerprint: stopped.fingerprint, requestId: randomUUID(), confirmInterruption: true });
  await until(async () => (await api('tasks/' + st.id)).state === 'Succeeded', 'stopped replacement failed');
  assert.equal(inspect(names.web).State.Running, false); pass('stopped services stay stopped after replacement');
  const bad = await api('plans', { services: [names.api], targets: { [names.api]: legacy.fixtureImage('bad') }, localOnly: true });
  const badTask = await api('tasks', { planId: bad.id, fingerprint: bad.fingerprint, requestId: randomUUID(), confirmInterruption: true });
  await until(async () => (await api('tasks/' + badTask.id)).state === 'RolledBack', 'health failure rollback failed', 60);
  assert.equal(await (await fetch('http://localhost:61881')).text(), 'microi-ops-fixture-v2'); pass('unhealthy target restores compatible original container');
  const resumePlan = await api('plans', { services: [names.api], targets: { [names.api]: legacy.fixtureImage('v1') }, localOnly: true });
  const resumeCommand = { planId: resumePlan.id, fingerprint: resumePlan.fingerprint, requestId: randomUUID(), confirmInterruption: true };
  const resumeTask = await api('tasks', resumeCommand);
  await until(async () => (await api('tasks/' + resumeTask.id)).steps[names.api] === 'Switching', 'cutover did not start');
  docker(['kill', names.ops]); docker(['start', names.ops]);
  await until(async () => (await context.get('/health')).ok(), 'Ops recovery failed');
  await until(async () => (await api('tasks/' + resumeTask.id)).state === 'Succeeded', 'cutover resume failed');
  assert.equal((await api('tasks', resumeCommand)).id, resumeTask.id);
  assert.equal(docker(['exec', names.api, 'cat', '/data/probe.txt']), 'persistent-value');
  pass('Ops crash during container cutover resumes the same task and volume');
  docker(['stop', names.api]);
  assert((await context.get('/health')).ok()); assert.equal((await api('snapshot')).containers.filter(x => x.managed && x.state === 'running').length, 0); pass('Ops stays available with both API/Web down');
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:61880');
  await page.getByLabel('运维账号').fill('ops-test'); await page.getByLabel('运维密码').fill(password);
  await page.getByRole('button', { name: '登录运维中心', exact: true }).click(); await page.getByRole('heading', { name: '服务器总览', exact: true }).waitFor();
  for (const title of ['吾码平台升级', '升级任务', '自动更新', '运维日志']) { await page.getByRole('button', { name: title, exact: true }).click(); await page.getByRole('heading', { name: title, exact: true }).waitFor(); }
  assert.deepEqual(errors, []); await page.screenshot({ path: resolve(work, 'ops-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: resolve(work, 'ops-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)); pass('real browser login/navigation and narrow viewport');
  await writeFile(resolve(work, 'test-result.json'), JSON.stringify({ passed, at: new Date().toISOString() }, null, 2));
} finally { await browser?.close(); await context.dispose(); }
