<template>
    <!-- 富文本编辑器组件 -->
    <div v-if="FormMode != 'View' && modelValue != undefined">
        <div class="richtext-editor-wrap">
            <Toolbar 
                :editor="editorRef" 
                :defaultConfig="toolbarConfig" 
                :mode="mode" 
                class="richtext-toolbar"
            />
            <Editor
                v-show="!sourceCodeVisible"
                :defaultConfig="editorConfig"
                :mode="mode"
                v-model="localValue"
                class="richtext-wysiwyg"
                @onCreated="handleCreated"
                @onChange="handleChange"
                @onDestroyed="handleDestroyed"
                @onFocus="handleFocus"
                @onBlur="handleBlur"
                @customAlert="customAlert"
                @customPaste="customPaste"
            />
            <textarea
                v-show="sourceCodeVisible"
                class="richtext-source-code"
                :value="sourceCodeValue"
                spellcheck="false"
                placeholder="请输入 HTML 源代码..."
                @input="handleSourceCodeInput"
            ></textarea>
        </div>
    </div>
    <div v-else>
        <!-- 预览模式 -->
        <div v-safe-html="modelValue"></div>
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
        draggable
        align-center
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
import { ref, computed, getCurrentInstance, watch, onBeforeUnmount, nextTick } from 'vue';
import { Editor, Toolbar } from '@wangeditor/editor-for-vue';
import { Boot } from '@wangeditor/editor';
import '@wangeditor/editor/dist/css/style.css'; // 导入编辑器样式

const SOURCE_CODE_MENU_KEY = 'microiSourceCode';
const getSourceCodeMenuStates = () => {
    if (typeof window === 'undefined') {
        return new WeakMap();
    }
    if (!window.__MICROI_RICHTEXT_SOURCE_CODE_MENU_STATES__) {
        window.__MICROI_RICHTEXT_SOURCE_CODE_MENU_STATES__ = new WeakMap();
    }
    return window.__MICROI_RICHTEXT_SOURCE_CODE_MENU_STATES__;
};
const sourceCodeMenuStates = getSourceCodeMenuStates();

class SourceCodeMenu {
    constructor() {
        this.title = '源码';
        this.iconSvg = '<svg viewBox="0 0 1024 1024"><path d="M377.6 249.6 115.2 512l262.4 262.4-90.4 90.4L0 577.6V446.4l287.2-287.2 90.4 90.4zm268.8 0 90.4-90.4L1024 446.4v131.2L736.8 864.8l-90.4-90.4L908.8 512 646.4 249.6zM574.4 96 448 928h-126.4L448 96h126.4z"></path></svg>';
        this.tag = 'button';
        this.alwaysEnable = true;
    }

    getValue(editor) {
        return sourceCodeMenuStates.get(editor)?.isActive() || false;
    }

    isActive(editor) {
        return sourceCodeMenuStates.get(editor)?.isActive() || false;
    }

    isDisabled() {
        return false;
    }

    exec(editor) {
        sourceCodeMenuStates.get(editor)?.toggle();
    }
}

const registerSourceCodeMenu = () => {
    try {
        Boot.registerMenu({
            key: SOURCE_CODE_MENU_KEY,
            factory() {
                return new SourceCodeMenu();
            }
        });
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        const lowerMessage = message.toLowerCase();
        if (!message.includes(SOURCE_CODE_MENU_KEY)
            && !lowerMessage.includes('duplicated')
            && !lowerMessage.includes('already')) {
            console.warn('[DiyRichText] 注册源码菜单失败：', error);
        }
    }
};

registerSourceCodeMenu();

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
const sourceCodeVisible = ref(false);
const sourceCodeValue = ref('');
const toolbarConfig = computed(() => {
    return {
        insertKeys: {
            index: 0,
            keys: [SOURCE_CODE_MENU_KEY]
        }
    };
});

// 本地值（双向绑定）
const localValue = computed({
    get() {
        return props.modelValue;
    },
    set(value) {
        emit('update:modelValue', value);
    }
});

const getCurrentHtml = () => {
    if (editorRef.value && !editorRef.value.isDestroyed) {
        return editorRef.value.getHtml();
    }
    return localValue.value || '';
};

const syncEditorFromSource = () => {
    const html = sourceCodeValue.value || '';
    localValue.value = html;
    if (editorRef.value && !editorRef.value.isDestroyed) {
        editorRef.value.setHtml(html);
    }
};

const toggleSourceCode = () => {
    if (sourceCodeVisible.value) {
        syncEditorFromSource();
        sourceCodeVisible.value = false;
        nextTick(() => {
            editorRef.value?.focus?.(true);
        });
        return;
    }

    sourceCodeValue.value = getCurrentHtml();
    localValue.value = sourceCodeValue.value;
    editorRef.value?.blur?.();
    sourceCodeVisible.value = true;
};

const handleSourceCodeInput = (event) => {
    sourceCodeValue.value = event.target.value;
    localValue.value = sourceCodeValue.value;
};

watch(
    () => props.modelValue,
    (value) => {
        if (sourceCodeVisible.value && value !== sourceCodeValue.value) {
            sourceCodeValue.value = value || '';
        }
    }
);

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
    sourceCodeMenuStates.set(editor, {
        isActive: () => sourceCodeVisible.value,
        toggle: toggleSourceCode
    });
};

const handleChange = (editor) => {
    // 值变化时自动通过 v-model 更新
    if (!sourceCodeVisible.value) {
        sourceCodeValue.value = editor.getHtml();
    }
};

const handleDestroyed = (editor) => {
    // 编辑器销毁
    sourceCodeMenuStates.delete(editor);
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
            sourceCodeMenuStates.delete(editorRef.value);
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
.richtext-editor-wrap {
    border: 1px solid #ccc;
}

.richtext-toolbar {
    border-bottom: 1px solid #ccc;
}

.richtext-wysiwyg {
    height: 400px;
    overflow-y: hidden;
}

.richtext-source-code {
    display: block;
    width: 100%;
    height: 400px;
    box-sizing: border-box;
    padding: 12px;
    border: 0;
    outline: none;
    resize: vertical;
    font-family: Consolas, Monaco, 'Courier New', monospace;
    font-size: 13px;
    line-height: 1.6;
    color: #d4d4d4;
    background: #1f1f1f;
    tab-size: 4;
    overflow: auto;
    white-space: pre;
}

.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}
</style>
