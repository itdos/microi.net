<template>
    <DiyTableChildComponent
        v-if="shouldRender"
        :TypeFieldName="'refJoinTable_' + field.Name"
        :ref="'refJoinTable_' + field.Name"
        :key="'refJoinTable_' + field.Id"
        :LoadMode="LoadMode"
        :PropsTableType="'JoinTable'"
        :props-is-join-table="true"
        :join-table-field="field"
        :PropsTableId="field.Config.JoinTable.TableId"
        :PropsSysMenuId="field.Config.JoinTable.ModuleId"
        :ContainerClass="'table-child'"
        :PropsWhere="GetPropsSearch(field)"
        :ParentFormLoadFinish="ParentFormLoadFinish"
        @CallbakRefreshChildTable="handleCallbakRefreshChildTable"
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
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    ParentFormLoadFinish: {
        type: Boolean,
        default: false
    }
});

const emit = defineEmits(["update:modelValue", "CallbakRefreshChildTable"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 检查是否应该渲染关联表格
const shouldRender = computed(() => {
    return (
        props.field.Component == "JoinTable" &&
        props.field.Config &&
        props.field.Config.JoinTable &&
        props.field.Config.JoinTable.TableId &&
        GetFieldIsShow(props.field)
    );
});

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const GetPropsSearch = (field) => {
    if (field.Config.JoinTable.Where) {
        try {
            return JSON.parse(field.Config.JoinTable.Where);
        } catch (error) {
            return [];
        }
    }
    return [];
};

// 事件转发
const handleCallbakRefreshChildTable = (...args) => {
    emit("CallbakRefreshChildTable", ...args);
};
</script>
