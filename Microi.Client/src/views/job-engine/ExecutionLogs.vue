<template>
  <section ref="root" class="execution-logs">
    <div class="execution-logs__toolbar">
      <el-date-picker v-model="month" type="month" value-format="YYYYMM" format="YYYY年MM月" :clearable="false" aria-label="日志月份" @change="reset" />
      <el-button :loading="loading" @click="reset">刷新</el-button>
      <span>{{ history ? '历史日志仅供查询' : '任务执行记录' }} · 按月查询</span>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
    <el-table v-mci-loading:table="loading" :data="rows" :empty-text="error ? '日志读取失败' : (loading ? '正在读取日志' : '本月暂无日志')" row-key="Id" max-height="480">
      <el-table-column type="expand">
        <template #default="scope"><pre class="execution-logs__detail">{{ scope.row.Content ?? scope.row.Message }}</pre></template>
      </el-table-column>
      <el-table-column prop="CreateTime" label="执行时间" min-width="190" />
      <el-table-column label="结果" width="100">
        <template #default="scope"><el-tag :type="status(scope.row).type">{{ status(scope.row).label }}</el-tag></template>
      </el-table-column>
      <el-table-column label="耗时" width="110">
        <template #default="scope">{{ duration(scope.row) }}</template>
      </el-table-column>
      <el-table-column label="内容" min-width="220" show-overflow-tooltip>
        <template #default="scope">{{ scope.row.Content ?? scope.row.Message }}</template>
      </el-table-column>
    </el-table>
    <div class="execution-logs__pager">
      <el-button :disabled="loading || cursors.length === 0" @click="previous">上一页</el-button>
      <span>第 {{ cursors.length + 1 }} 页</span>
      <el-button :disabled="loading || !nextCursor" @click="next">下一页</el-button>
    </div>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
const props = defineProps({ field: Object, FormDiyTableModel: Object, FormData: Object, LoadMode: String, ParentV8: Object });
const root = ref();
const month = ref(new Date().getFullYear() + String(new Date().getMonth() + 1).padStart(2, '0'));
const history = computed(() => props.field?.Config?.ScheduleLogSource === 'History');
const jobName = computed(() => props.FormDiyTableModel?.JobName || props.FormData?.JobName || '');
const rows = ref([]), loading = ref(false), error = ref(''), cursors = ref([]), nextCursor = ref(null);
let observer, visible = false, loadedKey = '', generation = 0;
const key = () => `${jobName.value}|${month.value}|${history.value}`;
function status(row) {
  if (row.Action === 'Skipped') return { label: '已跳过', type: 'info' };
  if (row.Success === false || row.Action === 'Failed') return { label: '失败', type: 'danger' };
  if (row.Success === true) return { label: '成功', type: 'success' };
  return { label: '历史记录', type: 'info' };
}
function duration(row) { const value = row.DurationMs ?? row.Duration; return value == null ? '—' : `${Math.round(value)} ms`; }
async function load(cursor = null) {
  if (!visible || !jobName.value || props.LoadMode === 'Design') return;
  const requestId = ++generation;
  loading.value = true; error.value = ''; rows.value = []; nextCursor.value = null;
  try {
    const data = { Action: history.value ? 'historylogs' : 'logs', JobName: jobName.value, SearchMonth: month.value, PageSize: 20, ...cursor };
    const response = await props.ParentV8.Http.Post({ Url: '/apiengine/platform-schedule-job', PostParam: data, ParamType: 'json', Timeout: 15 });
    let result;
    try { result = typeof response === 'string' ? JSON.parse(response) : response; }
    catch { throw new Error('日志服务未返回有效结果，请稍后重试。'); }
    if (requestId !== generation) return;
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '读取日志失败，请确认后端已更新并检查日志服务。');
    if (!Array.isArray(result.Data)) throw new Error('日志服务返回的数据格式不正确，请检查后端版本。');
    if (result.DataAppend?.HasMore && (!result.DataAppend.BeforeLogTime || !result.DataAppend.BeforeLogId))
      throw new Error('日志服务未返回完整翻页信息，请检查后端版本。');
    rows.value = result.Data;
    if (result.DataAppend?.HasMore) nextCursor.value = { BeforeLogTime: result.DataAppend.BeforeLogTime, BeforeLogId: result.DataAppend.BeforeLogId };
    loadedKey = key();
  } catch (e) {
    if (requestId === generation) error.value = e?.message || '读取日志失败，请稍后重试。';
  } finally { if (requestId === generation) loading.value = false; }
}
// 隐藏页签中切换任务也要清除在途状态；旧请求完成后不能覆盖新任务或阻止懒加载。
function reset() {
  cursors.value = []; loadedKey = ''; ++generation;
  loading.value = false; rows.value = []; error.value = ''; nextCursor.value = null;
  if (visible) load();
}
function next() { const cursor = nextCursor.value; if (!cursor) return; cursors.value.push(cursor); load(cursor); }
function previous() { cursors.value.pop(); load(cursors.value.at(-1)); }
watch([jobName, history], reset);
onMounted(() => {
  observer = new IntersectionObserver(entries => {
    visible = entries.some(entry => entry.isIntersecting);
    if (visible && loadedKey !== key() && !loading.value) load(cursors.value.at(-1));
  });
  observer.observe(root.value);
});
onBeforeUnmount(() => { ++generation; observer?.disconnect(); });
</script>

<style scoped>
.execution-logs { width: 100%; min-width: 0; }
.execution-logs__toolbar, .execution-logs__pager { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 0; }
.execution-logs__toolbar span { color: var(--el-text-color-regular); font-size: 13px; }
.execution-logs__pager { justify-content: flex-end; }
.execution-logs__detail { white-space: pre-wrap; overflow-wrap: anywhere; margin: 12px 24px; max-height: 320px; overflow: auto; }
</style>
