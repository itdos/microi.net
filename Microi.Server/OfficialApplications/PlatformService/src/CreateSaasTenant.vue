<template>
  <main class="tenant-app">
    <section v-if="loading" class="tenant-skeleton" aria-label="正在加载创建 SaaS 租户页面" aria-busy="true">
      <div class="tenant-skeleton__intro"><i></i><div><b></b><span></span></div></div>
      <div class="tenant-skeleton__form">
        <div v-for="item in 7" :key="item" class="tenant-skeleton__field"><b></b><span></span></div>
        <div class="tenant-skeleton__footer"><i></i><i></i></div>
      </div>
    </section>
    <template v-else>
    <section class="intro">
      <span class="intro__icon" aria-hidden="true">▦</span>
      <div>
        <h1>创建 SaaS 租户</h1>
        <p>可使用吾码官方标准空库，也可上传一个仅含单个 SQL 文件的 ZIP 数据库包。</p>
      </div>
    </section>

    <section v-if="task.Id" class="tenant-task" aria-live="polite">
      <header class="tenant-task__head">
        <span :class="['tenant-task__status', `is-${statusTone(task.Status)}`]">{{ statusText(task.Status) }}</span>
        <div><strong>{{ task.Title || `创建 SaaS 租户：${submittedTenantKey}` }}</strong><small>任务 {{ task.Id }}</small></div>
        <b>{{ progress }}%</b>
      </header>
      <div class="tenant-task__progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ transform: `scaleX(${progress / 100})` }"></i></div>
      <div class="tenant-task__meta">
        <span><b>{{ task.Current || 0 }}</b> / {{ task.Total || '—' }} 步</span>
        <span>已用时 {{ task.ElapsedText || '等待统计' }}</span>
        <span v-if="task.RemainingText">预计剩余 {{ task.RemainingText }}</span>
        <span v-if="task.HeartbeatTime" :title="`服务端心跳：${task.HeartbeatTime}`">服务端心跳 {{ heartbeatText }}</span>
      </div>
      <p class="tenant-task__message">{{ taskMessage || '任务已进入持久队列，正在等待 Worker 执行。' }}</p>

      <section v-if="task.Status === 'Succeeded' && tenantLaunchProjection" class="tenant-task__launch">
        <header>
          <div><span>安全启动地址</span><strong>{{ tenantLaunchProjection.LaunchUrl || '当前宿主未提供可信 Web/API 运行地址' }}</strong></div>
          <b>自定义域待绑定</b>
        </header>
        <a v-if="tenantLaunchProjection.LaunchUrlAvailable" :href="tenantLaunchProjection.LaunchUrl" target="_blank" rel="noopener noreferrer">立即进入新租户</a>
        <p>{{ tenantLaunchProjection.DomainBindingMessage }}</p>
        <small>裸域 {{ tenantLaunchProjection.BareDomainUrl || taskResult?.Data?.DomainName || '未登记' }} · {{ tenantLaunchProjection.DomainBindingStatus }}</small>
      </section>

      <section v-if="upgradeProjection" class="tenant-task__versions">
        <div><span>升级前版本</span><strong>{{ versionText(upgradeProjection.BeforeVersion) }}</strong></div>
        <div><span>目标版本</span><strong>{{ versionText(upgradeProjection.TargetVersion) }}</strong></div>
        <div><span>升级后版本</span><strong>{{ versionText(upgradeProjection.AfterVersion) }}</strong></div>
        <div><span>执行结论</span><strong>{{ upgradeProjection.AlreadyCurrent ? '版本已覆盖，完成运行时复检' : '升级完成' }}</strong></div>
      </section>

      <details class="tenant-task__log" :open="!isTerminal(task.Status)">
        <summary>执行记录（{{ taskLogLineCount }} 条）</summary>
        <pre>{{ renderedTaskLog || '等待任务写入执行记录…' }}</pre>
      </details>
      <p v-if="taskFailure" class="submit-error">{{ taskFailure }}</p>
      <details v-if="taskFailureDetails" class="tenant-task__log tenant-task__error-details">
        <summary>原始错误详情（供开发人员排查）</summary>
        <pre>{{ taskFailureDetails }}</pre>
      </details>
      <footer>
        <button v-if="!isTerminal(task.Status)" class="button button--ghost" type="button" :disabled="canceling" @click="cancelTask">{{ canceling ? '正在请求停止…' : '停止任务' }}</button>
        <button v-if="isTerminal(task.Status)" class="button button--primary" type="button" @click="closeTask">关闭</button>
      </footer>
    </section>

    <form v-else class="tenant-form" @submit.prevent="submit">
      <label class="field field--wide">
        <span>OsClient <em>*</em><small>租户唯一标识</small></span>
        <input v-model.trim="form.TenantKey" placeholder="例如 customer_a" autocomplete="off" @input="syncDomain" />
        <b v-if="errors.TenantKey">{{ errors.TenantKey }}</b>
      </label>

      <label class="field field--wide">
        <span>系统名称 <em>*</em></span>
        <input v-model.trim="form.SystemName" placeholder="例如 客户 A 业务系统" autocomplete="off" />
        <b v-if="errors.SystemName">{{ errors.SystemName }}</b>
      </label>

      <label class="field field--wide">
        <span>admin 密码 <em>*</em><small>至少 6 位</small></span>
        <div class="password-input">
          <input v-model="form.AdminPassword" :type="showPassword ? 'text' : 'password'" placeholder="用于初始化数据库中的 admin 账号" autocomplete="new-password" />
          <button type="button" :aria-label="showPassword ? '隐藏 admin 密码' : '显示 admin 密码'" @click="showPassword = !showPassword">{{ showPassword ? '隐藏' : '显示' }}</button>
        </div>
        <b v-if="errors.AdminPassword">{{ errors.AdminPassword }}</b>
      </label>

      <fieldset class="database-source">
        <legend>数据库来源 <em>*</em></legend>
        <label :class="{ 'is-selected': databaseSource === 'empty' }">
          <input v-model="databaseSource" type="radio" value="empty" />
          <span><strong>吾码官方标准空库</strong><small>自动获取最新 MySQL 空库模板</small></span>
        </label>
        <label :class="{ 'is-selected': databaseSource === 'zip' }">
          <input v-model="databaseSource" type="radio" value="zip" />
          <span><strong>上传数据库 ZIP</strong><small>适用于带业务表和数据的成熟吾码数据库</small></span>
        </label>
      </fieldset>

      <label v-if="databaseSource === 'zip'" class="database-upload" :class="{ 'has-file': databaseZip, 'is-disabled': uploadState.active }">
        <input type="file" accept=".zip,application/zip,application/x-zip-compressed" :disabled="uploadState.active" @change="selectDatabaseZip" />
        <span class="database-upload__icon" aria-hidden="true">⇧</span>
        <strong>{{ databaseZip ? databaseZip.name : '选择数据库 ZIP 包' }}</strong>
        <small>{{ databaseZip ? `${formatBytes(databaseZip.size)} · 16MB 分片断点续传` : 'ZIP 内必须且只能有一个 UTF-8 编码的 .sql 文件' }}</small>
      </label>
      <b v-if="errors.DatabaseZip" class="database-upload-error">{{ errors.DatabaseZip }}</b>
      <section v-if="databaseSource === 'zip' && uploadState.total" class="database-upload-progress" aria-live="polite">
        <header>
          <div><strong>{{ uploadState.message || '准备断点上传' }}</strong><small>{{ formatBytes(uploadState.loaded) }} / {{ formatBytes(uploadState.total) }}</small></div>
          <b>{{ Math.round(uploadState.percent) }}%</b>
        </header>
        <div class="database-upload-progress__bar" role="progressbar" :aria-valuenow="Math.round(uploadState.percent)" aria-valuemin="0" aria-valuemax="100">
          <i :style="{ transform: `scaleX(${uploadState.percent / 100})` }"></i>
        </div>
        <footer>
          <span>{{ uploadState.sessionId ? `会话 ${uploadState.sessionId}` : '正在建立安全上传会话' }}</span>
          <button v-if="uploadState.active" type="button" @click="pauseUpload">暂停上传</button>
          <span v-else-if="uploadState.percent > 0 && uploadState.percent < 100">再次点击“开始创建”将从已完成分片继续</span>
        </footer>
      </section>

      <div class="grid">
        <label class="field">
          <span>OsClientType <em>*</em></span>
          <input v-model.trim="form.OsClientType" autocomplete="off" />
          <b v-if="errors.OsClientType">{{ errors.OsClientType }}</b>
        </label>
        <label class="field">
          <span>OsClientNetwork <em>*</em><small>当前配置，可修改</small></span>
          <input v-model.trim="form.OsClientNetwork" placeholder="例如 Internal 或 Internet" autocomplete="off" />
          <b v-if="errors.OsClientNetwork">{{ errors.OsClientNetwork }}</b>
        </label>
      </div>

      <div class="grid">
        <label class="field">
          <span>域名 <small>可选，仅登记；需单独完成 DNS/证书/网关绑定</small></span>
          <input v-model.trim="form.DomainName" placeholder="留空登记为 OsClient.microi.net（不代表已绑定）" autocomplete="off" />
          <b v-if="errors.DomainName">{{ errors.DomainName }}</b>
        </label>
        <label class="field">
          <span>归属手机号 <small>可选</small></span>
          <input v-model.trim="form.OwnerPhone" placeholder="用于记录租户归属，可留空" autocomplete="tel" />
        </label>
      </div>

      <aside class="notice"><span>✓</span><p>数据库类型固定为 MySql。ZIP 默认支持 500MB，可在 SaaS 引擎系统设置中配置为 1GB 或 2GB；分片上传支持进度显示与断点续传。恢复库中的定时任务会先暂停，任一步骤失败都会自动补偿回滚。</p></aside>
      <p v-if="submitError" class="submit-error">{{ submitError }}</p>

      <footer>
        <button class="button button--ghost" type="button" :disabled="submitting" @click="cancel">取消</button>
        <button class="button button--primary" type="submit" :disabled="submitting">
          <span v-if="submitting" class="spinner"></span>{{ submittingText }}
        </button>
      </footer>
    </form>
    </template>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { configureV8, dispatch, getContext } from './microi'
