import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const FRONTEND = process.env.PW_BASE_URL || process.env.MICROI_TEST_FRONTEND_BASE || 'http://localhost:61500';
const OUTPUT = path.resolve(process.cwd(), '../.tmp/screenshots/webos-current-fixes-2026-08-30');
const HARNESS_URL = `${FRONTEND}/tests/fixtures/webos-current-fixes.html`;



test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ page }) => {

    await page.goto(HARNESS_URL, { waitUntil: 'domcontentloaded' });
});

test('系统引擎图标保持等宽透明画布、箭头居中且弹窗可拖动', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    const panel = page.locator('.webos-desktop-folder');
    await expect(panel).toBeVisible();
    const icons = panel.locator('.webos-theme-menu-icon');
    expect(await icons.count()).toBe(15);
    const geometry = await icons.evaluateAll(elements => elements.map(element => {
        const rect = element.getBoundingClientRect();
        return {
            width: rect.width,
            height: rect.height,
            radius: getComputedStyle(element).borderTopLeftRadius,
            background: getComputedStyle(element).backgroundColor,
            borderWidth: getComputedStyle(element).borderTopWidth,
        };
    }));
    expect(geometry.every(row => Math.abs(row.width - row.height) < .5), JSON.stringify(geometry)).toBe(true);
    expect(geometry.every(row => parseFloat(row.radius) === 0), JSON.stringify(geometry)).toBe(true);
    expect(geometry.every(row => row.background === 'rgba(0, 0, 0, 0)'), JSON.stringify(geometry)).toBe(true);
    expect(geometry.every(row => row.borderWidth === '0px'), JSON.stringify(geometry)).toBe(true);

    const nestedItem = panel.locator('.webos-desktop-folder__item.has-children').first();
    const aligned = await nestedItem.evaluate(element => {
        const icon = element.querySelector('.webos-theme-menu-icon').getBoundingClientRect();
        const chevron = element.querySelector('.webos-desktop-folder__chevron').getBoundingClientRect();
        return Math.abs((icon.top + icon.height / 2) - (chevron.top + chevron.height / 2));
    });
    expect(aligned).toBeLessThanOrEqual(1);

    const before = await panel.boundingBox();
    const header = await panel.locator('.webos-desktop-folder__header').boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width / 2 + 130, header.y + header.height / 2 + 70, { steps: 8 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    expect(after.x - before.x).toBeGreaterThan(100);
    expect(after.y - before.y).toBeGreaterThan(50);
    expect(after.x).toBeGreaterThanOrEqual(9);
    expect(after.y).toBeGreaterThanOrEqual(9);
    expect(after.x + after.width).toBeLessThanOrEqual(1271);
    expect(after.y + after.height).toBeLessThanOrEqual(791);

    await page.screenshot({ path: path.join(OUTPUT, 'system-engine-transparent-icons-dragged.png') });
});

test('Dock 文件夹同样保持等宽透明图标并支持标题栏拖动', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    await page.evaluate(() => window.__setWebosHarnessMode('dock'));
    const panel = page.locator('.webos-dock-folder');
    await expect(panel).toBeVisible();
    const firstIcon = panel.locator('.webos-theme-menu-icon').first();
    const iconBox = await firstIcon.boundingBox();
    expect(Math.abs(iconBox.width - iconBox.height)).toBeLessThan(.5);

    const before = await panel.boundingBox();
    const header = await panel.locator('header').boundingBox();
    await page.mouse.move(header.x + header.width / 2, header.y + header.height / 2);
    await page.mouse.down();
    await page.mouse.move(header.x + header.width / 2 - 120, header.y + header.height / 2 - 70, { steps: 8 });
    await page.mouse.up();
    const after = await panel.boundingBox();
    expect(before.x - after.x).toBeGreaterThan(90);
    expect(before.y - after.y).toBeGreaterThan(50);

    await page.screenshot({ path: path.join(OUTPUT, 'dock-folder-transparent-icons-dragged.png') });
});

test('WebOS 表单挂到 body，最大化与最小化都只作用于表单自身', async ({ page }) => {
    await fs.mkdir(OUTPUT, { recursive: true });
    await page.evaluate(() => window.__setWebosHarnessMode('form'));
    const dialog = page.locator('.diy-form-modern-dialog');
    await expect(dialog).toBeVisible();

    const bodyLayer = await dialog.evaluate(element => ({
        bodyContains: document.body.contains(element),
        parentIsOverlayDialog: element.parentElement?.classList.contains('el-overlay-dialog') === true,
        overlayIsBodyChild: element.parentElement?.parentElement?.parentElement === document.body,
        overlayZIndex: getComputedStyle(element.closest('.diy-form-webos-body-overlay')).zIndex
    }));
    expect(bodyLayer).toEqual({
        bodyContains:true,
        parentIsOverlayDialog:true,
        overlayIsBodyChild:true,
        overlayZIndex:'10030'
    });

    const parent = page.locator('.form-window-harness__desktop');
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
    await dialog.getByRole('button', { name:'最大化表单窗口' }).click();
    await expect(dialog).toHaveClass(/is-webos-form-maximized/);
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
    const maximized = await dialog.boundingBox();
    expect(maximized.width).toBeGreaterThan(1200);
    expect(maximized.height).toBeGreaterThan(680);
    await page.screenshot({ path: path.join(OUTPUT, 'form-body-layer-maximized.png') });

    await dialog.getByRole('button', { name:'还原表单窗口' }).click();
    await expect(dialog).not.toHaveClass(/is-webos-form-maximized/);
    await dialog.getByRole('button', { name:'最小化表单窗口' }).click();
    const restore = page.getByRole('button', { name:'恢复表单窗口' });
    await expect(restore).toBeVisible();
    await expect(dialog).toBeHidden();
    await restore.click();
    await expect(dialog).toBeVisible();
    await expect(parent).toHaveAttribute('data-parent-maximized', 'false');
});
