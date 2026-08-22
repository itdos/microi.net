<template>
    <el-dialog
        :model-value="modelValue"
        class="mci-image-crop-dialog"
        width="min(1120px, calc(100vw - 32px))"
        :close-on-click-modal="false"
        :close-on-press-escape="!isProcessing"
        :show-close="false"
        append-to-body
        destroy-on-close
        align-center
        @update:model-value="handleVisibleChange"
        @closed="destroyCropper"
    >
        <template #header>
            <div class="mci-crop-header">
                <div class="mci-crop-brand">
                    <span class="mci-crop-brand__icon"><el-icon><Crop /></el-icon></span>
                    <span>
                        <small>MICROI IMAGE STUDIO</small>
                        <strong>{{ t('Msg.ImageCropTitle') }}</strong>
                    </span>
                </div>
                <div class="mci-crop-file" :title="file?.name || ''">
                    <span>{{ file?.name || t('Msg.ImageCropUntitled') }}</span>
                    <small>{{ originalMeta }}</small>
                </div>
                <el-button
                    class="mci-crop-close"
                    circle
                    :disabled="isProcessing"
                    :aria-label="t('Msg.Cancel')"
                    @click="cancelCrop"
                >
                    <el-icon><Close /></el-icon>
                </el-button>
            </div>
        </template>

        <div class="mci-crop-workspace">
            <section class="mci-crop-stage" aria-live="polite">
                <div class="mci-crop-stage__grid"></div>
                <div class="mci-crop-canvas-shell">
                    <img ref="imageRef" class="mci-crop-source" :alt="t('Msg.ImageCropPreviewAlt')" />
                </div>
                <div class="mci-crop-stage__footer">
                    <span><i></i>{{ t('Msg.ImageCropOriginalProtected') }}</span>
                    <span>{{ cropMeta }}</span>
                </div>
            </section>

            <aside class="mci-crop-panel">
                <div class="mci-crop-panel__intro">
                    <span class="mci-crop-step">01</span>
                    <div>
                        <strong>{{ t('Msg.ImageCropRatioTitle') }}</strong>
                        <p>{{ ratioDescription }}</p>
                    </div>
                </div>

                <div v-if="normalizedConfig.Mode === 'select'" class="mci-ratio-grid">
                    <button
                        v-for="ratio in selectableRatios"
                        :key="ratio.value"
                        type="button"
                        class="mci-ratio-chip"
                        :class="{ 'is-active': selectedRatio === ratio.value }"
                        @click="selectRatio(ratio.value)"
                    >
                        <span :class="`mci-ratio-shape mci-ratio-shape--${ratio.value.replace(':', '-')}`"></span>
                        {{ ratio.value === 'free' ? t('Msg.ImageCropFree') : ratio.label }}
                    </button>
                </div>
                <div v-else class="mci-ratio-lock">
                    <el-icon><FullScreen /></el-icon>
                    <span>
                        <small>{{ normalizedConfig.Mode === 'free' ? t('Msg.ImageCropFreeMode') : t('Msg.ImageCropFixedMode') }}</small>
                        <strong>{{ activeRatioLabel }}</strong>
                    </span>
                </div>

                <div v-if="selectedRatio === 'custom'" class="mci-custom-ratio">
                    <span>{{ normalizedConfig.CustomWidth }}</span>
                    <i>:</i>
                    <span>{{ normalizedConfig.CustomHeight }}</span>
                </div>

                <div class="mci-crop-divider"></div>

                <div class="mci-crop-panel__intro mci-crop-panel__intro--compact">
                    <span class="mci-crop-step">02</span>
                    <div>
                        <strong>{{ t('Msg.ImageCropFineTuneTitle') }}</strong>
                        <p>{{ t('Msg.ImageCropFineTuneDesc') }}</p>
                    </div>
                </div>

                <div v-if="normalizedConfig.AllowZoom" class="mci-crop-control">
                    <div class="mci-crop-control__label">
                        <span><el-icon><ZoomIn /></el-icon>{{ t('Msg.ImageCropZoom') }}</span>
                        <strong>{{ zoomPercent }}%</strong>
                    </div>
                    <el-slider v-model="zoomPercent" :min="0" :max="100" :show-tooltip="false" @input="applyZoom" />
                </div>

                <div class="mci-crop-tools">
                    <el-tooltip v-if="normalizedConfig.AllowRotate" :content="t('Msg.ImageCropRotateLeft')">
                        <button type="button" :aria-label="t('Msg.ImageCropRotateLeft')" @click="rotate(-90)">
                            <el-icon><RefreshLeft /></el-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip v-if="normalizedConfig.AllowRotate" :content="t('Msg.ImageCropRotateRight')">
                        <button type="button" :aria-label="t('Msg.ImageCropRotateRight')" @click="rotate(90)">
                            <el-icon><RefreshRight /></el-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip v-if="normalizedConfig.AllowFlip" :content="t('Msg.ImageCropFlipHorizontal')">
                        <button type="button" :aria-label="t('Msg.ImageCropFlipHorizontal')" @click="flip('x')">
                            <el-icon class="mci-flip-horizontal"><Switch /></el-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip v-if="normalizedConfig.AllowFlip" :content="t('Msg.ImageCropFlipVertical')">
                        <button type="button" :aria-label="t('Msg.ImageCropFlipVertical')" @click="flip('y')">
                            <el-icon class="mci-flip-vertical"><Switch /></el-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip :content="t('Msg.ImageCropReset')">
                        <button type="button" :aria-label="t('Msg.ImageCropReset')" @click="resetCropper">
                            <el-icon><Refresh /></el-icon>
                        </button>
                    </el-tooltip>
                </div>

                <div class="mci-crop-assurance">
                    <el-icon><PictureRounded /></el-icon>
                    <span>
                        <strong>{{ t('Msg.ImageCropQualityTitle') }}</strong>
                        <small>{{ t('Msg.ImageCropQualityDesc') }}</small>
                    </span>
                </div>
            </aside>
        </div>

        <template #footer>
            <div class="mci-crop-footer">
                <div class="mci-crop-footer__hint">
                    <span class="mci-shortcut">ESC</span>{{ t('Msg.ImageCropCancelHint') }}
                </div>
                <div class="mci-crop-footer__actions">
                    <el-button :disabled="isProcessing" @click="cancelCrop">{{ t('Msg.Cancel') }}</el-button>
                    <el-button class="mci-crop-bypass" :disabled="isProcessing" @click="bypassCrop">
                        <el-icon><UploadFilled /></el-icon>
                        {{ t('Msg.ImageCropBypassUpload') }}
                    </el-button>
                    <el-button type="primary" :loading="isProcessing" @click="confirmCrop">
                        <el-icon v-if="!isProcessing"><Check /></el-icon>
                        {{ t('Msg.ImageCropApply') }}
                    </el-button>
                </div>
            </div>
        </template>
    </el-dialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ElMessage } from 'element-plus';
