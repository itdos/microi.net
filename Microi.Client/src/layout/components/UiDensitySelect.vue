<template>
    <el-popover
        placement="bottom-end"
        :width="320"
        trigger="click"
        popper-class="mci-ui-density-popper"
    >
        <template #reference>
            <button
                type="button"
                class="ui-density-trigger"
                :title="`界面密度：${snapshot.name}（${snapshot.scale}%）`"
                aria-label="调整全局字体与间距"
            >
                <el-icon><Operation /></el-icon>
            </button>
        </template>

        <section class="ui-density-panel" aria-label="界面密度设置">
            <header>
                <div>
                    <strong>界面密度</strong>
                    <p>字体、控件高度与间距同步调整</p>
                </div>
                <span>{{ snapshot.scale }}%</span>
            </header>

            <el-slider
                v-model="selectedScale"
                :min="UI_DENSITY_MIN"
                :max="UI_DENSITY_MAX"
                :step="UI_DENSITY_STEP"
                :show-tooltip="false"
                :marks="marks"
                @input="changeScale"
            />

            <div class="ui-density-preview">
                <span class="preview-kicker">{{ snapshot.name }}</span>
                <strong>平台界面预览</strong>
                <p>清晰易读，布局保持协调。</p>
            </div>

            <div class="ui-density-actions">
                <button
                    v-for="preset in presets"
                    :key="preset.value"
                    type="button"
                    :class="{ active: selectedScale === preset.value }"
                    @click="changeScale(preset.value)"
                >
                    {{ preset.label }}
                </button>
            </div>
        </section>
    </el-popover>
</template>

<script setup>
import { onBeforeUnmount, ref } from "vue";
import {
    UI_DENSITY_MAX,
    UI_DENSITY_MIN,
    UI_DENSITY_STEP,
    getUiDensitySnapshot,
    setUiDensityScale,
    subscribeUiDensity,
} from "@/utils/ui-density.js";

const snapshot = ref(getUiDensitySnapshot());
const selectedScale = ref(snapshot.value.scale);
const presets = [
    { value: 90, label: "紧凑" },
    { value: 100, label: "标准" },
    { value: 110, label: "大字" },
];
const marks = { 90: "小", 100: "标准", 110: "大" };

const unsubscribe = subscribeUiDensity((next) => {
    snapshot.value = next;
    selectedScale.value = next.scale;
});

function changeScale(value) {
    snapshot.value = setUiDensityScale(value);
    selectedScale.value = snapshot.value.scale;
}

onBeforeUnmount(unsubscribe);
</script>

<style scoped lang="scss">
.ui-density-trigger {
    // width: 100%;
    height: 100%;
    // min-width: 38px;
    padding: 0 10px;
    border: 0;
    color: var(--el-text-color-regular);
    background: transparent;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    .el-icon { font-size: 18px; }
}

.ui-density-panel {
    padding: 4px 2px 2px;

    header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 14px;
    }

    header strong { color: var(--el-text-color-primary); font-size: 15px; }
    header p { margin: 3px 0 0; color: var(--el-text-color-secondary); font-size: 12px; }
    header > span {
        flex: none;
        padding: 4px 9px;
        border-radius: 999px;
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        font-weight: 600;
    }
}

.ui-density-panel :deep(.el-slider) { margin: 4px 8px 26px; width: calc(100% - 16px); }
.ui-density-panel :deep(.el-slider__marks-text) { white-space: nowrap; font-size: 11px; }

.ui-density-preview {
    padding: var(--mci-space-3, 12px) var(--mci-space-4, 16px);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 10px;
    background: linear-gradient(135deg, var(--el-fill-color-light), var(--el-bg-color));

    .preview-kicker { color: var(--el-color-primary); font-size: var(--el-font-size-extra-small); }
    strong { display: block; margin-top: var(--mci-space-1, 4px); color: var(--el-text-color-primary); font-size: var(--el-font-size-base); }
    p { margin: var(--mci-space-1, 4px) 0 0; color: var(--el-text-color-secondary); font-size: var(--el-font-size-small); }
}

.ui-density-actions {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 12px;

    button {
        min-height: 32px;
        border: 1px solid var(--el-border-color);
        border-radius: 8px;
        color: var(--el-text-color-regular);
        background: var(--el-bg-color);
        cursor: pointer;
    }

    button.active {
        border-color: var(--el-color-primary);
        color: var(--el-color-primary);
        background: var(--el-color-primary-light-9);
        font-weight: 600;
    }
}
</style>
