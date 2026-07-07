<template>
  <div class="ai-login-page">
    <canvas ref="particleCanvas" class="particle-bg"></canvas>

    <div class="neural-grid">
      <div v-for="i in 20" :key="'h' + i" class="grid-line" :style="{ top: i * 5 + '%', animationDelay: i * 0.1 + 's' }"></div>
      <div v-for="i in 20" :key="'v' + i" class="grid-line vertical" :style="{ left: i * 5 + '%', animationDelay: i * 0.15 + 's' }"></div>
    </div>

    <div class="ai-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <div class="login-container">
      <section class="brand-section">
        <div class="brand-content">
          <div class="ai-brain-icon">
            <svg viewBox="0 0 120 120" class="brain-svg" aria-hidden="true">
              <defs>
                <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#8a2be2" />
                  <stop offset="50%" style="stop-color:#00bfff" />
                  <stop offset="100%" style="stop-color:#ff0080" />
                </linearGradient>
              </defs>
              <circle cx="60" cy="60" r="50" fill="none" stroke="url(#brainGrad)" stroke-width="1.5" opacity="0.3">
                <animate attributeName="r" values="48;52;48" dur="3s" repeatCount="indefinite" />
              </circle>
              <circle cx="60" cy="60" r="38" fill="none" stroke="url(#brainGrad)" stroke-width="1" opacity="0.5">
                <animate attributeName="r" values="36;40;36" dur="2.5s" repeatCount="indefinite" />
              </circle>
              <rect x="40" y="40" width="40" height="40" rx="8" fill="none" stroke="url(#brainGrad)" stroke-width="2" />
              <circle cx="52" cy="52" r="3" fill="url(#brainGrad)" opacity="0.8" />
              <circle cx="68" cy="52" r="3" fill="url(#brainGrad)" opacity="0.8" />
              <circle cx="52" cy="68" r="3" fill="url(#brainGrad)" opacity="0.8" />
              <circle cx="68" cy="68" r="3" fill="url(#brainGrad)" opacity="0.8" />
              <line x1="40" y1="52" x2="25" y2="45" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="40" y1="68" x2="25" y2="75" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="80" y1="52" x2="95" y2="45" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="80" y1="68" x2="95" y2="75" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
            </svg>
          </div>
          <h1 class="brand-title">Micro<span class="brand-i">i</span>吾码</h1>
          <p class="brand-subtitle">开源 AI 低代码平台</p>
          <div class="brand-features">
            <div v-for="feature in brandFeatures" :key="feature" class="feature-item">
              <span class="feature-dot"></span>
              <span class="feature-text">{{ feature }}</span>
            </div>
          </div>
          <a href="/" class="back-home-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            返回首页
          </a>
        </div>
      </section>

      <section class="login-section">
        <div class="login-card">
          <div class="card-top-glow"></div>

          <div class="login-header">
            <h2 class="login-title">{{ titleText }}</h2>
            <p class="login-desc">{{ descText }}</p>
          </div>

          <div v-if="tenantReady" class="tenant-ready-panel">
            <div class="tenant-badge">{{ tenantOsClient }}</div>
            <p>{{ tenantName || tenantOsClient }} 已创建完成，可以进入后台开始配置系统。</p>
            <div class="tenant-admin-tip">
              默认管理员账号 <strong>admin</strong>，初始密码 <strong>{{ tenantOsClient }}</strong>，请登录后及时修改。
            </div>
            <a v-if="adminUrl" class="tenant-url" :href="adminUrl" target="_blank" rel="noopener">{{ adminUrl }}</a>
            <div class="tenant-actions">
              <a class="login-btn tenant-action" :href="adminUrl" target="_blank" rel="noopener">进入后台</a>
              <a class="login-btn tenant-action secondary" href="/profile.html">进入个人中心</a>
            </div>
            <button class="link-btn" type="button" @click="resetSession">切换账号</button>
          </div>

          <form v-else-if="isAuthed" class="tenant-form" @submit.prevent="createTenant">
            <div class="input-group">
              <div class="input-icon">K</div>
              <input v-model.trim="tenantKey" class="login-input" placeholder="租户 Key，例如 microi-demo" autocomplete="off" />
            </div>
            <div class="input-group">
              <div class="input-icon">T</div>
              <input v-model.trim="systemName" class="login-input" placeholder="系统名称，例如 我的吾码系统" autocomplete="organization" />
            </div>
            <p class="login-tip">Key 必须以英文字母开头，仅支持英文字母、数字、- 和 _。</p>
            <div v-if="visibleTenantSteps" class="tenant-progress-panel">
              <div class="tenant-step-summary">{{ tenantProgress || tenantStepSummary }}</div>
              <div class="tenant-step-list">
                <div
                  v-for="(step, index) in tenantSteps"
                  :key="step.Key"
                  class="tenant-step"
                  :class="step.Status"
                >
                  <span class="step-index">{{ index + 1 }}</span>
                  <div class="step-content">
                    <strong>{{ step.Title }}</strong>
                    <em>{{ stepElapsedText(step) }}</em>
                    <small>{{ step.Detail }}</small>
                  </div>
                </div>
              </div>
            </div>
            <button class="login-btn" type="submit" :class="{ loading: isCreating }" :disabled="isCreating">
              {{ isCreating ? '正在创建...' : '创建我的免费租户' }}
            </button>
            <button class="link-btn" type="button" @click="resetSession">退出登录</button>
          </form>

          <div v-else>
            <div class="auth-tabs" role="tablist" aria-label="登录注册切换">
              <button class="auth-tab" :class="{ active: authTab === 'login' }" type="button" @click="switchAuthTab('login')">登录</button>
              <button class="auth-tab" :class="{ active: authTab === 'register' }" type="button" @click="switchAuthTab('register')">注册</button>
            </div>

            <form v-if="authTab === 'login'" class="phone-login-form" @submit.prevent="handleLogin">
              <div class="mode-switcher">
                <button class="mode-btn" :class="{ active: loginType === 'sms' }" type="button" @click="switchLoginType('sms')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                  验证码登录
                </button>
                <button class="mode-btn" :class="{ active: loginType === 'password' }" type="button" @click="switchLoginType('password')">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  密码登录
                </button>
              </div>

              <template v-if="loginType === 'sms'">
                <div class="input-group">
                  <div class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                      <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                  </div>
                  <input v-model.trim="loginPhone" type="tel" placeholder="请输入手机号" maxlength="11" class="login-input" autocomplete="tel" />
                </div>

                <div v-if="!devSmsBypass" class="input-group captcha-group">
                  <div class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input v-model.trim="captchaValue" type="text" placeholder="图形验证码" maxlength="6" class="login-input captcha-input" autocomplete="off" />
                  <button class="captcha-img-wrapper" type="button" @click="refreshCaptcha">
                    <img v-if="captchaImgSrc" :src="captchaImgSrc" alt="验证码" class="captcha-img" />
                    <span v-else class="captcha-loading"></span>
                  </button>
                </div>

                <div v-if="!devSmsBypass" class="input-group">
                  <div class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <input v-model.trim="loginSmsCode" type="text" placeholder="短信验证码" maxlength="6" class="login-input sms-input" autocomplete="one-time-code" />
                  <button class="sms-btn" type="button" :disabled="smsCooldown > 0 || !loginPhone" @click="sendSmsCode">
                    {{ smsCooldown > 0 ? smsCooldown + 's' : '获取验证码' }}
                  </button>
                </div>
              </template>

              <template v-else>
                <div class="input-group">
                  <div class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <input v-model.trim="loginAccount" placeholder="手机号或登录账号" maxlength="32" class="login-input" autocomplete="username" />
                </div>
                <div class="input-group">
                  <div class="input-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <input v-model="loginPassword" type="password" placeholder="请输入登录密码" maxlength="32" class="login-input" autocomplete="current-password" />
                </div>
              </template>

              <button class="login-btn" type="submit" :class="{ loading: isLogging }" :disabled="isLogging">
                {{ isLogging ? '登录中...' : '登录' }}
              </button>
            </form>

            <form v-else class="phone-login-form" @submit.prevent="handleRegister">
              <div class="input-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <input v-model.trim="registerPhone" type="tel" placeholder="请输入注册手机号" maxlength="11" class="login-input" autocomplete="tel" />
              </div>

              <div v-if="!devSmsBypass" class="input-group captcha-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input v-model.trim="captchaValue" type="text" placeholder="图形验证码" maxlength="6" class="login-input captcha-input" autocomplete="off" />
                <button class="captcha-img-wrapper" type="button" @click="refreshCaptcha">
                  <img v-if="captchaImgSrc" :src="captchaImgSrc" alt="验证码" class="captcha-img" />
                  <span v-else class="captcha-loading"></span>
                </button>
              </div>

              <div v-if="!devSmsBypass" class="input-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <input v-model.trim="registerSmsCode" type="text" placeholder="短信验证码" maxlength="6" class="login-input sms-input" autocomplete="one-time-code" />
                <button class="sms-btn" type="button" :disabled="smsCooldown > 0 || !registerPhone" @click="sendSmsCode">
                  {{ smsCooldown > 0 ? smsCooldown + 's' : '获取验证码' }}
                </button>
              </div>

              <div class="input-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <input v-model="registerPassword" type="password" placeholder="设置登录密码" maxlength="32" class="login-input" autocomplete="new-password" />
              </div>

              <div class="input-group">
                <div class="input-icon">✓</div>
                <input v-model="confirmPassword" type="password" placeholder="确认登录密码" maxlength="32" class="login-input" autocomplete="new-password" />
              </div>

              <button class="login-btn" type="submit" :class="{ loading: isLogging }" :disabled="isLogging">
                {{ isLogging ? '注册中...' : '注册并登录' }}
              </button>
              <p class="login-tip">注册成功后可继续创建一个免费的 SaaS 租户。</p>
              <p class="login-tip token-tip">注册即赠送 100,000 AI 中转站 Token，可在个人中心查看已用和剩余额度。</p>
            </form>
          </div>

          <div class="agreement">
            登录即表示同意
            <a href="javascript:void(0)">《用户协议》</a>
            和
            <a href="javascript:void(0)">《隐私政策》</a>
          </div>
        </div>
      </section>
    </div>

    <Transition name="toast-slide">
      <div v-if="toastMsg" class="toast-msg" :class="toastType">{{ toastMsg }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

const API_BASE = import.meta.env.VITE_MICROI_API_BASE || getDefaultApiBase()
const OS_CLIENT = 'iTdos'

const authTab = ref('login')
const loginType = ref('sms')
const loginPhone = ref('')
const loginAccount = ref('')
const loginPassword = ref('')
const loginSmsCode = ref('')
const registerPhone = ref('')
const registerSmsCode = ref('')
const captchaValue = ref('')
const captchaId = ref('')
const captchaImgSrc = ref('')
const smsCooldown = ref(0)
const registerPassword = ref('')
const confirmPassword = ref('')
const isLogging = ref(false)
const isCreating = ref(false)
const toastMsg = ref('')
const toastType = ref('info')
const authToken = ref('')
const currentUser = ref(null)
const tenantKey = ref('')
const systemName = ref('')
const tenantOsClient = ref('')
const tenantName = ref('')
const tenantUrl = ref('')
const tenantProgress = ref('')
const tenantSteps = ref([])
const tenantProgressTick = ref(Date.now())
const particleCanvas = ref(null)

let smsTimer = null
let toastTimer = null
let animFrame = null
let resizeHandler = null
let visibilityHandler = null
let tenantProgressTimer = null
let tenantProgressTraceId = ''

function getDefaultApiBase() {
  if (typeof window !== 'undefined' && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)) {
    return 'https://localhost:7266'
  }
  return 'https://api.itdos.com'
}

