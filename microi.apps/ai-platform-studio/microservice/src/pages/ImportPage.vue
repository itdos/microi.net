<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="RECOVERABLE IMPORT" title="可恢复导入中心" description="文件先解析和预检，再持久暂存；真正写入由带租约、栅栏令牌和检查点的后台任务分片完成。失败行可修正重试，回滚只撤销未被后续业务修改的数据。">
      <button type="button" class="mci-button" :disabled="state === 'loading'" @click="load()">刷新批次</button>
      <button type="button" class="mci-button mci-button--primary" @click="composerOpen = true">创建导入批次</button>
    </MciPageIntro>

    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <div v-else class="mci-grid">
      <article class="mci-card mci-section span-12">
        <div class="mci-section__head"><div><h2>导入批次</h2><p>进度来自已提交行数，不使用计时器伪造百分比。</p></div><span class="mci-badge">{{ jobs.length }} 个批次</span></div>
        <MciStatePanel v-if="!jobs.length" state="empty" title="暂无导入批次" action="创建第一个批次" @action="composerOpen = true" />
        <div v-else class="job-list">
          <article v-for="job in jobs" :key="String(job.Id)" class="job" :data-selected="selectedJobId === String(job.Id)" @click="selectJob(job)">
            <div class="job__head"><div><small>{{ job.ImportKey }}</small><strong>{{ job.FileName || 'JSON 数据集' }} → {{ job.TargetTable }}</strong></div><span class="mci-badge" :data-tone="statusTone(job.Status)">{{ statusLabel(job.Status) }}</span></div>
            <div class="progress" :aria-label="`真实进度 ${job.Progress || 0}%`"><span :style="{ width: `${Math.max(0, Math.min(100, Number(job.Progress || 0)))}%` }"></span></div>
            <div class="job__metrics"><span><strong>{{ job.SuccessCount || 0 }}</strong><small>成功</small></span><span><strong>{{ job.FailedCount || 0 }}</strong><small>失败</small></span><span><strong>{{ job.RolledBackCount || 0 }}</strong><small>回滚</small></span><span><strong>{{ job.TotalCount || 0 }}</strong><small>总行</small></span></div>
            <div class="job__actions" @click.stop>
              <button v-if="job.Status === 'Running'" type="button" class="mci-button" @click="control(job, 'Pause')">暂停</button>
              <button v-if="['Paused','Staged','Failed'].includes(job.Status)" type="button" class="mci-button mci-button--primary" @click="resume(job)">继续执行</button>
              <button v-if="Number(job.FailedCount || 0) > 0 && !['Running','RollingBack'].includes(job.Status)" type="button" class="mci-button" @click="control(job, 'RetryFailed')">重试失败行</button>
              <button v-if="!['Completed','CompletedWithErrors','RolledBack','RollingBack','Cancelled'].includes(job.Status)" type="button" class="mci-button" @click="control(job, 'Cancel')">取消</button>
              <button v-if="['Completed','CompletedWithErrors'].includes(job.Status) && Number(job.SuccessCount || 0) > Number(job.RolledBackCount || 0)" type="button" class="mci-button mci-button--danger" @click="confirmRollback(job)">条件回滚</button>
            </div>
          </article>
        </div>
      </article>

      <article class="mci-card mci-section span-8">
        <div class="mci-section__head"><div><h2>批次行明细</h2><p>失败行可在标准模块中修正 NormalizedJson 与 Action，再重置为待处理。</p></div><span v-if="selectedJob" class="mci-badge">{{ selectedJob.ImportKey }}</span></div>
        <MciStatePanel v-if="!selectedJobId" state="empty" title="请选择一个导入批次" />
        <MciStatePanel v-else-if="!rows.length" state="empty" title="批次暂无行明细" />
        <MciDataTable v-else :rows="rows" :columns="rowColumns" />
      </article>
      <article class="mci-card mci-section span-4">
        <div class="mci-section__head"><div><h2>后台执行</h2><p>通知中心保留跨节点任务与检查点。</p></div><span class="mci-badge">{{ backgroundTasks.length }}</span></div>
        <MciStatePanel v-if="!backgroundTasks.length" state="empty" title="暂无相关后台任务" />
        <ul v-else class="task-list"><li v-for="task in backgroundTasks" :key="String(task.Id)"><span class="health-dot" :data-state="task.Status"></span><div><strong>{{ task.Title || task.ApiEngineKey }}</strong><small>{{ task.StatusText || task.Status }} · {{ task.Progress ?? '估算中' }}{{ task.Progress == null ? '' : '%' }}</small></div></li></ul>
        <div v-if="action.message" class="feedback" :data-state="action.status" role="status">{{ action.message }}</div>
      </article>
    </div>

    <MciDialog :open="composerOpen" title="创建可恢复导入批次" confirm-text="执行预检" :busy="action.status === 'loading'" @cancel="closeComposer" @confirm="planImport">
      <div class="form-grid">
        <label class="mci-field"><span>目标表</span><input v-model.trim="form.TargetTable" list="mci-import-tables" placeholder="例如 diy_customer" /><datalist id="mci-import-tables"><option v-for="table in availableTables" :key="String(table.Id)" :value="table.Name">{{ table.Description }}</option></datalist></label>
        <label class="mci-field"><span>每分片行数</span><input v-model.number="form.ChunkSize" type="number" min="1" max="200" /></label>
        <label class="mci-field full"><span>JSON / CSV / Excel 文件（最大20MB，单批最多2000行）</span><input ref="fileInput" type="file" accept=".json,.csv,.xlsx,.xls,application/json,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="readFile" /></label>
        <label class="mci-field full"><span>字段映射 JSON（来源列名 → 目标字段名；同名字段可留空对象）</span><textarea v-model="form.MappingText" spellcheck="false" placeholder='{"客户名称":"Name","联系电话":"Phone"}'></textarea></label>
      </div>
      <div v-if="plan" class="plan-box">
        <div class="plan-stats"><span><strong>{{ plan.Summary.Total }}</strong><small>总行</small></span><span><strong>{{ plan.Summary.Add }}</strong><small>新增</small></span><span><strong>{{ plan.Summary.Update }}</strong><small>更新</small></span><span><strong>{{ plan.Summary.Invalid }}</strong><small>无效</small></span></div>
        <code class="mci-code">PlanHash: {{ plan.PlanHash }}</code>
        <p v-if="plan.Summary.Invalid">无效行会作为失败明细暂存，不会写入业务表；至少存在一行有效数据时仍可创建批次。</p>
        <button type="button" class="mci-button mci-button--primary stage-button" :disabled="!plan.CanStage || action.status === 'loading'" @click="stageAndRun">暂存并启动后台导入</button>
      </div>
      <p v-else class="privacy-note">来源文件只用于本次预检与暂存；凭据、密码、Token、密钥和平台核心表会被安全规则拒绝。</p>
    </MciDialog>

    <MciDialog :open="rollbackOpen" title="确认条件回滚" confirm-text="启动后台回滚" danger :busy="action.status === 'loading'" @cancel="rollbackOpen = false" @confirm="startRollback">
      <p>回滚不会修改历史记录。新增行仅在内容仍与导入后快照一致时删除；更新行仅在未被后续业务修改时恢复。发生冲突的行会跳过并进入审计明细。</p>
      <code v-if="rollbackTarget" class="mci-code">ImportKey: {{ rollbackTarget.ImportKey }}
