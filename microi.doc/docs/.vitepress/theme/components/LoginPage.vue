<template>
  <div class="ai-login-page">
    <!-- 粒子背景 -->
    <canvas ref="particleCanvas" class="particle-bg"></canvas>
    
    <!-- 神经网络线条背景 -->
    <div class="neural-grid">
      <div class="grid-line" v-for="i in 20" :key="'h'+i" :style="{ top: (i * 5) + '%', animationDelay: (i * 0.1) + 's' }"></div>
      <div class="grid-line vertical" v-for="i in 20" :key="'v'+i" :style="{ left: (i * 5) + '%', animationDelay: (i * 0.15) + 's' }"></div>
    </div>

    <!-- AI光效装饰 -->
    <div class="ai-orbs">
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>
    </div>

    <!-- 主内容区 -->
    <div class="login-container">
      <!-- 左侧品牌区 -->
      <div class="brand-section">
        <div class="brand-content">
          <div class="ai-brain-icon">
            <svg viewBox="0 0 120 120" class="brain-svg">
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
              <!-- AI芯片图标 -->
              <rect x="40" y="40" width="40" height="40" rx="8" fill="none" stroke="url(#brainGrad)" stroke-width="2" />
              <circle cx="52" cy="52" r="3" fill="url(#brainGrad)" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle cx="68" cy="52" r="3" fill="url(#brainGrad)" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="0.3s" repeatCount="indefinite" />
              </circle>
              <circle cx="52" cy="68" r="3" fill="url(#brainGrad)" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="0.6s" repeatCount="indefinite" />
              </circle>
              <circle cx="68" cy="68" r="3" fill="url(#brainGrad)" opacity="0.8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="0.9s" repeatCount="indefinite" />
              </circle>
              <!-- 连接线 -->
              <line x1="40" y1="52" x2="25" y2="45" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="40" y1="68" x2="25" y2="75" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="80" y1="52" x2="95" y2="45" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="80" y1="68" x2="95" y2="75" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="52" y1="40" x2="45" y2="25" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="68" y1="40" x2="75" y2="25" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="52" y1="80" x2="45" y2="95" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <line x1="68" y1="80" x2="75" y2="95" stroke="url(#brainGrad)" stroke-width="1" opacity="0.4" />
              <!-- 外围节点 -->
              <circle cx="25" cy="45" r="2" fill="#8a2be2" opacity="0.6"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" repeatCount="indefinite" /></circle>
              <circle cx="25" cy="75" r="2" fill="#00bfff" opacity="0.6"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="0.5s" repeatCount="indefinite" /></circle>
              <circle cx="95" cy="45" r="2" fill="#ff0080" opacity="0.6"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="1s" repeatCount="indefinite" /></circle>
              <circle cx="95" cy="75" r="2" fill="#8a2be2" opacity="0.6"><animate attributeName="opacity" values="0.3;0.8;0.3" dur="3s" begin="1.5s" repeatCount="indefinite" /></circle>
            </svg>
          </div>
          <h1 class="brand-title">
            Micro<span class="brand-i">i</span>吾码
          </h1>
          <p class="brand-subtitle">开源 AI 低代码平台</p>
          <div class="brand-features">
            <div class="feature-item" v-for="(feat, idx) in brandFeatures" :key="idx">
              <span class="feature-dot"></span>
              <span class="feature-text">{{ feat }}</span>
            </div>
          </div>
          <a href="/" class="back-home-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            返回首页
          </a>
        </div>
      </div>

      <!-- 右侧登录区 -->
      <div class="login-section">
        <div class="login-card">
          <!-- 卡片顶部装饰 -->
          <div class="card-top-glow"></div>
          
          <div class="login-header">
            <h2 class="login-title">{{ loginMode === 'wechat' ? '微信扫码登录' : '手机号登录' }}</h2>
            <p class="login-desc">{{ loginMode === 'wechat' ? '使用微信扫描下方二维码' : (phoneLoginType === 'sms' ? '输入手机号，获取验证码快捷登录' : '使用手机号和密码登录') }}</p>
          </div>

          <!-- 登录模式切换 -->
          <div class="mode-switcher">
            <button 
              class="mode-btn" 
              :class="{ active: loginMode === 'phone' }"
              @click="loginMode = 'phone'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                <line x1="12" y1="18" x2="12.01" y2="18"/>
              </svg>
              手机号登录
            </button>
            <button 
              class="mode-btn" 
              :class="{ active: loginMode === 'wechat' }"
              @click="loginMode = 'wechat'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1 .178-.555c1.529-1.185 2.481-2.806 2.481-4.634 0-3.548-3.514-6.233-7.041-6.106zm-2.428 3.701c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982zm4.856 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"/>
              </svg>
              微信扫码
            </button>
          </div>

          <!-- 手机号登录表单 -->
          <div v-show="loginMode === 'phone'" class="phone-login-form">
            <!-- 手机号输入 -->
            <div class="input-group">
              <div class="input-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                  <line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              </div>
              <input 
                v-model="phone" 
                type="tel" 
                placeholder="请输入手机号" 
                maxlength="11"
                class="login-input"
                @keyup.enter="handleLogin"
              />
            </div>

            <!-- 验证码登录模式 -->
            <template v-if="phoneLoginType === 'sms'">
              <!-- 图形验证码 -->
              <div class="input-group captcha-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input 
                  v-model="captchaValue" 
                  type="text" 
                  placeholder="图形验证码" 
                  maxlength="6"
                  class="login-input captcha-input"
                  @keyup.enter="handleLogin"
                />
                <div class="captcha-img-wrapper" @click="refreshCaptcha">
                  <img 
                    v-if="captchaImgSrc" 
                    :src="captchaImgSrc" 
                    alt="验证码" 
                    class="captcha-img"
                    title="点击刷新验证码"
                  />
                  <div v-else class="captcha-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </div>
              </div>

              <!-- 短信验证码 -->
              <div class="input-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
                <input 
                  v-model="smsCode" 
                  type="text" 
                  placeholder="短信验证码" 
                  maxlength="6"
                  class="login-input sms-input"
                  @keyup.enter="handleLogin"
                />
                <button 
                  class="sms-btn" 
                  :disabled="smsCooldown > 0 || !phone"
                  @click="sendSmsCode"
                >
                  {{ smsCooldown > 0 ? smsCooldown + 's' : '获取验证码' }}
                </button>
              </div>
            </template>

            <!-- 密码登录模式 -->
            <template v-else>
              <div class="input-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input 
                  v-model="password" 
                  type="password" 
                  placeholder="请输入登录密码" 
                  maxlength="32"
                  class="login-input"
                  @keyup.enter="handleLogin"
                />
              </div>

              <!-- 图形验证码（密码登录模式） -->
              <div class="input-group captcha-group">
                <div class="input-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input 
                  v-model="pwdCaptchaValue" 
                  type="text" 
                  placeholder="图形验证码" 
                  maxlength="6"
                  class="login-input captcha-input"
                  @keyup.enter="handleLogin"
                />
                <div class="captcha-img-wrapper" @click="refreshPwdCaptcha">
                  <img 
                    v-if="pwdCaptchaImgSrc" 
                    :src="pwdCaptchaImgSrc" 
                    alt="验证码" 
                    class="captcha-img"
                    title="点击刷新验证码"
                  />
                  <div v-else class="captcha-loading">
                    <div class="loading-spinner"></div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 切换登录方式 -->
            <div class="login-type-switch">
              <button class="switch-btn" @click="togglePhoneLoginType">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="17 1 21 5 17 9"/>
                  <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                  <polyline points="7 23 3 19 7 15"/>
                  <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                </svg>
                {{ phoneLoginType === 'sms' ? '使用密码登录' : '使用验证码登录' }}
              </button>
            </div>

            <!-- 登录按钮 -->
            <button 
              class="login-btn" 
              :class="{ loading: isLogging }"
              :disabled="isLogging"
              @click="handleLogin"
            >
              <span v-if="isLogging" class="btn-loading">
                <svg class="spinner" viewBox="0 0 24 24" width="20" height="20">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="30 70" stroke-linecap="round">
                    <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/>
                  </circle>
                </svg>
                登录中...
              </span>
              <span v-else class="btn-text">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                  <polyline points="10 17 15 12 10 7"/>
                  <line x1="15" y1="12" x2="3" y2="12"/>
                </svg>
                {{ phoneLoginType === 'sms' ? '登录 / 注册' : '登录' }}
              </span>
            </button>

            <p class="login-tip">{{ phoneLoginType === 'sms' ? '未注册的手机号将自动创建账户' : '仅限已注册用户，请先通过验证码登录注册' }}</p>
          </div>

          <!-- 微信扫码区域 -->
          <div v-show="loginMode === 'wechat'" class="wechat-login">
            <div class="qr-container">
              <div class="qr-frame">
                <div class="qr-corner tl"></div>
                <div class="qr-corner tr"></div>
                <div class="qr-corner bl"></div>
                <div class="qr-corner br"></div>
                <div class="qr-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                    <rect x="3" y="3" width="7" height="7"/>
                    <rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/>
                    <rect x="14" y="14" width="3" height="3"/>
                    <rect x="18" y="14" width="3" height="3"/>
                    <rect x="14" y="18" width="3" height="3"/>
                    <rect x="18" y="18" width="3" height="3"/>
                  </svg>
                  <p>微信扫码登录</p>
                  <p class="qr-sub-tip">请使用微信扫一扫</p>
                </div>
                <!-- 扫码动画线 -->
                <div class="scan-line"></div>
              </div>
            </div>
            <p class="wechat-tip">打开 <strong>微信</strong> → 扫一扫，即可完成登录</p>
          </div>

          <!-- 协议 -->
          <div class="agreement">
            登录即表示同意
            <a href="javascript:void(0)">《用户协议》</a>
            和
            <a href="javascript:void(0)">《隐私政策》</a>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast 通知 -->
    <Transition name="toast-slide">
      <div v-if="toastMsg" class="toast-msg" :class="toastType">
        <svg v-if="toastType === 'success'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        {{ toastMsg }}
      </div>
    </Transition>

    <!-- 设置密码弹窗（新用户注册后） -->
    <Transition name="toast-slide">
      <div v-if="showSetPwdDialog" class="pwd-dialog-overlay" @click.self="skipSetPassword">
        <div class="pwd-dialog">
          <h3 class="pwd-dialog-title">设置登录密码</h3>
          <p class="pwd-dialog-desc">设置密码后可以使用 账号+密码 方式登录</p>
          <div class="input-group">
            <input
              v-model="newPwd"
              type="password"
              placeholder="请输入密码（至少6位）"
              maxlength="32"
              class="login-input"
            />
          </div>
          <div class="input-group" style="margin-top: 12px;">
            <input
              v-model="confirmPwd"
              type="password"
              placeholder="请再次确认密码"
              maxlength="32"
              class="login-input"
              @keyup.enter="handleSetPassword"
            />
          </div>
          <div class="pwd-dialog-actions">
            <button class="pwd-skip-btn" @click="skipSetPassword">暂时跳过</button>
            <button class="pwd-confirm-btn" :disabled="isSettingPwd" @click="handleSetPassword">
              {{ isSettingPwd ? '设置中...' : '确认设置' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const API_BASE = 'https://api.microi.net'

// 状态
const loginMode = ref('phone')
const phoneLoginType = ref('sms') // 'sms' 验证码登录 | 'pwd' 密码登录
const phone = ref('')
const captchaValue = ref('')
const smsCode = ref('')
const password = ref('')
const captchaImgSrc = ref('')
const captchaId = ref('')
const pwdCaptchaValue = ref('')
const pwdCaptchaImgSrc = ref('')
const pwdCaptchaId = ref('')
const smsCooldown = ref(0)
const isLogging = ref(false)
const toastMsg = ref('')
const toastType = ref('info')
const particleCanvas = ref(null)
const showSetPwdDialog = ref(false)
const newPwd = ref('')
const confirmPwd = ref('')
const isSettingPwd = ref(false)

let smsTimer = null
let animFrame = null

const brandFeatures = [
  'AI 引擎 · 智能数据分析与编程',
  'API 接口引擎 · 在线编写后端接口',
  '工作流引擎 · 可视化流程设计',
  '多数据库 · MySQL / SqlServer / Oracle',
  '分布式架构 · Docker / K8S / 微服务'
]

// Toast
function showToast(msg, type = 'info') {
  toastMsg.value = msg
  toastType.value = type
  setTimeout(() => { toastMsg.value = '' }, 3000)
}

// 切换手机号登录方式
function togglePhoneLoginType() {
  phoneLoginType.value = phoneLoginType.value === 'sms' ? 'pwd' : 'sms'
  if (phoneLoginType.value === 'pwd') {
    refreshPwdCaptcha()
  } else {
    refreshCaptcha()
  }
}

// 获取图形验证码（通用）
async function fetchCaptcha(target) {
  try {
    const resp = await fetch(API_BASE + '/api/Captcha/GetCaptcha?OsClient=MicroiDoc&t=' + Date.now(), {
      method: 'GET'
    })
    if (!resp.ok) throw new Error('Failed')
    const cid = resp.headers.get('captchaid')
    const blob = await resp.blob()
    const src = URL.createObjectURL(blob)
    if (target === 'pwd') {
      if (cid) pwdCaptchaId.value = cid
      pwdCaptchaImgSrc.value = src
    } else {
      if (cid) captchaId.value = cid
      captchaImgSrc.value = src
    }
  } catch {
    if (target === 'pwd') {
      pwdCaptchaImgSrc.value = ''
    } else {
      captchaImgSrc.value = ''
    }
  }
}

// 获取图形验证码（短信登录用）
async function refreshCaptcha() {
  await fetchCaptcha('sms')
}

// 获取图形验证码（密码登录用）
async function refreshPwdCaptcha() {
  await fetchCaptcha('pwd')
}

// 发送短信验证码（需先输入图形验证码）
async function sendSmsCode() {
  if (!phone.value || phone.value.length !== 11) {
    showToast('请输入正确的11位手机号', 'error')
    return
  }
  if (!captchaValue.value) {
    showToast('请先输入图形验证码', 'error')
    return
  }
  try {
    const resp = await fetch(API_BASE + '/apiengine/send-sms-reg?OsClient=MicroiDoc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Phone: phone.value,
        _CaptchaId: captchaId.value,
        _CaptchaValue: captchaValue.value,
        OsClient: 'MicroiDoc'
      })
    })
    const result = await resp.json()
    if (result.Code === 1) {
      showToast('验证码已发送', 'success')
      smsCooldown.value = 60
      smsTimer = setInterval(() => {
        smsCooldown.value--
        if (smsCooldown.value <= 0) {
          clearInterval(smsTimer)
          smsTimer = null
        }
      }, 1000)
    } else {
      showToast(result.Msg || '发送失败，请重试', 'error')
      refreshCaptcha()
    }
  } catch {
    showToast('网络错误，请重试', 'error')
  }
}