const brandFeatures = [
  'AI 引擎 · 智能数据分析与编程',
  'API 接口引擎 · 在线编写后端接口',
  '工作流引擎 · 可视化流程设计',
  '多数据库 · MySQL / SqlServer / Oracle',
  '分布式架构 · Docker / K8S / 微服务'
]

const defaultTenantSteps = [
  { Key: 'validate', Title: '校验账号与租户Key', Detail: '检查登录态、租户Key格式和系统名称。', Status: 'pending' },
  { Key: 'quota', Title: '检查免费开通额度', Detail: '每个账号可免费创建一个租户。', Status: 'pending' },
  { Key: 'columns', Title: '检查主库字段', Detail: '补齐官网开通所需的租户归属字段。', Status: 'pending' },
  { Key: 'database-info', Title: '生成数据库信息', Detail: '生成数据库名、连接串和访问域名。', Status: 'pending' },
  { Key: 'create-database', Title: '创建租户数据库', Detail: '创建独立租户库。', Status: 'pending' },
  { Key: 'import-template', Title: '下载并导入空库模板', Detail: '每次都从 CDN 获取最新空库模板。', Status: 'pending' },
  { Key: 'create-osclient', Title: '写入SaaS引擎配置', Detail: '复制主租户公共配置并写入新租户配置。', Status: 'pending' },
  { Key: 'owner', Title: '绑定账号与租户', Detail: '用于个人中心展示和免费额度判断。', Status: 'pending' },
  { Key: 'admin', Title: '关联默认管理员', Detail: '复用空库模板中的默认 admin 账号，不额外插入管理员数据。', Status: 'pending' },
  { Key: 'sys-config', Title: '初始化系统设置', Detail: '写入一条启用的系统设置。', Status: 'pending' },
  { Key: 'reload', Title: '刷新SaaS引擎缓存', Detail: '让新租户立即可访问。', Status: 'pending' }
]

