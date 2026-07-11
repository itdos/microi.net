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
                <el-button
                  :icon="Refresh"
                  :loading="loadingSource"
                  :disabled="form.source.platformType === 'remote' && !form.source.isLoggedIn"
                  @click="loadSourceTree"
                >
                  加载源树
                </el-button>
              </div>
              <el-radio-group v-model="form.source.platformType" class="platform-toggle">
                <el-radio-button value="current">当前平台</el-radio-button>
                <el-radio-button value="remote">远程平台</el-radio-button>
              </el-radio-group>
              <div v-if="form.source.platformType === 'remote'" class="remote-session">
                <div class="connection-toolbar">
                  <el-select
                    v-model="form.source.connectionId"
                    placeholder="选择历史连接"
                    clearable
                    filterable
                    :loading="savedConnectionsLoading"
                    @update:model-value="handleSavedConnectionChange(form.source, $event, 'source')"
                  >
                    <el-option
                      v-for="item in savedConnections"
                      :key="item.Id"
                      :label="connectionOptionLabel(item)"
                      :value="item.Id"
                    />
                  </el-select>
                  <el-button
                    :icon="Delete"
                    circle
                    title="删除历史连接"
                    :disabled="!form.source.connectionId"
                    @click="deleteSavedConnection(form.source)"
                  />
                </div>
                <div v-if="form.source.isLoggedIn" class="login-identity">
                  <el-avatar :size="36" :src="form.source.remoteUser.Avatar || ''" :icon="UserFilled" />
                  <div class="identity-copy">
                    <strong>{{ remoteUserLabel(form.source) }}</strong>
                    <span>{{ form.source.apiBase }} · {{ form.source.osClient }}</span>
                  </div>
                  <el-tag type="success" effect="light">已登录</el-tag>
                  <el-button :icon="SwitchButton" plain @click="logoutRemotePlatform(form.source)">退出</el-button>
                </div>
                <template v-else>
                  <div class="credential-grid">
                    <el-input v-model="form.source.apiBase" placeholder="ApiBase" @blur="handleRemoteEndpointBlur(form.source)" />
                    <el-input v-model="form.source.osClient" placeholder="OsClient" @blur="handleRemoteEndpointBlur(form.source)" />
                    <el-input v-model="form.source.account" placeholder="帐号" />
                    <el-input v-model="form.source.password" placeholder="密码" type="password" show-password />
                    <div v-if="form.source.captchaRequired" class="captcha-field">
                      <el-input
                        v-model="form.source.captchaValue"
                        placeholder="验证码"
                        maxlength="8"
                        @keyup.enter="loginRemotePlatform(form.source, 'source')"
                      />
                      <button
                        type="button"
                        class="captcha-image"
                        title="刷新验证码"
                        @click="refreshRemoteCaptcha(form.source)"
                      >
                        <img v-if="form.source.captchaImage && !form.source.loadingCaptcha" :src="form.source.captchaImage" alt="登录验证码" />
                        <el-icon v-else class="is-loading"><Loading /></el-icon>
                      </button>
                    </div>
                  </div>
                  <div class="login-actions">
                    <span>登录成功后才能加载远程文件树</span>
                    <el-button
                      type="primary"
                      :icon="Key"
                      :loading="form.source.loggingIn"
                      @click="loginRemotePlatform(form.source, 'source')"
                    >登录</el-button>
                  </div>
                </template>
                <el-alert
                  v-if="form.source.capabilityError"
                  :title="form.source.capabilityError"
                  type="warning"
                  :closable="false"
                  show-icon
                />
              </div>
              <el-radio-group v-model="form.source.limit" class="bucket-switch">
                <el-radio-button :value="true">私有桶</el-radio-button>
                <el-radio-button :value="false">公有桶</el-radio-button>
              </el-radio-group>
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
                <el-button
                  :icon="Refresh"
                  :loading="loadingTarget"
                  :disabled="form.target.platformType === 'remote' && !form.target.isLoggedIn"
                  @click="loadTargetTree"
                >
                  加载目标树
                </el-button>
              </div>
              <el-radio-group v-model="form.target.platformType" class="platform-toggle">
                <el-radio-button value="current">当前平台</el-radio-button>
                <el-radio-button value="remote">远程平台</el-radio-button>
              </el-radio-group>
              <div v-if="form.target.platformType === 'remote'" class="remote-session">
                <div class="connection-toolbar">
                  <el-select
                    v-model="form.target.connectionId"
                    placeholder="选择历史连接"
                    clearable
                    filterable
                    :loading="savedConnectionsLoading"
                    @update:model-value="handleSavedConnectionChange(form.target, $event, 'target')"
                  >
                    <el-option
                      v-for="item in savedConnections"
                      :key="item.Id"
                      :label="connectionOptionLabel(item)"
                      :value="item.Id"
                    />
                  </el-select>
                  <el-button
                    :icon="Delete"
                    circle
                    title="删除历史连接"
                    :disabled="!form.target.connectionId"
                    @click="deleteSavedConnection(form.target)"
                  />
                </div>
                <div v-if="form.target.isLoggedIn" class="login-identity">
                  <el-avatar :size="36" :src="form.target.remoteUser.Avatar || ''" :icon="UserFilled" />
                  <div class="identity-copy">
                    <strong>{{ remoteUserLabel(form.target) }}</strong>
                    <span>{{ form.target.apiBase }} · {{ form.target.osClient }}</span>
                  </div>
                  <el-tag type="success" effect="light">已登录</el-tag>
                  <el-button :icon="SwitchButton" plain @click="logoutRemotePlatform(form.target)">退出</el-button>
                </div>
                <template v-else>
                  <div class="credential-grid">
                    <el-input v-model="form.target.apiBase" placeholder="ApiBase" @blur="handleRemoteEndpointBlur(form.target)" />
                    <el-input v-model="form.target.osClient" placeholder="OsClient" @blur="handleRemoteEndpointBlur(form.target)" />
                    <el-input v-model="form.target.account" placeholder="帐号" />
                    <el-input v-model="form.target.password" placeholder="密码" type="password" show-password />
                    <div v-if="form.target.captchaRequired" class="captcha-field">
                      <el-input
                        v-model="form.target.captchaValue"
                        placeholder="验证码"
                        maxlength="8"
                        @keyup.enter="loginRemotePlatform(form.target, 'target')"
                      />
                      <button
                        type="button"
                        class="captcha-image"
                        title="刷新验证码"
                        @click="refreshRemoteCaptcha(form.target)"
                      >
                        <img v-if="form.target.captchaImage && !form.target.loadingCaptcha" :src="form.target.captchaImage" alt="登录验证码" />
                        <el-icon v-else class="is-loading"><Loading /></el-icon>
                      </button>
                    </div>
                  </div>
                  <div class="login-actions">
                    <span>登录后将校验目标平台文件柜版本</span>
                    <el-button
                      type="primary"
                      :icon="Key"
                      :loading="form.target.loggingIn"
                      @click="loginRemotePlatform(form.target, 'target')"
                    >登录</el-button>
                  </div>
                </template>
                <el-alert
                  v-if="form.target.capabilityError"
                  :title="form.target.capabilityError"
                  type="warning"
                  :closable="false"
                  show-icon
                />
              </div>
              <el-radio-group
                v-model="form.target.limit"
                class="bucket-switch"
                @change="handleTargetBucketChange"
              >
                <el-radio-button :value="true">私有桶</el-radio-button>
                <el-radio-button :value="false">公有桶</el-radio-button>
              </el-radio-group>
            </section>
          </div>

          <div class="sync-rule-bar">
            <el-radio-group v-model="form.rule" class="rule-toggle">
              <el-radio-button value="ignore">重名忽略</el-radio-button>
              <el-radio-button value="overwrite">文件重名覆盖</el-radio-button>
            </el-radio-group>
            <div class="target-path">
              <span>目标位置</span>
              <strong>{{ bucketLabel(form.target.limit) }} / {{ selectedTargetPath || targetRootPath || '根目录' }}</strong>
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
                  <span>{{ bucketLabel(form.target.limit) }} · 选择同步落点</span>
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
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowRight,
  Delete,
  Document,
  FolderOpened,
  Key,
  Loading,
  Refresh,
  Switch,
  SwitchButton,
  UserFilled
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
const MAX_TREE_NODES = 10000

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
const savedConnections = ref([])
const savedConnectionsLoading = ref(false)

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
    connectionId: '',
    isLoggedIn: false,
    loggingIn: false,
    remoteUser: {},
    capability: {},
    capabilityError: '',
    suspendEndpointReset: false,
    loginConfigLoaded: false,
    checkingLoginConfig: false,
    captchaRequired: false,
    captchaId: '',
    captchaValue: '',
    captchaImage: '',
    loadingCaptcha: false,
    limit: true
  },
  target: {
    platformType: 'current',
    apiBase: '',
    osClient: '',
    account: '',
    password: '',
    authorization: '',
    connectionId: '',
    isLoggedIn: false,
    loggingIn: false,
    remoteUser: {},
    capability: {},
    capabilityError: '',
    suspendEndpointReset: false,
    loginConfigLoaded: false,
    checkingLoginConfig: false,
    captchaRequired: false,
    captchaId: '',
    captchaValue: '',
    captchaImage: '',
    loadingCaptcha: false,
    limit: true,
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
const loginConfigRequests = new WeakMap()

const targetRootPath = computed(() => {
  const osClient = form.target.platformType === 'current'
    ? currentPlatform.osClient
    : form.target.osClient
  return normalizeFolder(String(osClient || '').toLowerCase())
})
const hasTargetSelection = computed(() => targetTree.value.length > 0 && !!selectedTargetNodeKey.value)
const canStartSync = computed(() => checkedSourceRows.value.length > 0 && hasTargetSelection.value)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    activeTab.value = 'sync'
    form.source.limit = props.currentLimit
    form.target.limit = props.currentLimit
    selectedTargetPath.value = ''
    selectedTargetNodeKey.value = ''
    checkedSourceRows.value = []
    sourceTree.value = []
    targetTree.value = []
    results.value = []
    resetTask()
    loadSyncLogs()
    loadRemoteConnections()
  }
)

