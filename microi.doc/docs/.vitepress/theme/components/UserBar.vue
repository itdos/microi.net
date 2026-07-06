<template>
  <ClientOnly>
    <div class="user-bar" :class="{ 'home-user-bar': isHomePage }">
      <!-- 未登录：显示登录按钮 -->
      <template v-if="!user">
        <a href="/login.html" class="login-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
            <polyline points="10 17 15 12 10 7"/>
            <line x1="15" y1="12" x2="3" y2="12"/>
          </svg>
          <span>登录</span>
        </a>
      </template>

      <!-- 已登录：显示用户信息 -->
      <template v-else>
        <div class="user-info" @click="showMenu = !showMenu">
          <img 
            v-if="user.HeadImgUrl" 
            :src="user.HeadImgUrl" 
            :alt="user.NickName || user.Account" 
            class="user-avatar"
          />
          <div v-else class="user-avatar default-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <span class="user-name">{{ user.NickName || user.Account || '用户' }}</span>
          <svg class="arrow-icon" :class="{ open: showMenu }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        <!-- 下拉菜单 -->
        <Transition name="dropdown">
          <div v-if="showMenu" class="dropdown-menu">
            <a href="/profile.html" class="menu-item" @click="showMenu = false">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              个人中心
            </a>
            <button class="menu-item" @click="openSetPwd">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              设置密码
            </button>
            <div class="menu-divider"></div>
            <button class="menu-item" @click="handleLogout">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
              退出登录
            </button>
          </div>
        </Transition>
      </template>

      <!-- 设置密码弹窗 -->
      <Teleport to="body">
        <Transition name="dropdown">
          <div v-if="showSetPwd" class="pwd-overlay" @click.self="showSetPwd = false">
            <div class="pwd-dialog" :style="pwdDialogStyle">
              <div class="pwd-dialog-head" @pointerdown="startPwdDrag">
                <div>
                  <h3>设置登录密码</h3>
                  <p class="pwd-desc">设置密码后可以使用 账号+密码 方式登录</p>
                </div>
                <button class="pwd-close" type="button" @click="showSetPwd = false">×</button>
              </div>
              <input
                v-model="newPwd"
                type="password"
                placeholder="请输入密码（至少6位）"
                maxlength="32"
                class="pwd-input"
              />
              <input
                v-model="confirmPwd"
                type="password"
                placeholder="请再次确认密码"
                maxlength="32"
                class="pwd-input"
                @keyup.enter="submitSetPwd"
              />
              <div class="pwd-actions">
                <button class="pwd-cancel" @click="showSetPwd = false">取消</button>
                <button class="pwd-submit" :disabled="isSettingPwd" @click="submitSetPwd">
                  {{ isSettingPwd ? '设置中...' : '确认设置' }}
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </div>
  </ClientOnly>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vitepress'

const API_BASE = import.meta.env.VITE_MICROI_API_BASE || getDefaultApiBase()
const route = useRoute()

const user = ref(null)
const showMenu = ref(false)
const showSetPwd = ref(false)
const newPwd = ref('')
const confirmPwd = ref('')
const isSettingPwd = ref(false)
const pwdDialogOffset = ref({ x: 0, y: 0 })
const pwdDragState = ref(null)

const isHomePage = computed(() => route.path === '/' || route.path === '/index.html')
const pwdDialogStyle = computed(() => ({
  transform: `translate(${pwdDialogOffset.value.x}px, ${pwdDialogOffset.value.y}px)`
}))

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
  return `${API_BASE}/apiengine/${key}?OsClient=iTdos`
}

function authHeaders() {
  const token = normalizeToken(localStorage.getItem('microi_doc_token'))
  return token ? {
    'authorization': 'Bearer ' + token,
    'Token': token
  } : {}
}

function loadUser() {
  try {
    const stored = localStorage.getItem('microi_doc_user')
    if (stored) {
      user.value = JSON.parse(stored)
    }
  } catch {
    user.value = null
  }
}

function handleLogout() {
  localStorage.removeItem('microi_doc_user')
  localStorage.removeItem('microi_doc_token')
  localStorage.removeItem('microi_doc_tenant')
  localStorage.removeItem('microi_doc_tenant_url')
  localStorage.removeItem('microi_doc_phone')
  user.value = null
  showMenu.value = false
  window.location.href = '/'
}

function onLoginSuccess(e) {
  if (e.detail) {
    user.value = e.detail
  }
}

