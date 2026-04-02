<template>
  <ClientOnly>
    <div class="user-bar">
      <!-- 未登录：显示登录按钮 -->
      <template v-if="!user">
        <a href="/login" class="login-link">
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
            <a :href="backendUrl" target="_blank" rel="noopener noreferrer" class="menu-item primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              进入后台
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

      <!-- 进入后台按钮（仅登录后显示） -->
      <a 
        v-if="user"
        :href="backendUrl" 
        target="_blank" 
        rel="noopener noreferrer" 
        class="console-btn"
        title="进入 Microi 后台管理系统"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <span>进入后台</span>
      </a>

      <!-- 设置密码弹窗 -->
      <Transition name="dropdown">
        <div v-if="showSetPwd" class="pwd-overlay" @click.self="showSetPwd = false">
          <div class="pwd-dialog">
            <h3>设置登录密码</h3>
            <p class="pwd-desc">设置密码后可以使用 账号+密码 方式登录</p>
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
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const API_BASE = 'https://api.microi.net'

const user = ref(null)
const showMenu = ref(false)
const showSetPwd = ref(false)
const newPwd = ref('')
const confirmPwd = ref('')
const isSettingPwd = ref(false)

const backendUrl = computed(() => {
  const storedPhone = typeof localStorage !== 'undefined' ? localStorage.getItem('microi_doc_phone') : null
  if (storedPhone) {
    return `https://microi.net/${storedPhone}`
  }
  return 'https://microi.net'
})

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
  localStorage.removeItem('microi_doc_phone')
  user.value = null
  showMenu.value = false
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
  showSetPwd.value = true
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

// Token以旧换新：如果有旧token，尝试刷新获取新token
async function refreshToken() {
  const token = localStorage.getItem('microi_doc_token')
  if (!token) return
  try {
    const resp = await fetch(API_BASE + '/api/SysUser/refreshToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ authorization: 'Bearer ' + token })
    })
    const result = await resp.json()
    if (result.Code === 1) {
      // 更新token
      const newToken = resp.headers.get('authorization') || ''
      if (newToken) {
        localStorage.setItem('microi_doc_token', newToken)
      }
      // 更新用户信息
      if (result.Data) {
        localStorage.setItem('microi_doc_user', JSON.stringify(result.Data))
        user.value = result.Data
      }
    }
  } catch {
    // 刷新失败不做处理，保留旧token
  }
}

let refreshTokenTimer = null

onMounted(() => {
  loadUser()
  // 以旧换新：页面加载时尝试刷新token
  refreshToken()
  // 定时刷新token（每60秒）
  refreshTokenTimer = setInterval(refreshToken, 60 * 1000)
  window.addEventListener('microi-login-success', onLoginSuccess)
  document.addEventListener('click', closeMenu)
})

onUnmounted(() => {
  if (refreshTokenTimer) {
    clearInterval(refreshTokenTimer)
    refreshTokenTimer = null
  }
  window.removeEventListener('microi-login-success', onLoginSuccess)
  document.removeEventListener('click', closeMenu)
})
</script>

<style scoped>
.user-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: 8px;
}

/* 登录链接 */
.login-link {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: rgba(200,200,220,0.85) !important;
  text-decoration: none;
  background: rgba(138,43,226,0.08);
  border: 1px solid rgba(138,43,226,0.15);
  transition: all 0.25s;
  white-space: nowrap;
}
.login-link:hover {
  background: rgba(138,43,226,0.15);
  border-color: rgba(138,43,226,0.3);
  color: #fff !important;
}

/* 用户信息 */
.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
  position: relative;
}
.user-info:hover {
  background: rgba(255,255,255,0.06);
}
.user-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid rgba(138,43,226,0.3);
}
.default-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(138,43,226,0.12);
  color: #b388ff;
}
.user-name {
  font-size: 13px;
  color: rgba(220,220,240,0.9) !important;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.arrow-icon {
  transition: transform 0.2s;
  color: rgba(180,180,200,0.5);
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
  background: rgba(20,20,32,0.95);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(138,43,226,0.15);
  border-radius: 12px;
  padding: 6px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.3);
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
  color: rgba(200,200,220,0.85);
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-decoration: none;
}
.menu-item:hover {
  background: rgba(138,43,226,0.12);
  color: #fff;
}
.menu-item.primary {
  color: #b388ff;
}
.menu-item.primary:hover {
  background: rgba(138,43,226,0.18);
  color: #d0a0ff;
}
.menu-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 4px 8px;
}

/* 进入后台按钮 */
.console-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 13px;
  color: #fff !important;
  text-decoration: none;
  background: linear-gradient(135deg, #8a2be2, #6a1fd0);
  transition: all 0.25s;
  white-space: nowrap;
}
.console-btn:hover {
  box-shadow: 0 0 18px rgba(138,43,226,0.35);
  transform: translateY(-1px);
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
  .console-btn span {
    display: none;
  }
  .console-btn {
    padding: 6px 8px;
  }
  .login-link span {
    display: none;
  }
  .login-link {
    padding: 6px 8px;
  }
}

/* 设置密码弹窗 */
.pwd-overlay {
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
.pwd-dialog {
  background: rgba(30,30,50,0.98);
  border: 1px solid rgba(138,43,226,0.2);
  border-radius: 14px;
  padding: 28px;
  width: 360px;
  max-width: 90vw;
}
.pwd-dialog h3 {
  font-size: 17px;
  color: rgba(240,240,255,0.95);
  margin-bottom: 6px;
}
.pwd-desc {
  font-size: 13px;
  color: rgba(180,180,200,0.6);
  margin-bottom: 18px;
}
.pwd-input {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(240,240,255,0.9);
  font-size: 14px;
  outline: none;
  margin-bottom: 10px;
  box-sizing: border-box;
  transition: border-color 0.2s;
}
.pwd-input:focus {
  border-color: rgba(138,43,226,0.4);
}
.pwd-actions {
  display: flex;
  gap: 10px;
  margin-top: 10px;
}
.pwd-cancel {
  flex: 1;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.1);
  background: transparent;
  color: rgba(200,200,220,0.8);
  cursor: pointer;
  font-size: 14px;
}
.pwd-submit {
  flex: 1;
  padding: 9px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #8a2be2, #6a1fb5);
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}
.pwd-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