import { buildTenantLaunchProjection, normalizeHttpRuntimeBase } from './tenant-launch-url'
import { splitTenantProvisioningError } from './tenant-provisioning-error'

const loading = ref(true)
const submitting = ref(false)
const submittingText = ref('开始创建')
const showPassword = ref(false)
const databaseSource = ref('empty')
const databaseZip = ref(null)
const uploadState = reactive({ active: false, percent: 0, loaded: 0, total: 0, phase: '', sessionId: '', message: '' })
const submitError = ref('')
const errors = reactive({})
const form = reactive({ TenantKey: '', SystemName: '', AdminPassword: '', OsClientType: 'Product', OsClientNetwork: 'Internal', DomainName: '', OwnerPhone: '', DbType: 'MySql' })
const task = reactive({ Id: '', Title: '', Status: '', Progress: 0, Current: 0, Total: 0, Msg: '', ElapsedText: '', RemainingText: '', HeartbeatTime: '', Error: '' })
const taskLog = ref('')
const taskResult = ref(null)
const canceling = ref(false)
const submittedTenantKey = ref('')
const heartbeatNow = ref(Date.now())
const runtimeLaunchContext = reactive({ apiBase: '', webBase: '' })
let domainWasAuto = true
let pollTimer = 0
let pollBusy = false
let uploadAbortController = null