const isAuthed = computed(() => !!authToken.value && !!currentUser.value)
const tenantReady = computed(() => !!tenantOsClient.value)
const devSmsBypass = computed(() => {
  if (import.meta.env.VITE_MICROI_DEV_SMS_BYPASS === 'true') return true
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('devSmsBypass') === '1'
})
const adminUrl = computed(() => tenantUrl.value || (tenantOsClient.value ? `https://${tenantOsClient.value}.microi.net` : ''))
const titleText = computed(() => {
  if (tenantReady.value) return '租户已就绪'
  if (isAuthed.value) return '创建 SaaS 租户'
  return authTab.value === 'register' ? '注册 Microi吾码账号' : '登录 Microi吾码'
})
const descText = computed(() => {
  if (tenantReady.value) return '你的独立低代码工作台已经准备好'
  if (isAuthed.value) return '填写系统信息，一键生成全新租户数据库'
  return authTab.value === 'register' ? '手机号验证后设置登录密码' : '支持验证码登录或密码登录'
})
const activeSmsPhone = computed(() => authTab.value === 'register' ? registerPhone.value : loginPhone.value)
const visibleTenantSteps = computed(() => isCreating.value || tenantSteps.value.some(step => step.Status !== 'pending'))
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

function showToast(msg, type = 'info') {
  toastMsg.value = msg
  toastType.value = type
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toastMsg.value = '' }, 3000)
}

