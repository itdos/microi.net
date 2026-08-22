<template>
    <!-- 富文本编辑器组件 -->
    <div v-if="FormMode != 'View' && modelValue != undefined">
        <div class="richtext-editor-wrap">
            <div class="richtext-policy-bar" aria-label="富文本附件上传配置">
                <span class="richtext-policy-bar__title">附件策略</span>
                <span class="richtext-policy-chip" :class="richTextConfig.Limit ? 'is-private' : 'is-public'">
                    {{ richTextConfig.Limit ? '私有桶' : '公有桶' }}
                </span>
                <span class="richtext-policy-chip">
                    图片 {{ richTextConfig.Image.Enabled ? `${richTextConfig.Image.MaxSize}M` : '已关闭' }}
                </span>
                <span v-if="richTextConfig.Image.Enabled" class="richtext-policy-chip">
                    {{ richTextConfig.Image.Preview ? `压缩至 ${richTextConfig.Image.CompressMaxSize}KB` : '保留原尺寸' }}
                </span>
                <span class="richtext-policy-chip">
                    视频 {{ richTextConfig.Video.Enabled ? `${richTextConfig.Video.MaxSize}M` : '已关闭' }}
                </span>
                <span class="richtext-policy-chip">
                    文件 {{ richTextConfig.File.Enabled ? `${richTextConfig.File.MaxSize}M` : '已关闭' }}
                </span>
            </div>
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
                v-model="editorValue"
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
            <input
                ref="attachmentInputRef"
                class="richtext-attachment-input"
                type="file"
                :accept="richTextConfig.File.Accept"
                :multiple="richTextConfig.File.MaxCount > 1"
                @change="handleAttachmentFiles"
            />
        </div>
    </div>
    <div v-else>
        <!-- 预览模式 -->
        <div class="richtext-view-wrap" :class="{ 'is-resolving': privateAssetsResolving }">
            <div v-if="privateAssetsResolving" class="richtext-private-loading" role="status">
                正在安全加载私有附件…
            </div>
            <div v-safe-html="renderedValue" class="richtext-view-content"></div>
        </div>
    </div>

    <!-- 配置弹窗 - 设计模式下可用 -->
    <el-dialog
        v-if="configDialogVisible"
        v-model="configDialogVisible"
        title="富文本与附件配置"
        width="760px"
        style="--el-dialog-width: min(760px, calc(100vw - 32px)); width: min(760px, calc(100vw - 32px)) !important; max-width: calc(100vw - 32px) !important;"
        :close-on-click-modal="false"
        destroy-on-close
        append-to-body
        draggable
        align-center
        class="richtext-config-dialog"
    >
        <el-form label-position="top" size="default" class="richtext-config-form">
            <section class="richtext-storage-card">
                <div>
                    <div class="richtext-config-heading">统一存储范围</div>
                    <div class="form-item-tip">
                        图片、视频和附件使用同一存储策略；旧字段未配置时安全默认为私有桶。
                    </div>
                </div>
                <el-radio-group v-model="configForm.Limit" class="richtext-storage-choice">
                    <el-radio-button :value="true">私有桶</el-radio-button>
                    <el-radio-button :value="false">公有桶</el-radio-button>
                </el-radio-group>
            </section>

            <div class="richtext-storage-note" :class="configForm.Limit ? 'is-private' : 'is-public'">
                <template v-if="configForm.Limit">
                    正文只保存稳定对象标识，打开文章时按当前用户、菜单、记录和字段权限换取 30 分钟短效地址；不会保存临时 Token。
                </template>
                <template v-else>
                    适合官网公告等公开内容，正文保存可长期访问的公有地址。请勿上传敏感资料。
                </template>
            </div>

            <div class="richtext-media-grid">
                <section class="richtext-media-card">
                    <div class="richtext-media-card__header">
                        <div>
                            <div class="richtext-config-heading">图片</div>
                            <div class="form-item-tip">粘贴、拖入或工具栏上传</div>
                        </div>
                        <el-switch v-model="configForm.Image.Enabled" />
                    </div>
                    <template v-if="configForm.Image.Enabled">
                        <el-form-item label="单张最大体积（MB）">
                            <el-input-number v-model="configForm.Image.MaxSize" :min="1" :max="2048" controls-position="right" />
                        </el-form-item>
                        <el-form-item label="单次最多选择">
                            <el-input-number v-model="configForm.Image.MaxCount" :min="1" :max="100" controls-position="right" />
                        </el-form-item>
                        <div class="richtext-inline-setting">
                            <span>服务端压缩</span>
                            <el-switch v-model="configForm.Image.Preview" />
                        </div>
                        <template v-if="configForm.Image.Preview">
                            <el-form-item label="目标体积（KB）">
                                <el-input-number v-model="configForm.Image.CompressMaxSize" :min="50" :max="10240" controls-position="right" />
                            </el-form-item>
                            <el-form-item label="最大宽度（px）">
                                <el-input-number v-model="configForm.Image.CompressMaxWidth" :min="320" :max="12000" controls-position="right" />
                            </el-form-item>
                        </template>
                    </template>
                </section>

                <section class="richtext-media-card">
                    <div class="richtext-media-card__header">
                        <div>
                            <div class="richtext-config-heading">视频</div>
                            <div class="form-item-tip">上传后直接嵌入播放器</div>
                        </div>
                        <el-switch v-model="configForm.Video.Enabled" />
                    </div>
                    <template v-if="configForm.Video.Enabled">
                        <el-form-item label="单个最大体积（MB）">
                            <el-input-number v-model="configForm.Video.MaxSize" :min="1" :max="2048" controls-position="right" />
                        </el-form-item>
                        <el-form-item label="单次最多选择">
                            <el-input-number v-model="configForm.Video.MaxCount" :min="1" :max="20" controls-position="right" />
                        </el-form-item>
                    </template>
                </section>

                <section class="richtext-media-card">
                    <div class="richtext-media-card__header">
                        <div>
                            <div class="richtext-config-heading">文件附件</div>
                            <div class="form-item-tip">以安全下载链接插入正文</div>
                        </div>
                        <el-switch v-model="configForm.File.Enabled" />
                    </div>
                    <template v-if="configForm.File.Enabled">
                        <el-form-item label="单个最大体积（MB）">
                            <el-input-number v-model="configForm.File.MaxSize" :min="1" :max="2048" controls-position="right" />
                        </el-form-item>
                        <el-form-item label="单次最多选择">
                            <el-input-number v-model="configForm.File.MaxCount" :min="1" :max="100" controls-position="right" />
                        </el-form-item>
                        <el-form-item label="允许类型（可选）">
                            <el-input v-model="configForm.File.Accept" placeholder="如 .pdf,.docx,.xlsx；留空为平台安全白名单" />
                        </el-form-item>
                    </template>
                </section>
            </div>
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
import {
    buildRichTextPrivateAssetMarker,
    canonicalizeRichTextAssetUrls,
    collectRichTextPrivateAssetPaths,
    hydrateRichTextPrivateAssetUrls,
    normalizeRichTextConfig
} from './richtext-assets';

