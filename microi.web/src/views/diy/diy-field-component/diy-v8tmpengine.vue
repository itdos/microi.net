<template>
    <el-form-item v-show="GetFieldIsShow(field)" class="form-item">
        <template #label>
            <span :title="GetFormItemLabel(field)" :style="{ color: !field.Visible ? '#ccc' : '#000' }">
                <el-tooltip v-if="!DiyCommon.IsNull(field.Description)" class="item" effect="dark" :content="field.Description" placement="left">
                    <template #default>
                        <el-icon><InfoFilled /></el-icon>
                    </template>
                </el-tooltip>
                {{ GetFormItemLabel(field) }}
            </span>
        </template>
        <span v-html="FormDiyTableModel[field.Name + '_TmpEngineResult']"></span>
    </el-form-item>
</template>

<script setup>
import { getCurrentInstance } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";

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
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    }
});

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const GetFormItemLabel = (field) => {
    return field.Label || field.Name;
};
</script>