// 手机号登录（验证码/密码）
async function handleLogin() {
  if (isLogging.value) return
  if (!phone.value || phone.value.length !== 11) {
    showToast('请输入正确的11位手机号', 'error')
    return
  }
  
  if (phoneLoginType.value === 'sms') {
    // 验证码登录
    if (!smsCode.value) {
      showToast('请输入短信验证码', 'error')
      return
    }
    isLogging.value = true
    try {
      const resp = await fetch(API_BASE + '/api/SysUser/SmsLogin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Phone: phone.value,
          _CaptchaValue: smsCode.value,
          OsClient: 'MicroiDoc'
        })
      })
      const result = await resp.json()
      if (result.Code === 1) {
        handleLoginSuccess(resp, result)
      } else {
        showToast(result.Msg || '登录失败，请重试', 'error')
        refreshCaptcha()
      }
    } catch {
      showToast('网络错误，请重试', 'error')
    } finally {
      isLogging.value = false
    }
  } else {
    // 密码登录
    if (!password.value) {
      showToast('请输入登录密码', 'error')
      return
    }
    if (!pwdCaptchaValue.value) {
      showToast('请输入图形验证码', 'error')
      return
    }
    isLogging.value = true
    try {
      const resp = await fetch(API_BASE + '/api/SysUser/Login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Account: phone.value,
          Pwd: password.value,
          OsClient: 'MicroiDoc',
          _CaptchaId: pwdCaptchaId.value,
          _CaptchaValue: pwdCaptchaValue.value
        })
      })
      const result = await resp.json()
      if (result.Code === 1) {
        handleLoginSuccess(resp, result)
      } else {
        showToast(result.Msg || '账号或密码错误', 'error')
        refreshPwdCaptcha()
        pwdCaptchaValue.value = ''
      }
    } catch {
      showToast('网络错误，请重试', 'error')
    } finally {
      isLogging.value = false
    }
  }
}

