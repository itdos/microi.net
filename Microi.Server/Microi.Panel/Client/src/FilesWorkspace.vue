<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciDataState, MciSkeleton } from '@microi/mci-ui';
import { api, formatBytes, formatTime } from './api.js';
const emit = defineEmits(['navigate']);
const instances = ref([]), instance = ref(''), sites = ref([]), site = ref(''), directory = ref(''), listing = ref({ entries: [], total: 0 });
const loading = ref(true), busy = ref(false), message = ref(''), operation = ref(null), editor = ref(null), uploadOpen = ref(false), mkdirOpen = ref(false), remove = ref(null), historyOpen = ref(false), history = ref([]), restore = ref(null);
const form = reactive({ path: '', text: '', expectedHash: '', bytes: null }), folder = ref('');
let disposed = false, generation = 0, previousRequest = null;
const siteBase = computed(() => `panel/nginx/${encodeURIComponent(instance.value)}/sites/${encodeURIComponent(site.value)}`);
const resourceBase = computed(() => `panel/nginx/${encodeURIComponent(instance.value)}`);
const currentSite = computed(() => sites.value.find(x => x.id === site.value));
const pathWithin = name => directory.value ? `${directory.value}/${name}` : name;
const download = path => `/ops-api/${siteBase.value}/download?path=${encodeURIComponent(path)}`;
async function act(fn) { if (busy.value) return; busy.value = true; message.value = ''; try { await fn(); } catch (error) { message.value = error.message; } finally { busy.value = false; } }
async function loadDirectory(path = directory.value) {
  if (!site.value) { listing.value = { entries: [], total: 0 }; return; }
  const ticket = ++generation, base = siteBase.value;
  const value = await api(`${base}/files?path=${encodeURIComponent(path)}`);
  if (!disposed && ticket === generation) { directory.value = path; listing.value = value; }
}
async function loadInstance() {
  sites.value = instance.value ? (await api(`${resourceBase.value}`)).configuration.sites : [];
  if (!sites.value.some(x => x.id === site.value)) site.value = sites.value[0]?.id || '';
  await loadDirectory('');
}
async function refresh() {
  const snapshot = await api('panel/snapshot');
  instances.value = snapshot.resources.filter(x => x.pluginId === 'nginx' && x.state !== 'Removed');
  if (!instances.value.some(x => x.id === instance.value)) instance.value = instances.value[0]?.id || '';
  await loadInstance();
}
function resetForm(path = '') { Object.assign(form, { path, text: '', expectedHash: '', bytes: null }); previousRequest = null; }
function createFile() { resetForm(pathWithin('index.html')); editor.value = { existing: false }; }
async function editFile(entry) {
  await act(async () => {
    const value = await api(`${siteBase.value}/file?path=${encodeURIComponent(entry.path)}`);
    if (!value.editable) throw new Error('此文件不是可编辑的 UTF-8 文本，或超过 512 KiB；请下载后编辑，再上传替换。');
    resetForm(entry.path); form.text = value.text; form.expectedHash = value.hash; editor.value = { existing: true };
  });
}
async function selectedFile(event) {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 20 * 1024 * 1024) { event.target.value = ''; message.value = '单个文件不能超过 20 MiB。'; return; }
  await act(async () => { form.bytes = new Uint8Array(await file.arrayBuffer()); form.path = pathWithin(file.name); form.expectedHash = ''; });
}
function encode(bytes) {
  // 分块转换，避免大文件展开参数触发浏览器栈溢出。
  let value = ''; for (let index = 0; index < bytes.length; index += 16384) value += String.fromCharCode(...bytes.subarray(index, index + 16384));
  return btoa(value);
}
async function currentHash(path) {
  try { return (await api(`${siteBase.value}/file?path=${encodeURIComponent(path)}`)).hash; }
  catch (error) { if (error.status === 404) return ''; throw error; }
}
async function mutate(action, path, expectedHash = '', bytes = null, sourceOperationId = '') {
  const body = { siteId: site.value, path, action, expectedHash, contentBase64: bytes ? encode(bytes) : '', sourceOperationId, confirm: path };
  // 响应丢失时沿用请求编号；用户改动内容后才开始新的逻辑操作。
  const key = JSON.stringify(body);
  if (previousRequest?.key !== key) previousRequest = { key, requestId: crypto.randomUUID() };
  let result = await api(`${resourceBase.value}/files`, { ...body, requestId: previousRequest.requestId }); operation.value = result;
  while (!disposed && ['Queued', 'Running'].includes(result.state)) {
    await new Promise(resolve => setTimeout(resolve, 600)); result = await api(`panel/operations/${result.id}`); operation.value = result;
  }
  if (disposed) return;
  if (result.state !== 'Succeeded') throw new Error(result.error || '操作尚未成功，请在操作任务中查看。');
  editor.value = null; uploadOpen.value = false; mkdirOpen.value = false; remove.value = null; restore.value = null; form.bytes = null; form.text = ''; previousRequest = null;
  await loadDirectory(); if (historyOpen.value) history.value = await api(`${siteBase.value}/history`);
}
async function saveText() { await act(() => mutate('Write', form.path, form.expectedHash, new TextEncoder().encode(form.text))); }
async function saveUpload() {
  await act(async () => {
    if (!form.bytes) throw new Error('请先选择要上传的文件。');
    // 第一次点击只读取当前版本并要求明确确认覆盖，避免上传同名文件静默覆盖。
    const hash = await currentHash(form.path);
    if (hash && !form.expectedHash) { form.expectedHash = hash; throw new Error('同名文件已存在。原文件将保留在历史版本中；再次点击“上传文件”确认替换。'); }
    await mutate('Write', form.path, form.expectedHash, form.bytes);
  });
}
async function prepareRemove(entry) { await act(async () => { remove.value = { ...entry, hash: await currentHash(entry.path) }; previousRequest = null; }); }
async function showHistory() { await act(async () => { history.value = await api(`${siteBase.value}/history`); historyOpen.value = true; }); }
async function prepareRestore(entry) { await act(async () => { restore.value = { ...entry, hash: await currentHash(entry.path) }; previousRequest = null; }); }
onMounted(async () => { await act(refresh); loading.value = false; });
onUnmounted(() => { disposed = true; generation++; form.bytes = null; form.text = ''; });
</script>

