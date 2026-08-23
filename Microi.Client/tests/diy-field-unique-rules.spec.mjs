import assert from "node:assert/strict";
import test from "node:test";
import {
    buildDiyFieldUniqueRules,
    DIY_FIELD_UNIQUE_MODE,
    getDiyFieldUniqueMode
} from "../src/utils/diy-field-unique.js";

test("every standalone field becomes its own rule and all composite fields share one rule", () => {
    const fields = [
        { Name: "Code", Label: "编号", Unique: 1, Config: { Unique: { Type: "Alone" } } },
        { Name: "Phone", Label: "手机号", Unique: true, Config: "{}" },
        { Name: "TenantId", Label: "租户", Unique: 1, Config: { Unique: { Type: "All" } } },
        { Name: "ExternalCode", Label: "外部编号", Unique: "1", Config: '{"Unique":{"Type":"all"}}' },
        { Name: "Name", Label: "名称", Unique: 0, Config: {} }
    ];

    assert.equal(getDiyFieldUniqueMode(fields[3]), DIY_FIELD_UNIQUE_MODE.ALL);
    assert.deepEqual(buildDiyFieldUniqueRules(fields), [
        { Key: "Alone:Code", Type: "Alone", Fields: [{ Name: "Code", Label: "编号" }] },
        { Key: "Alone:Phone", Type: "Alone", Fields: [{ Name: "Phone", Label: "手机号" }] },
        {
            Key: "All:TenantId+ExternalCode",
            Type: "All",
            Fields: [
                { Name: "TenantId", Label: "租户" },
                { Name: "ExternalCode", Label: "外部编号" }
            ]
        }
    ]);
});
