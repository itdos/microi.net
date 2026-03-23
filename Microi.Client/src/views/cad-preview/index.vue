<template>
  <div class="cad-preview-page">
    <div class="preview-header">
      <span class="file-name" :title="fileName">{{ fileName || '文件预览' }}</span>
    </div>
    <CadViewer v-if="fileUrl" :filePath="fileUrl" :fileName="fileName" class="preview-body" />
    <div v-else class="no-file">
      <el-icon :size="60" color="#c0c4cc"><Warning /></el-icon>
      <p>未指定预览文件</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Warning } from '@element-plus/icons-vue'
import CadViewer from '../file-manage/components/CadViewer.vue'

const route = useRoute()
const fileUrl = ref('')
const fileName = ref('')

onMounted(() => {
  fileUrl.value = route.query.url || ''
  fileName.value = route.query.name || ''

  if (fileName.value) {
    document.title = fileName.value + ' - CAD 预览'
  }
})
</script>

<style scoped lang="scss">
.cad-preview-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  .preview-header {
    flex-shrink: 0;
    padding: 8px 16px;
    background: #1e293b;
    color: #fff;
    font-size: 14px;
    display: flex;
    align-items: center;
    .file-name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .preview-body {
    flex: 1;
    min-height: 0;
  }

  .no-file {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #909399;
    p { margin-top: 12px; font-size: 14px; }
  }
}
</style>
