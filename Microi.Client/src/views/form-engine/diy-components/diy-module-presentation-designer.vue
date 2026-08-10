<template>
    <div class="module-presentation-designer" v-loading="loading">
        <header class="designer-head">
            <div class="head-copy">
                <div class="designer-title">模块展示设计器</div>
                <div class="designer-subtitle">统一配置紧凑标题、动态统计、PC 复合列和移动端业务卡片。</div>
                <div class="context-row">
                    <el-tag v-if="diyTableId" type="success" effect="plain">已绑定数据表</el-tag>
                    <el-tag v-else type="warning" effect="plain">请先选择模块绑定表</el-tag>
                    <span v-if="diyTableId" class="context-id">{{ diyTableId }}</span>
                </div>
            </div>
            <div class="head-actions">
                <div class="enable-control">
                    <span>启用自定义表单视图</span>
                    <el-switch v-model="enabled" :disabled="readonly" />
                </div>
                <el-tag :type="syncStateType" effect="plain">{{ syncStateText }}</el-tag>
            </div>
        </header>

        <el-alert
            v-if="parseError"
            class="designer-alert"
            type="warning"
            show-icon
            :closable="false"
            :title="parseError"
            description="原内容已放在“高级 JSON”中，请修正后点击应用；设计器不会执行 JSON 中的任何脚本。"
        />

        <el-tabs v-if="listView && cardView" v-model="activeTab" class="designer-tabs">
            <el-tab-pane label="模块标题与统计" name="hero" lazy>
                <section class="designer-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">紧凑模块标题</div>
                            <div class="form-tip">标题区采用低高度布局；未填写标题时由页面自动使用模块名称。</div>
                        </div>
                    </div>
                    <el-form label-position="top" size="small" class="hero-form">
                        <el-form-item label="眉题">
                            <el-input v-model="listView.Layout.Hero.Eyebrow" :disabled="readonly" placeholder="如 PURCHASE CONTRACT" />
                        </el-form-item>
                        <el-form-item label="模块标题">
                            <el-input v-model="listView.Layout.Hero.Title" :disabled="readonly" placeholder="留空时使用模块名称" />
                        </el-form-item>
                        <el-form-item label="简短说明">
                            <el-input v-model="listView.Layout.Hero.Description" :disabled="readonly" maxlength="120" show-word-limit placeholder="建议一行内说明模块用途" />
                        </el-form-item>
                    </el-form>
                </section>

                <section class="designer-card metrics-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">动态统计指标</div>
                            <div class="form-tip">可直接汇总列表字段，也可调用接口引擎；每个指标应使用不同图标和语义色，接口返回值按 ValuePath 读取。</div>
                        </div>
                        <el-button size="small" :icon="Plus" :disabled="readonly" @click="addMetric">添加指标</el-button>
                    </div>
                    <el-empty v-if="listView.Layout.Hero.Metrics.length === 0" description="尚未配置统计指标" :image-size="52" />
                    <div v-for="(metric, index) in listView.Layout.Hero.Metrics" :key="`metric_${index}`" class="metric-row">
                        <el-input v-model="metric.Key" :disabled="readonly" placeholder="Key" title="指标唯一 Key" />
                        <el-input v-model="metric.Label" :disabled="readonly" placeholder="显示名称" />
                        <el-select v-model="metric.Source" clearable :disabled="readonly" placeholder="内置统计" @change="onMetricSourceChange(metric)">
                            <el-option v-for="item in metricSourceOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <el-select v-model="metric.Field" clearable filterable allow-create :disabled="readonly" placeholder="统计字段" @change="onMetricFieldChange(metric)">
                            <el-option v-for="item in metricFieldOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <el-select
                            v-model="metric.ApiEngineKey"
                            class="metric-api-engine-select"
                            data-testid="module-metric-api-engine"
                            clearable
                            filterable
                            remote
                            reserve-keyword
                            allow-create
                            :remote-method="searchApiEngines"
                            :loading="apiEnginesLoading"
                            :disabled="readonly"
                            placeholder="或接口引擎"
                            @visible-change="onApiEngineVisibleChange"
                            @change="onMetricApiChange(metric)"
                        >
                            <el-option v-for="item in apiEngines" :key="item.ApiEngineKey" :label="apiEngineLabel(item)" :value="item.ApiEngineKey" :disabled="Number(item.IsEnable) === 0" />
                        </el-select>
                        <el-input v-model="metric.ValuePath" :disabled="readonly" placeholder="ValuePath，如 Data.Total" />
                        <el-input :model-value="formatParamMap(metric.ParamMap)" :disabled="readonly" placeholder="接口参数 JSON" @change="setMetricParamMap(metric, $event)" />
                        <el-input v-model="metric.DefaultValue" :disabled="readonly" placeholder="失败兜底值" />
                        <el-input v-model="metric.Prefix" :disabled="readonly" placeholder="前缀" />
                        <el-input v-model="metric.Suffix" :disabled="readonly" placeholder="后缀" />
                        <el-input v-model="metric.Icon" :disabled="readonly" placeholder="图标，如 fas fa-clock" title="Font Awesome 图标；不同指标应使用不同图标" />
                        <el-select v-model="metric.Tone" clearable :disabled="readonly" placeholder="色调">
                            <el-option v-for="item in toneOptions" :key="item.value" :label="item.label" :value="item.value" />
                        </el-select>
                        <el-color-picker v-model="metric.Color" :disabled="readonly" show-alpha title="自定义颜色" />
                        <el-input-number v-model="metric.RefreshSeconds" :disabled="readonly" :min="0" :max="3600" controls-position="right" title="刷新秒数，0 表示不轮询" />
                        <el-button text type="danger" :icon="Delete" :disabled="readonly" title="删除指标" @click="removeMetric(index)" />
                    </div>
                </section>
            </el-tab-pane>

            <el-tab-pane label="PC 复合列" name="list" lazy>
                <section class="designer-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">列表密度与复合列</div>
                            <div class="form-tip">只需配置需要多行或右侧附加信息的列；其它普通列继续使用模块原有列表配置。</div>
                        </div>
                        <div class="inline-actions">
                            <el-radio-group v-model="listView.Layout.List.Density" size="small" :disabled="readonly">
                                <el-radio-button value="Compact">紧凑</el-radio-button>
                                <el-radio-button value="Comfortable">舒适</el-radio-button>
                            </el-radio-group>
                            <el-button size="small" :icon="Plus" :disabled="readonly" @click="addColumn">添加复合列</el-button>
                        </div>
                    </div>
                    <el-alert
                        class="designer-alert composite-guidance"
                        type="info"
                        show-icon
                        :closable="false"
                        title="跨端视图负责字段编排，字段模板负责复杂渲染，两者可以叠加使用"
                        description="字段已经配置表格模板时，主字段、次要行和右侧附加字段会直接复用其安全渲染结果；简单多行布局优先在这里配置，复杂条件、组合标签或自定义 HTML 再使用字段模板。"
                    />
                    <el-empty v-if="listView.Layout.List.Columns.length === 0" description="尚未配置 PC 复合列" :image-size="52" />
                    <article v-for="(column, columnIndex) in listView.Layout.List.Columns" :key="`column_${columnIndex}`" class="config-block">
                        <div class="block-head">
                            <span class="block-index">{{ columnIndex + 1 }}</span>
                            <el-select v-model="column.Field" filterable allow-create :disabled="readonly" placeholder="主显示字段">
                                <el-option v-for="item in fieldOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                            <el-input-number v-model="column.MinWidth" :disabled="readonly" :min="0" :max="1200" controls-position="right" placeholder="最小宽度" />
                            <el-select v-model="column.Align" :disabled="readonly" placeholder="对齐">
                                <el-option label="左对齐" value="Left" />
                                <el-option label="居中" value="Center" />
                                <el-option label="右对齐" value="Right" />
                            </el-select>
                            <el-button text type="danger" :icon="Delete" :disabled="readonly" @click="removeColumn(columnIndex)" />
                        </div>

                        <div class="subsection">
                            <div class="subsection-head">
                                <div><b>次要行</b><span>显示在主字段下方，最多 6 项</span></div>
                                <el-button text size="small" :icon="Plus" :disabled="readonly || column.Lines.length >= 6" @click="addDescriptor(column.Lines)">添加</el-button>
                            </div>
                            <div v-for="(item, index) in column.Lines" :key="`line_${columnIndex}_${index}`" class="descriptor-row">
                                <FieldDescriptorEditor
                                    v-model="column.Lines[index]"
                                    :field-options="fieldOptions"
                                    :tone-options="toneOptions"
                                    :readonly="readonly"
                                    @remove="removeDescriptor(column.Lines, index)"
                                />
                            </div>
                        </div>

                        <div class="subsection">
                            <div class="subsection-head">
                                <div><b>右侧附加字段</b><span>图标、标签或预警状态，最多 4 项</span></div>
                                <el-button text size="small" :icon="Plus" :disabled="readonly || column.TrailingFields.length >= 4" @click="addDescriptor(column.TrailingFields)">添加</el-button>
                            </div>
                            <div v-for="(item, index) in column.TrailingFields" :key="`trailing_${columnIndex}_${index}`" class="descriptor-row">
                                <FieldDescriptorEditor
                                    v-model="column.TrailingFields[index]"
                                    :field-options="fieldOptions"
                                    :tone-options="toneOptions"
                                    :readonly="readonly"
                                    @remove="removeDescriptor(column.TrailingFields, index)"
                                />
                            </div>
                        </div>
                    </article>
                </section>
            </el-tab-pane>

            <el-tab-pane label="移动端卡片" name="card" lazy>
                <section class="designer-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">卡片核心区域</div>
                            <div class="form-tip">标题、头像文字和各区域均来自当前模块绑定表字段。</div>
                        </div>
                    </div>
                    <div class="card-core-grid">
                        <label class="compact-field">
                            <span>头像文字字段</span>
                            <el-select v-model="cardView.Layout.Card.AvatarTextField" clearable filterable allow-create :disabled="readonly" placeholder="如 CustomerName">
                                <el-option v-for="item in fieldOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                        </label>
                        <label class="compact-field">
                            <span>标题字段</span>
                            <el-select v-model="cardView.Layout.Card.TitleField" clearable filterable allow-create :disabled="readonly" placeholder="卡片主标题">
                                <el-option v-for="item in fieldOptions" :key="item.value" :label="item.label" :value="item.value" />
                            </el-select>
                        </label>
                        <div class="toggle-field"><span>隐藏序号</span><el-switch v-model="cardView.Layout.Card.HideIndex" :disabled="readonly" /></div>
                        <div class="toggle-field"><span>显示创建时间</span><el-switch v-model="cardView.Layout.Card.ShowCreateTime" :disabled="readonly" /></div>
                        <div class="toggle-field"><span>显示修改时间</span><el-switch v-model="cardView.Layout.Card.ShowUpdateTime" :disabled="readonly" /></div>
                    </div>
                </section>

                <div class="zone-grid">
                    <section v-for="zone in cardZones" :key="zone.key" class="designer-card zone-card">
                        <div class="subsection-head zone-head">
                            <div><b>{{ zone.label }}</b><span>{{ zone.description }}</span></div>
                            <el-button text size="small" :icon="Plus" :disabled="readonly || cardView.Layout.Card[zone.key].length >= 12" @click="addDescriptor(cardView.Layout.Card[zone.key])">添加</el-button>
                        </div>
                        <el-empty v-if="cardView.Layout.Card[zone.key].length === 0" description="未配置" :image-size="42" />
                        <div v-for="(item, index) in cardView.Layout.Card[zone.key]" :key="`${zone.key}_${index}`" class="descriptor-row descriptor-row--card">
                            <FieldDescriptorEditor
                                v-model="cardView.Layout.Card[zone.key][index]"
                                :field-options="fieldOptions"
                                :tone-options="toneOptions"
                                :readonly="readonly"
                                @remove="removeDescriptor(cardView.Layout.Card[zone.key], index)"
                            />
                        </div>
                    </section>
                </div>
            </el-tab-pane>

            <el-tab-pane label="自定义表单" name="form-json" lazy>
                <section class="designer-card json-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">Detail / Edit 自定义表单视图</div>
                            <div class="form-tip">此处只编辑 Detail/Edit 场景，并合并回完整 ViewSchema；“启用自定义表单视图”仅控制这部分。标题与统计、PC 复合列和移动端卡片只要配置就始终生效。</div>
                        </div>
                        <div class="inline-actions">
                            <el-button size="small" :disabled="readonly" @click="refreshCustomFormJson">从完整配置刷新</el-button>
                            <el-button size="small" type="primary" :disabled="readonly" @click="applyCustomFormJson">校验并应用</el-button>
                        </div>
                    </div>
                    <el-alert
                        class="designer-alert"
                        type="info"
                        show-icon
                        :closable="false"
                        title="JSON 根节点使用 Views 数组，只允许 Scene=Detail 或 Scene=Edit；为空表示继续使用标准表单。"
                    />
                    <el-input v-model="customFormJson" type="textarea" :rows="22" resize="vertical" :disabled="readonly" spellcheck="false" @input="onCustomFormJsonInput" />
                    <el-alert v-if="customFormJsonError" class="json-error" type="error" :closable="false" show-icon :title="customFormJsonError" />
                </section>
            </el-tab-pane>

            <el-tab-pane label="高级 JSON" name="json" lazy>
                <section class="designer-card json-card">
                    <div class="card-head">
                        <div>
                            <div class="card-title">完整 ViewSchema</div>
                            <div class="form-tip">保留全部 List/Card/Detail/Edit、角色专属视图及未知扩展字段。List/Card 不受启用开关影响，Detail/Edit 由“启用自定义表单视图”控制；这里只解析 JSON，不会执行 eval 或任意脚本。</div>
                        </div>
                        <div class="inline-actions">
                            <el-button size="small" :disabled="readonly" @click="refreshAdvancedJson">从设计器刷新</el-button>
                            <el-button size="small" type="primary" :disabled="readonly" @click="applyAdvancedJson">校验并应用</el-button>
                        </div>
                    </div>
                    <el-input v-model="advancedJson" type="textarea" :rows="26" resize="vertical" :disabled="readonly" spellcheck="false" @input="onAdvancedJsonInput" />
                    <el-alert v-if="jsonError" class="json-error" type="error" :closable="false" show-icon :title="jsonError" />
                </section>
            </el-tab-pane>
        </el-tabs>

        <footer class="designer-footer">
            <span :class="{ 'dirty-text': dirty || customFormJsonDirty || advancedJsonDirty || syncError }">{{ syncStateText }}；完成后保存模块即可。</span>
            <span>协议 {{ viewSchemaVersion }} · 配置版本 {{ viewConfigVersion }}</span>
        </footer>
    </div>
