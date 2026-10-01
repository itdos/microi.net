import assert from "node:assert/strict";
import test from "node:test";
import { buildTableHeaderPlan } from "../src/views/form-engine/utils/table-header-groups.js";
import { isModuleBannerHidden } from "../src/views/form-engine/utils/module-banner-visibility.js";
import { getCornerStyle, initCornerStyle, setCornerStyle } from "../src/utils/theme-shape.js";
import { resolveUserCornerStyle } from "../src/utils/user-visual-preferences.js";

const fields = ["Type", "Total", "Male", "Female", "Amount"].map((Name) => ({ Name }));

test("多级表头仅合并连续的可见字段，保留前后独立列", () => {
    const plan = buildTableHeaderPlan('[{"Label":"人数（人）","Fields":["Total","Male","Female"]}]', fields);
    assert.equal(plan.length, 1);
    assert.deepEqual([plan[0].start, plan[0].end], [1, 3]);
    assert.deepEqual(plan[0].children.map((child) => child.index), [1, 2, 3]);
});

test("嵌套表头、非法 JSON、重复和非连续引用均安全处理", () => {
    const nested = buildTableHeaderPlan([{ Label: "人员", Children: [
        { Label: "数量", Fields: ["Total", "Male"] },
        { Label: "性别", Fields: ["Female"] }
    ] }], fields);
    assert.equal(nested[0].children.length, 2);
    assert.deepEqual(buildTableHeaderPlan("not-json", fields), []);
    assert.deepEqual(buildTableHeaderPlan([{ Label: "错误", Fields: ["Total", "Female"] }], fields), []);
    assert.deepEqual(buildTableHeaderPlan([{ Label: "逆序", Fields: ["Male", "Total"] }], fields), []);
    assert.deepEqual(buildTableHeaderPlan([
        { Label: "A", Fields: ["Total", "Male"] },
        { Label: "B", Fields: ["Male", "Female"] }
    ], fields), []);
});

test("多级表头可按原字段名或查询别名引用同一列", () => {
    const aliasedFields = [{ Name: "Headcount", AsName: "Total" }, { Name: "Male", AsName: "M" }];
    const plan = buildTableHeaderPlan([{ Label: "人数", Fields: ["Headcount", "M"] }], aliasedFields);
    assert.deepEqual(plan[0].children.map((child) => child.index), [0, 1]);
});

test("Banner 旧值默认显示，仅明确开启才隐藏", () => {
    for (const value of [undefined, null, false, 0, "0", "false", ""]) assert.equal(isModuleBannerHidden(value), false);
    for (const value of [true, 1, "1", "true"]) assert.equal(isModuleBannerHidden(value), true);
});

test("边角风格默认圆角，切换持久化并可恢复", () => {
    const values = new Map();
    const originalWindow = globalThis.window;
    const originalDocument = globalThis.document;
    globalThis.window = { localStorage: { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) } };
    globalThis.document = { documentElement: { dataset: {} } };
    try {
        assert.equal(getCornerStyle(), "round");
        assert.equal(setCornerStyle("square"), "square");
        assert.equal(document.documentElement.dataset.mciCornerStyle, "square");
        assert.equal(initCornerStyle(), "square");
        assert.equal(setCornerStyle("unknown"), "round");
    } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
    }
});

test("已安装账号字段优先于上一位用户的浏览器偏好", () => {
    assert.equal(resolveUserCornerStyle({ Id: "u1", CornerStyle: "round" }, "square"), "round");
    assert.equal(resolveUserCornerStyle({ Id: "u1", CornerStyle: "square" }, "round"), "square");
    assert.equal(resolveUserCornerStyle({ Id: "u1" }, "square"), "square");
});
