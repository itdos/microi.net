import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const componentSource = await readFile(
    new URL('../src/views/form-engine/diy-field-component/diy-v8tmpengine.vue', import.meta.url),
    'utf8'
);
const componentStyles = componentSource.match(/<style\s+scoped>([\s\S]*?)<\/style>/u)?.[1] || '';
// 使用通用的四列低代码表单模板，平台测试不能依赖任何客户项目文件。
const gridColumns = 'repeat(auto-fit,minmax(max(150px,calc(25% - 7.5px)),1fr))';

test('表单 V8 快照四列卡片铺满字段内容宽度，不再收缩在左侧', async ({ page }) => {
    expect(componentStyles).not.toBe('');
    await page.setViewportSize({ width: 1366, height: 900 });
    // 这里保留 Element Plus 的两层 flex 几何关系，V8 模板直接放进真实组件样式的承载节点。
    // 旧版 inline span 也同屏渲染作回归对照，证明仅修改 HTML 内部 width:100% 无法撑开父 flex item。
    const cards = Array.from({ length: 4 }, (_, index) => (
        `<div class="card"><small>设备指标 ${index + 1}</small><strong>${1577790565622936 + index}</strong></div>`
    )).join('');
    const dashboard = `<div class="dashboard"><div class="cards">${cards}</div></div>`;
    await page.setContent(`
      <style>
        body { margin: 0; padding: 24px; font: 14px Arial, sans-serif; }
        .fixture { width: 1080px; margin-bottom: 24px; }
        .el-form-item { display: flex; width: 100%; }
        .el-form-item__content { display: flex; flex: 1; align-items: center; flex-wrap: wrap; min-width: 0; }
        .dashboard { width: 100%; min-width: 0; }
        .cards { display: grid; grid-template-columns: ${gridColumns}; gap: 10px; min-width: 0; }
        .card { box-sizing: border-box; min-width: 0; padding: 12px 14px; border: 1px solid #ddd; }
        .card small, .card strong { display: block; overflow-wrap: anywhere; }
        ${componentStyles}
      </style>
      <div class="fixture old"><div class="el-form-item"><div class="el-form-item__content"><span>${dashboard}</span></div></div></div>
      <div class="fixture new"><div class="el-form-item diy-v8-template-item"><div class="el-form-item__content"><div class="diy-v8-template-content">${dashboard}</div></div></div></div>
    `);

    const widths = await page.evaluate(() => {
        const measure = (selector) => {
            const root = document.querySelector(selector);
            const content = root.querySelector('.el-form-item__content');
            const carrier = content.firstElementChild;
            const grid = root.querySelector('.cards');
            const items = Array.from(root.querySelectorAll('.card'));
            const boxes = items.map((item) => item.getBoundingClientRect());
            return {
                content: content.getBoundingClientRect().width,
                carrier: carrier.getBoundingClientRect().width,
                grid: grid.getBoundingClientRect().width,
                firstRowCount: boxes.filter((box) => Math.abs(box.top - boxes[0].top) < 1).length,
                lastRight: boxes.at(-1).right,
                gridRight: grid.getBoundingClientRect().right,
                overflow: document.documentElement.scrollWidth > window.innerWidth
            };
        };
        return { old: measure('.old'), fresh: measure('.new') };
    });

    expect(widths.old.carrier, JSON.stringify(widths)).toBeLessThan(widths.old.content * 0.8);
    expect(widths.fresh.carrier, JSON.stringify(widths)).toBeGreaterThanOrEqual(widths.fresh.content * 0.98);
    expect(widths.fresh.grid, JSON.stringify(widths)).toBeGreaterThanOrEqual(widths.fresh.content * 0.98);
    expect(widths.fresh.firstRowCount, JSON.stringify(widths)).toBe(4);
    expect(Math.abs(widths.fresh.lastRight - widths.fresh.gridRight), JSON.stringify(widths)).toBeLessThanOrEqual(1);
    expect(widths.fresh.overflow, JSON.stringify(widths)).toBe(false);
});
