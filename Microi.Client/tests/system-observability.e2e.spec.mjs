// @ts-check

import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND = process.env.FRONTEND || 'http://localhost:61500';
const BACKEND = process.env.BACKEND || 'https://localhost:61501';
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
    page.on('pageerror', error => pageErrors.push(String(error?.stack || error)));
    page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', async response => {
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

    for (const tab of ['运行诊断', '请求与接口', '系统监控', '系统日志', '安全数据', '应用日志']) {
        await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }
    await expect(page.getByText('进程 CPU（多核原始）', { exact: true })).toBeVisible();
    await expect(page.getByText('来源 IP', { exact: true })).toBeVisible();
    await expect(page.getByText('热点接口', { exact: true })).toBeVisible();
    await expect(page.getByText(/并不冒充逐请求 CPU 采样/)).toBeVisible();

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

    await page.screenshot({
        path: path.join(ARTIFACT_DIR, 'system-observability-light.png'),
        fullPage: true
    });

    const relevantConsoleErrors = consoleErrors.filter(message =>
        !/favicon|ResizeObserver loop|net::ERR_ABORTED/i.test(message));
    expect(pageErrors, '页面不得出现未捕获异常').toEqual([]);
    expect(relevantConsoleErrors, '页面不得输出业务级 console.error').toEqual([]);
});