</template>

<script setup>
import { computed, defineComponent, getCurrentInstance, h, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { Delete, Plus } from "@element-plus/icons-vue";
import { ElButton, ElColorPicker, ElInput, ElOption, ElSelect, ElSwitch } from "element-plus";

defineOptions({ name: "DiyModulePresentationDesigner", inheritAttrs: false });

const props = defineProps({
    modelValue: { type: [String, Object], default: "" },
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

const FieldDescriptorEditor = defineComponent({
    name: "ModulePresentationFieldDescriptorEditor",
    props: {
        modelValue: { type: Object, required: true },
        fieldOptions: { type: Array, default: () => [] },
        toneOptions: { type: Array, default: () => [] },
        readonly: { type: Boolean, default: false }
    },
    emits: ["update:modelValue", "remove"],
    setup(componentProps, { emit: childEmit }) {
        const patchValue = (name, value) => childEmit("update:modelValue", { ...(componentProps.modelValue || {}), [name]: value });
        return () => h("div", { class: "descriptor-editor" }, [
            h(ElSelect, {
                modelValue: componentProps.modelValue?.Name || "",
                "onUpdate:modelValue": (value) => patchValue("Name", value),
                clearable: true,
                filterable: true,
                allowCreate: true,
                disabled: componentProps.readonly,
                placeholder: "字段"
            }, () => componentProps.fieldOptions.map((item) => h(ElOption, { key: item.value, label: item.label, value: item.value }))),
            h(ElInput, {
                modelValue: componentProps.modelValue?.Icon || "",
                "onUpdate:modelValue": (value) => patchValue("Icon", value),
                disabled: componentProps.readonly,
                placeholder: "图标，如 fas fa-box"
            }),
            h(ElInput, {
                modelValue: componentProps.modelValue?.Prefix || "",
                "onUpdate:modelValue": (value) => patchValue("Prefix", value),
                disabled: componentProps.readonly,
                placeholder: "前缀"
            }),
            h(ElInput, {
                modelValue: componentProps.modelValue?.Suffix || "",
                "onUpdate:modelValue": (value) => patchValue("Suffix", value),
                disabled: componentProps.readonly,
                placeholder: "后缀"
            }),
            h(ElSelect, {
                modelValue: componentProps.modelValue?.Tone || "",
                "onUpdate:modelValue": (value) => patchValue("Tone", value),
                clearable: true,
                disabled: componentProps.readonly,
                placeholder: "色调"
            }, () => componentProps.toneOptions.map((item) => h(ElOption, { key: item.value, label: item.label, value: item.value }))),
            h(ElColorPicker, {
                modelValue: componentProps.modelValue?.Color || "",
                "onUpdate:modelValue": (value) => patchValue("Color", value || ""),
                disabled: componentProps.readonly,
                showAlpha: true,
                title: "自定义颜色"
            }),
            h("label", { class: "descriptor-switch" }, [
                h("span", "显示标签"),
                h(ElSwitch, {
                    modelValue: componentProps.modelValue?.ShowLabel === true,
                    "onUpdate:modelValue": (value) => patchValue("ShowLabel", value),
                    disabled: componentProps.readonly
                })
            ]),
            h(ElButton, {
                text: true,
                type: "danger",
                icon: Delete,
                disabled: componentProps.readonly,
                title: "删除",
                onClick: () => childEmit("remove")
            })
        ]);
    }
});

const activeTab = ref("hero");
const loading = ref(false);
const hydrating = ref(true);
const dirty = ref(false);
const syncError = ref("");
const parseError = ref("");
const jsonError = ref("");
const advancedJson = ref("");
const advancedJsonDirty = ref(false);
const customFormJson = ref("");
const customFormJsonDirty = ref(false);
const customFormJsonError = ref("");
const enabled = ref(false);
const DEFAULT_VIEW_SCHEMA_VERSION = "1.0";
const DEFAULT_VIEW_CONFIG_VERSION = 1;
const viewSchemaVersion = ref(DEFAULT_VIEW_SCHEMA_VERSION);
const viewConfigVersion = ref(DEFAULT_VIEW_CONFIG_VERSION);
const schema = ref({ Views: [] });
const listView = ref(null);
const cardView = ref(null);
const fields = shallowRef([]);
const apiEngines = shallowRef([]);
const apiEnginesLoading = ref(false);
const moduleContext = shallowRef({});
let syncTimer = 0;
let apiEngineSearchTimer = 0;
let syncRequestId = 0;
let lastSyncedSchema = "";
let lastSyncedEnabled = null;
let fieldRequestId = 0;
let apiEngineRequestId = 0;

const toneOptions = [
    { label: "主色", value: "primary" },
    { label: "成功", value: "success" },
    { label: "警告", value: "warning" },
    { label: "危险", value: "danger" },
    { label: "信息", value: "info" }
];
const metricVisualDefaults = [
    { Tone: "primary", Icon: "fas fa-chart-line" },
    { Tone: "success", Icon: "fas fa-circle-check" },
    { Tone: "warning", Icon: "fas fa-clock" },
    { Tone: "danger", Icon: "fas fa-triangle-exclamation" },
    { Tone: "info", Icon: "fas fa-layer-group" }
];
const metricSourceOptions = [
    { label: "总记录数", value: "DataCount" },
    { label: "本页加载", value: "PageCount" }
];
const cardZones = [
    { key: "StatusFields", label: "状态字段", description: "顶部优先展示的业务状态" },
    { key: "TopFields", label: "顶部字段", description: "标题上方的状态标签" },
    { key: "SubtitleFields", label: "副标题字段", description: "标题下方的辅助说明" },
    { key: "RightFields", label: "右侧字段", description: "金额、数量等重点值" },
    { key: "Fields", label: "内容字段", description: "卡片主体业务信息" },
    { key: "MetaFields", label: "元信息字段", description: "编号、创建人等弱化信息" },
    { key: "BottomFields", label: "底部字段", description: "联系人、跟进、合同等动作统计" }
];

const formModelCandidates = computed(() => [props.FormDiyTableModel, props.FormData].filter((item) => item && typeof item === "object"));
const formModel = computed(() => formModelCandidates.value.find((item) => ["ViewSchema", "EnableViewSchema", "ViewSchemaVersion", "ViewConfigVersion"].some((key) => item[key] !== undefined))
    || formModelCandidates.value.find((item) => item.DiyTableId !== undefined)
    || formModelCandidates.value[0]
    || {});
const readonly = computed(() => props.FieldReadonly || String(props.FormMode || "").toLowerCase() === "view");
const diyTableId = computed(() => normalizeEntityId(readFormField("DiyTableId")) || normalizeEntityId(moduleContext.value.DiyTableId));
const fieldOptions = computed(() => fields.value
    .filter((item) => item && item.Name)
    .map((item) => ({ value: item.Name, label: item.Label ? `${item.Label}（${item.Name}）` : item.Name })));
const metricFieldOptions = computed(() => fields.value
    .filter((item) => item && item.Name && /^(int|bigint|decimal|float|double)/i.test(String(item.Type || "")))
    .map((item) => ({ value: item.Name, label: item.Label ? `${item.Label}（${item.Name}）` : item.Name })));
const syncStateText = computed(() => {
    if (syncError.value) return syncError.value;
    if (customFormJsonDirty.value) return "自定义表单视图 JSON 待校验";
    if (advancedJsonDirty.value) return "高级 JSON 待校验";
    if (dirty.value) return "正在自动同步";
    return "已自动同步到表单";
});
const syncStateType = computed(() => syncError.value ? "danger" : (dirty.value || customFormJsonDirty.value || advancedJsonDirty.value ? "warning" : "success"));

onMounted(reload);
onBeforeUnmount(() => {
    clearTimeout(syncTimer);
    clearTimeout(apiEngineSearchTimer);
    apiEngineRequestId += 1;
});

watch(schema, () => onDesignerChange(), { deep: true, flush: "sync" });
watch(enabled, () => onDesignerChange(), { flush: "sync" });
watch(
    [() => props.FormDiyTableModel?.DiyTableId, () => props.FormData?.DiyTableId, () => props.TableRowId],
    async () => {
        await ensureModuleContext();
        await loadFields();
    }
);
watch(() => props.modelValue, (value) => {
    if (hydrating.value || dirty.value) return;
    const incoming = stringifyInput(value);
    if (incoming === lastSyncedSchema) return;
    hydrateSchema(value, false);
});

async function reload() {
    loading.value = true;
    hydrating.value = true;
    try {
        const formSchema = readFormField("ViewSchema");
        const source = formSchema === undefined || formSchema === null || formSchema === "" ? props.modelValue : formSchema;
        const configuredEnabled = readFormField("EnableViewSchema");
        enabled.value = configuredEnabled === undefined || configuredEnabled === null || configuredEnabled === ""
            ? false
            : toBoolean(configuredEnabled);
        viewSchemaVersion.value = String(readFormField("ViewSchemaVersion") || "").trim() || DEFAULT_VIEW_SCHEMA_VERSION;
        viewConfigVersion.value = normalizeConfigVersion(readFormField("ViewConfigVersion")) || DEFAULT_VIEW_CONFIG_VERSION;
        hydrateSchema(source, true);
        lastSyncedSchema = stringifyInput(source);
        lastSyncedEnabled = enabled.value;
        // 设计器内部会补齐缺省 List/Card 草稿，但仅打开表单不应修改用户数据。
        dirty.value = false;
    } catch (error) {
        syncError.value = error?.message || "展示配置加载失败";
    } finally {
        hydrating.value = false;
        loading.value = false;
    }
    // 字段和接口引擎只是编辑辅助数据，不应阻塞设计器外壳首次显示。
    void loadDesignerReferences();
}

async function loadDesignerReferences() {
    try {
        await ensureModuleContext();
        await Promise.all([loadFields(), loadSelectedApiEngines()]);
    } catch (error) {
        console.warn("[ModulePresentationDesigner] 编辑辅助数据加载失败", error);
    }
}

function hydrateSchema(value, initial = false) {
    hydrating.value = true;
    const parsed = parseSchema(value);
    parseError.value = parsed.error;
    const nextSchema = parsed.value;
    const ensured = ensureEditorViews(nextSchema);
    schema.value = nextSchema;
    listView.value = ensured.list;
    cardView.value = ensured.card;
    advancedJson.value = parsed.error && typeof value === "string" ? value : JSON.stringify(nextSchema, null, 2);
    advancedJsonDirty.value = false;
    customFormJson.value = stringifyCustomFormViews(nextSchema);
    customFormJsonDirty.value = false;
    customFormJsonError.value = "";
    jsonError.value = "";
    hydrating.value = false;
    if (!initial && ensured.changed && !readonly.value) {
        dirty.value = true;
        scheduleSync();
    }
    return parsed.error ? false : ensured.changed;
}

function parseSchema(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return { value: cloneJson(value), error: "" };
    }
    const text = String(value || "").trim();
    if (!text) return { value: { Views: [] }, error: "" };
    try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return { value: { Views: cloneJson(parsed) }, error: "" };
        if (!parsed || typeof parsed !== "object") throw new Error("根节点必须是 JSON 对象");
        return { value: cloneJson(parsed), error: "" };
    } catch (error) {
        return { value: { Views: [] }, error: `原 ViewSchema 解析失败：${error.message}` };
    }
}

function ensureEditorViews(root) {
    const before = JSON.stringify(root);
    let changed = false;
    if (!Array.isArray(root.Views)) {
        if (Array.isArray(root.views)) {
            root.Views = root.views;
            delete root.views;
        } else if (canonical(root.Scene) || canonical(root.scene)) {
            root.Views = [{ ...root }];
        } else {
            root.Views = [];
        }
        changed = true;
    }
    const listResult = ensureView(root.Views, "List", "PC", "module-list-pc");
    const cardResult = ensureView(root.Views, "Card", "Mobile", "module-card-mobile");
    changed = changed || listResult.changed || cardResult.changed;
    const listLayout = ensureObject(listResult.view, "Layout", "layout");
    const hero = ensureObject(listLayout.value, "Hero", "hero");
    const list = ensureObject(listLayout.value, "List", "list");
    changed = changed || listLayout.changed || hero.changed || list.changed;
    changed = ensureString(hero.value, "Title") || changed;
    changed = ensureString(hero.value, "Eyebrow") || changed;
    changed = ensureString(hero.value, "Description") || changed;
    changed = ensureObjectArray(hero.value, "Metrics", normalizeMetricDraft) || changed;
    if (!list.value.Density) { list.value.Density = "Compact"; changed = true; }
    changed = ensureObjectArray(list.value, "Columns", normalizeColumnDraft) || changed;

    const cardLayout = ensureObject(cardResult.view, "Layout", "layout");
    const card = ensureObject(cardLayout.value, "Card", "card");
    changed = changed || cardLayout.changed || card.changed;
    ["AvatarTextField", "TitleField"].forEach((key) => { changed = ensureString(card.value, key) || changed; });
    cardZones.forEach((zone) => { changed = ensureObjectArray(card.value, zone.key, normalizeDescriptor) || changed; });
    if (card.value.HideIndex === undefined) { card.value.HideIndex = false; changed = true; }
    if (card.value.ShowCreateTime === undefined) { card.value.ShowCreateTime = true; changed = true; }
    if (card.value.ShowUpdateTime === undefined) { card.value.ShowUpdateTime = false; changed = true; }
    return { list: listResult.view, card: cardResult.view, changed: before !== JSON.stringify(root) };
}

function ensureView(views, scene, device, key) {
    const candidates = views.filter((item) => item && typeof item === "object" && canonical(item.Scene || item.scene) === scene.toLowerCase() && isRoleless(item));
    const rank = (item) => [canonical(item.Key || item.key) === canonical(key) ? 1 : 0, toBoolean(item.Enabled ?? item.enabled ?? true) ? 1 : 0, Number(item.Priority ?? item.priority ?? 0)];
    const pick = (items) => items.slice().sort((left, right) => {
        const leftRank = rank(left);
        const rightRank = rank(right);
        return rightRank[0] - leftRank[0] || rightRank[1] - leftRank[1] || rightRank[2] - leftRank[2];
    })[0];
    let view = pick(candidates.filter((item) => canonical(item.Device || item.device) === device.toLowerCase()));
    let changed = false;
    if (!view) {
        const shared = pick(candidates.filter((item) => canonical(item.Device || item.device) === "all"));
        if (shared) {
            view = { ...cloneJson(shared), Key: key, Device: device };
            views.push(view);
            changed = true;
        }
    }
    if (!view) {
        view = { Key: key, Scene: scene, Device: device, Enabled: true, Priority: 0, Layout: {} };
        views.push(view);
        changed = true;
    }
    if (!view.Key && !view.key) { view.Key = key; changed = true; }
    if (!canonical(view.Scene || view.scene)) { view.Scene = scene; changed = true; }
    if (!canonical(view.Device || view.device)) { view.Device = device; changed = true; }
    if (view.Enabled === undefined) { view.Enabled = true; changed = true; }
    return { view, changed };
}

function ensureObject(target, key, legacyKey) {
    if (target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) return { value: target[key], changed: false };
    if (target[legacyKey] && typeof target[legacyKey] === "object" && !Array.isArray(target[legacyKey])) {
        target[key] = target[legacyKey];
        delete target[legacyKey];
        return { value: target[key], changed: true };
    }
    target[key] = {};
    return { value: target[key], changed: true };
}

function ensureString(target, key) {
    if (target[key] !== undefined && target[key] !== null) return false;
    target[key] = "";
    return true;
}

function ensureObjectArray(target, key, normalizer) {
    const original = target[key];
    let values = [];
    if (Array.isArray(original)) values = original;
    else if (typeof original === "string" && original.trim()) values = original.split(/[,;|]/).map((item) => item.trim()).filter(Boolean);
    const normalized = values.map((value, index) => normalizer(value, index)).filter(Boolean);
    const changed = !Array.isArray(original) || normalized.some((item, index) => item !== values[index]);
    target[key] = normalized;
    return changed;
}

function normalizeMetricDraft(value, index = 0) {
    const visual = metricVisualDefaults[index % metricVisualDefaults.length];
    if (!value || typeof value !== "object" || Array.isArray(value)) return { Key: String(value || ""), Label: "", Source: "", Field: String(value || ""), ApiEngineKey: "", ValuePath: "", ParamMap: {}, DefaultValue: "", Prefix: "", Suffix: "", Tone: visual.Tone, Color: "", Icon: visual.Icon, RefreshSeconds: 0 };
    const item = { ...value };
    ["Key", "Label", "Source", "Field", "ApiEngineKey", "ValuePath", "DefaultValue", "Prefix", "Suffix", "Tone", "Color", "Icon"].forEach((key) => {
        if (item[key] === undefined) item[key] = "";
    });
    if (!item.ParamMap || typeof item.ParamMap !== "object" || Array.isArray(item.ParamMap)) item.ParamMap = {};
    if (item.RefreshSeconds === undefined) item.RefreshSeconds = 0;
    if (!item.Tone) item.Tone = visual.Tone;
    if (!item.Icon) item.Icon = visual.Icon;
    return item;
}

function normalizeColumnDraft(value) {
    const item = value && typeof value === "object" && !Array.isArray(value) ? { ...value } : { Field: String(value || "") };
    if (item.Field === undefined) item.Field = item.Name || "";
    if (!item.Align) item.Align = "Left";
    if (item.MinWidth === undefined) item.MinWidth = 0;
    item.Lines = normalizeDescriptorArray(item.Lines || item.SubFields);
    item.TrailingFields = normalizeDescriptorArray(item.TrailingFields || item.Trailing);
    return item;
}

function normalizeDescriptorArray(value) {
    const list = Array.isArray(value) ? value : (typeof value === "string" ? value.split(/[,;|]/) : []);
    return list.map(normalizeDescriptor).filter(Boolean);
}

function normalizeDescriptor(value) {
    if (typeof value === "string") return { Name: value.trim(), Icon: "", Tone: "", Color: "", ShowLabel: false };
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const item = { ...value };
    if (item.Name === undefined) item.Name = item.Field || "";
    if (item.Icon === undefined) item.Icon = "";
    if (item.Tone === undefined) item.Tone = "";
    if (item.Color === undefined) item.Color = "";
    if (item.Prefix === undefined) item.Prefix = "";
    if (item.Suffix === undefined) item.Suffix = "";
    if (item.ShowLabel === undefined) item.ShowLabel = false;
    return item;
}

function onDesignerChange() {
    if (hydrating.value || loading.value || readonly.value) return;
    dirty.value = true;
    syncError.value = "";
    scheduleSync();
}

function scheduleSync() {
    clearTimeout(syncTimer);
    const requestId = ++syncRequestId;
    syncTimer = setTimeout(() => syncToForm(requestId), 320);
}

async function syncToForm(requestId = ++syncRequestId) {
    if (readonly.value || hydrating.value) return true;
    clearTimeout(syncTimer);
    try {
        const text = JSON.stringify(schema.value, null, 2);
        if (requestId !== syncRequestId) return false;
        const enableValue = enabled.value ? 1 : 0;
        const changed = text !== lastSyncedSchema || enableValue !== lastSyncedEnabled;
        if (changed) {
            const persistedVersion = normalizeConfigVersion(readFormField("ViewConfigVersion"));
            const versionBase = persistedVersion || (lastSyncedSchema ? DEFAULT_VIEW_CONFIG_VERSION : 0);
            viewConfigVersion.value = versionBase + 1;
        }
        viewSchemaVersion.value = String(readFormField("ViewSchemaVersion") || "").trim() || DEFAULT_VIEW_SCHEMA_VERSION;
        lastSyncedSchema = text;
        lastSyncedEnabled = enableValue;
        setFormValue("ViewSchema", text, props.field);
        setFormValue("EnableViewSchema", enableValue);
        setFormValue("ViewSchemaVersion", viewSchemaVersion.value);
        setFormValue("ViewConfigVersion", viewConfigVersion.value);
        emit("update:modelValue", text);
        if (!advancedJsonDirty.value) advancedJson.value = text;
        if (!customFormJsonDirty.value) {
            customFormJson.value = stringifyCustomFormViews(schema.value);
            customFormJsonError.value = "";
        }
        parseError.value = "";
        jsonError.value = "";
        dirty.value = false;
        syncError.value = "";
        return true;
    } catch (error) {
        syncError.value = error?.message || "展示配置同步失败";
        return false;
    }
}

async function flushPendingSync() {
    if (readonly.value) return true;
    if (customFormJsonDirty.value && advancedJsonDirty.value) {
        syncError.value = "自定义表单视图 JSON 与高级 JSON 均有未应用修改，请先选择一处校验并应用。";
        return false;
    }
    if (customFormJsonDirty.value && !applyCustomFormJson({ silent: true, schedule: false })) return false;
    if (advancedJsonDirty.value && !applyAdvancedJson({ silent: true, schedule: false })) return false;
    if (!dirty.value && !syncError.value) return true;
    clearTimeout(syncTimer);
    return await syncToForm(++syncRequestId);
}

function setFormValue(name, value, callbackField) {
    formModel.value[name] = value;
    emit("ParentFormSet", name, value);
    emit("CallbackFormValueChange", callbackField || { Name: name, Label: name }, value);
}

function addMetric() {
    const visual = metricVisualDefaults[listView.value.Layout.Hero.Metrics.length % metricVisualDefaults.length];
    listView.value.Layout.Hero.Metrics.push({ Key: "", Label: "", Source: "", Field: "", ApiEngineKey: "", ValuePath: "", ParamMap: {}, DefaultValue: "", Prefix: "", Suffix: "", Tone: visual.Tone, Color: "", Icon: visual.Icon, RefreshSeconds: 0 });
}
function removeMetric(index) { listView.value.Layout.Hero.Metrics.splice(index, 1); }
function onMetricSourceChange(metric) {
    if (!metric.Source) return;
    metric.Field = "";
    metric.ApiEngineKey = "";
    metric.ValuePath = "";
    if (!metric.Key) metric.Key = metric.Source;
    if (!metric.Label) metric.Label = metric.Source === "DataCount" ? "总记录数" : "本页加载";
}
function onMetricFieldChange(metric) {
    if (!metric.Field) return;
    metric.Source = "Field";
    metric.ApiEngineKey = "";
    if (!metric.Key) metric.Key = metric.Field;
    if (!metric.Label) metric.Label = fields.value.find((item) => item.Name === metric.Field)?.Label || metric.Field;
    ensureStatisticsField(metric.Field);
}
function onMetricApiChange(metric) {
    if (!metric.ApiEngineKey) return;
    metric.Source = "ApiEngine";
    metric.Field = "";
    if (!metric.Key) metric.Key = metric.ApiEngineKey;
    if (!metric.Label) metric.Label = apiEngines.value.find((item) => item.ApiEngineKey === metric.ApiEngineKey)?.ApiName || metric.ApiEngineKey;
}
function addColumn() {
    listView.value.Layout.List.Columns.push({ Field: "", Lines: [], TrailingFields: [], MinWidth: 180, Align: "Left" });
}
function removeColumn(index) { listView.value.Layout.List.Columns.splice(index, 1); }
function addDescriptor(target) { target.push({ Name: "", Icon: "", Tone: "", Color: "", ShowLabel: false }); }
function removeDescriptor(target, index) { target.splice(index, 1); }

function isCustomFormView(view) {
    return ["detail", "edit"].includes(canonical(view?.Scene || view?.scene));
}

function stringifyCustomFormViews(root) {
    const views = Array.isArray(root?.Views) ? root.Views : (Array.isArray(root?.views) ? root.views : []);
    return JSON.stringify({ Views: views.filter(isCustomFormView).map(cloneJson) }, null, 2);
}

function refreshCustomFormJson() {
    customFormJson.value = stringifyCustomFormViews(schema.value);
    customFormJsonDirty.value = false;
    customFormJsonError.value = "";
}

function onCustomFormJsonInput() {
    if (hydrating.value || readonly.value) return;
    customFormJsonDirty.value = true;
    customFormJsonError.value = "";
}

function applyCustomFormJson(options = {}) {
    try {
        if (parseError.value) throw new Error("原 ViewSchema 尚未修复，请先在高级 JSON 中校验并应用");
        if (advancedJsonDirty.value) throw new Error("高级 JSON 尚有未应用修改，请先校验并应用或从完整配置刷新");
        const text = String(customFormJson.value || "").trim();
        const parsed = text ? JSON.parse(text) : { Views: [] };
        const formViews = Array.isArray(parsed)
            ? parsed
            : (Array.isArray(parsed?.Views) ? parsed.Views : (Array.isArray(parsed?.views) ? parsed.views : null));
        if (!formViews) throw new Error("根节点必须是包含 Views 数组的 JSON 对象，也可以直接使用数组");
        const invalidView = formViews.find((view) => !view || typeof view !== "object" || Array.isArray(view) || !isCustomFormView(view));
        if (invalidView) throw new Error("Views 只允许包含 Scene=Detail 或 Scene=Edit 的对象");

        const next = cloneJson(schema.value);
        const currentViews = Array.isArray(next.Views) ? next.Views : [];
        next.Views = currentViews.filter((view) => !isCustomFormView(view)).concat(formViews.map(cloneJson));
        const ensured = ensureEditorViews(next);
        hydrating.value = true;
        schema.value = next;
        listView.value = ensured.list;
        cardView.value = ensured.card;
        hydrating.value = false;
        customFormJson.value = stringifyCustomFormViews(next);
        customFormJsonDirty.value = false;
        customFormJsonError.value = "";
        advancedJson.value = JSON.stringify(next, null, 2);
        advancedJsonDirty.value = false;
        jsonError.value = "";
        dirty.value = true;
        if (options.schedule !== false) scheduleSync();
        if (!options.silent) DiyCommon.Tips("自定义表单视图 JSON 已校验并应用。", true);
        return true;
    } catch (error) {
        hydrating.value = false;
        customFormJsonError.value = `JSON 校验失败：${error.message}`;
        if (!options.silent) DiyCommon.Tips(customFormJsonError.value, false);
        return false;
    }
}

function refreshAdvancedJson() {
    advancedJson.value = JSON.stringify(schema.value, null, 2);
    advancedJsonDirty.value = false;
    jsonError.value = "";
}

function onAdvancedJsonInput() {
    if (hydrating.value || readonly.value) return;
    advancedJsonDirty.value = true;
    jsonError.value = "";
}

function applyAdvancedJson(options = {}) {
    try {
        if (customFormJsonDirty.value) throw new Error("自定义表单视图 JSON 尚有未应用修改，请先校验并应用或从完整配置刷新");
        const parsed = JSON.parse(String(advancedJson.value || ""));
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("根节点必须是 JSON 对象");
        const next = cloneJson(parsed);
        const ensured = ensureEditorViews(next);
        hydrating.value = true;
        schema.value = next;
        listView.value = ensured.list;
        cardView.value = ensured.card;
        hydrating.value = false;
        advancedJson.value = JSON.stringify(next, null, 2);
        advancedJsonDirty.value = false;
        customFormJson.value = stringifyCustomFormViews(next);
        customFormJsonDirty.value = false;
        customFormJsonError.value = "";
        parseError.value = "";
        jsonError.value = "";
        dirty.value = true;
        if (options.schedule !== false) scheduleSync();
        if (!options.silent) DiyCommon.Tips("ViewSchema JSON 已校验并应用。", true);
        return true;
    } catch (error) {
        hydrating.value = false;
        jsonError.value = `JSON 校验失败：${error.message}`;
        if (!options.silent) DiyCommon.Tips(jsonError.value, false);
        return false;
    }
}

async function ensureModuleContext() {
    if (normalizeEntityId(readFormField("DiyTableId"))) return;
    const rowId = normalizeEntityId(props.TableRowId) || normalizeEntityId(readFormField("Id"));
    if (!rowId || normalizeEntityId(moduleContext.value.Id) === rowId) return;
    try {
        const result = await DiyCommon.FormEngine.GetFormData("sys_menu", { Id: rowId, _SelectFields: ["Id", "DiyTableId", "DiyTableName"] });
        if (result && Number(result.Code) === 1 && result.Data) moduleContext.value = result.Data;
    } catch (error) {
        console.warn("[ModulePresentationDesigner] 读取模块绑定表失败", error);
    }
}

async function loadFields() {
    const tableId = diyTableId.value;
    const requestId = ++fieldRequestId;
    fields.value = [];
    if (!tableId) return;
    try {
        const result = await DiyCommon.PostAsync(DiyApi.GetDiyFieldByDiyTables, { TableIds: [tableId] });
        if (requestId !== fieldRequestId || tableId !== diyTableId.value) return;
        fields.value = result && Number(result.Code) === 1 && Array.isArray(result.Data)
            ? result.Data.filter((item) => item && item.Name).map((item) => ({ Id: item.Id, Name: item.Name, Label: item.Label, Type: item.Type }))
            : [];
    } catch (error) {
        if (requestId !== fieldRequestId) return;
        fields.value = [];
        console.warn("[ModulePresentationDesigner] 读取绑定表字段失败", error);
    }
}

function formatParamMap(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length === 0) return "";
    try { return JSON.stringify(value); } catch (error) { return ""; }
}

