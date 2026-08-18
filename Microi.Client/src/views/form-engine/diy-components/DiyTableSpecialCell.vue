<script setup>
import { computed, ref, watch } from "vue";
import { DiyCommon } from "@/utils/diy.common";
import {
    formatFileSize,
    getFieldValue,
    getFileIcon,
    isPrivateUploadField,
    normalizePercentage,
    normalizeUploadItems,
    stripHtmlText,
    summarizeJsonValue
} from "@/views/form-engine/utils/table-special-field";

const props = defineProps({
    field: { type: Object, required: true },
    row: { type: Object, required: true },
    displayValue: { type: [String, Number, Boolean, Array, Object], default: "" },
    tableName: { type: String, default: "" },
    sysMenuId: { type: String, default: "" },
    compact: { type: Boolean, default: false }
});

const emit = defineEmits(["open-table-child", "open-detail"]);
const resolvedUrls = ref([]);
const failedImageUrls = ref(new Set());
const qrCodeUrl = ref("");
let resolveVersion = 0;
let qrVersion = 0;

const component = computed(() => props.field.Component || "");
const rawValue = computed(() => getFieldValue(props.row, props.field));
const uploadItems = computed(() => normalizeUploadItems(rawValue.value));
const privateUpload = computed(() => isPrivateUploadField(props.field));
const visibleImages = computed(() => uploadItems.value.slice(0, props.compact ? 2 : 3));
const visibleFiles = computed(() => uploadItems.value.slice(0, props.compact ? 1 : 2));
const previewUrls = computed(() => resolvedUrls.value.filter(Boolean));
const textPreview = computed(() => {
    const text = component.value === "RichText" || component.value === "Html"
        ? stripHtmlText(rawValue.value)
        : String(rawValue.value || "").trim();
    return text || "暂无内容";
});
const jsonSummary = computed(() => summarizeJsonValue(rawValue.value));
const colorValue = computed(() => String(rawValue.value || props.displayValue || "").trim());
const hasMapValue = computed(() => {
    if (component.value === "Map") {
        return !!(props.row[`${props.field.Name}_Lng`] || props.row[`${props.field.Name}_Lat`] || rawValue.value);
    }
    return !!rawValue.value;
});
const percentageValue = computed(() => normalizePercentage(rawValue.value));
const rateValue = computed(() => {
    const value = Number(rawValue.value);
    return Number.isFinite(value) ? Math.min(5, Math.max(0, value)) : 0;
});
const switchEnabled = computed(() => [true, 1, "1", "true", "True"].includes(rawValue.value));

function publicUrl(path) {
    return path ? DiyCommon.GetServerPath(path) : "";
}

async function resolveUploadUrls() {
    const version = ++resolveVersion;
    failedImageUrls.value = new Set();
    if (component.value !== "ImgUpload" && component.value !== "FileUpload") {
        resolvedUrls.value = [];
        return;
    }
    const urls = await Promise.all(uploadItems.value.map(async item => {
        if (!item.Path) return "";
        if (!privateUpload.value) return publicUrl(item.Path);
        return DiyCommon.GetPrivateFileUrl(item.Path, {
            FormEngineKey: props.tableName,
            FormDataId: props.row && props.row.Id,
            FieldId: props.field.Id || props.field.Name,
            SysMenuId: props.sysMenuId
        });
    }));
    if (version === resolveVersion) resolvedUrls.value = urls;
}

async function resolveQrCode() {
    const version = ++qrVersion;
    const value = String(rawValue.value || "").trim();
    if (!value || component.value !== "Qrcode") {
        qrCodeUrl.value = "";
        return;
    }
    try {
        const module = await import("qrcode");
        const QRCode = module.default || module;
        const result = await QRCode.toDataURL(value, { width: 220, margin: 1, errorCorrectionLevel: "M" });
        if (version === qrVersion) qrCodeUrl.value = result;
    } catch (error) {
        if (version === qrVersion) qrCodeUrl.value = "";
    }
}

