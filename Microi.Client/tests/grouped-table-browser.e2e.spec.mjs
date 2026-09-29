import { expect, test } from '@playwright/test';

test.use({ browserName: 'chromium', channel: 'msedge', viewport: { width: 1280, height: 800 } });

test('多级表头在真实 Element Plus 表格中保留固定列和数据顺序', async ({ page }) => {
    await page.goto(`${process.env.PW_BASE_URL || 'http://127.0.0.1:61500'}/tests/fixtures/grouped-table.html`, { waitUntil: 'domcontentloaded' });
    const table = page.locator('.el-table');
    await expect(table.locator('thead')).toContainText('人数（人）');
    await expect(table.locator('thead')).toContainText('总数');
    await expect(table.locator('thead')).toContainText('性别');
    const group = table.locator('thead th').filter({ hasText: '人数（人）' });
    await expect(group).toHaveAttribute('colspan', '3');
    await expect(table.locator('tbody tr').first()).toContainText('员工');
    await expect(table.locator('tbody tr').first()).toContainText('67');
    await expect(table.locator('tbody tr').first()).toContainText('38');
    await expect(table.locator('tbody tr').first()).toContainText('29');
    await expect(table.locator('thead')).toContainText('序号');
    await expect(table.locator('thead')).toContainText('操作');
});
