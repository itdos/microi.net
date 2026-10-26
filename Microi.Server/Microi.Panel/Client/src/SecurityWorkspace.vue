<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciSkeleton, MciDataState } from '@microi/mci-ui';
import { api, formatTime } from './api.js';

const snapshot = ref(null), loading = ref(true), busy = ref(false), message = ref(''), dirty = ref(false), unban = ref(null), confirmation = ref('');
const policy = reactive({ enabled: true, maxFailures: 3, banDuration: 24, banUnit: 3600, windowMinutes: 0, allowlistText: '', expectedRevision: null });
let timer, fetching = false;
const host = computed(() => snapshot.value?.host);
const scope = computed(() => host.value ? 'all' : 'panel');
const scopeName = computed(() => host.value ? '主机及面板' : '仅面板登录');
const serviceNames = { panel: '面板登录', ssh: 'SSH', mysql: 'MySQL', mongodb: 'MongoDB', redis: 'Redis', postgresql: 'PostgreSQL', sqlserver: 'SQL Server', oracle: 'Oracle' };
const labels = { protecting: '保护运行中', disabled: '已关闭', degraded: '需要处理', unsupported: '暂不支持', initializing: '正在接入', 'needs-migration': '需要迁移', 'needs-verification': '等待日志验证', monitoring: '监测中', unavailable: '未连接', ready: '已就绪', error: '异常', unconfigured: '未配置' };
const statusName = value => labels[String(value || '').toLowerCase()] || '待核验';
const time = value => formatTime(typeof value === 'number' ? value * 1000 : value);
const adapters = computed(() => {
  const actual = Array.isArray(host.value?.adapters) ? host.value.adapters : [];
  const items = actual.map(item => ({ ...item, service: item.service || item.kind, title: serviceNames[item.service || item.kind] || item.id }));
  if (!items.some(item => item.service === 'ssh')) items.unshift({ id: 'ssh', service: 'ssh', title: 'SSH', status: 'unavailable', message: '等待主机防护服务接入并确认认证日志。' });
  for (const resource of snapshot.value?.resources || []) {
    if (resource.state === 'Removed' || items.some(item => item.id === resource.id || item.resourceId === resource.id)) continue;
    items.push({ id: resource.id, title: `${serviceNames[resource.pluginId] || resource.pluginId} · ${resource.id}`, service: resource.pluginId,
      status: resource.pluginId === 'redis' && !resource.redisAuthProxy ? 'needs-migration' : 'unavailable',
      message: resource.pluginId === 'redis' && !resource.redisAuthProxy ? '此存量实例仍使用直接端口，尚未经过认证防护入口。请按文档在维护窗口迁移。' : '尚未收到此实例的有效保护回执，请核对适配器与服务配置。' });
  }
  return items;
});
const bans = computed(() => {
  const rows = new Map();
  for (const item of host.value?.bans || []) rows.set(item.ip, { ...item, source: 'host', until: item.expiresAt });
  for (const item of snapshot.value?.panel?.entries || []) {
    if (host.value && !(snapshot.value.pendingPanelIps || []).includes(item.ip)) continue;
    if (!item.banned || rows.has(item.ip)) continue;
    rows.set(item.ip, { ...item, source: 'panel', service: 'panel', until: item.bannedUntil, applied: true, reason: '面板登录认证失败' });
  }
  return [...rows.values()];
});
const firewallStatus = computed(() => {
  if (!host.value) return '主机防护未连接';
  const firewall = host.value.firewall;
  if (firewall?.status) return `防火墙：${statusName(firewall.status)}`;
  return firewall?.ready === true ? '防火墙已回读' : '防火墙待核验';
});
function loadPolicy() {
  const value = host.value?.policy || snapshot.value?.panel?.policy;
  if (!value) return;
  const unit = value.banSeconds % 3600 === 0 ? 3600 : value.banSeconds % 60 === 0 ? 60 : 1;
  Object.assign(policy, { enabled: value.enabled, maxFailures: value.maxFailures, banDuration: value.banSeconds / unit, banUnit: unit,
    windowMinutes: value.windowSeconds / 60, allowlistText: (value.allowlist || []).join('\n'), expectedRevision: value.revision ?? null });
  dirty.value = false;
}
async function refresh(force = false) {
  if (fetching) return;
  fetching = true;
  try { snapshot.value = await api('panel/security'); if (!dirty.value || force) loadPolicy(); }
  finally { fetching = false; loading.value = false; }
}
async function act(fn) {
  if (busy.value) return;
  busy.value = true;
  try { await fn(); } catch (error) { message.value = error.message; }
  finally { busy.value = false; }
}
async function save() {
  await act(async () => {
    const banSeconds = Math.round(Number(policy.banDuration) * Number(policy.banUnit)), windowSeconds = Math.round(Number(policy.windowMinutes) * 60);
    if (!Number.isInteger(Number(policy.maxFailures)) || !Number.isFinite(banSeconds) || !Number.isFinite(windowSeconds)) throw new Error('请输入有效的次数与时间。');
    await api('panel/security/policy', { enabled: policy.enabled, maxFailures: Number(policy.maxFailures), banSeconds, windowSeconds,
      allowlist: policy.allowlistText.split(/[\n,;]/).map(value => value.trim()).filter(Boolean), expectedRevision: policy.expectedRevision, scope: scope.value }, 'PUT');
    await refresh(true); message.value = `${scopeName.value}策略已保存并回读。各服务是否生效请查看下方保护状态。`;
  });
}
function openUnban(row) { unban.value = row; confirmation.value = ''; }
async function release() {
  await act(async () => {
    const ip = unban.value.ip;
    await api('panel/security/unban', { ip, confirm: confirmation.value, scope: scope.value });
    unban.value = null; await refresh(); message.value = `${ip} 已在${scopeName.value}范围解封，本轮错误计数已清零。`;
  });
}
function addCurrentIp() {
  const current = snapshot.value?.currentIp;
  if (current && !policy.allowlistText.split(/[\n,;]/).map(x => x.trim()).includes(current)) policy.allowlistText = [policy.allowlistText.trim(), current].filter(Boolean).join('\n');
  dirty.value = true;
}
onMounted(async () => { await act(() => refresh()); timer = setInterval(() => { if (!busy.value && !document.hidden) refresh().catch(() => {}); }, 10000); });
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <section class="mci-security" data-mci-ui-root>
    <MciSkeleton v-if="loading" height="280px" />
    <template v-else-if="snapshot">
      <MciCard>
        <div class="mci-security-heading"><div><h2>密码防暴力破解</h2><p>默认累计错误 3 次，封禁来源 IP 24 小时；到期自动解封并清零计数。</p></div><MciButton variant="plain" :disabled="busy" @click="act(() => refresh())">刷新防护状态</MciButton></div>
        <div class="mci-security-summary"><span>{{ scopeName }}</span><span>{{ firewallStatus }}</span><span>当前封禁 {{ bans.length }} 个 IP</span></div>
        <p v-if="!host" class="mci-security-warning" role="status">主机防护服务未连接。面板登录仍有独立防护；SSH 和数据库的主机封禁尚未确认生效。</p>
        <p v-else class="mci-security-note">开关表示配置意图。日志采集、真实来源地址和防火墙回读均正常的服务，才显示“保护运行中”。</p>
      </MciCard>

      <MciCard><h2>防护策略</h2><p>设置范围：{{ scopeName }}。默认按同一来源 IP 跨已接入服务累计，成功登录不清空计数。</p>
        <form class="mci-security-form" @submit.prevent="save" @input="dirty = true" @change="dirty = true">
          <label class="mci-security-check"><input v-model="policy.enabled" type="checkbox" :disabled="busy" />开启密码错误自动封禁</label>
          <div class="mci-security-fields">
            <MciFormField label="错误次数"><input v-model.number="policy.maxFailures" type="number" min="1" max="100" step="1" required :disabled="busy" aria-label="错误次数" /></MciFormField>
            <MciFormField label="自动解封时间"><div class="mci-security-duration"><input v-model.number="policy.banDuration" type="number" :min="60 / policy.banUnit" :max="31536000 / policy.banUnit" step="any" required :disabled="busy" aria-label="自动解封时间" /><select v-model.number="policy.banUnit" :disabled="busy" aria-label="解封时间单位"><option :value="3600">小时</option><option :value="60">分钟</option><option :value="1">秒</option></select></div></MciFormField>
            <MciFormField label="统计窗口（分钟，0 表示累计）"><input v-model.number="policy.windowMinutes" type="number" min="0" max="1440" step="1" required :disabled="busy" aria-label="统计窗口（分钟）" /></MciFormField>
          </div>
          <MciFormField label="不自动封禁的 IP / CIDR（每行一项）"><textarea v-model="policy.allowlistText" rows="4" :disabled="busy" aria-label="防护白名单" spellcheck="false" placeholder="填写已确认的固定运维 IP 或 CIDR 网段" /></MciFormField>
          <div class="mci-security-actions"><span>当前连接来源：<code>{{ snapshot.currentIp }}</code></span><MciButton variant="ghost" :disabled="busy" @click="addCurrentIp">加入当前 IP</MciButton></div>
          <p class="mci-security-note">白名单会免于自动封禁。共享出口的用户会共用同一 IP 的计数；只登记可信来源。窗口大于 0 时按该时间范围统计，解封后重新计数。</p>
          <div class="mci-security-actions mci-security-actions-end"><span v-if="dirty" class="mci-security-note">有未保存的修改</span><MciButton variant="plain" :disabled="busy || !dirty" @click="loadPolicy">放弃修改</MciButton><MciButton type="submit" :loading="busy" :disabled="busy || !dirty">保存策略</MciButton></div>
        </form>
      </MciCard>

      <MciCard><h2>服务保护状态</h2><div class="mci-security-adapters">
        <div class="mci-security-adapter"><div><strong>面板登录</strong><span :data-state="snapshot.panel?.policy?.enabled ? 'protecting' : 'disabled'">{{ snapshot.panel?.policy?.enabled ? '保护运行中' : '已关闭' }}</span></div><p>独立持久计数与可撤销会话；主机服务离线时继续保护面板登录。</p></div>
        <div v-for="item in adapters" :key="`${item.service}:${item.id}`" class="mci-security-adapter"><div><strong>{{ item.title }}<small v-if="item.resourceId"> · {{ item.resourceId }}</small></strong><span :data-state="String(item.status).toLowerCase()">{{ statusName(item.status) }}</span></div><p>{{ item.message || item.error || item.reason || '请查看主机防护状态与日志采集回执。' }}</p></div>
      </div><p class="mci-security-note">Redis 使用认证代理逐次识别失败，存量直接端口需维护窗口迁移。未列为已接入的第三方服务，不自动宣称受保护。</p></MciCard>

      <MciCard><h2>封禁 IP</h2><p>手动解封会移除对应封禁并清零本轮失败计数；自动解封按记录的到期时间执行。</p>
        <div v-if="bans.length" class="mci-security-table"><table><thead><tr><th>来源 IP</th><th>触发服务 / 原因</th><th>解封时间</th><th>生效状态</th><th>操作</th></tr></thead><tbody><tr v-for="row in bans" :key="row.ip"><td><code>{{ row.ip }}</code></td><td>{{ serviceNames[row.service] || row.service || '认证失败' }}<small>{{ row.reason }}</small></td><td>{{ time(row.until) }}</td><td>{{ row.applied === true ? '已执行' : '等待防火墙确认' }}<small v-if="row.source === 'panel'">面板登录范围</small><small v-if="row.error">{{ row.error }}</small></td><td><MciButton variant="plain" :disabled="busy" @click="openUnban(row)">手动解封</MciButton></td></tr></tbody></table></div>
        <MciDataState v-else title="当前没有封禁 IP" description="达到失败阈值后的封禁和到期时间会显示在这里。" />
      </MciCard>
    </template>
    <MciCard v-else><MciDataState title="防护状态暂时无法读取" description="请确认面板连接后重试。" /><MciButton @click="act(() => refresh())">重新读取</MciButton></MciCard>
    <MciModal :model-value="!!unban" title="手动解除 IP 封禁" @update:model-value="value => { if (!value && !busy) unban = null; }"><form id="mci-security-unban" @submit.prevent="release"><p>将在{{ scopeName }}范围解除 <code>{{ unban?.ip }}</code> 的封禁，并清零本轮错误计数。</p><p v-if="!host" class="mci-security-warning">主机服务离线，本次只能解除面板登录封禁。主机防火墙需在恢复连接后单独核对。</p><MciFormField v-model="confirmation" label="输入完整 IP 确认" required /></form><template #footer><MciButton variant="plain" :disabled="busy" @click="unban = null">取消</MciButton><MciButton form="mci-security-unban" type="submit" :loading="busy" :disabled="busy || confirmation !== unban?.ip">确认解封</MciButton></template></MciModal>
    <MciModal :model-value="!!message" title="安全防护提示" @update:model-value="value => { if (!value) message = ''; }"><p role="alert">{{ message }}</p><template #footer><MciButton @click="message = ''">知道了</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