const SOURCE_CODE_MENU_KEY = 'microiSourceCode';
const ATTACHMENT_MENU_KEY = 'microiAttachment';
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

class AttachmentMenu {
    constructor() {
        this.title = '上传附件';
        this.iconSvg = '<svg viewBox="0 0 1024 1024"><path d="M736 256v448c0 123.7-100.3 224-224 224S288 827.7 288 704V224C288 135.6 359.6 64 448 64s160 71.6 160 160v448c0 53-43 96-96 96s-96-43-96-96V288h64v384c0 17.7 14.3 32 32 32s32-14.3 32-32V224c0-53-43-96-96-96s-96 43-96 96v480c0 88.4 71.6 160 160 160s160-71.6 160-160V256h64z"></path></svg>';
        this.tag = 'button';
    }

    getValue() {
        return '';
    }

    isActive() {
        return false;
    }

    isDisabled(editor) {
        const state = sourceCodeMenuStates.get(editor);
        return !state || !state.attachmentEnabled();
    }

    exec(editor) {
        const state = sourceCodeMenuStates.get(editor);
        if (state && state.attachmentEnabled()) state.chooseAttachment();
    }
}

const registerMenu = (key, factory) => {
    try {
        Boot.registerMenu({
            key,
            factory
        });
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        const lowerMessage = message.toLowerCase();
        if (!message.includes(key)
            && !lowerMessage.includes('duplicated')
            && !lowerMessage.includes('already')) {
            console.warn(`[DiyRichText] 注册菜单 ${key} 失败：`, error);
        }
    }
};

