<template>
  <div class="profile-page">
    <aside class="profile-sidebar">
      <a class="brand" href="/profile.html">
        <img v-if="profileAvatarUrl" class="brand-avatar-img" :src="profileAvatarUrl" :alt="profileName" />
        <span v-else class="brand-mark">{{ profileInitial }}</span>
        <span>
          <strong>{{ profileName }}</strong>
          <small>{{ licenseShortText }}</small>
        </span>
      </a>
      <nav class="side-menu">
        <button
          v-for="item in menus"
          :key="item.key"
          type="button"
          class="side-menu-item"
          :class="{ active: activeMenu === item.key }"
          @click="navigateProfile(item.key)"
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
        <section v-if="activeMenu === 'overview'" class="profile-hero">
          <div>
            <p class="eyebrow">Microi Account</p>
            <h2>个人中心</h2>
            <p>{{ profileName }} 的 SaaS 工作空间、授权状态和租户入口都在这里。</p>
          </div>
          <article class="license-card">
            <span>当前授权</span>
            <strong>{{ licenseDisplayTitle }}</strong>
            <small>{{ licenseDisplayDesc }}</small>
          </article>
        </section>

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
          <article class="stat-card token-stat-card">
            <span>AI 中转站 Token</span>
            <strong>{{ formatTokenNumber(relayToken.RemainingTokens) }}</strong>
            <small>已用 {{ formatTokenNumber(relayToken.UsedTokens) }} / 赠送 {{ formatTokenNumber(relayToken.GiftTokens) }}</small>
          </article>
        </section>

        <section v-if="activeMenu === 'overview'" class="content-panel tenant-overview-panel">
          <div class="panel-head">
            <div>
              <h2>SaaS 租户</h2>
              <p>每个租户都是独立低代码数据库与访问入口。默认管理员为 admin，默认密码为租户 Key，请首次登录后及时修改。</p>
            </div>
            <button class="primary-action small" type="button" @click="navigateProfile('create')">创建租户</button>
          </div>
          <div v-if="isLoading" class="loading-row">正在读取租户信息...</div>
          <TenantList v-else :tenants="tenants" />
          <EmptyTenants v-if="!isLoading && tenants.length === 0" @create="navigateProfile('create')" />
          <div class="billing-strip">
            <div>
              <span>免费额度</span>
              <strong>1 个租户</strong>
              <small>适合试用、学习和小型系统搭建。</small>
            </div>
            <div>
              <span>扩容价格</span>
              <strong>¥{{ tenantCenter.NextTenantPrice || 9.9 }} / 年 / 个</strong>
              <small>第二个租户开始计费，付费开通功能后续上线。</small>
            </div>
          </div>
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
                  <em class="step-elapsed">{{ stepElapsedText(step) }}</em>
                  <small>{{ step.Detail }}</small>
                </div>
              </div>
            </div>
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
const tenantProgressTick = ref(Date.now())
const relayToken = ref({
  GiftTokens: 100000,
  UsedTokens: 0,
  RemainingTokens: 100000
})

let tenantProgressTimer = null
let tenantProgressTraceId = ''
let tenantProgressRestorePending = false

const menus = [
  { key: 'overview', name: '个人中心', icon: '⌂' },
  { key: 'create', name: '创建租户', icon: '+' },
  { key: 'account', name: '账号信息', icon: '◉' }
]

