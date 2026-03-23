<template>
  <div class="folder-tree">
    <div class="tree-header">
      <el-icon class="header-icon"><FolderOpened /></el-icon>
      <span>文件夹</span>
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
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { Folder, FolderOpened } from '@element-plus/icons-vue'

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

const emit = defineEmits(['select'])

const treeRef = ref(null)
const expandedKeys = ref([])

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
}

// 处理节点收起
const handleNodeCollapse = (data, node) => {
  const index = expandedKeys.value.indexOf(data.id)
  if (index > -1) {
    expandedKeys.value.splice(index, 1)
  }
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
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);

  .tree-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    font-size: 15px;
    font-weight: 600;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    background: linear-gradient(90deg, #f1f5f9 0%, #ffffff 100%);

    .header-icon {
      margin-right: 10px;
      font-size: 20px;
      color: #3b82f6;
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
    --el-tree-node-hover-bg-color: #f1f5f9;

    .el-tree-node__content {
      height: 40px;
      border-radius: 8px;
      margin: 2px 4px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: #f1f5f9;
      }
    }

    .el-tree-node__expand-icon {
      color: #94a3b8;
      font-size: 14px;
      padding: 4px;
      
      &.is-leaf {
        color: transparent;
      }
      
      &:not(.is-leaf):hover {
        color: #3b82f6;
      }
    }

    .el-tree-node.is-current > .el-tree-node__content {
      background: linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #bfdbfe;

      .folder-icon {
        color: #3b82f6;
      }

      .folder-name {
        color: #1d4ed8;
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
      font-size: 14px;
      color: #475569;
      transition: color 0.2s ease;
    }
  }
}
</style>
