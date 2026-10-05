<template>
  <section class="memory-view">
    <header class="memory-header"><div><h2>内存与事故定位</h2><p>从内存压力追到执行链、代码版本及分配栈。诊断采集独立运行，不开启 V8 资源限制。</p></div><button :disabled="busy" @click="refresh">{{ busy ? '读取中…' : '刷新诊断' }}</button></header>
    <p v-if="error" class="memory-warning" role="alert">{{ error }}</p>
    <div class="memory-health" :class="{ degraded: !healthy }" role="status">
      <b>{{ healthy ? '分配采样器在线' : '诊断采集存在缺口' }}</b>
      <span>{{ live.Collector?.Status || '尚未读取' }} · {{ time(live.Collector?.SampledAtUtc) }}</span>
      <span v-if="live.Collector?.Error">{{ live.Collector.Error }}</span>
      <span v-if="live.Collector?.LastCaptureError">{{ live.Collector.LastCaptureError }}</span>
      <span>待同步 {{ live.Evidence?.PendingUploads ?? '—' }} · 丢失待同步文件 {{ live.Evidence?.DroppedUnuploadedFiles ?? '—' }}</span>
      <span v-if="live.Evidence?.LocalStorageError || live.Evidence?.SharedStorageError">{{ live.Evidence?.LocalStorageError || live.Evidence?.SharedStorageError }}</span>
    </div>
    <p class="memory-boundary">实时指标来自节点 {{ live.NodeId || '—' }}，Boot {{ live.BootId || '—' }}。累计分配不等于存活内存。MySQL 已确认的关键证据可跨容器重建读取；原始分配栈文件仍需持久卷。</p>
    <div class="memory-health" :class="{ degraded: !live.Evidence?.CriticalStorage || live.Evidence?.CriticalStorage?.Error || live.Evidence?.CriticalStorage?.DroppedSnapshots }" role="status">
      <b>MySQL 关键事故证据</b><span>已确认写入 {{ live.Evidence?.CriticalStorage?.AcknowledgedWrites ?? '未支持' }} 次</span>
      <span>最后确认 {{ time(live.Evidence?.CriticalStorage?.LastAcknowledgedAtUtc) }}</span>
      <span>待写 {{ live.Evidence?.CriticalStorage?.Pending ?? '—' }} · 丢弃 {{ live.Evidence?.CriticalStorage?.DroppedSnapshots ?? '—' }}</span>
      <span>{{ live.Evidence?.CriticalStorage?.Error || '' }}</span>
    </div>
    <section class="memory-panel">
      <header><h3>当前租户请求等待</h3><span>请求与依赖调用分别计数，不能相加为线程数</span></header>
      <p>省略分组 {{ live.RequestWaits?.OmittedGroups ?? '—' }} · 注册溢出 {{ live.RequestWaits?.RegistryOverflowCount ?? '—' }}。长等待只记录证据，不缩短业务超时。</p>
      <ObservabilityTable :rows="live.RequestWaits?.Groups || []" :columns="waitColumns" :row-key="waitKey" empty-text="当前没有等待分组，或后端尚未支持等待取证" />
    </section>
    <div class="memory-metrics">
      <article><span>API 工作集 RSS</span><strong>{{ bytes(current.RssBytes) }}</strong><small>私有内存 {{ bytes(current.PrivateBytes) }}</small></article>
      <article><span>托管堆估计值</span><strong>{{ bytes(current.ManagedBytes) }}</strong><small>最近 GC 堆 {{ bytes(current.GcHeapBytes) }}</small></article>
      <article><span>累计分配速率</span><strong>{{ bytes(current.AllocationBytesPerSecond) }}/s</strong><small>GC 暂停 {{ Number(current.GcPausePercent || 0).toFixed(1) }}%</small></article>
      <article><span>宿主可用内存</span><strong>{{ bytes(current.HostAvailableBytes) }}</strong><small>总量 {{ bytes(current.HostTotalBytes) }} · {{ current.HostMemorySource || '来源不可用' }}</small></article>
      <article><span>容器当前 / 上限</span><strong>{{ bytes(current.ContainerCurrentBytes) }}</strong><small>{{ bytes(current.ContainerLimitBytes) }} · OOM kill {{ current.ContainerOomKillCount ?? '不可用' }}</small></article>
      <article><span>活动执行</span><strong>{{ live.Executions?.ActiveCount ?? '—' }}</strong><small>展示 {{ live.Executions?.Active?.length || 0 }} 条，注册溢出 {{ live.Executions?.RegistryOverflowCount || 0 }}</small></article>
      <article><span>MongoDB 进程内存</span><strong>{{ bytes(live.MongoDB?.ResidentBytes) }}</strong><small>WiredTiger 缓存 {{ bytes(live.MongoDB?.WiredTigerCacheBytes) }} / {{ bytes(live.MongoDB?.WiredTigerCacheLimitBytes) }}</small></article>
      <article><span>日志库存储空间</span><strong>{{ bytes(live.MongoDB?.LogStorageBytes) }}</strong><small>这是磁盘空间，不是内存。采样 {{ time(live.MongoDB?.SampledAtUtc) }} {{ live.MongoDB?.ServerStatusError }}</small></article>
    </div>
    <section class="memory-panel">
      <header><h3>最近两分钟内存变化</h3><span>蓝：RSS　绿：托管堆</span></header>
      <svg v-if="(live.History || []).length > 1" class="memory-chart" viewBox="0 0 900 150" preserveAspectRatio="none" role="img" aria-label="最近两分钟 RSS 与托管堆趋势">
        <path :d="curve('RssBytes')" fill="none" stroke="#4085ef" stroke-width="2" vector-effect="non-scaling-stroke"/>
        <path :d="curve('ManagedBytes')" fill="none" stroke="#15966a" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg><p v-else>尚未积累足够的采样点。</p>
      <div class="memory-axis"><span>{{ time(live.History?.[0]?.AtUtc) }}</span><span>峰值 {{ bytes(chartMax) }}</span><span>{{ time(current.AtUtc) }}</span></div>
    </section>
    <section class="memory-panel">
      <header><h3>当前 / 近期执行分配</h3><span>父调用包含子调用，分配量不能相加</span></header>
      <ObservabilityTable :rows="executions" :columns="executionColumns" row-key="ExecutionId" empty-text="当前租户暂无执行样本" search-placeholder="搜索接口 Key、表名、V8 事件或 TraceId">
        <template #cell-identity="{ row }"><b>{{ row.Key || row.Event || '未知入口' }}</b><small>{{ row.Kind }} · {{ row.Table }} · {{ row.Event }}</small><small>{{ row.Outcome }} · {{ row.ElapsedMs }} ms</small></template>
        <template #cell-allocation="{ row }"><b>{{ bytes(row.ExclusiveAllocatedBytes) }}</b><small>含子调用 {{ bytes(row.InclusiveAllocatedBytes) }}</small></template>
        <template #cell-trace="{ row }"><button v-if="row.TraceId" class="memory-link" @click="$emit('trace', row)">{{ row.TraceId }}</button><small>执行 {{ row.ExecutionId }}</small><small>父执行 {{ row.ParentExecutionId || '根执行' }}</small></template>
        <template #cell-code="{ row }"><code :title="row.ScriptHash">{{ row.ScriptHash || '平台代码' }}</code><small>{{ row.Stage }} · 最后进度 {{ time(row.LastProgressAtUtc) }}</small></template>
      </ObservabilityTable>
    </section>
    <section class="memory-panel">
      <header><h3>对象类型分配样本</h3><span>未归属 {{ bytes(live.Collector?.UnattributedEstimatedBytes) }} · 溢出 {{ live.Collector?.OverflowSamples || 0 }} · 丢事件 {{ live.Collector?.LostEvents || 0 }}</span></header>
      <ObservabilityTable :rows="live.AllocationTop || []" :columns="allocationColumns" :row-key="row => row.Execution?.ExecutionId + '-' + row.Type" empty-text="暂无可归属的分配样本">
        <template #cell-owner="{ row }"><b>{{ row.Execution?.Key }}</b><small>{{ row.Execution?.Kind }} · {{ row.Execution?.Table }} · {{ row.Execution?.Event }}</small></template>
        <template #cell-size="{ row }">{{ bytes(row.EstimatedAllocatedBytes) }}<small>{{ row.Samples }} 个采样事件</small></template>
      </ObservabilityTable>
    </section>
    <section class="memory-panel">
      <header><h3>事故历史</h3><span>MySQL：{{ relational || '尚未读取' }} · MongoDB：{{ shared || '尚未读取' }}</span></header>
      <ObservabilityTable :rows="incidents" :columns="incidentColumns" row-key="Id" :clickable="true" empty-text="暂无已记录的事故；不代表历史上未发生过故障" @row-click="openIncident">
        <template #cell-trigger="{ row }"><button class="memory-link" @click.stop="openIncident(row)">{{ trigger(row.Trigger) }}</button><small>{{ row.Status }}</small></template>
        <template #cell-peak="{ row }">{{ bytes(row.PeakRssBytes) }}</template>
        <template #cell-date="{ row }">{{ time(row.OccurredAtUtc) }}<small>{{ row.NodeId }}</small></template>
      </ObservabilityTable>
    </section>
    <section v-if="selected" class="memory-panel memory-incident" tabindex="-1" ref="detailPanel">
      <header><div><h3>事故证据：{{ trigger(selected.Trigger) }}</h3><p>{{ time(selected.OccurredAtUtc) }} · {{ selected.Id }}</p></div><button @click="selected = null">关闭详情</button></header>
      <p class="memory-boundary">{{ selected.Boundary }} {{ selected.ExitEvidence }}</p>
      <p>节点 {{ selected.NodeId }} · 版本 {{ selected.BuildVersion }} · 峰值 RSS {{ bytes(selected.PeakRssBytes) }} · {{ selected.Status }}</p>
      <p v-if="selected.StorageKind === 'MySqlCriticalEvidence'">本次读取的是 MySQL 已持久化的关键证据，原始分配栈不在此记录中。{{ selected.EvidenceTruncated ? '证据已按容量截断，请同时核对省略计数。' : '' }}</p>
      <h4>已保存的请求等待</h4>
      <p>各分组保留自己的并发峰值时刻，不能相加推算同一时刻总数。恢复后的空快照不会清除这些现场记录。</p>
      <ObservabilityTable :rows="selected.WaitEvidence?.Groups || selected.RequestWaits?.Groups || []" :columns="incidentWaitColumns" :row-key="waitKey" empty-text="此事故没有已保留的等待分组" />
      <details class="memory-stack"><summary>等待样本、TraceId、最差线程池时刻与最近完成结果</summary><pre>{{ JSON.stringify({Retained:selected.WaitEvidence,Latest:selected.RequestWaits}, null, 2) }}</pre></details>
      <p v-if="!selected.Stacks?.Top?.length" class="memory-warning">此记录没有完整分配栈。请结合执行样本、采集器错误与宿主 OOM 记录判断，不能据此宣布唯一根因。</p>
      <details v-for="(row, index) in selected.Stacks?.Top || []" :key="index" class="memory-stack">
        <summary>{{ row.Execution?.Key || '未归属' }} · {{ row.Type }} · {{ bytes(row.EstimatedAllocatedBytes) }}</summary>
        <p>{{ row.Execution?.Table }} · {{ row.Execution?.Event }} · 代码哈希 {{ row.Execution?.ScriptHash || '无' }}</p>
        <button v-if="row.Execution?.TraceId" class="memory-link" @click="$emit('trace', row.Execution)">查看 Trace {{ row.Execution.TraceId }}</button>
        <pre>{{ (row.Stack || []).join('\n') || '缺少符号或调用栈' }}</pre>
      </details>
      <h4>已保存的执行链</h4>
      <ObservabilityTable :rows="selected.Executions || []" :columns="executionColumns" row-key="ExecutionId" empty-text="没有已落盘的执行身份">
        <template #cell-identity="{ row }"><b>{{ row.Key || row.Event }}</b><small>{{ row.Kind }} · {{ row.Table }} · {{ row.Event }}</small></template>
        <template #cell-allocation="{ row }">{{ bytes(row.ExclusiveAllocatedBytes) }}<small>含子调用 {{ bytes(row.InclusiveAllocatedBytes) }}</small></template>
        <template #cell-trace="{ row }"><button v-if="row.TraceId" class="memory-link" @click="$emit('trace', row)">{{ row.TraceId }}</button><small>{{ row.ExecutionId }}</small><small>父执行 {{ row.ParentExecutionId || '根执行' }}</small></template>
        <template #cell-code="{ row }"><code>{{ row.ScriptHash || '平台代码' }}</code><small>{{ row.Stage }}</small></template>
      </ObservabilityTable>
      <details class="memory-stack"><summary>压力采样与采集质量详情</summary><pre>{{ JSON.stringify({ Current:selected.Current, Frames:selected.Frames, Collector:selected.Collector, Evidence:selected.Evidence }, null, 2) }}</pre></details>
    </section>
  </section>
