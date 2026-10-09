// 设计器只负责产生可审阅的 Vue 源码；数据权限仍由 FormEngine 按当前菜单和 DiyToken 判定。
const editableControls = new Set([
    "Text", "Textarea", "NumberText", "DateTime", "Select", "MultipleSelect",
    "Radio", "Checkbox", "Switch", "ColorPicker", "Slider", "Rate"
]);
const displayControls = new Set(["Guid", "AutoNumber", "Divider", "Alert", "StaticText"]);

function parseJson(value, fallback) {
    if (value && typeof value === "object") return value;
    if (typeof value !== "string" || !value.trim()) return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
}

function safeTableKey(value) {
    const tableKey = String(value || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(tableKey)) {
        throw new Error("表名只能包含英文字母、数字和下划线，且必须以字母开头。请先核对真实表名。");
    }
    return tableKey;
}

function safeFieldName(value) {
    const name = String(value || "").trim();
    if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/u.test(name)) throw new Error(`字段名不合法：${name}`);
    return name;
}

function normalizedOptions(field) {
    const config = parseJson(field.Config, {});
    if (config.DataSource && !["KeyValue", "Data"].includes(config.DataSource)) {
        throw new Error(`${field.Label || field.Name} 使用动态数据源，需要在生成的 Vue 页面中显式实现数据加载。`);
    }
    const rows = parseJson(field.Data, []);
    if (!Array.isArray(rows)) throw new Error(`${field.Label || field.Name} 的选项不是数组。`);
    return rows.map((row) => ({
        value: row?.Key ?? row?.Value ?? "",
        label: String(row?.Value ?? row?.Label ?? row?.Key ?? "")
    }));
}

function fieldTemplate(field) {
    const name = safeFieldName(field.Name);
    const label = escapeHtml(field.Label || name);
    const component = String(field.Component || "Text");
    const key = `'${name}'`;
    const value = `form[${key}]`;
    if (component === "Divider") return `      <h2 class="form-section-title">${label}</h2>`;
    if (component === "Alert" || component === "StaticText") return `      <p class="form-note">${label}</p>`;
    if (component === "Guid" || component === "AutoNumber") return `      <label v-if="canView('${name}')" class="form-field"><span>${label}</span><input :value="${value} ?? ''" readonly /></label>`;
    const required = Number(field.NotEmpty || 0) === 1 ? " required" : "";
    const fieldReadonly = Number(field.Readonly || 0) === 1;
    const readonly = ` :readonly="mode === 'view' || !canEdit('${name}')${fieldReadonly ? ' || true' : ''}"`;
    const disabled = ` :disabled="mode === 'view' || !canEdit('${name}')${fieldReadonly ? ' || true' : ''}"`;
    let control;
    if (component === "Textarea") control = `<textarea v-model="${value}"${required}${readonly} rows="4" />`;
    else if (component === "NumberText" || component === "Slider" || component === "Rate") control = `<input v-model.number="${value}" type="number"${required}${readonly} />`;
    else if (component === "DateTime") control = `<input v-model="${value}" type="datetime-local" step="1"${required}${readonly} />`;
    else if (component === "Switch") control = `<input v-model="${value}" type="checkbox"${disabled} />`;
    else if (component === "ColorPicker") control = `<input v-model="${value}" type="color"${disabled} />`;
    else if (["Select", "MultipleSelect", "Radio", "Checkbox"].includes(component)) {
        const multiple = component === "MultipleSelect" || component === "Checkbox";
        const options = normalizedOptions(field);
        if (!options.length && multiple) {
            throw new Error(`${field.Label || field.Name} 是多选控件，但设计器没有配置选项。`);
        }
        if (!options.length) {
            control = `<input v-model="${value}" type="text" placeholder="未配置选项，请输入"${required}${readonly} />`;
        } else {
            const rows = options.map((option) => `          <option :value="${escapeHtml(JSON.stringify(option.value))}">${escapeHtml(option.label)}</option>`).join("\n");
            control = `<select v-model="${value}"${multiple ? " multiple" : ""}${required}${disabled}>\n          <option value="">请选择</option>\n${rows}\n        </select>`;
        }
    } else control = `<input v-model="${value}" type="text"${required}${readonly} />`;
    return `      <label v-if="canView('${name}')" class="form-field"><span>${label}${required ? " *" : ""}</span>${control}</label>`;
}

