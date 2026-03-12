<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">🤖 AI模型配置</h1>
        <p class="oc-subtitle">管理大语言模型接口，支持 OpenAI 兼容 API</p>
      </div>
      <el-button class="oc-btn-glow" @click="openAddDialog"><el-icon><Plus /></el-icon> 添加模型</el-button>
    </div>

    <div class="oc-llm-grid">
      <div v-for="llm in llmList" :key="llm.Id" class="oc-llm-card" :class="{ default: llm.IsDefault == 1 }">
        <div class="oc-llm-header">
          <div class="oc-llm-avatar">🧠</div>
          <div class="oc-llm-title">
            <div class="oc-llm-name">
              {{ llm.ModelName }}
              <span v-if="llm.IsDefault == 1" class="oc-default-badge">默认</span>
            </div>
            <div class="oc-llm-provider">{{ llm.Provider || '自定义' }}</div>
          </div>
        </div>

        <div class="oc-llm-info">
          <div class="oc-llm-kv"><span class="k">Base URL</span><span class="v">{{ llm.BaseUrl }}</span></div>
          <div class="oc-llm-kv"><span class="k">API Key</span><span class="v">{{ maskKey(llm.ApiKey) }}</span></div>
          <div class="oc-llm-kv"><span class="k">Temperature</span><span class="v">{{ llm.Temperature || 0.7 }}</span></div>
          <div class="oc-llm-kv"><span class="k">Max Tokens</span><span class="v">{{ llm.MaxTokens || 4096 }}</span></div>
        </div>

        <div class="oc-llm-actions">
          <el-button v-if="llm.IsDefault != 1" text size="small" class="oc-text-btn" @click="handleSetDefault(llm)">⭐ 设为默认</el-button>
          <el-button text size="small" class="oc-text-btn" @click="handleTest(llm)">🔗 测试连接</el-button>
          <el-button text size="small" class="oc-text-btn" @click="openEditDialog(llm)">✏️ 编辑</el-button>
          <el-button text size="small" class="oc-text-btn danger" @click="handleDelete(llm)">🗑️</el-button>
        </div>
      </div>

      <div v-if="!llmList.length" class="oc-empty-mini" style="grid-column:1/-1;">
        暂无AI模型配置，点击右上角添加
      </div>
    </div>

    <!-- 添加/编辑弹窗 -->
    <el-dialog v-model="formVisible" :title="formData.Id ? '编辑模型' : '添加模型'" width="560px" class="oc-dialog" :close-on-click-modal="false" append-to-body>
      <el-form :model="formData" label-width="110px" class="oc-form">
        <el-form-item label="供应商">
          <el-select v-model="formData.Provider" class="oc-select" style="width:100%" @change="onProviderChange">
            <el-option label="OpenAI" value="openai" /><el-option label="DeepSeek" value="deepseek" />
            <el-option label="通义千问" value="qwen" /><el-option label="智谱 GLM" value="zhipu" />
            <el-option label="Moonshot" value="moonshot" /><el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型名称"><el-input v-model="formData.ModelName" placeholder="gpt-4o / deepseek-chat" class="oc-input" /></el-form-item>
        <el-form-item label="Base URL"><el-input v-model="formData.BaseUrl" placeholder="https://api.openai.com/v1" class="oc-input" /></el-form-item>
        <el-form-item label="API Key"><el-input v-model="formData.ApiKey" type="password" show-password placeholder="sk-..." class="oc-input" /></el-form-item>
        <el-form-item label="Temperature">
          <el-slider v-model="formData.Temperature" :min="0" :max="2" :step="0.1" :show-tooltip="true" style="padding: 0 10px;" />
        </el-form-item>
        <el-form-item label="Max Tokens"><el-input-number v-model="formData.MaxTokens" :min="256" :max="128000" :step="256" style="width:100%" /></el-form-item>
        <el-form-item label="System Prompt">
          <el-input v-model="formData.SystemPrompt" type="textarea" :rows="4" placeholder="系统提示词（可选）" class="oc-input" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formVisible=false" class="oc-btn-ghost">取消</el-button>
        <el-button class="oc-btn-glow" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 测试结果弹窗 -->
    <el-dialog v-model="testVisible" title="连接测试" width="450px" class="oc-dialog" append-to-body>
      <div class="oc-test-result" v-if="testResult">
        <div :class="'oc-test-status ' + (testResult.ok ? 'success' : 'fail')">
          {{ testResult.ok ? '✅ 连接成功' : '❌ 连接失败' }}
        </div>
        <div class="oc-test-detail" v-if="testResult.msg">{{ testResult.msg }}</div>
        <div class="oc-test-time" v-if="testResult.time">响应时间: {{ testResult.time }}ms</div>
      </div>
      <div v-else class="oc-empty-mini"><el-icon class="is-loading"><Loading /></el-icon> 测试中...</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { Plus, Loading } from '@element-plus/icons-vue'
import { getLlmList, addLlm, updateLlm, deleteLlm, setDefaultLlm } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'

const llmList = ref([])
const formVisible = ref(false)
const testVisible = ref(false)
const saving = ref(false)
const testResult = ref(null)
const formData = reactive({
  Id: '', Provider: 'deepseek', ModelName: 'deepseek-chat', BaseUrl: 'https://api.deepseek.com/v1',
  ApiKey: '', Temperature: 0.7, MaxTokens: 4096, SystemPrompt: ''
})