const menuKeys = menus.map(item => item.key)
const routeAliases = { tenants: 'overview', billing: 'overview' }

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
const profileName = computed(() => currentUser.value?.Name || currentUser.value?.NickName || currentUser.value?.Account || 'Microi吾码')
const profileInitial = computed(() => String(profileName.value || 'M').trim().slice(0, 1).toUpperCase())
const profileAvatarUrl = computed(() => normalizeAvatarUrl(currentUser.value?.Avatar || currentUser.value?.HeadImgUrl || currentUser.value?.HeadImg || currentUser.value?.AvatarUrl))
const licenseInfo = computed(() => {
  const raw = String(currentUser.value?.LicenseType || tenantCenter.value?.LicenseType || tenantCenter.value?.SysConfig?.LicenseType || '').trim().toLowerCase()
  if (raw === 'personal') {
    return {
      short: '个人版',
      title: 'Personal（个人版）',
      desc: '授权永久有效，售后服务支持有效期 1 年，续费 499/年。'
    }
  }
  if (raw === 'enterprise') {
    return {
      short: '企业版',
      title: 'Enterprise（企业版）',
      desc: '授权永久有效，售后服务支持有效期 1 年，续费 2.5w/年。'
    }
  }
  return {
    short: '开源版',
    title: '开源版',
    desc: '当前账号使用开源版能力，可按需升级到个人版或企业版。'
  }
})
const licenseShortText = computed(() => licenseInfo.value.short)
const licenseDisplayTitle = computed(() => licenseInfo.value.title)
const licenseDisplayDesc = computed(() => licenseInfo.value.desc)
const pageTitle = computed(() => {
  const map = {
    overview: '个人中心',
    create: '创建租户',
    account: '账号信息'
  }
  return map[activeMenu.value] || '个人中心'
})
const pageDesc = computed(() => {
  if (!isAuthed.value) return '登录后管理你的 Microi SaaS 工作空间。'
  if (activeMenu.value === 'create') return '第一个租户免费，第二个开始每个 9.9 元/年。'
  return `${profileName.value} 的 SaaS 工作空间管理。`
})
const tenantStepSummary = computed(() => {
  const errorStep = tenantSteps.value.find(step => step.Status === 'error')
  if (errorStep) return `${errorStep.Title}失败：${errorStep.Detail}`
  const runningStep = tenantSteps.value.find(step => step.Status === 'running')
  if (runningStep) {
    const index = tenantSteps.value.findIndex(step => step.Key === runningStep.Key) + 1
    return `正在执行第 ${index}/${tenantSteps.value.length} 步：${runningStep.Title}，已耗时 ${formatStepElapsed(runningStep)} 秒`
  }
  const doneCount = tenantSteps.value.filter(step => step.Status === 'done').length
  if (doneCount === tenantSteps.value.length) return '所有步骤已完成。'
  return `准备创建租户，共 ${tenantSteps.value.length} 步。`
})