/**
 * 生成可维护的表单 Vue SFC。复杂控件、动态数据源与前端事件委托平台原表单，
 * 保留已有行为；人工修改后的源码仍须审阅合并。
 */
export function generateFormVue(table, fields) {
    const tableKey = safeTableKey(table?.Name);
    const tableId = String(table?.Id || "").trim();
    if (!tableId) throw new Error("缺少表 Id，请先保存表单设计。 ");
    const clientEvents = ["InFormV8", "SubmitFormV8", "OutFormV8"]
        .filter(key => String(table?.[key] || "").trim());
    const ordered = [...(Array.isArray(fields) ? fields : [])]
        .filter((field) => field && Number(field.IsDeleted || 0) !== 1 && Number(field.Visible ?? 1) !== 0)
        .sort((a, b) => Number(a.Sort || 0) - Number(b.Sort || 0));
    const scripted = ordered.filter(field => {
        const config = parseJson(field.Config, {});
        return [field.V8Code, field.V8CodeBlur, field.V8TmpEngineForm, field.V8TmpEngineTable,
            config.V8Code, config.V8CodeBlur].some(value => String(value || "").trim());
    });
    const unsupported = ordered.filter((field) => !editableControls.has(field.Component || "Text") && !displayControls.has(field.Component));
    const dynamicOptions = ordered.some(field => {
        const config = parseJson(field.Config, {});
        return config.DataSource && !["KeyValue", "Data"].includes(config.DataSource);
    });
    const emptyMultiOptions = ordered.some(field => ["MultipleSelect", "Checkbox"].includes(field.Component) && !parseJson(field.Data, []).length);
    if (clientEvents.length || scripted.length || unsupported.length || dynamicOptions || emptyMultiOptions) {
        return generateRuntimeFormVue(table, ordered);
    }
    const editable = ordered.filter((field) => editableControls.has(field.Component || "Text"));
    const title = String(table.Label || table.Description || tableKey);
    const tabs = parseJson(table.Tabs, []);
    const tabNames = new Map((Array.isArray(tabs) ? tabs : []).map(tab => [String(tab.Id || tab.Name), String(tab.Name || tab.Label || tab.Id)]));
    let previousTab = null;
    const fieldMarkup = ordered.map(field => {
        const tab = String(field.Tab || "");
        const heading = tab && tab !== previousTab ? `      <h2 class="form-section-title">${escapeHtml(tabNames.get(tab) || tab)}</h2>\n` : "";
        previousTab = tab;
        return heading + fieldTemplate(field);
    }).join("\n");
    const listFields = [...editable.filter(field => Number(field.Readonly || 0) !== 1),
        ...editable.filter(field => Number(field.Readonly || 0) === 1)].slice(0, 5);
    const columns = listFields.map((field) => `        <th v-if="canView('${safeFieldName(field.Name)}')">${escapeHtml(field.Label || field.Name)}</th>`).join("\n");
    const cells = listFields.map((field) => `        <td v-if="canView('${safeFieldName(field.Name)}')" data-label="${escapeHtml(field.Label || field.Name)}">{{ row[${JSON.stringify(safeFieldName(field.Name))}] }}</td>`).join("\n");
    const initial = Object.fromEntries(ordered
        .filter(field => editableControls.has(field.Component || "Text") || ["Guid", "AutoNumber"].includes(field.Component))
        .map(field => [safeFieldName(field.Name), field.Component === "Switch" ? false : field.Component === "MultipleSelect" || field.Component === "Checkbox" ? [] : ""]));
    const editableFieldNames = editable
        .filter(field => Number(field.Readonly || 0) !== 1)
        .map(field => safeFieldName(field.Name));
    const dateFieldNames = ordered
        .filter(field => field.Component === "DateTime")
        .map(field => safeFieldName(field.Name));
    return `<template>
  <main class="generated-form-page">
    <header class="form-header"><div><small>吾码表单代码模式</small><h1>${escapeHtml(title)}</h1></div><button type="button" @click="openAdd">新增</button></header>
    <p v-if="error" role="alert" class="form-error">{{ error }}</p>
    <section v-if="mode" class="form-panel">
      <div class="form-panel-head"><h2>{{ mode === 'add' ? '新增' : mode === 'view' ? '详情' : '编辑' }}</h2><button type="button" class="quiet" @click="closeForm">关闭</button></div>
      <form @submit.prevent="save">
${fieldMarkup}
        <div class="form-actions"><button v-if="mode !== 'view'" type="submit" :disabled="saving">{{ saving ? '保存中…' : '保存' }}</button></div>
      </form>
    </section>
    <section class="form-panel" aria-label="数据列表">
      <div class="form-panel-head"><h2>记录</h2><button type="button" class="quiet" @click="loadRows">刷新</button></div>
      <p v-if="loading">加载中…</p>
      <table v-else><thead><tr>
${columns}
        <th>操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.Id">
${cells}
        <td data-label="操作"><button type="button" class="quiet" @click="openRecord(row, 'view')">查看</button><button type="button" class="quiet" @click="openRecord(row, 'edit')">编辑</button></td>
      </tr></tbody></table>
      <p v-if="!loading && !rows.length">暂无记录</p>
      <nav class="form-pagination"><button type="button" class="quiet" :disabled="page <= 1" @click="page--; loadRows()">上一页</button><span>第 {{ page }} 页</span><button type="button" class="quiet" :disabled="rows.length < pageSize" @click="page++; loadRows()">下一页</button></nav>
    </section>
  </main>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { microiV8 as V8 } from '../platform/microi'

const tableKey = ${JSON.stringify(tableKey)}
const initialForm = ${JSON.stringify(initial, null, 2)}
const editableFieldNames = ${JSON.stringify(editableFieldNames)}
const dateFieldNames = ${JSON.stringify(dateFieldNames)}
const pageSize = 20
const page = ref(1)
const rows = ref([])
const mode = ref('')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const form = reactive({ ...initialForm })
const fieldAccess = ref(null)
function canView(name) { return fieldAccess.value?.Fields?.[name]?.Visible ?? fieldAccess.value?.DefaultVisible ?? true }
function canEdit(name) { return canView(name) && (fieldAccess.value?.Fields?.[name]?.Editable ?? fieldAccess.value?.DefaultEditable ?? true) }
function acceptFieldAccess(result) { fieldAccess.value = result?.DataAppend?.FieldAccess || null }

// 菜单 Id 来自宿主上下文；客户端参数只选择授权范围，服务端仍按 DiyToken 判权。
function menuId() {
  const value = String(window.microApp?.getData?.()?.permissionContext?.sysMenuId || '')
  if (!value) throw new Error('缺少菜单授权上下文，请从吾码菜单打开本页面。')
  return value
}
function checkResult(result) { if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '操作失败') }
function closeForm() { mode.value = ''; error.value = '' }
function openAdd() {
  for (const key of Object.keys(form)) delete form[key]
  Object.assign(form, structuredClone(initialForm))
  mode.value = 'add'; error.value = ''
}
async function openRecord(row, targetMode) {
  error.value = ''
  try {
    // 列表由菜单的 SelectFields 裁剪，编辑前必须重新读取完整且已授权的单行。
    const result = await V8.FormEngine.GetFormData(tableKey, { Id: row.Id, _SysMenuId: menuId() })
    checkResult(result)
    acceptFieldAccess(result)
    const detail = result.Data
    if (!detail || !detail.Id) throw new Error('未取得完整表单记录')
    for (const key of Object.keys(form)) delete form[key]
    Object.assign(form, structuredClone(initialForm))
    for (const key of Object.keys(initialForm)) {
      const value = detail[key] ?? initialForm[key]
      form[key] = dateFieldNames.includes(key) && value ? String(value).replace(' ', 'T') : value
    }
    form.Id = detail.Id
    mode.value = targetMode
  } catch (cause) { error.value = cause?.message || String(cause) }
}
async function loadRows() {
  loading.value = true; error.value = ''
  try {
    const result = await V8.FormEngine.GetTableData(tableKey, { _SysMenuId: menuId(), _PageIndex: page.value, _PageSize: pageSize })
    checkResult(result); acceptFieldAccess(result); rows.value = Array.isArray(result.Data) ? result.Data : []
  } catch (cause) { error.value = cause?.message || String(cause) }
  finally { loading.value = false }
}
async function save() {
  if (mode.value === 'view' || saving.value) return
  saving.value = true; error.value = ''
  try {
    const record = Object.fromEntries(editableFieldNames.filter(canEdit).map(key => [key,
      dateFieldNames.includes(key) && form[key] ? String(form[key]).replace('T', ' ') : form[key]]))
    if (mode.value !== 'add') record.Id = form.Id
    const result = mode.value === 'add'
      ? await V8.FormEngine.AddFormData({ FormEngineKey: tableKey, _SysMenuId: menuId(), _RowModel: record })
      : await V8.FormEngine.UptFormData({ FormEngineKey: tableKey, Id: record.Id, _SysMenuId: menuId(), _RowModel: record })
    checkResult(result); closeForm(); await loadRows()
  } catch (cause) { error.value = cause?.message || String(cause) }
  finally { saving.value = false }
}
onMounted(loadRows)
</script>

<style scoped>
.generated-form-page{font-family:Inter,"Microsoft YaHei",sans-serif;color:#1f2937;padding:24px;display:grid;gap:18px;max-width:1400px;margin:auto}.form-header,.form-panel-head,.form-actions,.form-pagination{display:flex;align-items:center;justify-content:space-between;gap:12px}.form-header h1{margin:4px 0;font-size:26px}.form-header small{color:#64748b}.form-panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:20px;overflow:auto}.form-panel h2{font-size:17px;margin:0 0 14px}.form-field{display:grid;gap:7px;margin:0 0 16px;font-size:14px}.form-field input:not([type=checkbox]),.form-field textarea,.form-field select{width:100%;min-height:38px;border:1px solid #cbd5e1;border-radius:8px;padding:8px;background:#fff;color:#111827}.form-field input[type=checkbox]{width:20px;height:20px}.form-section-title{font-size:16px;padding-top:8px;border-top:1px solid #e2e8f0}.form-note{color:#64748b}.form-error{color:#b42318;background:#fef3f2;padding:10px;border-radius:8px}button{border:0;border-radius:8px;padding:9px 14px;background:#2563eb;color:#fff;cursor:pointer}button:disabled{opacity:.5;cursor:default}button.quiet{color:#2563eb;background:#eff6ff}table{border-collapse:collapse;min-width:680px;width:100%;font-size:14px}th,td{border-bottom:1px solid #e2e8f0;text-align:left;padding:10px}.form-pagination{justify-content:flex-end;margin-top:15px}@media(max-width:640px){.generated-form-page{padding:12px}.form-panel{padding:14px}}
@media(max-width:640px){table{min-width:0}thead{display:none}tbody tr{display:grid;border-bottom:1px solid #e2e8f0;padding:8px 0}td{display:flex;align-items:center;gap:8px;min-height:40px;border:0;padding:5px 0;overflow-wrap:anywhere}td::before{content:attr(data-label);flex:0 0 38%;color:#64748b;font-weight:600}td:last-child{flex-wrap:wrap}td:last-child::before{align-self:center}}
</style>
`;
}

