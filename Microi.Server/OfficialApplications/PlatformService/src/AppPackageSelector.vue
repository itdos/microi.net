<template>
  <main class="package-app">
    <header class="package-head">
      <div>
        <h1>配置 AI 应用包</h1>
        <p>编译包始终发布；源码包按应用单独选择，默认不发布源码。</p>
      </div>
    </header>

    <section class="package-toolbar">
      <input v-model.trim="keyword" placeholder="输入应用名称、Key 或类型搜索" />
      <span>已选择 {{ selectedCount }} 个应用</span>
    </section>

    <section class="app-list">
      <article v-for="app in filteredApps" :key="app.Id" class="app-card" :class="{ selected: selection[app.Id]?.Selected }">
        <label class="app-main">
          <input v-model="selection[app.Id].Selected" type="checkbox" />
          <span>
            <strong>{{ app.Name }}</strong>
            <small>{{ app.AppKey }} · {{ app.AppType }}</small>
          </span>
        </label>
        <label class="source-toggle">
          <input v-model="selection[app.Id].IncludeSource" type="checkbox" :disabled="!selection[app.Id].Selected" />
          同时发布源码 ZIP
        </label>
      </article>
      <div v-if="!loading && !filteredApps.length" class="empty">没有匹配的 AI 应用</div>
      <div v-if="loading" class="empty">正在加载 AI 应用…</div>
    </section>

    <div class="package-note">ZIP 仅在接口执行期间临时转为 Base64，数据库只保存公开文件地址、大小和校验值。</div>
    <footer class="package-actions">
      <button type="button" @click="cancel">取消</button>
      <button type="button" class="primary" :disabled="preparing || selectedCount === 0" @click="confirm">
        {{ preparing ? '正在打包并上传…' : `确定并生成（${selectedCount}）` }}
      </button>
    </footer>
    <div v-if="error" class="error">{{ error }}</div>
  </main>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { configureV8, dispatch, getContext } from './microi.js'

const client = configureV8()
const context = getContext()
const apps = ref([])
const selection = reactive({})
const keyword = ref('')
const loading = ref(true)
const preparing = ref(false)
const error = ref('')

const filteredApps = computed(() => {
  const value = keyword.value.toLowerCase()
  if (!value) return apps.value
  return apps.value.filter(app => `${app.Name || ''} ${app.AppKey || ''} ${app.AppType || ''}`.toLowerCase().includes(value))
})
const selectedCount = computed(() => Object.values(selection).filter(item => item.Selected).length)

function parseInitialSelection() {
  const raw = context.dialogData?.Selection || context.dialogData?.SelectAiApp || []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw || '[]') } catch { return [] }
}

async function call(action, payload = {}) {
  const result = await client.post('/apiengine/ai_app_prepare_store_assets', { Action: action, ...payload })
  if (!result || result.Code !== 1) throw new Error(result?.Msg || '接口执行失败')
  return result.Data || {}
}

async function loadApps() {
  const data = await call('List')
  apps.value = data.Apps || []
  const initial = parseInitialSelection()
  apps.value.forEach(app => {
    const old = initial.find(item => String(item.AppId || item.Id) === String(app.Id))
    selection[app.Id] = { Selected: !!old, IncludeSource: !!old?.IncludeSource }
  })
}

async function confirm() {
  const selected = apps.value
    .filter(app => selection[app.Id]?.Selected)
    .map(app => ({ AppId: app.Id, IncludeSource: !!selection[app.Id].IncludeSource }))
  if (!selected.length) return
  preparing.value = true
  error.value = ''
  try {
    const data = await call('Prepare', { Apps: selected })
    dispatch('app-dialog:success', data)
  } catch (e) {
    error.value = e.message
  } finally {
    preparing.value = false
  }
}

function cancel() { dispatch('app-dialog:cancel', {}) }

onMounted(async () => {
  try { await loadApps() } catch (e) { error.value = e.message } finally { loading.value = false }
})
</script>

<style scoped>
.package-app { display: flex; height: min(620px, calc(100vh - 190px)); min-height: 460px; flex-direction: column; overflow: hidden; padding: 18px; color: #273142; background: #f6f8fb; }
.package-head, .package-toolbar, .package-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.package-head { padding: 16px 18px; border: 1px solid #d7e8ff; border-radius: 12px; background: #eff7ff; }
h1 { margin: 0 0 5px; font-size: 20px; } p { margin: 0; color: #617083; font-size: 13px; }
button, input { min-height: 36px; border: 1px solid #d9e0e8; border-radius: 7px; background: #fff; font: inherit; }
button { padding: 0 15px; cursor: pointer; }
.package-toolbar { margin: 14px 0 10px; }.package-toolbar input { width: min(520px, 70%); padding: 0 11px; }.package-toolbar span { color: #667085; font-size: 13px; }
.app-list { min-height: 0; flex: 1; overflow-y: auto; padding: 3px; }
.app-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 9px; padding: 13px 15px; border: 1px solid #e1e6ed; border-radius: 10px; background: #fff; }.app-card.selected { border-color: #409eff; background: #f2f8ff; }
.app-main { display: flex; min-width: 0; align-items: center; gap: 11px; cursor: pointer; }.app-main input, .source-toggle input { min-height: auto; }.app-main span { display: grid; gap: 4px; }.app-main strong { font-size: 14px; }.app-main small { color: #748094; font-size: 12px; }
.source-toggle { display: flex; align-items: center; gap: 7px; color: #596579; font-size: 13px; cursor: pointer; }.source-toggle:has(input:disabled) { opacity: .55; }
.package-note { margin-top: 10px; padding: 10px 12px; border-radius: 8px; color: #526173; background: #eef2f6; font-size: 12px; }.package-actions { margin-top: 12px; justify-content: flex-end; }.primary { border-color: #409eff; color: #fff; background: #409eff; }.primary:disabled { opacity: .55; cursor: not-allowed; }.empty { padding: 70px 10px; color: #98a2b3; text-align: center; }.error { margin-top: 10px; padding: 9px 12px; border-radius: 7px; color: #c0362c; background: #fff1f0; font-size: 13px; }
@media (max-width: 680px) { .package-app { height: auto; min-height: 0; }.app-card { align-items: flex-start; flex-direction: column; gap: 10px; }.package-toolbar input { width: 100%; }.package-toolbar span { display: none; } }
</style>

