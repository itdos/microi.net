<template>
    <!-- 富文本编辑器组件 -->
    <div v-if="FormMode != 'View' && modelValue != undefined">
        <div style="border: 1px solid #ccc">
            <Toolbar 
                :editor="editorRef" 
                :defaultConfig="toolbarConfig" 
                :mode="mode" 
                style="border-bottom: 1px solid #ccc" 
            />
            <Editor
                :defaultConfig="editorConfig"
                :mode="mode"
                v-model="localValue"
                style="height: 400px; overflow-y: hidden"
                @onCreated="handleCreated"
                @onChange="handleChange"
                @onDestroyed="handleDestroyed"
                @onFocus="handleFocus"
                @onBlur="handleBlur"
                @customAlert="customAlert"
                @customPaste="customPaste"
            />
        </div>
    </div>
    <div v-else>
        <!-- 预览模式 -->
        <div v-html="modelValue"></div>
    </div>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="富文本配置"
        width="400px"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
    >
        <el-form label-width="100px" label-position="top" size="small">
            <el-form-item label="编辑器">
                <el-radio-group v-model="configForm.EditorProduct">
                    <el-radio value="WangEditor">WangEditor</el-radio>
                    <el-radio value="UEditor">UEditor</el-radio>
                </el-radio-group>
                <div class="form-item-tip">目前默认使用 WangEditor</div>
            </el-form-item>
        </el-form>
        <template #footer>
            <el-button @click="configDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveConfig">确定</el-button>
        </template>
    </el-dialog>
</template>

<script setup>
import { ref, computed, getCurrentInstance, watch, onBeforeUnmount } from 'vue';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import '@wangeditor/editor/dist/css/style.css'; // 导入编辑器样式

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

// Props
const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    field: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ''
    }
});

// Emits
const emit = defineEmits(['update:modelValue', 'CallbackRunV8Code']);

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

// 响应式数据
const editorRef = ref(null);
const mode = ref('default');
const toolbarConfig = ref({});

// 本地值（双向绑定）
const localValue = computed({
    get() {
        return props.modelValue;
    },
    set(value) {
        emit('update:modelValue', value);
    }
});

// 编辑器配置
const editorConfig = computed(() => {
    return {
        placeholder: '请输入内容...',
        MENU_CONF: {
            uploadImage: {
                server: DiyCommon.GetApiBase() + '/apiengine/hdfs/upload',
                maxFileSize: 20 * 1024 * 1024, // 20M
                meta: {
                    Path: 'editor'
                },
                headers: {
                    authorization: 'Bearer ' + DiyCommon.getToken()
                },
                timeout: 60 * 1000
            },
            uploadVideo: {
                server: DiyCommon.GetApiBase() + '/apiengine/hdfs/upload',
                maxFileSize: 200 * 1024 * 1024, // 200M
                meta: {
                    Path: 'editor'
                },
                headers: {
                    authorization: 'Bearer ' + DiyCommon.getToken()
                },
                timeout: 60 * 1000 * 100
            }
        }
    };
});

// 编辑器生命周期事件
const handleCreated = (editor) => {
    editorRef.value = Object.seal(editor);
};

const handleChange = (editor) => {
    // 值变化时自动通过 v-model 更新
};

const handleDestroyed = (editor) => {
    // 编辑器销毁
};

const handleFocus = (editor) => {
    // 聚焦
};

const handleBlur = (editor) => {
    // 失焦
};

const customAlert = (info, type) => {
    // 自定义提示
};

const customPaste = (editor, event, callback) => {
    callback(true); // 继续默认的粘贴行为
};

// 组件卸载时销毁编辑器
onBeforeUnmount(() => {
    if (editorRef.value) {
        try {
            editorRef.value.destroy();
            editorRef.value = null;
        } catch (error) {
            // ignore
        }
    }
});

// ==================== 配置弹窗相关 ====================
const configDialogVisible = ref(false);
const configForm = ref({
    EditorProduct: 'WangEditor'
});

const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.RichText) {
        props.field.Config.RichText = {};
    }
    configForm.value = {
        EditorProduct: props.field.Config.RichText.EditorProduct || 'WangEditor'
    };
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.RichText) {
        props.field.Config.RichText = {};
    }
    props.field.Config.RichText.EditorProduct = configForm.value.EditorProduct;
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>

<style scoped>
/* 富文本编辑器样式 */
.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
