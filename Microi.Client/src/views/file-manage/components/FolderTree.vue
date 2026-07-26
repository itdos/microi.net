<template>
  <div class="folder-tree" @contextmenu.prevent="handleTreeAreaContextMenu">
    <div class="tree-header">
      <div class="tree-title">
        <el-icon class="header-icon"><FolderOpened /></el-icon>
        <span>文件夹</span>
      </div>
      <el-tooltip content="新建文件夹" placement="top">
        <el-button class="header-action" circle text :icon="Plus" @click.stop="$emit('create-folder')" />
      </el-tooltip>
    </div>
    <el-scrollbar class="tree-scrollbar">
      <el-tree
        ref="treeRef"
        :data="folders"
        :props="defaultProps"
        node-key="id"
        :default-expanded-keys="expandedKeys"
        :current-node-key="currentFolderId"
        highlight-current
        :expand-on-click-node="false"
        :indent="32"
        :render-after-expand="true"
        @node-click="handleNodeClick"
        @node-expand="handleNodeExpand"
        @node-collapse="handleNodeCollapse"
        @node-contextmenu="handleNodeContextMenu"
      >
        <template #default="{ node }">
          <div class="custom-tree-node" @dblclick.stop="handleNodeDblClick(node)">
            <el-icon class="folder-icon" :class="{ 'is-expanded': node.expanded }">
              <FolderOpened v-if="node.expanded" />
              <Folder v-else />
            </el-icon>
            <span class="folder-name">{{ node.label }}</span>
          </div>
        </template>
      </el-tree>
    </el-scrollbar>

    <el-dropdown
      ref="contextMenuRef"
      trigger="contextmenu"
      :teleported="true"
      @command="handleContextCommand"
    >
      <span ref="contextMenuTriggerRef" class="context-menu-trigger"></span>
      <template #dropdown>
        <el-dropdown-menu class="folder-context-menu">
          <el-dropdown-item command="upload">
            <el-icon><Upload /></el-icon>
            <span>上传文件</span>
          </el-dropdown-item>
          <el-dropdown-item command="create-folder">
            <el-icon><Plus /></el-icon>
            <span>新建文件夹</span>
          </el-dropdown-item>
          <el-dropdown-item command="refresh">
            <el-icon><Refresh /></el-icon>
            <span>刷新目录</span>
          </el-dropdown-item>
          <el-dropdown-item divided command="sync">
            <el-icon><Connection /></el-icon>
            <span>文件同步</span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Connection, Folder, FolderOpened, Plus, Refresh, Upload } from '@element-plus/icons-vue'

