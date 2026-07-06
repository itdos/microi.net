<template>
  <div class="profile-page">
    <aside class="profile-sidebar">
      <a class="brand" href="/">
        <span class="brand-mark">M</span>
        <span>
          <strong>Microi吾码</strong>
          <small>个人中心</small>
        </span>
      </a>
      <nav class="side-menu">
        <button
          v-for="item in menus"
          :key="item.key"
          type="button"
          class="side-menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="activeMenu = item.key"
        >
          <span class="menu-icon">{{ item.icon }}</span>
          <span>{{ item.name }}</span>
        </button>
      </nav>
      <div class="sidebar-footer">
        <a href="/login.html">登录/注册</a>
        <a href="/">返回官网</a>
      </div>
    </aside>

    <main class="profile-main">
      <header class="profile-header">
        <div>
          <p class="eyebrow">Microi Account</p>
          <h1>{{ pageTitle }}</h1>
          <p class="header-desc">{{ pageDesc }}</p>
        </div>
        <div class="header-actions">
          <a v-if="primaryTenantUrl" class="ghost-action" :href="primaryTenantUrl" target="_blank" rel="noopener">进入后台</a>
          <button class="primary-action" type="button" @click="refreshCenter">刷新</button>
        </div>
      </header>

      <section v-if="!isAuthed" class="state-panel">
        <h2>请先登录</h2>
        <p>登录后可以查看你的 SaaS 租户、免费创建第一个数据库，并进入后台管理系统。</p>
        <a class="primary-action inline" href="/login.html?redirect=/profile.html">去登录</a>
      </section>

      <template v-else>
        <section v-if="activeMenu === 'overview'" class="overview-grid">
          <article class="stat-card">
            <span>已创建租户</span>
            <strong>{{ tenants.length }}</strong>
            <small>免费额度 {{ tenantCenter.FreeQuota || 1 }} 个</small>
          </article>
          <article class="stat-card">
            <span>免费创建</span>
            <strong>{{ canCreateFreeTenant ? '可用' : '已使用' }}</strong>
            <small>每个账号可免费创建 1 个租户</small>
          </article>
          <article class="stat-card">
            <span>扩容价格</span>
            <strong>¥{{ tenantCenter.NextTenantPrice || 9.9 }}</strong>
            <small>第二个租户起 / 年</small>
          </article>
        </section>

        <section v-if="activeMenu === 'overview'" class="content-panel">
          <div class="panel-head">
            <div>
              <h2>最近租户</h2>
              <p>你的独立低代码数据库与访问入口。</p>
            </div>
            <button class="link-action" type="button" @click="activeMenu = tenants.length ? 'tenants' : 'create'">
              {{ tenants.length ? '查看全部' : '创建租户' }}
            </button>
          </div>
          <TenantList :tenants="tenants.slice(0, 3)" />
          <EmptyTenants v-if="!isLoading && tenants.length === 0" @create="activeMenu = 'create'" />
        </section>

        <section v-if="activeMenu === 'tenants'" class="content-panel">
          <div class="panel-head">
            <div>
              <h2>我的租户</h2>
              <p>当前账号名下所有 SaaS 租户数据库。</p>
            </div>
            <button class="primary-action small" type="button" @click="activeMenu = 'create'">创建租户</button>
          </div>
          <div v-if="isLoading" class="loading-row">正在读取租户信息...</div>
          <TenantList v-else :tenants="tenants" />
          <EmptyTenants v-if="!isLoading && tenants.length === 0" @create="activeMenu = 'create'" />
        </section>

        <section v-if="activeMenu === 'create'" class="content-grid">
          <form class="content-panel create-panel" @submit.prevent="createTenant">
            <div class="panel-head">
              <div>
                <h2>{{ canCreateFreeTenant ? '创建免费租户' : '创建更多租户' }}</h2>
                <p>{{ canCreateFreeTenant ? '第一个租户免费，创建完成后即可访问后台。' : '第二个租户开始每个 9.9 元/年，付费开通功能即将开放。' }}</p>
              </div>
            </div>
            <div class="form-row">
              <label>租户 Key</label>
              <input v-model.trim="tenantKey" placeholder="例如 anderson" autocomplete="off" />
              <small>必须以英文字母开头，仅支持英文字母、数字、- 和 _。</small>
            </div>
            <div class="form-row">
              <label>系统名称</label>
              <input v-model.trim="systemName" placeholder="例如 Anderson CRM" autocomplete="organization" />
              <small>创建后会写入新库系统设置的 SysTitle / SysShortTitle。</small>
            </div>
            <p v-if="createError" class="error-box">{{ createError }}</p>
            <button class="primary-action submit" type="submit" :disabled="isCreating || !canCreateFreeTenant">
              {{ isCreating ? '正在创建...' : canCreateFreeTenant ? '创建免费租户' : '付费开通即将上线' }}
            </button>
          </form>

          <div class="content-panel progress-panel">
            <div class="panel-head">
              <div>
                <h2>开通进度</h2>
                <p>{{ tenantProgress || tenantStepSummary }}</p>
              </div>
            </div>
            <div class="step-list">
              <div v-for="(step, index) in tenantSteps" :key="step.Key" class="step-item" :class="step.Status">
                <span>{{ index + 1 }}</span>
                <div>
                  <strong>{{ step.Title }}</strong>
                  <small>{{ step.Detail }}</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section v-if="activeMenu === 'billing'" class="content-panel">
          <h2>费用说明</h2>
          <div class="price-card">
            <span>免费额度</span>
            <strong>1 个租户</strong>
            <p>适合试用、学习和小型系统搭建。</p>
          </div>
          <div class="price-card">
            <span>更多租户</span>
            <strong>¥{{ tenantCenter.NextTenantPrice || 9.9 }} / 年 / 个</strong>
            <p>第二个租户开始计费，付费开通功能后续上线。</p>
          </div>
        </section>

        <section v-if="activeMenu === 'account'" class="content-panel">
          <h2>账号信息</h2>
          <div class="account-grid">
            <label>账号</label>
            <span>{{ currentUser.Account || '-' }}</span>
            <label>姓名</label>
            <span>{{ currentUser.Name || currentUser.NickName || '-' }}</span>
            <label>手机号</label>
            <span>{{ currentUser.Phone || '-' }}</span>
          </div>
          <button class="ghost-action danger" type="button" @click="logout">退出登录</button>
        </section>

        <p v-if="profileError" class="page-error">{{ profileError }}</p>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, defineComponent, h, onMounted, onUnmounted, ref } from 'vue'