// 登录成功统一处理
function handleLoginSuccess(resp, result) {
  const authToken = resp.headers.get('authorization') || ''
  const userData = result.Data || {}
  localStorage.setItem('microi_doc_user', JSON.stringify(userData))
  localStorage.setItem('microi_doc_token', authToken)
  // 保存手机号（用于进入后台地址拼接）
  localStorage.setItem('microi_doc_phone', phone.value)
  const tenantOsClient = result.DataAppend?.TenantOsClient
  if (tenantOsClient) {
    localStorage.setItem('microi_doc_tenant', tenantOsClient)
  }
  const isNewUser = result.DataAppend?.IsNewUser
  window.dispatchEvent(new CustomEvent('microi-login-success', { detail: userData }))
  if (isNewUser) {
    showToast('注册成功！建议设置登录密码', 'success')
    showSetPwdDialog.value = true
  } else {
    showToast('登录成功！', 'success')
    setTimeout(() => {
      window.location.href = '/'
    }, 800)
  }
}

// 设置密码
async function handleSetPassword() {
  if (!newPwd.value || newPwd.value.length < 6) {
    showToast('密码长度不能少于6位', 'error')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    showToast('两次输入的密码不一致', 'error')
    return
  }
  isSettingPwd.value = true
  try {
    const token = localStorage.getItem('microi_doc_token')
    const resp = await fetch(API_BASE + '/api/SysUser/SetPassword', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': 'Bearer ' + token
      },
      body: JSON.stringify({
        Pwd: newPwd.value,
        OsClient: 'MicroiDoc'
      })
    })
    const result = await resp.json()
    if (result.Code === 1) {
      showToast('密码设置成功！', 'success')
      showSetPwdDialog.value = false
      setTimeout(() => {
        window.location.href = '/'
      }, 800)
    } else {
      showToast(result.Msg || '设置失败', 'error')
    }
  } catch {
    showToast('网络错误，请重试', 'error')
  } finally {
    isSettingPwd.value = false
  }
}