const resetRemoteLoginState = (platformConfig) => {
  platformConfig.authorization = ''
  platformConfig.connectionId = ''
  platformConfig.isLoggedIn = false
  platformConfig.remoteUser = {}
  platformConfig.capability = {}
  platformConfig.capabilityError = ''
  platformConfig.loginConfigLoaded = false
  platformConfig.captchaRequired = false
  platformConfig.captchaId = ''
  platformConfig.captchaValue = ''
  platformConfig.captchaImage = ''
}

watch(
  () => [form.source.platformType, form.source.apiBase, form.source.osClient],
  () => {
    if (form.source.suspendEndpointReset) return
    resetRemoteLoginState(form.source)
    sourceTree.value = []
    checkedSourceRows.value = []
  }
)

watch(
  () => [form.target.platformType, form.target.apiBase, form.target.osClient],
  () => {
    if (form.target.suspendEndpointReset) return
    resetRemoteLoginState(form.target)
    targetTree.value = []
    selectedTargetPath.value = ''
    selectedTargetNodeKey.value = ''
    targetListCache = new Map()
  }
)

watch(
  () => [form.source.account, form.source.password, form.source.captchaValue],
  () => {
    if (form.source.suspendEndpointReset || form.source.isLoggedIn) return
    form.source.authorization = ''
  }
)

