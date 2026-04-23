<template>
  <div class="file-manage-container">
    <!-- 初始化加载遮罩 -->
    <div v-if="initializing" class="initializing-overlay">
      <el-icon class="is-loading" :size="50"><Loading /></el-icon>
      <p>正在初始化文件管理器...</p>
    </div>
    
    <template v-else>
      <!-- 左侧文件夹树 -->
      <div class="sidebar" :style="{ width: sidebarWidth + 'px' }">
        <div class="bucket-switcher">
          <el-radio-group v-model="isPrivateBucket" size="small" @change="handleBucketSwitch">
            <el-radio-button :value="true">私有桶</el-radio-button>
            <el-radio-button :value="false">公有桶</el-radio-button>
          </el-radio-group>
        </div>
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
    </template>

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
        <!-- DWG/STEP/STP文件预览 -->
        <div v-if="['dwg','step','stp'].includes(previewFile?.type?.toLowerCase()) && previewFile?.filePath" class="dwg-preview">
          <CadViewer 
            :file-path="getCadPreviewPath(previewFile)" 
            :file-name="previewFile.name"
          />
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 图片预览 -->
        <div v-else-if="isImageType(previewFile?.type)" class="image-preview">
          <el-image
            v-if="previewFileUrl"
            :src="previewFileUrl"
            fit="contain"
            :preview-src-list="[previewFileUrl]"
            style="max-width: 100%; max-height: calc(80vh - 120px);"
          />
          <div v-else class="preview-loading">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>正在加载图片...</p>
          </div>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- PDF预览 -->
        <div v-else-if="previewFile?.type?.toLowerCase() === 'pdf'" class="pdf-preview">
          <iframe
            v-if="previewFileUrl"
            :src="previewFileUrl"
            style="width: 100%; height: calc(80vh - 120px); border: none;"
            @error="handleIframeError"
          />
          <div v-else class="preview-loading">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>正在加载PDF...</p>
          </div>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 视频预览 -->
        <div v-else-if="isVideoType(previewFile?.type)" class="video-preview">
          <video
            v-if="previewFileUrl"
            controls
            autoplay
            style="max-width: 100%; max-height: calc(80vh - 120px);"
          >
            <source :src="previewFileUrl" :type="'video/' + previewFile?.type?.toLowerCase()">
            您的浏览器不支持视频播放
          </video>
          <div v-else class="preview-loading">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>正在加载视频...</p>
          </div>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 音频预览 -->
        <div v-else-if="isAudioType(previewFile?.type)" class="audio-preview">
          <FileIcon :type="previewFile?.type" :size="120" />
          <h3>{{ previewFile?.name }}</h3>
          <audio
            v-if="previewFileUrl"
            controls
            autoplay
            style="width: 100%; margin-top: 16px;"
          >
            <source :src="previewFileUrl" :type="'audio/' + previewFile?.type?.toLowerCase()">
            您的浏览器不支持音频播放
          </audio>
          <div v-else class="preview-loading" style="margin-top: 16px;">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>正在加载音频...</p>
          </div>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 文本文件预览 -->
        <div v-else-if="isTextType(previewFile?.type)" class="text-preview">
          <pre v-if="previewTextContent !== null" class="text-content">{{ previewTextContent }}</pre>
          <div v-else class="preview-loading">
            <el-icon class="is-loading" :size="40"><Loading /></el-icon>
            <p>正在加载文件...</p>
          </div>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 其他不支持预览的文件 -->
        <div v-else class="preview-placeholder">
          <FileIcon :type="previewFile?.type" :size="120" />
          <h3>{{ previewFile?.name }}</h3>
          <p class="preview-tip">{{ previewFile?.type?.toUpperCase() }} 文件暂不支持在线预览</p>
          <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
            下载文件
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, shallowRef, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Download, Loading } from '@element-plus/icons-vue'
import FolderTree from './components/FolderTree.vue'
import FileList from './components/FileList.vue'
import FileIcon from './components/FileIcon.vue'
import CadViewer from './components/CadViewer.vue'
import { fileManageApi } from './api'
import { DiyCommon } from '@/utils/microi.net.import'

