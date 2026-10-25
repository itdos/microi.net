<template>
  <section class="runtime-panel" :aria-busy="busy">
    <header><div><h3>NAS 实际分流</h3><p>完整日达到阈值后自动复制公开运行依赖组；副本校验通过才改变下载入口。</p></div><button type="button" :disabled="busy" @click="refresh">刷新运行状态</button></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <p v-if="!status && !error">正在读取可信运行状态…</p>
    <template v-if="status">
      <p>采集：{{ collectorLabel }} · 缺失或迟到报表保持未知。OSS 流量下降后，已验证的同版本副本继续保留。</p>
      <p v-if="notice" role="status">{{ notice }}</p>
      <table v-if="status.Groups?.length"><thead><tr><th>公开应用 / 版本</th><th>实际窗口流量</th><th>副本与分流</th><th>操作</th></tr></thead><tbody>
        <tr v-for="group in status.Groups" :key="`${group.SourceTenant}/${group.AppKey}`">
          <td>{{ group.SourceTenant }} / {{ group.AppKey }}<small>{{ group.Version || '待读取当前版本' }}</small></td>
          <td>{{ group.Qualification ? formatResourceBytes(group.Qualification.ConfirmedBytesLowerBound) + '（已确认下界）' : '人工指定历史热点；本日用量未知' }}</td>
          <td>{{ group.Enabled === false ? '已暂停' : group.State === 'Ready' && group.HealthValidUntilUtc * 1000 > Date.now() ? 'NAS 副本校验通过，允许分流' : group.State === 'Copying' ? '正在复制与校验' : '等待处理或健康复核' }}<small>{{ group.CopiedFiles || 0 }} 个文件 · {{ formatResourceBytes(group.CopiedBytes) }}</small><small v-if="group.LastErrorCode">{{ failureLabel(group.LastErrorCode) }}</small></td>
          <td><button type="button" :disabled="busy" @click="queue(group.Enabled === false ? 'Enable' : 'Disable', group)">{{ group.Enabled === false ? '恢复' : '暂停' }}</button></td>
        </tr>
      </tbody></table>
      <p v-else>尚无完成阈值确认或人工指定的公开应用组。</p>
      <form @submit.prevent="queue('PinHistoricalHotspot', { SourceTenant: sourceTenant, AppKey: appKey })">
        <label>已知高流量应用的来源租户<input v-model.trim="sourceTenant" pattern="[a-zA-Z0-9_-]{1,64}" required maxlength="64" /></label>
        <label>应用 Key<input v-model.trim="appKey" pattern="[a-zA-Z0-9_-]{1,120}" required maxlength="120" /></label>
        <button type="submit" :disabled="busy">按历史热点纳入复制</button>
      </form>
      <p>人工指定单独留因，不伪造当前 24 小时用量。暂停保留副本和原始 OSS 文件；私有文件不开放匿名访问。</p>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { configureV8 } from '../microi'
import { formatResourceBytes } from '../file-resource-directory.mjs'
const props = defineProps({ sessionIdentity: { type: String, required: true }, tenant: { type: String, default: '' } })
const status = ref(null), busy = ref(false), error = ref(''), notice = ref(''), sourceTenant = ref(''), appKey = ref('')
let generation = 0, disposed = false
const failureLabel = code => ({ BackupStorageProbeFailed: 'MinIO 配置验证失败，请检查 SaaS 引擎。', BackupAnonymousReadFailed: 'NAS 公开读取失败，保持原下载。', BackupCorsNotConfirmed: 'NAS 跨域读取尚未通过。', CloudCollectionFailed: '云报表暂时读取失败，等待重试。' }[code] || '校验尚未通过，已保留进度并安排重试。')
const collectorLabel = computed(() => status.value?.Collector?.State === 'ReadCompleted' ? '已读取供应商报表' : status.value?.Collector?.State === 'Retrying' ? '读取失败，等待重试' : '等待完整日采集')
async function call(payload) {
  const v8 = configureV8(), url = '/apiengine/mci-file-resource-runtime'
  const result = v8.Http?.Post ? await v8.Http.Post({ Url: url, PostParam: payload }) : await v8.post(url, payload)
  if (Number(result?.Code) !== 1) throw new Error(failureLabel(result?.Msg))
  return result.Data
}
async function refresh() {
  if (busy.value || disposed) return
  const g = generation; busy.value = true; error.value = ''
  try { const data = await call({ Action: 'Status' }); if (g === generation && !disposed) status.value = data }
  catch (e) { if (g === generation && !disposed) error.value = e.message }
  finally { if (g === generation && !disposed) busy.value = false }
}
async function queue(action, group) {
  if (busy.value || disposed) return
  const g = generation; busy.value = true; error.value = ''; notice.value = ''
  try {
    await call({ Action: action, SourceTenant: group.SourceTenant, AppKey: group.AppKey })
    if (g !== generation || disposed) return
    notice.value = action === 'Disable' ? '已暂停分流。' : '请求已持久化，后台继续复制与校验。'
    const data = await call({ Action: 'Status' }); if (g === generation && !disposed) status.value = data
  } catch (e) { if (g === generation && !disposed) error.value = '提交或回读未确认，请先刷新状态核对，避免重复提交。' }
  finally { if (g === generation && !disposed) busy.value = false }
}
watch(() => props.sessionIdentity, () => { generation++; busy.value = false; status.value = null; error.value = ''; notice.value = ''; appKey.value = ''; sourceTenant.value = props.tenant; if (props.sessionIdentity) void refresh() }, { immediate: true })
onBeforeUnmount(() => { disposed = true; generation++ })
</script>

<style scoped>
.runtime-panel{margin:20px 0;padding:18px;border:1px solid var(--obs-border);border-radius:12px;background:var(--obs-panel);overflow:auto}.runtime-panel header,.runtime-panel form{display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap}.runtime-panel h3{margin:0}.runtime-panel p,.runtime-panel small{color:var(--obs-muted);font-size:12px;line-height:1.6}.runtime-panel small{display:block}.runtime-panel table{width:100%;border-collapse:collapse;margin:14px 0}.runtime-panel th,.runtime-panel td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid var(--obs-border);font-size:13px;overflow-wrap:anywhere}.runtime-panel label{display:grid;gap:6px;font-size:12px}.runtime-panel input,.runtime-panel button{font:inherit;min-height:42px;padding:8px 12px;color:var(--obs-text);background:var(--obs-bg);border:1px solid var(--obs-muted);border-radius:8px}.runtime-panel button{cursor:pointer}.runtime-panel button:disabled{opacity:.55;cursor:wait}.runtime-panel button:focus-visible,.runtime-panel input:focus-visible{outline:2px solid var(--obs-text);outline-offset:2px}@media(max-width:650px){.runtime-panel{padding:12px}.runtime-panel form{display:grid}.runtime-panel th,.runtime-panel td{padding:8px;min-width:110px}}
</style>
