<template>
    <section
        class="module-form-workbench"
        :class="[`is-${presentation.toLowerCase()}`, { 'is-control-center': isControlCenter }]"
    >
        <header class="workbench-toolbar">
            <div v-if="selector.Display !== 'List'" class="workbench-record-select">
                <span class="toolbar-label">当前记录</span>
                <el-select
                    v-model="selectedId"
                    filterable
                    :disabled="records.length === 0"
                    :placeholder="selector.Placeholder || '请选择要维护的数据'"
                >
                    <el-option
                        v-for="record in records"
                        :key="record.Id"
                        :label="recordLabel(record)"
                        :value="record.Id"
                    />
                </el-select>
                <span v-if="rowCount !== null && rowCount !== undefined" class="record-count">共 {{ rowCount }} 条</span>
            </div>
            <div class="workbench-actions workbench-page-actions">
                <!-- 页面 V8 按钮保持经典表格的页面作用域，逐个显示，不并入统一业务下拉。 -->
                <el-button
                    v-for="action in visiblePageActions"
                    :key="`page:${actionKey(action)}`"
                    :type="actionType(action)"
                    :loading="actionLoading"
                    :disabled="action.Disabled === true"
                    @click="runAction(action, 'Page')"
                >
                    <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                </el-button>
                <!-- 工作台只有一条当前记录；批量按钮默认以该记录作为已选数据执行。 -->
                <el-button
                    v-for="action in visibleBatchActions"
                    :key="`batch:${actionKey(action)}`"
                    :type="actionType(action)"
                    :loading="actionLoading"
                    :disabled="!selectedId || action.Disabled === true"
                    @click="runAction(action, 'Batch')"
                >
                    <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                </el-button>
                <el-button :icon="Refresh" :loading="loading" @click="refreshCurrentRecord">刷新</el-button>
                <el-button v-if="canAdd" :icon="Plus" @click="$emit('open-form', null, 'Add')">新增记录</el-button>
                <el-dropdown v-if="config.ShowClassicList !== false" trigger="click">
                    <el-button :icon="MoreFilled">更多功能<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item @click="$emit('switch-classic')">
                                <el-icon><List /></el-icon>切换到经典表格
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
            </div>
        </header>

        <div
            v-if="loading && records.length === 0"
            class="workbench-skeleton"
            :class="{ 'has-record-navigator': showRecordNavigator }"
            aria-label="数据加载中"
        >
            <aside v-if="showRecordNavigator"></aside><main><i v-for="index in 10" :key="index"></i></main>
        </div>

        <el-empty
            v-else-if="records.length === 0"
            class="workbench-empty"
            description="当前模块暂无可维护记录"
        >
            <el-button v-if="canAdd" type="primary" :icon="Plus" @click="$emit('open-form', null, 'Add')">新增第一条记录</el-button>
        </el-empty>

        <div v-else class="workbench-layout" :class="{ 'has-record-navigator': showRecordNavigator }">
            <aside v-if="showRecordNavigator" class="record-navigator">
                <div class="record-search">
                    <el-input v-model="keyword" clearable :prefix-icon="Search" placeholder="搜索当前页记录" />
                </div>
                <div class="record-list" role="listbox" aria-label="记录列表">
                    <button
                        v-for="record in filteredRecords"
                        :key="record.Id"
                        type="button"
                        class="record-item"
                        :class="{ active: selectedId === record.Id }"
                        :aria-selected="selectedId === record.Id"
                        @click="selectRecord(record.Id)"
                    >
                        <span class="record-mark">{{ recordInitial(record) }}</span>
                        <span class="record-copy">
                            <b>{{ recordLabel(record) }}</b>
                            <small>{{ recordSecondary(record) }}</small>
                        </span>
                        <el-icon><ArrowRight /></el-icon>
                    </button>
                </div>
                <div v-if="rowCount > pageSize" class="record-pagination">
                    <el-button text :disabled="pageIndex <= 1 || loading" @click="$emit('load-page', pageIndex - 1)">上一页</el-button>
                    <span>{{ pageIndex }} / {{ pageCount }}</span>
                    <el-button text :disabled="pageIndex >= pageCount || loading" @click="$emit('load-page', pageIndex + 1)">下一页</el-button>
                </div>
            </aside>

            <main class="form-workspace">
                <div class="form-workspace-head">
                    <div class="workspace-copy">
                        <span class="workspace-eyebrow">{{ workspaceEyebrow }}</span>
                        <h2>{{ recordLabel(selectedRecord) }}</h2>
                        <p>{{ workspaceDescription }}</p>
                    </div>
                    <div class="form-scope-actions">
                        <!-- 表单 V8 按钮显示在表单操作区。 -->
                        <el-button
                            v-for="action in visibleFormActions"
                            :key="`form:${actionKey(action)}`"
                            :type="actionType(action)"
                            :loading="actionLoading"
                            :disabled="action.Disabled === true"
                            @click="runAction(action, 'Form')"
                        >
                            <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                        </el-button>
                        <!-- ShowRow=true 的行按钮继续直接显示。 -->
                        <el-button
                            v-for="action in visibleRowOutsideActions"
                            :key="`row-out:${actionKey(action)}`"
                            :type="actionType(action)"
                            :loading="actionLoading"
                            :disabled="action.Disabled === true"
                            @click="runAction(action, 'Row')"
                        >
                            <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                        </el-button>
                        <!-- ShowRow=false 的行按钮只进入当前记录自己的“更多”。 -->
                        <el-dropdown v-if="visibleRowInsideActions.length" trigger="click">
                            <el-button>更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                            <template #dropdown>
                                <el-dropdown-menu>
                                    <el-dropdown-item
                                        v-for="action in visibleRowInsideActions"
                                        :key="`row-in:${actionKey(action)}`"
                                        :disabled="action.Disabled === true"
                                        @click="runAction(action, 'Row')"
                                    >
                                        <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                                    </el-dropdown-item>
                                </el-dropdown-menu>
                            </template>
                        </el-dropdown>
                        <el-tag effect="plain" type="success">{{ formMode === 'View' ? '查看模式' : '编辑模式' }}</el-tag>
                        <el-button
                            v-if="selectedId && canEdit && formMode !== 'View'"
                            type="primary"
                            :icon="Select"
                            :loading="saving"
                            @click="saveCurrent"
                        >{{ config.SaveText || '保存当前记录' }}</el-button>
                    </div>
                </div>
                <div class="form-field-toolbar">
                    <el-input
                        v-model="fieldKeyword"
                        clearable
                        :prefix-icon="Search"
                        placeholder="搜索字段名称、字段名或说明"
                        aria-label="搜索当前表单字段"
                    />
                    <span v-if="fieldKeyword" class="field-match-count">{{ matchingFieldCount }} 项匹配</span>
                    <el-button :icon="Refresh" :loading="loading" @click="refreshCurrentRecord">刷新当前记录</el-button>
                </div>
                <DiyForm
                    v-if="selectedId && tableId"
                    :key="`${tableId}:${selectedId}:${formMode}:${formRefreshVersion}`"
                    ref="formRef"
                    :TableId="tableId"
                    :TableName="tableName"
                    :SysMenuId="sysMenuId"
                    :TableRowId="selectedId"
                    :FormMode="formMode"
                    :LoadMode="'Workbench'"
                    :PresentationMode="presentation"
                    :PresentationConfig="resolvedPresentationConfig"
                    :CurrentTableData="records"
                    @CallbackFormSubmit="handleRequestedSubmit"
                    @CallbackSetFormData="handleFormData"
                    @CallbackRefreshTable="$emit('refresh')"
                />
            </main>
        </div>
    </section>
