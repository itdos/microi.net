<template>
    <section class="module-form-workbench" :class="`is-${presentation.toLowerCase()}`">
        <header class="workbench-toolbar">
            <div v-if="selector.Display !== 'List'" class="workbench-record-select">
                <span class="toolbar-label">当前记录</span>
                <el-select
                    v-model="selectedId"
                    filterable
                    :disabled="records.length === 0"
                    :placeholder="selector.Placeholder || '请选择要维护的数据'"
                    @change="handleRecordChange"
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
            <div class="workbench-actions">
                <el-button :icon="Refresh" :loading="loading" @click="$emit('refresh')">刷新</el-button>
                <el-button v-if="config.ShowClassicList !== false" :icon="List" @click="$emit('switch-classic')">经典表格</el-button>
                <el-button v-if="canAdd" :icon="Plus" @click="$emit('open-form', null, 'Add')">新增记录</el-button>
                <el-dropdown v-if="dynamicActions.length" trigger="click">
                    <el-button :icon="MoreFilled">业务功能<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                        <el-dropdown-menu>
                            <el-dropdown-item
                                v-for="action in dynamicActions"
                                :key="actionKey(action)"
                                :disabled="action.Disabled === true"
                                @click="$emit('run-action', action, actionRow(action))"
                            >
                                <fa-icon v-if="action.Icon" :icon="action.Icon" class="action-icon" />
                                {{ action.Name || action.Label || '业务功能' }}
                            </el-dropdown-item>
                        </el-dropdown-menu>
                    </template>
                </el-dropdown>
                <el-button
                    v-if="selectedId && canEdit && formMode !== 'View'"
                    type="primary"
                    :icon="Select"
                    :loading="saving"
                    @click="saveCurrent"
                >保存当前设置</el-button>
            </div>
        </header>

        <div v-if="loading && records.length === 0" class="workbench-skeleton" aria-label="数据加载中">
            <aside></aside><main><i v-for="index in 8" :key="index"></i></main>
        </div>

        <el-empty
            v-else-if="records.length === 0"
            class="workbench-empty"
            description="当前模块暂无可维护记录"
        >
            <el-button v-if="canAdd" type="primary" :icon="Plus" @click="$emit('open-form', null, 'Add')">新增第一条记录</el-button>
        </el-empty>

        <div v-else class="workbench-layout">
            <aside v-if="selector.Display !== 'Dropdown'" class="record-navigator">
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
                    <div>
                        <span class="workspace-eyebrow">FORM WORKBENCH</span>
                        <h2>{{ recordLabel(selectedRecord) }}</h2>
                        <p>这里使用原表单引擎加载、校验和提交；字段事件、表单事件及服务端 V8 均保持原执行链。</p>
                    </div>
                    <el-tag effect="plain" type="success">{{ formMode === 'View' ? '查看模式' : '编辑模式' }}</el-tag>
                </div>
                <DiyForm
                    v-if="selectedId && tableId"
                    :key="`${tableId}:${selectedId}:${formMode}`"
                    ref="formRef"
                    :TableId="tableId"
                    :TableName="tableName"
                    :SysMenuId="sysMenuId"
                    :TableRowId="selectedId"
                    :FormMode="formMode"
                    :LoadMode="'Workbench'"
                    :PresentationMode="presentation"
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
    formButtons: { type: Array, default: () => [] },
    rowCount: { type: Number, default: 0 },
    pageIndex: { type: Number, default: 1 },
    pageSize: { type: Number, default: 15 },
    canAdd: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    initialRecordId: { type: String, default: "" }
});

const emit = defineEmits(["refresh", "switch-classic", "open-form", "run-action", "load-page", "record-change", "form-ready", "saved"]);
const selectedId = ref("");
const keyword = ref("");
const saving = ref(false);
const formRef = ref(null);
const currentForm = ref({});