function normalizeToken(raw) {
  return (raw || '').replace(/^Bearer\s+/i, '').trim()
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}`, Token: authToken.value } : {}
}

function apiEngineUrl(key) {
  return `${API_BASE}/apiengine/${key}?OsClient=${OS_CLIENT}`
}

function switchAuthTab(tab) {
  authTab.value = tab
  captchaValue.value = ''
  loginSmsCode.value = ''
  registerSmsCode.value = ''
  if (!devSmsBypass.value) refreshCaptcha()
}

function switchLoginType(type) {
  loginType.value = type
  captchaValue.value = ''
  loginSmsCode.value = ''
  if (!devSmsBypass.value && type === 'sms') refreshCaptcha()
}

async function refreshCaptcha() {
  try {
    const resp = await fetch(`${API_BASE}/api/Captcha/GetCaptcha?OsClient=${OS_CLIENT}&t=${Date.now()}`)
    if (!resp.ok) throw new Error('captcha failed')
    const cid = resp.headers.get('captchaid') || ''
    captchaId.value = cid
    captchaImgSrc.value = URL.createObjectURL(await resp.blob())
  } catch {
    captchaImgSrc.value = ''
    showToast('验证码加载失败，请稍后重试。', 'error')
  }
}

async function sendSmsCode() {
  const smsPhone = activeSmsPhone.value
  if (!/^1\d{10}$/.test(smsPhone)) {
    showToast('请输入正确的11位手机号。', 'error')
    return
  }
  if (!captchaValue.value) {
    showToast('请先输入图形验证码。', 'error')
    return
  }
  try {
    const resp = await fetch(`${API_BASE}/apiengine/send-sms-reg?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Phone: smsPhone,
        _CaptchaId: captchaId.value,
        _CaptchaValue: captchaValue.value,
        OsClient: OS_CLIENT
      })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showToast(result.Msg || '短信验证码发送失败。', 'error')
      if (!devSmsBypass.value) refreshCaptcha()
      return
    }
    showToast('验证码已发送。', 'success')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value -= 1
      if (smsCooldown.value <= 0 && smsTimer) {
        clearInterval(smsTimer)
        smsTimer = null
      }
    }, 1000)
  } catch {
    showToast('网络异常，短信发送失败。', 'error')
  }
}

function validatePasswordFields() {
  if (!registerPassword.value || registerPassword.value.length < 6) {
    showToast('密码长度不能少于6位。', 'error')
    return false
  }
  if (registerPassword.value !== confirmPassword.value) {
    showToast('两次输入的密码不一致。', 'error')
    return false
  }
  return true
}

async function handleLogin() {
  if (isLogging.value) return
  if (loginType.value === 'sms') {
    if (!/^1\d{10}$/.test(loginPhone.value)) {
      showToast('请输入正确的11位手机号。', 'error')
      return
    }
    if (!devSmsBypass.value && !loginSmsCode.value) {
      showToast('请输入短信验证码。', 'error')
      return
    }
  } else {
    if (!loginAccount.value) {
      showToast('请输入登录账号。', 'error')
      return
    }
    if (!loginPassword.value) {
      showToast('请输入登录密码。', 'error')
      return
    }
  }

  isLogging.value = true
  try {
    const payload = {
      Action: 'login',
      LoginType: loginType.value,
      OsClient: OS_CLIENT
    }
    if (loginType.value === 'sms') {
      payload.Phone = loginPhone.value
      payload._CaptchaValue = devSmsBypass.value ? '' : loginSmsCode.value
      payload._SmsCaptchaValue = devSmsBypass.value ? '' : loginSmsCode.value
    } else {
      payload.Account = loginAccount.value
      payload.Pwd = loginPassword.value
    }
    const resp = await fetch(apiEngineUrl('official_sms_login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showToast(result.Msg || '登录失败，请重试。', 'error')
      refreshCaptcha()
      return
    }
    handleLoginSuccess(resp, result)
  } catch {
    showToast('网络异常，登录失败。', 'error')
  } finally {
    isLogging.value = false
  }
}

async function handleRegister() {
  if (isLogging.value) return
  if (!/^1\d{10}$/.test(registerPhone.value)) {
    showToast('请输入正确的11位手机号。', 'error')
    return
  }
  if (!devSmsBypass.value && !registerSmsCode.value) {
    showToast('请输入短信验证码。', 'error')
    return
  }
  if (!validatePasswordFields()) return

  isLogging.value = true
  try {
    const resp = await fetch(apiEngineUrl('official_sms_login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Action: 'register',
        LoginType: 'sms',
        Phone: registerPhone.value,
        _CaptchaValue: devSmsBypass.value ? '' : registerSmsCode.value,
        _SmsCaptchaValue: devSmsBypass.value ? '' : registerSmsCode.value,
        Pwd: registerPassword.value,
        OsClient: OS_CLIENT
      })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showToast(result.Msg || '注册失败，请重试。', 'error')
      refreshCaptcha()
      return
    }
    handleLoginSuccess(resp, result)
  } catch {
    showToast('网络异常，注册失败。', 'error')
  } finally {
    isLogging.value = false
  }
}

