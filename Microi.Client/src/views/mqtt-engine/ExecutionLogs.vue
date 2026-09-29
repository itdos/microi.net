<template>
  <section ref="root" class="mqtt-logs">
    <div class="mqtt-logs__toolbar">
      <el-date-picker v-model="month" type="month" value-format="YYYYMM" format="YYYY年MM月" :clearable="false" aria-label="MQTT 日志月份" @change="reset" />
      <el-switch v-model="history" active-text="历史与兜底记录" inactive-text="运行日志" @change="reset" />
      <el-button :loading="loading" @click="reset">刷新</el-button>
      <span>{{ source ? `来源：${source}` : 'MQTT 运行日志' }}</span>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table v-mci-loading:table="loading" :data="rows" :empty-text="error ? '日志读取失败' : (loading ? '正在读取日志' : '本月暂无日志')" row-key="Id" max-height="480">
      <el-table-column prop="CreateTime" label="时间" min-width="180" />
      <el-table-column label="类型" min-width="120"><template #default="scope">{{ scope.row.Type || scope.row.Action }}</template></el-table-column>
      <el-table-column label="设备" min-width="150"><template #default="scope">{{ scope.row.TargetId || scope.row.ClientId || '—' }}</template></el-table-column>
      <el-table-column prop="Api" label="Topic" min-width="180" show-overflow-tooltip />
      <el-table-column label="数据" min-width="260" show-overflow-tooltip>
        <template #default="scope"><pre class="mqtt-logs__data">{{ scope.row.Content ?? scope.row.Data }}</pre></template>
      </el-table-column>
    </el-table>
    <div class="mqtt-logs__pager">
      <el-button :disabled="loading || cursors.length === 0" @click="previous">上一页</el-button>
      <span>第 {{ cursors.length + 1 }} 页</span>
      <el-button :disabled="loading || !nextCursor" @click="next">下一页</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, getCurrentInstance, onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps({ FormDiyTableModel: Object, FormData: Object, LoadMode: String, ParentV8: Object, AllClients: Boolean });
const diyCommon = getCurrentInstance()?.appContext?.config?.globalProperties?.DiyCommon;
const root = ref();
const month = ref(new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0'));
const history = ref(false);
const clientId = computed(() => props.FormDiyTableModel?.ClientId || props.FormData?.ClientId || '');
const rows = ref([]), loading = ref(false), error = ref(''), source = ref(''), cursors = ref([]), nextCursor = ref(null);
let observer, visible = false, generation = 0;

async function load(cursor = null) {
  if (!visible || (!props.AllClients && !clientId.value) || props.LoadMode === 'Design') return;
  const requestId = ++generation;
  loading.value = true; error.value = ''; rows.value = []; nextCursor.value = null;
  try {
    const body = { Action: history.value ? 'HistoryLogs' : 'Logs', ClientId: props.AllClients ? '' : clientId.value, SearchMonth: month.value, PageSize: 20, ...cursor };
    const response = props.ParentV8?.Http?.Post
      ? await props.ParentV8.Http.Post({ Url: '/apiengine/platform-mqtt', ParamType: 'json', Timeout: 15, PostParam: body })
      : await diyCommon.PostAsync('/apiengine/platform-mqtt', body);
    const result = typeof response === 'string' ? JSON.parse(response) : response;
    if (requestId !== generation) return;
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '读取 MQTT 日志失败，请检查后端版本和日志存储。');
    if (!Array.isArray(result.Data)) throw new Error('MQTT 日志返回格式不正确。');
    rows.value = result.Data;
    source.value = result.DataAppend?.Source || '';
    if (result.DataAppend?.HasMore) {
      if (!result.DataAppend.BeforeLogTime || !result.DataAppend.BeforeLogId) throw new Error('日志翻页游标不完整。');
      nextCursor.value = { BeforeLogTime: result.DataAppend.BeforeLogTime, BeforeLogId: result.DataAppend.BeforeLogId };
    }
  } catch (e) {
    if (requestId === generation) error.value = e?.message || '读取 MQTT 日志失败。';
  } finally { if (requestId === generation) loading.value = false; }
}
function reset() { cursors.value = []; source.value = ''; ++generation; loading.value = false; rows.value = []; error.value = ''; nextCursor.value = null; if (visible) load(); }
function next() { if (!nextCursor.value) return; cursors.value.push(nextCursor.value); load(nextCursor.value); }
function previous() { cursors.value.pop(); load(cursors.value.at(-1)); }
watch(clientId, reset);
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && rows.value.length === 0 && !loading.value && !error.value) load(cursors.value.at(-1));
  });
  observer.observe(root.value);
});
onBeforeUnmount(() => { ++generation; observer?.disconnect(); });
</script>

<style scoped>
.mqtt-logs { width: 100%; min-width: 0; }
.mqtt-logs__toolbar, .mqtt-logs__pager { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; }
.mqtt-logs__toolbar span { color: var(--el-text-color-regular); font-size: 13px; }
.mqtt-logs__pager { justify-content: flex-end; }
.mqtt-logs__data { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; }
</style>
