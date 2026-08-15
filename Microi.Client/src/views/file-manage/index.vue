<template>
  <div class="file-manage-container" v-mci-loading:page="initializing">
    <template>
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
          @expand="handleFolderExpand"
          @create-folder="handleCreateFolder"
          @context-action="handleFolderContextAction"
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
          :preview-enabled="previewEnabled"
          :thumbnail-urls="thumbnailUrls"
          :recycle-mode="recycleMode"
          @open="handleFileOpen"
          @contextmenu="handleContextMenuAction"
          @navigate="handleBreadcrumbNavigate"
          @select="handleFileSelect"
          @upload="openUploadPicker"
          @create-folder="handleCreateFolder"
          @refresh="refreshCurrentFolder"
          @sync="syncDialogVisible = true"
          @toggle-trash="toggleTrashMode"
          @preview-toggle="handlePreviewToggle"
          @batch-delete="handleBatchDelete"
          @batch-move="handleBatchMove"
          @batch-restore="handleBatchRestore"
          @area-action="handleFileAreaAction"
        />
      </div>
    </template>

    <input
      ref="fileInputRef"
      class="hidden-file-input"
      type="file"
      multiple
      @change="handleUploadChange"
    />

    <el-dialog
      v-model="uploadProgressVisible"
      title="上传文件"
      width="420px"
      align-center
      draggable
      :close-on-click-modal="false"
    >
      <div class="upload-progress">
        <div>{{ uploadProgressText }}</div>
        <el-progress :percentage="uploadProgress" />
      </div>
    </el-dialog>

    <FileSyncDialog
      v-model="syncDialogVisible"
      :current-folder-id="currentFolderId"
      :current-limit="isPrivateBucket"
      @finished="refreshCurrentFolder"
    />

    <!-- 文件属性弹窗 -->
    <el-dialog
      v-model="propertiesVisible"
      title="文件属性"
      width="420px"
      align-center
      draggable
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
      align-center
      draggable
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
        <div v-else-if="isImageType(previewFile?.type)" class="image-preview" v-mci-loading:detail="!previewFileUrl">
          <el-image
            v-if="previewFileUrl"
            :src="previewFileUrl"
            fit="contain"
            :preview-src-list="[previewFileUrl]"
            style="max-width: 100%; max-height: calc(80vh - 120px);"
          />
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- PDF预览 -->
        <div v-else-if="previewFile?.type?.toLowerCase() === 'pdf'" class="pdf-preview" v-mci-loading:detail="!previewFileUrl">
          <iframe
            v-if="previewFileUrl"
            :src="previewFileUrl"
            style="width: 100%; height: calc(80vh - 120px); border: none;"
            @error="handleIframeError"
          />
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 视频预览 -->
        <div v-else-if="isVideoType(previewFile?.type)" class="video-preview" v-mci-loading:detail="!previewFileUrl">
          <video
            v-if="previewFileUrl"
            controls
            autoplay
            style="max-width: 100%; max-height: calc(80vh - 120px);"
          >
            <source :src="previewFileUrl" :type="'video/' + previewFile?.type?.toLowerCase()">
            您的浏览器不支持视频播放
          </video>
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 音频预览 -->
        <div v-else-if="isAudioType(previewFile?.type)" class="audio-preview" v-mci-loading:detail="!previewFileUrl">
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
          <div class="preview-actions">
            <el-button type="primary" :icon="Download" @click="handleDownload(previewFile)">
              下载文件
            </el-button>
          </div>
        </div>
        <!-- 文本文件预览 -->
        <div v-else-if="isTextType(previewFile?.type)" class="text-preview" v-mci-loading:detail="previewTextContent === null">
          <pre v-if="previewTextContent !== null" class="text-content">{{ previewTextContent }}</pre>
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
import { Download } from '@element-plus/icons-vue'
import FolderTree from './components/FolderTree.vue'
import FileList from './components/FileList.vue'
import FileIcon from './components/FileIcon.vue'
import CadViewer from './components/CadViewer.vue'
import FileSyncDialog from './components/FileSyncDialog.vue'
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
// 是否开启图片缩略图预览
const previewEnabled = ref(true)
// 当前文件夹软删除路径映射
const deletedPathMap = shallowRef({})
// 回收站列表
const trashRows = shallowRef([])
// 回收站模式
const recycleMode = ref(false)
// 缩略图地址缓存
const thumbnailUrls = shallowRef({})
const thumbnailLoading = new Set()
// 上传与同步状态
const fileInputRef = ref(null)
const uploadProgressVisible = ref(false)
const uploadProgress = ref(0)
const uploadProgressText = ref('')
const syncDialogVisible = ref(false)
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
// 文件夹树按需加载标记
const loadedTreeFolders = ref(new Set())
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