function handleLoginSuccess(resp, result) {
  const token = normalizeToken(resp.headers.get('authorization') || result.Data?.Authorization || result.DataAppend?.Token)
  authToken.value = token
  currentUser.value = result.Data || {}
  tenantOsClient.value = result.DataAppend?.TenantOsClient || ''
  tenantName.value = result.DataAppend?.TenantName || tenantOsClient.value
  tenantUrl.value = result.DataAppend?.TenantUrl || result.DataAppend?.Url || (tenantOsClient.value ? `https://${tenantOsClient.value}.microi.net` : '')

  localStorage.setItem('microi_doc_token', token)
  localStorage.setItem('microi_doc_user', JSON.stringify(currentUser.value))
  localStorage.setItem('microi_doc_phone', result.Data?.Phone || registerPhone.value || loginPhone.value || loginAccount.value)
  if (tenantOsClient.value) {
    localStorage.setItem('microi_doc_tenant', tenantOsClient.value)
    localStorage.setItem('microi_doc_tenant_url', tenantUrl.value)
  } else {
    localStorage.removeItem('microi_doc_tenant')
    localStorage.removeItem('microi_doc_tenant_url')
  }

  window.dispatchEvent(new CustomEvent('microi-login-success', { detail: currentUser.value }))
  showToast('登录成功，正在进入个人中心。', 'success')
  const redirect = getRedirectTarget()
  window.setTimeout(() => {
    window.location.href = redirect || '/profile.html#/overview'
  }, 350)
}

function getRedirectTarget() {
  if (typeof window === 'undefined') return ''
  const redirect = new URLSearchParams(window.location.search).get('redirect')
  if (!redirect || /^https?:\/\//i.test(redirect)) return ''
  const safeRedirect = redirect.startsWith('/') ? redirect : '/' + redirect
  return safeRedirect === '/profile.html' ? '/profile.html#/overview' : safeRedirect
}

async function createTenant() {
  if (isCreating.value) return
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey.value)) {
    showToast('租户 Key 格式不正确。', 'error')
    return
  }
  if (!systemName.value) {
    showToast('请输入系统名称。', 'error')
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
      body: JSON.stringify({
        TenantKey: tenantKey.value,
        SystemName: systemName.value,
        TraceId: traceId,
        _Lang: 'zh-CN'
      })
    })
    const result = await resp.json()
    mergeTenantSteps(result.DataAppend?.Steps || result.Data?.Steps)
    if (result.Code !== 1) {
      tenantProgress.value = result.Msg || '租户创建失败。'
      showToast(result.Msg || '租户创建失败。', 'error')
      return
    }
    const data = result.Data || result.data || {}
    const returnedTraceId = data.TraceId || data.TaskId || result.DataAppend?.TraceId || result.DataAppend?.TaskId || traceId
    if (returnedTraceId && returnedTraceId !== tenantProgressTraceId) {
      startTenantProgress(returnedTraceId)
    }
    if (data.Status === 'running' || data.TaskId || data.TraceId) {
      tenantProgress.value = result.Msg || '租户创建任务已提交，正在后台处理。'
      keepPollingAfterRequestError = true
      return
    }
    tenantOsClient.value = data.OsClient || tenantKey.value
    tenantName.value = data.SystemName || systemName.value
    tenantUrl.value = data.Url || (data.DomainName ? `https://${data.DomainName}` : `https://${tenantOsClient.value}.microi.net`)
    localStorage.setItem('microi_doc_tenant', tenantOsClient.value)
    localStorage.setItem('microi_doc_tenant_url', tenantUrl.value)
    tenantProgress.value = `租户创建成功，访问地址：${tenantUrl.value}`
    window.dispatchEvent(new CustomEvent('microi-tenant-updated'))
    showToast('租户创建成功。', 'success')
  } catch {
    keepPollingAfterRequestError = true
    tenantProgress.value = '请求连接已中断，后台可能仍在创建租户；页面会继续读取实时进度。'
    showToast('连接超时，继续为你读取后台进度。', 'info')
  } finally {
    if (!keepPollingAfterRequestError) {
      stopTenantProgress()
      isCreating.value = false
    }
  }
}

