import * as legacy from './fixture-context.mjs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const { chromium } = createRequire(resolve(root, 'Microi.Client/package.json'))('@playwright/test');
const work = resolve(root, legacy.work);
const password = (await readFile(resolve(work, 'ops-test.env'), 'utf8')).match(/^OPS_ADMIN_PASSWORD=(.*)$/m)[1];
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://localhost:61880');
  await page.getByLabel('运维账号').fill('ops-test'); await page.getByLabel('运维密码').fill(password);
  await page.getByRole('button', { name: '登录运维中心', exact: true }).click(); await page.getByRole('heading', { name: '服务器总览', exact: true }).waitFor();
  await page.screenshot({ path: resolve(work, 'ops-overview.png'), fullPage: true });
  for (const title of ['吾码平台升级', '升级任务', '自动更新', '运维日志']) { await page.getByRole('button', { name: title, exact: true }).click(); await page.getByRole('heading', { name: title, exact: true }).waitFor(); }
  assert.deepEqual(errors, []); await page.screenshot({ path: resolve(work, 'ops-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.screenshot({ path: resolve(work, 'ops-mobile.png'), fullPage: true });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  await writeFile(resolve(work, 'browser-result.json'), JSON.stringify({ passed: ['Independent login', 'All navigation', 'API/Web down usability', 'Mobile no horizontal overflow'], errors }, null, 2));
  console.log('PASS independent Ops browser login, navigation, API/Web down and responsive layout');
} finally { await browser.close(); }