</template>

<script setup>
import { computed, defineAsyncComponent, ref, watch } from "vue";
import { ArrowDown, ArrowRight, List, MoreFilled, Plus, Refresh, Search, Select } from "@element-plus/icons-vue";

const DiyForm = defineAsyncComponent(() => import("@/views/form-engine/diy-form.vue"));

const props = defineProps({
    tableId: { type: String, default: "" },
    tableName: { type: String, default: "" },
    sysMenuId: { type: String, default: "" },
    rows: { type: Array, default: () => [] },
    fields: { type: Array, default: () => [] },
    config: { type: Object, default: () => ({}) },
    pageButtons: { type: Array, default: () => [] },
    batchButtons: { type: Array, default: () => [] },
    formButtons: { type: Array, default: () => [] },
    rowCount: { type: Number, default: 0 },
    pageIndex: { type: Number, default: 1 },
    pageSize: { type: Number, default: 15 },
    canAdd: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    actionLoading: { type: Boolean, default: false },
    initialRecordId: { type: String, default: "" }
});

const emit = defineEmits(["refresh", "switch-classic", "open-form", "run-action", "load-page", "record-change", "form-ready", "saved"]);
const selectedId = ref("");
const keyword = ref("");
const fieldKeyword = ref("");
const saving = ref(false);
const formRefreshVersion = ref(0);
const formRef = ref(null);
const currentForm = ref({});

