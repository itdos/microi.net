<template>
  <el-dialog
    :model-value="modelValue"
    title="文件同步"
    width="min(1280px, calc(100vw - 48px))"
    class="mci-file-sync-dialog"
    align-center
    draggable
    append-to-body
    :close-on-click-modal="!syncing"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="sync-shell">
      <el-tabs v-model="activeTab" class="sync-tabs">
        <el-tab-pane label="同步配置" name="sync">
          <div class="sync-config-grid">
            <section class="platform-panel">
              <div class="panel-head">
                <div>
                  <strong>源文件系统</strong>
                  <span>{{ platformSummary(form.source) }}</span>
                </div>
                <el-button :icon="Refresh" :loading="loadingSource" @click="loadSourceTree">
                  加载源树
                </el-button>
              </div>
              <el-radio-group v-model="form.source.platformType" class="platform-toggle">
                <el-radio-button label="current">当前平台</el-radio-button>
                <el-radio-button label="remote">远程平台</el-radio-button>
              </el-radio-group>
              <div v-if="form.source.platformType === 'remote'" class="credential-grid">
                <el-input v-model="form.source.apiBase" placeholder="ApiBase" />
                <el-input v-model="form.source.osClient" placeholder="OsClient" />
                <el-input v-model="form.source.account" placeholder="帐号" />
                <el-input v-model="form.source.password" placeholder="密码" type="password" show-password />
              </div>
              <div class="path-grid">
                <el-select v-model="form.source.limit" placeholder="源桶">
                  <el-option label="私有桶" :value="true" />
                  <el-option label="公有桶" :value="false" />
                </el-select>
                <el-input v-model="form.source.path" placeholder="源起点目录，如 itdos/upload/" />
              </div>
            </section>

            <div class="sync-direction">
              <el-icon><ArrowRight /></el-icon>
            </div>

            <section class="platform-panel">
              <div class="panel-head">
                <div>
                  <strong>目标文件系统</strong>
                  <span>{{ platformSummary(form.target) }}</span>
                </div>
                <el-button :icon="Refresh" :loading="loadingTarget" @click="loadTargetTree">
                  加载目标树
                </el-button>
              </div>
              <el-radio-group v-model="form.target.platformType" class="platform-toggle">
                <el-radio-button label="current">当前平台</el-radio-button>
                <el-radio-button label="remote">远程平台</el-radio-button>
              </el-radio-group>
              <div v-if="form.target.platformType === 'remote'" class="credential-grid">
                <el-input v-model="form.target.apiBase" placeholder="ApiBase" />
                <el-input v-model="form.target.osClient" placeholder="OsClient" />
                <el-input v-model="form.target.account" placeholder="帐号" />
                <el-input v-model="form.target.password" placeholder="密码" type="password" show-password />
              </div>
              <div class="path-grid">
                <el-select v-model="form.target.limit" placeholder="目标桶">
                  <el-option label="私有桶" :value="true" />
                  <el-option label="公有桶" :value="false" />
                </el-select>
                <el-input v-model="form.target.path" placeholder="目标落点目录，如 itdos/upload/" />
              </div>
            </section>
          </div>

          <div class="sync-rule-bar">
            <el-radio-group v-model="form.rule" class="rule-toggle">
              <el-radio-button label="ignore">重名忽略</el-radio-button>
              <el-radio-button label="overwrite">文件重名覆盖</el-radio-button>
            </el-radio-group>
            <div class="target-path">
              <span>目标位置</span>
              <strong>{{ selectedTargetPath || normalizeFolder(form.target.path) || '根目录' }}</strong>
            </div>
            <el-button
              type="primary"
              :icon="Switch"
              :loading="syncing"
              :disabled="!canStartSync"
              @click="startSync"
            >
              开始同步
            </el-button>
          </div>

          <div class="tree-grid">
            <section class="tree-panel">
              <div class="tree-panel-head">
                <div>
                  <strong>源文件树</strong>
                  <span>已选 {{ checkedSourceRows.length }} 项</span>
                </div>
              </div>
              <el-scrollbar v-loading="loadingSource" class="tree-body">
                <el-empty v-if="sourceTree.length === 0 && !loadingSource" description="未加载源文件树" />
                <el-tree
                  v-else
                  ref="sourceTreeRef"
                  :data="sourceTree"
                  :props="treeProps"
                  node-key="id"
                  show-checkbox
                  check-strictly
                  default-expand-all
                  :expand-on-click-node="false"
                  @check="handleSourceCheck"
                >
                  <template #default="{ data }">
                    <div class="tree-node" :class="{ 'is-file': !data.isFolder }">
                      <el-icon>
                        <FolderOpened v-if="data.isFolder" />
                        <Document v-else />
                      </el-icon>
                      <span class="node-name" :title="data.filePath">{{ data.name }}</span>
                      <span class="node-meta">{{ data.isFolder ? '文件夹' : formatFileSize(data.size) }}</span>
                    </div>
                  </template>
                </el-tree>
              </el-scrollbar>
            </section>

            <section class="tree-panel target-tree">
              <div class="tree-panel-head">
                <div>
                  <strong>目标文件系统树</strong>
                  <span>选择同步落点</span>
                </div>
              </div>
              <el-scrollbar v-loading="loadingTarget" class="tree-body">
                <el-empty v-if="targetTree.length === 0 && !loadingTarget" description="未加载目标文件树" />
                <el-tree
                  v-else
                  ref="targetTreeRef"
                  :data="targetTree"
                  :props="treeProps"
                  node-key="id"
                  :current-node-key="selectedTargetNodeKey"
                  highlight-current
                  default-expand-all
                  :expand-on-click-node="false"
                  @node-click="handleTargetNodeClick"
                >
                  <template #default="{ data }">
                    <div class="tree-node" :class="{ 'is-file': !data.isFolder }">
                      <el-icon>
                        <FolderOpened v-if="data.isFolder" />
                        <Document v-else />
                      </el-icon>
                      <span class="node-name" :title="data.filePath">{{ data.name }}</span>
                      <span class="node-meta">{{ data.isFolder ? '目录' : formatFileSize(data.size) }}</span>
                    </div>
                  </template>
                </el-tree>
              </el-scrollbar>
            </section>
          </div>

          <div v-if="task.progressVisible" class="sync-progress">
            <div class="progress-head">
              <div>
                <strong>{{ task.statusText }}</strong>
                <span>{{ task.successCount }} 成功 / {{ task.failCount }} 失败 / {{ task.totalCount }} 总数</span>
              </div>
              <el-tag :type="task.failCount > 0 && task.progress === 100 ? 'danger' : 'success'">
                {{ task.progress }}%
              </el-tag>
            </div>
            <el-progress :percentage="task.progress" :status="task.failCount > 0 && task.progress === 100 ? 'exception' : undefined" />
          </div>

          <el-table v-if="results.length" class="result-table" :data="results" height="180">
            <el-table-column prop="name" label="名称" min-width="220" show-overflow-tooltip />
            <el-table-column prop="targetPath" label="目标路径" min-width="260" show-overflow-tooltip />
            <el-table-column prop="status" label="结果" width="96">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.status)">
                  {{ resultLabel(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="message" label="说明" min-width="220" show-overflow-tooltip />
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="同步记录" name="logs">
          <div class="log-toolbar">
            <div>
              <strong>同步任务记录</strong>
              <span>来源于 mci_file_sync_task</span>
            </div>
            <el-button :icon="Refresh" :loading="logsLoading" @click="loadSyncLogs">
              刷新记录
            </el-button>
          </div>
          <el-table v-loading="logsLoading" class="log-table" :data="syncLogs" height="520">
            <el-table-column prop="TaskNo" label="任务号" width="180" show-overflow-tooltip />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="statusTagType(row.Status)">
                  {{ taskStatusLabel(row.Status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="源平台" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ platformLogLabel(row, 'Source') }}</template>
            </el-table-column>
            <el-table-column label="目标平台" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ platformLogLabel(row, 'Target') }}</template>
            </el-table-column>
            <el-table-column label="规则" width="120">
              <template #default="{ row }">{{ ruleLabel(row.SyncRule) }}</template>
            </el-table-column>
            <el-table-column label="进度" width="160">
              <template #default="{ row }">
                <el-progress :percentage="normalizeProgress(row.Progress)" :stroke-width="5" />
              </template>
            </el-table-column>
            <el-table-column label="结果" width="170">
              <template #default="{ row }">
                {{ Number(row.SuccessCount || 0) }} 成功 / {{ Number(row.FailCount || 0) }} 失败
              </template>
            </el-table-column>
            <el-table-column prop="CreateTime" label="创建时间" width="170" />
            <el-table-column prop="UpdateTime" label="更新时间" width="170" />
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <template #footer>
      <el-button :disabled="syncing" @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  Document,
  FolderOpened,
  Refresh,
  Switch
} from '@element-plus/icons-vue'
import { fileManageApi, fileSyncApi } from '../api'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  currentFolderId: {
    type: String,
    default: ''
  },
  currentLimit: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'finished'])

