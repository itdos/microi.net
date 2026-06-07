<template>
  <section class="mci-card mci-theme-panel" :class="{ 'mci-theme-panel--compact': compact }">
    <header v-if="title" class="mci-theme-panel__header">
      <strong>{{ title }}</strong>
      <span>{{ state.theme === 'dark' ? '暗色' : '亮色' }} / {{ paletteLabel }}</span>
    </header>

    <div class="mci-theme-panel__group" role="group" aria-label="明暗模式">
      <button
        v-for="item in themes"
        :key="item.value"
        type="button"
        class="mci-theme-panel__seg"
        :class="{ 'is-active': state.theme === item.value }"
        @click="apply('theme', item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div class="mci-theme-panel__swatches" role="group" aria-label="主色">
      <button
        v-for="palette in palettes"
        :key="palette"
        type="button"
        class="mci-theme-panel__swatch"
        :class="{ 'is-active': state.palette === palette, 'is-white': palette === 'white' }"
        :style="{ '--mci-swatch': paletteColors[palette] }"
        :aria-label="`切换为${paletteLabels[palette]}色主题`"
        :title="`${paletteLabels[palette]}色`"
        @click="apply('palette', palette)"
      />
    </div>

    <div class="mci-theme-panel__group" role="group" aria-label="形态模式">
      <button
        v-for="item in shapes"
        :key="item.value"
        type="button"
        class="mci-theme-panel__seg"
        :class="{ 'is-active': state.shape === item.value }"
        @click="apply('shape', item.value)"
      >
        {{ item.label }}
      </button>
    </div>

    <div v-if="showMotion" class="mci-theme-panel__group" role="group" aria-label="动效偏好">
      <button
        v-for="item in motions"
        :key="item.value"
        type="button"
        class="mci-theme-panel__seg"
        :class="{ 'is-active': state.motion === item.value }"
        @click="apply('motion', item.value)"
      >
        {{ item.label }}
      </button>
    </div>
  </section>
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
.mci-theme-panel {
  display: grid;
  gap: var(--mci-space-4);
  padding: var(--mci-space-4);
}

.mci-theme-panel--compact {
  gap: var(--mci-space-3);
  padding: var(--mci-space-3);
}

.mci-theme-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3);
  color: var(--mci-text-primary);
}

.mci-theme-panel__header span {
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
}

.mci-theme-panel__group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--mci-space-2);
}

.mci-theme-panel__seg {
  min-height: 38px;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-surface);
  color: var(--mci-text-secondary);
  cursor: pointer;
  font: inherit;
  font-weight: 750;
}

.mci-theme-panel__seg.is-active {
  border-color: var(--mci-color-primary);
  background: var(--mci-gradient-primary);
  color: var(--mci-text-on-primary);
  box-shadow: var(--mci-shadow-button);
}

.mci-theme-panel__swatches {
  display: grid;
  grid-template-columns: repeat(9, minmax(0, 1fr));
  gap: var(--mci-space-2);
}

.mci-theme-panel__swatch {
  aspect-ratio: 1;
  min-height: 30px;
  border: 2px solid transparent;
  border-radius: var(--mci-shape-input);
  background: var(--mci-swatch);
  cursor: pointer;
  box-shadow: var(--mci-shadow-sm);
}

.mci-theme-panel__swatch.is-white {
  border-color: var(--mci-border-strong);
}

.mci-theme-panel__swatch.is-active {
  border-color: var(--mci-text-primary);
  outline: 3px solid var(--mci-border-glow);
}
</style>
