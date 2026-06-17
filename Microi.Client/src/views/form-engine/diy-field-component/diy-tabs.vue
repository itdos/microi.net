<template>
    <div
        class="diy-field-tabs"
        :class="[
            'diy-field-tabs--' + theme,
            {
                'is-design': LoadMode === 'Design',
                'is-field-tabs-header': isRuntimeHeader
            }
        ]"
    >
        <div v-if="description" class="diy-field-tabs__desc" v-safe-html="description"></div>
        <el-tabs
            v-model="activeKey"
            class="diy-field-tabs__nav"
            :type="tabType"
            :tab-position="tabPosition"
            :stretch="stretch"
            @tab-change="handleTabChange"
        >
            <el-tab-pane
                v-for="pane in panes"
                :key="pane.Key"
                :name="pane.Key"
                :disabled="pane.Disabled === true"
            >
                <template #label>
                    <span class="diy-field-tabs__label" :class="{ 'is-active': pane.Key === activeKey }">
                        <fa-icon v-if="pane.Icon" :icon="pane.Icon" class="diy-field-tabs__icon" />
                        <span class="diy-field-tabs__title">{{ pane.Title }}</span>
                        <span
                            v-if="showFieldCount"
                            class="diy-field-tabs__count"
                            :style="getPaneCountStyle(pane)"
                        >
                            {{ getPaneCount(pane) }}
                        </span>
                    </span>
                </template>
            </el-tab-pane>
        </el-tabs>
    </div>

    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="字段页签配置"
        width="760px"
        draggable
        align-center
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="120px" label-position="top" size="small">
            <el-divider content-position="left">基础设置</el-divider>
            <el-row :gutter="12">
                <el-col :span="8" :xs="24">
                    <el-form-item label="分组方式">
                        <el-select v-model="configForm.ScopeMode" style="width: 100%">
                            <el-option label="按页签字段数" value="FieldCount" />
                            <el-option label="手动选择字段" value="Manual" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="总作用字段数">
                        <el-input-number v-model="configForm.TotalFieldCount" :min="0" :max="200" :step="1" />
                        <div class="form-item-tip">0 表示直到下一个页签分组</div>
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="默认页签">
                        <el-select v-model="configForm.DefaultActiveKey" style="width: 100%">
                            <el-option
                                v-for="pane in configForm.Tabs"
                                :key="'default_' + pane.Key"
                                :label="pane.Title || pane.Key"
                                :value="pane.Key"
                            />
                        </el-select>
                    </el-form-item>
                </el-col>
            </el-row>

            <el-row :gutter="12">
                <el-col :span="8" :xs="24">
                    <el-form-item label="页签样式">
                        <el-select v-model="configForm.Type" style="width: 100%">
                            <el-option label="简洁" value="" />
                            <el-option label="卡片" value="card" />
                            <el-option label="边框卡片" value="border-card" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="页签位置">
                        <el-select v-model="configForm.Position" style="width: 100%">
                            <el-option label="顶部" value="top" />
                            <el-option label="底部" value="bottom" />
                            <el-option label="左侧" value="left" />
                            <el-option label="右侧" value="right" />
                        </el-select>
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="拉伸铺满">
                        <el-switch v-model="configForm.Stretch" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="显示字段数">
                        <el-switch v-model="configForm.ShowFieldCount" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                </el-col>
                <el-col :span="8" :xs="24">
                    <el-form-item label="末页包含剩余字段">
                        <el-switch v-model="configForm.CaptureRest" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                </el-col>
            </el-row>

            <el-form-item label="说明文字">
                <el-input v-model="configForm.Description" type="textarea" :rows="2" placeholder="显示在页签上方，可为空" />
            </el-form-item>

            <el-divider content-position="left">页签项</el-divider>
            <div class="tabs-config-list">
                <div v-for="(pane, index) in configForm.Tabs" :key="'tab_config_' + index" class="tabs-config-item">
                    <div class="tabs-config-item__header">
                        <el-tag size="small" effect="plain">Tab {{ index + 1 }}</el-tag>
                        <div class="tabs-config-item__actions">
                            <el-button :icon="ArrowUp" circle :disabled="index === 0" @click="movePane(index, -1)" />
                            <el-button :icon="ArrowDown" circle :disabled="index === configForm.Tabs.length - 1" @click="movePane(index, 1)" />
                            <el-button :icon="Delete" circle type="danger" :disabled="configForm.Tabs.length <= 1" @click="removePane(index)" />
                        </div>
                    </div>
                    <el-row :gutter="12">
                        <el-col :span="6" :xs="24">
                            <el-form-item label="Key">
                                <el-input v-model="pane.Key" placeholder="tab1" />
                            </el-form-item>
                        </el-col>
                        <el-col :span="7" :xs="24">
                            <el-form-item label="标题">
                                <el-input v-model="pane.Title" placeholder="基础信息" />
                            </el-form-item>
                        </el-col>
                        <el-col :span="6" :xs="24">
                            <el-form-item label="图标">
                                <el-input v-model="pane.Icon" placeholder="fas fa-user">
                                    <template #prefix>
                                        <fa-icon v-if="pane.Icon" :icon="pane.Icon" />
                                    </template>
                                </el-input>
                            </el-form-item>
                        </el-col>
                        <el-col v-if="configForm.ScopeMode === 'FieldCount'" :span="5" :xs="24">
                            <el-form-item label="字段数">
                                <el-input-number v-model="pane.FieldCount" :min="1" :max="100" :step="1" />
                            </el-form-item>
                        </el-col>
                    </el-row>
                    <el-form-item v-if="configForm.ScopeMode === 'Manual'" label="手动字段">
                        <el-select
                            v-model="pane.FieldKeys"
                            multiple
                            filterable
                            collapse-tags
                            collapse-tags-tooltip
                            clearable
                            style="width: 100%"
                            placeholder="从总作用字段范围内选择字段"
                        >
                            <el-option
                                v-for="item in manualFieldOptions"
                                :key="'manual_field_' + item.Key"
                                :label="item.Label"
                                :value="item.Key"
                            >
                                <span style="float: left">{{ item.Label }}</span>
                                <span style="float: right; color: #8492a6; font-size: 12px">{{ item.Name }}</span>
                            </el-option>
                        </el-select>
                    </el-form-item>
                    <el-form-item label="禁用页签">
                        <el-switch v-model="pane.Disabled" active-color="#ff6c04" inactive-color="#ccc" />
                    </el-form-item>
                </div>
            </div>
            <el-button class="tabs-config-add" type="primary" plain :icon="Plus" @click="addPane">新增页签</el-button>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, getCurrentInstance, ref, watch } from "vue";
