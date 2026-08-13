<template>
  <div ref="container" class="microi-code-editor" :style="containerStyle"></div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { loadMonaco } from '@/utils/monaco-loader'

defineOptions({ name: 'MicroiCodeEditor' })

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  language: { type: String, default: '' },
  height: { type: [String, Number], default: 260 },
  options: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['update:modelValue', 'input', 'change'])

const container = ref(null)
const editor = ref(null)
let monaco
let applyingExternalValue = false

const normalizeHeight = (value) => typeof value === 'number' || /^\d+$/.test(String(value)) ? `${value}px` : String(value)
const containerStyle = computed(() => ({ height: normalizeHeight(props.height), width: '100%' }))
const normalizeLanguage = () => {
  if (props.language) return props.language
  const mode = String(props.options?.mode || '').toLowerCase()
  if (mode.includes('html') || mode.includes('xml')) return 'html'
  if (mode.includes('json')) return 'json'
  if (mode.includes('css')) return 'css'
  if (mode.includes('sql')) return 'sql'
  return 'javascript'
}

const emitValue = (value) => {
  emit('update:modelValue', value)
  emit('input', value)
  emit('change', value)
}

const legacyApi = {
  refresh: () => editor.value?.layout(),
  setSize: (width, height) => {
    if (container.value) {
      if (width && width !== 'auto') container.value.style.width = normalizeHeight(width)
      if (height && height !== 'auto') container.value.style.height = normalizeHeight(height)
    }
    nextTick(() => editor.value?.layout())
  },
  focus: () => editor.value?.focus(),
  replaceSelection: (text) => {
    const instance = editor.value
    const selection = instance?.getSelection()
    if (!instance || !selection) return
    instance.executeEdits('microi-code-editor', [{ range: selection, text: String(text ?? ''), forceMoveMarkers: true }])
    instance.focus()
  },
  setCursor: (line, ch = 0) => {
    editor.value?.setPosition({ lineNumber: Math.max(1, Number(line) || 1), column: Math.max(1, (Number(ch) || 0) + 1) })
  },
  execCommand: (command) => {
    if (command === 'goColumnLeft') editor.value?.trigger('microi-code-editor', 'cursorLeft', null)
  },
  getValue: () => editor.value?.getValue() || '',
  setValue: (value) => editor.value?.setValue(String(value ?? '')),
}

onMounted(async () => {
  monaco = await loadMonaco()
  if (!container.value) return
  editor.value = monaco.editor.create(container.value, {
    value: String(props.modelValue ?? ''),
    language: normalizeLanguage(),
    theme: props.options?.theme === 'default' || props.options?.theme === 'vs' ? 'vs' : 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    lineNumbers: props.options?.lineNumbers === false ? 'off' : 'on',
    wordWrap: props.options?.lineWrapping === false ? 'off' : 'on',
    tabSize: Number(props.options?.tabSize) || 2,
    scrollBeyondLastLine: false,
    ...props.options?.monaco,
  })
  editor.value.onDidChangeModelContent(() => {
    if (!applyingExternalValue) emitValue(editor.value.getValue())
  })
})

watch(() => props.modelValue, (value) => {
  const nextValue = String(value ?? '')
  if (!editor.value || editor.value.getValue() === nextValue) return
  applyingExternalValue = true
  editor.value.setValue(nextValue)
  applyingExternalValue = false
})

watch(() => props.language, () => {
  const model = editor.value?.getModel()
  if (model && monaco) monaco.editor.setModelLanguage(model, normalizeLanguage())
})

onBeforeUnmount(() => {
  editor.value?.dispose()
  editor.value = null
})

defineExpose({ editor, editorApi: legacyApi, refresh: legacyApi.refresh, getValue: legacyApi.getValue })
</script>

<style scoped>
.microi-code-editor {
  min-height: 120px;
  overflow: hidden;
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
}
</style>
