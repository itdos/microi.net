<script setup>
import { computed, onMounted, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciDataState, MciSkeleton } from '@microi/mci-ui';
import { api, formatBytes, formatTime } from './api.js';
const emit=defineEmits(['navigate']);
const resources=ref([]),selected=ref(''),backups=ref([]),busy=ref(false),loading=ref(true),message=ref(''),createOpen=ref(false),restore=ref(null),remove=ref(null),allow=ref(false),maximumGiB=ref(10);
let requestId='';
const visible=computed(()=>backups.value.filter(x=>x.resourceId===selected.value));
async function act(fn){if(busy.value)return;busy.value=true;try{await fn();}catch(error){message.value=error.message;}finally{busy.value=false;}}
async function refresh(){const snapshot=await api('panel/snapshot');resources.value=snapshot.resources.filter(x=>!['Pending','Removed'].includes(x.state));if(!resources.value.some(x=>x.id===selected.value))selected.value=resources.value[0]?.id||'';backups.value=await api('panel/backups');}
function openCreate(){allow.value=false;maximumGiB.value=10;requestId=crypto.randomUUID();createOpen.value=true;}
function openRestore(backup){allow.value=false;restore.value=backup;requestId=crypto.randomUUID();}
function openRemove(backup){remove.value=backup;requestId=crypto.randomUUID();}
async function create(){await act(async()=>{await api(`panel/resources/${selected.value}/backups`,{requestId,confirm:selected.value,allowInterruption:allow.value,maximumGiB:maximumGiB.value});createOpen.value=false;emit('navigate','operations');});}
async function restoreBackup(){await act(async()=>{await api(`panel/resources/${restore.value.resourceId}/restore`,{requestId,backupId:restore.value.id,confirm:restore.value.resourceId,allowInterruption:allow.value});restore.value=null;emit('navigate','operations');});}
async function removeBackup(){await act(async()=>{await api(`panel/backups/${remove.value.id}/delete`,{confirm:remove.value.id,requestId});remove.value=null;emit('navigate','operations');});}
onMounted(async()=>{await act(refresh);loading.value=false;});
</script>
<template>
 <section class="mci-backups" data-mci-ui-root>
  <MciSkeleton v-if="loading" height="240px" />
  <MciCard v-else-if="!resources.length"><MciDataState title="先安装需要备份的服务" description="数据库、对象存储和网站数据均可创建冷备份。" /><MciButton @click="emit('navigate','market')">前往插件市场</MciButton></MciCard>
  <MciCard v-else><div class="mci-backups-toolbar"><MciFormField label="备份实例"><select v-model="selected" aria-label="备份实例" :disabled="busy"><option v-for="item in resources" :key="item.id" :value="item.id">{{ item.id }} · {{ item.version }}</option></select></MciFormField><div class="mci-backups-actions"><MciButton variant="plain" :disabled="busy" @click="act(refresh)">刷新备份</MciButton><MciButton :disabled="busy" @click="openCreate">创建冷备份</MciButton></div></div>
   <h2>备份与恢复</h2><p>备份时暂时停止此服务，完成后恢复原运行状态。恢复使用独立新卷，原容器和原数据卷保留。</p>
   <p>此处保存在本机的备份不能抵御整台主机或磁盘丢失；可下载归档到独立存储。</p>
   <div v-if="visible.length" class="mci-backups-table"><table><thead><tr><th>时间 / 版本</th><th>状态 / 大小</th><th>内容校验</th><th>操作</th></tr></thead><tbody><tr v-for="backup in visible" :key="backup.id"><td>{{ formatTime(backup.created) }}<small>{{ backup.pluginId }} · {{ backup.version }}</small></td><td>{{ backup.state === 'Ready' ? '已校验' : '准备中或需处理' }}<small>{{ formatBytes(backup.size) }}</small></td><td><code :title="backup.sha256">{{ backup.sha256 ? backup.sha256.slice(0,16) + '…' : '尚未生成' }}</code></td><td><div class="mci-backups-actions"><template v-if="backup.state==='Ready'"><a :href="`/ops-api/panel/backups/${backup.id}/download`" download>下载归档</a><MciButton variant="plain" :disabled="busy" @click="openRestore(backup)">恢复备份</MciButton></template><MciButton v-else variant="ghost" @click="emit('navigate','operations')">查看任务</MciButton><MciButton variant="ghost" :disabled="busy" @click="openRemove(backup)">删除备份</MciButton></div></td></tr></tbody></table></div>
   <MciDataState v-else title="还没有备份" description="首次维护、版本更新或重大配置变更前，先保存一份可验证备份。" />
  </MciCard>
  <MciModal v-model="createOpen" title="创建冷备份"><form id="mci-backup-create" class="mci-backups-form" @submit.prevent="create"><p>将暂时停止 {{ selected }}，备份数据卷后恢复原运行状态。备份较大时停机时间会延长。</p><MciFormField label="备份容量上限（GiB）"><input v-model.number="maximumGiB" aria-label="备份容量上限（GiB）" type="number" min="1" max="100" required /></MciFormField><label class="mci-backups-check"><input v-model="allow" type="checkbox" required />已确认此服务可以暂时中断</label></form><template #footer><MciButton variant="plain" :disabled="busy" @click="createOpen=false">取消</MciButton><MciButton type="submit" form="mci-backup-create" :disabled="busy || !allow" :loading="busy">确认创建备份</MciButton></template></MciModal>
  <MciModal :model-value="!!restore" title="恢复完整备份" @update:model-value="value=>{if(!value&&!busy)restore=null;}"><form id="mci-backup-restore" @submit.prevent="restoreBackup"><p>将 {{ restore?.resourceId }} 恢复到 {{ formatTime(restore?.created) }} 的数据与 {{ restore?.version }} 版本。备份后的新增数据保留在原卷中，新服务使用备份内容。</p><label class="mci-backups-check"><input v-model="allow" type="checkbox" required />已确认切换备份内容与服务中断</label></form><template #footer><MciButton variant="plain" :disabled="busy" @click="restore=null">取消</MciButton><MciButton type="submit" form="mci-backup-restore" :disabled="busy || !allow" :loading="busy">确认恢复备份</MciButton></template></MciModal>
  <MciModal :model-value="!!remove" title="删除备份文件" @update:model-value="value=>{if(!value&&!busy)remove=null;}"><p>将永久删除 {{ remove?.resourceId }} 在 {{ formatTime(remove?.created) }} 创建的此份备份文件。运行数据和其它备份保持不变。</p><template #footer><MciButton variant="plain" :disabled="busy" @click="remove=null">取消</MciButton><MciButton :disabled="busy" :loading="busy" @click="removeBackup">确认删除备份</MciButton></template></MciModal>
  <MciModal :model-value="!!message" title="备份操作提示" @update:model-value="value=>{if(!value)message='';}"><p role="alert">{{ message }}</p><template #footer><MciButton @click="message=''">知道了</MciButton></template></MciModal>
 </section>
</template>
<style scoped>
.mci-backups { display:grid;gap:20px;min-width:0; }.mci-backups-toolbar,.mci-backups-actions { display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap; }.mci-backups-actions { justify-content:flex-start; }.mci-backups p,.mci-backups small { color:var(--mci-text-secondary);overflow-wrap:anywhere; }.mci-backups small { display:block;margin-top:6px; }.mci-backups a { color:var(--mci-text-link,var(--mci-color-primary));text-decoration:underline; }.mci-backups-table { overflow:auto; }.mci-backups table { width:100%;min-width:650px;border-collapse:collapse; }.mci-backups th,.mci-backups td { text-align:left;padding:12px;border-bottom:1px solid var(--mci-border-default); }.mci-backups select { padding:10px;min-width:220px;color:var(--mci-text-primary);background:var(--mci-surface-card);border:1px solid var(--mci-border-default);border-radius:var(--mci-radius-control); }.mci-backups-form { display:grid;gap:16px; }.mci-backups-check { display:flex;align-items:center;gap:8px;padding:12px 0;line-height:1.6; }
</style>