// 侧边栏宽度
const sidebarWidth = ref(280)
const isResizing = ref(false)

// 存储桶类型（true=私有桶，false=公有桶）
const isPrivateBucket = ref(true)

// 文件夹数据（使用shallowRef减少响应式开销）
const folders = shallowRef([])
// 文件数据（按文件夹路径索引，使用shallowRef）
const filesMap = shallowRef({})
// 当前选中的文件夹ID（使用完整路径作为ID）
const currentFolderId = ref('')
// 当前文件夹路径（用于面包屑，使用shallowRef避免深度响应）
const breadcrumb = shallowRef([])
// 选中的文件ID列表
const selectedFileIds = ref([])
// 文件加载状态
const fileLoading = ref(false)
// 初始化加载状态
const initializing = ref(true)

// 根路径前缀（OsClient/）
const rootPrefix = ref('')

// 获取CAD文件转换后的预览路径
const getCadPreviewPath = (file) => {
  const path = '/' + file.filePath
  const ext = (file.type || '').toLowerCase()
  const lastDot = path.lastIndexOf('.')
  const base = path.substring(0, lastDot)
  if (ext === 'dwg') return base + '_preview.dxf'
  if (ext === 'step' || ext === 'stp') return base + '_preview.stl'
  return path
}

// 记录已加载过的文件夹（使用路径作为key）
const loadedFolders = ref(new Set())
// 当前正在加载的请求ID
let currentLoadingRequest = null

// 属性弹窗状态
const propertiesVisible = ref(false)
const propertiesFile = ref(null)

// 预览弹窗状态
const previewVisible = ref(false)
const previewFile = ref(null)
const previewFileUrl = ref('')
const previewTextContent = ref(null)

// 文件类型判断辅助函数
const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico']
const videoTypes = ['mp4', 'webm', 'ogg']
const audioTypes = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
const textTypes = ['txt', 'md', 'json', 'xml', 'csv', 'log', 'yml', 'yaml', 'ini', 'conf', 'sh', 'bat', 'cmd', 'js', 'ts', 'css', 'html', 'htm', 'sql', 'py', 'java', 'cs', 'go', 'rs', 'c', 'cpp', 'h']
const isImageType = (type) => imageTypes.includes(type?.toLowerCase())
const isVideoType = (type) => videoTypes.includes(type?.toLowerCase())
const isAudioType = (type) => audioTypes.includes(type?.toLowerCase())
const isTextType = (type) => textTypes.includes(type?.toLowerCase())
const isBrowserPreviewable = (type) => isImageType(type) || isVideoType(type) || isAudioType(type) || isTextType(type) || type?.toLowerCase() === 'pdf'

// 监听预览弹窗打开/关闭，自动加载预览URL
watch(previewVisible, async (visible) => {
  if (visible && previewFile.value) {
    const file = previewFile.value
    const fileType = file.type?.toLowerCase()
    previewFileUrl.value = ''
    previewTextContent.value = null

    // 获取临时访问URL（私有桶和公有桶均通过后端获取）
    if (file.filePath && (isImageType(fileType) || isVideoType(fileType) || isAudioType(fileType) || fileType === 'pdf')) {
      try {
        const result = await fileManageApi.getPrivateFileUrl(file.filePath, isPrivateBucket.value)
        if (result.Code === 1 && result.Data) {
          previewFileUrl.value = result.Data
        }
      } catch (e) {
        console.error('获取预览URL失败:', e)
      }
    } else if (file.filePath && isTextType(fileType)) {
      try {
        const result = await fileManageApi.getPrivateFileUrl(file.filePath, isPrivateBucket.value)
        if (result.Code === 1 && result.Data) {
          const resp = await fetch(result.Data)
          previewTextContent.value = await resp.text()
        }
      } catch (e) {
        console.error('获取文本内容失败:', e)
        previewTextContent.value = '加载失败'
      }
    }
  } else {
    previewFileUrl.value = ''
    previewTextContent.value = null
  }
})

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
let cachedFolderId = ''
let cachedItems = []

