<template>
  <label class="mci-web-form-field" :class="{ 'is-error': error, 'is-disabled': disabled }">
    <span v-if="label" class="mci-web-form-field__label">
      {{ label }}<em v-if="required">*</em>
    </span>
    <slot>
      <textarea
        v-if="multiline"
        class="mci-web-form-field__control"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        @input="emitValue"
      />
      <input
        v-else
        class="mci-web-form-field__control"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="emitValue"
      />
    </slot>
    <span v-if="error || help" class="mci-web-form-field__hint">{{ error || help }}</span>
  </label>
</template>

<script setup>
defineOptions({ name: 'MciFormField' });

defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  help: { type: String, default: '' },
  error: { type: String, default: '' },
  type: { type: String, default: 'text' },
  rows: { type: Number, default: 4 },
  multiline: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function emitValue(event) {
  emit('update:modelValue', event.target.value);
}
</script>

<style scoped>
.mci-web-form-field {
  display: grid;
  gap: 8px;
  color: var(--mci-text-primary);
}

.mci-web-form-field__label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--mci-text-secondary);
  font-size: var(--mci-text-sm);
  font-weight: 800;
}

.mci-web-form-field__label em {
  color: var(--mci-color-danger);
  font-style: normal;
}

.mci-web-form-field__control {
  min-height: var(--mci-touch-target);
  width: 100%;
  padding: 0 14px;
  border: 1px solid var(--mci-border);
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-surface);
  color: var(--mci-text-primary);
  font: inherit;
  outline: none;
  box-shadow: 0 1px 0 rgba(255,255,255,.76) inset;
  transition: border-color var(--mci-duration-base) var(--mci-ease-out), box-shadow var(--mci-duration-base) var(--mci-ease-out), background var(--mci-duration-base) var(--mci-ease-out);
}

textarea.mci-web-form-field__control {
  min-height: 112px;
  padding-block: 12px;
  resize: vertical;
}

.mci-web-form-field__control:focus {
  border-color: var(--mci-color-primary);
  box-shadow: 0 0 0 4px var(--mci-border-glow);
}

.mci-web-form-field__hint {
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-xs);
  line-height: 1.5;
}

.mci-web-form-field.is-error .mci-web-form-field__control {
  border-color: var(--mci-color-danger);
}

.mci-web-form-field.is-error .mci-web-form-field__hint {
  color: var(--mci-color-danger);
}

.mci-web-form-field.is-disabled {
  opacity: .62;
}
</style>
