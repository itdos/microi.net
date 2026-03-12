<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">🔑 平台账号</h1>
        <p class="oc-subtitle">管理各平台登录账号和Cookie状态</p>
      </div>
      <el-button class="oc-btn-glow" @click="openAddDialog"><el-icon><Plus /></el-icon> 添加账号</el-button>
    </div>

    <div class="oc-account-grid">
      <div v-for="acc in accounts" :key="acc.Id" class="oc-account-card" :class="{ disabled: acc.IsEnabled != 1 }">
        <div class="oc-acc-header">
          <div class="oc-platform-icon" :style="{background: platformColor(acc.Platform)}">
            {{ platformIcon(acc.Platform) }}
          </div>
          <div class="oc-acc-info">
            <div class="oc-acc-name">{{ acc.AccountName || acc.Username }}</div>
            <div class="oc-acc-platform">{{ acc.Platform }}</div>
          </div>
          <el-switch v-model="acc._enabled" size="small" :active-color="'#22c55e'" :inactive-color="'#333'" @change="handleToggle(acc)" />
        </div>

        <div class="oc-acc-stats">
          <div class="oc-acc-stat">
            <span class="oc-acc-stat-label">Cookie状态</span>
            <span :class="'oc-cookie-status ' + (acc.CookieStatus === 'valid' ? 'valid' : 'invalid')">
              {{ acc.CookieStatus === 'valid' ? '✅ 有效' : '⚠️ 过期' }}
            </span>
          </div>
          <div class="oc-acc-stat">
            <span class="oc-acc-stat-label">登录方式</span>
            <span class="oc-acc-stat-val">{{ acc.LoginType || 'cookie' }}</span>
          </div>
          <div class="oc-acc-stat">
            <span class="oc-acc-stat-label">最后活跃</span>
            <span class="oc-acc-stat-val">{{ formatTime(acc.UpdateTime) }}</span>
          </div>
        </div>

        <div class="oc-acc-actions">
          <el-button text size="small" class="oc-text-btn" @click="openEditDialog(acc)">✏️ 编辑</el-button>
          <el-button text size="small" class="oc-text-btn danger" @click="handleDelete(acc)">🗑️ 删除</el-button>
        </div>
      </div>

      <div v-if="!accounts.length" class="oc-empty-mini" style="grid-column:1/-1;">
        暂无平台账号，点击右上角添加
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formData.Id ? '编辑账号' : '添加账号'" width="550px" class="oc-dialog" :close-on-click-modal="false" append-to-body>
      <el-form :model="formData" label-width="100px" class="oc-form">
        <el-form-item label="平台">
          <el-select v-model="formData.Platform" class="oc-select" style="width:100%">
            <el-option v-for="p in platforms" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="账号名称"><el-input v-model="formData.AccountName" placeholder="显示用的别名" class="oc-input" /></el-form-item>
        <el-form-item label="用户名"><el-input v-model="formData.Username" placeholder="登录用户名" class="oc-input" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="formData.Password" type="password" placeholder="登录密码 (加密存储)" class="oc-input" show-password /></el-form-item>
        <el-form-item label="登录方式">
          <el-select v-model="formData.LoginType" class="oc-select" style="width:100%">
            <el-option label="Cookie" value="cookie" /><el-option label="账号密码" value="password" />
            <el-option label="扫码登录" value="qrcode" />
          </el-select>
        </el-form-item>
        <el-form-item label="Cookie">
          <el-input v-model="formData.Cookie" type="textarea" :rows="4" placeholder="粘贴浏览器Cookie" class="oc-input" />
        </el-form-item>
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
import { ref, reactive, onMounted } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import { getAccountList, addAccount, updateAccount, deleteAccount, toggleAccount } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const accounts = ref([])
const formVisible = ref(false)
const saving = ref(false)
const formData = reactive({ Id: '', Platform: 'csdn', AccountName: '', Username: '', Password: '', LoginType: 'cookie', Cookie: '', Remark: '' })
const platforms = ['csdn', 'juejin', 'zhihu', 'jianshu', 'segmentfault', 'cnblogs', 'oschina', 'toutiao', 'wechat']