const API_BASE = import.meta.env.VITE_MICROI_API_BASE || getDefaultApiBase()
const OS_CLIENT = 'iTdos'

const activeMenu = ref('overview')
const authToken = ref('')
const currentUser = ref(null)
const tenantCenter = ref({})
const tenants = ref([])
const isLoading = ref(false)
const isCreating = ref(false)
const tenantKey = ref('')
const systemName = ref('')
const tenantProgress = ref('')
const createError = ref('')
const profileError = ref('')
const tenantSteps = ref([])

let tenantProgressTimer = null
let tenantProgressIndex = 0

const menus = [
  { key: 'overview', name: '概览', icon: '⌂' },
  { key: 'tenants', name: '我的租户', icon: '▦' },
  { key: 'create', name: '创建租户', icon: '+' },
  { key: 'billing', name: '费用说明', icon: '¥' },
  { key: 'account', name: '账号信息', icon: '◉' }
]

const defaultTenantSteps = [
  { Key: 'validate', Title: '校验账号与租户Key', Detail: '检查登录态、租户Key格式和系统名称。', Status: 'pending' },
  { Key: 'quota', Title: '检查免费开通额度', Detail: '每个账号可免费创建一个租户，第二个起按 9.9 元/年。', Status: 'pending' },
  { Key: 'columns', Title: '检查主库字段', Detail: '补齐官网开通所需的租户归属字段。', Status: 'pending' },
  { Key: 'database-info', Title: '生成数据库信息', Detail: '生成数据库名、连接串和访问域名。', Status: 'pending' },
  { Key: 'create-database', Title: '创建租户数据库', Detail: '在当前数据库服务中创建独立租户库。', Status: 'pending' },
  { Key: 'import-template', Title: '下载并导入空库模板', Detail: '每次都从 CDN 获取最新 microi_empty_temp.sql.zip。', Status: 'pending' },
  { Key: 'create-osclient', Title: '写入SaaS引擎配置', Detail: '复制主租户公共配置并写入租户域名、连接串和JWT密钥。', Status: 'pending' },
  { Key: 'owner', Title: '绑定账号与租户', Detail: '记录租户归属，后续个人中心按账号展示。', Status: 'pending' },
  { Key: 'admin', Title: '关联默认管理员', Detail: '复用空库模板中的默认 admin 账号，不额外插入管理员数据。', Status: 'pending' },
  { Key: 'sys-config', Title: '初始化系统设置', Detail: '复制主库系统设置并归一化为一条启用配置。', Status: 'pending' },
  { Key: 'reload', Title: '刷新SaaS引擎缓存', Detail: '让新租户无需重启即可访问。', Status: 'pending' }
]

