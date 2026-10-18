import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import tableState from "../src/views/form-engine/mixins/diy-table-state.mixin.js";

const tableSource = await readFile(new URL("../src/views/form-engine/diy-table.vue", import.meta.url), "utf8");

test("更多功能仅由模块明确开关或嵌入页开关隐藏，旧菜单继续显示", () => {
    const compute = tableState.computed.HideMoreFunctions;
    assert.equal(typeof compute, "function", "模块开关尚未接入 DiyTable");
    for (const value of [true, 1, "1", "true"]) {
        assert.equal(compute.call({ PropsHideMoreFunctions: false, SysMenuModel: { HideMoreFunctions: value } }), true);
    }
    for (const value of [undefined, null, false, 0, "0", "false", "", "yes"]) {
        assert.equal(compute.call({ PropsHideMoreFunctions: false, SysMenuModel: { HideMoreFunctions: value } }), false);
    }
    assert.equal(compute.call({ PropsHideMoreFunctions: false }), false);
    assert.equal(compute.call({ PropsHideMoreFunctions: true, SysMenuModel: { HideMoreFunctions: 0 } }), true);
});

test("更多功能采用更多搜索相同的默认按钮样式并保留加载与原动作", () => {
    const toolbar = tableSource.match(/<el-dropdown v-if="!HideMoreFunctions[^]*?<\/el-dropdown>/u)?.[0];
    assert.ok(toolbar, "更多功能入口必须使用合并后的模块开关");
    const button = toolbar.match(/<el-button\b[^>]*>/u)?.[0];
    assert.ok(button);
    assert.doesNotMatch(button, /type="primary"/u);
    assert.match(button, /:loading="BusinessDataTranslateLoading"/u);
    assert.match(toolbar, /ShiftTableDisplayMode\(\)/u);
    assert.match(toolbar, /TranslateBusinessData\(\)/u);
});