registerMenu(SOURCE_CODE_MENU_KEY, () => new SourceCodeMenu());
registerMenu(ATTACHMENT_MENU_KEY, () => new AttachmentMenu());

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
    },
    FormDiyTableModel: {
        type: Object,
        default: () => ({})
    },
    DiyTableModel: {
        type: Object,
        default: () => ({})
    },
    TableName: {
        type: String,
        default: ''
    },
    TableRowId: {
        type: String,
        default: ''
    },
    SysMenuId: {
        type: String,
        default: ''
    },
    TableChildAuth: {
        type: Object,
        default: null
    }
});

// Emits
const emit = defineEmits(['update:modelValue', 'CallbackRunV8Code']);

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;

// 响应式数据
const editorRef = ref(null);
const attachmentInputRef = ref(null);
const mode = ref('default');
const sourceCodeVisible = ref(false);
const sourceCodeValue = ref('');
const editorValue = ref(props.modelValue || '');
const renderedValue = ref(props.modelValue || '');
const privateAssetsResolving = ref(false);
const runtimeUrlMarkers = new Map();
const uploadedRuntimeUrls = new Map();
let hydrationVersion = 0;
const richTextConfig = computed(() => normalizeRichTextConfig(props.field?.Config?.RichText));
const toolbarConfig = computed(() => {
    const insertKeys = [SOURCE_CODE_MENU_KEY];
    if (richTextConfig.value.File.Enabled) insertKeys.push(ATTACHMENT_MENU_KEY);
    const excludeKeys = [];
    if (!richTextConfig.value.Image.Enabled) excludeKeys.push('uploadImage');
    if (!richTextConfig.value.Video.Enabled) excludeKeys.push('uploadVideo');
    return {
        insertKeys: {
            index: 0,
            keys: insertKeys
        },
        excludeKeys
    };
});

// 富文本统一复用 HDFS Controller；字段配置只允许进一步收紧平台上传限制。
const richTextUploadUrl = () => DiyCommon.GetApiBase() + '/api/HDFS/Upload';

const matchesAccept = (file, accept) => {
    const rules = String(accept || '').split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (!rules.length) return true;
    const fileName = String(file?.name || '').toLowerCase();
    const mime = String(file?.type || '').toLowerCase();
    return rules.some((rule) => {
        if (rule.startsWith('.')) return fileName.endsWith(rule);
        if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1));
        return mime === rule;
    });
};

// 自定义上传绕过 WangEditor 默认 Uppy 后，继续保留字段级类型、数量和大小限制。
const validateRichTextFile = (file, options) => {
    const { mediaType, maxSize, accept } = options;
    if (!file || !file.name || file.size <= 0) throw new Error('不能上传空文件');
    if (file.size > maxSize * 1024 * 1024) {
        throw new Error(`文件不能超过${maxSize}MB`);
    }
    if (mediaType !== 'file' && file.type && !file.type.toLowerCase().startsWith(mediaType + '/')) {
        throw new Error(mediaType === 'image' ? '只能上传图片文件' : '只能上传视频文件');
    }
    if (mediaType === 'file' && !matchesAccept(file, accept)) {
        throw new Error(`文件类型不符合限制：${accept}`);
    }
};

