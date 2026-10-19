<template>
        <section class="ui-density-panel" :aria-label="$t('Msg.FrameworkAppearance.densitySettings')">
            <header>
                <div>
                    <strong>{{ $t('Msg.FrameworkAppearance.density') }}</strong>
                    <p>{{ $t('Msg.FrameworkAppearance.densityHint') }}</p>
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
                <span class="preview-kicker">{{ $t('Msg.FrameworkAppearance.' + densityNames[snapshot.scale]) }}</span>
                <strong>{{ $t('Msg.FrameworkAppearance.densityPreview') }}</strong>
                <p>{{ $t('Msg.FrameworkAppearance.densityPreviewHint') }}</p>
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
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import {
    UI_DENSITY_MAX,
    UI_DENSITY_MIN,
    UI_DENSITY_STEP,
    getUiDensitySnapshot,
    setUiDensityScale,
    subscribeUiDensity,
} from "@/utils/ui-density.js";

import { useI18n } from 'vue-i18n';
const { t } = useI18n();
const densityNames = {90:'compact',95:'nearCompact',100:'standard',105:'comfortable',110:'largeText'};
const snapshot = ref(getUiDensitySnapshot());
const emit = defineEmits(['change']);
const selectedScale = ref(snapshot.value.scale);
const presets = computed(() => [
    { value: 90, label: t('Msg.FrameworkAppearance.compact') },
    { value: 100, label: t('Msg.FrameworkAppearance.standard') },
    { value: 110, label: t('Msg.FrameworkAppearance.largeText') },
]);
const marks = computed(() => ({ 90: t('Msg.FrameworkAppearance.small'), 100: t('Msg.FrameworkAppearance.standard'), 110: t('Msg.FrameworkAppearance.large') }));

const unsubscribe = subscribeUiDensity((next) => {
    snapshot.value = next;
    selectedScale.value = next.scale;
});

function changeScale(value) {
    snapshot.value = setUiDensityScale(value);
    selectedScale.value = snapshot.value.scale;
    emit('change', snapshot.value.scale);
}

onBeforeUnmount(unsubscribe);
</script>

<style scoped lang="scss">
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