const currentItems = computed(() => {
  const folderId = currentFolderId.value
  
  if (folderId === cachedFolderId && cachedItems.length > 0) {
    return cachedItems
  }
  
  const folderItems = currentSubFolders.value.map(folder => 
    Object.freeze({
      ...folder,
      isFolder: true,
      type: 'folder',
      size: 0,
      createTime: '',
      updateTime: ''
    })
  )
  
  const files = currentFiles.value
  const result = [...folderItems, ...files]
  
  cachedFolderId = folderId
  cachedItems = result
  
  return result
})

// 初始化数据
onMounted(async () => {
  await loadFolders()
})

// 切换存储桶
const handleBucketSwitch = () => {
  // 清除所有缓存
  loadedFolders.value = new Set()
  filesMap.value = {}
  cachedFolderId = ''
  cachedItems = []
  currentFolderId.value = ''
  breadcrumb.value = []
  folders.value = []
  initializing.value = true
  // 重新加载
  loadFolders()
}

// 从OSS/MinIO列出根目录结构，构建文件夹树
const loadFolders = async () => {
  try {
    // 获取当前OsClient作为根路径
    const osClient = (DiyCommon.GetOsClient() || '').toLowerCase()
    rootPrefix.value = osClient ? osClient + '/' : ''

    // 列出根目录下的文件夹
    const result = await fileManageApi.listObjects(rootPrefix.value, isPrivateBucket.value)
    
    if (result.Code === 1 && result.Data) {
      const rootFolders = (result.Data.Folders || []).map(f => ({
        id: f.FullPath,
        name: f.Name,
        fullPath: f.FullPath,
        parentId: null,
        children: [] // 子文件夹需要按需加载
      }))

      // 如果没有文件夹，创建一个虚拟根节点
      if (rootFolders.length === 0) {
        folders.value = [{
          id: rootPrefix.value || '/',
          name: osClient || '根目录',
          fullPath: rootPrefix.value || '/',
          parentId: null,
          children: []
        }]
      } else {
        folders.value = rootFolders
      }

      // 异步加载每个根文件夹的子文件夹
      for (const folder of folders.value) {
        loadSubFolders(folder)
      }
    } else {
      // 回退到默认根目录
      folders.value = [{
        id: rootPrefix.value || '/',
        name: osClient || '根目录',
        fullPath: rootPrefix.value || '/',
        parentId: null,
        children: []
      }]
    }

    initializing.value = false
    
    await new Promise(resolve => setTimeout(resolve, 0))
    
    // 默认选中第一个文件夹
    if (folders.value.length > 0) {
      handleFolderSelect(folders.value[0])
    }
  } catch (error) {
    console.error('加载文件夹失败:', error)
    ElMessage.error('加载文件夹失败')
    initializing.value = false
  }
}

// 递归加载子文件夹结构
const loadSubFolders = async (folder) => {
  try {
    const result = await fileManageApi.listObjects(folder.fullPath, isPrivateBucket.value)
    if (result.Code === 1 && result.Data && result.Data.Folders) {
      const children = result.Data.Folders.map(f => ({
        id: f.FullPath,
        name: f.Name,
        fullPath: f.FullPath,
        parentId: folder.id,
        children: []
      }))
      
      if (children.length > 0) {
        folder.children = children
        // 触发响应式更新
        folders.value = [...folders.value]
        
        // 继续递归加载下级文件夹
        for (const child of children) {
          loadSubFolders(child)
        }
      }
    }
  } catch (error) {
    console.error('加载子文件夹失败:', folder.fullPath, error)
  }
}

