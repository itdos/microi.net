<template>
  <main class="login-page">
    <section class="brand-panel">
      <div class="brand-copy">
        <img class="brand-mark" src="/icon.png" alt="Microi吾码" />
        <p class="eyebrow">Microi吾码</p>
        <h1>开源 AI 低代码平台</h1>
        <p class="lede">登录后即可创建一个免费的 SaaS 租户，用独立数据库启动你的低代码工作台。</p>
        <div class="feature-grid">
          <span>表单引擎</span>
          <span>接口引擎</span>
          <span>工作流</span>
          <span>多租户</span>
        </div>
      </div>
    </section>

    <section class="auth-panel">
      <div class="auth-shell">
        <div class="auth-head">
          <p class="section-kicker">{{ tenantReady ? '租户已就绪' : isAuthed ? '创建租户' : '账号登录' }}</p>
          <h2>{{ tenantReady ? tenantName : isAuthed ? '填写系统信息' : '登录 / 注册' }}</h2>
          <p>{{ tenantReady ? '你可以进入后台开始使用。' : isAuthed ? '每个用户当前可免费创建一个租户。' : '手机号验证码会自动创建账号。' }}</p>
        </div>

        <div v-if="tenantReady" class="tenant-ready">
          <div class="tenant-badge">{{ tenantOsClient }}</div>
          <a class="primary-btn" :href="adminUrl" target="_blank" rel="noopener">进入后台</a>
          <button class="ghost-btn" type="button" @click="resetSession">切换账号</button>
        </div>

        <form v-else-if="isAuthed" class="form-stack" @submit.prevent="createTenant">
          <label>
            <span>租户 Key</span>
            <input
              v-model.trim="tenantKey"
              autocomplete="off"
              placeholder="例如 microi-demo"
              pattern="[A-Za-z][A-Za-z0-9_-]*"
            />
          </label>
          <label>
            <span>系统名称</span>
            <input v-model.trim="systemName" autocomplete="organization" placeholder="例如 我的吾码系统" />
          </label>
          <p class="field-hint">Key 必须以英文字母开头，仅支持英文字母、数字、- 和 _。</p>
          <button class="primary-btn" type="submit" :disabled="isCreating">
            {{ isCreating ? '正在创建...' : '创建我的租户' }}
          </button>
          <button class="ghost-btn" type="button" @click="resetSession">退出登录</button>
        </form>

        <div v-else class="login-tabs">
          <div class="segmented">
            <button type="button" :class="{ active: loginType === 'sms' }" @click="loginType = 'sms'">验证码</button>
            <button type="button" :class="{ active: loginType === 'pwd' }" @click="loginType = 'pwd'">密码</button>
          </div>

          <form class="form-stack" @submit.prevent="handleLogin">
            <label>
              <span>手机号</span>
              <input v-model.trim="phone" type="tel" maxlength="11" autocomplete="tel" placeholder="请输入手机号" />
            </label>

            <template v-if="loginType === 'sms'">
              <label>
                <span>图形验证码</span>
                <div class="captcha-row">
                  <input v-model.trim="captchaValue" maxlength="6" autocomplete="off" placeholder="请输入图形验证码" />
                  <button class="captcha-btn" type="button" @click="refreshCaptcha">
                    <img v-if="captchaImgSrc" :src="captchaImgSrc" alt="验证码" />
                    <span v-else>刷新</span>
                  </button>
                </div>
              </label>
              <label>
                <span>短信验证码</span>
                <div class="sms-row">
                  <input v-model.trim="smsCode" maxlength="6" autocomplete="one-time-code" placeholder="请输入短信验证码" />
                  <button class="sms-btn" type="button" :disabled="smsCooldown > 0 || !phone" @click="sendSmsCode">
                    {{ smsCooldown > 0 ? smsCooldown + 's' : '获取验证码' }}
                  </button>
                </div>
              </label>
            </template>

            <template v-else>
              <label>
                <span>密码</span>
                <input v-model="password" type="password" maxlength="32" autocomplete="current-password" placeholder="请输入密码" />
              </label>
              <label>
                <span>图形验证码</span>
                <div class="captcha-row">
                  <input v-model.trim="pwdCaptchaValue" maxlength="6" autocomplete="off" placeholder="请输入图形验证码" />
                  <button class="captcha-btn" type="button" @click="refreshPwdCaptcha">
                    <img v-if="pwdCaptchaImgSrc" :src="pwdCaptchaImgSrc" alt="验证码" />
                    <span v-else>刷新</span>
                  </button>
                </div>
              </label>
            </template>

            <button class="primary-btn" type="submit" :disabled="isLogging">
              {{ isLogging ? '登录中...' : loginType === 'sms' ? '登录 / 注册' : '登录' }}
            </button>
          </form>
        </div>

        <p v-if="message" class="message" :class="messageType">{{ message }}</p>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const API_BASE = import.meta.env.VITE_MICROI_API_BASE || 'https://api.microi.net'
