<template>
  <main class="mci-backup-page mci-page" data-mci-ui-root>
    <header class="mci-backup-hero">
      <div class="mci-backup-hero__icon" aria-hidden="true">▤</div>
      <div class="mci-backup-hero__copy">
        <p class="mci-backup-eyebrow">DATABASE PROTECTION</p>
        <h1>数据库定时备份</h1>
        <p>全部 SaaS 数据库串行备份，上传至主租户 HDFS 私有桶；在线一致性快照和资源节流避免阻塞业务。</p>
      </div>
      <div class="mci-backup-hero__badges" aria-label="备份安全特性">
        <span>全库串行</span><span>跨节点租约</span><span>私有存储</span>
      </div>
    </header>

    <nav class="mci-backup-tabs" aria-label="数据库备份功能">
      <button :class="{ 'is-active': activeTab === 'settings' }" type="button" @click="activeTab = 'settings'">备份设置</button>
      <button :class="{ 'is-active': activeTab === 'records' }" type="button" @click="openRecords">备份记录 <span v-if="runningCount">{{ runningCount }}</span></button>
    </nav>

    <Teleport to="body">
      <Transition name="mci-backup-feedback">
        <section v-if="toast.text" class="mci-backup-toast" :class="`is-${toast.type}`" :role="toast.type === 'danger' ? 'alert' : 'status'" aria-live="assertive">
          <span class="mci-backup-toast__icon" aria-hidden="true">{{ toast.type === 'danger' ? '!' : '✓' }}</span>
          <div><strong>{{ toast.type === 'danger' ? '操作未完成' : '操作成功' }}</strong><p>{{ toast.text }}</p></div>
          <button type="button" aria-label="关闭提示" @click="toast.text = ''">×</button>
        </section>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="mci-backup-confirm">
        <div v-if="confirmState.open" class="mci-backup-confirm-mask" @click.self="resolveConfirmation(false)">
          <section ref="confirmDialogRef" class="mci-backup-confirm" role="alertdialog" aria-modal="true" aria-labelledby="mci-backup-confirm-title" tabindex="-1" @keydown.esc="resolveConfirmation(false)">
            <div class="mci-backup-confirm__icon" aria-hidden="true">▶</div>
            <p class="mci-backup-eyebrow">DATABASE BACKUP</p>
            <h2 id="mci-backup-confirm-title">{{ confirmState.title }}</h2>
            <strong>{{ confirmState.scope }}</strong>
            <p>{{ confirmState.message }}</p>
            <footer>
              <button class="mci-button mci-button--ghost" type="button" @click="resolveConfirmation(false)">取消</button>
              <button class="mci-button mci-button--primary" type="button" @click="resolveConfirmation(true)">确认并提交</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <section v-if="activeTab === 'settings'" class="mci-backup-panel mci-fade-up">
      <div v-if="loadingSettings" class="mci-backup-skeleton" aria-label="正在加载备份设置">
        <i v-for="n in 6" :key="n"></i>
      </div>
      <form v-else @submit.prevent="saveSettings">
        <div class="mci-backup-section-title">
          <div><h2>计划任务</h2><p>平台只维护这一条固定任务，修改设置会同步刷新任务调度器。</p></div>
          <label class="mci-backup-switch"><input v-model="settings.Enabled" type="checkbox"><span aria-hidden="true"></span><b>{{ settings.Enabled ? '已启用' : '已停用' }}</b></label>
        </div>

        <div class="mci-backup-form-grid">
          <label class="mci-backup-field">
            <span>执行周期</span>
            <select v-model="settings.ScheduleType">
              <option value="Daily">每天</option><option value="EveryNDays">N 天</option>
              <option value="Hourly">每小时</option><option value="EveryNHours">N 小时</option>
              <option value="Weekly">每周</option>
              <option value="Monthly">每月</option><option value="Custom">自定义 Cron</option>
            </select>
          </label>
          <label v-if="['EveryNDays','EveryNHours'].includes(settings.ScheduleType)" class="mci-backup-field">
            <span>间隔数</span><input v-model.number="settings.Interval" type="number" min="1" max="31">
          </label>
          <label v-if="settings.ScheduleType === 'Weekly'" class="mci-backup-field">
            <span>星期</span><select v-model="settings.WeekDay"><option v-for="day in weekDays" :key="day.value" :value="day.value">{{ day.label }}</option></select>
          </label>
          <label v-if="settings.ScheduleType === 'Monthly'" class="mci-backup-field">
            <span>每月日期</span><input v-model.number="settings.MonthDay" type="number" min="1" max="28">
          </label>
          <label v-if="showHour" class="mci-backup-field"><span>小时</span><input v-model.number="settings.Hour" type="number" min="0" max="23"></label>
          <label v-if="showMinute" class="mci-backup-field"><span>分钟</span><input v-model.number="settings.Minute" type="number" min="0" max="59"></label>
          <label v-if="settings.ScheduleType === 'Custom'" class="mci-backup-field mci-backup-field--wide"><span>Quartz Cron（6 或 7 段）</span><input v-model.trim="settings.CustomCron" placeholder="例如 0 30 2 * * ?"></label>
          <label class="mci-backup-field"><span>保留最新</span><div class="mci-backup-input-unit"><input v-model.number="settings.RetainCount" type="number" min="1" max="100"><em>份</em></div></label>
        </div>

        <section class="mci-backup-tenant-scope">
          <div class="mci-backup-section-title">
            <div><h3>备份租户</h3><p>只展示当前后端运行环境三元组内、已启用且数据库类型为 MySQL 的租户。</p></div>
            <label class="mci-backup-switch"><input v-model="settings.BackupAllEligible" type="checkbox"><span aria-hidden="true"></span><b>{{ settings.BackupAllEligible ? '全部符合条件' : '指定租户' }}</b></label>
          </div>
          <div v-if="!settings.BackupAllEligible" class="mci-backup-tenant-grid">
            <div class="mci-backup-tenant-search">
              <label><span aria-hidden="true">⌕</span><input v-model.trim="tenantKeyword" type="search" aria-label="搜索可备份租户" placeholder="搜索租户名称或 OsClient"></label>
              <b>{{ filteredTenantCatalog.length }} / {{ tenantCatalog.length }}</b>
            </div>
            <label v-for="tenant in filteredTenantCatalog" :key="tenant.OsClient" :class="{ 'is-selected': settings.TenantOsClients.includes(tenant.OsClient) }">
              <input v-model="settings.TenantOsClients" type="checkbox" :value="tenant.OsClient">
              <span><b>{{ tenant.Name || tenant.OsClient }}</b><small>{{ tenant.OsClient }}<em v-if="tenant.IsMainTenant">主租户</em></small></span>
            </label>
            <p v-if="!tenantCatalog.length" class="mci-backup-tenant-empty">当前运行环境没有可备份的 MySQL 租户。</p>
            <p v-else-if="!filteredTenantCatalog.length" class="mci-backup-tenant-empty">没有匹配“{{ tenantKeyword }}”的可备份租户。</p>
          </div>
          <p class="mci-backup-runtime">当前环境：{{ runtime.OsClient }} + {{ runtime.OsClientType }} + {{ runtime.OsClientNetwork }}；可选 {{ tenantCatalog.length }} 个租户。</p>
        </section>

        <div class="mci-backup-fixed-options">
          <div><strong>备份范围</strong><span>{{ settings.BackupAllEligible ? '当前环境全部符合条件的租户' : `指定 ${settings.TenantOsClients.length} 个租户` }}（相同物理库自动去重）</span></div>
          <div><strong>存储位置</strong><span>主租户 HDFS 私有桶 /database-backups/</span></div>
          <div><strong>执行策略</strong><span>单任务串行排队、Redis 可续租锁、Fastest 压缩、分批节流</span></div>
        </div>

        <aside class="mci-backup-notice"><b>在线业务保护</b><p>备份不使用全局读锁；每个数据库以 REPEATABLE READ 快照读取。计划任务最短间隔为 1 小时；上一任务未完成时不会重复积压，也不会并行争抢 CPU、磁盘或数据库连接。</p></aside>
        <footer class="mci-backup-actions">
          <button class="mci-button mci-button--secondary" type="button" :disabled="starting" @click="startNow"><span aria-hidden="true">▶</span>{{ starting ? '正在提交…' : '立即备份' }}</button>
          <button class="mci-button mci-button--primary" type="submit" :disabled="saving"><span aria-hidden="true">✓</span>{{ saving ? '正在保存…' : '保存设置' }}</button>
        </footer>
      </form>
    </section>

    <section v-else class="mci-backup-panel mci-fade-up">
      <div class="mci-backup-toolbar">
        <div><h2>备份记录</h2><p>进度、日志与结果来自表单引擎；下载时才签发私有临时地址。</p></div>
        <div class="mci-backup-filters">
          <select v-model="filters.Status" aria-label="按状态筛选" @change="loadRecords(1)"><option value="">全部状态</option><option v-for="item in statusOptions" :key="item.value" :value="item.value">{{ item.label }}</option></select>
          <select v-model="filters.TriggerType" aria-label="按触发方式筛选" @change="loadRecords(1)"><option value="">全部方式</option><option value="Manual">立即备份</option><option value="Scheduled">定时备份</option></select>
          <input v-model.trim="filters.Keyword" aria-label="按备份编号筛选" placeholder="搜索备份编号" @keyup.enter="loadRecords(1)">
          <button type="button" @click="loadRecords(1)">查询</button>
        </div>
      </div>

      <div v-if="loadingRecords" class="mci-backup-table-skeleton" aria-label="正在加载备份记录"><i v-for="n in 6" :key="n"></i></div>
      <div v-else-if="!records.length" class="mci-backup-empty"><span aria-hidden="true">▤</span><strong>暂无备份记录</strong><p>保存计划或点击“立即备份”后，任务会出现在这里。</p></div>
      <div v-else class="mci-backup-records">
        <article v-for="record in records" :key="record.Id" class="mci-backup-record">
          <div class="mci-backup-record__head">
            <div><span class="mci-backup-status" :class="`is-${statusTone(record.Status)}`">{{ statusText(record.Status) }}</span><strong>{{ record.BackupNo }}</strong></div>
            <time>{{ record.StartedAt || record.CreateTime || '等待开始' }}</time>
          </div>
          <div class="mci-backup-progress" role="progressbar" :aria-valuenow="Number(record.Progress || 0)" aria-valuemin="0" aria-valuemax="100"><i :style="{ transform: `scaleX(${Math.max(0, Math.min(100, Number(record.Progress || 0))) / 100})` }"></i></div>
          <div class="mci-backup-record__meta">
            <span><b>{{ record.Progress || 0 }}%</b> 进度</span><span>{{ record.CompletedDatabases || 0 }}/{{ record.TotalDatabases || 0 }} 数据库</span>
            <span class="is-success">成功 {{ record.SuccessCount || 0 }}</span><span :class="{ 'is-danger': Number(record.FailedCount || 0) > 0 }">失败 {{ record.FailedCount || 0 }}</span>
            <span>{{ triggerText(record.TriggerType) }}</span><span>{{ formatSize(record.FileSize) }}</span>
          </div>
          <p v-if="record.CurrentDatabase" class="mci-backup-current">{{ record.CurrentDatabase }}</p>
          <p v-if="record.ErrorSummary" class="mci-backup-error">{{ record.ErrorSummary }}</p>
          <details v-if="record.Log" class="mci-backup-log"><summary>查看执行日志</summary><pre>{{ record.Log }}</pre></details>
          <div class="mci-backup-record__actions">
            <span v-if="record.FileName" :title="record.FileName">{{ record.FileName }}</span>
            <button v-if="canDownload(record)" type="button" :disabled="downloadingId === record.Id" @click="download(record)">{{ downloadingId === record.Id ? '正在生成…' : '下载 ZIP' }}</button>
            <em v-else-if="record.RetentionStatus === 'Deleted'">文件已按保留策略清理</em>
          </div>
        </article>
      </div>
      <footer v-if="recordCount > pageSize" class="mci-backup-pagination"><button type="button" :disabled="pageIndex <= 1" @click="loadRecords(pageIndex - 1)">上一页</button><span>第 {{ pageIndex }} / {{ totalPages }} 页，共 {{ recordCount }} 条</span><button type="button" :disabled="pageIndex >= totalPages" @click="loadRecords(pageIndex + 1)">下一页</button></footer>
    </section>
  </main>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { configureV8, dispatch } from './microi'