const providerDefaults = {
  openai: { ModelName: 'gpt-4o', BaseUrl: 'https://api.openai.com/v1' },
  deepseek: { ModelName: 'deepseek-chat', BaseUrl: 'https://api.deepseek.com/v1' },
  qwen: { ModelName: 'qwen-plus', BaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  zhipu: { ModelName: 'glm-4-flash', BaseUrl: 'https://open.bigmodel.cn/api/paas/v4' },
  moonshot: { ModelName: 'moonshot-v1-8k', BaseUrl: 'https://api.moonshot.cn/v1' },
  custom: { ModelName: '', BaseUrl: '' }
}

function maskKey(key) {
  if (!key) return '***'
  if (key.length <= 8) return '***'
  return key.substring(0, 4) + '****' + key.substring(key.length - 4)
}

function onProviderChange(provider) {
  const defaults = providerDefaults[provider]
  if (defaults) { formData.ModelName = defaults.ModelName; formData.BaseUrl = defaults.BaseUrl }
}

async function loadList() {
  const res = await getLlmList()
  if (res.Code === 1) { llmList.value = res.Data || [] }
}

function openAddDialog() {
  Object.assign(formData, { Id: '', Provider: 'deepseek', ModelName: 'deepseek-chat', BaseUrl: 'https://api.deepseek.com/v1', ApiKey: '', Temperature: 0.7, MaxTokens: 4096, SystemPrompt: '' })
  formVisible.value = true
}
function openEditDialog(llm) {
  Object.assign(formData, { Id: llm.Id, Provider: llm.Provider, ModelName: llm.ModelName, BaseUrl: llm.BaseUrl, ApiKey: '', Temperature: llm.Temperature || 0.7, MaxTokens: llm.MaxTokens || 4096, SystemPrompt: llm.SystemPrompt || '' })
  formVisible.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const res = formData.Id ? await updateLlm({ ...formData }) : await addLlm({ ...formData })
    if (res.Code === 1) { ElMessage.success('保存成功'); formVisible.value = false; loadList() }
    else ElMessage.error(res.Msg)
  } finally { saving.value = false }
}

async function handleDelete(llm) {
  await ElMessageBox.confirm(`确定删除模型【${llm.ModelName}】？`, '提示', { type: 'warning' })
  const res = await deleteLlm(llm.Id)
  if (res.Code === 1) { ElMessage.success('已删除'); loadList() } else ElMessage.error(res.Msg)
}

async function handleSetDefault(llm) {
  const res = await setDefaultLlm(llm.Id)
  if (res.Code === 1) { ElMessage.success('已设为默认'); loadList() } else ElMessage.error(res.Msg)
}

async function handleTest(llm) {
  testResult.value = null
  testVisible.value = true
  const start = Date.now()
  try {
    const resp = await fetch(llm.BaseUrl + '/models', {
      method: 'GET',
      headers: { 'Authorization': `Bearer test` }
    })
    const elapsed = Date.now() - start
    testResult.value = { ok: resp.status < 500, msg: `HTTP ${resp.status} - ${resp.statusText}`, time: elapsed }
  } catch (e) {
    testResult.value = { ok: false, msg: e.message, time: Date.now() - start }
  }
}

onMounted(loadList)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }
.oc-btn-ghost { background: rgba(255,255,255,0.04) !important; color: #8b8fa3 !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 10px !important; }

.oc-llm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.oc-llm-card { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 20px; transition: all 0.25s; }
.oc-llm-card:hover { border-color: rgba(249,115,22,0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.3); transform: translateY(-2px); }
.oc-llm-card.default { border-color: rgba(249,115,22,0.3); box-shadow: 0 0 20px rgba(249,115,22,0.08); }

.oc-llm-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.oc-llm-avatar { width: 44px; height: 44px; border-radius: 12px; background: linear-gradient(135deg, rgba(139,92,246,0.2), rgba(249,115,22,0.2)); display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
.oc-llm-name { font-size: 16px; font-weight: 700; color: #f0f0f5; display: flex; align-items: center; gap: 8px; }
.oc-llm-provider { font-size: 12px; color: #6b7280; }
.oc-default-badge { font-size: 9px; padding: 1px 6px; border-radius: 4px; background: linear-gradient(135deg, #f97316, #ef4444); color: #fff; font-weight: 600; }

.oc-llm-info { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
.oc-llm-kv { display: flex; justify-content: space-between; align-items: center; }
.oc-llm-kv .k { font-size: 12px; color: #6b7280; min-width: 90px; }
.oc-llm-kv .v { font-size: 12px; color: #8b8fa3; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 200px; }

.oc-llm-actions { display: flex; gap: 4px; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 10px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-text-btn:hover { color: #f97316 !important; }
.oc-text-btn.danger:hover { color: #ef4444 !important; }

.oc-test-result { text-align: center; padding: 20px; }
.oc-test-status { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.oc-test-status.success { color: #22c55e; }
.oc-test-status.fail { color: #ef4444; }
.oc-test-detail { font-size: 13px; color: #8b8fa3; margin-bottom: 6px; }
.oc-test-time { font-size: 12px; color: #6b7280; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }

:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper), :deep(.oc-input .el-textarea__inner) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
</style>
