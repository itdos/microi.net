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
        <component
            v-if="!DiyCommon.IsNull(DevComponents[field.Config.DevComponentName]) && !DiyCommon.IsNull(DevComponents[field.Config.DevComponentName].Path)"
            :is="field.Config.DevComponentName"
            :TableRowId="TableRowId"
            :DataAppend="GetDataAppend(field)"
            @FormSet="FormSet"
            :pageLifetimes="pageLifetimes"
        />
    </el-form-item>
</template>

<script setup>
import { getCurrentInstance } from "vue";
import { InfoFilled } from "@element-plus/icons-vue";

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
    TableRowId: {
        type: String,
        default: ""
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    DevComponents: {
        type: Object,
        default: () => ({})
    },
    pageLifetimes: {
        type: Object,
        default: () => ({})
    }
});

const emit = defineEmits(["update:modelValue", "FormSet"]);

const { proxy } = getCurrentInstance();
const DiyCommon = proxy.DiyCommon;

const GetFieldIsShow = (field) => {
    return DiyCommon.IsNull(field.Visible) ? true : field.Visible;
};

const GetFormItemLabel = (field) => {
    return field.Label || field.Name;
};

const GetDataAppend = (field) => {
    if (DiyCommon.IsNull(field.DataAppend)) {
        return {};
    }
    if (typeof field.DataAppend == "string") {
        return JSON.parse(field.DataAppend);
    }
    return field.DataAppend;
};

const FormSet = (data) => {
    emit("FormSet", data);
};
</script>
