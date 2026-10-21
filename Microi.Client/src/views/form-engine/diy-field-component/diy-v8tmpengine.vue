<template>
    <el-form-item v-show="GetFieldIsShow(field)" class="form-item diy-v8-template-item">
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
        <div class="diy-v8-template-content" v-safe-html:template="FormDiyTableModel[field.Name + '_TmpEngineResult']"></div>
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

<style scoped>
.diy-v8-template-item,
.diy-v8-template-content {
    width: 100%;
    min-width: 0;
}

.diy-v8-template-content {
    flex: 1 1 100%;
}
</style>