const currentPlatform = fileSyncApi.getCurrentPlatform()
const MAX_TREE_NODES = 1600
const MAX_TREE_DEPTH = 18

const activeTab = ref('sync')
const sourceTreeRef = ref(null)
const targetTreeRef = ref(null)
const sourceTree = ref([])
const targetTree = ref([])
const checkedSourceRows = ref([])
const selectedTargetPath = ref('')
const selectedTargetNodeKey = ref('')
const loadingSource = ref(false)
const loadingTarget = ref(false)
const logsLoading = ref(false)
const syncing = ref(false)
const results = ref([])
const syncLogs = ref([])

const treeProps = {
  children: 'children',
  label: 'name'
}

const form = reactive({
  source: {
    platformType: 'current',
    apiBase: '',
    osClient: '',
    account: '',
    password: '',
    authorization: '',
    limit: true,
    path: ''
  },
  target: {
    platformType: 'current',
    apiBase: '',
    osClient: '',
    account: '',
    password: '',
    authorization: '',
    limit: true,
    path: ''
  },
  rule: 'ignore'
})

const task = reactive({
  taskId: '',
  taskNo: '',
  progressVisible: false,
  statusText: '',
  totalCount: 0,
  successCount: 0,
  failCount: 0,
  progress: 0
})

let targetListCache = new Map()