function setMetricParamMap(metric, value) {
    const text = String(value || "").trim();
    if (!text) { metric.ParamMap = {}; return; }
    try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("必须是 JSON 对象");
        metric.ParamMap = parsed;
    } catch (error) {
        DiyCommon.Tips(`接口参数 JSON 无效：${error.message}`, false);
    }
}

function ensureStatisticsField(fieldName) {
    const field = fields.value.find((item) => item.Name === fieldName);
    if (!field?.Id) return;
    const original = readFormField("StatisticsFields");
    let list = [];
    try {
        list = Array.isArray(original) ? cloneJson(original) : JSON.parse(String(original || "[]"));
    } catch (error) {
        list = [];
    }
    if (!Array.isArray(list)) list = [];
    if (list.some((item) => String(item?.Id || item?.id || item) === String(field.Id))) return;
    list.push({ Id: field.Id, Type: "Sum" });
    setFormValue("StatisticsFields", typeof original === "string" ? JSON.stringify(list) : list);
}

function selectedApiEngineKeys() {
    const metrics = listView.value?.Layout?.Hero?.Metrics;
    if (!Array.isArray(metrics)) return [];
    return Array.from(new Set(metrics.map((item) => String(item?.ApiEngineKey || "").trim()).filter(Boolean)));
}