const OS_CLIENT = 'MicroiDoc'

const loginType = ref('sms')
const phone = ref('')
const captchaValue = ref('')
const captchaId = ref('')
const captchaImgSrc = ref('')
const smsCode = ref('')
const smsCooldown = ref(0)
const password = ref('')
const pwdCaptchaValue = ref('')
const pwdCaptchaId = ref('')
const pwdCaptchaImgSrc = ref('')
const isLogging = ref(false)
const isCreating = ref(false)
const message = ref('')
const messageType = ref('info')
const authToken = ref('')
const currentUser = ref(null)
const tenantKey = ref('')
const systemName = ref('')
const tenantOsClient = ref('')
const tenantName = ref('')
let smsTimer = null

const isAuthed = computed(() => !!authToken.value && !!currentUser.value)
const tenantReady = computed(() => !!tenantOsClient.value)
const adminUrl = computed(() => `https://microi.net/?OsClient=${encodeURIComponent(tenantOsClient.value)}`)

function showMessage(text, type = 'info') {
  message.value = text
  messageType.value = type
}

function normalizeToken(raw) {
  return (raw || '').replace(/^Bearer\s+/i, '').trim()
}

function authHeaders() {
  return authToken.value ? { authorization: `Bearer ${authToken.value}` } : {}
}

async function fetchCaptcha(target) {
  try {
    const resp = await fetch(`${API_BASE}/api/Captcha/GetCaptcha?OsClient=${OS_CLIENT}&t=${Date.now()}`)
    if (!resp.ok) throw new Error('captcha failed')
    const cid = resp.headers.get('captchaid') || ''
    const src = URL.createObjectURL(await resp.blob())
    if (target === 'pwd') {
      pwdCaptchaId.value = cid
      pwdCaptchaImgSrc.value = src
    } else {
      captchaId.value = cid
      captchaImgSrc.value = src
    }
  } catch {
    showMessage('验证码加载失败，请稍后重试。', 'error')
  }
}

function refreshCaptcha() {
  return fetchCaptcha('sms')
}

function refreshPwdCaptcha() {
  return fetchCaptcha('pwd')
}

