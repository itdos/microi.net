import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = 'http://localhost:61500';
const API_BASE = 'https://localhost:61501';
const PASSWORD = process.env.PW_LOCAL_PASSWORD || '';
const OUTPUT = path.resolve(process.cwd(), '../.tmp/screenshots/webos-four-issues-2026-08-30');
const MENU_ROUTE = '**/apiengine/platform-sys-menu**';

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
    const responsePromise = page.waitForResponse(
        response => /\/api\/SysUser\/Login(?:\?|$)/i.test(response.url()),
        { timeout: 30_000 },
    );
    await page.getByRole('button', { name: '登录', exact: true }).click();
    const response = await responsePromise;
    const body = await response.json();
    expect(Number(body?.Code), body?.Msg || '真实 UI 登录失败').toBe(1);
    await page.waitForTimeout(900);
}

async function openStyleMenu(page) {
    const trigger = page.getByTitle('切换界面风格').first();
    await expect(trigger).toBeVisible({ timeout: 30_000 });
    await trigger.hover();
    await expect(page.getByText('macOS 风格', { exact: true })).toBeVisible();
}

async function switchStyle(page, label) {
    await openStyleMenu(page);
    await page.getByText(label, { exact: true }).click();
    if (label === '经典传统') {
        await expect(page.locator('.webos-platform')).toHaveCount(0, { timeout: 45_000 });
        return;
    }
    const platform = label === 'Windows 风格' ? 'windows' : 'macos';
    await expect(page.locator(`.webos-platform--${platform}`)).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('.el-loading-mask:visible')).toHaveCount(0, { timeout: 45_000 });
}

async function currentStyle(page) {
    return page.evaluate(() => {
        if (document.querySelector('.webos-platform--windows')) return 'Windows 风格';
        if (document.querySelector('.webos-platform--macos')) return 'macOS 风格';
        return '经典传统';
    });
}

async function themeMode(page) {
    return page.evaluate(() => (
        document.documentElement.classList.contains('dark')
        || document.documentElement.getAttribute('data-theme') === 'dark'
    ) ? 'dark' : 'light');
}

async function setThemeMode(page, mode) {
    if (await themeMode(page) === mode) return;
    const trigger = page.locator('.webos-toolbar .theme-select-trigger').first();
    await expect(trigger).toBeVisible();
    await trigger.click();
    const panel = page.locator('.mci-theme-popover:visible').first();
    await expect(panel).toBeVisible();
    await panel.locator('.mci-mode-btn').nth(mode === 'dark' ? 1 : 0).click();
    await expect.poll(() => themeMode(page), { timeout: 20_000 }).toBe(mode);
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
}

async function openModuleWindow(page) {
    const desk = '.microi-macos-desk';
    const named = page.locator([
        `${desk} .microi-desk-griditem[title="Home"]`,
        `${desk} .microi-desk-griditem[title="首页"]`,
        `${desk} .microi-desk-griditem[title="主页"]`,
    ].join(', ')).first();
    if (await named.isVisible().catch(() => false)) await named.click();
    else {
        const leaf = page.locator(`${desk} .microi-desk-griditem:not(:has(> .thumb)):not(:has(.has-widget))`).first();
        await expect(leaf).toBeVisible();
        await leaf.click();
    }
    const active = page.locator('.webos-app-window.is-active');
    await expect(active).toBeVisible({ timeout: 45_000 });
    await expect(active.locator('.webos-module-host.is-ready')).toBeVisible({ timeout: 45_000 });
    await expect(active.locator('iframe')).toHaveCount(0);
    return active;
}

function rgbaAlpha(value) {
    const match = String(value).match(/rgba?\((?:\s*\d+(?:\.\d+)?\s*,){2}\s*\d+(?:\.\d+)?(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)/i);
    if (!match) return 1;
    return match[1] === undefined || match[1] === '' ? 1 : Number(match[1]);
}

function parseRgb(value) {
    const match = String(value).match(/rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)/i);
    return match ? match.slice(1, 4).map(Number) : null;
}

