<template>
  <div class="oc-page">
    <div class="oc-page-header">
      <div>
        <h1 class="oc-title">⚙️ 系统设置</h1>
        <p class="oc-subtitle">OpenClaw 全局配置项管理</p>
      </div>
      <el-button class="oc-btn-glow" @click="handleSaveAll" :loading="saving">💾 保存所有配置</el-button>
    </div>

    <!-- 配置分组 -->
    <div class="oc-settings-layout">
      <div class="oc-settings-nav">
        <div v-for="group in configGroups" :key="group.key" :class="['oc-nav-item', { active: activeGroup === group.key }]" @click="activeGroup = group.key">
          <span class="oc-nav-icon">{{ group.icon }}</span>
          <span>{{ group.label }}</span>
        </div>
      </div>

      <div class="oc-settings-content">
        <!-- 基础配置 -->
        <div v-show="activeGroup === 'basic'" class="oc-config-group">
          <h3 class="oc-group-title">🔧 基础配置</h3>
          <div class="oc-config-item" v-for="cfg in basicConfigs" :key="cfg.key">
            <div class="oc-cfg-left">
              <div class="oc-cfg-key">{{ cfg.label }}</div>
              <div class="oc-cfg-desc">{{ cfg.desc }}</div>
            </div>
            <div class="oc-cfg-right">
              <el-switch v-if="cfg.type === 'switch'" v-model="configMap[cfg.key]" :active-color="'#f97316'" />
              <el-input-number v-else-if="cfg.type === 'number'" v-model="configMap[cfg.key]" :min="cfg.min" :max="cfg.max" size="small" />
              <el-input v-else v-model="configMap[cfg.key]" :placeholder="cfg.placeholder" class="oc-input" size="small" style="width:280px" />
            </div>
          </div>
        </div>

        <!-- 爬虫配置 -->
        <div v-show="activeGroup === 'crawler'" class="oc-config-group">
          <h3 class="oc-group-title">🕷️ 爬虫配置</h3>
          <div class="oc-config-item" v-for="cfg in crawlerConfigs" :key="cfg.key">
            <div class="oc-cfg-left">
              <div class="oc-cfg-key">{{ cfg.label }}</div>
              <div class="oc-cfg-desc">{{ cfg.desc }}</div>
            </div>
            <div class="oc-cfg-right">
              <el-switch v-if="cfg.type === 'switch'" v-model="configMap[cfg.key]" :active-color="'#f97316'" />
              <el-input-number v-else-if="cfg.type === 'number'" v-model="configMap[cfg.key]" :min="cfg.min" :max="cfg.max" size="small" />
              <el-input v-else-if="cfg.type === 'textarea'" v-model="configMap[cfg.key]" type="textarea" :rows="3" class="oc-input" style="width:280px" />
              <el-input v-else v-model="configMap[cfg.key]" :placeholder="cfg.placeholder" class="oc-input" size="small" style="width:280px" />
            </div>
          </div>
        </div>

        <!-- 发布配置 -->
        <div v-show="activeGroup === 'publish'" class="oc-config-group">
          <h3 class="oc-group-title">📤 发布配置</h3>
          <div class="oc-config-item" v-for="cfg in publishConfigs" :key="cfg.key">
            <div class="oc-cfg-left">
              <div class="oc-cfg-key">{{ cfg.label }}</div>
              <div class="oc-cfg-desc">{{ cfg.desc }}</div>
            </div>
            <div class="oc-cfg-right">
              <el-switch v-if="cfg.type === 'switch'" v-model="configMap[cfg.key]" :active-color="'#f97316'" />
              <el-input-number v-else-if="cfg.type === 'number'" v-model="configMap[cfg.key]" :min="cfg.min" :max="cfg.max" size="small" />
              <el-input v-else v-model="configMap[cfg.key]" :placeholder="cfg.placeholder" class="oc-input" size="small" style="width:280px" />
            </div>
          </div>
        </div>

        <!-- 互评配置 -->
        <div v-show="activeGroup === 'interact'" class="oc-config-group">
          <h3 class="oc-group-title">💬 互评配置</h3>
          <div class="oc-config-item" v-for="cfg in interactConfigs" :key="cfg.key">
            <div class="oc-cfg-left">
              <div class="oc-cfg-key">{{ cfg.label }}</div>
              <div class="oc-cfg-desc">{{ cfg.desc }}</div>
            </div>
            <div class="oc-cfg-right">
              <el-switch v-if="cfg.type === 'switch'" v-model="configMap[cfg.key]" :active-color="'#f97316'" />
              <el-input-number v-else-if="cfg.type === 'number'" v-model="configMap[cfg.key]" :min="cfg.min" :max="cfg.max" size="small" />
              <el-input v-else v-model="configMap[cfg.key]" :placeholder="cfg.placeholder" class="oc-input" size="small" style="width:280px" />
            </div>
          </div>
        </div>

        <!-- 通知配置 -->
        <div v-show="activeGroup === 'notify'" class="oc-config-group">
          <h3 class="oc-group-title">🔔 通知配置</h3>
          <div class="oc-config-item" v-for="cfg in notifyConfigs" :key="cfg.key">
            <div class="oc-cfg-left">
              <div class="oc-cfg-key">{{ cfg.label }}</div>
              <div class="oc-cfg-desc">{{ cfg.desc }}</div>
            </div>
            <div class="oc-cfg-right">
              <el-switch v-if="cfg.type === 'switch'" v-model="configMap[cfg.key]" :active-color="'#f97316'" />
              <el-input v-else v-model="configMap[cfg.key]" :placeholder="cfg.placeholder" class="oc-input" size="small" style="width:280px" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { getConfigList, saveConfigs } from '../api'