// 每个富文本文件使用独立 multipart 请求；图片压缩与公私桶均由可信后端执行。
const uploadRichTextFile = async (file, options) => {
    const { timeout, mediaType, maxSize, accept } = options;
    validateRichTextFile(file, { mediaType, maxSize, accept });
    const formData = new FormData();
    formData.append('Path', 'editor');
    formData.append('Limit', String(richTextConfig.value.Limit));
    formData.append('Multiple', 'false');
    formData.append('Preview', String(mediaType === 'image' && richTextConfig.value.Image.Preview));
    if (mediaType === 'image' && richTextConfig.value.Image.Preview) {
        formData.append('CompressMaxSize', String(richTextConfig.value.Image.CompressMaxSize));
        formData.append('CompressMaxWidth', String(richTextConfig.value.Image.CompressMaxWidth));
    }
    formData.append('file', file, file.name);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeout);
    const token = DiyCommon.Authorization();
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

        if (!response.ok || !result || Number(result.Code) !== 1) {
            throw new Error(result?.Msg || result?.message || `上传失败（HTTP ${response.status}）`);
        }
        return Array.isArray(result.Data) ? result.Data[0] : result.Data;
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

const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getUploadedAsset = (data, file) => {
    const item = Array.isArray(data) ? data[0] : data;
    const path = String(item?.Path || item?.FilePathName || '').trim();
    const name = String(item?.Name || item?.FileName || file?.name || '').trim();
    let runtimeUrl = String(item?.Url || item?.FullPath || '').trim();
    const rawLimit = item?.Limit;
    const effectiveLimit = rawLimit === true || rawLimit === 1
        || String(rawLimit).trim().toLowerCase() === 'true'
        || (rawLimit == null && richTextConfig.value.Limit);
    if (!runtimeUrl && path && !effectiveLimit) runtimeUrl = DiyCommon.GetServerPath(path);
    if (!path) throw new Error('上传成功但未返回文件路径');
    if (!runtimeUrl) throw new Error('上传成功但未返回可用的预览地址');
    if (effectiveLimit) {
        const marker = buildRichTextPrivateAssetMarker(path);
        runtimeUrlMarkers.set(runtimeUrl, marker);
        uploadedRuntimeUrls.set(path, runtimeUrl);
    }
    return { path, name, runtimeUrl, limit: effectiveLimit };
};

// 图片运行时使用短效 URL，字段值在 handleChange 中自动还原为稳定私有标识。
const uploadRichTextImage = async (file, insertFn) => {
    try {
        const data = await uploadRichTextFile(file, {
            timeout: 60 * 1000,
            mediaType: 'image',
            maxSize: richTextConfig.value.Image.MaxSize
        });
        const asset = getUploadedAsset(data, file);
        insertFn(asset.runtimeUrl, asset.name, '');
    } catch (error) {
        showRichTextUploadError(file, error);
    }
};

// 视频与图片采用相同的稳定标识协议。
const uploadRichTextVideo = async (file, insertFn) => {
    try {
        const data = await uploadRichTextFile(file, {
            timeout: 60 * 1000 * 100,
            mediaType: 'video',
            maxSize: richTextConfig.value.Video.MaxSize
        });
        const asset = getUploadedAsset(data, file);
        insertFn(asset.runtimeUrl, '');
    } catch (error) {
        showRichTextUploadError(file, error);
    }
};

const chooseAttachment = () => {
    if (!richTextConfig.value.File.Enabled) return;
    if (attachmentInputRef.value) {
        attachmentInputRef.value.value = '';
        attachmentInputRef.value.click();
    }
};

const handleAttachmentFiles = async (event) => {
    const files = Array.from(event?.target?.files || []);
    if (!files.length) return;
    if (files.length > richTextConfig.value.File.MaxCount) {
        DiyCommon.Tips(`单次最多选择 ${richTextConfig.value.File.MaxCount} 个附件`, false);
        if (event?.target) event.target.value = '';
        return;
    }
    for (const file of files) {
        try {
            const data = await uploadRichTextFile(file, {
                timeout: 10 * 60 * 1000,
                mediaType: 'file',
                maxSize: richTextConfig.value.File.MaxSize,
                accept: richTextConfig.value.File.Accept
            });
            const asset = getUploadedAsset(data, file);
            editorRef.value?.dangerouslyInsertHtml?.(
                `<p><a href="${escapeHtml(asset.runtimeUrl)}" target="_blank" rel="noopener noreferrer">📎 ${escapeHtml(asset.name)}</a></p>`
            );
        } catch (error) {
            showRichTextUploadError(file, error);
        }
    }
    if (event?.target) event.target.value = '';
};

