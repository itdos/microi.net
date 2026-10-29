<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal } from '@microi/mci-ui';
import MciDataState from './PanelDataState.vue';
import { api } from './api.js';

const state = ref(null), preview = ref(null), error = ref(''), notice = ref(''), busy = ref(false), loading = ref(false);
const dirty = ref(false), revision = ref(''), confirmOpen = ref(false), confirmation = ref(''), requestId = ref(''), filter = ref('all');
const policy = reactive({ enabled: true, warningPercent: 85, pausePercent: 90, minimumFreeGiB: 5, inodeWarningPercent: 85,
  inodePausePercent: 90, idleDays: 7, rollbackVersions: 2, cleanupHour: 3, utcOffsetMinutes: 480 });
const status = computed(() => state.value?.status);
const rows = computed(() => (preview.value?.images || []).filter(item => filter.value === 'all' || (filter.value === 'eligible' ? item.eligible : !item.eligible)));
const candidates = computed(() => (preview.value?.images || []).filter(item => item.eligible));
const capacity = computed(() => preview.value?.capacity || status.value?.snapshot?.capacity);
const active = computed(() => status.value?.jobs?.some(item => ['Queued', 'Running'].includes(item.state)));
const gib = value => Number.isFinite(value) ? (value / 1024 ** 3).toFixed(2) + ' GiB' : '暂不可用';
const percent = value => Number.isFinite(value) ? value.toFixed(1) + '%' : '暂不可用';
const time = value => value ? new Date(value * 1000).toLocaleString('zh-CN', { hour12: false }) : '—';
const shortId = value => value?.replace('sha256:', '').slice(0, 16);
const states = { Queued: '等待执行', Running: '正在清理', Succeeded: '已完成', Failed: '未完成', NeedsReview: '需要核对' };
let timer;
async function refresh(withPreview = false) {
  if (loading.value) return;
  loading.value = true;
  try {
    state.value = await api('panel/disk');
    if (status.value?.policy && !dirty.value) {
      const { revision: value, ...settings } = status.value.policy;
      Object.assign(policy, settings); revision.value = value;
    }
    if (withPreview && state.value.available) preview.value = await api('panel/disk/preview');
    error.value = '';
  } catch (e) { error.value = e.message; }
  finally { loading.value = false; }
}
async function save() {
  if (busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    await api('panel/disk/policy', { expectedRevision: revision.value, policy: { ...policy } }, 'PUT');
    dirty.value = false; preview.value = null;
    await refresh(true); notice.value = '策略已保存。数据卷、容器和回滚保护始终保留。';
  } catch (e) { error.value = e.message; }
  finally { busy.value = false; }
}
function beginCleanup() {
  if (!preview.value || !candidates.value.length || active.value) return;
  confirmation.value = ''; requestId.value = crypto.randomUUID(); confirmOpen.value = true;
}
async function cleanup() {
  if (busy.value || confirmation.value !== '安全清理') return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    // 请求号在结果未知时保留；宿主按请求与预览幂等处理，不重复执行同一次删除。
    const job = await api('panel/disk/run', { requestId: requestId.value, fingerprint: preview.value.fingerprint, confirm: confirmation.value });
    confirmOpen.value = false; preview.value = null;
    notice.value = `任务已登记：${job.id}。关闭页面不会停止宿主任务。`;
    await refresh();
  } catch (e) { error.value = e.message; await refresh(); }
  finally { busy.value = false; }
}
onMounted(async () => { await refresh(true); timer = setInterval(() => refresh(), 5000); });
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <section class="disk-workspace">
    <p v-if="error" class="mci-panel-error" role="alert">{{ error }}</p>
    <p v-if="notice" class="disk-notice" role="status">{{ notice }}</p>
    <MciDataState v-if="!state" title="正在读取宿主维护状态" description="连接独立维护服务…" />
    <MciDataState v-else-if="!state.available" title="宿主维护尚未就绪" :description="state.message">
      <MciButton :disabled="loading" @click="refresh(true)">重新检查</MciButton>
    </MciDataState>
    <template v-else>
      <MciCard>
        <div class="mci-panel-row"><h2>磁盘容量保护</h2><MciButton variant="plain" :disabled="loading || busy" @click="refresh(true)">刷新并预览</MciButton></div>
        <p class="mci-panel-muted">宿主任务独立运行，业务 API 或数据库停机后仍能监测。安全清理只处理登记的应用历史镜像。</p>
        <div class="disk-badges"><span>{{ status.automaticCleanupEnabled ? '自动安全清理已开启' : '自动清理已关闭，继续监测' }}</span><span>数据库数据卷始终保留</span><span>{{ status.monitoringFresh ? '监测状态有效' : '监测回执需要刷新' }}</span></div>
        <p v-if="status.error" class="mci-panel-error" role="alert">{{ status.error }}</p>
        <p v-if="capacity?.blockUpdates" class="mci-panel-error">容量保护已触发，暂停新增镜像下载与更新。{{ capacity.reasons?.join('；') }}</p>
        <div v-if="capacity?.disks?.length" class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>文件系统位置</th><th>可用 / 总量</th><th>空间使用率</th><th>inode 使用率</th><th>状态</th></tr></thead><tbody><tr v-for="item in capacity.disks" :key="item.path"><td>{{ item.path }}</td><td>{{ gib(item.availableBytes) }} / {{ gib(item.totalBytes) }}</td><td>{{ percent(item.usedPercent) }}</td><td>{{ percent(item.inodeUsedPercent) }}</td><td>{{ item.readOnly ? '只读，停止维护写入' : '可写' }}</td></tr></tbody></table></div>
        <p v-else class="mci-panel-muted">还没有可确认的磁盘采样，请刷新预览；未采样不代表空间充足。</p>
        <p class="mci-panel-muted">采样时间：{{ time(capacity?.checkedAt) }}。镜像显示大小与实际回收空间可能不同；数据持续增长时仍需要扩容或调整保留策略。</p>
      </MciCard>

      <MciCard>
        <h2>自动清理策略</h2>
        <form class="mci-panel-form disk-policy" @submit.prevent="save" @input="dirty = true" @change="dirty = true">
          <label class="disk-toggle"><input v-model="policy.enabled" type="checkbox" aria-label="开启自动安全清理" /> 开启自动安全清理</label>
          <MciFormField label="空间预警（%）"><input v-model.number="policy.warningPercent" type="number" min="50" max="95" required /></MciFormField>
          <MciFormField label="暂停新增下载（%）"><input v-model.number="policy.pausePercent" type="number" min="60" max="98" required /></MciFormField>
          <MciFormField label="最小可用余量（GiB）"><input v-model.number="policy.minimumFreeGiB" type="number" min="1" max="1024" required /></MciFormField>
          <MciFormField label="镜像连续闲置（天）"><input v-model.number="policy.idleDays" type="number" min="1" max="365" required /></MciFormField>
          <MciFormField label="至少保留历史版本"><input v-model.number="policy.rollbackVersions" type="number" min="2" max="20" required /></MciFormField>
          <MciFormField label="每日清理开始小时"><input v-model.number="policy.cleanupHour" type="number" min="0" max="23" required /></MciFormField>
          <MciFormField label="inode 预警（%）"><input v-model.number="policy.inodeWarningPercent" type="number" min="50" max="95" required /></MciFormField>
          <MciFormField label="inode 暂停下载（%）"><input v-model.number="policy.inodePausePercent" type="number" min="60" max="98" required /></MciFormField>
          <MciFormField label="维护时区 UTC 偏移（分钟）"><input v-model.number="policy.utcOffsetMinutes" type="number" min="-720" max="840" required /></MciFormField>
          <p class="mci-panel-muted mci-panel-wide">每 15 分钟监测，默认 UTC+08:00。压力达到预警线时会提前尝试符合原保留策略的清理；不会缩短闲置期、删除回滚版本或数据卷来凑空间。</p>
          <MciButton class="mci-panel-wide" :disabled="busy || !dirty || active" type="submit">保存策略</MciButton>
        </form>
      </MciCard>

      <MciCard>
        <div class="mci-panel-row"><h2>安全回收预览</h2><MciButton :disabled="busy || loading || active || !candidates.length" @click="beginCleanup">清理 {{ candidates.length }} 个候选镜像</MciButton></div>
        <p class="mci-panel-muted">所有运行及停止容器的镜像引用、当前及历史保护、预拉取目标、更新与恢复任务均保留。未登记或共享的资源不自动清理。</p>
        <p v-if="!status.registrations.length" class="mci-panel-muted">尚未登记应用。安装器会登记本部署的 API/Web；现有其它部署需先明确接入范围。</p>
        <div class="disk-filters" role="group" aria-label="镜像预览筛选"><MciButton v-for="[value,label] in [['all','全部'],['eligible','可回收'],['retained','保留']]" :key="value" :variant="filter === value ? 'plain' : 'ghost'" @click="filter = value">{{ label }}</MciButton></div>
        <div v-if="rows.length" class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>镜像 / 标签</th><th>逻辑大小</th><th>闲置起点</th><th>结果与原因</th></tr></thead><tbody><tr v-for="item in rows.slice(0,100)" :key="item.id"><td :title="item.id"><strong>{{ shortId(item.id) }}</strong><small>{{ item.tags.join('、') || '无标签' }}</small></td><td>{{ gib(item.size) }}</td><td>{{ time(item.unusedSince) }}</td><td>{{ item.eligible ? '可回收' : '保留' }} · {{ item.reason }}</td></tr></tbody></table><p v-if="rows.length > 100" class="mci-panel-muted">当前显示前 100 项，共 {{ rows.length }} 项；任务仍按完整绑定预览与单次预算执行。</p></div>
        <MciDataState v-else :title="preview ? '此筛选下没有镜像' : '请刷新预览'" description="没有候选不代表没有磁盘压力；可能需要处理业务数据增长或扩容。" />
      </MciCard>

      <MciCard>
        <h2>登记与维护保护</h2>
        <div v-if="status.registrations.length" class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>容器</th><th>范围</th><th>镜像仓库</th></tr></thead><tbody><tr v-for="item in status.registrations" :key="item.name"><td>{{ item.name }}</td><td>{{ item.role === 'data' ? '只监测数据盘' : '应用历史镜像' }}</td><td>{{ item.repository }}</td></tr></tbody></table></div>
        <p class="mci-panel-muted">{{ status.leases.length }} 个任务正在保护镜像。失败和待恢复任务的保护不会因超时失效，完成原任务后释放。</p>
      </MciCard>

      <MciCard>
        <h2>清理任务与回执</h2>
        <article v-for="job in status.jobs" :key="job.id" class="disk-job"><div class="mci-panel-row"><strong>{{ job.mode === 'automatic' ? '自动安全清理' : '手动安全清理' }}</strong><span>{{ states[job.state] || job.state }}</span></div><small>{{ job.id }} · {{ time(job.createdAt) }}</small><p>已确认删除 {{ job.deleted.length }} 个镜像，跳过 {{ job.skipped.length }} 个。</p><p v-if="job.error" class="mci-panel-error">{{ job.error }}</p><p v-if="job.pressureRemaining" class="mci-panel-error">空间压力仍在，请处理增长来源或扩容；服务没有扩大删除范围。</p><p v-if="job.volumeListUnchanged === true" class="mci-panel-muted">数据卷清单回读一致。</p></article>
        <MciDataState v-if="!status.jobs.length" title="暂无清理任务" description="自动或手动任务执行后，在这里查看真实结果。" />
      </MciCard>
    </template>
    <MciModal v-model="confirmOpen" title="确认安全清理" :close-on-mask="!busy"><p>本次预览有 {{ candidates.length }} 个候选。删除前仍会核对主机身份、引用与保护；发生变化就跳过或停止。</p><MciFormField label="请输入“安全清理”"><input v-model="confirmation" aria-label="请输入安全清理" :disabled="busy" /></MciFormField><template #footer><MciButton variant="ghost" :disabled="busy" @click="confirmOpen = false">取消</MciButton><MciButton :disabled="busy || confirmation !== '安全清理'" @click="cleanup">提交清理任务</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