const activeTab = ref('settings')
const loadingSettings = ref(true)
const loadingRecords = ref(false)
const saving = ref(false)
const starting = ref(false)
const downloadingId = ref('')
const tenantCatalog = ref([])
const tenantKeyword = ref('')
const runtime = reactive({ OsClient: '', OsClientType: '', OsClientNetwork: '' })
const records = ref([])
const recordCount = ref(0)
const pageIndex = ref(1)
const pageSize = 15
const toast = reactive({ text: '', type: 'success' })
const confirmState = reactive({ open: false, title: '', scope: '', message: '' })
const confirmDialogRef = ref(null)
const filters = reactive({ Status: '', TriggerType: '', Keyword: '' })
const settings = reactive({ Enabled: true, ScheduleType: 'Daily', Interval: 1, WeekDay: 'MON', MonthDay: 1, Hour: 0, Minute: 0, CustomCron: '0 0 0 * * ?', RetainCount: 7, BackupAllEligible: true, TenantOsClients: [] })
const weekDays = [{value:'MON',label:'星期一'},{value:'TUE',label:'星期二'},{value:'WED',label:'星期三'},{value:'THU',label:'星期四'},{value:'FRI',label:'星期五'},{value:'SAT',label:'星期六'},{value:'SUN',label:'星期日'}]
const statusOptions = [{value:'Queued',label:'排队中'},{value:'Running',label:'备份中'},{value:'Succeeded',label:'成功'},{value:'PartiallySucceeded',label:'部分成功'},{value:'Failed',label:'失败'},{value:'Interrupted',label:'已中断'}]
let pollTimer = 0
let pendingRequestId = ''
let confirmResolver = null
const pendingRequestStorageKey = 'microi:database-backup:pending-request-id'