</template>
<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'
import ObservabilityTable from './ObservabilityTable.vue'
const props = defineProps({ query: { type: Function, required: true } })
defineEmits(['trace'])
const live = ref({}), incidents = ref([]), selected = ref(null), detailPanel = ref(null), busy = ref(false), error = ref(''), shared = ref(''), relational = ref('')
const waitColumns = [{key:'ApiEngineKey',label:'接口',minWidth:160},{key:'Kind',label:'类型',minWidth:90},{key:'Stage',label:'等待阶段',minWidth:180},{key:'Target',label:'依赖目标（路径哈希）',minWidth:240,wrap:true},{key:'Count',label:'数量',minWidth:70},{key:'LongestMs',label:'最长等待 ms',minWidth:120}]
const incidentWaitColumns = [...waitColumns,{key:'ObservedAtUtc',label:'该峰值采样时间 UTC',minWidth:210}]
const waitKey = row => [row.ApiEngineKey,row.Kind,row.Stage,row.Target].join('|')
const current = computed(() => live.value.Current || {})
const healthy = computed(() => !error.value && live.value.Collector?.Fresh && live.value.Collector?.Status === 'Collecting' && !live.value.Collector?.Error && !live.value.Collector?.LastCaptureError && !live.value.Collector?.LostEvents && !live.value.Collector?.OverflowSamples && !live.value.Evidence?.LocalStorageError && !live.value.Evidence?.SharedStorageError)
const executions = computed(() => [...(live.value.Executions?.Active || []), ...(live.value.Executions?.Recent || [])].sort((a,b) => Number(b.InclusiveAllocatedBytes) - Number(a.InclusiveAllocatedBytes)))
const executionColumns = [{ key:'identity',label:'接口 / 事件',minWidth:220,searchKeys:['Key','Table','Event','Kind'] },{ key:'allocation',label:'累计分配（独占 / 含子）',minWidth:155 },{ key:'trace',label:'Trace / 执行链',minWidth:240,searchKeys:['TraceId','ExecutionId','ParentExecutionId'] },{ key:'code',label:'代码版本 / 进度',minWidth:200 }]
const allocationColumns = [{ key:'owner',label:'执行身份',minWidth:250 },{ key:'Type',label:'对象类型',minWidth:260,wrap:true },{ key:'size',label:'估计分配量',minWidth:140 }]
const incidentColumns = [{ key:'trigger',label:'触发信号',minWidth:250 },{ key:'peak',label:'峰值 RSS',minWidth:130 },{ key:'date',label:'时间 / 节点',minWidth:220 }]
function bytes(n) { if (n == null) return '不可用'; const v=Number(n); if(!Number.isFinite(v)||v<0)return '不可用'; if(v>=1024**3)return (v/1024**3).toFixed(2)+' GiB'; if(v>=1024**2)return (v/1024**2).toFixed(1)+' MiB'; return (v/1024).toFixed(1)+' KiB' }
function time(n) { if(!n)return '—'; const d=new Date(n);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-CN',{hour12:false}) }
function trigger(text) { const names={ ObservedLongRequestWait:'观察到请求长时间等待',SustainedRequestGateWait:'请求持续排队',HostMemoryPressure:'宿主内存压力',ContainerMemoryPressure:'容器内存压力',RapidRssGrowth:'RSS 快速增长',HighAllocationRate:'高分配速率',CgroupOomKillObserved:'cgroup OOM kill',DiskSpacePressure:'磁盘空间压力',UncleanExit:'未正常退出' };return String(text||'').split(',').map(s=>names[s]||s).join('、') }
const chartMax = computed(() => Math.max(1,...(live.value.History || []).flatMap(v => [Number(v.RssBytes)||0,Number(v.ManagedBytes)||0])))
function curve(key) { const points=live.value.History || [];return points.map((v,i)=>(i?'L':'M')+(i*900/Math.max(1,points.length-1))+','+(145-140*(Number(v[key])||0)/chartMax.value)).join(' ') }
async function refresh() {
  if(busy.value)return
  busy.value=true;error.value=''
  try { const result=await props.query({Action:'Memory'});live.value=result.Data||{} } catch(e) { live.value={};error.value=e?.message||'内存诊断能力不可用，请核对 API 后端是否包含诊断运行时。' }
  try { const result=await props.query({Action:'MemoryIncidents'});incidents.value=result.Data?.Items||[];shared.value=result.Data?.SharedStorage||'';relational.value=result.Data?.RelationalStorage||'此后端尚未支持' } catch(e) { shared.value='Unavailable';relational.value='Unavailable';error.value ||= e?.message||'事故历史读取失败' }
  busy.value=false
}
async function openIncident(row) {
  try { const result=await props.query({Action:'MemoryIncident',IncidentId:row.Id});selected.value=result.Data?.Items?.[0]||null;if(!selected.value)throw new Error('事故记录不存在或已过期');await nextTick();detailPanel.value?.focus();detailPanel.value?.scrollIntoView({behavior:'smooth',block:'start'}) } catch(e){error.value=e?.message||'读取事故失败'}
}
defineExpose({ refresh })
onMounted(refresh)
</script>
<style scoped>
.memory-view{min-width:0;--obs-muted:color-mix(in srgb,var(--obs-text) 75%,var(--obs-panel));--memory-link:color-mix(in srgb,var(--obs-primary) 40%,var(--obs-text))}
.memory-view>*{min-width:0;max-width:100%;box-sizing:border-box}
.memory-header>div,.memory-health>span{min-width:0;overflow-wrap:anywhere}
.memory-view .memory-boundary{overflow-wrap:anywhere}
.memory-view .memory-link{color:var(--memory-link)!important}
.memory-view{display:grid;gap:14px;color:var(--obs-text);font-size:13px}.memory-header,.memory-panel>header{display:flex;align-items:center;justify-content:space-between;gap:12px}.memory-view h2,.memory-view h3{margin:0 0 8px}.memory-view p,.memory-view small{color:var(--obs-muted);line-height:1.65}.memory-view button{padding:7px 12px;border:1px solid var(--obs-border);border-radius:6px;color:var(--obs-text);background:var(--obs-panel);cursor:pointer}.memory-view button:disabled{opacity:.5;cursor:wait}.memory-health{display:flex;flex-wrap:wrap;gap:12px;padding:12px;border:1px solid #15966a;border-radius:8px;background:color-mix(in srgb,#15966a 6%,var(--obs-panel))}.memory-health.degraded,.memory-warning{border-color:#ce8720;background:color-mix(in srgb,#ce8720 8%,var(--obs-panel));color:var(--obs-text)}.memory-warning{padding:12px;border-left:3px solid #ce8720}.memory-boundary{margin:0;padding:10px 12px;background:var(--obs-soft);border-radius:6px}.memory-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.memory-metrics article,.memory-panel{border:1px solid var(--obs-border);border-radius:9px;background:var(--obs-panel);padding:16px}.memory-metrics article{display:grid;gap:7px}.memory-metrics strong{font-size:23px}.memory-metrics span,.memory-panel>header>span,.memory-axis{color:var(--obs-muted);font-size:12px}.memory-chart{display:block;width:100%;height:150px;border-bottom:1px solid var(--obs-border)}.memory-axis{display:flex;justify-content:space-between;gap:8px;margin-top:10px}.memory-panel small{display:block;overflow-wrap:anywhere}.memory-panel code{display:block;max-width:240px;overflow-wrap:anywhere;white-space:normal;font-size:11px}.memory-view .memory-link{padding:3px 0;border:0;color:var(--obs-primary);background:transparent;word-break:break-all;text-align:left}.memory-stack{margin:10px 0;border:1px solid var(--obs-border);border-radius:6px;padding:12px}.memory-stack summary{cursor:pointer;overflow-wrap:anywhere}.memory-stack pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:420px;overflow:auto;font-size:11px;line-height:1.6}.memory-incident:focus{outline:2px solid var(--obs-primary);outline-offset:4px}@media(max-width:760px){.memory-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.memory-header,.memory-panel>header{align-items:flex-start;flex-direction:column}.memory-metrics strong{font-size:18px}.memory-axis{font-size:10px;flex-wrap:wrap}.memory-panel{padding:10px}}@media(max-width:420px){.memory-metrics{grid-template-columns:1fr}}
</style>