function openSetPwd() {
  showMenu.value = false
  newPwd.value = ''
  confirmPwd.value = ''
  pwdDialogOffset.value = { x: 0, y: 0 }
  showSetPwd.value = true
}

function startPwdDrag(e) {
  if (e.button !== undefined && e.button !== 0) return
  pwdDragState.value = {
    startX: e.clientX,
    startY: e.clientY,
    baseX: pwdDialogOffset.value.x,
    baseY: pwdDialogOffset.value.y
  }
  window.addEventListener('pointermove', onPwdDrag)
  window.addEventListener('pointerup', stopPwdDrag)
}

function onPwdDrag(e) {
  if (!pwdDragState.value) return
  pwdDialogOffset.value = {
    x: pwdDragState.value.baseX + e.clientX - pwdDragState.value.startX,
    y: pwdDragState.value.baseY + e.clientY - pwdDragState.value.startY
  }
}

function stopPwdDrag() {
  pwdDragState.value = null
  window.removeEventListener('pointermove', onPwdDrag)
  window.removeEventListener('pointerup', stopPwdDrag)
}

async function submitSetPwd() {
  if (!newPwd.value || newPwd.value.length < 6) {
    alert('密码长度不能少于6位')
    return
  }
  if (newPwd.value !== confirmPwd.value) {
    alert('两次输入的密码不一致')
    return
  }
  isSettingPwd.value = true
  try {
    const token = normalizeToken(localStorage.getItem('microi_doc_token'))
    const resp = await fetch(API_BASE + '/apiengine/official_set_password?OsClient=iTdos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': 'Bearer ' + token,
        'Token': token
      },
      body: JSON.stringify({
        Pwd: newPwd.value,
        OsClient: 'iTdos'
      })
    })
    const result = await resp.json()
    if (result.Code === 1) {
      alert('密码设置成功！')
      showSetPwd.value = false
    } else {
      alert(result.Msg || '设置失败')
    }
  } catch {
    alert('网络错误，请重试')
  } finally {
    isSettingPwd.value = false
  }
}

function closeMenu(e) {
  if (!e.target.closest('.user-info') && !e.target.closest('.dropdown-menu')) {
    showMenu.value = false
  }
}

onMounted(() => {
  loadUser()
  window.addEventListener('microi-login-success', onLoginSuccess)
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  window.removeEventListener('microi-login-success', onLoginSuccess)
  document.removeEventListener('click', closeMenu)
  stopPwdDrag()
})
</script>

<style scoped>
.user-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 8px;
  position: relative;
}

/* 登录链接 */
.login-link {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--vp-c-text-1) !important;
  text-decoration: none;
  background: rgba(124, 58, 237, 0.08);
  border: 1px solid rgba(124, 58, 237, 0.2);
  transition: all 0.25s;
  white-space: nowrap;
}
.login-link:hover {
  background: linear-gradient(135deg, #8a2be2, #ff5a2e);
  border-color: transparent;
  color: #fff !important;
  box-shadow: 0 10px 24px rgba(255, 90, 46, 0.18);
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 5px 9px;
  border-radius: 8px;
  transition: all 0.2s;
  position: relative;
  color: var(--vp-c-text-1);
  background: rgba(124, 58, 237, 0.07);
  border: 1px solid rgba(124, 58, 237, 0.16);
}
.user-info:hover {
  background: rgba(124, 58, 237, 0.12);
  border-color: rgba(255, 90, 46, 0.26);
}
.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(255, 90, 46, 0.35);
}
.default-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 90, 46, 0.12);
  color: #ff5a2e;
}
.user-name {
  font-size: 13px;
  color: var(--vp-c-text-1) !important;
  font-weight: 700;
  max-width: 118px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrow-icon {
  transition: transform 0.2s;
  color: var(--vp-c-text-2);
}
.arrow-icon.open {
  transform: rotate(180deg);
}

/* 下拉菜单 */
.dropdown-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  background: var(--vp-c-bg-elv);
  backdrop-filter: blur(16px);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 18px 38px rgba(15,23,42,0.18);
  z-index: 100;
}
.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 14px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-1);
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}
.menu-item:hover {
  background: rgba(255, 90, 46, 0.1);
  color: #ff5a2e;
}
.menu-divider {
  height: 1px;
  background: var(--vp-c-divider);
  margin: 4px 8px;
}

/* 首页强制暗色导航，账号区需要独立提升对比度 */
:global(body:has(.VPHome):not(:has(.ai-login-page))) .user-bar {
  --microi-userbar-home-text: rgba(255, 255, 255, 0.94);
  --microi-userbar-home-muted: rgba(255, 255, 255, 0.72);
  --microi-userbar-home-border: rgba(148, 163, 255, 0.42);
  --microi-userbar-home-bg: rgba(18, 31, 67, 0.72);
}