function markImageFailed(url) {
    const next = new Set(failedImageUrls.value);
    next.add(url);
    failedImageUrls.value = next;
}

function openTableChild() {
    emit("open-table-child", { field: props.field, row: props.row });
}

function openDetail(mode) {
    emit("open-detail", { field: props.field, row: props.row, mode });
}

watch([rawValue, privateUpload, () => props.row && props.row.Id, () => props.sysMenuId], resolveUploadUrls, {
    immediate: true,
    deep: true
});
watch([rawValue, component], resolveQrCode, { immediate: true });
</script>

<template>
    <div class="diy-special-cell" :class="[`is-${component.toLowerCase()}`, { 'is-compact': compact }]" @click.stop>
        <template v-if="component === 'ImgUpload'">
            <div v-if="uploadItems.length" class="diy-special-images" :aria-label="`${uploadItems.length} 张图片`">
                <template v-for="(item, index) in visibleImages" :key="`${item.Path}-${index}`">
                    <span
                        v-if="!resolvedUrls[index]"
                        class="mci-media-skeleton diy-special-image"
                        role="status"
                        aria-label="图片加载中"
                    ></span>
                    <el-image
                        v-else-if="!failedImageUrls.has(resolvedUrls[index])"
                        class="diy-special-image"
                        :src="resolvedUrls[index]"
                        :preview-src-list="previewUrls"
                        :initial-index="index"
                        :preview-teleported="true"
                        :z-index="50000"
                        fit="cover"
                        lazy
                        :alt="item.Name || field.Label"
                        @error="markImageFailed(resolvedUrls[index])"
                    />
                </template>
                <span v-if="uploadItems.length > visibleImages.length" class="diy-special-more">+{{ uploadItems.length - visibleImages.length }}</span>
            </div>
            <span v-else class="diy-special-empty"><fa-icon icon="far fa-image" /> 暂无图片</span>
        </template>

        <template v-else-if="component === 'FileUpload'">
            <div v-if="uploadItems.length" class="diy-special-files">
                <template v-for="(item, index) in visibleFiles" :key="`${item.Path}-${index}`">
                    <span
                        v-if="!resolvedUrls[index]"
                        class="mci-inline-value-skeleton diy-special-file-loading"
                        role="status"
                        aria-label="文件链接加载中"
                    ></span>
                    <a
                        v-else
                        class="diy-special-file"
                        :href="resolvedUrls[index]"
                        target="_blank"
                        rel="noopener noreferrer"
                        :title="item.Name"
                        @click.stop
                    >
                        <fa-icon :icon="getFileIcon(item)" />
                        <span class="diy-special-file-name">{{ item.Name }}</span>
                        <span v-if="formatFileSize(item.Size)" class="diy-special-file-size">{{ formatFileSize(item.Size) }}</span>
                    </a>
                </template>
                <el-popover
                    v-if="uploadItems.length > visibleFiles.length"
                    placement="right"
                    :width="360"
                    trigger="click"
                    popper-class="diy-special-file-popover"
                >
                    <template #reference>
                        <button type="button" class="diy-special-file-more" @click.stop>
                            查看全部 {{ uploadItems.length }} 个文件
                        </button>
                    </template>
                    <div class="diy-special-file-list" :aria-label="`${uploadItems.length} 个文件`">
                        <template v-for="(item, index) in uploadItems" :key="`all-${item.Path}-${index}`">
                            <span
                                v-if="!resolvedUrls[index]"
                                class="mci-inline-value-skeleton diy-special-file-loading"
                                role="status"
                                aria-label="文件链接加载中"
                            ></span>
                            <a
                                v-else
                                class="diy-special-file"
                                :href="resolvedUrls[index]"
                                target="_blank"
                                rel="noopener noreferrer"
                                :title="item.Name"
                                @click.stop
                            >
                                <fa-icon :icon="getFileIcon(item)" />
                                <span class="diy-special-file-name">{{ item.Name }}</span>
                                <span v-if="formatFileSize(item.Size)" class="diy-special-file-size">{{ formatFileSize(item.Size) }}</span>
                            </a>
                        </template>
                    </div>
                </el-popover>
            </div>
            <span v-else class="diy-special-empty"><fa-icon icon="far fa-file" /> 暂无文件</span>
        </template>

        <button v-else-if="component === 'TableChild'" type="button" class="diy-special-action diy-special-action--table-child" @click.stop="openTableChild">
            <fa-icon icon="fas fa-table-list" />
            <span>查看子表</span>
            <fa-icon class="diy-special-action-arrow" icon="fas fa-chevron-right" />
        </button>

        <button v-else-if="component === 'Map' || component === 'MapArea'" type="button" class="diy-special-action" @click.stop="openDetail(hasMapValue ? 'View' : 'Edit')">
            <fa-icon :icon="component === 'MapArea' ? 'far fa-map' : 'fas fa-location-dot'" />
            <span>{{ hasMapValue ? (component === 'MapArea' ? '查看区域' : '查看位置') : (component === 'MapArea' ? '未绘制' : '未标注') }}</span>
        </button>

        <el-popover v-else-if="component === 'Qrcode'" placement="right" :width="190" trigger="hover" popper-class="diy-special-qrcode-popover">
            <template #reference>
                <button type="button" class="diy-special-action">
                    <fa-icon icon="fas fa-qrcode" />
                    <span class="diy-special-truncate">{{ rawValue || '暂无二维码' }}</span>
                </button>
            </template>
            <img v-if="qrCodeUrl" class="diy-special-qrcode" :src="qrCodeUrl" alt="二维码预览" />
            <span v-else class="diy-special-empty">暂无二维码</span>
        </el-popover>

        <span v-else-if="component === 'FontAwesome'" class="diy-special-font-icon" :title="String(rawValue || '')">
            <fa-icon :icon="rawValue || 'far fa-image'" />
            <span v-if="displayValue && displayValue !== rawValue" class="diy-special-truncate">{{ displayValue }}</span>
        </span>

        <span v-else-if="component === 'ColorPicker'" class="diy-special-color">
            <span class="diy-special-color-swatch" :style="{ backgroundColor: colorValue || 'transparent' }"></span>
            <span>{{ colorValue || '未设置' }}</span>
        </span>

        <el-rate
            v-else-if="component === 'Rate'"
            class="diy-special-rate"
            :model-value="rateValue"
            disabled
            allow-half
            :show-score="!compact"
        />

        <el-progress
            v-else-if="component === 'Progress' || component === 'Slider'"
            class="diy-special-progress"
            :percentage="percentageValue"
            :stroke-width="7"
            :show-text="!compact"
        />

        <el-tag v-else-if="component === 'Switch'" size="small" round :type="switchEnabled ? 'success' : 'info'">
            {{ switchEnabled ? '已开启' : '已关闭' }}
        </el-tag>

        <el-popover v-else-if="component === 'JsonTable'" placement="right" :width="360" trigger="click">
            <template #reference>
                <button type="button" class="diy-special-action">
                    <fa-icon icon="fas fa-table-cells" />
                    <span>{{ jsonSummary.label }}</span>
                </button>
            </template>
            <pre class="diy-special-json">{{ jsonSummary.pretty }}</pre>
        </el-popover>

        <span v-else-if="component === 'RichText' || component === 'CodeEditor' || component === 'Html'" class="diy-special-text" :title="textPreview">
            <fa-icon :icon="component === 'CodeEditor' || component === 'Html' ? 'fas fa-code' : 'far fa-file-lines'" />
            <span class="diy-special-truncate">{{ textPreview }}</span>
        </span>

        <span v-else-if="component === 'OpenTable' || component === 'JoinTable' || component === 'JoinForm'" class="diy-special-relation">
            <fa-icon :icon="component === 'JoinForm' ? 'far fa-window-restore' : 'fas fa-link'" />
            <span class="diy-special-truncate">{{ displayValue || rawValue || '暂无关联' }}</span>
        </span>

        <span v-else class="diy-special-truncate">{{ displayValue || rawValue }}</span>
    </div>