export function generatedFormFilePath(table) {
    return `src/pages/Form_${safeTableKey(table?.Name)}.vue`;
}

export function generatedFormRoutePath(table) {
    return `/forms/${safeTableKey(table?.Name).toLowerCase()}`;
}

// 这是独立的微服务入口。每张表编译成独立 SFC，运行时只按路由加载对应 chunk。
export const generatedFormAppShell = `<!-- microi-generated-form-app-v1 -->
<template>
  <Suspense><component :is="activePage" /><template #fallback><p>页面加载中…</p></template></Suspense>
</template>
<script setup>
import { computed, defineAsyncComponent, onMounted, onUnmounted, ref } from 'vue'
import { configureMicroiV8, getMicroiContext } from './platform/microi'
import routeManifest from '../microi.routes.json'
const modules = import.meta.glob('./pages/Form_*.vue')
const currentPath = ref('/')
function normalizePath(value) {
  const path = String(value || '/').split('?')[0].replace(/\\/+$/, '') || '/'
  return path.startsWith('/') ? path : '/' + path
}
function updateFromHost(data) {
  const next = data?.microRoute || data?.route?.path || location.hash.slice(1) || '/'
  currentPath.value = normalizePath(next)
  configureMicroiV8(getMicroiContext())
}
const activePage = computed(() => {
  const route = routeManifest.find(item => normalizePath(item.path) === currentPath.value)
    || (currentPath.value === '/' && routeManifest.find(item => item.isHome && item.sourceFile))
  const source = route?.sourceFile && './' + String(route.sourceFile).replace(/^src\\//, '')
  const loader = source && modules[source]
  return loader ? defineAsyncComponent(loader) : { template: '<p role="alert">页面尚未生成或发布。</p>' }
})
onMounted(() => {
  updateFromHost(window.microApp?.getData?.())
  window.microApp?.addDataListener?.(updateFromHost, true)
  window.addEventListener('hashchange', updateFromHash)
})
function updateFromHash() { updateFromHost(window.microApp?.getData?.()) }
onUnmounted(() => {
  window.microApp?.removeDataListener?.(updateFromHost)
  window.removeEventListener('hashchange', updateFromHash)
})
</script>
`;