const terminalStatuses = new Set(['Succeeded', 'Failed', 'Canceled', 'Interrupted'])
const progress = computed(() => Math.max(0, Math.min(100, Number(task.Progress || 0))))
const taskLogLines = computed(() => taskLog.value.split('\n').filter(Boolean))
const taskLogLineCount = computed(() => taskLogLines.value.length)
const renderedTaskLog = computed(() => {
  const lines = taskLogLines.value
  if (lines.length <= 200) return lines.join('\n')
  return `[前 ${lines.length - 200} 条记录已折叠，避免大量 DOM 节点拖慢页面]\n${lines.slice(-200).join('\n')}`
})
const heartbeatText = computed(() => {
  const raw = text(task.HeartbeatTime)
  if (!raw) return ''
  const timestamp = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T')).getTime()
  if (!Number.isFinite(timestamp)) return raw
  const age = Math.max(0, Math.floor((heartbeatNow.value - timestamp) / 1000))
  if (age < 10) return '刚刚'
  if (age < 60) return `${age} 秒前`
  return `${Math.floor(age / 60)} 分钟前`
})
const upgradeProjection = computed(() => taskResult.value?.Data?.Upgrade || taskResult.value?.Data?.upgrade || null)
const tenantLaunchProjection = computed(() => {
  const data = taskResult.value?.Data || {}
  const osClient = text(data.OsClient || submittedTenantKey.value)
  if (!osClient) return null
  try {
    return buildTenantLaunchProjection({
      apiBase: runtimeLaunchContext.apiBase,
      webBase: runtimeLaunchContext.webBase,
      osClient,
      domainName: data.DomainName || form.DomainName
    })
  } catch {
    return null
  }
})
const taskFailureRaw = computed(() => {
  if (!isTerminal(task.Status) || task.Status === 'Succeeded') return ''
  return task.Error || taskResult.value?.Msg || task.Msg || '任务未成功完成，请查看执行记录。'
})
const taskFailure = computed(() => splitTenantProvisioningError(taskFailureRaw.value).summary)
const taskFailureDetails = computed(() => splitTenantProvisioningError(taskFailureRaw.value).details)
const taskMessage = computed(() => splitTenantProvisioningError(task.Msg).summary)

