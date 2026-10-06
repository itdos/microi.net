<template>
  <main class="tenant-app">
    <section class="intro">
      <span class="intro__icon" aria-hidden="true">↥</span>
      <div>
        <h1>升级租户数据库</h1>
        <p>读取租户数据库中的 ServerVersion，只执行尚未覆盖的版本迁移，并复检当前后端依赖的运行时结构。</p>
      </div>
    </section>

    <section v-if="!task.Id" class="tenant-form tenant-upgrade-confirm">
      <div class="tenant-upgrade-target">
        <div><span>租户</span><strong>{{ target.TenantKey || '未选择' }}</strong></div>
        <div><span>记录 Id</span><strong>{{ target.TenantId || '未提供' }}</strong></div>
        <div><span>运行类型</span><strong>{{ target.OsClientType || '—' }}</strong></div>
        <div><span>运行网络</span><strong>{{ target.OsClientNetwork || '—' }}</strong></div>
      </div>
      <aside class="notice"><span>✓</span><p>已执行过的版本门禁会直接跳过；只有全部待执行迁移成功后才会前向更新 ServerVersion。数据库连接串和密码不会进入微服务、任务参数或执行日志。</p></aside>
      <p v-if="submitError" class="submit-error">{{ submitError }}</p>
      <footer>
        <button class="button button--ghost" type="button" :disabled="submitting" @click="close">取消</button>
        <button class="button button--primary" type="button" :disabled="submitting || !canStart" @click="start">
          <span v-if="submitting" class="spinner"></span>{{ submitting ? '正在提交…' : '开始升级检查' }}
        </button>
      </footer>
    </section>

    <section v-else class="tenant-task" aria-live="polite">
      <header class="tenant-task__head">
        <span :class="['tenant-task__status', `is-${statusTone(task.Status)}`]">{{ statusText(task.Status) }}</span>
        <div><strong>{{ task.Title || `升级租户数据库：${target.TenantKey}` }}</strong><small>任务 {{ task.Id }}</small></div>
        <b>{{ progress }}%</b>
      </header>
      <div class="tenant-task__progress" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100"><i :style="{ transform: `scaleX(${progress / 100})` }"></i></div>
      <div class="tenant-task__meta">
        <span><b>{{ task.Current || 0 }}</b> / {{ task.Total || '—' }} 步</span>
        <span>已用时 {{ task.ElapsedText || '等待统计' }}</span>
        <span v-if="task.RemainingText">预计剩余 {{ task.RemainingText }}</span>
      </div>
      <p class="tenant-task__message">{{ task.Msg || '任务已进入持久队列。' }}</p>

      <section v-if="upgradeProjection" class="tenant-task__versions">
        <div><span>升级前版本</span><strong>{{ versionText(upgradeProjection.BeforeVersion) }}</strong></div>
        <div><span>当前后端目标版本</span><strong>{{ versionText(upgradeProjection.TargetVersion) }}</strong></div>
        <div><span>升级后版本</span><strong>{{ versionText(upgradeProjection.AfterVersion) }}</strong></div>
        <div><span>执行结论</span><strong>{{ upgradeProjection.AlreadyCurrent ? '无需重复迁移，运行时复检通过' : '待执行迁移已全部完成' }}</strong></div>
      </section>

      <details class="tenant-task__log" :open="!isTerminal(task.Status)">
        <summary>执行记录（{{ taskLog ? taskLog.split('\n').filter(Boolean).length : 0 }} 条）</summary>
        <pre>{{ taskLog || '等待任务写入执行记录…' }}</pre>
      </details>
      <p v-if="taskFailure" class="submit-error">{{ taskFailure }}</p>
      <footer>
        <button v-if="!isTerminal(task.Status)" class="button button--ghost" type="button" :disabled="canceling" @click="cancelTask">{{ canceling ? '正在请求停止…' : '停止任务' }}</button>
        <button v-if="isTerminal(task.Status)" class="button button--primary" type="button" @click="close">关闭</button>
      </footer>
    </section>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { configureV8, dispatch, getContext } from './microi'

const target = reactive({ TenantId: '', TenantKey: '', OsClientType: '', OsClientNetwork: '' })
const task = reactive({ Id: '', Title: '', Status: '', Progress: 0, Current: 0, Total: 0, Msg: '', ElapsedText: '', RemainingText: '', Error: '' })
const taskLog = ref('')
const taskResult = ref(null)
const submitError = ref('')
const submitting = ref(false)
const canceling = ref(false)
let pollTimer = 0
let pollBusy = false

const terminalStatuses = new Set(['Succeeded', 'Failed', 'Canceled', 'Interrupted'])
const canStart = computed(() => Boolean(target.TenantId && target.TenantKey && target.OsClientType && target.OsClientNetwork))
const progress = computed(() => Math.max(0, Math.min(100, Number(task.Progress || 0))))
const upgradeProjection = computed(() => taskResult.value?.Data || null)
const taskFailure = computed(() => {
  if (!isTerminal(task.Status) || task.Status === 'Succeeded') return ''
  return task.Error || taskResult.value?.Msg || task.Msg || '任务未成功完成，请查看执行记录。'
})

function text(value) { return value == null ? '' : String(value).trim() }
function isTerminal(status) { return terminalStatuses.has(String(status || '')) }
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
    pollBusy = false
    if (task.Id && !isTerminal(task.Status)) {
      window.clearTimeout(pollTimer)
      pollTimer = window.setTimeout(refreshTask, 1500)
    }
  }
}

async function start() {
  submitError.value = ''
  if (!canStart.value) {
    submitError.value = '当前行缺少租户 Id、OsClientType 或 OsClientNetwork，请刷新列表后重试。'
    return
  }
  submitting.value = true
  try {
    const result = await configureV8().post('/apiengine/platform-background-task', {
      Action: 'RunApiEngine',
      TargetApiEngineKey: 'admin_upgrade_saas_tenant_database',
      Param: { ...target },
      Title: `升级租户数据库：${target.TenantKey}`
    })
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '任务提交失败')
    applyTask(result.Data)
    if (!task.Id) throw new Error('任务提交成功，但未返回后台任务 Id')
    dispatch('background-task:created', result.Data, { force: true })
    await refreshTask()
  } catch (error) {
    submitError.value = error?.message || String(error)
  } finally {
    submitting.value = false
  }
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

function close() {
  if (task.Status === 'Succeeded') {
    dispatch('app-dialog:success', { ...(taskResult.value?.Data || {}), TaskId: task.Id, OsClient: target.TenantKey })
  } else {
    dispatch('app-dialog:cancel', task.Id ? { TaskId: task.Id, Status: task.Status } : {})
  }
}

onMounted(() => {
  const initial = getContext().dialogData || {}
  target.TenantId = text(initial.TenantId || initial.Id)
  target.TenantKey = text(initial.TenantKey || initial.OsClient || initial.Key)
  target.OsClientType = text(initial.OsClientType)
  target.OsClientNetwork = text(initial.OsClientNetwork)
})

onBeforeUnmount(() => window.clearTimeout(pollTimer))
</script>