import { ElMessage } from 'element-plus'

const activeGroup = ref('basic')
const configMap = reactive({})
const saving = ref(false)

const configGroups = [
  { key: 'basic', label: '基础配置', icon: '🔧' },
  { key: 'crawler', label: '爬虫配置', icon: '🕷️' },
  { key: 'publish', label: '发布配置', icon: '📤' },
  { key: 'interact', label: '互评配置', icon: '💬' },
  { key: 'notify', label: '通知配置', icon: '🔔' }
]

const basicConfigs = [
  { key: 'app_name', label: '应用名称', desc: 'OpenClaw 实例名称', placeholder: 'My OpenClaw' },
  { key: 'log_level', label: '日志级别', desc: 'DEBUG / INFO / WARNING / ERROR', placeholder: 'INFO' },
  { key: 'timezone', label: '时区', desc: '执行调度使用的时区', placeholder: 'Asia/Shanghai' },
  { key: 'max_concurrent_tasks', label: '最大并发任务', desc: '单节点同时运行的最大任务数', type: 'number', min: 1, max: 20 },
  { key: 'auto_retry', label: '失败自动重试', desc: '任务失败时自动重试', type: 'switch' },
  { key: 'retry_times', label: '重试次数', desc: '自动重试的最大次数', type: 'number', min: 0, max: 10 }
]

const crawlerConfigs = [
  { key: 'crawler_enabled', label: '启用爬虫', desc: '是否启用自动爬取文档', type: 'switch' },
  { key: 'crawler_urls', label: '爬取URL列表', desc: '每行一个URL，支持通配符', type: 'textarea', placeholder: 'https://docs.example.com/*' },
  { key: 'crawler_depth', label: '爬取深度', desc: '从入口页面的最大爬取层级', type: 'number', min: 1, max: 10 },
  { key: 'crawler_interval', label: '爬取间隔(秒)', desc: '两次请求之间的等待时间', type: 'number', min: 1, max: 60 },
  { key: 'crawler_max_pages', label: '最大页面数', desc: '单次爬取的最大页面数量', type: 'number', min: 1, max: 1000 },
  { key: 'crawler_use_playwright', label: '使用Playwright', desc: '启用浏览器渲染，支持JS动态页面', type: 'switch' }
]

const publishConfigs = [
  { key: 'publish_enabled', label: '启用自动发布', desc: '文章审核通过后自动发布', type: 'switch' },
  { key: 'publish_platforms', label: '发布平台', desc: '逗号分隔: csdn,juejin,zhihu', placeholder: 'csdn,juejin' },
  { key: 'publish_interval', label: '发布间隔(分钟)', desc: '同一平台两次发布的间隔', type: 'number', min: 1, max: 120 },
  { key: 'publish_need_review', label: '发布前需审核', desc: '文章需人工审核后才能发布', type: 'switch' },
  { key: 'publish_add_footer', label: '文章追加Footer', desc: '发布时在文末自动添加文本', placeholder: '> 本文由 OpenClaw 自动生成' }
]

const interactConfigs = [
  { key: 'interact_enabled', label: '启用自动互评', desc: '自动对其他文章进行评论/点赞', type: 'switch' },
  { key: 'interact_daily_limit', label: '每日互动上限', desc: '每个账号每天最多互动次数', type: 'number', min: 1, max: 100 },
  { key: 'interact_interval', label: '互动间隔(秒)', desc: '两次互动之间的等待时间', type: 'number', min: 5, max: 300 },
  { key: 'interact_use_ai_comment', label: 'AI生成评论', desc: '使用AI生成个性化评论内容', type: 'switch' },
  { key: 'interact_comment_min_len', label: '评论最小长度', desc: '生成评论的最小字符数', type: 'number', min: 5, max: 500 }
]

