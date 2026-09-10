<script setup>
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciDataState, MciSkeleton } from '@microi/mci-ui';
import { api, formatTime, formatBytes } from './api.js';
const props = defineProps({ page: { type: String, required: true } });
const emit = defineEmits(['navigate']);
const catalog = ref([]), snapshot = ref(null), loading = ref(true), busy = ref(false), feedback = ref('');
const search = ref(''), category = ref('全部'), install = ref(null), selectedAction = ref(null), logs = ref(null);
const form = reactive({ name: '', version: '', bindAddress: '127.0.0.1', ports: {}, password: '', username: 'microi', database: 'microi', edition: 'Express', memoryMb: 0, acceptLicense: false, localOnly: false });
let requestId = '', polling = false, disposed = false;
const categories = computed(() => ['全部', ...new Set(catalog.value.map(x => x.category))]);
const filtered = computed(() => catalog.value.filter(x => (category.value === '全部' || x.category === category.value) && `${x.name} ${x.description}`.toLowerCase().includes(search.value.toLowerCase())));
const installed = computed(() => snapshot.value?.resources.filter(x => x.state !== 'Removed') || []);
const active = computed(() => snapshot.value?.operations.filter(x => ['Queued', 'Running'].includes(x.state)) || []);
const selectedVersion = computed(() => install.value?.versions.find(x => x.id === form.version));
const stateName = value => ({ Queued: '等待执行', Running: '正在执行', Succeeded: '已完成', Failed: '需处理', Installed: '已安装', Pending: '安装中', Stopped: '已停止', Removed: '已卸载，保留数据' }[value] || value);
const actionName = value => ({ Start: '启动', Stop: '停止', Restart: '重启', Uninstall: '卸载', Reinstall: '重新安装', Install: '安装', NginxPublish: '发布网站配置', AcmeIssue: '申请网站证书', AcmeRenew: '自动续期证书', FileWrite: '保存网站文件', FileMkdir: '创建网站目录', FileTrash: '回收网站文件', FileRestore: '恢复网站文件', Backup: '创建冷备份', RestoreBackup: '恢复完整备份', DeleteBackup: '删除备份文件' }[value] || value);
const isActive = id => active.value.some(x => x.resourceId === id);
const containerOf = resource => snapshot.value?.containers.find(x => x.id === resource.containerId);
const gib = value => value == null ? '暂不可用' : (value / 1073741824).toFixed(1) + ' GB';
function beginAction(resource, action) { selectedAction.value = { resource, action, id: crypto.randomUUID() }; }
async function refresh(initial = false) {
  if (polling || disposed) return;
  polling = true; if (initial) loading.value = true;
  try {
    if (!catalog.value.length) catalog.value = await api('panel/catalog');
    snapshot.value = await api('panel/snapshot');
  } catch (error) { feedback.value = error.message; }
  finally { polling = false; loading.value = false; }
}
async function act(fn) {
  if (busy.value) return;
  busy.value = true;
  try { await fn(); await refresh(); } catch (error) { feedback.value = error.message; }
  finally { busy.value = false; }
}
function openInstall(plugin) {
  install.value = plugin; requestId = crypto.randomUUID();
  Object.assign(form, { name: plugin.id, version: plugin.versions[0].id, bindAddress: '127.0.0.1', ports: Object.fromEntries(plugin.ports.map(x => [x.name, x.defaultHostPort])), password: '', username: 'microi', database: 'microi', edition: 'Express', memoryMb: plugin.memoryMb, acceptLicense: false, localOnly: false });
}
async function submitInstall() {
  await act(async () => {
    await api('panel/install', { ...form, pluginId: install.value.id, requestId, confirm: form.name });
    form.password = ''; install.value = null; emit('navigate', 'operations');
  });
}
async function submitAction() {
  await act(async () => {
    const { resource, action, id } = selectedAction.value;
    await api(`panel/resources/${resource.id}/actions`, { action, requestId: id, confirm: resource.id });
    selectedAction.value = null; emit('navigate', 'operations');
  });
}
async function showLogs(resource) { await act(async () => { logs.value = { title: resource.id, content: (await api(`panel/resources/${resource.id}/logs`)).content }; }); }
watch(() => props.page, () => refresh(!snapshot.value), { immediate: true });
watch(install, value => { if (!value) form.password = ''; });
const timer = setInterval(() => { if (!document.hidden && !busy.value && !install.value) refresh(); }, 4000);
onUnmounted(() => { disposed = true; clearInterval(timer); form.password = ''; });
</script>