function text(value) { return value == null ? '' : String(value).trim() }
function isTerminal(status) { return terminalStatuses.has(String(status || '')) }
function resolveHostWebBase(context) {
  const candidates = [context?.webBase]
  try {
    if (window.parent && window.parent !== window) candidates.push(window.parent.location.origin)
  } catch {}
  try {
    if (document.referrer) candidates.push(new URL(document.referrer).origin)
  } catch {}
  for (const candidate of candidates) {
    try {
      const normalized = normalizeHttpRuntimeBase(candidate, 'WebBase')
      if (normalized) return normalized
    } catch {}
  }
  return ''
}

function applyRuntimeLaunchContext(context) {
  try {
    runtimeLaunchContext.apiBase = normalizeHttpRuntimeBase(context?.apiBase, 'ApiBase')
  } catch {
    runtimeLaunchContext.apiBase = ''
  }
  runtimeLaunchContext.webBase = resolveHostWebBase(context)
}

function versionText(value) { return text(value) || '未记录' }
function statusText(status) {
  return ({ Pending: '等待入队', Queued: '排队中', Running: '执行中', Succeeded: '已成功', Failed: '失败', Canceled: '已停止', Interrupted: '已中断' })[status] || status || '等待中'
}
function statusTone(status) {
  if (status === 'Succeeded') return 'success'
  if (['Failed', 'Interrupted'].includes(status)) return 'danger'
  if (status === 'Canceled') return 'muted'
  return 'running'
}

function applyTask(data) {
  if (!data || typeof data !== 'object') return
  Object.keys(task).forEach(key => {
    if (data[key] !== undefined && data[key] !== null) task[key] = data[key]
  })
  if (data.Log !== undefined) taskLog.value = text(data.Log)
  if (data.Result && typeof data.Result === 'object') taskResult.value = data.Result
}

async function refreshTask() {
  if (!task.Id || pollBusy || isTerminal(task.Status)) return
  pollBusy = true
  try {
    const result = await configureV8().post('/apiengine/platform-background-task', { Action: 'Detail', Id: task.Id })
    if (result?.Code === 1) applyTask(result.Data)
    else submitError.value = result?.Msg || '读取后台任务详情失败，稍后将自动重试。'
  } catch (error) {
    submitError.value = error?.message || '读取后台任务详情失败，稍后将自动重试。'
  } finally {
    heartbeatNow.value = Date.now()
    pollBusy = false
    if (task.Id && !isTerminal(task.Status)) {
      window.clearTimeout(pollTimer)
      pollTimer = window.setTimeout(refreshTask, 1500)
    }
  }
}

