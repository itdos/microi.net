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

//zhy：富文本上传统一使用接口引擎地址，并在实际请求时读取当前 API 地址。
const richTextUploadUrl = () => DiyCommon.GetApiBase() + '/apiengine/hdfs/upload';

//zhy：自定义上传绕过 WangEditor 默认 Uppy 后，继续保留字段级类型和大小限制。
const validateRichTextFile = (file, mediaType, maxFileSize) => {
    if (!file || !file.name || file.size <= 0) throw new Error('不能上传空文件');
    if (file.size > maxFileSize) {
        throw new Error(`文件不能超过${Math.round(maxFileSize / 1024 / 1024)}MB`);
    }
    if (file.type && !file.type.toLowerCase().startsWith(mediaType + '/')) {
        throw new Error(mediaType === 'image' ? '只能上传图片文件' : '只能上传视频文件');
    }
};

//zhy：每个富文本文件使用独立 multipart 请求，避免并发操作产生同名文件批次。
const uploadRichTextFile = async (file, options) => {
    const { fieldName, timeout, mediaType, maxFileSize } = options;
    validateRichTextFile(file, mediaType, maxFileSize);
    const formData = new FormData();
    formData.append('Path', 'editor');
    //zhy：WangEditor 默认上传器会复用 Uppy 且以 bundle 模式发送文件。并发粘贴/选择时，
    //zhy：未清理的文件可能再次进入后续请求。这里固定为一文件一请求，避免 multipart
    //zhy：中出现同名文件，同时保留服务端的重复文件名安全校验。
    formData.append(fieldName, file, file.name);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);
    const token = DiyCommon.getToken();
    const headers = token ? { authorization: 'Bearer ' + token } : {};

    try {
        const response = await fetch(richTextUploadUrl(), {
            method: 'POST',
            headers,
            body: formData,
            signal: controller.signal
        });
        const responseText = await response.text();
        let result = null;
        try {
            result = responseText ? JSON.parse(responseText) : null;
        } catch (error) {
            throw new Error('上传接口返回了无法识别的数据');
        }

        if (!response.ok || !result || Number(result.errno) !== 0) {
            throw new Error(result?.message || result?.Msg || `上传失败（HTTP ${response.status}）`);
        }
        return result.data;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error('上传超时，请检查网络后重试');
        }
        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
};

//zhy：向用户透传后端上传失败原因，便于区分文件限制、身份和存储错误。
const showRichTextUploadError = (file, error) => {
    const fileName = file?.name ? `“${file.name}”` : '文件';
    const message = error?.message || '未知错误';
    DiyCommon.Tips(`${fileName}上传失败：${message}`, false, 12);
    console.error('[DiyRichText] 上传失败：', error);
};

//zhy：图片上传成功后兼容 WangEditor 新旧两种 data 返回结构。
const uploadRichTextImage = async (file, insertFn) => {
    try {
        const data = await uploadRichTextFile(file, {
            fieldName: 'wangeditor-uploaded-image',
            timeout: 60 * 1000,
            mediaType: 'image',
            maxFileSize: 20 * 1024 * 1024
        });
        const items = Array.isArray(data) ? data : [data];
        let inserted = false;
        items.forEach((item) => {
            if (!item?.url) return;
            insertFn(item.url, item.alt || file.name, item.href || '');
            inserted = true;
        });
        if (!inserted) throw new Error('上传成功但未返回图片地址');
    } catch (error) {
        showRichTextUploadError(file, error);
    }
};

//zhy：视频同样采用单文件独立上传，并兼容数组形式的历史响应。
const uploadRichTextVideo = async (file, insertFn) => {
    try {
        const result = await uploadRichTextFile(file, {
            fieldName: 'wangeditor-uploaded-video',
            timeout: 60 * 1000 * 100,
            mediaType: 'video',
            maxFileSize: 200 * 1024 * 1024
        });
        const data = Array.isArray(result) ? result[0] : result;
        if (!data?.url) throw new Error('上传成功但未返回视频地址');
        insertFn(data.url, data.poster || '');
    } catch (error) {
        showRichTextUploadError(file, error);
    }
};

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
                maxFileSize: 20 * 1024 * 1024, // 20M
                //zhy：使用单文件自定义上传，避免 WangEditor bundle 重复打包。
                customUpload: uploadRichTextImage
            },
            uploadVideo: {
                maxFileSize: 200 * 1024 * 1024, // 200M
                //zhy：视频上传与图片保持相同的单文件请求策略。
                customUpload: uploadRichTextVideo
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
