<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciDataState, MciSkeleton } from '@microi/mci-ui';
import { api, formatTime } from './api.js';
const props = defineProps({ page: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const instances = ref([]), selected = ref(''), config = ref(null), certificates = ref([]), loading = ref(true), busy = ref(false);
const message = ref(''), editor = ref(null), deleteSite = ref(null), certificateOpen = ref(false), preview = ref(''), publishOpen = ref(false), hasChanges = ref(false);
const form = reactive({}), certificate = reactive({ id: '', name: '', certificatePem: '', privateKeyPem: '' });
const automatic=ref([]),acmeOpen=ref(false),acme=reactive({siteId:'',email:'',provider:'LetsEncrypt',directoryUrl:'',rootCertificatePem:'',autoRenew:true,acceptTerms:false,expectedAcmeRevision:''});
const automaticFor=site=>automatic.value.find(x=>x.resourceId===selected.value&&x.siteId===site.id);
let requestId = '', disposed = false, generation = 0;
const sites = computed(() => config.value?.configuration.sites || []);
const validCertificates = computed(() => certificates.value.filter(x => new Date(x.notAfter) > new Date()));
async function act(fn) { if (busy.value) return; busy.value = true; message.value = ''; try { await fn(); } catch (e) { message.value = e.message; } finally { busy.value = false; } }
async function refresh() {
  loading.value = true;
  try {
    certificates.value = await api('panel/certificates');
    automatic.value = await api('panel/acme');
    const snapshot = await api('panel/snapshot'); instances.value = snapshot.resources.filter(x => x.pluginId === 'nginx' && x.state !== 'Removed');
    if (!instances.value.some(x => x.id === selected.value)) selected.value = instances.value[0]?.id || '';
    if (selected.value && !hasChanges.value) await loadSelected();
  } catch (e) { message.value = e.message; } finally { loading.value = false; }
}
async function loadSelected() {
  const version = ++generation, id = selected.value;
  if (!id) { config.value = null; return; }
  const value = await api(`panel/nginx/${encodeURIComponent(id)}`);
  if (!disposed && generation === version) { config.value = value; hasChanges.value = false; requestId = crypto.randomUUID(); }
}
function edit(site) {
  const next = site ? JSON.parse(JSON.stringify(site)) : { id: '', name: '', domains: [], kind: 'Proxy', enabled: true, certificateId: '', redirectHttps: false, httpsPublicPort: config.value?.resource.ports.https || 443, maxBodyMb: 100, gzip: true, spaFallback: false, routes: [{ prefix: '/', upstream: 'http://host.docker.internal:8080', stripPrefix: false, webSocket: true, timeoutSeconds: 300, verifyUpstreamCertificate: true }] };
  Object.assign(form, next, { domainsText: next.domains.join('\n') }); editor.value = { originalId: site?.id || '' };
}
async function saveSite() {
  await act(async () => {
    const { domainsText, ...site } = JSON.parse(JSON.stringify(form)); site.domains = domainsText.split(/[\s,，]+/).filter(Boolean);
    if (site.kind === 'Static') site.routes = [];
    const candidate = { sites: sites.value.filter(x => x.id !== editor.value.originalId).concat(site) };
    await api(`panel/nginx/${selected.value}/preview`, candidate);
    config.value.configuration = candidate; hasChanges.value = true; requestId = crypto.randomUUID(); editor.value = null;
  });
}
async function removeSite() { config.value.configuration.sites = sites.value.filter(x => x.id !== deleteSite.value.id); deleteSite.value = null; hasChanges.value = true; requestId = crypto.randomUUID(); }
async function showPreview() { await act(async () => { preview.value = (await api(`panel/nginx/${selected.value}/preview`, config.value.configuration)).content; }); }
async function publish() {
  await act(async () => {
    await api(`panel/nginx/${selected.value}/publish`, { requestId, confirm: selected.value, expectedRevision: config.value.revision, configuration: config.value.configuration });
    hasChanges.value = false; publishOpen.value = false; emit('navigate', 'operations');
  });
}
async function importCertificate() {
  await act(async () => {
    await api('panel/certificates', { ...certificate, confirm: certificate.id });
    certificate.privateKeyPem = ''; certificate.certificatePem = ''; certificateOpen.value = false;
    certificates.value = await api('panel/certificates'); message.value = '证书已保存。选择对应网站并发布配置后生效。';
  });
}
function openCertificate() { Object.assign(certificate, { id: '', name: '', certificatePem: '', privateKeyPem: '' }); certificateOpen.value = true; }
function openAcme(site){const existing=automaticFor(site);Object.assign(acme,{siteId:site.id,email:existing?.email||'',provider:existing?.provider||'LetsEncrypt',directoryUrl:existing?.directoryUrl||'',rootCertificatePem:existing?.rootCertificatePem||'',autoRenew:existing?.autoRenew??true,acceptTerms:false,expectedAcmeRevision:existing?.revision||''});requestId=crypto.randomUUID();acmeOpen.value=true;}
async function issueAcme(){await act(async()=>{await api('panel/acme',{...acme,requestId,resourceId:selected.value,expectedRevision:config.value.revision,confirm:acme.siteId});acmeOpen.value=false;emit('navigate','operations');});}
async function toggleAcme(item){await act(async()=>{await api(`panel/acme/${item.id}/policy`,{revision:item.revision,enabled:!item.autoRenew,confirm:item.id});automatic.value=await api('panel/acme');});}
watch(certificateOpen, value => { if (!value) certificate.privateKeyPem = ''; });
watch(() => props.page, refresh, { immediate: true });
onUnmounted(() => { disposed = true; generation++; certificate.privateKeyPem = ''; });
</script>

<template>
  <section class="mci-nginx-workspace" data-mci-ui-root>
    <MciSkeleton v-if="loading" height="240px" />
    <template v-else-if="page === 'websites'">
      <MciCard v-if="!instances.length"><MciDataState title="先安装 Nginx" description="从插件市场选择版本与独立端口，再创建网站或反向代理。" /><MciButton @click="emit('navigate','market')">前往插件市场</MciButton></MciCard>
      <template v-else>
        <div class="mci-nginx-toolbar"><MciFormField label="Nginx 实例"><select v-model="selected" aria-label="Nginx 实例" class="mci-nginx-input" :disabled="busy || hasChanges" @change="act(loadSelected)"><option v-for="item in instances" :key="item.id" :value="item.id">{{ item.id }} · {{ item.version }}</option></select></MciFormField><span class="mci-nginx-muted">HTTP {{ config?.resource.ports.http }} / HTTPS {{ config?.resource.ports.https }}</span><MciButton :disabled="busy || !config" @click="edit(null)">＋ 创建网站</MciButton></div>
        <MciCard v-if="config"><div class="mci-nginx-heading"><div><h2>网站与反向代理</h2><p class="mci-nginx-muted">域名入口、代理路径和 HTTPS 集中配置。</p></div><div class="mci-nginx-actions"><MciButton variant="plain" :disabled="busy" @click="showPreview">预览配置</MciButton><MciButton :disabled="busy" @click="publishOpen = true">发布配置</MciButton></div></div>
          <p v-if="hasChanges" class="mci-nginx-notice">有尚未发布的修改。<MciButton variant="ghost" :disabled="busy" @click="act(loadSelected)">放弃修改并重新读取</MciButton></p>
          <div v-if="sites.length" class="mci-nginx-table-scroll"><table><thead><tr><th>网站</th><th>类型与上游</th><th>HTTPS</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="site in sites" :key="site.id"><td><strong>{{ site.name || site.id }}</strong><small>{{ site.domains.join('、') }}</small></td><td>{{ site.kind === 'Static' ? '静态网站' : '反向代理' }}<small v-for="route in site.routes" :key="route.prefix">{{ route.prefix }} → {{ route.upstream }}</small></td><td>{{ site.certificateId || '未启用' }}<small v-if="site.redirectHttps">自动跳转 HTTPS</small></td><td>{{ site.enabled ? '启用' : '停用' }}</td><td><div class="mci-nginx-actions"><MciButton variant="ghost" :disabled="busy" @click="edit(site)">编辑</MciButton><MciButton variant="ghost" :disabled="busy || hasChanges || !site.enabled" @click="openAcme(site)">自动证书</MciButton><MciButton variant="ghost" :disabled="busy" @click="deleteSite = site">移除</MciButton></div></td></tr></tbody></table></div>
          <MciDataState v-else title="还没有网站" description="可以代理吾码 API、管理系统或主机上的其它 Web 服务，也可以托管静态网站。" />
        </MciCard>
      </template>
    </template>
    <template v-else-if="page === 'certificates'">
      <MciCard><div class="mci-nginx-heading"><div><h2>SSL 证书</h2><p class="mci-nginx-muted">导入完整证书链与私钥，再绑定到网站。</p></div><MciButton @click="openCertificate">＋ 导入证书</MciButton></div>
        <div v-if="certificates.length" class="mci-nginx-table-scroll"><table><thead><tr><th>证书</th><th>主体</th><th>有效期</th><th>来源</th><th>操作</th></tr></thead><tbody><tr v-for="item in certificates" :key="item.id"><td><strong>{{ item.name || item.id }}</strong><small>{{ item.id }}</small></td><td>{{ item.subject }}</td><td>{{ formatTime(item.notAfter) }}<small>{{ new Date(item.notAfter) > new Date() ? '有效' : '已过期' }}</small></td><td>{{ item.source === 'Import' ? '手动导入' : item.source }}</td><td><MciButton variant="ghost" @click="openCertificate(); certificate.id = item.id; certificate.name = item.name">更新证书</MciButton></td></tr></tbody></table></div>
        <MciDataState v-else title="暂无证书" description="可以导入 CA 签发的证书，或导入内网使用的自签名证书。" />
      </MciCard>
          <MciCard v-if="automatic.length"><h2>自动签发与续期</h2><p class="mci-nginx-muted">证书客户端会按证书有效期和 CA 续期指引判断是否续期。暂停后，已经排队的任务继续执行。</p><div class="mci-nginx-table-scroll"><table><thead><tr><th>网站 / 证书</th><th>证书机构</th><th>下次检查</th><th>续期设置</th></tr></thead><tbody><tr v-for="item in automatic" :key="item.id"><td>{{ item.resourceId }} / {{ item.siteId }}<small>{{ item.domains.join('、') }}</small><small v-if="item.lastError">{{ item.lastError }}</small></td><td>{{ item.provider }}</td><td>{{ formatTime(item.nextCheck) }}</td><td><MciButton variant="plain" :disabled="busy" @click="toggleAcme(item)">{{ item.autoRenew ? '暂停自动续期' : '启用自动续期' }}</MciButton></td></tr></tbody></table></div></MciCard>
    </template>

    <MciModal :model-value="!!editor" :title="editor?.originalId ? '编辑网站' : '创建网站'" size="lg" @update:model-value="value => { if (!value && !busy) editor = null; }">
      <form v-if="editor" id="mci-nginx-site-form" class="mci-nginx-form" @submit.prevent="saveSite">
        <MciFormField v-model="form.id" label="网站标识" required :disabled="!!editor.originalId" placeholder="小写字母、数字或短横线" /><MciFormField v-model="form.name" label="网站名称" placeholder="例如：客户管理系统" />
        <MciFormField class="mci-nginx-wide" label="域名（每行一个）"><textarea v-model="form.domainsText" class="mci-nginx-input" rows="3" required placeholder="app.example.com" /></MciFormField>
        <MciFormField label="网站类型"><select v-model="form.kind" aria-label="网站类型" class="mci-nginx-input"><option value="Proxy">反向代理</option><option value="Static">静态网站</option></select></MciFormField><MciFormField label="上传大小上限（MiB）"><input v-model.number="form.maxBodyMb" type="number" min="1" max="1024" required /></MciFormField>
        <MciFormField label="SSL 证书"><select v-model="form.certificateId" aria-label="SSL 证书" class="mci-nginx-input"><option value="">不启用 HTTPS</option><option v-for="item in validCertificates" :key="item.id" :value="item.id">{{ item.name || item.id }}</option></select></MciFormField><MciFormField v-if="form.certificateId" label="外部 HTTPS 端口"><input v-model.number="form.httpsPublicPort" type="number" min="1" max="65535" required /></MciFormField>
        <label class="mci-nginx-check"><input v-model="form.enabled" type="checkbox" />启用网站</label><label class="mci-nginx-check"><input v-model="form.gzip" type="checkbox" />启用 Gzip</label>
        <label v-if="form.certificateId" class="mci-nginx-check"><input v-model="form.redirectHttps" type="checkbox" />HTTP 自动跳转 HTTPS</label><label v-if="form.kind === 'Static'" class="mci-nginx-check"><input v-model="form.spaFallback" type="checkbox" />单页应用回退到 index.html</label>
        <template v-if="form.kind === 'Proxy'">
          <div class="mci-nginx-wide mci-nginx-heading"><h3>代理规则</h3><MciButton variant="plain" @click="form.routes.push({ prefix: '/', upstream: '', stripPrefix: false, webSocket: true, timeoutSeconds: 300, verifyUpstreamCertificate: true })">＋ 添加路径</MciButton></div>
          <p class="mci-nginx-wide mci-nginx-muted">代理本机服务时使用 host.docker.internal，例如 http://host.docker.internal:8080。127.0.0.1 指向 Nginx 容器自身。</p>
          <div v-for="(route,index) in form.routes" :key="index" class="mci-nginx-wide mci-nginx-route"><MciFormField v-model="route.prefix" label="访问路径" required /><MciFormField v-model="route.upstream" label="上游地址" required placeholder="http://host.docker.internal:8080" /><MciFormField label="超时（秒）"><input v-model.number="route.timeoutSeconds" type="number" min="1" max="3600" required /></MciFormField><label class="mci-nginx-check"><input v-model="route.stripPrefix" type="checkbox" />移除路径前缀</label><label class="mci-nginx-check"><input v-model="route.webSocket" type="checkbox" />支持 WebSocket</label><label class="mci-nginx-check"><input v-model="route.verifyUpstreamCertificate" type="checkbox" />验证 HTTPS 上游证书</label><MciButton variant="ghost" :disabled="form.routes.length === 1" @click="form.routes.splice(index,1)">移除规则</MciButton></div>
        </template>
        <p v-else class="mci-nginx-wide mci-nginx-muted">静态文件保存在该 Nginx 实例的持久数据卷，可在文件管理中上传。</p>
      </form>
      <template #footer><MciButton variant="plain" :disabled="busy" @click="editor = null">取消</MciButton><MciButton type="submit" form="mci-nginx-site-form" :loading="busy" :disabled="busy">保存到待发布配置</MciButton></template>
    </MciModal>
    <MciModal v-model="acmeOpen" title="自动签发并启用 HTTPS" size="lg"><form id="mci-acme-form" class="mci-nginx-form" @submit.prevent="issueAcme"><p class="mci-nginx-wide mci-nginx-muted">签发后自动绑定 {{ acme.siteId }} 并平滑重载 Nginx。域名的公网 80 端口必须能访问本实例的 /.well-known/acme-challenge/；已有面板占用 80 时，可由它代理这一路径。</p><MciFormField v-model="acme.email" label="证书联系邮箱" type="email" required /><MciFormField label="证书机构"><select v-model="acme.provider" class="mci-nginx-input" aria-label="证书机构"><option value="LetsEncrypt">Let's Encrypt 正式</option><option value="LetsEncryptStaging">Let's Encrypt 测试</option><option value="Custom">自定义 ACME CA</option></select></MciFormField><template v-if="acme.provider==='Custom'"><MciFormField v-model="acme.directoryUrl" label="HTTPS Directory URL" class="mci-nginx-wide" required /><MciFormField label="自定义 CA 根证书 PEM（可选）" class="mci-nginx-wide"><textarea v-model="acme.rootCertificatePem" class="mci-nginx-input mci-nginx-code" rows="5" /></MciFormField></template><p v-if="acme.provider==='LetsEncryptStaging'" class="mci-nginx-wide mci-nginx-muted">测试证书不会被普通浏览器信任；用于先验证域名和签发流程。</p><label class="mci-nginx-wide mci-nginx-check"><input v-model="acme.autoRenew" type="checkbox" />启用自动续期检查</label><label class="mci-nginx-wide mci-nginx-check"><input v-model="acme.acceptTerms" type="checkbox" required />已阅读并接受证书机构的服务条款，同意向其提交此网站域名和联系邮箱</label></form><template #footer><MciButton variant="plain" :disabled="busy" @click="acmeOpen=false">取消</MciButton><MciButton type="submit" form="mci-acme-form" :disabled="busy || !acme.acceptTerms" :loading="busy">确认签发并启用</MciButton></template></MciModal>
    <MciModal v-model="certificateOpen" title="导入 SSL 证书" size="lg"><form id="mci-nginx-certificate-form" class="mci-nginx-form" @submit.prevent="importCertificate"><MciFormField v-model="certificate.id" label="证书标识" required /><MciFormField v-model="certificate.name" label="证书名称" /><MciFormField class="mci-nginx-wide" label="PEM 完整证书链"><textarea v-model="certificate.certificatePem" class="mci-nginx-input mci-nginx-code" rows="6" required spellcheck="false" placeholder="-----BEGIN CERTIFICATE-----" /></MciFormField><MciFormField class="mci-nginx-wide" label="PEM 私钥"><textarea v-model="certificate.privateKeyPem" class="mci-nginx-input mci-nginx-code" rows="6" required autocomplete="off" spellcheck="false" placeholder="-----BEGIN PRIVATE KEY-----" /></MciFormField></form><template #footer><MciButton variant="plain" :disabled="busy" @click="certificateOpen = false">取消</MciButton><MciButton type="submit" form="mci-nginx-certificate-form" :loading="busy" :disabled="busy">校验并保存</MciButton></template></MciModal>
    <MciModal :model-value="!!preview" title="Nginx 候选配置" size="lg" @update:model-value="preview = ''"><pre class="mci-nginx-code mci-nginx-preview">{{ preview }}</pre></MciModal>
    <MciModal v-model="publishOpen" title="发布网站配置"><p>将在 {{ selected }} 上校验并发布 {{ sites.length }} 个网站的配置，通过后平滑重载。进度可在操作任务中查看。</p><template #footer><MciButton variant="plain" :disabled="busy" @click="publishOpen = false">取消</MciButton><MciButton :loading="busy" :disabled="busy" @click="publish">确认发布</MciButton></template></MciModal>
    <MciModal :model-value="!!deleteSite" title="移除网站配置" @update:model-value="deleteSite = null"><p>从待发布配置移除 {{ deleteSite?.name || deleteSite?.id }}，发布后关闭该域名入口。网站文件保留。</p><template #footer><MciButton variant="plain" @click="deleteSite = null">取消</MciButton><MciButton @click="removeSite">确认移除</MciButton></template></MciModal>
    <MciModal :model-value="!!message" title="操作提示" @update:model-value="message = ''"><p role="alert">{{ message }}</p><template #footer><MciButton @click="message = ''">知道了</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
.mci-nginx-workspace { display:grid;gap:22px;min-width:0; }
.mci-nginx-heading,.mci-nginx-toolbar,.mci-nginx-actions { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap; }
.mci-nginx-toolbar > :first-child { min-width:220px; }.mci-nginx-heading { margin-bottom:18px; }.mci-nginx-heading h2,.mci-nginx-heading h3,.mci-nginx-heading p { margin:0; }
.mci-nginx-muted,small { color:var(--mci-text-secondary);font-size:13px; }small { display:block; }
.mci-nginx-table-scroll { overflow:auto; }.mci-nginx-table-scroll td { overflow-wrap:anywhere; }
.mci-nginx-form,.mci-nginx-route { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px; }.mci-nginx-wide { grid-column:1/-1; }.mci-nginx-route { padding:18px 0;border-top:1px solid var(--mci-border); }
.mci-nginx-input { width:100%;min-height:44px;padding:10px 12px;border:1px solid var(--mci-border-strong);border-radius:var(--mci-shape-input);background:var(--mci-bg-surface);color:var(--mci-text-primary);font:inherit;resize:vertical; }
.mci-nginx-check { display:flex;align-items:center;gap:8px; }.mci-nginx-notice { padding:14px 18px;border:1px solid var(--mci-border);border-radius:var(--mci-shape-card);background:var(--mci-bg-muted);display:flex;align-items:center;justify-content:space-between;gap:12px; }
.mci-nginx-code { font:12px/1.7 var(--mci-font-mono); }.mci-nginx-preview { max-height:55vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;background:var(--mci-bg-muted);padding:18px; }
@media(max-width:600px) { .mci-nginx-form,.mci-nginx-route { grid-template-columns:1fr; }.mci-nginx-toolbar > :first-child { min-width:0;width:100%; } }
</style>