const records = computed(() => (Array.isArray(props.rows) ? props.rows : []).filter((item) => item && item.Id));
const selector = computed(() => ({ Display: "Both", LabelFields: [], ...((props.config && props.config.RecordSelector) || {}) }));
const presentation = computed(() => String(props.config.Presentation || "SettingsCenter"));
const formMode = computed(() => props.canEdit ? String(props.config.Mode || "Edit") : "View");
const selectedRecord = computed(() => records.value.find((item) => item.Id === selectedId.value) || records.value[0] || {});
const pageCount = computed(() => Math.max(1, Math.ceil(Number(props.rowCount || 0) / Math.max(1, Number(props.pageSize || 15)))));
const filteredRecords = computed(() => {
    const value = keyword.value.trim().toLowerCase();
    if (!value) return records.value;
    return records.value.filter((record) => `${recordLabel(record)} ${recordSecondary(record)}`.toLowerCase().includes(value));
});
const dynamicActions = computed(() => {
    const current = selectedRecord.value || {};
    const source = [
        ...(Array.isArray(props.pageButtons) ? props.pageButtons.map((action) => ({ ...action, _WorkbenchScope: "Page" })) : []),
        ...(Array.isArray(props.formButtons) ? props.formButtons.map((action) => ({ ...action, _WorkbenchScope: "Form" })) : []),
        ...(Array.isArray(current._RowMoreBtnsOut) ? current._RowMoreBtnsOut.map((action) => ({ ...action, _WorkbenchScope: "Row" })) : []),
        ...(Array.isArray(current._RowMoreBtnsIn) ? current._RowMoreBtnsIn.map((action) => ({ ...action, _WorkbenchScope: "Row" })) : [])
    ];
    const seen = new Set();
    return source.filter((action, index) => {
        if (!action || action.IsVisible === false || action.IsVisible === 0) return false;
        const key = actionKey(action, index);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
});

watch(records, (value) => {
    if (value.some((item) => item.Id === selectedId.value)) return;
    const requested = props.initialRecordId && value.find((item) => item.Id === props.initialRecordId);
    selectedId.value = (requested || value[0] || {}).Id || "";
}, { immediate: true });
watch(() => props.initialRecordId, (value) => {
    if (value && records.value.some((item) => item.Id === value)) selectedId.value = value;
});

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
    const secondary = values.slice(1, 3).join(" · ");
    return secondary || String(record.Id || "");
}
function recordInitial(record) {
    return recordLabel(record).trim().slice(0, 1).toUpperCase() || "#";
}
function actionKey(action, index = 0) {
    return String(action && (action.Id || action.Key || action.Name || action.Label) || `action:${index}`);
}
function actionRow(action) {
    if (action?._WorkbenchScope === "Page") return {};
    if (action?._WorkbenchScope === "Form") {
        return formRef.value?.FormDiyTableModel || currentForm.value || selectedRecord.value;
    }
    return selectedRecord.value;
}
function selectRecord(id) {
    selectedId.value = id;
    handleRecordChange(id);
}
function handleRecordChange(id) {
    currentForm.value = {};
    emit("record-change", id);
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
    --workbench-accent: var(--el-color-primary, #3478f6);
    --workbench-line: var(--el-border-color-lighter, #e7edf5);
    --workbench-soft: var(--el-fill-color-extra-light, #f5f8fc);
    padding: 14px;
    border: 1px solid var(--workbench-line);
    border-radius: 18px;
    background: var(--el-bg-color, #fff);
    box-shadow: 0 14px 42px rgba(25, 48, 82, .06);
}
.workbench-toolbar,
.workbench-record-select,
.workbench-actions,
.form-workspace-head,
.record-pagination { display: flex; align-items: center; }
.workbench-toolbar { justify-content: space-between; gap: 12px; padding-bottom: 13px; border-bottom: 1px solid var(--workbench-line); }
.workbench-record-select { min-width: 0; flex: 1; gap: 9px; }
.workbench-record-select :deep(.el-select) { width: min(460px, 50vw); }
.toolbar-label { color: var(--el-text-color-secondary); font-size: 12px; white-space: nowrap; }
.record-count { padding: 3px 8px; border-radius: 999px; color: var(--workbench-accent); background: color-mix(in srgb, var(--workbench-accent) 9%, transparent); font-size: 11px; white-space: nowrap; }
.workbench-actions { justify-content: flex-end; gap: 7px; flex-wrap: wrap; }
.workbench-actions :deep(.el-button + .el-button) { margin-left: 0; }
.workbench-layout { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 14px; margin-top: 14px; }
.record-navigator { display: flex; min-height: 520px; flex-direction: column; padding: 10px; border: 1px solid var(--workbench-line); border-radius: 15px; background: var(--workbench-soft); }
.record-search { margin-bottom: 9px; }
.record-list { display: flex; min-height: 0; flex: 1; flex-direction: column; gap: 6px; overflow: auto; }
.record-item { display: flex; width: 100%; align-items: center; gap: 9px; padding: 9px; border: 1px solid transparent; border-radius: 11px; color: var(--el-text-color-regular); background: transparent; text-align: left; cursor: pointer; transition: .16s ease; }
.record-item:hover { border-color: color-mix(in srgb, var(--workbench-accent) 20%, var(--workbench-line)); background: var(--el-bg-color); }
.record-item.active { border-color: color-mix(in srgb, var(--workbench-accent) 34%, var(--workbench-line)); color: var(--workbench-accent); background: var(--el-bg-color); box-shadow: inset 3px 0 var(--workbench-accent), 0 8px 18px rgba(25, 48, 82, .06); }
.record-mark { display: grid; width: 32px; height: 32px; flex: 0 0 32px; place-items: center; border-radius: 10px; color: var(--workbench-accent); background: color-mix(in srgb, var(--workbench-accent) 10%, transparent); font-weight: 750; }
.record-copy { min-width: 0; flex: 1; }
.record-copy b,.record-copy small { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.record-copy b { font-size: 12px; }
.record-copy small { margin-top: 3px; color: var(--el-text-color-secondary); font-size: 9px; }
.record-pagination { justify-content: space-between; gap: 4px; padding-top: 8px; color: var(--el-text-color-secondary); font-size: 10px; }
.form-workspace { min-width: 0; padding: 15px; border: 1px solid var(--workbench-line); border-radius: 15px; background: var(--el-bg-color); }
.form-workspace-head { justify-content: space-between; gap: 16px; margin-bottom: 12px; padding: 2px 2px 12px; border-bottom: 1px solid var(--workbench-line); }
.form-workspace-head h2 { margin: 3px 0 0; font-size: 18px; line-height: 25px; }
.form-workspace-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); font-size: 11px; line-height: 17px; }
.workspace-eyebrow { color: var(--workbench-accent); font-size: 9px; font-weight: 800; letter-spacing: 1.4px; }
.workbench-empty { min-height: 420px; }
.workbench-skeleton { display: grid; grid-template-columns: 230px 1fr; gap: 14px; margin-top: 14px; }
.workbench-skeleton aside,.workbench-skeleton main { min-height: 520px; border-radius: 15px; background: linear-gradient(90deg, var(--workbench-soft), var(--el-bg-color), var(--workbench-soft)); background-size: 220% 100%; animation: workbench-shimmer 1.2s infinite; }
.workbench-skeleton main { display: grid; grid-template-columns: 1fr 1fr; align-content: start; gap: 12px; padding: 64px 18px 18px; }
.workbench-skeleton i { height: 58px; border-radius: 10px; background: rgba(255,255,255,.58); }
.action-icon { margin-right: 6px; }
@keyframes workbench-shimmer { to { background-position: -220% 0; } }
@media (max-width: 900px) {
    .workbench-toolbar { align-items: stretch; flex-direction: column; }
    .workbench-record-select :deep(.el-select) { width: 100%; }
    .workbench-layout { grid-template-columns: 1fr; }
    .record-navigator { min-height: auto; }
    .record-list { max-height: 240px; }
}
@media (max-width: 620px) {
    .module-form-workbench { padding: 9px; border-radius: 12px; }
    .workbench-record-select { align-items: stretch; flex-direction: column; }
    .toolbar-label { display: none; }
    .workbench-actions { display: grid; grid-template-columns: repeat(2, 1fr); }
    .workbench-actions :deep(.el-button),.workbench-actions :deep(.el-dropdown),.workbench-actions :deep(.el-dropdown .el-button) { width: 100%; }
    .form-workspace { padding: 10px; }
    .form-workspace-head p { display: none; }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
