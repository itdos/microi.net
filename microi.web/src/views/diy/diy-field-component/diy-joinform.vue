<template>
    <DiyFormChildComponent
        v-if="shouldRender"
        :ref="joinFormRef => joinFormInstance = joinFormRef"
        :key="'refJoinForm_' + field.Id"
        :FormMode="getJoinFormMode()"
        :TableId="field.Config.JoinForm.TableId"
        :TableName="field.Config.JoinForm.TableName"
        :TableRowId="field.Config.JoinForm.Id"
    />
</template>

<script setup>
import { ref, computed, defineAsyncComponent, getCurrentInstance } from "vue";

const DiyFormChildComponent = defineAsyncComponent(() => import("@/views/diy/diy-form"));

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

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
    TableId: {
        type: String,
        default: ""
    },
    TableName: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

// 关联表单组件实例引用
const joinFormInstance = ref(null);

// 检查是否应该渲染关联表单
const shouldRender = computed(() => {
    if (props.field.Component != "JoinForm") {
        return false;
    }

    if (!props.field.Config || !props.field.Config.JoinForm) {
        return false;
    }

    const config = props.field.Config.JoinForm;

    // 检查表ID或表名是否与当前表不同
    const tableDifferent =
        (!DiyCommon.IsNull(config.TableId) && props.TableId != config.TableId) ||
        (!DiyCommon.IsNull(config.TableName) && props.TableName != config.TableName);

    if (!tableDifferent) {
        return false;
    }

    // 检查是否有ID或搜索条件
    const hasIdOrSearch = !DiyCommon.IsNull(config.Id) || (config._SearchEqual && config._SearchEqual != {});

    if (!hasIdOrSearch) {
        return false;
    }

    return GetFieldIsShow(props.field);
});

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const getJoinFormMode = () => {
    if (props.field.Config && props.field.Config.JoinForm) {
        return DiyCommon.IsNull(props.field.Config.JoinForm.FormMode) ? props.FormMode : props.field.Config.JoinForm.FormMode;

// 暴露方法供父组件调用（转发到内部表单组件）
defineExpose({
    // 转发所有需要的方法到内部组件
    Init: (...args) => joinFormInstance.value?.Init?.(...args),
    FormSubmit: (...args) => joinFormInstance.value?.FormSubmit?.(...args),
    Clear: (...args) => joinFormInstance.value?.Clear?.(...args),
    GetFormData: (...args) => joinFormInstance.value?.GetFormData?.(...args),
    SetFormData: (...args) => joinFormInstance.value?.SetFormData?.(...args),
    // 暴露属性访问器
    get FormDiyTableModel() {
        return joinFormInstance.value?.FormDiyTableModel || {};
    }
});
    }
    return props.FormMode;
};
</script>