let lastEmittedCanonical = '';

const privateFileContext = () => ({
    FormEngineKey: props.DiyTableModel?.Name || props.TableName || props.field?.TableId || '',
    FormDataId: props.TableRowId || props.FormDiyTableModel?.Id || '',
    FieldId: props.field?.Id || props.field?.Name || '',
    SysMenuId: props.SysMenuId || '',
    _TableChildAuth: props.TableChildAuth || undefined
});

const requestPrivateAssetUrls = async (paths) => {
    const uniquePaths = Array.from(new Set(paths.filter(Boolean)));
    const resolved = new Map();
    if (!uniquePaths.length) return resolved;
    const context = privateFileContext();
    if (!context.FormEngineKey || !context.FormDataId || !context.FieldId || !context.SysMenuId) {
        return resolved;
    }

    if (uniquePaths.length > 1) {
        try {
            const batchResult = await DiyCommon.PostAsync('/api/HDFS/GetPrivateFileUrl', {
                FilePathNames: uniquePaths,
                ...context
            });
            const urls = Array.isArray(batchResult?.Data) ? batchResult.Data : [];
            if (Number(batchResult?.Code) === 1 && urls.length === uniquePaths.length) {
                uniquePaths.forEach((path, index) => {
                    if (urls[index]) resolved.set(path, String(urls[index]));
                });
                return resolved;
            }
        } catch (error) {
            // 批量解析失败时降级为逐项解析，让一条历史坏路径不影响其余附件。
        }
    }

    await Promise.all(uniquePaths.map(async (path) => {
        try {
            const result = await DiyCommon.PostAsync('/api/HDFS/GetPrivateFileUrl', {
                FilePathName: path,
                ...context
            });
            if (Number(result?.Code) === 1 && result?.Data) resolved.set(path, String(result.Data));
        } catch (error) {
            console.warn('[DiyRichText] 私有附件解析失败：', path, error);
        }
    }));
    return resolved;
};

const hydrateCanonicalHtml = async (canonicalHtml, applyToEditor) => {
    const version = ++hydrationVersion;
    const canonical = String(canonicalHtml || '');
    const paths = collectRichTextPrivateAssetPaths(canonical);
    if (!paths.length) {
        renderedValue.value = canonical;
        if (applyToEditor) editorValue.value = canonical;
        privateAssetsResolving.value = false;
        return canonical;
    }

    privateAssetsResolving.value = true;
    const resolved = new Map();
    // 仅复用当前表单会话刚上传、尚未持久化的对象地址。已持久化记录每次
    // 打开都必须按当前菜单、行和字段权限重新换签，不能沿用上一条记录的地址。
    uploadedRuntimeUrls.forEach((runtimeUrl, path) => resolved.set(path, runtimeUrl));
    const unresolvedPaths = paths.filter((path) => !resolved.has(path));
    const serverResolved = await requestPrivateAssetUrls(unresolvedPaths);
    serverResolved.forEach((url, path) => resolved.set(path, url));
    if (version !== hydrationVersion) return canonical;
    resolved.forEach((url, path) => {
        runtimeUrlMarkers.set(url, buildRichTextPrivateAssetMarker(path));
    });
    const hydrated = hydrateRichTextPrivateAssetUrls(canonical, resolved);
    renderedValue.value = hydrated;
    if (applyToEditor) editorValue.value = hydrated;
    privateAssetsResolving.value = false;
    return hydrated;
};

const emitCanonicalValue = (value) => {
    const canonical = canonicalizeRichTextAssetUrls(value, runtimeUrlMarkers);
    lastEmittedCanonical = canonical;
    if (canonical !== props.modelValue) emit('update:modelValue', canonical);
    return canonical;
};