watch(
  () => [form.target.account, form.target.password, form.target.captchaValue],
  () => {
    if (form.target.suspendEndpointReset || form.target.isLoggedIn) return
    form.target.authorization = ''
  }
)

const normalizeObjectPath = (path = '') => String(path || '')
  .replace(/\\/g, '/')
  .replace(/^\/+/, '')

const canonicalObjectPath = (path = '') => normalizeObjectPath(path).replace(/\/{2,}/g, '/')

const canonicalFolderPath = (path = '') => {
  const value = canonicalObjectPath(path).replace(/\/+$/, '')
  return value ? `${value}/` : ''
}

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

const folderNodeId = (path = '') => `folder:${canonicalFolderPath(path) || '/'}`

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
  if (platformConfig.isLoggedIn) {
    return `${platformConfig.osClient || '远程平台'} · ${remoteUserLabel(platformConfig)}`
  }
  return platformConfig.osClient || '远程平台'
}

const bucketLabel = (limit) => limit ? '私有桶' : '公有桶'
const REQUIRED_FILE_CABINET_PROTOCOL = 2

const remoteUserLabel = (platformConfig) => {
  const user = platformConfig.remoteUser || {}
  return user.Name || user.Account || platformConfig.account || '远程用户'
}

const connectionOptionLabel = (item) => {
  let host = item.ApiBase || ''
  try {
    host = new URL(item.ApiBase).host
  } catch (error) {}
  return `${item.ConnectionName || `${item.RemoteOsClient} / ${item.Account}`} · ${host}`
}

const toRemotePlatform = (platformConfig) => ({
  platformType: 'remote',
  apiBase: platformConfig.apiBase,
  osClient: platformConfig.osClient,
  authorization: platformConfig.authorization
})

const targetUpgradeMessage = () => '目标平台未安装文件同步接口或文件柜版本过低，请让目标平台更新【文件柜】应用后重试（缺少接口：mci_file_sync_capability）。'

