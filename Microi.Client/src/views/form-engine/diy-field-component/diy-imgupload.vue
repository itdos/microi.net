<template>
    <div class="diy-imgupload">
        <!-- 上传组件 - 编辑/新增模式 -->
        <!-- 相册选择保留系统默认行为，拍摄入口通过独立的原生 input 明确请求摄像头。 -->
        <el-upload
            v-if="FormMode != 'View' && field.Visible"
            ref="uploadRef"
            class="mci-compact-upload"
            drag
            accept="image/*"
            :multiple="getMultipleFlag"
            :limit="field.Config.ImgUpload.MaxCount"
            :action="GetUploadUrl()"
            :data="{
                Path: '/img',
                Limit: field.Config.ImgUpload.Limit,
                Preview: isImgCompressionEnabled(field.Config.ImgUpload.Preview)
            }"
            :headers="GetUploadHeaders()"
            :http-request="performImageUpload"
            :before-upload="(file) => BeforeImgUpload(file)"
            :on-exceed="() => onExceed()"
            :on-success="(result, file, fileList) => ImgUploadSuccess(result, file, fileList)"
            :on-error="(error, file, fileList) => ImgUploadError(error, file, fileList)"
            :on-remove="(file, fileList) => ImgUploadRemove(file, fileList)"
            :show-file-list="false"
        >
            <DiyUploadCompactSummary
                kind="image"
                :private-storage="field.Config.ImgUpload.Limit"
                :multiple="getMultipleFlag"
                :max-count="field.Config.ImgUpload.MaxCount"
                :compressed="isImgCompressionEnabled(field.Config.ImgUpload.Preview)"
                :max-size="field.Config.ImgUpload.MaxSize"
                :tips="field.Config.ImgUpload.Tips"
                show-crop-toggle
                v-model:crop-enabled="runtimeCropEnabled"
            />
            <template #tip>
                <div class="image-upload-actions">
                    <el-button
                        v-if="showCameraCapture"
                        type="primary"
                        :icon="Camera"
                        data-testid="image-upload-camera-button"
                        @click.stop="openImagePicker('camera')"
                    >{{ t('Msg.ImageUploadTakePhoto') }}</el-button>
                    <el-button
                        :icon="Picture"
                        data-testid="image-upload-gallery-button"
                        @click.stop="openImagePicker('gallery')"
                    >{{ t('Msg.ImageUploadChooseImages') }}</el-button>
                </div>
            </template>
        </el-upload>

        <!-- capture 必须落到原生文件 input；不能只写在 el-upload 的外层组件上。
             拍摄一次返回一张照片，多图字段可以连续拍摄；相册 input 仍保留 multiple。 -->
        <input
            v-if="FormMode != 'View' && field.Visible"
            ref="cameraInputRef"
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            data-testid="image-upload-camera-input"
            @click.stop
            @change.stop="handleCameraSelection"
        />

        <!-- 单图片显示 - 编辑/新增模式 -->
        <div v-if="FormMode != 'View' && field.Visible && !getMultipleFlag && isValidSingleImgValue(modelValue)"
            class="single-img-display">
            <div
                v-if="isImagePathLoading(getImageDisplayPath())"
                class="mci-media-skeleton preview-image"
                role="status"
                aria-label="图片加载中"
            ></div>
            <el-image
                v-else
                :src="getImageDisplayPath()"
                :preview-src-list="[getImageDisplayPath()]"
                fit="cover"
                class="preview-image"
            />
            <div class="img-actions">
                <el-input
                    v-if="FormMode == 'Edit' || FormMode == 'Add'"
                    v-model="singleImageName"
                    size="small"
                    class="img-name-input"
                    @change="updateSingleImageName"
                />
                <span v-else class="img-name">{{ GetFileName(modelValue) }}</span>
                <span class="img-size">{{ getSingleImgSize() }}</span>
                <el-button
                    type="danger"
                    size="small"
                    :icon="Delete"
                    @click="ConfirmDelSingleUpload()"
                    link
                >
                    删除
                </el-button>
            </div>
        </div>

        <!-- 查看模式 - 单图片 -->
        <div v-if="FormMode == 'View' && !getMultipleFlag && isValidSingleImgValue(modelValue)"
            class="single-img-display view-mode">
            <div
                v-if="isImagePathLoading(getImageDisplayPath())"
                class="mci-media-skeleton preview-image"
                role="status"
                aria-label="图片加载中"
            ></div>
            <el-image
                v-else
                :src="getImageDisplayPath()"
                :preview-src-list="[getImageDisplayPath()]"
                fit="cover"
                class="preview-image"
            />
            <div class="img-info">
                <span class="img-name">{{ GetFileName(modelValue) }}</span>
                <span class="img-size">{{ getSingleImgSize() }}</span>
            </div>
        </div>

        <!-- 多图片显示 -->
        <div
            v-if="getMultipleFlag && showMultipleImgList"
            ref="sortableContainer"
            class="multiple-imgs-list"
        >
            <el-card
                v-for="(img, index) in imageListComputed"
                :key="img.Id"
                class="img-card"
                :data-id="img.Id"
                :body-style="{ padding: '0px' }"
            >
                <el-icon class="drag-handle"><Rank /></el-icon>
                <!-- zhy取消浏览器图片预览@click="openImagePreview(img)" ，开通遮罩层取消图片预览:hide-on-click-modal='true'  ，:initial-index="index"该属性主要是支持多图预览可以点击预览对应图片而不是默认第一张---->
                <div
                    v-if="isImagePathLoading(FormDiyTableModel[field.Name + '_' + img.Id + '_RealPath'])"
                    class="mci-media-skeleton card-image"
                    role="status"
                    aria-label="图片加载中"
                ></div>
                <el-image
                    v-else
                    :src="FormDiyTableModel[field.Name + '_' + img.Id + '_RealPath']"
                    :preview-src-list="GetImgUploadImgs()"
                    :initial-index="index"
                    fit="cover"
                    :hide-on-click-modal='true'
                    class="card-image"
                    style="cursor: pointer;"
                />
                <div class="card-footer">
                    <div class="img-detail">
                        <div class="img-name" :title="img.Name">
                            <el-input
                                v-if="FormMode == 'Edit' || FormMode == 'Add'"
                                v-model="img.Name"
                                size="small"
                            />
                            <span v-else>{{ img.Name }}</span>
                        </div>
                        <div class="img-meta">
                            <span class="img-size">{{ formatFileSize(img.Size) }}</span>
                            <time v-if="img.CreateTime" class="img-time">{{ img.CreateTime }}</time>
                        </div>
                        <el-tag
                            v-if="img.State == 0"
                            type="info"
                            size="small"
                        >
                            待上传
                        </el-tag>
                        <!-- zhy关闭”已上传“字段预览@click="openImagePreview(img)" -->
                        <el-tag
                            v-else-if="img.State == 1"
                            type="success"
                            size="small"
                            style="cursor: pointer;"
                        >
                            已上传
                        </el-tag>
                        <el-tag v-else type="danger" size="small">失败</el-tag>
                    </div>
                    <el-button
                        v-if="FormMode != 'View'"
                        type="danger"
                        size="small"
                        :icon="Delete"
                        @click="ConfirmDelUploadImgs(img)"
                        link
                    />
                </div>
            </el-card>
        </div>

        <!-- 配置弹窗 - 设计模式下可用 -->
        <el-dialog
            v-if="configDialogVisible"
            v-model="configDialogVisible"
            class="mci-field-config-dialog mci-imgupload-config-dialog"
            title="图片上传配置"
            width="min(780px, calc(100vw - 32px))"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <div class="mci-img-config-banner">
                <span><el-icon><Crop /></el-icon></span>
                <div>
                    <strong>图片上传与智能裁剪</strong>
                    <small>用统一的安全上传协议保存展示图，原图始终保留在 HDFS 私有桶。</small>
                </div>
            </div>

            <el-form label-width="150px" label-position="left" size="default">
                <section class="mci-img-config-section">
                    <header><span>01</span><strong>上传基础</strong></header>
                    <el-form-item label="禁止匿名访问">
                        <el-switch v-model="configForm.Limit" />
                        <div class="form-item-tip">开启后图片通过带鉴权的短期链接访问</div>
                    </el-form-item>
                    <el-form-item label="多图片上传">
                        <el-switch v-model="configForm.Multiple" />
                        <div class="form-item-tip">开启后支持一次选择多张图片</div>
                    </el-form-item>
                    <el-form-item label="最大允许上传个数">
                        <el-input-number v-model="configForm.MaxCount" :min="1" :max="100" />
                    </el-form-item>
                    <el-form-item label="上传说明">
                        <el-input v-model="configForm.Tips" placeholder="如：支持 JPG、PNG、WebP 格式" />
                    </el-form-item>
                    <el-form-item label="是否压缩">
                        <el-switch v-model="configForm.Preview" />
                        <div class="form-item-tip">开启后后端会自动生成约 500KB 的展示图</div>
                    </el-form-item>
                    <el-form-item label="最大体积(M)">
                        <el-input-number v-model="configForm.MaxSize" :min="1" :max="1024" />
                    </el-form-item>
                    <el-form-item label="保存为完整路径">
                        <el-switch v-model="configForm.SaveFullPath" />
                        <div class="form-item-tip">开启后保存完整 URL，默认保存稳定的相对路径</div>
                    </el-form-item>
                </section>

                <section class="mci-img-config-section mci-img-config-section--crop">
                    <header>
                        <span>02</span><strong>图片裁剪</strong>
                        <el-tag type="success" effect="light" round>原图私有保留</el-tag>
                    </header>
                    <el-form-item label="默认开启裁剪">
                        <el-switch v-model="configForm.Crop.Enabled" />
                        <div class="form-item-tip">仅决定表单用户的初始状态；用户仍可在图片控件中随时开启或关闭裁剪</div>
                    </el-form-item>
                    <template>
                        <el-form-item label="裁剪模式">
                            <el-radio-group v-model="configForm.Crop.Mode" @change="handleCropModeChange">
                                <el-radio-button value="free">自由裁剪</el-radio-button>
                                <el-radio-button value="fixed">固定比例</el-radio-button>
                                <el-radio-button value="select">用户可选</el-radio-button>
                            </el-radio-group>
                            <div class="form-item-tip">“用户可选”会在裁剪时提供自由、1:1、4:3、16:9 等比例</div>
                        </el-form-item>
                        <el-form-item v-if="configForm.Crop.Mode !== 'free'" label="默认比例">
                            <el-select v-model="configForm.Crop.Ratio" style="width: 220px">
                                <el-option
                                    v-for="ratio in cropRatioOptions"
                                    :key="ratio.value"
                                    :label="ratio.label"
                                    :value="ratio.value"
                                />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="configForm.Crop.Mode !== 'free' && configForm.Crop.Ratio === 'custom'" label="自定义比例">
                            <div class="mci-custom-ratio-inputs">
                                <el-input-number v-model="configForm.Crop.CustomWidth" :min="1" :max="10000" :precision="2" controls-position="right" />
                                <span>:</span>
                                <el-input-number v-model="configForm.Crop.CustomHeight" :min="1" :max="10000" :precision="2" controls-position="right" />
                            </div>
                        </el-form-item>
                        <el-form-item label="编辑工具">
                            <el-checkbox v-model="configForm.Crop.AllowZoom">缩放</el-checkbox>
                            <el-checkbox v-model="configForm.Crop.AllowRotate">旋转</el-checkbox>
                            <el-checkbox v-model="configForm.Crop.AllowFlip">镜像翻转</el-checkbox>
                        </el-form-item>
                    </template>
                </section>

                <section class="mci-img-config-section">
                    <header><span>03</span><strong>V8 扩展</strong></header>
                    <el-form-item label="上传前V8引擎代码">
                        <el-button type="primary" plain :icon="Edit" @click="openCodeEditor('BeforeUploadV8', '上传前V8引擎代码')">
                            编辑代码{{ getCodeLength(configForm.BeforeUploadV8) }}
                        </el-button>
                        <div class="form-item-tip">V8.Result 返回 false 可阻止上传</div>
                    </el-form-item>
                    <el-form-item label="上传成功后V8代码">
                        <el-button type="primary" plain :icon="Edit" @click="openCodeEditor('UploadSuccessV8', '上传成功后V8引擎代码')">
                            编辑代码{{ getCodeLength(configForm.UploadSuccessV8) }}
                        </el-button>
                    </el-form-item>
                </section>
            </el-form>
            <template #footer>
                <el-button @click="configDialogVisible = false">取消</el-button>
                <el-button type="primary" @click="saveConfig">确定</el-button>
            </template>
        </el-dialog>

        <!-- 代码编辑器弹窗 -->
        <el-dialog
            v-if="codeEditorVisible"
            v-model="codeEditorVisible"
            :title="codeEditorTitle"
            width="80%"
            :close-on-click-modal="false"
            destroy-on-close
            append-to-body
        >
            <diy-code-editor
                v-model="codeEditorValue"
                :field="{
                    Name: codeEditorType,
                    Component: 'CodeEditor',
                    Config: {
                        CodeEditor: {
                            Language: 'javascript',
                            Theme: 'vs-dark'
                        }
                    }
                }"
                :FormDiyTableModel="{ [codeEditorType]: codeEditorValue }"
                :FormMode="'Edit'"
                :ReadonlyFields="[]"
                :FieldReadonly="false"
            />
            <template #footer>
                <el-button @click="codeEditorVisible = false">取消</el-button>
                <el-button type="primary" @click="saveCodeEditor">确定</el-button>
            </template>
        </el-dialog>

        <diy-image-crop-dialog
            v-model="cropDialogVisible"
            :file="cropDialogFile"
            :config="cropDialogConfig"
            @confirm="handleCropConfirm"
            @bypass="handleCropBypass"
            @cancel="handleCropCancel"
        />
    </div>