const isAuthed = computed(() => !!authToken.value && !!currentUser.value)
const canCreateFreeTenant = computed(() => tenants.value.length < (tenantCenter.value.FreeQuota || 1))
const primaryTenantUrl = computed(() => tenants.value[0]?.Url || '')
const pageTitle = computed(() => {
  const map = {
    overview: '账号概览',
    tenants: '我的租户',
    create: '创建租户',
    billing: '费用说明',
    account: '账号信息'
  }
  return map[activeMenu.value] || '个人中心'
})
const pageDesc = computed(() => {
  if (!isAuthed.value) return '登录后管理你的 Microi SaaS 工作空间。'
  if (activeMenu.value === 'create') return '第一个租户免费，第二个开始每个 9.9 元/年。'
  return `${currentUser.value?.Name || currentUser.value?.Account || '用户'} 的 SaaS 工作空间管理。`
})
const tenantStepSummary = computed(() => {
  const errorStep = tenantSteps.value.find(step => step.Status === 'error')
  if (errorStep) return `${errorStep.Title}失败：${errorStep.Detail}`
  const runningStep = tenantSteps.value.find(step => step.Status === 'running')
  if (runningStep) {
    const index = tenantSteps.value.findIndex(step => step.Key === runningStep.Key) + 1
    return `正在执行第 ${index}/${tenantSteps.value.length} 步：${runningStep.Title}`
  }
  const doneCount = tenantSteps.value.filter(step => step.Status === 'done').length
  if (doneCount === tenantSteps.value.length) return '所有步骤已完成。'
  return `准备创建租户，共 ${tenantSteps.value.length} 步。`
})

const TenantList = defineComponent({
  props: { tenants: { type: Array, default: () => [] } },
  setup(props) {
    return () => h('div', { class: 'tenant-grid' }, props.tenants.map(tenant => h('a', {
      class: 'tenant-card',
      href: tenant.Url,
      target: '_blank',
      rel: 'noopener noreferrer'
    }, [
      h('span', { class: 'tenant-status' }, tenant.IsEnable == 1 ? '启用' : '停用'),
      h('strong', tenant.ClientName || tenant.OsClient),
      h('small', `${tenant.OsClient || ''} · ${tenant.DomainName || ''}`),
      h('em', tenant.Url || '')
    ])))
  }
})

const EmptyTenants = defineComponent({
  emits: ['create'],
  setup(_, { emit }) {
    return () => h('div', { class: 'empty-card' }, [
      h('h3', '还没有租户'),
      h('p', '你可以免费创建第一个 SaaS 数据库，创建完成后立即进入后台使用。'),
      h('button', { class: 'primary-action small', type: 'button', onClick: () => emit('create') }, '创建免费租户')
    ])
  }
})

function getDefaultApiBase() {
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
    return 'https://localhost:7266'
  }
  return 'https://api.itdos.com'
}

function normalizeToken(raw) {
  return (raw || '').replace(/^Bearer\s+/i, '').trim()
}

