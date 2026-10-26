import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import crypto from 'node:crypto';

// 真实 Vue / Element Plus 几何回归：读取生产按钮、列头、密度样式和测量器，无业务接口或写库。
// 不启动 Vite/API、不生成截图或构建树；浏览器临时上下文由 finally 精确释放。
const root = path.resolve(import.meta.dirname, '../../..');
const client = path.join(root, 'Microi.Client');
const moduleAt = relative => import(pathToFileURL(path.join(client, relative)));
const { chromium } = await moduleAt('node_modules/playwright/index.mjs');
const sass = await moduleAt('node_modules/sass/sass.node.mjs');
const { buildUiDensityVariables } = await moduleAt('src/utils/ui-density.js');
const source = await fs.readFile(path.join(client, 'src/views/form-engine/utils/table-action-column-width.js'), 'utf8');
const style = await fs.readFile(path.join(client, 'src/styles/diy-table.scss'), 'utf8');
const actionStyles = style.slice(style.indexOf('.diy-table-action-content {'), style.indexOf('//liucheng2025-4-4'));
assert.ok(actionStyles.includes('padding-inline: 9px'));
function blockFrom(source, marker) {
    const start = source.indexOf(marker);
    assert.ok(start >= 0, marker);
    let depth = 0;
    let started = false;
    for (let index = start; index < source.length; index++) {
        if (source[index] === '{') { depth++; started = true; }
        else if (source[index] === '}' && --depth === 0 && started) return source.slice(start, index + 1);
    }
    throw new Error('Unclosed production CSS block: ' + marker);
}
const styles = sass.compileString(actionStyles + '\n' + blockFrom(style, '.col-header-cell {') + '\n'
    + blockFrom(style, '.action-column-settings-trigger {') + '\n'
    + await fs.readFile(path.join(client, 'src/styles/ui-density.scss'), 'utf8')).css;
const labels = {
    zh: ['复制', '清除所有缓存', '升级租户数据库', '详情', '更多'],
    en: ['Copy', 'Clear all cached data', 'Upgrade tenant database', 'Details', 'More actions'],
    vi: ['Sao chép', 'Xóa tất cả bộ nhớ đệm', 'Nâng cấp cơ sở dữ liệu khách hàng', 'Chi tiết', 'Thêm'],
    my: ['ကူးယူရန်', 'သိမ်းဆည်းထားသော အချက်အလက်အားလုံးကို ရှင်းလင်းပါ', 'ဒေတာဘေ့စ်ကို အဆင့်မြှင့်တင်ပါ', 'အသေးစိတ်', 'နောက်ထပ်']
};
let browser;
const cases = [];
try {
    browser = await chromium.launch({ headless: true, args: ['--renderer-process-limit=2'] });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    try {
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.setContent('<!doctype html><html><body><div id="app" class="diy-table"></div></body></html>');
        await page.addStyleTag({ content: await fs.readFile(path.join(client, 'node_modules/element-plus/dist/index.css'), 'utf8') });
        await page.addStyleTag({ content: styles });
        await page.addScriptTag({ content: await fs.readFile(path.join(client, 'node_modules/vue/dist/vue.global.prod.js'), 'utf8') });
        await page.addScriptTag({ content: await fs.readFile(path.join(client, 'node_modules/element-plus/dist/index.full.min.js'), 'utf8') });
        await page.addScriptTag({ content: source.replace(/^export /gm, '') + '\nwindow.observeActionColumnWidth = observeActionColumnWidth;' });
        await page.evaluate(() => {
            const app = Vue.createApp({
                data: () => ({ width: 180, labels: ['复制', '清除所有缓存'], hidden: false, rows: [{ Id: 1 }, { Id: 2 }], measurements: 0 }),
                mounted() {
                    this.observer = window.observeActionColumnWidth(this.$refs.table.$el, width => {
                        this.width = width; this.measurements++;
                        this.$nextTick(() => this.$refs.table.doLayout());
                    });
                },
                beforeUnmount() { this.observer.stop(); },
                template: `<el-table ref="table" :data="rows" style="width:100%" table-layout="fixed">
                    <el-table-column prop="Id" label="Record" min-width="400" />
                    <el-table-column label="Actions" class-name="row-last-op" fixed="right" :width="width">
                        <template #header><div class="col-header-cell action-column-settings-trigger"><span class="col-header-label">Actions</span><span style="width:15px;flex:none">⚙</span></div></template>
                        <template #default="scope"><div class="diy-table-action-content"><el-button v-for="(label,index) in labels" :key="index" v-show="!hidden || index === 0"><span aria-hidden="true">✦</span><span>{{label}}</span></el-button></div></template>
                    </el-table-column></el-table>`
            });
            app.use(ElementPlus);
            window.fixture = app.mount('#app');
            window.unmountFixture = () => app.unmount();
            window.settleFixture = async () => {
                await Vue.nextTick();
                let previous = -1;
                let stable = 0;
                // Element Plus 的字体/几何过渡结束后连续四帧无变化才验收，避免读取上一档密度。
                for (let frame = 0; frame < 120; frame++) {
                    await new Promise(resolve => requestAnimationFrame(resolve));
                    stable = window.fixture.measurements === previous ? stable + 1 : 0;
                    previous = window.fixture.measurements;
                    if (stable >= 4) return;
                }
                throw new Error('Action-column measurement did not stabilize');
            };
        });
        for (const [language, text] of Object.entries(labels)) for (const density of [90, 100, 110]) {
            await page.evaluate(({ text, density, variables }) => {
                document.documentElement.dataset.mciUiDensity = density;
                for (const [key, value] of Object.entries(variables)) document.documentElement.style.setProperty(key, value);
                window.fixture.labels = text;
            }, { text, density, variables: buildUiDensityVariables(density) });
            await page.evaluate(() => window.settleFixture());
            await page.waitForFunction(() => [...document.querySelectorAll('.diy-table-action-content')].every(content => {
                const cell = content.closest('td').getBoundingClientRect();
                return [...content.children].every(button => {
                    const bounds = button.getBoundingClientRect();
                    return bounds.left >= cell.left && bounds.right <= cell.right;
                });
            }));
            cases.push({ language, density, columnWidth: await page.evaluate(() => window.fixture.width) });
        }
        const beforeHide = await page.evaluate(() => window.fixture.width);
        await page.evaluate(() => { window.fixture.hidden = true; });
        await page.evaluate(() => window.settleFixture());
        await page.waitForFunction(previous => window.fixture.width < previous, beforeHide);
        const stable = await page.evaluate(() => window.fixture.measurements);
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        assert.equal(await page.evaluate(() => window.fixture.measurements), stable, 'stable layout must not continue writing widths');
        await page.evaluate(() => window.unmountFixture());
        assert.deepEqual(errors, []);
    } finally { await context.close(); }
} finally { await browser?.close(); }
console.log(JSON.stringify({ Passed: true, Cases: cases, SourceSHA256: crypto.createHash('sha256').update(source).digest('hex'), BrowserClosed: true, BusinessWrites: 0 }));