</template>

<style scoped lang="scss">
.diy-special-cell {
    min-width: 0;
    max-width: 100%;
    color: var(--el-text-color-regular);
    font-size: 13px;
}
.diy-special-images {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 34px;
}
.diy-special-image {
    width: 34px;
    height: 34px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
    cursor: zoom-in;
    flex: none;
}
.diy-special-more {
    min-width: 28px;
    height: 28px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-light);
    font-size: 12px;
}
.diy-special-files {
    display: flex;
    min-width: 0;
    flex-direction: column;
    align-items: flex-start;
    gap: 3px;
}
.diy-special-file {
    display: flex;
    align-items: center;
    gap: 6px;
    max-width: 100%;
    color: var(--el-color-primary);
    text-decoration: none;
    line-height: 20px;
}
.diy-special-file:hover .diy-special-file-name { text-decoration: underline; }
.diy-special-file-loading {
    width: min(128px, 100%);
    height: 18px;
    flex: none;
}
.diy-special-file-name,
.diy-special-truncate {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.diy-special-file-size { color: var(--el-text-color-secondary); font-size: 11px; flex: none; }
.diy-special-file-more {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--el-text-color-secondary);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
}
.diy-special-file-more:hover { color: var(--el-color-primary); text-decoration: underline; }
.diy-special-file-list {
    display: flex;
    max-height: 320px;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
}
.diy-special-action {
    max-width: 100%;
    min-height: 28px;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 4px 9px;
    border: 1px solid var(--el-border-color);
    border-radius: 6px;
    background: var(--el-fill-color-blank);
    color: var(--el-color-primary);
    cursor: pointer;
    font: inherit;
}
.diy-special-action:hover { background: var(--el-color-primary-light-9); border-color: var(--el-color-primary-light-5); }
.diy-special-action-arrow { color: var(--el-text-color-placeholder); font-size: 10px; }
.diy-special-action--table-child {
    min-height: 26px;
    gap: 6px;
    padding: 3px 8px;
    border-color: color-mix(in srgb, var(--el-color-primary) 18%, var(--el-border-color));
    border-radius: 999px;
    background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
    box-shadow: none;
    font-size: 12px;
    line-height: 18px;
    transition: color .15s ease, border-color .15s ease, background-color .15s ease, transform .15s ease;
}
.diy-special-action--table-child:hover,
.diy-special-action--table-child:focus-visible {
    outline: 0;
    border-color: color-mix(in srgb, var(--el-color-primary) 36%, var(--el-border-color));
    background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
    transform: translateY(-1px);
}
.diy-special-action--table-child .diy-special-action-arrow { margin-left: -1px; }
.diy-special-empty { display: inline-flex; align-items: center; gap: 6px; color: var(--el-text-color-placeholder); }
.diy-special-font-icon,
.diy-special-color,
.diy-special-text,
.diy-special-relation {
    min-width: 0;
    display: inline-flex;
    align-items: center;
    gap: 7px;
    max-width: 100%;
}
.diy-special-font-icon > :first-child { font-size: 19px; color: var(--el-color-primary); }
.diy-special-color-swatch { width: 18px; height: 18px; border-radius: 5px; border: 1px solid var(--el-border-color); box-shadow: inset 0 0 0 2px rgba(255,255,255,.55); }
.diy-special-text > :first-child,
.diy-special-relation > :first-child { color: var(--el-text-color-secondary); flex: none; }
.diy-special-qrcode { display: block; width: 170px; height: 170px; margin: 0 auto; }
.diy-special-json { max-height: 320px; margin: 0; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.55; }
.diy-special-rate { height: 24px; }
.diy-special-progress { width: min(180px, 100%); min-width: 88px; }
.is-compact .diy-special-image { width: 30px; height: 30px; }
</style>