async function sendSmsCode() {
  if (!/^1\d{10}$/.test(phone.value)) {
    showMessage('请输入正确的 11 位手机号。', 'error')
    return
  }
  if (!captchaValue.value) {
    showMessage('请先输入图形验证码。', 'error')
    return
  }

  try {
    const resp = await fetch(`${API_BASE}/apiengine/send-sms-reg?OsClient=${OS_CLIENT}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Phone: phone.value,
        _CaptchaId: captchaId.value,
        _CaptchaValue: captchaValue.value,
        OsClient: OS_CLIENT
      })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showMessage(result.Msg || '短信验证码发送失败。', 'error')
      refreshCaptcha()
      return
    }

    showMessage('短信验证码已发送。', 'success')
    smsCooldown.value = 60
    smsTimer = setInterval(() => {
      smsCooldown.value -= 1
      if (smsCooldown.value <= 0 && smsTimer) {
        clearInterval(smsTimer)
        smsTimer = null
      }
    }, 1000)
  } catch {
    showMessage('网络异常，短信发送失败。', 'error')
  }
}

async function handleLogin() {
  if (isLogging.value) return
  if (!/^1\d{10}$/.test(phone.value)) {
    showMessage('请输入正确的 11 位手机号。', 'error')
    return
  }

  isLogging.value = true
  try {
    const isSms = loginType.value === 'sms'
    if (isSms && !smsCode.value) {
      showMessage('请输入短信验证码。', 'error')
      return
    }
    if (!isSms && (!password.value || !pwdCaptchaValue.value)) {
      showMessage('请输入密码和图形验证码。', 'error')
      return
    }

    const url = isSms ? '/api/SysUser/SmsLogin' : '/api/SysUser/Login'
    const payload = isSms
      ? { Phone: phone.value, _CaptchaValue: smsCode.value, OsClient: OS_CLIENT }
      : {
          Account: phone.value,
          Pwd: password.value,
          _CaptchaId: pwdCaptchaId.value,
          _CaptchaValue: pwdCaptchaValue.value,
          OsClient: OS_CLIENT
        }

    const resp = await fetch(API_BASE + url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showMessage(result.Msg || '登录失败。', 'error')
      isSms ? refreshCaptcha() : refreshPwdCaptcha()
      return
    }

    handleLoginSuccess(resp, result)
  } catch {
    showMessage('网络异常，登录失败。', 'error')
  } finally {
    isLogging.value = false
  }
}

function handleLoginSuccess(resp, result) {
  const token = normalizeToken(resp.headers.get('authorization') || result.DataAppend?.Token)
  authToken.value = token
  currentUser.value = result.Data || {}
  tenantOsClient.value = result.DataAppend?.TenantOsClient || ''
  tenantName.value = result.DataAppend?.TenantName || tenantOsClient.value

  localStorage.setItem('microi_doc_token', token)
  localStorage.setItem('microi_doc_user', JSON.stringify(currentUser.value))
  localStorage.setItem('microi_doc_phone', phone.value)
  if (tenantOsClient.value) {
    localStorage.setItem('microi_doc_tenant', tenantOsClient.value)
  }

  window.dispatchEvent(new CustomEvent('microi-login-success', { detail: currentUser.value }))
  showMessage(tenantOsClient.value ? '登录成功，租户已就绪。' : '登录成功，请创建你的租户。', 'success')
}

async function createTenant() {
  if (isCreating.value) return
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(tenantKey.value)) {
    showMessage('租户 Key 格式不正确。', 'error')
    return
  }
  if (!systemName.value) {
    showMessage('请输入系统名称。', 'error')
    return
  }

  isCreating.value = true
  try {
    const resp = await fetch(`${API_BASE}/api/SysUser/CreateTenant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        TenantKey: tenantKey.value,
        SystemName: systemName.value
      })
    })
    const result = await resp.json()
    if (result.Code !== 1) {
      showMessage(result.Msg || '租户创建失败。', 'error')
      return
    }

    tenantOsClient.value = result.Data?.OsClient || tenantKey.value
    tenantName.value = result.Data?.SystemName || systemName.value
    localStorage.setItem('microi_doc_tenant', tenantOsClient.value)
    showMessage('租户创建成功。', 'success')
  } catch {
    showMessage('网络异常，租户创建失败。', 'error')
  } finally {
    isCreating.value = false
  }
}

function restoreSession() {
  const token = normalizeToken(localStorage.getItem('microi_doc_token'))
  const userRaw = localStorage.getItem('microi_doc_user')
  const tenant = localStorage.getItem('microi_doc_tenant')
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
  }
}

function resetSession() {
  authToken.value = ''
  currentUser.value = null
  tenantOsClient.value = ''
  tenantName.value = ''
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_user')
  localStorage.removeItem('microi_doc_tenant')
  showMessage('已退出登录。')
}

