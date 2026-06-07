<template>
  <Teleport to="body">
    <div v-if="modelValue" class="mci-web-modal" role="dialog" aria-modal="true">
      <div class="mci-web-modal__mask" @click="handleMask" />
      <section class="mci-web-modal__panel" :class="`mci-web-modal__panel--${size}`">
        <header v-if="title || $slots.header" class="mci-web-modal__header">
          <slot name="header">
            <strong>{{ title }}</strong>
          </slot>
          <button type="button" aria-label="关闭" @click="close">×</button>
        </header>
        <main class="mci-web-modal__body">
          <slot />
        </main>
        <footer v-if="$slots.footer" class="mci-web-modal__footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup>
defineOptions({ name: 'MciModal' });

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  size: { type: String, default: 'md' },
  closeOnMask: { type: Boolean, default: true }
});

const emit = defineEmits(['update:modelValue', 'close']);

function close() {
  emit('update:modelValue', false);
  emit('close');
}

function handleMask() {
  if (props.closeOnMask) close();
}
</script>

<style scoped>
.mci-web-modal {
  position: fixed;
  inset: 0;
  z-index: var(--mci-z-modal);
  display: grid;
  place-items: center;
  padding: var(--mci-space-4);
}

.mci-web-modal__mask {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, .48);
  backdrop-filter: blur(12px) saturate(1.2);
}

.mci-web-modal__panel {
  position: relative;
  width: min(100%, 560px);
  overflow: hidden;
  border: 1px solid var(--mci-bg-glass-border);
  border-radius: var(--mci-shape-card);
  background: var(--mci-bg-surface);
  box-shadow: var(--mci-shadow-dialog);
  animation: mciModalIn var(--mci-duration-slow) var(--mci-ease-out) both;
}

.mci-web-modal__panel--sm { width: min(100%, 420px); }
.mci-web-modal__panel--lg { width: min(100%, 760px); }

.mci-web-modal__header,
.mci-web-modal__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3);
  padding: var(--mci-space-4) var(--mci-space-5);
  border-bottom: 1px solid var(--mci-border);
}

.mci-web-modal__header strong {
  color: var(--mci-text-primary);
  font-size: var(--mci-text-lg);
  font-weight: 900;
}

.mci-web-modal__header button {
  width: 34px;
  height: 34px;
  border: 0;
  border-radius: var(--mci-radius-full);
  background: var(--mci-bg-muted);
  color: var(--mci-text-secondary);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.mci-web-modal__body {
  padding: var(--mci-space-5);
}

.mci-web-modal__footer {
  justify-content: flex-end;
  border-top: 1px solid var(--mci-border);
  border-bottom: 0;
}

@keyframes mciModalIn {
  from { opacity: 0; transform: translateY(18px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
</style>
