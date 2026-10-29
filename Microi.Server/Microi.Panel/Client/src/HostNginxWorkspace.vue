<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciSkeleton } from '@microi/mci-ui';
import MciDataState from './PanelDataState.vue';
import { api, formatTime } from './api.js';

const emit = defineEmits(['dirty', 'navigate']);
const instances = ref([]), selected = ref(''), sites = ref([]), errors = ref([]), revisions = ref([]);
const loading = ref(true), busy = ref(false), notice = ref(''), failure = ref(''), search = ref('');
const draft = ref(null), text = ref(''), confirmation = ref(null), confirmText = ref(''), historyOpen = ref(false);
const acmeTarget = ref(null), certificateForm = reactive({ email: '', provider: 'LetsEncrypt', directoryUrl: '', rootCertificatePem: '', autoRenew: true, acceptTerms: false });
const current = computed(() => instances.value.find(item => item.id === selected.value));
const filtered = computed(() => sites.value.filter(item => `${item.name} ${item.fileName} ${(item.domains || []).join(' ')}`.toLowerCase().includes(search.value.toLowerCase())));
const dirty = computed(() => draft.value !== null && text.value !== draft.value.content);
let generation = 0, disposed = false, pendingWrite = null;
const endpoint = (tail = '') => `panel/host-nginx/instances/${encodeURIComponent(selected.value)}${tail}`;