function skipSetPassword() {
  showSetPwdDialog.value = false
  setTimeout(() => {
    window.location.href = '/'
  }, 300)
}

// 粒子动画
function initParticles() {
  const canvas = particleCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  let w, h
  const particles = []
  const count = 60

  function resize() {
    w = canvas.width = canvas.offsetWidth
    h = canvas.height = canvas.offsetHeight
  }

  function createParticle() {
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      r: Math.random() * 2 + 0.5,
      color: ['rgba(138,43,226,', 'rgba(0,191,255,', 'rgba(255,0,128,'][Math.floor(Math.random() * 3)]
    }
  }

  resize()
  window.addEventListener('resize', resize)
  for (let i = 0; i < count; i++) particles.push(createParticle())

  function draw() {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i]
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > w) p.vx *= -1
      if (p.y < 0 || p.y > h) p.vy *= -1
      
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = p.color + '0.6)'
      ctx.fill()

      // 连线
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j]
        const dx = p.x - p2.x
        const dy = p.y - p2.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 120) {
          ctx.beginPath()
          ctx.moveTo(p.x, p.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = p.color + (0.15 * (1 - dist / 120)) + ')'
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }
    animFrame = requestAnimationFrame(draw)
  }
  draw()
}

onMounted(() => {
  nextTick(() => {
    initParticles()
    refreshCaptcha()
    refreshPwdCaptcha()
  })
})

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame)
  if (smsTimer) clearInterval(smsTimer)
})
</script>

