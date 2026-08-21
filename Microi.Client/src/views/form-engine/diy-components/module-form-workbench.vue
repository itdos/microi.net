<template>
    <section
        class="module-form-workbench"
        :class="[`is-${presentation.toLowerCase()}`, { 'is-control-center': isControlCenter }]"
    >
        <div
            v-if="loading && records.length === 0"
            class="workbench-skeleton"
            :class="{ 'has-record-navigator': showRecordNavigator }"
            aria-label="数据加载中"
        >
            <aside v-if="showRecordNavigator"></aside><main><i v-for="index in 10" :key="index"></i></main>
        </div>

        <el-empty
            v-else-if="recordOptions.length === 0"
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
                        :key="recordId(record)"
                        type="button"
                        class="record-item"
                        :class="{ active: selectedId === recordId(record) }"
                        :aria-selected="selectedId === recordId(record)"
                        @click="selectRecord(recordId(record))"
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
                <DiyFormFull
                    v-if="selectedId && tableId"
                    :key="tableId"
                    ref="embeddedFormRef"
                    :EmbeddedHeader="embeddedHeader"
                    :EmbeddedRecordNavigator="embeddedRecordNavigator"
                    @CallbackSetFormData="handleFormData"
                    @CallbackGetDiyTableRow="handleEmbeddedRefresh"
                    @WorkspaceRecordChange="selectRecord"
                >
                    <template #workspace-actions>
                        <el-button
                            v-for="action in visiblePageActions"
                            :key="`page:${actionKey(action)}`"
                            :type="actionType(action)"
                            size="small"
                            :loading="actionLoading"
                            :disabled="action.Disabled === true"
                            @click="runAction(action, 'Page')"
                        >
                            <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                        </el-button>
                        <el-button
                            v-for="action in visibleBatchActions"
                            :key="`batch:${actionKey(action)}`"
                            :type="actionType(action)"
                            size="small"
                            :loading="actionLoading"
                            :disabled="!selectedId || action.Disabled === true"
                            @click="runAction(action, 'Batch')"
                        >
                            <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                        </el-button>
                        <el-button
                            v-for="action in visibleRowOutsideActions"
                            :key="`row-out:${actionKey(action)}`"
                            :type="actionType(action)"
                            size="small"
                            :loading="actionLoading"
                            :disabled="!selectedId || action.Disabled === true"
                            @click="runAction(action, 'Row')"
                        >
                            <fa-icon :icon="actionIcon(action)" class="action-icon" />{{ actionLabel(action) }}
                        </el-button>
                        <el-dropdown v-if="visibleRowInsideActions.length" trigger="click" size="small">
                            <el-button :icon="MoreFilled" size="small">更多业务<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
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
                        <el-button v-if="canAdd" :icon="Plus" size="small" @click="$emit('open-form', null, 'Add')">新增记录</el-button>
                    </template>
                </DiyFormFull>
            </main>
        </div>
    </section>
</template>

<script setup>
import { computed, defineAsyncComponent, nextTick, ref, watch } from "vue";
import { ArrowDown, ArrowRight, MoreFilled, Plus, Search } from "@element-plus/icons-vue";

const DiyFormFull = defineAsyncComponent(() => import("@/views/form-engine/diy-form-full.vue"));

const props = defineProps({
    tableId: { type: String, default: "" },
    tableName: { type: String, default: "" },
    sysMenuId: { type: String, default: "" },
    rows: { type: Array, default: () => [] },
    fields: { type: Array, default: () => [] },
    config: { type: Object, default: () => ({}) },
    titleIcon: { type: String, default: "" },
    pageButtons: { type: Array, default: () => [] },
    batchButtons: { type: Array, default: () => [] },
    rowCount: { type: Number, default: 0 },
    pageIndex: { type: Number, default: 1 },
    pageSize: { type: Number, default: 15 },
    canAdd: { type: Boolean, default: false },
    canEdit: { type: Boolean, default: false },
    loading: { type: Boolean, default: false },
    actionLoading: { type: Boolean, default: false },
    initialRecordId: { type: String, default: "" }
});

const emit = defineEmits(["refresh", "open-form", "run-action", "load-page", "record-change", "form-ready"]);
const selectedId = ref("");
const keyword = ref("");
const embeddedFormRef = ref(null);
const currentForm = ref({});
const lastEmbeddedSignature = ref("");
let lastEmbeddedFormInstance = null;
const embeddedCurrentForm = computed(() => {
    const row = embeddedFormRef.value?.CurrentRowModel;
    return row && Object.keys(row).length ? row : currentForm.value;
});

