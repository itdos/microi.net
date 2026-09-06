import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tls from 'node:tls';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium, request } = createRequire(resolve(root, 'Microi.Client/package.json'))('@playwright/test');
const work = resolve(root, '.tmp/microi-ops-20260906');
const name = 'microi-ops-e2e-20260906';
function docker(args) { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
const old = JSON.parse(docker(['inspect', name]))[0]; assert.equal(old.Config.Labels['io.microi.ops.test'], '20260906');
// 只读取本机开发证书，再在 Ops 中固定校验证书 SHA256；不会对实际登录禁用 TLS 校验。
const certificate = await new Promise((resolveCert, reject) => {
  const socket = tls.connect({ host: 'localhost', port: 61501, rejectUnauthorized: false }, () => { const raw = socket.getPeerCertificate().raw; socket.end(); resolveCert(raw); }); socket.on('error', reject);
});
await writeFile(resolve(work, 'platform.cer'), certificate);
const deployment = JSON.parse(await readFile(resolve(work, 'deployment.json'), 'utf8'));
deployment.platformApiBase = 'https://host.docker.internal:61501'; deployment.platformOsClient = 'iTdos';
await writeFile(resolve(work, 'deployment.json'), JSON.stringify(deployment));
let env = await readFile(resolve(work, 'ops-test.env'), 'utf8');
env = env.replace(/^OPS_PLATFORM_CERTIFICATE_FILE=.*\n?/gm, '') + 'OPS_PLATFORM_CERTIFICATE_FILE=/etc/microi-ops/platform.cer\n';
await writeFile(resolve(work, 'ops-test.env'), env);
const password = env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
docker(['rm', '-f', name]);
docker(['run', '-d', '--name', name, '--label', 'io.microi.ops.test=20260906', '--memory', '512m', '--cpus', '1', '--env-file', resolve(work, 'ops-test.env'), '--network', 'microi-ops-e2e-network', '-p', '127.0.0.1:61880:8080', '-v', '/var/run/docker.sock:/var/run/docker.sock', '-v', `${resolve(work, 'deployment.json')}:/etc/microi-ops/deployment.json:ro`, '-v', `${resolve(work, 'platform.cer')}:/etc/microi-ops/platform.cer:ro`, '-v', `${resolve(work, 'data')}:/microi/ops/data`, '-v', `${resolve(work, 'logs')}:/microi/logs/ops`, 'microi-ops:local-20260906']);
const source = await readFile(resolve(root, 'AI测试要用到的帐号密码.txt'), 'utf8');
const lines = source.split(/\r?\n/); const hostIndex = lines.findIndex(line => line.includes('api.itdos.com'));
const line = (hostIndex >= 0 ? lines.slice(hostIndex + 1).find(value => /^帐号/.test(value.trim())) : null) || lines.find(value => /^帐号/.test(value.trim()));
const match = line?.match(/^帐号\s*([^，,\s]+).*?密码\s*([^，,\s]+)/);
if (!match || match[1] !== 'admin') throw new Error('Cannot locate approved admin test credential; no credential values printed.');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const probe = await request.newContext();
try {
  for (let i = 0; i < 40; i++) { try { if ((await probe.get('http://localhost:61880/health')).ok()) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:61880');
  await page.getByLabel('运维账号').fill('ops-test'); await page.getByLabel('运维密码').fill(password);
  await page.getByRole('button', { name: '登录运维中心', exact: true }).click();
  await page.getByRole('heading', { name: '运行总览', exact: true }).waitFor();
  await page.getByRole('button', { name: '平台连接', exact: true }).click();
  await page.getByLabel('平台账号', { exact: false }).fill(match[1]); await page.getByLabel('平台密码').fill(match[2]);
  const config = await page.evaluate(async () => (await fetch('/ops-api/platform/config')).json());
  assert.equal(config.enableCaptcha, false, 'Real tenant setting must be observed; never bypass an enabled captcha.');
  await page.getByRole('button', { name: '登录并连接平台', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '平台登录成功' }).waitFor({ timeout: 30_000 });
  const deadline = Date.now() + 60_000; let platform;
  while (Date.now() < deadline) {
    platform = await page.evaluate(async () => (await (await fetch('/ops-api/snapshot')).json()).platform);
    if (platform.connected && platform.pendingEvents === 0 && platform.lastSync) break;
    await new Promise(r => setTimeout(r, 1200));
  }
  assert.equal(platform.pendingEvents, 0, platform.lastError || 'No durable receipt');
  assert(platform.lastSync); assert.deepEqual(errors, []);
  await page.screenshot({ path: resolve(work, 'ops-platform-connected.png'), fullPage: true });
  await writeFile(resolve(work, 'platform-result.json'), JSON.stringify({ testedApi: deployment.platformApiBase, osClient: 'iTdos', account: 'admin', captchaEnabled: config.enableCaptcha, pendingEvents: platform.pendingEvents, lastSync: platform.lastSync, errors }, null, 2));
  console.log('PASS real shared backend admin login, authoritative captcha setting and durable MongoDB receipt');
} finally { await browser.close(); await probe.dispose(); }