const records = computed(() => (Array.isArray(props.rows) ? props.rows : []).filter((item) => item && item.Id));
const selector = computed(() => ({ Display: "Both", LabelFields: [], ...((props.config && props.config.RecordSelector) || {}) }));
const presentation = computed(() => String(props.config.Presentation || "ControlCenter"));
const isControlCenter = computed(() => ["controlcenter", "settingscenter"].includes(presentation.value.toLowerCase()));
const formMode = computed(() => props.canEdit ? String(props.config.Mode || "Edit") : "View");
const selectedRecord = computed(() => records.value.find((item) => item.Id === selectedId.value) || records.value[0] || {});
const showRecordNavigator = computed(() => selector.value.Display === "List" || (selector.value.Display === "Both" && !isControlCenter.value));
const pageCount = computed(() => Math.max(1, Math.ceil(Number(props.rowCount || 0) / Math.max(1, Number(props.pageSize || 15)))));
const filteredRecords = computed(() => {
    const value = keyword.value.trim().toLowerCase();
    if (!value) return records.value;
    return records.value.filter((record) => `${recordLabel(record)} ${recordSecondary(record)}`.toLowerCase().includes(value));
});
const visiblePageActions = computed(() => visibleActions(props.pageButtons));
const visibleBatchActions = computed(() => visibleActions(props.batchButtons));
const visibleFormActions = computed(() => visibleActions(props.formButtons));
const visibleRowOutsideActions = computed(() => visibleActions(selectedRecord.value?._RowMoreBtnsOut));
const visibleRowInsideActions = computed(() => visibleActions(selectedRecord.value?._RowMoreBtnsIn));
const workspaceEyebrow = computed(() => String(props.config.Eyebrow || "FORM WORKBENCH"));
const workspaceDescription = computed(() => String(props.config.Description || "集中维护当前记录的业务信息，原有字段事件、表单事件与权限规则保持不变。"));
const resolvedPresentationConfig = computed(() => ({
    ...(props.config || {}),
    FieldSearchKeyword: fieldKeyword.value
}));
const matchingFieldCount = computed(() => {
    const value = fieldKeyword.value.trim().toLowerCase();
    if (!value) return (Array.isArray(props.fields) ? props.fields : []).length;
    return (Array.isArray(props.fields) ? props.fields : []).filter((field) => [
        field?.Label,
        field?.Name,
        field?.AsName,
        field?.Description,
        field?.Component
    ].some((item) => String(item || "").toLowerCase().includes(value))).length;
});

watch(selectedId, (value, previous) => {
    if (!value || value === previous) return;
    currentForm.value = {};
    emit("record-change", value);
}, { flush: "post" });
watch(records, (value) => {
    if (value.some((item) => item.Id === selectedId.value)) return;
    const requested = props.initialRecordId && value.find((item) => item.Id === props.initialRecordId);
    selectedId.value = (requested || value[0] || {}).Id || "";
}, { immediate: true });
watch(() => props.initialRecordId, (value) => {
    if (value && records.value.some((item) => item.Id === value)) selectedId.value = value;
});

