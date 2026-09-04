import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = process.env.PW_BASE_URL || 'http://localhost:61500';
const API_BASE = process.env.PW_API_BASE || 'https://localhost:61501';
const OS_CLIENT = process.env.PW_OS_CLIENT || 'iTdos';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin';
const BROWSER_CHANNEL = process.env.PW_BROWSER_CHANNEL || '';
const TARGET_IMAGE = process.env.PW_VISION_TARGET_IMAGE || '';
const RESULT_DIR = path.resolve(process.cwd(), '../AI-Project/microi/vision/test-results');
const ASSET_DIR = path.resolve(process.cwd(), '../AI-Project/microi/vision/test-assets');
const CREDENTIAL_FILE = path.resolve(process.cwd(), '../AI测试要用到的帐号密码.txt');

test.use({
  viewport: { width: 1920, height: 1080 },
  ignoreHTTPSErrors: true,
  ...(BROWSER_CHANNEL ? { channel: BROWSER_CHANNEL } : {})
});
test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

async function testCredential() {
  if (process.env.PW_TEST_PASSWORD) return { account: ACCOUNT, password: process.env.PW_TEST_PASSWORD };
  const source = await fs.readFile(CREDENTIAL_FILE, 'utf8');
  const credentialLine = source.split(/\r?\n/).find((line) => /^帐号/.test(line.trim())) || '';
  const match = credentialLine.match(/^帐号\s*([^，,\s]+).*?密码\s*([^，,\s]+)/);
  if (!match) throw new Error('无法从 AI 测试凭据文件解析本地 iTdos 账号；不会输出凭据内容。');
  return { account: match[1], password: match[2] };
}

function tenantUrl(hash = '') {
  const query = new URLSearchParams({ OsClient: OS_CLIENT, ApiBase: API_BASE });
  return `${FRONTEND}/?${query.toString()}${hash}`;
}

