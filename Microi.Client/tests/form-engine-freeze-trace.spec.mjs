// 表单设计器响应性诊断；默认复用已授权测试租户中的可回收小型夹具。
import { test, expect } from '@playwright/test';
import { getLoginIdentityName } from './helpers/login-identity.mjs';
import { prepareFormUiFixture } from './helpers/form-ui-fixture.mjs';

const FRONTEND = process.env.PW_BASE_URL || process.env.MICROI_TEST_FRONTEND_BASE || process.env.FRONTEND || 'http://localhost:61500';
const BACKEND = process.env.PW_API_BASE || process.env.MICROI_TEST_API_BASE || process.env.BACKEND || 'https://localhost:61501';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || process.env.MICROI_TEST_ACCOUNT || 'admin';
const PASSWORD = process.env.PW_TEST_PASSWORD || process.env.MICROI_TEST_PASSWORD || '';
const OS_CLIENT = process.env.PW_OS_CLIENT || process.env.MICROI_TEST_OSCLIENT || process.env.MICROI_OSCLIENT || '';
const DESIGN_PATH = process.env.MICROI_FREEZE_PATH || '';

test.use({ ignoreHTTPSErrors: true });
test.setTimeout(60_000);

function tenantUrl(hash = '') {
    return `${FRONTEND}/?${new URLSearchParams({ OsClient: OS_CLIENT, ApiBase: BACKEND })}${hash}`;
}

function toHash(value) {
    if (value.startsWith('/#')) return value.slice(1);
    if (value.startsWith('#')) return value;
    return `#${value}`;
}

async function attachDiagnostics(page, testInfo, consoleLines) {
    const trace = await page.evaluate(() => (window.__MICROI_FORM_TRACE__ || []).slice(-120)).catch(error => [{ label: 'trace-read-error', payload: { message: error.message } }]);
    const url = await page.evaluate(() => location.href).catch(() => 'unreadable');
    await testInfo.attach('form-engine-trace.json', { body: JSON.stringify(trace, null, 2), contentType: 'application/json' });
    await testInfo.attach('console-lines.txt', { body: consoleLines.join('\n'), contentType: 'text/plain' });
    await testInfo.attach('page-url.txt', { body: url, contentType: 'text/plain' });
    return trace;
}

test('design page remains responsive and emits form trace', async ({ page, request }, testInfo) => {
    expect(OS_CLIENT, 'An explicit test tenant is required').not.toBe('');
    expect(PASSWORD, 'Existing test login credentials are required').not.toBe('');
    const consoleLines = [];
    page.on('console', message => {
        consoleLines.push(`[${message.type()}] ${message.text()}`);
        if (consoleLines.length > 500) consoleLines.shift();
    });
    page.on('pageerror', error => consoleLines.push(`[pageerror] ${error.message}`));

    await page.addInitScript(() => {
        window.__MICROI_FORM_TRACE_ENABLED__ = true;
        window.__MICROI_FORM_TRACE__ = [];
        localStorage.setItem('Microi.FormEngineTrace', '1');
        localStorage.removeItem('Microi.EnableAdvancedFieldLayoutRuntime');
        localStorage.removeItem('Microi.DisableAdvancedFieldLayoutRuntime');
    });
    let fixture;
    try {
        // 明确指定诊断路径时保留原独立入口；常规回归只操作 owner 标记的自有表。
        if (!DESIGN_PATH) fixture = await prepareFormUiFixture(request, { apiBase: BACKEND, osClient: OS_CLIENT, account: ACCOUNT, password: PASSWORD }, 'designer');
        await page.goto(tenantUrl(), { waitUntil: 'domcontentloaded' });
        await page.locator('input[placeholder*="用户名"],input[placeholder*="账号"],input[placeholder*="帐号"],input[placeholder*="username" i]').first().fill(ACCOUNT);
        await page.locator('input[type="password"]').first().fill(PASSWORD);
        const privacy = page.locator('.privacy-policy-wrapper .el-checkbox').first();
        if (await privacy.isVisible() && !(await privacy.locator('input[type="checkbox"]').isChecked())) await privacy.click();
        const responsePromise = page.waitForResponse(response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()));
        await page.getByRole('button', { name: '登录', exact: true }).click();
        const result = await (await responsePromise).json();
        expect(Number(result.Code), result.Msg || 'UI login failed').toBe(1);
        await expect(page.getByRole('button', { name: getLoginIdentityName(result), exact: true }).first()).toBeVisible({ timeout: 30_000 });
        const route = DESIGN_PATH || `#/diy/diy-design/${fixture.tableId}?PageType=`;
        const hash = toHash(route + (route.includes('?') ? '&' : '?') + 'MicroiFormTrace=1');
        await page.goto(tenantUrl(hash), { waitUntil: 'domcontentloaded' });
        const designAttached = await page.locator('.itdos-diy-form, .diy-form, .diy-design').first().waitFor({ state: 'attached', timeout: 20_000 }).then(() => true).catch(() => false);
        if (!designAttached) await attachDiagnostics(page, testInfo, consoleLines);
        expect(designAttached, 'Design/form DOM should attach before freeze checks.').toBe(true);
        await page.waitForTimeout(15_000);
        const responsive = await page.waitForFunction(() => true, null, { timeout: 2_000 }).then(() => true).catch(() => false);
        await attachDiagnostics(page, testInfo, consoleLines);
        expect(responsive, 'Page should still respond after loading the design page.').toBe(true);
    } finally {
        await fixture?.cleanup();
    }
});
