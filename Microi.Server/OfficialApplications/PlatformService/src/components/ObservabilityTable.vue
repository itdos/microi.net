<template>
  <div class="obs-data-table" :class="{ 'is-loading': loading }">
    <div v-if="searchable || showPageSize" class="obs-data-table__tools">
      <label v-if="searchable" class="obs-data-table__search">
        <span class="sr-only">搜索表格</span>
        <input v-model.trim="keyword" type="search" :placeholder="searchPlaceholder" @keyup.enter="submitSearch">
      </label>
      <label v-if="showPageSize" class="obs-data-table__size">
        <span>每页</span>
        <select :value="effectivePageSize" @change="changePageSize($event.target.value)">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ size }} 条</option>
        </select>
      </label>
    </div>

    <div class="obs-data-table__viewport">
      <table>
        <thead>
          <tr><th v-for="column in columns" :key="column.key" :style="columnStyle(column)">{{ column.label }}</th></tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in visibleRows"
            :key="resolveRowKey(row, index)"
            :class="[{ 'is-clickable': clickable }, resolveRowClass(row, index)]"
            @click="emit('row-click', row)"
          >
            <td v-for="column in columns" :key="column.key" :class="[{ 'is-wrap': column.wrap }, column.className]">
              <slot :name="`cell-${column.key}`" :row="row" :column="column" :value="readValue(row, column.key)" :index="rowOffset + index">
                {{ formatValue(row, column) }}
              </slot>
            </td>
          </tr>
          <tr v-if="!visibleRows.length"><td :colspan="Math.max(1, columns.length)" class="obs-data-table__empty">{{ emptyText }}</td></tr>
        </tbody>
      </table>
    </div>

    <footer class="obs-data-table__pager">
      <span>共 {{ effectiveTotal }} 条</span>
      <button type="button" :disabled="effectivePage <= 1" @click="changePage(effectivePage - 1)">上一页</button>
      <b>第 {{ effectivePage }} / {{ pageCount }} 页</b>
      <button type="button" :disabled="effectivePage >= pageCount" @click="changePage(effectivePage + 1)">下一页</button>
    </footer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  rowKey: { type: [String, Function], default: 'Id' },
  searchable: { type: Boolean, default: true },
  searchPlaceholder: { type: String, default: '搜索当前表格…' },
  defaultPageSize: { type: Number, default: 15 },
  pageSizes: { type: Array, default: () => [15, 30, 50, 100] },
  showPageSize: { type: Boolean, default: true },
  server: { type: Boolean, default: false },
  total: { type: Number, default: 0 },
  page: { type: Number, default: 1 },
  pageSize: { type: Number, default: 15 },
  loading: { type: Boolean, default: false },
  emptyText: { type: String, default: '暂无数据' },
  clickable: { type: Boolean, default: false },
  rowClass: { type: [String, Function], default: '' }
})

const emit = defineEmits(['update:page', 'update:pageSize', 'row-click', 'search'])
const keyword = ref('')
const localPage = ref(1)
const localPageSize = ref(normalizePageSize(props.defaultPageSize))
let serverSearchTimer = 0

const filteredRows = computed(() => {
  if (props.server || !keyword.value) return props.rows || []
  const needle = keyword.value.toLocaleLowerCase()
  return (props.rows || []).filter(row => props.columns.some(column => {
    const keys = Array.isArray(column.searchKeys) && column.searchKeys.length ? column.searchKeys : [column.key]
    return keys.some(key => String(readValue(row, key) ?? '').toLocaleLowerCase().includes(needle))
  }))
})
const effectivePage = computed(() => props.server ? Math.max(1, Number(props.page) || 1) : localPage.value)
const effectivePageSize = computed(() => props.server ? normalizePageSize(props.pageSize) : localPageSize.value)
const effectiveTotal = computed(() => props.server ? Math.max(0, Number(props.total) || 0) : filteredRows.value.length)
const pageCount = computed(() => Math.max(1, Math.ceil(effectiveTotal.value / effectivePageSize.value)))
const rowOffset = computed(() => (effectivePage.value - 1) * effectivePageSize.value)
const visibleRows = computed(() => props.server
  ? (props.rows || [])
  : filteredRows.value.slice(rowOffset.value, rowOffset.value + effectivePageSize.value))

watch(() => props.rows, () => {
  if (!props.server && localPage.value > pageCount.value) localPage.value = pageCount.value
})
watch(keyword, () => {
  if (!props.server) localPage.value = 1
  else {
    window.clearTimeout(serverSearchTimer)
    serverSearchTimer = window.setTimeout(() => emit('search', keyword.value), 350)
  }
})
onBeforeUnmount(() => window.clearTimeout(serverSearchTimer))