function apiEngineUrl(key) {
  return `${API_BASE}/apiengine/${key}?OsClient=${OS_CLIENT}`
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}`, Token: authToken.value } : {}
}

function createTenantSteps() {
  return defaultTenantSteps.map(step => ({ ...step }))
}

tenantSteps.value = createTenantSteps()

function restoreSession() {
  authToken.value = normalizeToken(localStorage.getItem('microi_doc_token'))
  const userRaw = localStorage.getItem('microi_doc_user')
  try {
    currentUser.value = userRaw ? JSON.parse(userRaw) : null
  } catch {
    currentUser.value = null
  }
}

async function refreshCenter() {
  if (!isAuthed.value) return
  isLoading.value = true
  profileError.value = ''
  try {
    const resp = await fetch(apiEngineUrl('official_tenant_center'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ OsClient: OS_CLIENT })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      profileError.value = result.Msg || '租户信息读取失败。'
      if (result.Code === 1001) logout(false)
      return
    }
    tenantCenter.value = result.Data || {}
    tenants.value = Array.isArray(result.Data?.Tenants) ? result.Data.Tenants : []
    if (tenants.value[0]) {
      localStorage.setItem('microi_doc_tenant', tenants.value[0].OsClient || '')
      localStorage.setItem('microi_doc_tenant_url', tenants.value[0].Url || '')
    }
  } catch {
    profileError.value = '网络异常，租户信息读取失败。'
  } finally {
    isLoading.value = false
  }
}

async function createTenant() {
  createError.value = ''
  tenantProgress.value = ''
  if (isCreating.value || !canCreateFreeTenant.value) return
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey.value)) {
    createError.value = '租户 Key 格式不正确。'
    return
  }
  if (!systemName.value) {
    createError.value = '请输入系统名称。'
    return
  }
  isCreating.value = true
  startTenantProgress()
  try {
    const resp = await fetch(apiEngineUrl('official_create_tenant'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ TenantKey: tenantKey.value, SystemName: systemName.value, _Lang: 'zh-CN' })
    })
    const result = await resp.json()
    mergeTenantSteps(result.DataAppend?.Steps || result.Data?.Steps)
    if (result.Code !== 1) {
      createError.value = result.Msg || '租户创建失败。'
      tenantProgress.value = createError.value
      return
    }
    const data = result.Data || {}
    const url = data.Url || (data.DomainName ? `https://${data.DomainName}` : `https://${tenantKey.value}.microi.net`)
    localStorage.setItem('microi_doc_tenant', data.OsClient || tenantKey.value)
    localStorage.setItem('microi_doc_tenant_url', url)
    tenantProgress.value = `租户创建成功，访问地址：${url}`
    tenantKey.value = ''
    systemName.value = ''
    await refreshCenter()
    activeMenu.value = 'tenants'
  } catch {
    markTenantStep('reload', 'error', '网络异常，无法确认租户创建结果，请稍后刷新个人中心查看。')
    createError.value = '网络异常，租户创建失败。'
    tenantProgress.value = createError.value
  } finally {
    stopTenantProgress()
    isCreating.value = false
  }
}

function startTenantProgress() {
  tenantSteps.value = createTenantSteps()
  tenantProgressIndex = 0
  markTenantStep(tenantSteps.value[tenantProgressIndex].Key, 'running')
  if (tenantProgressTimer) clearInterval(tenantProgressTimer)
  tenantProgressTimer = setInterval(() => {
    if (tenantProgressIndex < tenantSteps.value.length - 1) {
      markTenantStep(tenantSteps.value[tenantProgressIndex].Key, 'done')
      tenantProgressIndex += 1
      markTenantStep(tenantSteps.value[tenantProgressIndex].Key, 'running')
    }
  }, 3200)
}

function stopTenantProgress() {
  if (tenantProgressTimer) {
    clearInterval(tenantProgressTimer)
    tenantProgressTimer = null
  }
}

function markTenantStep(key, status, detail) {
  tenantSteps.value = tenantSteps.value.map(step => {
    if (step.Key !== key) return step
    return { ...step, Status: status, Detail: detail || step.Detail }
  })
}

function mergeTenantSteps(serverSteps) {
  if (!Array.isArray(serverSteps) || serverSteps.length === 0) return
  tenantSteps.value = tenantSteps.value.map((localStep, index) => {
    const serverStep = serverSteps.find(item => item.Key === localStep.Key) || serverSteps[index]
    if (!serverStep) return localStep
    return {
      ...localStep,
      Title: serverStep.Title || localStep.Title,
      Detail: serverStep.Detail || localStep.Detail,
      Status: serverStep.Status || localStep.Status
    }
  })
}

function logout(goLogin = true) {
  localStorage.removeItem('microi_doc_user')
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_tenant')
  localStorage.removeItem('microi_doc_tenant_url')
  localStorage.removeItem('microi_doc_phone')
  authToken.value = ''
  currentUser.value = null
  tenants.value = []
  tenantCenter.value = {}
  if (goLogin) window.location.href = '/login.html'
}