function syncDomain() {
  if (domainWasAuto || !form.DomainName) {
    form.DomainName = form.TenantKey ? `${form.TenantKey}.microi.net` : ''
    domainWasAuto = true
  }
}

function validate() {
  Object.keys(errors).forEach(key => delete errors[key])
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(form.TenantKey)) errors.TenantKey = '必须以英文字母开头，只能包含字母、数字、-、_'
  if (!form.SystemName) errors.SystemName = '请输入系统名称'
  if (!form.AdminPassword || form.AdminPassword.length < 6) errors.AdminPassword = '密码长度不能少于 6 位'
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(form.OsClientType)) errors.OsClientType = '格式不正确'
  if (!form.OsClientNetwork || form.OsClientNetwork.length > 50 || !/^[A-Za-z][A-Za-z0-9_.-]*$/.test(form.OsClientNetwork)) errors.OsClientNetwork = '只能包含字母、数字、-、_、.'
  if (form.DomainName && (!/^[A-Za-z0-9.-]+$/.test(form.DomainName) || form.DomainName.includes('..'))) errors.DomainName = '请只填写域名，不要包含协议或路径'
  if (databaseSource.value === 'zip') {
    const file = databaseZip.value
    if (!file) errors.DatabaseZip = '请选择数据库 ZIP 包'
    else if (!/\.zip$/i.test(file.name || '')) errors.DatabaseZip = '数据库包必须是 .zip 文件'
    else if (!Number(file.size)) errors.DatabaseZip = '数据库 ZIP 不能为空'
    else if (Number(file.size) > 2 * 1024 * 1024 * 1024) errors.DatabaseZip = '数据库 ZIP 不能超过平台绝对上限 2GB'
  }
  return Object.keys(errors).length === 0
}

function selectDatabaseZip(event) {
  delete errors.DatabaseZip
  const file = event?.target?.files?.[0] || null
  databaseZip.value = file
  Object.assign(uploadState, { active: false, percent: 0, loaded: 0, total: Number(file?.size || 0), phase: '', sessionId: '', message: '' })
  if (!file) return
  if (!/\.zip$/i.test(file.name || '')) errors.DatabaseZip = '数据库包必须是 .zip 文件'
  else if (!file.size) errors.DatabaseZip = '数据库 ZIP 不能为空'
}

function applyUploadProgress(value) {
  Object.assign(uploadState, {
    active: value?.phase !== 'completed',
    percent: Number(value?.percent || 0),
    loaded: Number(value?.loaded || 0),
    total: Number(value?.total || databaseZip.value?.size || 0),
    phase: text(value?.phase),
    sessionId: text(value?.sessionId || uploadState.sessionId),
    message: text(value?.message)
  })
  if (uploadState.phase === 'fingerprinting') submittingText.value = '正在生成续传指纹...'
  else if (uploadState.phase === 'verifying') submittingText.value = `正在校验分片 ${Math.round(uploadState.percent)}%`
  else if (uploadState.phase === 'completing') submittingText.value = '正在合并并校验 ZIP...'
  else if (uploadState.phase === 'retrying') submittingText.value = '连接恢复中...'
  else if (uploadState.phase !== 'completed') submittingText.value = `正在上传 ZIP ${Math.round(uploadState.percent)}%`
}

function pauseUpload() {
  if (uploadAbortController) uploadAbortController.abort()
}

