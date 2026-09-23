import assert from "node:assert/strict";
import test from "node:test";

import {
    mergeCurrentSelectOptions,
    resolveTextSelectValueKey
} from "../src/utils/select-option-merge.js";

// zhy：验证 Text 格式远程下拉框在选项加载前后始终使用配置的保存字段进行匹配。
test("text-format remote select keeps its configured value key before and after options load", () => {
    const config = {
        DataSource: "Sql",
        DataSourceSqlRemote: true,
        SelectSaveFormat: "Text",
        SelectSaveField: "KehuMC",
        SelectLabel: "KehuMC"
    };

    const savedValue = "Ningbo University";
    assert.equal(resolveTextSelectValueKey(config), "KehuMC");

    const options = mergeCurrentSelectOptions(
        [{ Id: "customer-1", KehuMC: savedValue }],
        savedValue,
        config,
        false
    );

    assert.equal(resolveTextSelectValueKey(config), "KehuMC");
    assert.deepEqual(options, [{ Id: "customer-1", KehuMC: savedValue }]);
});

// zhy：验证 Json 格式仍可继续使用完整对象的稳定标识字段。
test("json-format remote select can continue using an object identity key", () => {
    assert.equal(resolveTextSelectValueKey({
        SelectSaveFormat: "Json",
        SelectSaveField: "Name",
        SelectLabel: "Name"
    }), "");
});

// zhy：验证单选会保留不在当前远程结果中的历史已选项。
test("remote select preserves a saved option outside the current authorized result", () => {
    const result = mergeCurrentSelectOptions(
        [{ Id: "u2", Name: "当前范围人员" }],
        { Id: "u1", Name: "历史负责人" },
        { SelectSaveField: "Id", SelectLabel: "Name" },
        false
    );

    assert.deepEqual(result, [
        { Id: "u2", Name: "当前范围人员" },
        { Id: "u1", Name: "历史负责人" }
    ]);
});

// zhy：验证多选兼容对象数组、JSON 字符串及历史文本值，并保持去重。
test("remote multiple select preserves object and text legacy values without duplicates", () => {
    const result = mergeCurrentSelectOptions(
        [{ Id: "u2", Name: "张二" }],
        JSON.stringify([{ Id: "u1", Name: "张一" }, { Id: "u2", Name: "张二" }]),
        { SelectSaveField: "Id", SelectLabel: "Name" },
        true
    );

    assert.deepEqual(result, [
        { Id: "u2", Name: "张二" },
        { Id: "u1", Name: "张一" }
    ]);

    assert.deepEqual(
        mergeCurrentSelectOptions([], "历史姓名", { SelectLabel: "Name" }, true),
        [{ Name: "历史姓名" }]
    );
});

// zhy：验证远程搜索不会把上一次搜索的无关选项带入新结果。
test("remote select never carries unrelated options from a previous search", () => {
    const result = mergeCurrentSelectOptions(
        [{ Id: "u3", Name: "新结果" }],
        { Id: "u1", Name: "当前已选" },
        { SelectSaveField: "Id", SelectLabel: "Name" },
        false
    );

    assert.equal(result.some((item) => item.Id === "u-old"), false);
    assert.deepEqual(result.map((item) => item.Id), ["u3", "u1"]);
});
