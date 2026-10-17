<template>
    <aside ref="root" class="mci-resizable-pane" :class="{ 'is-collapsed': collapsed, 'is-resizing': dragging }" :style="{ width: effectiveWidth + 'px' }">
        <div v-show="!collapsed || keepCollapsedContent" class="mci-resizable-pane__content"><slot /></div>
        <button type="button" class="mci-resizable-pane__toggle" :aria-label="$t(collapsed ? 'Msg.FrameworkAppearance.expandPanel' : 'Msg.FrameworkAppearance.collapsePanel', { label })" :aria-expanded="!collapsed" @click="$emit('update:collapsed', !collapsed)">
            <svg viewBox="0 0 24 24" aria-hidden="true" :style="{ transform: collapsed ? 'rotate(180deg)' : '' }"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <div v-if="!collapsed && !narrow" class="mci-resizable-pane__handle" role="separator" tabindex="0" aria-orientation="vertical" :aria-label="$t('Msg.FrameworkAppearance.panelWidth', { label })" :aria-valuenow="Math.round(effectiveWidth)" :aria-valuemin="minimum" :aria-valuemax="maximum" @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancel" @lostpointercapture="cancel" @keydown="keyboard" />
    </aside>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { clampPanelWidth, normalizePanelWidth } from '../../utils/panel-layout-preferences.js';
const props = defineProps({ width: { type: Number, default: 240 }, collapsed: Boolean, collapsedWidth: { type: Number, default: 32 }, keepCollapsedContent: Boolean, label: { type: String, default: '面板' }, mainMinWidth: { type: Number, default: 480 } });
const emit = defineEmits(['commit', 'update:collapsed', 'effective-width']);
const root = ref(null), available = ref(typeof window === 'undefined' ? 1200 : window.innerWidth), preview = ref(null), dragging = ref(false), narrow = ref(false);
const maximum = computed(() => Math.max(0, Math.min(600, available.value - props.mainMinWidth)));
const minimum = computed(() => Math.min(160, maximum.value));
const effectiveWidth = computed(() => props.collapsed ? props.collapsedWidth : clampPanelWidth(preview.value ?? props.width, available.value, props.mainMinWidth));
watch(effectiveWidth, value => emit('effective-width', value), { immediate: true });
watch(() => props.collapsed || narrow.value, value => { if (value) cancel(); });
let element, observer, pointer, startX = 0, startWidth = 0;
function measure() { const parent = root.value?.parentElement, gap = parseFloat(parent && window.getComputedStyle?.(parent)?.columnGap) || 0; available.value = Math.max(0, (parent?.clientWidth || window.innerWidth) - gap); narrow.value = window.innerWidth <= 768; }
function release() { if (pointer != null && element?.hasPointerCapture?.(pointer)) element.releasePointerCapture(pointer); pointer = null; dragging.value = false; }
function start(event) {
    if (event.button !== 0 || narrow.value) return;
    element = event.currentTarget; startX = event.clientX; startWidth = effectiveWidth.value; pointer = event.pointerId;
    element.setPointerCapture(pointer); dragging.value = true; event.preventDefault();
}
function move(event) { if (dragging.value && event.pointerId === pointer) preview.value = Math.max(minimum.value, Math.min(maximum.value, startWidth + event.clientX - startX)); }
function finish(event) { if (!dragging.value || event.pointerId !== pointer) return; const value = normalizePanelWidth(effectiveWidth.value); release(); preview.value = null; emit('commit', value); }
function cancel(event) { if (event && event.pointerId !== pointer) return; release(); preview.value = null; }
function keyboard(event) {
    const step = event.shiftKey ? 40 : 16;
    const value = event.key === 'ArrowLeft' ? effectiveWidth.value - step : event.key === 'ArrowRight' ? effectiveWidth.value + step : event.key === 'Home' ? minimum.value : event.key === 'End' ? maximum.value : null;
    if (value == null) return;
    event.preventDefault(); emit('commit', normalizePanelWidth(Math.max(minimum.value, Math.min(maximum.value, value))));
}
onMounted(() => {
    // 观察父容器可用宽度，角色树与固定侧栏共用约束；不依赖浏览器缩放整个画布。
    window.addEventListener('resize', measure); measure();
    if (typeof ResizeObserver !== 'undefined' && root.value?.parentElement) { observer = new ResizeObserver(measure); observer.observe(root.value.parentElement); }
});
onBeforeUnmount(() => { cancel(); observer?.disconnect(); window.removeEventListener('resize', measure); });
</script>

<style scoped>
.mci-resizable-pane { position:relative;flex:0 0 auto;min-width:0;box-sizing:border-box; }
.mci-resizable-pane__content { width:100%;height:100%;min-width:0;min-height:0; }
.mci-resizable-pane__handle { position:absolute;inset-block:0;right:-3px;width:7px;z-index:6;cursor:col-resize;touch-action:none; }
.mci-resizable-pane__handle:hover,.mci-resizable-pane__handle:focus-visible,.is-resizing .mci-resizable-pane__handle { background:color-mix(in srgb,var(--el-color-primary) 30%,transparent);outline:1px solid var(--mci-text-link,var(--el-color-primary)); }
.mci-resizable-pane__toggle { position:absolute;right:0;top:8px;z-index:7;width:22px;height:26px;padding:2px;border:1px solid var(--mci-border-color,var(--el-border-color));border-radius:var(--mci-radius-sm,6px);background:var(--el-bg-color-overlay);color:var(--el-text-color-primary);cursor:pointer; }
.mci-resizable-pane__toggle svg { width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8; }
.mci-resizable-pane__toggle:focus-visible { outline:2px solid var(--mci-text-link,var(--el-color-primary));outline-offset:2px; }
.is-resizing { user-select:none; }
@media(max-width:768px) { .mci-resizable-pane__toggle { min-width:32px;height:44px; } }
</style>
