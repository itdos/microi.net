<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">💬 互评记录</h1>
        <p class="oc-subtitle">自动评论与互动的历史记录</p>
      </div>
      <div style="display:flex;gap:10px">
        <el-select v-model="filter.platform" placeholder="平台" clearable size="small" class="oc-select" style="width:120px" @change="loadRecords">
          <el-option v-for="p in platforms" :key="p" :label="p" :value="p" />
        </el-select>
        <el-select v-model="filter.status" placeholder="状态" clearable size="small" class="oc-select" style="width:100px" @change="loadRecords">
          <el-option label="成功" value="success" /><el-option label="失败" value="failed" />
        </el-select>
        <el-input v-model="filter.keyword" placeholder="搜索评论内容" clearable size="small" class="oc-input" style="width:180px" @keyup.enter="loadRecords" />
      </div>
    </div>

    <!-- 统计面板 -->
    <div class="oc-stat-row">
      <div class="oc-stat-mini" v-for="st in statCards" :key="st.label">
        <span class="oc-stat-num" :style="{color: st.color}">{{ st.value }}</span>
        <span class="oc-stat-label">{{ st.label }}</span>
      </div>
    </div>

    <div class="oc-card">
      <el-table :data="records" style="width:100%" class="oc-table" size="small" :header-cell-style="{background:'rgba(255,255,255,0.02)',color:'#8b8fa3',border:'none'}" :cell-style="{background:'transparent',color:'#d0d4e0',borderBottom:'1px solid rgba(255,255,255,0.04)'}">
        <el-table-column type="index" width="40" />
        <el-table-column prop="Platform" label="平台" width="80">
          <template #default="{row}"><span class="oc-mini-tag">{{ row.Platform }}</span></template>
        </el-table-column>
        <el-table-column prop="AccountName" label="账号" width="110" show-overflow-tooltip />
        <el-table-column prop="InteractType" label="类型" width="70">
          <template #default="{row}">
            <span class="oc-type-tag">{{ typeLabel(row.InteractType) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="TargetTitle" label="目标文章" min-width="200" show-overflow-tooltip>
          <template #default="{row}">
            <a v-if="row.TargetUrl" :href="row.TargetUrl" target="_blank" class="oc-link">{{ row.TargetTitle || row.TargetUrl }}</a>
            <span v-else>{{ row.TargetTitle || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="Content" label="评论内容" min-width="200" show-overflow-tooltip />
        <el-table-column prop="Status" label="状态" width="70">
          <template #default="{row}">
            <span :class="'oc-status-dot ' + row.Status">{{ row.Status === 'success' ? '✅' : '❌' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="ErrorMsg" label="错误信息" width="150" show-overflow-tooltip>
          <template #default="{row}"><span class="oc-error-text">{{ row.ErrorMsg || '-' }}</span></template>
        </el-table-column>
        <el-table-column prop="CreateTime" label="时间" width="140" :formatter="(r) => formatTime(r.CreateTime)" />
      </el-table>
      <div class="oc-pagination">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadRecords" small />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { getInteractList } from '../api'
import dayjs from 'dayjs'

const records = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const filter = reactive({ platform: '', status: '', keyword: '' })
const platforms = ['csdn', 'juejin', 'zhihu', 'jianshu', 'segmentfault', 'cnblogs']

const typeMap = { comment: '评论', like: '点赞', bookmark: '收藏', follow: '关注' }
function typeLabel(t) { return typeMap[t] || t }
function formatTime(t) { return t ? dayjs(t).format('MM-DD HH:mm:ss') : '-' }

const statCards = computed(() => {
  const data = records.value
  const successCount = data.filter(r => r.Status === 'success').length
  const failCount = data.filter(r => r.Status === 'failed').length
  const platforms = [...new Set(data.map(r => r.Platform))]
  return [
    { label: '总记录', value: total.value, color: '#f97316' },
    { label: '成功', value: successCount, color: '#22c55e' },
    { label: '失败', value: failCount, color: '#ef4444' },
    { label: '涉及平台', value: platforms.length, color: '#3b82f6' }
  ]
})

async function loadRecords() {
  const res = await getInteractList({ platform: filter.platform, status: filter.status, keyword: filter.keyword, _PageIndex: page.value, _PageSize: pageSize })
  if (res.Code === 1) { records.value = res.Data || []; total.value = res.Total || 0 }
}

onMounted(loadRecords)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }

.oc-stat-row { display: flex; gap: 14px; margin-bottom: 16px; }
.oc-stat-mini { flex: 1; background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 16px; text-align: center; }
.oc-stat-num { font-size: 24px; font-weight: 800; display: block; }
.oc-stat-label { font-size: 11px; color: #6b7280; }

.oc-card { background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; }
.oc-mini-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(139,92,246,0.15); color: #a78bfa; }
.oc-type-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(59,130,246,0.1); color: #60a5fa; }
.oc-link { color: #f97316; text-decoration: none; }
.oc-link:hover { text-decoration: underline; }
.oc-error-text { font-size: 11px; color: #ef4444; }
.oc-status-dot { font-size: 14px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-pagination { margin-top: 14px; display: flex; justify-content: flex-end; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }
:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
</style>