const loadRemoteConnections = async (showError = true) => {
  savedConnectionsLoading.value = true
  try {
    const result = await fileSyncApi.listRemoteConnections()
    if (result?.Code !== 1) {
      throw new Error(result?.Msg || '加载历史连接失败')
    }
    savedConnections.value = result.Data || []
  } catch (error) {
    savedConnections.value = []
    if (showError) ElMessage.error(error.message || '加载历史连接失败')
  } finally {
    savedConnectionsLoading.value = false
  }
}

const validateRemoteCapability = async (platformConfig, role) => {
  try {
    const capability = await fileSyncApi.getFileCabinetCapability(toRemotePlatform(platformConfig))
    const protocolVersion = Number(capability.ProtocolVersion || 0)
    if (role === 'target' && protocolVersion < REQUIRED_FILE_CABINET_PROTOCOL) {
      throw new Error(targetUpgradeMessage())
    }
    platformConfig.capability = capability
    platformConfig.capabilityError = ''
    return capability
  } catch (error) {
    if (error?.code === 1001) throw error
    if (role === 'target') {
      const upgradeError = new Error(targetUpgradeMessage())
      upgradeError.code = error?.code
      throw upgradeError
    }
    platformConfig.capability = {}
    platformConfig.capabilityError = ''
    return {}
  }
}

const saveRemoteConnection = async (platformConfig) => {
  const result = await fileSyncApi.saveRemoteConnection({
    Id: platformConfig.connectionId || '',
    ApiBase: platformConfig.apiBase,
    RemoteOsClient: platformConfig.osClient,
    Account: platformConfig.account,
    Password: platformConfig.password,
    Authorization: platformConfig.authorization,
    RemoteUser: platformConfig.remoteUser || {},
    Capability: platformConfig.capability || {}
  })
  if (result?.Code !== 1) {
    throw new Error(result?.Msg || '保存远程连接失败')
  }
  platformConfig.connectionId = result.Data?.Id || platformConfig.connectionId || ''
  await loadRemoteConnections(false)
}

const loginRemotePlatform = async (platformConfig, role, force = false) => {
  if (platformConfig.loggingIn && !force) return false
  platformConfig.loggingIn = true
  platformConfig.capabilityError = ''
  try {
    if (!platformConfig.apiBase || !platformConfig.osClient || !platformConfig.account || !platformConfig.password) {
      throw new Error('请完整填写远程平台 ApiBase、OsClient、帐号、密码')
    }
    await detectRemoteLoginConfig(platformConfig)
    if (platformConfig.captchaRequired && (!platformConfig.captchaId || !platformConfig.captchaImage)) {
      await refreshRemoteCaptcha(platformConfig)
    }
    if (platformConfig.captchaRequired && !platformConfig.captchaValue) {
      throw new Error('远程平台已开启验证码，请输入验证码')
    }

    const login = await fileSyncApi.loginRemote(platformConfig)
    if (login.result?.Code !== 1) {
      if (platformConfig.captchaRequired) await refreshRemoteCaptcha(platformConfig)
      throw new Error(login.result?.Msg || '远程平台登录失败')
    }
    platformConfig.authorization = login.authorization || ''
    if (!platformConfig.authorization) {
      throw new Error('远程平台登录成功但未返回授权令牌')
    }
    platformConfig.remoteUser = login.result?.Data || { Account: platformConfig.account }
    platformConfig.isLoggedIn = true

    try {
      await validateRemoteCapability(platformConfig, role)
    } catch (error) {
      platformConfig.capabilityError = error.message || targetUpgradeMessage()
    }

    try {
      await saveRemoteConnection(platformConfig)
    } catch (error) {
      ElMessage.error(`远程平台已登录，但连接记录保存失败：${error.message || '未知错误'}`)
      return false
    }

    if (platformConfig.capabilityError) {
      ElMessage.error(platformConfig.capabilityError)
      return false
    }
    ElMessage.success(`已登录：${remoteUserLabel(platformConfig)}`)
    return true
  } catch (error) {
    platformConfig.authorization = ''
    platformConfig.isLoggedIn = false
    platformConfig.remoteUser = {}
    ElMessage.error(error.message || '远程平台登录失败')
    return false
  } finally {
    platformConfig.loggingIn = false
  }
}

const invalidateRemoteLogin = async (platformConfig, message) => {
  if (platformConfig.connectionId) {
    try {
      await fileSyncApi.logoutRemoteConnection(platformConfig.connectionId, message || '远程登录已失效')
    } catch (error) {}
  }
  platformConfig.authorization = ''
  platformConfig.isLoggedIn = false
  platformConfig.remoteUser = {}
  platformConfig.capability = {}
  await loadRemoteConnections(false)
}