function startTenantProgress(traceId) {
  tenantSteps.value = createTenantSteps()
  tenantProgressTraceId = traceId
  tenantProgressTick.value = Date.now()
  tenantProgress.value = ''
  markTenantStep(tenantSteps.value[0].Key, 'running')
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
      tenantOsClient.value = payload.OsClient || tenantKey.value
      tenantName.value = payload.SystemName || systemName.value
      tenantUrl.value = payload.Url || (payload.DomainName ? `https://${payload.DomainName}` : `https://${tenantOsClient.value}.microi.net`)
      localStorage.setItem('microi_doc_tenant', tenantOsClient.value)
      localStorage.setItem('microi_doc_tenant_url', tenantUrl.value)
      tenantProgress.value = `租户创建成功，访问地址：${tenantUrl.value}`
      window.dispatchEvent(new CustomEvent('microi-tenant-updated'))
      showToast('租户创建成功。', 'success')
      stopTenantProgress()
      isCreating.value = false
      return
    }
    if (data.Status === 'error' && data.Msg) {
      tenantProgress.value = data.Msg
      showToast(data.Msg, 'error')
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

function restoreSession() {
  const token = normalizeToken(localStorage.getItem('microi_doc_token'))
  const userRaw = localStorage.getItem('microi_doc_user')
  const tenant = localStorage.getItem('microi_doc_tenant')
  const savedTenantUrl = localStorage.getItem('microi_doc_tenant_url')
  if (token && userRaw) {
    authToken.value = token
    try {
      currentUser.value = JSON.parse(userRaw)
    } catch {
      currentUser.value = {}
    }
  }
  if (tenant) {
    tenantOsClient.value = tenant
    tenantName.value = tenant
    tenantUrl.value = savedTenantUrl || `https://${tenant}.microi.net`
  }
}

function resetSession() {
  authToken.value = ''
  currentUser.value = null
  tenantOsClient.value = ''
  tenantName.value = ''
  tenantUrl.value = ''
  tenantProgress.value = ''
  tenantSteps.value = createTenantSteps()
  tenantProgressTraceId = ''
  tenantKey.value = ''
  systemName.value = ''
  authTab.value = 'login'
  loginType.value = 'sms'
  loginPhone.value = ''
  loginAccount.value = ''
  loginPassword.value = ''
  loginSmsCode.value = ''
  registerPhone.value = ''
  registerSmsCode.value = ''
  registerPassword.value = ''
  confirmPassword.value = ''
  captchaValue.value = ''
  stopTenantProgress()
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_user')
  localStorage.removeItem('microi_doc_tenant')
  localStorage.removeItem('microi_doc_tenant_url')
  showToast('已退出登录。')
}

function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return
  const ctx = canvas.getContext('2d')
  const particles = []
  const count = window.innerWidth < 768 ? 18 : 34
  let width = 0
  let height = 0
  let lastDraw = 0
  let isVisible = !document.hidden

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.35)
    width = window.innerWidth || document.documentElement.clientWidth || 1440
    height = window.innerHeight || document.documentElement.clientHeight || 900
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function createParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 0.5,
      color: ['rgba(138,43,226,', 'rgba(0,191,255,', 'rgba(255,0,128,'][Math.floor(Math.random() * 3)]
    }
  }

  resize()
  resizeHandler = resize
  window.addEventListener('resize', resizeHandler)
  visibilityHandler = () => {
    isVisible = !document.hidden
  }
  document.addEventListener('visibilitychange', visibilityHandler)
  for (let i = 0; i < count; i += 1) particles.push(createParticle())

  function draw(now = 0) {
    animFrame = requestAnimationFrame(draw)
    if (!isVisible || now - lastDraw < 33) return
    lastDraw = now
    ctx.clearRect(0, 0, width, height)
    particles.forEach((particle, index) => {
      particle.x += particle.vx
      particle.y += particle.vy
      if (particle.x < 0 || particle.x > width) particle.vx *= -1
      if (particle.y < 0 || particle.y > height) particle.vy *= -1
      ctx.beginPath()
      ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2)
      ctx.fillStyle = particle.color + '0.6)'
      ctx.fill()

      for (let j = index + 1; j < particles.length; j += 1) {
        const other = particles[j]
        const dx = particle.x - other.x
        const dy = particle.y - other.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.moveTo(particle.x, particle.y)
          ctx.lineTo(other.x, other.y)
          ctx.strokeStyle = particle.color + (0.15 * (1 - dist / 120)) + ')'
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    })
  }
  draw()
}

onMounted(() => {
  restoreSession()
  if (isAuthed.value) {
    window.location.href = getRedirectTarget() || '/profile.html#/overview'
    return
  }
  nextTick(() => {
    initParticles()
    if (!devSmsBypass.value) {
      refreshCaptcha()
    }
  })
})

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (animFrame) cancelAnimationFrame(animFrame)
  if (resizeHandler) window.removeEventListener('resize', resizeHandler)
  if (visibilityHandler) document.removeEventListener('visibilitychange', visibilityHandler)
})
</script>

<style scoped>
.ai-login-page {
  position: fixed;
  inset: 0;
  min-height: 100dvh;
  width: 100vw;
  background: linear-gradient(135deg, #0a0a14 0%, #0d0d1a 40%, #1a0a2e 70%, #0a0a14 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans CJK SC', sans-serif;
}

.particle-bg,
.neural-grid,
.ai-orbs {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100dvh;
}

.particle-bg {
  display: block;
  z-index: 1;
}

.neural-grid {
  z-index: 0;
  opacity: 0.04;
}

.grid-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138, 43, 226, 0.5), rgba(0, 191, 255, 0.5), transparent);
  animation: gridPulse 4s ease-in-out infinite;
}

.grid-line.vertical {
  top: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, transparent, rgba(138, 43, 226, 0.5), rgba(0, 191, 255, 0.5), transparent);
}

@keyframes gridPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

.ai-orbs {
  z-index: 1;
  pointer-events: none;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
}

