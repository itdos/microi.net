import assert from "node:assert/strict";
import test from "node:test";
import { buildDuplicateFieldPayload } from "../src/views/form-engine/field-duplicate.js";

test("字段复制保留完整控件配置但移除身份与运行态字段", () => {
    const field = {
        Id: "source-id",
        TableId: "table-id",
        Name: "Status",
        Label: "状态",
        Component: "Switch",
        Config: { Switch: { VisualStyle: "modern" }, Custom: { keep: true } },
        Data: [{ Key: "1", Value: "是" }],
        ChangeV8Code: "V8.Form.Other = 1;",
        Visible: 0,
        AppVisible: 1,
        Sort: 200,
        CreateTime: "2026-08-18",
        _V8: { runtime: true }
    };
    const snapshot = structuredClone(field);
    const result = buildDuplicateFieldPayload(field, [field], 1);

    assert.equal(result.Name, "Status_Copy");
    assert.equal(result.Label, "状态(副本)");
    assert.equal(result._insertIndex, 1);
    assert.equal(result.Id, undefined);
    assert.equal(result.TableId, undefined);
    assert.equal(result.Sort, undefined);
    assert.equal(result._V8, undefined);
    assert.equal(result.ChangeV8Code, field.ChangeV8Code);
    assert.deepEqual(result.Config, field.Config);
    assert.notEqual(result.Config, field.Config);
    assert.deepEqual(field, snapshot);
});

test("连续复制自动生成不冲突的字段名与标签", () => {
    const field = { Name: "Status", Label: "状态", Component: "Switch" };
    const result = buildDuplicateFieldPayload(field, [
        field,
        { Name: "status_copy" },
        { Name: "Status_Copy2" }
    ], 3);

    assert.equal(result.Name, "Status_Copy3");
    assert.equal(result.Label, "状态(副本3)");
});