<style scoped>
.ai-login-page {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background: linear-gradient(135deg, #0a0a14 0%, #0d0d1a 40%, #1a0a2e 70%, #0a0a14 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans CJK SC', sans-serif;
}

/* 粒子画布 */
.particle-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 1;
}

/* 神经网络网格 */
.neural-grid {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  opacity: 0.04;
}
.grid-line {
  position: absolute;
  left: 0;
  width: 100%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(138,43,226,0.5), rgba(0,191,255,0.5), transparent);
  animation: gridPulse 4s ease-in-out infinite;
}
.grid-line.vertical {
  top: 0;
  width: 1px;
  height: 100%;
  background: linear-gradient(180deg, transparent, rgba(138,43,226,0.5), rgba(0,191,255,0.5), transparent);
}
@keyframes gridPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.8; }
}

/* AI光效球 */
.ai-orbs {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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
  background: radial-gradient(circle, rgba(138,43,226,0.3), transparent 70%);
  top: -10%;
  left: -5%;
  animation: orbFloat1 8s ease-in-out infinite;
}
.orb-2 {
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(0,191,255,0.25), transparent 70%);
  bottom: -10%;
  right: -5%;
  animation: orbFloat2 10s ease-in-out infinite;
}
.orb-3 {
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, rgba(255,0,128,0.15), transparent 70%);
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