.orb-1 {
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(138, 43, 226, 0.3), transparent 70%);
  top: -10%;
  left: -5%;
  animation: orbFloat1 8s ease-in-out infinite;
}

.orb-2 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(0, 191, 255, 0.25), transparent 70%);
  bottom: -10%;
  right: -5%;
  animation: orbFloat2 10s ease-in-out infinite;
}

.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255, 0, 128, 0.15), transparent 70%);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: orbFloat3 12s ease-in-out infinite;
}

@keyframes orbFloat1 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(50px, 30px); }
}

@keyframes orbFloat2 {
  0%, 100% { transform: translate(0, 0); }
  50% { transform: translate(-40px, -30px); }
}

@keyframes orbFloat3 {
  0%, 100% { transform: translate(-50%, -50%) scale(1); }
  50% { transform: translate(-50%, -50%) scale(1.2); }
}

.login-container {
  position: relative;
  z-index: 10;
  display: flex;
  width: 920px;
  max-width: 95vw;
  min-height: 610px;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(15, 15, 25, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(138, 43, 226, 0.15);
  box-shadow: 0 0 40px rgba(138, 43, 226, 0.1), 0 0 80px rgba(0, 191, 255, 0.05), 0 25px 50px rgba(0, 0, 0, 0.3);
}

.brand-section {
  flex: 1;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.08), rgba(0, 191, 255, 0.05));
  border-right: 1px solid rgba(255, 255, 255, 0.05);
}

.ai-brain-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.brain-svg {
  width: 100%;
  height: 100%;
}

.brand-title {
  font-size: 32px;
  font-weight: 700;
  color: #fff;
  margin: 0 0 8px;
}

.brand-i {
  color: #ff3333;
}

.brand-subtitle {
  font-size: 16px;
  color: rgba(222, 222, 238, 0.82);
  margin: 0 0 32px;
}

.brand-features {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.feature-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #8a2be2, #00bfff);
}

.feature-text,
.back-home-link,
.login-desc,
.login-tip,
.agreement {
  color: rgba(210, 210, 226, 0.78);
}

.feature-text,
.back-home-link {
  font-size: 13px;
}

.back-home-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 36px;
  text-decoration: none;
  color: rgba(138, 43, 226, 0.9);
}

.login-section {
  width: 420px;
  padding: 42px 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-card {
  position: relative;
  width: 100%;
  padding: 32px 28px;
  border-radius: 20px;
  background: rgba(20, 20, 35, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}

.card-top-glow {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #8a2be2, #00bfff, #ff0080);
}

.login-header {
  margin-bottom: 24px;
  text-align: center;
}

.login-title {
  margin: 0 0 8px;
  font-size: 24px;
  color: #fff;
}

.login-desc {
  margin: 0;
  font-size: 14px;
}

.auth-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 18px;
  padding: 5px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.auth-tab {
  height: 42px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: rgba(222, 222, 238, 0.76);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-tab.active {
  color: #fff;
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.34), rgba(0, 191, 255, 0.22));
  box-shadow: 0 10px 24px rgba(0, 191, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.16);
}

.mode-switcher {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  padding: 4px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
}

.mode-switcher.single .mode-btn {
  width: 100%;
}

.mode-btn,
.sms-btn,
.login-btn,
.link-btn,
.captcha-img-wrapper {
  border: 0;
  cursor: pointer;
}

.mode-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  gap: 8px;
  height: 42px;
  border-radius: 11px;
  background: transparent;
  color: rgba(222, 222, 238, 0.72);
  font-weight: 600;
}

.mode-btn.active {
  background: linear-gradient(135deg, rgba(138, 43, 226, 0.28), rgba(0, 191, 255, 0.18));
  color: #fff;
  box-shadow: 0 0 18px rgba(138, 43, 226, 0.18);
}

.phone-login-form,
.tenant-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input-group {
  position: relative;
  display: flex;
  align-items: center;
  height: 48px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.055);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-group:focus-within {
  border-color: rgba(0, 191, 255, 0.55);
  box-shadow: 0 0 18px rgba(0, 191, 255, 0.12);
}

.input-icon {
  width: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(138, 43, 226, 0.9);
  font-size: 14px;
  font-weight: 700;
}

.login-input {
  flex: 1;
  height: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #fff;
  font-size: 14px;
}

.login-input::placeholder {
  color: rgba(210, 210, 226, 0.38);
}

.captcha-input,
.sms-input {
  padding-right: 8px;
}

