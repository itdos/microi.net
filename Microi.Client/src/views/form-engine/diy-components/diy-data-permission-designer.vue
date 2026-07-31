<template>
    <div class="data-permission-designer" v-loading="loading">
        <div class="designer-head">
            <div>
                <div class="designer-title">数据权限设计器</div>
                <div class="designer-subtitle">选择权限范围和关联关系即可，系统会实时生成并同步数据权限。</div>
                <div class="designer-table-context">
                    <el-tag v-if="mainTableName" type="success" effect="plain">当前绑定表：{{ mainTableName }}</el-tag>
                    <el-tag v-else type="danger" effect="plain">尚未识别当前模块绑定表</el-tag>
                    <span v-if="mainTableId" class="form-tip">{{ mainTableId }}</span>
                </div>
            </div>
            <el-tag :type="syncStateType" effect="plain">{{ syncStateText }}</el-tag>
        </div>

        <el-alert
            v-if="legacyMode"
            class="designer-alert"
            type="warning"
            :closable="false"
            show-icon
            title="已载入历史手写条件，右侧 SQL 已原样保留；调整左侧图形配置后会按新配置重新生成。"
        />

        <el-alert
            class="designer-alert"
            type="info"
            :closable="false"
            show-icon
            title="使用方法：选择普通用户能看哪些数据，再按需设置可看全部数据的角色、岗位或部门。"
            description="左侧修改会实时生成右侧 SQL；右侧也可随时手写。所有修改都会自动同步，配置完成后直接保存模块即可。"
        />

        <el-tabs v-model="activeTab" class="designer-tabs">
            <el-tab-pane label="可见范围" name="scope" lazy>
                <div class="visual-preview-layout scope-layout">
                    <div class="visual-config-column">
                        <div class="scope-grid">
                            <section class="permission-card permission-card--accent">
                        <div class="card-title">基础保护</div>
                        <el-form label-position="top">
                            <el-form-item label="超级管理员查看全部">
                                <div class="inline-control">
                                    <el-switch v-model="config.superAdminAll" :disabled="readonly" @change="markDirty" />
                                    <el-input-number
                                        v-if="config.superAdminAll"
                                        v-model="config.superAdminLevel"
                                        :min="1"
                                        :max="999999"
                                        :disabled="readonly"
                                        controls-position="right"
                                        @change="markDirty"
                                    />
                                    <span class="control-tip">当前用户 Level 达到该值时放行，默认 9999。</span>
                                </div>
                            </el-form-item>
                            <el-form-item label="租户隔离">
                                <div class="inline-control">
                                    <el-switch v-model="config.tenantIsolation" :disabled="readonly" @change="markDirty" />
                                    <el-select
                                        v-if="config.tenantIsolation"
                                        v-model="config.tenantField"
                                        filterable
                                        allow-create
                                        default-first-option
                                        :disabled="readonly"
                                        placeholder="业务表租户字段"
                                        @change="markDirty"
                                    >
                                        <el-option v-for="field in mainFields" :key="field.Name" :label="fieldLabel(field)" :value="field.Name" />
                                    </el-select>
                                    <span class="control-tip">条件始终限制在 $CurrentUser.TenantId$，超级管理员也不会跨租户。</span>
                                </div>
                            </el-form-item>
                        </el-form>
                            </section>

                            <section class="permission-card">
                        <div class="card-title">普通用户的数据范围</div>
                        <el-radio-group v-model="config.scopeMode" :disabled="readonly" class="scope-mode" @change="onScopeModeChange">
                            <el-radio-button value="all">全部数据</el-radio-button>
                            <el-radio-button value="self">仅本人</el-radio-button>
                            <el-radio-button value="selfAndSubordinates">本人和下级</el-radio-button>
                            <el-radio-button value="department">本部门</el-radio-button>
                            <el-radio-button value="departmentAndSubDepartments">本部门和下级部门</el-radio-button>
                            <el-radio-button value="custom">仅高级条件</el-radio-button>
                        </el-radio-group>

                        <div v-if="needsOwnerField" class="field-setting-row">
                            <span>数据负责人字段</span>
                            <el-select v-model="config.ownerField" filterable allow-create :disabled="readonly" placeholder="如 UserId" @change="markDirty">
                                <el-option v-for="field in mainFields" :key="field.Name" :label="fieldLabel(field)" :value="field.Name" />
                            </el-select>
                        </div>
                        <div v-if="needsDepartmentField" class="field-setting-row">
                            <span>数据所属部门字段</span>
                            <el-select v-model="config.departmentField" filterable allow-create :disabled="readonly" placeholder="如 DeptId" @change="markDirty">
                                <el-option v-for="field in mainFields" :key="field.Name" :label="fieldLabel(field)" :value="field.Name" />
                            </el-select>
                        </div>
                        <div v-if="needsOwnerJoin" class="field-setting-row">
                            <span>用户表层级字段</span>
                            <el-input v-model="config.userLevelField" :disabled="readonly" placeholder="Level" @input="markDirty" />
                            <el-input v-model="config.userDeptIdsField" :disabled="readonly" placeholder="DeptIds" @input="markDirty" />
                        </div>
                            </section>

                            <section class="permission-card">
                        <div class="card-title">可查看全部数据的角色 / 岗位</div>
                        <el-form label-position="top">
                            <el-form-item label="角色">
                                <el-select
                                    v-model="config.fullAccessRoleIds"
                                    multiple
                                    filterable
                                    remote
                                    reserve-keyword
                                    collapse-tags
                                    :remote-method="searchRolesRemote"
                                    :loading="roleSearchLoading"
                                    :disabled="readonly"
                                    placeholder="搜索并选择角色"
                                    @visible-change="onRoleSelectVisible"
                                    @change="markDirty"
                                >
                                    <el-option v-for="role in normalRoles" :key="role.Id" :label="role.Name" :value="role.Id" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="岗位">
                                <el-select
                                    v-model="config.fullAccessPostIds"
                                    multiple
                                    filterable
                                    remote
                                    reserve-keyword
                                    collapse-tags
                                    :remote-method="searchRolesRemote"
                                    :loading="roleSearchLoading"
                                    :disabled="readonly"
                                    placeholder="搜索并选择岗位角色"
                                    @visible-change="onRoleSelectVisible"
                                    @change="markDirty"
                                >
                                    <el-option v-for="role in postRoles" :key="role.Id" :label="role.Name" :value="role.Id" />
                                </el-select>
                                <div class="form-tip">吾码岗位沿用岗位角色数据；若租户没有区分角色类型，这里仍可选择全部角色。</div>
                            </el-form-item>
                        </el-form>
                            </section>

                            <section class="permission-card">
                        <div class="card-title">可查看全部数据的部门</div>
                        <el-select
                            v-model="config.fullAccessDeptIds"
                            multiple
                            filterable
                            remote
                            reserve-keyword
                            collapse-tags
                            :remote-method="searchDepartmentsRemote"
                            :loading="departmentSearchLoading"
                            :disabled="readonly"
                            placeholder="搜索部门（包含其下级部门）"
                            @visible-change="onDepartmentSelectVisible"
                            @change="markDirty"
                        >
                            <el-option v-for="dept in departments" :key="dept.Id" :label="dept.Name" :value="dept.Id" />
                        </el-select>
                        <div class="form-tip">按当前用户 DeptIds 判断；选中父部门后，该部门及其下级部门用户均可放行。</div>
                            </section>
                        </div>

                        <section class="permission-card advanced-card">
                    <div class="card-title-row">
                        <div>
                            <div class="card-title">高级图形条件</div>
                            <div class="form-tip">用于补充“负责人、协作人、转交人”等规则；条件值可来自当前用户或固定值。</div>
                        </div>
                        <div class="advanced-actions">
                            <el-select v-model="config.ruleMatch" :disabled="readonly" @change="markDirty">
                                <el-option label="满足任一条件（OR）" value="any" />
                                <el-option label="满足全部条件（AND）" value="all" />
                            </el-select>
                            <el-button :icon="Plus" :disabled="readonly" @click="addRule">添加条件</el-button>
                        </div>
                    </div>
                    <el-empty v-if="config.rules.length === 0" description="尚未添加高级条件" :image-size="60" />
                    <div v-for="(rule, index) in config.rules" :key="rule.id" class="rule-row">
                        <el-select v-model="rule.field" filterable allow-create :disabled="readonly" placeholder="数据字段" @change="markDirty">
                            <el-option v-for="field in allFieldOptions" :key="field.value" :label="field.label" :value="field.value" />
                        </el-select>
                        <el-select v-model="rule.operator" :disabled="readonly" @change="markDirty">
                            <el-option v-for="operator in operators" :key="operator.value" :label="operator.label" :value="operator.value" />
                        </el-select>
                        <el-select v-model="rule.valueSource" :disabled="readonly" @change="markDirty">
                            <el-option label="当前用户字段" value="currentUser" />
                            <el-option label="固定值" value="constant" />
                        </el-select>
                        <el-select v-if="rule.valueSource === 'currentUser'" v-model="rule.value" filterable allow-create :disabled="readonly" @change="markDirty">
                            <el-option v-for="item in currentUserFields" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <el-input v-else v-model="rule.value" :disabled="readonly" placeholder="固定值" @input="markDirty" />
                        <el-button text type="danger" :icon="Delete" :disabled="readonly" @click="removeRule(index)" />
                    </div>
                        </section>
                    </div>

                    <section class="permission-card preview-card side-preview-card">
                        <div class="card-title-row">
                            <div>
                                <div class="card-title">最终数据权限条件</div>
                                <div class="form-tip">始终允许手动编辑；修改左侧图形配置时，这里会立即按最新配置重新生成。</div>
                            </div>
                        </div>
                        <div class="permission-summary">
                            <el-tag v-for="item in permissionSummary" :key="item" effect="plain">{{ item }}</el-tag>
                        </div>
                        <div class="designer-code-editor preview-editor">
                            <DiyCodeEditor
                                :model-value="finalSql"
                                :field="finalSqlEditorField"
                                height="52vh"
                                :FormData="FormData"
                                :FormDiyTableModel="FormDiyTableModel"
                                :FormMode="FormMode"
                                :FieldReadonly="readonly"
                                v8-code-type="server"
                                @update:modelValue="setFinalSql"
                            />
                        </div>
                    </section>
                </div>
            </el-tab-pane>

            <el-tab-pane label="关联关系" name="joins" lazy>
                <div class="visual-preview-layout join-layout">
                    <div class="visual-config-column">
                        <div class="join-head">
                            <div>
                                <div class="card-title">主表：{{ mainTableName || "未选择" }}（别名 A）</div>
                                <div class="form-tip">下面的图形关系就是“关联表”配置，同时会自动生成 Join 关联 SQL。</div>
                            </div>
                            <el-button :icon="Plus" :disabled="readonly || !mainTableId" @click="addJoin">添加关联表</el-button>
                        </div>

                        <div class="join-table-flow">
                            <el-tag type="primary" effect="dark">A · {{ mainTableName || "主表" }}</el-tag>
                            <template v-for="join in config.joins" :key="`flow_${join.id}`">
                                <span class="join-flow-arrow">→</span>
                                <el-tag effect="plain">{{ join.alias || "?" }} · {{ tableForJoin(join)?.Name || join.tableName || "待选择关联表" }}</el-tag>
                            </template>
                        </div>

                        <el-empty v-if="config.joins.length === 0" description="尚未配置关联表" />
                        <div v-for="(join, index) in config.joins" :key="join.id" class="join-card">
                            <div class="join-card-head">
                                <span class="join-index">{{ index + 1 }}</span>
                                <el-select v-model="join.joinType" :disabled="readonly" @change="markDirty">
                                    <el-option label="左关联 LEFT JOIN" value="LEFT" />
                                    <el-option label="内关联 INNER JOIN" value="INNER" />
                                </el-select>
                                <el-select
                                    v-model="join.tableId"
                                    filterable
                                    remote
                                    reserve-keyword
                                    :remote-method="searchTablesRemote"
                                    :loading="tableSearchLoading"
                                    :disabled="readonly"
                                    placeholder="搜索关联表"
                                    @visible-change="onTableSelectVisible"
                                    @change="onJoinTableChange(join)"
                                >
                                    <el-option v-for="table in tables" :key="table.Id" :label="tableLabel(table)" :value="table.Id" />
                                </el-select>
                                <el-input v-model="join.alias" :disabled="readonly" placeholder="别名" maxlength="12" @input="markDirty" />
                                <el-button text type="danger" :icon="Delete" :disabled="readonly" @click="removeJoin(index)" />
                            </div>
                            <div class="join-expression">
                                <el-select v-model="join.leftAlias" :disabled="readonly" @change="markDirty">
                                    <el-option label="主表 A" value="A" />
                                    <el-option v-for="item in previousJoins(index)" :key="item.alias" :label="joinDisplayName(item)" :value="item.alias" />
                                </el-select>
                                <span>.</span>
                                <el-select v-model="join.leftField" filterable allow-create :disabled="readonly" placeholder="左字段" @change="markDirty">
                                    <el-option v-for="field in fieldsForAlias(join.leftAlias)" :key="field.Name" :label="fieldLabel(field)" :value="field.Name" />
                                </el-select>
                                <span class="join-equal">=</span>
                                <span>{{ join.alias || "?" }}.</span>
                                <el-select v-model="join.rightField" filterable allow-create :disabled="readonly" placeholder="右字段" @change="markDirty">
                                    <el-option v-for="field in fieldsForTable(join.tableId)" :key="field.Name" :label="fieldLabel(field)" :value="field.Name" />
                                </el-select>
                            </div>
                        </div>
                    </div>

                    <section class="permission-card join-sql-card side-preview-card">
                        <div class="card-title">Join 关联 SQL（自动生成）</div>
                        <div class="form-tip">右侧实时显示图形关联生成的 SQL，只用于核对，无需手写。</div>
                        <div class="designer-code-editor">
                            <DiyCodeEditor
                                :model-value="generatedSqlJoin"
                                :field="sqlJoinEditorField"
                                height="52vh"
                                :FormData="FormData"
                                :FormDiyTableModel="FormDiyTableModel"
                                :FormMode="FormMode"
                                :FieldReadonly="true"
                                v8-code-type="server"
                            />
                        </div>
                    </section>
                </div>
            </el-tab-pane>
        </el-tabs>

        <div class="designer-footer">
            <span :class="{ 'dirty-text': dirty || syncError }">{{ syncStateText }}；配置完成后请保存模块。</span>
            <el-tag v-if="legacyMode" type="warning" effect="plain">历史手写条件</el-tag>
        </div>
    </div>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from "vue";