const showHour = computed(() => ['Daily','EveryNDays','Weekly','Monthly'].includes(settings.ScheduleType))
const showMinute = computed(() => settings.ScheduleType !== 'Custom')
const totalPages = computed(() => Math.max(1, Math.ceil(recordCount.value / pageSize)))
const runningCount = computed(() => records.value.filter(item => ['Queued','Running'].includes(item.Status)).length)
const filteredTenantCatalog = computed(() => {
  const keyword = tenantKeyword.value.toLocaleLowerCase()
  if (!keyword) return tenantCatalog.value
  return tenantCatalog.value.filter(tenant => `${tenant.Name || ''}\n${tenant.OsClient || ''}`.toLocaleLowerCase().includes(keyword))
})

function notify(text, type = 'success') { toast.text = text; toast.type = type; window.clearTimeout(notify.timer); notify.timer = window.setTimeout(() => { toast.text = '' }, type === 'danger' ? 15000 : 5000) }
function requestConfirmation({ title, scope, message }) {
  if (confirmResolver) confirmResolver(false)
  Object.assign(confirmState, { open: true, title, scope, message })
  return new Promise(resolve => { confirmResolver = resolve })
}
function resolveConfirmation(accepted) {
  if (!confirmState.open && !confirmResolver) return
  confirmState.open = false
  const resolve = confirmResolver
  confirmResolver = null
  if (resolve) resolve(Boolean(accepted))
}
function clamp(value, min, max, fallback) { const number = Number(value); return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.trunc(number))) : fallback }
function validateMinimumCron(cron) {
  const fields = String(cron || '').trim().split(/\s+/)
  if (![6,7].includes(fields.length)) throw new Error('自定义 Cron 必须是 6 或 7 段 Quartz 表达式')
  if (fields[0] !== '0' || !/^\d{1,2}$/.test(fields[1]) || Number(fields[1]) > 59) throw new Error('数据库备份最短间隔为 1 小时：秒必须为 0，分钟必须是单个 0-59 固定值')
  return cron
}
function createRequestId() {
  const random = globalThis.crypto?.randomUUID?.().replace(/-/g, '') || Math.random().toString(36).slice(2) + Date.now().toString(36)
  return `ui-${Date.now().toString(36)}-${random}`.slice(0, 128)
}
function getPendingRequestId() {
  let existing = pendingRequestId
  try { existing = window.localStorage.getItem(pendingRequestStorageKey) || existing } catch {}
  if (/^[A-Za-z0-9:._-]{8,128}$/.test(existing || '')) return existing
  const created = createRequestId(); pendingRequestId = created
  try { window.localStorage.setItem(pendingRequestStorageKey, created) } catch {}
  return created
}
function clearPendingRequestId() { pendingRequestId = ''; try { window.localStorage.removeItem(pendingRequestStorageKey) } catch {} }
function cronAndDescription() {
  const minute = clamp(settings.Minute, 0, 59, 0), hour = clamp(settings.Hour, 0, 23, 0), interval = clamp(settings.Interval, 1, 31, 1)
  if (settings.ScheduleType === 'Daily') return { cron:`0 ${minute} ${hour} * * ?`, desc:`每天 ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` }
  if (settings.ScheduleType === 'EveryNDays') return { cron:`0 ${minute} ${hour} 1/${interval} * ?`, desc:`每 ${interval} 天 ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` }
  if (settings.ScheduleType === 'Hourly') return { cron:`0 ${minute} * * * ?`, desc:`每小时第 ${minute} 分钟` }
  if (settings.ScheduleType === 'EveryNHours') return { cron:`0 ${minute} 0/${interval} * * ?`, desc:`每 ${interval} 小时` }
  if (settings.ScheduleType === 'Weekly') return { cron:`0 ${minute} ${hour} ? * ${settings.WeekDay}`, desc:`每周 ${weekDays.find(x => x.value === settings.WeekDay)?.label || '星期一'} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` }
  if (settings.ScheduleType === 'Monthly') { const day = clamp(settings.MonthDay,1,28,1); return { cron:`0 ${minute} ${hour} ${day} * ?`, desc:`每月 ${day} 日 ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}` } }
  const custom = validateMinimumCron(String(settings.CustomCron || '').trim())
  return { cron:custom, desc:`自定义：${custom}` }
}

