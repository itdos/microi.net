<template>
    <div class="wf-line-condition-designer">
        <div class="wf-line-condition-designer__toolbar">
            <div>
                <div class="wf-line-condition-designer__title">流程条件</div>
                <div class="wf-line-condition-designer__meta">
                    {{ currentNodeName || "当前节点" }}，{{ routes.length }} 条可选路线
                </div>
            </div>
            <div class="wf-line-condition-designer__actions">
                <el-button :icon="Refresh" :loading="loading" @click="loadDesignerData">刷新</el-button>
                <el-button type="primary" :icon="MagicStick" :disabled="routes.length === 0" @click="applyConfig">应用配置</el-button>
            </div>
        </div>

        <div class="wf-line-condition-designer__code">
            <div class="wf-line-condition-designer__code-title">条件判断V8</div>
            <DiyCodeEditor
                :model-value="lineValueV8Code"
                :field="codeEditorField"
                :fields="fieldOptions"
                :FormData="FormData"
                :FormDiyTableModel="FormDiyTableModel"
                :FormMode="FormMode"
                :TableRowId="TableRowId"
                :TableId="TableId"
                :CodeEditorMini="true"
                v8-code-type="server"
                @update:modelValue="setLineValueV8Code"
            />
        </div>

        <el-alert
            v-if="legacyV8Code && !hasVisualConfig"
            type="warning"
            :closable="false"
            show-icon
            title="当前节点已有手写条件判断 V8。继续保留原代码不受影响；点击应用配置后，会把当前图形化规则生成到 LineValueV8。"
        />

        <el-alert
            v-if="!businessTableId"
            class="wf-line-condition-designer__alert"
            type="info"
            :closable="false"
            show-icon
            title="未找到流程绑定表单，字段下拉会为空；仍可手动输入字段名。"
        />

        <el-empty v-if="!loading && routes.length === 0" description="当前节点还没有向外连接的条件线" />

        <div v-else class="wf-line-condition-designer__routes">
            <section v-for="(route, routeIndex) in routes" :key="route.lineId || routeIndex" class="wf-route">
                <div class="wf-route__head">
                    <div class="wf-route__main">
                        <span class="wf-route__badge">{{ routeIndex + 1 }}</span>
                        <span class="wf-route__name">{{ getRouteTitle(route) }}</span>
                        <span class="wf-route__target">{{ route.conditionName ? "条件 " + route.conditionName : "未命名条件" }}</span>
                    </div>
                    <el-checkbox v-model="route.isDefault" @change="setDefaultRoute(route)">默认路线</el-checkbox>
                </div>

                <div class="wf-route__line">
                    <el-input v-model="route.conditionName" placeholder="条件名称" @input="markDirty" />
                    <el-input v-model="route.lineValue" placeholder="可选；留空时使用 NextNodeId" @input="markDirty">
                        <template #prepend>LineValue</template>
                    </el-input>
                </div>

                <div v-if="!route.isDefault" class="wf-route__condition-head">
                    <span>满足以下</span>
                    <el-select v-model="route.match" class="wf-route__match" @change="markDirty">
                        <el-option label="所有条件" value="all" />
                        <el-option label="任一条件" value="any" />
                    </el-select>
                    <span>时走此路线</span>
                </div>

                <div v-if="!route.isDefault" class="wf-route__rules">
                    <div v-for="(rule, ruleIndex) in route.rules" :key="rule.id" class="wf-rule">
                        <el-select
                            v-model="rule.field"
                            filterable
                            allow-create
                            default-first-option
                            placeholder="字段"
                            class="wf-rule__field"
                            @change="onRuleFieldChange(rule)"
                        >
                            <el-option
                                v-for="fieldItem in fieldOptions"
                                :key="fieldItem.Name"
                                :label="fieldItem.Label ? fieldItem.Label + ' / ' + fieldItem.Name : fieldItem.Name"
                                :value="fieldItem.Name"
                            />
                        </el-select>
                        <el-select v-model="rule.operator" placeholder="关系" class="wf-rule__operator" @change="markDirty">
                            <el-option v-for="op in operatorOptions" :key="op.value" :label="op.label" :value="op.value" />
                        </el-select>
                        <el-input
                            v-if="!isUnaryOperator(rule.operator)"
                            v-model="rule.value"
                            placeholder="比较值"
                            class="wf-rule__value"
                            @input="markDirty"
                        />
                        <el-button :icon="Delete" text type="danger" @click="removeRule(route, ruleIndex)" />
                    </div>
                    <el-button :icon="Plus" plain @click="addRule(route)">添加条件</el-button>
                </div>
            </section>
        </div>

        <div class="wf-line-condition-designer__footer" v-if="routes.length > 0">
            <span v-if="dirty" class="wf-line-condition-designer__dirty">配置有变更，点击应用配置后再保存流程。</span>
            <span v-else-if="hasVisualConfig">已同步到条件判断 V8。</span>
            <span v-else-if="legacyV8Code">当前条件判断 V8 未包含图形标记。</span>
            <span v-else>尚未生成条件判断 V8。</span>
        </div>
    </div>