<template>
  <section class="mci-panel-workspace" data-mci-ui-root>
    <div v-if="loading" class="mci-panel-grid" aria-busy="true" aria-label="加载服务器状态"><MciSkeleton v-for="n in 4" :key="n" height="180px" /></div>
    <template v-else-if="snapshot">
      <MciCard v-if="snapshot.dockerAvailable === false"><p role="status">{{ snapshot.dockerError }}</p><small>最近成功观测：{{ formatTime(snapshot.observedAt) }}</small></MciCard>
      <template v-if="page === 'server'">
        <div class="mci-panel-metrics">
          <MciCard><span class="mci-panel-muted">Docker 主机</span><strong>{{ snapshot.host.name || '暂不可用' }}</strong><small>{{ snapshot.host.os }} · {{ snapshot.host.cpus }} 核 · {{ snapshot.host.architecture }}</small></MciCard>
          <MciCard><span class="mci-panel-muted">主机 CPU 用量</span><strong>{{ snapshot.host.cpuPercent == null ? '采样中' : snapshot.host.cpuPercent.toFixed(1) + '%' }}</strong><small>两次观测间的各核平均使用率</small></MciCard>
          <MciCard><span class="mci-panel-muted">主机内存用量</span><strong>{{ gib(snapshot.host.memoryUsedBytes) }}</strong><small>总内存 {{ gib(snapshot.host.memoryBytes) }}</small></MciCard>
          <MciCard><span class="mci-panel-muted">面板数据磁盘可用空间</span><strong>{{ gib(snapshot.host.dataDiskAvailableBytes) }}</strong><small>所在文件系统总量 {{ gib(snapshot.host.dataDiskTotalBytes) }}</small></MciCard>
          <MciCard><span class="mci-panel-muted">已安装插件</span><strong>{{ installed.length }} <small>个</small></strong><small>{{ active.length }} 个操作正在执行</small></MciCard>
          <MciCard><span class="mci-panel-muted">Docker 引擎</span><strong>{{ snapshot.host.dockerVersion }}</strong><small>{{ snapshot.containers.length }} 个容器</small></MciCard>
        </div>
        <MciCard><div class="mci-panel-row"><div><h2>从插件市场开始</h2><p class="mci-panel-muted">安装数据库、对象存储和网站服务，集中查看状态与操作记录。</p></div><MciButton @click="emit('navigate', 'market')">＋ 安装服务</MciButton></div></MciCard>
        <MciCard v-if="snapshot.operations.some(x => x.state === 'Failed')"><h2>需要处理的操作</h2><article v-for="operation in snapshot.operations.filter(x => x.state === 'Failed')" :key="operation.id" class="mci-panel-operation"><strong>{{ operation.resourceId }} · {{ actionName(operation.action) }}</strong><p>{{ operation.error }}</p><MciButton variant="plain" @click="emit('navigate', 'operations')">查看操作记录</MciButton></article></MciCard>
      </template>

      <template v-if="page === 'market'">
        <div class="mci-panel-filter"><MciFormField v-model="search" label="搜索插件" placeholder="搜索数据库、存储或网站服务" /><MciFormField label="分类"><select v-model="category" class="mci-panel-select" aria-label="分类"><option v-for="item in categories" :key="item">{{ item }}</option></select></MciFormField></div>
        <div class="mci-panel-grid"><MciCard v-for="plugin in filtered" :key="plugin.id" class="mci-panel-plugin"><div class="mci-panel-row"><svg class="mci-panel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6h.01M7 17h.01M11 6h6M11 17h6"/></svg><span class="mci-panel-muted">{{ plugin.category }}</span></div><h2>{{ plugin.name }}</h2><p class="mci-panel-muted">{{ plugin.description }}</p><div class="mci-panel-row"><small>{{ plugin.versions.length }} 个可选版本</small><MciButton :disabled="busy" @click="openInstall(plugin)">＋ 安装</MciButton></div></MciCard></div>
        <MciDataState v-if="!filtered.length" title="没有匹配的插件" description="试试其它名称或分类。" />
      </template>

      <template v-if="page === 'services'">
        <MciCard v-if="snapshot.containers.some(x => x.managed && x.metrics)"><h2>受管容器资源用量</h2><p class="mci-panel-muted">CPU 按各核累计计算，100% 表示占用一个核心；网络为容器累计字节。</p><div class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>容器</th><th>CPU</th><th>内存 / 上限</th><th>接收 / 发送</th></tr></thead><tbody><tr v-for="container in snapshot.containers.filter(x => x.managed && x.metrics)" :key="container.id"><td>{{ container.name }}</td><td>{{ container.metrics.cpuPercent == null ? '采样中' : container.metrics.cpuPercent.toFixed(1) + '%' }}</td><td>{{ container.metrics.memoryBytes == null ? '暂不可用' : formatBytes(container.metrics.memoryBytes) }} / {{ container.metrics.memoryLimitBytes == null ? '暂不可用' : formatBytes(container.metrics.memoryLimitBytes) }}</td><td>{{ container.metrics.receivedBytes == null ? '暂不可用' : formatBytes(container.metrics.receivedBytes) }} / {{ container.metrics.sentBytes == null ? '暂不可用' : formatBytes(container.metrics.sentBytes) }}</td></tr></tbody></table></div></MciCard>
        <MciCard><div class="mci-panel-row"><h2>插件实例</h2><MciButton @click="emit('navigate', 'market')">＋ 安装插件</MciButton></div>
          <div v-if="snapshot.resources.length" class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>实例 / 版本</th><th>状态</th><th>访问端口</th><th>操作</th></tr></thead><tbody><tr v-for="resource in snapshot.resources" :key="resource.id"><td><strong>{{ resource.id }}</strong><small>{{ catalog.find(x => x.id === resource.pluginId)?.name }} · {{ resource.version }}</small></td><td>{{ stateName(resource.state) }}<small>{{ containerOf(resource)?.status || (resource.state === 'Removed' ? '数据卷已保留' : '等待容器就绪') }}</small></td><td><small v-for="(port, name) in resource.ports" :key="name">{{ name }} · {{ resource.bindAddress }}:{{ port }}</small></td><td><div v-if="resource.state !== 'Removed'" class="mci-panel-actions"><MciButton variant="ghost" :disabled="busy || !containerOf(resource)" @click="showLogs(resource)">日志</MciButton><MciButton v-for="action in ['Start','Stop','Restart','Uninstall']" :key="action" variant="ghost" :disabled="busy || isActive(resource.id) || !containerOf(resource)" @click="beginAction(resource, action)">{{ actionName(action) }}</MciButton></div><MciButton v-else variant="plain" :disabled="busy || isActive(resource.id)" @click="beginAction(resource, 'Reinstall')">重新安装</MciButton></td></tr></tbody></table></div>
          <MciDataState v-else title="尚未安装插件" description="在插件市场选择所需服务和版本。" />
        </MciCard>
        <MciCard><h2>主机容器</h2><p class="mci-panel-muted">显示同一 Docker 主机上的容器，未纳入本面板的服务仅展示状态。</p><div class="mci-panel-table-scroll"><table class="mci-panel-table"><thead><tr><th>容器</th><th>镜像</th><th>状态</th><th>归属</th></tr></thead><tbody><tr v-for="container in snapshot.containers" :key="container.id"><td>{{ container.name }}</td><td>{{ container.image }}</td><td>{{ container.status }}</td><td>{{ container.managed ? '本面板' : '外部服务' }}</td></tr></tbody></table></div></MciCard>
      </template>

      <template v-if="page === 'operations'">
        <MciCard><h2>安装与服务操作</h2><p class="mci-panel-muted">关闭页面不会中断任务。失败任务保留现场，可处理原因后继续。</p><article v-for="operation in snapshot.operations" :key="operation.id" class="mci-panel-operation"><div class="mci-panel-row"><strong>{{ operation.resourceId }} · {{ actionName(operation.action) }}</strong><span>{{ stateName(operation.state) }}</span></div><p>{{ operation.phase }}</p><p v-if="operation.error" class="mci-panel-error">{{ operation.error }}</p><div class="mci-panel-row"><small>{{ formatTime(operation.created) }} · {{ operation.actor }}</small><MciButton v-if="operation.state === 'Failed'" variant="plain" :disabled="busy || isActive(operation.resourceId)" @click="act(() => api(`panel/operations/${operation.id}/retry`, { confirm: operation.id }))">↻ 继续执行</MciButton></div></article><MciDataState v-if="!snapshot.operations.length" title="暂无操作记录" description="安装、启停和卸载插件后，会在这里显示进度与结果。" /></MciCard>
      </template>
    </template>
    <MciDataState v-else title="暂时无法读取主机" description="请检查 Docker 服务和面板连接后重试。"><MciButton @click="refresh(true)">↻ 重试</MciButton></MciDataState>

    <MciModal :model-value="!!install" :title="`安装 ${install?.name || ''}`" size="lg" :close-on-mask="false" @update:model-value="value => { if (!value && !busy) install = null; }">
      <form v-if="install" id="mci-panel-install-form" class="mci-panel-form" @submit.prevent="submitInstall">
        <MciFormField v-model="form.name" label="实例名称" required /><MciFormField label="版本"><select v-model="form.version" class="mci-panel-select" aria-label="版本"><option v-for="version in install.versions" :key="version.id" :value="version.id">{{ version.id }} · {{ version.architectures.join(' / ') }}</option></select></MciFormField>
        <p v-if="selectedVersion?.note" class="mci-panel-wide mci-panel-muted" role="note">{{ selectedVersion.note }}</p>
        <MciFormField v-model="form.bindAddress" label="主机监听地址" /><MciFormField label="内存上限（MiB）"><input v-model.number="form.memoryMb" type="number" :min="install.memoryMb" max="16384" required /></MciFormField>
        <MciFormField v-for="port in install.ports" :key="port.name" :label="`${port.name} 主机端口 → ${port.containerPort}`"><input v-model.number="form.ports[port.name]" type="number" min="1" max="65535" required /></MciFormField>
        <template v-if="install.requiresPassword"><MciFormField v-if="['postgresql','mongodb','minio'].includes(install.id)" v-model="form.username" label="服务账号" required /><MciFormField v-if="['mysql','postgresql'].includes(install.id)" v-model="form.database" label="初始数据库" required /><MciFormField v-model="form.password" label="服务密码（至少12位）" type="password" required /></template>
        <MciFormField v-if="install.id === 'sqlserver'" label="SQL Server 类型"><select v-model="form.edition" class="mci-panel-select" aria-label="SQL Server 类型"><option>Express</option><option>Developer</option><option>Standard</option><option>Enterprise</option></select></MciFormField>
        <p v-if="install.id === 'sqlserver'" class="mci-panel-wide mci-panel-muted">Developer 仅适用于开发测试；Standard 和 Enterprise 需要已有的相应授权。</p>
        <label v-if="install.licenseUrl" class="mci-panel-wide mci-panel-check"><input v-model="form.acceptLicense" type="checkbox" required />我已阅读并接受 <a :href="install.licenseUrl" target="_blank" rel="noopener noreferrer">原厂使用许可</a></label>
        <label class="mci-panel-wide mci-panel-check"><input v-model="form.localOnly" type="checkbox" />仅使用已导入的本地镜像</label>
        <p class="mci-panel-wide mci-panel-muted">默认监听 127.0.0.1，仅主机可连接。需要外部访问时请填写主机地址或 0.0.0.0，并按实际访问范围配置网络入口。数据使用独立持久卷保存。</p>
      </form>
      <template #footer><MciButton variant="plain" :disabled="busy" @click="install = null">取消</MciButton><MciButton type="submit" form="mci-panel-install-form" :loading="busy" :disabled="busy">＋ 确认安装</MciButton></template>
    </MciModal>
    <MciModal :model-value="!!selectedAction" :title="`${actionName(selectedAction?.action)} ${selectedAction?.resource.id || ''}`" @update:model-value="value => { if (!value && !busy) selectedAction = null; }"><p v-if="selectedAction?.action === 'Uninstall'">卸载容器并停止服务，持久数据卷保留。此操作会中断该服务。</p><p v-else-if="selectedAction?.action === 'Reinstall'">使用保留的数据卷和原镜像重新创建此实例，原版本、账号和网站配置继续保留。</p><p v-else>将在当前主机对这个插件实例执行{{ actionName(selectedAction?.action) }}操作。</p><template #footer><MciButton variant="plain" :disabled="busy" @click="selectedAction = null">取消</MciButton><MciButton :disabled="busy" :loading="busy" @click="submitAction">确认{{ actionName(selectedAction?.action) }}</MciButton></template></MciModal>
    <MciModal :model-value="!!logs" :title="`${logs?.title || ''} · 容器日志`" size="lg" @update:model-value="logs = null"><pre class="mci-panel-log">{{ logs?.content }}</pre></MciModal>
    <MciModal :model-value="!!feedback" title="操作提示" @update:model-value="feedback = ''"><p role="alert">{{ feedback }}</p><template #footer><MciButton @click="feedback = ''">知道了</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
