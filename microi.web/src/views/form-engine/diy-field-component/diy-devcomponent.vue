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

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="开发组件配置"
        width="500px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="组件名称">
                <el-input v-model="configForm.DevComponentName" placeholder="如：MyCustomComponent" />
                <div class="form-item-tip">开发组件的名称，需与注册的组件名一致</div>
            </el-form-item>
            
            <el-form-item label="组件路径">
                <el-input v-model="configForm.DevComponentPath" placeholder="如：@/views/custom/MyComponent.vue" />
                <div class="form-item-tip">开发组件的文件路径，用于动态导入组件</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, reactive, getCurrentInstance } from "vue";
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

// 配置弹窗相关
const configDialogVisible = ref(false);
const configForm = reactive({
    DevComponentName: '',
    DevComponentPath: ''
});

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

// 打开配置弹窗
const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    configForm.DevComponentName = props.field.Config.DevComponentName || '';
    configForm.DevComponentPath = props.field.Config.DevComponentPath || '';
    configDialogVisible.value = true;
};

// 保存配置
const saveConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    props.field.Config.DevComponentName = configForm.DevComponentName;
    props.field.Config.DevComponentPath = configForm.DevComponentPath;
    
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供外部调用
defineExpose({
    openConfig,
    saveConfig
});
</script>

<style lang="scss" scoped>
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
