import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = process.env.PW_BASE_URL || 'http://localhost:61500';
const API_BASE = process.env.PW_API_BASE || 'https://localhost:61501';
const OS_CLIENT = process.env.PW_OS_CLIENT || 'iTdos';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin';
const PASSWORD = process.env.PW_TEST_PASSWORD || '';
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || '';
const SCREENSHOT_DIR = path.resolve(
  process.cwd(),
  process.env.PW_SCREENSHOT_DIR || '../.tmp/job-engine-acceptance'
);

test.use({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
  ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

function tenantUrl(hash = '') {
  const query = new URLSearchParams({ OsClient: OS_CLIENT, ApiBase: API_BASE });
  return `${FRONTEND}/?${query.toString()}${hash}`;
}

async function loginThroughUi(page) {
  await page.goto(tenantUrl(), { waitUntil: 'domcontentloaded' });
  const account = page.locator([
    'input[placeholder*="用户名"]',
    'input[placeholder*="账号"]',
    'input[placeholder*="帐号"]',
    'input[placeholder*="username" i]',
    'input[placeholder*="user name" i]'
  ].join(', ')).first();
  await expect(account).toBeVisible({ timeout: 30_000 });
  await account.fill(ACCOUNT);
  await page.locator('input[type="password"]').first().fill(PASSWORD);

  const privacy = page.locator('.privacy-policy-wrapper .el-checkbox').first();
  if (await privacy.isVisible().catch(() => false)) {
    const checked = await privacy.evaluate((element) => (
      element.classList.contains('is-checked')
      || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
    ));
    if (!checked) await privacy.click();
  }

  const responsePromise = page.waitForResponse(
    (response) => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
    { timeout: 30_000 }
  );
  await page.getByRole('button', { name: '登录', exact: true }).click();
  const response = await responsePromise;
  const result = await response.json();
  expect(Number(result.Code), result.Msg || 'UI login failed').toBe(1);
  const rawAuthorization = response.headers().authorization
    || result.Data?.Token
    || result.Token
    || result.DataAppend?.Token;
  const token = String(rawAuthorization || '').replace(/^Bearer\s+/i, '');
  expect(token).toBeTruthy();
  await expect(page.getByRole('button', { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
  return token;
}

async function postLegacy(page, token, action, form, expectedCode = 1) {
  const response = await page.request.post(
    `${API_BASE}/api/Job/${action}?OsClient=${encodeURIComponent(OS_CLIENT)}`,
    {
      headers: { authorization: `Bearer ${token}`, OsClient: OS_CLIENT },
      form,
      ignoreHTTPSErrors: true
    }
  );
  expect(response.status(), action).toBe(200);
  const result = await response.json();
  expect(Number(result.Code), `${action}: ${result.Msg || ''}`).toBe(expectedCode);
  return result;
}

async function deleteMetadataRow(page, token, id) {
  const response = await page.request.post(`${API_BASE}/api/FormEngine/DelFormData`, {
    headers: { authorization: `Bearer ${token}`, OsClient: OS_CLIENT },
    data: {
      FormEngineKey: 'diy_schedule_job',
      Id: id,
      _InvokeType: 'Server'
    },
    ignoreHTTPSErrors: true
  });
  expect(response.status(), 'cleanup diy_schedule_job metadata').toBe(200);
  const result = await response.json();
  expect([1, 2], result.Msg || 'cleanup diy_schedule_job metadata').toContain(Number(result.Code));
}

async function visibleJobRow(page, jobName) {
  const row = page.locator('.el-table__row').filter({ hasText: jobName }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

async function confirmMessageBox(page) {
  const box = page.locator('.el-message-box:visible').last();
  await expect(box).toBeVisible({ timeout: 10_000 });
  await box.getByRole('button', { name: /^(确定|OK|Confirm)$/i }).last().click();
}

async function assertReadableText(page) {
  const lowContrast = await page.evaluate(() => {
    const parseColor = (value) => {
      const normalized = String(value || '').trim().toLowerCase();
      if (normalized === 'transparent') return { rgb: [0, 0, 0], alpha: 0 };

      const srgb = normalized.match(/^color\(srgb\s+([^)]*)\)$/);
      if (srgb) {
        const [channelsPart, alphaPart] = srgb[1].split('/').map((part) => part.trim());
        const channels = channelsPart.split(/\s+/).slice(0, 3).map((part) => (
          part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part) * 255
        ));
        const alpha = alphaPart
          ? (alphaPart.endsWith('%') ? Number.parseFloat(alphaPart) / 100 : Number.parseFloat(alphaPart))
          : 1;
        if (channels.length === 3 && channels.every(Number.isFinite) && Number.isFinite(alpha)) {
          return { rgb: channels, alpha };
        }
      }

      const rgb = normalized.match(/^rgba?\(([^)]*)\)$/);
      if (rgb) {
        const [channelsPart, alphaPart] = rgb[1].split('/').map((part) => part.trim());
        const values = channelsPart.includes(',')
          ? channelsPart.split(',').map((part) => part.trim())
          : channelsPart.split(/\s+/);
        const channels = values.slice(0, 3).map((part) => (
          part.endsWith('%') ? Number.parseFloat(part) * 2.55 : Number.parseFloat(part)
        ));
        const legacyAlpha = values.length > 3 ? values[3] : null;
        const rawAlpha = alphaPart || legacyAlpha;
        const alpha = rawAlpha
          ? (rawAlpha.endsWith('%') ? Number.parseFloat(rawAlpha) / 100 : Number.parseFloat(rawAlpha))
          : 1;
        if (channels.length === 3 && channels.every(Number.isFinite) && Number.isFinite(alpha)) {
          return { rgb: channels, alpha };
        }
      }
      return null;
    };
    const composite = (top, bottom) => top.rgb.map((channel, index) => (
      channel * top.alpha + bottom[index] * (1 - top.alpha)
    ));
    const ratio = (foreground, background) => {
      const lum = (color) => {
        const values = color.map((value) => value / 255)
          .map((value) => value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4));
        return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
      };
      const foregroundLum = lum(foreground);
      const backgroundLum = lum(background);
      return (Math.max(foregroundLum, backgroundLum) + 0.05) / (Math.min(foregroundLum, backgroundLum) + 0.05);
    };
    const findBackground = (element) => {
      const layers = [];
      let current = element;
      while (current) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (color && color.alpha > 0) layers.push(color);
        current = current.parentElement;
      }
      return layers.reverse().reduce((background, layer) => composite(layer, background), [255, 255, 255]);
    };
    const issues = [];
    document.querySelectorAll('.diy-table-page *, .diy-table *').forEach((element) => {
      const text = (element.innerText || '').trim();
      if (!text || element.children.length) return;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden' || style.display === 'none' || parseFloat(style.opacity) < 0.5) return;
      const fontSize = parseFloat(style.fontSize);
      if (fontSize < 9) return;
      const background = findBackground(element);
      const foregroundColor = parseColor(style.color);
      if (!foregroundColor || foregroundColor.alpha < 0.01) return;
      const foreground = composite(foregroundColor, background);
      const contrast = ratio(foreground, background);
      if (contrast < 4.5) {
        issues.push({
          text: text.slice(0, 40),
          tag: element.tagName,
          className: String(element.className || ''),
          parentClass: String(element.parentElement?.className || ''),
          color: style.color,
          background,
          contrast: +contrast.toFixed(2),
          fontSize
        });
      }
    });
    return issues;
  });
  expect(lowContrast, `低对比度文字: ${JSON.stringify(lowContrast.slice(0, 8))}`).toEqual([]);
}

test('任务调度七条旧接口与页面暂停恢复全流程可用', async ({ page }) => {
  test.skip(!PASSWORD, 'PW_TEST_PASSWORD is required for the real UI login.');
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });

  const pageErrors = [];
  const badApiResponses = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    if (response.url().startsWith(API_BASE) && /\/api\//i.test(response.url()) && response.status() >= 400) {
      badApiResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  const token = await loginThroughUi(page);
  const marker = Date.now().toString(36);
  const job = {
    Id: randomUUID(),
    JobName: `CodexScheduleCompat${marker}`,
    JobDesc: 'Codex 任务调度兼容回归',
    Description: 'Codex 任务调度兼容回归',
    JobParam: '{"Source":"CodexE2E"}',
    CronDesc: '2099 年一次性安全测试',
    CronExpression: '0 0 0 1 1 ? 2099',
    TimeZoneId: 'Asia/Shanghai',
    JobType: '1',
    ApiEngineKey: 'platform-service-health',
    Action: 'Delete'
  };
  const updatedJob = {
    ...job,
    JobDesc: 'Codex 任务调度兼容回归（已更新）',
    Description: 'Codex 任务调度兼容回归（已更新）',
    CronDesc: '2099 年更新后的安全测试',
    CronExpression: '0 0 0 2 1 ? 2099'
  };
  console.log(`JOB_ENGINE_E2E_ROW=${JSON.stringify({ Id: job.Id, JobName: job.JobName })}`);

  let runtimeDeleted = false;
  try {
    const add = await postLegacy(page, token, 'AddJob', job);
    expect(add.Data?.JobName).toBe(job.JobName);
    expect(add.DataAppend?.Status).toBe('正常');

    const list = await postLegacy(page, token, 'GetAllJob', {
      _PageIndex: '1',
      _PageSize: '100',
      Action: 'Delete'
    });
    expect(list.Data.some((row) => row.JobName === job.JobName)).toBeTruthy();

    const detail = await postLegacy(page, token, 'GetJobDetail', {
      Id: job.Id,
      Action: 'Delete'
    });
    expect(detail.Data.JobName).toBe(job.JobName);
    expect(detail.Data.CronExpression).toBe(job.CronExpression);

    await postLegacy(page, token, 'UpdateJob', updatedJob);
    const updatedDetail = await postLegacy(page, token, 'GetJobDetail', { Id: job.Id });
    expect(updatedDetail.Data.JobDesc).toBe(updatedJob.JobDesc);
    expect(updatedDetail.Data.CronExpression).toBe(updatedJob.CronExpression);

    await postLegacy(page, token, 'PauseJob', {
      Id: job.Id,
      JobName: job.JobName,
      Action: 'Delete'
    });
    const pausedDetail = await postLegacy(page, token, 'GetJobDetail', { Id: job.Id });
    expect(pausedDetail.Data.Status).toBe('暂停');
    await postLegacy(page, token, 'ResumeJob', { Id: job.Id, JobName: job.JobName });

    const getResponse = await page.request.get(
      `${API_BASE}/api/Job/PauseJob?OsClient=${encodeURIComponent(OS_CLIENT)}`,
      { headers: { authorization: `Bearer ${token}`, OsClient: OS_CLIENT }, ignoreHTTPSErrors: true }
    );
    expect(getResponse.status()).toBe(200);
    const getResult = await getResponse.json();
    expect(Number(getResult.Code)).toBe(0);
    expect(String(getResult.Msg || '')).toContain('仅支持 POST');

    await page.goto(tenantUrl('#/job-engine'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('任务调度', { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0, { timeout: 45_000 });
    const keyword = page.locator('.keyword-input input, input[placeholder*="搜索"]').first();
    await expect(keyword).toBeVisible({ timeout: 30_000 });
    const searchResponse = page.waitForResponse(
      (response) => /\/api\/FormEngine\/GetTableData(?:-[^?]+)?(?:\?|$)/i.test(response.url()),
      { timeout: 30_000 }
    );
    await keyword.fill(job.JobName);
    await keyword.press('Enter');
    const searchResult = await (await searchResponse).json();
    expect(Number(searchResult.Code), searchResult.Msg || 'UI search failed').toBe(1);
    expect(Number(searchResult.DataCount)).toBeGreaterThanOrEqual(1);
    let row = await visibleJobRow(page, job.JobName);

    const detailButton = row.getByRole('button', { name: /^(详情|Detail|Details)$/i }).first();
    await expect(detailButton).toBeVisible();
    await detailButton.click();
    const detailDialog = page.locator('.el-dialog:visible, .el-drawer:visible').last();
    await expect(detailDialog).toBeVisible({ timeout: 20_000 });
    await expect(detailDialog.getByText(job.JobName, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    await detailDialog.getByRole('button', { name: /^(关闭|Close)$/i }).first().click();
    await expect(detailDialog).toBeHidden({ timeout: 15_000 });

    row = await visibleJobRow(page, job.JobName);
    const pauseResponse = page.waitForResponse(
      (response) => /\/api\/Job\/PauseJob(?:\?|$)/i.test(response.url()),
      { timeout: 30_000 }
    );
    await row.getByRole('button', { name: /^(暂停|Pause)$/i }).first().click();
    await confirmMessageBox(page);
    const pauseResult = await (await pauseResponse).json();
    expect(Number(pauseResult.Code), pauseResult.Msg || 'UI pause failed').toBe(1);
    row = await visibleJobRow(page, job.JobName);
    await expect(row).toContainText(/暂停|Paused|Pause/i);

    const resumeResponse = page.waitForResponse(
      (response) => /\/api\/Job\/ResumeJob(?:\?|$)/i.test(response.url()),
      { timeout: 30_000 }
    );
    await row.getByRole('button', { name: /^(恢复|Resume|Restore)$/i }).first().click();
    await confirmMessageBox(page);
    const resumeResult = await (await resumeResponse).json();
    expect(Number(resumeResult.Code), resumeResult.Msg || 'UI resume failed').toBe(1);
    row = await visibleJobRow(page, job.JobName);
    await expect(row).toContainText(/正常|Normal/i);

    await expect(page.getByRole('button', { name: /^(新增|Add)$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^(导入|Import)$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^(导出|Export)$/i }).first()).toBeVisible();
    await assertReadableText(page);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'job-engine-functional.png'), fullPage: true });

    await postLegacy(page, token, 'DeleteJob', { Id: job.Id, JobName: job.JobName });
    runtimeDeleted = true;
    await postLegacy(page, token, 'ResumeJob', { Id: job.Id, JobName: job.JobName }, 0);
  } finally {
    if (runtimeDeleted) {
      await postLegacy(page, token, 'UpdateJob', updatedJob);
      runtimeDeleted = false;
    }
    await deleteMetadataRow(page, token, job.Id);
  }

  expect(badApiResponses, badApiResponses.join('\n')).toEqual([]);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
});