const records = computed(() => (Array.isArray(props.rows) ? props.rows : []).filter((item) => item && item.Id));
const recordOptions = computed(() => {
    const result = [...records.value];
    const currentId = recordId(embeddedCurrentForm.value);
    if (currentId === selectedId.value && !result.some((item) => recordId(item) === currentId)) {
        result.unshift(embeddedCurrentForm.value);
    } else if (selectedId.value && !result.some((item) => recordId(item) === selectedId.value)) {
        result.unshift({ Id: selectedId.value });
    }
    return result;
});
const selector = computed(() => ({ Display: "Both", LabelFields: [], ...((props.config && props.config.RecordSelector) || {}) }));
const presentation = computed(() => String(props.config.Presentation || "ControlCenter"));
const isControlCenter = computed(() => ["controlcenter", "settingscenter"].includes(presentation.value.toLowerCase()));
const formMode = computed(() => props.canEdit ? String(props.config.Mode || "Edit") : "View");
const selectedRecord = computed(() => {
    const listRecord = records.value.find((item) => recordId(item) === selectedId.value);
    if (recordId(embeddedCurrentForm.value) === selectedId.value) {
        return { ...(listRecord || {}), ...(embeddedCurrentForm.value || {}) };
    }
    return listRecord || (selectedId.value ? { Id: selectedId.value } : {});
});
const showRecordNavigator = computed(() => selector.value.Display === "List" || (selector.value.Display === "Both" && !isControlCenter.value));
const pageCount = computed(() => Math.max(1, Math.ceil(Number(props.rowCount || 0) / Math.max(1, Number(props.pageSize || 15)))));
const filteredRecords = computed(() => {
    const value = keyword.value.trim().toLowerCase();
    if (!value) return recordOptions.value;
    return recordOptions.value.filter((record) => `${recordLabel(record)} ${recordSecondary(record)}`.toLowerCase().includes(value));
});
const visiblePageActions = computed(() => visibleActions(props.pageButtons));
const visibleBatchActions = computed(() => visibleActions(props.batchButtons));
const visibleRowOutsideActions = computed(() => visibleActions(selectedRecord.value?._RowMoreBtnsOut));
const visibleRowInsideActions = computed(() => visibleActions(selectedRecord.value?._RowMoreBtnsIn));
const workspaceEyebrow = computed(() => String(props.config.Eyebrow || "FORM WORKBENCH"));
const workspaceDescription = computed(() => String(props.config.Description || "集中维护当前记录的业务信息，原有字段事件、表单事件与权限规则保持不变。"));
const embeddedHeader = computed(() => ({
    Eyebrow: workspaceEyebrow.value,
    Title: recordLabel(selectedRecord.value),
    Description: workspaceDescription.value,
    Icon: props.titleIcon || props.config.Icon || props.config.TitleIcon || "fas fa-sliders-h"
}));
const embeddedRecordNavigator = computed(() => ({
    Enabled: selector.value.Display !== "List",
    Rows: recordOptions.value,
    RowCount: props.rowCount,
    LabelFields: configuredLabelFields(),
    Placeholder: selector.value.Placeholder || "搜索并切换记录"
}));