import { Delete, Plus } from "@element-plus/icons-vue";
import {
    composeDataPermissionSql,
    extractDataPermissionConfig,
    resolveDataPermissionSqlShape,
    shouldClearGeneratedDefaultDenySql,
    stripDataPermissionMarker
} from "@/utils/data-permission-config.js";
import DiyCodeEditor from "../diy-field-component/diy-code-editor.vue";

defineOptions({ name: "DiyDataPermissionDesigner", inheritAttrs: false });

const props = defineProps({
    modelValue: { type: [String, Number, Object], default: "" },
    field: { type: Object, default: () => ({}) },
    FormDiyTableModel: { type: Object, default: () => ({}) },
    FormData: { type: Object, default: () => ({}) },
    FormMode: { type: String, default: "" },
    FieldReadonly: { type: Boolean, default: false },
    TableRowId: { type: String, default: "" },
    TableId: { type: String, default: "" },
    TableName: { type: String, default: "" }
});
const emit = defineEmits(["update:modelValue", "CallbackFormValueChange", "ParentFormSet"]);
const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const DiyApi = proxy.DiyApi;

const activeTab = ref("scope");
const loading = ref(false);
const hydrating = ref(true);
const dirty = ref(false);
const syncError = ref("");
const legacyMode = ref(false);
const tables = shallowRef([]);
const roles = shallowRef([]);
const departments = shallowRef([]);
const tableSearchLoading = ref(false);
const roleSearchLoading = ref(false);
const departmentSearchLoading = ref(false);
const fieldsByTable = reactive({});
const moduleContext = reactive({ DiyTableId: "", DiyTableName: "" });
const raw = reactive({ sqlWhere: "", sqlJoin: "", joinTables: "" });
const finalSql = ref("");
const finalSqlEditorField = createEditorField("PermissionFinalSql", "最终数据权限条件", "sql", 280);
const sqlJoinEditorField = createEditorField("PermissionSqlJoin", "Join 关联", "sql", 240);
let syncTimer = 0;
let syncRequestId = 0;
let pendingSyncMode = null;
let tableSearchTimer = 0;
let roleSearchTimer = 0;
let departmentSearchTimer = 0;
let tableSearchRequestId = 0;
let roleSearchRequestId = 0;
let departmentSearchRequestId = 0;
let tableOptionsLoaded = false;
let roleOptionsLoaded = false;
let departmentOptionsLoaded = false;
let referenceHydrationDepth = 0;
const tableLookupPromises = new Map();
const fieldLookupPromises = new Map();