const TenantList = defineComponent({
  props: { tenants: { type: Array, default: () => [] } },
  setup(props) {
    return () => h('div', { class: 'tenant-grid' }, props.tenants.map(tenant => h('article', {
      class: 'tenant-card'
    }, [
      h('div', { class: 'tenant-card-top' }, [
        h('div', { class: 'tenant-title-block' }, [
          h('strong', tenant.ClientName || tenant.OsClient || '未命名租户'),
          h('small', tenant.OsClient || '-')
        ]),
        h('span', { class: ['tenant-status', tenant.IsEnable == 1 ? 'enabled' : 'disabled'] }, tenant.IsEnable == 1 ? '启用中' : '已停用')
      ]),
      h('div', { class: 'tenant-domain' }, [
        h('span', '访问入口'),
        h('a', { href: tenant.Url, target: '_blank', rel: 'noopener noreferrer' }, tenant.DomainName || tenant.Url || '-')
      ]),
      h('div', { class: 'tenant-password-tip' }, [
        h('span', '默认管理员'),
        h('b', `admin / ${tenant.AdminDefaultPassword || tenant.OsClient || '-'}`),
        h('small', '请首次登录后及时修改密码')
      ]),
      h('div', { class: 'tenant-card-actions' }, [
        h('a', {
          class: 'tenant-open',
          href: tenant.Url,
          target: '_blank',
          rel: 'noopener noreferrer'
        }, '进入后台'),
        h('button', {
          class: 'tenant-copy',
          type: 'button',
          onClick: () => copyTenantUrl(tenant.Url)
        }, '复制链接')
      ])
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

function copyTenantUrl(url) {
  if (!url || typeof navigator === 'undefined' || !navigator.clipboard) return
  navigator.clipboard.writeText(url)
}

function normalizeProfileRoute(raw) {
  const key = String(raw || '').replace(/^#\/?/, '').split('?')[0] || 'overview'
  return routeAliases[key] || (menuKeys.includes(key) ? key : 'overview')
}

function normalizeAvatarUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^(https?:|data:|blob:)/i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return `${API_BASE}/${url.replace(/^\.?\//, '')}`
}

function syncMenuFromHash() {
  if (typeof window === 'undefined') return
  const nextKey = normalizeProfileRoute(window.location.hash)
  activeMenu.value = nextKey
  if (nextKey === 'create') {
    restoreActiveTenantProgress()
  } else if (tenantProgressTimer) {
    stopTenantProgress()
    isCreating.value = false
  }
}

function navigateProfile(key) {
  const nextKey = normalizeProfileRoute(key)
  activeMenu.value = nextKey
  if (typeof window !== 'undefined') {
    const nextHash = `#/${nextKey}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
  }
  if (nextKey === 'create') {
    restoreActiveTenantProgress()
  } else if (tenantProgressTimer) {
    stopTenantProgress()
    isCreating.value = false
  }
}

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

function formatTokenNumber(value) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num.toLocaleString('zh-CN') : '0'
}

function createTenantSteps() {
  return defaultTenantSteps.map(step => ({ ...step }))
}

tenantSteps.value = createTenantSteps()

function createTraceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '')
  }
  return `${Date.now()}${Math.floor(Math.random() * 100000)}`
}

function parseStepTimeMs(step, msField, timeField) {
  const ms = Number(step?.[msField] || 0)
  if (ms > 0) return ms
  const raw = step?.[timeField]
  if (!raw) return 0
  const parsed = Date.parse(String(raw).replace(/-/g, '/'))
  return Number.isNaN(parsed) ? 0 : parsed
}

function getStepElapsedMs(step) {
  const tick = tenantProgressTick.value
  if (!step) return 0
  const startMs = step.StartAt || parseStepTimeMs(step, 'StartMs', 'StartTime')
  if (step.Status === 'running' && startMs) {
    return Math.max(0, tick - startMs)
  }
  const endMs = step.EndAt || parseStepTimeMs(step, 'EndMs', 'EndTime')
  if (startMs && endMs) return Math.max(0, endMs - startMs)
  return Math.max(0, Number(step.ElapsedMs || 0))
}

function formatStepElapsed(step) {
  return (Math.round(getStepElapsedMs(step) / 100) / 10).toFixed(1)
}

function stepElapsedText(step) {
  if (!step || step.Status === 'pending') return '等待中'
  if (step.Status === 'skipped') return '未执行'
  return `耗时 ${formatStepElapsed(step)} 秒`
}

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
    await refreshRelayTokenSummary()
  } catch {
    profileError.value = '网络异常，租户信息读取失败。'
  } finally {
    isLoading.value = false
  }
}

async function refreshRelayTokenSummary() {
  if (!isAuthed.value) return
  try {
    const resp = await fetch(`${API_BASE}/api/Ai/RelayTokenSummary?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ OsClient: OS_CLIENT })
    })
    const result = await resp.json()
    if (result.Code === 1 && result.Data) {
      relayToken.value = {
        GiftTokens: Number(result.Data.GiftTokens || 100000),
        UsedTokens: Number(result.Data.UsedTokens || 0),
        RemainingTokens: Number(result.Data.RemainingTokens || 0)
      }
    }
  } catch {
    // Token 统计不阻塞个人中心主流程。
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
  const traceId = createTraceId()
  let keepPollingAfterRequestError = false
  startTenantProgress(traceId)
  try {
    const resp = await fetch(apiEngineUrl('official_create_tenant'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ TenantKey: tenantKey.value, SystemName: systemName.value, TraceId: traceId, _Lang: 'zh-CN' })
    })
    const result = await resp.json()
    mergeTenantSteps(result.DataAppend?.Steps || result.Data?.Steps)
    if (result.Code !== 1) {
      createError.value = result.Msg || '租户创建失败。'
      tenantProgress.value = createError.value
      return
    }
    const data = result.Data || {}
    const returnedTraceId = data.TraceId || data.TaskId || result.DataAppend?.TraceId || result.DataAppend?.TaskId || traceId
    if (returnedTraceId && returnedTraceId !== tenantProgressTraceId) {
      startTenantProgress(returnedTraceId)
    }
    if (data.Status === 'running' || data.TaskId || data.TraceId) {
      tenantProgress.value = result.Msg || '租户创建任务已提交，正在后台处理。'
      keepPollingAfterRequestError = true
      return
    }
    const url = data.Url || (data.DomainName ? `https://${data.DomainName}` : `https://${tenantKey.value}.microi.net`)
    localStorage.setItem('microi_doc_tenant', data.OsClient || tenantKey.value)
    localStorage.setItem('microi_doc_tenant_url', url)
    tenantProgress.value = `租户创建成功，访问地址：${url}`
    tenantKey.value = ''
    systemName.value = ''
    await refreshCenter()
    navigateProfile('overview')
  } catch {
    keepPollingAfterRequestError = true
    createError.value = ''
    tenantProgress.value = '请求连接已中断，后台可能仍在创建租户；页面会继续读取实时进度。'
  } finally {
    if (!keepPollingAfterRequestError) {
      stopTenantProgress()
      isCreating.value = false
    }
  }
}

function startTenantProgress(traceId, options = {}) {
  const shouldReset = options.reset !== false
  if (shouldReset) tenantSteps.value = createTenantSteps()
  tenantProgressTraceId = traceId
  tenantProgressTick.value = Date.now()
  if (shouldReset && tenantSteps.value[0]) markTenantStep(tenantSteps.value[0].Key, 'running')
  if (tenantProgressTimer) clearInterval(tenantProgressTimer)
  tenantProgressTimer = setInterval(() => {
    tenantProgressTick.value = Date.now()
    pollTenantProgress(traceId)
  }, 1000)
  pollTenantProgress(traceId)
}

function stopTenantProgress() {
  if (tenantProgressTimer) {
    clearInterval(tenantProgressTimer)
    tenantProgressTimer = null
  }
  tenantProgressTraceId = ''
}

function isActiveTenantProgressStatus(status) {
  const normalized = String(status || '').toLowerCase()
  return normalized === 'running' || normalized === 'queued' || normalized === 'pending'
}

async function restoreActiveTenantProgress() {
  if (!isAuthed.value || activeMenu.value !== 'create' || tenantProgressTimer || tenantProgressRestorePending) return
  tenantProgressRestorePending = true
  try {
    const resp = await fetch(apiEngineUrl('official_create_tenant_progress'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ ActiveOnly: 1, _Lang: 'zh-CN' })
    })
    const result = await resp.json()
    const data = result.Data || {}
    const activeTask = data.ActiveTask || data.Task || {}
    const traceId = data.TraceId || data.TaskId || activeTask.TraceId || activeTask.TaskId
    if (result.Code !== 1 || !traceId || !isActiveTenantProgressStatus(data.Status || activeTask.Status)) return

    if (!tenantKey.value && activeTask.OsClient) tenantKey.value = activeTask.OsClient
    if (!systemName.value && activeTask.SystemName) systemName.value = activeTask.SystemName
    createError.value = ''
    isCreating.value = true
    tenantProgress.value = data.Msg || '检测到租户创建任务正在后台执行，已恢复实时进度。'
    mergeTenantSteps(data.Steps)
    startTenantProgress(traceId, { reset: false })
  } catch {
  } finally {
    tenantProgressRestorePending = false
  }
}