function onLoginSuccess() {
  restoreSession()
  refreshCenter()
}

function onTenantUpdated() {
  refreshCenter()
}

function redirectToLoginIfNeeded() {
  if (isAuthed.value) return false
  if (typeof window !== 'undefined') {
    window.location.href = '/login.html?redirect=/profile.html'
  }
  return true
}

onMounted(() => {
  restoreSession()
  if (redirectToLoginIfNeeded()) return
  window.addEventListener('microi-login-success', onLoginSuccess)
  window.addEventListener('microi-tenant-updated', onTenantUpdated)
  refreshCenter()
})

onUnmounted(() => {
  stopTenantProgress()
  window.removeEventListener('microi-login-success', onLoginSuccess)
  window.removeEventListener('microi-tenant-updated', onTenantUpdated)
})
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px 1fr;
  background: #f5f7fb;
  color: #1f2937;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans CJK SC', sans-serif;
}

.profile-sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 22px 18px;
  background: linear-gradient(180deg, #111827 0%, #1f2937 100%);
  color: #fff;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #fff;
  text-decoration: none;
  margin-bottom: 28px;
}

.brand-mark {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  font-weight: 800;
}

.brand strong,
.brand small {
  display: block;
}

.brand small {
  margin-top: 2px;
  color: rgba(255,255,255,0.58);
  font-size: 12px;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.side-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: rgba(255,255,255,0.72);
  cursor: pointer;
  font-size: 14px;
  text-align: left;
}

.side-menu-item.active,
.side-menu-item:hover {
  background: rgba(255,255,255,0.11);
  color: #fff;
}

.menu-icon {
  width: 24px;
  text-align: center;
}

.sidebar-footer {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar-footer a {
  color: rgba(255,255,255,0.68);
  font-size: 13px;
  text-decoration: none;
}

.profile-main {
  padding: 28px;
  min-width: 0;
}

.profile-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #ff5a2e;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0;
}

.profile-header h1 {
  margin: 0;
  font-size: 28px;
}

.header-desc {
  margin: 8px 0 0;
  color: #64748b;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.primary-action,
.ghost-action,
.link-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  border-radius: 10px;
  border: 0;
  cursor: pointer;
  font-weight: 700;
  text-decoration: none;
}

.primary-action {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 10px 24px rgba(255, 90, 46, 0.22);
}

.primary-action:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.primary-action.small,
.ghost-action,
.link-action {
  min-height: 34px;
  font-size: 13px;
}

.ghost-action {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #334155;
}

.ghost-action.danger {
  color: #ef4444;
}

.link-action {
  background: #fff4ed;
  color: #ff5a2e;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 18px;
}

.stat-card,
.content-panel,
.state-panel {
  border: 1px solid #e6edf5;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.045);
}

.stat-card {
  padding: 18px;
}

.stat-card span,
.stat-card small {
  display: block;
  color: #64748b;
}

.stat-card strong {
  display: block;
  margin: 10px 0 6px;
  font-size: 26px;
}

.content-panel,
.state-panel {
  padding: 20px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(360px, 520px) 1fr;
  gap: 18px;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
}

.panel-head h2,
.state-panel h2,
.content-panel h2 {
  margin: 0 0 6px;
  font-size: 18px;
}

.panel-head p,
.state-panel p {
  margin: 0;
  color: #64748b;
  line-height: 1.6;
}