function visibleActions(source) {
    return (Array.isArray(source) ? source : []).filter((action) => action && Boolean(action.IsVisible));
}
function fieldValue(record, name) {
    if (!record || !name) return "";
    const value = record[name];
    if (value !== undefined && value !== null && value !== "") return String(value);
    const field = props.fields.find((item) => item && (item.Name === name || item.AsName === name));
    const alias = field && (field.AsName || field.Name);
    return alias && record[alias] !== undefined ? String(record[alias] || "") : "";
}
function configuredLabelFields() {
    const configured = Array.isArray(selector.value.LabelFields) ? selector.value.LabelFields : [];
    return configured.length ? configured : ["Name", "Title", "Label", "Key", "SysTitle", "PeizhiMC", "Account"];
}
function recordLabel(record) {
    if (!record) return "未选择记录";
    const values = configuredLabelFields().map((name) => fieldValue(record, name)).filter(Boolean);
    return values[0] || `记录 ${String(record.Id || "").slice(0, 8)}`;
}
function recordSecondary(record) {
    if (!record) return "";
    const values = configuredLabelFields().map((name) => fieldValue(record, name)).filter(Boolean);
    return values.slice(1, 3).join(" · ") || String(record.Id || "");
}
function recordInitial(record) {
    return recordLabel(record).trim().slice(0, 1).toUpperCase() || "#";
}
function actionKey(action) {
    return String(action && (action.Id || action.Key || action.Name || action.Label) || "action");
}
function actionLabel(action) {
    return String(action?.Name || action?.Label || "业务功能");
}
function actionIcon(action) {
    return action?.Icon || "far fa-check-circle";
}
function actionType(action) {
    return action?.BtnStyle || action?.Style || "primary";
}
function selectRecord(id) {
    selectedId.value = id;
}
function refreshCurrentRecord() {
    formRefreshVersion.value += 1;
    emit("refresh");
}
function runAction(action, scope) {
    let row = selectedRecord.value || {};
    if (scope === "Page") row = {};
    if (scope === "Form") row = Object.keys(currentForm.value || {}).length ? currentForm.value : selectedRecord.value;
    emit("run-action", action, row || {}, scope, selectedRecord.value || {});
}
function handleFormData(form) {
    currentForm.value = form || {};
    emit("form-ready", currentForm.value);
}
function handleRequestedSubmit(param) {
    saveCurrent(param || {});
}
async function saveCurrent(overrides = {}) {
    if (!formRef.value || saving.value || !selectedId.value || formMode.value === "View") return;
    saving.value = true;
    const formParam = {
        FormMode: formMode.value,
        TableRowId: selectedId.value,
        SavedType: "Update",
        ...overrides
    };
    try {
        await formRef.value.FormSubmit(formParam, (success, formData) => {
            if (!success) return;
            emit("saved", formData || currentForm.value);
            emit("refresh");
        });
    } finally {
        saving.value = false;
    }
}
</script>

