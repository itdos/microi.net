<template>
  <div class="oc-page oc-dashboard">
    <!-- 顶部标题 -->
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">🦞 仪表盘</h1>
        <p class="oc-subtitle">OpenClaw 全局态势感知</p>
      </div>
      <div class="oc-header-actions">
        <el-button class="oc-btn-glow" @click="refreshData" :loading="loading">
          <el-icon><Refresh /></el-icon> 刷新数据
        </el-button>
      </div>
    </div>

    <!-- 今日统计卡片 -->
    <div class="oc-stat-grid">
      <div v-for="item in statCards" :key="item.key" class="oc-stat-card" :style="{ '--accent': item.color }">
        <div class="oc-stat-icon">{{ item.icon }}</div>
        <div class="oc-stat-info">
          <div class="oc-stat-value">{{ item.value }}</div>
          <div class="oc-stat-label">{{ item.label }}</div>
        </div>
        <div class="oc-stat-glow"></div>
      </div>
    </div>

    <!-- 中间区域：节点状态 + 近期趋势 -->
    <div class="oc-row">
      <!-- 节点状态 -->
      <div class="oc-card" style="flex: 1;">
        <div class="oc-card-header">
          <span class="oc-card-title">🖥️ 节点状态</span>
          <span class="oc-card-extra">
            <span class="oc-dot online"></span> {{ nodeData.online }} 在线
            <span style="margin-left:12px" class="oc-dot offline"></span> {{ nodeData.offline }} 离线
          </span>
        </div>
        <div class="oc-node-grid">
          <div v-for="node in nodeData.list" :key="node.Id" class="oc-node-item">
            <div class="oc-node-header">
              <span class="oc-dot" :class="node.Status == 1 ? 'online' : 'offline'"></span>
              <span class="oc-node-name">{{ node.Name || node.IP }}</span>
              <span class="oc-node-os">{{ node.OSType }}</span>
            </div>
            <div class="oc-node-metrics">
              <div class="oc-metric">
                <span class="oc-metric-label">CPU</span>
                <el-progress :percentage="Number(node.CpuUsage) || 0" :stroke-width="4" :show-text="false"
                  :color="getUsageColor(node.CpuUsage)" />
                <span class="oc-metric-val">{{ node.CpuUsage }}%</span>
              </div>
              <div class="oc-metric">
                <span class="oc-metric-label">MEM</span>
                <el-progress :percentage="Number(node.MemoryUsage) || 0" :stroke-width="4" :show-text="false"
                  :color="getUsageColor(node.MemoryUsage)" />
                <span class="oc-metric-val">{{ node.MemoryUsage }}%</span>
              </div>
            </div>
            <div class="oc-node-footer">
              <span>v{{ node.ClawVersion || '-' }}</span>
              <span :class="node.EnvReady == 1 ? 'oc-tag-success' : 'oc-tag-warn'">
                {{ node.EnvReady == 1 ? '环境就绪' : '未就绪' }}
              </span>
            </div>
          </div>
          <div v-if="!nodeData.list || nodeData.list.length === 0" class="oc-empty-mini">
            暂无节点，请先在<b style="color:#f97316">节点管理</b>中添加
          </div>
        </div>
      </div>

      <!-- 7天趋势图 -->
      <div class="oc-card" style="flex: 1.5;">
        <div class="oc-card-header">
          <span class="oc-card-title">📈 近7天趋势</span>
        </div>
        <div ref="chartRef" style="width:100%;height:260px;"></div>
      </div>
    </div>

    <!-- 底部：最近任务 + 最近文章 -->
    <div class="oc-row">
      <div class="oc-card" style="flex:1">
        <div class="oc-card-header">
          <span class="oc-card-title">⚡ 最近任务</span>
        </div>
        <div class="oc-mini-table">
          <div v-for="task in recentTasks" :key="task.Id" class="oc-mini-row">
            <span :class="'oc-status-dot status-' + task.Status"></span>
            <span class="oc-mini-name">{{ task.TemplateName }}</span>
            <span class="oc-mini-tag">{{ task.TaskType }}</span>
            <span class="oc-mini-node">{{ task.NodeName }}</span>
            <span class="oc-mini-time">{{ formatTime(task.StartTime) }}</span>
          </div>
          <div v-if="!recentTasks.length" class="oc-empty-mini">暂无任务记录</div>
        </div>
      </div>
      <div class="oc-card" style="flex:1">
        <div class="oc-card-header">
          <span class="oc-card-title">📝 最近文章</span>
        </div>
        <div class="oc-mini-table">
          <div v-for="art in recentArticles" :key="art.Id" class="oc-mini-row">
            <span :class="'oc-status-dot status-' + art.Status"></span>
            <span class="oc-mini-name" style="flex:2">{{ art.Title }}</span>
            <span class="oc-mini-tag">{{ art.ArticleType }}</span>
            <span class="oc-mini-count">{{ art.WordCount }}字</span>
            <span class="oc-mini-time">{{ formatTime(art.CreateTime) }}</span>
          </div>
          <div v-if="!recentArticles.length" class="oc-empty-mini">暂无文章</div>
        </div>
      </div>
    </div>

    <!-- 平台账号概况 -->
    <div class="oc-card">
      <div class="oc-card-header">
        <span class="oc-card-title">🌐 平台账号概况</span>
      </div>
      <div class="oc-account-grid">
        <div v-for="acc in accounts" :key="acc.Id" class="oc-account-item">
          <div class="oc-account-avatar">
            <img v-if="acc.Avatar" :src="acc.Avatar" />
            <span v-else class="oc-account-letter">{{ (acc.PlatformName || acc.Platform || '?')[0] }}</span>
          </div>
          <div class="oc-account-info">
            <div class="oc-account-name">{{ acc.Name }}</div>
            <div class="oc-account-platform">{{ acc.PlatformName || acc.Platform }}</div>
          </div>
          <span :class="acc.LoginStatus == 1 ? 'oc-tag-success' : 'oc-tag-warn'">
            {{ acc.LoginStatus == 1 ? '已登录' : '未登录' }}
          </span>
        </div>
        <div v-if="!accounts.length" class="oc-empty-mini">暂无平台账号</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { Refresh } from '@element-plus/icons-vue'
