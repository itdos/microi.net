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
const handlerSource = fs.readFileSync(
    new URL("../src/views/workflow/wf-work-handler.vue", import.meta.url),
    "utf8"
);
const workflowMixinSource = fs.readFileSync(
    new URL("../src/views/form-engine/mixins/diy-form-full-workflow.mixin.js", import.meta.url),
    "utf8"
);
const diyFormSource = fs.readFileSync(
    new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
    "utf8"
);
const legacyWorkflowFormSource = fs.readFileSync(
    new URL("../src/views/workflow/diy-form-wf.vue", import.meta.url),
    "utf8"
);
const customWorkflowFormSource = fs.readFileSync(
    new URL("../src/views/workflow/custom-form-wf.vue", import.meta.url),
    "utf8"
);
const workflowResultDialogSource = fs.readFileSync(
    new URL("../src/views/workflow/component/workflow-result-dialog.vue", import.meta.url),
    "utf8"
);

test("workflow review mode is distinguished from ordinary CRUD mode", function () {
    assert.match(stateSource, /IsWorkflowSubmitMode\(\)[\s\S]*StartWork[\s\S]*DoWork/);
    assert.match(stateSource, /IsWorkflowReviewContext\(\)[\s\S]*DoWork[\s\S]*ViewWork/);
});

test("workflow review headers hide generic save, edit, custom and mutation actions", function () {
    assert.doesNotMatch(formSource, /OpenDiyFormWorkFlowType\.WorkType != 'StartWork'/);
    assert.ok((formSource.match(/v-if="!IsWorkflowReviewContext && FormMode != 'View'"[^>]*@click="SaveToDraftBox"/g) || []).length >= 3);
    assert.ok((formSource.match(/v-if="!IsWorkflowReviewContext"[^>]*@click="OpenDraftDialog"/g) || []).length >= 3);
    assert.ok((formSource.match(/v-if="!IsWorkflowReviewContext"[^>]*@click="TranslateBusinessData"/g) || []).length >= 3);
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

test("workflow success waits for the centered result dialog before completing callbacks", function () {
    assert.match(handlerSource, /<WorkflowResultDialog ref="refWorkflowResultDialog"\s*\/>/);
    assert.match(handlerSource, /async ShowWorkflowResult\(resultData, action\)[\s\S]*?return await dialog\.open/);
    assert.match(handlerSource, /HandOverWork\(param, callback\)[\s\S]*?CurrentNodeModel\.EndV8[\s\S]*?await self\.ShowWorkflowResult\(result\.Data, "Handover"\)[\s\S]*?CallbackWFSubmit/);
    assert.match(handlerSource, /RecallOrCancelWork\(param, callback\)[\s\S]*?CurrentNodeModel\.EndV8[\s\S]*?await self\.ShowWorkflowResult\([\s\S]*?CallbackWFSubmit/);
    assert.match(handlerSource, /BuildStartWorkAlternateSubmit\(param\)[\s\S]*?CurrentNodeModel\.EndV8[\s\S]*?await self\.ShowWorkflowResult\(result\.Data, "Start"\)[\s\S]*?CallbackWFSubmit[\s\S]*?cb\(/);
    assert.match(handlerSource, /BuildSendWorkAlternateSubmit\(param\)[\s\S]*?CurrentNodeModel\.EndV8[\s\S]*?await self\.ShowWorkflowResult\(result\.Data, "Process"\)[\s\S]*?CallbackWFSubmit[\s\S]*?cb\(/);
    assert.ok((handlerSource.match(/await self\.ShowWorkflowResult\(/g) || []).length >= 6);
    assert.doesNotMatch(handlerSource, /DiyCommon\.Tips\(["'`]流程(?:发起|处理|作废)成功/);
    assert.doesNotMatch(handlerSource, /DiyCommon\.Tips\(["'`]工作(?:移交|撤回)成功/);
});

test("workflow result content is text-bound and reuses the platform dialog shell", function () {
    assert.match(workflowResultDialogSource, /<el-dialog[\s\S]*?append-to-body[\s\S]*?align-center[\s\S]*?draggable/);
    assert.match(workflowResultDialogSource, /open\(payload\)[\s\S]*?return new Promise/);
    assert.match(workflowResultDialogSource, /@closed="ResolveOpen\(true\)"/);
    assert.match(workflowResultDialogSource, /v-for="name in Result\.ReceiverNames"[\s\S]*?\{\{ name \}\}/);
    assert.match(workflowResultDialogSource, /Array\.isArray\(source\.Receivers\)/);
    assert.doesNotMatch(workflowResultDialogSource, /v-html|dangerouslyUseHTMLString|<br\s*\/?\s*>/i);
    [
        "WorkflowStartSuccess",
        "WorkflowProcessSuccess",
        "WorkflowHandoverSuccess",
        "WorkflowRecallSuccess",
        "WorkflowCancelSuccess",
        "WorkflowEnded",
        "WorkflowNextNode",
        "WorkflowNextApprovers"
    ].forEach(function (key) {
        assert.match(workflowResultDialogSource, new RegExp(`Msg\\.${key}`));
    });
});

test("workflow form submissions suppress the duplicate generic success notification", function () {
    assert.ok((workflowMixinSource.match(/SuppressSuccessTips:\s*true/g) || []).length >= 2);
    assert.ok((legacyWorkflowFormSource.match(/SuppressSuccessTips:\s*true/g) || []).length >= 3);
    assert.match(diyFormSource, /formParam\.SuppressSuccessTips !== true[\s\S]*?DiyCommon\.Tips\(self\.\$t\("Msg\.Success"\)\)/);
    assert.match(customWorkflowFormSource, /refWfWorkHandler_3\.SendWork\(/);
    assert.match(customWorkflowFormSource, /refWfWorkHandler_3\.StartWork\(/);
});