function normalizeApiEngine(item) {
    return item && item.ApiEngineKey
        ? { ApiName: item.ApiName || "", ApiEngineKey: item.ApiEngineKey, IsEnable: item.IsEnable }
        : null;
}

function mergeApiEngineOptions(items, replaceSearchResults = false) {
    const selected = new Set(selectedApiEngineKeys());
    const base = replaceSearchResults
        ? apiEngines.value.filter((item) => selected.has(item.ApiEngineKey))
        : apiEngines.value;
    const result = new Map(base.map((item) => [item.ApiEngineKey, item]));
    (items || []).map(normalizeApiEngine).filter(Boolean).forEach((item) => result.set(item.ApiEngineKey, item));
    selected.forEach((key) => {
        if (!result.has(key)) result.set(key, { ApiName: "", ApiEngineKey: key, IsEnable: 1 });
    });
    apiEngines.value = Array.from(result.values());
}

async function loadSelectedApiEngines() {
    const keys = selectedApiEngineKeys();
    if (keys.length === 0) return;
    mergeApiEngineOptions(keys.map((key) => ({ ApiEngineKey: key, IsEnable: 1 })));
    const chunks = [];
    for (let index = 0; index < keys.length; index += 50) chunks.push(keys.slice(index, index + 50));
    try {
        const results = await Promise.all(chunks.map((chunk) => DiyCommon.FormEngine.GetTableData("sys_apiengine", {
            _SelectFields: ["ApiName", "ApiEngineKey", "IsEnable"],
            _Where: [["IsDeleted", "<>", 1], ["ApiEngineKey", "In", chunk]],
            _OrderBy: "ApiName",
            _OrderByType: "ASC",
            _PageIndex: 1,
            _PageSize: 50
        })));
        mergeApiEngineOptions(results.flatMap((result) => result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : []));
    } catch (error) {
        console.warn("[ModulePresentationDesigner] 已选接口引擎回填失败", error);
    }
}