/* 本组件独立挂载，不能依赖兄弟 PanelWorkspace 的 scoped 样式；窄屏表格只在卡片内滚动。 */
.disk-workspace{grid-template-columns:minmax(0,1fr)}
.disk-workspace>.mci-web-card{min-width:0;max-width:100%}
.disk-workspace .mci-panel-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.disk-workspace .mci-panel-table-scroll{min-width:0;max-width:100%;overflow:auto}
.disk-workspace .mci-panel-table{width:100%;min-width:560px;border-collapse:collapse;font-size:13px;text-align:left}
.disk-workspace .mci-panel-table th,.disk-workspace .mci-panel-table td{padding:12px 10px;border-bottom:1px solid var(--mci-border);vertical-align:top}
.disk-workspace .mci-panel-muted{color:var(--mci-text-secondary);font-size:13px}
.disk-workspace .mci-panel-error{color:var(--mci-color-danger);overflow-wrap:anywhere}
.disk-workspace .mci-panel-wide{grid-column:1/-1}
.disk-workspace .disk-policy{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
@media(max-width:700px){.disk-workspace .disk-policy{grid-template-columns:1fr}}
.disk-workspace{display:grid;gap:20px;min-width:0}.disk-workspace h2{margin:0}.disk-badges,.disk-filters{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0}.disk-badges span{padding:5px 10px;border:1px solid var(--mci-border-color,#8993a544);border-radius:8px;font-size:.85rem}.disk-notice{padding:12px;border:1px solid var(--mci-border-color,#8993a544);border-radius:10px}.disk-policy{margin-top:16px}.disk-toggle{display:flex;align-items:center;gap:8px;grid-column:1/-1}.disk-job{padding:16px 0;border-bottom:1px solid var(--mci-border-color,#8993a544)}.disk-job small{display:block;overflow-wrap:anywhere;margin-top:8px}.disk-workspace td{overflow-wrap:anywhere}.disk-workspace td small{display:block;max-width:420px}@media(max-width:700px){.disk-workspace{gap:14px}.disk-policy{grid-template-columns:1fr}}
</style>