function changed() { pendingWrite = null; emit('dirty', dirty.value); }
async function action(work) {
  if (busy.value) return;
  busy.value = true; failure.value = ''; notice.value = '';
  try { await work(); } catch (error) { failure.value = error.message; }
  finally { busy.value = false; }
}
async function loadSites() {
  const version = ++generation, id = selected.value;
  sites.value = []; draft.value = null; revisions.value = []; pendingWrite = null; emit('dirty', false);
  if (!id) return;
  const result = await api(endpoint('/sites'));
  if (!disposed && generation === version) {
    sites.value = result.sites;
    const instance = instances.value.find(item => item.id === id);
    if (instance) instance.fingerprint = result.fingerprint;
  }
}
async function refresh() {
  if (dirty.value) { notice.value = '请先发布或放弃当前修改，再重新发现站点。'; return; }
  loading.value = true;
  await action(async () => {
    const result = await api('panel/host-nginx/instances');
    if (disposed) return;
    instances.value = result.instances; errors.value = result.errors || [];
    if (!instances.value.some(item => item.id === selected.value)) selected.value = instances.value[0]?.id || '';
    await loadSites();
  });
  loading.value = false;
}
async function openSite(site) {
  await action(async () => {
    const result = await api(endpoint(`/sites/${encodeURIComponent(site.id)}/configuration`));
    if (disposed) return;
    draft.value = { ...result, name: site.name || site.fileName }; text.value = result.content;
    pendingWrite = null; emit('dirty', false);
  });
}
function ask(kind, revision = null) { confirmation.value = { kind, revision }; confirmText.value = ''; }
function closeEditor() {
  if (busy.value) return;
  if (dirty.value) { ask('discard'); return; }
  draft.value = null; text.value = ''; pendingWrite = null; emit('dirty', false);
}
async function history() {
  await action(async () => {
    const result = await api(endpoint(`/sites/${encodeURIComponent(draft.value.siteId)}/history`));
    revisions.value = result.revisions; historyOpen.value = true;
  });
}
async function openAutomaticCertificate(site) {
  await action(async () => {
    // 签发绑定实际配置版本和当前域名，不能使用列表里的旧快照覆盖原面板的新修改。
    const configuration = await api(endpoint(`/sites/${encodeURIComponent(site.id)}/configuration`));
    const registrations = await api('panel/acme');
    const existing = registrations.find(item => item.target === 'External' && item.instanceId === selected.value && item.siteId === site.id);
    if (!Array.isArray(configuration.domains) || configuration.domains.length === 0) throw new Error('当前配置未包含可申请证书的明确域名，请检查站点后重新读取。');
    acmeTarget.value = { ...configuration, expectedAcmeRevision: existing?.revision || '', requestId: crypto.randomUUID() };
    Object.assign(certificateForm, { email: existing?.email || '', provider: existing?.provider || 'LetsEncrypt', directoryUrl: existing?.directoryUrl || '',
      rootCertificatePem: existing?.rootCertificatePem || '', autoRenew: existing?.autoRenew ?? true, acceptTerms: false });
  });
}
async function issueCertificate() {
  if (!acmeTarget.value || !certificateForm.acceptTerms) return;
  await action(async () => {
    const target = acmeTarget.value;
    const result = await api('panel/acme/external', { ...certificateForm, requestId: target.requestId, instanceId: target.instanceId, siteId: target.siteId,
      expectedFingerprint: target.fingerprint, expectedSha256: target.sha256, domains: target.domains, expectedAcmeRevision: target.expectedAcmeRevision, confirm: target.siteId });
    if (!result.id) throw new Error('服务未返回证书任务编号，请回读操作任务后再重试。');
    acmeTarget.value = null; emit('navigate', 'operations');
  });
}
async function execute() {
  const command = confirmation.value;
  if (!command) return;
  if (command.kind === 'discard') {
    draft.value = null; text.value = ''; pendingWrite = null; confirmation.value = null; emit('dirty', false); return;
  }
  const expected = ['save', 'rollback'].includes(command.kind) ? draft.value?.siteId : selected.value;
  if (confirmText.value !== expected) return;
  await action(async () => {
    const target = { instanceId: selected.value, expectedFingerprint: draft.value?.fingerprint || current.value.fingerprint, confirm: expected };
    let result;
    if (command.kind === 'save' || command.kind === 'rollback') {
      const payload = { ...target, siteId: draft.value.siteId, expectedSha256: draft.value.sha256,
        ...(command.kind === 'save' ? { content: text.value } : { revisionId: command.revision.id }) };
      // 响应未知时保留相同请求号；只有正文或目标变化才重新创建操作，避免重复写配置。
      const identity = JSON.stringify({ kind: command.kind, payload });
      if (pendingWrite?.identity !== identity) pendingWrite = { identity, requestId: crypto.randomUUID() };
      result = await api(`panel/host-nginx/${command.kind === 'save' ? 'configuration' : 'rollback'}`, { ...payload, requestId: pendingWrite.requestId });
      if (result.validated !== true || result.reloaded !== true) throw new Error('宿主未确认校验和重载完成，请重新读取站点状态。');
      confirmation.value = null; historyOpen.value = false; draft.value = null; text.value = ''; pendingWrite = null; emit('dirty', false);
      await loadSites(); notice.value = `配置已校验并重载，备份编号：${result.backupRevision || '见历史记录'}。`;
    } else {
      result = await api(`panel/host-nginx/${command.kind}`, target);
      confirmation.value = null;
      if (command.kind === 'attach') { current.value.attached = true; notice.value = '已接入此实例。修改网站配置前会校验版本并创建备份。'; }
      else notice.value = command.kind === 'test' ? 'Nginx 配置校验通过。' : '配置校验与平滑重载完成。';
    }
  });
}
const confirmationTitle = computed(() => ({ attach: '接入已有 Nginx', save: '发布已有网站配置', rollback: '恢复历史配置', test: '校验 Nginx 配置', reload: '平滑重载 Nginx', discard: '放弃未发布修改' })[confirmation.value?.kind] || '确认操作');
const confirmationId = computed(() => ['save', 'rollback'].includes(confirmation.value?.kind) ? draft.value?.siteId : selected.value);
function beforeUnload(event) { if (dirty.value) { event.preventDefault(); event.returnValue = ''; } }
onMounted(() => { refresh(); window.addEventListener('beforeunload', beforeUnload); });
onUnmounted(() => { disposed = true; generation++; window.removeEventListener('beforeunload', beforeUnload); emit('dirty', false); });
</script>