const logoutRemotePlatform = async (platformConfig) => {
  const connectionId = platformConfig.connectionId
  try {
    if (connectionId) {
      const result = await fileSyncApi.logoutRemoteConnection(connectionId)
      if (result?.Code !== 1) throw new Error(result?.Msg || '退出远程平台失败')
    }
    platformConfig.authorization = ''
    platformConfig.connectionId = ''
    platformConfig.isLoggedIn = false
    platformConfig.remoteUser = {}
    platformConfig.capability = {}
    platformConfig.capabilityError = ''
    platformConfig.loginConfigLoaded = false
    await detectRemoteLoginConfig(platformConfig)
    await loadRemoteConnections(false)
    ElMessage.success('已退出远程平台')
  } catch (error) {
    ElMessage.error(error.message || '退出远程平台失败')
  }
}

const handleSavedConnectionChange = async (platformConfig, connectionId, role) => {
  if (!connectionId) {
    resetRemoteLoginState(platformConfig)
    return
  }
  platformConfig.loggingIn = true
  try {
    const result = await fileSyncApi.getRemoteConnection(connectionId)
    if (result?.Code !== 1 || !result.Data) {
      throw new Error(result?.Msg || '读取历史连接失败')
    }
    const connection = result.Data
    platformConfig.suspendEndpointReset = true
    Object.assign(platformConfig, {
      connectionId: connection.Id,
      apiBase: connection.ApiBase || '',
      osClient: connection.RemoteOsClient || '',
      account: connection.Account || '',
      password: connection.Password || '',
      authorization: connection.Authorization || '',
      isLoggedIn: !!connection.Authorization && Number(connection.IsLoggedIn || 0) === 1,
      remoteUser: {
        Id: connection.RemoteUserId || '',
        Account: connection.RemoteUserAccount || connection.Account || '',
        Name: connection.RemoteUserName || '',
        Avatar: connection.RemoteUserAvatar || ''
      },
      capability: {},
      capabilityError: '',
      loginConfigLoaded: false,
      captchaRequired: false,
      captchaId: '',
      captchaValue: '',
      captchaImage: ''
    })
    await nextTick()
    platformConfig.suspendEndpointReset = false

    if (platformConfig.isLoggedIn && role === 'target') {
      try {
        await validateRemoteCapability(platformConfig, role)
      } catch (error) {
        if (error?.code === 1001) {
          await invalidateRemoteLogin(platformConfig, '远程 Token 已失效')
        } else {
          platformConfig.capabilityError = error.message || targetUpgradeMessage()
          ElMessage.error(platformConfig.capabilityError)
          return
        }
      }
    }

    if (platformConfig.isLoggedIn) {
      ElMessage.success(`已恢复登录：${remoteUserLabel(platformConfig)}`)
      return
    }

    await detectRemoteLoginConfig(platformConfig)
    if (!platformConfig.captchaRequired && platformConfig.password) {
      platformConfig.loggingIn = false
      await loginRemotePlatform(platformConfig, role, true)
    } else if (platformConfig.captchaRequired) {
      ElMessage.info('历史连接已载入，请输入验证码后登录')
    }
  } catch (error) {
    platformConfig.suspendEndpointReset = false
    ElMessage.error(error.message || '载入历史连接失败')
  } finally {
    platformConfig.loggingIn = false
  }
}

const deleteSavedConnection = async (platformConfig) => {
  if (!platformConfig.connectionId) return
  try {
    await ElMessageBox.confirm('删除后将清除该远程平台保存的帐号、密码和 Token，确定继续？', '删除历史连接', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
    const connectionId = platformConfig.connectionId
    const result = await fileSyncApi.deleteRemoteConnection(connectionId)
    if (result?.Code !== 1) throw new Error(result?.Msg || '删除历史连接失败')
    ;[form.source, form.target].forEach(config => {
      if (config.connectionId === connectionId) resetRemoteLoginState(config)
    })
    await loadRemoteConnections(false)
    ElMessage.success('历史连接已删除')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error.message || '删除历史连接失败')
  }
}

const refreshRemoteCaptcha = async (platformConfig) => {
  if (platformConfig.platformType !== 'remote' || !platformConfig.apiBase || !platformConfig.osClient) return
  platformConfig.loadingCaptcha = true
  try {
    const captcha = await fileSyncApi.getRemoteCaptcha(platformConfig)
    platformConfig.captchaId = captcha.captchaId
    platformConfig.captchaImage = captcha.image
    platformConfig.captchaValue = ''
  } finally {
    platformConfig.loadingCaptcha = false
  }
}

