<template>
  <!-- 注入 NaiveUI 全局 message/dialog 到 window -->
  <div style="display: none;"></div>
</template>

<script setup>
import { useMessage, useDialog, useLoadingBar, useNotification } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()
const loadingBar = useLoadingBar()
const notification = useNotification()

// go-view 内部通过 window.$message 等调用全局 UI 组件
window['$message'] = message
window['$dialog'] = dialog
window['$loading'] = loadingBar
window['$notification'] = notification
</script>