<template>
  <section class="mci-host-nginx" data-mci-ui-root>
    <MciCard class="mci-host-card">
      <div class="mci-host-heading"><div><h2>已有面板的网站</h2><p>管理本机宝塔 Nginx、1Panel OpenResty 的已有网站。</p></div><MciButton variant="plain" :disabled="busy || dirty" @click="refresh">重新发现</MciButton></div>
      <MciSkeleton v-if="loading" height="150px" />
      <template v-else>
        <p v-if="failure" class="mci-host-error" role="alert">{{ failure }}</p>
        <p v-if="notice" role="status" class="mci-host-feedback">{{ notice }}</p>
        <div v-if="errors.length" class="mci-host-feedback"><p v-for="(error, index) in errors" :key="index">{{ typeof error === 'string' ? error : error.message || error.error }}</p></div>
        <MciDataState v-if="!instances.length" title="未发现可管理的实例" description="请确认本机已安装宝塔 Nginx 或 1Panel OpenResty，并检查主机服务状态。" />
        <div v-else class="mci-host-toolbar">
          <MciFormField label="已有 Nginx 实例"><select v-model="selected" aria-label="已有 Nginx 实例" :disabled="busy || dirty" @change="action(loadSites)"><option v-for="instance in instances" :key="instance.id" :value="instance.id">{{ instance.provider }} · {{ instance.name }}</option></select></MciFormField>
          <div class="mci-host-meta"><strong>{{ current?.attached ? '已接入管理' : '只读发现' }}</strong><small>{{ current?.version }} · {{ current?.status }}</small><small>{{ current?.configRoot }}</small></div>
          <div class="mci-host-actions"><MciButton v-if="!current?.attached" :disabled="busy" @click="ask('attach')">接入管理</MciButton><template v-else><MciButton variant="plain" :disabled="busy" @click="ask('test')">校验配置</MciButton><MciButton variant="plain" :disabled="busy" @click="ask('reload')">平滑重载</MciButton></template></div>
        </div>
      </template>
    </MciCard>
    <MciCard v-if="selected && !loading" class="mci-host-card">
      <div class="mci-host-heading"><h3>现有网站 <small>{{ sites.length }} 个</small></h3><MciFormField v-model="search" label="搜索网站" placeholder="域名、名称或配置文件" /></div>
      <template v-if="filtered.length">
        <div class="mci-host-table mci-host-site-table"><table><thead><tr><th>网站</th><th>域名</th><th>配置文件</th><th>操作</th></tr></thead><tbody><tr v-for="site in filtered" :key="site.id"><td>{{ site.name || site.id }}</td><td>{{ (site.domains || []).join('、') || '以实际配置为准' }}</td><td>{{ site.fileName }}</td><td><div class="mci-host-actions"><MciButton variant="ghost" :disabled="busy" @click="openSite(site)">{{ current?.attached ? '管理配置' : '查看配置' }}</MciButton><MciButton v-if="current?.attached" variant="ghost" :disabled="busy || !site.domains?.length" @click="openAutomaticCertificate(site)">免费 SSL</MciButton></div></td></tr></tbody></table></div>
        <div class="mci-host-mobile-sites"><article v-for="site in filtered" :key="site.id"><strong>{{ site.name || site.id }}</strong><p>{{ (site.domains || []).join('、') || '以实际配置为准' }}</p><small>{{ site.fileName }}</small><div class="mci-host-actions"><MciButton variant="plain" :disabled="busy" @click="openSite(site)">{{ current?.attached ? '管理配置' : '查看配置' }}</MciButton><MciButton v-if="current?.attached" variant="plain" :disabled="busy || !site.domains?.length" @click="openAutomaticCertificate(site)">免费 SSL</MciButton></div></article></div>
      </template>
      <MciDataState v-else :title="search ? '没有匹配的网站' : '此实例暂无可管理站点'" description="这里只列出已识别的站点配置；其它文件和全局配置保持原样。" />
    </MciCard>
    <MciModal :model-value="!!draft" :title="draft ? `网站配置 · ${draft.name}` : '网站配置'" size="lg" @update:model-value="value => { if (!value) closeEditor(); }">
      <div v-if="draft" class="mci-host-editor">
        <p>保存时会备份当前版本、执行语法校验，再平滑重载。其它管理员修改过此配置后，需要重新读取才能继续发布。</p>
        <label :for="'mci-host-config'">{{ draft.siteId }}<small v-if="dirty">有未发布修改</small></label>
        <textarea id="mci-host-config" v-model="text" aria-label="已有网站 Nginx 配置" spellcheck="false" autocomplete="off" :readonly="!current?.attached || busy" @input="changed" />
      </div>
      <template #footer><MciButton variant="plain" :disabled="busy" @click="closeEditor">关闭</MciButton><MciButton variant="plain" :disabled="busy" @click="history">历史备份</MciButton><MciButton v-if="current?.attached" :disabled="busy || !dirty" @click="ask('save')">校验并发布</MciButton></template>
    </MciModal>
    <MciModal v-model="historyOpen" title="网站配置历史" size="lg">
      <div class="mci-host-table" v-if="revisions.length"><table><thead><tr><th>时间 / 版本</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="revision in revisions" :key="revision.id"><td>{{ formatTime(revision.created) }}<small>{{ revision.id }}</small></td><td>{{ revision.state }}</td><td><MciButton variant="plain" :disabled="busy || dirty || !current?.attached" @click="ask('rollback', revision)">恢复此版本</MciButton></td></tr></tbody></table></div>
      <MciDataState v-else title="暂无吾码变更备份" description="首次发布配置时会备份原文件；宝塔或 1Panel 自己的历史记录仍由原面板管理。" />
      <template #footer><MciButton @click="historyOpen = false">关闭</MciButton></template>
    </MciModal>
    <MciModal :model-value="!!confirmation" :title="confirmationTitle" @update:model-value="value => { if (!value && !busy) confirmation = null; }">
      <p v-if="confirmation?.kind === 'discard'">当前编辑尚未发布。确认后丢弃本次输入，服务器配置不变。</p>
      <template v-else><p>{{ confirmation?.kind === 'attach' ? '允许吾码管理此实例已发现的网站配置。宝塔或 1Panel 仍可继续使用。' : '操作将作用于当前实例；校验或重载失败时显示具体结果，保留恢复记录。' }}</p><MciFormField v-model="confirmText" :label="`输入 ${confirmationId} 确认`" autocomplete="off" /></template>
      <template #footer><MciButton variant="plain" :disabled="busy" @click="confirmation = null">取消</MciButton><MciButton :loading="busy" :disabled="busy || (confirmation?.kind !== 'discard' && confirmText !== confirmationId)" @click="execute">确认</MciButton></template>
    </MciModal>
    <MciModal :model-value="!!acmeTarget" title="已有网站免费 SSL 与自动续期" size="lg" @update:model-value="value => { if (!value && !busy) acmeTarget = null; }">
      <form v-if="acmeTarget" id="mci-host-acme-form" class="mci-host-certificate" @submit.prevent="issueCertificate">
        <p>网站：{{ acmeTarget.siteId }}<br />域名：{{ acmeTarget.domains.join('、') }}</p>
        <p>将为现有网站配置 HTTP-01 验证路径。域名须解析到此主机，公网 80 端口可达；成功后部署证书并平滑重载，失败保留原证书。请避免同时在原面板修改此站点的证书设置。</p>
        <MciFormField v-model="certificateForm.email" label="证书联系邮箱" type="email" required />
        <MciFormField label="免费证书机构"><select v-model="certificateForm.provider" aria-label="免费证书机构"><option value="LetsEncrypt">Let's Encrypt 正式</option><option value="LetsEncryptStaging">Let's Encrypt 测试</option><option value="Custom">自定义 ACME CA</option></select></MciFormField>
        <template v-if="certificateForm.provider === 'Custom'"><MciFormField v-model="certificateForm.directoryUrl" label="HTTPS Directory URL" required /><MciFormField v-model="certificateForm.rootCertificatePem" label="CA 根证书 PEM（可选）" multiline /></template>
        <p v-if="certificateForm.provider === 'LetsEncryptStaging'">测试机构签发的证书不会被普通浏览器信任。</p>
        <label><input v-model="certificateForm.autoRenew" type="checkbox" />启用自动续期</label>
        <label><input v-model="certificateForm.acceptTerms" type="checkbox" required />接受证书机构服务条款，同意提交上述域名与联系邮箱</label>
      </form>
      <template #footer><MciButton variant="plain" :disabled="busy" @click="acmeTarget = null">取消</MciButton><MciButton type="submit" form="mci-host-acme-form" :loading="busy" :disabled="busy || !certificateForm.acceptTerms">申请并部署证书</MciButton></template>
    </MciModal>
    <MciModal :model-value="!!failure && (!!draft || !!acmeTarget)" title="操作未完成" @update:model-value="failure = ''"><p role="alert">{{ failure }}</p><template #footer><MciButton @click="failure = ''">返回编辑</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