.mci-panel-workspace { display: grid; gap: 22px; min-width: 0; }
.mci-panel-grid, .mci-panel-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 18px; }
.mci-panel-metrics { grid-template-columns:repeat(3,minmax(0,1fr)); }
.mci-panel-metrics strong { display: block; font-size: 24px; margin: 12px 0; overflow-wrap: anywhere; }
.mci-panel-metrics small, .mci-panel-table small { display: block; font-size: 12px; color: var(--mci-text-secondary); }
.mci-panel-muted { color: var(--mci-text-secondary); }.mci-panel-error { color: var(--mci-color-danger); }
.mci-panel-plugin { display: flex; flex-direction: column; gap: 14px; }.mci-panel-plugin p { flex: 1; font-size: 13px; }.mci-panel-plugin h2 { margin: 0; }
.mci-panel-row, .mci-panel-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.mci-panel-actions { flex-wrap: wrap; justify-content: flex-start; gap: 4px; }
.mci-panel-icon { width: 34px; height: 34px; color: var(--mci-color-primary); }
.mci-panel-filter { display: grid; grid-template-columns: minmax(200px,440px) 180px; gap: 16px; }
.mci-panel-select { width: 100%; min-height: 44px; padding: 8px 12px; border: 1px solid var(--mci-border-strong); border-radius: var(--mci-shape-input); background: var(--mci-bg-surface); color: var(--mci-text-primary); font: inherit; }
.mci-panel-table-scroll { overflow: auto; }.mci-panel-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }.mci-panel-table th, .mci-panel-table td { padding: 14px 10px; border-bottom: 1px solid var(--mci-border); overflow-wrap: anywhere; }
.mci-panel-operation { padding: 18px 0; border-bottom: 1px solid var(--mci-border); }.mci-panel-operation p { margin: 10px 0; }
.mci-panel-form { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 18px; }.mci-panel-wide { grid-column: 1/-1; }.mci-panel-check { display: flex; align-items: center; gap: 10px; }
.mci-panel-log { max-height: 55vh; white-space: pre-wrap; overflow-wrap: anywhere; overflow: auto; font: 12px/1.7 var(--mci-font-mono); background: var(--mci-bg-muted); padding: 18px; }
@media(max-width:1200px) { .mci-panel-grid,.mci-panel-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media(max-width:600px) { .mci-panel-grid,.mci-panel-metrics,.mci-panel-form,.mci-panel-filter { grid-template-columns: 1fr; }.mci-panel-row { flex-wrap: wrap; } }
</style>
