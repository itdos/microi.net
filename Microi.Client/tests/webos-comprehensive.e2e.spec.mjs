import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = 'http://localhost:61500';
const API_BASE = 'https://localhost:61501';
const PASSWORD = process.env.PW_LOCAL_PASSWORD || '';
const OUTPUT = path.resolve(process.cwd(), '../.tmp/screenshots/webos-after');
let pendingPreferenceRestore = null;

const tenantUrl = () => `${FRONTEND}/?OsClient=iTdos&ApiBase=${encodeURIComponent(API_BASE)}`;

async function login(page) {
    await page.goto(tenantUrl(), { waitUntil: 'domcontentloaded' });
    const account = page.locator([
        'input[placeholder*="用户名"]',
        'input[placeholder*="账号"]',
        'input[placeholder*="帐号"]',
        'input[placeholder*="username" i]',
        'input[placeholder*="user name" i]',
    ].join(', ')).first();
    await expect(account).toBeVisible({ timeout: 30_000 });
    await account.fill('admin');
    await page.locator('input[type="password"]').first().fill(PASSWORD);
    const privacy = page.locator('.privacy-policy-wrapper .el-checkbox').first();
    if (await privacy.isVisible().catch(() => false)) {
        const checked = await privacy.evaluate(element => (
            element.classList.contains('is-checked')
            || Boolean(element.querySelector('input[type="checkbox"]')?.checked)
        ));
        if (!checked) await privacy.click();
    }
    const loginResponse = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 },
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    const response = await loginResponse;
    const body = await response.json();
    expect(Number(body?.Code), body?.Msg || '真实 UI 登录失败').toBe(1);
    await page.waitForTimeout(900);
}

async function openStyleMenu(page) {
    const trigger = page.getByTitle('切换界面风格').first();
    await expect(trigger).toBeVisible();
    await trigger.hover();
    await expect(page.getByText('macOS 风格', { exact: true })).toBeVisible();
}

async function switchStyle(page, label) {
    await openStyleMenu(page);
    await page.getByText(label, { exact: true }).click();
    if (label === '经典传统') return;
    const platform = label === 'Windows 风格' ? 'windows' : 'macos';
    await expect(page.locator(`.webos-platform--${platform}`)).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0, { timeout: 45_000 });
}

async function screenshot(page, name) {
    await page.screenshot({ path: path.join(OUTPUT, name), fullPage: false });
}

async function openHome(page, platform) {
    const desktopSelector = platform === 'macos' ? '.microi-macos-desk' : '.microi-windows-desk';
    const itemSelector = platform === 'macos' ? '.microi-desk-griditem' : '.microi-desk-item';
    const home = page.locator(`${desktopSelector} ${itemSelector}[title="Home"]`).first();
    if (await home.isVisible().catch(() => false)) await home.click();
    else {
        const leaf = page.locator(`${desktopSelector} ${itemSelector}:not(:has(> .thumb))`).first();
        await expect(leaf).toBeVisible();
        await leaf.click();
    }
    const activeWindow = page.locator('.webos-app-window.is-active');
    await expect(activeWindow).toBeVisible({ timeout: 45_000 });
    await expect(activeWindow.locator('.webos-module-host.is-ready')).toBeVisible({ timeout: 45_000 });
    await expect(activeWindow.locator('.webos-module-host__mount > *').first()).toBeVisible({ timeout: 45_000 });
    await expect(activeWindow.locator('iframe')).toHaveCount(0);
    return activeWindow;
}

async function exerciseFolder(page, platform) {
    const desk = platform === 'macos' ? '.microi-macos-desk' : '.microi-windows-desk';
    const item = platform === 'macos' ? '.microi-desk-griditem' : '.microi-desk-item';
    const folder = page.locator(`${desk} ${item}:has(> .thumb)`).first();
    if (!await folder.isVisible().catch(() => false)) return false;
    await folder.click();
    const layer = page.locator('.microi-desk-thumblayer:visible').first();
    await expect(layer).toBeVisible();
    await expect(layer.locator('.microi-desk-thumblayer__item').first()).toBeVisible();
    const layerBox = await layer.boundingBox();
    expect(layerBox?.width).toBeGreaterThanOrEqual(240);
    expect(layerBox?.height).toBeGreaterThanOrEqual(240);
    await layer.locator('.microi-folder-close').click();
    await expect(layer).toBeHidden();
    await folder.click();
    await expect(layer).toBeVisible();
    await layer.locator('.microi-folder-close').click();
    return true;
}

