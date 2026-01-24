<template>
  <div class="file-manage-container">
    <!-- 左侧文件夹树 -->
    <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
      <FolderTree
        :folders="folders"
        :current-folder-id="currentFolderId"
        @select="handleFolderSelect"
      />
    </div>

    <!-- 可拖拽分隔线 -->
    <div class="resize-handle" @mousedown="startResize"></div>

    <!-- 右侧文件列表 -->
    <div class="main-content">
      <FileList
        :files="currentItems"
        :breadcrumb="breadcrumb"
        :loading="fileLoading"
        @open="handleFileOpen"
        @contextmenu="handleContextMenuAction"
        @navigate="handleBreadcrumbNavigate"
        @select="handleFileSelect"
      />
    </div>

    <!-- 文件属性弹窗 -->
    <el-dialog
      v-model="propertiesVisible"
      title="文件属性"
      width="420px"
      :close-on-click-modal="false"
      class="properties-dialog"
    >
      <div class="properties-content" v-if="propertiesFile">
        <div class="properties-header">
          <FileIcon :type="propertiesFile.type" :size="64" />
          <div class="file-info">
            <h3>{{ propertiesFile.name }}</h3>
            <span class="file-type">{{ getFileTypeName(propertiesFile.type) }}</span>
          </div>
        </div>
        <el-divider />
        <div class="properties-body">
          <div class="info-row">
            <span class="label">文件大小</span>
            <span class="value">{{ formatFileSize(propertiesFile.size) }}</span>
          </div>
          <div class="info-row">
            <span class="label">文件类型</span>
            <span class="value">{{ propertiesFile.type?.toUpperCase() }} 文件</span>
          </div>
          <el-divider />
          <div class="info-row">
            <span class="label">创建时间</span>
            <span class="value">{{ propertiesFile.createTime }}</span>
          </div>
          <div class="info-row">
            <span class="label">修改时间</span>
            <span class="value">{{ propertiesFile.updateTime }}</span>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 文件预览弹窗 -->
    <el-dialog
      v-model="previewVisible"
      :title="'文件预览 - ' + (previewFile?.name || '')"
      width="85%"
      :close-on-click-modal="true"
      class="preview-dialog"
      destroy-on-close
    >
      <div class="preview-content">
        <!-- DWG文件预览 -->
        <div v-if="previewFile?.type?.toLowerCase() === 'dwg' && previewFile?.filePath" class="dwg-preview">
          <DwgViewer 
            :file-path="'/' + previewFile.filePath" 
            :file-name="previewFile.name"
          />
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 其他文件预览占位 -->
        <div v-else class="preview-placeholder">
          <FileIcon :type="previewFile?.type" :size="120" />
          <h3>{{ previewFile?.name }}</h3>
          <p class="preview-tip">{{ previewFile?.type?.toUpperCase() }} 文件预览需要专业软件支持</p>
          <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
            下载文件
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download } from '@element-plus/icons-vue'
import FolderTree from './components/FolderTree.vue'
import FileList from './components/FileList.vue'
import FileIcon from './components/FileIcon.vue'
import DwgViewer from './components/DwgViewer.vue'
import fileData from './data.json'

// 侧边栏宽度
const sidebarWidth = ref(280)
const isResizing = ref(false)

// 文件夹数据
const folders = ref([])
// 文件数据（按文件夹ID索引）
const filesMap = ref({})
// 当前选中的文件夹ID
const currentFolderId = ref('')
// 当前文件夹路径（用于面包屑）
const breadcrumb = ref([])
// 选中的文件ID列表
const selectedFileIds = ref([])
// 文件加载状态
const fileLoading = ref(false)
// 记录已加载过的文件夹
const loadedFolders = ref(new Set())
// 当前正在加载的请求ID
let currentLoadingRequest = null

// 属性弹窗状态
const propertiesVisible = ref(false)
const propertiesFile = ref(null)

// 预览弹窗状态
const previewVisible = ref(false)
const previewFile = ref(null)

// 文件类型名称映射
const fileTypeNameMap = {
  docx: 'Word 文档',
  doc: 'Word 文档',
  xlsx: 'Excel 表格',
  xls: 'Excel 表格',
  pdf: 'PDF 文档',
  txt: '文本文件',
  md: 'Markdown 文档',
  pptx: '演示文稿',
  ppt: '演示文稿',
  jpg: 'JPEG 图片',
  jpeg: 'JPEG 图片',
  png: 'PNG 图片',
  gif: 'GIF 图片',
  bmp: 'BMP 图片',
  svg: 'SVG 图片',
  webp: 'WebP 图片',
  psd: 'Photoshop 文件',
  mp4: 'MP4 视频',
  avi: 'AVI 视频',
  mov: 'MOV 视频',
  mkv: 'MKV 视频',
  mp3: 'MP3 音频',
  wav: 'WAV 音频',
  flac: 'FLAC 音频',
  zip: 'ZIP 压缩包',
  rar: 'RAR 压缩包',
  '7z': '7Z 压缩包',
  exe: '可执行程序',
  iso: '光盘镜像',
  rp: 'Axure 原型'
}