function normalizePageSize(value) {
  const size = Math.max(1, Number(value) || 15)
  return props.pageSizes.includes(size) ? size : (props.pageSizes[0] || 15)
}
function changePage(page) {
  const next = Math.max(1, Math.min(pageCount.value, Number(page) || 1))
  if (props.server) emit('update:page', next)
  else localPage.value = next
}
function changePageSize(value) {
  const size = normalizePageSize(value)
  if (props.server) {
    emit('update:pageSize', size)
  } else {
    localPageSize.value = size
    localPage.value = 1
  }
}
function submitSearch() { window.clearTimeout(serverSearchTimer); emit('search', keyword.value) }
function readValue(row, path) {
  return String(path || '').split('.').reduce((value, key) => value == null ? value : value[key], row)
}
function formatValue(row, column) {
  const value = readValue(row, column.key)
  if (typeof column.format === 'function') return column.format(value, row)
  return value === null || value === undefined || value === '' ? '-' : String(value)
}
function resolveRowKey(row, index) {
  if (typeof props.rowKey === 'function') return props.rowKey(row, index)
  return readValue(row, props.rowKey) || `${rowOffset.value + index}`
}
function resolveRowClass(row, index) {
  return typeof props.rowClass === 'function' ? props.rowClass(row, rowOffset.value + index) : props.rowClass
}
function columnStyle(column) {
  const style = {}
  if (column.width) style.width = typeof column.width === 'number' ? `${column.width}px` : column.width
  if (column.minWidth) style.minWidth = typeof column.minWidth === 'number' ? `${column.minWidth}px` : column.minWidth
  return style
}
</script>

<style scoped>
.obs-data-table{min-width:0}.obs-data-table__tools{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:0 0 9px}.obs-data-table__search{flex:1;max-width:320px}.obs-data-table input,.obs-data-table select{width:100%;height:34px;padding:0 10px;border:1px solid var(--obs-border);border-radius:7px;color:var(--obs-text);background:var(--obs-panel);outline:none}.obs-data-table input:focus,.obs-data-table select:focus{border-color:var(--obs-primary);box-shadow:0 0 0 2px color-mix(in srgb,var(--obs-primary) 14%,transparent)}.obs-data-table__size{display:flex;gap:6px;align-items:center;color:var(--obs-muted);font-size:10px;white-space:nowrap}.obs-data-table__size select{width:78px}.obs-data-table__viewport{width:100%;overflow:auto}.obs-data-table table{width:100%;border-collapse:collapse;font-size:11px}.obs-data-table th{padding:8px;color:var(--obs-muted);background:var(--obs-bg);font-weight:650;text-align:left;white-space:nowrap}.obs-data-table td{max-width:360px;padding:9px 8px;border-bottom:1px solid var(--obs-border);vertical-align:top;transition:background-color .16s,color .16s}.obs-data-table td.is-wrap{white-space:normal;overflow-wrap:anywhere}.obs-data-table tr.is-clickable{cursor:pointer}.obs-data-table tr.is-clickable:hover td{background:var(--obs-soft)}.obs-data-table tr.is-warning-row td{background:color-mix(in srgb,#d88414 7%,var(--obs-panel))}.obs-data-table tr.is-danger-row td{color:#d9363e;background:color-mix(in srgb,#e5484d 9%,var(--obs-panel))}.obs-data-table tr.is-danger-row:hover td{background:color-mix(in srgb,#e5484d 14%,var(--obs-panel))}.obs-data-table__empty{padding:28px!important;color:var(--obs-muted);text-align:center!important}.obs-data-table__pager{display:flex;gap:9px;align-items:center;justify-content:flex-end;margin-top:10px;color:var(--obs-muted);font-size:10px}.obs-data-table__pager button{height:30px;padding:0 10px;border:1px solid var(--obs-border);border-radius:6px;color:var(--obs-text);background:var(--obs-panel);cursor:pointer}.obs-data-table__pager button:disabled{cursor:not-allowed;opacity:.45}.obs-data-table__pager b{color:var(--obs-muted);font-weight:500}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:650px){.obs-data-table__tools{align-items:stretch;flex-direction:column}.obs-data-table__search{width:100%;max-width:none}.obs-data-table__size{justify-content:flex-end}.obs-data-table__pager{justify-content:center;flex-wrap:wrap}}
</style>
