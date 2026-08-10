<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="AI PLATFORM CONTROL" title="把平台治理变成可验证的日常动作" description="门户、身份、发布、服务和告警共享同一套版本、哈希、幂等与审计语义；先看异常，再进入对应控制面。">
      <button type="button" class="mci-button mci-button--primary" @click="load">刷新治理快照</button>
    </MciPageIntro>

    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <template v-else>
      <div class="metrics">
        <MciMetricCard v-for="metric in metrics" :key="metric.key" :metric="metric" />
      </div>
      <div class="mci-grid content-grid">
        <article class="mci-card mci-section span-7">
          <div class="mci-section__head"><div><h2>需要关注</h2><p>只展示会影响交付、安全或运行质量的信号。</p></div><span class="mci-badge" :data-tone="attentionTotal ? 'danger' : 'success'">{{ attentionTotal ? `${attentionTotal} 项` : '全部正常' }}</span></div>
          <div class="attention-list">
            <button v-for="item in attention" :key="item.path" type="button" @click="$emit('navigate', item.path)">
              <i :data-tone="item.value ? item.tone : 'success'" aria-hidden="true"></i>
              <span><strong>{{ item.label }}</strong><small>{{ item.value ? item.message : item.ok }}</small></span>
              <b>{{ item.value }}</b>
            </button>
          </div>
        </article>
        <article class="mci-card mci-section span-5">
          <div class="mci-section__head"><div><h2>治理原则</h2><p>每次动作都留下可解释的证据。</p></div></div>
          <ol class="principles">
            <li><b>01</b><span><strong>计划先行</strong><small>危险写入先返回范围、差异和计划哈希。</small></span></li>
            <li><b>02</b><span><strong>共享事实</strong><small>版本、幂等键和告警状态落共享数据库。</small></span></li>
            <li><b>03</b><span><strong>租户可扩展</strong><small>官方核心受管升级，扩展 Hook 永不覆盖。</small></span></li>
          </ol>
        </article>
        <article class="mci-card mci-section span-6">
          <div class="mci-section__head"><div><h2>最近告警</h2><p>按数据库创建时间倒序。</p></div><button type="button" class="mci-button mci-button--ghost" @click="$emit('navigate', '/observability')">查看全部</button></div>
          <MciStatePanel v-if="!data.RecentAlerts?.length" state="empty" title="没有告警" message="当前没有活动告警事件。" />
          <MciDataTable v-else :rows="data.RecentAlerts" :columns="alertColumns" />
        </article>
        <article class="mci-card mci-section span-6">
          <div class="mci-section__head"><div><h2>最近发布</h2><p>发布门禁与环境状态。</p></div><button type="button" class="mci-button mci-button--ghost" @click="$emit('navigate', '/release')">进入发布</button></div>
          <MciStatePanel v-if="!data.RecentReleases?.length" state="empty" title="暂无发布计划" message="创建发布计划后，这里会展示门禁结果。" />
          <MciDataTable v-else :rows="data.RecentReleases" :columns="releaseColumns" />
        </article>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import MciDataTable from '../components/MciDataTable.vue'
import MciMetricCard from '../components/MciMetricCard.vue'
import MciPageIntro from '../components/MciPageIntro.vue'
import MciStatePanel from '../components/MciStatePanel.vue'
import type { HostContext, Metric } from '../domain/models'
import type { RoutePath } from '../domain/navigation'
import { runEngine } from '../platform/client'