const config = reactive(defaultConfig());

const operators = [
    { label: "等于", value: "eq" },
    { label: "不等于", value: "ne" },
    { label: "包含", value: "contains" },
    { label: "不包含", value: "notContains" },
    { label: "大于", value: "gt" },
    { label: "大于等于", value: "gte" },
    { label: "小于", value: "lt" },
    { label: "小于等于", value: "lte" }
];
const currentUserFields = [
    { label: "用户 Id", value: "Id" },
    { label: "账号", value: "Account" },
    { label: "当前部门 Id", value: "DeptId" },
    { label: "所属部门链 DeptIds", value: "DeptIds" },
    { label: "角色 Id 列表 RoleIds", value: "RoleIds" },
    { label: "用户层级 Level", value: "Level" },
    { label: "租户 Id", value: "TenantId" }
];

const formModelCandidates = computed(() => [props.FormDiyTableModel, props.FormData].filter((item) => item && typeof item === "object"));
const formModel = computed(() => formModelCandidates.value.find((item) => ["DiyTableId", "Id", "SqlWhere", "SqlJoin", "JoinTables"].some((key) => item[key] !== undefined)) || formModelCandidates.value[0] || {});
const readonly = computed(() => props.FieldReadonly || String(props.FormMode || "").toLowerCase() === "view");
const mainTableId = computed(() => normalizeEntityId(readFormField("DiyTableId")) || normalizeEntityId(moduleContext.DiyTableId));
const mainTable = computed(() => tables.value.find((item) => normalizeEntityId(item.Id) === mainTableId.value) || null);
const mainTableName = computed(() => mainTable.value?.Name || readFormField("DiyTableName") || moduleContext.DiyTableName || "");
const mainFields = computed(() => fieldsByTable[mainTableId.value] || []);
const needsOwnerField = computed(() => ["self", "selfAndSubordinates", "departmentAndSubDepartments"].includes(config.scopeMode));
const needsDepartmentField = computed(() => ["department"].includes(config.scopeMode));
const needsOwnerJoin = computed(() => ["selfAndSubordinates", "departmentAndSubDepartments"].includes(config.scopeMode));
const normalRoles = computed(() => roles.value.filter((item) => !isPostRole(item)));
const postRoles = computed(() => {
    const result = roles.value.filter(isPostRole);
    return result.length > 0 ? result : roles.value;
});
const allFieldOptions = computed(() => {
    const result = mainFields.value.map((field) => ({ label: `A.${fieldLabel(field)}`, value: `A.${field.Name}` }));
    config.joins.forEach((join) => {
        fieldsForTable(join.tableId).forEach((field) => {
            result.push({ label: `${join.alias}.${fieldLabel(field)}`, value: `${join.alias}.${field.Name}` });
        });
    });
    return result;
});
const generatedSqlJoin = computed(() => {
    const completeJoins = buildSnapshot().joins.filter(isJoinComplete);
    return completeJoins.length > 0 ? buildSqlJoin(completeJoins) : "-- 暂无关联关系";
});
const permissionSummary = computed(() => {
    const result = [];
    if (config.superAdminAll) result.push(`超级管理员：Level ≥ ${Number(config.superAdminLevel || 9999)}`);
    if (config.tenantIsolation) result.push(`租户隔离：A.${config.tenantField || "TenantId"}`);
    result.push(`普通用户：${scopeModeLabel(config.scopeMode)}`);
    appendSelectionSummary(result, "全量角色", config.fullAccessRoleIds, roles.value);
    appendSelectionSummary(result, "全量岗位", config.fullAccessPostIds, roles.value);
    appendSelectionSummary(result, "全量部门", config.fullAccessDeptIds, departments.value);
    if (config.rules.length) result.push(`高级图形条件：${config.rules.length} 条`);
    return result;
});
const syncStateText = computed(() => {
    if (syncError.value) return syncError.value;
    if (dirty.value) return "正在自动同步";
    return "已自动同步到表单";
});
const syncStateType = computed(() => syncError.value ? "danger" : (dirty.value ? "warning" : "success"));

onMounted(reload);
onBeforeUnmount(() => {
    clearTimeout(syncTimer);
    clearTimeout(tableSearchTimer);
    clearTimeout(roleSearchTimer);
    clearTimeout(departmentSearchTimer);
    tableSearchRequestId++;
    roleSearchRequestId++;
    departmentSearchRequestId++;
});
watch(
    [() => props.FormDiyTableModel?.DiyTableId, () => props.FormData?.DiyTableId, () => props.TableRowId],
    async () => {
        await ensureModuleContext();
        await ensureMainTableAvailable();
    }
);
watch(config, () => {
    if (hydrating.value || referenceHydrationDepth > 0 || loading.value || readonly.value) return;
    markDirty();
    scheduleAutoSync();
}, { deep: true });
watch(activeTab, (value) => {
    if (value === "joins") void prepareJoinReferenceData();
});

function defaultConfig() {
    return {
        version: 1,
        superAdminAll: true,
        superAdminLevel: 9999,
        tenantIsolation: false,
        tenantField: "TenantId",
        scopeMode: "self",
        ownerField: "UserId",
        departmentField: "DeptId",
        userLevelField: "Level",
        userDeptIdsField: "DeptIds",
        fullAccessRoleIds: [],
        fullAccessPostIds: [],
        fullAccessDeptIds: [],
        ruleMatch: "any",
        rules: [],
        joins: []
    };
}

async function reload() {
    hydrating.value = true;
    loading.value = true;
    try {
        readRawFromForm();
        importRawValues(false);
        dirty.value = false;
        syncError.value = "";
    } catch (error) {
        syncError.value = error?.message || "数据权限配置加载失败";
    } finally {
        // 配置回显不依赖任何远程字典。先移除根遮罩并完成首帧，再在后台
        // 补充表、字段、角色和部门，避免模块表单被全量元数据请求阻塞。
        loading.value = false;
        await nextTick();
        hydrating.value = false;
    }
    void loadBackgroundReferences();
}

async function loadBackgroundReferences() {
    void loadViewerOptions();
    try {
        await ensureModuleContext();
        await Promise.all([ensureMainTableAvailable(), ensureConfiguredTables()]);
    } catch (error) {
        console.warn("[DataPermissionDesigner] 后台加载表元数据失败", error);
    }
}

async function ensureModuleContext() {
    const rowId = normalizeEntityId(props.TableRowId) || normalizeEntityId(readFormField("Id"));
    if (!rowId || (moduleContext.DiyTableId && normalizeEntityId(moduleContext.Id) === rowId)) return;
    try {
        const result = await DiyCommon.FormEngine.GetFormData("sys_menu", {
            Id: rowId,
            _SelectFields: ["Id", "DiyTableId", "DiyTableName"]
        });
        if (result && Number(result.Code) === 1 && result.Data) Object.assign(moduleContext, result.Data);
    } catch (error) {
        console.warn("[DataPermissionDesigner] 读取模块绑定表失败", error);
    }
}

async function ensureMainTableAvailable() {
    const tableId = mainTableId.value;
    if (!tableId) return;
    await ensureTableById(tableId);
    if (mainTableName.value) moduleContext.DiyTableName = mainTableName.value;
    await loadFields(tableId);
}

function searchTablesRemote(keyword) {
    clearTimeout(tableSearchTimer);
    tableSearchTimer = setTimeout(() => void queryTables(keyword), 180);
}

function onTableSelectVisible(visible) {
    if (visible) void prepareJoinReferenceData();
}

