<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="IDENTITY GOVERNANCE" title="身份同步与权限解释" description="连接器只保存密钥引用；同步先生成差异计划，再用计划哈希和幂等键执行。新账号默认停用，不生成密码。">
      <button type="button" class="mci-button" @click="connectorOpen = true">新建身份连接器</button>
      <button type="button" class="mci-button mci-button--primary" :disabled="!selectedConnectorId || action.status === 'loading'" @click="planSync">生成同步计划</button>
    </MciPageIntro>

    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <div v-else class="mci-grid">
      <article class="mci-card mci-section span-5">
        <div class="mci-section__head"><div><h2>身份来源</h2><p>SCIM 由可信宿主读取；导入与扩展连接器接收净化后的标准 JSON。</p></div><span class="mci-badge">{{ connectors.length }} 个连接器</span></div>
        <MciStatePanel v-if="!connectors.length" state="empty" title="暂无身份连接器" action="创建安全导入连接器" @action="connectorOpen = true" />
        <template v-else>
          <label class="mci-field"><span>连接器</span><select v-model="selectedConnectorId"><option v-for="item in connectors" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }} · {{ item.ConnectorType }}</option></select></label>
          <label v-if="!usesTrustedScim" class="mci-field source-field"><span>来源记录 JSON（留空时调用租户扩展）</span><textarea v-model="sourceText" spellcheck="false" placeholder='[{"Account":"zhangsan","Name":"张三","Email":"..."}]'></textarea></label>
          <div v-else class="trusted-source"><strong>可信 SCIM 目录</strong><span>{{ selectedConnector?.Endpoint }}</span><small>分页上限 5 页 / 1000 人；Bearer Token 只在服务端解密，响应仅保留标准身份属性。</small></div>
          <div class="security-note"><span aria-hidden="true">✓</span><p>前端与 V8 均不接收密码、Token 或连接器密钥；新账号默认停用且不生成密码。</p></div>
        </template>
      </article>

      <article class="mci-card mci-section span-7">
        <div class="mci-section__head"><div><h2>同步计划</h2><p>计划哈希把预检内容与最终执行绑定。</p></div><span v-if="syncPlan" class="mci-badge" :data-tone="syncPlan.Summary.Conflict ? 'warning' : 'success'">{{ syncPlan.Summary.Conflict ? '存在冲突' : '可执行' }}</span></div>
        <MciStatePanel v-if="!syncPlan" state="empty" title="尚未生成计划" message="选择连接器并提供来源记录后执行预检。" />
        <template v-else>
          <div class="plan-metrics"><div><strong>{{ syncPlan.Summary.Add }}</strong><small>待新增</small></div><div><strong>{{ syncPlan.Summary.Update }}</strong><small>待更新</small></div><div><strong>{{ syncPlan.Summary.Conflict }}</strong><small>冲突</small></div><div><strong>{{ syncPlan.Summary.Unchanged }}</strong><small>无变化</small></div></div>
          <code class="mci-code">PlanHash: {{ syncPlan.PlanHash }}\nSource: {{ syncPlan.Source?.Mode || 'Request' }} · {{ syncPlan.Source?.Fetched ?? syncPlan.Source?.TotalResults ?? 0 }} records</code>
          <div class="mci-section__actions plan-actions"><button type="button" class="mci-button" @click="syncPlan = null">清除计划</button><button type="button" class="mci-button mci-button--primary" :disabled="action.status === 'loading'" @click="syncConfirmOpen = true">执行该计划</button></div>
        </template>
        <div v-if="action.message" class="feedback" :data-state="action.status" role="status">{{ action.message }}</div>
      </article>

      <article class="mci-card mci-section span-6">
        <div class="mci-section__head"><div><h2>最近同步</h2><p>每个幂等键只产生一个运行结果。</p></div></div>
        <MciStatePanel v-if="!runs.length" state="empty" title="暂无同步记录" />
        <MciDataTable v-else :rows="runs" :columns="runColumns" />
      </article>
      <article class="mci-card mci-section span-6">
        <div class="mci-section__head"><div><h2>待处理冲突</h2><p>冲突不会静默覆盖现有账号。</p></div><span class="mci-badge" :data-tone="conflicts.length ? 'warning' : 'success'">{{ conflicts.length }}</span></div>
        <MciStatePanel v-if="!conflicts.length" state="empty" title="没有待处理冲突" />
        <MciDataTable v-else :rows="conflicts" :columns="conflictColumns" />
      </article>
      <article class="mci-card mci-section span-12">
        <div class="mci-section__head"><div><h2>权限为什么允许或拒绝</h2><p>直接复用真实 FormEngine 授权边界，覆盖表、菜单、动作、行范围与保护资源。</p></div><button type="button" class="mci-button" :disabled="permissionBusy" @click="explainPermission">{{ permissionBusy ? '解释中…' : '生成解释' }}</button></div>
        <div class="permission-form"><label class="mci-field"><span>用户Id（留空解释当前用户）</span><input v-model.trim="permissionForm.UserId" placeholder="可选" /></label><label class="mci-field"><span>表Key / 表名</span><input v-model.trim="permissionForm.TableKey" placeholder="例如 diy_order" /></label><label class="mci-field"><span>动作</span><select v-model="permissionForm.Operation"><option>List</option><option>Read</option><option>Add</option><option>Edit</option><option>Delete</option><option>Import</option><option>Export</option></select></label><label class="mci-field"><span>菜单Id</span><input v-model.trim="permissionForm.MenuId" placeholder="可选；指定菜单上下文" /></label><label class="mci-field"><span>模块Key</span><input v-model.trim="permissionForm.ModuleEngineKey" placeholder="可选" /></label><label class="mci-field"><span>样例行Id</span><input v-model.trim="permissionForm.RowId" placeholder="可选；验证行范围" /></label></div>
        <pre v-if="permissionResult" class="mci-code permission-result">{{ JSON.stringify(permissionResult, null, 2) }}</pre>
      </article>
    </div>

    <MciDialog :open="connectorOpen" title="新建身份连接器" confirm-text="创建连接器" :busy="action.status === 'loading'" @cancel="connectorOpen = false" @confirm="createConnector">
      <div class="form-grid"><label class="mci-field"><span>连接器Key</span><input v-model.trim="connectorForm.ConnectorKey" placeholder="hr-directory" /></label><label class="mci-field"><span>连接器名称</span><input v-model.trim="connectorForm.Name" placeholder="人事身份目录" /></label><label class="mci-field"><span>类型</span><select v-model="connectorForm.ConnectorType"><option>Import</option><option>SCIM</option><option>Custom</option></select></label><label v-if="connectorForm.ConnectorType === 'SCIM'" class="mci-field full"><span>SCIM HTTPS 基础地址</span><input v-model.trim="connectorForm.Endpoint" placeholder="https://directory.example.com/scim/v2" /></label><label v-if="connectorForm.ConnectorType === 'SCIM'" class="mci-field full"><span>租户密钥设置 Key</span><input v-model.trim="connectorForm.SecretReference" placeholder="Identity.Directory.Hr.BearerToken" /></label></div>
      <p>这里只保存密钥引用。SCIM 端点拒绝私网、环回、链路本地、重定向和超大响应；其它目录协议通过租户扩展 Hook 接入。</p>
    </MciDialog>
    <MciDialog :open="syncConfirmOpen" title="确认执行身份同步" confirm-text="执行同步计划" :busy="action.status === 'loading'" @cancel="syncConfirmOpen = false" @confirm="applySync">
      <p>即将新增 {{ syncPlan?.Summary.Add ?? 0 }} 个停用账号、更新 {{ syncPlan?.Summary.Update ?? 0 }} 个已有账号，并记录 {{ syncPlan?.Summary.Conflict ?? 0 }} 个冲突。提交后使用稳定幂等键，即使网络重试也不会重复执行。</p>
      <code class="mci-code">PlanHash: {{ syncPlan?.PlanHash }}\nIdempotencyKey: {{ idempotencyKey }}</code>
    </MciDialog>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MciDataTable from '../components/MciDataTable.vue'