watch(selectedId, (value, previous) => {
    if (!value || value === previous) return;
    currentForm.value = {};
    emit("record-change", value);
}, { flush: "post" });
watch(records, (value) => {
    const requested = String(props.initialRecordId || "").trim();
    if (requested) {
        if (selectedId.value !== requested) selectedId.value = requested;
        return;
    }
    if (value.some((item) => recordId(item) === selectedId.value)) return;
    selectedId.value = value.length ? recordId(value[0]) : "";
}, { immediate: true });
watch(() => props.initialRecordId, (value) => {
    const requested = String(value || "").trim();
    if (requested) {
        if (selectedId.value !== requested) selectedId.value = requested;
        return;
    }
    if (!records.value.some((item) => recordId(item) === selectedId.value)) {
        selectedId.value = records.value.length ? recordId(records.value[0]) : "";
    }
});
watch(
    [embeddedFormRef, selectedId, () => props.tableId, () => props.tableName, () => props.sysMenuId, formMode, presentation, () => props.config],
    initializeEmbeddedForm,
    { immediate: true, flush: "post", deep: true }
);

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
function recordId(record) {
    return String(record?.Id || "").trim();
}
function configuredLabelFields() {
    const configured = Array.isArray(selector.value.LabelFields) ? selector.value.LabelFields : [];
    return configured.length ? configured : ["Name", "ApiName", "Title", "Label", "PeizhiMC", "SysTitle", "Key", "Account"];
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
async function selectRecord(id) {
    const nextId = String(id || "").trim();
    if (!nextId || nextId === selectedId.value) return;

    // 左侧记录列表与表单头部选择器共用同一条切换链，确保编辑态先经过
    // DiyFormFull 的未保存确认；WorkspaceRecordChange 回调再次进入时，
    // TableRowId 已提交为 nextId，此处只同步宿主 selectedId 和 URL。
    const form = embeddedFormRef.value;
    const activeFormId = String(form?.TableRowId || "").trim();
    if (form && typeof form.SwitchWorkspaceRecord === "function" && activeFormId !== nextId) {
        await form.SwitchWorkspaceRecord(nextId);
        return;
    }
    selectedId.value = nextId;
}
function runAction(action, scope) {
    let row = selectedRecord.value || {};
    if (scope === "Page") row = {};
    emit("run-action", action, row || {}, scope, selectedRecord.value || {});
}
function handleFormData(form) {
    currentForm.value = form || {};
    emit("form-ready", currentForm.value);
}
function handleEmbeddedRefresh() {
    emit("refresh");
}
function stableConfigKey() {
    try {
        return JSON.stringify(props.config || {});
    } catch (_error) {
        return presentation.value;
    }
}
async function initializeEmbeddedForm() {
    await nextTick();
    const form = embeddedFormRef.value;
    if (!form || typeof form.Init !== "function" || !selectedId.value || !props.tableId) {
        if (!form) {
            lastEmbeddedFormInstance = null;
            lastEmbeddedSignature.value = "";
        }
        return;
    }
    // v-if 卸载后可能重新出现相同 tableId/recordId；签名相同不代表还是
    // 已完成 Init 的那个组件实例，新实例必须重新初始化。
    if (lastEmbeddedFormInstance !== form) {
        lastEmbeddedFormInstance = form;
        lastEmbeddedSignature.value = "";
    }
    const signature = [
        props.tableId,
        props.tableName,
        props.sysMenuId,
        selectedId.value,
        formMode.value,
        presentation.value,
        stableConfigKey()
    ].join("|");
    if (lastEmbeddedSignature.value === signature) return;
    lastEmbeddedSignature.value = signature;
    form.Init({
        TableId: props.tableId,
        TableName: props.tableName,
        SysMenuId: props.sysMenuId,
        Id: selectedId.value,
        FormMode: formMode.value,
        DialogType: "Embedded",
        PresentationMode: presentation.value,
        PresentationConfig: props.config || {},
        RecordNavigator: embeddedRecordNavigator.value
    });
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
.record-pagination { display: flex; align-items: center; }
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
.form-workspace { min-width: 0; padding: 0; border: 0; border-radius: 14px; background: transparent; }
.workbench-empty { min-height: 420px; }
.workbench-skeleton { display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 10px; }
.workbench-skeleton.has-record-navigator { grid-template-columns: 230px minmax(0, 1fr); }
.workbench-skeleton aside,.workbench-skeleton main { min-height: 520px; border-radius: 15px; background: linear-gradient(90deg, var(--workbench-soft), var(--el-bg-color), var(--workbench-soft)); background-size: 220% 100%; animation: workbench-shimmer 1.2s infinite; }
.workbench-skeleton main { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 12px; padding: 26px 18px 18px; overflow: hidden; }
.workbench-skeleton i { height: 58px; border-radius: 10px; background: color-mix(in srgb, var(--el-bg-color) 58%, transparent); }
.action-icon { margin-right: 6px; }
@keyframes workbench-shimmer { to { background-position: -220% 0; } }
@media (max-width: 900px) {
    .workbench-layout,.workbench-layout.has-record-navigator { grid-template-columns: 1fr; }
    .workbench-skeleton,.workbench-skeleton.has-record-navigator { grid-template-columns: 1fr; }
    .workbench-skeleton aside { display: none; }
    .record-navigator { min-height: auto; }
    .record-list { max-height: 240px; }
}
@media (max-width: 620px) {
    .module-form-workbench { padding: 4px; border-radius: 0; }
    .form-workspace { padding: 6px; }
}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; transition: none !important; } }
</style>