TargetTable: {{ rollbackTarget.TargetTable }}
Success: {{ rollbackTarget.SuccessCount || 0 }}</code>
    </MciDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import MciDataTable from '../components/MciDataTable.vue'
import MciDialog from '../components/MciDialog.vue'
import MciPageIntro from '../components/MciPageIntro.vue'
import MciStatePanel from '../components/MciStatePanel.vue'
import type { ActionState, HostContext } from '../domain/models'
import { getTable, listBackground, runBackground, runEngine } from '../platform/client'

const props = defineProps<{ context: HostContext }>()
type Row = Record<string, any>
interface ImportPlan { Target: Row; Fields: Row[]; Rows: Row[]; Mapping: Row; FileHash: string; PlanHash: string; Summary: { Total: number; Add: number; Update: number; Invalid: number }; CanStage: boolean }
const jobs = ref<Row[]>([]), rows = ref<Row[]>([]), availableTables = ref<Row[]>([]), backgroundTasks = ref<Row[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading'), error = ref(''), action = reactive<ActionState>({ status: 'idle' })
const selectedJobId = ref(''), composerOpen = ref(false), rollbackOpen = ref(false), rollbackTarget = ref<Row | null>(null), plan = ref<ImportPlan | null>(null)
const fileInput = ref<HTMLInputElement | null>(null), fileName = ref(''), records = ref<Row[]>([]), fileBase64 = ref('')
const form = reactive({ TargetTable: '', ChunkSize: 50, MappingText: '{}' })
const selectedJob = computed(() => jobs.value.find((item) => String(item.Id) === selectedJobId.value) || null)
const rowColumns = [{ key: 'RowNo', label: '行号' }, { key: 'Action', label: '动作' }, { key: 'Status', label: '状态', tone: true }, { key: 'TargetId', label: '目标Id' }, { key: 'ErrorMessage', label: '错误说明' }]
let timer = 0

function statusLabel(status: string) { return ({ Staged: '已暂存', Running: '处理中', Paused: '已暂停', Completed: '已完成', CompletedWithErrors: '完成但有错误', Cancelled: '已取消', RollingBack: '回滚中', RolledBack: '已回滚', Failed: '失败' } as Record<string, string>)[status] || status || '未知' }
function statusTone(status: string) { if (['Completed','RolledBack'].includes(status)) return 'success'; if (['Failed','CompletedWithErrors'].includes(status)) return 'danger'; if (['Running','RollingBack','Staged'].includes(status)) return 'primary'; return 'warning' }
function protectedTable(name: string) { return ['diy_table','diy_field','sys_user','sys_menu','sys_role','sys_rolelimit','sys_apiengine','sys_osclients','sys_config','mci_import_job','mci_import_row'].includes(String(name || '').toLowerCase()) }
function parseMapping() { const value = JSON.parse(form.MappingText || '{}'); if (!value || Array.isArray(value) || typeof value !== 'object') throw new Error('字段映射必须是JSON对象。'); return value }
function parseCsv(text: string): Row[] { const result: string[][] = []; let row: string[] = [], cell = '', quoted = false; for (let i = 0; i < text.length; i++) { const char = text[i], next = text[i + 1]; if (quoted && char === '"' && next === '"') { cell += '"'; i++ } else if (char === '"') quoted = !quoted; else if (!quoted && char === ',') { row.push(cell); cell = '' } else if (!quoted && (char === '\n' || char === '\r')) { if (char === '\r' && next === '\n') i++; row.push(cell); if (row.some((item) => item !== '')) result.push(row); row = []; cell = '' } else cell += char } row.push(cell); if (row.some((item) => item !== '')) result.push(row); const headers = result.shift()?.map((item) => item.trim()) || []; return result.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))) }
function toBase64(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let binary = ''; const chunk = 0x8000; for (let offset = 0; offset < bytes.length; offset += chunk) binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length))); return btoa(binary) }
async function readFile(event: Event) { plan.value = null; records.value = []; fileBase64.value = ''; action.message = ''; const file = (event.target as HTMLInputElement).files?.[0]; if (!file) return; if (file.size > 20 * 1024 * 1024) { action.status = 'error'; action.message = '文件超过20MB，请拆分后重试。'; return } fileName.value = file.name; try { if (/\.json$/i.test(file.name)) { const value = JSON.parse(await file.text()); records.value = Array.isArray(value) ? value : (Array.isArray(value.Data) ? value.Data : []); if (!records.value.length) throw new Error('JSON必须是对象数组或包含Data数组。') } else if (/\.csv$/i.test(file.name)) records.value = parseCsv(await file.text()); else fileBase64.value = toBase64(await file.arrayBuffer()); action.status = 'idle'; action.message = `已读取 ${file.name}，请执行预检。` } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '文件解析失败。' } }
async function load(silent = false) { if (!silent) state.value = 'loading'; try { const [jobPage, tablePage, tasks] = await Promise.all([getTable<Row>(props.context, 'mci_import_job'), getTable<Row>(props.context, 'diy_table', { _SelectFields: ['Id','Name','Description'], _PageSize: 1000 }), listBackground<Row>(props.context)]); jobs.value = jobPage.rows; availableTables.value = tablePage.rows.filter((item) => !protectedTable(item.Name)); backgroundTasks.value = tasks.filter((item) => ['mci-import-execute','mci-import-rollback'].includes(item.ApiEngineKey)); if (!selectedJobId.value && jobs.value.length) selectedJobId.value = String(jobs.value[0].Id); if (selectedJobId.value) rows.value = (await getTable<Row>(props.context, 'mci_import_row', { _Where: [['JobId','=',selectedJobId.value]], _OrderBy: 'RowNo', _OrderByType: 'ASC' })).rows; state.value = 'ready'; error.value = '' } catch (e) { if (!silent) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } } }
async function act<T>(work: () => Promise<T>, success: string) { action.status = 'loading'; action.message = ''; try { const value = await work(); action.status = 'success'; action.message = success; return value } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '执行失败'; return null } }
async function planImport() { if (!form.TargetTable || (!records.value.length && !fileBase64.value)) { action.status = 'error'; action.message = '请选择来源文件并填写目标表。'; return } let mapping: Row; try { mapping = parseMapping() } catch (e) { action.status = 'error'; action.message = (e as Error).message; return } const result = await act(() => runEngine<ImportPlan>(props.context, 'mci-import-plan', { TargetTable: form.TargetTable, Records: records.value, FileByteBase64: fileBase64.value, FileName: fileName.value, Mapping: mapping }), '预检完成，请核对统计后暂存。'); if (result) plan.value = result }
async function stageAndRun() { if (!plan.value) return; const idempotencyKey = `import:${plan.value.Target.Name}:${plan.value.FileHash}:${plan.value.PlanHash}`; const staged = await act(() => runEngine<Row>(props.context, 'mci-import-stage', { TargetTable: form.TargetTable, Records: records.value, FileByteBase64: fileBase64.value, FileName: fileName.value, Mapping: parseMapping(), ExpectedPlanHash: plan.value?.PlanHash, IdempotencyKey: idempotencyKey, ChunkSize: form.ChunkSize }), '批次已暂存，正在提交后台执行。'); if (!staged) return; const jobId = String(staged.JobId || staged.Id); const task = await act(() => startExecute(jobId, `execute:${jobId}:initial`), '后台导入任务已进入持久队列。'); if (task) { selectedJobId.value = jobId; closeComposer(); await load() } }
function startExecute(jobId: string, key: string) { return runBackground<Row>(props.context, 'mci-import-execute', { ImportJobId: jobId }, `可恢复导入：${jobId}`, { IdempotencyKey: key, ConcurrencyKey: `mci-import:${jobId}`, MaxAttempts: 3, BusinessTable: 'mci_import_job', BusinessId: jobId, BusinessStatusField: 'Status', BusinessTaskIdField: 'BackgroundTaskId', BusinessProgressField: 'Progress', BusinessEtaField: 'EstimatedEndTime' }) }
async function selectJob(job: Row) { selectedJobId.value = String(job.Id); rows.value = (await getTable<Row>(props.context, 'mci_import_row', { _Where: [['JobId','=',selectedJobId.value]], _OrderBy: 'RowNo', _OrderByType: 'ASC' })).rows }
async function control(job: Row, command: string) { const result = await act(() => runEngine<Row>(props.context, 'mci-import-control', { ImportJobId: job.Id, Action: command }), `批次操作“${command}”已提交。`); if (result) await load() }
async function resume(job: Row) { if (job.Status === 'Paused' || job.Status === 'Failed') { const changed = await act(() => runEngine<Row>(props.context, 'mci-import-control', { ImportJobId: job.Id, Action: 'Resume' }), '批次已恢复。'); if (!changed) return } const taskKey = `execute:${job.Id}:${job.Progress || 0}:${job.SuccessCount || 0}:${job.FailedCount || 0}:${Date.now()}`; const result = await act(() => startExecute(String(job.Id), taskKey), '后台导入任务已进入持久队列。'); if (result) await load() }
function confirmRollback(job: Row) { rollbackTarget.value = job; rollbackOpen.value = true }
async function startRollback() { const job = rollbackTarget.value; if (!job) return; const key = `rollback:${job.Id}:${job.SuccessCount || 0}:${job.RolledBackCount || 0}`; const result = await act(() => runBackground<Row>(props.context, 'mci-import-rollback', { ImportJobId: job.Id }, `条件回滚：${job.ImportKey}`, { IdempotencyKey: key, ConcurrencyKey: `mci-import:${job.Id}`, MaxAttempts: 3, BusinessTable: 'mci_import_job', BusinessId: job.Id, BusinessStatusField: 'Status', BusinessTaskIdField: 'BackgroundTaskId', BusinessProgressField: 'Progress', BusinessEtaField: 'EstimatedEndTime' }), '后台回滚任务已进入持久队列。'); if (result) { rollbackOpen.value = false; await load() } }
function closeComposer() { composerOpen.value = false; plan.value = null; records.value = []; fileBase64.value = ''; fileName.value = ''; if (fileInput.value) fileInput.value.value = '' }
onMounted(async () => { await load(); timer = window.setInterval(() => { if (jobs.value.some((item) => ['Running','RollingBack'].includes(item.Status))) void load(true) }, 4000) })
onBeforeUnmount(() => { if (timer) window.clearInterval(timer) })
</script>