import MciDialog from '../components/MciDialog.vue'
import MciPageIntro from '../components/MciPageIntro.vue'
import MciStatePanel from '../components/MciStatePanel.vue'
import type { ActionState, HostContext } from '../domain/models'
import { addRow, getTable, runEngine } from '../platform/client'

const props = defineProps<{ context: HostContext }>()
type Row = Record<string, any>
interface SyncPlan { PlanHash: string; Summary: { Add: number; Update: number; Conflict: number; Unchanged: number }; Source?: { Mode?: string; Fetched?: number; TotalResults?: number }; Plan: unknown }
const connectors = ref<Row[]>([]), runs = ref<Row[]>([]), conflicts = ref<Row[]>([]), selectedConnectorId = ref('')
const state = ref<'loading' | 'ready' | 'error'>('loading'), error = ref(''), action = reactive<ActionState>({ status: 'idle' })
const sourceText = ref('[\n  { "Account": "zhangsan", "Name": "张三", "Email": "zhangsan@example.com" }\n]')
const syncPlan = ref<SyncPlan | null>(null), idempotencyKey = ref(''), syncConfirmOpen = ref(false), connectorOpen = ref(false)
const connectorForm = reactive({ ConnectorKey: '', Name: '', ConnectorType: 'Import', Endpoint: '', SecretReference: '' })
const selectedConnector = computed(() => connectors.value.find((item) => String(item.Id) === selectedConnectorId.value) || null)
const usesTrustedScim = computed(() => String(selectedConnector.value?.ConnectorType || '').toUpperCase() === 'SCIM')
const permissionForm = reactive({ UserId: '', TableKey: '', Operation: 'List', MenuId: '', ModuleEngineKey: '', RowId: '' }), permissionResult = ref<unknown>(null), permissionBusy = ref(false)
const runColumns = [{ key: 'Status', label: '状态', tone: true }, { key: 'AddCount', label: '新增' }, { key: 'UpdateCount', label: '更新' }, { key: 'ConflictCount', label: '冲突' }, { key: 'StartedTime', label: '开始时间' }]
const conflictColumns = [{ key: 'Account', label: '账号' }, { key: 'ConflictType', label: '类型' }, { key: 'Message', label: '说明' }, { key: 'Status', label: '状态', tone: true }]
function parseSource(): unknown[] { const value = JSON.parse(sourceText.value || '[]'); if (!Array.isArray(value)) throw new Error('来源记录必须是JSON数组。'); return value }
async function load() { state.value = 'loading'; error.value = ''; try { const [c, r, f] = await Promise.all([getTable<Row>(props.context, 'mci_identity_connector'), getTable<Row>(props.context, 'mci_identity_sync_run'), getTable<Row>(props.context, 'mci_identity_sync_conflict', { _Where: [['Status', '=', 'Open']] })]); connectors.value = c.rows; runs.value = r.rows; conflicts.value = f.rows; if (!selectedConnectorId.value && connectors.value.length) selectedConnectorId.value = String(connectors.value[0].Id); state.value = 'ready' } catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } }
async function runAction<T>(work: () => Promise<T>, success: string) { action.status = 'loading'; action.message = ''; try { const result = await work(); action.status = 'success'; action.message = success; return result } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '执行失败'; return null } }
async function createConnector() { if (!connectorForm.ConnectorKey || !connectorForm.Name) { action.status = 'error'; action.message = '连接器Key和名称不能为空。'; return } if (connectorForm.ConnectorType === 'SCIM' && (!connectorForm.Endpoint.startsWith('https://') || !connectorForm.SecretReference)) { action.status = 'error'; action.message = 'SCIM连接器必须填写HTTPS地址和租户密钥设置Key。'; return } const result = await runAction(() => addRow(props.context, 'mci_identity_connector', { ...connectorForm, MappingJson: '{}', StrategyJson: '{}', Enabled: 1 }), '身份连接器已创建。'); if (result) { connectorOpen.value = false; Object.assign(connectorForm, { ConnectorKey: '', Name: '', ConnectorType: 'Import', Endpoint: '', SecretReference: '' }); await load() } }
async function planSync() { if (!selectedConnectorId.value) return; let records: unknown[] = []; if (!usesTrustedScim.value) { try { records = parseSource() } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : 'JSON解析失败'; return } } const result = await runAction(() => runEngine<SyncPlan>(props.context, 'mci-identity-sync-plan', { ConnectorId: selectedConnectorId.value, SourceRecords: records }), '身份同步计划已生成。'); if (result) { syncPlan.value = result; idempotencyKey.value = `identity-${selectedConnectorId.value}-${result.PlanHash.slice(0, 20)}` } }
async function applySync() { if (!syncPlan.value) return; const records = usesTrustedScim.value ? [] : parseSource(); const result = await runAction(() => runEngine(props.context, 'mci-identity-sync-apply', { ConnectorId: selectedConnectorId.value, SourceRecords: records, ExpectedPlanHash: syncPlan.value?.PlanHash, IdempotencyKey: idempotencyKey.value }), '身份同步已完成。'); if (result) { syncConfirmOpen.value = false; syncPlan.value = null; await load() } }
async function explainPermission() { permissionBusy.value = true; try { permissionResult.value = await runEngine(props.context, 'mci-permission-explain', { ...permissionForm }) } catch (e) { permissionResult.value = { Error: e instanceof Error ? e.message : '解释失败' } } finally { permissionBusy.value = false } }
onMounted(load)
</script>