const notifyConfigs = [
  { key: 'notify_enabled', label: '启用通知', desc: '任务完成/失败时发送通知', type: 'switch' },
  { key: 'notify_webhook', label: 'Webhook URL', desc: '企业微信/钉钉/飞书 Webhook 地址', placeholder: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...' },
  { key: 'notify_email', label: '通知邮箱', desc: '接收通知的邮箱地址', placeholder: 'admin@example.com' },
  { key: 'notify_on_success', label: '成功时通知', desc: '任务成功完成时也发送通知', type: 'switch' },
  { key: 'notify_on_failure', label: '失败时通知', desc: '任务失败时发送通知', type: 'switch' }
]

const allConfigs = [...basicConfigs, ...crawlerConfigs, ...publishConfigs, ...interactConfigs, ...notifyConfigs]

async function loadConfigs() {
  const res = await getConfigList({ group: 'openclaw' })
  if (res.Code === 1 && res.Data) {
    res.Data.forEach(item => {
      const def = allConfigs.find(c => c.key === item.ConfigKey)
      if (def && def.type === 'switch') configMap[item.ConfigKey] = item.ConfigValue === 'true' || item.ConfigValue === '1'
      else if (def && def.type === 'number') configMap[item.ConfigKey] = Number(item.ConfigValue) || 0
      else configMap[item.ConfigKey] = item.ConfigValue || ''
    })
  }
  // 设置默认值
  allConfigs.forEach(cfg => {
    if (configMap[cfg.key] === undefined) {
      if (cfg.type === 'switch') configMap[cfg.key] = false
      else if (cfg.type === 'number') configMap[cfg.key] = cfg.min || 0
      else configMap[cfg.key] = ''
    }
  })
}

async function handleSaveAll() {
  saving.value = true
  try {
    const configs = allConfigs.map(cfg => ({
      ConfigKey: cfg.key,
      ConfigValue: String(configMap[cfg.key] ?? ''),
      ConfigGroup: 'openclaw'
    }))
    const res = await saveConfigs(configs)
    if (res.Code === 1) ElMessage.success('配置已保存')
    else ElMessage.error(res.Msg)
  } finally { saving.value = false }
}

onMounted(loadConfigs)
</script>

<style scoped>
.oc-page { padding: 24px 28px; min-height: 100vh; }
.oc-page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
.oc-title { font-size: 22px; font-weight: 700; color: #f0f0f5; margin: 0; }
.oc-subtitle { font-size: 13px; color: #6b7280; margin-top: 4px; }
.oc-btn-glow { background: linear-gradient(135deg, #ef4444, #f97316) !important; color: #fff !important; border: none !important; border-radius: 10px !important; padding: 8px 18px !important; font-weight: 600; box-shadow: 0 4px 15px rgba(239,68,68,0.3); }

.oc-settings-layout { display: flex; gap: 20px; min-height: 600px; }

.oc-settings-nav { width: 180px; flex-shrink: 0; background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 10px; }
.oc-nav-item { display: flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 10px; cursor: pointer; font-size: 13px; color: #8b8fa3; transition: all 0.2s; margin-bottom: 2px; }
.oc-nav-item:hover { background: rgba(255,255,255,0.04); color: #d0d4e0; }
.oc-nav-item.active { background: rgba(249,115,22,0.1); color: #f97316; font-weight: 600; }
.oc-nav-icon { font-size: 16px; }

.oc-settings-content { flex: 1; background: linear-gradient(135deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01)); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 24px; }
.oc-group-title { font-size: 16px; font-weight: 700; color: #f0f0f5; margin: 0 0 20px 0; }

.oc-config-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
.oc-config-item:last-child { border-bottom: none; }
.oc-cfg-left { flex: 1; }
.oc-cfg-key { font-size: 14px; font-weight: 600; color: #d0d4e0; margin-bottom: 2px; }
.oc-cfg-desc { font-size: 12px; color: #6b7280; }
.oc-cfg-right { flex-shrink: 0; margin-left: 20px; }

:deep(.oc-input .el-input__wrapper), :deep(.oc-input .el-textarea__inner) { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(255,255,255,0.08) !important; box-shadow: none !important; border-radius: 8px !important; color: #d0d4e0 !important; }
:deep(.el-input-number) { --el-input-bg-color: rgba(255,255,255,0.04); }
:deep(.el-input-number .el-input__wrapper) { background: rgba(255,255,255,0.04) !important; box-shadow: none !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 8px !important; }
</style>
