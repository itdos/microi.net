<template>
  <MonacoHtmlEditor :html-str="htmlStr" @editor-content="forwardContent" />
</template>

<script setup name="PageEngineLegacyHtmlEditor">
import MonacoHtmlEditor from '../monaco-html-editor/index.vue'

defineProps({
  htmlStr: { type: String, required: true },
})

const emit = defineEmits(['editor-content'])
const forwardContent = (content) => emit('editor-content', content)
</script>