.mci-security-duration { display:flex;gap:8px; }.mci-security-duration input { min-width:0; }.mci-security-duration select { flex:0 0 76px;padding:8px;color:var(--mci-text-primary);background:var(--mci-bg-surface);border:1px solid var(--mci-border-default);border-radius:var(--mci-shape-input);font:inherit; }.mci-security-duration select:focus-visible { outline:2px solid var(--mci-text-link);outline-offset:2px; }
.mci-security { display:grid;gap:20px;min-width:0; }.mci-security h2 { margin:0 0 10px; }.mci-security p { color:var(--mci-text-secondary);line-height:1.7;overflow-wrap:anywhere; }.mci-security-heading,.mci-security-actions,.mci-security-summary { display:flex;align-items:center;gap:12px;flex-wrap:wrap; }.mci-security-heading { justify-content:space-between; }.mci-security-summary { margin-top:16px; }.mci-security-summary>span { padding:8px 12px;background:var(--mci-bg-elevated);border:1px solid var(--mci-border-default);border-radius:var(--mci-shape-input); }.mci-security .mci-security-warning { color:var(--mci-color-danger); }.mci-security-form { display:grid;gap:16px; }.mci-security-fields { display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px; }.mci-security input[type=number],.mci-security textarea { width:100%;box-sizing:border-box;padding:10px 12px;color:var(--mci-text-primary);background:var(--mci-bg-surface);border:1px solid var(--mci-border-default);border-radius:var(--mci-shape-input);font:inherit;min-height:44px; }.mci-security textarea { resize:vertical; }.mci-security input:focus-visible,.mci-security textarea:focus-visible { outline:2px solid var(--mci-text-link);outline-offset:2px; }.mci-security-check { display:flex;align-items:center;gap:10px;min-height:44px; }.mci-security-actions-end { justify-content:flex-end; }.mci-security-note { font-size:13px; }.mci-security-adapters { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 24px; }.mci-security-adapter { padding:16px 0;border-bottom:1px solid var(--mci-border-default); }.mci-security-adapter>div { display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap; }.mci-security-adapter p { margin-bottom:0;font-size:13px; }.mci-security-adapter span { color:var(--mci-color-warning);font-size:13px; }.mci-security-adapter span[data-state=protecting] { color:var(--mci-color-success); }.mci-security-table { overflow:auto; }.mci-security table { width:100%;min-width:720px;border-collapse:collapse; }.mci-security td,.mci-security th { padding:12px;text-align:left;border-bottom:1px solid var(--mci-border-default); }.mci-security small { display:block;color:var(--mci-text-secondary);margin-top:5px; }.mci-security code { overflow-wrap:anywhere; }.mci-security [disabled] { cursor:not-allowed; }@media(max-width:760px){.mci-security-fields,.mci-security-adapters{grid-template-columns:1fr;}.mci-security-heading{align-items:flex-start;}.mci-security-actions-end{justify-content:stretch;}.mci-security-actions-end>*{flex:1;} }
</style>
