<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">📝 文章管理</h1>
        <p class="oc-subtitle">AI生成文章的管理、审核与发布记录</p>
      </div>
      <div style="display:flex;gap:10px">
        <el-select v-model="filter.status" placeholder="状态筛选" clearable size="small" class="oc-select" style="width:120px" @change="loadArticles">
          <el-option label="待审核" value="draft" /><el-option label="已通过" value="approved" />
          <el-option label="已拒绝" value="rejected" /><el-option label="已发布" value="published" />
        </el-select>
        <el-input v-model="filter.keyword" placeholder="搜索标题" clearable size="small" class="oc-input" style="width:180px" @keyup.enter="loadArticles" />
      </div>
    </div>

    <div class="oc-card">
      <el-table :data="articles" style="width:100%" class="oc-table" size="small" :header-cell-style="{background:'rgba(255,255,255,0.02)',color:'#8b8fa3',border:'none'}" :cell-style="{background:'transparent',color:'#d0d4e0',borderBottom:'1px solid rgba(255,255,255,0.04)'}">
        <el-table-column type="index" width="40" />
        <el-table-column prop="Title" label="标题" min-width="240" show-overflow-tooltip>
          <template #default="{row}">
            <span class="oc-link" @click="openPreview(row)">{{ row.Title }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="Status" label="状态" width="80">
          <template #default="{row}">
            <span :class="'oc-status-tag s-' + row.Status">{{ statusLabel(row.Status) }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="Platform" label="平台" width="80">
          <template #default="{row}"><span class="oc-mini-tag">{{ row.Platform || '通用' }}</span></template>
        </el-table-column>
        <el-table-column prop="Tags" label="标签" width="120" show-overflow-tooltip>
          <template #default="{row}">
            <span v-for="tag in parseTags(row.Tags)" :key="tag" class="oc-tag-chip">{{ tag }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="WordCount" label="字数" width="60" align="center" />
        <el-table-column prop="LLMModel" label="模型" width="100" show-overflow-tooltip />
        <el-table-column prop="CreateTime" label="生成时间" width="140" :formatter="(r) => formatTime(r.CreateTime)" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <el-button text size="small" class="oc-text-btn" @click="openPreview(row)">👁️ 预览</el-button>
            <el-button v-if="row.Status==='draft'" text size="small" class="oc-text-btn" @click="handleReview(row,'approved')">✅ 通过</el-button>
            <el-button v-if="row.Status==='draft'" text size="small" class="oc-text-btn danger" @click="handleReview(row,'rejected')">❌ 拒绝</el-button>
            <el-button text size="small" class="oc-text-btn" @click="showPublishRecords(row)">📤 发布</el-button>
            <el-button text size="small" class="oc-text-btn danger" @click="handleDelete(row)">🗑️</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="oc-pagination">
        <el-pagination background layout="total, prev, pager, next" :total="total" :page-size="pageSize" v-model:current-page="page" @current-change="loadArticles" small />
      </div>
    </div>

    <!-- 文章预览弹窗 -->
    <el-dialog v-model="previewVisible" :title="previewData.Title" width="750px" class="oc-dialog" append-to-body>
      <div class="oc-article-preview">
        <div class="oc-preview-meta">
          <span class="oc-mini-tag">{{ previewData.Platform }}</span>
          <span class="oc-preview-time">{{ formatTime(previewData.CreateTime) }}</span>
          <span class="oc-preview-model">模型: {{ previewData.LLMModel }}</span>
          <span>{{ previewData.WordCount }} 字</span>
        </div>
        <div class="oc-preview-content" v-html="renderContent(previewData.Content)"></div>
        <div class="oc-preview-tags">
          <span v-for="tag in parseTags(previewData.Tags)" :key="tag" class="oc-tag-chip">{{ tag }}</span>
        </div>
      </div>
    </el-dialog>

    <!-- 发布记录弹窗 -->
    <el-dialog v-model="publishVisible" title="发布记录" width="600px" class="oc-dialog" append-to-body>
      <el-table :data="publishRecords" style="width:100%" class="oc-table" size="small" :header-cell-style="{background:'rgba(255,255,255,0.02)',color:'#8b8fa3',border:'none'}" :cell-style="{background:'transparent',color:'#d0d4e0',borderBottom:'1px solid rgba(255,255,255,0.04)'}">
        <el-table-column prop="Platform" label="平台" width="80" />
        <el-table-column prop="AccountName" label="账号" width="110" />
        <el-table-column prop="Status" label="状态" width="70">
          <template #default="{row}"><span :class="'oc-status-tag s-' + row.Status">{{ row.Status }}</span></template>
        </el-table-column>
        <el-table-column prop="PublishUrl" label="链接" show-overflow-tooltip>
          <template #default="{row}"><a v-if="row.PublishUrl" :href="row.PublishUrl" target="_blank" class="oc-link">{{ row.PublishUrl }}</a><span v-else>-</span></template>
        </el-table-column>
        <el-table-column prop="PublishTime" label="发布时间" width="140" :formatter="(r) => formatTime(r.PublishTime)" />
      </el-table>
      <div v-if="!publishRecords.length" class="oc-empty-mini">暂无发布记录</div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getArticleList, getArticle, deleteArticle, reviewArticle, getPublishRecords } from '../api'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'

const articles = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = 15
const filter = reactive({ status: '', keyword: '' })
const previewVisible = ref(false)
const publishVisible = ref(false)
const previewData = ref({})
const publishRecords = ref([])

const statusMap = { draft: '待审核', approved: '已通过', rejected: '已拒绝', published: '已发布' }
function statusLabel(s) { return statusMap[s] || s }
function formatTime(t) { return t ? dayjs(t).format('MM-DD HH:mm:ss') : '-' }
function parseTags(tags) {
  if (!tags) return []
  try { return JSON.parse(tags) } catch { return tags.split(',').map(t => t.trim()).filter(Boolean) }
}
function renderContent(c) { return c ? c.replace(/\n/g, '<br>') : '' }

async function loadArticles() {
  const res = await getArticleList({ status: filter.status, keyword: filter.keyword, _PageIndex: page.value, _PageSize: pageSize })
  if (res.Code === 1) { articles.value = res.Data || []; total.value = res.Total || 0 }
}

async function openPreview(row) {
  const res = await getArticle(row.Id)
  if (res.Code === 1) { previewData.value = res.Data; previewVisible.value = true }
}

async function handleReview(row, status) {
  const res = await reviewArticle({ articleId: row.Id, status, reason: status === 'rejected' ? '内容需修改' : '' })
  if (res.Code === 1) { ElMessage.success('操作成功'); loadArticles() }
  else ElMessage.error(res.Msg)
}

async function handleDelete(row) {
  await ElMessageBox.confirm(`确定删除文章【${row.Title}】？`, '提示', { type: 'warning' })
  const res = await deleteArticle(row.Id)
  if (res.Code === 1) { ElMessage.success('已删除'); loadArticles() } else ElMessage.error(res.Msg)
}

async function showPublishRecords(row) {
  const res = await getPublishRecords(row.Id)
  publishRecords.value = res.Code === 1 ? (res.Data || []) : []
  publishVisible.value = true
}

onMounted(loadArticles)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-card { background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 18px; }

.oc-link { color: #f97316; cursor: pointer; text-decoration: none; }
.oc-link:hover { text-decoration: underline; }

.oc-status-tag { font-size: 10px; padding: 2px 8px; border-radius: 6px; font-weight: 600; }
.s-draft { background: rgba(245,158,11,0.12); color: #f59e0b; }
.s-approved { background: rgba(34,197,94,0.12); color: #22c55e; }
.s-rejected { background: rgba(239,68,68,0.12); color: #ef4444; }
.s-published { background: rgba(59,130,246,0.12); color: #3b82f6; }
.s-success { background: rgba(34,197,94,0.12); color: #22c55e; }
.s-failed { background: rgba(239,68,68,0.12); color: #ef4444; }

.oc-mini-tag { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(139,92,246,0.15); color: #a78bfa; }
.oc-tag-chip { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(249,115,22,0.1); color: #f97316; margin-right: 4px; }
.oc-text-btn { color: #8b8fa3 !important; font-size: 11.5px !important; }
.oc-text-btn:hover { color: #f97316 !important; }
.oc-text-btn.danger:hover { color: #ef4444 !important; }
.oc-pagination { margin-top: 14px; display: flex; justify-content: flex-end; }
.oc-empty-mini { text-align: center; padding: 30px 10px; font-size: 12.5px; color: #4b5563; }

.oc-article-preview { max-height: 600px; overflow-y: auto; }
.oc-preview-meta { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; font-size: 12px; color: #8b8fa3; }
.oc-preview-content { font-size: 14px; line-height: 1.8; color: #d0d4e0; padding: 16px; background: rgba(0,0,0,0.3); border-radius: 10px; }
.oc-preview-tags { margin-top: 14px; display: flex; gap: 6px; flex-wrap: wrap; }

:deep(.oc-select .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; }
:deep(.oc-input .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
</style>