async function queryTables(keyword = "") {
    const requestId = ++tableSearchRequestId;
    const text = String(keyword || "").trim();
    const where = [["IsDeleted", "<>", 1]];
    if (text) {
        where.push(["AND", "(", "Name", "Like", text]);
        where.push(["OR", "Description", "Like", text, ")"]);
    }
    tableSearchLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("diy_table", {
            _SelectFields: ["Id", "Name", "Description"],
            _Where: where,
            _OrderBy: "Name",
            _OrderByType: "ASC",
            _PageIndex: 1,
            _PageSize: 50
        });
        if (requestId !== tableSearchRequestId) return [];
        const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : [];
        tableOptionsLoaded = true;
        mergeTableOptions(rows, true);
        return rows;
    } catch (error) {
        if (requestId === tableSearchRequestId) console.warn("[DataPermissionDesigner] 搜索数据表失败", error);
        return [];
    } finally {
        if (requestId === tableSearchRequestId) tableSearchLoading.value = false;
    }
}

async function prepareJoinReferenceData() {
    // 下拉候选与已配置关联表的精确回填并行启动，避免首次展开时被
    // 逐表元数据读取串行挡住；精确回填结果会与远程搜索页安全合并。
    if (!tableOptionsLoaded && !tableSearchLoading.value) void queryTables("");
    await ensureConfiguredTables();
    const fieldTasks = config.joins.map((join) => normalizeEntityId(join.tableId)).filter(Boolean).map((tableId) => loadFields(tableId));
    if (fieldTasks.length) void Promise.allSettled(fieldTasks);
}

async function ensureConfiguredTables() {
    const joins = config.joins.slice();
    const resolved = await Promise.all(joins.map((join) => {
        const tableId = normalizeEntityId(join.tableId);
        return tableId ? ensureTableById(tableId) : ensureTableByName(join.tableName);
    }));
    const assignments = [];
    resolved.forEach((table, index) => {
        if (!table) return;
        const join = joins[index];
        if (!normalizeEntityId(join.tableId)) assignments.push(() => { join.tableId = table.Id; });
        if (!join.tableName) assignments.push(() => { join.tableName = table.Name; });
    });
    if (assignments.length) {
        referenceHydrationDepth++;
        try {
            assignments.forEach((apply) => apply());
            await nextTick();
        } finally {
            referenceHydrationDepth--;
        }
    }
}

async function ensureTableById(tableId) {
    const id = normalizeEntityId(tableId);
    if (!id) return null;
    const existing = tables.value.find((item) => normalizeEntityId(item.Id) === id);
    if (existing) return existing;
    return await lookupTable(`id:${id}`, { Id: id });
}

async function ensureTableByName(tableName) {
    const name = String(tableName || "").trim();
    if (!name) return null;
    const existing = tables.value.find((item) => String(item.Name || "").toLowerCase() === name.toLowerCase());
    if (existing) return existing;
    return await lookupTable(`name:${name.toLowerCase()}`, { _Where: [["Name", "=", name], ["AND", "IsDeleted", "<>", 1]] });
}

async function lookupTable(cacheKey, param) {
    if (tableLookupPromises.has(cacheKey)) return await tableLookupPromises.get(cacheKey);
    const promise = (async () => {
        try {
            const result = await DiyCommon.FormEngine.GetFormData("diy_table", {
                ...param,
                _SelectFields: ["Id", "Name", "Description"]
            });
            const table = result && Number(result.Code) === 1 && result.Data ? result.Data : null;
            if (table) mergeTableOptions([table]);
            return table;
        } catch (error) {
            console.warn("[DataPermissionDesigner] 精确读取数据表失败", error);
            return null;
        } finally {
            tableLookupPromises.delete(cacheKey);
        }
    })();
    tableLookupPromises.set(cacheKey, promise);
    return await promise;
}

function mergeTableOptions(rows, replaceSearch = false) {
    const referencedIds = new Set([mainTableId.value, ...config.joins.map((join) => normalizeEntityId(join.tableId))].filter(Boolean));
    const referencedNames = new Set(config.joins.map((join) => String(join.tableName || "").toLowerCase()).filter(Boolean));
    const preserved = replaceSearch
        ? tables.value.filter((table) => referencedIds.has(normalizeEntityId(table.Id)) || referencedNames.has(String(table.Name || "").toLowerCase()))
        : tables.value;
    tables.value = uniqueRows([...preserved, ...(rows || [])], (item) => normalizeEntityId(item.Id) || String(item.Name || "").toLowerCase());
}

async function loadViewerOptions() {
    await Promise.allSettled([
        loadSelectedRoleOptions(),
        loadSelectedDepartmentOptions(),
        queryRoles(""),
        queryDepartments("")
    ]);
}

function searchRolesRemote(keyword) {
    clearTimeout(roleSearchTimer);
    roleSearchTimer = setTimeout(() => void queryRoles(keyword), 180);
}

function searchDepartmentsRemote(keyword) {
    clearTimeout(departmentSearchTimer);
    departmentSearchTimer = setTimeout(() => void queryDepartments(keyword), 180);
}

function onRoleSelectVisible(visible) {
    if (visible && !roleOptionsLoaded && !roleSearchLoading.value) void queryRoles("");
}

function onDepartmentSelectVisible(visible) {
    if (visible && !departmentOptionsLoaded && !departmentSearchLoading.value) void queryDepartments("");
}

async function queryRoles(keyword = "") {
    const requestId = ++roleSearchRequestId;
    const text = String(keyword || "").trim();
    const where = [["IsDeleted", "<>", 1]];
    if (text) {
        where.push(["AND", "(", "Name", "Like", text]);
        where.push(["OR", "Class", "Like", text]);
        where.push(["OR", "Remark", "Like", text, ")"]);
    }
    roleSearchLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("sys_role", {
            _SelectFields: ["Id", "Name", "Class", "Remark", "Sort"],
            _Where: where,
            _OrderBy: "Sort",
            _PageIndex: 1,
            _PageSize: 50
        });
        if (requestId !== roleSearchRequestId) return [];
        const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : [];
        roleOptionsLoaded = true;
        mergeRoleOptions(rows, true);
        return rows;
    } catch (error) {
        if (requestId === roleSearchRequestId) console.warn("[DataPermissionDesigner] 搜索角色失败", error);
        return [];
    } finally {
        if (requestId === roleSearchRequestId) roleSearchLoading.value = false;
    }
}

async function queryDepartments(keyword = "") {
    const requestId = ++departmentSearchRequestId;
    const text = String(keyword || "").trim();
    const where = [["IsDeleted", "<>", 1]];
    if (text) where.push(["AND", "Name", "Like", text]);
    departmentSearchLoading.value = true;
    try {
        const result = await DiyCommon.FormEngine.GetTableData("sys_dept", {
            _SelectFields: ["Id", "Name", "ParentId", "Sort"],
            _Where: where,
            _OrderBy: "Sort",
            _PageIndex: 1,
            _PageSize: 50
        });
        if (requestId !== departmentSearchRequestId) return [];
        const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : [];
        departmentOptionsLoaded = true;
        mergeDepartmentOptions(rows, true);
        return rows;
    } catch (error) {
        if (requestId === departmentSearchRequestId) console.warn("[DataPermissionDesigner] 搜索部门失败", error);
        return [];
    } finally {
        if (requestId === departmentSearchRequestId) departmentSearchLoading.value = false;
    }
}

async function loadSelectedRoleOptions() {
    const ids = unique([...config.fullAccessRoleIds, ...config.fullAccessPostIds]);
    const rows = await loadRowsByIds("sys_role", ids, ["Id", "Name", "Class", "Remark", "Sort"]);
    mergeRoleOptions(rows);
}

async function loadSelectedDepartmentOptions() {
    const ids = unique(config.fullAccessDeptIds);
    const rows = await loadRowsByIds("sys_dept", ids, ["Id", "Name", "ParentId", "Sort"]);
    mergeDepartmentOptions(rows);
}