import {
    Check,
    Close,
    Crop,
    FullScreen,
    PictureRounded,
    Refresh,
    RefreshLeft,
    RefreshRight,
    Switch,
    UploadFilled,
    ZoomIn
} from '@element-plus/icons-vue';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import {
    getCropOutputMimeType,
    IMAGE_CROP_RATIOS,
    normalizeImageCropConfig,
    resolveCropAspectRatio
} from './image-crop-config';

const props = defineProps({
    modelValue: { type: Boolean, default: false },
    file: { type: Object, default: null },
    config: { type: Object, default: () => ({}) }
});

const emit = defineEmits(['update:modelValue', 'confirm', 'bypass', 'cancel']);
const { t } = useI18n();
const imageRef = ref(null);
const selectedRatio = ref('free');
const zoomPercent = ref(50);
const originalWidth = ref(0);
const originalHeight = ref(0);
const cropWidth = ref(0);
const cropHeight = ref(0);
const isProcessing = ref(false);
let cropper = null;
let objectUrl = '';
let scaleX = 1;
let scaleY = 1;
let previousZoom = 50;

const normalizedConfig = computed(() => normalizeImageCropConfig(props.config));
const selectableRatios = computed(() => IMAGE_CROP_RATIOS);
const formatSize = (bytes) => {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) return '--';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};
const originalMeta = computed(() => {
    const dimensions = originalWidth.value && originalHeight.value
        ? `${originalWidth.value} × ${originalHeight.value}`
        : '--';
    return `${dimensions}  ·  ${formatSize(props.file?.size)}`;
});
const cropMeta = computed(() => cropWidth.value && cropHeight.value
    ? `${t('Msg.ImageCropOutput')} ${cropWidth.value} × ${cropHeight.value}px`
    : t('Msg.ImageCropPreparing'));