const normalizeObjectPath = (path = '') => String(path || '').replace(/^\/+/, '')
const normalizeFolderPath = (path = '') => {
  const normalized = normalizeObjectPath(path).replace(/\/+$/, '')
  return normalized ? normalized + '/' : ''
}
const joinObjectPath = (folder = '', name = '') => normalizeFolderPath(folder) + String(name || '').replace(/^\/+/, '')
const getObjectPath = (file) => normalizeObjectPath(file?.filePath || file?.fullPath || file?.Path || file?.id || '')
const getBucketScope = () => isPrivateBucket.value ? 'private' : 'public'
const stripRootPrefix = (path = '') => {
  let value = normalizeFolderPath(path).replace(/\/+$/, '')
  const prefix = String(rootPrefix.value || '').toLowerCase()
  if (prefix && value.toLowerCase().startsWith(prefix)) {
    value = value.substring(prefix.length)
  }
  return value || 'upload'
}
const resolveTargetFolder = (path = '') => {
  let value = normalizeFolderPath(path)
  if (!value) return normalizeFolderPath(rootPrefix.value)
  const prefix = String(rootPrefix.value || '').toLowerCase()
  if (prefix && !value.toLowerCase().startsWith(prefix)) {
    value = normalizeFolderPath(rootPrefix.value + value)
  }
  return value
}
const getParentFolderPath = (path = '') => {
  const normalized = normalizeObjectPath(path)
  const source = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  const index = source.lastIndexOf('/')
  return index >= 0 ? source.substring(0, index + 1) : ''
}
const isDeletedPath = (path = '', isFolder = false) => {
  const deleted = deletedPathMap.value || {}
  const normalized = isFolder ? normalizeFolderPath(path) : normalizeObjectPath(path)
  return !!deleted[normalized] || !!deleted[normalizeFolderPath(path)]
}
const buildDeletedPathMap = (rows = []) => {
  const map = {}
  rows.forEach(row => {
    const path = normalizeObjectPath(row.Path || row.FilePathName || row.FullPath || '')
    if (!path) return
    map[path] = true
    if (row.IsFolder === 1 || row.IsFolder === true || path.endsWith('/')) {
      map[normalizeFolderPath(path)] = true
    }
  })
  return map
}

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
  if (!bytes || Number(bytes) <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 当前选中的文件夹对象
const currentFolder = computed(() => {
  if (!currentFolderId.value) return null
  return findFolderById(currentFolderId.value)
})

// 当前文件夹下的子文件夹列表
const currentSubFolders = computed(() => {
  if (!currentFolder.value) return []
  return (currentFolder.value.children || []).filter(folder => !isDeletedPath(folder.fullPath || folder.id, true))
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
  const cacheKey = [
    folderId,
    recycleMode.value ? 'trash' : 'files',
    currentFiles.value.length,
    currentSubFolders.value.length,
    trashRows.value.length,
    Object.keys(deletedPathMap.value || {}).length
  ].join('|')

  if (cacheKey === cachedFolderId && cachedItems.length > 0) {
    return cachedItems
  }

  if (recycleMode.value) {
    const result = trashRows.value.map(row => Object.freeze({
      id: row.Id,
      trashId: row.Id,
      name: row.Name,
      type: row.FileType || (row.IsFolder ? 'folder' : ''),
      size: row.Size || 0,
      createTime: row.DeletedTime,
      updateTime: row.OriginalLastModified,
      folderId: row.FolderPath,
      filePath: row.Path,
      fullPath: row.Path,
      isFolder: row.IsFolder === 1 || row.IsFolder === true,
      isTrash: true
    }))

    cachedFolderId = cacheKey
    cachedItems = result
    return result
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
  
  const files = currentFiles.value.filter(file => !isDeletedPath(file.filePath || file.id, false))
  const result = [...folderItems, ...files]
  
  cachedFolderId = cacheKey
  cachedItems = result
  
  return result
})

const clearItemsCache = () => {
  cachedFolderId = ''
  cachedItems = []
}

function findFolderById(id, folderList = folders.value) {
  for (const folder of folderList || []) {
    if (folder.id === id) return folder
    const found = findFolderById(id, folder.children || [])
    if (found) return found
  }
  return null
}

const mapFolderRows = (rows = [], parentId = null) => (rows || [])
  .filter(f => !isDeletedPath(f.FullPath, true))
  .map(f => ({
    id: f.FullPath,
    name: f.Name,
    fullPath: f.FullPath,
    parentId,
    children: []
  }))

const applyFolderChildren = (folderId, folderRows = []) => {
  const folder = findFolderById(folderId)
  if (!folder) return
  folder.children = mapFolderRows(folderRows, folder.id)
  loadedTreeFolders.value.add(folder.id)
  folders.value = [...folders.value]
  clearItemsCache()
}

const loadTrashRecords = async (folderId = currentFolderId.value, options = {}) => {
  const { setRows = true, mergeMap = true } = options
  const prefix = normalizeFolderPath(folderId || rootPrefix.value)

  try {
    const result = await fileManageApi.trashQuery({
      path: prefix,
      limit: isPrivateBucket.value,
      pageSize: 5000
    })

    if (result.Code !== 1) {
      if (setRows) trashRows.value = []
      return []
    }

    const rows = Array.isArray(result.Data) ? result.Data : []
    const pathMap = result.DataAppend?.PathMap || buildDeletedPathMap(rows)
    const nextMap = mergeMap ? { ...(deletedPathMap.value || {}) } : {}
    if (mergeMap && prefix) {
      Object.keys(nextMap).forEach(key => {
        if (key.startsWith(prefix)) delete nextMap[key]
      })
    }
    deletedPathMap.value = { ...nextMap, ...pathMap }
    if (setRows) trashRows.value = rows
    clearItemsCache()
    return rows
  } catch (error) {
    console.error('加载回收站记录失败:', error)
    if (setRows) trashRows.value = []
    return []
  }
}

const ensureThumbnails = (items = []) => {
  if (!previewEnabled.value) return

  items
    .filter(file => !file.isFolder && isImageType(file.type))
    .forEach(file => {
      const path = getObjectPath(file)
      if (!path || thumbnailUrls.value[file.id] || thumbnailUrls.value[path] || thumbnailLoading.has(path)) return

      thumbnailLoading.add(path)
      fileManageApi.getPrivateFileUrl(path, isPrivateBucket.value)
        .then(result => {
          if (result.Code === 1 && result.Data) {
            thumbnailUrls.value = {
              ...thumbnailUrls.value,
              [file.id]: result.Data,
              [path]: result.Data
            }
          }
        })
        .catch(error => {
          console.error('加载图片缩略图失败:', path, error)
        })
        .finally(() => {
          thumbnailLoading.delete(path)
        })
    })
}

watch(
  () => [previewEnabled.value, currentItems.value],
  ([enabled, items]) => {
    if (enabled) ensureThumbnails(items)
  },
  { deep: false }
)

// 初始化数据
onMounted(async () => {
  await loadFolders()
})

// 切换存储桶
const handleBucketSwitch = () => {
  // 清除所有缓存
  loadedFolders.value = new Set()
  loadedTreeFolders.value = new Set()
  filesMap.value = {}
  clearItemsCache()
  deletedPathMap.value = {}
  trashRows.value = []
  thumbnailUrls.value = {}
  recycleMode.value = false
  selectedFileIds.value = []
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
    await loadTrashRecords(rootPrefix.value, { setRows: false, mergeMap: false })

    // 列出根目录下的文件夹
    const result = await fileManageApi.listObjects(rootPrefix.value, isPrivateBucket.value)
    
    if (result.Code === 1 && result.Data) {
      const rootFolders = mapFolderRows(result.Data.Folders || [], null)

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

// 按需加载一层子文件夹结构
const loadSubFolders = async (folder, force = false) => {
  if (!folder?.fullPath || (!force && loadedTreeFolders.value.has(folder.id))) {
    return
  }

  try {
    const result = await fileManageApi.listObjects(folder.fullPath, isPrivateBucket.value)
    if (result.Code === 1 && result.Data && result.Data.Folders) {
      applyFolderChildren(folder.id, result.Data.Folders || [])
    }
  } catch (error) {
    console.error('加载子文件夹失败:', folder.fullPath, error)
  }
}

// 加载文件夹下的文件
const loadFolderFiles = async (folderId) => {
  if (!folderId) return

  // 回收站模式只加载软删除记录
  if (recycleMode.value) {
    fileLoading.value = true
    try {
      await loadTrashRecords(folderId, { setRows: true, mergeMap: true })
    } finally {
      fileLoading.value = false
    }
    return
  }

  // 如果已经加载过，刷新软删除标记后直接返回
  if (loadedFolders.value.has(folderId)) {
    await loadTrashRecords(folderId, { setRows: true, mergeMap: true })
    ensureThumbnails(currentItems.value)
    return
  }
  
  if (currentLoadingRequest) {
    currentLoadingRequest.cancelled = true
  }
  
  const requestId = { cancelled: false }
  currentLoadingRequest = requestId
  
  fileLoading.value = true
  
  try {
    await loadTrashRecords(folderId, { setRows: true, mergeMap: true })
    const result = await fileManageApi.listObjects(folderId, isPrivateBucket.value)
    
    if (requestId.cancelled) return
    
    if (result.Code === 1 && result.Data) {
      applyFolderChildren(folderId, result.Data.Folders || [])

      const fileList = (result.Data.Files || [])
        .filter(f => !isDeletedPath(f.FullPath, false))
        .map(f => ({
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
      clearItemsCache()
      ensureThumbnails(fileList)
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
  selectedFileIds.value = []
  
  // 构建面包屑（使用shallowRef需要替换整个对象）
  const path = findFolderPath(folder.id, folders.value)
  breadcrumb.value = Object.freeze(path || [{ id: folder.id, name: folder.name }])
  
  // 异步加载该文件夹下的文件（不阻塞UI）
  loadFolderFiles(folder.id)
}

const handleFolderExpand = (folder) => {
  loadSubFolders(folder)
}

const handleFileAreaAction = (action) => {
  switch (action) {
    case 'upload':
      openUploadPicker()
      break
    case 'create-folder':
      handleCreateFolder()
      break
    case 'refresh':
      refreshCurrentFolder()
      break
    case 'sync':
      syncDialogVisible.value = true
      break
    case 'toggle-trash':
      toggleTrashMode()
      break
    default:
      break
  }
}

const handleFolderContextAction = ({ action, folder }) => {
  if (folder && currentFolderId.value !== folder.id) {
    handleFolderSelect(folder)
  }
  handleFileAreaAction(action)
}

// 处理文件打开
const handleFileOpen = (file) => {
  if (recycleMode.value) {
    if (file.isFolder) {
      ElMessage.info('请先还原文件夹再打开')
      return
    }
    previewFile.value = file
    previewVisible.value = true
    return
  }

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

const handlePreviewToggle = (value) => {
  previewEnabled.value = value
  if (value) ensureThumbnails(currentItems.value)
}

const toggleTrashMode = async () => {
  recycleMode.value = !recycleMode.value
  selectedFileIds.value = []
  clearItemsCache()
  await loadFolderFiles(currentFolderId.value)
}

const openUploadPicker = () => {
  if (recycleMode.value) {
    ElMessage.warning('请先退出回收站再上传文件')
    return
  }
  fileInputRef.value?.click()
}

const handleUploadChange = async (event) => {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (files.length === 0) return

  const folderId = currentFolderId.value || rootPrefix.value
  if (!folderId) {
    ElMessage.warning('请先选择上传目录')
    return
  }

  uploadProgressVisible.value = true
  uploadProgress.value = 0
  uploadProgressText.value = `正在上传 ${files.length} 个文件...`

  try {
    const result = await fileManageApi.uploadFiles(
      files,
      stripRootPrefix(folderId),
      isPrivateBucket.value,
      (percent) => {
        uploadProgress.value = percent
      }
    )

    if (result.Code !== 1) {
      throw new Error(result.Msg || '上传失败')
    }

    const uploadedRows = Array.isArray(result.Data) ? result.Data : (result.Data ? [result.Data] : [])
    uploadProgressText.value = '正在整理文件到当前目录...'

    for (const row of uploadedRows) {
      const source = normalizeObjectPath(row.Path || row.FilePathName || row.FullPath || '')
      const name = row.Name || row.FileName || (source ? source.split('/').pop() : '')
      const target = joinObjectPath(folderId, name)
      if (source && target && source !== target) {
        await fileManageApi.moveObject(source, target, isPrivateBucket.value)
      }
    }

    uploadProgress.value = 100
    uploadProgressText.value = '上传完成'
    ElMessage.success(`已上传 ${files.length} 个文件`)
    await refreshCurrentFolder()
  } catch (error) {
    console.error('上传文件失败:', error)
    ElMessage.error(error.message || '上传文件失败')
  } finally {
    setTimeout(() => {
      uploadProgressVisible.value = false
    }, 500)
  }
}

const handleCreateFolder = () => {
  if (recycleMode.value) {
    ElMessage.warning('请先退出回收站再新建文件夹')
    return
  }

  ElMessageBox.prompt('请输入文件夹名称', '新建文件夹', {
    confirmButtonText: '创建',
    cancelButtonText: '取消',
    inputPattern: /^[^/\\:*?"<>|]+$/,
    inputErrorMessage: '名称不能为空且不能包含 / \\ : * ? " < > |'
  }).then(async ({ value }) => {
    const folderPath = normalizeFolderPath(joinObjectPath(currentFolderId.value || rootPrefix.value, value))
    const result = await fileManageApi.createFolder(folderPath, isPrivateBucket.value)
    if (result.Code === 1) {
      ElMessage.success('文件夹创建成功')
      await refreshCurrentFolder()
    } else {
      ElMessage.error(result.Msg || '文件夹创建失败')
    }
  }).catch(() => {})
}

const getSelectedItems = (ids = selectedFileIds.value) => {
  const idSet = new Set(ids)
  return currentItems.value.filter(item => idSet.has(item.id))
}

const removeDeletedFoldersFromTree = (items = []) => {
  const deletedFolders = new Set(
    items
      .filter(item => item.IsFolder === 1 || item.IsFolder === true || item.isFolder)
      .map(item => normalizeFolderPath(item.Path || getObjectPath(item)))
  )

  if (deletedFolders.size === 0) return

  const prune = (list = []) => list
    .filter(folder => !deletedFolders.has(normalizeFolderPath(folder.fullPath || folder.id)))
    .map(folder => ({
      ...folder,
      children: prune(folder.children || [])
    }))

  folders.value = prune(folders.value)
}

const toTrashPayload = (file) => {
  const objectPath = file.isFolder ? normalizeFolderPath(getObjectPath(file)) : getObjectPath(file)
  return {
    Path: objectPath,
    Name: file.name,
    BucketScope: getBucketScope(),
    Limit: isPrivateBucket.value,
    IsFolder: file.isFolder ? 1 : 0,
    FolderPath: file.folderId || getParentFolderPath(objectPath),
    Size: Number(file.size) || 0,
    FileType: file.isFolder ? 'folder' : (file.type || ''),
    OriginalLastModified: file.updateTime || file.createTime || ''
  }
}

const softDeleteItems = async (items = []) => {
  const payload = items.map(toTrashPayload).filter(item => item.Path)
  if (payload.length === 0) {
    ElMessage.warning('没有可删除的文件')
    return
  }

  const result = await fileManageApi.trashMark(payload, isPrivateBucket.value)
  if (result.Code === 1) {
    deletedPathMap.value = {
      ...(deletedPathMap.value || {}),
      ...buildDeletedPathMap(payload)
    }
    removeDeletedFoldersFromTree(payload)
    selectedFileIds.value = []
    clearItemsCache()
    ElMessage.success('已移入回收站')
    await refreshCurrentFolder()
  } else {
    ElMessage.error(result.Msg || '移入回收站失败')
  }
}

const restoreItems = async (items = []) => {
  const payload = items
    .map(file => ({
      Id: file.trashId || file.Id,
      Path: getObjectPath(file),
      BucketScope: getBucketScope(),
      Limit: isPrivateBucket.value
    }))
    .filter(item => item.Id || item.Path)

  if (payload.length === 0) {
    ElMessage.warning('没有可还原的文件')
    return
  }

  const result = await fileManageApi.trashRestore(payload, isPrivateBucket.value)
  if (result.Code === 1) {
    const nextMap = { ...(deletedPathMap.value || {}) }
    payload.forEach(item => {
      delete nextMap[normalizeObjectPath(item.Path)]
      delete nextMap[normalizeFolderPath(item.Path)]
    })
    deletedPathMap.value = nextMap
    selectedFileIds.value = []
    clearItemsCache()
    ElMessage.success('还原成功')
    await refreshCurrentFolder()
  } else {
    ElMessage.error(result.Msg || '还原失败')
  }
}

const moveItems = async (items = []) => {
  if (recycleMode.value) {
    ElMessage.warning('回收站文件请先还原后再移动')
    return
  }

  if (items.length === 0) {
    ElMessage.warning('请先选择要移动的文件')
    return
  }

  ElMessageBox.prompt('请输入目标目录（相对当前租户根目录，如 upload/img）', '移动到', {
    confirmButtonText: '移动',
    cancelButtonText: '取消',
    inputValue: stripRootPrefix(currentFolderId.value || rootPrefix.value),
    inputPattern: /^[^:*?"<>|]*$/,
    inputErrorMessage: '目录不能包含 : * ? " < > |'
  }).then(async ({ value }) => {
    const targetFolder = resolveTargetFolder(value)
    let successCount = 0

    for (const item of items) {
      const source = item.isFolder ? normalizeFolderPath(getObjectPath(item)) : getObjectPath(item)
      const sourceName = item.isFolder
        ? source.replace(/\/$/, '').split('/').pop()
        : item.name
      const target = item.isFolder
        ? normalizeFolderPath(joinObjectPath(targetFolder, sourceName))
        : joinObjectPath(targetFolder, item.name)

      if (!source || !target || source === target) continue
      const result = await fileManageApi.moveObject(source, target, isPrivateBucket.value)
      if (result.Code === 1) successCount++
    }

    ElMessage.success(`已移动 ${successCount} 项`)
    selectedFileIds.value = []
    await refreshCurrentFolder()
  }).catch(() => {})
}

const handleBatchDelete = (ids) => {
  const items = getSelectedItems(ids)
  if (items.length === 0) return

  ElMessageBox.confirm(
    `确定将选中的 ${items.length} 项移入回收站吗？源文件不会从 OSS/MinIO 物理删除。`,
    '移入回收站',
    {
      confirmButtonText: '移入回收站',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => softDeleteItems(items)).catch(() => {})
}

const handleBatchMove = (ids) => {
  moveItems(getSelectedItems(ids))
}

const handleBatchRestore = (ids) => {
  restoreItems(getSelectedItems(ids))
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
    case 'restore':
      restoreItems([file])
      break
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
      moveItems([file])
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
    `确定将${isFolder ? '文件夹' : '文件'} "${displayName}" 移入回收站吗？源文件不会从 OSS/MinIO 物理删除，可在回收站还原。`,
    '移入回收站',
    {
      confirmButtonText: '移入回收站',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger'
    }
  ).then(() => softDeleteItems([file])).catch(() => {})
}

// 刷新当前文件夹
const refreshCurrentFolder = async () => {
  const folderId = currentFolderId.value
  if (folderId) {
    // 清除该文件夹的缓存
    loadedFolders.value.delete(folderId)
    loadedTreeFolders.value.delete(folderId)
    clearItemsCache()
    // 重新加载
    await loadFolderFiles(folderId)
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
  background: var(--el-bg-color-page, #f1f5f9);
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
    padding: 16px;
    border-bottom: 1px solid var(--el-border-color-lighter, #e2e8f0);
    display: flex;
    justify-content: center;
    background: var(--mci-gradient-surface, linear-gradient(180deg, #ffffff 0%, #f7fafc 100%));
    flex-shrink: 0;
    
    .el-radio-group {
      width: 100%;
      display: flex;
      padding: 5px;
      border: 1px solid var(--el-border-color, #dbe5ef);
      border-radius: 8px;
      background: var(--el-fill-color-light, #eef3f7);
      box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.05), 0 8px 18px rgba(15, 23, 42, 0.05);
      
      .el-radio-button {
        flex: 1;
        
        :deep(.el-radio-button__inner) {
          width: 100%;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--el-text-color-regular, #526475);
          font-size: 15px;
          font-weight: 700;
          letter-spacing: 0;
          line-height: 1;
          box-shadow: none;
          transition: all 0.18s ease;
        }

        :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
          background: linear-gradient(135deg, #20b26b 0%, #15935c 100%);
          color: #fff;
          box-shadow: 0 8px 18px rgba(32, 178, 107, 0.28);
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
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
}

.hidden-file-input {
  display: none;
}

.upload-progress {
  display: grid;
  gap: 12px;
  color: #334155;
  font-size: 13px;
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