const props = defineProps({
  folders: {
    type: Array,
    default: () => []
  },
  currentFolderId: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['select', 'create-folder', 'expand', 'context-action'])

const treeRef = ref(null)
const expandedKeys = ref([])
const contextMenuRef = ref(null)
const contextMenuTriggerRef = ref(null)
const contextFolder = ref(null)

const defaultProps = {
  children: 'children',
  label: 'name'
}

// 点击节点
const handleNodeClick = (data, node) => {
  emit('select', data, node)
}

// 双击节点 - 展开/收起
const handleNodeDblClick = (node) => {
  if (node.expanded) {
    node.collapse()
  } else {
    node.expand()
  }
}

// 处理节点展开
const handleNodeExpand = (data, node) => {
  if (!expandedKeys.value.includes(data.id)) {
    expandedKeys.value.push(data.id)
  }
  emit('expand', data, node)
}

// 处理节点收起
const handleNodeCollapse = (data, node) => {
  const index = expandedKeys.value.indexOf(data.id)
  if (index > -1) {
    expandedKeys.value.splice(index, 1)
  }
}

const openContextMenu = (event) => {
  nextTick(() => {
    if (!contextMenuTriggerRef.value) return
    contextMenuTriggerRef.value.style.position = 'fixed'
    contextMenuTriggerRef.value.style.left = event.clientX + 'px'
    contextMenuTriggerRef.value.style.top = event.clientY + 'px'
    contextMenuRef.value?.handleOpen()
  })
}

const handleNodeContextMenu = (event, data) => {
  contextFolder.value = data
  openContextMenu(event)
}

const handleTreeAreaContextMenu = (event) => {
  if (event.target?.closest?.('.el-tree-node')) return
  contextFolder.value = null
  openContextMenu(event)
}

const handleContextCommand = (action) => {
  emit('context-action', {
    action,
    folder: contextFolder.value
  })
}

// 监听当前文件夹变化，展开父节点
watch(
  () => props.currentFolderId,
  (newVal) => {
    if (newVal && treeRef.value) {
      nextTick(() => {
        treeRef.value.setCurrentKey(newVal)
        // 展开到当前节点的路径
        const node = treeRef.value.getNode(newVal)
        if (node) {
          let parent = node.parent
          while (parent) {
            if (parent.data && parent.data.id) {
              if (!expandedKeys.value.includes(parent.data.id)) {
                expandedKeys.value.push(parent.data.id)
              }
            }
            parent = parent.parent
          }
        }
      })
    }
  },
  { immediate: true }
)

// 初始化时展开第一层
watch(
  () => props.folders,
  (newVal) => {
    if (newVal && newVal.length > 0) {
      expandedKeys.value = newVal.map(item => item.id)
    }
  },
  { immediate: true }
)
</script>

<style lang="scss" scoped>
.folder-tree {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--mci-gradient-surface, linear-gradient(180deg, #f8fafc 0%, #ffffff 100%));

  .tree-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: var(--el-text-color-primary, #1e293b);
    border-bottom: 1px solid var(--el-border-color, #e2e8f0);
    background: var(--mci-gradient-surface, linear-gradient(90deg, #f1f5f9 0%, #ffffff 100%));

    .tree-title {
      display: flex;
      align-items: center;
      min-width: 0;

      .header-icon {
        margin-right: 10px;
        font-size: 20px;
        color: var(--el-color-primary, #3b82f6);
      }
    }

    .header-action {
      width: 30px;
      height: 30px;
      color: var(--el-text-color-regular, #475569);

      &:hover {
        color: var(--el-color-primary, #2563eb);
        background: var(--mci-bg-primary-soft, #e0ecff);
      }
    }
  }

  .tree-scrollbar {
    flex: 1;
    overflow: hidden;

    :deep(.el-scrollbar__wrap) {
      overflow-x: hidden;
    }
  }

  :deep(.el-tree) {
    padding: 12px 8px;
    background: transparent;
    --el-tree-node-hover-bg-color: var(--el-fill-color-light, #f1f5f9);

    .el-tree-node__content {
      height: 40px;
      border-radius: 8px;
      margin: 2px 4px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: var(--el-fill-color-light, #f1f5f9);
      }
    }

    .el-tree-node__expand-icon {
      color: var(--el-text-color-placeholder, #94a3b8);
      font-size: 13px;
      padding: 4px;
      
      &.is-leaf {
        color: transparent;
      }
      
      &:not(.is-leaf):hover {
        color: var(--el-color-primary, #3b82f6);
      }
    }

    .el-tree-node.is-current > .el-tree-node__content {
      background: var(--mci-bg-primary-soft, linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%));
      border: 1px solid var(--el-color-primary-light-7, #bfdbfe);

      .folder-icon {
        color: var(--el-color-primary, #3b82f6);
      }

      .folder-name {
        color: var(--el-color-primary, #1d4ed8);
        font-weight: 500;
      }
    }
  }

  .custom-tree-node {
    display: flex;
    align-items: center;
    flex: 1;
    overflow: hidden;
    padding: 0 4px;

    .folder-icon {
      font-size: 18px;
      color: #f59e0b;
      margin-right: 10px;
      flex-shrink: 0;
      transition: all 0.2s ease;

      &.is-expanded {
        color: #f59e0b;
      }
    }

    .folder-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
      color: var(--el-text-color-regular, #475569);
      transition: color 0.2s ease;
    }
  }

  .context-menu-trigger {
    position: fixed;
    width: 1px;
    height: 1px;
    visibility: hidden;
  }
}

.folder-context-menu {
  min-width: 160px;

  :deep(.el-dropdown-menu__item) {
    display: flex;
    align-items: center;
    gap: 10px;

    .el-icon {
      font-size: 15px;
    }
  }
}
</style>