const activeRatioLabel = computed(() => {
    if (selectedRatio.value === 'free') return t('Msg.ImageCropFree');
    if (selectedRatio.value === 'custom') {
        return `${normalizedConfig.value.CustomWidth} : ${normalizedConfig.value.CustomHeight}`;
    }
    return selectedRatio.value.replace(':', ' : ');
});
const ratioDescription = computed(() => normalizedConfig.value.Mode === 'select'
    ? t('Msg.ImageCropRatioSelectDesc')
    : normalizedConfig.value.Mode === 'fixed'
        ? t('Msg.ImageCropRatioFixedDesc')
        : t('Msg.ImageCropRatioFreeDesc'));

const updateCropMeta = () => {
    if (!cropper) return;
    const data = cropper.getData(true);
    cropWidth.value = Math.max(1, Math.round(data.width || 0));
    cropHeight.value = Math.max(1, Math.round(data.height || 0));
};

const destroyCropper = () => {
    cropper?.destroy();
    cropper = null;
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    objectUrl = '';
    isProcessing.value = false;
};

const initializeCropper = async () => {
    destroyCropper();
    if (!props.modelValue || !props.file) return;
    selectedRatio.value = normalizedConfig.value.Mode === 'free'
        ? 'free'
        : normalizedConfig.value.Ratio;
    zoomPercent.value = 50;
    previousZoom = 50;
    scaleX = 1;
    scaleY = 1;
    objectUrl = URL.createObjectURL(props.file);
    await nextTick();
    if (!imageRef.value || !props.modelValue) return;
    imageRef.value.src = objectUrl;
    cropper = new Cropper(imageRef.value, {
        viewMode: 1,
        dragMode: 'move',
        aspectRatio: resolveCropAspectRatio(normalizedConfig.value, selectedRatio.value),
        autoCropArea: 0.86,
        background: false,
        responsive: true,
        restore: false,
        guides: true,
        center: true,
        highlight: false,
        movable: true,
        rotatable: normalizedConfig.value.AllowRotate,
        scalable: normalizedConfig.value.AllowFlip,
        zoomable: normalizedConfig.value.AllowZoom,
        zoomOnTouch: normalizedConfig.value.AllowZoom,
        zoomOnWheel: normalizedConfig.value.AllowZoom,
        ready() {
            const data = cropper?.getImageData();
            originalWidth.value = Math.round(data?.naturalWidth || 0);
            originalHeight.value = Math.round(data?.naturalHeight || 0);
            updateCropMeta();
        },
        crop: updateCropMeta
    });
};

watch(() => [props.modelValue, props.file], ([visible]) => {
    if (visible) initializeCropper();
    else destroyCropper();
});

const selectRatio = (ratio) => {
    selectedRatio.value = ratio;
    cropper?.setAspectRatio(resolveCropAspectRatio(normalizedConfig.value, ratio));
    updateCropMeta();
};

const applyZoom = (value) => {
    if (!cropper || !normalizedConfig.value.AllowZoom) return;
    const delta = (Number(value) - previousZoom) / 100;
    cropper.zoom(delta);
    previousZoom = Number(value);
};
const rotate = (degrees) => cropper?.rotate(degrees);
const flip = (axis) => {
    if (!cropper) return;
    if (axis === 'x') {
        scaleX *= -1;
        cropper.scaleX(scaleX);
    } else {
        scaleY *= -1;
        cropper.scaleY(scaleY);
    }
};
const resetCropper = () => {
    if (!cropper) return;
    cropper.reset();
    scaleX = 1;
    scaleY = 1;
    zoomPercent.value = 50;
    previousZoom = 50;
    cropper.setAspectRatio(resolveCropAspectRatio(normalizedConfig.value, selectedRatio.value));
    updateCropMeta();
};

const cancelCrop = () => {
    if (isProcessing.value) return;
    emit('update:modelValue', false);
    emit('cancel');
};
const bypassCrop = () => {
    if (isProcessing.value) return;
    emit('bypass', props.file);
    emit('update:modelValue', false);
};
const handleVisibleChange = (visible) => {
    if (!visible) cancelCrop();
};