const getCurrentHtml = () => {
    if (editorRef.value && !editorRef.value.isDestroyed) {
        return editorRef.value.getHtml();
    }
    return editorValue.value || '';
};

const syncEditorFromSource = async () => {
    const canonical = sourceCodeValue.value || '';
    emitCanonicalValue(canonical);
    const hydrated = await hydrateCanonicalHtml(canonical, true);
    if (editorRef.value && !editorRef.value.isDestroyed && editorRef.value.getHtml() !== hydrated) {
        editorRef.value.setHtml(hydrated);
    }
};

const toggleSourceCode = async () => {
    if (sourceCodeVisible.value) {
        sourceCodeVisible.value = false;
        // WangEditor/Slate 不能在 v-show 隐藏的编辑区上可靠重建选区。
        // 先恢复可视 DOM，再同步源码，避免清空或重排 HTML 时选区越界。
        await nextTick();
        try {
            await syncEditorFromSource();
        } catch (error) {
            sourceCodeVisible.value = true;
            DiyCommon.Tips(error?.message || 'HTML 源码同步失败，请检查内容后重试。', false);
            return;
        }
        nextTick(() => {
            editorRef.value?.focus?.(true);
        });
        return;
    }

    sourceCodeValue.value = emitCanonicalValue(getCurrentHtml());
    editorRef.value?.blur?.();
    sourceCodeVisible.value = true;
};

const handleSourceCodeInput = (event) => {
    sourceCodeValue.value = event.target.value;
    emitCanonicalValue(sourceCodeValue.value);
};

watch(
    [
        () => props.modelValue,
        () => props.TableRowId,
        () => props.FormDiyTableModel?.Id,
        () => props.SysMenuId,
        () => props.DiyTableModel?.Name || props.TableName || props.field?.TableId,
        () => props.field?.Id || props.field?.Name
    ],
    (value, oldValue) => {
        const canonical = value[0] || '';
        if (oldValue && value.slice(1).some((item, index) => item !== oldValue[index + 1])) {
            runtimeUrlMarkers.clear();
            uploadedRuntimeUrls.clear();
        }
        if (canonical === lastEmittedCanonical) {
            lastEmittedCanonical = '';
            return;
        }
        if (sourceCodeVisible.value) {
            sourceCodeValue.value = canonical;
            return;
        }
        hydrateCanonicalHtml(canonical, props.FormMode !== 'View');
    },
    { immediate: true }
);

// 编辑器配置
const editorConfig = computed(() => {
    return {
        placeholder: '请输入内容...',
        MENU_CONF: {
            uploadImage: {
                maxFileSize: richTextConfig.value.Image.MaxSize * 1024 * 1024,
                maxNumberOfFiles: richTextConfig.value.Image.MaxCount,
                allowedFileTypes: ['image/*'],
                customUpload: uploadRichTextImage
            },
            uploadVideo: {
                maxFileSize: richTextConfig.value.Video.MaxSize * 1024 * 1024,
                maxNumberOfFiles: richTextConfig.value.Video.MaxCount,
                allowedFileTypes: ['video/*'],
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
        toggle: toggleSourceCode,
        attachmentEnabled: () => richTextConfig.value.File.Enabled,
        chooseAttachment
    });
};

const handleChange = (editor) => {
    if (!sourceCodeVisible.value) {
        sourceCodeValue.value = emitCanonicalValue(editor.getHtml());
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
            runtimeUrlMarkers.clear();
            uploadedRuntimeUrls.clear();
        } catch (error) {
            // ignore
        }
    }
});

// ==================== 配置弹窗相关 ====================
const configDialogVisible = ref(false);
const configForm = ref(normalizeRichTextConfig());

const openConfig = () => {
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.RichText) {
        props.field.Config.RichText = {};
    }
    configForm.value = normalizeRichTextConfig(props.field.Config.RichText);
    configDialogVisible.value = true;
};