import { ArrowDown, ArrowUp, Delete, Plus } from "@element-plus/icons-vue";

defineOptions({
    name: "diy-tabs",
    inheritAttrs: false
});

const props = defineProps({
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ""
    },
    LoadMode: {
        type: String,
        default: ""
    },
    ParentFieldList: {
        type: Array,
        default: () => []
    }
});

const emit = defineEmits(["CallbackFieldTabsChange"]);

const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

const defaultPanes = () => [
    { Key: "tab1", Title: "基础信息", Icon: "fas fa-id-card", FieldCount: 4, Disabled: false },
    { Key: "tab2", Title: "扩展信息", Icon: "fas fa-layer-group", FieldCount: 4, Disabled: false }
];

const normalizeBoolean = (value, defaultValue) => {
    if (value === undefined || value === null || value === "") return defaultValue;
    return value === true || value === 1 || value === "1" || value === "true";
};

const normalizePanes = (tabs) => {
    var list = Array.isArray(tabs) && tabs.length > 0 ? tabs : defaultPanes();
    var usedKeys = {};
    return list.map((pane, index) => {
        var rawKey = pane && pane.Key ? String(pane.Key).trim() : "";
        var key = rawKey || ("tab" + (index + 1));
        if (usedKeys[key]) {
            key = key + "_" + (index + 1);
        }
        usedKeys[key] = true;
        var fieldCount = parseInt(pane && pane.FieldCount, 10);
        if (!fieldCount || fieldCount < 1) fieldCount = 1;
        return {
            Key: key,
            Title: (pane && (pane.Title || pane.Name || pane.Label)) || ("页签" + (index + 1)),
            Icon: (pane && pane.Icon) || "",
            FieldCount: fieldCount,
            FieldKeys: Array.isArray(pane && pane.FieldKeys) ? pane.FieldKeys.map((item) => String(item)) : [],
            FieldNames: Array.isArray(pane && pane.FieldNames) ? pane.FieldNames.map((item) => String(item)) : [],
            Disabled: normalizeBoolean(pane && pane.Disabled, false),
            _fieldCount: pane && pane._fieldCount !== undefined ? pane._fieldCount : undefined
        };
    });
};