function searchApiEngines(keyword) {
    clearTimeout(apiEngineSearchTimer);
    const requestId = ++apiEngineRequestId;
    apiEnginesLoading.value = true;
    apiEngineSearchTimer = setTimeout(() => void fetchApiEngines(keyword, requestId), 180);
}

function onApiEngineVisibleChange(visible) {
    if (!visible) return;
    clearTimeout(apiEngineSearchTimer);
    const requestId = ++apiEngineRequestId;
    apiEnginesLoading.value = true;
    void fetchApiEngines("", requestId);
}

async function fetchApiEngines(keyword, requestId) {
    const text = String(keyword || "").trim();
    const where = [["IsDeleted", "<>", 1]];
    if (text) {
        where.push(["AND", "(", "ApiName", "Like", text]);
        where.push(["OR", "ApiEngineKey", "Like", text, ")"]);
    }
    try {
        const result = await DiyCommon.FormEngine.GetTableData("sys_apiengine", {
            _SelectFields: ["ApiName", "ApiEngineKey", "IsEnable"],
            _Where: where,
            _OrderBy: "ApiName",
            _OrderByType: "ASC",
            _PageIndex: 1,
            _PageSize: 50
        });
        if (requestId !== apiEngineRequestId) return;
        mergeApiEngineOptions(result && Number(result.Code) === 1 && Array.isArray(result.Data) ? result.Data : [], true);
    } catch (error) {
        if (requestId !== apiEngineRequestId) return;
        console.warn("[ModulePresentationDesigner] 搜索接口引擎失败", error);
    } finally {
        if (requestId === apiEngineRequestId) apiEnginesLoading.value = false;
    }
}

