<template>
  <section class="mci-star-records" aria-label="Star活动登记">
    <div class="mci-star-records__heading"><div><h2>Star活动登记</h2><p>与后台活动模块同步，查看全部登记资料、核验及领取情况。</p></div><span>{{ total }} 条登记</span></div>
    <form class="mci-star-records__filters" @submit.prevent="load(1)">
      <label class="mci-star-records__keyword">搜索登记<input v-model="filters.Keyword" maxlength="100" placeholder="公司、姓名、电话或登记编号" /></label>
      <label v-for="filter in filterFields" :key="filter.Name">{{ filter.Label }}<select v-model="filters[filter.Name]"><option value="">全部</option><option v-for="option in options[filter.Name] || []" :key="option.Key" :value="option.Key">{{ option.Value }}</option></select></label>
      <button type="submit" :disabled="loading">查询</button><button type="button" class="mci-star-records__secondary" :disabled="loading" @click="reset">重置</button>
    </form>
    <div v-if="error" class="mci-star-records__error" role="alert">{{ error }}<button type="button" @click="load(page)">重试</button></div>
    <div v-if="loading" class="mci-star-records__skeleton" role="status" aria-label="正在读取登记数据"><div v-for="i in 5" :key="i"></div></div>
    <p v-else-if="!error && !records.length" class="mci-star-records__empty">没有符合条件的登记记录。</p>
    <div v-else-if="!error" class="mci-star-records__list">
      <div class="mci-star-records__table-scroll" tabindex="0" aria-label="活动登记列表，可横向滚动">
        <table><thead><tr><th>登记人 / 公司</th><th>电话</th><th>登记编号</th><th>Star核验</th><th>公众号核验</th><th>领取状态</th><th>创建时间</th><th>资料</th></tr></thead>
          <tbody><template v-for="record in records" :key="record.Id"><tr><td><strong>{{ record.ContactName || '未填写姓名' }}</strong><small>{{ record.CompanyName || '未填写公司' }}</small></td><td>{{ record.Phone || '—' }}</td><td>{{ record.ReceiptNo || '—' }}</td><td><span :class="['mci-star-records__status', { verified: record.StarVerifyStatus === 'verified' }]">{{ display(record, 'StarVerifyStatus') }}</span></td><td>{{ display(record, 'WeChatVerifyStatus') }}</td><td>{{ display(record, 'GiftStatus') }}</td><td>{{ record.CreateTime || '—' }}</td><td><button type="button" class="mci-star-records__secondary" :aria-expanded="expanded === record.Id" @click="toggle(record.Id)">{{ expanded === record.Id ? '收起' : '完整资料' }}</button></td></tr><tr v-if="expanded === record.Id"><td colspan="8"><dl class="mci-star-records__details"><div v-for="field in fields" :key="field.Name"><dt>{{ field.Label }}</dt><dd>{{ display(record, field.Name) }}</dd></div></dl></td></tr></template></tbody>
        </table>
      </div>
      <article v-for="record in records" :key="`mobile-${record.Id}`" class="mci-star-records__card"><header><strong>{{ record.ContactName || '未填写姓名' }}</strong><span>{{ display(record, 'GiftStatus') }}</span></header><p>{{ record.CompanyName || '未填写公司' }}</p><dl><div><dt>电话</dt><dd>{{ record.Phone || '—' }}</dd></div><div><dt>登记编号</dt><dd>{{ record.ReceiptNo || '—' }}</dd></div><div><dt>Star核验</dt><dd>{{ display(record, 'StarVerifyStatus') }}</dd></div><div><dt>公众号核验</dt><dd>{{ display(record, 'WeChatVerifyStatus') }}</dd></div></dl><button type="button" class="mci-star-records__secondary" :aria-expanded="expanded === record.Id" @click="toggle(record.Id)">{{ expanded === record.Id ? '收起' : '完整资料' }}</button><dl v-if="expanded === record.Id" class="mci-star-records__details"><div v-for="field in fields" :key="field.Name"><dt>{{ field.Label }}</dt><dd>{{ display(record, field.Name) }}</dd></div></dl></article>
    </div>
    <footer class="mci-star-records__pagination"><span>共 {{ total }} 条 · 第 {{ page }} / {{ pages }} 页</span><label>每页<select v-model.number="pageSize" :disabled="loading" @change="load(1)"><option :value="20">20 条</option><option :value="50">50 条</option><option :value="100">100 条</option></select></label><button type="button" class="mci-star-records__secondary" :disabled="loading || page <= 1" @click="load(page - 1)">上一页</button><button type="button" class="mci-star-records__secondary" :disabled="loading || page >= pages" @click="load(page + 1)">下一页</button></footer>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
