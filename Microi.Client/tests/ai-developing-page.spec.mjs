import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse, compileScript, compileTemplate, compileStyle } from "@vue/compiler-sfc";

const pageUrl = new URL("../src/views/ai-engine/developing.vue", import.meta.url);
const helperUrl = new URL("../src/views/ai-engine/developing-runtime.js", import.meta.url);

test("新菜单能够通过框架真实动态导入规则访问同一开发中组件", () => {
    assert.ok(fs.existsSync(pageUrl), "框架缺少可由菜单使用的 AI 开发中页面");
    const source = fs.readFileSync(new URL("../src/pinia/modules/permission.js", import.meta.url), "utf8");
    const start = source.indexOf("function GetComponent(item)");
    const end = source.indexOf("\n/**", start);
    const body = source.slice(start, end).replace('const modules = import.meta.glob("/src/views/**/*.vue");', "");
    const loader = () => "shared-developing-page";
    // 执行真实框架解析函数，只替换 Vite 编译期 glob；不同菜单无需新增常量路由或复制页面。
    const getComponent = new Function("DiyCommon", "normalizeComponentPath", "modules", "shouldIgnoreWarning",
        `${body}\nreturn GetComponent;`)(
        { IsNull: value => value == null || value === "" }, value => value,
        { "/src/views/ai-engine/developing.vue": loader }, () => true
    );
    for (const path of ["/ai-engine/developing", "/ai-engine/developing.vue", "/views/ai-engine/developing"]) {
        assert.equal(getComponent({ ComponentPath: path, IsMicroiService: false }), loader);
    }
});

test("共享页面按当前菜单更新标题，不使用 URL 假进度或沿用上一菜单", async () => {
    const { resolveDevelopingMenu } = await import(helperUrl);
    const route = { meta: { title: "销售管理", Id: "menu-sales" }, query: { title: "假标题", progress: "100", status: "completed" } };
    assert.deepEqual(resolveDevelopingMenu(route), { title: "销售管理", menuId: "menu-sales" });
    route.meta = { title: "老板经营看板", Id: "menu-dashboard" };
    assert.deepEqual(resolveDevelopingMenu(route), { title: "老板经营看板", menuId: "menu-dashboard" });
    assert.equal("progress" in resolveDevelopingMenu(route), false);
});

test("缺失或非法菜单信息安全降级且长标题有界", async () => {
    const { resolveDevelopingMenu } = await import(helperUrl);
    assert.deepEqual(resolveDevelopingMenu(), { title: "当前功能", menuId: "" });
    assert.deepEqual(resolveDevelopingMenu({ meta: { title: {}, Id: [] } }), { title: "当前功能", menuId: "" });
    assert.equal(resolveDevelopingMenu({ meta: { title: "  采购\u0000管理  " } }).title, "采购管理");
    assert.equal(resolveDevelopingMenu({ meta: { title: "长".repeat(1000) } }).title.length, 160);
});

test("实际 SFC 可编译，标题以文本插值显示且无业务写入或伪造进度", () => {
    const source = fs.readFileSync(pageUrl, "utf8");
    const { descriptor, errors } = parse(source, { filename: pageUrl.pathname });
    assert.deepEqual(errors, []);
    assert.doesNotThrow(() => compileScript(descriptor, { id: "ai-developing" }));
    assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: pageUrl.pathname, id: "ai-developing" }).errors, []);
    assert.deepEqual(compileStyle({ source: descriptor.styles[0].content, filename: pageUrl.pathname, id: "ai-developing", scoped: true }).errors, []);
    assert.match(descriptor.template.content, /\{\{\s*menu\.title\s*\}\}/);
    assert.doesNotMatch(source, /v-html|Math\.random|setInterval|aria-valuenow|\bfetch\s*\(|AddFormData|UptFormData/);
    assert.match(source, /window\.location\.reload\(\)/);
});

test("动效可暂停并随隐藏与卸载停止，无障碍偏好和移动布局有降级", () => {
    const source = fs.readFileSync(pageUrl, "utf8");
    assert.match(source, /prefers-reduced-motion:\s*reduce/);
    assert.match(source, /animation-play-state:\s*paused/);
    assert.match(source, /visibilitychange/);
    assert.match(source, /removeEventListener\("visibilitychange"/);
    assert.match(source, /deactivated\(\)/);
    assert.match(source, /:aria-pressed="motionPaused"/);
    assert.match(source, /@media\s*\(max-width:\s*600px\)/);
    assert.match(source, /width:\s*100%/);
    assert.match(source, /height:\s*100%/);
    assert.match(source, /:focus-visible/);
});

test("真实组件生命周期在缓存失活后保持停播，页面可见事件不能复活隐藏菜单", () => {
    const { descriptor } = parse(fs.readFileSync(pageUrl, "utf8"));
    const listeners = new Set();
    const document = { hidden: false, addEventListener: (_name, callback) => listeners.add(callback), removeEventListener: (_name, callback) => listeners.delete(callback) };
    // 执行 SFC 的实际 Options API 生命周期，不复制停播判断；fixture 只提供浏览器可见性事件。
    const component = new Function("document", "resolveDevelopingMenu",
        descriptor.script.content.replace(/import[^;]+;/, "").replace("export default", "return"))(document, () => ({}));
    const vm = component.data();
    for (const [key, value] of Object.entries(component.methods)) vm[key] = value.bind(vm);
    component.mounted.call(vm);
    assert.equal(vm.pageVisible, true);
    component.deactivated.call(vm);
    assert.equal(vm.pageVisible, false);
    document.hidden = true; for (const callback of listeners) callback();
    document.hidden = false; for (const callback of listeners) callback();
    assert.equal(vm.pageVisible, false, "KeepAlive 的非活动菜单必须保持停播");
    component.activated.call(vm);
    assert.equal(vm.pageVisible, true);
    document.hidden = true; for (const callback of listeners) callback();
    assert.equal(vm.pageVisible, false);
    component.beforeUnmount.call(vm);
    assert.equal(listeners.size, 0);
});