const config = computed(() => {
    return props.field && props.field.Config && props.field.Config.FieldTabs ? props.field.Config.FieldTabs : {};
});

const panes = computed(() => {
    var runtimePanes = props.field && Array.isArray(props.field._fieldTabsPanes) && props.field._fieldTabsPanes.length > 0
        ? props.field._fieldTabsPanes
        : config.value.Tabs;
    return normalizePanes(runtimePanes);
});

const description = computed(() => config.value.Description || "");
const theme = computed(() => config.value.Theme || "default");
const isRuntimeHeader = computed(() => {
    return props.field && typeof props.field._collapseClass === "string" && props.field._collapseClass.indexOf("field-tabs-header") > -1;
});
const tabType = computed(() => {
    var type = config.value.Type || "";
    return type === "default" ? "" : type;
});
const tabPosition = computed(() => {
    var position = config.value.Position || "top";
    return ["top", "bottom", "left", "right"].indexOf(position) > -1 ? position : "top";
});
const stretch = computed(() => normalizeBoolean(config.value.Stretch, false));
const showFieldCount = computed(() => config.value.ShowFieldCount !== false);
const getDefaultActiveKey = () => {
    var paneList = panes.value;
    if (!paneList.length) return "";
    var configuredKey = props.field._fieldTabsActiveKey || config.value.DefaultActiveKey;
    var enabledPane = paneList.find((pane) => pane.Key === configuredKey && pane.Disabled !== true);
    if (enabledPane) return enabledPane.Key;
    var firstEnabled = paneList.find((pane) => pane.Disabled !== true);
    return (firstEnabled || paneList[0]).Key;
};

const getRuntimeActiveKey = () => {
    return props.field && props.field._fieldTabsActiveKey ? String(props.field._fieldTabsActiveKey) : "";
};

const activeKey = ref("");

watch(
    () => props.field && props.field._fieldTabsActiveKey,
    () => {
        var nextKey = getDefaultActiveKey();
        if (activeKey.value !== nextKey) {
            activeKey.value = nextKey;
        }
    },
    { immediate: true }
);

watch(
    panes,
    () => {
        var nextKey = getDefaultActiveKey();
        if (activeKey.value !== nextKey) {
            activeKey.value = nextKey;
        }
    },
    { deep: true, flush: "post" }
);

const getPaneCount = (pane) => {
    if (pane && pane._fieldCount !== undefined) return pane._fieldCount;
    return pane && pane.FieldCount ? pane.FieldCount : 0;
};

const getPaneCountStyle = (pane) => {
    if (!pane || pane.Key !== activeKey.value) return "";
    return "color: var(--field-tabs-color) !important; background-color: #fff !important; border-color: #fff !important;";
};

const handleTabChange = (key) => {
    var nextKey = String(key || "");
    if (!nextKey) return;
    activeKey.value = nextKey;
    if (nextKey === getRuntimeActiveKey()) {
        return;
    }
    emit("CallbackFieldTabsChange", props.field, nextKey);
};

const configDialogVisible = ref(false);
const configForm = ref({
    ScopeMode: "FieldCount",
    TotalFieldCount: 0,
    DefaultActiveKey: "tab1",
    Type: "card",
    Position: "top",
    Stretch: false,
    ShowFieldCount: true,
    CaptureRest: true,
    Description: "",
    Theme: "default",
    Tabs: defaultPanes()
});

const getFieldKey = (fieldModel) => {
    if (!fieldModel) return "";
    return String(fieldModel.Id || fieldModel.Name || "");
};

