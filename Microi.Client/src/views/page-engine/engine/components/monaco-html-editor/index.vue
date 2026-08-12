<template>
  <el-button style="margin-bottom: 20px" size="small" type="primary" @click="emitContent">
    {{ $t('Msg.PageEngine.confirm') }}
  </el-button>
  <MicroiCodeEditor v-model="content" language="html" height="600" />
  <el-button style="margin-top: 20px" size="small" type="primary" @click="emitContent">
    {{ $t('Msg.PageEngine.confirm') }}
  </el-button>
</template>

<script setup name="MonacoHtmlEditor">
import { ref } from 'vue'
import { html as beautifyHtml } from 'js-beautify'
import MicroiCodeEditor from '@/components/microi-code-editor.vue'

const props = defineProps({
  htmlStr: { type: String, required: true },
})
const emit = defineEmits(['editor-content'])

const rawHtml = props.htmlStr
  .replace(/^"|"$/g, '')
  .replace(/\\"/g, '"')
  .replace(/\\n/g, '\n')
const content = ref(beautifyHtml(rawHtml, {
  indent_size: 2,
  indent_char: ' ',
  wrap_attributes: 'auto',
  end_with_newline: true,
  preserve_newlines: true,
  max_preserve_newlines: 10,
}))

const emitContent = () => emit('editor-content', content.value)
</script>