async function loadRowsByIds(tableName, ids, selectFields) {
    if (!ids.length) return [];
    const chunks = [];
    for (let index = 0; index < ids.length; index += 50) chunks.push(ids.slice(index, index + 50));
    const results = await Promise.allSettled(chunks.map((chunk) => DiyCommon.FormEngine.GetTableData(tableName, {
        _SelectFields: selectFields,
        _Where: [["Id", "In", chunk]],
        _PageIndex: 1,
        _PageSize: 50
    })));
    return results.flatMap((item) => item.status === "fulfilled" && Number(item.value?.Code) === 1 && Array.isArray(item.value.Data) ? item.value.Data : []);
}

function mergeRoleOptions(rows, replaceSearch = false) {
    const selected = new Set(unique([...config.fullAccessRoleIds, ...config.fullAccessPostIds]));
    const preserved = replaceSearch ? roles.value.filter((item) => selected.has(String(item.Id))) : roles.value;
    roles.value = uniqueRows([...preserved, ...(rows || [])], (item) => String(item.Id || ""));
}

function mergeDepartmentOptions(rows, replaceSearch = false) {
    const selected = new Set(unique(config.fullAccessDeptIds));
    const preserved = replaceSearch ? departments.value.filter((item) => selected.has(String(item.Id))) : departments.value;
    departments.value = uniqueRows([...preserved, ...(rows || [])], (item) => String(item.Id || ""));
}

async function loadFields(tableId) {
    const id = normalizeEntityId(tableId);
    if (!id || fieldsByTable[id]) return fieldsByTable[id] || [];
    if (fieldLookupPromises.has(id)) return await fieldLookupPromises.get(id);
    const promise = (async () => {
        try {
            const result = await DiyCommon.PostAsync(DiyApi.GetDiyFieldByDiyTables, { TableIds: [id] });
            const rows = result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : [];
            fieldsByTable[id] = rows.map((field) => ({ Id: field.Id, Name: field.Name, Label: field.Label, Type: field.Type }));
            return fieldsByTable[id];
        } catch (error) {
            console.warn("[DataPermissionDesigner] 读取数据表字段失败", error);
            return [];
        } finally {
            fieldLookupPromises.delete(id);
        }
    })();
    fieldLookupPromises.set(id, promise);
    return await promise;
}

function readRawFromForm() {
    raw.sqlWhere = stringValue(readFormField("SqlWhere") ?? props.modelValue);
    raw.sqlJoin = stringValue(readFormField("SqlJoin"));
    raw.joinTables = formatJoinTables(readFormField("JoinTables"));
}

function importRawValues(showTip = true) {
    const markerState = extractDataPermissionConfig(raw.sqlWhere);
    // “历史手写条件”只描述 SqlWhere；空 JoinTables（常见值为 []）或单独的
    // SqlJoin 不应让一个真正无条件的模块看起来仍藏着权限 SQL。
    legacyMode.value = !markerState && !!raw.sqlWhere.trim();

    const next = markerState ? normalizeConfig(markerState.config) : inferLegacyConfig();
    if (next.joins.length === 0) next.joins = parseLegacyJoins();
    Object.assign(config, next);
    const clearGeneratedDefaultDeny = shouldClearGeneratedDefaultDenySql(raw.sqlWhere, markerState);
    const storedSqlBody = stripDataPermissionMarker(raw.sqlWhere);
    finalSql.value = clearGeneratedDefaultDeny ? "" : (storedSqlBody || buildAnnotatedSqlWhere(buildSnapshot()));
    if (clearGeneratedDefaultDeny) {
        raw.sqlWhere = "";
        setFormValue("SqlWhere", "");
        emit("update:modelValue", "");
    }
    if (showTip) {
        const message = clearGeneratedDefaultDeny
            ? "已移除旧版设计器自动生成的默认拒绝条件。"
            : (markerState ? "已恢复数据权限配置。" : "已保留历史手写权限条件。");
        DiyCommon.Tips(message, true);
    }
    dirty.value = false;
}