const manualFieldOptions = computed(() => {
    var fields = Array.isArray(props.ParentFieldList)
        ? props.ParentFieldList.slice().sort((a, b) => (a.Sort || 0) - (b.Sort || 0))
        : [];
    var currentKey = getFieldKey(props.field);
    var startIndex = fields.findIndex((item) => getFieldKey(item) === currentKey);
    if (startIndex < 0) return [];

    var total = parseInt(configForm.value.TotalFieldCount, 10);
    if (!total || total < 0) total = 0;

    var result = [];
    for (var index = startIndex + 1; index < fields.length; index++) {
        var item = fields[index];
        if (!item) continue;
        if (item.Component === "Tabs") break;
        var key = getFieldKey(item);
        if (!key) continue;
        result.push({
            Key: key,
            Name: item.Name || "",
            Label: item.Label || item.Name || key
        });
        if (total > 0 && result.length >= total) break;
    }
    return result;
});

const openConfig = () => {
    var cfg = config.value;
    var tabList = normalizePanes(cfg.Tabs);
    configForm.value = {
        ScopeMode: cfg.ScopeMode || "FieldCount",
        TotalFieldCount: Number(cfg.TotalFieldCount || 0),
        DefaultActiveKey: cfg.DefaultActiveKey || props.field._fieldTabsActiveKey || tabList[0].Key,
        Type: cfg.Type === "default" ? "" : (cfg.Type || "card"),
        Position: cfg.Position || "top",
        Stretch: normalizeBoolean(cfg.Stretch, false),
        ShowFieldCount: cfg.ShowFieldCount !== false,
        CaptureRest: cfg.CaptureRest !== false,
        Description: cfg.Description || "",
        Theme: cfg.Theme || "default",
        Tabs: tabList
    };
    configDialogVisible.value = true;
};

const addPane = () => {
    var nextIndex = configForm.value.Tabs.length + 1;
    configForm.value.Tabs.push({
        Key: "tab" + nextIndex,
        Title: "页签" + nextIndex,
        Icon: "",
        FieldCount: 4,
        FieldKeys: [],
        FieldNames: [],
        Disabled: false
    });
};

const removePane = (index) => {
    if (configForm.value.Tabs.length <= 1) return;
    configForm.value.Tabs.splice(index, 1);
};

const movePane = (index, direction) => {
    var target = index + direction;
    if (target < 0 || target >= configForm.value.Tabs.length) return;
    var item = configForm.value.Tabs.splice(index, 1)[0];
    configForm.value.Tabs.splice(target, 0, item);
};

const saveConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    var tabList = normalizePanes(configForm.value.Tabs);
    var active = configForm.value.DefaultActiveKey;
    if (!tabList.some((pane) => pane.Key === active)) {
        active = tabList[0].Key;
    }
    props.field.Config.FieldTabs = {
        ScopeMode: configForm.value.ScopeMode || "FieldCount",
        TotalFieldCount: Number(configForm.value.TotalFieldCount || 0),
        DefaultActiveKey: active,
        Type: configForm.value.Type || "",
        Position: configForm.value.Position || "top",
        Stretch: configForm.value.Stretch === true,
        ShowFieldCount: configForm.value.ShowFieldCount !== false,
        CaptureRest: configForm.value.CaptureRest !== false,
        Description: configForm.value.Description || "",
        Theme: configForm.value.Theme || "default",
        Tabs: tabList
    };
    configForm.value.DefaultActiveKey = active;
    activeKey.value = active;
    emit("CallbackFieldTabsChange", props.field, active, { force: true });
    configDialogVisible.value = false;
    DiyCommon.Tips("配置已保存", true);
};

defineExpose({
    openConfig
});
</script>