.tenant-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.tenant-card {
  position: relative;
  display: flex;
  min-height: 126px;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  background: linear-gradient(180deg, #fff, #f8fafc);
  color: inherit;
  text-decoration: none;
}

.tenant-card strong {
  max-width: 220px;
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-card small,
.tenant-card em {
  color: #64748b;
  font-size: 12px;
  font-style: normal;
  word-break: break-all;
}

.tenant-status {
  position: absolute;
  top: 14px;
  right: 14px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  font-size: 12px;
}

.empty-card,
.loading-row {
  padding: 28px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
  text-align: center;
}

.empty-card h3 {
  margin: 0 0 8px;
}

.empty-card p {
  margin: 0 0 14px;
  color: #64748b;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-row label {
  font-weight: 800;
}

.form-row input {
  height: 42px;
  padding: 0 12px;
  border: 1px solid #d9e1ec;
  border-radius: 10px;
  outline: none;
}

.form-row input:focus {
  border-color: #ff7a45;
  box-shadow: 0 0 0 3px rgba(255, 122, 69, 0.12);
}

.form-row small {
  color: #64748b;
}

.primary-action.submit {
  width: 100%;
}

.error-box,
.page-error {
  padding: 12px;
  border-radius: 10px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
}

.step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 520px;
  overflow: auto;
}

.step-item {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: 10px;
  padding: 11px;
  border: 1px solid #edf2f7;
  border-radius: 10px;
  background: #f8fafc;
}

.step-item span {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #e2e8f0;
  color: #475569;
  font-size: 12px;
  font-weight: 800;
}

.step-item strong,
.step-item small {
  display: block;
}

.step-item small {
  margin-top: 3px;
  color: #64748b;
  line-height: 1.45;
}

.step-item.running {
  border-color: rgba(255, 122, 69, 0.4);
  background: #fff7ed;
}

.step-item.running span {
  background: #ffedd5;
  color: #ea580c;
}

.step-item.done {
  border-color: rgba(34, 197, 94, 0.36);
  background: #f0fdf4;
}

.step-item.done span {
  background: #dcfce7;
  color: #15803d;
}

.step-item.error {
  border-color: rgba(239, 68, 68, 0.38);
  background: #fef2f2;
}

.step-item.error span {
  background: #fee2e2;
  color: #dc2626;
}

.step-item.skipped {
  opacity: 0.56;
}

.price-card {
  padding: 16px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  margin-top: 12px;
}

.price-card span,
.price-card p {
  color: #64748b;
}

.price-card strong {
  display: block;
  margin: 6px 0;
  font-size: 22px;
}

.account-grid {
  display: grid;
  grid-template-columns: 90px 1fr;
  gap: 12px;
  margin: 16px 0 20px;
}

.account-grid label {
  color: #64748b;
}

.dark .profile-page {
  background: #0b1120;
  color: #e5e7eb;
}

.dark .profile-sidebar {
  background: linear-gradient(180deg, #030712 0%, #111827 100%);
  border-right: 1px solid rgba(148, 163, 184, 0.16);
}

.dark .profile-main {
  background: #0b1120;
}

.dark .profile-header h1,
.dark .panel-head h2,
.dark .state-panel h2,
.dark .content-panel h2,
.dark .stat-card strong,
.dark .tenant-card strong,
.dark .price-card strong,
.dark .account-grid span,
.dark .form-row label,
.dark .step-item strong {
  color: #f8fafc;
}

.dark .header-desc,
.dark .panel-head p,
.dark .state-panel p,
.dark .stat-card span,
.dark .stat-card small,
.dark .tenant-card small,
.dark .tenant-card em,
.dark .empty-card p,
.dark .form-row small,
.dark .account-grid label,
.dark .step-item small,
.dark .price-card span,
.dark .price-card p,
.dark .loading-row {
  color: #94a3b8;
}

.dark .stat-card,
.dark .content-panel,
.dark .state-panel,
.dark .tenant-card,
.dark .empty-card,
.dark .loading-row,
.dark .price-card {
  background: #111827;
  border-color: rgba(148, 163, 184, 0.18);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
}

.dark .tenant-card {
  background: linear-gradient(180deg, #111827, #0f172a);
}

.dark .ghost-action {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #e2e8f0;
}

.dark .link-action {
  background: rgba(255, 90, 46, 0.12);
  color: #fb923c;
}

.dark .form-row input {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #f8fafc;
}

.dark .step-item {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.14);
}

.dark .step-item span {
  background: #1f2937;
  color: #cbd5e1;
}

.dark .step-item.running {
  background: rgba(251, 146, 60, 0.12);
  border-color: rgba(251, 146, 60, 0.38);
}

.dark .step-item.done {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.34);
}

.dark .step-item.error,
.dark .error-box,
.dark .page-error {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.34);
}

@media (max-width: 960px) {
  .profile-page {
    grid-template-columns: 1fr;
  }

  .profile-sidebar {
    position: relative;
    height: auto;
  }

  .side-menu {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
  }

  .overview-grid,
  .content-grid {
    grid-template-columns: 1fr;
  }

  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
