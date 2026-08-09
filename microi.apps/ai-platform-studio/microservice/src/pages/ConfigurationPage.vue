<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="CONFIGURATION GOVERNANCE" title="配置模板、继承解析与漂移巡检" description="非敏感参数与 Secret 引用分离；发布生成稳定摘要和不可变版本，环境配置按继承链解析并留下漂移证据。">
      <button type="button" class="mci-button mci-button--primary" @click="publishOpen = true">发布配置模板</button>
    </MciPageIntro>
    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <template v-else>
      <div class="config-metrics"><article class="mci-card"><strong>{{ profiles.length }}</strong><small>已发布模板</small></article><article class="mci-card"><strong>{{ profiles.filter((item) => item.Environment === 'Production').length }}</strong><small>生产基线</small></article><article class="mci-card"><strong>{{ activeDrifts }}</strong><small>活动漂移</small></article><article class="mci-card"><strong>{{ inheritedProfiles }}</strong><small>继承模板</small></article></div>
      <div class="mci-grid">
        <article class="mci-card mci-section span-7">
          <div class="mci-section__head"><div><h2>配置模板</h2><p>版本、环境、父配置和内容摘要均可审计。</p></div><span class="mci-badge">{{ profiles.length }} 项</span></div>
          <MciStatePanel v-if="!profiles.length" state="empty" title="尚无配置模板" action="发布第一个模板" @action="publishOpen = true" />
          <MciDataTable v-else :rows="profiles" :columns="profileColumns"><template #actions="{ row }"><button type="button" @click="resolveProfile(row)">解析继承</button></template></MciDataTable>
          <code v-if="resolved" class="mci-code resolved">{{ JSON.stringify(resolved, null, 2) }}</code>
        </article>
        <article class="mci-card mci-section span-5">
          <div class="mci-section__head"><div><h2>环境漂移巡检</h2><p>比较两条已发布配置的最终有效结果。</p></div></div>
          <div class="drift-form"><label class="mci-field"><span>基线配置</span><select v-model="scanForm.BaselineProfileId"><option v-for="item in profiles" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }} · {{ item.Environment }}</option></select></label><label class="mci-field"><span>目标配置</span><select v-model="scanForm.TargetProfileId"><option v-for="item in profiles" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }} · {{ item.Environment }}</option></select></label></div>
          <button type="button" class="mci-button mci-button--primary scan-button" :disabled="action.status === 'loading' || profiles.length < 2" @click="scanDrift">执行巡检</button>
          <code v-if="scanResult" class="mci-code scan-result">{{ JSON.stringify(scanResult, null, 2) }}</code>
        </article>
        <article class="mci-card mci-section span-12">
          <div class="mci-section__head"><div><h2>漂移处置队列</h2><p>忽略必须说明理由，修复必须由新巡检证明摘要一致。</p></div><span class="mci-badge" :data-tone="activeDrifts ? 'warning' : 'success'">{{ activeDrifts }} 个活动漂移</span></div>
          <MciStatePanel v-if="!drifts.length" state="empty" title="尚无漂移记录" />
          <MciDataTable v-else :rows="drifts" :columns="driftColumns"><template #actions="{ row }"><button v-if="row.Status === 'Changed'" type="button" @click="openDriftAction(row, 'Ignore')">忽略</button><button v-else-if="row.Status === 'Ignored'" type="button" @click="openDriftAction(row, 'Reopen')">重新打开</button><button v-if="row.BaselineHash === row.ActualHash && row.Status !== 'Resolved'" type="button" @click="openDriftAction(row, 'Resolve')">标记修复</button></template></MciDataTable>
        </article>
      </div>
      <div v-if="action.message" class="feedback" :data-state="action.status" role="status">{{ action.message }}</div>
    </template>
    <MciDialog :open="publishOpen" title="发布配置模板" confirm-text="校验并发布" :busy="action.status === 'loading'" @cancel="publishOpen = false" @confirm="publishProfile(false)">
      <div class="form-grid"><label class="mci-field"><span>配置Key</span><input v-model.trim="profileForm.ProfileKey" placeholder="platform.production" /></label><label class="mci-field"><span>配置名称</span><input v-model.trim="profileForm.Name" placeholder="平台生产配置" /></label><label class="mci-field"><span>分类</span><select v-model="profileForm.Category"><option>Business</option><option>Runtime</option><option>Theme</option><option>Integration</option></select></label><label class="mci-field"><span>环境</span><select v-model="profileForm.Environment"><option>Development</option><option>Test</option><option>Staging</option><option>Production</option></select></label><label class="mci-field"><span>父配置</span><select v-model="profileForm.ParentProfileId"><option value="">无</option><option v-for="item in profiles" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }}</option></select></label><label class="mci-field"><span>语义版本</span><input v-model.trim="profileForm.VersionNo" placeholder="1.0.0" /></label><label class="mci-field"><span>负责人</span><input v-model.trim="profileForm.Owner" /></label><label class="mci-field full"><span>参数协议 JSON</span><textarea v-model="profileForm.SchemaJson" spellcheck="false"></textarea></label><label class="mci-field full"><span>非敏感值 JSON</span><textarea v-model="profileForm.ValuesJson" spellcheck="false"></textarea></label><label class="mci-field full"><span>Secret 引用 JSON</span><textarea v-model="profileForm.SecretReferencesJson" spellcheck="false"></textarea></label></div>
      <div class="dialog-tools"><button type="button" class="mci-button" :disabled="action.status === 'loading'" @click="publishProfile(true)">DryRun 校验</button><small>秘密原文只能保存在 SaaS 系统设置；此处仅填写设置 Key。</small></div><code v-if="publishPreview" class="mci-code preview">{{ JSON.stringify(publishPreview, null, 2) }}</code>
    </MciDialog>
    <MciDialog :open="driftActionOpen" title="处置配置漂移" confirm-text="确认处置" :busy="action.status === 'loading'" @cancel="driftActionOpen = false" @confirm="applyDriftAction">
      <label class="mci-field"><span>动作</span><input :value="driftAction.Action" disabled /></label><label class="mci-field"><span>原因 / 修复证据</span><textarea v-model.trim="driftAction.Reason" :placeholder="driftAction.Action === 'Ignore' ? '忽略原因必填' : '可填写修复说明'"></textarea></label>
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
import { getTable, runEngine } from '../platform/client'