async function loadSettings() {
  loadingSettings.value = true
  try {
    const result = await configureV8().post('/api/V8Engine/GetDatabaseBackupSettings', {})
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '读取备份设置失败')
    const job = result.Data?.Job || {}, catalog = result.Data?.TenantCatalog || {}
    Object.assign(settings, job.Settings || {})
    if (settings.ScheduleType === 'EveryNMinutes') settings.ScheduleType = 'Hourly'
    settings.Enabled = String(job.Status || '') !== '暂停'
    settings.BackupAllEligible = settings.BackupAllEligible !== false
    settings.TenantOsClients = Array.isArray(settings.TenantOsClients) ? settings.TenantOsClients : []
    if (job.CronExpression) settings.CustomCron = job.CronExpression
    tenantCatalog.value = Array.isArray(catalog.Tenants) ? catalog.Tenants : []
    Object.assign(runtime, catalog.Runtime || {})
  } catch (error) { notify(error?.message || String(error), 'danger') }
  finally { loadingSettings.value = false }
}

async function saveSettings() {
  saving.value = true
  try {
    settings.Interval = clamp(settings.Interval,1,59,1); settings.Hour = clamp(settings.Hour,0,23,0); settings.Minute = clamp(settings.Minute,0,59,0); settings.MonthDay = clamp(settings.MonthDay,1,28,1); settings.RetainCount = clamp(settings.RetainCount,1,100,7)
    if (!settings.BackupAllEligible && !settings.TenantOsClients.length) throw new Error('指定租户备份时至少选择一个租户')
    const schedule = cronAndDescription()
    validateMinimumCron(schedule.cron)
    const result = await configureV8().post('/api/V8Engine/SaveDatabaseBackupSettings', { Enabled:settings.Enabled, CronExpression:schedule.cron, CronDesc:schedule.desc, Settings:{ ...settings, TenantOsClients:[...settings.TenantOsClients] } })
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '保存失败')
    notify(`设置已保存：${settings.Enabled ? schedule.desc : '任务已停用'}`)
  } catch (error) { notify(error?.message || String(error), 'danger') }
  finally { saving.value = false }
}

async function startNow() {
  const scopeText = settings.BackupAllEligible ? '当前环境全部符合条件的租户' : `指定的 ${settings.TenantOsClients.length} 个租户`
  if (!settings.BackupAllEligible && !settings.TenantOsClients.length) { notify('请至少选择一个备份租户', 'danger'); return }
  const confirmed = await requestConfirmation({
    title: '确认立即备份',
    scope: `本次范围：${scopeText}`,
    message: runningCount.value > 0
      ? `当前检测到 ${runningCount.value} 个备份任务仍在排队或执行，本次提交会按顺序等待，不会并行争抢资源。`
      : '当前未检测到正在执行的备份任务，提交后将创建新的持久后台任务并尽快开始；若提交瞬间其它节点已有任务，系统才会自动排队。'
  })
  if (!confirmed) return
  starting.value = true
  try {
    const requestId = getPendingRequestId()
    const payload = { ConfirmExecution:'DATABASE_BACKUP', IdempotencyKey:requestId, RetainCount:clamp(settings.RetainCount,1,100,7) }
    if (!settings.BackupAllEligible) payload.TenantOsClients = [...settings.TenantOsClients]
    const result = await configureV8().post('/api/V8Engine/RunDatabaseBackup', payload)
    if (!result || result.Code !== 1) { if (result) clearPendingRequestId(); throw new Error(result?.Msg || '提交失败') }
    if (!result.Data?.TaskId) throw new Error('后台未返回 TaskId，请重试；系统会复用本次幂等请求，不会重复创建任务')
    clearPendingRequestId()
    notify('立即备份已进入队列，可在本页记录或右上角通知中心查看进度。')
    dispatch('background-task:created', result.Data || {})
    window.setTimeout(() => { activeTab.value = 'records'; loadRecords(1) }, 900)
  } catch (error) { notify(error?.message || String(error), 'danger') }
  finally { starting.value = false }
}

async function loadRecords(nextPage = pageIndex.value, quiet = false) {
  if (!quiet) loadingRecords.value = true
  try {
    const where = []
    if (filters.Status) where.push(['Status','=',filters.Status])
    if (filters.TriggerType) where.push(['TriggerType','=',filters.TriggerType])
    if (filters.Keyword) where.push(['BackupNo','Like',filters.Keyword])
    const result = await configureV8().post('/api/FormEngine/GetTableData', { FormEngineKey:'mci_database_backup', _Where:where, _SelectFields:['Id','CreateTime','BackupNo','TriggerType','Status','Progress','TotalDatabases','CompletedDatabases','SuccessCount','FailedCount','CurrentDatabase','StartedAt','FinishedAt','FileName','FileSize','Sha256','RequestedByName','RetentionStatus','Log','ErrorSummary'], _OrderBy:'CreateTime', _OrderByType:'DESC', _PageIndex:nextPage, _PageSize:pageSize })
    if (!result || result.Code !== 1) throw new Error(result?.Msg || '读取记录失败')
    records.value = Array.isArray(result.Data) ? result.Data : []; recordCount.value = Number(result.DataCount || records.value.length); pageIndex.value = nextPage
  } catch (error) { if (!quiet) notify(error?.message || String(error), 'danger') }
  finally { loadingRecords.value = false }
}

