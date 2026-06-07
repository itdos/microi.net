<template>
  <view class="mci-uni-form-field" :class="{ 'is-error': error, 'is-disabled': disabled }">
    <text v-if="label" class="mci-uni-form-field__label">
      {{ label }}<text v-if="required">*</text>
    </text>
    <slot>
      <textarea
        v-if="multiline"
        class="mci-uni-form-field__control mci-uni-form-field__control--textarea"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        @input="emitValue"
      />
      <input
        v-else
        class="mci-uni-form-field__control"
        :value="modelValue"
        :type="type"
        :placeholder="placeholder"
        :disabled="disabled"
        :maxlength="maxlength"
        @input="emitValue"
      />
    </slot>
    <text v-if="error || help" class="mci-uni-form-field__hint">{{ error || help }}</text>
  </view>
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
  maxlength: { type: Number, default: -1 },
  multiline: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['update:modelValue']);

function emitValue(event) {
  emit('update:modelValue', event.detail.value);
}
</script>

<style scoped>
.mci-uni-form-field {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.mci-uni-form-field__label {
  color: var(--mci-text-secondary);
  font-size: 26rpx;
  font-weight: 800;
}

.mci-uni-form-field__label text {
  color: var(--mci-color-danger);
}

.mci-uni-form-field__control {
  min-height: 88rpx;
  width: 100%;
  padding: 0 24rpx;
  border: 1rpx solid var(--mci-border);
  border-radius: var(--mci-shape-input);
  background: var(--mci-bg-surface);
  color: var(--mci-text-primary);
  font-size: 28rpx;
  box-sizing: border-box;
}

.mci-uni-form-field__control--textarea {
  min-height: 220rpx;
  padding-top: 20rpx;
  line-height: 1.6;
}

.mci-uni-form-field__hint {
  color: var(--mci-text-tertiary);
  font-size: 22rpx;
  line-height: 1.5;
}

.mci-uni-form-field.is-error .mci-uni-form-field__control {
  border-color: var(--mci-color-danger);
}

.mci-uni-form-field.is-error .mci-uni-form-field__hint {
  color: var(--mci-color-danger);
}

.mci-uni-form-field.is-disabled {
  opacity: .62;
}
</style>