<style lang="scss" scoped>
.diy-field-tabs {
    --field-tabs-color: var(--el-color-primary);
    --field-tabs-bg: color-mix(in srgb, var(--field-tabs-color) 5%, var(--el-bg-color) 95%);
    --field-tabs-border: var(--el-border-color-light);
    width: 100%;
    min-height: 44px;
    border: 1px solid var(--field-tabs-border);
    border-radius: 8px;
    background: var(--field-tabs-bg);
    padding: 0;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        border-color: color-mix(in srgb, var(--field-tabs-color) 42%, var(--field-tabs-border) 58%);
    }

    &.is-field-tabs-header {
        border-radius: 8px 8px 0 0 !important;
    }

    &__desc {
        padding: 8px 12px 0;
        font-size: 12px;
        line-height: 18px;
        color: var(--el-text-color-secondary);
        word-break: break-word;
    }

    &__nav {
        --el-color-primary: var(--field-tabs-color);
    }

    &__label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 100%;
        line-height: 1;
        min-width: 0;
        max-width: 180px;

        &.is-active {
            .diy-field-tabs__icon {
                color: var(--color-primary-text, #fff) !important;
            }

            .diy-field-tabs__count {
                color: var(--field-tabs-color) !important;
                background-color: #fff !important;
                border-color: #fff !important;
            }
        }
    }

    &__title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    &__icon {
        flex: 0 0 auto;
        color: var(--field-tabs-color);
        line-height: 1;
    }

    &__count {
        flex: 0 0 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        line-height: 1;
        padding: 0 6px;
        border: 1px solid color-mix(in srgb, var(--field-tabs-color) 24%, transparent);
        border-radius: 999px;
        background: color-mix(in srgb, var(--field-tabs-color) 10%, var(--el-bg-color) 90%);
        color: var(--field-tabs-color);
        font-size: 12px;
        font-weight: 600;
        box-sizing: border-box;
    }

    :deep(.el-tabs__header) {
        display: block !important;
        margin: 0 !important;
        background: transparent !important;
        border: 0 !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        padding: 0 !important;
    }

    :deep(.el-tabs__nav-wrap) {
        display: flex !important;
        align-items: center !important;
        height: 42px !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: hidden !important;
    }

    :deep(.el-tabs__nav) {
        border: 0 !important;
        display: flex;
        align-items: center;
        gap: 6px;
        height: 42px !important;
        padding: 5px 12px;
        box-sizing: border-box;
        background: transparent !important;
        border-radius: 0 !important;
        box-shadow: none !important;
    }

    :deep(.el-tabs__item) {
        height: 32px;
        min-height: 32px;
        line-height: 1 !important;
        margin: 0 !important;
        padding: 0 14px;
        box-sizing: border-box;
        border: 1px solid transparent !important;
        border-radius: 6px !important;
        background: transparent !important;
        color: var(--el-text-color-regular);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        transition: color 0.2s ease, background 0.2s ease, border-color 0.2s ease;
    }

    :deep(.el-tabs__item:hover) {
        color: var(--field-tabs-color);
        background: color-mix(in srgb, var(--field-tabs-color) 8%, var(--el-bg-color) 92%) !important;
    }

    :deep(.el-tabs__item.is-active) {
        color: var(--color-primary-text, #fff) !important;
        background: var(--field-tabs-color) !important;
        border-color: var(--field-tabs-color) !important;
        box-shadow: 0 2px 6px color-mix(in srgb, var(--field-tabs-color) 22%, transparent);
    }

    :deep(.el-tabs__item.is-active .diy-field-tabs__icon) {
        color: var(--color-primary-text, #fff) !important;
    }

    :deep(.el-tabs__item.is-active .diy-field-tabs__count) {
        color: var(--field-tabs-color) !important;
        background-color: #fff !important;
        border-color: #fff !important;
    }

    :deep(.el-tabs__item.is-active::before) {
        display: none !important;
    }

    :deep(.el-tabs__content) {
        display: none;
    }

    :deep(.el-tabs__nav-wrap::after) {
        display: none;
    }

    &--success { --field-tabs-color: var(--el-color-success); }
    &--warning { --field-tabs-color: var(--el-color-warning); }
    &--danger { --field-tabs-color: var(--el-color-danger); }
}

:global(.field-tabs-header) .diy-field-tabs {
    border-radius: 8px 8px 0 0 !important;
}

:global(.field-tabs-header),
:global(.field-tabs-header > .container-form-item),
:global(.field-tabs-header .container-form-item > .el-form-item),
:global(.field-tabs-header .container-form-item > .el-form-item > .el-form-item__content) {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
}

.tabs-config-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.tabs-config-item {
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    padding: 10px 12px 4px;
    background: var(--el-fill-color-blank);

    &__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
    }

    &__actions {
        display: inline-flex;
        align-items: center;
        gap: 6px;

        :deep(.el-button) {
            width: 28px;
            height: 28px;
        }
    }
}

.tabs-config-add {
    margin-top: 12px;
}

@media (max-width: 768px) {
    .diy-field-tabs {
        padding: 6px 8px 0;

        &__label {
            max-width: 128px;
        }
    }
}
</style>