function inferLegacyConfig() {
    const next = defaultConfig();
    next.joins = parseLegacyJoins();
    const whereWithoutMarker = stripDataPermissionMarker(raw.sqlWhere).trim();
    // 历史 SQL 只做字段提示，不自动拆成多个 OR 放行分支；否则重新应用时可能扩大权限。
    next.superAdminAll = false;
    next.tenantIsolation = false;
    next.scopeMode = "custom";

    const adminMatch = whereWithoutMarker.match(/\$CurrentUser\.Level\$\s*>=\s*(\d+)/i);
    if (adminMatch) {
        next.superAdminLevel = Number(adminMatch[1]);
    }
    const tenantMatch = whereWithoutMarker.match(/A\.([A-Za-z_][\w$]*)\s*=\s*['"]\$CurrentUser\.TenantId\$['"]/i);
    if (tenantMatch) {
        next.tenantField = tenantMatch[1];
    }
    const ownerMatch = whereWithoutMarker.match(/A\.([A-Za-z_][\w$]*)\s*=\s*['"]\$CurrentUser\.Id\$['"]/i);
    if (ownerMatch) {
        next.ownerField = ownerMatch[1];
    }
    const deptMatch = whereWithoutMarker.match(/A\.([A-Za-z_][\w$]*)\s*=\s*['"]\$CurrentUser\.DeptId\$['"]/i);
    if (deptMatch) {
        next.departmentField = deptMatch[1];
    }
    return next;
}

function parseLegacyJoins() {
    const joinTables = parseJoinTables(raw.joinTables);
    const byName = new Map(tables.value.map((table) => [String(table.Name || "").toLowerCase(), table]));
    const byAlias = new Map();
    const joins = [];
    const pattern = /(LEFT|INNER)\s+JOIN\s+([A-Za-z_][\w$]*)\s+([A-Za-z][\w]*)\s+ON\s+([A-Za-z][\w]*)\.([A-Za-z_][\w$]*)\s*=\s*([A-Za-z][\w]*)\.([A-Za-z_][\w$]*)/gi;
    let match;
    while ((match = pattern.exec(raw.sqlJoin))) {
        const table = byName.get(match[2].toLowerCase()) || joinTables.find((item) => String(item.Name || "").toLowerCase() === match[2].toLowerCase());
        const alias = match[3];
        const rightIsNew = match[6].toLowerCase() === alias.toLowerCase();
        const join = {
            id: createId(),
            joinType: match[1].toUpperCase(),
            tableId: table?.Id || "",
            tableName: match[2],
            alias,
            leftAlias: rightIsNew ? match[4] : match[6],
            leftField: rightIsNew ? match[5] : match[7],
            rightField: rightIsNew ? match[7] : match[5]
        };
        joins.push(join);
        byAlias.set(alias, join);
    }
    joinTables.forEach((table) => {
        if (!joins.some((join) => join.tableId === table.Id || String(join.tableName).toLowerCase() === String(table.Name).toLowerCase())) {
            joins.push({ id: createId(), joinType: "LEFT", tableId: table.Id || "", tableName: table.Name || "", alias: table.AsName || nextAlias(joins), leftAlias: "A", leftField: "", rightField: "Id" });
        }
    });
    return joins;
}

function scheduleAutoSync() {
    clearTimeout(syncTimer);
    pendingSyncMode = "visual";
    const requestId = ++syncRequestId;
    syncTimer = setTimeout(() => autoSyncToForm(requestId, true), 320);
}

function scheduleEditedSqlSync() {
    clearTimeout(syncTimer);
    pendingSyncMode = "manual";
    const requestId = ++syncRequestId;
    // 手写 SQL 不依赖异步元数据，立即写回表单，避免输入后马上保存时丢失最后一次修改。
    void autoSyncToForm(requestId, false);
}

async function autoSyncToForm(requestId, regenerateSql) {
    if (readonly.value || hydrating.value) return false;
    try {
        if (regenerateSql) {
            await ensureModuleContext();
            await ensureMainTableAvailable();
            await ensureSystemUserJoin();
            validateConfig();
        }
        if (requestId !== syncRequestId) return false;
        const snapshot = buildSnapshot();
        if (regenerateSql) finalSql.value = buildAnnotatedSqlWhere(snapshot);
        const sqlWhere = composeDataPermissionSql(snapshot, finalSql.value);
        raw.sqlWhere = sqlWhere;
        if (regenerateSql) {
            const sqlJoin = buildSqlJoin(snapshot.joins);
            const joinTables = buildJoinTables(snapshot.joins);
            raw.sqlJoin = sqlJoin;
            raw.joinTables = JSON.stringify(joinTables, null, 2);
            writeFormValues(sqlWhere, sqlJoin, JSON.stringify(joinTables));
        } else {
            setFormValue("SqlWhere", sqlWhere);
            emit("update:modelValue", sqlWhere);
        }
        dirty.value = false;
        syncError.value = "";
        legacyMode.value = false;
        pendingSyncMode = null;
        return true;
    } catch (error) {
        syncError.value = error.message || "数据权限配置尚未完整";
        return false;
    }
}

async function flushPendingSync() {
    if (readonly.value) return true;

    // 图形配置可能需要异步补齐表、字段或 Sys_User 关联。模块保存前强制排空，
    // 保证父表单取得的是最后一次图形/手写修改，而不是 320ms 防抖前的旧快照。
    for (let attempt = 0; attempt < 4; attempt++) {
        if (pendingSyncMode === null && !dirty.value) return !syncError.value;
        clearTimeout(syncTimer);
        const regenerateSql = pendingSyncMode !== "manual";
        pendingSyncMode = null;
        const requestId = ++syncRequestId;
        const success = await autoSyncToForm(requestId, regenerateSql);
        if (success && pendingSyncMode === null && !dirty.value) return true;
        if (syncError.value && pendingSyncMode === null) return false;
    }
    return false;
}

function setFinalSql(value) {
    finalSql.value = stripDataPermissionMarker(stringValue(value));
    markDirty();
    scheduleEditedSqlSync();
}

function createEditorField(id, label, language, height) {
    return {
        Id: id,
        Name: id,
        Label: label,
        Config: {
            CodeEditor: {
                Language: language,
                Height: height,
                V8CodeType: "server"
            }
        }
    };
}

function writeFormValues(sqlWhere, sqlJoin, joinTables) {
    setFormValue("SqlWhere", sqlWhere);
    setFormValue("SqlJoin", sqlJoin);
    setFormValue("JoinTables", joinTables);
    emit("update:modelValue", sqlWhere);
}

function setFormValue(name, value) {
    formModel.value[name] = value;
    emit("ParentFormSet", name, value);
    emit("CallbackFormValueChange", { Name: name, Label: name }, value);
}

function validateConfig() {
    if (!mainTableId.value || !mainTableName.value) throw new Error("请先选择模块绑定的数据表。");
    if (needsOwnerField.value && !safeIdentifier(config.ownerField)) throw new Error("请配置合法的数据负责人字段。");
    if (needsDepartmentField.value && !safeIdentifier(config.departmentField)) throw new Error("请配置合法的数据所属部门字段。");
    config.joins.forEach((join, index) => {
        const table = tableForJoin(join);
        if (!table || !safeIdentifier(table.Name) || !safeAlias(join.alias) || !safeAlias(join.leftAlias) || !safeIdentifier(join.leftField) || !safeIdentifier(join.rightField)) {
            throw new Error(`第 ${index + 1} 条关联关系不完整或包含非法标识符。`);
        }
    });
}

async function ensureSystemUserJoin() {
    if (!needsOwnerJoin.value) return;
    const existing = config.joins.find((join) => String(tableForJoin(join)?.Name || join.tableName || "").toLowerCase() === "sys_user" && join.leftAlias === "A" && join.leftField === config.ownerField);
    if (existing) return;
    const userTable = tables.value.find((table) => String(table.Name || "").toLowerCase() === "sys_user") || await ensureTableByName("sys_user");
    if (!userTable) throw new Error("未找到 sys_user 表，无法生成本人和下级的层级权限。");
    const join = {
        id: createId(), joinType: "LEFT", tableId: userTable.Id, tableName: userTable.Name,
        alias: nextAlias(config.joins), leftAlias: "A", leftField: config.ownerField, rightField: "Id"
    };
    config.joins.push(join);
    await loadFields(userTable.Id);
}

function buildSnapshot() {
    return {
        version: 1,
        superAdminAll: !!config.superAdminAll,
        superAdminLevel: Number(config.superAdminLevel || 9999),
        tenantIsolation: !!config.tenantIsolation,
        tenantField: config.tenantField || "TenantId",
        scopeMode: config.scopeMode,
        ownerField: config.ownerField,
        departmentField: config.departmentField,
        userLevelField: config.userLevelField || "Level",
        userDeptIdsField: config.userDeptIdsField || "DeptIds",
        fullAccessRoleIds: unique(config.fullAccessRoleIds),
        fullAccessPostIds: unique(config.fullAccessPostIds),
        fullAccessDeptIds: unique(config.fullAccessDeptIds),
        ruleMatch: config.ruleMatch === "all" ? "all" : "any",
        rules: config.rules.map((rule) => ({ field: rule.field, operator: rule.operator, valueSource: rule.valueSource, value: rule.value })),
        joins: config.joins.map((join) => ({ ...join, tableName: tableForJoin(join)?.Name || join.tableName || "" }))
    };
}

function permissionLineComment(text) {
    return `-- 【权限说明】${safeCommentText(text)}`;
}

function buildAnnotatedSqlWhere(snapshot) {
    const branches = buildAccessBranches(snapshot);
    const shape = resolveDataPermissionSqlShape(snapshot, branches.length);
    if (shape === "empty") return "";
    if (shape === "tenant-only") {
        return [
            permissionLineComment(`租户隔离：当前行 A.${snapshot.tenantField} 必须属于当前租户。`),
            `A.${snapshot.tenantField} = '$CurrentUser.TenantId$'`
        ].join("\n");
    }

    const lines = [];

    lines.push(permissionLineComment("总条件开始：外层括号保证本权限条件与模块其它筛选条件组合时优先级不变。"));
    lines.push("(");

    if (shape === "tenant-and-branches") {
        lines.push(`  ${permissionLineComment(`租户隔离：当前行 A.${snapshot.tenantField} 必须属于当前租户。`)}`);
        lines.push(`  A.${snapshot.tenantField} = '$CurrentUser.TenantId$'`);
        lines.push(`  ${permissionLineComment("组合关系：必须先满足租户隔离，并且再满足下方任意一个放行条件。")}`);
        lines.push("  AND (");
        appendAnnotatedBranches(lines, branches, "    ");
        lines.push(`    ${permissionLineComment("放行条件组结束：上方条件之间使用 OR，满足任意一项即可查看。")}`);
        lines.push("  )");
    } else {
        lines.push(`  ${permissionLineComment("租户隔离未启用：下方任意一个放行条件成立即可查看。")}`);
        appendAnnotatedBranches(lines, branches, "  ");
    }

    if (snapshot.joins.length > 0) {
        const joins = snapshot.joins.map((join) =>
            `${join.leftAlias}.${join.leftField} = ${join.alias}.${join.rightField}（${join.joinType === "INNER" ? "内关联" : "左关联"} ${join.tableName}）`);
        lines.push(`  ${permissionLineComment(`关联关系说明：${joins.join("；")}；JOIN 本身保存在 SqlJoin。`)}`);
    }
    lines.push(`  ${permissionLineComment("总条件结束：下一行右括号与最上方左括号配对。")}`);
    lines.push(")");
    return lines.join("\n");
}

function appendAnnotatedBranches(lines, branches, indent) {
    branches.forEach((branch, index) => {
        lines.push(`${indent}${permissionLineComment(branch.description)}`);
        appendSqlWithPrefix(lines, branch.sql, indent, index === 0 ? "" : "OR ");
    });
}

function appendSqlWithPrefix(lines, sql, indent, prefix) {
    const normalizedSql = String(sql || "").trim();
    if (!normalizedSql) return;
    const sqlLines = normalizedSql.replace(/\r\n/g, "\n").split("\n");
    lines.push(`${indent}${prefix}${sqlLines[0]}`);
    const continuationIndent = `${indent}${" ".repeat(prefix.length)}`;
    sqlLines.slice(1).forEach((line) => lines.push(`${continuationIndent}${line}`));
}

function scopeModeDescription(snapshot) {
    const owner = `A.${safeCommentText(snapshot.ownerField || "UserId")}`;
    const department = `A.${safeCommentText(snapshot.departmentField || "DeptId")}`;
    return ({
        all: "可查看全部数据",
        self: `仅查看本人负责的数据（${owner} = 当前用户 Id）`,
        selfAndSubordinates: `查看本人及下级负责的数据（负责人字段 ${owner}）`,
        department: `仅查看本部门数据（${department} = 当前部门 Id）`,
        departmentAndSubDepartments: `查看本部门及下级部门用户负责的数据（负责人字段 ${owner}）`,
        custom: "仅按高级图形条件或历史兼容条件判断"
    })[snapshot.scopeMode] || "未配置额外范围";
}

function safeCommentText(value) {
    return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function buildSqlJoin(joins) {
    return joins.map((join) => `${join.joinType === "INNER" ? "INNER" : "LEFT"} JOIN ${join.tableName} ${join.alias} ON ${join.leftAlias}.${join.leftField} = ${join.alias}.${join.rightField}`).join("\n");
}

function isJoinComplete(join) {
    const table = tableForJoin(join);
    return !!table
        && safeIdentifier(table.Name)
        && safeAlias(join.alias)
        && safeAlias(join.leftAlias)
        && safeIdentifier(join.leftField)
        && safeIdentifier(join.rightField);
}

function buildJoinTables(joins) {
    return joins.map((join) => {
        const table = tableForJoin(join) || {};
        return { Id: join.tableId || table.Id || "", Name: join.tableName || table.Name || "", Description: table.Description || "", AsName: join.alias };
    });
}

function buildAccessBranches(snapshot) {
    // “全部数据”本身就是不附加范围条件；若同时启用租户隔离，最终只保留租户条件。
    if (snapshot.scopeMode === "all") return [];

    const branches = [];
    const sqlSeen = new Set();
    const addBranch = (description, sql) => {
        const normalizedSql = String(sql || "").trim();
        if (!normalizedSql || sqlSeen.has(normalizedSql)) return;
        sqlSeen.add(normalizedSql);
        branches.push({ description, sql: normalizedSql });
    };

    if (snapshot.superAdminAll) {
        addBranch(`超级管理员放行：当前用户 Level >= ${snapshot.superAdminLevel} 时可查看全部数据。`, `$CurrentUser.Level$ >= ${snapshot.superAdminLevel}`);
    }
    snapshot.fullAccessRoleIds.forEach((id) => {
        addBranch(`角色放行：当前用户属于“${selectionDisplayName(id, roles.value)}”时可查看全部数据。`, `'$CurrentUser.RoleIds$' LIKE '%${escapeSqlLiteral(id)}%'`);
    });
    snapshot.fullAccessPostIds.forEach((id) => {
        addBranch(`岗位放行：当前用户属于“${selectionDisplayName(id, roles.value)}”时可查看全部数据。`, `'$CurrentUser.RoleIds$' LIKE '%${escapeSqlLiteral(id)}%'`);
    });
    snapshot.fullAccessDeptIds.forEach((id) => {
        addBranch(`部门放行：当前用户属于“${selectionDisplayName(id, departments.value)}”或其下级部门时可查看全部数据。`, `'$CurrentUser.DeptIds$' LIKE '%${escapeSqlLiteral(id)}%'`);
    });

    const scope = buildScopeBranch(snapshot);
    if (scope) addBranch(`普通用户范围：${scopeModeDescription(snapshot)}。`, scope);
    const graphicalRules = snapshot.rules.filter((rule) => rule.field && rule.value);
    if (graphicalRules.length > 0) {
        const joiner = snapshot.ruleMatch === "all" ? " AND " : " OR ";
        addBranch(`高级图形条件：共 ${graphicalRules.length} 条，条件之间按“${snapshot.ruleMatch === "all" ? "全部满足（AND）" : "任一满足（OR）"}”组合。`, `(${graphicalRules.map(buildRuleSql).join(joiner)})`);
    }
    return branches;
}

function selectionDisplayName(id, options) {
    return safeCommentText(options.find((item) => String(item.Id) === String(id))?.Name || id);
}

function buildScopeBranch(snapshot) {
    if (snapshot.scopeMode === "all") return "";
    if (snapshot.scopeMode === "self") return `A.${snapshot.ownerField} = '$CurrentUser.Id$'`;
    if (snapshot.scopeMode === "department") return `A.${snapshot.departmentField} = '$CurrentUser.DeptId$'`;
    if (snapshot.scopeMode === "custom") return "";
    const userJoin = snapshot.joins.find((join) => String(join.tableName).toLowerCase() === "sys_user" && join.leftAlias === "A" && join.leftField === snapshot.ownerField);
    if (!userJoin) throw new Error("本人和下级权限需要关联 sys_user。");
    if (snapshot.scopeMode === "selfAndSubordinates") {
        return `(A.${snapshot.ownerField} = '$CurrentUser.Id$' OR $CurrentUser.Level$ > ${userJoin.alias}.${snapshot.userLevelField})`;
    }
    return `(A.${snapshot.ownerField} = '$CurrentUser.Id$' OR ${userJoin.alias}.${snapshot.userDeptIdsField} LIKE '%$CurrentUser.DeptId$%')`;
}

function buildRuleSql(rule) {
    if (!safeFieldReference(rule.field)) throw new Error(`高级条件字段不合法：${rule.field}`);
    const currentUserField = safeIdentifier(rule.value) ? rule.value : "Id";
    const right = rule.valueSource === "currentUser"
        ? `'$CurrentUser.${currentUserField}$'`
        : `'${escapeSqlLiteral(rule.value)}'`;
    const map = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" };
    if (rule.operator === "contains") {
        const value = rule.valueSource === "currentUser" ? `$CurrentUser.${currentUserField}$` : escapeSqlLiteral(rule.value);
        return `${rule.field} LIKE '%${value}%'`;
    }
    if (rule.operator === "notContains") {
        const value = rule.valueSource === "currentUser" ? `$CurrentUser.${currentUserField}$` : escapeSqlLiteral(rule.value);
        return `${rule.field} NOT LIKE '%${value}%'`;
    }
    return `${rule.field} ${map[rule.operator] || "="} ${right}`;
}

function addJoin() {
    config.joins.push({ id: createId(), joinType: "LEFT", tableId: "", tableName: "", alias: nextAlias(config.joins), leftAlias: "A", leftField: "", rightField: "Id" });
    markDirty();
}

async function onJoinTableChange(join) {
    const table = tableForJoin(join);
    join.tableName = table?.Name || "";
    if (join.tableId) await loadFields(join.tableId);
    markDirty();
}

function removeJoin(index) { config.joins.splice(index, 1); markDirty(); }
function addRule() { config.rules.push({ id: createId(), field: "", operator: "eq", valueSource: "currentUser", value: "Id" }); markDirty(); }
function removeRule(index) { config.rules.splice(index, 1); markDirty(); }
function onScopeModeChange() { markDirty(); }
function markDirty() { dirty.value = true; }
function previousJoins(index) { return config.joins.slice(0, index).filter((join) => join.alias); }
function fieldsForTable(tableId) { return fieldsByTable[tableId] || []; }
function fieldsForAlias(alias) {
    if (alias === "A") return mainFields.value;
    const join = config.joins.find((item) => item.alias === alias);
    return join ? fieldsForTable(join.tableId) : [];
}
function tableForJoin(join) {
    const tableId = normalizeEntityId(join?.tableId);
    const tableName = String(join?.tableName || "").toLowerCase();
    return tables.value.find((item) => (tableId && normalizeEntityId(item.Id) === tableId) || (tableName && String(item.Name || "").toLowerCase() === tableName)) || null;
}
function joinDisplayName(join) { return `${join.alias} · ${tableForJoin(join)?.Name || join.tableName || "关联表"}`; }
function tableLabel(table) { return table.Description ? `${table.Name} · ${table.Description}` : table.Name; }
function fieldLabel(field) { return field.Label ? `${field.Name} · ${field.Label}` : field.Name; }
function isPostRole(role) { return /post|job|position|岗位|职位/i.test(`${role.Class || ""} ${role.Remark || ""} ${role.Name || ""}`); }

function normalizeConfig(value) {
    const next = defaultConfig();
    Object.keys(next).forEach((key) => {
        if (value && value[key] !== undefined) next[key] = value[key];
    });
    next.fullAccessRoleIds = Array.isArray(next.fullAccessRoleIds) ? next.fullAccessRoleIds : [];
    next.fullAccessPostIds = Array.isArray(next.fullAccessPostIds) ? next.fullAccessPostIds : [];
    next.fullAccessDeptIds = Array.isArray(next.fullAccessDeptIds) ? next.fullAccessDeptIds : [];
    next.rules = (Array.isArray(next.rules) ? next.rules : []).map((rule) => ({ id: createId(), ...rule }));
    next.joins = (Array.isArray(next.joins) ? next.joins : []).map((join) => ({ id: createId(), ...join }));
    return next;
}

function readFormField(name) {
    for (const item of formModelCandidates.value) {
        const value = item?.[name];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return formModel.value?.[name];
}

function normalizeEntityId(value) {
    if (Array.isArray(value)) return normalizeEntityId(value[0]);
    if (value && typeof value === "object") return normalizeEntityId(value.Id ?? value.id ?? value.Value ?? value.value ?? value.Key ?? value.key);
    const text = String(value ?? "").trim();
    if (!text) return "";
    if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
        try { return normalizeEntityId(JSON.parse(text)); } catch (error) { return text; }
    }
    return text;
}

function scopeModeLabel(value) {
    return ({ all: "全部数据", self: "仅本人", selfAndSubordinates: "本人和下级", department: "本部门", departmentAndSubDepartments: "本部门和下级部门", custom: "仅高级条件" })[value] || "未配置";
}

function appendSelectionSummary(target, prefix, ids, options) {
    const values = unique(ids);
    if (!values.length) return;
    const names = values.map((id) => options.find((item) => String(item.Id) === id)?.Name || id);
    target.push(`${prefix}：${names.join("、")}`);
}

function parseJoinTables(value) {
    try {
        const parsed = typeof value === "string" ? JSON.parse(value || "[]") : value;
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) { return []; }
}
function formatJoinTables(value) {
    const parsed = parseJoinTables(value);
    return parsed.length > 0 ? JSON.stringify(parsed, null, 2) : stringValue(value);
}
function unique(values) { return Array.from(new Set((values || []).filter(Boolean).map(String))); }
function uniqueRows(values, keySelector) {
    const result = [];
    const seen = new Set();
    (values || []).forEach((item) => {
        if (!item) return;
        const key = String(keySelector(item) || "");
        if (!key || seen.has(key)) return;
        seen.add(key);
        result.push(item);
    });
    return result;
}
function stringValue(value) { return value == null ? "" : (typeof value === "string" ? value : JSON.stringify(value)); }
function safeIdentifier(value) { return /^[A-Za-z_][A-Za-z0-9_$]*$/.test(String(value || "")); }
function safeAlias(value) { return /^[A-Za-z][A-Za-z0-9_]*$/.test(String(value || "")); }
function safeFieldReference(value) { return /^[A-Za-z][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_$]*$/.test(String(value || "")); }
function escapeSqlLiteral(value) { return String(value == null ? "" : value).replace(/'/g, "''"); }
function createId() { return `permission_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`; }
function nextAlias(joins) {
    const used = new Set(["A", ...(joins || []).map((join) => String(join.alias || "").toUpperCase())]);
    for (let code = 66; code <= 90; code++) {
        const alias = String.fromCharCode(code);
        if (!used.has(alias)) return alias;
    }
    let index = 1;
    while (used.has(`T${index}`)) index++;
    return `T${index}`;
}

defineExpose({ flushPendingSync });
</script>

<style scoped lang="scss">
.data-permission-designer { display: block; width: 100%; max-width: none; min-width: 0; box-sizing: border-box; color: var(--el-text-color-primary); }
.designer-head, .card-title-row, .join-head, .join-card-head, .designer-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.designer-head { padding: 18px 20px; border: 1px solid var(--el-border-color-light); border-radius: 12px; background: linear-gradient(135deg, var(--el-fill-color-light), var(--el-bg-color)); }
.designer-title { font-size: 18px; font-weight: 700; }
.designer-subtitle, .form-tip, .control-tip { margin-top: 5px; color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.55; }
.designer-table-context { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.advanced-actions, .inline-control { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.designer-alert { margin-top: 14px; }
.designer-tabs, .scope-grid, .visual-preview-layout, .visual-config-column { width: 100%; min-width: 0; box-sizing: border-box; }
.designer-tabs { margin-top: 12px; }
// 旧全局样式会给弹窗里的每一层 Tabs 都创建滚动条；设计器内容交给外层 Dialog Body 统一滚动。
.data-permission-designer :deep(.designer-tabs > .el-tabs__content) { max-height: none !important; overflow: visible !important; }
.visual-preview-layout { display: grid; grid-template-columns: minmax(0, 3fr) minmax(420px, 2fr); gap: 14px; align-items: start; }
.side-preview-card { position: sticky; top: 0; z-index: 2; min-width: 0; margin-top: 0; }
.scope-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.permission-card, .join-card { border: 1px solid var(--el-border-color-light); border-radius: 12px; padding: 16px; background: var(--el-bg-color); box-shadow: 0 4px 18px rgba(18, 42, 74, 0.04); }
.permission-card--accent { border-color: var(--el-color-primary-light-7); background: var(--el-color-primary-light-9); }
.card-title { font-size: 15px; font-weight: 650; margin-bottom: 14px; }
.scope-mode { display: flex; flex-wrap: wrap; gap: 8px; }
.scope-mode :deep(.el-radio-button__inner) { border: 1px solid var(--el-border-color); border-radius: 8px !important; box-shadow: none !important; }
.field-setting-row { display: grid; grid-template-columns: 150px minmax(180px, 1fr) minmax(150px, 1fr); align-items: center; gap: 10px; margin-top: 14px; }
.advanced-card { margin-top: 14px; }
.advanced-actions .el-select { width: 210px; }
.rule-row { display: grid; grid-template-columns: 1.5fr 120px 140px 1.2fr 40px; gap: 8px; margin-top: 10px; align-items: center; }
.permission-summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.preview-error { margin-bottom: 10px; }
.preview-editor { width: 100%; }
.code-editor-label { margin-bottom: 8px; color: var(--el-text-color-regular); font-size: 13px; font-weight: 600; }
.designer-code-editor { width: 100%; min-width: 0; }
.join-head { margin-bottom: 14px; padding: 4px 2px; }
.join-table-flow { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; padding: 12px 14px; border-radius: 10px; background: var(--el-fill-color-light); }
.join-flow-arrow { color: var(--el-text-color-secondary); font-weight: 700; }
.join-card { margin-bottom: 12px; }
.join-card-head { justify-content: flex-start; }
.join-card-head .el-select:nth-of-type(1) { width: 170px; }
.join-card-head .el-select:nth-of-type(2) { flex: 1; min-width: 220px; }
.join-card-head .el-input { width: 100px; }
.join-index { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; color: var(--el-color-primary); background: var(--el-color-primary-light-9); font-weight: 700; }
.join-expression { display: grid; grid-template-columns: 160px 12px minmax(180px, 1fr) 34px auto minmax(180px, 1fr); gap: 8px; align-items: center; margin-top: 14px; padding: 12px; border-radius: 8px; background: var(--el-fill-color-light); }
.join-equal { text-align: center; font-weight: 700; }
.join-sql-card .form-tip { margin: -7px 0 10px; }
.designer-footer { margin-top: 14px; padding: 12px 16px; border-radius: 8px; background: var(--el-fill-color-light); justify-content: flex-start; }
.dirty-text { color: var(--el-color-warning); }
@media (max-width: 1400px) {
    .visual-preview-layout { grid-template-columns: minmax(0, 1.35fr) minmax(380px, 1fr); }
    .scope-grid { grid-template-columns: 1fr; }
}
@media (max-width: 1100px) {
    .visual-preview-layout { grid-template-columns: 1fr; }
    .side-preview-card { position: static; }
    .scope-grid { grid-template-columns: 1fr; }
    .rule-row { grid-template-columns: 1fr 120px 140px 1fr 40px; }
}
@media (max-width: 760px) {
    .designer-head, .card-title-row, .join-head { align-items: flex-start; flex-direction: column; }
    .rule-row, .field-setting-row, .join-expression { display: flex; flex-direction: column; align-items: stretch; }
    .join-card-head { flex-wrap: wrap; }
    .join-card-head .el-select, .join-card-head .el-input { width: 100% !important; }
}
</style>