</template>

<script setup>
import { computed, getCurrentInstance, onMounted, ref, watch } from "vue";
import { Delete, MagicStick, Plus, Refresh } from "@element-plus/icons-vue";
import DiyCodeEditor from "../diy-field-component/diy-code-editor.vue";

defineOptions({
    name: "DiyWorkflowLineCondition",
    inheritAttrs: false
});

const props = defineProps({
    modelValue: {
        type: [String, Object],
        default: ""
    },
    field: {
        type: Object,
        default: () => ({})
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    FormData: {
        type: Object,
        default: () => ({})
    },
    FormMode: {
        type: String,
        default: ""
    },
    TableRowId: {
        type: String,
        default: ""
    },
    TableId: {
        type: String,
        default: ""
    },
    DataAppend: {
        type: Object,
        default: () => ({})
    },
    ParentV8: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue", "CallbackFormValueChange", "ParentFormSet"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;
const DiyApi = proxy.DiyApi;

const MARKER_BEGIN = "/* MICROI_WF_LINE_CONDITION_JSON";
const MARKER_END = "MICROI_WF_LINE_CONDITION_JSON */";
const CODE_BEGIN = "// MICROI_WF_LINE_CONDITION_CODE_BEGIN";
const CODE_END = "// MICROI_WF_LINE_CONDITION_CODE_END";

const loading = ref(false);
const routes = ref([]);
const fieldOptions = ref([]);
const nodeOptions = ref([]);
const dirty = ref(false);
const hasVisualConfig = ref(false);

const operatorOptions = [
    { label: "等于", value: "eq" },
    { label: "不等于", value: "ne" },
    { label: "大于", value: "gt" },
    { label: "大于等于", value: "gte" },
    { label: "小于", value: "lt" },
    { label: "小于等于", value: "lte" },
    { label: "包含", value: "contains" },
    { label: "不包含", value: "notContains" },
    { label: "开头是", value: "startsWith" },
    { label: "结尾是", value: "endsWith" },
    { label: "为空", value: "empty" },
    { label: "不为空", value: "notEmpty" }
];

const currentNodeId = computed(() => props.FormDiyTableModel.Id || props.TableRowId || "");
const currentNodeName = computed(() => getNodeName(currentNodeId.value) || props.FormDiyTableModel.NodeName || "");
const flowDesignId = computed(() => props.FormDiyTableModel.FlowDesignId || props.ParentV8?.FlowDesignModel?.Id || props.DataAppend.FlowDesignId || "");
const businessTableId = computed(() => props.FormDiyTableModel.TableId || props.ParentV8?.FlowDesignModel?.TableId || props.DataAppend.TableId || "");
const targetFieldName = computed(() => props.field?.Config?.WorkflowCondition?.TargetField || props.DataAppend.TargetField || "LineValueV8");
const legacyV8Code = computed(() => getCurrentLineValueV8());
const lineValueV8Code = computed(() => getCurrentLineValueV8());
const codeEditorField = computed(() => ({
    Id: `${currentNodeId.value || "wf-line"}_${targetFieldName.value || "LineValueV8"}`,
    Name: targetFieldName.value || "LineValueV8",
    Label: "条件判断V8",
    Config: {
        CodeEditor: {
            Language: "javascript",
            Height: 520,
            V8CodeType: "server"
        }
    }
}));

watch(
    () => props.FormDiyTableModel.Id,
    () => loadDesignerData()
);

onMounted(() => {
    loadDesignerData();
});

function isReadonly() {
    return props.FormMode === "View";
}

function newRule() {
    return {
        id: createId(),
        field: "",
        fieldLabel: "",
        operator: "eq",
        value: ""
    };
}

function createId() {
    return "wf_rule_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
}

function isUnaryOperator(operatorValue) {
    return operatorValue === "empty" || operatorValue === "notEmpty";
}

function markDirty() {
    if (!isReadonly()) {
        dirty.value = true;
    }
}

function addRule(route) {
    route.rules.push(newRule());
    markDirty();
}

function removeRule(route, ruleIndex) {
    route.rules.splice(ruleIndex, 1);
    markDirty();
}

function setDefaultRoute(route) {
    if (route.isDefault) {
        routes.value.forEach((item) => {
            if (item !== route) item.isDefault = false;
        });
    }
    markDirty();
}

function onRuleFieldChange(rule) {
    const field = fieldOptions.value.find((item) => item.Name === rule.field);
    rule.fieldLabel = field ? field.Label : "";
    markDirty();
}

function getNodeName(nodeId) {
    if (!nodeId) return "";
    const node = nodeOptions.value.find((item) => item.Id === nodeId) || {};
    return node.NodeName || node.Name || "";
}

function buildRouteTitle(fromNodeId, toNodeId, fromNodeName, toNodeName) {
    const fromName = getNodeName(fromNodeId) || fromNodeName || (fromNodeId === currentNodeId.value ? currentNodeName.value : "") || fromNodeId || "当前节点";
    const toName = getNodeName(toNodeId) || toNodeName || toNodeId || "下一节点";
    return `${fromName} 到 ${toName}`;
}

function getRouteTitle(route) {
    return buildRouteTitle(route.fromNodeId, route.toNodeId, route.fromNodeName, route.toNodeName);
}

async function loadDesignerData() {
    if (!currentNodeId.value) {
        routes.value = [];
        return;
    }

    loading.value = true;
    try {
        await Promise.all([loadFields(), loadNodesAndLines()]);
        initRoutesFromVisualConfig();
        dirty.value = false;
    } finally {
        loading.value = false;
    }
}

async function loadFields() {
    if (!businessTableId.value) {
        fieldOptions.value = [];
        return;
    }
    const result = await DiyCommon.PostAsync(DiyApi.GetDiyField, { TableId: businessTableId.value });
    fieldOptions.value = result && result.Code === 1 && Array.isArray(result.Data) ? result.Data : [];
}

async function loadNodesAndLines() {
    let nodes = Array.isArray(props.ParentV8?.WF_Node_List) ? props.ParentV8.WF_Node_List : [];
    let lines = Array.isArray(props.ParentV8?.WF_Line_List) ? props.ParentV8.WF_Line_List : [];

    if ((!nodes.length || !lines.length) && flowDesignId.value) {
        const requests = [
            {
                Url: DiyApi.GetDiyTableRow,
                Param: {
                    TableName: "WF_Node",
                    _SearchEqual: { FlowDesignId: flowDesignId.value }
                }
            },
            {
                Url: DiyApi.GetDiyTableRow,
                Param: {
                    TableName: "WF_Line",
                    _SearchEqual: { FlowDesignId: flowDesignId.value }
                }
            }
        ];
        const resultList = await new Promise((resolve) => {
            DiyCommon.PostAll(requests, (result) => resolve(result || []));
        });
        nodes = resultList[0] && resultList[0].Code === 1 && Array.isArray(resultList[0].Data) ? resultList[0].Data : nodes;
        lines = resultList[1] && resultList[1].Code === 1 && Array.isArray(resultList[1].Data) ? resultList[1].Data : lines;
    }

    nodeOptions.value = nodes || [];
    const outgoingLines = (lines || []).filter((line) => line.FromNodeId === currentNodeId.value);
    routes.value = outgoingLines.map((line, index) => toRoute(line, index));
}

function toRoute(line, index) {
    const fromNode = nodeOptions.value.find((node) => node.Id === line.FromNodeId) || {};
    const toNode = nodeOptions.value.find((node) => node.Id === line.ToNodeId) || {};
    const fromNodeName = fromNode.NodeName || line.FromNodeName || "";
    const toNodeName = toNode.NodeName || line.ToNodeName || "";
    const routeTitle = buildRouteTitle(line.FromNodeId, line.ToNodeId, fromNodeName, toNodeName);
    const conditionName = line.LineName && line.LineName !== routeTitle ? line.LineName : "";
    return {
        lineId: line.Id,
        conditionName,
        lineValue: line.LineValue || "",
        fromNodeId: line.FromNodeId,
        fromNodeName,
        toNodeId: line.ToNodeId,
        toNodeName,
        match: "all",
        isDefault: false,
        rules: [newRule()]
    };
}

function initRoutesFromVisualConfig() {
    const config = extractVisualConfig(getCurrentLineValueV8());
    hasVisualConfig.value = !!config;
    if (!config || !Array.isArray(config.routes)) return;

    routes.value.forEach((route) => {
        const savedRoute = config.routes.find((item) => item.lineId === route.lineId || (item.lineValue && item.lineValue === route.lineValue));
        if (!savedRoute) return;
        route.conditionName = savedRoute.conditionName || savedRoute.lineName || route.conditionName;
        route.lineValue = savedRoute.lineValue == null ? route.lineValue : savedRoute.lineValue;
        route.fromNodeName = getNodeName(route.fromNodeId) || savedRoute.fromNodeName || route.fromNodeName;
        route.toNodeName = getNodeName(route.toNodeId) || savedRoute.toNodeName || route.toNodeName;
        route.match = savedRoute.match === "any" ? "any" : "all";
        route.isDefault = !!savedRoute.isDefault;
        route.rules = Array.isArray(savedRoute.rules) && savedRoute.rules.length > 0
            ? savedRoute.rules.map((rule) => ({
                  id: createId(),
                  field: rule.field || "",
                  fieldLabel: rule.fieldLabel || "",
                  operator: rule.operator || "eq",
                  value: rule.value == null ? "" : rule.value
              }))
            : [newRule()];
    });
}

function getCurrentLineValueV8() {
    const target = targetFieldName.value;
    if (target && props.FormDiyTableModel && props.FormDiyTableModel[target] != null) {
        return String(props.FormDiyTableModel[target] || "");
    }
    if (props.modelValue != null && typeof props.modelValue !== "object") {
        return String(props.modelValue || "");
    }
    return "";
}

function setLineValueV8Code(code) {
    const nextCode = code == null ? "" : String(code);
    const target = targetFieldName.value;

    if (props.FormDiyTableModel && target) {
        props.FormDiyTableModel[target] = nextCode;
    }

    emit("update:modelValue", nextCode);
    emit("ParentFormSet", target, nextCode);
    emit("CallbackFormValueChange", { Name: target, Label: "条件判断V8" }, nextCode);

    const visualConfig = extractVisualConfig(nextCode);
    hasVisualConfig.value = !!visualConfig;
    if (visualConfig && Array.isArray(visualConfig.routes)) {
        initRoutesFromVisualConfig();
        dirty.value = false;
    }
}

function extractVisualConfig(code) {
    if (!code) return null;
    const beginIndex = code.indexOf(MARKER_BEGIN);
    if (beginIndex < 0) return null;
    const jsonStart = beginIndex + MARKER_BEGIN.length;
    const endIndex = code.indexOf(MARKER_END, jsonStart);
    if (endIndex < 0) return null;
    try {
        return JSON.parse(code.slice(jsonStart, endIndex).trim());
    } catch (error) {
        console.warn("[DiyWorkflowLineCondition] parse visual config failed", error);
        return null;
    }
}

function buildConfig() {
    return {
        version: 1,
        mode: "visual",
        updatedAt: new Date().toISOString(),
        nodeId: currentNodeId.value,
        nodeName: currentNodeName.value,
        routes: routes.value.map((route) => ({
            lineId: route.lineId,
            conditionName: route.conditionName || "",
            lineName: route.conditionName || "",
            lineValue: String(route.lineValue || ""),
            fromNodeId: route.fromNodeId,
            fromNodeName: getNodeName(route.fromNodeId) || route.fromNodeName || "",
            toNodeId: route.toNodeId,
            toNodeName: getNodeName(route.toNodeId) || route.toNodeName || "",
            routeTitle: getRouteTitle(route),
            match: route.match === "any" ? "any" : "all",
            isDefault: !!route.isDefault,
            rules: (route.rules || [])
                .filter((rule) => rule.field)
                .map((rule) => ({
                    field: rule.field || "",
                    fieldLabel: rule.fieldLabel || "",
                    operator: rule.operator || "eq",
                    value: isUnaryOperator(rule.operator) ? "" : rule.value
                }))
        }))
    };
}

function buildV8Code(config) {
    const json = JSON.stringify(config, null, 2);
    const normalRoutes = (config.routes || []).filter((route) => !route.isDefault && buildRouteExpression(route));
    const defaultRoute = (config.routes || []).find((route) => route.isDefault);
    const codeLines = [CODE_BEGIN, MARKER_BEGIN, json, MARKER_END];

    normalRoutes.forEach((route, index) => {
        const keyword = index === 0 ? "if" : "else if";
        codeLines.push(`${keyword} (${buildRouteExpression(route)}) {`);
        codeLines.push(buildRouteAssignment(route));
        codeLines.push("}");
    });

    if (defaultRoute) {
        codeLines.push(normalRoutes.length > 0 ? "else {" : "if (true) {");
        codeLines.push(buildRouteAssignment(defaultRoute));
        codeLines.push("}");
    }

    codeLines.push(CODE_END);
    return codeLines.join("\n");
}

function buildRouteExpression(route) {
    const rules = (route.rules || []).filter((rule) => rule.field);
    if (rules.length === 0) return "";
    const joiner = route.match === "any" ? " || " : " && ";
    return rules.map((rule) => `(${buildRuleExpression(rule)})`).join(joiner);
}

function buildRouteAssignment(route) {
    if (route.lineValue) {
        return `  V8.LineValue = ${formatLineValue(route.lineValue)};`;
    }
    return `  V8.NextNodeId = ${toJsString(route.toNodeId || "")};`;
}

function buildRuleExpression(rule) {
    const fieldValue = `V8.Form[${toJsString(rule.field)}]`;
    const value = rule.value == null ? "" : String(rule.value);
    const valueString = toJsString(value);
    const textValue = `String(${fieldValue} == null ? "" : ${fieldValue})`;

    if (rule.operator === "empty") return `${fieldValue} == null || ${textValue}.replace(/(^\\s*)|(\\s*$)/g, "") === ""`;
    if (rule.operator === "notEmpty") return `${fieldValue} != null && ${textValue}.replace(/(^\\s*)|(\\s*$)/g, "") !== ""`;
    if (rule.operator === "contains") return `${textValue}.indexOf(${valueString}) > -1`;
    if (rule.operator === "notContains") return `${textValue}.indexOf(${valueString}) === -1`;
    if (rule.operator === "startsWith") return `${textValue}.indexOf(${valueString}) === 0`;
    if (rule.operator === "endsWith") return `${valueString} === "" || ${textValue}.lastIndexOf(${valueString}) === ${textValue}.length - ${valueString}.length`;

    const compareValue = isNumericValue(value) && ["gt", "gte", "lt", "lte"].indexOf(rule.operator) > -1
        ? Number(value)
        : valueString;
    const leftValue = isNumericValue(value) && ["gt", "gte", "lt", "lte"].indexOf(rule.operator) > -1
        ? `Number(${fieldValue})`
        : textValue;

    const operatorMap = {
        eq: "==",
        ne: "!=",
        gt: ">",
        gte: ">=",
        lt: "<",
        lte: "<="
    };
    return `${leftValue} ${operatorMap[rule.operator] || "=="} ${compareValue}`;
}

function isNumericValue(value) {
    return value !== "" && !Number.isNaN(Number(value));
}

function formatLineValue(value) {
    return isNumericValue(String(value)) ? String(value) : toJsString(value);
}

function toJsString(value) {
    return JSON.stringify(value == null ? "" : String(value));
}

function mergeVisualCode(oldCode, visualCode) {
    const source = String(oldCode || "");
    if (!source.trim()) return visualCode;

    const codeBeginIndex = source.indexOf(CODE_BEGIN);
    if (codeBeginIndex > -1) {
        const codeEndIndex = source.indexOf(CODE_END, codeBeginIndex);
        if (codeEndIndex > -1) {
            return source.slice(0, codeBeginIndex) + visualCode + source.slice(codeEndIndex + CODE_END.length);
        }
    }

    const markerBeginIndex = source.indexOf(MARKER_BEGIN);
    if (markerBeginIndex > -1) {
        const markerEndIndex = source.indexOf(MARKER_END, markerBeginIndex);
        if (markerEndIndex > -1) {
            const oldBlockEndIndex = source.indexOf("\n})();", markerEndIndex);
            if (oldBlockEndIndex > -1) {
                return source.slice(0, markerBeginIndex) + visualCode + source.slice(oldBlockEndIndex + "\n})();".length);
            }
        }
    }

    return visualCode + "\n\n" + source.trimStart();
}

function applyConfig() {
    if (isReadonly()) return;

    const config = buildConfig();
    const code = mergeVisualCode(getCurrentLineValueV8(), buildV8Code(config));
    const target = targetFieldName.value;

    routes.value.forEach((route) => {
        updateParentLine(route);
    });

    if (props.FormDiyTableModel && target) {
        props.FormDiyTableModel[target] = code;
    }
    emit("update:modelValue", code);
    emit("ParentFormSet", target, code);
    emit("CallbackFormValueChange", { Name: target, Label: "条件判断V8" }, code);
    hasVisualConfig.value = true;
    dirty.value = false;
    DiyCommon.Tips("流程条件配置已生成到条件判断V8。", true);
}

function updateParentLine(route) {
    const patch = {
        LineName: getRouteTitle(route),
        LineValue: String(route.lineValue || "")
    };
    if (typeof props.ParentV8?.SetWorkflowLine === "function") {
        props.ParentV8.SetWorkflowLine(route.lineId, patch);
        return;
    }
    const lineList = props.ParentV8?.WF_Line_List;
    if (!Array.isArray(lineList)) return;
    const line = lineList.find((item) => item.Id === route.lineId);
    if (line) {
        Object.assign(line, patch);
    }
}
</script>

<style lang="scss" scoped>
.wf-line-condition-designer {
    width: 100%;
    min-width: 0;
    color: var(--el-text-color-primary);
    box-sizing: border-box;
    overflow: hidden;

    * {
        box-sizing: border-box;
    }
}

.wf-line-condition-designer__toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
}

.wf-line-condition-designer__title {
    font-size: 15px;
    font-weight: 600;
    line-height: 22px;
}

.wf-line-condition-designer__meta,
.wf-line-condition-designer__footer {
    color: var(--el-text-color-secondary);
    font-size: 12px;
}

.wf-line-condition-designer__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
}

.wf-line-condition-designer__code {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
    padding: 10px;
    margin-bottom: 10px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    background: var(--el-fill-color-lighter);
}

.wf-line-condition-designer__code-title {
    color: var(--el-text-color-regular);
    font-size: 13px;
    font-weight: 600;
}

:deep(.el-alert__title) {
    line-height: 1.7;
    white-space: normal;
}

.wf-line-condition-designer__alert {
    margin-top: 8px;
}

.wf-line-condition-designer__routes {
    display: grid;
    gap: 10px;
    margin-top: 12px;
}

.wf-route {
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
    padding: 10px;
    background: var(--el-bg-color);
    min-width: 0;
    overflow: hidden;
}

.wf-route__head,
.wf-route__main,
.wf-route__line,
.wf-route__condition-head,
.wf-rule {
    display: flex;
    align-items: center;
    gap: 8px;
}

.wf-route__head {
    justify-content: space-between;
    margin-bottom: 8px;
    align-items: flex-start;
}

.wf-route__main {
    min-width: 0;
    flex: 1 1 auto;
    flex-wrap: wrap;
}

.wf-route__badge {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--el-color-primary-light-9);
    color: var(--el-color-primary);
    font-size: 12px;
    flex: 0 0 auto;
}

