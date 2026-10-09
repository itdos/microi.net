import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { isReactive, nextTick, reactive, toRaw, watchEffect } from "vue";

import {
    collectMenuFieldReferenceIds,
    hasFieldReference,
    selectTableDataSourceFields
} from "../src/views/form-engine/mixins/table-field-data-source.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");

test("keeps every primary-table field but filters unrelated joined-table data sources", () => {
    const fields = [
        { Id: "main-select", TableId: "main" },
        { Id: "tenant-name", TableId: "sys-user" },
        { Id: "wx-mp-id", TableId: "sys-user" }
    ];
    const menu = {
        SearchFieldIds: [{ Id: "tenant-name", TableId: "sys-user" }]
    };

    assert.deepEqual(
        selectTableDataSourceFields(fields, "main", menu).map((field) => field.Id),
        ["main-select", "tenant-name"]
    );
});

test("collects field ids from object arrays, id arrays and serialized menu values", () => {
    const ids = collectMenuFieldReferenceIds({
        SelectFields: [{ Id: "select-a" }],
        TableDiyFieldIds: '["column-a"]',
        InTableEditFields: '[{"Id":"editable-a"}]',
        FixedFields: "fixed-a,fixed-b"
    });

    assert.deepEqual(
        [...ids].sort(),
        ["column-a", "editable-a", "fixed-a", "fixed-b", "select-a"]
    );
});

test("matches inline-edit fields across legacy and current storage shapes", () => {
    assert.equal(hasFieldReference('[{"Id":"open-all"}]', "open-all"), true);
    assert.equal(hasFieldReference([{ Id: "open-all" }], "department"), false);
    assert.equal(hasFieldReference(["open-all"], "open-all"), true);
    assert.equal(hasFieldReference("open-all,department", "department"), true);
    assert.equal(hasFieldReference("{invalid-json", "open-all"), false);
});

test("loads asynchronous field data only after the table field list is reactive", async () => {
    const source = fs.readFileSync(
        path.join(clientRoot, "src/views/form-engine/mixins/diy-table-schema.mixin.js"),
        "utf8"
    );
    const assignmentIndex = source.indexOf("self.DiyFieldList = result.Data;");
    const reactiveSelection = /var dataSourceFields = selectTableDataSourceFields\(\r?\n                self\.DiyFieldList/.exec(
        source.slice(assignmentIndex)
    );
    const dataSourceIndex = reactiveSelection ? assignmentIndex + reactiveSelection.index : -1;
    const loadIndex = source.indexOf("self.DiyCommon.SetFieldsData(dataSourceFields", dataSourceIndex);

    assert.ok(assignmentIndex >= 0, "table fields should be assigned to the reactive list");
    assert.ok(dataSourceIndex > assignmentIndex, "data-source fields should be selected from the reactive list");
    assert.ok(loadIndex > dataSourceIndex, "asynchronous data loading should start after reactive assignment");

    // Execute the actual method with Vue's proxies: source ordering alone cannot
    // prove that an asynchronous option response invalidates the table render.
    const ast = parse(source, { sourceType: "module" });
    const mixin = ast.program.body.find((node) => node.type === "ExportDefaultDeclaration").declaration;
    const methods = mixin.properties.find((node) => node.key.name === "methods").value.properties;
    const method = methods.find((node) => node.key.name === "GetDiyFieldAfter");
    const getDiyFieldAfter = vm.runInNewContext(
        `({${source.slice(method.start, method.end)}})`,
        { selectTableDataSourceFields }
    ).GetDiyFieldAfter;
    const rawFields = [
        { Id: "main-select", TableId: "main", Config: {}, Data: [] },
        { Id: "department", TableId: "sys-user", Config: {}, Data: [] },
        { Id: "unrelated", TableId: "sys-user", Config: {}, Data: [] }
    ];
    let completeLoad;
    const state = reactive({
        DiyFieldList: [],
        TableId: "main",
        SysMenuModel: { SearchFieldIds: [{ Id: "department" }] },
        PropsVirtualFields: [],
        TableChildAuth: { ChildTableId: "child-table" },
        DiyCommon: {
            IsNull: (value) => value === undefined || value === null || value === "",
            DiyFieldConfigStrToJson() {},
            Base64DecodeDiyField() {},
            EnsureFieldProperties() {},
            SetFieldsData(fields, formData, tableChildAuth) {
                assert.equal(isReactive(state.DiyFieldList), true, "the list must already be reactive when loading starts");
                assert.deepEqual(fields.map((field) => field.Id), ["main-select", "department"]);
                assert.equal(formData, null);
                assert.equal(tableChildAuth, state.TableChildAuth, "child-table authorization must reach the loader");
                for (const field of fields) {
                    assert.equal(isReactive(field), true, "the loader must receive each field's Vue proxy");
                    assert.equal(field, state.DiyFieldList.find((item) => item.Id === field.Id));
                }
                assert.equal(toRaw(fields[1]), rawFields[1], "the proxy must wrap the actual returned field");
                completeLoad = () => {
                    fields[1].Data = [{ Id: "department-id", Name: "研发部" }];
                };
            }
        }
    });
    let renderedLabel;
    const stop = watchEffect(() => {
        const department = state.DiyFieldList.find((field) => field.Id === "department");
        renderedLabel = department?.Data.find((item) => item.Id === "department-id")?.Name || "department-id";
    });
    try {
        getDiyFieldAfter.call(state, { Code: 1, Data: rawFields });
        await nextTick();
        assert.equal(renderedLabel, "department-id", "the saved value is visible before the option response");
        await Promise.resolve().then(completeLoad);
        await nextTick();
        assert.equal(renderedLabel, "研发部", "the option response must update the label without resizing or refreshing the table");
    } finally {
        stop();
    }
});