const confirmCrop = async () => {
    if (!cropper || !props.file || isProcessing.value) return;
    isProcessing.value = true;
    try {
        const mimeType = getCropOutputMimeType(props.file);
        const canvas = cropper.getCroppedCanvas({
            maxWidth: 4096,
            maxHeight: 4096,
            fillColor: mimeType === 'image/jpeg' ? '#ffffff' : undefined,
            imageSmoothingEnabled: true,
            imageSmoothingQuality: 'high'
        });
        if (!canvas) throw new Error(t('Msg.ImageCropCanvasError'));
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                result => result ? resolve(result) : reject(new Error(t('Msg.ImageCropEncodeError'))),
                mimeType,
                mimeType === 'image/png' ? undefined : 0.92
            );
        });
        emit('confirm', {
            blob,
            originalFile: props.file,
            width: canvas.width,
            height: canvas.height,
            ratio: selectedRatio.value
        });
        emit('update:modelValue', false);
    } catch (error) {
        ElMessage.error(error?.message || t('Msg.ImageCropFailed'));
        isProcessing.value = false;
    }
};

onBeforeUnmount(destroyCropper);
</script>

<style lang="scss">
.mci-image-crop-dialog {
    --mci-crop-primary: var(--el-color-primary, #4f46e5);
    --mci-crop-primary-soft: color-mix(in srgb, var(--mci-crop-primary) 12%, transparent);
    padding: 0;
    overflow: hidden;
    border-radius: 24px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 0 32px 90px rgba(15, 23, 42, 0.32);

    .el-dialog__header,
    .el-dialog__body,
    .el-dialog__footer { margin: 0; padding: 0; }

    .mci-crop-header {
        min-height: 76px;
        display: grid;
        grid-template-columns: minmax(220px, 1fr) minmax(180px, auto) 42px;
        align-items: center;
        gap: 20px;
        padding: 0 22px;
        color: #e2e8f0;
        background: linear-gradient(110deg, #101827 0%, #172033 60%, #111827 100%);
        border-bottom: 1px solid rgba(148, 163, 184, 0.16);
    }

    .mci-crop-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .mci-crop-brand__icon {
        width: 42px; height: 42px; display: grid; place-items: center;
        border-radius: 13px; font-size: 21px; color: #fff;
        background: linear-gradient(145deg, var(--mci-crop-primary), #7c3aed);
        box-shadow: 0 10px 26px color-mix(in srgb, var(--mci-crop-primary) 34%, transparent);
    }
    .mci-crop-brand span:last-child { min-width: 0; display: flex; flex-direction: column; }
    .mci-crop-brand small { color: #818cf8; font-size: 10px; letter-spacing: .18em; font-weight: 700; }
    .mci-crop-brand strong { margin-top: 3px; color: #fff; font-size: 18px; letter-spacing: .02em; }
    .mci-crop-file { min-width: 0; max-width: 320px; display: flex; flex-direction: column; text-align: right; }
    .mci-crop-file span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
    .mci-crop-file small { margin-top: 3px; color: #94a3b8; font-size: 11px; }
    .mci-crop-close { border-color: rgba(255,255,255,.14); color: #cbd5e1; background: rgba(255,255,255,.06); }
    .mci-crop-close:hover { color: #fff; background: rgba(255,255,255,.12); }

    .mci-crop-workspace { min-height: 560px; display: grid; grid-template-columns: minmax(0, 1fr) 320px; background: #f8fafc; }
    .mci-crop-stage {
        position: relative; min-width: 0; overflow: hidden; padding: 32px 34px 26px;
        display: flex; flex-direction: column; justify-content: center;
        background: radial-gradient(circle at 50% 42%, #263247 0%, #111827 52%, #0b1220 100%);
    }
    .mci-crop-stage__grid {
        position: absolute; inset: 0; opacity: .18; pointer-events: none;
        background-image: linear-gradient(rgba(148,163,184,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.12) 1px, transparent 1px);
        background-size: 28px 28px;
        mask-image: radial-gradient(circle at center, #000 30%, transparent 78%);
    }
    .mci-crop-canvas-shell {
        position: relative; z-index: 1; width: 100%; height: 460px; min-height: 320px;
        overflow: hidden; border-radius: 16px; background: rgba(2, 6, 23, .72);
        box-shadow: inset 0 0 0 1px rgba(148,163,184,.12), 0 22px 55px rgba(0,0,0,.28);
    }
    .mci-crop-source { display: block; max-width: 100%; }
    .mci-crop-stage__footer {
        position: relative; z-index: 1; margin-top: 16px; display: flex; justify-content: space-between;
        gap: 16px; color: #94a3b8; font-size: 11px; letter-spacing: .02em;
    }
    .mci-crop-stage__footer span:first-child { display: flex; align-items: center; gap: 7px; }
    .mci-crop-stage__footer i { width: 7px; height: 7px; border-radius: 50%; background: #34d399; box-shadow: 0 0 0 4px rgba(52,211,153,.12); }

    .cropper-view-box { outline: 2px solid var(--mci-crop-primary); outline-color: color-mix(in srgb, var(--mci-crop-primary) 88%, #fff); }
    .cropper-line { background-color: var(--mci-crop-primary); }
    .cropper-point { width: 9px; height: 9px; border-radius: 50%; background-color: #fff; box-shadow: 0 0 0 3px var(--mci-crop-primary); opacity: 1; }
    .cropper-dashed { border-color: rgba(255,255,255,.54); }
    .cropper-modal { background-color: #020617; opacity: .72; }

    .mci-crop-panel { padding: 28px 24px; overflow-y: auto; background: #fff; border-left: 1px solid #e2e8f0; }
    .mci-crop-panel__intro { display: flex; gap: 12px; }
    .mci-crop-panel__intro--compact { margin-bottom: 18px; }
    .mci-crop-step { flex: 0 0 auto; color: var(--mci-crop-primary); font-size: 11px; font-weight: 800; letter-spacing: .08em; }
    .mci-crop-panel__intro strong { color: #0f172a; font-size: 14px; }
    .mci-crop-panel__intro p { margin: 5px 0 0; color: #64748b; font-size: 11px; line-height: 1.55; }
    .mci-ratio-grid { margin-top: 18px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
    .mci-ratio-chip {
        height: 58px; border: 1px solid #e2e8f0; border-radius: 11px; background: #fff;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
        color: #64748b; font: inherit; font-size: 11px; cursor: pointer; transition: .18s ease;
    }
    .mci-ratio-chip:hover { border-color: color-mix(in srgb, var(--mci-crop-primary) 45%, #e2e8f0); color: var(--mci-crop-primary); transform: translateY(-1px); }
    .mci-ratio-chip.is-active { border-color: var(--mci-crop-primary); color: var(--mci-crop-primary); background: var(--mci-crop-primary-soft); box-shadow: 0 0 0 3px color-mix(in srgb, var(--mci-crop-primary) 8%, transparent); }
    .mci-ratio-shape { display: block; width: 17px; height: 13px; border: 1.5px solid currentColor; border-radius: 2px; }
    .mci-ratio-shape--1-1 { width: 14px; height: 14px; }
    .mci-ratio-shape--16-9, .mci-ratio-shape--3-2, .mci-ratio-shape--4-3 { width: 19px; height: 12px; }
    .mci-ratio-shape--9-16, .mci-ratio-shape--2-3, .mci-ratio-shape--3-4 { width: 10px; height: 17px; }
    .mci-ratio-shape--free { border-style: dashed; transform: rotate(-6deg); }
    .mci-ratio-shape--custom { width: 17px; height: 13px; border-style: dotted; }
    .mci-ratio-lock { margin-top: 18px; padding: 14px; display: flex; align-items: center; gap: 12px; border-radius: 12px; color: var(--mci-crop-primary); background: var(--mci-crop-primary-soft); }
    .mci-ratio-lock > .el-icon { font-size: 24px; }
    .mci-ratio-lock span { display: flex; flex-direction: column; }
    .mci-ratio-lock small { color: #64748b; font-size: 10px; }
    .mci-ratio-lock strong { margin-top: 2px; color: #0f172a; font-size: 15px; }
    .mci-custom-ratio { margin-top: 10px; display: flex; justify-content: center; align-items: center; gap: 10px; color: #334155; }
    .mci-custom-ratio span { min-width: 58px; padding: 7px 10px; text-align: center; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; font-size: 12px; }
    .mci-custom-ratio i { color: #94a3b8; font-style: normal; }
    .mci-crop-divider { height: 1px; margin: 24px 0; background: #eef2f7; }
    .mci-crop-control__label { display: flex; align-items: center; justify-content: space-between; color: #475569; font-size: 12px; }
    .mci-crop-control__label span { display: inline-flex; align-items: center; gap: 6px; }
    .mci-crop-control__label strong { color: #0f172a; font-size: 11px; }
    .mci-crop-control .el-slider { margin-top: 8px; }
    .mci-crop-tools { margin-top: 16px; display: grid; grid-template-columns: repeat(5, 1fr); gap: 7px; }
    .mci-crop-tools button {
        height: 38px; border: 1px solid #e2e8f0; border-radius: 10px; color: #475569;
        background: #fff; font-size: 17px; cursor: pointer; transition: .18s ease;
    }
    .mci-crop-tools button:hover { color: var(--mci-crop-primary); border-color: var(--mci-crop-primary); background: var(--mci-crop-primary-soft); }
    .mci-flip-horizontal { transform: rotate(0); }
    .mci-flip-vertical { transform: rotate(90deg); }
    .mci-crop-assurance { margin-top: 25px; padding: 13px; display: flex; align-items: center; gap: 10px; border: 1px solid #dcfce7; border-radius: 12px; color: #15803d; background: #f0fdf4; }
    .mci-crop-assurance > .el-icon { font-size: 22px; }
    .mci-crop-assurance span { display: flex; flex-direction: column; }
    .mci-crop-assurance strong { font-size: 11px; }
    .mci-crop-assurance small { margin-top: 2px; color: #4b7d5b; font-size: 10px; line-height: 1.4; }

    .mci-crop-footer { min-height: 72px; padding: 0 22px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; background: #fff; }
    .mci-crop-footer__hint { display: flex; align-items: center; gap: 8px; color: #94a3b8; font-size: 11px; }
    .mci-shortcut { padding: 3px 6px; border: 1px solid #cbd5e1; border-bottom-width: 2px; border-radius: 5px; color: #64748b; background: #f8fafc; font-size: 9px; font-weight: 700; }
    .mci-crop-footer__actions { display: flex; gap: 8px; }
    .mci-crop-footer__actions .el-button { min-width: 96px; height: 42px; border-radius: 11px; }
    .mci-crop-footer__actions .mci-crop-bypass {
        min-width: 156px;
        border-color: #cbd5e1;
        color: #334155;
        background: #fff;
        box-shadow: 0 7px 18px rgba(15, 23, 42, .07);
    }
    .mci-crop-footer__actions .mci-crop-bypass:hover,
    .mci-crop-footer__actions .mci-crop-bypass:focus-visible {
        border-color: color-mix(in srgb, var(--mci-crop-primary) 55%, #cbd5e1);
        color: var(--mci-crop-primary);
        background: color-mix(in srgb, var(--mci-crop-primary) 4%, #fff);
    }
    .mci-crop-footer__actions .el-button--primary { box-shadow: 0 9px 20px color-mix(in srgb, var(--mci-crop-primary) 22%, transparent); }
}

@media (max-width: 860px) {
    .mci-image-crop-dialog {
        width: calc(100vw - 20px) !important;
        max-height: calc(100vh - 20px);
        .mci-crop-header { grid-template-columns: 1fr 40px; padding: 0 16px; }
        .mci-crop-file { display: none; }
        .mci-crop-workspace { grid-template-columns: 1fr; max-height: calc(100vh - 168px); overflow-y: auto; }
        .mci-crop-stage { min-height: 430px; padding: 18px; }
        .mci-crop-canvas-shell { height: 360px; }
        .mci-crop-panel { border-left: 0; border-top: 1px solid #e2e8f0; }
        .mci-crop-footer__hint { display: none; }
        .mci-crop-footer { justify-content: flex-end; padding: 0 14px; }
        .mci-crop-footer__actions { width: 100%; }
        .mci-crop-footer__actions .el-button { flex: 1 1 auto; min-width: 0; padding: 0 12px; }
        .mci-crop-footer__actions .mci-crop-bypass { min-width: 0; }
    }
}

@media (prefers-reduced-motion: reduce) {
    .mci-image-crop-dialog * { transition: none !important; animation: none !important; }
}
</style>