.mci-host-nginx { display:grid;grid-template-columns:minmax(0,1fr);gap:20px;min-width:0; }
.mci-host-card { min-width:0; }
.mci-host-mobile-sites { display:none; }.mci-host-mobile-sites article { padding:16px 0;overflow-wrap:anywhere; }.mci-host-mobile-sites article + article { border-top:1px solid var(--mci-border); }.mci-host-mobile-sites p { margin:8px 0; }.mci-host-mobile-sites .mci-host-actions { margin-top:14px;justify-content:flex-start; }
.mci-host-certificate { display:grid;gap:16px; }.mci-host-certificate p { margin:0; }.mci-host-certificate label { overflow-wrap:anywhere; }
.mci-host-heading,.mci-host-toolbar,.mci-host-actions { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px; }
.mci-host-heading { margin-bottom:18px; }.mci-host-heading h2,.mci-host-heading h3,.mci-host-heading p { margin:0; }
.mci-host-nginx p,.mci-host-nginx small { color:var(--mci-text-secondary); }.mci-host-nginx small { display:block;font-size:12px;overflow-wrap:anywhere; }
.mci-host-toolbar > :first-child { min-width:240px; }.mci-host-meta { flex:1;min-width:180px; }
.mci-host-nginx select,.mci-host-editor textarea { width:100%;padding:12px;color:var(--mci-text-primary);background:var(--mci-bg-surface);border:1px solid var(--mci-border-strong);border-radius:var(--mci-shape-input);font:inherit; }
.mci-host-nginx select { min-height:44px; }.mci-host-editor { display:grid;gap:14px; }.mci-host-editor textarea { min-height:42vh;resize:vertical;font:13px/1.7 var(--mci-font-mono);tab-size:4; }
.mci-host-editor textarea:focus-visible,.mci-host-nginx select:focus-visible { outline:2px solid var(--mci-color-primary);outline-offset:2px; }
.mci-host-table { overflow:auto;max-width:100%; }.mci-host-table td { overflow-wrap:anywhere;max-width:360px; }.mci-host-table table { min-width:580px; }
.mci-host-feedback { padding:12px;border:1px solid var(--mci-border);border-radius:var(--mci-shape-input);background:var(--mci-bg-muted); }
.mci-host-nginx .mci-host-error { color:var(--mci-color-danger); }
@media(max-width:600px) { .mci-host-toolbar > :first-child { min-width:0;width:100%; }.mci-host-heading > :last-child { max-width:100%; }.mci-host-meta { width:100%; }.mci-host-editor textarea { min-height:45vh;font-size:12px; }.mci-host-site-table { display:none; }.mci-host-mobile-sites { display:block; } }
</style>