.wf-route__name {
    font-weight: 600;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.wf-route__target {
    min-width: 0;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.wf-route__line {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    margin-bottom: 8px;
}

.wf-route__condition-head {
    color: var(--el-text-color-secondary);
    font-size: 12px;
    margin-bottom: 8px;
}

.wf-route__match {
    width: 110px;
}

.wf-route__rules {
    display: grid;
    gap: 8px;
}

.wf-rule {
    width: 100%;
    min-width: 0;
    flex-wrap: wrap;
}

.wf-rule__field {
    flex: 1 1 160px;
    min-width: 0;
}

.wf-rule__operator {
    width: 105px;
    flex: 0 0 auto;
}

.wf-rule__value {
    flex: 1 1 130px;
    min-width: 0;
}

.wf-line-condition-designer__footer {
    margin-top: 10px;
}

.wf-line-condition-designer__dirty {
    color: var(--el-color-warning);
}

@media (max-width: 768px) {
    .wf-line-condition-designer__toolbar,
    .wf-route__head,
    .wf-rule {
        align-items: stretch;
        flex-direction: column;
    }

    .wf-route__line {
        grid-template-columns: 1fr;
    }

    .wf-line-condition-designer__code {
        align-items: stretch;
        flex-direction: column;
    }

    .wf-rule__operator,
    .wf-route__match {
        width: 100%;
    }
}
</style>