import { getDashboardStats } from '../api'
import * as echarts from 'echarts'
import dayjs from 'dayjs'

const loading = ref(false)
const chartRef = ref(null)
let chartInstance = null

const statCards = ref([])
const nodeData = reactive({ total: 0, online: 0, offline: 0, list: [] })
const recentTasks = ref([])
const recentArticles = ref([])
const accounts = ref([])
const trendData = ref([])

function formatTime(t) {
  if (!t) return '-'
  return dayjs(t).format('MM-DD HH:mm')
}
function getUsageColor(val) {
  const v = Number(val) || 0
  if (v > 80) return '#ef4444'
  if (v > 50) return '#f59e0b'
  return '#22c55e'
}

function buildStatCards(today) {
  statCards.value = [
    { key: 'articles', icon: '📝', label: '今日生成文章', value: today.ArticleCount || 0, color: '#8b5cf6' },
    { key: 'publish', icon: '🚀', label: '今日发布成功', value: today.PublishCount || 0, color: '#22c55e' },
    { key: 'interact', icon: '💬', label: '今日互评', value: today.InteractCount || 0, color: '#3b82f6' },
    { key: 'crawl', icon: '🕷️', label: '今日爬取', value: today.CrawlCount || 0, color: '#f59e0b' },
    { key: 'task', icon: '⚡', label: '今日任务', value: today.TaskCount || 0, color: '#ef4444' },
    { key: 'views', icon: '👁️', label: '累计浏览', value: today.TotalViews || 0, color: '#06b6d4' },
  ]
}

function renderChart(data) {
  if (!chartRef.value) return
  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value, 'dark')
  }
  const dates = data.map(d => dayjs(d.StatDate).format('MM/DD'))
  chartInstance.setOption({
    backgroundColor: 'transparent',
    grid: { top: 30, right: 20, bottom: 30, left: 40 },
    tooltip: { trigger: 'axis', backgroundColor: '#1a1a2e', borderColor: '#333', textStyle: { color: '#e0e0e0' } },
    legend: { data: ['文章', '发布', '互评', '爬取'], textStyle: { color: '#8b8fa3', fontSize: 11 }, top: 0 },
    xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#333' } }, axisLabel: { color: '#8b8fa3' } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)' } }, axisLabel: { color: '#8b8fa3' } },
    series: [
      { name: '文章', type: 'line', smooth: true, data: data.map(d => d.ArticleCount), itemStyle: { color: '#8b5cf6' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.3)' }, { offset: 1, color: 'rgba(139,92,246,0)' }] } } },
      { name: '发布', type: 'line', smooth: true, data: data.map(d => d.PublishCount), itemStyle: { color: '#22c55e' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,197,94,0.3)' }, { offset: 1, color: 'rgba(34,197,94,0)' }] } } },
      { name: '互评', type: 'line', smooth: true, data: data.map(d => d.InteractCount), itemStyle: { color: '#3b82f6' } },
      { name: '爬取', type: 'bar', data: data.map(d => d.CrawlCount), itemStyle: { color: 'rgba(245,158,11,0.5)', borderRadius: [3, 3, 0, 0] } },
    ]
  })
}

async function refreshData() {
  loading.value = true
  try {
    const res = await getDashboardStats()
    if (res.Code === 1) {
      const d = res.Data
      buildStatCards(d.today || {})
      Object.assign(nodeData, d.nodes || { total: 0, online: 0, offline: 0, list: [] })
      recentTasks.value = d.recentTasks || []
      recentArticles.value = d.recentArticles || []
      accounts.value = d.accounts || []
      trendData.value = d.trend || []
      await nextTick()
      renderChart(trendData.value)
    }
  } catch (e) {
    console.error('[Dashboard]', e)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshData()
  window.addEventListener('resize', () => chartInstance?.resize())
})
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; letter-spacing: -0.5px; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); transition: all 0.3s; }
.oc-btn-glow:hover { box-shadow: 0 6px 25px rgba(239,68,68,0.5); transform: translateY(-1px); }

