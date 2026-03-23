<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">⚡ 任务中心</h1>
        <p class="oc-subtitle">管理任务模板、查看执行记录与日志</p>
      </div>
      <div style="display:flex;gap:10px">
        <el-button class="oc-btn-glow" @click="openAddDialog"><el-icon><Plus /></el-icon> 新建任务</el-button>
      </div>
    </div>

    <!-- 任务模板列表 -->
    <div class="oc-card">
      <div class="oc-card-header">
        <span class="oc-card-title">📋 任务模板</span>
        <div style="display:flex;gap:10px">
          <el-select v-model="filter.taskType" placeholder="任务类型" clearable size="small" class="oc-select" style="width:140px" @change="loadTemplates">
            <el-option label="完整流程" value="full_pipeline" /><el-option label="爬取" value="crawl" />
            <el-option label="写作" value="write" /><el-option label="发布" value="publish" /><el-option label="互评" value="interact" />
          </el-select>
          <el-input v-model="filter.keyword" placeholder="搜索模板名称" clearable size="small" class="oc-input" style="width:180px" @keyup.enter="loadTemplates" />
        </div>
      </div>
      <div class="oc-template-grid">
        <div v-for="tpl in templates" :key="tpl.Id" class="oc-template-card">
          <div class="oc-tpl-header">
            <span class="oc-tpl-type" :style="{background: typeColor(tpl.TaskType)}">{{ typeLabel(tpl.TaskType) }}</span>
            <el-switch v-model="tpl._enabled" size="small" :active-color="'#22c55e'" :inactive-color="'#333'" @change="handleToggle(tpl)" />
          </div>
          <div class="oc-tpl-name">{{ tpl.Name }}</div>
          <div class="oc-tpl-desc">{{ tpl.Description || '暂无描述' }}</div>
          <div class="oc-tpl-schedule" v-if="tpl.RunTimes">
            <el-icon><Clock /></el-icon>
            <span>{{ formatRunTimes(tpl.RunTimes) }}</span>
          </div>
          <div class="oc-tpl-actions">
            <el-button text size="small" class="oc-text-btn" @click="openExecuteDialog(tpl)">▶ 立即执行</el-button>
            <el-button text size="small" class="oc-text-btn" @click="showExecutions(tpl)">📊 执行记录</el-button>
            <el-button text size="small" class="oc-text-btn" @click="openEditDialog(tpl)">✏️ 编辑</el-button>
            <el-button text size="small" class="oc-text-btn danger" @click="handleDelete(tpl)">🗑️ 删除</el-button>
          </div>
        </div>
        <div v-if="!templates.length" class="oc-empty-mini" style="grid-column:1/-1;">暂无任务模板，点击右上角新建</div>
      </div>
    </div>

    <!-- 执行记录 -->
    <div class="oc-card" v-if="showExecPanel">
      <div class="oc-card-header">
        <span class="oc-card-title">📊 执行记录 — {{ execTitle }}</span>
        <el-button text size="small" class="oc-text-btn" @click="showExecPanel = false">✕ 关闭</el-button>
      </div>
      <el-table :data="executions" style="width:100%" class="oc-table" size="small" :header-cell-style="{background:'rgba(255,255,255,0.02)',color:'#8b8fa3',border:'none'}" :cell-style="{background:'transparent',color:'#d0d4e0',borderBottom:'1px solid rgba(255,255,255,0.04)'}">
        <el-table-column prop="Status" label="状态" width="90">
          <template #default="{row}">
            <span :class="'oc-exec-status status-' + row.Status">{{ statusLabel(row.Status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="TriggerType" label="触发" width="70">
          <template #default="{row}"><span class="oc-mini-tag">{{ row.TriggerType }}</span></template>
        </el-table-column>
        <el-table-column prop="NodeName" label="节点" width="120" />
        <el-table-column prop="CurrentStep" label="当前步骤" show-overflow-tooltip />
        <el-table-column prop="Progress" label="进度" width="80">
          <template #default="{row}"><el-progress :percentage="row.Progress || 0" :stroke-width="4" :show-text="false" color="#f97316" /></template>
        </el-table-column>
        <el-table-column prop="StartTime" label="开始时间" width="140" :formatter="(r) => formatTime(r.StartTime)" />
        <el-table-column prop="Duration" label="耗时" width="70">
          <template #default="{row}">{{ row.Duration ? row.Duration + 's' : '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button text size="small" class="oc-text-btn" @click="showLogs(row)">📋 日志</el-button>
            <el-button v-if="row.Status==='pending'||row.Status==='running'" text size="small" class="oc-text-btn danger" @click="handleCancel(row)">取消</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 日志弹窗 -->
    <el-dialog v-model="logVisible" title="执行日志" width="800px" class="oc-dialog" :close-on-click-modal="false" append-to-body>
      <div class="oc-log-container">
        <div v-for="log in logList" :key="log.Id" :class="'oc-log-line level-' + (log.Level||'INFO').toLowerCase()">
          <span class="oc-log-time">{{ formatTime(log.LogTime) }}</span>
          <span :class="'oc-log-level level-' + (log.Level||'INFO').toLowerCase()">{{ log.Level }}</span>
          <span class="oc-log-step">{{ log.StepName || log.Step }}</span>
          <span class="oc-log-msg">{{ log.Message }}</span>
        </div>
        <div v-if="!logList.length" class="oc-empty-mini">暂无日志</div>
      </div>
    </el-dialog>

    <!-- 新建/编辑任务弹窗 -->
    <el-dialog v-model="formVisible" :title="formData.Id ? '编辑任务模板' : '新建任务模板'" width="600px" class="oc-dialog" :close-on-click-modal="false" append-to-body>
      <el-form :model="formData" label-width="100px" class="oc-form">
        <el-form-item label="模板名称"><el-input v-model="formData.Name" placeholder="例：每日全自动发文" class="oc-input" /></el-form-item>
        <el-form-item label="任务类型">
          <el-select v-model="formData.TaskType" class="oc-select" style="width:100%">
            <el-option label="完整流程 (爬取→写作→发布→互评)" value="full_pipeline" />
            <el-option label="仅爬取文档" value="crawl" /><el-option label="仅AI写作" value="write" />
            <el-option label="仅发布文章" value="publish" /><el-option label="仅自动互评" value="interact" />
          </el-select>
        </el-form-item>
        <el-form-item label="执行时间"><el-input v-model="formData._runTimesStr" placeholder='JSON数组，如 ["09:00","14:00","20:00"]' class="oc-input" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="formData.Description" type="textarea" :rows="3" class="oc-input" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible=false" class="oc-btn-ghost">取消</el-button>
        <el-button class="oc-btn-glow" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 执行任务选择节点弹窗 -->
    <el-dialog v-model="execDialogVisible" title="选择执行节点" width="400px" class="oc-dialog" append-to-body>
      <div v-for="node in onlineNodes" :key="node.Id" class="oc-node-select-item" @click="handleExecute(node)">
        <span class="oc-dot online"></span>
        <span>{{ node.Name || node.IP }}</span>
        <span class="oc-node-os">{{ node.OSType }}</span>
      </div>
      <div v-if="!onlineNodes.length" class="oc-empty-mini">没有在线节点</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Clock } from '@element-plus/icons-vue'
import { getTaskList, addTask, updateTask, deleteTask, toggleTask, executeTask, getExecutions, getTaskLogs, cancelExecution, getNodeList } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const templates = ref([])
const executions = ref([])
const logList = ref([])
const onlineNodes = ref([])
const filter = reactive({ taskType: '', keyword: '' })
const showExecPanel = ref(false)
const execTitle = ref('')
const logVisible = ref(false)
const formVisible = ref(false)
const execDialogVisible = ref(false)
const saving = ref(false)
const formData = reactive({ Id: '', Name: '', TaskType: 'full_pipeline', Description: '', _runTimesStr: '["09:00","14:00","20:00"]' })
const execTemplateId = ref('')

const typeMap = { full_pipeline: '完整流程', crawl: '爬取', write: '写作', publish: '发布', interact: '互评' }
const typeColorMap = { full_pipeline: 'rgba(239,68,68,0.15)', crawl: 'rgba(245,158,11,0.15)', write: 'rgba(139,92,246,0.15)', publish: 'rgba(34,197,94,0.15)', interact: 'rgba(59,130,246,0.15)' }
const statusMap = { pending: '待执行', running: '运行中', success: '成功', failed: '失败', cancelled: '已取消' }

function typeLabel(t) { return typeMap[t] || t }
function typeColor(t) { return typeColorMap[t] || 'rgba(255,255,255,0.06)' }
function statusLabel(s) { return statusMap[s] || s }
function formatTime(t) { return t ? dayjs(t).format('MM-DD HH:mm:ss') : '-' }
function formatRunTimes(rt) {
  try { const arr = typeof rt === 'string' ? JSON.parse(rt) : rt; return arr.join(' / ') } catch { return rt }
}

async function loadTemplates() {
  const res = await getTaskList({ taskType: filter.taskType, keyword: filter.keyword, _PageSize: 50 })
  if (res.Code === 1) {
    templates.value = (res.Data || []).map(t => ({ ...t, _enabled: t.IsEnabled == 1 }))
  }
}

async function handleToggle(tpl) {
  await toggleTask(tpl.Id)
  loadTemplates()
}

function openAddDialog() {
  Object.assign(formData, { Id: '', Name: '', TaskType: 'full_pipeline', Description: '', _runTimesStr: '["09:00","14:00","20:00"]' })
  formVisible.value = true
}
function openEditDialog(tpl) {
  Object.assign(formData, { Id: tpl.Id, Name: tpl.Name, TaskType: tpl.TaskType, Description: tpl.Description, _runTimesStr: tpl.RunTimes || '[]' })
  formVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const params = { ...formData, RunTimes: formData._runTimesStr }
    delete params._runTimesStr
    const res = formData.Id ? await updateTask(params) : await addTask(params)
    if (res.Code === 1) { ElMessage.success('保存成功'); formVisible.value = false; loadTemplates() }
    else ElMessage.error(res.Msg)
  } finally { saving.value = false }
}

async function handleDelete(tpl) {
  await ElMessageBox.confirm(`确定删除任务模板【${tpl.Name}】？`, '提示', { type: 'warning', confirmButtonClass: 'oc-btn-glow' })
  const res = await deleteTask(tpl.Id)
  if (res.Code === 1) { ElMessage.success('已删除'); loadTemplates() } else ElMessage.error(res.Msg)
}

async function openExecuteDialog(tpl) {
  execTemplateId.value = tpl.Id
  const res = await getNodeList({ status: 1 })
  onlineNodes.value = res.Code === 1 ? (res.Data || []) : []
  execDialogVisible.value = true
}

async function handleExecute(node) {
  const res = await executeTask({ templateId: execTemplateId.value, nodeId: node.Id })
  if (res.Code === 1) { ElMessage.success(res.Msg); execDialogVisible.value = false }
  else ElMessage.error(res.Msg)
}

async function showExecutions(tpl) {
  execTitle.value = tpl.Name
  showExecPanel.value = true
  const res = await getExecutions({ templateId: tpl.Id, _PageSize: 20 })
  executions.value = res.Code === 1 ? (res.Data || []) : []
}

async function showLogs(exec) {
  const res = await getTaskLogs({ executionId: exec.Id, _PageSize: 500 })
  logList.value = res.Code === 1 ? (res.Data || []) : []
  logVisible.value = true
}

async function handleCancel(exec) {
  const res = await cancelExecution(exec.Id)
  if (res.Code === 1) { ElMessage.success('已取消'); showExecutions({ Id: exec.TemplateId, Name: execTitle.value }) }
  else ElMessage.error(res.Msg)
}

onMounted(loadTemplates)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }
.oc-btn-ghost { background: rgba(255,255,255,0.04) !important; color: #8b8fa3 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 10px !important; }
.oc-card { background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; margin-bottom: 16px; }
.oc-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.oc-card-title { font-size: 14px; font-weight: 600; color: #d0d4e0; }

.oc-template-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
.oc-template-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; transition: all 0.25s; }
.oc-template-card:hover { border-color: rgba(249,115,22,0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.3); transform: translateY(-2px); }
.oc-tpl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.oc-tpl-type { font-size: 10px; padding: 2px 8px; border-radius: 6px; color: #d0d4e0; font-weight: 600; }
.oc-tpl-name { font-size: 15px; font-weight: 700; color: #f0f0f5; margin-bottom: 6px; }
.oc-tpl-desc { font-size: 12px; color: #6b7280; margin-bottom: 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.oc-tpl-schedule { font-size: 11px; color: #8b8fa3; display: flex; align-items: center; gap: 4px; margin-bottom: 10px; }
.oc-tpl-actions { display: flex; gap: 4px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-text-btn:hover { color: #f97316 !important; }
.oc-text-btn.danger:hover { color: #ef4444 !important; }

.oc-exec-status { font-size: 11px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
.status-pending { background: rgba(245,158,11,0.12); color: #f59e0b; }
.status-running { background: rgba(59,130,246,0.12); color: #3b82f6; }
.status-success { background: rgba(34,197,94,0.12); color: #22c55e; }
.status-failed { background: rgba(239,68,68,0.12); color: #ef4444; }
.status-cancelled { background: rgba(107,114,128,0.12); color: #6b7280; }

/* 日志 */
.oc-log-container { max-height: 500px; overflow-y: auto; background: #0a0a12; border-radius: 10px; padding: 14px; font-family: 'Fira Code', 'Consolas', monospace; font-size: 12px; }
.oc-log-line { display: flex; gap: 10px; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.02); }
.oc-log-time { color: #4b5563; min-width: 100px; }
.oc-log-level { min-width: 50px; font-weight: 600; }
.level-info .oc-log-level, .level-info { color: #3b82f6; }
.level-warning .oc-log-level, .level-warning { color: #f59e0b; }
.level-error .oc-log-level, .level-error { color: #ef4444; }
.level-debug .oc-log-level, .level-debug { color: #6b7280; }
.oc-log-step { color: #a78bfa; min-width: 80px; }
.oc-log-msg { color: #d0d4e0; flex: 1; }

.oc-node-select-item { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; cursor: pointer; transition: all 0.2s; }
.oc-node-select-item:hover { background: rgba(249,115,22,0.08); }
.oc-dot { width: 8px; height: 8px; border-radius: 50%; }
.oc-dot.online { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.6); }
.oc-node-os { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #8b8fa3; margin-left: auto; }
.oc-mini-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(139,92,246,0.15); color: #a78bfa; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }
:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper), :deep(.oc-input .el-textarea__inner) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
</style>