onMounted(() => {
  restoreSession()
  refreshCaptcha()
  refreshPwdCaptcha()
})

onUnmounted(() => {
  if (smsTimer) clearInterval(smsTimer)
})
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(360px, 1fr) minmax(360px, 460px);
  background: #0f172a;
  color: #e5e7eb;
}

.brand-panel {
  min-height: 100vh;
  display: flex;
  align-items: center;
  padding: 64px;
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.94), rgba(15, 23, 42, 0.68)),
    url('/home.png') center / cover no-repeat;
}

.brand-copy {
  max-width: 620px;
}

.brand-mark {
  width: 56px;
  height: 56px;
  border-radius: 12px;
  margin-bottom: 28px;
}

.eyebrow,
.section-kicker {
  margin: 0 0 10px;
  color: #f97316;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1,
h2 {
  margin: 0;
  color: #fff;
  line-height: 1.1;
}

h1 {
  font-size: 56px;
  max-width: 520px;
}

h2 {
  font-size: 30px;
}

.lede {
  margin: 22px 0 0;
  max-width: 500px;
  color: rgba(229, 231, 235, 0.84);
  font-size: 18px;
  line-height: 1.8;
}

.feature-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 34px;
}

.feature-grid span,
.tenant-badge {
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  color: #fff;
  font-size: 13px;
}

.auth-panel {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: #fff;
  color: #111827;
}

.auth-shell {
  width: 100%;
  max-width: 390px;
}

.auth-head {
  margin-bottom: 26px;
}

.auth-head p:last-child {
  margin: 10px 0 0;
  color: #6b7280;
  line-height: 1.6;
}

.segmented {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  padding: 4px;
  margin-bottom: 22px;
  background: #f3f4f6;
  border-radius: 8px;
}

.segmented button,
.ghost-btn,
.primary-btn,
.sms-btn,
.captcha-btn {
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 650;
}

.segmented button {
  height: 38px;
  background: transparent;
  color: #6b7280;
}

.segmented button.active {
  background: #fff;
  color: #111827;
  box-shadow: 0 1px 8px rgba(15, 23, 42, 0.08);
}

.form-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

label span {
  display: block;
  margin-bottom: 7px;
  color: #374151;
  font-size: 13px;
  font-weight: 650;
}

input {
  width: 100%;
  height: 44px;
  box-sizing: border-box;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  padding: 0 12px;
  color: #111827;
  outline: none;
}

input:focus {
  border-color: #f97316;
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.14);
}

.captcha-row,
.sms-row {
  display: grid;
  grid-template-columns: 1fr 116px;
  gap: 10px;
}

.captcha-btn,
.sms-btn {
  height: 44px;
  background: #f3f4f6;
  color: #374151;
}

.captcha-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.sms-btn:disabled,
.primary-btn:disabled {
  opacity: 0.62;
  cursor: not-allowed;
}

.primary-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 46px;
  background: #f97316;
  color: #fff;
  text-decoration: none;
}

.ghost-btn {
  height: 42px;
  background: transparent;
  color: #6b7280;
}

.field-hint {
  margin: -4px 0 0;
  color: #6b7280;
  font-size: 12px;
  line-height: 1.6;
}

.tenant-ready {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.tenant-badge {
  color: #111827;
  border-color: #e5e7eb;
  background: #f9fafb;
  text-align: center;
}

.message {
  margin: 18px 0 0;
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.5;
  background: #f3f4f6;
  color: #374151;
}

.message.success {
  background: #ecfdf5;
  color: #047857;
}

.message.error {
  background: #fef2f2;
  color: #b91c1c;
}

@media (max-width: 860px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 42vh;
    padding: 42px 24px;
  }

  .auth-panel {
    min-height: auto;
    padding: 32px 22px 48px;
  }

  h1 {
    font-size: 38px;
  }
}
</style>