async function loginThroughUi(page) {
  const credential = await testCredential();
  await page.goto(tenantUrl(), { waitUntil: 'domcontentloaded' });
  const account = page.locator([
    'input[placeholder*="用户名"]', 'input[placeholder*="账号"]',
    'input[placeholder*="帐号"]', 'input[placeholder*="username" i]',
    'input[placeholder*="user name" i]'
  ].join(', ')).first();
  await expect(account).toBeVisible({ timeout: 30_000 });
  await account.fill(credential.account);
  const password = page.locator([
    'input[type="password"][placeholder*="密码"]',
    'input[type="password"][placeholder*="user password" i]',
    'input[type="password"]:visible'
  ].join(', ')).first();
  await expect(password).toBeVisible();
  await password.fill(credential.password);

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
    || result.DataAppend?.Token || result.Data?.Token || '';
  const token = String(rawAuthorization).replace(/^Bearer\s+/i, '');
  expect(token, '登录响应必须返回 DiyToken').not.toBe('');
  await expect(page.getByRole('button', { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 30_000 });
  return token;
}

async function postJson(page, token, url, data) {
  const response = await page.request.post(url, {
    headers: { authorization: `Bearer ${token}`, OsClient: OS_CLIENT },
    data,
    ignoreHTTPSErrors: true
  });
  expect(response.status(), url).toBe(200);
  return response.json();
}

async function runVision(page, token, action, data = {}) {
  return postJson(
    page,
    token,
    `${API_BASE}/apiengine/platform-vision-runtime?OsClient=${encodeURIComponent(OS_CLIENT)}`,
    { Action: action, ...data }
  );
}

async function tableRows(page, token, table, where, fields) {
  const result = await postJson(page, token, `${API_BASE}/api/FormEngine/GetTableData`, {
    FormEngineKey: table,
    _Where: where,
    _SelectFields: fields,
    _PageIndex: 1,
    _PageSize: 20
  });
  expect([1, 2], result.Msg || `query ${table}`).toContain(Number(result.Code));
  return Array.isArray(result.Data) ? result.Data : result.Data ? [result.Data] : [];
}

async function ensureSubject(page, token, { name, categoryId, objectType, mode }) {
  const current = await tableRows(page, token, 'mci_vision_subject', [
    ['Name', '=', name], ['AND', 'Enabled', '=', 1]
  ], ['Id', 'Name', 'CategoryId', 'CategoryName', 'ObjectType', 'RecognitionMode']);
  if (current[0]) return current[0];
  const result = await postJson(page, token, `${API_BASE}/api/FormEngine/AddFormData`, {
    FormEngineKey: 'mci_vision_subject',
    ObjectNo: `AUTOTEST-${Date.now()}`,
    Name: name,
    CategoryId: categoryId,
    ObjectType: objectType,
    RecognitionMode: mode,
    ReviewRequired: mode === 'Face' ? 1 : 0,
    Enabled: 1,
    _InvokeType: 'Client'
  });
  expect(Number(result.Code), result.Msg || `create ${name}`).toBe(1);
  return result.Data;
}

async function ensureCarpSample(page, token, subject, base64) {
  const current = await tableRows(page, token, 'mci_vision_sample', [
    ['SubjectId', '=', subject.Id], ['AND', 'Status', '=', 'Ready'],
    ['AND', 'OriginalFileName', '=', 'common-carp.jpg']
  ], ['Id', 'SampleNo', 'SubjectId', 'OriginalFileName', 'ModelKey', 'Status']);
  if (current[0]) return { ...current[0], Existing: true };
  const result = await runVision(page, token, 'Enroll', {
    SubjectId: subject.Id,
    Mode: 'General',
    SampleNo: `autotest-frame-${Date.now()}`,
    FileName: 'common-carp.jpg',
    FileByteBase64: base64,
    Source: 'Import'
  });
  expect(Number(result.Code), result.Msg || 'enroll common carp').toBe(1);
  expect(result.Data.Id).not.toBe('');
  expect(result.Data.SampleNo).toMatch(/^VS\d+$/);
  return result.Data;
}

async function currentPlatformTheme(page) {
  return page.evaluate(async () => {
    const root = document.documentElement;
    const app = document.querySelector('[data-mci-ui-root="microi-vision"]');
    try {
      const { useDiyStore } = await import('/src/pinia/index.js');
      const store = useDiyStore();
      return {
        mode: root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark') ? 'dark' : 'light',
        palette: app?.getAttribute('data-mci-palette') || root.getAttribute('data-mci-palette') || 'blue',
        color: store.themeColor || getComputedStyle(root).getPropertyValue('--mci-color-primary').trim() || '#2563EB'
      };
    } catch {
      const styles = getComputedStyle(app || root);
      return {
        mode: app?.getAttribute('data-theme') === 'dark' || root.getAttribute('data-theme') === 'dark' || root.classList.contains('dark') ? 'dark' : 'light',
        palette: app?.getAttribute('data-mci-palette') || root.getAttribute('data-mci-palette') || 'blue',
        color: styles.getPropertyValue('--vision-primary').trim() || styles.getPropertyValue('--mci-color-primary').trim() || '#2563EB'
      };
    }
  });
}

async function applyPlatformTheme(page, { mode, color }) {
  await page.evaluate(async ({ nextMode, nextColor }) => {
    const [{ setThemeColor, setThemeMode }, { useDiyStore }] = await Promise.all([
      import('/src/utils/theme-color.js'),
      import('/src/pinia/index.js')
    ]);
    const store = useDiyStore();
    // Match ThemeSelect's real runtime contract. Installed per-user visual
    // preferences are authoritative over the local compatibility color, so both
    // values must move together or the global watcher correctly restores the old
    // user palette on the next tick.
    store.setCurrentUser({
      ...(store.GetCurrentUser || {}),
      ThemeMode: nextMode,
      ThemeColor: nextColor
    });
    store.setThemeColor(nextColor);
    setThemeMode(nextMode);
    setThemeColor(nextColor);
  }, { nextMode: mode, nextColor: color });
}

function cssRgb(value) {
  const match = String(value).match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (!match) throw new Error(`无法解析 CSS 颜色：${value}`);
  return match.slice(1, 4).map(Number);
}

function contrastRatio(foreground, background) {
  const luminance = (rgb) => {
    const channels = rgb.map((value) => {
      const channel = value / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

async function assertWorkbenchTheme(page, expected) {
  const root = page.locator('[data-mci-ui-root="microi-vision"]');
  await expect(root).toHaveAttribute('data-theme', expected.mode, { timeout: 15_000 });
  await expect(root).toHaveAttribute('data-mci-palette', expected.palette, { timeout: 15_000 });
  await expect.poll(async () => root.evaluate((element) => getComputedStyle(element).getPropertyValue('--vision-primary').trim().toLowerCase()))
    .toBe(expected.color.toLowerCase());
  const colors = await root.evaluate((element) => {
    const card = element.querySelector('.vision-capture-card');
    const primary = element.querySelector('button.primary');
    const cardStyle = getComputedStyle(card);
    const primaryStyle = getComputedStyle(primary);
    return {
      cardText: cardStyle.color,
      cardBackground: cardStyle.backgroundColor,
      primaryText: primaryStyle.color,
      primaryBackground: primaryStyle.backgroundColor
    };
  });
  expect(contrastRatio(cssRgb(colors.cardText), cssRgb(colors.cardBackground))).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(cssRgb(colors.primaryText), cssRgb(colors.primaryBackground))).toBeGreaterThanOrEqual(4.5);
}

async function readCompactLayout(page) {
  return page.evaluate(() => {
    const rootElement = document.querySelector('[data-mci-ui-root="microi-vision"]');
    const captureElement = document.querySelector('.vision-capture-card');
    const resultElement = document.querySelector('.vision-result-card');
    const stageElement = document.querySelector('.vision-stage');
    const root = rootElement?.getBoundingClientRect();
    const capture = captureElement?.getBoundingClientRect();
    const result = resultElement?.getBoundingClientRect();
    const stage = stageElement?.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      root: root ? { top: root.top, bottom: root.bottom, width: root.width, height: root.height } : null,
      capture: capture ? { top: capture.top, right: capture.right, bottom: capture.bottom, left: capture.left, height: capture.height } : null,
      result: result ? { top: result.top, right: result.right, bottom: result.bottom, left: result.left, height: result.height } : null,
      stageHeight: stage?.height || 0,
      rootClientHeight: rootElement?.clientHeight || 0,
      rootScrollHeight: rootElement?.scrollHeight || 0,
      rootClientWidth: rootElement?.clientWidth || 0,
      rootScrollWidth: rootElement?.scrollWidth || 0,
    };
  });
}

function expectCompactLayout(layout, orientation) {
  expect(layout.root).not.toBeNull();
  expect(layout.capture).not.toBeNull();
  expect(layout.result).not.toBeNull();
  expect(layout.rootScrollHeight).toBeLessThanOrEqual(layout.rootClientHeight + 1);
  expect(layout.rootScrollWidth).toBeLessThanOrEqual(layout.rootClientWidth + 1);
  expect(layout.root.bottom).toBeLessThanOrEqual(layout.viewport.height + 1);
  expect(layout.capture.bottom).toBeLessThanOrEqual(layout.root.bottom + 1);
  expect(layout.result.bottom).toBeLessThanOrEqual(layout.root.bottom + 1);
  expect(layout.stageHeight).toBeGreaterThanOrEqual(96);
  if (orientation === 'portrait') {
    expect(layout.result.top).toBeGreaterThanOrEqual(layout.capture.bottom - 1);
    expect(layout.result.top - layout.capture.bottom).toBeLessThanOrEqual(8);
  } else {
    expect(layout.result.left).toBeGreaterThanOrEqual(layout.capture.right - 1);
    expect(layout.result.left - layout.capture.right).toBeLessThanOrEqual(8);
  }
}

test('真实 61501 链路：样本库优先、AI 异步回退及人脸同意门禁', async ({ page }, testInfo) => {
  await fs.mkdir(RESULT_DIR, { recursive: true });
  const token = await loginThroughUi(page);
  const [carpBytes, tomatoBytes] = await Promise.all([
    fs.readFile(path.join(ASSET_DIR, 'common-carp.jpg')),
    fs.readFile(path.join(ASSET_DIR, 'ripe-tomatoes.jpg'))
  ]);
  const carpBase64 = carpBytes.toString('base64');
  const tomatoBase64 = tomatoBytes.toString('base64');
  expect(createHash('sha256').update(carpBytes).digest('hex')).toBe(
    '905e723054bda5e38f4e97a4a2bf101e8a7322202a9318813be7ed0d6d3c996e'
  );
  expect(createHash('sha256').update(tomatoBytes).digest('hex')).toBe(
    '3ecf6e5c2e0ad3264573d457c48138f5a7b5a15fc0a949e79bed6a6c42fd2e3b'
  );

  const capabilities = await runVision(page, token, 'Capabilities');
  expect(Number(capabilities.Code), capabilities.Msg || 'capabilities').toBe(1);
  expect(capabilities.Data.Capabilities.Models.some((item) => item.Ready)).toBeTruthy();

  const [generalCategories, faceCategories] = await Promise.all([
    tableRows(page, token, 'mci_vision_category', [
      ['Name', 'In', ['水产鱼类', '生鲜水产']], ['AND', 'Enabled', '=', 1]
    ], ['Id', 'Name', 'Scope']),
    tableRows(page, token, 'mci_vision_category', [
      ['Name', '=', '人员'], ['AND', 'Enabled', '=', 1]
    ], ['Id', 'Name', 'Scope'])
  ]);
  expect(generalCategories[0]?.Id, '当前租户需要一个启用的水产分类').toBeTruthy();
  expect(faceCategories[0]?.Id, '当前租户需要一个启用的人员分类').toBeTruthy();

  const generalSubject = await ensureSubject(page, token, {
    name: '自动化测试-鲤鱼', categoryId: generalCategories[0].Id,
    objectType: 'Product', mode: 'General'
  });
  const faceSubject = await ensureSubject(page, token, {
    name: '自动化测试-合规人脸对象', categoryId: faceCategories[0].Id,
    objectType: 'Person', mode: 'Face'
  });
  const sample = await ensureCarpSample(page, token, generalSubject, carpBase64);

  const localRequestId = `autotest-local-${randomUUID().replaceAll('-', '')}`;
  const local = await runVision(page, token, 'Recognize', {
    Mode: 'General', RequestId: localRequestId,
    FileName: 'common-carp.jpg', FileByteBase64: carpBase64
  });
  expect(Number(local.Code), local.Msg || 'local recognition').toBe(1);
  expect(local.Data).toMatchObject({
    Status: 'LocalMatched', MatchSource: 'Database', DatabaseMatched: true,
    Subject: { Id: generalSubject.Id, Name: generalSubject.Name }
  });
  expect(Number(local.Data.LocalSimilarity)).toBeGreaterThanOrEqual(0.99);

  const aiRequestId = `autotest-ai-${randomUUID().replaceAll('-', '')}`;
  const pending = await runVision(page, token, 'Recognize', {
    Mode: 'General', RequestId: aiRequestId,
    FileName: 'ripe-tomatoes.jpg', FileByteBase64: tomatoBase64
  });
  expect(Number(pending.Code), pending.Msg || 'AI fallback enqueue').toBe(1);
  expect(pending.Data).toMatchObject({ Status: 'AiPending', MatchSource: 'None', AiPending: true });
  expect(pending.Data.BackgroundTaskId).not.toBe('');

  let aiFinal = pending;
  for (let attempt = 0; attempt < 45 && aiFinal.Data.Status === 'AiPending'; attempt += 1) {
    await page.waitForTimeout(2_000);
    aiFinal = await runVision(page, token, 'Result', { RequestId: aiRequestId });
  }
  expect(Number(aiFinal.Code), aiFinal.Msg || aiFinal.Data?.ErrorMessage || 'AI result').toBe(1);
  expect(aiFinal.Data).toMatchObject({ Status: 'AiMatched', MatchSource: 'AI', AiPending: false });
  expect(String(aiFinal.Data.Ai?.Label || '')).not.toBe('');

  const noConsentEnroll = await runVision(page, token, 'Enroll', {
    SubjectId: faceSubject.Id,
    Mode: 'Face',
    FileName: 'common-carp.jpg',
    FileByteBase64: carpBase64,
    ConsentConfirmed: false
  });
  expect(Number(noConsentEnroll.Code)).toBe(0);
  expect(String(noConsentEnroll.Msg)).toMatch(/同意|授权/);

  const crossModeEnroll = await runVision(page, token, 'Enroll', {
    SubjectId: generalSubject.Id,
    Mode: 'Face',
    FileName: 'common-carp.jpg',
    FileByteBase64: carpBase64,
    ConsentConfirmed: true
  });
  expect(Number(crossModeEnroll.Code)).toBe(0);
  expect(String(crossModeEnroll.Msg)).toMatch(/模式/);

  const evidence = {
    testedAt: new Date().toISOString(),
    target: { frontend: FRONTEND, api: API_BASE, osClient: OS_CLIENT },
    capabilities: capabilities.Data.Capabilities,
    sample: { id: sample.Id, sampleNo: sample.SampleNo, modelKey: sample.ModelKey },
    databaseMatch: local.Data,
    aiInitial: pending.Data,
    aiFinal: aiFinal.Data,
    privacyGates: { faceEnrollmentWithoutConsent: noConsentEnroll.Msg, crossModeEnrollment: crossModeEnroll.Msg }
  };
  await fs.writeFile(path.join(RESULT_DIR, 'live-api-result.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await testInfo.attach('vision-live-api-result', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});

test('真实 61500 页面：视觉引擎工作台跟随平台主题、可识别且人脸同意前禁用提交', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await loginThroughUi(page);
  await page.goto(tenantUrl('#/micro-app/microi-vision/workbench'), { waitUntil: 'domcontentloaded' });

  // micro-app 在当前版本把可访问 DOM 暴露到宿主树中；直接从 page 定位，
  // 同时兼容 iframe 属性存在但运行时采用沙箱 DOM 的实现。
  const app = page;
  const workbench = app.getByTestId('vision-workbench');
  await expect(workbench).toBeVisible({ timeout: 60_000 });
  await expect(app.getByRole('heading', { name: '视觉引擎', exact: true })).toBeVisible();
  await expect(app.getByText('采集与识别', { exact: true })).toBeVisible();
  await expect(app.getByTestId('bootstrap-error')).toHaveCount(0);

  const originalTheme = await currentPlatformTheme(page);
  if (/^https?:\/\/(?:localhost|127\.0\.0\.1)(?::|\/|$)/i.test(FRONTEND)) {
    try {
      await applyPlatformTheme(page, { mode: 'light', color: '#2563EB' });
      await assertWorkbenchTheme(page, { mode: 'light', palette: 'blue', color: '#2563EB' });
      await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-theme-light-blue.png'), fullPage: true });

      await applyPlatformTheme(page, { mode: 'dark', color: '#2563EB' });
      await assertWorkbenchTheme(page, { mode: 'dark', palette: 'blue', color: '#2563EB' });
      await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-theme-dark-blue.png'), fullPage: true });

      await applyPlatformTheme(page, { mode: 'light', color: '#7C3AED' });
      await assertWorkbenchTheme(page, { mode: 'light', palette: 'purple', color: '#7C3AED' });
      await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-theme-light-purple.png'), fullPage: true });
    } finally {
      await applyPlatformTheme(page, originalTheme);
    }
  } else {
    await assertWorkbenchTheme(page, originalTheme);
    await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-theme-target-current.png'), fullPage: true });
  }

  await app.getByTestId('recognize-file').setInputFiles(path.join(ASSET_DIR, 'common-carp.jpg'));
  await expect(app.getByAltText('待识别图片预览')).toBeVisible();
  await app.getByTestId('recognize-submit').click();
  await expect(app.getByTestId('result-name')).toContainText('鲤鱼', { timeout: 45_000 });
  await expect(app.getByText('租户样本库', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-live-database-match.png'), fullPage: true });

  await app.getByTestId('recognize-file').setInputFiles(path.join(ASSET_DIR, 'ripe-tomatoes.jpg'));
  await app.getByTestId('recognize-submit').click();
  await expect(app.getByTestId('ai-pending')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-live-ai-pending.png'), fullPage: true });
  await expect(app.getByTestId('result-name')).toContainText(/番茄|西红柿/, { timeout: 120_000 });
  await expect(app.getByText('AI 引擎', { exact: true }).first()).toBeVisible();
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-live-ai-result.png'), fullPage: true });

  await app.getByTestId('mode-face').click();
  await app.getByTestId('recognize-file').setInputFiles(path.join(ASSET_DIR, 'common-carp.jpg'));
  await expect(app.getByTestId('recognize-submit')).toBeDisabled();
  await app.getByTestId('face-consent').check();
  await expect(app.getByTestId('recognize-submit')).toBeEnabled();
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-live-face-consent.png'), fullPage: true });

  expect(pageErrors.filter((item) => /ReferenceError|TypeError|Unhandled/i.test(item))).toEqual([]);
});

test('真实 61500 页面：摄像头连续识别支持暂停、继续和强制再次识别', async ({ page }) => {
  await fs.mkdir(RESULT_DIR, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  const recognizedFrames = [];
  const pollRecognizeCounts = [];
  let pendingRequestId = '';
  let resultPolls = 0;
  let recognizeCountAtPending = 0;

  // 使用浏览器原生 canvas.captureStream 生成可控视频轨道。它仍会经过
  // getUserMedia -> video -> canvas -> JPEG 的真实前端采集链，只替代物理摄像头。
  await page.addInitScript(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const context = canvas.getContext('2d');
    let frame = 0;
    const paint = () => {
      frame += 1;
      context.fillStyle = frame % 2 ? '#2f855a' : '#2563eb';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = '48px sans-serif';
      context.fillText(`VISION ${frame}`, 120, 190);
    };
    paint();
    const stream = canvas.captureStream(10);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => stream,
        enumerateDevices: async () => [],
      },
    });
    window.__advanceVisionCameraFrame = paint;
  });

  await page.route('**/apiengine/platform-vision-runtime*', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.continue();
    const raw = request.postData() || '';
    let body = {};
    try { body = JSON.parse(raw); } catch { body = Object.fromEntries(new URLSearchParams(raw)); }
    const action = String(body.Action || '').toLowerCase();
    if (action === 'result' && pendingRequestId && body.RequestId === pendingRequestId) {
      resultPolls += 1;
      pollRecognizeCounts.push(recognizedFrames.length);
      const terminal = resultPolls >= 2;
      await route.fulfill({
        status: 200,
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          Code: 1,
          Data: {
            Id: 'camera-ai-result', RequestId: pendingRequestId, FrameId: pendingRequestId,
            StreamSessionId: recognizedFrames.at(-1)?.StreamSessionId || '', FrameSequence: 2,
            Mode: 'General', Status: terminal ? 'AiMatched' : 'AiPending',
            MatchSource: terminal ? 'AI' : 'None', DatabaseMatched: false, AiPending: !terminal,
            Subject: null, LocalSimilarity: 0, Confidence: terminal ? .93 : 0,
            Ai: terminal ? { Label: '鱼', Category: '水产鱼类', Description: '画面中可见鱼类。', Candidates: [] } : null,
            ModelKey: 'siglip2-base-patch16-224-v1', ModelVersion: '1.0.0', QualityScore: .91,
            BackgroundTaskId: 'camera-ai-task', RequestedAt: new Date().toISOString(),
            CompletedAt: terminal ? new Date().toISOString() : '', ElapsedMs: terminal ? 3100 : 40,
            ErrorMessage: '', DetectedItems: [],
            Stability: { Stable: true, Key: '__unmatched__', Name: '未匹配', VoteCount: 3, WindowCount: 3, AverageConfidence: .91 },
          },
        }),
      });
      return;
    }
    if (action !== 'recognize') return route.continue();

    recognizedFrames.push(body);
    const sequence = Number(body.FrameSequence || recognizedFrames.length);
    const aiPending = sequence === 2 && Boolean(body.Continuous);
    if (aiPending) {
      pendingRequestId = body.RequestId;
      recognizeCountAtPending = recognizedFrames.length;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify({
        Code: 1,
        Data: {
          Id: `camera-result-${sequence}`,
          RequestId: body.RequestId,
          FrameId: body.FrameId,
          StreamSessionId: body.StreamSessionId,
          FrameSequence: sequence,
          Mode: body.Mode || 'General',
          Status: aiPending ? 'AiPending' : 'LocalMatched',
          MatchSource: aiPending ? 'None' : 'Database',
          DatabaseMatched: !aiPending,
          AiPending: aiPending,
          Subject: aiPending ? null : { Id: 'fish-carp', Name: '鲤鱼', CategoryId: 'fish', CategoryName: '淡水鱼' },
          LocalSimilarity: aiPending ? 0 : .94,
          Confidence: aiPending ? 0 : .94,
          Ai: null,
          ModelKey: 'siglip2-base-patch16-224-v1',
          ModelVersion: '1.0.0',
          QualityScore: .91,
          BackgroundTaskId: aiPending ? 'camera-ai-task' : '',
          RequestedAt: new Date().toISOString(),
          CompletedAt: new Date().toISOString(),
          ElapsedMs: 38,
          ErrorMessage: '',
          DetectedItems: [{
            TrackId: 'track-1', Label: 'fish', DetectionConfidence: .96,
            Box: { X: .1, Y: .12, Width: .76, Height: .71 },
            SubjectId: 'fish-carp', SubjectName: '鲤鱼', CategoryId: 'fish',
            CategoryName: '淡水鱼', Similarity: .94, Threshold: .82, Matched: true,
          }],
          Stability: aiPending
            ? { Stable: true, Key: '__unmatched__', Name: '未匹配', VoteCount: 3, WindowCount: 3, AverageConfidence: .91 }
            : { Stable: sequence >= 3, Key: 'fish-carp', Name: '鲤鱼', VoteCount: sequence, WindowCount: Math.min(sequence, 5), AverageConfidence: .94 },
        },
      }),
    });
  });

  await loginThroughUi(page);
  await page.goto(tenantUrl('#/micro-app/microi-vision/workbench'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('vision-workbench')).toBeVisible({ timeout: 60_000 });
  if (OS_CLIENT === 'hongdi-dev') {
    await expect.poll(async () => Number(await page.locator('.vision-summary article').first().locator('strong').textContent() || 0), {
      timeout: 20_000,
    }).toBeGreaterThanOrEqual(10);
  }

  const mobileLayout = await readCompactLayout(page);
  expectCompactLayout(mobileLayout, 'portrait');
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-mobile-compact-initial.png'), fullPage: false });

  await page.getByTestId('camera-toggle').click();
  await expect(page.getByTestId('camera-toggle')).toHaveAttribute('data-camera-state', 'on');
  expect(await page.getByTestId('camera-toggle').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  await expect.poll(() => recognizedFrames.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(1);

  await page.getByTestId('camera-pause').click();
  await expect(page.getByTestId('camera-resume')).toBeVisible();
  const pausedCount = recognizedFrames.length;
  await page.waitForTimeout(2_500);
  expect(recognizedFrames.length).toBe(pausedCount);

  await page.evaluate(() => window.__advanceVisionCameraFrame());
  await page.getByTestId('camera-resume').click();
  await expect.poll(() => recognizedFrames.length, { timeout: 10_000 }).toBeGreaterThan(pausedCount);
  await page.getByTestId('camera-pause').click();
  await expect(page.getByTestId('ai-pending')).toBeVisible();
  await expect(page.getByTestId('camera-retry')).toBeDisabled();
  await expect(page.getByTestId('camera-retry')).toBeEnabled({ timeout: 10_000 });
  expect(resultPolls).toBeGreaterThanOrEqual(2);
  expect(pollRecognizeCounts.every((count) => count === recognizeCountAtPending)).toBeTruthy();
  await expect(page.getByTestId('result-name')).toContainText('鱼');
  await expect(page.getByTestId('recognition-result')).not.toContainText('undefined');
  const resumedCount = recognizedFrames.length;

  await page.evaluate(() => window.__advanceVisionCameraFrame());
  await page.getByTestId('camera-retry').click();
  await expect.poll(() => recognizedFrames.length, { timeout: 10_000 }).toBeGreaterThan(resumedCount);
  await expect(page.getByTestId('result-name')).toContainText('鲤鱼');
  await expect(page.getByTestId('mobile-result-retry')).toBeVisible();
  expect(await page.getByTestId('mobile-result-retry').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  const inlineRetryCount = recognizedFrames.length;
  await page.evaluate(() => window.__advanceVisionCameraFrame());
  await page.getByTestId('mobile-result-retry').click();
  await expect.poll(() => recognizedFrames.length, { timeout: 10_000 }).toBeGreaterThan(inlineRetryCount);

  const firstThree = recognizedFrames.slice(0, 3);
  expect(firstThree).toHaveLength(3);
  expect(firstThree.map((item) => Number(item.FrameSequence))).toEqual([1, 2, 3]);
  expect(firstThree[0].ResetStream).toBeTruthy();
  expect(firstThree.slice(1).every((item) => !item.ResetStream)).toBeTruthy();
  expect(firstThree[0].Continuous).toBeTruthy();
  expect(firstThree[1].Continuous).toBeTruthy();
  expect(firstThree[2].Continuous).toBeFalsy();
  expect(new Set(firstThree.map((item) => item.StreamSessionId)).size).toBe(1);
  expect(String(firstThree[0].StreamSessionId || '')).toMatch(/^stream-/);
  expect(firstThree.every((item) => String(item.FileByteBase64 || '').length > 1_000)).toBeTruthy();

  const recognizedPortraitLayout = await readCompactLayout(page);
  expectCompactLayout(recognizedPortraitLayout, 'portrait');
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-mobile-camera-paused.png'), fullPage: false });
  await page.getByTestId('camera-toggle').click();
  await expect(page.getByTestId('camera-toggle')).toHaveAttribute('data-camera-state', 'off');
  await expect(page.getByTestId('camera-pause')).toHaveCount(0);

  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  const landscapeLayout = await readCompactLayout(page);
  expectCompactLayout(landscapeLayout, 'landscape');
  await page.screenshot({ path: path.join(RESULT_DIR, 'workbench-mobile-landscape.png'), fullPage: false });
});

test('真实目标租户：手机端上传指定图片后可完成数据库或 AI 识别', async ({ page }, testInfo) => {
  test.skip(!TARGET_IMAGE, '仅在 PW_VISION_TARGET_IMAGE 指定验收图片时执行。');
  await fs.mkdir(RESULT_DIR, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await loginThroughUi(page);
  await page.goto(tenantUrl('#/micro-app/microi-vision/workbench'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('vision-workbench')).toBeVisible({ timeout: 60_000 });

  await page.getByTestId('recognize-file').setInputFiles(TARGET_IMAGE);
  await expect(page.getByAltText('待识别图片预览')).toBeVisible();
  const initialLayout = await readCompactLayout(page);
  expectCompactLayout(initialLayout, 'portrait');

  const initialResponsePromise = page.waitForResponse(
    (response) => response.request().method() === 'POST'
      && /\/apiengine\/platform-vision-runtime(?:\?|$)/i.test(response.url()),
    { timeout: 30_000 }
  );
  await page.getByTestId('recognize-submit').click();
  const initialResponse = await initialResponsePromise;
  const initialBody = await initialResponse.json();
  expect(Number(initialBody.Code), initialBody.Msg || '目标图片提交失败').toBe(1);
  expect(['LocalMatched', 'AiPending', 'AiMatched']).toContain(initialBody.Data?.Status);

  if (initialBody.Data?.Status === 'AiPending') {
    await expect(page.getByTestId('ai-pending')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('ai-pending')).toHaveCount(0, { timeout: 120_000 });
  }
  await expect.poll(async () => String(await page.getByTestId('result-name').textContent() || '').trim(), {
    timeout: 120_000,
    intervals: [1_000, 2_000, 2_000, 3_000],
  }).not.toMatch(/等待图片|正在调用|正在识别|未匹配到已知对象/);
  await expect(page.getByTestId('recognition-result')).toContainText(/鱼/);
  await expect(
    page.getByTestId('recognition-result').getByText(/租户样本库|平台 AI 引擎/, { exact: true }).first()
  ).toBeVisible();
  await expect(page.getByTestId('mobile-result-retry')).toBeVisible();
  await expect(page.locator('.vision-inline-error')).toHaveCount(0);
  await expect(page.getByText(/私有图片暂存失败/)).toHaveCount(0);

  const evidence = {
    testedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844 },
    initialStatus: initialBody.Data?.Status,
    initialSource: initialBody.Data?.MatchSource,
    requestId: initialBody.Data?.RequestId,
    backgroundTaskId: initialBody.Data?.BackgroundTaskId,
    finalLabel: String(await page.getByTestId('result-name').textContent() || '').trim(),
    finalSource: String(await page.getByTestId('recognition-result').locator('dt', { hasText: '结果来源' }).locator('..').locator('dd').textContent() || '').trim(),
    finalConfidence: String(await page.getByTestId('recognition-result').locator('dt', { hasText: /相似度|置信度/ }).locator('..').locator('dd').textContent() || '').trim(),
    finalElapsed: String(await page.getByTestId('recognition-result').locator('dt', { hasText: '处理耗时' }).locator('..').locator('dd').textContent() || '').trim(),
    layout: await readCompactLayout(page),
  };
  await fs.writeFile(path.join(RESULT_DIR, 'hongdi-mobile-upload-result.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  await page.screenshot({ path: path.join(RESULT_DIR, 'hongdi-mobile-upload-result.png'), fullPage: false });
  await testInfo.attach('hongdi-mobile-upload-result', { body: JSON.stringify(evidence, null, 2), contentType: 'application/json' });
});