/* 主容器 */
.login-container {
  position: relative;
  z-index: 10;
  display: flex;
  width: 900px;
  max-width: 95vw;
  min-height: 560px;
  border-radius: 24px;
  overflow: hidden;
  background: rgba(15, 15, 25, 0.6);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(138,43,226,0.15);
  box-shadow: 
    0 0 40px rgba(138,43,226,0.1),
    0 0 80px rgba(0,191,255,0.05),
    0 25px 50px rgba(0,0,0,0.3);
}

/* 左侧品牌区 */
.brand-section {
  flex: 1;
  padding: 48px 40px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  position: relative;
  background: linear-gradient(135deg, rgba(138,43,226,0.08), rgba(0,191,255,0.05));
  border-right: 1px solid rgba(255,255,255,0.05);
}
.brand-content {
  position: relative;
  z-index: 2;
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
  letter-spacing: -0.5px;
}
.brand-i {
  color: #ff3333;
  -webkit-text-fill-color: #ff3333;
}
.brand-subtitle {
  font-size: 16px;
  color: rgba(200,200,220,0.8);
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
  flex-shrink: 0;
}
.feature-text {
  font-size: 13px;
  color: rgba(180,180,200,0.9);
}
.back-home-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 36px;
  font-size: 13px;
  color: rgba(138,43,226,0.8);
  text-decoration: none;
  transition: color 0.2s;
}
.back-home-link:hover {
  color: #8a2be2;
}

