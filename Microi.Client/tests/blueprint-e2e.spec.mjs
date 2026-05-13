// @ts-check
// Microi 业务架构蓝图 (Blueprint) 端到端测试
// 运行: cd Microi.Client && npx playwright test ../tests/blueprint-e2e.spec.mjs --headed --reporter=list
//
// 前置：
//  1. 后端 https://localhost:7266 + iTdos 租户 + MICROI_DEV_TEST_KEY=itdos-smoketest-2026
//  2. 前端 vite dev http://localhost:1988
//  3. 已执行 microi-business-blueprint 三张表的建表 SQL

import { test, expect } from '@playwright/test';

const FRONTEND = process.env.FRONTEND || 'http://localhost:1988';
const BACKEND = process.env.BACKEND || 'https://localhost:7266';
const ACCOUNT = process.env.PW_TEST_ACCOUNT || 'admin';
const PASSWORD = process.env.PW_TEST_PASSWORD || '123456';
const OS_CLIENT = process.env.MICROI_OSCLIENT || 'iTdos';
const DEV_KEY = process.env.MICROI_DEV_KEY || 'itdos-smoketest-2026';

test.use({ ignoreHTTPSErrors: true });

test.describe('Blueprint E2E', () => {
    test.beforeEach(async ({ page }) => {
        // 通过 dev bypass 直接登录获取 Token
        const loginResp = await page.request.post(`${BACKEND}/api/SysUser/Login`, {
            headers: { 'X-Microi-Dev-Key': DEV_KEY, 'OsClient': OS_CLIENT },
            data: { Account: ACCOUNT, Pwd: '_DEV_BYPASS_' },
            ignoreHTTPSErrors: true
        });
        const loginJson = await loginResp.json();
        expect(loginJson.Code, 'Login Code=1').toBe(1);
        const token = loginJson.Data?.Token || loginJson.Token;
        const userId = loginJson.Data?.Id || loginJson.Id;
        expect(token).toBeTruthy();

        // 访问前端，并把 token 写入 localStorage（与 Microi.Client 约定一致）
        await page.goto(FRONTEND);
        await page.evaluate(({ t, u, oc }) => {
            localStorage.setItem('Token', t);
            localStorage.setItem('CurrentUser', JSON.stringify({ Id: u, Account: 'admin' }));
            localStorage.setItem('OsClient', oc);
        }, { t: token, u: userId, oc: OS_CLIENT });
    });

    test('列表页加载 + 新建蓝图', async ({ page }) => {
        await page.goto(`${FRONTEND}/#/blueprint/list`);
        await expect(page.locator('.blueprint-list')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('button:has-text("新建蓝图")')).toBeVisible();
    });

    test('设计器：添加节点 → 保存 → 验证', async ({ page }) => {
        await page.goto(`${FRONTEND}/#/blueprint/designer/new`);
        await expect(page.locator('.blueprint-designer')).toBeVisible({ timeout: 10000 });

        // 填名称
        const nameInput = page.locator('input[placeholder="蓝图名称"]');
        await nameInput.fill('E2E测试蓝图_' + Date.now());

        // 添加 1 个表节点 + 1 个引擎节点
        await page.locator('button:has-text("+ 表节点")').click();
        await page.locator('button:has-text("+ 接口引擎")').click();

        // 保存
        await page.locator('button:has-text("保存")').click();
        await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 5000 });

        // 验证
        await page.locator('button:has-text("验证")').click();
        await expect(page.locator('.el-dialog__title:has-text("蓝图验证结果")')).toBeVisible({ timeout: 5000 });
    });
});