const hasTargetSelection = computed(() => !!selectedTargetNodeKey.value)
const canStartSync = computed(() => checkedSourceRows.value.length > 0 && hasTargetSelection.value)

const defaultRootPath = computed(() => {
  if (props.currentFolderId) return normalizeFolder(props.currentFolderId)
  const osClient = String(currentPlatform.osClient || '').toLowerCase()
  return osClient ? `${osClient}/` : ''
})

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    const rootPath = defaultRootPath.value
    activeTab.value = 'sync'
    form.source.limit = props.currentLimit
    form.target.limit = props.currentLimit
    form.source.path = rootPath
    form.target.path = rootPath
    selectedTargetPath.value = normalizeFolder(rootPath)
    selectedTargetNodeKey.value = folderNodeId(selectedTargetPath.value)
    checkedSourceRows.value = []
    sourceTree.value = []
    targetTree.value = []
    results.value = []
    resetTask()
    loadSyncLogs()
  }
)

watch(
  () => [form.source.apiBase, form.source.osClient, form.source.account, form.source.password],
  () => {
    form.source.authorization = ''
  }
)

watch(
  () => [form.target.apiBase, form.target.osClient, form.target.account, form.target.password],
  () => {
    form.target.authorization = ''
  }
)

const normalizeObjectPath = (path = '') => String(path || '').replace(/^\/+/, '')

function normalizeFolder(path = '') {
  const value = normalizeObjectPath(path).replace(/\/+$/, '')
  return value ? `${value}/` : ''
}

const getParentFolderPath = (path = '') => {
  const normalized = normalizeObjectPath(path)
  const source = normalized.endsWith('/') ? normalized.slice(0, -1) : normalized
  const index = source.lastIndexOf('/')
  return index >= 0 ? source.substring(0, index + 1) : ''
}

const joinPath = (folder, name) => normalizeFolder(folder) + String(name || '').replace(/^\/+/, '')

