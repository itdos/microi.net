<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">🖥️ 节点管理</h1>
        <p class="oc-subtitle">管理 OpenClaw 运行节点、监控状态与下发指令</p>
      </div>
      <el-button class="oc-btn-glow" @click="openAddDialog"><el-icon><Plus /></el-icon> 添加节点</el-button>
    </div>

    <div class="oc-node-grid">
      <div v-for="node in nodes" :key="node.Id" class="oc-node-card" :class="{ offline: node.Status != 1 }">
        <div class="oc-node-header">
          <span :class="'oc-status-circle ' + (node.Status == 1 ? 'online' : 'offline')"></span>
          <span class="oc-node-name">{{ node.Name || node.IP }}</span>
          <span class="oc-os-badge">{{ node.OSType || 'Unknown' }}</span>
        </div>

        <div class="oc-node-metrics" v-if="node.Status == 1">
          <div class="oc-metric">
            <span class="oc-metric-label">CPU</span>
            <el-progress :percentage="node.CPUUsage || 0" :stroke-width="6" :show-text="false" :color="barColor(node.CPUUsage)" />
            <span class="oc-metric-val">{{ node.CPUUsage || 0 }}%</span>
          </div>
          <div class="oc-metric">
            <span class="oc-metric-label">内存</span>
            <el-progress :percentage="node.MemoryUsage || 0" :stroke-width="6" :show-text="false" :color="barColor(node.MemoryUsage)" />
            <span class="oc-metric-val">{{ node.MemoryUsage || 0 }}%</span>
          </div>
          <div class="oc-metric">
            <span class="oc-metric-label">磁盘</span>
            <el-progress :percentage="node.DiskUsage || 0" :stroke-width="6" :show-text="false" :color="barColor(node.DiskUsage)" />
            <span class="oc-metric-val">{{ node.DiskUsage || 0 }}%</span>
          </div>
        </div>

        <div class="oc-node-info-grid">
          <div class="oc-node-kv"><span class="k">IP</span><span class="v">{{ node.IP || '-' }}</span></div>
          <div class="oc-node-kv"><span class="k">端口</span><span class="v">{{ node.Port || '-' }}</span></div>
          <div class="oc-node-kv"><span class="k">机器码</span><span class="v">{{ (node.MachineCode || '').substring(0, 12) }}...</span></div>
          <div class="oc-node-kv"><span class="k">Python</span><span class="v">{{ node.PythonVersion || '-' }}</span></div>
          <div class="oc-node-kv"><span class="k">运行任务</span><span class="v">{{ node.RunningTasks || 0 }}</span></div>
          <div class="oc-node-kv"><span class="k">心跳</span><span class="v">{{ formatTime(node.LastHeartbeat) }}</span></div>
        </div>

        <div class="oc-node-actions">
          <el-button text size="small" class="oc-text-btn" @click="openEditDialog(node)">✏️ 编辑</el-button>
          <el-dropdown size="small" @command="(cmd) => handleCommand(node, cmd)">
            <el-button text size="small" class="oc-text-btn">📡 指令 ▾</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="restart_service">🔄 重启服务</el-dropdown-item>
                <el-dropdown-item command="update_config">⚙️ 更新配置</el-dropdown-item>
                <el-dropdown-item command="clear_cache">🧹 清除缓存</el-dropdown-item>
                <el-dropdown-item command="pull_update">📥 拉取更新</el-dropdown-item>
                <el-dropdown-item command="stop_all_tasks" divided>⛔ 停止所有任务</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button text size="small" class="oc-text-btn danger" @click="handleDelete(node)">🗑️ 删除</el-button>
        </div>
      </div>

      <div v-if="!nodes.length" class="oc-empty-mini" style="grid-column:1/-1;">暂无节点，点击右上角添加</div>
    </div>

    <!-- 添加/编辑节点弹窗 -->
    <el-dialog v-model="formVisible" :title="formData.Id ? '编辑节点' : '添加节点'" width="500px" class="oc-dialog" :close-on-click-modal="false" append-to-body>
      <el-form :model="formData" label-width="90px" class="oc-form">
        <el-form-item label="节点名称"><el-input v-model="formData.Name" placeholder="例: 生产节点-01" class="oc-input" /></el-form-item>
        <el-form-item label="IP地址"><el-input v-model="formData.IP" placeholder="节点IP地址" class="oc-input" /></el-form-item>
        <el-form-item label="端口"><el-input v-model="formData.Port" placeholder="9000" class="oc-input" /></el-form-item>
        <el-form-item label="操作系统">
          <el-select v-model="formData.OSType" class="oc-select" style="width:100%">
            <el-option label="Windows" value="Windows" /><el-option label="macOS" value="macOS" /><el-option label="Linux" value="Linux" />
          </el-select>
        </el-form-item>
        <el-form-item label="机器码"><el-input v-model="formData.MachineCode" placeholder="唯一标识，自动填充" class="oc-input" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="formData.Remark" class="oc-input" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible=false" class="oc-btn-ghost">取消</el-button>
        <el-button class="oc-btn-glow" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getNodeList, addNode, updateNode, deleteNode, sendNodeCommand } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const nodes = ref([])