</template>

<script setup>
import { ref, computed, getCurrentInstance, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { Delete, Rank, Edit, Crop, Camera, Picture } from '@element-plus/icons-vue';
import { ElMessageBox } from 'element-plus';
import Sortable from 'sortablejs';
import { useDiyStore } from "@/pinia";
import { getUploadErrorMessage } from "@/utils/upload-error";
// zhy：统一解析上传接口返回的实际私有策略、短期预览地址和可持久化元数据。
import {
    getUploadPreviewUrl,
    normalizeUploadResponseItem,
    resolveUploadLimit,
    sanitizeUploadMeta
} from "@/utils/upload-response";
import { appendFormFieldUploadContext } from "@/utils/form-field-upload-context";
import DiyImageCropDialog from './diy-image-crop-dialog.vue';
import DiyUploadCompactSummary from './diy-upload-compact-summary.vue';
import {
    IMAGE_CROP_RATIOS,
    isCropSupportedImage,
    normalizeImageCropConfig
} from './image-crop-config';

// 禁用属性继承
defineOptions({
    inheritAttrs: false
});

// Props定义
const props = defineProps({
    modelValue: {
        type: [String, Array, Object],
        default: ''
    },
    field: {
        type: Object,
        required: true
    },
    FormDiyTableModel: {
        type: Object,
        required: true
    },
    FormMode: {
        type: String,
        default: ''
    },
    SysConfig: {
        type: Object,
        default: () => ({})
    },
    DiyTableModel: {
        type: Object,
        default: () => ({})
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

// Emits定义
const emit = defineEmits(['update:modelValue', 'CallbackRunV8Code']);

// 获取全局属性
const instance = getCurrentInstance();
const DiyCommon = instance.appContext.config.globalProperties.DiyCommon;
const DiyApi = instance.appContext.config.globalProperties.DiyApi;
const { t } = useI18n();
const diyStore = useDiyStore();
const SysConfig = computed(() => ({
    ...(diyStore.SysConfig || {}),
    ...(props.SysConfig || {})
}));

// 响应式数据
const uploadRef = ref(null);
const cameraInputRef = ref(null);
const showCameraCapture = computed(() => (
    diyStore.IsPhoneView || !!instance.appContext.config.globalProperties.DosCommon?.isMobile
));

// 只查找当前字段自己的上传 input，避免同一表单多个图片字段互相串图。
const getGalleryInput = () => uploadRef.value?.$el?.querySelector('input.el-upload__input');
const canSelectImage = () => props.FormMode !== 'View' && !!props.field.Visible;
const openImagePicker = (source) => {
    if (!canSelectImage()) return;
    const input = source === 'camera' ? cameraInputRef.value : getGalleryInput();
    if (!input) return;
    // 保持同步的用户手势，并清空上次选择，允许取消后重拍或再次选择同一张照片。
    input.value = '';
    input.click();
};
const handleCameraSelection = (event) => {
    const input = event.target;
    if (!canSelectImage() || !input?.files?.length) return;
    const galleryInput = getGalleryInput();
    if (!galleryInput) return;
    try {
        // 转交原生 FileList，复用 el-upload 的限量、V8、裁剪及单文件上传入口。
        // 不调用 submit()：它会重新提交其它仍在等待裁剪/V8 的 ready 文件。
        galleryInput.files = input.files;
        galleryInput.dispatchEvent(new Event('change', { bubbles: true }));
    } catch {
        DiyCommon.Tips(t('Msg.ImageUploadCaptureReadFailed'), false);
    } finally {
        input.value = '';
    }
};
const sortableContainer = ref(null);
let sortableInstance = null;

// 单图文件名编辑
const singleImageName = ref('');

// 配置弹窗相关
const configDialogVisible = ref(false);
// 未配置时遵循后端安全默认值：图片生成约 500KB 的展示图，原图只保存在私有桶。
// 仅显式 false/0 才关闭压缩，兼容历史 JSON 中的字符串布尔值。
const isImgCompressionEnabled = (value) => !(
    value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false'
);
const configForm = ref({
    Limit: false,
    Multiple: false,
    MaxCount: 10,
    Tips: '',
    Preview: true,
    MaxSize: 10,
    SaveFullPath: false,
    Crop: normalizeImageCropConfig(),
    BeforeUploadV8: '',
    UploadSuccessV8: ''
});
const cropRatioOptions = IMAGE_CROP_RATIOS.filter(item => item.value !== 'free');
const handleCropModeChange = () => {
    // 历史字段从自由裁剪切到固定/可选模式时，Ratio 仍可能是 free。
    // 立即归一化，避免固定模式出现一个无法选择的“free”原始值。
    configForm.value.Crop = normalizeImageCropConfig(configForm.value.Crop);
};

// 裁剪对话框通过队列串行处理多选图片，避免同时选择多图时弹窗互相覆盖。
const cropDialogVisible = ref(false);
const cropDialogFile = ref(null);
const cropDialogConfig = ref(normalizeImageCropConfig());
const runtimeCropEnabled = ref(normalizeImageCropConfig(props.field.Config?.ImgUpload?.Crop).Enabled);
const activeCropConfig = computed(() => ({
    ...normalizeImageCropConfig(props.field.Config?.ImgUpload?.Crop),
    Enabled: runtimeCropEnabled.value
}));
watch(
    () => normalizeImageCropConfig(props.field.Config?.ImgUpload?.Crop).Enabled,
    (enabled) => {
        runtimeCropEnabled.value = enabled;
    },
    { immediate: true }
);
const pendingCropUploads = new Map();
let cropQueue = Promise.resolve();
let cropDialogResolver = null;

// 代码编辑器弹窗相关
const codeEditorVisible = ref(false);
const codeEditorType = ref('');
const codeEditorValue = ref('');
const codeEditorTitle = ref('');

// 打开配置弹窗
const openConfig = () => {
    // 初始化配置表单
    if (!props.field.Config) {
        props.field.Config = {};
    }
    if (!props.field.Config.ImgUpload) {
        props.field.Config.ImgUpload = {};
    }
    configForm.value = {
        Limit: props.field.Config.ImgUpload.Limit || false,
        Multiple: props.field.Config.ImgUpload.Multiple || false,
        MaxCount: props.field.Config.ImgUpload.MaxCount || 10,
        Tips: props.field.Config.ImgUpload.Tips || '',
        Preview: isImgCompressionEnabled(props.field.Config.ImgUpload.Preview),
        MaxSize: props.field.Config.ImgUpload.MaxSize || 10,
        SaveFullPath: props.field.Config.ImgUpload.SaveFullPath || false,
        Crop: normalizeImageCropConfig(props.field.Config.ImgUpload.Crop),
        BeforeUploadV8: props.field.Config.Upload?.BeforeUploadV8 || '',
        UploadSuccessV8: props.field.Config.Upload?.UploadSuccessV8 || ''
    };
    configDialogVisible.value = true;
};

// 保存配置
const saveConfig = () => {
    // 保存配置到 field.Config.ImgUpload
    if (!props.field.Config.ImgUpload) {
        props.field.Config.ImgUpload = {};
    }
    props.field.Config.ImgUpload.Limit = configForm.value.Limit;
    props.field.Config.ImgUpload.Multiple = configForm.value.Multiple;
    props.field.Config.ImgUpload.MaxCount = configForm.value.MaxCount;
    props.field.Config.ImgUpload.Tips = configForm.value.Tips;
    props.field.Config.ImgUpload.Preview = configForm.value.Preview;
    props.field.Config.ImgUpload.MaxSize = configForm.value.MaxSize;
    props.field.Config.ImgUpload.SaveFullPath = configForm.value.SaveFullPath;
    props.field.Config.ImgUpload.Crop = normalizeImageCropConfig(configForm.value.Crop);

    // 保存Upload V8配置
    if (!props.field.Config.Upload) {
        props.field.Config.Upload = {};
    }
    props.field.Config.Upload.BeforeUploadV8 = configForm.value.BeforeUploadV8;
    props.field.Config.Upload.UploadSuccessV8 = configForm.value.UploadSuccessV8;

    configDialogVisible.value = false;
    DiyCommon.Tips('配置已保存', true);
};

// V8代码编辑器相关方法
const getCodeLength = (value) => {
    if (!value) return '';
    const len = String(value).length;
    return len > 0 ? `(${len})` : '';
};

const openCodeEditor = (type, title) => {
    codeEditorType.value = type;
    codeEditorTitle.value = title;
    codeEditorValue.value = configForm.value[type] || '';
    codeEditorVisible.value = true;
};

const saveCodeEditor = () => {
    configForm.value[codeEditorType.value] = codeEditorValue.value;
    codeEditorVisible.value = false;
};

// 暴露方法给父组件
defineExpose({
    openConfig
});

// zhy：统一 PC、小程序和历史 ImgUpload 的值结构。
// zhy：小程序上传成功记录可能没有 State；只要存在有效 Path，默认视为已上传，
// zhy：避免 PC 端图片正常显示但状态被误判为“失败”。
const normalizeUploadItem = (item, index = 0) => {
    if (DiyCommon.IsNull(item)) return null;
    if (typeof item === 'string') {
        const path = item.trim();
        if (!path) return null;
        return {
            Id: `legacy_${index}_${path.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
            Name: path.split('/').pop() || path,
            Size: '',
            CreateTime: '',
            Path: path,
            State: 1
        };
    }
    if (typeof item !== 'object') return null;
    const path = item.Path || item.FilePathName || item.FullPath || item.Url || item.url || item.src || '';
    if (!path) return null;
    const rawState = item.State ?? item.state;
    return {
        ...item,
        Id: item.Id || item.id || `legacy_${index}_${String(path).replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        Name: item.Name || item.FileName || item.name || String(path).split('/').pop() || '',
        Size: item.Size ?? item.size ?? '',
        CreateTime: item.CreateTime || item.createTime || '',
        Path: path,
        State: rawState === undefined || rawState === null || rawState === '' ? 1 : rawState
    };
};

// 处理兼容老数据：将字符串转换为对象格式
const normalizeValue = (value) => {
    if (DiyCommon.IsNull(value) || value === '正在上传中...') {
        return value;
    }

    // zhy：数组中的每一项都需要补齐 Path/Id/State。
    if (Array.isArray(value)) {
        return value.map((item, index) => normalizeUploadItem(item, index)).filter(Boolean);
    }

    // zhy：如果已经是对象，补齐跨端兼容字段。
    if (typeof value === 'object' && value !== null) {
        return normalizeUploadItem(value);
    }

    // 如果是字符串
    if (typeof value === 'string') {
        const trimmed = value.trim();
        // zhy：同时兼容单图对象和多图数组 JSON。
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
            try {
                return normalizeValue(JSON.parse(trimmed));
            } catch (e) {
                console.error('JSON解析失败:', e);
                // 解析失败，按老数据处理
            }
        }

        // 老数据（纯路径字符串），包装成新格式
        if (trimmed && trimmed !== '[]' && trimmed !== '[ ]') {
            return normalizeUploadItem(trimmed);
        }
    }

    return value;
};

// 计算属性
const getMultipleFlag = computed(() => {
    return props.field.Config.ImgUpload.Multiple === true || props.field.Config.ImgUpload.Multiple === 'true';
});

// zhy：使用跨端归一化后的数据判断是否显示多图片列表。
const showMultipleImgList = computed(() => {
    const normalized = normalizeValue(props.modelValue);
    return Array.isArray(normalized) && normalized.length > 0;
});

// zhy：图片列表统一过滤无 Id 或无 Path 的异常上传记录。
const imageListComputed = computed(() => {
    const normalized = normalizeValue(props.modelValue);
    return Array.isArray(normalized) ? normalized.filter(img => img && img.Id && img.Path) : [];
});

// 验证单图片值是否有效
const isValidSingleImgValue = (value) => {
    // 先规范化数据
    const normalized = normalizeValue(value);

    if (DiyCommon.IsNull(normalized)) return false;
    if (normalized === '正在上传中...') return false;
    if (normalized === '[]' || normalized === '[ ]') return false;
    if (normalized === 'null' || normalized === 'undefined') return false;
    if (Array.isArray(normalized)) return false;
    // 如果是对象（单图片JSON格式），检查Path字段
    if (typeof normalized === 'object' && normalized !== null) {
        return !DiyCommon.IsNull(normalized.Path);
    }
    return true;
};

// 获取图片显示路径
const getImageDisplayPath = () => {
    const pathKey = props.field.Name + '_' + props.field.Name + '_RealPath';
    const realPath = props.FormDiyTableModel[pathKey];

    if (!DiyCommon.IsNull(realPath) && realPath !== './static/img/loading.gif') {
        return realPath;
    }

    // 内部仍保留 loading.gif 哨兵兼容旧表单逻辑，但不再把它交给图片标签发起请求。
    return '';
};

const isImagePathLoading = (path) => DiyCommon.IsNull(path) || path === './static/img/loading.gif';

// 初始化拖动排序
const initSortable = () => {
    // 确保容器存在且FormMode不是View
    if (!sortableContainer.value || props.FormMode === 'View') {
        return;
    }

    // 如果已经初始化过，先销毁
    if (sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }

    // 使用nextTick确保DOM完全渲染
    nextTick(() => {
        if (sortableContainer.value) {
            sortableInstance = Sortable.create(sortableContainer.value, {
                animation: 150,
                handle: '.drag-handle',
                onEnd: (evt) => {
                    const { oldIndex, newIndex } = evt;
                    if (oldIndex === newIndex) return;

                    const images = [...props.modelValue];
                    const movedItem = images.splice(oldIndex, 1)[0];
                    images.splice(newIndex, 0, movedItem);

                    emit('update:modelValue', images);
                    console.log('图片排序更新:', images);
                }
            });
            console.log('Sortable初始化成功');
        } else {
            console.warn('Sortable初始化失败：容器不存在');
        }
    });
};

// 获取上传URL
const GetUploadUrl = () => {
    return DiyApi.Upload();
};

// 获取上传请求头
const GetUploadHeaders = () => {
    return {
        'authorization': 'Bearer ' + DiyCommon.Authorization()
    };
};

const getUploadUid = (file) => String(file?.uid ?? '');

const finishCropDialog = (value) => {
    const resolver = cropDialogResolver;
    cropDialogResolver = null;
    cropDialogVisible.value = false;
    if (resolver) resolver(value);
    nextTick(() => {
        if (!cropDialogVisible.value) cropDialogFile.value = null;
    });
};

const handleCropConfirm = (result) => finishCropDialog(result);
const handleCropBypass = () => finishCropDialog({ bypass: true });
const handleCropCancel = () => finishCropDialog(null);

const enqueueImageCrop = (file, config) => {
    const task = cropQueue.then(() => new Promise((resolve) => {
        cropDialogResolver = resolve;
        cropDialogFile.value = file;
        cropDialogConfig.value = normalizeImageCropConfig(config);
        cropDialogVisible.value = true;
    }));
    // 无论用户应用还是取消，后续图片都能继续进入队列。
    cropQueue = task.then(() => undefined, () => undefined);
    return task;
};

const runBeforeUploadV8 = (file) => {
    const code = props.field.Config?.Upload?.BeforeUploadV8;
    if (!code) return Promise.resolve(true);
    return new Promise((resolve) => {
        emit('CallbackRunV8Code', {
            field: props.field,
            thisValue: file,
            _v8Code: code,
            callback: (result) => resolve(result !== false)
        });
    });
};

// 自定义上传保证裁剪图与未修改原图在同一 multipart 请求中送达。
// 后端先把 MicroiOriginalFile 写入私有桶，成功后才会保存裁剪展示图。
const performImageUpload = (options) => {
    const rawFile = options.file;
    const uid = getUploadUid(rawFile);
    const cropPayload = pendingCropUploads.get(uid);
    const formData = new FormData();
    const displayFile = cropPayload
        ? new File([cropPayload.blob], cropPayload.originalFile.name, {
            type: cropPayload.blob.type || cropPayload.originalFile.type,
            lastModified: Date.now()
        })
        : rawFile;

    formData.append(options.filename || 'file', displayFile, displayFile.name);
    if (cropPayload) {
        formData.append('MicroiOriginalFile', cropPayload.originalFile, cropPayload.originalFile.name);
        formData.append('CropEnabled', 'true');
    }
    formData.append('Path', '/img');
    const limitValue = props.field.Config.ImgUpload.Limit;
    const limitEnabled = limitValue === true || limitValue === 1
        || String(limitValue).trim().toLowerCase() === 'true'
        || String(limitValue).trim() === '1';
    formData.append('Limit', String(limitEnabled));
    formData.append('Multiple', String(getMultipleFlag.value));
    formData.append('Preview', String(isImgCompressionEnabled(props.field.Config.ImgUpload.Preview)));
    appendFormFieldUploadContext(formData, {
        field: props.field,
        diyTableModel: props.DiyTableModel,
        formData: props.FormDiyTableModel,
        tableRowId: props.TableRowId,
        sysMenuId: props.SysMenuId,
        tableChildAuth: props.TableChildAuth
    });

    const xhr = new XMLHttpRequest();
    xhr.open(options.method || 'POST', options.action || GetUploadUrl(), true);
    xhr.withCredentials = options.withCredentials === true;
    const headers = { ...GetUploadHeaders(), ...(options.headers || {}) };
    Object.entries(headers).forEach(([name, value]) => {
        if (value !== undefined && value !== null) xhr.setRequestHeader(name, String(value));
    });
    xhr.upload.addEventListener('progress', (event) => {
        if (event.total > 0) options.onProgress({ percent: event.loaded / event.total * 100 });
    });

    const clearPending = () => pendingCropUploads.delete(uid);
    xhr.addEventListener('load', () => {
        clearPending();
        if (xhr.status < 200 || xhr.status >= 300) {
            const error = new Error(xhr.responseText || `HTTP ${xhr.status}`);
            error.status = xhr.status;
            options.onError(error);
            return;
        }
        try {
            options.onSuccess(JSON.parse(xhr.responseText));
        } catch {
            options.onError(new Error('上传服务返回了无法解析的数据！'));
        }
    });
    xhr.addEventListener('error', () => {
        clearPending();
        options.onError(new Error('图片上传网络异常，请稍后重试！'));
    });
    xhr.addEventListener('abort', () => clearPending());
    xhr.send(formData);
    return xhr;
};

// 上传文件超出限制
const onExceed = () => {
    DiyCommon.Tips(`最多只能上传${props.field.Config.ImgUpload.MaxCount}张图片`, false);
};

// 上传前的准备逻辑（提取为独立函数，供V8事件回调使用）
const setupBeforeImgUpload = (file) => {
    if (!getMultipleFlag.value) {
        // 单图片模式：设置上传中状态
        props.FormDiyTableModel[props.field.Name] = '正在上传中...';
        emit('update:modelValue', '正在上传中...');
    } else {
        // 多图片模式：添加State=0的占位图片
        if (!Array.isArray(props.FormDiyTableModel[props.field.Name])) {
            props.FormDiyTableModel[props.field.Name] = [];
        }
        props.FormDiyTableModel[props.field.Name].push({
            Id: file.uid,
            State: 0,
            Name: file.name,
            Size: file.size
        });
        emit('update:modelValue', props.FormDiyTableModel[props.field.Name]);
    }
};

// 上传前的钩子
const BeforeImgUpload = async (file) => {
    // 验证文件类型
    const isImage = file.type.startsWith('image/');
    if (!isImage) {
        DiyCommon.Tips('只能上传图片文件！', false);
        return false;
    }

    const maxSizeMegabytes = Number(props.field.Config.ImgUpload.MaxSize || 10);
    if (Number.isFinite(maxSizeMegabytes) && maxSizeMegabytes > 0
        && file.size > maxSizeMegabytes * 1024 * 1024) {
        DiyCommon.Tips(`单张图片不能超过 ${maxSizeMegabytes}MB！`, false);
        return false;
    }

    const v8Allowed = await runBeforeUploadV8(file);
    if (!v8Allowed) return false;

    const cropConfig = activeCropConfig.value;
    if (cropConfig.Enabled) {
        if (!isCropSupportedImage(file)) {
            DiyCommon.Tips('开启裁剪时支持 JPG、PNG 和 WebP 图片；GIF 等动态格式请关闭裁剪后上传。', false, 10);
            return false;
        }
        const cropResult = await enqueueImageCrop(file, cropConfig);
        if (!cropResult) return false;
        if (!cropResult.bypass) pendingCropUploads.set(getUploadUid(file), cropResult);
    }

    setupBeforeImgUpload(file);
    return true;
};

// 图片上传移除
const ImgUploadRemove = (file, fileList) => {
    if (!getMultipleFlag.value) {
        props.FormDiyTableModel[props.field.Name] = '';
        emit('update:modelValue', '');
    }
};

const clearFailedImgUpload = (file) => {
    if (getMultipleFlag.value) {
        const currentImages = Array.isArray(props.FormDiyTableModel[props.field.Name])
            ? props.FormDiyTableModel[props.field.Name]
            : [];
        const failedUid = file && file.uid;
        const nextImages = currentImages.filter(item => !(
            item
            && item.State === 0
            && String(item.Id) === String(failedUid)
        ));
        props.FormDiyTableModel[props.field.Name] = nextImages;
        emit('update:modelValue', nextImages);
        return;
    }

    if (props.FormDiyTableModel[props.field.Name] === '正在上传中...') {
        props.FormDiyTableModel[props.field.Name] = '';
        emit('update:modelValue', '');
    }
};

const ImgUploadError = (error, file) => {
    clearFailedImgUpload(file);
    DiyCommon.Tips(getUploadErrorMessage(error, file && (file.raw || file)), false, 12);
};

// 上传成功的钩子
const ImgUploadSuccess = (result, file, fileList) => {
    console.log('=== ImgUploadSuccess 被调用了 ===');
    console.log('原始 result:', result);
    console.log('原始 file:', file);
    console.log('原始 file.response:', file.response);

    const isSuccess = DiyCommon.Result(result);
    console.log('DiyCommon.Result(result) 返回:', isSuccess);

    if (isSuccess) {
        const responseData = normalizeUploadResponseItem(file.response?.Data ?? result.Data);
        if (!responseData?.Path) {
            clearFailedImgUpload(file);
            DiyCommon.Tips('图片上传成功，但服务端未返回可用的图片路径！', false, 10);
            return;
        }
        const uploadedImgId = responseData.Id || file.uid;
        const uploadedImgPath = responseData.Path;
        // zhy：以服务端实际 Limit 为准，并复用本次上传返回的短期地址，避免未保存记录二次鉴权失败。
        const uploadedPreviewUrl = getUploadPreviewUrl(responseData);
        const effectiveLimit = resolveUploadLimit(responseData, props.field.Config.ImgUpload.Limit);
        // zhy：业务字段只保存稳定路径和文件元数据，不保存短期 URL、完整地址或 Limit。
        const uploadedImgMeta = {
            ...sanitizeUploadMeta(responseData),
            Id: uploadedImgId,
            Name: responseData.Name || file.name,
            Size: responseData.Size,
            CreateTime: responseData.CreateTime,
            Path: uploadedImgPath,
            State: 1
        };

        if (getMultipleFlag.value) {
            // 多图片模式
            let imgsJson = props.FormDiyTableModel[props.field.Name];
            if (!Array.isArray(imgsJson)) imgsJson = [];

            console.log('【多图片】当前图片列表:', JSON.parse(JSON.stringify(imgsJson)));
            console.log('【多图片】查找file.uid:', file.uid);

            let isHave = false;
            imgsJson.forEach((element) => {
                if (element.Id == file.uid) {
                    console.log('【多图片】✓ 找到匹配图片，更新State为1');
                    element.Id = uploadedImgId;
                    element.Size = responseData.Size;
                    element.CreateTime = responseData.CreateTime;
                    element.Path = uploadedImgPath;
                    element.State = 1;
                    element.Name = responseData.Name || file.name;
                    isHave = true;
                }
            });

            if (!isHave) {
                console.log('【多图片】× 未找到匹配图片，添加新图片');
                imgsJson.push(uploadedImgMeta);
            }

            // zhy：先写运行时 RealPath 再更新字段值，避免监听器对未保存记录提前发起取址请求。
            setRealPath(uploadedImgId, uploadedImgPath, effectiveLimit, uploadedPreviewUrl);
            props.FormDiyTableModel[props.field.Name] = imgsJson;
            emit('update:modelValue', imgsJson);
            console.log('【多图片】更新后的图片列表:', JSON.parse(JSON.stringify(imgsJson)));

        } else {
            // 单图片模式 - 存储为JSON字符串
            console.log('【单图片】上传成功，Path:', uploadedImgPath);
            const singleImgObject = {
                Id: uploadedImgId,
                Name: responseData.Name || file.name,
                Size: responseData.Size,
                CreateTime: responseData.CreateTime,
                Path: uploadedImgPath,
                State: 1
            };
            // 存储为JSON字符串
            const jsonString = JSON.stringify(singleImgObject);
            // zhy：单图片同样先注入本次上传的短期地址，再触发表单值更新。
            setRealPath(props.field.Name, uploadedImgPath, effectiveLimit, uploadedPreviewUrl);
            props.FormDiyTableModel[props.field.Name] = jsonString;
            emit('update:modelValue', jsonString);
            console.log('【单图片】存储的JSON字符串:', jsonString);
            console.log('【单图片】验证存储类型:', typeof props.FormDiyTableModel[props.field.Name]);
            console.log('【单图片】验证字符串是否正确:', props.FormDiyTableModel[props.field.Name].charAt ? '是字符串' : '不是字符串');
        }

        // 上传成功后V8事件
        if (props.field.Config?.Upload?.UploadSuccessV8) {
            emit('CallbackRunV8Code', {
                field: props.field,
                _v8Code: props.field.Config.Upload.UploadSuccessV8
            });
        }
        // 触发标准V8Code（兼容旧版行为）
        emit('CallbackRunV8Code', { field: props.field });

        console.log('=== ImgUploadSuccess END ===');
    } else {
        clearFailedImgUpload(file);
        console.error('【上传失败】接口返回失败:', result);
    }
};

// zhy：上传成功时优先复用短期地址；历史图片仍按原流程调用 GetPrivateFileUrl 校验记录权限。
const setRealPath = (imgId, imgPath, isLimit, uploadedPreviewUrl = '') => {
    const pathKey = props.field.Name + '_' + imgId + '_RealPath';
    console.log('=== setRealPath START ===');
    console.log('参数 imgId:', imgId);
    console.log('参数 imgPath:', imgPath);
    console.log('参数 isLimit:', isLimit);
    console.log('计算出的 pathKey:', pathKey);

    if (isLimit === true) {
        // zhy：短期地址只写入运行时 RealPath，绝不写入图片业务字段。
        if (!DiyCommon.IsNull(uploadedPreviewUrl)) {
            props.FormDiyTableModel[pathKey] = uploadedPreviewUrl;
            return;
        }
        // 私有图片，需要获取临时URL
        props.FormDiyTableModel[pathKey] = './static/img/loading.gif';
        console.log('【私有图片】设置loading状态');

        DiyCommon.Post(
            '/apiengine/platform-private-file-url',
            {
                FilePathName: imgPath,
                HDFS: SysConfig.value.HDFS || 'Aliyun',
                FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                FormDataId: props.TableRowId || props.FormDiyTableModel.Id || '',
                FieldId: props.field.Id,
                SysMenuId: props.SysMenuId,
                _TableChildAuth: props.TableChildAuth || undefined
            },
            (privateResult) => {
                if (DiyCommon.Result(privateResult)) {
                    props.FormDiyTableModel[pathKey] = privateResult.Data;
                    console.log('【私有图片】URL获取成功:', privateResult.Data);
                } else {
                    props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                    console.error('【私有图片】URL获取失败');
                }
            },
            () => {
                props.FormDiyTableModel[pathKey] = './static/img/img-load-fail.jpg';
                console.error('【私有图片】URL请求异常');
            }
        );
    } else {
        // 公开图片，直接拼接路径
        const serverPath = DiyCommon.GetServerPath(imgPath);
        props.FormDiyTableModel[pathKey] = serverPath;
        console.log('【公开图片】路径设置完成');
        console.log('【公开图片】serverPath:', serverPath);
    }

    console.log('=== setRealPath END ===');
};

// 确认删除图片
const ConfirmDelUploadImgs = (img) => {
    ElMessageBox.confirm(
        `确定要删除图片 "${img.Name}" 吗？`,
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(() => {
        DelUploadImgs(img);
    }).catch(() => {});
};

// 删除多图片
const DelUploadImgs = (img) => {
    const images = props.FormDiyTableModel[props.field.Name].filter(i => i.Id !== img.Id);
    props.FormDiyTableModel[props.field.Name] = images;
    emit('update:modelValue', images);
};

// 确认删除单图片
const ConfirmDelSingleUpload = () => {
    const imgName = GetFileName(props.modelValue);
    ElMessageBox.confirm(
        `确定要删除图片 "${imgName}" 吗？`,
        '删除确认',
        {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
        }
    ).then(() => {
        DelSingleUpload();
    }).catch(() => {});
};

// 删除单图片
const DelSingleUpload = () => {
    delete props.FormDiyTableModel[props.field.Name];
    delete props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'];
    delete props.FormDiyTableModel[props.field.Name + '_FileSize'];

    props.FormDiyTableModel[props.field.Name] = '';
    props.FormDiyTableModel[props.field.Name + '_' + props.field.Name + '_RealPath'] = '';

    if (uploadRef.value) {
        uploadRef.value.clearFiles();
    }

    // 清空单图文件名
    singleImageName.value = '';

    emit('update:modelValue', '');
};

// 更新单图文件名
const updateSingleImageName = () => {
    const normalized = normalizeValue(props.modelValue);
    if (typeof normalized === 'object' && normalized !== null) {
        // 更新对象中的Name字段
        normalized.Name = singleImageName.value;
        // 重新序列化为JSON字符串
        const jsonString = JSON.stringify(normalized);
        props.FormDiyTableModel[props.field.Name] = jsonString;
        emit('update:modelValue', jsonString);
    }
};

// 打开图片预览
const openImagePreview = (img) => {
    const imagePath = props.FormDiyTableModel[props.field.Name + '_' + img.Id + '_RealPath'];
    if (!DiyCommon.IsNull(imagePath) && imagePath !== './static/img/loading.gif') {
        window.open(imagePath, '_blank', 'noopener,noreferrer');
    }
};

// 获取文件名
const GetFileName = (path) => {
    // 先规范化数据
    const normalized = normalizeValue(path);

    if (DiyCommon.IsNull(normalized)) {
        return '';
    }
    // 如果是对象（单图片JSON格式），直接返回Name
    if (typeof normalized === 'object' && normalized !== null) {
        return normalized.Name || '';
    }
    // 如果是字符串路径，从路径中提取文件名
    var arr = normalized.split('/');
    return arr[arr.length - 1];
};

// 格式化文件大小
const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    if (bytes < k) return bytes + ' B';
    if (bytes < k * k) return (bytes / k).toFixed(2) + ' KB';
    if (bytes < k * k * k) return (bytes / (k * k)).toFixed(2) + ' MB';
    return (bytes / (k * k * k)).toFixed(2) + ' GB';
};

// 获取单图片的大小
const getSingleImgSize = () => {
    // 先规范化数据
    const normalized = normalizeValue(props.modelValue);

    // 如果是对象（单图片JSON格式），从对象中读取Size
    if (typeof normalized === 'object' && normalized !== null && normalized.Size) {
        return formatFileSize(normalized.Size);
    }
    // 兼容老数据（字符串格式）- 尝试从旧的FileSize字段读取
    const sizeKey = props.field.Name + '_FileSize';
    const size = props.FormDiyTableModel[sizeKey];
    return formatFileSize(size);
};

// zhy：多图片预览统一使用归一化列表获取真实访问地址。
const GetImgUploadImgs = () => {
    const result = [];
    imageListComputed.value.forEach((img) => {
        const path = props.FormDiyTableModel[props.field.Name + '_' + img.Id + '_RealPath'];
        if (!DiyCommon.IsNull(path) && path !== './static/img/loading.gif') {
            result.push(path);
        }
    });
    return result;
};

// 获取上传后的下载地址（用于View模式）
const GetUploadPath = (img) => {
    // 获取图片路径：如果是单图片对象，从Path字段获取；否则使用原值或img.Path
    let imgPathName;
    if (DiyCommon.IsNull(img)) {
        const fieldValue = props.FormDiyTableModel[props.field.Name];
        // 先规范化数据
        const normalized = normalizeValue(fieldValue);
        // 如果是对象（单图片JSON格式），取Path字段
        if (typeof normalized === 'object' && normalized !== null && normalized.Path) {
            imgPathName = normalized.Path;
        } else {
            imgPathName = normalized;
        }
    } else {
        imgPathName = img.Path;
    }

    if (DiyCommon.IsNull(imgPathName) || Array.isArray(imgPathName)) {
        return;
    }

    if (imgPathName === '[]' || imgPathName === '[ ]' || imgPathName === 'null' || imgPathName === 'undefined') {
        return;
    }

    const limit = props.field.Config.ImgUpload.Limit;
    const imgId = props.field.Name;

    if (limit !== true) {
        const serverPath = DiyCommon.GetServerPath(imgPathName);
        props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = serverPath;
    } else {
        const nowPath = props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'];

        if (DiyCommon.IsNull(nowPath) || nowPath == './static/img/loading.gif') {
            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/loading.gif';
            if (imgPathName != './static/img/loading.gif' && imgPathName != '正在上传中...') {
                DiyCommon.Post(
                    '/apiengine/platform-private-file-url',
                    {
                        FilePathName: imgPathName,
                        HDFS: SysConfig.value.HDFS || 'Aliyun',
                        FormEngineKey: props.DiyTableModel.Name || props.field.TableId,
                        FormDataId: props.TableRowId || props.FormDiyTableModel.Id || '',
                        FieldId: props.field.Id,
                        SysMenuId: props.SysMenuId,
                        _TableChildAuth: props.TableChildAuth || undefined
                    },
                    (result) => {
                        if (DiyCommon.Result(result)) {
                            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = result.Data;
                        } else {
                            props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/img-load-fail.jpg';
                        }
                    },
                    () => {
                        props.FormDiyTableModel[props.field.Name + '_' + imgId + '_RealPath'] = './static/img/img-load-fail.jpg';
                    }
                );
            }
        }
    }
};

// 监听modelValue变化
watch(
    () => props.modelValue,
    (newVal) => {
        // 移除 FormMode == 'View' 的限制，让编辑模式和查看模式都能正确显示图片
        if (!DiyCommon.IsNull(newVal) && !getMultipleFlag.value) {
            GetUploadPath(null);
            // 同时初始化单图文件名
            const normalized = normalizeValue(newVal);
            if (typeof normalized === 'object' && normalized !== null) {
                singleImageName.value = normalized.Name || '';
            } else {
                singleImageName.value = GetFileName(newVal);
            }
        }
    },
    { immediate: true }
);

// 监听图片列表变化，重新初始化sortable
watch(
    () => showMultipleImgList.value,
    async (newVal) => {
        if (newVal) {
            await nextTick();
            initSortable();
            // zhy：为归一化后的多图片初始化 RealPath（编辑模式和查看模式都需要）。
            if (imageListComputed.value.length) {
                imageListComputed.value.forEach((img) => {
                    if (img && img.Id && img.Path) {
                        const pathKey = props.field.Name + '_' + img.Id + '_RealPath';
                        // 只在 RealPath 未设置或为 loading.gif 时才设置
                        if (DiyCommon.IsNull(props.FormDiyTableModel[pathKey]) ||
                            props.FormDiyTableModel[pathKey] === './static/img/loading.gif') {
                            setRealPath(img.Id, img.Path, props.field.Config.ImgUpload.Limit);
                        }
                    }
                });
            }
        }
    }
);

// 组件挂载后初始化
onMounted(() => {
    // 初始化多图片的拖拽排序
    if (showMultipleImgList.value) {
        nextTick(() => {
            initSortable();
        });
    }

    // zhy：为已有的归一化多图片初始化 RealPath（编辑模式和查看模式都需要）。
    if (getMultipleFlag.value && imageListComputed.value.length > 0) {
        imageListComputed.value.forEach((img) => {
            if (img && img.Id && img.Path) {
                const pathKey = props.field.Name + '_' + img.Id + '_RealPath';
                // 只在 RealPath 未设置或为 loading.gif 时才设置
                if (DiyCommon.IsNull(props.FormDiyTableModel[pathKey]) ||
                    props.FormDiyTableModel[pathKey] === './static/img/loading.gif') {
                    setRealPath(img.Id, img.Path, props.field.Config.ImgUpload.Limit);
                }
            }
        });
    }
});

// 组件卸载前清理
onBeforeUnmount(() => {
    if (sortableInstance) {
        sortableInstance.destroy();
    }
    if (cropDialogResolver) finishCropDialog(null);
    pendingCropUploads.clear();
    uploadRef.value = null;
});
</script>

<style lang="scss" scoped>
.diy-imgupload {
    width: 100%;

    .image-upload-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;

        .el-button {
            min-height: 44px;
            min-width: 112px;
            margin-left: 0;
        }
    }

    .single-img-display {
        margin-top: 8px;
        display: inline-flex;
        flex-direction: column;
        gap: 8px;

        &.view-mode {
            .img-actions {
                justify-content: flex-start;
            }
        }

        .preview-image {
            width: 175px;
            height: 175px;
            border-radius: 4px;
            border: 1px solid #e4e7ed;
        }

        .img-actions, .img-info {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 8px;

            .img-name-input {
                flex: 1;
                :deep(.el-input__wrapper) {
                    padding: 2px 8px;
                }
                :deep(.el-input__inner) {
                    font-size: 13px;
                }
            }

            .img-name {
                flex: 1;
                font-size: 13px;
                color: #606266;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .img-size {
                font-size: 12px;
                color: #909399;
                flex-shrink: 0;
            }
        }
    }

    .multiple-imgs-list {
        margin-top: 8px;
        display: flex;
        flex-wrap: wrap;
        gap: 8px;

        .img-card {
            width: 140px;
            position: relative;
            cursor: move;
            transition: all 0.2s;

            &:hover {
                box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
            }

            .drag-handle {
                position: absolute;
                top: 4px;
                left: 4px;
                font-size: 18px;
                color: #fff;
                cursor: move;
                z-index: 1;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                padding: 2px;

                &:hover {
                    background: rgba(0, 0, 0, 0.7);
                }
            }

            .card-image {
                width: 140px;
                height: 140px;
            }

            .card-footer {
                padding: 6px;
                display: flex;
                flex-direction: column;
                gap: 4px;

                .img-detail {
                    flex: 1;
                    min-width: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 2px;

                    .img-name {
                        font-size: 12px;
                        color: #606266;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;

                        :deep(.el-input) {
                            .el-input__wrapper {
                                padding: 2px 6px;
                            }
                            .el-input__inner {
                                font-size: 12px;
                            }
                        }
                    }

                    .img-meta {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 4px;
                        font-size: 11px;
                        color: #909399;

                        .img-size {
                            flex-shrink: 0;
                        }

                        .img-time {
                            flex: 1;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                        }
                    }
                }

                .el-button {
                    align-self: flex-end;
                    margin-top: 2px;
                }
            }
        }
    }
}

.form-item-tip {
    font-size: 12px;
    color: #909399;
    line-height: 1.5;
    margin-top: 4px;
}

/* zhy隐藏缩放旋转按钮，但保留左右切换按钮 */
@media (max-width: 768px) {
  :deep(.el-image-viewer__actions) {
    display: none !important;
    }
}

</style>

<style lang="scss">
.mci-imgupload-config-dialog {
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 28px 80px rgba(15, 23, 42, .22);

    .el-dialog__header {
        margin: 0;
        padding: 20px 24px 15px;
        border-bottom: 1px solid var(--el-border-color-lighter);
    }
    .el-dialog__title { font-size: 18px; font-weight: 700; color: var(--el-text-color-primary); }
    .el-dialog__body { max-height: min(72vh, 760px); padding: 18px 22px; overflow-y: auto; background: var(--el-fill-color-extra-light); }
    .el-dialog__footer { padding: 15px 22px; border-top: 1px solid var(--el-border-color-lighter); background: var(--el-bg-color); }

    .mci-img-config-banner {
        display: flex; align-items: center; gap: 13px; margin-bottom: 15px; padding: 15px 17px;
        border: 1px solid color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color-lighter));
        border-radius: 14px;
        background: linear-gradient(115deg, color-mix(in srgb, var(--el-color-primary) 9%, #fff), #fff 68%);
    }
    .mci-img-config-banner > span {
        width: 40px; height: 40px; display: grid; place-items: center; flex: 0 0 auto;
        border-radius: 12px; color: #fff; font-size: 20px;
        background: linear-gradient(145deg, var(--el-color-primary), #7c3aed);
        box-shadow: 0 8px 18px color-mix(in srgb, var(--el-color-primary) 22%, transparent);
    }
    .mci-img-config-banner > div { display: flex; flex-direction: column; min-width: 0; }
    .mci-img-config-banner strong { color: var(--el-text-color-primary); font-size: 14px; }
    .mci-img-config-banner small { margin-top: 4px; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.5; }

    .mci-img-config-section {
        margin-top: 12px; padding: 17px 18px 4px; border: 1px solid var(--el-border-color-lighter);
        border-radius: 14px; background: var(--el-bg-color);
    }
    .mci-img-config-section > header { margin-bottom: 14px; display: flex; align-items: center; gap: 9px; }
    .mci-img-config-section > header > span { color: var(--el-color-primary); font-size: 10px; font-weight: 800; letter-spacing: .1em; }
    .mci-img-config-section > header > strong { color: var(--el-text-color-primary); font-size: 14px; }
    .mci-img-config-section > header .el-tag { margin-left: auto; }
    .mci-img-config-section--crop {
        border-color: color-mix(in srgb, var(--el-color-primary) 22%, var(--el-border-color-lighter));
        background: linear-gradient(145deg, var(--el-bg-color), color-mix(in srgb, var(--el-color-primary) 3%, var(--el-bg-color)));
    }
    .el-form-item { margin-bottom: 15px; }
    .el-form-item__content { min-width: 0; }
    .form-item-tip { flex-basis: 100%; margin-top: 5px; color: var(--el-text-color-secondary); font-size: 11px; line-height: 1.5; }
    .mci-custom-ratio-inputs { display: flex; align-items: center; gap: 10px; }
    .mci-custom-ratio-inputs .el-input-number { width: 145px; }
}

@media (max-width: 680px) {
    .mci-imgupload-config-dialog {
        width: calc(100vw - 20px) !important;
        .el-dialog__body { padding: 14px; }
        .mci-img-config-section { padding: 15px 13px 3px; }
        .el-form-item { display: block; }
        .el-form-item__label { width: auto !important; height: auto; margin-bottom: 7px; }
        .el-form-item__content { margin-left: 0 !important; }
        .el-radio-group { display: grid; grid-template-columns: 1fr; width: 100%; }
        .el-radio-button__inner { width: 100%; }
    }
}
</style>