/* 右侧登录区 */
.login-section {
  flex: 1;
  padding: 40px;
  display: flex;
  align-items: center;
}
.login-card {
  width: 100%;
  position: relative;
}
.card-top-glow {
  position: absolute;
  top: -1px;
  left: 20%;
  right: 20%;
  height: 2px;
  background: linear-gradient(90deg, transparent, #8a2be2, #00bfff, transparent);
  border-radius: 2px;
}

/* 登录头部 */
.login-header {
  margin-bottom: 28px;
  text-align: center;
}
.login-title {
  font-size: 22px;
  font-weight: 600;
  color: #fff;
  margin: 0 0 6px;
}
.login-desc {
  font-size: 13px;
  color: rgba(160,160,180,0.7);
  margin: 0;
}

/* 模式切换 */
.mode-switcher {
  display: flex;
  gap: 0;
  margin-bottom: 28px;
  background: rgba(255,255,255,0.04);
  border-radius: 12px;
  padding: 4px;
  border: 1px solid rgba(255,255,255,0.06);
}
.mode-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 16px;
  border: none;
  background: transparent;
  color: rgba(180,180,200,0.7);
  font-size: 13px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.3s;
}
.mode-btn.active {
  background: linear-gradient(135deg, rgba(138,43,226,0.2), rgba(0,191,255,0.15));
  color: #fff;
  box-shadow: 0 0 20px rgba(138,43,226,0.15);
}
.mode-btn:hover:not(.active) {
  color: rgba(220,220,240,0.9);
}

/* 输入框组 */
.input-group {
  position: relative;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  transition: all 0.3s;
}
.input-group:focus-within {
  border-color: rgba(138,43,226,0.4);
  box-shadow: 0 0 20px rgba(138,43,226,0.1);
  background: rgba(255,255,255,0.06);
}
.input-icon {
  padding: 0 4px 0 14px;
  color: rgba(138,43,226,0.6);
  display: flex;
  flex-shrink: 0;
}
.login-input {
  flex: 1;
  padding: 13px 14px;
  background: transparent;
  border: none;
  outline: none;
  color: #e0e0e0;
  font-size: 14px;
  min-width: 0;
}
.login-input::placeholder {
  color: rgba(140,140,160,0.5);
}

/* 图形验证码 */
.captcha-group {
  flex-wrap: nowrap;
}
.captcha-input {
  flex: 1;
}
.captcha-img-wrapper {
  flex-shrink: 0;
  width: 110px;
  height: 38px;
  margin-right: 6px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}
.captcha-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.captcha-loading {
  display: flex;
  align-items: center;
  justify-content: center;
}
.loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(138,43,226,0.3);
  border-top-color: #8a2be2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 短信验证码按钮 */
.sms-input {
  flex: 1;
}
.sms-btn {
  flex-shrink: 0;
  padding: 8px 14px;
  margin-right: 6px;
  border: 1px solid rgba(138,43,226,0.3);
  background: rgba(138,43,226,0.1);
  color: #b388ff;
  font-size: 12px;
  border-radius: 8px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.3s;
}
.sms-btn:hover:not(:disabled) {
  background: rgba(138,43,226,0.2);
  border-color: rgba(138,43,226,0.5);
}
.sms-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* 切换登录方式 */
.login-type-switch {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
  margin-top: -4px;
}
.switch-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: none;
  background: transparent;
  color: rgba(138,43,226,0.75);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.2s;
}
.switch-btn:hover {
  color: #b388ff;
}

/* 登录按钮 */
.login-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #8a2be2, #6a1fd0);
  color: #fff;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 4px;
  position: relative;
  overflow: hidden;
}
.login-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
  transition: left 0.5s;
}
.login-btn:hover::before {
  left: 100%;
}
.login-btn:hover:not(:disabled) {
  box-shadow: 0 0 30px rgba(138,43,226,0.4);
  transform: translateY(-1px);
}
.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.btn-text, .btn-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.login-tip {
  text-align: center;
  font-size: 12px;
  color: rgba(140,140,160,0.5);
  margin: 14px 0 0;
}