// 获取文件类型名称
const getFileTypeName = (type) => {
  return fileTypeNameMap[type?.toLowerCase()] || (type?.toUpperCase() + ' 文件')
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 当前选中的文件夹对象
const currentFolder = computed(() => {
  if (!currentFolderId.value) return null
  const findFolder = (list, id) => {
    for (const folder of list) {
      if (folder.id === id) return folder
      if (folder.children && folder.children.length > 0) {
        const found = findFolder(folder.children, id)
        if (found) return found
      }
    }
    return null
  }
  return findFolder(folders.value, currentFolderId.value)
})

// 当前文件夹下的子文件夹列表
const currentSubFolders = computed(() => {
  if (!currentFolder.value) return []
  return currentFolder.value.children || []
})

// 当前文件夹下的文件列表
const currentFiles = computed(() => {
  if (!currentFolderId.value) return []
  return filesMap.value[currentFolderId.value] || []
})

// 合并文件夹和文件，文件夹优先
const currentItems = computed(() => {
  const folders = currentSubFolders.value.map(folder => ({
    ...folder,
    isFolder: true,
    type: 'folder',
    size: 0,
    createTime: '',
    updateTime: ''
  }))
  const files = currentFiles.value
  return [...folders, ...files]
})

// 初始化数据
onMounted(() => {
  loadFolders()
})

// 加载文件夹数据
const loadFolders = () => {
  // TODO: 替换为真实接口
  // const res = await request.get('/api/folders')
  folders.value = fileData.folders
  filesMap.value = fileData.files
  
  // 默认选中第一个文件夹
  if (folders.value.length > 0) {
    handleFolderSelect(folders.value[0])
  }
}

// 加载文件夹下的文件
const loadFolderFiles = async (folderId) => {
  // 如果已经加载过，直接返回，不设置loading状态
  if (loadedFolders.value.has(folderId)) {
    return
  }
  
  // 取消之前的加载请求
  if (currentLoadingRequest) {
    currentLoadingRequest.cancelled = true
  }
  
  // 创建新的请求标识
  const requestId = { cancelled: false }
  currentLoadingRequest = requestId
  
  fileLoading.value = true
  
  try {
    // TODO: 替换为真实接口
    // const res = await request.get('/api/files', { params: { folderId } })
    // filesMap.value[folderId] = res.data
    
    // 模拟网络延迟（实际项目中移除此行）
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 检查请求是否已被取消
    if (requestId.cancelled) {
      return
    }
    
    // 使用模拟数据
    // 数据已经在 filesMap 中了，这里只是模拟加载过程
    
    // 标记为已加载
    loadedFolders.value.add(folderId)
  } catch (error) {
    if (!requestId.cancelled) {
      ElMessage.error('加载文件列表失败')
    }
  } finally {
    // 只有当前请求未被取消时才关闭loading
    if (!requestId.cancelled && currentLoadingRequest === requestId) {
      fileLoading.value = false
      currentLoadingRequest = null
    }
  }
}

// 递归查找文件夹并构建路径
const findFolderPath = (folderId, folderList, path = []) => {
  for (const folder of folderList) {
    const currentPath = [...path, { id: folder.id, name: folder.name }]
    if (folder.id === folderId) {
      return currentPath
    }
    if (folder.children && folder.children.length > 0) {
      const result = findFolderPath(folderId, folder.children, currentPath)
      if (result) return result
    }
  }
  return null
}

// 处理文件夹选择 - 这里可以调用接口获取该文件夹下的文件
const handleFolderSelect = (folder, node) => {
  // 立即更新选中状态，不等待数据加载
  currentFolderId.value = folder.id
  
  // 构建面包屑
  const path = findFolderPath(folder.id, folders.value)
  breadcrumb.value = path || [{ id: folder.id, name: folder.name }]
  
  // 异步加载该文件夹下的文件（不阻塞UI）
  loadFolderFiles(folder.id)
  
  // 你可以在这里添加更多逻辑，比如记录访问历史等
  console.log('选中文件夹:', folder.id, folder.name)
}

// 处理文件打开
const handleFileOpen = (file) => {
  // 如果是文件夹，进入该文件夹
  if (file.isFolder) {
    handleFolderSelect(file)
    return
  }
  
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
  const previewTypes = ['dwg', 'dxf', 'pdf', ...imageTypes]
  
  if (previewTypes.includes(file.type?.toLowerCase())) {
    previewFile.value = file
    previewVisible.value = true
  } else {
    ElMessage.info(`打开文件: ${file.name}`)
  }
}

// 处理面包屑导航
const handleBreadcrumbNavigate = (item) => {
  const folder = { id: item.id, name: item.name }
  handleFolderSelect(folder)
}

// 处理文件选择
const handleFileSelect = (fileIds) => {
  selectedFileIds.value = fileIds
}

// 处理下载
const handleDownload = (file) => {
  if (file.filePath) {
    // 如果有文件路径，创建下载链接
    const link = document.createElement('a')
    link.href = '/' + file.filePath
    link.download = file.name
    link.click()
  } else {
    ElMessage.success(`开始下载: ${file.name}`)
  }
}

// 处理iframe加载错误
const handleIframeError = () => {
  ElMessage.warning('文件预览加载失败，请尝试下载查看')
}

// 处理右键菜单操作
const handleContextMenuAction = ({ action, file }) => {
  switch (action) {
    case 'open':
      handleFileOpen(file)
      break
    case 'preview':
      previewFile.value = file
      previewVisible.value = true
      break
    case 'download':
      ElMessage.success(`开始下载: ${file.name}`)
      break
    case 'share':
      ElMessage.info(`分享文件: ${file.name}`)
      break
    case 'rename':
      ElMessageBox.prompt('请输入新名称', '重命名', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: file.name,
        inputPattern: /^.+$/,
        inputErrorMessage: '名称不能为空'
      }).then(({ value }) => {
        ElMessage.success(`已重命名为: ${value}`)
      }).catch(() => {})
      break
    case 'copy':
      ElMessage.success('已复制到剪贴板')
      break
    case 'cut':
      ElMessage.success('已剪切')
      break
    case 'move':
      ElMessage.info('选择目标文件夹（功能待实现）')
      break
    case 'delete':
      ElMessageBox.confirm(
        `确定要删除 "${file.name}" 吗？此操作不可撤销。`,
        '删除确认',
        {
          confirmButtonText: '删除',
          cancelButtonText: '取消',
          type: 'warning',
          confirmButtonClass: 'el-button--danger'
        }
      ).then(() => {
        // 实际项目中调用删除接口
        const files = filesMap.value[file.folderId]
        if (files) {
          const index = files.findIndex(f => f.id === file.id)
          if (index > -1) {
            files.splice(index, 1)
          }
        }
        ElMessage.success('删除成功')
      }).catch(() => {})
      break
    case 'properties':
      propertiesFile.value = file
      propertiesVisible.value = true
      break
    default:
      ElMessage.info(`操作: ${action}`)
  }
}

