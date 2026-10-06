<template>
  <main class="selector-app">
    <header class="selector-head">
      <div>
        <h1>选择应用数据</h1>
        <p>先选择表，再按条件筛选并勾选数据；制作应用包时会固化实际行数据。</p>
      </div>
      <div class="head-actions">
        <span class="count">已配置 {{ dataSets.length }} 张表</span>
      </div>
    </header>

    <section class="workspace">
      <aside class="dataset-list">
        <div class="aside-title">已选数据集</div>
        <button
          v-for="item in dataSets"
          :key="item.TableId"
          type="button"
          class="dataset-item"
          :class="{ active: item.TableId === selectedTableId }"
          @click="editDataSet(item)"
        >
          <strong>{{ item.TableDescription || item.TableName }}</strong>
          <small>{{ item.SelectionMode === 'Where' ? '按条件' : `${item.RowIds.length} 条` }}</small>
        </button>
        <div v-if="!dataSets.length" class="empty-small">尚未选择数据</div>
      </aside>

      <section class="content">
        <div class="toolbar">
          <label>
            <span>数据表</span>
            <input
              v-model.trim="tableInput"
              list="app-store-table-options"
              placeholder="输入表名或中文名称后选择"
              autocomplete="off"
              @change="selectTableFromInput"
            />
            <datalist id="app-store-table-options">
              <option v-for="table in tables" :key="table.Id" :value="tableOptionText(table)" />
            </datalist>
          </label>
          <label>
            <span>选择方式</span>
            <select v-model="selectionMode">
              <option value="Ids">勾选指定数据</option>
              <option value="Where">按条件动态选择</option>
            </select>
          </label>
        </div>

        <div v-if="selectedTable" class="condition-box">
          <div class="quick-search">
            <input v-model.trim="rowKeyword" placeholder="输入关键词搜索当前表数据" @keyup.enter="queryRows(1)" />
            <button type="button" class="primary" :disabled="loading" @click="queryRows(1)">搜索</button>
          </div>
          <div v-for="(condition, index) in conditions" :key="index" class="condition-row">
            <select v-model="condition.Field">
              <option value="">选择字段</option>
              <option v-for="field in fields" :key="field.Name" :value="field.Name">{{ field.Label || field.Name }}</option>
            </select>
            <select v-model="condition.Operator">
              <option value="Like">包含</option>
              <option value="=">等于</option>
              <option value="<>">不等于</option>
              <option value="StartLike">开头为</option>
              <option value="EndLike">结尾为</option>
            </select>
            <input v-model.trim="condition.Value" placeholder="条件值" @keyup.enter="queryRows(1)" />
            <button type="button" class="link danger" :disabled="conditions.length === 1" @click="removeCondition(index)">删除</button>
          </div>
          <div class="condition-actions">
            <button type="button" class="link" @click="addCondition">+ 添加条件</button>
            <button type="button" class="primary" :disabled="loading" @click="queryRows(1)">{{ loading ? '查询中…' : '查询数据' }}</button>
          </div>
        </div>

        <div v-if="selectedTable" class="table-wrap">
          <table>
            <thead>
              <tr>
                <th v-if="selectionMode === 'Ids'" class="check-col"><input type="checkbox" :checked="pageAllChecked" @change="togglePage" /></th>
                <th v-for="field in displayFields" :key="field.Name">{{ field.Label || field.Name }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in rows" :key="row.Id">
                <td v-if="selectionMode === 'Ids'" class="check-col"><input v-model="selectedRowIds" type="checkbox" :value="row.Id" /></td>
                <td v-for="field in displayFields" :key="field.Name" :title="formatValue(row[field.Name])">{{ formatValue(row[field.Name]) }}</td>
              </tr>
              <tr v-if="!rows.length"><td :colspan="displayFields.length + (selectionMode === 'Ids' ? 1 : 0)" class="empty-row">暂无数据</td></tr>
            </tbody>
          </table>
          <footer class="pager">
            <span>共 {{ total }} 条；当前已勾选 {{ selectedRowIds.length }} 条</span>
            <div>
              <button type="button" :disabled="pageIndex <= 1" @click="queryRows(pageIndex - 1)">上一页</button>
              <span>第 {{ pageIndex }} / {{ totalPages }} 页</span>
              <button type="button" :disabled="pageIndex >= totalPages" @click="queryRows(pageIndex + 1)">下一页</button>
            </div>
          </footer>
        </div>

        <div v-if="selectedTable" class="save-current">
          <span>冲突策略：按原 Id 幂等新增或更新，保证菜单、页面等引用关系不变。</span>
          <button type="button" class="primary" @click="saveCurrentDataSet">保存当前表选择</button>
        </div>
      </section>
    </section>

    <footer class="dialog-actions">
      <button type="button" @click="cancel">取消</button>
      <button type="button" class="primary" @click="confirm">确定（{{ dataSets.length }} 张表）</button>
    </footer>
    <div v-if="error" class="error">{{ error }}</div>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { configureV8, dispatch, getContext } from './microi.js'

const client = configureV8()
const context = getContext()
const tables = ref([])
const fields = ref([])
const rows = ref([])
const total = ref(0)
const pageIndex = ref(1)
const pageSize = 20
const selectedTableId = ref('')
const selectionMode = ref('Ids')
const selectedRowIds = ref([])
const conditions = ref([{ Field: '', Operator: 'Like', Value: '' }])
const dataSets = ref(parseInitialDataSets())
const loading = ref(false)
const error = ref('')
const tableInput = ref('')
const rowKeyword = ref('')

const selectedTable = computed(() => tables.value.find(item => item.Id === selectedTableId.value) || null)
const displayFields = computed(() => {
  const list = fields.value.filter(item => item.Name && item.Name !== 'IsDeleted').slice(0, 6)
  if (!list.some(item => item.Name === 'Id')) list.unshift({ Name: 'Id', Label: 'Id' })
  return list.slice(0, 7)
})
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const pageAllChecked = computed(() => rows.value.length > 0 && rows.value.every(row => selectedRowIds.value.includes(row.Id)))

function parseInitialDataSets() {
  const raw = context.dialogData?.SelectData || context.dialogData?.Value || context.dialogData?.DataSets || []
  if (Array.isArray(raw)) return raw
  try {
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function call(action, payload = {}) {
  const result = await client.post('/apiengine/app-store-data-selector-query', { Action: action, ...payload })
  if (!result || result.Code !== 1) throw new Error(result?.Msg || '接口执行失败')
  return result.Data || {}
}

async function loadTables() {
  const data = await call('Tables')
  tables.value = data.Tables || []
}

async function changeTable() {
  fields.value = []
  rows.value = []
  total.value = 0
  selectedRowIds.value = []
  rowKeyword.value = ''
  conditions.value = [{ Field: '', Operator: 'Like', Value: '' }]
  if (!selectedTableId.value) return
  const data = await call('Fields', { TableId: selectedTableId.value })
  fields.value = data.Fields || []
  const existing = dataSets.value.find(item => item.TableId === selectedTableId.value)
  if (existing) {
    selectionMode.value = existing.SelectionMode || 'Ids'
    selectedRowIds.value = (existing.RowIds || []).slice()
    conditions.value = existing.Where?.length ? existing.Where.map(item => ({ Field: item[0], Operator: item[1], Value: item[2] })) : conditions.value
  }
  await queryRows(1)
}

function tableOptionText(table) {
  return `${table.Description || table.Name} - ${table.Name}`
}

async function selectTableFromInput() {
  const value = tableInput.value.toLowerCase()
  const table = tables.value.find(item =>
    tableOptionText(item).toLowerCase() === value ||
    String(item.Name || '').toLowerCase() === value ||
    String(item.Id || '').toLowerCase() === value
  )
  if (!table) {
    selectedTableId.value = ''
    return
  }
  selectedTableId.value = table.Id
  tableInput.value = tableOptionText(table)
  await changeTable()
}

async function queryRows(index) {
  if (!selectedTable.value) return
  loading.value = true
  error.value = ''
  try {
    const validConditions = conditions.value.filter(item => item.Field && item.Value !== '')
    const data = await call('Rows', {
      TableId: selectedTable.value.Id,
      Conditions: validConditions,
      Keyword: rowKeyword.value,
      PageIndex: index,
      PageSize: pageSize
    })
    rows.value = data.Rows || []
    total.value = Number(data.DataCount || 0)
    pageIndex.value = index
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function addCondition() {
  conditions.value.push({ Field: '', Operator: 'Like', Value: '' })
}
function removeCondition(index) {
  if (conditions.value.length > 1) conditions.value.splice(index, 1)
}
function togglePage(event) {
  const ids = rows.value.map(row => row.Id).filter(Boolean)
  if (event.target.checked) selectedRowIds.value = Array.from(new Set(selectedRowIds.value.concat(ids)))
  else selectedRowIds.value = selectedRowIds.value.filter(id => !ids.includes(id))
}
function formatValue(value) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return text.length > 80 ? `${text.slice(0, 80)}…` : text
}

function saveCurrentDataSet() {
  error.value = ''
  if (!selectedTable.value) return
  const where = conditions.value.filter(item => item.Field && item.Value !== '').map(item => [item.Field, item.Operator, item.Value])
  if (selectionMode.value === 'Ids' && selectedRowIds.value.length === 0) {
    error.value = '请至少勾选一条数据。'
    return
  }
  if (selectionMode.value === 'Where' && where.length === 0) {
    error.value = '按条件选择时至少需要一个有效条件，禁止无条件导出整张表。'
    return
  }
  const item = {
    TableId: selectedTable.value.Id,
    TableName: selectedTable.value.Name,
    TableDescription: selectedTable.value.Description || selectedTable.value.Name,
    SelectionMode: selectionMode.value,
    RowIds: selectionMode.value === 'Ids' ? selectedRowIds.value.slice() : [],
    Where: where,
    ConflictPolicy: 'UpsertById',
    PreviewCount: selectionMode.value === 'Ids' ? selectedRowIds.value.length : total.value
  }
  const index = dataSets.value.findIndex(current => current.TableId === item.TableId)
  if (index >= 0) dataSets.value.splice(index, 1, item)
  else dataSets.value.push(item)
}

function editDataSet(item) {
  selectedTableId.value = item.TableId
  const table = tables.value.find(current => current.Id === item.TableId)
  tableInput.value = table ? tableOptionText(table) : item.TableName || ''
  changeTable()
}
function confirm() {
  dispatch('app-dialog:success', { DataSets: dataSets.value, Value: JSON.stringify(dataSets.value) })
}
function cancel() {
  dispatch('app-dialog:cancel', {})
}

onMounted(async () => {
  try {
    await loadTables()
    if (dataSets.value.length) {
      selectedTableId.value = dataSets.value[0].TableId
      const table = tables.value.find(item => item.Id === selectedTableId.value)
      tableInput.value = table ? tableOptionText(table) : dataSets.value[0].TableName || ''
      await changeTable()
    }
  } catch (e) {
    error.value = e.message
  }
})
</script>

<style scoped>
.selector-app { display: flex; height: clamp(500px, calc(100vh - 190px), 660px); min-height: 0; flex-direction: column; overflow: hidden; padding: 18px; color: #273142; background: #f6f8fb; }
.selector-head { display: flex; align-items: center; justify-content: space-between; padding: 16px 18px; border: 1px solid #d7e8ff; border-radius: 12px; background: #eff7ff; }
h1 { margin: 0 0 5px; font-size: 20px; } p { margin: 0; color: #617083; font-size: 13px; }
.head-actions { display: flex; align-items: center; gap: 10px; }
.count { padding: 6px 10px; border-radius: 999px; color: #1768c4; background: #dceeff; font-size: 13px; }
.workspace { display: grid; min-height: 0; flex: 1; grid-template-columns: 210px minmax(0, 1fr); gap: 14px; margin-top: 14px; }
.dataset-list, .content { border: 1px solid #e2e7ef; border-radius: 12px; background: #fff; }
.dataset-list { min-height: 0; overflow-y: auto; padding: 12px; }.aside-title { margin-bottom: 10px; font-weight: 700; }
.dataset-item { display: flex; width: 100%; justify-content: space-between; gap: 8px; margin-bottom: 7px; padding: 10px; border: 1px solid #e3e8ef; border-radius: 8px; color: #3c4858; background: #fff; text-align: left; cursor: pointer; }
.dataset-item.active { border-color: #409eff; background: #ecf5ff; }.dataset-item small { color: #718096; }.empty-small { padding: 28px 4px; color: #9aa5b3; text-align: center; }
.content { min-width: 0; min-height: 0; overflow-y: auto; padding: 14px; }.toolbar { display: grid; grid-template-columns: minmax(280px, 1fr) 200px; gap: 12px; }.toolbar label { display: grid; gap: 6px; font-size: 13px; font-weight: 600; }
select, input, button { min-height: 34px; border: 1px solid #d9e0e8; border-radius: 6px; background: #fff; font: inherit; }select, input { width: 100%; padding: 0 9px; }
.condition-box { margin-top: 12px; padding: 12px; border-radius: 9px; background: #f8fafc; }.quick-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-bottom: 10px; }.condition-row { display: grid; grid-template-columns: 1fr 120px 1fr 52px; gap: 8px; margin-bottom: 8px; }
.condition-actions, .save-current, .dialog-actions, .pager { display: flex; align-items: center; justify-content: space-between; gap: 10px; }.link { border: 0; color: #409eff; background: transparent; cursor: pointer; }.link.danger { color: #f56c6c; }
.primary { padding: 0 16px; border-color: #409eff; color: #fff; background: #409eff; cursor: pointer; }.primary:disabled, button:disabled { opacity: .5; cursor: not-allowed; }
.table-wrap { margin-top: 12px; overflow: hidden; border: 1px solid #e4e8ee; border-radius: 9px; }table { width: 100%; border-collapse: collapse; table-layout: fixed; }th, td { padding: 9px 10px; overflow: hidden; border-bottom: 1px solid #edf0f4; color: #4a5568; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }th { color: #667085; background: #f7f9fc; text-align: left; }.check-col { width: 42px; text-align: center; }.check-col input { width: auto; min-height: auto; }.empty-row { padding: 42px; color: #9aa5b3; text-align: center; }
.pager { padding: 10px 12px; color: #6c7786; font-size: 12px; }.pager div { display: flex; align-items: center; gap: 8px; }.pager button { padding: 0 10px; }
.save-current { margin-top: 12px; color: #718096; font-size: 12px; }.dialog-actions { margin-top: 14px; justify-content: flex-end; }.dialog-actions button { padding: 0 18px; }.error { margin-top: 10px; padding: 9px 12px; border-radius: 7px; color: #c0362c; background: #fff1f0; font-size: 13px; }
@media (max-width: 760px) { .selector-app { height: auto; min-height: 0; overflow: visible; padding: 10px; }.workspace { grid-template-columns: 1fr; }.dataset-list { min-height: auto; }.content { overflow: visible; }.toolbar { grid-template-columns: 1fr; }.condition-row { grid-template-columns: 1fr 100px; }.condition-row input { grid-column: 1 / -1; } }
</style>

