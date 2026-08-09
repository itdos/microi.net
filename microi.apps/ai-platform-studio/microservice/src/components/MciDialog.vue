<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-mask" role="presentation" @mousedown.self="$emit('cancel')">
      <section ref="dialogRef" class="dialog" role="dialog" aria-modal="true" :aria-labelledby="titleId" :style="positionStyle">
        <header @pointerdown="startDrag">
          <div><small>MICROI CONTROL</small><h2 :id="titleId">{{ title }}</h2></div>
          <button type="button" class="close" aria-label="关闭" @click="$emit('cancel')">×</button>
        </header>
        <div class="dialog__body"><slot /></div>
        <footer>
          <button type="button" class="mci-button" :disabled="busy" @click="$emit('cancel')">取消</button>
          <button type="button" class="mci-button" :class="danger ? 'mci-button--danger' : 'mci-button--primary'" :disabled="busy" @click="$emit('confirm')">
            {{ busy ? '正在执行…' : confirmText }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

const props = withDefaults(defineProps<{ open: boolean; title: string; confirmText?: string; busy?: boolean; danger?: boolean }>(), { confirmText: '确认', busy: false, danger: false })
defineEmits<{ cancel: []; confirm: [] }>()
const titleId = `mci-dialog-${Math.random().toString(16).slice(2)}`
const dialogRef = ref<HTMLElement | null>(null)
const offset = ref({ x: 0, y: 0 })
const positionStyle = computed(() => ({ transform: `translate(${offset.value.x}px, ${offset.value.y}px)` }))

function startDrag(event: PointerEvent) {
  if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return
  const startPointer = { x: event.clientX, y: event.clientY }
  const startOffset = { ...offset.value }
  const move = (next: PointerEvent) => {
    const rect = dialogRef.value?.getBoundingClientRect()
    const proposedX = startOffset.x + (next.clientX - startPointer.x)
    const proposedY = startOffset.y + (next.clientY - startPointer.y)
    const halfWidth = (rect?.width ?? 600) / 2
    const halfHeight = (rect?.height ?? 360) / 2
    offset.value = {
      x: Math.max(-window.innerWidth / 2 + halfWidth, Math.min(window.innerWidth / 2 - halfWidth, proposedX)),
      y: Math.max(-window.innerHeight / 2 + halfHeight, Math.min(window.innerHeight / 2 - halfHeight, proposedY))
    }
  }
  const stop = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop) }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', stop, { once: true })
}
</script>

<style scoped>
.dialog-mask { position: fixed; inset: 0; z-index: 2147483000; display: grid; place-items: center; padding: 18px; background: var(--mci-bg-mask); }
.dialog { width: min(620px, 100%); max-height: min(760px, calc(100vh - 36px)); overflow: auto; border: 1px solid var(--mci-border-strong); border-radius: var(--mci-radius-xl); background: var(--mci-bg-elevated); box-shadow: var(--mci-shadow-dialog); }
header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 17px 18px; border-bottom: 1px solid var(--mci-border-color); cursor: move; user-select: none; }
header small { color: var(--mci-color-primary); font-size: 10px; font-weight: 800; letter-spacing: .14em; }
header h2 { margin: 3px 0 0; font-size: 17px; }
.close { display: grid; width: 40px; min-height: 40px; place-items: center; border-color: transparent; background: transparent; font-size: 24px; line-height: 1; }
.dialog__body { padding: 18px; color: var(--mci-text-secondary); line-height: 1.65; }
footer { position: sticky; bottom: 0; display: flex; justify-content: flex-end; gap: 10px; padding: 14px 18px calc(14px + var(--mci-safe-bottom)); border-top: 1px solid var(--mci-border-color); background: var(--mci-bg-elevated); }
@media (max-width: 640px) { .dialog-mask { align-items: end; padding: 0; } .dialog { width: 100%; max-height: 88vh; border-radius: var(--mci-radius-xl) var(--mci-radius-xl) 0 0; transform: none !important; } }
</style>