function readFormField(name) {
    for (const item of formModelCandidates.value) {
        const value = item?.[name];
        if (value !== undefined && value !== null && value !== "") return value;
    }
    return formModel.value?.[name];
}
function apiEngineLabel(item) { return item.ApiName ? `${item.ApiName}（${item.ApiEngineKey}）` : item.ApiEngineKey; }
function canonical(value) { return String(value || "").trim().toLowerCase(); }
function isRoleless(view) {
    return [view.RoleIds, view.roleIds, view.Roles, view.roles].every((value) => {
        if (value === undefined || value === null || value === "") return true;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === "string") {
            const text = value.trim();
            if (!text) return true;
            try { return Array.isArray(JSON.parse(text)) && JSON.parse(text).length === 0; } catch (error) { return false; }
        }
        return false;
    });
}
function toBoolean(value) { return [true, 1, "1", "true"].includes(value); }
function normalizeConfigVersion(value) {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 ? number : 0;
}
function cloneJson(value) { return JSON.parse(JSON.stringify(value || {})); }
function stringifyInput(value) {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object") {
        try { return JSON.stringify(value, null, 2); } catch (error) { return ""; }
    }
    return "";
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

defineExpose({ flushPendingSync });
</script>

<style scoped lang="scss">
.module-presentation-designer {
    width: 100%;
    min-width: 0;
    color: var(--mci-text-primary, var(--el-text-color-primary));
    box-sizing: border-box;
}
.designer-head,
.card-head,
.block-head,
.subsection-head,
.designer-footer,
.head-actions,
.inline-actions,
.context-row,
.enable-control {
    display: flex;
    align-items: center;
}
.designer-head {
    justify-content: space-between;
    gap: 16px;
    min-height: 54px;
    padding: 10px 12px;
    border: 1px solid var(--mci-border-color, var(--el-border-color-light));
    border-radius: 6px;
    background: var(--mci-bg-soft, var(--el-fill-color-lighter));
}
.designer-title { font-size: 16px; line-height: 22px; font-weight: 700; }
.designer-subtitle,
.form-tip,
.subsection-head span,
.context-id {
    color: var(--mci-text-secondary, var(--el-text-color-secondary));
    font-size: 12px;
    line-height: 18px;
}
.context-row { gap: 8px; margin-top: 5px; }
.head-actions { gap: 12px; flex-wrap: wrap; justify-content: flex-end; }
.enable-control { gap: 8px; font-size: 13px; }
.designer-alert { margin-top: 10px; }
.designer-tabs { margin-top: 8px; }
.module-presentation-designer :deep(.designer-tabs .el-tabs__item.is-active) {
    color: var(--mci-presentation-primary-text, #1d4ed8) !important;
    font-weight: 700;
}
.module-presentation-designer :deep(.designer-tabs > .el-tabs__content) { max-height: none !important; overflow: visible !important; }
.designer-card {
    min-width: 0;
    padding: 12px;
    border: 1px solid var(--mci-border-color, var(--el-border-color-light));
    border-radius: 6px;
    background: var(--mci-bg-card, var(--el-bg-color));
    box-sizing: border-box;
}
.designer-card + .designer-card { margin-top: 10px; }
.card-head { justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.card-title { font-size: 14px; line-height: 20px; font-weight: 650; }
.hero-form { display: grid; grid-template-columns: minmax(160px, .7fr) minmax(220px, 1fr) minmax(300px, 1.6fr); gap: 10px; }
.hero-form :deep(.el-form-item) { margin-bottom: 0; }
.metric-row {
    display: grid;
    grid-template-columns: 110px 120px 110px minmax(150px, 1fr) minmax(180px, 1.2fr) minmax(155px, 1fr) 72px 72px 100px 34px 118px 34px;
    gap: 6px;
    align-items: center;
    padding: 8px 0;
    border-top: 1px solid var(--mci-border-color-light, var(--el-border-color-lighter));
}
.metric-row:first-of-type { border-top: 0; }
.metric-row :deep(.el-input-number) { width: 100%; }
.inline-actions { gap: 8px; flex-wrap: wrap; }
.config-block {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid var(--mci-border-color-light, var(--el-border-color-lighter));
    border-left: 3px solid var(--el-color-primary);
    border-radius: 5px;
    background: var(--mci-bg-card, var(--el-bg-color));
}
.block-head { display: grid; grid-template-columns: 28px minmax(220px, 1fr) 140px 110px 34px; gap: 8px; }
.block-index {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 4px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    font-weight: 700;
}
.subsection { margin-top: 9px; padding-top: 8px; border-top: 1px dashed var(--mci-border-color, var(--el-border-color)); }
.subsection-head { justify-content: space-between; gap: 10px; min-height: 28px; }
.subsection-head b { margin-right: 8px; font-size: 13px; }
.descriptor-row { margin-top: 6px; }
.descriptor-editor {
    display: grid;
    grid-template-columns: minmax(170px, 1fr) minmax(150px, .9fr) 105px 34px 96px 34px;
    gap: 6px;
    align-items: center;
}
.descriptor-switch { display: flex; align-items: center; justify-content: space-between; gap: 5px; color: var(--el-text-color-regular); font-size: 12px; }
.card-core-grid { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(220px, 1fr) 130px 150px 150px; gap: 10px; align-items: end; }
.compact-field { display: flex; flex-direction: column; gap: 6px; color: var(--el-text-color-regular); font-size: 12px; }
.toggle-field { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; padding: 0 8px; border: 1px solid var(--el-border-color-lighter); border-radius: 4px; font-size: 12px; }
.zone-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-top: 10px; }
.zone-grid .designer-card { margin-top: 0; }
.zone-head { margin-bottom: 4px; }
.descriptor-row--card .descriptor-editor { grid-template-columns: minmax(140px, 1fr) minmax(130px, .8fr) 95px 34px 92px 34px; }
.json-card :deep(textarea) { font-family: Consolas, "SFMono-Regular", monospace; font-size: 12px; line-height: 1.55; tab-size: 2; }
.json-error { margin-top: 8px; }
.designer-footer {
    justify-content: space-between;
    gap: 12px;
    margin-top: 10px;
    padding: 8px 10px;
    border-radius: 4px;
    background: var(--mci-bg-soft, var(--el-fill-color-light));
    color: var(--mci-text-secondary, var(--el-text-color-secondary));
    font-size: 12px;
}
.dirty-text { color: var(--el-color-warning); }

@media (max-width: 1500px) {
    .metric-row { grid-template-columns: 100px 110px 100px minmax(135px, 1fr) minmax(160px, 1.1fr) minmax(140px, 1fr) 64px 64px 92px 34px 106px 34px; }
    .card-core-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)) repeat(3, 130px); }
}
@media (max-width: 1180px) {
    .metric-row { grid-template-columns: repeat(4, minmax(130px, 1fr)); }
    .metric-row > :last-child { justify-self: end; }
    .zone-grid { grid-template-columns: 1fr; }
    .card-core-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); }
}
@media (max-width: 760px) {
    .designer-head, .card-head, .designer-footer { align-items: flex-start; flex-direction: column; }
    .hero-form, .metric-row, .block-head, .descriptor-editor, .descriptor-row--card .descriptor-editor, .card-core-grid { grid-template-columns: 1fr; }
    .head-actions { justify-content: flex-start; }
    .zone-grid { grid-template-columns: 1fr; }
}
</style>
