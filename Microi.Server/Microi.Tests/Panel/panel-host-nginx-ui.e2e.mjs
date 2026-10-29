// 界面组件契约验收：API 使用受控夹具；不能替代 Linux/真实 Nginx/第三方面板验收。
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { freemem, totalmem } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium, expect } = createRequire(resolve(root, 'Microi.Client/package.json'))('@playwright/test');
const output = resolve(process.env.PANEL_TEST_RESULTS || resolve(root, '.tmp/panel-host-ui-' + randomUUID()));
assert(output.startsWith(resolve(root, '.tmp') + sep));
const staticRoot = resolve(process.env.PANEL_UI_DIRECTORY || resolve(root, 'Microi.Server/Microi.Panel/wwwroot'));
assert(freemem() > Math.max(1.5 * 1024 ** 3, totalmem() * .05) + 768 * 1024 ** 2);
await mkdir(output, { recursive: true });
const checks = [], errors = [], writes = [];
let browser, attached = false, timeoutOnce = true, content = 'server { listen 80; server_name existing.example.test; return 200 "original"; }\n', hash = 'a'.repeat(64);
const instance = { id: 'baota', provider: 'Baota', name: '宝塔 Nginx', version: '1.26.3', kind: 'native', status: 'running', fingerprint: 'b'.repeat(64), configRoot: '/www/server/panel/vhost/nginx' };
const site = { id: 'existing.example.test.conf', name: '已有业务站点', domains: ['existing.example.test'], fileName: 'existing.example.test.conf' };
const managed = { id: 'managed-gateway', pluginId: 'nginx', state: 'Installed', version: '1.30.4', ports: { http: 8080, https: 8443 } };
const server = createServer(async (request, response) => {
  try {
    const path = resolve(staticRoot, '.' + new URL(request.url, 'http://localhost').pathname);
    assert(path === staticRoot || path.startsWith(staticRoot + sep));
    const file = path === staticRoot ? resolve(staticRoot, 'index.html') : path;
    response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.statusCode = 404; response.end('missing'); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
function pass(name) { checks.push(name); console.log('PASS ' + name); }
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.route('**/ops-api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname.slice('/ops-api/'.length), body = request.postDataJSON();
    const reply = (value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
    if (path === 'session') return reply({ authenticated: true, account: 'fixture-admin', csrfToken: 'fixture-csrf', version: '2.0.1', publicUrl: base });
    if (path === 'snapshot') return reply({ containers: [], tasks: [], deployment: { name: '网站管理验收', services: [] }, policy: {} });
    if (['panel/catalog', 'panel/certificates', 'panel/acme'].includes(path)) return reply([]);
    if (path === 'panel/snapshot') return reply({ resources: [managed], containers: [], operations: [], host: {} });
    if (path === 'panel/nginx/managed-gateway') return reply({ resource: managed, configuration: { sites: [] }, revision: 'initial' });
    if (path === 'panel/nginx/managed-gateway/preview') return reply({ content: '# isolated UI fixture preview' });
    if (path === 'panel/host-nginx/instances') return reply({ instances: [{ ...instance, attached }], errors: [] });
    if (path.endsWith('/sites')) return reply({ instanceId: instance.id, fingerprint: instance.fingerprint, sites: [{ ...site, sha256: hash }] });
    if (path.endsWith('/configuration') && request.method() === 'GET') return reply({ instanceId: instance.id, siteId: site.id, content, domains: site.domains, sha256: hash, fingerprint: instance.fingerprint });
    if (path.endsWith('/history')) return reply({ revisions: [{ id: 'revision-original', created: '2026-10-26T12:00:00Z', sha256: 'a'.repeat(64), state: 'Saved' }] });
    if (path === 'panel/host-nginx/attach') { assert.equal(body.confirm, instance.id); attached = true; return reply({ instanceId: instance.id, attached: true }); }
    if (path === 'panel/host-nginx/configuration') {
      writes.push(body);
      assert.equal(body.confirm, site.id); assert.equal(body.expectedFingerprint, instance.fingerprint);
      if (body.expectedSha256 !== hash) return reply({ error: '站点已被其它管理员修改，请重新读取。' }, 409);
      if (timeoutOnce) { timeoutOnce = false; return reply({ error: '宿主操作超时，结果未知，请使用原请求标识回读或重试。' }, 504); }
      content = body.content; hash = 'c'.repeat(64);
      return reply({ instanceId: instance.id, siteId: site.id, requestId: body.requestId, sha256: hash, backupRevision: 'revision-original', validated: true, reloaded: true });
    }
    if (path === 'panel/acme/external') {
      assert.equal(body.instanceId, instance.id); assert.equal(body.siteId, site.id);
      assert.equal(body.expectedSha256, hash); assert.equal(body.expectedFingerprint, instance.fingerprint);
      assert.equal(body.autoRenew, true); assert.equal(body.acceptTerms, true); assert.equal(body.provider, 'LetsEncrypt');
      assert.deepEqual(body.domains, site.domains);
      return reply({ id: 'external-acme-fixture-operation', state: 'Queued' }, 202);
    }
    return reply({ error: 'Unexpected fixture API ' + path }, 500);
  });
  const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  await page.goto(base);
  await page.getByRole('navigation').getByRole('button', { name: '网站与反向代理', exact: true }).click();
  await page.getByRole('button', { name: '宝塔 / 1Panel 网站', exact: true }).click();
  await expect(page.getByText('只读发现', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '查看配置', exact: true }).click();
  await expect(page.getByRole('textbox', { name: '已有网站 Nginx 配置', exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('dialog', { name: '网站配置 · 已有业务站点', exact: true }).getByRole('button', { name: '关闭', exact: true }).last().click();
  pass('discovery is read-only until explicit attachment');
  await page.getByRole('button', { name: '接入管理', exact: true }).click();
  const attach = page.getByRole('dialog', { name: '接入已有 Nginx', exact: true });
  await expect(attach.getByRole('button', { name: '确认', exact: true })).toBeDisabled();
  await attach.getByRole('textbox').fill(instance.id); await attach.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('已接入管理', { exact: true })).toBeVisible();
  pass('attachment requires matching instance identity');
  await page.getByRole('button', { name: '管理配置', exact: true }).click();
  const editor = page.getByRole('textbox', { name: '已有网站 Nginx 配置', exact: true });
  const changed = content.replace('original', 'updated'); await editor.fill(changed);
  await page.getByRole('button', { name: '校验并发布', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: '发布已有网站配置', exact: true });
  await confirm.getByRole('textbox').fill(site.id); await confirm.getByRole('button', { name: '确认', exact: true }).click();
  const failure = page.getByRole('dialog', { name: '操作未完成', exact: true });
  await expect(failure).toContainText('超时'); await failure.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(editor).toHaveValue(changed);
  // 响应失败后同一正文保留请求身份，服务端决定重放还是拒绝，界面不制造新写入。
  await confirm.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText(/配置已校验并重载，备份编号/)).toBeVisible();
  assert.equal(writes.length, 2); assert.equal(writes[0].requestId, writes[1].requestId);
  await page.getByRole('button', { name: '管理配置', exact: true }).click(); await expect(editor).toHaveValue(changed);
  await editor.fill(changed + '# unsaved\n');
  // 真正的版本冲突不能因为第二次点击就成功；模拟原面板已更新配置，拒绝旧哈希并保留输入。
  content = changed + '# changed by original panel\n'; hash = 'd'.repeat(64);
  await page.getByRole('button', { name: '校验并发布', exact: true }).click();
  await confirm.getByRole('textbox').fill(site.id); await confirm.getByRole('button', { name: '确认', exact: true }).click();
  await expect(failure).toContainText('其它管理员'); await failure.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(editor).toHaveValue(changed + '# unsaved\n');
  assert.equal(writes.length, 3); assert.equal(hash, 'd'.repeat(64));
  await confirm.getByRole('button', { name: '取消', exact: true }).click();
  pass('unknown-result retry preserves identity and actual version conflict preserves draft without overwriting');
  // 页面级编辑框关闭必须先确认，不依赖浏览器原生 confirm。
  await page.getByRole('dialog', { name: '网站配置 · 已有业务站点', exact: true }).getByRole('button', { name: '关闭', exact: true }).last().click();
  const discard = page.getByRole('dialog', { name: '放弃未发布修改', exact: true });
  await discard.getByRole('button', { name: '取消', exact: true }).click(); await expect(editor).toHaveValue(changed + '# unsaved\n');
  await page.getByRole('dialog', { name: '网站配置 · 已有业务站点', exact: true }).getByRole('button', { name: '关闭', exact: true }).last().click();
  await discard.getByRole('button', { name: '确认', exact: true }).click();
  pass('discard confirmation preserves input on cancel');
  // 列表快照之后原面板改了域名，申请必须采用配置回读中的新域名和新摘要。
  site.domains = ['renewed.example.test']; content = content.replace('existing.example.test', site.domains[0]); hash = 'e'.repeat(64);
  await page.getByRole('button', { name: '免费 SSL', exact: true }).click();
  const certificate = page.getByRole('dialog', { name: '已有网站免费 SSL 与自动续期', exact: true });
  await expect(certificate).toContainText('renewed.example.test');
  await expect(certificate.getByRole('checkbox', { name: '启用自动续期', exact: true })).toBeChecked();
  await expect(certificate.getByRole('button', { name: '申请并部署证书', exact: true })).toBeDisabled();
  await certificate.getByLabel(/^证书联系邮箱/).fill('operator@example.test');
  await certificate.getByRole('checkbox', { name: /接受证书机构服务条款/ }).check();
  await certificate.getByRole('button', { name: '申请并部署证书', exact: true }).click();
  await expect(page.getByRole('heading', { name: '操作任务', exact: true })).toBeVisible();
  pass('external SSL defaults to automatic renewal and submits current website identity');
  await page.getByRole('navigation').getByRole('button', { name: '网站与反向代理', exact: true }).click();
  await page.getByRole('button', { name: '宝塔 / 1Panel 网站', exact: true }).click();
  await page.getByLabel('搜索网站', { exact: true }).fill('no-match'); await expect(page.getByText('没有匹配的网站', { exact: true })).toBeVisible();
  await page.getByLabel('搜索网站', { exact: true }).fill('');
  for (const [width, theme] of [[1440, '亮色'], [390, '暗色']]) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await page.getByRole('button', { name: '主题', exact: true }).click();
    await page.getByRole('button', { name: theme, exact: true }).click();
    await page.getByRole('dialog', { name: '外观设置', exact: true }).getByRole('button', { name: '关闭', exact: true }).last().click();
    await page.screenshot({ path: resolve(output, `host-nginx-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      elements: [...document.querySelectorAll('body *')].filter(element => element.getBoundingClientRect().right > innerWidth + 1).map(element => ({ tag: element.tagName, class: element.className, width: element.getBoundingClientRect().width })).slice(0, 12) }));
    assert(overflow.scroll <= width + 1, JSON.stringify(overflow));
  }
  pass('filter and desktop-light/mobile-dark layout render without overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: '吾码 Nginx', exact: true }).click();
  await page.getByRole('button', { name: '＋ 创建网站', exact: true }).click();
  await page.getByLabel(/^网站标识/).fill('pending-site'); await page.getByLabel('网站名称', { exact: true }).fill('待发布网站');
  await page.getByLabel('域名（每行一个）', { exact: true }).fill('pending.example.test');
  await page.getByLabel('网站类型', { exact: true }).selectOption('Static');
  await page.getByRole('button', { name: '保存到待发布配置', exact: true }).click();
  const navigate = () => page.getByRole('navigation').getByRole('button', { name: 'SSL 证书', exact: true }).click();
  await navigate();
  const leave = page.getByRole('dialog', { name: '离开未发布的网站配置', exact: true });
  await expect(leave).toBeVisible(); await leave.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(page.getByText('待发布网站', { exact: true })).toBeVisible();
  await navigate(); await leave.getByRole('button', { name: '放弃修改并离开', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SSL 证书', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: '网站与反向代理', exact: true }).click();
  await expect(page.getByText('待发布网站', { exact: true })).toHaveCount(0);
  pass('managed pending configuration requires a discard decision across website and certificate navigation');
  assert.deepEqual(errors, []); pass('no browser runtime errors');
} finally {
  await browser?.close(); await new Promise(done => server.close(done));
  await writeFile(resolve(output, 'report.json'), JSON.stringify({ evidenceType: 'browser-with-controlled-api-fixture', passed: checks, errors, writes: writes.length, completed: checks.length === 8 }, null, 2));
}