export const generatedFormAppMarker = "microi-generated-form-app-v1";

/** 复杂表单保留平台控件、数据源和 V8 事件，通过已有宿主动作打开完整表单。 */
function generateRuntimeFormVue(table, fields) {
    const tableKey = safeTableKey(table.Name);
    const columns = fields.filter(f => !["Guid", "TableChild", "Tabs", "CollapseGroup", "Divider", "Alert", "Button", "ImgUpload", "FileUpload", "RichText"].includes(f.Component)).slice(0, 5);
    return `<template>
  <main class="form-code-page">
    <header><div><h1>${escapeHtml(table.Label || table.Description || tableKey)}</h1><p>数据与表单共用当前模块的授权范围</p></div><button @click="openForm('Add')">新增</button></header>
    <p v-if="error" role="alert">{{ error }}</p>
    <section><button @click="loadRows" :disabled="loading">{{ loading ? '加载中…' : '刷新' }}</button>
      <table><thead><tr>${columns.map(f => `<th v-if="canView('${safeFieldName(f.Name)}')">${escapeHtml(f.Label || f.Name)}</th>`).join('')}<th>操作</th></tr></thead>
        <tbody><tr v-for="row in rows" :key="row.Id">${columns.map(f => `<td v-if="canView('${safeFieldName(f.Name)}')" data-label="${escapeHtml(f.Label || f.Name)}">{{ row[${JSON.stringify(safeFieldName(f.Name))}] }}</td>`).join('')}<td data-label="操作"><button @click="openForm('View', row.Id)">查看</button><button @click="openForm('Edit', row.Id)">编辑</button></td></tr></tbody>
      </table><p v-if="!loading && !rows.length">暂无记录</p>
      <nav><button :disabled="page === 1" @click="page--; loadRows()">上一页</button><span>第 {{ page }} 页 · 共 {{ total }} 条</span><button :disabled="page * pageSize >= total" @click="page++; loadRows()">下一页</button></nav>
    </section>
  </main>
</template>
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { microiV8 as V8 } from '../platform/microi'
const tableKey = ${JSON.stringify(tableKey)}
const rows = ref([]), error = ref(''), loading = ref(false), page = ref(1), total = ref(0), pageSize = 20
const pending = new Map()
const fieldAccess = ref(null)
function canView(name) { return fieldAccess.value?.Fields?.[name]?.Visible ?? fieldAccess.value?.DefaultVisible ?? true }
function menuId() {
  const id = String(window.microApp?.getData?.()?.permissionContext?.sysMenuId || '')
  if (!id) throw new Error('请从已授权的模块菜单打开表单代码页面')
  return id
}
async function loadRows() {
  loading.value = true; error.value = ''
  try {
    const result = await V8.FormEngine.GetTableData(tableKey, { _SysMenuId: menuId(), _PageIndex: page.value, _PageSize: pageSize })
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || '读取失败')
    fieldAccess.value = result.DataAppend?.FieldAccess || null
    rows.value = result.Data || []; total.value = Number(result.DataCount || 0)
  } catch (cause) { error.value = cause.message || String(cause) }
  finally { loading.value = false }
}
function onHostData(message) {
  if (message?.type === 'micro-app:form-saved' && message.data?.tableName?.toLowerCase() === tableKey.toLowerCase()) loadRows()
  message = message?.hostActionResult || message
  if (message?.type !== 'micro-app:host-action-result') return
  const item = pending.get(message.requestId)
  if (!item) return
  clearTimeout(item.timer); pending.delete(message.requestId)
  if (message.success === false || message.error) item.reject(new Error(message.error?.message || '表单打开失败'))
  else item.resolve(message.data)
}
async function openForm(formMode, id = '') {
  error.value = ''
  try {
    const sysMenuId = menuId(), app = window.microApp
    if (!app?.dispatch || !app?.addDataListener) throw new Error('当前平台宿主不支持表单，请升级平台前端')
    const requestId = crypto.randomUUID()
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('表单打开超时，请重试')) }, 30000)
      pending.set(requestId, { resolve, reject, timer })
      app.dispatch({ type: 'micro-app:host-action', protocol: 'microi.host.v1', requestId, action: 'openForm', data: { tableName: tableKey, formMode, id, sysMenuId } })
    })
  } catch (cause) { error.value = cause.message || String(cause) }
}
onMounted(() => { window.microApp?.addDataListener?.(onHostData); loadRows() })
onBeforeUnmount(() => { window.microApp?.removeDataListener?.(onHostData); for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('页面已关闭')) } pending.clear() })
</script>
<style scoped>
.form-code-page{padding:24px;max-width:1400px;margin:auto;color:var(--el-text-color-primary,#172033);background:var(--el-bg-color-page,#f4f6fa)}header,nav{display:flex;align-items:center;justify-content:space-between;gap:12px}h1{margin:0;font-size:24px}p{color:var(--el-text-color-secondary,#64748b)}section{margin-top:20px;padding:20px;border:1px solid var(--el-border-color-light,#e2e8f0);border-radius:14px;background:var(--el-bg-color,#fff);overflow:auto}button{cursor:pointer;min-height:40px;padding:8px 14px;border:1px solid #cbd5e1;border-radius:8px;color:#2563eb;background:#eff6ff}button:disabled{opacity:.5;cursor:default}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{text-align:left;padding:14px 10px;border-bottom:1px solid #e2e8f0}td button+button{margin-left:8px}nav{justify-content:flex-end;margin-top:16px}[role=alert]{color:#b42318}@media(max-width:640px){.form-code-page{padding:12px}section{padding:12px}thead{display:none}tr{display:grid;padding:8px 0;border-bottom:1px solid #e2e8f0}td{display:flex;gap:12px;border:0;padding:8px 0;overflow-wrap:anywhere}td:before{content:attr(data-label);flex:0 0 30%;color:#64748b}}
</style>`;
}