const props = defineProps<{ context: HostContext }>()
defineEmits<{ navigate: [path: RoutePath] }>()
interface OverviewData { Metrics: Record<string, number>; Attention: Record<string, number>; RecentAlerts: Record<string, unknown>[]; RecentReleases: Record<string, unknown>[]; GeneratedAt: string }
const data = ref<OverviewData>({ Metrics: {}, Attention: {}, RecentAlerts: [], RecentReleases: [], GeneratedAt: '' })
const state = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref('')
const metrics = computed<Metric[]>(() => [
  { key: 'portal', label: '门户项目', value: data.value.Metrics.PortalProjects ?? 0, hint: '已登记且未归档', tone: 'primary' },
  { key: 'flag', label: '启用开关', value: data.value.Metrics.EnabledFlags ?? 0, hint: '正在参与运行评估', tone: 'success' },
  { key: 'service', label: '注册服务', value: data.value.Metrics.RegisteredServices ?? 0, hint: '当前启用的服务目录', tone: 'neutral' },
  { key: 'alert', label: '活动告警', value: data.value.Metrics.ActiveAlerts ?? 0, hint: `快照 ${data.value.GeneratedAt || '—'}`, tone: (data.value.Metrics.ActiveAlerts ?? 0) > 0 ? 'danger' : 'success' }
])
const attention = computed(() => [
  { label: '高危告警', value: data.value.Attention.CriticalAlerts ?? 0, message: '需要立即研判和处置', ok: '没有高危告警', tone: 'danger', path: '/observability' as RoutePath },
  { label: '身份冲突', value: data.value.Attention.IdentityConflicts ?? 0, message: '需要管理员决定合并策略', ok: '没有未处理冲突', tone: 'warning', path: '/identity' as RoutePath },
  { label: '待处理发布', value: data.value.Attention.PendingReleases ?? 0, message: '草稿、检查中或已阻断', ok: '没有待处理发布', tone: 'warning', path: '/release' as RoutePath },
  { label: '异常服务', value: data.value.Attention.UnhealthyServices ?? 0, message: '降级、故障或状态未知', ok: '服务状态正常', tone: 'danger', path: '/services' as RoutePath },
  { label: '导入异常', value: data.value.Attention.ImportIssues ?? 0, message: '失败、部分失败或已暂停', ok: '导入批次状态正常', tone: 'warning', path: '/import' as RoutePath }
])
const attentionTotal = computed(() => attention.value.reduce((sum, item) => sum + item.value, 0))
const alertColumns = [{ key: 'Title', label: '标题' }, { key: 'Severity', label: '级别', tone: true }, { key: 'Status', label: '状态', tone: true }, { key: 'CreateTime', label: '发现时间' }]
const releaseColumns = [{ key: 'Name', label: '发布' }, { key: 'VersionNo', label: '版本' }, { key: 'Environment', label: '环境' }, { key: 'Status', label: '状态', tone: true }]
async function load() { state.value = 'loading'; error.value = ''; try { data.value = await runEngine<OverviewData>(props.context, 'mci-ai-platform-overview'); state.value = 'ready' } catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } }
onMounted(load)
</script>

<style scoped>
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
.content-grid { align-items: start; }.attention-list { display: grid; gap: 7px; }.attention-list button { display: grid; min-height: 60px; grid-template-columns: 10px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 10px 12px; border-color: var(--mci-border-color); text-align: left; }.attention-list i { width: 8px; height: 28px; border-radius: 5px; background: var(--mci-color-info); }.attention-list i[data-tone="danger"] { background: var(--mci-color-danger); }.attention-list i[data-tone="warning"] { background: var(--mci-color-warning); }.attention-list i[data-tone="success"] { background: var(--mci-color-success); }.attention-list span { display: grid; gap: 3px; }.attention-list small { color: var(--mci-text-tertiary); }.attention-list b { font-family: var(--mci-font-mono); font-size: 18px; }
.principles { display: grid; gap: 15px; margin: 0; padding: 2px 0 0; list-style: none; }.principles li { display: flex; gap: 13px; }.principles b { display: grid; width: 34px; height: 34px; flex: 0 0 34px; place-items: center; border-radius: 9px; color: var(--mci-color-primary); background: color-mix(in srgb, var(--mci-color-primary) 8%, var(--mci-bg-soft)); font-family: var(--mci-font-mono); font-size: 11px; }.principles span { display: grid; gap: 4px; }.principles small { color: var(--mci-text-secondary); line-height: 1.55; }
@media (max-width: 1080px) { .metrics { grid-template-columns: repeat(2, minmax(0,1fr)); } }
@media (max-width: 560px) { .metrics { grid-template-columns: 1fr; } }
</style>