function formatBytes(bytes) {
  const size = Number(bytes || 0)
  if (size <= 0) return '0 B'
  if (size < 1024 * 1024) return `${Math.max(1, Math.round(size / 1024))} KB`
  return `${(size / 1024 / 1024).toFixed(size >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

async function submit() {
  submitError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    const V8 = configureV8()
    let databaseZipPath = ''
    if (databaseSource.value === 'zip') {
      uploadAbortController = typeof AbortController !== 'undefined' ? new AbortController() : null
      uploadState.active = true
      uploadState.total = Number(databaseZip.value?.size || 0)
      submittingText.value = '正在建立断点上传...'
      const uploadResult = await V8.uploadTenantDatabaseZip(databaseZip.value, {
        file: databaseZip.value,
        signal: uploadAbortController?.signal,
        onProgress: applyUploadProgress
      })
      uploadState.active = false
      const uploadData = Array.isArray(uploadResult?.Data) ? uploadResult.Data[0] : uploadResult?.Data
      databaseZipPath = text(uploadData?.Path || uploadData?.FilePathName || uploadData?.FilePath)
      if (!databaseZipPath) throw new Error('数据库 ZIP 上传成功，但未返回私有文件路径')
    }
    submittingText.value = '正在提交后台任务...'
    const result = await V8.post('/apiengine/platform-background-task', {
      Action: 'RunApiEngine',
      TargetApiEngineKey: 'admin_create_empty_saas_tenant',
      Param: {
        ...form,
        DomainName: form.DomainName || `${form.TenantKey}.microi.net`,
        RuntimeApiBase: runtimeLaunchContext.apiBase,
        RuntimeWebBase: runtimeLaunchContext.webBase,
        DatabaseSource: databaseSource.value === 'zip' ? 'CustomZip' : 'OfficialEmpty',
        DatabaseZipPath: databaseZipPath,
        DatabaseZipName: databaseZip.value?.name || ''
      },
      Title: `创建 SaaS 租户：${form.TenantKey}`
    })
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '任务提交失败')
    submittedTenantKey.value = form.TenantKey
    applyTask(result.Data)
    if (!task.Id) throw new Error('任务提交成功，但未返回后台任务 Id')
    form.AdminPassword = ''
    showPassword.value = false
    dispatch('background-task:created', result.Data, { force: true })
    await refreshTask()
  } catch (error) {
    uploadState.active = false
    submitError.value = error?.name === 'AbortError'
      ? '上传已暂停，服务端保留已完成分片；再次点击“开始创建”即可断点续传。'
      : (error?.message || String(error))
  } finally {
    uploadAbortController = null
    submitting.value = false
    submittingText.value = '开始创建'
  }
}

function cancel() {
  if (uploadAbortController) uploadAbortController.abort()
  dispatch('app-dialog:cancel')
}

async function cancelTask() {
  if (!task.Id || isTerminal(task.Status)) return
  canceling.value = true
  try {
    const result = await configureV8().post('/apiengine/platform-background-task', { Action: 'Cancel', Id: task.Id })
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '停止任务失败')
    task.Msg = result.Msg || '已请求停止，等待当前安全步骤结束。'
    await refreshTask()
  } catch (error) {
    submitError.value = error?.message || String(error)
  } finally {
    canceling.value = false
  }
}

function closeTask() {
  const data = taskResult.value?.Data || {}
  if (task.Status === 'Succeeded') {
    dispatch('app-dialog:success', { ...data, ...(tenantLaunchProjection.value || {}), OsClient: data.OsClient || submittedTenantKey.value, TaskId: task.Id, message: taskResult.value?.Msg || task.Msg })
  } else {
    dispatch('app-dialog:cancel', { TaskId: task.Id, Status: task.Status })
  }
}

onMounted(async () => {
  try {
    const context = getContext()
    applyRuntimeLaunchContext(context)
    const initial = context.dialogData || {}
    Object.keys(form).forEach(key => { if (initial[key] !== undefined) form[key] = initial[key] })
    if (initial.DatabaseSource === 'CustomZip') databaseSource.value = 'zip'
    const V8 = configureV8()
    const result = await V8.post('/api/Os/GetOsClient', {})
    const environment = result?.Data && typeof result.Data === 'object' ? result.Data : result || {}
    form.OsClientType = text(initial.OsClientType || environment.OsClientType || 'Product') || 'Product'
    form.OsClientNetwork = text(initial.OsClientNetwork || environment.OsClientNetwork || 'Internal') || 'Internal'
  } catch (error) {
    submitError.value = '未能读取当前环境配置，已使用默认值，可继续手动填写。'
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  if (uploadAbortController) uploadAbortController.abort()
  window.clearTimeout(pollTimer)
})
</script>

<style scoped>
.tenant-task__message, .submit-error { white-space: pre-line; overflow-wrap: anywhere; }
</style>