function markTenantStep(key, status, detail) {
  tenantSteps.value = tenantSteps.value.map(step => {
    if (step.Key !== key) return step
    const now = Date.now()
    const next = { ...step, Status: status, Detail: detail || step.Detail }
    if (status === 'running' && !next.StartAt) next.StartAt = now
    if ((status === 'done' || status === 'error' || status === 'skipped') && !next.EndAt) {
      next.EndAt = now
      if (next.StartAt) next.ElapsedMs = now - next.StartAt
    }
    return next
  })
}

async function pollTenantProgress(traceId) {
  if (!traceId || traceId !== tenantProgressTraceId) return
  try {
    const resp = await fetch(apiEngineUrl('official_create_tenant_progress'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ TraceId: traceId, _Lang: 'zh-CN' })
    })
    const result = await resp.json()
    const data = result.Data || {}
    mergeTenantSteps(data.Steps)
    if (data.Status === 'success') {
      const payload = data.Data || {}
      const url = payload.Url || (payload.DomainName ? `https://${payload.DomainName}` : `https://${payload.OsClient || tenantKey.value}.microi.net`)
      localStorage.setItem('microi_doc_tenant', payload.OsClient || tenantKey.value)
      localStorage.setItem('microi_doc_tenant_url', url)
      tenantProgress.value = `租户创建成功，访问地址：${url}`
      tenantKey.value = ''
      systemName.value = ''
      await refreshCenter()
      navigateProfile('overview')
      stopTenantProgress()
      isCreating.value = false
      return
    }
    if (data.Status === 'error' && data.Msg) {
      tenantProgress.value = data.Msg
      createError.value = data.Msg
      stopTenantProgress()
      isCreating.value = false
    }
  } catch {
  }
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
      Status: serverStep.Status || localStep.Status,
      StartTime: serverStep.StartTime || localStep.StartTime,
      EndTime: serverStep.EndTime || localStep.EndTime,
      StartMs: serverStep.StartMs || localStep.StartMs || 0,
      EndMs: serverStep.EndMs || localStep.EndMs || 0,
      StartAt: localStep.StartAt || serverStep.StartMs || 0,
      EndAt: localStep.EndAt || serverStep.EndMs || 0,
      ElapsedMs: serverStep.ElapsedMs || localStep.ElapsedMs || 0,
      ElapsedSeconds: serverStep.ElapsedSeconds || localStep.ElapsedSeconds || 0
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
  if (goLogin) window.location.href = '/'
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
    window.location.href = '/login.html?redirect=/profile.html%23/overview'
  }
  return true
}