<template>
  <section class="mci-files" data-mci-ui-root>
    <MciSkeleton v-if="loading" height="240px" />
    <MciCard v-else-if="!instances.length"><MciDataState title="先安装 Nginx 并创建网站" description="网站文件保存在独立数据卷内，可上传、编辑、下载并恢复历史版本。" /><MciButton @click="emit('navigate','market')">前往插件市场</MciButton></MciCard>
    <template v-else>
      <div class="mci-files-toolbar"><MciFormField label="文件管理实例"><select v-model="instance" aria-label="文件管理实例" :disabled="busy" @change="act(loadInstance)"><option v-for="item in instances" :key="item.id" :value="item.id">{{ item.id }}</option></select></MciFormField><MciFormField label="文件管理网站"><select v-model="site" aria-label="文件管理网站" :disabled="busy || !sites.length" @change="act(() => loadDirectory(''))"><option v-for="item in sites" :key="item.id" :value="item.id">{{ item.name || item.id }}</option></select></MciFormField><MciButton variant="plain" :disabled="busy" @click="act(() => loadDirectory())">刷新文件</MciButton></div>
      <MciCard v-if="!sites.length"><MciDataState title="此实例还没有已发布网站" description="先在网站与反向代理中创建网站并发布配置。" /><MciButton @click="emit('navigate','websites')">管理网站</MciButton></MciCard>
      <MciCard v-else>
        <div class="mci-files-toolbar"><div><h2>网站文件</h2><p>{{ currentSite?.name || site }} · /{{ directory }}</p></div><div class="mci-files-actions"><MciButton variant="plain" :disabled="busy" @click="showHistory">历史版本与回收</MciButton><MciButton variant="plain" :disabled="busy" @click="folder = ''; mkdirOpen = true; previousRequest = null">新建目录</MciButton><MciButton variant="plain" :disabled="busy" @click="createFile">新建文本</MciButton><MciButton :disabled="busy" @click="resetForm(); uploadOpen = true">上传文件</MciButton></div></div>
        <p class="mci-files-muted">单个文件最大 20 MiB，在线文本编辑最大 512 KiB。覆盖或移除文件前会保留原副本。</p>
        <MciButton v-if="directory" variant="ghost" :disabled="busy" @click="act(() => loadDirectory(directory.split('/').slice(0,-1).join('/')))">↑ 返回上级目录</MciButton>
        <div v-if="listing.entries.length" class="mci-files-table"><table><thead><tr><th>名称</th><th>大小</th><th>修改时间</th><th>操作</th></tr></thead><tbody><tr v-for="entry in listing.entries" :key="entry.path"><td><MciButton v-if="entry.directory && !entry.link" variant="ghost" :disabled="busy" @click="act(() => loadDirectory(entry.path))">📁 {{ entry.name }}</MciButton><span v-else>{{ entry.name }}{{ entry.link ? '（链接不可访问）' : '' }}</span></td><td>{{ entry.directory ? '目录' : formatBytes(entry.size) }}</td><td>{{ formatTime(entry.modified) }}</td><td><div v-if="!entry.directory && !entry.link" class="mci-files-actions"><a :href="download(entry.path)" download>下载</a><MciButton variant="ghost" :disabled="busy" @click="editFile(entry)">编辑</MciButton><MciButton variant="ghost" :disabled="busy" @click="prepareRemove(entry)">移入回收</MciButton></div></td></tr></tbody></table></div>
        <MciDataState v-else title="目录为空" description="上传网站文件，或新建 index.html 开始使用。" />
        <p v-if="listing.total > 200" role="status">此目录共 {{ listing.total }} 项，本页显示前 200 项；请按目录整理文件。</p>
        <p v-if="operation" role="status">最近操作：{{ operation.state === 'Succeeded' ? '已完成' : operation.state === 'Failed' ? '未完成' : operation.phase || '等待执行' }} <MciButton variant="ghost" @click="emit('navigate','operations')">查看操作任务</MciButton></p>
      </MciCard>
    </template>
    <MciModal :model-value="!!editor" :title="editor?.existing ? '编辑文件' : '新建文本文件'" size="lg" @update:model-value="value => { if (!value && !busy) editor = null; }"><form v-if="editor" id="mci-file-text" class="mci-files-form" @submit.prevent="saveText"><MciFormField v-model="form.path" label="文件路径" required :disabled="editor.existing" /><MciFormField label="文件内容"><textarea v-model="form.text" aria-label="文件内容" rows="18" spellcheck="false" /></MciFormField><p v-if="busy" role="status">{{ operation?.phase || '正在提交' }}</p></form><template #footer><MciButton variant="plain" :disabled="busy" @click="editor = null">取消</MciButton><MciButton type="submit" form="mci-file-text" :loading="busy" :disabled="busy">保存文件</MciButton></template></MciModal>
    <MciModal v-model="uploadOpen" title="上传网站文件" :close-on-escape="!busy"><form id="mci-file-upload" class="mci-files-form" @submit.prevent="saveUpload"><MciFormField label="选择上传文件"><input type="file" aria-label="选择上传文件" :disabled="busy" required @change="selectedFile" /></MciFormField><MciFormField v-model="form.path" label="保存路径" required :disabled="busy" /><p v-if="form.expectedHash">已确认同名文件，将保存原文件历史版本后替换。</p></form><template #footer><MciButton variant="plain" :disabled="busy" @click="uploadOpen = false">取消</MciButton><MciButton type="submit" form="mci-file-upload" :loading="busy" :disabled="busy || !form.bytes">上传文件</MciButton></template></MciModal>
    <MciModal v-model="mkdirOpen" title="新建网站目录" :close-on-escape="!busy"><form id="mci-file-mkdir" @submit.prevent="act(() => mutate('Mkdir', pathWithin(folder)))"><MciFormField v-model="folder" label="目录名称" required /></form><template #footer><MciButton variant="plain" :disabled="busy" @click="mkdirOpen = false">取消</MciButton><MciButton type="submit" form="mci-file-mkdir" :loading="busy" :disabled="busy">创建目录</MciButton></template></MciModal>
    <MciModal :model-value="!!remove" title="移入回收" @update:model-value="value => { if (!value && !busy) remove = null; }"><p>将移除网站中的 {{ remove?.path }}，网站访问会立即受影响。原文件可从“历史版本与回收”恢复。</p><template #footer><MciButton variant="plain" :disabled="busy" @click="remove = null">取消</MciButton><MciButton :loading="busy" :disabled="busy" @click="act(() => mutate('Trash', remove.path, remove.hash))">确认移入回收</MciButton></template></MciModal>
    <MciModal v-model="historyOpen" title="历史版本与回收" size="lg"><p>显示当前实例最近 100 次操作中保留的原文件副本；恢复会再次保留当前文件。</p><div v-if="history.length" class="mci-files-history"><article v-for="entry in history" :key="entry.operationId"><div><strong>{{ entry.path }}</strong><small>{{ formatTime(entry.created) }} · {{ formatBytes(entry.size) }} · {{ entry.actor }}</small></div><MciButton variant="plain" :disabled="busy" @click="prepareRestore(entry)">恢复此版本</MciButton></article></div><MciDataState v-else title="暂无历史副本" description="覆盖或移除已有文件后，会在这里显示原文件。" /></MciModal>
    <MciModal :model-value="!!restore" title="恢复文件版本" @update:model-value="value => { if (!value && !busy) restore = null; }"><p>将 {{ restore?.path }} 恢复到 {{ formatTime(restore?.created) }} 操作前的内容。</p><template #footer><MciButton variant="plain" :disabled="busy" @click="restore = null">取消</MciButton><MciButton :disabled="busy" :loading="busy" @click="act(() => mutate('Restore', restore.path, restore.hash, null, restore.operationId))">确认恢复文件</MciButton></template></MciModal>
    <MciModal :model-value="!!message" title="文件操作提示" @update:model-value="value => { if (!value) message = ''; }"><p role="alert">{{ message }}</p><template #footer><MciButton @click="message = ''">知道了</MciButton></template></MciModal>
  </section>