const folderNodeId = (path = '') => `folder:${normalizeFolder(path) || '/'}`

const fileNodeId = (path = '') => `file:${normalizeObjectPath(path)}`

const displayNameFromPath = (path = '', fallback = '根目录') => {
  const value = normalizeObjectPath(path).replace(/\/+$/, '')
  if (!value) return fallback
  return value.split('/').pop() || fallback
}

const stripRootForUpload = (path, platform) => {
  let value = normalizeFolder(path).replace(/\/+$/, '')
  const osClient = String(platform?.osClient || currentPlatform.osClient || '').toLowerCase()
  const prefix = osClient ? `${osClient}/` : ''
  if (prefix && value.toLowerCase().startsWith(prefix)) {
    value = value.substring(prefix.length)
  }
  return value || 'upload'
}

const resetTask = () => {
  Object.assign(task, {
    taskId: '',
    taskNo: '',
    progressVisible: false,
    statusText: '',
    totalCount: 0,
    successCount: 0,
    failCount: 0,
    progress: 0
  })
}

const platformSummary = (platformConfig) => {
  if (platformConfig.platformType === 'current') {
    return currentPlatform.osClient || '当前租户'
  }
  return platformConfig.osClient || '远程平台'
}

const preparePlatform = async (platformConfig) => {
  if (platformConfig.platformType === 'current') {
    return {
      platformType: 'current',
      apiBase: currentPlatform.apiBase,
      osClient: currentPlatform.osClient,
      authorization: ''
    }
  }

  if (!platformConfig.apiBase || !platformConfig.osClient || !platformConfig.account || !platformConfig.password) {
    throw new Error('请完整填写远程平台 ApiBase、OsClient、帐号、密码')
  }

  if (!platformConfig.authorization) {
    const login = await fileSyncApi.loginRemote(platformConfig)
    if (login.result?.Code !== 1) {
      throw new Error(login.result?.Msg || '远程平台登录失败')
    }
    platformConfig.authorization = login.authorization || ''
  }

  return {
    platformType: 'remote',
    apiBase: platformConfig.apiBase,
    osClient: platformConfig.osClient,
    authorization: platformConfig.authorization
  }
}

const normalizeRows = (result, folderPath, includeFiles = true) => {
  if (result?.Code !== 1 || !result.Data) return []
  const folders = (result.Data.Folders || []).map(item => {
    const fullPath = normalizeFolder(item.FullPath || joinPath(folderPath, item.Name))
    return {
      id: folderNodeId(fullPath),
      name: item.Name || displayNameFromPath(fullPath),
      isFolder: true,
      type: 'folder',
      size: 0,
      filePath: fullPath,
      children: []
    }
  })
  const files = includeFiles
    ? (result.Data.Files || []).map(item => {
        const fullPath = normalizeObjectPath(item.FullPath || joinPath(folderPath, item.Name))
        return {
          id: fileNodeId(fullPath),
          name: item.Name || displayNameFromPath(fullPath, '文件'),
          isFolder: false,
          type: item.Type || '',
          size: Number(item.Size || 0),
          filePath: fullPath,
          children: []
        }
      })
    : []
  return [...folders, ...files]
}

const buildFileTree = async (platform, rootPath, limit, includeFiles = true) => {
  const rootFolder = normalizeFolder(rootPath)
  const rootNode = {
    id: folderNodeId(rootFolder),
    name: rootFolder || '根目录',
    isFolder: true,
    type: 'folder',
    size: 0,
    filePath: rootFolder,
    root: true,
    children: []
  }

  let nodeCount = 1
  let clipped = false
  const loadChildren = async (node, depth) => {
    if (depth > MAX_TREE_DEPTH || nodeCount >= MAX_TREE_NODES) {
      clipped = true
      return
    }

    const result = await fileSyncApi.listObjects(platform, node.filePath, limit)
    if (result.Code !== 1) {
      throw new Error(result.Msg || '加载文件树失败')
    }

    const rows = normalizeRows(result, node.filePath, includeFiles)
    node.children = rows
    nodeCount += rows.length

    for (const child of rows) {
      if (!child.isFolder) continue
      if (nodeCount >= MAX_TREE_NODES) {
        clipped = true
        break
      }
      await loadChildren(child, depth + 1)
    }
  }

  await loadChildren(rootNode, 0)
  if (clipped) {
    ElMessage.warning(`文件树较大，已加载前 ${MAX_TREE_NODES} 个节点`)
  }
  return [rootNode]
}

