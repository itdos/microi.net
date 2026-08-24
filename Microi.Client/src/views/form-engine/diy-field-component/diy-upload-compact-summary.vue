<template>
    <div
        class="mci-upload-summary"
        :data-testid="kind === 'image' ? 'image-upload-config-summary' : 'file-upload-config-summary'"
        :aria-label="t('Msg.UploadSummaryAria', { type: title })"
    >
        <div class="mci-upload-summary__identity">
            <span class="mci-upload-summary__icon" aria-hidden="true">
                <el-icon><component :is="kind === 'image' ? PictureFilled : FolderOpened" /></el-icon>
            </span>
            <span class="mci-upload-summary__copy">
                <strong>{{ title }}</strong>
                <small :title="description">{{ description }}</small>
            </span>
        </div>

        <div class="mci-upload-summary__meta">
            <span class="mci-upload-summary__pill mci-upload-summary__pill--storage">
                {{ privateStorageEnabled ? t('Msg.UploadSummaryPrivate') : t('Msg.UploadSummaryPublic') }}
            </span>
            <span class="mci-upload-summary__pill">{{ amountLabel }}</span>
            <span class="mci-upload-summary__pill">{{ processingLabel }}</span>
            <span class="mci-upload-summary__pill">{{ t('Msg.UploadSummaryMaxSize', { size: normalizedMaxSize }) }}</span>
            <span
                v-if="showCropToggle"
                class="mci-upload-summary__crop"
                data-testid="image-crop-runtime-toggle"
                @click.stop
                @mousedown.stop
                @keydown.stop
            >
                <span>{{ t('Msg.UploadSummaryCrop') }}</span>
                <el-switch
                    :model-value="cropEnabled"
                    :aria-label="t('Msg.UploadSummaryCrop')"
                    @update:model-value="$emit('update:cropEnabled', $event)"
                    @click.stop
                />
            </span>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOpened, PictureFilled } from '@element-plus/icons-vue';

const props = defineProps({
    kind: {
        type: String,
        default: 'file',
        validator: value => ['image', 'file'].includes(value)
    },
    privateStorage: {
        type: [Boolean, Number, String],
        default: false
    },
    multiple: {
        type: Boolean,
        default: false
    },
    maxCount: {
        type: [Number, String],
        default: 1
    },
    compressed: {
        type: Boolean,
        default: false
    },
    maxSize: {
        type: [Number, String],
        default: 10
    },
    tips: {
        type: String,
        default: ''
    },
    showCropToggle: {
        type: Boolean,
        default: false
    },
    cropEnabled: {
        type: Boolean,
        default: false
    }
});

defineEmits(['update:cropEnabled']);

const { t } = useI18n();
const privateStorageEnabled = computed(() => (
    props.privateStorage === true
    || props.privateStorage === 1
    || String(props.privateStorage).toLowerCase() === 'true'
    || String(props.privateStorage) === '1'
));
const title = computed(() => props.kind === 'image' ? t('Msg.UploadSummaryImageTitle') : t('Msg.UploadSummaryFileTitle'));
const description = computed(() => String(props.tips || '').trim()
    || (props.kind === 'image' ? t('Msg.UploadSummaryImageHint') : t('Msg.UploadSummaryFileHint')));
const normalizedMaxCount = computed(() => Math.max(1, Number(props.maxCount) || 1));
const normalizedMaxSize = computed(() => Math.max(1, Number(props.maxSize) || 1));
const amountLabel = computed(() => {
    if (!props.multiple) {
        return props.kind === 'image' ? t('Msg.UploadSummarySingleImage') : t('Msg.UploadSummarySingleFile');
    }
    return props.kind === 'image'
        ? t('Msg.UploadSummaryMultipleImages', { count: normalizedMaxCount.value })
        : t('Msg.UploadSummaryMultipleFiles', { count: normalizedMaxCount.value });
});
const processingLabel = computed(() => {
    if (props.kind !== 'image') return t('Msg.UploadSummaryOriginalFile');
    return props.compressed ? t('Msg.UploadSummaryCompressed') : t('Msg.UploadSummaryOriginalImage');
});
</script>

<style lang="scss">
.mci-compact-upload {
    width: 100%;

    > .el-upload,
    .el-upload-dragger {
        width: 100%;
    }

    .el-upload-dragger {
        height: auto !important;
        min-height: 58px;
        padding: 0;
        overflow: hidden;
        border-radius: 14px;
        border-color: color-mix(in srgb, var(--el-color-primary) 20%, var(--el-border-color));
        background: linear-gradient(115deg,
            color-mix(in srgb, var(--el-color-primary) 5%, var(--el-bg-color)) 0%,
            var(--el-bg-color) 72%);
        transition: border-color .18s ease, background-color .18s ease, box-shadow .18s ease;
    }

    .el-upload-dragger:hover,
    .el-upload-dragger.is-dragover {
        border-color: var(--el-color-primary);
        background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
        box-shadow: 0 7px 20px color-mix(in srgb, var(--el-color-primary) 10%, transparent);
    }
}

.mci-upload-summary {
    width: 100%;
    min-height: 58px;
    padding: 9px 11px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-sizing: border-box;
    color: var(--el-text-color-primary);
    text-align: left;
}

.mci-upload-summary__identity {
    min-width: 180px;
    flex: 1 1 260px;
    display: flex;
    align-items: center;
    gap: 9px;
}

.mci-upload-summary__icon {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    border-radius: 11px;
    color: var(--el-color-primary);
    font-size: 17px;
    background: color-mix(in srgb, var(--el-color-primary) 11%, var(--el-bg-color));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--el-color-primary) 12%, transparent);
}

.mci-upload-summary__copy {
    min-width: 0;
    display: flex;
    flex-direction: column;

    strong {
        font-size: 13px;
        font-weight: 700;
        line-height: 1.35;
    }

    small {
        max-width: 420px;
        margin-top: 2px;
        overflow: hidden;
        color: var(--el-text-color-secondary);
        font-size: 11px;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
}

.mci-upload-summary__meta {
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 5px;
}

.mci-upload-summary__pill,
.mci-upload-summary__crop {
    min-height: 24px;
    padding: 0 8px;
    display: inline-flex;
    align-items: center;
    box-sizing: border-box;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 999px;
    color: var(--el-text-color-regular);
    font-size: 11px;
    line-height: 1;
    white-space: nowrap;
    background: color-mix(in srgb, var(--el-fill-color-light) 84%, var(--el-bg-color));
}

.mci-upload-summary__pill--storage {
    color: var(--el-color-primary);
    border-color: color-mix(in srgb, var(--el-color-primary) 17%, var(--el-border-color-lighter));
    background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
}

.mci-upload-summary__crop {
    gap: 6px;
    padding-right: 5px;
    color: var(--el-text-color-primary);
    cursor: default;

    .el-switch {
        --el-switch-on-color: var(--el-color-primary);
        height: 20px;
        transform: scale(.82);
        transform-origin: center;
    }
}

@media (max-width: 760px) {
    .mci-upload-summary {
        align-items: flex-start;
        flex-direction: column;
        gap: 7px;
    }

    .mci-upload-summary__identity {
        width: 100%;
        min-width: 0;
        flex-basis: auto;
    }

    .mci-upload-summary__copy small {
        max-width: calc(100vw - 112px);
    }

    .mci-upload-summary__meta {
        width: 100%;
        justify-content: flex-start;
    }
}

@media (prefers-reduced-motion: reduce) {
    .mci-compact-upload .el-upload-dragger {
        transition: none;
    }
}
</style>