<style scoped>
.source-field { margin-top: 14px; }.trusted-source { display: grid; gap: 6px; margin-top: 14px; padding: 13px; border: 1px solid color-mix(in srgb, var(--mci-color-primary) 30%, var(--mci-border-color)); border-radius: var(--mci-shape-input); background: color-mix(in srgb, var(--mci-color-primary) 6%, var(--mci-bg-soft)); }.trusted-source span { overflow-wrap: anywhere; color: var(--mci-text-secondary); }.trusted-source small { color: var(--mci-text-tertiary); line-height: 1.6; }.security-note { display: flex; gap: 10px; margin-top: 12px; padding: 11px 12px; border: 1px solid color-mix(in srgb, var(--mci-color-success) 25%, var(--mci-border-color)); border-radius: var(--mci-shape-input); color: var(--mci-text-secondary); background: color-mix(in srgb, var(--mci-color-success) 6%, var(--mci-bg-elevated)); }.security-note span { color: var(--mci-color-success); font-weight: 800; }.security-note p { margin: 0; line-height: 1.6; }.plan-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 9px; margin-bottom: 12px; }.plan-metrics div { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.plan-metrics strong { font-family: var(--mci-font-mono); font-size: 23px; }.plan-metrics small { color: var(--mci-text-tertiary); }.plan-actions { margin-top: 14px; }.feedback { margin-top: 12px; padding: 10px; border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.feedback[data-state="error"] { color: var(--mci-color-danger); }.feedback[data-state="success"] { color: var(--mci-color-success); }.permission-form, .form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.form-grid .full { grid-column: 1 / -1; }.permission-result { max-height: 380px; margin-top: 12px; }
@media (max-width: 640px) { .plan-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }.permission-form, .form-grid { grid-template-columns: 1fr; } }
</style>