const loadSourceTree = async () => {
  loadingSource.value = true
  checkedSourceRows.value = []
  try {
    const sourcePlatform = await preparePlatform(form.source)
    sourceTree.value = await buildFileTree(sourcePlatform, form.source.path, form.source.limit, true)
    ElMessage.success('源文件树加载完成')
  } catch (error) {
    sourceTree.value = []
    ElMessage.error(error.message || '加载源文件树失败')
  } finally {
    loadingSource.value = false
  }
}

const loadTargetTree = async () => {
  loadingTarget.value = true
  try {
    const targetPlatform = await preparePlatform(form.target)
    targetTree.value = await buildFileTree(targetPlatform, form.target.path, form.target.limit, true)
    selectedTargetPath.value = normalizeFolder(form.target.path)
    selectedTargetNodeKey.value = folderNodeId(selectedTargetPath.value)
    ElMessage.success('目标文件树加载完成')
  } catch (error) {
    targetTree.value = []
    ElMessage.error(error.message || '加载目标文件树失败')
  } finally {
    loadingTarget.value = false
  }
}

const handleSourceCheck = () => {
  checkedSourceRows.value = (sourceTreeRef.value?.getCheckedNodes(false, false) || [])
    .filter(row => !row.root)
}

const handleTargetNodeClick = (node) => {
  if (node.isFolder) {
    selectedTargetPath.value = normalizeFolder(node.filePath)
    selectedTargetNodeKey.value = node.id
  } else {
    selectedTargetPath.value = getParentFolderPath(node.filePath)
    selectedTargetNodeKey.value = folderNodeId(selectedTargetPath.value)
    ElMessage.info('已选择该文件所在目录')
  }
  form.target.path = selectedTargetPath.value
}

const hasCheckedAncestor = (row, checkedFolderPaths) => {
  let parentPath = row.isFolder
    ? getParentFolderPath(normalizeFolder(row.filePath))
    : getParentFolderPath(row.filePath)

  while (parentPath) {
    if (checkedFolderPaths.has(normalizeFolder(parentPath))) return true
    parentPath = getParentFolderPath(parentPath)
  }
  return false
}

const getSelectedRootRows = () => {
  const checkedFolderPaths = new Set(
    checkedSourceRows.value
      .filter(row => row.isFolder)
      .map(row => normalizeFolder(row.filePath))
  )
  return checkedSourceRows.value.filter(row => !hasCheckedAncestor(row, checkedFolderPaths))
}

const countEntries = (row) => {
  if (!row.isFolder) return 1
  return 1 + (row.children || []).reduce((sum, child) => sum + countEntries(child), 0)
}

const getTargetRows = async (targetPlatform, targetFolder) => {
  const key = [
    targetPlatform.platformType,
    targetPlatform.apiBase,
    targetPlatform.osClient,
    form.target.limit ? 'private' : 'public',
    normalizeFolder(targetFolder)
  ].join('|')
  if (targetListCache.has(key)) return targetListCache.get(key)

  const list = await fileSyncApi.listObjects(targetPlatform, normalizeFolder(targetFolder), form.target.limit)
  const rows = normalizeRows(list, normalizeFolder(targetFolder), true)
  targetListCache.set(key, rows)
  return rows
}

const targetExists = async (targetPlatform, targetFolder, name, isFolder) => {
  const rows = await getTargetRows(targetPlatform, targetFolder)
  return rows.some(row => row.name === name && row.isFolder === isFolder)
}

const addResult = (row, targetPath, status, message) => {
  results.value.push({
    name: row.name,
    sourcePath: row.filePath,
    targetPath,
    status,
    message: message || ''
  })
}

