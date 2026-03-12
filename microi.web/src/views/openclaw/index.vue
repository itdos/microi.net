<template>
  <div class="oc-layout">
    <!-- 侧边栏 -->
    <aside class="oc-sidebar">
      <div class="oc-logo">
        <div class="oc-logo-icon">🦞</div>
        <span class="oc-logo-text">OpenClaw</span>
        <span class="oc-logo-version">v1.0</span>
      </div>
      <nav class="oc-nav">
        <div
          v-for="item in menuList"
          :key="item.path"
          :class="['oc-nav-item', { active: currentPath === item.path }]"
          @click="navigate(item.path)"
        >
          <el-icon :size="18"><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
          <span v-if="item.badge" class="oc-badge">{{ item.badge }}</span>
        </div>
      </nav>
      <div class="oc-sidebar-footer">
        <div class="oc-node-status">
          <span class="oc-dot" :class="onlineNodes > 0 ? 'online' : 'offline'"></span>
          <span>{{ onlineNodes }} 节点在线</span>
        </div>
      </div>
    </aside>
    <!-- 主内容区 -->
    <main class="oc-main">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { Monitor, Document, Connection, Setting, DataAnalysis, ChatDotSquare, User, Cpu } from '@element-plus/icons-vue'
import { getDashboardStats } from './api'

const router = useRouter()
const route = useRoute()
const currentPath = computed(() => route.path)
const onlineNodes = ref(0)

const menuList = ref([
  { path: '/openclaw/dashboard', title: '仪表盘', icon: DataAnalysis, badge: '' },
  { path: '/openclaw/tasks', title: '任务中心', icon: Monitor, badge: '' },
  { path: '/openclaw/articles', title: '文章管理', icon: Document, badge: '' },
  { path: '/openclaw/accounts', title: '平台账号', icon: User, badge: '' },
  { path: '/openclaw/interact', title: '互评管理', icon: ChatDotSquare, badge: '' },
  { path: '/openclaw/nodes', title: '节点管理', icon: Cpu, badge: '' },
  { path: '/openclaw/llm', title: 'AI模型', icon: Connection, badge: '' },
  { path: '/openclaw/settings', title: '系统设置', icon: Setting, badge: '' },
])

function navigate(path) {
  router.push(path)
}

onMounted(async () => {
  try {
    const res = await getDashboardStats()
    if (res.Code === 1) {
      onlineNodes.value = res.Data?.nodes?.online || 0
    }
  } catch (e) { /* ignore */ }
})
</script>

<style scoped>
.oc-layout {
  display: flex;
  height: 100vh;
  background: #0a0a0f;
  color: #e0e0e0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  overflow: hidden;
}

/* ---- 侧边栏 ---- */
.oc-sidebar {
  width: 220px;
  min-width: 220px;
  background: linear-gradient(180deg, #0f1117 0%, #0a0c12 100%);
  border-right: 1px solid rgba(255,255,255,0.06);
  display: flex;
  flex-direction: column;
  z-index: 10;
}
.oc-logo {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.oc-logo-icon {
  font-size: 26px;
  filter: drop-shadow(0 0 8px rgba(239,68,68,0.5));
}
.oc-logo-text {
  font-size: 18px;
  font-weight: 700;
  background: linear-gradient(135deg, #ef4444, #f97316);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}
.oc-logo-version {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(239,68,68,0.15);
  color: #ef4444;
  font-weight: 600;
}

.oc-nav {
  flex: 1;
  padding: 12px 8px;
  overflow-y: auto;
}
.oc-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13.5px;
  color: #8b8fa3;
  margin-bottom: 2px;
  position: relative;
}
.oc-nav-item:hover {
  background: rgba(255,255,255,0.04);
  color: #c0c4d6;
}
.oc-nav-item.active {
  background: linear-gradient(135deg, rgba(239,68,68,0.12), rgba(249,115,22,0.08));
  color: #f97316;
  font-weight: 600;
  box-shadow: inset 0 0 0 1px rgba(249,115,22,0.15);
}
.oc-badge {
  margin-left: auto;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 600;
}

.oc-sidebar-footer {
  padding: 14px 16px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.oc-node-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #6b7280;
}
.oc-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.oc-dot.online {
  background: #22c55e;
  box-shadow: 0 0 6px rgba(34,197,94,0.6);
  animation: pulse-green 2s infinite;
}
.oc-dot.offline {
  background: #6b7280;
}
@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ---- 主内容区 ---- */
.oc-main {
  flex: 1;
  overflow-y: auto;
  background: #0a0a0f;
  padding: 0;
}
.oc-main::-webkit-scrollbar {
  width: 6px;
}
.oc-main::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.08);
  border-radius: 3px;
}
.oc-main::-webkit-scrollbar-track {
  background: transparent;
}
</style>
