<template>
    <el-dialog
        v-model="visible"
        class="diy-code-design-dialog"
        title="代码设计器"
        width="86vw"
        top="24px"
        draggable
        append-to-body
        destroy-on-close
        :close-on-click-modal="false"
        @open="onDialogOpen"
    >
        <div class="diy-code-design">
            <div class="diy-code-design__left">
                <el-tabs v-model="activeTab" stretch>
                    <el-tab-pane label="V8模板" name="v8">
                        <div class="designer-search">
                            <el-input v-model="keyword" clearable placeholder="搜索模板" />
                            <el-select v-model="selectedField" clearable filterable placeholder="字段" class="designer-field-select">
                                <el-option v-for="item in fieldsForSelect" :key="item.Name" :label="fieldLabel(item)" :value="item.Name" />
                            </el-select>
                        </div>
                        <el-scrollbar class="snippet-scrollbar">
                            <div v-for="group in filteredSnippetGroups" :key="group.key" class="snippet-group">
                                <div class="snippet-group__title">{{ group.label }}</div>
                                <button
                                    v-for="snippet in group.snippets"
                                    :key="snippet.id"
                                    type="button"
                                    class="snippet-item"
                                    :class="{ active: activeSnippetId === snippet.id }"
                                    @click="selectSnippet(snippet)"
                                >
                                    <span class="snippet-item__title">{{ snippet.title }}</span>
                                    <span class="snippet-item__desc">{{ snippet.description }}</span>
                                </button>
                            </div>
                        </el-scrollbar>
                    </el-tab-pane>

                    <el-tab-pane label="SQL生成" name="sql">
                        <el-form label-position="top" class="sql-form">
                            <el-form-item label="表">
                                <el-select
                                    v-model="sqlForm.table"
                                    filterable
                                    clearable
                                    placeholder="请选择表"
                                    :loading="tableLoading"
                                    @change="onSqlTableChange"
                                >
                                    <el-option v-for="item in tableList" :key="item.Id || item.Name" :label="tableLabel(item)" :value="item.Name" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="字段">
                                <el-select v-model="sqlForm.fields" multiple filterable collapse-tags collapse-tags-tooltip placeholder="默认 *">
                                    <el-option v-for="item in sqlFieldList" :key="item.Name" :label="fieldLabel(item)" :value="item.Name" />
                                </el-select>
                            </el-form-item>
                            <el-form-item label="删除状态">
                                <el-select v-model="sqlForm.isDeleted">
                                    <el-option label="未删除" value="0" />
                                    <el-option label="已删除" value="1" />
                                    <el-option label="全部" value="all" />
                                </el-select>
                            </el-form-item>
                            <div class="sql-condition-row">
                                <el-select v-model="sqlForm.whereField" filterable clearable placeholder="条件字段">
                                    <el-option v-for="item in sqlFieldList" :key="item.Name" :label="fieldLabel(item)" :value="item.Name" />
                                </el-select>
                                <el-select v-model="sqlForm.whereOperator" class="sql-condition-row__operator">
                                    <el-option label="等于" value="=" />
                                    <el-option label="不等于" value="<>" />
                                    <el-option label="包含" value="LIKE" />
                                    <el-option label="大于" value=">" />
                                    <el-option label="大于等于" value=">=" />
                                    <el-option label="小于" value="<" />
                                    <el-option label="小于等于" value="<=" />
                                </el-select>
                            </div>
                            <el-form-item label="条件值">
                                <el-input v-model="sqlForm.whereValue" clearable placeholder="可为空" />
                            </el-form-item>
                            <el-form-item label="返回形式">
                                <el-radio-group v-model="sqlForm.outputMode" @change="generateSqlCode">
                                    <el-radio-button label="sql">SQL</el-radio-button>
                                    <el-radio-button label="v8">V8.Db</el-radio-button>
                                </el-radio-group>
                            </el-form-item>
                            <el-form-item label="数量限制">
                                <el-input-number v-model="sqlForm.limit" :min="0" :max="5000" controls-position="right" />
                            </el-form-item>
                            <el-button type="primary" :icon="MagicStick" class="sql-generate-btn" @click="generateSqlCode">生成代码</el-button>
                        </el-form>
                    </el-tab-pane>
                </el-tabs>
            </div>

            <div class="diy-code-design__right">
                <div class="preview-toolbar">
                    <div class="preview-title">生成结果</div>
                    <div class="preview-actions">
                        <el-button :icon="DocumentCopy" @click="copyCode">复制</el-button>
                        <el-button :icon="Plus" @click="insertCode">插入到光标</el-button>
                        <el-button type="primary" :icon="Check" @click="replaceCode">应用为当前代码</el-button>
                    </div>
                </div>
                <el-input v-model="previewCode" type="textarea" :rows="26" resize="none" spellcheck="false" class="preview-editor" />
            </div>
        </div>
    </el-dialog>