const updateProgress = async (sourcePlatform, status = 'Running') => {
  const finished = task.successCount + task.failCount
  task.progress = task.totalCount ? Math.min(100, Math.round((finished / task.totalCount) * 100)) : 0
  task.statusText = status === 'Running' ? '同步中...' : status === 'Finished' ? '同步完成' : '同步失败'
  if (!task.taskId && !task.taskNo) return
  const payload = {
    Action: 'update',
    TaskId: task.taskId,
    TaskNo: task.taskNo,
    Status: status,
    TotalCount: task.totalCount,
    SuccessCount: task.successCount,
    FailCount: task.failCount,
    Progress: task.progress,
    Summary: JSON.stringify(results.value)
  }
  try {
    await fileSyncApi.runApiEngine('mci_file_sync_record', payload, sourcePlatform)
  } catch (error) {
    await fileSyncApi.runApiEngine('mci_file_sync_record', payload)
  }
}

const createTaskRecord = async (sourcePlatform, targetPlatform, selectedRows) => {
  const payload = {
    Action: 'create',
    Task: {
      SourcePlatformType: form.source.platformType,
      SourceApiBase: sourcePlatform.apiBase,
      SourceOsClient: sourcePlatform.osClient,
      TargetPlatformType: form.target.platformType,
      TargetApiBase: targetPlatform.apiBase,
      TargetOsClient: targetPlatform.osClient,
      SourceBucketScope: form.source.limit ? 'private' : 'public',
      TargetBucketScope: form.target.limit ? 'private' : 'public',
      SyncRule: form.rule,
      Status: 'Running',
      TotalCount: task.totalCount
    },
    Items: selectedRows.map(row => ({
      SourcePath: row.filePath,
      TargetPath: joinPath(selectedTargetPath.value, row.name),
      Name: row.name,
      IsFolder: row.isFolder,
      Size: row.size,
      FileType: row.type
    }))
  }
  try {
    const result = await fileSyncApi.runApiEngine('mci_file_sync_record', payload, sourcePlatform)
    if (result.Code === 1) return result.Data || {}
  } catch (error) {}

  const fallback = await fileSyncApi.runApiEngine('mci_file_sync_record', payload)
  return fallback.Code === 1 ? (fallback.Data || {}) : {}
}

const syncFile = async (row, sourcePlatform, targetPlatform, targetFolder) => {
  const targetPath = joinPath(targetFolder, row.name)
  const exists = await targetExists(targetPlatform, targetFolder, row.name, false)
  if (exists && form.rule === 'ignore') {
    task.successCount++
    addResult(row, targetPath, 'Ignored', '目标已存在，已按规则忽略')
    return
  }

  const urlResult = await fileSyncApi.getPrivateFileUrl(sourcePlatform, row.filePath, form.source.limit)
  if (urlResult.Code !== 1 || !urlResult.Data) {
    throw new Error(urlResult.Msg || '获取源文件下载地址失败')
  }

  const resp = await fetch(urlResult.Data)
  const blob = await resp.blob()
  const uploadPath = stripRootForUpload(targetFolder, targetPlatform)
  const uploadResult = await fileSyncApi.uploadFiles(
    targetPlatform,
    [new File([blob], row.name, { type: blob.type })],
    uploadPath,
    form.target.limit
  )
  if (uploadResult.Code !== 1) {
    throw new Error(uploadResult.Msg || '上传到目标失败')
  }

  const uploadData = Array.isArray(uploadResult.Data) ? uploadResult.Data[0] : uploadResult.Data
  if (uploadData?.Path && normalizeObjectPath(uploadData.Path) !== normalizeObjectPath(targetPath)) {
    const moveResult = await fileSyncApi.moveObject(
      targetPlatform,
      uploadData.Path,
      targetPath,
      form.target.limit
    )
    if (moveResult.Code !== 1) {
      throw new Error(moveResult.Msg || '移动到目标目录失败')
    }
  }

  targetListCache = new Map()
  task.successCount++
  addResult(row, targetPath, 'Success', exists ? '已覆盖同名文件' : '同步成功')
}

