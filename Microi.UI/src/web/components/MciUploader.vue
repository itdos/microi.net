<template>
  <div class="mci-web-uploader" :class="{ 'is-disabled': disabled }">
    <input
      ref="inputRef"
      class="mci-web-uploader__input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      :disabled="disabled"
      @change="handleChange"
    />
    <button type="button" class="mci-web-uploader__trigger" :disabled="disabled" @click="open">
      <span />
      <strong>{{ title }}</strong>
      <em>{{ description }}</em>
    </button>
    <div v-if="files.length" class="mci-web-uploader__list">
      <span v-for="file in files" :key="file.name">{{ file.name }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

defineOptions({ name: 'MciUploader' });

defineProps({
  title: { type: String, default: '上传文件' },
  description: { type: String, default: '点击选择或拖拽文件到此处' },
  accept: { type: String, default: '' },
  multiple: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});

const emit = defineEmits(['change']);
const inputRef = ref(null);
const files = ref([]);

function open() {
  inputRef.value?.click();
}

function handleChange(event) {
  files.value = Array.from(event.target.files || []);
  emit('change', files.value);
}
</script>

<style scoped>
.mci-web-uploader {
  display: grid;
  gap: var(--mci-space-3);
}

.mci-web-uploader__input {
  display: none;
}

.mci-web-uploader__trigger {
  min-height: 168px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: var(--mci-space-2);
  border: 1px dashed var(--mci-border-strong);
  border-radius: var(--mci-shape-card);
  background:
    linear-gradient(135deg, rgba(181,18,32,.08), transparent),
    var(--mci-bg-surface);
  color: var(--mci-text-secondary);
  cursor: pointer;
  font: inherit;
  transition: border-color var(--mci-duration-base) var(--mci-ease-out), transform var(--mci-duration-base) var(--mci-ease-out), box-shadow var(--mci-duration-base) var(--mci-ease-out);
}

.mci-web-uploader__trigger span {
  width: 52px;
  height: 52px;
  border-radius: var(--mci-radius-full);
  background: var(--mci-gradient-primary);
  box-shadow: var(--mci-shadow-button);
  position: relative;
}

.mci-web-uploader__trigger span::before,
.mci-web-uploader__trigger span::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 20px;
  height: 3px;
  border-radius: 999px;
  background: var(--mci-text-on-primary);
  transform: translate(-50%, -50%);
}

.mci-web-uploader__trigger span::after {
  transform: translate(-50%, -50%) rotate(90deg);
}

.mci-web-uploader__trigger strong {
  color: var(--mci-text-primary);
  font-weight: 900;
}

.mci-web-uploader__trigger em {
  color: var(--mci-text-tertiary);
  font-size: var(--mci-text-sm);
  font-style: normal;
}

@media (hover: hover) {
  .mci-web-uploader__trigger:hover {
    transform: translateY(var(--mci-hover-y));
    border-color: var(--mci-color-primary);
    box-shadow: var(--mci-shadow-card-hover);
  }
}

.mci-web-uploader__list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mci-space-2);
}

.mci-web-uploader__list span {
  padding: 6px 10px;
  border-radius: var(--mci-radius-pill);
  background: var(--mci-bg-soft);
  color: var(--mci-color-primary);
  font-size: var(--mci-text-xs);
  font-weight: 800;
}
</style>