.home-user-bar {
  --microi-userbar-home-text: rgba(255, 255, 255, 0.96);
  --microi-userbar-home-muted: rgba(255, 255, 255, 0.74);
  --microi-userbar-home-border: rgba(148, 163, 255, 0.46);
  --microi-userbar-home-bg: rgba(18, 31, 67, 0.78);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .login-link,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .user-info,
.home-user-bar .login-link,
.home-user-bar .user-info {
  color: var(--microi-userbar-home-text) !important;
  background: var(--microi-userbar-home-bg);
  border-color: var(--microi-userbar-home-border);
  box-shadow: 0 12px 32px rgba(16, 24, 64, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .login-link,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .user-info {
  color: var(--microi-userbar-home-text) !important;
  background: var(--microi-userbar-home-bg);
  border-color: var(--microi-userbar-home-border);
  box-shadow: 0 12px 32px rgba(16, 24, 64, 0.28), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(14px);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .user-info:hover,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .login-link:hover,
.home-user-bar .user-info:hover,
.home-user-bar .login-link:hover {
  background: rgba(35, 50, 104, 0.86);
  border-color: rgba(255, 90, 46, 0.58);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .user-name,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .arrow-icon,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .login-link span,
:global(body:has(.VPHome):not(:has(.ai-login-page))) .login-link svg,
.home-user-bar .user-name,
.home-user-bar .arrow-icon,
.home-user-bar .login-link span,
.home-user-bar .login-link svg {
  color: var(--microi-userbar-home-text) !important;
  opacity: 1;
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .default-avatar,
.home-user-bar .default-avatar {
  background: rgba(255, 90, 46, 0.16);
  color: #ff7a45;
  border-color: rgba(255, 90, 46, 0.5);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .dropdown-menu,
.home-user-bar .dropdown-menu {
  background: rgba(8, 16, 40, 0.96);
  border-color: rgba(148, 163, 255, 0.26);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.38);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .menu-item,
.home-user-bar .menu-item {
  color: rgba(255, 255, 255, 0.88);
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .menu-item:hover,
.home-user-bar .menu-item:hover {
  background: rgba(255, 90, 46, 0.16);
  color: #fff;
}

:global(body:has(.VPHome):not(:has(.ai-login-page))) .menu-divider,
.home-user-bar .menu-divider {
  background: rgba(255, 255, 255, 0.12);
}

/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}
.dropdown-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (max-width: 768px) {
  .user-name {
    display: none;
  }
  .login-link span {
    display: none;
  }
  .login-link {
    padding: 6px 8px;
  }
}

/* 设置密码弹窗 */
:global(.pwd-overlay) {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}
:global(.pwd-dialog) {
  width: min(520px, calc(100vw - 32px));
  max-height: min(82vh, 620px);
  overflow: auto;
  background:
    radial-gradient(circle at 100% 0, rgba(255, 90, 46, 0.16), transparent 32%),
    rgba(30,30,50,0.98);
  border: 1px solid rgba(138,43,226,0.24);
  border-radius: 18px;
  padding: 24px;
  box-shadow: 0 28px 80px rgba(0,0,0,0.46);
  will-change: transform;
}
:global(.pwd-dialog-head) {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  cursor: move;
  user-select: none;
}
:global(.pwd-dialog h3) {
  font-size: 17px;
  color: rgba(240,240,255,0.95);
  margin: 0 0 6px;
}
:global(.pwd-desc) {
  font-size: 13px;
  color: rgba(180,180,200,0.6);
  margin: 0;
}
:global(.pwd-close) {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 10px;
  background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.72);
  cursor: pointer;
  font-size: 20px;
  line-height: 1;
}
:global(.pwd-input) {
  width: 100%;
  height: 46px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(240,240,255,0.9);
  font-size: 14px;
  outline: none;
  margin-bottom: 10px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
:global(.pwd-input:focus) {
  border-color: rgba(138,43,226,0.4);
}
:global(.pwd-actions) {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
:global(.pwd-cancel) {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(200,200,220,0.8);
  cursor: pointer;
  font-size: 14px;
}
:global(.pwd-submit) {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #8a2be2, #6a1fb5);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
:global(.pwd-submit:disabled) {
  opacity: 0.5;
  cursor: not-allowed;
}

.profile-dialog {
  width: 480px;
  max-width: 92vw;
  max-height: 82vh;
  overflow: auto;
  padding: 26px;
  border: 1px solid rgba(138,43,226,0.22);
  border-radius: 16px;
  background: rgba(26,26,44,0.98);
  box-shadow: 0 24px 60px rgba(0,0,0,0.42);
}

.profile-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.profile-head h3 {
  margin: 0 0 6px;
  color: rgba(245,245,255,0.96);
  font-size: 18px;
}

.profile-head p,
.profile-note,
.profile-loading,
.empty-tenant p {
  margin: 0;
  color: rgba(205,205,226,0.68);
  font-size: 13px;
  line-height: 1.6;
}

.profile-close {
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: rgba(240,240,255,0.82);
  cursor: pointer;
  font-size: 22px;
  line-height: 1;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}

.profile-stats div {
  padding: 14px 12px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  background: rgba(255,255,255,0.045);
}

.profile-stats strong {
  display: block;
  color: #fff;
  font-size: 20px;
  margin-bottom: 4px;
}

.profile-stats span {
  color: rgba(205,205,226,0.62);
  font-size: 12px;
}

.profile-error {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid rgba(239,68,68,0.32);
  border-radius: 10px;
  background: rgba(239,68,68,0.1);
  color: #fca5a5;
  font-size: 13px;
}

.tenant-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.tenant-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 12px;
  background: rgba(255,255,255,0.045);
  color: inherit;
  text-decoration: none;
  transition: all 0.2s;
}

.tenant-item:hover {
  border-color: rgba(0,191,255,0.28);
  background: rgba(0,191,255,0.08);
}

.tenant-item strong {
  display: block;
  color: rgba(245,245,255,0.94);
  font-size: 14px;
}

.tenant-item small {
  display: block;
  max-width: 300px;
  overflow: hidden;
  color: rgba(205,205,226,0.58);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tenant-item em {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(34,197,94,0.14);
  color: #86efac;
  font-size: 12px;
  font-style: normal;
}

.empty-tenant {
  padding: 16px;
  border: 1px dashed rgba(138,43,226,0.28);
  border-radius: 12px;
  background: rgba(138,43,226,0.06);
  text-align: center;
}

.create-tenant-link {
  display: inline-flex;
  margin-top: 12px;
  padding: 9px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, #8a2be2, #00bfff);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
}

.profile-note {
  margin-top: 14px;
}
</style>

<style>
/* Teleport 到 body 的弹窗不能依赖 scoped 样式，必须用全局样式保证居中和可拖动。 */
.pwd-overlay {
  position: fixed !important;
  inset: 0 !important;
  width: 100vw !important;
  height: 100dvh !important;
  z-index: 10000 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: rgba(0, 0, 0, 0.5) !important;
  backdrop-filter: blur(6px);
}

.pwd-dialog {
  width: min(520px, calc(100vw - 32px)) !important;
  max-height: min(82vh, 620px);
  overflow: auto;
  padding: 24px;
  border: 1px solid rgba(138, 43, 226, 0.24);
  border-radius: 18px;
  background:
    radial-gradient(circle at 100% 0, rgba(255, 90, 46, 0.16), transparent 32%),
    rgba(30, 30, 50, 0.98);
  box-shadow: 0 28px 80px rgba(0, 0, 0, 0.46);
  will-change: transform;
}

.pwd-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
  cursor: move;
  user-select: none;
}

.pwd-dialog h3 {
  margin: 0 0 6px;
  color: rgba(240, 240, 255, 0.95);
  font-size: 17px;
}

.pwd-desc {
  margin: 0;
  color: rgba(180, 180, 200, 0.6);
  font-size: 13px;
}

.pwd-close {
  width: 32px;
  height: 32px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.72);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}

.pwd-input {
  width: 100%;
  height: 46px;
  box-sizing: border-box;
  margin-bottom: 10px;
  padding: 0 14px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  outline: none;
  background: rgba(255, 255, 255, 0.05);
  color: rgba(240, 240, 255, 0.9);
  font-size: 14px;
  transition: border-color 0.2s;
}

.pwd-input:focus {
  border-color: rgba(138, 43, 226, 0.4);
}

.pwd-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.pwd-cancel,
.pwd-submit {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  font-size: 14px;
  cursor: pointer;
}

.pwd-cancel {
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(200, 200, 220, 0.8);
}

.pwd-submit {
  border: 0;
  background: linear-gradient(135deg, #8a2be2, #6a1fb5);
  color: #fff;
  font-weight: 500;
}

.pwd-submit:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