const syncFolder = async (row, sourcePlatform, targetPlatform, targetFolder) => {
  const targetPath = joinPath(targetFolder, row.name)
  const exists = await targetExists(targetPlatform, targetFolder, row.name, true)
  if (!exists) {
    const create = await fileSyncApi.createFolder(targetPlatform, targetPath, form.target.limit)
    if (create.Code !== 1) {
      throw new Error(create.Msg || '创建目标文件夹失败')
    }
    targetListCache = new Map()
  }

  task.successCount++
  addResult(row, targetPath, 'Success', exists ? '文件夹已存在，保留目标原有文件' : '已创建文件夹')

  for (const child of row.children || []) {
    await syncEntry(child, sourcePlatform, targetPlatform, targetPath)
    await updateProgress(sourcePlatform)
  }
}

const syncEntry = async (row, sourcePlatform, targetPlatform, targetFolder) => {
  try {
    if (row.isFolder) {
      await syncFolder(row, sourcePlatform, targetPlatform, targetFolder)
    } else {
      await syncFile(row, sourcePlatform, targetPlatform, targetFolder)
    }
  } catch (error) {
    task.failCount++
    addResult(row, joinPath(targetFolder, row.name), 'Failed', error.message || '同步失败')
  }
}

const startSync = async () => {
  const selectedRows = getSelectedRootRows()
  if (selectedRows.length === 0) {
    ElMessage.warning('请选择要同步的文件或文件夹')
    return
  }
  if (!hasTargetSelection.value) {
    ElMessage.warning('请选择目标同步位置')
    return
  }

  syncing.value = true
  targetListCache = new Map()
  results.value = []
  Object.assign(task, {
    progressVisible: true,
    statusText: '准备同步...',
    totalCount: selectedRows.reduce((sum, row) => sum + countEntries(row), 0),
    successCount: 0,
    failCount: 0,
    progress: 0
  })

  try {
    const sourcePlatform = await preparePlatform(form.source)
    const targetPlatform = await preparePlatform(form.target)
    const record = await createTaskRecord(sourcePlatform, targetPlatform, selectedRows)
    task.taskId = record.TaskId || ''
    task.taskNo = record.TaskNo || ''

    for (const row of selectedRows) {
      await syncEntry(row, sourcePlatform, targetPlatform, selectedTargetPath.value)
      await updateProgress(sourcePlatform)
    }

    await updateProgress(sourcePlatform, task.failCount > 0 ? 'Failed' : 'Finished')
    ElMessage.success(task.failCount > 0 ? '同步完成，部分失败' : '同步完成')
    emit('finished')
    loadSyncLogs()
  } catch (error) {
    task.statusText = '同步失败'
    task.failCount = Math.max(task.failCount, 1)
    task.progress = 100
    ElMessage.error(error.message || '同步失败')
  } finally {
    syncing.value = false
  }
}

const loadSyncLogs = async () => {
  logsLoading.value = true
  try {
    const result = await fileManageApi.getSyncTasks({ _PageSize: 50 })
    syncLogs.value = result.Code === 1 ? (result.Data || []) : []
  } catch (error) {
    syncLogs.value = []
    ElMessage.error('加载同步记录失败')
  } finally {
    logsLoading.value = false
  }
}

