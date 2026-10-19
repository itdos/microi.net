import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { compileString } from "sass";

const searchSource = await readFile(new URL("../src/views/form-engine/diy-search.vue", import.meta.url), "utf8");
const searchStyles = searchSource.match(/<style[^>]*>([^]*?)<\/style>/u)?.[1] || "";
const elementStyles = await readFile(new URL("../node_modules/element-plus/dist/index.css", import.meta.url), "utf8");
// 使用生产搜索 Select 的完整模板；只替换外部业务查询，以真实 Element Plus 测量标签可读宽度。
const selectTemplate = searchSource.match(/<!-- 下拉选择器 -->[^]*?(<div v-else-if="field.Component == 'Select'[^]*?)\s*<!-- 级联选择器 -->/u)?.[1]
    .replace(/v-else-if="[^"]*"/u, "");
const fixture = await build({
    stdin: {
        contents: `import {createApp} from "vue/dist/vue.esm-bundler.js";
            import {ElSelect, ElOption, ElTag, ElIcon} from "element-plus";
            import {Search} from "@element-plus/icons-vue";
            window.mountSearchFixture = (template, options) => {
                const app = createApp({template: '<div class="diy-search-container"><div class="search-fields-wrapper"><div class="search-field-item">' + template + '</div></div></div>',
                    components: {ElSelect, ElOption, ElTag, ElIcon, Search},
                    data: () => ({field: {Id:'nature', Name:'Nature', Label:'法规性质', Component:'MultipleSelect', Config:{DataSource:'KeyValue'}, Data:options}, SearchSelect: {Nature: []}}),
                    methods: {SelectRemoteMethod(){}, GetFieldPlaceholder(){return ''}, GetSelectValueKey(){return 'Key'}, SearchSelectChange(){}, getSelectOptionKey(field, option){return option.Key}, GetSearchItemCheckLabel(option){return option.Value}}
                });
                window.searchFixture = app.mount('#fixture');
            };`,
        resolveDir: fileURLToPath(new URL("../", import.meta.url)),
        loader: "js"
    },
    bundle: true,
    write: false,
    format: "iife",
    define: { "process.env.NODE_ENV": '"production"', __VUE_OPTIONS_API__: "true", __VUE_PROD_DEVTOOLS__: "false", __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: "false" },
    logLevel: "silent"
});
const css = compileString(searchStyles.replace(/:deep\(([^)]+)\)/gu, "$1")).css;

for (const width of [1366, 3840]) {
    test(`搜索多选标签在 ${width}px 下始终可读，长标签可通过折叠提示查看`, async ({ page }, testInfo) => {
        await page.setViewportSize({width, height: width === 3840 ? 2160 : 900});
        await page.setContent(`<style>${elementStyles}\n${css}</style><div id="fixture"></div>`);
        await page.addScriptTag({ content: fixture.outputFiles[0].text });
        await page.evaluate(({template}) => window.mountSearchFixture(template, [
            {Key:'law', Value:'法律'}, {Key:'rule', Value:'行政法规'}, {Key:'policy', Value:'规范性文件'}
        ]), {template: selectTemplate});
        const select = page.locator('.search-input-block .el-select');
        await select.click();
        for (const label of ['法律', '行政法规', '规范性文件']) {
            await page.getByRole('option', {name: label, exact: true}).click();
        }
        await page.mouse.click(5, 100);
        const label = select.locator('.el-select__tags-text').first();
        await expect(label).toHaveText('法律');
        await expect.poll(() => label.evaluate((node) => node.getBoundingClientRect().width)).toBeGreaterThanOrEqual(24);
        expect(await page.evaluate(() => window.searchFixture.SearchSelect.Nature.map((option) => option.Key))).toEqual(['law', 'rule', 'policy']);
        await expect(select).toContainText('+ 2');
        await select.locator('.el-select__selected-item').filter({hasText:'+ 2'}).hover();
        await expect(page.locator('.el-select__selection .el-select__tags-text', {hasText:'行政法规'})).toBeVisible();
        await testInfo.attach('选中标签几何数据', {body: JSON.stringify(await label.evaluate((node) => ({text:node.textContent,width:node.getBoundingClientRect().width}))), contentType:'application/json'});
        await page.screenshot({path:testInfo.outputPath(`selected-label-${width}.png`)});
        // 清除仍回到空条件，标签修复不能改变查询值。
        await select.hover();
        await select.locator('.el-select__clear').click();
        await expect(select.locator('.el-select__tags-text')).toHaveCount(0);
        expect(await page.evaluate(() => window.searchFixture.SearchSelect.Nature)).toEqual([]);
    });
}
