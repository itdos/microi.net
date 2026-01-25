<template>
  <div class="file-list" v-loading="loading" element-loading-text="加载中...">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item v-for="(item, index) in breadcrumb" :key="item.id">
            <span
              class="breadcrumb-item"
              :class="{ 'is-link': index < breadcrumb.length - 1 }"
              @click="index < breadcrumb.length - 1 && $emit('navigate', item)"
            >
              {{ item.name }}
            </span>
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="toolbar-right">
        <!-- 搜索 -->
        <div class="search-box">
          <el-input
            v-model="searchKeyword"
            placeholder="搜索文件"
            clearable
            :prefix-icon="Search"
          />
        </div>
        
        <!-- 分隔线 -->
        <div class="toolbar-divider"></div>
        
        <!-- 视图切换 -->
        <div class="view-switch">
          <el-tooltip content="网格视图" placement="top">
            <div 
              class="switch-btn" 
              :class="{ active: viewMode === 'grid' }"
              @click="viewMode = 'grid'"
            >
              <el-icon><Grid /></el-icon>
            </div>
          </el-tooltip>
          <el-tooltip content="列表视图" placement="top">
            <div 
              class="switch-btn" 
              :class="{ active: viewMode === 'list' }"
              @click="viewMode = 'list'"
            >
              <el-icon><List /></el-icon>
            </div>
          </el-tooltip>
        </div>
        
        <!-- 图标大小调整（仅网格模式） -->
        <template v-if="viewMode === 'grid'">
          <div class="toolbar-divider"></div>
          <div class="size-control">
            <el-icon class="size-icon" :size="14"><Minus /></el-icon>
            <el-slider
              v-model="iconSize"
              :min="60"
              :max="150"
              :step="10"
              :show-tooltip="false"
            />
            <el-icon class="size-icon" :size="14"><Plus /></el-icon>
          </div>
        </template>
        
        <!-- 分隔线 -->
        <div class="toolbar-divider"></div>
        
        <!-- 排序 -->
        <el-dropdown trigger="click" @command="handleSort">
          <div class="sort-btn">
            <el-icon><Sort /></el-icon>
            <span>{{ sortOptions[sortBy] }}</span>
            <el-icon class="arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="(label, key) in sortOptions"
                :key="key"
                :command="key"
                :class="{ 'is-active': sortBy === key }"
              >
                <span>{{ label }}</span>
                <el-icon v-if="sortBy === key" class="sort-direction">
                  <ArrowUp v-if="sortOrder === 'asc'" />
                  <ArrowDown v-else />
                </el-icon>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 文件列表内容 -->
    <el-scrollbar ref="scrollbarRef" class="file-content" @scroll="handleScroll">
      <!-- 网格视图 -->
      <div v-if="viewMode === 'grid'" class="grid-view" ref="gridViewRef">
        <div
          v-for="file in displayFiles"
          :key="file.id"
          class="file-item"
          :class="{ 
            'is-selected': selectedFiles.includes(file.id),
            'is-folder': file.isFolder
          }"
          :style="{ width: iconSize + 40 + 'px' }"
          @click="handleSelect(file, $event)"
          @dblclick="handleOpen(file)"
          @contextmenu.prevent="handleContextMenu(file, $event)"
        >
          <template v-if="file.isFolder">
            <el-icon class="folder-icon-large" :size="iconSize">
              <Folder />
            </el-icon>
          </template>
          <template v-else>
            <FileIcon :type="file.type" :size="iconSize" />
          </template>
          <div class="file-name" :title="file.name">
            {{ file.name }}
          </div>
        </div>
        
        <!-- 加载更多提示 -->
        <div v-if="hasMore" class="load-more-tip" @click="loadMore">
          <el-icon v-if="loadingMore" class="is-loading"><Loading /></el-icon>
          <template v-else>
            <el-button type="primary" link>
              <el-icon><ArrowDown /></el-icon>
              <span>点击加载更多</span>
            </el-button>
            <span class="load-more-hint">（已加载 {{ displayFiles.length }} / {{ filteredFiles.length }}）</span>
          </template>
        </div>
        
        <div v-if="displayFiles.length === 0 && !loading" class="empty-tip">
          <el-icon :size="60"><FolderOpened /></el-icon>
          <p>{{ searchKeyword ? '没有找到匹配的文件' : '此文件夹为空' }}</p>
        </div>
      </div>

      <!-- 列表视图 -->
      <div v-else class="list-view">
        <el-table
          :data="displayFiles"
          style="width: 100%"
          @row-click="handleRowClick"
          @row-dblclick="handleOpen"
          highlight-current-row
          :row-class-name="getRowClassName"
          @row-contextmenu="handleRowContextMenu"
        >
          <el-table-column width="50">
            <template #default="{ row }">
              <el-checkbox
                :model-value="selectedFiles.includes(row.id)"
                @change="handleCheckboxChange(row, $event)"
                @click.stop
              />
            </template>
          </el-table-column>
          <el-table-column label="名称" min-width="300" sortable prop="name">
            <template #default="{ row }">
              <div class="file-name-cell">
                <template v-if="row.isFolder">
                  <el-icon :size="32" class="folder-icon-list">
                    <Folder />
                  </el-icon>
                </template>
                <template v-else>
                  <FileIcon :type="row.type" :size="32" :show-extension="false" />
                </template>
                <span class="name-text" :class="{ 'is-folder': row.isFolder }">{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="120" sortable prop="size">
            <template #default="{ row }">
              {{ row.isFolder ? '-' : formatFileSize(row.size) }}
            </template>
          </el-table-column>
          <el-table-column label="类型" width="100" sortable prop="type">
            <template #default="{ row }">
              {{ row.isFolder ? '文件夹' : getFileTypeName(row.type) }}
            </template>
          </el-table-column>
          <el-table-column label="创建时间" width="180" sortable prop="createTime" />
          <el-table-column label="修改时间" width="180" sortable prop="updateTime" />
        </el-table>
        
        <!-- 加载更多提示 -->
        <div v-if="hasMore" class="load-more-tip" @click="loadMore">
          <el-icon v-if="loadingMore" class="is-loading"><Loading /></el-icon>
          <template v-else>
            <el-button type="primary" link>
              <el-icon><ArrowDown /></el-icon>
              <span>点击加载更多</span>
            </el-button>
            <span class="load-more-hint">（已加载 {{ displayFiles.length }} / {{ filteredFiles.length }}）</span>
          </template>
        </div>
        
        <div v-if="displayFiles.length === 0 && !loading" class="empty-tip">
          <el-icon :size="60"><FolderOpened /></el-icon>
          <p>{{ searchKeyword ? '没有找到匹配的文件' : '此文件夹为空' }}</p>
        </div>
      </div>
    </el-scrollbar>

    <!-- 状态栏 -->
    <div class="status-bar">
      <span>共 {{ filteredFiles.length }} 个项目</span>
      <span v-if="hasMore">，已加载 {{ displayFiles.length }} 个</span>
      <span v-if="selectedFiles.length > 0" class="selected-info">
        已选中 {{ selectedFiles.length }} 个项目
      </span>
    </div>

    <!-- 列表视图右键菜单 -->
    <el-dropdown
      ref="listContextMenuRef"
      trigger="contextmenu"
      :teleported="true"
      @command="handleListContextMenuCommand"
    >
      <span class="context-menu-trigger" ref="listContextMenuTriggerRef"></span>
      <template #dropdown>
        <el-dropdown-menu class="file-context-menu">
          <el-dropdown-item command="open">
            <el-icon><FolderOpened /></el-icon>
            <span>打开</span>
          </el-dropdown-item>
          <el-dropdown-item command="preview">
            <el-icon><View /></el-icon>
            <span>预览</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="download">
            <el-icon><Download /></el-icon>
            <span>下载</span>
          </el-dropdown-item>
          <el-dropdown-item command="share">
            <el-icon><Share /></el-icon>
            <span>分享</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="rename">
            <el-icon><Edit /></el-icon>
            <span>重命名</span>
          </el-dropdown-item>
          <el-dropdown-item command="copy">
            <el-icon><CopyDocument /></el-icon>
            <span>复制</span>
          </el-dropdown-item>
          <el-dropdown-item command="cut">
            <el-icon><DocumentRemove /></el-icon>
            <span>剪切</span>
          </el-dropdown-item>
          <el-dropdown-item command="move">
            <el-icon><Rank /></el-icon>
            <span>移动到...</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="delete">
            <el-icon color="#f56c6c"><Delete /></el-icon>
            <span style="color: #f56c6c;">删除</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="properties">
            <el-icon><InfoFilled /></el-icon>
            <span>属性</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
    
    <!-- 共享的右键菜单 -->
    <el-dropdown
      ref="contextMenuRef"
      trigger="contextmenu"
      :teleported="true"
      @command="handleContextMenuCommand"
    >
      <span class="context-menu-trigger" ref="contextMenuTriggerRef"></span>
      <template #dropdown>
        <el-dropdown-menu class="file-context-menu">
          <el-dropdown-item command="open">
            <el-icon><FolderOpened /></el-icon>
            <span>打开</span>
          </el-dropdown-item>
          <el-dropdown-item command="preview">
            <el-icon><View /></el-icon>
            <span>预览</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="download">
            <el-icon><Download /></el-icon>
            <span>下载</span>
          </el-dropdown-item>
          <el-dropdown-item command="share">
            <el-icon><Share /></el-icon>
            <span>分享</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="rename">
            <el-icon><Edit /></el-icon>
            <span>重命名</span>
          </el-dropdown-item>
          <el-dropdown-item command="copy">
            <el-icon><CopyDocument /></el-icon>
            <span>复制</span>
          </el-dropdown-item>
          <el-dropdown-item command="cut">
            <el-icon><DocumentRemove /></el-icon>
            <span>剪切</span>
          </el-dropdown-item>
          <el-dropdown-item command="move">
            <el-icon><Rank /></el-icon>
            <span>移动到...</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="delete">
            <el-icon color="#f56c6c"><Delete /></el-icon>
            <span style="color: #f56c6c;">删除</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="properties">
            <el-icon><InfoFilled /></el-icon>
            <span>属性</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import {
  Search,
  Grid,
  List,
  Minus,
  Plus,
  Sort,
  ArrowDown,
  ArrowUp,
  FolderOpened,
  Folder,
  Loading,
  View,
  Download,
  Share,
  Edit,
  CopyDocument,
  Rank,
  Delete,
  InfoFilled,
  DocumentRemove
} from '@element-plus/icons-vue'
import FileIcon from './FileIcon.vue'

const props = defineProps({
  files: {
    type: Array,
    default: () => []
  },
  breadcrumb: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['open', 'contextmenu', 'navigate', 'select'])

// 视图模式：grid / list
const viewMode = ref('grid')
// 图标大小
const iconSize = ref(80)
// 搜索关键词
const searchKeyword = ref('')
// 选中的文件
const selectedFiles = ref([])
// 排序字段
const sortBy = ref('name')
// 排序顺序
const sortOrder = ref('asc')

// 分页相关 - 网格视图初始加载40条，列表视图20条
const gridPageSize = 40
const listPageSize = 20
const initialLoadSize = ref(20) // 初始加载数量改为20，减少首次渲染压力
const loadingMore = ref(false)

// 当前显示的最大数量
const maxDisplayCount = ref(20)

// 滚动容器
const scrollbarRef = ref(null)
const gridViewRef = ref(null)

// 共享的右键菜单
const contextMenuRef = ref(null)
const contextMenuTriggerRef = ref(null)
const contextMenuFile = ref(null)

// 列表视图右键菜单
const listContextMenuRef = ref(null)
const listContextMenuTriggerRef = ref(null)
const listContextMenuFile = ref(null)

const sortOptions = {
  name: '名称',
  size: '大小',
  type: '类型',
  createTime: '创建时间',
  updateTime: '修改时间'
}

// 文件类型名称映射
const fileTypeNameMap = {
  docx: 'Word',
  doc: 'Word',
  xlsx: 'Excel',
  xls: 'Excel',
  pdf: 'PDF',
  txt: '文本',
  md: 'MD',
  pptx: 'PPT',
  ppt: 'PPT',
  jpg: '图片',
  jpeg: '图片',
  png: '图片',
  gif: '图片',
  bmp: '图片',
  svg: '图片',
  webp: '图片',
  psd: 'PSD',
  mp4: '视频',
  avi: '视频',
  mov: '视频',
  mkv: '视频',
  mp3: '音频',
  wav: '音频',
  flac: '音频',
  zip: '压缩包',
  rar: '压缩包',
  '7z': '压缩包',
  exe: '程序',
  iso: '镜像',
  rp: '原型'
}

// 获取文件类型名称
const getFileTypeName = (type) => {
  return fileTypeNameMap[type?.toLowerCase()] || type?.toUpperCase()
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 过滤和排序后的文件列表（优化：使用缓存避免重复计算）
let cachedFilterKey = ''
let cachedFilteredFiles = []

const filteredFiles = computed(() => {
  const files = props.files
  const keyword = searchKeyword.value
  const sort = sortBy.value
  const order = sortOrder.value
  
  // 生成缓存键
  const cacheKey = `${files.length}_${keyword}_${sort}_${order}`
  
  // 如果缓存键相同，返回缓存结果
  if (cacheKey === cachedFilterKey && cachedFilteredFiles.length > 0) {
    return cachedFilteredFiles
  }
  
  let result = files.slice() // 使用slice而不是扩展运算符，性能更好
  
  // 搜索过滤
  if (keyword) {
    const lowerKeyword = keyword.toLowerCase()
    result = result.filter(file => 
      file.name.toLowerCase().includes(lowerKeyword)
    )
  }
  
  // 排序
  result.sort((a, b) => {
    let valueA = a[sort]
    let valueB = b[sort]
    
    if (sort === 'name') {
      valueA = valueA?.toLowerCase() || ''
      valueB = valueB?.toLowerCase() || ''
    }
    
    let comparison = 0
    if (valueA < valueB) comparison = -1
    if (valueA > valueB) comparison = 1
    
    return order === 'asc' ? comparison : -comparison
  })
  
  // 更新缓存
  cachedFilterKey = cacheKey
  cachedFilteredFiles = result
  
  return result
})

// 是否还有更多数据
const hasMore = computed(() => {
  return maxDisplayCount.value < filteredFiles.value.length
})

// 当前显示的文件（分页 + 虚拟化）
const displayFiles = computed(() => {
  const count = Math.min(maxDisplayCount.value, filteredFiles.value.length)
  return filteredFiles.value.slice(0, count)
})

// 加载更多
const loadMore = () => {
  if (loadingMore.value || !hasMore.value) return
  
  loadingMore.value = true
  
  // 模拟加载延迟
  setTimeout(() => {
    const increment = viewMode.value === 'grid' ? gridPageSize : listPageSize
    maxDisplayCount.value += increment
    loadingMore.value = false
  }, 300)
}

// 记录上一次的文件数组长度，避免重复重置
let lastFilesLength = 0

// 监听文件变化，重置显示数量（优化：只在文件数量变化时重置）
watch(() => props.files, (newFiles, oldFiles) => {
  const newLength = newFiles?.length || 0
  
  // 只有在文件数量变化时才重置
  if (newLength !== lastFilesLength) {
    lastFilesLength = newLength
    maxDisplayCount.value = initialLoadSize.value
    selectedFiles.value = []
    
    // 使用requestAnimationFrame优化滚动性能
    requestAnimationFrame(() => {
      if (scrollbarRef.value) {
        scrollbarRef.value.setScrollTop(0)
      }
    })
  }
}, { deep: false }) // 使用浅层监听提升性能

// 监听视图模式变化
watch(viewMode, () => {
  maxDisplayCount.value = viewMode.value === 'grid' ? gridPageSize : listPageSize
})

// 处理排序
const handleSort = (key) => {
  if (sortBy.value === key) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = key
    sortOrder.value = 'asc'
  }
}

// 处理选中
const handleSelect = (file, event) => {
  if (event.ctrlKey || event.metaKey) {
    const index = selectedFiles.value.indexOf(file.id)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    } else {
      selectedFiles.value.push(file.id)
    }
  } else {
    selectedFiles.value = [file.id]
  }
  emit('select', selectedFiles.value)
}

// 处理表格行点击
const handleRowClick = (row, column, event) => {
  handleSelect(row, event)
}

// 处理复选框变化
const handleCheckboxChange = (file, checked) => {
  if (checked) {
    if (!selectedFiles.value.includes(file.id)) {
      selectedFiles.value.push(file.id)
    }
  } else {
    const index = selectedFiles.value.indexOf(file.id)
    if (index > -1) {
      selectedFiles.value.splice(index, 1)
    }
  }
  emit('select', selectedFiles.value)
}

// 获取行的类名
const getRowClassName = ({ row }) => {
  return selectedFiles.value.includes(row.id) ? 'is-selected' : ''
}

// 处理网格视图的右键菜单
const handleContextMenu = (file, event) => {
  // 如果右键的文件未被选中，则只选中它
  if (!selectedFiles.value.includes(file.id)) {
    selectedFiles.value = [file.id]
  }
  contextMenuFile.value = file
  
  nextTick(() => {
    if (contextMenuTriggerRef.value) {
      contextMenuTriggerRef.value.style.position = 'fixed'
      contextMenuTriggerRef.value.style.left = event.clientX + 'px'
      contextMenuTriggerRef.value.style.top = event.clientY + 'px'
      contextMenuRef.value?.handleOpen()
    }
  })
}

// 处理右键菜单命令
const handleContextMenuCommand = (command) => {
  if (contextMenuFile.value) {
    emit('contextmenu', { action: command, file: contextMenuFile.value })
  }
}

// 处理打开
const handleOpen = (file) => {
  emit('open', file)
}

// // 网格视图右键菜单命令
// const handleContextMenuCommand = (command, file) => {
//   emit('contextmenu', { action: command, file })
// }

// 列表视图右键菜单
const handleRowContextMenu = (row, column, event) => {
  event.preventDefault()
  if (!selectedFiles.value.includes(row.id)) {
    selectedFiles.value = [row.id]
  }
  listContextMenuFile.value = row
  
  nextTick(() => {
    if (listContextMenuTriggerRef.value) {
      listContextMenuTriggerRef.value.style.position = 'fixed'
      listContextMenuTriggerRef.value.style.left = event.clientX + 'px'
      listContextMenuTriggerRef.value.style.top = event.clientY + 'px'
      listContextMenuRef.value?.handleOpen()
    }
  })
}

// 列表视图右键菜单命令
const handleListContextMenuCommand = (command) => {
  if (listContextMenuFile.value) {
    emit('contextmenu', { action: command, file: listContextMenuFile.value })
  }
}

// 处理滚动加载更多
const handleScroll = ({ scrollTop, scrollLeft }) => {
  if (loadingMore.value || !hasMore.value) return
  
  const scrollbar = scrollbarRef.value
  if (!scrollbar) return
  
  const wrapRef = scrollbar.wrapRef
  if (!wrapRef) return
  
  const scrollHeight = wrapRef.scrollHeight
  const clientHeight = wrapRef.clientHeight
  
  // 距离底部100px时加载更多
  if (scrollHeight - scrollTop - clientHeight < 100) {
    loadMore()
  }
}

// 监听文件变化，重置状态（已在上面的watch中处理，删除此重复watch避免冲突）

// 监听搜索变化，重置显示数量（添加防抖）
let searchTimer = null
watch(searchKeyword, () => {
  if (searchTimer) clearTimeout(searchTimer)
  
  searchTimer = setTimeout(() => {
    maxDisplayCount.value = initialLoadSize.value
    requestAnimationFrame(() => {
      if (scrollbarRef.value) {
        scrollbarRef.value.setScrollTop(0)
      }
    })
  }, 300)
})

// 组件卸载时清理缓存，避免内存泄露
onUnmounted(() => {
  // 清理定时器
  if (searchTimer) clearTimeout(searchTimer)
  
  // 清理缓存
  cachedFilterKey = ''
  cachedFilteredFiles = []
  lastFilesLength = 0
  selectedFiles.value = []
  contextMenuFile.value = null
  listContextMenuFile.value = null
})
</script>

<style lang="scss" scoped>
.file-list {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    gap: 16px;

    .toolbar-left {
      flex-shrink: 0;
      
      :deep(.el-breadcrumb) {
        .el-breadcrumb__item {
          .el-breadcrumb__inner {
            .breadcrumb-item {
              color: #64748b;
              font-weight: 500;
              
              &.is-link {
                color: #3b82f6;
                cursor: pointer;
                
                &:hover {
                  text-decoration: underline;
                }
              }
            }
          }
        }
      }
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 12px;

      .search-box {
        :deep(.el-input) {
          width: 200px;
          
          .el-input__wrapper {
            border-radius: 8px;
            background: #f1f5f9;
            box-shadow: none;
            
            &:hover, &:focus-within {
              background: #fff;
              box-shadow: 0 0 0 1px #3b82f6;
            }
          }
        }
      }

      .toolbar-divider {
        width: 1px;
        height: 20px;
        background: #e2e8f0;
      }

      .view-switch {
        display: flex;
        background: #f1f5f9;
        border-radius: 8px;
        padding: 2px;

        .switch-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 28px;
          border-radius: 6px;
          cursor: pointer;
          color: #64748b;
          transition: all 0.2s;

          &:hover {
            color: #3b82f6;
          }

          &.active {
            background: #fff;
            color: #3b82f6;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
        }
      }

      .size-control {
        display: flex;
        align-items: center;
        gap: 8px;

        .size-icon {
          color: #94a3b8;
        }

        :deep(.el-slider) {
          width: 80px;
          
          .el-slider__runway {
            margin: 0;
            height: 4px;
            background: #e2e8f0;
          }
          
          .el-slider__bar {
            height: 4px;
            background: #3b82f6;
          }
          
          .el-slider__button-wrapper {
            top: -14px;
          }
          
          .el-slider__button {
            width: 14px;
            height: 14px;
            border: 2px solid #3b82f6;
          }
        }
      }

      .sort-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 8px;
        cursor: pointer;
        color: #475569;
        background: #f1f5f9;
        font-size: 13px;
        transition: all 0.2s;

        &:hover {
          background: #e2e8f0;
        }

        .arrow {
          font-size: 12px;
          color: #94a3b8;
        }
      }
    }
  }

  .file-content {
    flex: 1;
    overflow: hidden;

    .grid-view {
      display: flex;
      flex-wrap: wrap;
      padding: 20px;
      gap: 12px;
      min-height: 100%;
      align-content: flex-start;

      .file-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px 8px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: 2px solid transparent;

        &:hover {
          background: #f8fafc;
          border-color: #e2e8f0;
        }

        &.is-selected {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border-color: #3b82f6;
        }
        
        &.is-folder {
          .folder-icon-large {
            color: #f59e0b;
          }
          
          .file-name {
            font-weight: 500;
          }
        }

        .file-name {
          width: 100%;
          text-align: center;
          font-size: 12px;
          color: #334155;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          word-break: break-all;
          line-height: 1.4;
          margin-top: 8px;
        }
      }

      .load-more-tip {
        width: 100%;
        text-align: center;
        padding: 24px 20px;
        color: #94a3b8;
        font-size: 13px;
        cursor: pointer;
        transition: background-color 0.2s;
        border-radius: 12px;
        margin-top: 8px;
        
        &:hover {
          background-color: #f8fafc;
        }
        
        .is-loading {
          animation: rotate 1s linear infinite;
          font-size: 20px;
          color: #3b82f6;
        }
        
        .load-more-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #94a3b8;
        }
      }

      .empty-tip {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 0;
        color: #94a3b8;

        p {
          margin-top: 16px;
          font-size: 14px;
        }
      }
    }

    .list-view {
      padding: 16px;

      :deep(.el-table) {
        --el-table-border-color: #e2e8f0;
        --el-table-header-bg-color: #f8fafc;
        
        .el-table__header th {
          font-weight: 600;
          color: #475569;
        }
        
        .el-table__row {
          cursor: pointer;

          &.is-selected {
            td {
              background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%) !important;
            }
          }
          
          &:hover td {
            background: #f8fafc !important;
          }
        }
      }

      .file-name-cell {
        display: flex;
        align-items: center;
        gap: 12px;

        .folder-icon-list {
          color: #f59e0b;
        }

        .name-text {
          color: #1e293b;
          
          &.is-folder {
            font-weight: 500;
          }
        }
      }

      .load-more-tip {
        text-align: center;
        padding: 20px;
        color: #94a3b8;
        font-size: 13px;
        cursor: pointer;
        transition: background-color 0.2s;
        border-radius: 8px;
        margin: 12px 0;
        
        &:hover {
          background-color: #f1f5f9;
        }
        
        .is-loading {
          animation: rotate 1s linear infinite;
          font-size: 20px;
          color: #3b82f6;
        }
        
        .load-more-hint {
          display: block;
          margin-top: 6px;
          font-size: 12px;
          color: #94a3b8;
        }
      }

      .empty-tip {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 0;
        color: #94a3b8;

        p {
          margin-top: 16px;
          font-size: 14px;
        }
      }
    }
  }

  .status-bar {
    display: flex;
    align-items: center;
    padding: 10px 20px;
    border-top: 1px solid #e2e8f0;
    background: #f8fafc;
    font-size: 12px;
    color: #64748b;

    .selected-info {
      margin-left: auto;
      color: #3b82f6;
      font-weight: 500;
    }
  }

  .context-menu-trigger {
    position: fixed;
    width: 1px;
    height: 1px;
    visibility: hidden;
  }
}

.file-context-menu {
  min-width: 180px;
  
  :deep(.el-dropdown-menu__item) {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 16px;
    
    .el-icon {
      font-size: 16px;
    }
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