</template>

<style scoped>
.mci-files { display:grid;gap:20px;min-width:0; }.mci-files h2 { margin-top:0; }.mci-files p,.mci-files small { color:var(--mci-text-secondary);overflow-wrap:anywhere; }
.mci-files-toolbar,.mci-files-actions { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px; }.mci-files-toolbar { margin-bottom:16px; }.mci-files-actions { justify-content:flex-start;gap:8px; }.mci-files-toolbar>.mci-web-form-field { min-width:200px; }
.mci-files select,.mci-files-form textarea { width:100%;box-sizing:border-box;background:var(--mci-surface-card);color:var(--mci-text-primary);border:1px solid var(--mci-border-default);border-radius:var(--mci-radius-control);padding:10px; }.mci-files-form { display:grid;gap:16px; }.mci-files-form textarea { font-family:ui-monospace,monospace;resize:vertical;line-height:1.6; }
.mci-files-table { max-width:100%;overflow:auto; }.mci-files-table table { border-collapse:collapse;width:100%;min-width:590px; }.mci-files-table th,.mci-files-table td { padding:12px;text-align:left;border-bottom:1px solid var(--mci-border-default);overflow-wrap:anywhere;max-width:340px; }.mci-files a { color:var(--mci-text-link,var(--mci-color-primary));text-decoration:underline; }
.mci-files-history { display:grid;gap:12px; }.mci-files-history article { display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--mci-border-default); }.mci-files-history small { display:block;overflow-wrap:anywhere;margin-top:8px;color:var(--mci-text-secondary); }
@media(max-width:600px) { .mci-files-toolbar>.mci-web-form-field { width:100%;min-width:0; }.mci-files-actions { gap:6px; } }
</style>