const platformIcons = { csdn: 'C', juejin: '掘', zhihu: '知', jianshu: '简', segmentfault: 'SF', cnblogs: '博', oschina: 'OS', toutiao: '头', wechat: '微' }
const platformColors = {
  csdn: 'linear-gradient(135deg,#fc5531,#e53e3e)', juejin: 'linear-gradient(135deg,#1e80ff,#3b82f6)',
  zhihu: 'linear-gradient(135deg,#0066ff,#2563eb)', jianshu: 'linear-gradient(135deg,#ea6f5a,#f97316)',
  segmentfault: 'linear-gradient(135deg,#009a61,#22c55e)', cnblogs: 'linear-gradient(135deg,#3e76c1,#6366f1)',
  oschina: 'linear-gradient(135deg,#3e8e41,#22c55e)', toutiao: 'linear-gradient(135deg,#f5222d,#ef4444)',
  wechat: 'linear-gradient(135deg,#07c160,#22c55e)'
}
function platformIcon(p) { return platformIcons[p] || p.charAt(0).toUpperCase() }
function platformColor(p) { return platformColors[p] || 'linear-gradient(135deg,#6b7280,#4b5563)' }
function formatTime(t) { return t ? dayjs(t).format('MM-DD HH:mm') : '-' }

async function loadAccounts() {
  const res = await getAccountList({ _PageSize: 100 })
  if (res.Code === 1) { accounts.value = (res.Data || []).map(a => ({ ...a, _enabled: a.IsEnabled == 1 })) }
}

function openAddDialog() {
  Object.assign(formData, { Id: '', Platform: 'csdn', AccountName: '', Username: '', Password: '', LoginType: 'cookie', Cookie: '', Remark: '' })
  formVisible.value = true
}
function openEditDialog(acc) {
  Object.assign(formData, { Id: acc.Id, Platform: acc.Platform, AccountName: acc.AccountName, Username: acc.Username, Password: '', LoginType: acc.LoginType, Cookie: acc.Cookie, Remark: acc.Remark })
  formVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const res = formData.Id ? await updateAccount({ ...formData }) : await addAccount({ ...formData })
    if (res.Code === 1) { ElMessage.success('保存成功'); formVisible.value = false; loadAccounts() }
    else ElMessage.error(res.Msg)
  } finally { saving.value = false }
}

async function handleToggle(acc) {
  await toggleAccount(acc.Id)
  loadAccounts()
}

async function handleDelete(acc) {
  await ElMessageBox.confirm(`确定删除账号【${acc.AccountName || acc.Username}】？`, '提示', { type: 'warning' })
  const res = await deleteAccount(acc.Id)
  if (res.Code === 1) { ElMessage.success('已删除'); loadAccounts() } else ElMessage.error(res.Msg)
}

onMounted(loadAccounts)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }
.oc-btn-ghost { background: rgba(255,255,255,0.04) !important; color: #8b8fa3 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 10px !important; }

.oc-account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

.oc-account-card { background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; transition: all 0.25s; }
.oc-account-card:hover { border-color: rgba(249,115,22,0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.3); transform: translateY(-2px); }
.oc-account-card.disabled { opacity: 0.5; }

.oc-acc-header { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.oc-platform-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 15px; flex-shrink: 0; }
.oc-acc-info { flex: 1; }
.oc-acc-name { font-size: 15px; font-weight: 700; color: #f0f0f5; }
.oc-acc-platform { font-size: 12px; color: #6b7280; text-transform: uppercase; }

.oc-acc-stats { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.oc-acc-stat { display: flex; justify-content: space-between; align-items: center; }
.oc-acc-stat-label { font-size: 12px; color: #6b7280; }
.oc-acc-stat-val { font-size: 12px; color: #8b8fa3; }
.oc-cookie-status { font-size: 12px; }
.oc-cookie-status.valid { color: #22c55e; }
.oc-cookie-status.invalid { color: #f59e0b; }

.oc-acc-actions { display: flex; gap: 4px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-text-btn:hover { color: #f97316 !important; }
.oc-text-btn.danger:hover { color: #ef4444 !important; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }
:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper), :deep(.oc-input .el-textarea__inner) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
</style>
