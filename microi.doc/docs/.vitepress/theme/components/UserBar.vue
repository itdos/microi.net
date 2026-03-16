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
            <a href="https://os.microi.net" target="_blank" rel="noopener noreferrer" class="menu-item primary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
              进入后台
            </a>
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

      <!-- 进入后台按钮（无论登录与否都显示） -->
      <a 
        href="https://os.microi.net" 
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
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const user = ref(null)
const showMenu = ref(false)

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
  user.value = null
  showMenu.value = false
}

function onLoginSuccess(e) {
  if (e.detail) {
    user.value = e.detail
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
</style>