const props = defineProps<{ context: HostContext }>()
type Row = Record<string, any>
const profiles = ref<Row[]>([]), drifts = ref<Row[]>([]), state = ref<'loading' | 'ready' | 'error'>('loading'), error = ref(''), action = reactive<ActionState>({ status: 'idle' })
const publishOpen = ref(false), driftActionOpen = ref(false), publishPreview = ref<unknown>(null), resolved = ref<unknown>(null), scanResult = ref<unknown>(null)
const profileForm = reactive({ ProfileKey: '', Name: '', Category: 'Business', Environment: 'Development', ParentProfileId: '', VersionNo: '1.0.0', Owner: '', SchemaJson: '{\n  "type": "object",\n  "properties": {}\n}', ValuesJson: '{\n  "enabled": true\n}', SecretReferencesJson: '{}' })
const scanForm = reactive({ BaselineProfileId: '', TargetProfileId: '' }), driftAction = reactive({ DriftId: '', Action: 'Ignore', Reason: '', ExpectedRowVersion: 0 })
const activeDrifts = computed(() => drifts.value.filter((item) => ['Changed', 'Ignored'].includes(item.Status)).length), inheritedProfiles = computed(() => profiles.value.filter((item) => item.ParentProfileId).length)
const profileColumns = [{ key: 'Name', label: '配置' }, { key: 'Environment', label: '环境' }, { key: 'VersionNo', label: '版本' }, { key: 'Status', label: '状态', tone: true }, { key: 'ContentHash', label: '摘要' }]
const driftColumns = [{ key: 'Environment', label: '环境' }, { key: 'Status', label: '状态', tone: true }, { key: 'BaselineHash', label: '基线摘要' }, { key: 'ActualHash', label: '实际摘要' }, { key: 'DetectedTime', label: '发现时间' }]
function parseJson(value: string, label: string) { try { return JSON.parse(value || '{}') } catch { throw new Error(`${label}必须是有效 JSON。`) } }
async function act<T>(work: () => Promise<T>, success: string) { action.status = 'loading'; action.message = ''; try { const result = await work(); action.status = 'success'; action.message = success; return result } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '执行失败'; return null } }
async function load() { state.value = 'loading'; error.value = ''; try { const [p, d] = await Promise.all([getTable<Row>(props.context, 'mci_configuration_profile'), getTable<Row>(props.context, 'mci_configuration_drift', { _OrderBy: 'DetectedTime', _OrderByType: 'DESC' })]); profiles.value = p.rows; drifts.value = d.rows; scanForm.BaselineProfileId ||= String(profiles.value[0]?.Id || ''); scanForm.TargetProfileId ||= String(profiles.value[1]?.Id || ''); state.value = 'ready' } catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } }
function publishPayload(dryRun: boolean) { return { ProfileKey: profileForm.ProfileKey, Name: profileForm.Name, Category: profileForm.Category, Environment: profileForm.Environment, ParentProfileId: profileForm.ParentProfileId, VersionNo: profileForm.VersionNo, Owner: profileForm.Owner, Schema: parseJson(profileForm.SchemaJson, '参数协议'), Values: parseJson(profileForm.ValuesJson, '非敏感值'), SecretReferences: parseJson(profileForm.SecretReferencesJson, 'Secret引用'), ExpectedContentHash: '', ChangeSummary: 'AI平台配置模板发布', Enabled: 1, DryRun: dryRun } }
async function publishProfile(dryRun: boolean) { if (!profileForm.ProfileKey || !profileForm.Name || !profileForm.VersionNo) { action.status = 'error'; action.message = '配置Key、名称和版本不能为空。'; return } let payload: Row; try { payload = publishPayload(dryRun) } catch (e) { action.status = 'error'; action.message = (e as Error).message; return } const result = await act(() => runEngine<Row>(props.context, 'mci-configuration-publish', payload), dryRun ? '配置协议和敏感值边界校验通过。' : '配置模板已发布。'); if (result && dryRun) publishPreview.value = result; if (result && !dryRun) { publishPreview.value = null; publishOpen.value = false; await load() } }
async function resolveProfile(row: Row) { const result = await act(() => runEngine<Row>(props.context, 'mci-configuration-resolve', { ProfileId: row.Id }), '配置继承解析完成。'); if (result) resolved.value = result }
async function scanDrift() { if (!scanForm.BaselineProfileId || !scanForm.TargetProfileId || scanForm.BaselineProfileId === scanForm.TargetProfileId) { action.status = 'error'; action.message = '请选择不同的基线和目标配置。'; return } const result = await act(() => runEngine<Row>(props.context, 'mci-configuration-drift-scan', scanForm), '配置漂移巡检完成。'); if (result) { scanResult.value = result; await load() } }
function openDriftAction(row: Row, nextAction: string) { driftAction.DriftId = String(row.Id); driftAction.Action = nextAction; driftAction.Reason = ''; driftAction.ExpectedRowVersion = Number(row.RowVersion || 0); driftActionOpen.value = true }
async function applyDriftAction() { if (driftAction.Action === 'Ignore' && !driftAction.Reason) { action.status = 'error'; action.message = '忽略漂移必须填写原因。'; return } const result = await act(() => runEngine(props.context, 'mci-configuration-drift-transition', { ...driftAction }), '配置漂移状态已更新。'); if (result) { driftActionOpen.value = false; await load() } }
onMounted(load)
</script>

<style scoped>
.config-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; margin-bottom: 16px; }.config-metrics article { display: grid; gap: 5px; min-height: 82px; align-content: center; padding: 14px; }.config-metrics strong { font-family: var(--mci-font-mono); font-size: 24px; }.config-metrics small { color: var(--mci-text-tertiary); }.resolved,.scan-result { max-height: 280px; margin-top: 12px; }.drift-form,.form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.scan-button { width: 100%; margin-top: 12px; }.form-grid .full { grid-column: 1 / -1; }.dialog-tools { display: flex; align-items: center; gap: 10px; margin-top: 12px; }.dialog-tools small { color: var(--mci-text-secondary); }.preview { max-height: 240px; margin-top: 10px; }.feedback { margin-top: 12px; padding: 10px; border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.feedback[data-state="error"] { color: var(--mci-color-danger); }.feedback[data-state="success"] { color: var(--mci-color-success); }
@media (max-width: 760px) { .config-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); }.drift-form,.form-grid { grid-template-columns: 1fr; }.form-grid .full { grid-column: auto; }.dialog-tools { align-items: flex-start; flex-direction: column; } }
</style>