async function exerciseDockFolder(page, platform) {
    const dock = platform === 'macos' ? '.microi-macos-dock' : '.microi-windows-dock';
    const folder = page.locator(`${dock} .microi-dock-item:has(.thumb)`).first();
    if (!await folder.isVisible().catch(() => false)) return false;
    await folder.click();
    const popover = page.locator(`.webos-dock-folder.is-${platform}:visible`);
    await expect(popover).toBeVisible();
    await expect(popover.locator('.webos-dock-folder__item').first()).toBeVisible();
    await popover.locator('header button').click();
    await expect(popover).toBeHidden();
    return true;
}

async function openThemePanel(page) {
    const trigger = page.locator('.webos-toolbar .theme-select-trigger').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const panel = page.locator('.mci-theme-popover:visible').first();
    await expect(panel).toBeVisible();
    return panel;
}

async function ensureThemePanel(page) {
    const visiblePanel = page.locator('.mci-theme-popover:visible').first();
    if (await visiblePanel.isVisible().catch(() => false)) return visiblePanel;
    return openThemePanel(page);
}

async function setTheme(page, mode, paletteTitle) {
    let panel = await ensureThemePanel(page);
    const modeButtons = panel.locator('.mci-mode-btn');
    const modeButton = mode === 'dark' ? modeButtons.nth(1) : modeButtons.nth(0);
    if (!await modeButton.evaluate(element => element.classList.contains('active'))) {
        await modeButton.click();
    }
    await expect.poll(() => page.evaluate(() => (
        document.documentElement.classList.contains('dark')
        || document.documentElement.getAttribute('data-theme') === 'dark'
    ))).toBe(mode === 'dark');
    /* 偏好写入会替换 CurrentUser，工具栏随之重渲染；每一步都重新获取当前弹层。 */
    await page.waitForTimeout(700);
    panel = await ensureThemePanel(page);
    if (paletteTitle) {
        const palette = panel.locator(`.mci-color-dot[title="${paletteTitle}"]`);
        if (await palette.count() && !await palette.evaluate(element => element.classList.contains('active'))) {
            await palette.click();
            await page.waitForTimeout(700);
            panel = await ensureThemePanel(page);
        }
        await expect(panel.locator(`.mci-color-dot[title="${paletteTitle}"]`)).toHaveClass(/active/);
    }
    return panel;
}

async function boxesDoNotOverlap(a, b) {
    if (!a || !b) return true;
    return a.x + a.width <= b.x || b.x + b.width <= a.x
        || a.y + a.height <= b.y || b.y + b.height <= a.y;
}

test.use({ viewport: { width: 1440, height: 900 } });
test.afterEach(async ({ page }) => {
    const restore = pendingPreferenceRestore;
    pendingPreferenceRestore = null;
    if (!restore || page.isClosed()) return;
    try {
        if (restore.mode) {
            await setTheme(page, restore.mode, restore.palette || null);
            await page.keyboard.press('Escape');
        }
        if (restore.style) await switchStyle(page, restore.style);
    } catch (error) {
        console.warn(`WebOS 测试偏好恢复失败：${error?.message || error}`);
    }
});