onMounted(() => {
  restoreSession()
  syncMenuFromHash()
  if (redirectToLoginIfNeeded()) return
  window.addEventListener('microi-login-success', onLoginSuccess)
  window.addEventListener('microi-tenant-updated', onTenantUpdated)
  window.addEventListener('hashchange', syncMenuFromHash)
  window.addEventListener('popstate', syncMenuFromHash)
  refreshCenter()
  if (activeMenu.value === 'create') restoreActiveTenantProgress()
})

onUnmounted(() => {
  stopTenantProgress()
  window.removeEventListener('microi-login-success', onLoginSuccess)
  window.removeEventListener('microi-tenant-updated', onTenantUpdated)
  window.removeEventListener('hashchange', syncMenuFromHash)
  window.removeEventListener('popstate', syncMenuFromHash)
})
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 248px 1fr;
  background:
    radial-gradient(circle at 78% 8%, rgba(255, 90, 46, 0.08), transparent 30%),
    linear-gradient(180deg, #f7f9fc 0%, #eef3f8 100%);
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

.brand-avatar-img {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  object-fit: cover;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
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

.profile-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 18px;
  align-items: stretch;
  margin-bottom: 18px;
}

.profile-hero > div,
.license-card {
  border: 1px solid #e6edf5;
  border-radius: 18px;
  background:
    radial-gradient(circle at 86% 10%, rgba(255, 90, 46, 0.11), transparent 32%),
    linear-gradient(135deg, #fff, #f8fbff);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.06);
}

.profile-hero > div {
  padding: 24px;
}

.profile-hero h2 {
  margin: 0;
  font-size: 34px;
  line-height: 1.18;
}

.profile-hero p:not(.eyebrow) {
  margin: 10px 0 0;
  color: #64748b;
  line-height: 1.7;
}

.license-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 22px;
}

.license-card span {
  color: #64748b;
}

.license-card strong {
  margin: 10px 0 8px;
  color: #111827;
  font-size: 24px;
}

.license-card small {
  color: #64748b;
  line-height: 1.7;
}

.overview-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

.token-stat-card {
  background:
    radial-gradient(circle at 86% 12%, rgba(255, 90, 46, 0.16), transparent 36%),
    linear-gradient(135deg, #fff, #f7fbff);
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
  padding: 22px;
}

.content-grid {
  display: grid;
  grid-template-columns: minmax(360px, 520px) 1fr;
  gap: 18px;
  align-items: stretch;
  min-height: calc(100vh - 190px);
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

.tenant-overview-panel {
  overflow: hidden;
}

.tenant-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tenant-card {
  position: relative;
  display: flex;
  min-height: 220px;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at top right, rgba(255, 122, 69, 0.1), transparent 34%);
  color: inherit;
  text-decoration: none;
  min-width: 0;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
  overflow: hidden;
}

.tenant-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #ff4d2d, #ff9f43, #38bdf8);
}

.tenant-card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 122, 69, 0.42);
  box-shadow: 0 24px 54px rgba(15, 23, 42, 0.1);
}

