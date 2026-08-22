import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const designFilename = new URL("../src/views/form-engine/diy-design.vue", import.meta.url);
const designerMixinFilename = new URL("../src/views/form-engine/mixins/diy-form-designer.mixin.js", import.meta.url);

function read(filename) {
    return fs.readFileSync(filename, "utf8");
}

function extractBalancedBlock(source, marker) {
    const markerIndex = source.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing source marker: ${marker}`);
    const blockStart = source.indexOf("{", markerIndex + marker.length);
    assert.notEqual(blockStart, -1, `missing block after source marker: ${marker}`);

    let depth = 0;
    let quote = "";
    let escaped = false;
    for (let index = blockStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = "";
            continue;
        }
        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }
        if (character === "{") depth += 1;
        if (character === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(blockStart + 1, index);
        }
    }
    assert.fail(`unterminated block after source marker: ${marker}`);
}

function compileMethod(source, marker, dependencies = []) {
    const body = extractBalancedBlock(source, marker);
    return Function(...dependencies, "field", body);
}

test("deleting a designer layout field recomputes stale child visibility", function () {
    const designerSource = read(designerMixinFilename);
    const delDiyFieldArr = compileMethod(designerSource, "\nDelDiyFieldArr(field)");
    const collapseGroup = { Id: "group-id", Component: "CollapseGroup", _isShow: true };
    const collapsedChild = { Id: "child-id", Component: "Text", _isShow: false };
    const unrelatedField = { Id: "other-id", Component: "Text", _isShow: true };
    let refreshCount = 0;
    const context = {
        DiyFieldList: [collapseGroup, collapsedChild, unrelatedField],
        CollapseGroupState: { "group-id": true, "other-id": false },
        FieldTabsState: { "group-id": "pane-a" },
        CurrentDiyFieldModel: collapseGroup,
        selectedFieldForToolbar: collapseGroup,
        RefreshDiyFieldRuntimeState() {
            refreshCount += 1;
            this.DiyFieldList.forEach((field) => {
                field._isShow = true;
            });
        }
    };

    assert.equal(delDiyFieldArr.call(context, collapseGroup), true);
    assert.deepEqual(context.DiyFieldList.map((field) => field.Id), ["child-id", "other-id"]);
    assert.equal(collapsedChild._isShow, true);
    assert.equal(refreshCount, 1);
    assert.equal(Object.hasOwn(context.CollapseGroupState, "group-id"), false);
    assert.equal(context.CollapseGroupState["other-id"], false);
    assert.equal(Object.hasOwn(context.FieldTabsState, "group-id"), false);
    assert.deepEqual(context.CurrentDiyFieldModel, {});
    assert.equal(context.selectedFieldForToolbar, null);
});

test("successful deletion delegates to the canvas and synchronizes parent designer state", function () {
    const designSource = read(designFilename);
    const removeDeletedField = compileMethod(
        designSource,
        "\n        RemoveDeletedFieldFromDesigner(field)",
        ["lodash"]
    );
    const collapseGroup = { Id: "group-id", Label: "分组", _isShow: true };
    const child = { Id: "child-id", Label: "子字段", _isShow: false };
    const canvasList = [collapseGroup, child];
    let delegatedField = null;
    const fieldForm = {
        DiyFieldList: canvasList,
        DelDiyFieldArr(field) {
            delegatedField = field;
            this.DiyFieldList.splice(0, 1);
            this.DiyFieldList[0]._isShow = true;
            return true;
        }
    };
    const context = {
        $refs: { fieldForm },
        DiyFieldList: [collapseGroup, child],
        DiyFieldListClone: [],
        CurrentDiyFieldModel: collapseGroup,
        ShowFieldSettingsDialog: true
    };
    const lodash = { cloneDeep: (value) => structuredClone(value) };

    removeDeletedField.call(context, lodash, collapseGroup);

    assert.equal(delegatedField, collapseGroup);
    assert.equal(context.DiyFieldList, canvasList);
    assert.deepEqual(context.DiyFieldList.map((field) => field.Id), ["child-id"]);
    assert.equal(context.DiyFieldList[0]._isShow, true);
    assert.notEqual(context.DiyFieldListClone, context.DiyFieldList);
    assert.deepEqual(context.DiyFieldListClone.map((field) => field.Id), ["child-id"]);
    assert.deepEqual(context.CurrentDiyFieldModel, {});
    assert.equal(context.ShowFieldSettingsDialog, false);
});

test("the delete API success callback uses the synchronized designer removal path", function () {
    const designSource = read(designFilename);
    const callbackDeleteField = compileMethod(designSource, "\n        CallbackDeleteField(field)");
    const field = { Id: "field-id", Label: "待删字段" };
    let removed = null;
    const context = {
        PageType: "",
        DiyApi: { DelDiyField: "/api/FormEngine/DelDiyField", FormEngine: { DelFormData: "/api/FormEngine/DelFormData" } },
        DiyCommon: {
            OsConfirm(message, callback) {
                assert.match(message, /待删字段/);
                callback();
            },
            Post(url, param, callback) {
                assert.equal(url, "/api/FormEngine/DelDiyField");
                assert.deepEqual(param, { Id: "field-id" });
                callback({ Code: 1 });
            },
            Result: (result) => result.Code === 1,
            Tips() {}
        },
        $t: () => "操作成功",
        RemoveDeletedFieldFromDesigner(deletedField) {
            removed = deletedField;
        }
    };

    callbackDeleteField.call(context, field);
    assert.equal(removed, field);
});
