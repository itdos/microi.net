// @ts-check

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.FRONTEND || 'http://localhost:61500';
const BACKEND = process.env.BACKEND || 'http://localhost:61501';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin';
const PASSWORD = process.env.PW_TEST_PASSWORD || '';
const OS_CLIENT = process.env.MICROI_OSCLIENT || 'iTdos';
const ARTIFACT_DIR = process.env.OBS_ARTIFACT_DIR
    || path.resolve(process.cwd(), '..', '.tmp', 'system-observability-acceptance');

test.use({
    ignoreHTTPSErrors: true,
    channel: 'msedge',
    viewport: { width: 1600, height: 1000 }
});
test.setTimeout(180_000);

test('系统日志/监控：唯一菜单、平台微服务、真实观测接口与主题', async ({ page }) => {
    expect(PASSWORD, 'PW_TEST_PASSWORD 必须由受保护的测试进程变量提供').toBeTruthy();
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

    const pageErrors = [];
    const consoleErrors = [];
    const observabilityResponses = [];
    const presentationStatsRequests = [];
    const presentationRequestEvidence = new Map();
    const menuRequestStartedAt = new Map();
    const menuRequestDurations = [];
    const menuRequestTransports = [];
    const isMenuRequest = url => /(?:\/api\/SysMenu\/GetSysMenuStep|\/apiengine\/platform-sys-menu\?[^#]*\bAction=GetSysMenuStep)(?:&|$|#)/i.test(url);
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', async response => {
        const request = response.request();
        const presentationEvidence = presentationRequestEvidence.get(request);
        if (presentationEvidence) {
            presentationEvidence.durationMs = Date.now() - presentationEvidence.startedAt;
            presentationEvidence.status = response.status();
            delete presentationEvidence.startedAt;
        }
        if (isMenuRequest(response.url())) {
            const startedAt = menuRequestStartedAt.get(request);
            if (startedAt) menuRequestDurations.push(Date.now() - startedAt);
        }
        if (!/(?:\/api\/ApiEngine\/Run|\/apiengine\/mci-system-observability-query)(?:\?|$)/i.test(response.url())) return;
        try {
            const body = await response.json();
            if (body?.Data?.RequestRuntime?.Node || body?.Data?.Node || body?.Data?.Snapshot || body?.Data?.Process) {
                observabilityResponses.push({ status: response.status(), body });
            }
        } catch {
            // Non-JSON responses are irrelevant to this assertion.
        }
    });
    page.on('request', request => {
        if (isMenuRequest(request.url())) {
            menuRequestStartedAt.set(request, Date.now());
            menuRequestTransports.push(/\/apiengine\/platform-sys-menu/i.test(request.url()) ? 'custom-address' : 'legacy-controller');
        }
        const isLegacyRun = /\/api\/ApiEngine\/Run(?:\?|$)/i.test(request.url());
        const isPresentationAddress = /\/apiengine\/mci-module-presentation-stats(?:\?|$)/i.test(request.url());
        if (!isLegacyRun && !isPresentationAddress) return;
        try {
            const body = request.postDataJSON();
            if (isLegacyRun && String(body?.ApiEngineKey || '').toLowerCase() !== 'mci-module-presentation-stats') return;
            const evidence = {
                transport: isPresentationAddress ? 'custom-address' : 'legacy-run',
                menuId: body.SysMenuId || body._SysMenuId || '',
                batchSize: Array.isArray(body.MenuRequests) ? body.MenuRequests.length : 0,
                startedAt: Date.now()
            };
            presentationStatsRequests.push(evidence);
            presentationRequestEvidence.set(request, evidence);
        } catch {
            // Non-JSON API calls are irrelevant to this performance assertion.
        }
    });

    const tenantUrl = `${FRONTEND}/?OsClient=${encodeURIComponent(OS_CLIENT)}&ApiBase=${encodeURIComponent(BACKEND)}`;
    await page.goto(tenantUrl, { waitUntil: 'domcontentloaded' });
    const accountInput = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="user name" i]',
        'input[placeholder*="username" i]'
    ].join(', ')).first();
    await expect(accountInput).toBeVisible({ timeout: 30_000 });
    await accountInput.fill(ACCOUNT);
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    const loginPromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 }
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    const login = await (await loginPromise).json();
    expect(login.Code, login.Msg || '真实账号登录失败').toBe(1);
    await expect(page.getByRole('button', { name: /管理员|admin/i }).first()).toBeVisible({ timeout: 60_000 });

    await page.goto(`${tenantUrl}#/micro-app/microi-platform-service/system-observability`);
    await page.waitForLoadState('domcontentloaded');

    const microApp = page.locator('micro-app.micro-app-host__app').last();
    await expect(microApp, '系统日志/监控应由平台内置微服务挂载').toBeVisible({ timeout: 45_000 });
    await expect.poll(async () => microApp.evaluate(element => {
        const body = element.querySelector('micro-app-body')
            || element.shadowRoot?.querySelector?.('micro-app-body');
        if (!body) return false;
        const appRoot = body.querySelector?.('#app');
        const candidates = appRoot
            ? [appRoot]
            : Array.from(body.children || []).filter(child => !['SCRIPT', 'STYLE', 'LINK'].includes(child.tagName));
        return candidates.some(child => {
            const rect = child.getBoundingClientRect();
            const style = getComputedStyle(child);
            return rect.width > 0
                && rect.height > 0
                && style.display !== 'none'
                && style.visibility !== 'hidden'
                && (child.childElementCount > 0 || String(child.textContent || '').trim().length > 0);
        });
    }), {
        timeout: 45_000,
        message: '平台内置微服务必须渲染真实业务内容，不能停在宿主或加载骨架'
    }).toBe(true);
    await expect(page.getByRole('heading', { name: '系统日志/监控', exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.mci-micro-app-error:visible'), '系统日志/监控不能进入微服务错误态').toHaveCount(0);

    for (const tab of ['系统日志', '网络流量', '运行诊断', '请求与接口', '系统监控', '安全数据', '应用日志']) {
        await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    const tabLabels = await page.locator('.obs-tabs > button').allTextContents();
    expect(tabLabels[0]).toContain('系统日志');
    await expect(page.getByRole('button', { name: '系统日志', exact: true })).toHaveClass(/is-active/);
    for (const label of ['日志总数', '错误日志', '警告日志', '慢 SQL', '慢执行', '异常', '日志类型']) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await expect(page.getByPlaceholder('搜索标题、内容、用户、IP、TraceId…')).toBeVisible();
    const logPageSize = page.locator('.obs-log-panel .obs-data-table__size select');
    await expect(logPageSize).toHaveValue('15');
    await expect.poll(async () => page.locator('.obs-log-panel tbody tr.is-clickable').count(), {
        timeout: 30_000,
        message: '系统日志表格应返回可查看详情的真实日志'
    }).toBeGreaterThan(0);
    expect(await page.locator('.obs-log-panel tbody tr.is-clickable').count()).toBeLessThanOrEqual(15);
    const twoLineStyle = await page.locator('.obs-log-panel .obs-two-line').first().evaluate(element => {
        const style = getComputedStyle(element);
        return {
            clamp: style.webkitLineClamp,
            overflow: style.overflow,
            height: element.getBoundingClientRect().height,
            lineHeight: Number.parseFloat(style.lineHeight)
        };
    });
    expect(twoLineStyle.clamp).toBe('2');
    expect(twoLineStyle.overflow).toBe('hidden');
    expect(twoLineStyle.height).toBeLessThanOrEqual(twoLineStyle.lineHeight * 2.1);
    await page.locator('.obs-log-panel tbody tr.is-clickable').first().click();
    await expect(page.getByRole('heading', { name: '日志详情', exact: true })).toBeVisible();
    await expect(page.locator('.obs-dialog--large')).toBeVisible();
    const platformOverlay = page.locator('.micro-app-host__global-overlay:visible');
    await expect(platformOverlay, '日志详情必须触发覆盖整个平台框架的宿主遮罩').toBeVisible();
    await expect(page.locator('.micro-app-host--modal-active')).toBeVisible();
    const overlayBox = await platformOverlay.boundingBox();
    expect(overlayBox?.x).toBeLessThanOrEqual(1);
    expect(overlayBox?.y).toBeLessThanOrEqual(1);
    expect(overlayBox?.width).toBeGreaterThanOrEqual(1598);
    expect(overlayBox?.height).toBeGreaterThanOrEqual(998);
    await page.getByRole('button', { name: '关闭日志详情', exact: true }).click();
    await expect(platformOverlay).toHaveCount(0);

    const trafficProbe = await page.request.post(
        `${BACKEND}/api/observability-upload-probe?OsClient=${encodeURIComponent(OS_CLIENT)}`,
        {
            data: Buffer.alloc(10 * 1024 * 1024 + 1, 0x61),
            headers: { 'Content-Type': 'application/octet-stream' },
            failOnStatusCode: false
        }
    );
    expect([404, 405]).toContain(trafficProbe.status());

    await page.getByRole('button', { name: '网络流量', exact: true }).click();
    await expect(page.getByText('网卡累计接收', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '流量热点接口', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '帐号 / 匿名', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: /大文件 \/ 可疑传输明细$/ })).toBeVisible();
    await expect(page.locator('.obs-traffic-cockpit .obs-data-table__size select').first()).toHaveValue('15');
    const criticalRisk = page.locator('.obs-traffic-cockpit .obs-risk.is-critical').first();
    await expect(criticalRisk, '匿名 10MB 上传探针应被识别为严重异常').toBeVisible({ timeout: 30_000 });
    await expect(criticalRisk).toHaveAttribute('title', /原因：[\s\S]*解决方案：/);
    const criticalColor = await criticalRisk.evaluate(element => getComputedStyle(element).color);
    expect(criticalColor).toMatch(/rgb\((?:229, 72, 77|220, 38, 38|239, 68, 68)\)/);

    await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'system-observability-traffic-cockpit.png'),
        fullPage: true
    });

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('.obs-page')).toHaveClass(/is-motion-paused/);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await page.getByRole('button', { name: '运行诊断', exact: true }).click();
    await expect(page.getByText('进程 CPU（多核原始）', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '来源 IP', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '热点接口', exact: true })).toBeVisible();
    await expect(page.getByText(/不代表逐请求 CPU 采样|请求耗时和并发用于归因/)).toBeVisible();

    await page.getByRole('button', { name: '系统监控', exact: true }).click();
    await expect(page.getByText('CPU / 内存趋势', { exact: true })).toBeVisible();
    await expect(page.getByText('Docker 容器', { exact: true })).toBeVisible();

    const theme = await page.locator('.obs-page').evaluate(element => {
        const style = getComputedStyle(element);
        return {
            dark: element.classList.contains('is-dark'),
            background: style.backgroundColor,
            color: style.color,
            primary: style.getPropertyValue('--obs-primary').trim()
        };
    });
    expect(theme.dark, '默认页面不得强制深色').toBe(false);
    expect(theme.primary, '页面必须获得宿主主题色').not.toBe('');

    await expect.poll(() => observabilityResponses.length, {
        timeout: 20_000,
        message: '页面未完成真实观测接口调用'
    }).toBeGreaterThan(0);
    expect(observabilityResponses.every(item => item.status === 200 && item.body?.Code === 1)).toBe(true);

    await expect.poll(() => presentationStatsRequests.filter(item => item.batchSize > 0).length, {
        timeout: 20_000,
        message: '侧栏菜单统计应使用批量接口协议'
    }).toBeGreaterThan(0);
    const badgeBatches = presentationStatsRequests.filter(item => item.batchSize > 0);
    expect(badgeBatches.some(item => item.transport === 'custom-address'), '侧栏统计必须调用接口引擎自定义地址').toBe(true);
    expect(presentationStatsRequests.some(item => item.transport === 'legacy-run'), '侧栏统计不应回退到 /api/ApiEngine/Run').toBe(false);
    expect(presentationStatsRequests.length, '侧栏统计不得退化为按菜单逐项调用').toBeLessThanOrEqual(6);
    expect(Math.max(...badgeBatches.map(item => item.batchSize)), '一次批量请求应承载多个菜单').toBeGreaterThan(10);

    const snapshotEvidence = [...observabilityResponses].reverse().find(item =>
        item.body?.Data?.RequestRuntime?.TopEndpoints || item.body?.Data?.Snapshot?.TopEndpoints);
    fs.writeFileSync(
        path.join(ARTIFACT_DIR, 'system-observability-snapshot.json'),
        JSON.stringify(snapshotEvidence?.body || observabilityResponses.at(-1)?.body || {}, null, 2),
        'utf8'
    );

    await page.getByRole('button', { name: '系统日志', exact: true }).click();
    await expect(page.getByRole('button', { name: '系统日志', exact: true })).toHaveClass(/is-active/);
    await expect(page.locator('.obs-log-panel tbody tr.is-clickable').first()).toBeVisible();

    await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'system-observability-light.png'),
        fullPage: true
    });

    const menuRequestCountBeforeReload = menuRequestDurations.length;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: '系统日志/监控', exact: true })).toBeVisible({ timeout: 45_000 });
    await expect.poll(() => menuRequestDurations.length, {
        timeout: 30_000,
        message: '同一登录会话刷新时应重新请求并命中版本化菜单缓存'
    }).toBeGreaterThan(menuRequestCountBeforeReload);
    expect(
        menuRequestDurations.at(-1),
        `菜单缓存命中应快于首次查询：${JSON.stringify(menuRequestDurations)}`
    ).toBeLessThan(menuRequestDurations[0]);
    expect(menuRequestTransports.every(item => item === 'custom-address'), '菜单加载必须使用接口引擎自定义地址').toBe(true);

    fs.writeFileSync(
        path.join(ARTIFACT_DIR, 'system-observability-performance.json'),
        JSON.stringify({
            presentationStatsRequestCount: presentationStatsRequests.length,
            presentationStatsRequests,
            getSysMenuStepDurationsMs: menuRequestDurations,
            getSysMenuStepTransports: menuRequestTransports
        }, null, 2),
        'utf8'
    );

    const relevantConsoleErrors = consoleErrors.filter(message =>
        !/favicon|ResizeObserver loop|net::ERR_ABORTED/i.test(message));
    expect(pageErrors, '页面不得出现未捕获异常').toEqual([]);
    expect(relevantConsoleErrors, '页面不得输出业务级 console.error').toEqual([]);
});