.tenant-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.tenant-title-block {
  min-width: 0;
}

.tenant-title-block strong {
  display: block;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-title-block small {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
}

.tenant-domain {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border: 1px solid #e8eef6;
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.78);
}

.tenant-domain span,
.tenant-password-tip span,
.tenant-password-tip small {
  color: #64748b;
}

.tenant-domain a {
  min-width: 0;
  overflow: hidden;
  color: #2563eb;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.tenant-password-tip {
  display: grid;
  grid-template-columns: 68px minmax(0, 1fr);
  gap: 6px 10px;
  padding: 12px;
  border: 1px solid rgba(251, 146, 60, 0.22);
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(255, 237, 213, 0.55));
  font-size: 12px;
}

.tenant-password-tip b {
  color: #c2410c;
}

.tenant-password-tip small {
  grid-column: 2;
  line-height: 1.5;
}

.tenant-card-actions {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
  margin-top: auto;
}

.tenant-open,
.tenant-copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.tenant-open {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 12px 24px rgba(255, 90, 46, 0.18);
}

.tenant-copy {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.tenant-status {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.tenant-status.enabled {
  background: #dcfce7;
  color: #15803d;
}

.tenant-status.disabled {
  background: #fee2e2;
  color: #b91c1c;
}

.profile-page :deep(.tenant-grid) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.profile-page :deep(.tenant-card) {
  position: relative;
  display: flex;
  min-height: 220px;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.9);
  border-radius: 16px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.94), rgba(248, 250, 252, 0.96)),
    radial-gradient(circle at top right, rgba(255, 122, 69, 0.1), transparent 34%);
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
}

.profile-page :deep(.tenant-card)::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #ff4d2d, #ff9f43, #38bdf8);
}

.profile-page :deep(.tenant-card-top),
.profile-page :deep(.tenant-card-actions),
.profile-page :deep(.tenant-domain),
.profile-page :deep(.tenant-password-tip) {
  min-width: 0;
}

.profile-page :deep(.tenant-card-top) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.profile-page :deep(.tenant-title-block) {
  min-width: 0;
}