async function openRecords() { activeTab.value = 'records'; await loadRecords(1) }
function statusText(value) { return statusOptions.find(item => item.value === value)?.label || value || '未知' }
function statusTone(value) { return value === 'Succeeded' ? 'success' : value === 'PartiallySucceeded' ? 'warning' : ['Failed','Interrupted'].includes(value) ? 'danger' : value === 'Running' ? 'primary' : 'muted' }
function triggerText(value) { return value === 'Scheduled' ? '定时备份' : value === 'Manual' ? '立即备份' : value || '未知' }
function formatSize(value) { const bytes=Number(value||0); if(!bytes)return '—'; const units=['B','KB','MB','GB','TB']; const index=Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024))); return `${(bytes/Math.pow(1024,index)).toFixed(index>1?2:0)} ${units[index]}` }
function canDownload(record) { return ['Succeeded','PartiallySucceeded'].includes(record.Status) && record.FileName && record.RetentionStatus !== 'Deleted' }
async function download(record) {
  const downloadWindow = window.open('about:blank', '_blank')
  if (!downloadWindow) {
    notify('浏览器阻止了下载窗口，请允许本站打开新窗口后重试。', 'danger')
    return
  }
  try {
    downloadWindow.opener = null
    downloadWindow.document.title = '正在准备数据库备份下载'
    const status = downloadWindow.document.createElement('p')
    status.textContent = '正在生成私有临时下载地址，请稍候…'
    status.style.cssText = 'font:16px/1.8 system-ui,"Microsoft YaHei",sans-serif;color:#243149;padding:32px'
    downloadWindow.document.body.replaceChildren(status)
  } catch {}
  downloadingId.value = record.Id
  try {
    const result = await configureV8().post('/apiengine/database-backup-download', { RecordId:record.Id })
    if (!result || result.Code !== 1 || !result.Data?.Url) throw new Error(result?.Msg || '生成下载地址失败')
    const url = new URL(String(result.Data.Url), window.location.href)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('下载地址协议不安全，已阻止打开')
    downloadWindow.location.replace(url.href)
    notify('下载已在新窗口打开；临时地址将在 30 分钟后失效。')
  } catch(error) {
    try { downloadWindow.close() } catch {}
    notify(error?.message || String(error), 'danger')
  }
  finally { downloadingId.value = '' }
}

watch(activeTab, value => { if (value === 'records' && !records.value.length) loadRecords(1) })
watch(() => confirmState.open, async open => { if (open) { await nextTick(); confirmDialogRef.value?.focus() } })
onMounted(async () => { await Promise.all([loadSettings(), loadRecords(1, true)]); pollTimer = window.setInterval(() => { if (activeTab.value === 'records' && records.value.some(item => ['Queued','Running'].includes(item.Status))) loadRecords(pageIndex.value, true) }, 5000) })
onBeforeUnmount(() => { window.clearInterval(pollTimer); resolveConfirmation(false) })
</script>