const detectRemoteLoginConfig = async (platformConfig) => {
  if (platformConfig.platformType !== 'remote') return
  if (!platformConfig.apiBase || !platformConfig.osClient) {
    throw new Error('请先填写远程平台 ApiBase 和 OsClient')
  }
  if (platformConfig.loginConfigLoaded) return
  if (loginConfigRequests.has(platformConfig)) return loginConfigRequests.get(platformConfig)

  const request = (async () => {
    platformConfig.checkingLoginConfig = true
    try {
      const loginConfig = await fileSyncApi.getRemoteLoginConfig(platformConfig)
      platformConfig.loginConfigLoaded = true
      platformConfig.captchaRequired = loginConfig.captchaRequired
      if (loginConfig.captchaRequired) {
        await refreshRemoteCaptcha(platformConfig)
      } else {
        platformConfig.captchaId = ''
        platformConfig.captchaValue = ''
        platformConfig.captchaImage = ''
      }
    } finally {
      platformConfig.checkingLoginConfig = false
      loginConfigRequests.delete(platformConfig)
    }
  })()
  loginConfigRequests.set(platformConfig, request)
  return request
}

const handleRemoteEndpointBlur = async (platformConfig) => {
  if (!platformConfig.apiBase || !platformConfig.osClient || platformConfig.loginConfigLoaded) return
  try {
    await detectRemoteLoginConfig(platformConfig)
  } catch (error) {
    ElMessage.error(error.message || '检测远程登录配置失败')
  }
}