// 拖拽调整侧边栏宽度
const startResize = (e) => {
  isResizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value

  const onMouseMove = (e) => {
    if (!isResizing.value) return
    const diff = e.clientX - startX
    const newWidth = Math.max(200, Math.min(400, startWidth + diff))
    sidebarWidth.value = newWidth
  }

  const onMouseUp = () => {
    isResizing.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style lang="scss" scoped>
.file-manage-container {
  display: flex;
  height: calc(100vh - 84px);
  background: #f1f5f9;

  .sidebar {
    flex-shrink: 0;
    height: 100%;
    background: #fff;
    border-right: 1px solid #e2e8f0;
    overflow: hidden;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
  }

  .resize-handle {
    width: 4px;
    cursor: col-resize;
    background: transparent;
    transition: background-color 0.2s;
    position: relative;
    z-index: 10;

    &:hover {
      background: linear-gradient(180deg, #3b82f6 0%, #60a5fa 100%);
    }
    
    &:active {
      background: #2563eb;
    }
  }

  .main-content {
    flex: 1;
    overflow: hidden;
    min-width: 0;
    background: #fff;
    margin: 8px;
    margin-left: 0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
}

// 属性弹窗样式
:deep(.properties-dialog) {
  .el-dialog__header {
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 16px;
  }
  
  .el-dialog__body {
    padding: 0;
  }
}

.properties-content {
  .properties-header {
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 24px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    
    .file-info {
      h3 {
        margin: 0 0 8px 0;
        font-size: 16px;
        color: #1e293b;
        word-break: break-all;
      }
      
      .file-type {
        font-size: 13px;
        color: #64748b;
      }
    }
  }
  
  .properties-body {
    padding: 20px 24px;
    
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      
      .label {
        color: #64748b;
        font-size: 14px;
      }
      
      .value {
        color: #1e293b;
        font-size: 14px;
        font-weight: 500;
      }
    }
    
    .el-divider {
      margin: 12px 0;
    }
  }
}

// 预览弹窗样式
:deep(.preview-dialog) {
  .el-dialog__body {
    padding: 0;
    min-height: 400px;
  }
}

.preview-content {
  min-height: 500px;
  
  .dwg-preview {
    height: 70vh;
    display: flex;
    flex-direction: column;
    
    .preview-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 16px 0;
      border-top: 1px solid #e2e8f0;
      margin-top: 16px;
    }
  }
  
  .preview-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 60px 40px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
    min-height: 400px;
    
    h3 {
      margin: 20px 0 8px;
      color: #1e293b;
      font-size: 18px;
    }
    
    .preview-tip {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 24px;
    }
  }
}

.preview-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
  }
}
</style>
