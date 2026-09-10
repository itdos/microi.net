import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import https from 'node:https';
import { constants, generateKeyPairSync, privateDecrypt, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium, request } = createRequire(resolve(root, 'Microi.Client/package.json'))('@playwright/test');
const work = resolve(root, legacy.work), name = legacy.names.ops;
// 隔离每轮登录状态与加密密钥；后续本轮重启仍挂载同一目录验证恢复和幂等。
const runStorage = resolve(work, 'protocol-runs', randomUUID());
await mkdir(resolve(runStorage,'data'),{recursive:true});await mkdir(resolve(runStorage,'logs'),{recursive:true});
const originalDeployment = await readFile(resolve(work, 'deployment.json'), 'utf8');
const env = await readFile(resolve(work, 'ops-test.env'), 'utf8');
const password = env.match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const state = { captcha: true, down: true, configDown: false, loginCalls: 0, captchaCalls: 0, token: 'fixture-platform-session-one', attempts: new Map(), persisted: new Map(), rotations: 0 };
const fixturePassword = 'fixture-only-password-92';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6AAAAABJRU5ErkJggg==', 'base64');
const server = https.createServer({ cert: await readFile(resolve(work, 'fixture-tls/fixture-cert.pem')), key: await readFile(resolve(work, 'fixture-tls/fixture-key.pem')) }, async (req, res) => {
  const send = (data, status = 200, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', ...headers }); res.end(JSON.stringify(data)); };
  const path = new URL(req.url, 'https://localhost').pathname;
  try {
    if (path === '/api/Captcha/GetCaptcha') { state.captchaCalls++; res.writeHead(200, { 'Content-Type': 'image/png', captchaid: 'fixture-' + state.captchaCalls }); res.end(png); return; }
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw || '{}');
    assert.equal(body.OsClient, 'fixture-tenant');
    assert.equal(req.headers.did, 'Microi.Ops:ops-e2e');
    if (path === '/apiengine/platform-sys-config') {
      if (state.configDown) return send({ Code: 0 }, 503);
      return send({ Code: 1, Data: { SysTitle: '验证码协议测试平台', EnableCaptcha: state.captcha ? '1' : '0', EnablePrivacyPolicy: 1, PrivacyPolicyName: '测试隐私协议', LoginRsaPublicKey: publicKey.export({ type: 'spki', format: 'pem' }) } });
    }
    if (path === '/api/SysUser/Login') {
      state.loginCalls++; assert.equal(body._ClientType, 'MCP');
      const padded = privateDecrypt({ key: privateKey, padding: constants.RSA_NO_PADDING }, Buffer.from(body.Pwd, 'base64'));
      assert.equal(padded[1], 2); assert.equal(padded.subarray(padded.indexOf(0, 2) + 1).toString(), fixturePassword);
      if (state.captcha && (!body._CaptchaId?.startsWith('fixture-') || body._CaptchaValue !== 'A123')) return send({ Code: 0, Msg: '验证码错误' });
      return send({ Code: 1, Data: { Name: '测试管理员' } }, 200, { Authorization: state.token });
    }
    if (path === '/apiengine/platform-ops-event-ingest') {
      assert.equal(req.headers.authorization, 'Bearer ' + state.token);
      state.attempts.set(body.eventId, (state.attempts.get(body.eventId) || 0) + 1);
      // 模拟已写入后响应中断：重投必须沿用原事件 Id，不产生第二条日志。
      state.persisted.set(body.eventId, body);
      if (state.down) return send({ Code: 0, Msg: 'temporary unavailable' }, 503);
      state.token = 'fixture-platform-session-rotated-' + (++state.rotations);
      return send({ Code: 1, Data: { EventId: body.eventId } }, 200, { Authorization: state.token });
    }
    send({ Code: 0 }, 404);
  } catch { send({ Code: 0, Msg: 'Fixture protocol assertion failed' }, 500); }
});
await new Promise(r => server.listen(61883, '0.0.0.0', r));
function docker(args) { return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }).trim(); }
function remove() { const old = JSON.parse(docker(['inspect', name]))[0]; assert.equal(old.Config.Labels['io.microi.ops.test'], legacy.run); docker(['rm','-f',name]); }
function start(fixture) {
  const mount = fixture ? 'fixture-tls/fixture-cert.pem' : 'platform.cer';
  // 首轮基础面板尚未连接真实平台；恢复时仅还原原有证书配置，不能挂载不存在的文件。
  const certificate = fixture || /^OPS_PLATFORM_CERTIFICATE_FILE=/m.test(env)
    ? ['-e','OPS_PLATFORM_CERTIFICATE_FILE=/etc/microi-ops/platform.cer','-v',`${resolve(work,mount)}:/etc/microi-ops/platform.cer:ro`] : [];
  docker(['run','-d','--name',name,'--label',legacy.label,'--memory','512m','--cpus','1','--env-file',resolve(work,'ops-test.env'),
    ...certificate,'--network',legacy.network,'-p','127.0.0.1:61880:8080',
    '-v','/var/run/docker.sock:/var/run/docker.sock','-v',`${resolve(work,'deployment.json')}:/etc/microi-ops/deployment.json:ro`,
    '-v',`${fixture?resolve(runStorage,'data'):resolve(work,'data')}:/microi/ops/data`,
    '-v',`${fixture?resolve(runStorage,'logs'):resolve(work,'logs')}:/microi/logs/ops`,legacy.image]);
}
const context = await request.newContext({ baseURL: 'http://localhost:61880' });
async function until(fn, seconds = 40) { const end=Date.now()+seconds*1000; while(Date.now()<end){try { const v=await fn();if(v)return v; } catch {} await new Promise(r=>setTimeout(r,500));}throw new Error('Fixture test timed out'); }
let csrf = '', browser, page, releaseSnapshot;
async function api(path, body, method = body ? 'POST' : 'GET') { return context.fetch('/ops-api/'+path,{method,data:body,headers:{'X-Ops-CSRF':csrf,Origin:'http://localhost:61880'}}); }
const passed=[];
try {
  const spec=JSON.parse(originalDeployment);spec.platformApiBase='https://host.docker.internal:61883';spec.platformOsClient='fixture-tenant';
  await writeFile(resolve(work,'deployment.json'),JSON.stringify(spec));remove();start(true);
  await until(async()=>(await context.get('/health')).ok());
  csrf=(await (await api('session')).json()).csrfToken;
  assert((await api('login',{account:'ops-test',password})).ok());csrf=(await(await api('session')).json()).csrfToken;
  assert.equal((await(await api('platform/config')).json()).enableCaptcha,true);
  assert.equal((await api('platform/login',{account:'admin',password:fixturePassword})).status(),400);assert.equal(state.loginCalls,0);
  const cap=await(await api('platform/captcha')).json();assert(cap.image.startsWith('data:image/png'));
  assert.equal((await api('platform/login',{account:'admin',password:fixturePassword,captchaId:cap.id,captchaValue:'A123'})).status(),400);
  passed.push('authoritative captcha and privacy cannot be bypassed');
  browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});
  // 固定住首次部署状态响应，覆盖登录已认证但初始化尚未结束时立即操作菜单的窗口。
  const snapshotGate=new Promise(resolveGate=>{releaseSnapshot=resolveGate;});
  let snapshotStarted;const snapshotRequest=new Promise(resolveStarted=>{snapshotStarted=resolveStarted;});
  await page.route('**/ops-api/snapshot',async route=>{snapshotStarted();await snapshotGate;await route.continue();},{times:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:61880');
  await page.getByLabel('运维账号').fill('ops-test');await page.getByLabel('运维密码').fill(password);await page.getByRole('button',{name:'登录运维中心',exact:true}).click();
  await snapshotRequest;await page.getByRole('button',{name:'平台连接',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'平台连接',exact:true}).isDisabled(),true,'Navigation must wait for authenticated initialization instead of dropping its loading action.');
  releaseSnapshot();await page.getByRole('heading',{name:'服务器总览',exact:true}).waitFor();
  await page.getByRole('button',{name:'平台连接',exact:true}).click();await page.getByRole('textbox',{name:'平台验证码',exact:true}).waitFor();
  await page.getByLabel('平台账号',{exact:false}).fill('admin');await page.getByLabel('平台密码',{exact:false}).fill(fixturePassword);
  await page.getByRole('textbox',{name:'平台验证码',exact:true}).fill('A123');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'登录并连接平台',exact:true}).click();
  await page.getByRole('status').filter({hasText:'平台登录成功'}).waitFor();assert(state.loginCalls>0);passed.push('browser captcha image, RSA login and privacy acknowledgement');
  await page.screenshot({path:resolve(work,'ops-captcha-protocol.png'),fullPage:true});await browser.close();browser=null;
  await until(async()=>{const s=await(await api('snapshot')).json();return s.platform.pendingEvents>0&&s.platform.lastError;});
  docker(['restart',name]);await until(async()=>(await context.get('/health')).ok());
  const offline=await(await api('snapshot')).json();assert(offline.platform.connected);assert(offline.platform.pendingEvents>0);passed.push('platform outage and Ops restart preserve encrypted session and outbox');
  state.down=false;await until(async()=>(await(await api('snapshot')).json()).platform.pendingEvents===0,90);
  assert([...state.attempts.values()].some(v=>v>1));assert(state.rotations>1);passed.push('stable event replay and rotating token receipts');
  state.captcha=false;assert.equal((await(await api('platform/config')).json()).enableCaptcha,false);
  assert((await api('platform/login',{account:'admin',password:fixturePassword,acceptPrivacy:true})).ok());passed.push('captcha-disabled login follows current setting');
  state.configDown=true;const before=state.loginCalls;assert.equal((await api('platform/login',{account:'admin',password:fixturePassword,acceptPrivacy:true})).status(),503);assert.equal(state.loginCalls,before);passed.push('unavailable configuration never assumes captcha disabled');
  for(const file of await readdir(resolve(runStorage,'logs'))) {const text=await readFile(resolve(runStorage,'logs',file),'utf8');assert(!text.includes(fixturePassword));assert(!text.includes('fixture-platform-session'));}
  assert(!(await readFile(resolve(runStorage,'data/ops.db'))).includes(Buffer.from('fixture-platform-session')));assert.deepEqual(errors,[]);
  await writeFile(resolve(work,'protocol-result.json'),JSON.stringify({passed,errors,replayedEvents:[...state.attempts.values()].filter(v=>v>1).length,uniquePersisted:state.persisted.size},null,2));
  for(const name of passed)console.log('PASS '+name);
} catch (error) {
  if(page&&!page.isClosed())await page.screenshot({path:resolve(work,'ops-protocol-failure.png'),fullPage:true,mask:[page.locator('input')]}).catch(()=>{});
  throw error;
} finally {
  releaseSnapshot?.();
  if(browser)await browser.close();await context.dispose();remove();await writeFile(resolve(work,'deployment.json'),originalDeployment);start(false);await new Promise(r=>server.close(r));
}