/* 微信扫码 */
.wechat-login {
  text-align: center;
  padding: 10px 0;
}
.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}
.qr-frame {
  position: relative;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.03);
  border-radius: 12px;
  overflow: hidden;
}
.qr-corner {
  position: absolute;
  width: 20px;
  height: 20px;
  border-color: #8a2be2;
  border-style: solid;
  border-width: 0;
}
.qr-corner.tl { top: 0; left: 0; border-top-width: 3px; border-left-width: 3px; border-radius: 4px 0 0 0; }
.qr-corner.tr { top: 0; right: 0; border-top-width: 3px; border-right-width: 3px; border-radius: 0 4px 0 0; }
.qr-corner.bl { bottom: 0; left: 0; border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 4px; }
.qr-corner.br { bottom: 0; right: 0; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 4px 0; }
.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(160,160,180,0.6);
  font-size: 13px;
}
.qr-sub-tip {
  font-size: 11px;
  color: rgba(140,140,160,0.4);
  margin: 0;
}
.scan-line {
  position: absolute;
  left: 10px;
  right: 10px;
  height: 2px;
  background: linear-gradient(90deg, transparent, #8a2be2, #00bfff, transparent);
  animation: scanMove 2.5s ease-in-out infinite;
}
@keyframes scanMove {
  0%, 100% { top: 10px; opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 1; }
  50% { top: calc(100% - 10px); }
}
.wechat-tip {
  font-size: 13px;
  color: rgba(160,160,180,0.6);
  margin: 0;
}
.wechat-tip strong {
  color: #4caf50;
}

/* 协议 */
.agreement {
  text-align: center;
  font-size: 11px;
  color: rgba(140,140,160,0.4);
  margin-top: 24px;
}
.agreement a {
  color: rgba(138,43,226,0.7);
  text-decoration: none;
}
.agreement a:hover {
  color: #8a2be2;
}

/* Toast */
.toast-msg {
  position: fixed;
  top: 40px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 12px;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  z-index: 9999;
  backdrop-filter: blur(20px);
}
.toast-msg.success {
  background: rgba(76,175,80,0.15);
  color: #81c784;
  border: 1px solid rgba(76,175,80,0.3);
}
.toast-msg.error {
  background: rgba(244,67,54,0.15);
  color: #ef9a9a;
  border: 1px solid rgba(244,67,54,0.3);
}
.toast-msg.info {
  background: rgba(138,43,226,0.15);
  color: #b388ff;
  border: 1px solid rgba(138,43,226,0.3);
}
.toast-slide-enter-active,
.toast-slide-leave-active {
  transition: all 0.3s ease;
}
.toast-slide-enter-from {
  opacity: 0;
  transform: translate(-50%, -20px);
}
.toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}

/* 移动端适配 */
@media (max-width: 768px) {
  .login-container {
    flex-direction: column;
    min-height: auto;
    max-width: 440px;
    margin: 20px;
  }
  .brand-section {
    padding: 32px 28px 24px;
    border-right: none;
    border-bottom: 1px solid rgba(255,255,255,0.05);
  }
  .brand-features {
    display: none;
  }
  .ai-brain-icon {
    width: 56px;
    height: 56px;
    margin-bottom: 16px;
  }
  .brand-title {
    font-size: 24px;
  }
  .brand-subtitle {
    margin-bottom: 0;
  }
  .back-home-link {
    margin-top: 16px;
  }
  .login-section {
    padding: 28px;
  }
}

/* 设置密码弹窗 */
.pwd-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
.pwd-dialog {
  background: rgba(20,20,35,0.95);
  border: 1px solid rgba(138,43,226,0.2);
  border-radius: 16px;
  padding: 32px;
  width: 380px;
  max-width: 90vw;
}
.pwd-dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: rgba(240,240,255,0.95);
  margin-bottom: 8px;
}
.pwd-dialog-desc {
  font-size: 13px;
  color: rgba(180,180,200,0.7);
  margin-bottom: 20px;
}
.pwd-dialog-actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}
.pwd-skip-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(200,200,220,0.8);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
}
.pwd-skip-btn:hover {
  background: rgba(255,255,255,0.1);
}
.pwd-confirm-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(135deg, #8a2be2, #6a1fb5);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}
.pwd-confirm-btn:hover {
  opacity: 0.9;
}
.pwd-confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