const props = defineProps({ request: { type: Function, required: true } })
const emit = defineEmits(['denied'])
const records = ref([]), fields = ref([]), options = ref({}), total = ref(0), page = ref(1), pageSize = ref(20)
const loading = ref(false), error = ref(''), expanded = ref('')
const filters = reactive({ Keyword: '', StarVerifyStatus: '', WeChatVerifyStatus: '', GiftStatus: '' })
const filterFields = [{ Name: 'StarVerifyStatus', Label: 'Star核验' }, { Name: 'WeChatVerifyStatus', Label: '公众号核验' }, { Name: 'GiftStatus', Label: '领取状态' }]
const pages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
let requestId = 0
// 查询和离开页面使旧请求失效，防止迟到响应恢复已经撤权或切换前的资料。
async function load(nextPage = 1) {
  const id = ++requestId
  loading.value = true; error.value = ''; records.value = []; expanded.value = ''
  try {
    const data = await props.request('official_star_gift_records', { Action: 'List', ...filters, PageIndex: nextPage, PageSize: pageSize.value })
    if (id !== requestId) return
    if (!data.CanView) { emit('denied'); return }
    records.value = data.Records || []; fields.value = data.Fields || []; options.value = data.Options || {}
    total.value = Number(data.Total || 0); page.value = Number(data.PageIndex || 1)
  } catch (e) {
    if (id !== requestId) return
    total.value = 0; error.value = e.message || '读取失败，请重试。'
    if (/无权查看/.test(error.value)) emit('denied')
  } finally { if (id === requestId) loading.value = false }
}
function reset() { Object.keys(filters).forEach(key => { filters[key] = '' }); void load(1) }
function toggle(id) { expanded.value = expanded.value === id ? '' : id }
function display(record, name) {
  const value = record[name]
  if (value === null || value === undefined || value === '') return '未记录'
  if (['StarDeclared', 'WeChatDeclared', 'IsDeleted'].includes(name)) return Number(value) === 1 ? '是' : '否'
  return options.value[name]?.find(option => option.Key === String(value))?.Value || String(value)
}
onMounted(() => { void load() })
onUnmounted(() => { requestId++; records.value = [] })
</script>

<style scoped>
.mci-star-records { color:var(--portal-text); min-width:0; }
.mci-star-records__heading { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
.mci-star-records__heading h2 { margin:0 0 8px; font-size:20px; }.mci-star-records__heading p,.mci-star-records__heading>span { margin:0; color:var(--portal-muted); font-size:13px; }
.mci-star-records__filters { display:flex; gap:12px; align-items:end; flex-wrap:wrap; margin-bottom:20px; }
.mci-star-records label { display:flex; flex-direction:column; gap:7px; font-size:12px; color:var(--portal-muted); }
.mci-star-records__keyword { flex:1; min-width:220px; }
.mci-star-records input,.mci-star-records select { min-height:42px; border:1px solid var(--portal-line); border-radius:6px; padding:8px 10px; background:var(--portal-surface); color:var(--portal-text); font:inherit; }
.mci-star-records button { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:10px 16px; border:1px solid var(--portal-text); border-radius:6px; background:var(--portal-text); color:var(--portal-surface); font-size:13px; line-height:1; cursor:pointer; }
.mci-star-records button.mci-star-records__secondary { color:var(--portal-text); background:var(--portal-surface); border-color:var(--portal-line); }
.mci-star-records button:hover:not(:disabled) { filter:brightness(.9); }.mci-star-records button:active:not(:disabled) { transform:translateY(1px); }.mci-star-records :is(button,input,select):focus-visible { outline:2px solid var(--portal-text); outline-offset:3px; }.mci-star-records button:disabled { opacity:.45; cursor:default; }
.mci-star-records__table-scroll { overflow:auto; border:1px solid var(--portal-line); border-radius:8px; }.mci-star-records table { width:100%; border-collapse:collapse; font-size:13px; text-align:left; white-space:nowrap; margin:0; display:table; }
.mci-star-records th,.mci-star-records td { padding:14px; border:0; border-bottom:1px solid var(--portal-line); background:var(--portal-surface); }.mci-star-records th { background:var(--portal-bg); font-size:12px; color:var(--portal-muted); }.mci-star-records td strong { display:block; }.mci-star-records td small { display:block; margin-top:5px; color:var(--portal-muted); max-width:240px; overflow:hidden; text-overflow:ellipsis; }
.mci-star-records__status { color:var(--portal-muted); }.mci-star-records__status.verified { color:var(--portal-text); font-weight:600; }
.mci-star-records__details { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:18px; margin:0; padding:10px; white-space:normal; }.mci-star-records dt { color:var(--portal-muted); font-size:12px; }.mci-star-records dd { margin:5px 0 0; overflow-wrap:anywhere; font-size:13px; line-height:1.6; }
.mci-star-records__pagination { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:12px; align-items:center; margin-top:20px; font-size:12px; color:var(--portal-muted); }.mci-star-records__pagination>span { margin-right:auto; }.mci-star-records__pagination label { flex-direction:row; align-items:center; }
.mci-star-records__empty { padding:50px 16px; text-align:center; color:var(--portal-muted); }.mci-star-records__error { padding:16px; border:1px solid var(--portal-line); border-radius:8px; display:flex; justify-content:space-between; gap:12px; align-items:center; }
.mci-star-records__skeleton { display:grid; gap:12px; padding:12px 0; }.mci-star-records__skeleton div { height:52px; background:var(--portal-bg); animation:mci-star-pulse 1.4s ease-in-out infinite; }.mci-star-records__card { display:none; }
@keyframes mci-star-pulse { 50% { opacity:.45; } } @media(prefers-reduced-motion:reduce) { .mci-star-records__skeleton div { animation:none; } }
@media(max-width:760px) { .mci-star-records__heading { align-items:start; }.mci-star-records__heading>span { white-space:nowrap; }.mci-star-records__filters>label { flex:1 1 40%; min-width:0; }.mci-star-records__filters>.mci-star-records__keyword { flex-basis:100%; }.mci-star-records__table-scroll { display:none; }.mci-star-records__card { display:block; padding:18px 0; border-bottom:1px solid var(--portal-line); }.mci-star-records__card header { display:flex; justify-content:space-between; gap:12px; }.mci-star-records__card p { color:var(--portal-muted); font-size:13px; }.mci-star-records__card dl { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }.mci-star-records__card .mci-star-records__details { padding:18px 0 0; }.mci-star-records__pagination>span { width:100%; }.mci-star-records__pagination { justify-content:start; }.mci-star-records input { width:100%; box-sizing:border-box; } }
</style>
