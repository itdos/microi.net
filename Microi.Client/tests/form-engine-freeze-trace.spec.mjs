// Diagnostic test for form-engine design/add-page freezes.
// Run example:
//   $env:FRONTEND='http://localhost:1988'; $env:BACKEND='https://api.jifulii.com'; $env:MICROI_OSCLIENT='xjy'; $env:PW_TEST_ACCOUNT='admin'; $env:PW_TEST_PASSWORD='***'; npx playwright test tests/form-engine-freeze-trace.spec.mjs --headed --reporter=list

import { test, expect } from '@playwright/test';

const FRONTEND = process.env.FRONTEND || 'http://localhost:1988';
const BACKEND = process.env.BACKEND || 'https://api.jifulii.com';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin';
const PASSWORD = process.env.PW_TEST_PASSWORD || '';
const OS_CLIENT = process.env.MICROI_OSCLIENT || 'xjy';
const DESIGN_PATH = process.env.MICROI_FREEZE_PATH || '/#/diy/diy-design/9c5e803b-1906-4368-bca1-0dc9823b5510?PageType=';

test.use({ ignoreHTTPSErrors: true });
test.setTimeout(60_000);

async function login(page) {
    if (!PASSWORD) {
        throw new Error('PW_TEST_PASSWORD is required for this diagnostic test.');
    }

    const response = await page.request.post(`${BACKEND}/api/SysUser/Login`, {
        headers: { OsClient: OS_CLIENT },
        data: { Account: ACCOUNT, Pwd: PASSWORD, OsClient: OS_CLIENT },
        ignoreHTTPSErrors: true
    });
    const text = await response.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch (error) {
        throw new Error(`Login returned non-JSON response: ${text.slice(0, 300)}`);
    }
    expect(json.Code, `Login response: ${text.slice(0, 500)}`).toBe(1);
    const data = json.Data || {};
    const headers = response.headers();
    const token = data.Token || json.Token || headers.authorization || headers.Authorization;
    expect(token, 'Login token').toBeTruthy();
    return { token, user: data };
}

function withTraceFlag(path, token) {
    const separator = path.indexOf('?') > -1 ? '&' : '?';
    return `${FRONTEND}${path}${separator}MicroiFormTrace=1&token=${encodeURIComponent(token)}`;
}

function toHash(path) {
    if (path.startsWith('/#')) return path.slice(1);
    if (path.startsWith('#')) return path;
    return `#${path}`;
}

async function attachDiagnostics(page, testInfo, consoleLines) {
    const trace = await page.evaluate(() => (window.__MICROI_FORM_TRACE__ || []).slice(-120)).catch((error) => [{ label: 'trace-read-error', payload: { message: error.message } }]);
    const url = await page.evaluate(() => location.href).catch(() => 'unreadable');
    await testInfo.attach('form-engine-trace.json', {
        body: JSON.stringify(trace, null, 2),
        contentType: 'application/json'
    });
    await testInfo.attach('console-lines.txt', {
        body: consoleLines.join('\n'),
        contentType: 'text/plain'
    });
    await testInfo.attach('page-url.txt', {
        body: url,
        contentType: 'text/plain'
    });
    console.log('Current page URL:', url);
    console.log('Last form trace entries:', JSON.stringify(trace.slice(-20), null, 2));
    console.log('Captured console lines:', consoleLines.slice(-80).join('\n'));
    return trace;
}

async function loginThroughUiIfNeeded(page) {
    const usernameInput = page.locator('input[placeholder="请输入用户名"]');
    const isLoginPage = await usernameInput.first().waitFor({ state: 'visible', timeout: 10_000 }).then(() => true).catch(() => false);
    if (!isLoginPage) return;

    await usernameInput.fill(ACCOUNT);
    await page.locator('input[placeholder="请输入密码"]').fill(PASSWORD);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await page.waitForFunction(() => document.body && document.body.innerText && document.body.innerText.indexOf('请输入用户名') === -1, null, { timeout: 30_000 });
}

test('design page remains responsive and emits form trace', async ({ page }, testInfo) => {
    const consoleLines = [];
    page.on('console', (message) => {
        const text = message.text();
        consoleLines.push(`[${message.type()}] ${text}`);
        if (consoleLines.length > 500) {
            consoleLines.shift();
        }
    });
    page.on('pageerror', (error) => {
        consoleLines.push(`[pageerror] ${error.message}`);
    });

    await page.addInitScript(({ apiBase, osClient }) => {
        window.ApiBase = apiBase;
        window.OsClient = osClient;
        window.__MICROI_FORM_TRACE_ENABLED__ = true;
        window.__MICROI_FORM_TRACE__ = [];
        localStorage.setItem('Microi.FormEngineTrace', '1');
        localStorage.removeItem('Microi.EnableAdvancedFieldLayoutRuntime');
        localStorage.removeItem('Microi.DisableAdvancedFieldLayoutRuntime');
    }, { apiBase: BACKEND, osClient: OS_CLIENT });

    const { token, user } = await login(page);
    await page.goto(FRONTEND, { waitUntil: 'domcontentloaded' });
    await page.evaluate(({ tokenValue, userValue, osClient, apiBase }) => {
        const storage = JSON.parse(localStorage.getItem('microi.net') || '{}');
        Object.assign(storage, {
            Token: tokenValue,
            CurrentUser: userValue,
            OsClient: osClient,
            ApiBase: apiBase,
            TokenExpires: '2099-12-31 23:59:59'
        });
        localStorage.setItem('microi.net', JSON.stringify(storage));
        localStorage.setItem('Token', tokenValue);
        localStorage.setItem('CurrentUser', JSON.stringify(userValue));
        localStorage.setItem('OsClient', osClient);
        localStorage.setItem('Microi.FormEngineTrace', '1');
        document.cookie = `authorization=${tokenValue}; path=/`;
    }, { tokenValue: token, userValue: user, osClient: OS_CLIENT, apiBase: BACKEND });

    await page.goto(`${FRONTEND}/#/login?MicroiFormTrace=1`, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    await loginThroughUiIfNeeded(page);
    await page.evaluate((hash) => {
        location.hash = hash;
    }, toHash(DESIGN_PATH + (DESIGN_PATH.indexOf('?') > -1 ? '&' : '?') + 'MicroiFormTrace=1'));
    const designAttached = await page.locator('.itdos-diy-form, .diy-form, .diy-design').first().waitFor({ state: 'attached', timeout: 20_000 }).then(() => true).catch(() => false);
    if (!designAttached) {
        await attachDiagnostics(page, testInfo, consoleLines);
    }
    expect(designAttached, 'Design/form DOM should attach before freeze checks.').toBe(true);

    await page.waitForTimeout(15_000);

    const responsive = await page.waitForFunction(() => true, null, { timeout: 2_000 }).then(() => true).catch(() => false);
    await attachDiagnostics(page, testInfo, consoleLines);

    expect(responsive, 'Page should still respond after loading the design page.').toBe(true);
});
