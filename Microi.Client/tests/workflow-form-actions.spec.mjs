import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const stateSource = fs.readFileSync(
    new URL("../src/views/form-engine/mixins/diy-form-full-state.mixin.js", import.meta.url),
    "utf8"
);
const formSource = fs.readFileSync(
    new URL("../src/views/form-engine/diy-form-full.vue", import.meta.url),
    "utf8"
);
const recordSource = fs.readFileSync(
    new URL("../src/views/form-engine/mixins/diy-table-workflow-record.mixin.js", import.meta.url),
    "utf8"
);
const previewSource = fs.readFileSync(
    new URL("../src/views/workflow/component/designer-preview.vue", import.meta.url),
    "utf8"
);
const historySource = fs.readFileSync(
    new URL("../src/views/workflow/component/workflow-history.vue", import.meta.url),
    "utf8"
);

test("workflow review mode is distinguished from ordinary CRUD mode", function () {
    assert.match(stateSource, /IsWorkflowSubmitMode\(\)[\s\S]*StartWork[\s\S]*DoWork/);
    assert.match(stateSource, /IsWorkflowReviewContext\(\)[\s\S]*DoWork[\s\S]*ViewWork/);
});

test("workflow review headers hide generic save, edit, custom and more actions", function () {
    assert.doesNotMatch(formSource, /OpenDiyFormWorkFlowType\.WorkType != 'StartWork'/);
    assert.ok((formSource.match(/v-if="!IsWorkflowReviewContext" trigger="click" size="small"/g) || []).length >= 3);
    assert.ok((formSource.match(/!IsWorkflowSubmitMode && ShowSaveBtn/g) || []).length >= 2);
    assert.ok((formSource.match(/!IsWorkflowReviewContext && !DiyCommon\.IsNull\(SysMenuModel\)/g) || []).length >= 5);
    assert.match(formSource, /param\.IsOpenWorkFlowForm === true[\s\S]*OpenDiyFormWorkFlowType = Object\.assign/);
});

test("opening a copied workflow persists read state before rendering the record", function () {
    assert.match(recordSource, /MarkWorkflowCopyRead\(flowId\)[\s\S]*\/api\/WorkFlow\/markCopyRead/);
    assert.match(recordSource, /workType === "Copy"[\s\S]*await self\.MarkWorkflowCopyRead\(currentFlowId\)/);
});

test("workflow preview requests the complete node and line package", function () {
    assert.ok((previewSource.match(/_PageSize:\s*1000/g) || []).length >= 2);
    assert.match(previewSource, /propsFlowTableRowId:[\s\S]*String\(routeFlowId \|\| ""\)\.trim\(\)[\s\S]*propsFlowTableRowId/);
    assert.match(historySource, /:disabled="DiyCommon\.IsNull\(CurrentFlowDesignId\)"/);
});