.captcha-img-wrapper,
.sms-btn {
  flex-shrink: 0;
  height: 36px;
  margin-right: 6px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.captcha-img-wrapper {
  width: 96px;
  padding: 0;
  overflow: hidden;
}

.captcha-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.captcha-loading {
  display: block;
  width: 18px;
  height: 18px;
  margin: 9px auto;
  border: 2px solid rgba(255, 255, 255, 0.18);
  border-top-color: #00bfff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.sms-btn {
  min-width: 96px;
  padding: 0 12px;
  font-size: 13px;
  color: #00bfff;
}

.sms-btn:disabled {
  cursor: not-allowed;
  color: rgba(210, 210, 226, 0.42);
}

.login-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  margin-top: 4px;
  border-radius: 12px;
  background: linear-gradient(135deg, #8a2be2, #00bfff);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: 0 12px 24px rgba(0, 191, 255, 0.18);
}

.login-btn:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.login-tip {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.token-tip {
  margin-top: 6px;
  border: 1px solid rgba(0, 191, 255, 0.18);
  border-radius: 12px;
  background: rgba(0, 191, 255, 0.08);
  color: rgba(236, 249, 255, 0.92);
  padding: 8px 10px;
}

.tenant-progress-panel {
  padding: 12px;
  border: 1px solid rgba(0, 191, 255, 0.18);
  border-radius: 14px;
  background: rgba(0, 191, 255, 0.08);
}

.tenant-step-summary {
  margin-bottom: 10px;
  color: rgba(236, 249, 255, 0.94);
  font-size: 12px;
  line-height: 1.6;
}

.tenant-step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
  padding-right: 4px;
}

.tenant-step {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 9px;
  align-items: flex-start;
  padding: 9px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tenant-step.done {
  border-color: rgba(34, 197, 94, 0.32);
  background: rgba(34, 197, 94, 0.08);
}

.tenant-step.running {
  border-color: rgba(0, 191, 255, 0.38);
  background: rgba(0, 191, 255, 0.1);
}

.tenant-step.error {
  border-color: rgba(239, 68, 68, 0.42);
  background: rgba(239, 68, 68, 0.1);
}

.tenant-step.skipped {
  opacity: 0.58;
}

.step-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(230, 230, 246, 0.72);
  font-size: 12px;
  font-weight: 700;
}

.tenant-step.done .step-index {
  background: rgba(34, 197, 94, 0.22);
  color: #86efac;
}

.tenant-step.running .step-index {
  background: rgba(0, 191, 255, 0.2);
  color: #8be6ff;
  animation: stepPulse 1.1s ease-in-out infinite;
}

.tenant-step.error .step-index {
  background: rgba(239, 68, 68, 0.22);
  color: #fca5a5;
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.step-content strong {
  color: rgba(245, 245, 255, 0.92);
  font-size: 12px;
}

.step-content em {
  color: #8be6ff;
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
}

.step-content small {
  color: rgba(210, 210, 226, 0.62);
  font-size: 11px;
  line-height: 1.5;
}

@keyframes stepPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(0, 191, 255, 0.24); }
  50% { box-shadow: 0 0 0 5px rgba(0, 191, 255, 0); }
}

.agreement {
  margin-top: 20px;
  font-size: 12px;
  text-align: center;
}

.agreement a {
  color: #00bfff;
  text-decoration: none;
}

.tenant-ready-panel {
  text-align: center;
  color: rgba(230, 230, 246, 0.84);
}

.tenant-url {
  display: block;
  margin: 12px 0;
  color: #00bfff;
  font-size: 13px;
  text-decoration: none;
  word-break: break-all;
}

.tenant-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 16px;
  margin-bottom: 12px;
  border-radius: 999px;
  background: rgba(0, 191, 255, 0.12);
  color: #8be6ff;
  font-weight: 700;
}

.tenant-admin-tip {
  margin: 12px 0 6px;
  padding: 10px 12px;
  border: 1px solid rgba(0, 191, 255, 0.24);
  border-radius: 14px;
  background: rgba(0, 191, 255, 0.08);
  color: rgba(235, 249, 255, 0.9);
  font-size: 13px;
  line-height: 1.7;
}

.tenant-admin-tip strong {
  color: #8be6ff;
}

.tenant-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tenant-action {
  text-decoration: none;
}

.tenant-action.secondary {
  background: linear-gradient(135deg, rgba(0, 191, 255, 0.18), rgba(123, 97, 255, 0.22));
  border: 1px solid rgba(139, 230, 255, 0.28);
  box-shadow: none;
}

.link-btn {
  display: block;
  margin: 14px auto 0;
  background: transparent;
  color: rgba(210, 210, 226, 0.68);
  font-size: 13px;
}

.toast-msg {
  position: fixed;
  top: 24px;
  left: 50%;
  z-index: 100;
  transform: translateX(-50%);
  min-width: 220px;
  padding: 12px 18px;
  border-radius: 12px;
  background: rgba(20, 20, 35, 0.96);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.toast-msg.success {
  border-color: rgba(34, 197, 94, 0.5);
}

.toast-msg.error {
  border-color: rgba(239, 68, 68, 0.5);
}

.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: opacity 0.2s, transform 0.2s;
}

.toast-slide-enter-from,
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -8px);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 860px) {
  .ai-login-page {
    padding: 24px 0;
    align-items: flex-start;
    overflow-y: auto;
  }

  .login-container {
    flex-direction: column;
    width: min(440px, 94vw);
    min-height: 0;
  }

  .brand-section {
    padding: 34px 28px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .login-section {
    width: auto;
    padding: 28px 20px;
  }

  .login-card {
    padding: 28px 22px;
  }
}
</style>