test('WebOS macOS/Windows 全流程、主题、低视口与截图回归', async ({ page }) => {
    test.skip(!PASSWORD, 'PW_LOCAL_PASSWORD is required');
    await fs.mkdir(OUTPUT, { recursive: true });
    const diagnostics = {
        consoleErrors: [],
        pageErrors: [],
        failedResponses: [],
        nativeDialogs: [],
        webosResponses: [],
        screenshots: [],
        features: {},
    };
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('dialog', async dialog => {
        diagnostics.nativeDialogs.push(`${dialog.type()}:${dialog.message()}`);
        await dialog.dismiss();
    });
    page.on('response', response => {
        if (response.status() >= 400) diagnostics.failedResponses.push({ status: response.status(), url: response.url() });
        if (/\/apiengine\/platform-(?:sys-menu|user-update-preferences)/i.test(response.url())) {
            response.json().then(body => diagnostics.webosResponses.push({
                status: response.status(),
                url: response.url(),
                code: body?.Code,
                msg: body?.Msg || '',
            })).catch(() => {});
        }
    });

    await login(page);
    const initialStyle = await page.evaluate(() => {
        if (document.querySelector('.webos-platform--windows')) return 'Windows 风格';
        if (document.querySelector('.webos-platform--macos')) return 'macOS 风格';
        return '经典传统';
    });
    pendingPreferenceRestore = { style: initialStyle };
    await switchStyle(page, 'macOS 风格');
    await expect(page.locator('.microi-macos-desk .microi-desk-griditem').first()).toBeVisible({ timeout: 30_000 });

    const runtime = await page.evaluate(() => window.__MICROI_RUNTIME_ENDPOINT__);
    expect(runtime?.protocol).toBe('microi.runtime-endpoint.v1');
    expect(runtime?.apiBase).toBe(API_BASE);
    expect(runtime?.osClient).toBe('iTdos');
    expect(runtime?.webBase).toBe(FRONTEND);
    expect(runtime?.source?.apiBase).toBe('url-query');
    expect(runtime?.source?.osClient).toBe('url-query');
    expect(await page.locator('.vu__touchball').count()).toBe(0);
    expect(await page.locator('.microi-macos-desk').textContent()).not.toContain('Loading...');
    expect(await page.locator('.microi-macos-desk').textContent()).not.toMatch(/测试2|测试3|测试4|测试5/);
    await screenshot(page, '01-macos-light-desktop-1440x900.png');
    diagnostics.screenshots.push('01-macos-light-desktop-1440x900.png');

    diagnostics.features.macosFolder = await exerciseFolder(page, 'macos');
    if (diagnostics.features.macosFolder) {
        const folder = page.locator('.microi-macos-desk .microi-desk-griditem:has(> .thumb)').first();
        await folder.click();
        await page.waitForTimeout(500);
        await screenshot(page, '02-macos-folder-light-1440x900.png');
        diagnostics.screenshots.push('02-macos-folder-light-1440x900.png');
        await page.locator('.microi-desk-thumblayer:visible .microi-folder-close').click();
    }
    diagnostics.features.macosDockFolder = await exerciseDockFolder(page, 'macos');

    let activeWindow = await openHome(page, 'macos');
    const macWindowBox = await activeWindow.boundingBox();
    const macClose = await activeWindow.locator('.is-close').boundingBox();
    const macMin = await activeWindow.locator('.is-minimize').boundingBox();
    const macMax = await activeWindow.locator('.is-maximize').boundingBox();
    expect(macClose.x).toBeLessThan(macMin.x);
    expect(macMin.x).toBeLessThan(macMax.x);
    const macTitle = await activeWindow.locator('.webos-app-window__title').boundingBox();
    expect(Math.abs((macTitle.x + macTitle.width / 2) - (macWindowBox.x + macWindowBox.width / 2))).toBeLessThan(4);
    await screenshot(page, '03-macos-window-light-1440x900.png');
    diagnostics.screenshots.push('03-macos-window-light-1440x900.png');

    const originalWindowBox = await activeWindow.boundingBox();
    const header = await activeWindow.locator('.webos-app-window__header').boundingBox();
    await page.mouse.move(header.x + header.width * .72, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width * .72 + 28, header.y + header.height / 2 + 20, { steps: 5 });
    await page.mouse.up();
    const movedWindowBox = await activeWindow.boundingBox();
    expect(Math.abs(movedWindowBox.x - originalWindowBox.x) + Math.abs(movedWindowBox.y - originalWindowBox.y)).toBeGreaterThan(8);
    const resizeHandle = activeWindow.locator('.webos-window-resize.is-se');
    let resizeBox = await resizeHandle.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x - 72, resizeBox.y - 48, { steps: 5 });
    await page.mouse.up();
    const shrunkenWindowBox = await activeWindow.boundingBox();
    expect(shrunkenWindowBox.width).toBeLessThan(movedWindowBox.width - 30);
    expect(shrunkenWindowBox.height).toBeLessThan(movedWindowBox.height - 20);
    resizeBox = await resizeHandle.boundingBox();
    await page.mouse.move(resizeBox.x + resizeBox.width / 2, resizeBox.y + resizeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(resizeBox.x + 56, resizeBox.y + 42, { steps: 5 });
    await page.mouse.up();
    const resizedWindowBox = await activeWindow.boundingBox();
    expect(resizedWindowBox.width).toBeGreaterThan(shrunkenWindowBox.width + 24);
    expect(resizedWindowBox.height).toBeGreaterThan(shrunkenWindowBox.height + 18);

    await activeWindow.locator('.is-minimize').click();
    await expect(activeWindow).toBeHidden();
    const macTask = page.locator('.microi-macos-dock .microi-window-task').first();
    await expect(macTask).toBeVisible();
    await macTask.click();
    await expect(activeWindow).toBeVisible();
    await activeWindow.locator('.is-maximize').click();
    const maxBox = await activeWindow.boundingBox();
    const managerBox = await page.locator('.webos-window-manager').boundingBox();
    expect(maxBox.width).toBeGreaterThan(managerBox.width - 24);
    await activeWindow.locator('.is-maximize').click();
    const deepLinkState = await page.evaluate(() => {
        const values = Reflect.ownKeys(window.__VUE_APP__?._context?.provides || {})
            .map(key => window.__VUE_APP__._context.provides[key]);
        const pinia = values.find(value => value?._s instanceof Map);
        const webos = pinia ? [...pinia._s.values()].find(store => store?.$id === 'webosStore') : null;
        return {
            hash: location.hash,
            activeWindowId: webos?.ActiveWindowId || '',
            windows: (webos?.Windows || []).map(item => ({ id: item.id, url: item.url, minimized: item.minimized })),
        };
    });
    const activeUrl = deepLinkState.windows.find(item => item.id === deepLinkState.activeWindowId)?.url || '';
    if (activeUrl === '/') {
        // 官方 Home 菜单当前就是根路由；桌面地址本身已代表该入口，无需写入冗余 webosApp=/。
        expect(deepLinkState.hash).toBe('#/os');
    } else {
        await expect.poll(() => page.evaluate(() => location.hash), { timeout: 10_000 }).toContain('webosApp=');
    }

    let themePanel = await openThemePanel(page);
    const initialModeText = (await themePanel.locator('.mci-mode-btn.active').textContent() || '').trim();
    const initialPalette = await themePanel.locator('.mci-color-dot.active').getAttribute('title').catch(() => '');
    pendingPreferenceRestore.mode = /深|dark/i.test(initialModeText) ? 'dark' : 'light';
    pendingPreferenceRestore.palette = initialPalette || null;
    await page.keyboard.press('Escape');
    themePanel = await setTheme(page, 'dark', '橙色');
    await expect(themePanel.locator('.mci-color-dot[title="橙色"]')).toHaveClass(/active/);
    await screenshot(page, '04-macos-dark-orange-theme-panel-1440x900.png');
    diagnostics.screenshots.push('04-macos-dark-orange-theme-panel-1440x900.png');
    await page.keyboard.press('Escape');

    await switchStyle(page, 'Windows 风格');
    await expect(page.locator('.microi-windows-desk .microi-desk-item').first()).toBeVisible({ timeout: 30_000 });
    activeWindow = page.locator('.webos-app-window.is-active');
    if (!await activeWindow.isVisible().catch(() => false)) activeWindow = await openHome(page, 'windows');
    else await expect(activeWindow.locator('.webos-module-host.is-ready')).toBeVisible({ timeout: 45_000 });
    const winMin = await activeWindow.locator('.is-minimize').boundingBox();
    const winMax = await activeWindow.locator('.is-maximize').boundingBox();
    const winClose = await activeWindow.locator('.is-close').boundingBox();
    expect(winMin.x).toBeLessThan(winMax.x);
    expect(winMax.x).toBeLessThan(winClose.x);
    const taskbar = await page.locator('.webos-windows-taskbar').boundingBox();
    expect(Math.abs(taskbar.y + taskbar.height - 900)).toBeLessThanOrEqual(1);
    const centralDock = await page.locator('.webos-windows-taskbar .microi-windows-dock').boundingBox();
    const quickActions = await page.locator('.webos-toolbar--windows .webos-quick-actions').boundingBox();
    expect(await boxesDoNotOverlap(centralDock, quickActions)).toBe(true);
    await screenshot(page, '05-windows-dark-orange-window-1440x900.png');
    diagnostics.screenshots.push('05-windows-dark-orange-window-1440x900.png');

    await activeWindow.locator('.is-minimize').click();
    await expect(activeWindow).toBeHidden();
    diagnostics.features.windowsFolder = await exerciseFolder(page, 'windows');
    if (diagnostics.features.windowsFolder) {
        const folder = page.locator('.microi-windows-desk .microi-desk-item:has(> .thumb)').first();
        await folder.click();
        await page.waitForTimeout(500);
        await screenshot(page, '06-windows-folder-dark-1440x900.png');
        diagnostics.screenshots.push('06-windows-folder-dark-1440x900.png');
        await page.locator('.microi-desk-thumblayer:visible .microi-folder-close').click();
    }
    diagnostics.features.windowsDockFolder = await exerciseDockFolder(page, 'windows');

    await page.setViewportSize({ width: 1024, height: 600 });
    const winTask = page.locator('.microi-windows-dock .microi-window-task').first();
    if (await winTask.isVisible().catch(() => false)) await winTask.click();
    activeWindow = page.locator('.webos-app-window.is-active');
    await expect(activeWindow).toBeVisible();
    const lowWindow = await activeWindow.boundingBox();
    expect(lowWindow.x).toBeGreaterThanOrEqual(0);
    expect(lowWindow.y).toBeGreaterThanOrEqual(0);
    expect(lowWindow.x + lowWindow.width).toBeLessThanOrEqual(1025);
    expect(lowWindow.y + lowWindow.height).toBeLessThanOrEqual(553);
    const lowTaskbar = await page.locator('.webos-windows-taskbar').boundingBox();
    expect(Math.abs(lowTaskbar.y + lowTaskbar.height - 600)).toBeLessThanOrEqual(1);
    await screenshot(page, '07-windows-dark-low-1024x600.png');
    diagnostics.screenshots.push('07-windows-dark-low-1024x600.png');

    await setTheme(page, /深|dark/i.test(initialModeText) ? 'dark' : 'light', initialPalette || null);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1_200);
    await screenshot(page, '08-windows-restored-theme-low-1024x600.png');
    diagnostics.screenshots.push('08-windows-restored-theme-low-1024x600.png');

    expect(await page.locator('.webos-app-window iframe').count()).toBe(0);
    expect(diagnostics.nativeDialogs).toEqual([]);
    expect(diagnostics.consoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedResponses).toEqual([]);
    expect(diagnostics.webosResponses.length).toBeGreaterThan(0);
    expect(diagnostics.webosResponses.every(item => Number(item.code) === 1)).toBe(true);

    const restoreLabel = /Windows/.test(initialStyle)
        ? 'Windows 风格'
        : /macOS/.test(initialStyle)
            ? 'macOS 风格'
            : '经典传统';
    await switchStyle(page, restoreLabel);
    pendingPreferenceRestore = null;
    await fs.writeFile(path.join(OUTPUT, 'diagnostics.json'), JSON.stringify({
        ...diagnostics,
        runtime,
        initialStyle,
        restoredStyle: restoreLabel,
        finalWindowFrames: await page.locator('.webos-app-window iframe').count(),
    }, null, 2), 'utf8');
});