</template>

<script setup>
import { computed, getCurrentInstance, nextTick, reactive, ref, watch } from "vue";
import { Check, DocumentCopy, MagicStick, Plus } from "@element-plus/icons-vue";
import { ElMessage } from "element-plus";

defineOptions({
    name: "DiyCodeDesign"
});

const props = defineProps({
    modelValue: {
        type: [String, Number, Object, Array],
        default: ""
    },
    model: {
        type: [String, Number, Object, Array],
        default: undefined
    },
    fields: {
        type: Array,
        default: () => []
    },
    defaultTab: {
        type: String,
        default: "v8"
    },
    v8CodeType: {
        type: String,
        default: "client"
    }
});

const emit = defineEmits(["update:modelValue", "update:model", "insert-code", "replace-code"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const DiyApi = proxy.DiyApi;

const visible = ref(false);
const activeTab = ref(props.defaultTab || "v8");
const keyword = ref("");
const selectedField = ref("");
const activeSnippetId = ref("");
const previewCode = ref("");
const tableLoading = ref(false);
const fieldLoading = ref(false);
const tableList = ref([]);
const sqlFieldList = ref([]);
let tableLoaded = false;

const sqlForm = reactive({
    table: "",
    fields: [],
    isDeleted: "0",
    whereField: "",
    whereOperator: "=",
    whereValue: "",
    outputMode: "sql",
    limit: 100
});

const fieldsForSelect = computed(() => Array.isArray(props.fields) ? props.fields.filter((item) => item && item.Name) : []);

const snippetGroups = [
    {
        key: "form",
        label: "表单与字段",
        snippets: [
            {
                id: "field-set",
                title: "设置字段属性",
                description: "V8.FieldSet 修改显隐、只读、提示等属性",
                code: (field) => `V8.FieldSet('${field}', 'Readonly', true);`
            },
            {
                id: "form-set",
                title: "给字段赋值",
                description: "V8.FormSet 设置当前表单字段值",
                code: (field) => `V8.FormSet('${field}', '');`
            },
            {
                id: "parent-form-set",
                title: "给父表单赋值",
                description: "开发组件或子表场景回写父表单",
                code: (field) => `V8.ParentV8.FormSet('${field}', '');`
            },
            {
                id: "submit-form",
                title: "提交表单",
                description: "前端 V8 触发表单保存",
                code: () => "V8.FormSubmit({ CloseForm: true, SavedType: 'Insert' });"
            }
        ]
    },
    {
        key: "server",
        label: "服务端 V8",
        snippets: [
            {
                id: "server-validate",
                title: "提交前校验",
                description: "SubmitBeforeServerV8 中阻止提交",
                code: (field) => `if (!V8.Form.${field}) {\n  return { Code: 0, Msg: '请填写必填字段' };\n}`
            },
            {
                id: "server-update-current",
                title: "事务内更新当前表",
                description: "使用共享事务更新业务数据",
                code: (field) => `V8.FormEngine.UptFormData(V8.TableModel.Name, {\n  Id: V8.Form.Id,\n  ${field}: V8.Form.${field}\n}, V8.DbTrans);`
            },
            {
                id: "server-query-one",
                title: "查询一条数据",
                description: "FormEngine.GetFormData 参数化查询",
                code: (field) => `var result = V8.FormEngine.GetFormData('TableName', {\n  _Where: [['${field}', '=', V8.Form.${field}]],\n  _SelectFields: ['Id', '${field}']\n});\nif (result.Code != 1) {\n  return { Code: 0, Msg: result.Msg || '数据不存在' };\n}`
            }
        ]
    },
    {
        key: "db",
        label: "数据库",
        snippets: [
            {
                id: "db-list",
                title: "SQL列表查询",
                description: "V8.Db.FromSql 查询列表",
                code: () => "var dataList = V8.Db.FromSql('SELECT * FROM table_name WHERE IsDeleted = @p0', 0).ToArray();\nreturn { Code: 1, Data: dataList };"
            },
            {
                id: "db-scalar",
                title: "SQL统计",
                description: "V8.Db.FromSql 执行标量",
                code: () => "var count = V8.Db.FromSql('SELECT COUNT(*) FROM table_name WHERE IsDeleted = @p0', 0).ToScalar();\nreturn { Code: 1, Data: count };"
            },
            {
                id: "db-update",
                title: "SQL更新",
                description: "使用参数化 SQL 执行更新",
                code: (field) => `var affected = V8.Db.FromSql('UPDATE table_name SET ${field} = @p0 WHERE Id = @p1', V8.Param.${field}, V8.Param.Id).ExecuteNonQuery();\nreturn { Code: 1, Data: affected };`
            }
        ]
    },
    {
        key: "integration",
        label: "接口与集成",
        snippets: [
            {
                id: "http-post",
                title: "HTTP POST JSON",
                description: "调用第三方接口",
                code: () => "var result = V8.Http.Post({\n  Url: 'https://api.example.com/data',\n  PostParam: { id: V8.Param.Id },\n  ParamType: 'json',\n  Timeout: 10,\n  Headers: { 'Content-Type': 'application/json' }\n});\nreturn { Code: 1, Data: result };"
            },
            {
                id: "api-engine-run",
                title: "调用接口引擎",
                description: "V8.ApiEngine.Run 调用其它引擎",
                code: () => "var result = V8.ApiEngine.Run('other-api-engine-key', {\n  Id: V8.Param.Id\n});\nreturn result;"
            },
            {
                id: "cache",
                title: "Redis缓存",
                description: "读写 V8.Cache",
                code: () => "var cacheKey = 'Microi:' + V8.OsClient + ':demo:' + V8.Param.Id;\nvar data = V8.Cache.Get(cacheKey);\nif (!data) {\n  data = { Id: V8.Param.Id };\n  V8.Cache.Set(cacheKey, JSON.stringify(data), 300);\n}\nreturn { Code: 1, Data: data };"
            }
        ]
    },
    {
        key: "workflow",
        label: "流程引擎",
        snippets: [
            {
                id: "line-value-simple",
                title: "条件线 LineValue",
                description: "根据表单字段决定下一条线",
                code: (field) => `if (Number(V8.Form.${field}) > 100) {\n  V8.LineValue = '2';\n} else {\n  V8.LineValue = '1';\n}`
            },
            {
                id: "workflow-approval",
                title: "审批动作判断",
                description: "读取 V8.WF.ApprovalType",
                code: () => "if (V8.WF.ApprovalType == 'Disagree') {\n  V8.LineValue = 'reject';\n} else {\n  V8.LineValue = 'agree';\n}"
            }
        ]
    }
];

const filteredSnippetGroups = computed(() => {
    const text = keyword.value.trim().toLowerCase();
    return snippetGroups
        .map((group) => ({
            ...group,
            snippets: group.snippets.filter((snippet) => {
                if (!text) return true;
                return [group.label, snippet.title, snippet.description].some((item) => String(item).toLowerCase().includes(text));
            })
        }))
        .filter((group) => group.snippets.length > 0);
});

watch(selectedField, () => {
    const snippet = findSnippet(activeSnippetId.value);
    if (snippet) previewCode.value = buildSnippetCode(snippet);
});

watch(activeTab, (value) => {
    if (value === "sql") loadTablesOnce();
});

watch(
    () => props.fields,
    () => {
        if (!selectedField.value && fieldsForSelect.value.length > 0) {
            selectedField.value = fieldsForSelect.value[0].Name;
        }
    },
    { immediate: true }
);

function normalizeCode(value) {
    if (value == null) return "";
    if (typeof value === "object") {
        try {
            return JSON.stringify(value, null, 2);
        } catch (error) {
            return "";
        }
    }
    return String(value);
}

function currentModelCode() {
    return normalizeCode(props.model !== undefined ? props.model : props.modelValue);
}

function fieldLabel(item) {
    return item.Label ? `${item.Label} / ${item.Name}` : item.Name;
}

function tableLabel(item) {
    return item.Description ? `${item.Description} / ${item.Name}` : item.Name;
}

function firstFieldName() {
    return selectedField.value || fieldsForSelect.value[0]?.Name || "FieldName";
}

function findSnippet(snippetId) {
    for (const group of snippetGroups) {
        const snippet = group.snippets.find((item) => item.id === snippetId);
        if (snippet) return snippet;
    }
    return null;
}

function buildSnippetCode(snippet) {
    return snippet.code(firstFieldName(), props.v8CodeType);
}

function selectSnippet(snippet) {
    activeSnippetId.value = snippet.id;
    previewCode.value = buildSnippetCode(snippet);
}

function selectDefaultSnippet() {
    const firstGroup = filteredSnippetGroups.value[0] || snippetGroups[0];
    const firstSnippet = firstGroup?.snippets?.[0] || snippetGroups[0].snippets[0];
    if (firstSnippet) selectSnippet(firstSnippet);
}

function open(options = {}) {
    activeTab.value = options.tab || props.defaultTab || "v8";
    visible.value = true;
    nextTick(() => {
        if (!previewCode.value || options.resetPreview) {
            if (activeTab.value === "sql") {
                generateSqlCode();
            } else {
                selectDefaultSnippet();
            }
        }
        if (activeTab.value === "sql") loadTablesOnce();
    });
}

function show(options = {}) {
    open(options);
}

function onDialogOpen() {
    if (!previewCode.value) selectDefaultSnippet();
}

async function loadTablesOnce() {
    if (tableLoaded || tableLoading.value) return;
    tableLoading.value = true;
    try {
        const result = await DiyCommon.PostAsync("/api/FormEngine/GetDiyTableList", { _Keyword: "" });
        tableList.value = result && result.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
        tableLoaded = true;
    } catch (error) {
        console.warn("[DiyCodeDesign] load tables failed", error);
    } finally {
        tableLoading.value = false;
    }
}

async function onSqlTableChange() {
    sqlForm.fields = [];
    sqlForm.whereField = "";
    sqlFieldList.value = [];
    const table = tableList.value.find((item) => item.Name === sqlForm.table);
    if (!table) {
        generateSqlCode();
        return;
    }
    fieldLoading.value = true;
    try {
        const result = await DiyCommon.PostAsync(DiyApi.GetDiyField, { TableId: table.Id });
        sqlFieldList.value = result && result.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
    } catch (error) {
        console.warn("[DiyCodeDesign] load fields failed", error);
    } finally {
        fieldLoading.value = false;
    }
    generateSqlCode();
}

function quoteIdentifier(name) {
    return "`" + String(name || "").replace(/`/g, "``") + "`";
}

function quoteSqlValue(value, operatorValue) {
    const text = String(value ?? "").replace(/'/g, "''");
    if (operatorValue === "LIKE") return `'%${text}%'`;
    if (/^-?\d+(\.\d+)?$/.test(text)) return text;
    return `'${text}'`;
}

function buildSql() {
    const tableName = sqlForm.table || "TableName";
    const fields = sqlForm.fields.length > 0 ? sqlForm.fields.map(quoteIdentifier).join(", ") : "*";
    const whereList = [];
    if (sqlForm.isDeleted !== "all") {
        whereList.push(`${quoteIdentifier("IsDeleted")} = ${sqlForm.isDeleted}`);
    }
    if (sqlForm.whereField) {
        whereList.push(`${quoteIdentifier(sqlForm.whereField)} ${sqlForm.whereOperator} ${quoteSqlValue(sqlForm.whereValue, sqlForm.whereOperator)}`);
    }
    const lines = [`SELECT ${fields}`, `FROM ${quoteIdentifier(tableName)}`];
    if (whereList.length > 0) lines.push("WHERE " + whereList.join(" AND "));
    if (sqlForm.limit > 0) lines.push(`LIMIT ${sqlForm.limit}`);
    return lines.join("\n");
}

function generateSqlCode() {
    const sql = buildSql();
    if (sqlForm.outputMode === "v8") {
        previewCode.value = `var sql = ${JSON.stringify(sql)};\nvar dataList = V8.Db.FromSql(sql).ToArray();\nreturn { Code: 1, Data: dataList };`;
    } else {
        previewCode.value = sql;
    }
}

async function copyCode() {
    const code = previewCode.value || "";
    if (!code) return;
    try {
        await navigator.clipboard.writeText(code);
        ElMessage.success("已复制代码");
    } catch (error) {
        ElMessage.warning("当前浏览器不允许自动复制，请手动复制。");
    }
}

function insertCode() {
    if (!previewCode.value) return;
    emit("insert-code", previewCode.value);
}

function replaceCode() {
    const code = previewCode.value || "";
    emit("update:modelValue", code);
    emit("update:model", code);
    emit("replace-code", code);
    visible.value = false;
}

defineExpose({
    open,
    show,
    currentModelCode
});
</script>

<style lang="scss" scoped>
.diy-code-design {
    display: grid;
    grid-template-columns: 360px minmax(0, 1fr);
    gap: 14px;
    min-height: 640px;
}

.diy-code-design__left,
.diy-code-design__right {
    min-height: 0;
}

.diy-code-design__left {
    border-right: 1px solid var(--el-border-color-lighter);
    padding-right: 14px;
}

.designer-search {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    margin-bottom: 10px;
}

.designer-field-select {
    width: 100%;
}

.snippet-scrollbar {
    height: 535px;
}

.snippet-group + .snippet-group {
    margin-top: 14px;
}

.snippet-group__title {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 6px;
}

.snippet-item {
    width: 100%;
    display: grid;
    gap: 4px;
    text-align: left;
    background: var(--el-bg-color);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 9px 10px;
    color: var(--el-text-color-primary);
    cursor: pointer;
}

.snippet-item + .snippet-item {
    margin-top: 7px;
}

.snippet-item:hover,
.snippet-item.active {
    border-color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
}

.snippet-item__title {
    font-weight: 600;
    line-height: 18px;
}

.snippet-item__desc {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 16px;
}

.sql-form {
    padding-right: 4px;
}

.sql-condition-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 112px;
    gap: 8px;
    margin-bottom: 18px;
}

.sql-generate-btn {
    width: 100%;
}

.preview-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
}

.preview-title {
    font-size: 15px;
    font-weight: 600;
}

.preview-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.preview-editor :deep(.el-textarea__inner) {
    font-family: Consolas, Monaco, "Courier New", monospace;
    font-size: 13px;
    line-height: 1.55;
    tab-size: 2;
}

@media (max-width: 960px) {
    .diy-code-design {
        grid-template-columns: 1fr;
    }

    .diy-code-design__left {
        border-right: 0;
        border-bottom: 1px solid var(--el-border-color-lighter);
        padding-right: 0;
        padding-bottom: 12px;
    }

    .snippet-scrollbar {
        height: 280px;
    }
}
</style>