<style scoped lang="scss">
.module-form-workbench {
    --workbench-accent: var(--mci-color-primary, var(--el-color-primary, #3478f6));
    --workbench-line: var(--mci-border-color, var(--el-border-color-lighter, #e7edf5));
    --workbench-soft: var(--mci-bg-soft, var(--el-fill-color-extra-light, #f5f8fc));
    padding: 8px;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}
.workbench-toolbar,
.workbench-record-select,
.workbench-actions,
.form-workspace-head,
.form-scope-actions,
.record-pagination { display: flex; align-items: center; }
.workbench-toolbar { justify-content: space-between; gap: 10px; padding: 2px 0 8px; border-bottom: 0; }
.workbench-record-select { min-width: 0; flex: 1; gap: 9px; }
.workbench-record-select :deep(.el-select) { width: min(460px, 50vw); }
.toolbar-label { color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; }
.record-count { padding: 3px 8px; border-radius: 999px; color: var(--workbench-accent); background: color-mix(in srgb, var(--workbench-accent) 9%, transparent); font-size: 11px; white-space: nowrap; }
.workbench-actions,.form-scope-actions { justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
.workbench-actions :deep(.el-button + .el-button),.form-scope-actions :deep(.el-button + .el-button) { margin-left: 0; }
.workbench-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 10px; }
.workbench-layout.has-record-navigator { grid-template-columns: 230px minmax(0, 1fr); }
.record-navigator { display: flex; min-height: 520px; flex-direction: column; padding: 8px; border: 1px solid color-mix(in srgb, var(--workbench-line) 58%, transparent); border-radius: 13px; background: color-mix(in srgb, var(--workbench-soft) 68%, transparent); }
.record-search { margin-bottom: 9px; }
.record-list { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 6px; overflow: auto; }
.record-item { display: flex; width: 100%; align-items: center; gap: 9px; padding: 9px; border: 1px solid transparent; border-radius: 11px; color: var(--el-text-color-regular); background: transparent; text-align: left; cursor: pointer; transition: .16s ease; }
.record-item:hover { border-color: color-mix(in srgb, var(--workbench-accent) 20%, var(--workbench-line)); background: var(--el-bg-color); }
.record-item.active { border-color: color-mix(in srgb, var(--workbench-accent) 30%, var(--workbench-line)); color: var(--workbench-accent); background: var(--el-bg-color); box-shadow: inset 3px 0 var(--workbench-accent), 0 2px 8px rgba(25, 48, 82, .035); }
.record-mark { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border-radius: 10px; color: var(--workbench-accent); background: color-mix(in srgb, var(--workbench-accent) 10%, transparent); font-weight: 750; }
.record-copy { min-width: 0; flex: 1; }
.record-copy b,.record-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-copy b { font-size: 12px; }
.record-copy small { margin-top: 3px; color: var(--el-text-color-secondary); font-size: 9px; }
.record-pagination { justify-content: space-between; gap: 4px; padding-top: 8px; color: var(--el-text-color-secondary); font-size: 10px; }
.form-workspace { min-width: 0; padding: 10px; border: 0; border-radius: 14px; background: transparent; }
.form-workspace-head { justify-content: space-between; gap: 14px; margin-bottom: 8px; padding: 2px 2px 6px; border-bottom: 0; }
.form-field-toolbar { display: flex; align-items: center; gap: 8px; margin: 0 2px 10px; padding: 8px; border: 1px solid color-mix(in srgb, var(--workbench-line) 64%, transparent); border-radius: 12px; background: color-mix(in srgb, var(--workbench-soft) 55%, transparent); }
.form-field-toolbar :deep(.el-input) { min-width: 220px; flex: 1; }
.field-match-count { color: var(--el-text-color-secondary); font-size: 11px; white-space: nowrap; }
.workspace-copy { min-width: 240px; flex: 1; }
.form-workspace-head h2 { margin: 3px 0 0; color: var(--el-text-color-primary); font-size: 18px; line-height: 25px; }
.form-workspace-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 17px; }
.workspace-eyebrow { color: var(--workbench-accent); font-size: 9px; font-weight: 800; letter-spacing: 1.4px; }
.workbench-empty { min-height: 420px; }
.workbench-skeleton { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 10px; }
.workbench-skeleton.has-record-navigator { grid-template-columns: 230px minmax(0, 1fr); }
.workbench-skeleton aside,.workbench-skeleton main { min-height: 520px; border-radius: 15px; background: linear-gradient(90deg, var(--workbench-soft), var(--el-bg-color), var(--workbench-soft)); background-size: 220% 100%; animation: workbench-shimmer 1.2s infinite; }
.workbench-skeleton main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 12px; padding: 26px 18px 18px; overflow: hidden; }
.workbench-skeleton i { height: 58px; border-radius: 10px; background: color-mix(in srgb, var(--el-bg-color) 58%, transparent); }
.action-icon { margin-right: 6px; }
@keyframes workbench-shimmer { to { background-position: -220% 0; } }
@media (max-width: 1100px) {
    .workbench-toolbar,.form-workspace-head { align-items: stretch; flex-direction: column; }
    .workbench-actions,.form-scope-actions { justify-content: flex-start; }
}
@media (max-width: 900px) {
    .workbench-record-select :deep(.el-select) { width: 100%; }
    .workbench-layout,.workbench-layout.has-record-navigator { grid-template-columns: 1fr; }
    .workbench-skeleton,.workbench-skeleton.has-record-navigator { grid-template-columns: 1fr; }
    .workbench-skeleton aside { display: none; }
    .record-navigator { min-height: auto; }
    .record-list { max-height: 240px; }
}
@media (max-width: 620px) {
    .module-form-workbench { padding: 4px; border-radius: 0; }
    .workbench-record-select { align-items: stretch; flex-direction: column; }
    .toolbar-label { display: none; }
    .workbench-actions,.form-scope-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .workbench-actions :deep(.el-button),.workbench-actions :deep(.el-dropdown),.workbench-actions :deep(.el-dropdown .el-button),
    .form-scope-actions :deep(.el-button),.form-scope-actions :deep(.el-dropdown),.form-scope-actions :deep(.el-dropdown .el-button) { width: 100%; }
    .form-workspace { padding: 6px; }
    .form-workspace-head p { display: none; }
    .form-field-toolbar { align-items: stretch; flex-direction: column; }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