const formatFileSize = (bytes) => {
  if (!bytes || Number(bytes) <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const resultLabel = (status) => {
  if (status === 'Success') return '成功'
  if (status === 'Ignored') return '忽略'
  return '失败'
}

const statusTagType = (status) => {
  if (status === 'Finished' || status === 'Success') return 'success'
  if (status === 'Running') return 'primary'
  if (status === 'Ignored') return 'info'
  return 'danger'
}

const taskStatusLabel = (status) => {
  if (status === 'Running') return '同步中'
  if (status === 'Finished') return '已完成'
  if (status === 'Failed') return '失败'
  return status || '未知'
}

const ruleLabel = (rule) => rule === 'overwrite' ? '重名覆盖' : '重名忽略'

const platformLogLabel = (row, prefix) => {
  const type = row[`${prefix}PlatformType`] === 'remote' ? '远程' : '当前'
  const osClient = row[`${prefix}OsClient`] || '-'
  const bucket = row[`${prefix}BucketScope`] === 'public' ? '公有桶' : '私有桶'
  return `${type} / ${osClient} / ${bucket}`
}

const normalizeProgress = (value) => Math.max(0, Math.min(100, Number(value || 0)))
</script>

<style lang="scss" scoped>
:deep(.mci-file-sync-dialog) {
  margin: 0;
  max-height: calc(100vh - 48px);
  border-radius: 8px;
  overflow: hidden;

  .el-dialog__header {
    padding: 18px 22px 14px;
    border-top: 4px solid #20b26b;
    border-bottom: 1px solid #e5edf5;
    cursor: move;
  }

  .el-dialog__title {
    color: #16202a;
    font-size: 17px;
    font-weight: 700;
  }

  .el-dialog__body {
    padding: 14px 18px 18px;
    background: #f5f8fb;
  }

  .el-dialog__footer {
    padding: 12px 18px 16px;
    border-top: 1px solid #e5edf5;
  }
}

.sync-shell {
  display: flex;
  flex-direction: column;
  min-height: 620px;
}

.sync-tabs {
  :deep(.el-tabs__header) {
    margin: 0 0 12px;
  }

  :deep(.el-tabs__item) {
    font-weight: 700;
  }
}

.sync-config-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 48px minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}

.platform-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  background: #ffffff;
}

.panel-head,
.tree-panel-head,
.log-toolbar,
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;

  strong {
    display: block;
    color: #182636;
    font-size: 15px;
    line-height: 1.2;
  }

  span {
    display: block;
    margin-top: 4px;
    color: #7c8a99;
    font-size: 12px;
  }
}

.platform-toggle,
.rule-toggle {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border-radius: 8px;
  background: #edf2f7;

  :deep(.el-radio-button__inner) {
    width: 100%;
    height: 34px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #536579;
    font-weight: 700;
    line-height: 1;
    box-shadow: none;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: #20b26b;
    color: #ffffff;
    box-shadow: 0 8px 18px rgba(32, 178, 107, 0.22);
  }
}

.credential-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.path-grid {
  display: grid;
  grid-template-columns: 132px minmax(0, 1fr);
  gap: 10px;
}

.sync-direction {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #2563eb;
  font-size: 26px;
}

.sync-rule-bar {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  margin: 14px 0;
  padding: 12px;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  background: #ffffff;
}

.target-path {
  min-width: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: #f6f9fc;

  span {
    margin-right: 8px;
    color: #7c8a99;
    font-size: 12px;
  }

  strong {
    color: #1f3347;
    font-size: 13px;
    word-break: break-all;
  }
}

.tree-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.tree-panel {
  min-width: 0;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.tree-panel-head {
  padding: 13px 16px;
  border-bottom: 1px solid #edf2f7;
}

.tree-body {
  height: 360px;
  padding: 8px 8px 12px;

  :deep(.el-scrollbar__view) {
    min-height: 100%;
  }

  :deep(.el-tree) {
    background: transparent;
    --el-tree-node-hover-bg-color: #f3f7fb;
  }

  :deep(.el-tree-node__content) {
    height: 34px;
    border-radius: 6px;
  }
}

.target-tree {
  :deep(.el-tree-node.is-current > .el-tree-node__content) {
    background: #e8f7ef;
    color: #0f7d4f;
  }
}

.tree-node {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;

  .el-icon {
    flex: 0 0 auto;
    color: #d99012;
  }

  &.is-file .el-icon {
    color: #2563eb;
  }
}

.node-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.node-meta {
  flex: 0 0 auto;
  margin-left: auto;
  color: #95a3b3;
  font-size: 12px;
}

.sync-progress {
  margin-top: 14px;
  padding: 12px 14px;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  background: #ffffff;
}

.result-table,
.log-table {
  margin-top: 14px;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  overflow: hidden;
}

.log-toolbar {
  padding: 12px 14px;
  border: 1px solid #dfe8f1;
  border-radius: 8px;
  background: #ffffff;
}

@media (max-width: 1100px) {
  .sync-config-grid,
  .tree-grid {
    grid-template-columns: 1fr;
  }

  .sync-direction {
    display: none;
  }

  .sync-rule-bar {
    grid-template-columns: 1fr;
  }
}
</style>
