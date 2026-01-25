<template>
    <DiyTableChildComponent
        v-if="shouldRender"
        :TypeFieldName="'refTableChild_' + field.Name"
        :ref="'refTableChild_' + field.Name"
        :key="'refTableChild_' + field.Id"
        :LoadMode="LoadMode"
        :PropsTableType="'TableChild'"
        :TableChildTableRowId="getTableChildTableRowId()"
        :ContainerClass="'table-child'"
        :TableChildConfig="field.Config.TableChild"
        :TableChildField="field"
        :TableChildFieldLabel="field.Label"
        :TableChildTableId="field.Config.TableChildTableId"
        :TableChildSysMenuId="field.Config.TableChildSysMenuId"
        :TableChildFkFieldName="field.Config.TableChildFkFieldName"
        :TableChildPrimaryableFieldName="field.Config.TableChild.PrimaryTableFieldName"
        :TableChildCallbackField="field.Config.TableChildCallbackField"
        :TableChildFormMode="FormMode"
        :FatherFormModel="FormDiyTableModel"
        :ParentV8="ParentV8"
        :TableChildData="field.Config.TableChild.Data"
        :SearchAppend="field.Config.TableChild.SearchAppend"
        :ParentFormLoadFinish="ParentFormLoadFinish"
        @ParentFormSet="handleParentFormSet"
        @CallbackParentFormSubmit="handleCallbackParentFormSubmit"
        @CallbakRefreshChildTable="handleCallbakRefreshChildTable"
        @CallbackShowTableChildHideField="handleCallbackShowTableChildHideField"
    />
</template>

<script setup>
import { computed, defineAsyncComponent, getCurrentInstance } from "vue";

const DiyTableChildComponent = defineAsyncComponent(() => import("@/views/diy/diy-table-rowlist"));

const props = defineProps({
    modelValue: {},
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
    TableRowId: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    ParentV8: {
        type: Object,
        default: () => ({})
    },
    ParentFormLoadFinish: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits([
    "update:modelValue",
    "ParentFormSet",
    "CallbackParentFormSubmit",
    "CallbakRefreshChildTable",
    "CallbackShowTableChildHideField"
]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 检查是否应该渲染子表
const shouldRender = computed(() => {
    return (
        props.field.Component == "TableChild" &&
        !DiyCommon.IsNull(props.field.Config.TableChildTableId) &&
        !DiyCommon.IsNull(props.field.Config.TableChildSysMenuId) &&
        !DiyCommon.IsNull(props.TableRowId) &&
        GetFieldIsShow(props.field)
    );
});

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const getTableChildTableRowId = () => {
    if (props.field.Config.TableChild.PrimaryTableFieldName) {
        return props.FormDiyTableModel[props.field.Config.TableChild.PrimaryTableFieldName];
    }
    return props.TableRowId;
};

// 事件转发
const handleParentFormSet = (...args) => {
    emit("ParentFormSet", ...args);
};

const handleCallbackParentFormSubmit = (...args) => {
    emit("CallbackParentFormSubmit", ...args);
};

const handleCallbakRefreshChildTable = (...args) => {
    emit("CallbakRefreshChildTable", ...args);
};

const handleCallbackShowTableChildHideField = (...args) => {
    emit("CallbackShowTableChildHideField", ...args);
};
</script>