const saveConfig = () => {
    if (!props.field.Config.RichText) {
        props.field.Config.RichText = {};
    }
    props.field.Config.RichText = normalizeRichTextConfig(configForm.value);
    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// 暴露方法供父组件调用
defineExpose({
    openConfig
});
</script>

<style scoped>
.richtext-editor-wrap {
    overflow: hidden;
    border: 1px solid var(--el-border-color);
    border-radius: 12px;
    background: var(--el-bg-color);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.richtext-policy-bar {
    min-height: 38px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px 10px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    border-bottom: 1px solid var(--el-border-color-lighter);
    font-size: 12px;
}

.richtext-policy-bar__title {
    margin-right: 2px;
    color: var(--el-text-color-primary);
    font-weight: 650;
}

.richtext-policy-chip {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 1px 8px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 999px;
    background: var(--el-bg-color);
    white-space: nowrap;
}

.richtext-policy-chip.is-private {
    color: var(--el-color-warning-dark-2);
    border-color: var(--el-color-warning-light-7);
    background: var(--el-color-warning-light-9);
}

.richtext-policy-chip.is-public {
    color: var(--el-color-success-dark-2);
    border-color: var(--el-color-success-light-7);
    background: var(--el-color-success-light-9);
}

.richtext-toolbar {
    border-bottom: 1px solid var(--el-border-color-lighter);
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

.richtext-attachment-input {
    display: none;
}

.richtext-view-wrap {
    position: relative;
    min-height: 32px;
}

.richtext-private-loading {
    position: absolute;
    top: 6px;
    right: 8px;
    z-index: 1;
    padding: 3px 8px;
    border-radius: 999px;
    color: var(--el-color-primary);
    background: var(--el-color-primary-light-9);
    font-size: 12px;
}

.richtext-view-content :deep(img),
.richtext-view-content :deep(video) {
    max-width: 100%;
}

.form-item-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.5;
    margin-top: 4px;
}

.richtext-config-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

:global(.el-dialog.richtext-config-dialog.mci-field-config-dialog),
:global(.el-dialog.richtext-config-dialog.mci-field-config-dialog.is-draggable) {
    --el-dialog-width: min(760px, calc(100vw - 32px));
    width: min(760px, calc(100vw - 32px)) !important;
    max-width: calc(100vw - 32px) !important;
}

.richtext-storage-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 14px 16px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-fill-color-extra-light);
}

.richtext-config-heading {
    color: var(--el-text-color-primary);
    font-size: 14px;
    line-height: 1.4;
    font-weight: 700;
}

.richtext-storage-choice {
    flex: none;
}

.richtext-storage-note {
    padding: 9px 12px;
    border-radius: 9px;
    font-size: 12px;
    line-height: 1.65;
}

.richtext-storage-note.is-private {
    color: var(--el-color-warning-dark-2);
    background: var(--el-color-warning-light-9);
}

.richtext-storage-note.is-public {
    color: var(--el-color-success-dark-2);
    background: var(--el-color-success-light-9);
}

.richtext-media-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
}

.richtext-media-card {
    min-width: 0;
    padding: 13px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 12px;
    background: var(--el-bg-color);
}

.richtext-media-card__header,
.richtext-inline-setting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.richtext-media-card__header {
    min-height: 42px;
    margin-bottom: 10px;
}

.richtext-inline-setting {
    min-height: 32px;
    margin-bottom: 8px;
    color: var(--el-text-color-regular);
    font-size: 13px;
}

.richtext-media-card :deep(.el-form-item) {
    margin-bottom: 9px;
}

.richtext-media-card :deep(.el-form-item__label) {
    height: auto;
    margin-bottom: 4px;
    line-height: 1.4;
    font-size: 12px;
}

.richtext-media-card :deep(.el-input-number),
.richtext-media-card :deep(.el-input) {
    width: 100%;
}

@media (max-width: 760px) {
    .richtext-storage-card {
        align-items: flex-start;
        flex-direction: column;
    }

    .richtext-media-grid {
        grid-template-columns: 1fr;
    }
}
</style>