const formVisible = ref(false)
const saving = ref(false)
const formData = reactive({ Id: '', Name: '', IP: '', Port: '9000', OSType: 'Linux', MachineCode: '', Remark: '' })
let timer = null

function formatTime(t) { return t ? dayjs(t).format('MM-DD HH:mm:ss') : '-' }
function barColor(val) {
  if (val >= 90) return '#ef4444'
  if (val >= 70) return '#f59e0b'
  return '#22c55e'
}

async function loadNodes() {
  const res = await getNodeList({ _PageSize: 50 })
  if (res.Code === 1) { nodes.value = res.Data || [] }
}

function openAddDialog() {
  Object.assign(formData, { Id: '', Name: '', IP: '', Port: '9000', OSType: 'Linux', MachineCode: '', Remark: '' })
  formVisible.value = true
}
function openEditDialog(node) {
  Object.assign(formData, { Id: node.Id, Name: node.Name, IP: node.IP, Port: node.Port, OSType: node.OSType, MachineCode: node.MachineCode, Remark: node.Remark })
  formVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const res = formData.Id ? await updateNode({ ...formData }) : await addNode({ ...formData })
    if (res.Code === 1) { ElMessage.success('保存成功'); formVisible.value = false; loadNodes() }
    else ElMessage.error(res.Msg)
  } finally { saving.value = false }
}

async function handleDelete(node) {
  await ElMessageBox.confirm(`确定删除节点【${node.Name || node.IP}】？`, '提示', { type: 'warning' })
  const res = await deleteNode(node.Id)
  if (res.Code === 1) { ElMessage.success('已删除'); loadNodes() } else ElMessage.error(res.Msg)
}

async function handleCommand(node, cmd) {
  await ElMessageBox.confirm(`确定对节点【${node.Name || node.IP}】执行【${cmd}】指令？`, '确认', { type: 'warning' })
  const res = await sendNodeCommand({ nodeId: node.Id, command: cmd })
  if (res.Code === 1) ElMessage.success(res.Msg || '指令已下发')
  else ElMessage.error(res.Msg)
}

onMounted(() => {
  loadNodes()
  timer = setInterval(loadNodes, 30000) // 30秒自动刷新
})
onUnmounted(() => { if (timer) clearInterval(timer) })
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }
.oc-btn-ghost { background: rgba(255,255,255,0.04) !important; color: #8b8fa3 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 10px !important; }

.oc-node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.oc-node-card { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; transition: all 0.25s; }
.oc-node-card:hover { border-color: rgba(249,115,22,0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.3); transform: translateY(-2px); }
.oc-node-card.offline { opacity: 0.6; }

.oc-node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.oc-status-circle { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.oc-status-circle.online { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,0.6); animation: pulse 2s infinite; }
.oc-status-circle.offline { background: #6b7280; }
.oc-node-name { font-size: 15px; font-weight: 700; color: #f0f0f5; flex: 1; }
.oc-os-badge { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: rgba(139,92,246,0.12); color: #a78bfa; }

.oc-node-metrics { display: flex; flex-direction: column; gap: 8px; margin-bottom: 14px; background: rgba(0,0,0,0.2); border-radius: 10px; padding: 12px; }
.oc-metric { display: flex; align-items: center; gap: 8px; }
.oc-metric-label { font-size: 11px; color: #6b7280; min-width: 30px; }
.oc-metric :deep(.el-progress) { flex: 1; }
.oc-metric :deep(.el-progress-bar__outer) { background: rgba(255,255,255,0.06) !important; }
.oc-metric-val { font-size: 11px; color: #8b8fa3; min-width: 35px; text-align: right; }

.oc-node-info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; margin-bottom: 14px; }
.oc-node-kv { display: flex; justify-content: space-between; }
.oc-node-kv .k { font-size: 11px; color: #6b7280; }
.oc-node-kv .v { font-size: 11px; color: #8b8fa3; }

.oc-node-actions { display: flex; gap: 4px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-text-btn:hover { color: #f97316 !important; }
.oc-text-btn.danger:hover { color: #ef4444 !important; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }
:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
</style>