const preparePlatform = async (platformConfig, role = 'source') => {
  if (platformConfig.platformType === 'current') {
    return {
      platformType: 'current',
      apiBase: currentPlatform.apiBase,
      osClient: currentPlatform.osClient,
      authorization: ''
    }
  }

  if (!platformConfig.isLoggedIn || !platformConfig.authorization) {
    throw new Error('请先登录远程平台')
  }
  if (role === 'target' && !platformConfig.capability?.ProtocolVersion) {
    try {
      await validateRemoteCapability(platformConfig, role)
    } catch (error) {
      platformConfig.capabilityError = error.message || targetUpgradeMessage()
      throw error
    }
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
  const parentPath = normalizeFolder(folderPath)
  const canonicalParentPath = canonicalFolderPath(parentPath)
  const rows = new Map()

  const getDirectChildName = (fullPath, isFolder) => {
    const normalized = isFolder ? canonicalFolderPath(fullPath) : canonicalObjectPath(fullPath)
    if (!normalized || normalized === canonicalParentPath) return ''
    if (canonicalParentPath && !normalized.toLowerCase().startsWith(canonicalParentPath.toLowerCase())) return ''
    let relative = canonicalParentPath ? normalized.substring(canonicalParentPath.length) : normalized
    if (isFolder) relative = relative.replace(/\/+$/, '')
    return relative && !relative.includes('/') ? relative : ''
  }

  ;(result.Data.Folders || []).forEach(item => {
    const fullPath = normalizeFolder(item.FullPath || joinPath(parentPath, item.Name))
    const directName = getDirectChildName(fullPath, true)
    if (!directName) return
    const row = {
      id: folderNodeId(fullPath),
      name: item.Name || directName,
      isFolder: true,
      type: 'folder',
      size: 0,
      filePath: fullPath,
      children: []
    }
    rows.set(row.id, row)
  })

  if (includeFiles) {
    ;(result.Data.Files || []).forEach(item => {
      const fullPath = normalizeObjectPath(item.FullPath || joinPath(parentPath, item.Name))
      const directName = getDirectChildName(fullPath, false)
      if (!directName) return
      const row = {
        id: fileNodeId(fullPath),
        name: item.Name || directName,
        isFolder: false,
        type: item.Type || '',
        size: Number(item.Size || 0),
        filePath: fullPath,
        children: []
      }
      rows.set(row.id, row)
    })
  }

  return Array.from(rows.values())
}

const loadListData = async (platform, folderPath, limit, recursive = false) => {
  const folders = new Map()
  const files = new Map()
  let marker = ''
  let pageCount = 0
  let completed = false

  while (pageCount < 100) {
    const result = await fileSyncApi.listObjects(platform, folderPath, limit, '', marker, recursive)
    if (result.Code !== 1) {
      const error = new Error(result.Msg || '加载文件树失败')
      error.code = result.Code
      throw error
    }
    ;(result.Data?.Folders || []).forEach(item => {
      const path = canonicalFolderPath(item.FullPath || joinPath(folderPath, item.Name))
      if (path) folders.set(path, item)
    })
    ;(result.Data?.Files || []).forEach(item => {
      const path = normalizeObjectPath(item.FullPath || joinPath(folderPath, item.Name))
      if (path) files.set(path, item)
    })

    pageCount++
    if (!result.Data?.IsTruncated) {
      completed = true
      break
    }
    const nextMarker = String(result.Data.NextMarker || '')
    if (!nextMarker || nextMarker === marker) {
      throw new Error('目录分页标识异常，已停止加载')
    }
    marker = nextMarker
  }

  if (!completed) {
    throw new Error('目录数据量过大，已停止加载')
  }
  return {
    Folders: Array.from(folders.values()),
    Files: Array.from(files.values())
  }
}

const loadDirectoryRows = async (platform, folderPath, limit, includeFiles = true) => {
  const data = await loadListData(platform, folderPath, limit, false)
  return normalizeRows({ Code: 1, Data: data }, folderPath, includeFiles)
}

const buildFileTree = async (platform, rootPath, limit, includeFiles = true) => {
  const rootFolder = canonicalFolderPath(rootPath)
  const rootNode = {
    id: folderNodeId(rootFolder),
    name: displayNameFromPath(rootFolder, '根目录'),
    isFolder: true,
    type: 'folder',
    size: 0,
    filePath: rootFolder,
    root: true,
    children: []
  }

  const data = await loadListData(platform, rootFolder, limit, true)
  const folderNodes = new Map([[rootFolder, rootNode]])
  let nodeCount = 1
  let clipped = false

  const ensureFolderNode = (path) => {
    const folderPath = canonicalFolderPath(path)
    if (!folderPath || folderPath === rootFolder) return rootNode
    if (rootFolder && !folderPath.toLowerCase().startsWith(rootFolder.toLowerCase())) return null
    if (folderNodes.has(folderPath)) return folderNodes.get(folderPath)
    if (nodeCount >= MAX_TREE_NODES) {
      clipped = true
      return null
    }

    const parentPath = getParentFolderPath(folderPath)
    if (parentPath === folderPath) return null
    const parentNode = ensureFolderNode(parentPath)
    if (!parentNode) return null

    const node = {
      id: folderNodeId(folderPath),
      name: displayNameFromPath(folderPath),
      isFolder: true,
      type: 'folder',
      size: 0,
      filePath: folderPath,
      children: []
    }
    folderNodes.set(folderPath, node)
    parentNode.children.push(node)
    nodeCount++
    return node
  }

  data.Folders.forEach(item => {
    ensureFolderNode(item.FullPath || joinPath(rootFolder, item.Name))
  })

  if (includeFiles) {
    data.Files.forEach(item => {
      if (nodeCount >= MAX_TREE_NODES) {
        clipped = true
        return
      }
      const actualPath = normalizeObjectPath(item.FullPath || joinPath(rootFolder, item.Name))
      const logicalPath = canonicalObjectPath(actualPath)
      if (!logicalPath || (rootFolder && !logicalPath.toLowerCase().startsWith(rootFolder.toLowerCase()))) return
      const parentNode = ensureFolderNode(getParentFolderPath(logicalPath))
      if (!parentNode) return
      parentNode.children.push({
        id: fileNodeId(actualPath),
        name: item.Name || displayNameFromPath(logicalPath, '文件'),
        isFolder: false,
        type: item.Type || '',
        size: Number(item.Size || 0),
        filePath: actualPath,
        logicalPath,
        children: []
      })
      nodeCount++
    })
  }

  const sortChildren = (node) => {
    node.children.sort((left, right) => {
      if (left.isFolder !== right.isFolder) return left.isFolder ? -1 : 1
      return String(left.name || '').localeCompare(String(right.name || ''), 'zh-CN', { numeric: true })
    })
    node.children.filter(child => child.isFolder).forEach(sortChildren)
  }
  sortChildren(rootNode)

  if (clipped) {
    ElMessage.warning(`文件树较大，已加载前 ${MAX_TREE_NODES} 个节点`)
  }
  return [rootNode]
}

const loadSourceTree = async () => {
  loadingSource.value = true
  checkedSourceRows.value = []
  try {
    const sourcePlatform = await preparePlatform(form.source, 'source')
    const sourceRoot = normalizeFolder(String(sourcePlatform.osClient || '').toLowerCase())
    sourceTree.value = await buildFileTree(sourcePlatform, sourceRoot, form.source.limit, true)
    ElMessage.success('源文件树加载完成')
  } catch (error) {
    sourceTree.value = []
    if (form.source.platformType === 'remote' && error?.code === 1001) {
      await invalidateRemoteLogin(form.source, '远程 Token 已失效')
    }
    ElMessage.error(error.message || '加载源文件树失败')
  } finally {
    loadingSource.value = false
  }
}

const loadTargetTree = async () => {
  loadingTarget.value = true
  try {
    const targetPlatform = await preparePlatform(form.target, 'target')
    const rootPath = normalizeFolder(String(targetPlatform.osClient || '').toLowerCase())
    targetTree.value = await buildFileTree(targetPlatform, rootPath, form.target.limit, true)
    selectedTargetPath.value = rootPath
    selectedTargetNodeKey.value = folderNodeId(selectedTargetPath.value)
    ElMessage.success('目标文件树加载完成')
  } catch (error) {
    targetTree.value = []
    if (form.target.platformType === 'remote' && error?.code === 1001) {
      await invalidateRemoteLogin(form.target, '远程 Token 已失效')
    }
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
}

const handleTargetBucketChange = () => {
  const shouldReload = targetTree.value.length > 0
  targetTree.value = []
  selectedTargetPath.value = ''
  selectedTargetNodeKey.value = ''
  targetListCache = new Map()
  if (shouldReload) loadTargetTree()
}

const hasCheckedAncestor = (row, checkedFolderPaths) => {
  let parentPath = row.isFolder
    ? getParentFolderPath(canonicalFolderPath(row.filePath))
    : getParentFolderPath(row.logicalPath || canonicalObjectPath(row.filePath))

  while (parentPath) {
    if (checkedFolderPaths.has(canonicalFolderPath(parentPath))) return true
    parentPath = getParentFolderPath(parentPath)
  }
  return false
}

const getSelectedRootRows = () => {
  const checkedFolderPaths = new Set(
    checkedSourceRows.value
      .filter(row => row.isFolder)
      .map(row => canonicalFolderPath(row.filePath))
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

  const rows = await loadDirectoryRows(targetPlatform, normalizeFolder(targetFolder), form.target.limit, true)
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
    const sourcePlatform = await preparePlatform(form.source, 'source')
    const targetPlatform = await preparePlatform(form.target, 'target')
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
    max-height: calc(100vh - 150px);
    overflow-y: auto;
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

.remote-session {
  display: flex;
  flex-direction: column;
  gap: var(--mci-space-3, 10px);
}

.connection-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  gap: var(--mci-space-2, 8px);

  .el-select {
    width: 100%;
  }
}

.login-identity {
  min-height: 58px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--mci-space-3, 10px);
  padding: var(--mci-space-3, 10px) var(--mci-space-4, 12px);
  border: 1px solid var(--mci-color-success-border, #bce8d1);
  border-radius: var(--mci-shape-panel, 8px);
  background: var(--mci-color-success-soft, #eefaf4);
}

.identity-copy {
  min-width: 0;

  strong,
  span {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  strong {
    color: var(--mci-text-primary, #183247);
    font-size: 14px;
  }

  span {
    margin-top: 3px;
    color: var(--mci-text-secondary, #687b8d);
    font-size: 12px;
  }
}

.login-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mci-space-3, 10px);

  span {
    color: var(--mci-text-tertiary, #7b8b9b);
    font-size: 12px;
  }
}

.captcha-field {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 128px;
  gap: 10px;
}

.captcha-image {
  height: 40px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--mci-border-color, #d8e2ec);
  border-radius: var(--mci-shape-input, 6px);
  background: var(--mci-bg-elevated, #ffffff);
  color: var(--mci-color-primary, #20b26b);
  cursor: pointer;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.bucket-switch {
  width: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border: 1px solid var(--mci-border-color, #dfe8f1);
  border-radius: var(--mci-shape-panel, 8px);
  background: var(--mci-bg-surface, #edf2f7);

  :deep(.el-radio-button__inner) {
    width: 100%;
    height: 38px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--mci-text-secondary, #536579);
    font-weight: 700;
    line-height: 1;
    box-shadow: none;
  }

  :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: var(--mci-color-primary, #20b26b);
    color: var(--mci-text-on-primary, #ffffff);
    box-shadow: var(--mci-shadow-button, 0 7px 16px rgba(32, 178, 107, 0.22));
  }
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

@media (max-width: 700px) {
  .credential-grid {
    grid-template-columns: 1fr;
  }

  .captcha-field {
    grid-template-columns: minmax(0, 1fr) 112px;
  }

  .login-identity {
    grid-template-columns: auto minmax(0, 1fr) auto;

    .el-avatar {
      grid-row: 1 / 3;
    }

    .el-tag {
      grid-column: 2;
      justify-self: start;
    }

    .el-button {
      grid-column: 3;
      grid-row: 1 / 3;
    }
  }
}
</style>