/* 统计卡片 */
.oc-stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 20px; }
.oc-stat-card { background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px 16px; display: flex; align-items: center; gap: 14px; position: relative; overflow: hidden; transition: all 0.3s; }
.oc-stat-card:hover { border-color: var(--accent, #f97316); box-shadow: 0 0 20px color-mix(in srgb, var(--accent, #f97316) 20%, transparent); transform: translateY(-2px); }
.oc-stat-glow { position: absolute; top: -20px; right: -20px; width: 60px; height: 60px; background: var(--accent, #f97316); border-radius: 50%; opacity: 0.08; filter: blur(20px); }
.oc-stat-icon { font-size: 28px; }
.oc-stat-value { font-size: 24px; font-weight: 700; color: #f0f0f5; line-height: 1; }
.oc-stat-label { font-size: 11.5px; color: #6b7280; margin-top: 4px; }

/* 行布局 */
.oc-row { display: flex; gap: 16px; margin-bottom: 16px; }

/* 卡片 */
.oc-card { background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; margin-bottom: 16px; }
.oc-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
.oc-card-title { font-size: 14px; font-weight: 600; color: #d0d4e0; }
.oc-card-extra { font-size: 12px; color: #6b7280; display: flex; align-items: center; gap: 4px; }

/* 节点 */
.oc-node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.oc-node-item { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; padding: 12px; transition: all 0.2s; }
.oc-node-item:hover { border-color: rgba(249,115,22,0.2); }
.oc-node-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.oc-node-name { font-size: 13px; font-weight: 600; color: #e0e0e5; }
.oc-node-os { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.06); color: #8b8fa3; margin-left: auto; }
.oc-node-metrics { display: flex; flex-direction: column; gap: 6px; }
.oc-metric { display: flex; align-items: center; gap: 8px; }
.oc-metric-label { font-size: 10px; color: #6b7280; width: 28px; }
.oc-metric-val { font-size: 10px; color: #8b8fa3; min-width: 32px; text-align: right; }
.oc-node-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 10px; color: #6b7280; }

/* 迷你表格 */
.oc-mini-table { display: flex; flex-direction: column; gap: 2px; }
.oc-mini-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; transition: background 0.15s; font-size: 12.5px; }
.oc-mini-row:hover { background: rgba(255,255,255,0.03); }
.oc-mini-name { flex: 1; color: #d0d4e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oc-mini-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(139,92,246,0.15); color: #a78bfa; }
.oc-mini-node { font-size: 11px; color: #6b7280; }
.oc-mini-count { font-size: 11px; color: #6b7280; }
.oc-mini-time { font-size: 11px; color: #4b5563; min-width: 80px; text-align: right; }

/* 状态点 */
.oc-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
.oc-dot.online { background: #22c55e; box-shadow: 0 0 6px rgba(34,197,94,0.6); }
.oc-dot.offline { background: #6b7280; }
.oc-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.status-pending { background: #f59e0b; }
.status-running { background: #3b82f6; animation: pulse-blue 1.5s infinite; }
.status-success { background: #22c55e; }
.status-failed { background: #ef4444; }
.status-cancelled { background: #6b7280; }
.status-draft { background: #6b7280; }
.status-reviewing { background: #f59e0b; }
.status-approved { background: #3b82f6; }
.status-published { background: #22c55e; }
.status-rejected { background: #ef4444; }

@keyframes pulse-blue { 0%,100%{ opacity:1 } 50%{ opacity:0.4 } }

/* 标签 */
.oc-tag-success { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: rgba(34,197,94,0.12); color: #22c55e; }
.oc-tag-warn { font-size: 10px; padding: 2px 8px; border-radius: 6px; background: rgba(245,158,11,0.12); color: #f59e0b; }

/* 账号 */
.oc-account-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
.oc-account-item { display: flex; align-items: center; gap: 12px; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; transition: all 0.2s; }
.oc-account-item:hover { border-color: rgba(249,115,22,0.2); }
.oc-account-avatar { width: 36px; height: 36px; border-radius: 50%; overflow: hidden; background: rgba(249,115,22,0.12); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.oc-account-avatar img { width: 100%; height: 100%; object-fit: cover; }
.oc-account-letter { font-size: 16px; font-weight: 700; color: #f97316; }
.oc-account-info { flex: 1; min-width: 0; }
.oc-account-name { font-size: 13px; font-weight: 600; color: #d0d4e0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.oc-account-platform { font-size: 11px; color: #6b7280; }

.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }

@media (max-width: 1200px) {
  .oc-stat-grid { grid-template-columns: repeat(3, 1fr); }
  .oc-row { flex-direction: column; }
}
</style>
