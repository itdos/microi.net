import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { computed, effectScope, nextTick, reactive, ref, watch } from "vue";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";
import { isExplicitlyEnabled, normalizeRenderSourceType } from "../src/utils/framework-presentation.js";

const source = readFileSync(new URL("../src/components/MciRenderSourceBadge/index.vue", import.meta.url), "utf8");
const { descriptor } = parse(source);
const script = descriptor.scriptSetup.content.replace(/^import\s+.*?\s+from\s+["'][^"']+["'];\r?\n/gm, "");

// 执行真实来源组件的 setup 与 Vue 响应式；身份只由宿主 store 提供，不能取应用元数据中的等级。
function badge(t, user = {}, patch = {}) {
    const scope = effectScope();
    t.after(() => scope.stop());
    const props = reactive({ type: "microservice", instanceKey: "page-a", dismissible: true, sourceInfo: {}, ...patch });
    const store = reactive({ CurrentUser: user, get GetCurrentUser() { return this.CurrentUser; } });
    const events = [];
    const context = vm.createContext({
        computed, ref, watch, normalizeRenderSourceType, isExplicitlyEnabled,
        defineProps: () => props,
        defineEmits: () => event => events.push(event),
        useI18n: () => ({ t: key => key }),
        useDiyStore: () => store,
        ElMessage: { success() {}, error() {} }
    });
    scope.run(() => vm.runInContext(`${script}\nglobalThis.badge = { visible, dismissed, detailsVisible, dismiss };`, context));
    return { ...context.badge, props, store, events };
}

test("微服务来源入口仅向 Level >= 9999 的当前用户展示，未知和非法等级保持隐藏", t => {
    for (const level of [undefined, null, "", " ", false, true, 0, 1, 9998, 9998.9, "9998", "invalid", NaN, Infinity, -Infinity, [], [9999], { valueOf: () => 9999 }]) {
        const current = badge(t, { Id: "ordinary", Level: level, _IsAdmin: true });
        assert.equal(current.visible.value, false, `Level=${String(level)} cannot expose the source entry`);
    }
    for (const level of [9999, 10000, "9999", " 10000 "]) {
        assert.equal(badge(t, { Id: "administrator", Level: level, _IsAdmin: false }).visible.value, true);
    }
});

test("应用元数据和管理员名称不能赋予来源入口权限，受限访问密钥会话不显示控制面入口", t => {
    assert.equal(badge(t, { Id: "ordinary", Account: "admin", Level: 1 }, { sourceInfo: { Level: 9999, CurrentUser: { Level: 9999 } } }).visible.value, false);
    assert.equal(badge(t, { Id: "limited", Level: 9999, _AccessKeySession: true }).visible.value, false);
    assert.equal(badge(t, { Id: "limited", Level: 9999, _AccessKeySession: "true" }).visible.value, false);
});

test("身份和等级刷新即时改变入口，降级同时关闭已展开的源码详情", async t => {
    const current = badge(t, { Id: "user-a", Level: 9999 });
    current.detailsVisible.value = true;
    current.store.CurrentUser.Level = 9998;
    assert.equal(current.visible.value, false);
    await nextTick();
    assert.equal(current.detailsVisible.value, false);
    current.store.CurrentUser.Level = 9999;
    await nextTick();
    assert.equal(current.visible.value, true);
    current.store.CurrentUser = { Id: "user-b", Level: 1 };
    assert.equal(current.visible.value, false);
    await nextTick();
    current.store.CurrentUser = {};
    assert.equal(current.visible.value, false);
});

test("管理员关闭仅作用当前实例，切换页面或账号后恢复，定制组件来源逻辑保持兼容", async t => {
    const current = badge(t, { Id: "user-a", Level: 9999 });
    current.dismiss();
    assert.equal(current.visible.value, false);
    assert.deepEqual(current.events, ["dismiss"]);
    current.props.instanceKey = "page-b";
    await nextTick();
    assert.equal(current.visible.value, true);
    current.dismiss();
    current.store.CurrentUser = { Id: "user-b", Level: 9999 };
    await nextTick();
    assert.equal(current.visible.value, true);
    const custom = badge(t, { Id: "ordinary", Level: 1 }, { type: "custom" });
    assert.equal(custom.visible.value, true);
    custom.dismiss();
    custom.store.CurrentUser.Level = 9999;
    await nextTick();
    assert.equal(custom.visible.value, false, "custom source dismissal must retain its original instance-only behavior");
    assert.equal(badge(t, { Id: "administrator", Level: 9999 }, { type: "" }).visible.value, false);
});

test("来源权限同时包住标签、关闭按钮与详情弹层，组件仍可编译", () => {
    assert.match(descriptor.template.content, /^\s*<template v-if="visible">[\s\S]*data-render-source-dismiss[\s\S]*<el-dialog[\s\S]*<\/template>\s*$/u);
    assert.doesNotThrow(() => compileScript(descriptor, { id: "source-badge-permission" }));
    const result = compileTemplate({ source: descriptor.template.content, filename: "MciRenderSourceBadge.vue", id: "source-badge-permission" });
    assert.deepEqual(result.errors, []);
});