function luminance(rgb) {
    const channels = rgb.map(value => {
        const channel = value / 255;
        return channel <= .03928 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}

function contrastRatio(foreground, background) {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + .05) / (values[1] + .05);
}

test.use({ viewport: { width: 1920, height: 900 } });

test('WebOS 截图 1-4 专项回归', async ({ page }) => {
    test.skip(!PASSWORD, 'PW_LOCAL_PASSWORD is required');
    await fs.mkdir(OUTPUT, { recursive: true });
    const diagnostics = { consoleErrors: [], pageErrors: [], failedResponses: [], screenshots: [], checks: {} };
    page.on('console', message => {
        if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
    });
    page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
    page.on('response', response => {
        if (response.status() >= 400) diagnostics.failedResponses.push({ status: response.status(), url: response.url() });
    });

    await login(page);
    const initialStyle = await currentStyle(page);
    await switchStyle(page, 'macOS 风格');
    const initialTheme = await themeMode(page);
    await setThemeMode(page, 'light');
    await expect(page.locator('.microi-macos-desk')).toBeVisible();

    // 问题 1：清空仅当前自动化上下文的 WebOS 缓存，并暂停真实菜单响应，捕获稳定骨架态。
    await page.evaluate(() => {
        localStorage.removeItem('webos-store');
        Object.keys(localStorage).filter(key => key.startsWith('webos_')).forEach(key => localStorage.removeItem(key));
    });
    let releaseMenuRequests;
    const menuGate = new Promise(resolve => { releaseMenuRequests = resolve; });
    const holdMenuRoute = async route => {
        // 带 Action 查询参数的是平台启动就绪探针；仅暂停 WebOS 自身无查询参数的菜单请求。
        if (new URL(route.request().url()).searchParams.has('Action')) {
            await route.continue();
            return;
        }
        await menuGate;
        await route.continue();
    };
    await page.route(MENU_ROUTE, holdMenuRoute);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('.webos-platform--macos')).toBeVisible({ timeout: 45_000 });
    const skeleton = page.getByTestId('webos-dock-skeleton');
    await expect(skeleton).toBeVisible({ timeout: 20_000 });
    await expect(skeleton).toHaveAttribute('aria-busy', 'true');
    expect(await skeleton.locator('.webos-dock-skeleton__item').count()).toBeGreaterThanOrEqual(7);
    await expect(page.getByText('100%', { exact: true })).toBeHidden({ timeout: 15_000 });
    await expect(skeleton).toBeVisible();
    await page.screenshot({ path: path.join(OUTPUT, 'issue-01-dock-loading-skeleton.png') });
    diagnostics.screenshots.push('issue-01-dock-loading-skeleton.png');
    releaseMenuRequests();
    await expect(skeleton).toBeHidden({ timeout: 45_000 });
    await expect(page.locator('.microi-macos-desk .microi-desk-griditem').first()).toBeVisible({ timeout: 45_000 });

    // 问题 2：鼠标未松开时真实窗口已经移动，DOM 中不存在第二个预览窗口。
    const activeWindow = await openModuleWindow(page);
    const before = await activeWindow.boundingBox();
    const header = await activeWindow.locator('.webos-app-window__header').boundingBox();
    await page.mouse.move(header.x + header.width * .7, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width * .7 + 120, header.y + header.height / 2 + 72, { steps: 8 });
    await page.waitForTimeout(120);
    const during = await activeWindow.boundingBox();
    expect(Math.abs(during.x - before.x) + Math.abs(during.y - before.y)).toBeGreaterThan(40);
    await expect(page.locator('.webos-window-ghost')).toHaveCount(0);
    await expect(page.locator('.webos-app-window:visible')).toHaveCount(1);
    expect(await activeWindow.locator('.webos-module-host').evaluate(element => getComputedStyle(element).visibility)).toBe('visible');
    await page.screenshot({ path: path.join(OUTPUT, 'issue-02-single-window-drag.png') });
    diagnostics.screenshots.push('issue-02-single-window-drag.png');
    await page.mouse.up();

    // 问题 3：自定义组件不再套任何外框；普通桌面磁贴只保留低对比主题边界。
    await activeWindow.locator('.is-close').click();
    await expect(activeWindow).toBeHidden();
    const frames = page.locator([
        '.microi-macos-desk .microi-desk-griditem .thumb',
        '.microi-macos-desk .microi-desk-griditem .imgico.has-widget',
        '.microi-macos-desk .microi-desk-griditem .imgico.has-iconclass',
    ].join(', '));
    await expect(frames.first()).toBeVisible();
    const desktopFrameBorders = await frames.evaluateAll(elements => elements
        .filter(element => element.getBoundingClientRect().width > 0)
        .map(element => {
            const style = getComputedStyle(element);
            return { width: style.borderTopWidth, color: style.borderTopColor };
        }));
    expect(desktopFrameBorders.length).toBeGreaterThanOrEqual(3);
    expect(
        desktopFrameBorders.every(border => border.width === '0px' || rgbaAlpha(border.color) <= .22),
        JSON.stringify(desktopFrameBorders),
    ).toBe(true);
    const widgetFrames = page.locator('.microi-macos-desk .microi-desk-griditem .imgico.has-widget:visible');
    expect(await widgetFrames.count()).toBeGreaterThanOrEqual(5);
    const widgetFrameStyles = await widgetFrames.evaluateAll(elements => elements.map(element => {
        const style = getComputedStyle(element);
        return {
            borderWidth: style.borderTopWidth,
            borderColor: style.borderTopColor,
            backgroundColor: style.backgroundColor,
            boxShadow: style.boxShadow,
        };
    }));
    expect(widgetFrameStyles.every(style => style.borderWidth === '0px'), JSON.stringify(widgetFrameStyles)).toBe(true);
    expect(widgetFrameStyles.every(style => rgbaAlpha(style.backgroundColor) === 0), JSON.stringify(widgetFrameStyles)).toBe(true);
    expect(widgetFrameStyles.every(style => !/inset/i.test(style.boxShadow)), JSON.stringify(widgetFrameStyles)).toBe(true);
    diagnostics.checks.desktopFrameBorders = desktopFrameBorders;
    diagnostics.checks.widgetFrames = widgetFrameStyles;
    await page.screenshot({ path: path.join(OUTPUT, 'issue-03-borderless-custom-widgets.png') });
    diagnostics.screenshots.push('issue-03-borderless-custom-widgets.png');

    // 问题 4：系统引擎二级菜单使用透明图片图标，并具备 iOS 风格半透明毛玻璃。
    const folder = page.locator([
        '.microi-macos-desk .microi-desk-griditem[title="系统引擎"]',
        '.microi-macos-desk .microi-desk-griditem[title="System Engine"]',
    ].join(', ')).first();
    await expect(folder).toBeVisible();
    await folder.click();
    const folderLayer = page.locator('.webos-desktop-folder:visible').first();
    const folderWrap = page.locator('.webos-desktop-folder-backdrop:visible').first();
    await expect(folderLayer).toBeVisible();
    const material = await folderLayer.evaluate(element => {
        const style = getComputedStyle(element);
        return {
            radius: parseFloat(style.borderTopLeftRadius),
            backdrop: style.backdropFilter || style.webkitBackdropFilter || '',
            backgroundImage: style.backgroundImage,
            backgroundColor: style.backgroundColor,
            borderColor: style.borderTopColor,
            titleColor: getComputedStyle(element.querySelector('.webos-desktop-folder__heading strong')).color,
            overflow: style.overflow,
        };
    });
    expect(material.radius).toBeGreaterThanOrEqual(24);
    expect(material.overflow).toBe('hidden');
    expect(material.backdrop).toMatch(/blur\((?:3[8-9]|[4-9]\d)px\)/);
    expect(material.backgroundImage).toContain('linear-gradient');
    expect(material.backgroundColor).not.toBe('rgb(255, 255, 255)');
    expect(rgbaAlpha(material.borderColor)).toBeLessThanOrEqual(.26);
    const borderRgb = parseRgb(material.borderColor);
    expect(borderRgb).not.toBeNull();
    expect(borderRgb.some(channel => channel < 220), material.borderColor).toBe(true);
    const titleRgb = parseRgb(material.titleColor);
    expect(titleRgb).not.toBeNull();
    expect(contrastRatio(titleRgb, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    await expect(folderWrap).toBeVisible();
    const folderItems = folderLayer.locator('.webos-desktop-folder__item');
    expect(await folderItems.count()).toBeGreaterThanOrEqual(15);
    const iconRows = await folderItems.evaluateAll(items => items.map(item => {
        const icon = item.querySelector('.webos-theme-menu-icon');
        return {
            label: item.querySelector('.webos-desktop-folder__label')?.textContent?.trim() || '',
            hasSvg: Boolean(icon?.querySelector('svg')),
            hasImage: Boolean(icon?.querySelector('img')),
            src: icon?.querySelector('img')?.src || '',
            naturalWidth: icon?.querySelector('img')?.naturalWidth || 0,
            naturalHeight: icon?.querySelector('img')?.naturalHeight || 0,
        };
    }));
    expect(iconRows.every(row => row.hasImage && !row.hasSvg && row.src), JSON.stringify(iconRows)).toBe(true);
    expect(iconRows.every(row => row.naturalWidth === 320 && row.naturalHeight === 320), JSON.stringify(iconRows)).toBe(true);
    expect(iconRows.every(row => /webos-icons\/ios-skeuomorphic-v2\/202609\/.+\.webp/i.test(row.src)), JSON.stringify(iconRows)).toBe(true);
    expect(new Set(iconRows.map(row => row.src)).size).toBeGreaterThanOrEqual(15);
    const originalAccent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--mci-color-primary').trim());
    diagnostics.checks.folderMaterial = material;
    diagnostics.checks.transparentImageIcons = iconRows;
    await page.screenshot({ path: path.join(OUTPUT, 'issue-04-transparent-image-glass-folder.png') });
    diagnostics.screenshots.push('issue-04-transparent-image-glass-folder.png');
    await folderLayer.locator('.webos-desktop-folder__close').click();

    // 通过产品真实主题工具切换强调色，验证图片图标不会被主题色替换或丢失。
    const changedAccent = await page.evaluate(async () => {
        const { setThemeColor } = await import('/src/utils/theme-color.js');
        return setThemeColor('#e4572e');
    });
    expect(String(changedAccent).toLowerCase()).not.toBe(String(originalAccent).toLowerCase());
    await folder.click();
    const recoloredLayer = page.locator('.webos-desktop-folder:visible').first();
    await expect(recoloredLayer).toBeVisible();
    const themedSources = await recoloredLayer.locator('.webos-theme-menu-icon.is-image img').evaluateAll(images => images.map(image => image.src));
    expect(themedSources.length).toBe(iconRows.length);
    expect(themedSources).toEqual(iconRows.map(row => row.src));
    diagnostics.checks.themeIndependentImageIcons = themedSources;
    await page.screenshot({ path: path.join(OUTPUT, 'issue-04-image-icons-after-accent-change.png') });
    diagnostics.screenshots.push('issue-04-image-icons-after-accent-change.png');
    await recoloredLayer.locator('.webos-desktop-folder__close').click();
    await page.evaluate(async color => {
        const { setThemeColor } = await import('/src/utils/theme-color.js');
        setThemeColor(color || '#409eff');
    }, originalAccent);

    await setThemeMode(page, initialTheme);
    await switchStyle(page, initialStyle);
    const knownReloadConsoleErrors = diagnostics.consoleErrors.filter(message => (
        /Invocation canceled due to the underlying connection being closed/i.test(message)
        && /获取(?:最近联系人列表|未读消息条数)失败/.test(message)
    ));
    const unexpectedConsoleErrors = diagnostics.consoleErrors.filter(message => !knownReloadConsoleErrors.includes(message));
    diagnostics.knownReloadConsoleErrorCount = knownReloadConsoleErrors.length;
    diagnostics.consoleErrors = unexpectedConsoleErrors;
    diagnostics.unexpectedConsoleErrors = unexpectedConsoleErrors;
    expect(unexpectedConsoleErrors).toEqual([]);
    expect(diagnostics.pageErrors).toEqual([]);
    expect(diagnostics.failedResponses).toEqual([]);
    await fs.writeFile(path.join(OUTPUT, 'diagnostics.json'), JSON.stringify({
        ...diagnostics,
        initialStyle,
        initialTheme,
        restoredStyle: await currentStyle(page),
        restoredTheme: await themeMode(page),
    }, null, 2), 'utf8');
});
