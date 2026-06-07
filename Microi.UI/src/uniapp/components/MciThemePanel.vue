<template>
  <view class="mci-card mci-uni-theme-panel" :class="{ 'mci-uni-theme-panel--compact': compact }">
    <view v-if="title" class="mci-uni-theme-panel__header">
      <text class="mci-uni-theme-panel__title">{{ title }}</text>
      <text class="mci-uni-theme-panel__summary">{{ state.theme === 'dark' ? '暗色' : '亮色' }} / {{ paletteLabel }}</text>
    </view>

    <view class="mci-uni-theme-panel__group">
      <view
        v-for="item in themes"
        :key="item.value"
        class="mci-uni-theme-panel__seg"
        :class="{ 'is-active': state.theme === item.value }"
        @tap="apply('theme', item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view class="mci-uni-theme-panel__swatches">
      <view
        v-for="palette in palettes"
        :key="palette"
        class="mci-uni-theme-panel__swatch"
        :class="{ 'is-active': state.palette === palette, 'is-white': palette === 'white' }"
        :style="{ background: paletteColors[palette] }"
        @tap="apply('palette', palette)"
      >
        <text class="mci-uni-theme-panel__swatch-label">{{ paletteLabels[palette] }}</text>
      </view>
    </view>

    <view class="mci-uni-theme-panel__group">
      <view
        v-for="item in shapes"
        :key="item.value"
        class="mci-uni-theme-panel__seg"
        :class="{ 'is-active': state.shape === item.value }"
        @tap="apply('shape', item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view v-if="showMotion" class="mci-uni-theme-panel__group">
      <view
        v-for="item in motions"
        :key="item.value"
        class="mci-uni-theme-panel__seg"
        :class="{ 'is-active': state.motion === item.value }"
        @tap="apply('motion', item.value)"
      >
        <text>{{ item.label }}</text>
      </view>
    </view>
  </view>
</template>

<script setup>
import { computed, ref } from 'vue';
import {
  MCI_PALETTE_LABELS,
  MCI_PALETTES,
  getMciDesign,
  setMciMotion,
  setMciPalette,
  setMciShape,
  setMciTheme
} from '../../theme/runtime.js';

defineOptions({ name: 'MciThemePanel' });
const emit = defineEmits(['change']);
defineProps({
  title: { type: String, default: '主题设置' },
  compact: { type: Boolean, default: false },
  showMotion: { type: Boolean, default: true }
});

const state = ref(getMciDesign());
const palettes = MCI_PALETTES;
const paletteLabels = MCI_PALETTE_LABELS;
const paletteColors = {
  black: '#111827',
  white: '#FFFFFF',
  red: '#B51220',
  orange: '#EA580C',
  yellow: '#D9A23A',
  green: '#16A34A',
  cyan: '#0891B2',
  blue: '#2563EB',
  purple: '#7C3AED'
};
const themes = [{ value: 'light', label: '亮色' }, { value: 'dark', label: '暗色' }];
const shapes = [{ value: 'rounded', label: '圆角' }, { value: 'flat', label: '扁平' }];
const motions = [{ value: 'full', label: '完整动效' }, { value: 'reduced', label: '减弱动效' }];
const paletteLabel = computed(() => paletteLabels[state.value.palette] || state.value.palette);

function apply(key, value) {
  const setters = {
    theme: setMciTheme,
    palette: setMciPalette,
    shape: setMciShape,
    motion: setMciMotion
  };
  const next = setters[key](value);
  state.value = { ...state.value, [key]: next };
  emit('change', { ...state.value });
}
</script>

<style scoped>
.mci-uni-theme-panel {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 28rpx;
}

.mci-uni-theme-panel--compact {
  gap: 18rpx;
  padding: 22rpx;
}

.mci-uni-theme-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.mci-uni-theme-panel__title {
  color: var(--mci-text-primary);
  font-size: 30rpx;
  font-weight: 850;
}

.mci-uni-theme-panel__summary {
  color: var(--mci-text-tertiary);
  font-size: 24rpx;
}

.mci-uni-theme-panel__group {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.mci-uni-theme-panel__seg {
  width: calc((100% - 16rpx) / 2);
  min-height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-surface);
  color: var(--mci-text-secondary);
  font-size: 26rpx;
  font-weight: 750;
}

.mci-uni-theme-panel__seg.is-active {
  border-color: var(--mci-color-primary);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-uni-theme-panel__swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.mci-uni-theme-panel__swatch {
  width: calc((100% - 32rpx) / 3);
  min-height: 78rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3rpx solid transparent;
  border-radius: var(--mci-shape-input);
  box-shadow: var(--mci-shadow-sm);
}

.mci-uni-theme-panel__swatch.is-white {
  border-color: var(--mci-border-strong);
}

.mci-uni-theme-panel__swatch.is-active {
  border-color: var(--mci-text-primary);
}

.mci-uni-theme-panel__swatch-label {
  color: rgba(255,255,255,.92);
  font-size: 24rpx;
  font-weight: 850;
}

.mci-uni-theme-panel__swatch.is-white .mci-uni-theme-panel__swatch-label,
.mci-uni-theme-panel__swatch:nth-child(5) .mci-uni-theme-panel__swatch-label {
  color: #111827;
}
</style>