<style scoped>
.mci-backup-page{--mci-color-primary:var(--el-color-primary,#3478f6);--mci-color-success:var(--el-color-success,#20a36a);--mci-color-warning:var(--el-color-warning,#d99818);--mci-color-danger:var(--el-color-danger,#d6424b);--mci-bg-base:var(--el-bg-color-page,#f6f8fc);--mci-bg-card:var(--el-bg-color,#fff);--mci-bg-soft:var(--el-fill-color-light,#f3f6fa);--mci-text-primary:var(--el-text-color-primary,#243149);--mci-text-secondary:var(--el-text-color-regular,#64748b);--mci-border:var(--el-border-color-light,#e2e8f0);--mci-radius-card:var(--el-border-radius-base,12px);min-height:100vh;padding:20px;color:var(--mci-text-primary);background:var(--mci-bg-base);font-family:Inter,"Microsoft YaHei",system-ui,sans-serif;animation:mciBackupEnter .35s ease-out both}
.mci-backup-hero{position:relative;display:flex;align-items:center;gap:16px;overflow:hidden;padding:20px 22px;border:1px solid color-mix(in srgb,var(--mci-color-primary) 24%,var(--mci-border));border-radius:var(--mci-radius-card);background:linear-gradient(120deg,color-mix(in srgb,var(--mci-color-primary) 9%,var(--mci-bg-card)),var(--mci-bg-card));box-shadow:0 8px 26px rgba(31,49,78,.07)}
.mci-backup-hero::after{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(52,120,246,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(52,120,246,.035) 1px,transparent 1px);background-size:28px 28px;pointer-events:none}.mci-backup-hero__icon{z-index:1;display:grid;flex:0 0 52px;width:52px;height:52px;place-items:center;border-radius:14px;color:#fff;background:var(--mci-color-primary);box-shadow:0 8px 22px color-mix(in srgb,var(--mci-color-primary) 30%,transparent);font-size:27px}.mci-backup-hero__copy{z-index:1;flex:1;min-width:0}.mci-backup-eyebrow{margin:0 0 2px!important;color:var(--mci-color-primary)!important;font-size:10px!important;font-weight:800;letter-spacing:.14em}.mci-backup-hero h1{margin:0;font-size:21px;line-height:30px}.mci-backup-hero p{margin:3px 0 0;color:var(--mci-text-secondary);font-size:13px;line-height:20px}.mci-backup-hero__badges{z-index:1;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:280px}.mci-backup-hero__badges span{display:inline-flex;align-items:center;min-height:28px;padding:0 10px;border:1px solid color-mix(in srgb,var(--mci-color-primary) 20%,var(--mci-border));border-radius:999px;color:var(--mci-color-primary);background:color-mix(in srgb,var(--mci-color-primary) 7%,var(--mci-bg-card));font-size:11px;font-weight:700}
.mci-backup-tabs{display:flex;gap:4px;margin:14px 0;padding:4px;border:1px solid var(--mci-border);border-radius:10px;background:var(--mci-bg-card)}.mci-backup-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:126px;height:38px;border:0;border-radius:7px;color:var(--mci-text-secondary);background:transparent;cursor:pointer;transition:transform .18s ease,background .18s ease,color .18s ease}.mci-backup-tabs button:hover{color:var(--mci-color-primary);background:var(--mci-bg-soft)}.mci-backup-tabs button:active{transform:scale(.98)}.mci-backup-tabs button.is-active{color:#fff;background:var(--mci-color-primary);box-shadow:0 5px 14px color-mix(in srgb,var(--mci-color-primary) 25%,transparent)}.mci-backup-tabs button span{display:grid;min-width:18px;height:18px;place-items:center;border-radius:9px;color:var(--mci-color-primary);background:#fff;font-size:10px;font-weight:800}
.mci-backup-panel{padding:20px;border:1px solid var(--mci-border);border-radius:var(--mci-radius-card);background:var(--mci-bg-card);box-shadow:0 8px 26px rgba(31,49,78,.05)}.mci-backup-toast,.mci-backup-confirm-mask{--mci-color-primary:var(--el-color-primary,#3478f6);--mci-color-success:var(--el-color-success,#20a36a);--mci-color-danger:var(--el-color-danger,#d6424b);--mci-bg-card:var(--el-bg-color,#fff);--mci-bg-soft:var(--el-fill-color-light,#f3f6fa);--mci-text-primary:var(--el-text-color-primary,#243149);--mci-text-secondary:var(--el-text-color-regular,#64748b);--mci-border:var(--el-border-color-light,#e2e8f0);font-family:Inter,"Microsoft YaHei",system-ui,sans-serif}.mci-backup-toast{position:fixed;z-index:2147483646;top:50%;left:50%;display:grid;grid-template-columns:38px minmax(0,1fr) 28px;align-items:center;gap:12px;width:min(560px,calc(100vw - 32px));margin:0;padding:15px 16px;border:1px solid color-mix(in srgb,var(--mci-color-success) 30%,var(--mci-border));border-radius:12px;color:var(--mci-text-primary);background:var(--mci-bg-card);box-shadow:0 22px 70px rgba(15,23,42,.28);transform:translate(-50%,-50%)}.mci-backup-toast.is-danger{border-color:color-mix(in srgb,var(--mci-color-danger) 35%,var(--mci-border))}.mci-backup-toast__icon{display:grid;width:38px;height:38px;place-items:center;border-radius:50%;color:#fff;background:var(--mci-color-success);font-weight:800}.mci-backup-toast.is-danger .mci-backup-toast__icon{background:var(--mci-color-danger)}.mci-backup-toast strong,.mci-backup-toast p{display:block;margin:0}.mci-backup-toast strong{font-size:13px}.mci-backup-toast p{margin-top:3px;color:var(--mci-text-secondary);font-size:12px;line-height:18px;overflow-wrap:anywhere}.mci-backup-toast button{display:grid;width:28px;height:28px;place-items:center;border:0;border-radius:7px;color:var(--mci-text-secondary);background:var(--mci-bg-soft);cursor:pointer}.mci-backup-confirm-mask{position:fixed;z-index:2147483645;inset:0;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.46)}.mci-backup-confirm{width:min(480px,calc(100vw - 32px));padding:25px;border:1px solid color-mix(in srgb,var(--mci-color-primary) 25%,var(--mci-border));border-radius:16px;outline:0;color:var(--mci-text-primary);background:var(--mci-bg-card);box-shadow:0 28px 90px rgba(15,23,42,.34)}.mci-backup-confirm__icon{display:grid;width:48px;height:48px;margin-bottom:15px;place-items:center;border-radius:14px;color:#fff;background:var(--mci-color-primary);box-shadow:0 10px 26px color-mix(in srgb,var(--mci-color-primary) 28%,transparent)}.mci-backup-confirm h2{margin:0;font-size:20px}.mci-backup-confirm>strong{display:block;margin-top:15px;padding:10px 12px;border-radius:8px;color:var(--mci-color-primary);background:color-mix(in srgb,var(--mci-color-primary) 8%,var(--mci-bg-card));font-size:13px}.mci-backup-confirm>p:not(.mci-backup-eyebrow){margin:11px 0 0;color:var(--mci-text-secondary);font-size:13px;line-height:21px}.mci-backup-confirm footer{display:flex;justify-content:flex-end;gap:10px;margin-top:22px;padding-top:17px;border-top:1px solid var(--mci-border)}.mci-button--ghost{border:1px solid var(--mci-border);color:var(--mci-text-primary);background:var(--mci-bg-card)}
.mci-backup-section-title,.mci-backup-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px}.mci-backup-section-title h2,.mci-backup-toolbar h2{margin:0;font-size:17px}.mci-backup-section-title p,.mci-backup-toolbar p{margin:4px 0 0;color:var(--mci-text-secondary);font-size:12px}.mci-backup-switch{display:flex;align-items:center;gap:8px;min-height:36px;cursor:pointer}.mci-backup-switch input{position:absolute;opacity:0}.mci-backup-switch span{position:relative;width:42px;height:23px;border-radius:999px;background:var(--mci-border);transition:background .2s}.mci-backup-switch span::after{content:"";position:absolute;top:3px;left:3px;width:17px;height:17px;border-radius:50%;background:#fff;box-shadow:0 2px 5px rgba(0,0,0,.16);transition:transform .2s}.mci-backup-switch input:checked+span{background:var(--mci-color-success)}.mci-backup-switch input:checked+span::after{transform:translateX(19px)}.mci-backup-switch b{font-size:12px}
.mci-backup-form-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.mci-backup-field{display:block;min-width:0}.mci-backup-field--wide{grid-column:span 2}.mci-backup-field>span{display:block;margin-bottom:7px;font-size:12px;font-weight:700}.mci-backup-field input,.mci-backup-field select,.mci-backup-filters input,.mci-backup-filters select{width:100%;height:40px;padding:0 11px;border:1px solid var(--mci-border);border-radius:7px;outline:0;color:var(--mci-text-primary);background:var(--mci-bg-card);transition:border-color .16s,box-shadow .16s}.mci-backup-field input:focus,.mci-backup-field select:focus,.mci-backup-filters input:focus,.mci-backup-filters select:focus{border-color:var(--mci-color-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--mci-color-primary) 12%,transparent)}.mci-backup-input-unit{position:relative}.mci-backup-input-unit input{padding-right:44px}.mci-backup-input-unit em{position:absolute;top:0;right:0;display:grid;width:42px;height:40px;place-items:center;border-left:1px solid var(--mci-border);color:var(--mci-text-secondary);font-size:12px;font-style:normal}
.mci-backup-tenant-scope{margin-top:18px;padding:14px;border:1px solid var(--mci-border);border-radius:9px;background:color-mix(in srgb,var(--mci-color-primary) 3%,var(--mci-bg-card))}.mci-backup-tenant-scope .mci-backup-section-title{margin-bottom:10px}.mci-backup-tenant-scope h3{margin:0;font-size:14px}.mci-backup-tenant-scope p{margin:3px 0 0;color:var(--mci-text-secondary);font-size:11px}.mci-backup-tenant-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.mci-backup-tenant-search{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-bottom:2px}.mci-backup-tenant-search label{display:flex;flex:1;align-items:center;gap:8px;height:40px;padding:0 11px;border:1px solid var(--mci-border);border-radius:8px;background:var(--mci-bg-card)}.mci-backup-tenant-search label:focus-within{border-color:var(--mci-color-primary);box-shadow:0 0 0 3px color-mix(in srgb,var(--mci-color-primary) 12%,transparent)}.mci-backup-tenant-search span{color:var(--mci-color-primary);font-size:18px}.mci-backup-tenant-search input{flex:1;min-width:0;border:0;outline:0;color:var(--mci-text-primary);background:transparent}.mci-backup-tenant-search>b{flex:0 0 auto;padding:5px 9px;border-radius:999px;color:var(--mci-color-primary);background:color-mix(in srgb,var(--mci-color-primary) 9%,transparent);font-size:11px}.mci-backup-tenant-grid>label{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid var(--mci-border);border-radius:7px;background:var(--mci-bg-card);cursor:pointer}.mci-backup-tenant-grid>label.is-selected{border-color:color-mix(in srgb,var(--mci-color-primary) 55%,var(--mci-border));background:color-mix(in srgb,var(--mci-color-primary) 7%,var(--mci-bg-card))}.mci-backup-tenant-grid>label input{accent-color:var(--mci-color-primary)}.mci-backup-tenant-grid>label span,.mci-backup-tenant-grid>label b,.mci-backup-tenant-grid>label small{display:block;min-width:0}.mci-backup-tenant-grid>label b,.mci-backup-tenant-grid>label small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mci-backup-tenant-grid>label b{font-size:12px}.mci-backup-tenant-grid>label small{margin-top:3px;color:var(--mci-text-secondary);font-size:10px}.mci-backup-tenant-grid>label small em{margin-left:6px;padding:1px 5px;border-radius:999px;color:var(--mci-color-primary);background:color-mix(in srgb,var(--mci-color-primary) 10%,transparent);font-style:normal}.mci-backup-tenant-grid .mci-backup-tenant-empty{grid-column:1/-1;padding:14px;text-align:center}.mci-backup-tenant-scope .mci-backup-runtime{margin-top:10px}
.mci-backup-fixed-options{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.mci-backup-fixed-options>div{padding:12px;border:1px solid var(--mci-border);border-radius:8px;background:var(--mci-bg-soft)}.mci-backup-fixed-options strong,.mci-backup-fixed-options span{display:block}.mci-backup-fixed-options strong{margin-bottom:5px;font-size:12px}.mci-backup-fixed-options span{color:var(--mci-text-secondary);font-size:11px;line-height:18px}.mci-backup-notice{display:flex;gap:12px;margin-top:14px;padding:12px 14px;border-left:3px solid var(--mci-color-success);border-radius:6px;background:color-mix(in srgb,var(--mci-color-success) 7%,var(--mci-bg-card))}.mci-backup-notice b{flex:0 0 auto;color:var(--mci-color-success);font-size:12px}.mci-backup-notice p{margin:0;color:var(--mci-text-secondary);font-size:12px;line-height:19px}.mci-backup-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px;padding-top:16px;border-top:1px solid var(--mci-border)}.mci-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-width:112px;height:40px;padding:0 17px;border-radius:7px;font-weight:650;line-height:1;cursor:pointer;transition:transform .16s,box-shadow .16s}.mci-button:active{transform:scale(.97)}.mci-button:disabled{cursor:wait;opacity:.62}.mci-button--primary{border:1px solid var(--mci-color-primary);color:#fff;background:var(--mci-color-primary);box-shadow:0 6px 16px color-mix(in srgb,var(--mci-color-primary) 24%,transparent)}.mci-button--secondary{border:1px solid color-mix(in srgb,var(--mci-color-success) 45%,var(--mci-border));color:var(--mci-color-success);background:color-mix(in srgb,var(--mci-color-success) 7%,var(--mci-bg-card))}
.mci-backup-filters{display:grid;grid-template-columns:120px 110px 150px 64px;gap:7px}.mci-backup-filters input,.mci-backup-filters select{height:36px;font-size:12px}.mci-backup-filters button,.mci-backup-pagination button,.mci-backup-record__actions button{display:inline-flex;align-items:center;justify-content:center;border:1px solid var(--mci-color-primary);border-radius:6px;color:var(--mci-color-primary);background:var(--mci-bg-card);cursor:pointer}.mci-backup-records{display:grid;gap:10px}.mci-backup-record{padding:14px;border:1px solid var(--mci-border);border-radius:9px;background:var(--mci-bg-card);transition:transform .18s ease,border-color .18s ease}.mci-backup-record:hover{border-color:color-mix(in srgb,var(--mci-color-primary) 28%,var(--mci-border));transform:translateY(-1px)}.mci-backup-record__head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mci-backup-record__head>div{display:flex;align-items:center;gap:9px;min-width:0}.mci-backup-record__head strong{overflow:hidden;font-size:13px;text-overflow:ellipsis;white-space:nowrap}.mci-backup-record__head time{flex:0 0 auto;color:var(--mci-text-secondary);font-size:11px}.mci-backup-status{display:inline-flex;align-items:center;justify-content:center;min-width:58px;height:23px;padding:0 8px;border-radius:999px;font-size:10px;font-weight:800}.mci-backup-status.is-success{color:var(--mci-color-success);background:color-mix(in srgb,var(--mci-color-success) 11%,transparent)}.mci-backup-status.is-warning{color:var(--mci-color-warning);background:color-mix(in srgb,var(--mci-color-warning) 12%,transparent)}.mci-backup-status.is-danger{color:var(--mci-color-danger);background:color-mix(in srgb,var(--mci-color-danger) 10%,transparent)}.mci-backup-status.is-primary{color:var(--mci-color-primary);background:color-mix(in srgb,var(--mci-color-primary) 10%,transparent)}.mci-backup-status.is-muted{color:var(--mci-text-secondary);background:var(--mci-bg-soft)}.mci-backup-progress{overflow:hidden;height:6px;margin:11px 0 9px;border-radius:999px;background:var(--mci-bg-soft)}.mci-backup-progress i{display:block;width:100%;height:100%;transform-origin:left center;border-radius:inherit;background:linear-gradient(90deg,var(--mci-color-primary),var(--mci-color-success));transition:transform .35s ease}.mci-backup-record__meta{display:flex;flex-wrap:wrap;gap:6px 15px;color:var(--mci-text-secondary);font-size:11px}.mci-backup-record__meta b{color:var(--mci-color-primary)}.mci-backup-record__meta .is-success{color:var(--mci-color-success)}.mci-backup-record__meta .is-danger{color:var(--mci-color-danger)}.mci-backup-current,.mci-backup-error{margin:9px 0 0;padding:7px 9px;border-radius:6px;background:var(--mci-bg-soft);font-size:11px}.mci-backup-error{color:var(--mci-color-danger);background:color-mix(in srgb,var(--mci-color-danger) 7%,var(--mci-bg-card))}.mci-backup-log{margin-top:8px}.mci-backup-log summary{color:var(--mci-color-primary);font-size:11px;cursor:pointer}.mci-backup-log pre{max-height:210px;overflow:auto;margin:7px 0 0;padding:10px;border-radius:6px;color:var(--mci-text-secondary);background:var(--mci-bg-soft);font:11px/18px Consolas,monospace;white-space:pre-wrap;overflow-wrap:anywhere}.mci-backup-record__actions{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:9px;padding-top:9px;border-top:1px solid var(--mci-border)}.mci-backup-record__actions>span{overflow:hidden;margin-right:auto;color:var(--mci-text-secondary);font-size:11px;text-overflow:ellipsis;white-space:nowrap}.mci-backup-record__actions button{height:30px;padding:0 10px;font-size:11px}.mci-backup-record__actions em{color:var(--mci-text-secondary);font-size:11px;font-style:normal}.mci-backup-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:15px;color:var(--mci-text-secondary);font-size:11px}.mci-backup-pagination button{height:32px;padding:0 11px}.mci-backup-pagination button:disabled{cursor:not-allowed;opacity:.45}.mci-backup-empty{display:grid;min-height:250px;place-items:center;align-content:center;text-align:center}.mci-backup-empty span{font-size:36px;color:var(--mci-border)}.mci-backup-empty strong{margin-top:7px;font-size:14px}.mci-backup-empty p{margin:5px 0;color:var(--mci-text-secondary);font-size:12px}
.mci-backup-skeleton{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.mci-backup-skeleton i,.mci-backup-table-skeleton i{display:block;height:72px;border-radius:8px;background:linear-gradient(90deg,var(--mci-bg-soft),color-mix(in srgb,var(--mci-text-secondary) 8%,var(--mci-bg-soft)),var(--mci-bg-soft));background-size:220% 100%;animation:mciSkeleton 1.15s ease-in-out infinite}.mci-backup-table-skeleton{display:grid;gap:10px}.mci-backup-table-skeleton i{height:112px}
@keyframes mciBackupEnter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}@keyframes mciSkeleton{from{background-position:120% 0}to{background-position:-120% 0}}.mci-fade-up{animation:mciBackupEnter .28s ease-out both}.mci-backup-feedback-enter-active,.mci-backup-feedback-leave-active,.mci-backup-confirm-enter-active,.mci-backup-confirm-leave-active{transition:opacity .2s ease}.mci-backup-feedback-enter-active.mci-backup-toast,.mci-backup-feedback-leave-active.mci-backup-toast,.mci-backup-confirm-enter-active .mci-backup-confirm,.mci-backup-confirm-leave-active .mci-backup-confirm{transition:transform .2s ease}.mci-backup-feedback-enter-from.mci-backup-toast,.mci-backup-feedback-leave-to.mci-backup-toast,.mci-backup-confirm-enter-from,.mci-backup-confirm-leave-to{opacity:0}.mci-backup-feedback-enter-from.mci-backup-toast,.mci-backup-feedback-leave-to.mci-backup-toast{transform:translate(-50%,-50%) scale(.94)}.mci-backup-confirm-enter-from .mci-backup-confirm,.mci-backup-confirm-leave-to .mci-backup-confirm{transform:scale(.94)}
@media(max-width:900px){.mci-backup-form-grid,.mci-backup-fixed-options,.mci-backup-tenant-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mci-backup-toolbar{display:block}.mci-backup-filters{grid-template-columns:repeat(2,minmax(0,1fr));margin-top:13px}.mci-backup-hero__badges{display:none}}
@media(max-width:640px){.mci-backup-page{padding:12px}.mci-backup-hero{align-items:flex-start;padding:16px}.mci-backup-hero__icon{flex-basis:44px;width:44px;height:44px}.mci-backup-form-grid,.mci-backup-fixed-options,.mci-backup-skeleton,.mci-backup-tenant-grid{grid-template-columns:1fr}.mci-backup-field--wide{grid-column:auto}.mci-backup-panel{padding:14px}.mci-backup-tabs button{flex:1;min-width:0}.mci-backup-section-title{align-items:center}.mci-backup-actions{position:sticky;bottom:0;margin:15px -14px -14px;padding:12px 14px;background:var(--mci-bg-card)}.mci-button{flex:1}.mci-backup-toast{grid-template-columns:34px minmax(0,1fr) 28px}.mci-backup-toast__icon{width:34px;height:34px}.mci-backup-confirm{padding:20px}.mci-backup-confirm footer{display:grid;grid-template-columns:1fr 1fr}.mci-backup-record__head{align-items:flex-start}.mci-backup-record__head time{display:none}.mci-backup-notice{display:block}.mci-backup-notice p{margin-top:4px}.mci-backup-filters{grid-template-columns:1fr 1fr}.mci-backup-filters input{grid-column:span 2}.mci-backup-filters button{height:36px;grid-column:span 2}.mci-backup-record__actions{align-items:flex-end}.mci-backup-record__actions>span{white-space:normal;overflow-wrap:anywhere}}
@media(prefers-reduced-motion:reduce){.mci-backup-page,.mci-fade-up,.mci-backup-toast,.mci-backup-skeleton i,.mci-backup-table-skeleton i{animation:none!important}.mci-backup-progress i,.mci-backup-switch span,.mci-backup-switch span::after{transition:none!important}}
</style>