<style scoped>
.job-list { display: grid; gap: 10px; }.job { padding: 14px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-card); background: var(--mci-bg-elevated); cursor: pointer; transition: border-color .18s ease, background .18s ease; }.job:hover,.job[data-selected="true"] { border-color: color-mix(in srgb, var(--mci-color-primary) 42%, var(--mci-border-color)); background: color-mix(in srgb, var(--mci-color-primary) 3%, var(--mci-bg-elevated)); }.job__head,.job__actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.job__head > div { display: grid; gap: 3px; min-width: 0; }.job__head small { color: var(--mci-color-primary); font-family: var(--mci-font-mono); }.job__head strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.progress { height: 6px; margin: 12px 0; overflow: hidden; border-radius: var(--mci-radius-full); background: var(--mci-bg-soft); }.progress span { display: block; height: 100%; border-radius: inherit; background: var(--mci-gradient-primary); transition: width .25s ease; }.job__metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; }.job__metrics span { display: grid; gap: 2px; padding: 7px 9px; border-left: 2px solid var(--mci-border-strong); }.job__metrics strong { font-family: var(--mci-font-mono); }.job__metrics small { color: var(--mci-text-tertiary); }.job__actions { justify-content: flex-end; flex-wrap: wrap; margin-top: 12px; }.task-list { display: grid; gap: 10px; padding: 0; list-style: none; }.task-list li { display: flex; align-items: center; gap: 10px; padding: 10px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-input); }.task-list div { display: grid; gap: 3px; min-width: 0; }.task-list strong,.task-list small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.task-list small { color: var(--mci-text-tertiary); }.health-dot { width: 8px; height: 8px; flex: 0 0 8px; border-radius: 50%; background: var(--mci-color-warning); }.health-dot[data-state="Succeeded"] { background: var(--mci-color-success); }.health-dot[data-state="Failed"] { background: var(--mci-color-danger); }.form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.form-grid .full { grid-column: 1/-1; }.plan-box { margin-top: 14px; padding: 13px; border: 1px solid color-mix(in srgb, var(--mci-color-primary) 25%, var(--mci-border-color)); border-radius: var(--mci-shape-input); background: color-mix(in srgb, var(--mci-color-primary) 4%, var(--mci-bg-elevated)); }.plan-stats { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 8px; margin-bottom: 10px; }.plan-stats span { display: grid; gap: 3px; }.plan-stats strong { font-family: var(--mci-font-mono); font-size: 20px; }.plan-stats small,.privacy-note { color: var(--mci-text-tertiary); }.stage-button { width: 100%; margin-top: 10px; }.feedback { margin-top: 12px; padding: 10px; border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.feedback[data-state="error"] { color: var(--mci-color-danger); }.feedback[data-state="success"] { color: var(--mci-color-success); }
@media (max-width: 640px) { .form-grid { grid-template-columns: 1fr; }.form-grid .full { grid-column: auto; }.job__metrics,.plan-stats { grid-template-columns: repeat(2,minmax(0,1fr)); }.job__head { align-items: flex-start; }.job__actions { justify-content: stretch; }.job__actions button { flex: 1 1 120px; } }
</style>