.profile-page :deep(.tenant-title-block strong) {
  display: block;
  overflow: hidden;
  font-size: 16px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.profile-page :deep(.tenant-title-block small) {
  display: block;
  margin-top: 4px;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
}

.profile-page :deep(.tenant-domain),
.profile-page :deep(.tenant-password-tip) {
  padding: 12px;
  border-radius: 12px;
}

.profile-page :deep(.tenant-domain) {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid #e8eef6;
  background: rgba(248, 250, 252, 0.78);
}

.profile-page :deep(.tenant-domain a) {
  min-width: 0;
  overflow: hidden;
  color: #2563eb;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-decoration: none;
}

.profile-page :deep(.tenant-password-tip) {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 6px 10px;
  border: 1px solid rgba(251, 146, 60, 0.22);
  background: linear-gradient(135deg, rgba(255, 247, 237, 0.95), rgba(255, 237, 213, 0.55));
  font-size: 12px;
}

.profile-page :deep(.tenant-password-tip b) {
  color: #c2410c;
}

.profile-page :deep(.tenant-password-tip small) {
  grid-column: 2;
  color: #64748b;
  line-height: 1.5;
}

.profile-page :deep(.tenant-card-actions) {
  display: grid;
  grid-template-columns: 1fr 104px;
  gap: 10px;
  margin-top: auto;
}

.profile-page :deep(.tenant-open),
.profile-page :deep(.tenant-copy) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.profile-page :deep(.tenant-open) {
  background: linear-gradient(135deg, #ff4d2d, #ff8a3d);
  color: #fff;
  box-shadow: 0 12px 24px rgba(255, 90, 46, 0.18);
}

.profile-page :deep(.tenant-copy) {
  border: 1px solid #d9e1ec;
  background: #fff;
  color: #475569;
  cursor: pointer;
}

.profile-page :deep(.tenant-status) {
  flex-shrink: 0;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}

.profile-page :deep(.tenant-status.enabled) {
  background: #dcfce7;
  color: #15803d;
}

.profile-page :deep(.tenant-status.disabled) {
  background: #fee2e2;
  color: #b91c1c;
}

.billing-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-top: 18px;
}

.billing-strip > div {
  padding: 16px;
  border: 1px solid #e8eef6;
  border-radius: 14px;
  background: linear-gradient(135deg, #f8fafc, #fff);
}

.billing-strip span,
.billing-strip small {
  display: block;
  color: #64748b;
}

.billing-strip strong {
  display: block;
  margin: 6px 0;
  color: #111827;
  font-size: 20px;
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
  flex: 1;
  min-height: 0;
  overflow: visible;
}

.progress-panel {
  display: flex;
  flex-direction: column;
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
.step-item em,
.step-item small {
  display: block;
}

.step-item em {
  margin-top: 3px;
  color: #f97316;
  font-size: 12px;
  font-style: normal;
  font-weight: 700;
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
.dark .profile-hero h2,
.dark .license-card strong,
.dark .billing-strip strong,
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
.dark .profile-hero p:not(.eyebrow),
.dark .license-card span,
.dark .license-card small,
.dark .billing-strip span,
.dark .billing-strip small,
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
.dark .profile-hero > div,
.dark .license-card,
.dark .billing-strip > div,
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
  background:
    linear-gradient(180deg, #111827, #0f172a),
    radial-gradient(circle at top right, rgba(251, 146, 60, 0.14), transparent 34%);
}

.dark .profile-page :deep(.tenant-card) {
  border-color: rgba(148, 163, 184, 0.18);
  background:
    linear-gradient(180deg, #111827, #0f172a),
    radial-gradient(circle at top right, rgba(251, 146, 60, 0.14), transparent 34%);
}

.dark .profile-page :deep(.tenant-domain) {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.16);
}

.dark .profile-page :deep(.tenant-password-tip) {
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.22);
}

.dark .profile-page :deep(.tenant-copy) {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #cbd5e1;
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

.dark .tenant-domain {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.16);
}

.dark .tenant-password-tip {
  background: rgba(251, 146, 60, 0.1);
  border-color: rgba(251, 146, 60, 0.22);
}

.dark .tenant-copy {
  background: #0f172a;
  border-color: rgba(148, 163, 184, 0.22);
  color: #cbd5e1;
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

.dark .step-item em {
  color: #fdba74;
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
  .profile-hero,
  .content-grid,
  .billing-strip,
  .profile-page :deep(.tenant-grid) {
    grid-template-columns: 1fr;
  }

  .profile-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