// 加载文件夹下的文件
const loadFolderFiles = async (folderId) => {
  // 如果已经加载过，直接返回
  if (loadedFolders.value.has(folderId)) {
    return
  }
  
  if (currentLoadingRequest) {
    currentLoadingRequest.cancelled = true
  }
  
  const requestId = { cancelled: false }
  currentLoadingRequest = requestId
  
  fileLoading.value = true
  
  try {
    const result = await fileManageApi.listObjects(folderId, isPrivateBucket.value)
    
    if (requestId.cancelled) return
    
    if (result.Code === 1 && result.Data) {
      const fileList = (result.Data.Files || []).map(f => ({
        id: f.FullPath,
        name: f.Name,
        type: f.Type,
        size: f.Size,
        createTime: f.LastModified,
        updateTime: f.LastModified,
        folderId: folderId,
        filePath: f.FullPath
      }))
      
      // 更新filesMap
      const newMap = { ...filesMap.value }
      newMap[folderId] = fileList
      filesMap.value = newMap
      
      // 清除缓存以触发重新计算
      cachedFolderId = ''
      cachedItems = []
    }
    
    loadedFolders.value.add(folderId)
  } catch (error) {
    if (!requestId.cancelled) {
      ElMessage.error('加载文件列表失败')
    }
  } finally {
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
  // 避免重复选择同一个文件夹
  if (currentFolderId.value === folder.id) {
    return
  }
  
  // 立即更新选中状态，不等待数据加载
  currentFolderId.value = folder.id
  
  // 构建面包屑（使用shallowRef需要替换整个对象）
  const path = findFolderPath(folder.id, folders.value)
  breadcrumb.value = Object.freeze(path || [{ id: folder.id, name: folder.name }])
  
  // 异步加载该文件夹下的文件（不阻塞UI）
  loadFolderFiles(folder.id)
}

// 处理文件打开
const handleFileOpen = (file) => {
  // 如果是文件夹，进入该文件夹
  if (file.isFolder) {
    handleFolderSelect(file)
    return
  }
  
  const fileType = file.type?.toLowerCase()
  const cadTypes = ['dwg', 'step', 'stp', 'dxf']
  
  if (cadTypes.includes(fileType) || isBrowserPreviewable(fileType)) {
    previewFile.value = file
    previewVisible.value = true
  } else {
    // 不支持预览的类型，直接下载
    handleDownload(file)
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
const handleDownload = async (file) => {
  if (file.filePath) {
    try {
      const result = await fileManageApi.getPrivateFileUrl(file.filePath, isPrivateBucket.value)
      if (result.Code === 1 && result.Data) {
        const link = document.createElement('a')
        link.href = result.Data
        link.download = file.name
        link.target = '_blank'
        link.click()
      } else {
        ElMessage.error(result.Msg || '获取下载链接失败')
      }
    } catch (error) {
      ElMessage.error('获取下载链接失败')
    }
  } else {
    ElMessage.warning('文件路径不存在')
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
      handleDownload(file)
      break
    case 'share':
      ElMessage.info(`分享文件: ${file.name}`)
      break
    case 'rename':
      handleRename(file)
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
      handleDelete(file)
      break
    case 'properties':
      propertiesFile.value = file
      propertiesVisible.value = true
      break
    default:
      ElMessage.info(`操作: ${action}`)
  }
}

// 重命名文件/文件夹
const handleRename = (file) => {
  const nameWithoutExt = file.isFolder ? file.name : file.name.replace(/\.[^.]+$/, '')
  ElMessageBox.prompt('请输入新名称', '重命名', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    inputValue: nameWithoutExt,
    inputPattern: /^[^/\\:*?"<>|]+$/,
    inputErrorMessage: '名称不能为空且不能包含特殊字符'
  }).then(async ({ value }) => {
    try {
      const oldPath = file.filePath || file.fullPath || file.id
      let newPath
      
      if (file.isFolder) {
        // 文件夹重命名
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/', oldPath.length - 2) + 1)
        newPath = parentPath + value + '/'
      } else {
        // 文件重命名
        const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : ''
        const parentPath = oldPath.substring(0, oldPath.lastIndexOf('/') + 1)
        newPath = parentPath + value + ext
      }
      
      const result = await fileManageApi.renameObject(oldPath, newPath, isPrivateBucket.value)
      if (result.Code === 1) {
        ElMessage.success('重命名成功')
        refreshCurrentFolder()
      } else {
        ElMessage.error(result.Msg || '重命名失败')
      }
    } catch (error) {
      ElMessage.error('重命名失败')
    }
  }).catch(() => {})
}

// 删除文件/文件夹
const handleDelete = (file) => {
  const isFolder = file.isFolder
  const displayName = file.name
  
  ElMessageBox.confirm(
    `确定要删除${isFolder ? '文件夹' : ''} "${displayName}" 吗？${isFolder ? '文件夹内所有文件将被一起删除，' : ''}此操作不可撤销。`,
    '删除确认',
    {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(async () => {
    try {
      let deletePath = file.filePath || file.fullPath || file.id
      // 如果是文件夹，确保路径以"/"结尾
      if (isFolder && !deletePath.endsWith('/')) {
        deletePath += '/'
      }
      
      const result = await fileManageApi.deleteObject(deletePath, isPrivateBucket.value)
      if (result.Code === 1) {
        ElMessage.success('删除成功')
        refreshCurrentFolder()
      } else {
        ElMessage.error(result.Msg || '删除失败')
      }
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }).catch(() => {})
}

// 刷新当前文件夹
const refreshCurrentFolder = () => {
  const folderId = currentFolderId.value
  if (folderId) {
    // 清除该文件夹的缓存
    loadedFolders.value.delete(folderId)
    cachedFolderId = ''
    cachedItems = []
    // 重新加载
    loadFolderFiles(folderId)
    // 也刷新子文件夹
    const folder = currentFolder.value
    if (folder) {
      loadSubFolders(folder)
    }
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

// 组件卸载时清理资源，避免内存泄露
onUnmounted(() => {
  // 清理缓存
  cachedFolderId = ''
  cachedItems = []
  
  // 取消未完成的加载请求
  if (currentLoadingRequest) {
    currentLoadingRequest.cancelled = true
  }
})
</script>

<style lang="scss" scoped>
.file-manage-container {
  display: flex;
  height: calc(100vh - 84px);
  background: #f1f5f9;
  position: relative;

  // 初始化加载遮罩
  .initializing-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--el-bg-color, #ffffff);
    z-index: 1000;
    
    .el-icon {
      margin-bottom: 16px;
      color: var(--el-color-primary, #3b82f6);
    }
    
    p {
      margin: 0;
      font-size: 13px;
      color: var(--el-text-color-secondary, #64748b);
    }
  }

  .sidebar {
    flex-shrink: 0;
    height: 100%;
    background: var(--el-bg-color, #fff);
    border-right: 1px solid var(--el-border-color-lighter, #e2e8f0);
    overflow: hidden;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
  }

  .bucket-switcher {
    padding: 10px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter, #e2e8f0);
    display: flex;
    justify-content: center;
    background: var(--el-fill-color-light, #f8fafc);
    flex-shrink: 0;
    
    .el-radio-group {
      width: 100%;
      display: flex;
      
      .el-radio-button {
        flex: 1;
        
        :deep(.el-radio-button__inner) {
          width: 100%;
        }
      }
    }
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
    background: var(--el-bg-color, #fff);
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
        font-size: 13px;
      }
      
      .value {
        color: #1e293b;
        font-size: 13px;
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
      font-size: 13px;
      margin-bottom: 24px;
    }
  }

  .preview-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    padding: 16px 0;
    border-top: 1px solid #e2e8f0;
    margin-top: 8px;
  }

  .preview-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 300px;
    color: #64748b;
    
    p {
      margin-top: 12px;
      font-size: 13px;
    }
  }

  .image-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    
    .el-image {
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }
  }

  .pdf-preview {
    display: flex;
    flex-direction: column;
    padding: 0;
    
    iframe {
      border-radius: 4px;
    }
  }

  .video-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px;
    
    video {
      border-radius: 8px;
      box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
      background: #000;
    }
  }

  .audio-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
    border-radius: 12px;
    min-height: 300px;
    
    h3 {
      margin: 16px 0 0;
      color: #1e293b;
      font-size: 16px;
    }
  }

  .text-preview {
    display: flex;
    flex-direction: column;
    padding: 0;
    
    .text-content {
      max-height: calc(80vh - 120px);
      overflow: auto;
      padding: 16px 20px;
      margin: 0;
      font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
      background: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      white-space: pre-wrap;
      word-break: break-all;
    }
  }
}
</style>
