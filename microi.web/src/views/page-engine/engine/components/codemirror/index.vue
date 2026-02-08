<template>
  <el-button
    style="margin-bottom: 20px"
    @click="getEditorContent"
    size="small"
    type="primary"
    >确认修改</el-button
  >
  <div class="editor-container" ref="editorContainer"></div>

  <el-button
    style="margin-top: 20px"
    @click="getEditorContent"
    size="small"
    type="primary"
    >确认修改</el-button
  >
</template>

<script setup name="codemirror">
import { defineProps, ref, defineEmits, onMounted } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { html } from '@codemirror/lang-html'
import { oneDark } from '@codemirror/theme-one-dark'

// 引入 js-beautify 用于美化 HTML
import { html as beautifyHtml } from 'js-beautify'

import { escapeHtml, unescapeHtml } from '../../utils/util'

const props = defineProps({
  htmlStr: {
    type: String, // 修改类型为String
    required: true,
  },
})
const emit = defineEmits(['editor-content'])
const editorContainer = ref(null)
let editorView = null

onMounted(() => {
  // 反转义 HTML 字符串
  let rawHtml = props.htmlStr
  // 去除字符串开头和结尾的双引号
  rawHtml = rawHtml.replace(/^"|"$/g, '')
  // 将 \" 替换为 "
  rawHtml = rawHtml.replace(/\\"/g, '"')
  // 手动将 \n 换行符替换为实际的换行符
  rawHtml = rawHtml.replace(/\\n/g, '\n')

  // 使用 js-beautify 美化 HTML
  const beautifiedHtml = beautifyHtml(rawHtml, {
    indent_size: 2, // 缩进大小
    indent_char: ' ', // 缩进字符
    wrap_attributes: 'auto', // 自动换行属性
    end_with_newline: true, // 结尾添加换行符
    preserve_newlines: true, // 保留原始换行符
    max_preserve_newlines: 10, // 最大保留换行符数量
  })

  editorView = new EditorView({
    doc: beautifiedHtml, // 直接使用 unescapeHtml 处理换行符
    extensions: [
      basicSetup, // 基本设置
      html(), // HTML 语言支持
      oneDark, // 深色主题
    ],
    parent: editorContainer.value,
  })
})

const getEditorContent = () => {
  if (editorView) {
    const content = editorView.state.doc.toString()
    emit('editor-content', content) // 直接传递内容，不需要再次反转义
  }
}
</script>

<style lang="scss" scoped>
.editor-container {
  min-height: 600px; // 设置最小高度
  height: 100%; // 设置高度为100%，根据父容器调整
}
</style>
