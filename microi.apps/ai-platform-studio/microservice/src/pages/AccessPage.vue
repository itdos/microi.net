<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="ACCESS CONTROL" title="用户组、授权变更与组织快照" description="动态成员先固化为不可变快照；批量授权先预览、再用计划哈希执行，必要时按原始角色版本条件回滚。">
      <button type="button" class="mci-button" :disabled="action.status === 'loading'" @click="captureOrganization">保存组织快照</button>
      <button type="button" class="mci-button" @click="tagOpen = true">新建用户标签</button>
      <button type="button" class="mci-button" @click="requestOpen = true">提交访问申请</button>
      <button type="button" class="mci-button mci-button--primary" @click="groupOpen = true">新建用户组</button>
    </MciPageIntro>

    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <div v-else class="mci-grid">
      <article class="mci-card mci-section span-7">
        <div class="mci-section__head"><div><h2>动态用户组</h2><p>规则只接受参数化字段条件，不执行任意 SQL。</p></div><span class="mci-badge">{{ groups.length }} 组</span></div>
        <MciStatePanel v-if="!groups.length" state="empty" title="暂无用户组" action="新建用户组" @action="groupOpen = true" />
        <MciDataTable v-else :rows="groups" :columns="groupColumns">
          <template #actions="{ row }"><div class="table-actions"><button type="button" :disabled="action.status === 'loading'" @click="previewGroup(row)">预览</button><button type="button" :disabled="action.status === 'loading'" @click="prepareRefresh(row)">刷新快照</button></div></template>
        </MciDataTable>
        <div v-if="groupPreview" class="preview-panel"><div><strong>{{ groupPreview.MemberCount }}</strong><small>预览成员</small></div><code class="mci-code">RuleHash: {{ groupPreview.RuleHash }}\n{{ previewAccounts }}</code></div>
      </article>

      <article class="mci-card mci-section span-5">
        <div class="mci-section__head"><div><h2>组织时间线</h2><p>部门与账号结构按内容哈希去重。</p></div><span class="mci-badge">{{ snapshots.length }} 版</span></div>
        <MciStatePanel v-if="!snapshots.length" state="empty" title="暂无组织快照" action="保存当前结构" @action="captureOrganization" />
        <ol v-else class="snapshot-list"><li v-for="item in snapshots.slice(0, 8)" :key="String(item.Id)"><span aria-hidden="true"></span><div><strong>{{ item.SnapshotKey }}</strong><small>{{ item.DeptCount || 0 }} 部门 · {{ item.UserCount || 0 }} 用户 · {{ item.SnapshotTime }}</small><code>{{ String(item.ContentHash || '').slice(0, 18) }}</code></div></li></ol>
      </article>

      <article class="mci-card mci-section span-6">
        <div class="mci-section__head"><div><h2>用户标签字典</h2><p>标签分配保留来源、值、有效期和证据哈希。</p></div><button type="button" class="mci-button" :disabled="!tags.length" @click="tagAssignOpen = true">分配 / 撤销</button></div>
        <MciStatePanel v-if="!tags.length" state="empty" title="暂无用户标签" action="新建标签" @action="tagOpen = true" />
        <MciDataTable v-else :rows="tags" :columns="tagColumns" />
      </article>
      <article class="mci-card mci-section span-6">
        <div class="mci-section__head"><div><h2>标签分配</h2><p>到期标签由跨节点幂等维护任务自动失效。</p></div><span class="mci-badge">{{ tagAssignments.length }}</span></div>
        <MciStatePanel v-if="!tagAssignments.length" state="empty" title="暂无标签分配" />
        <MciDataTable v-else :rows="tagAssignments" :columns="tagAssignmentColumns" />
      </article>

      <article class="mci-card mci-section span-12">
        <div class="mci-section__head"><div><h2>批量授权控制台</h2><p>目标可以是已固化用户组或明确用户Id列表。</p></div><span v-if="accessPlan" class="mci-badge" :data-tone="accessPlan.Summary.Missing ? 'warning' : 'success'">{{ accessPlan.Summary.Changed }} 项变化</span></div>
        <div class="access-layout">
          <div class="form-grid">
            <label class="mci-field"><span>动作</span><select v-model="accessForm.ActionType"><option value="GrantRole">授予角色</option><option value="RevokeRole">移除角色</option><option value="ReplaceRoles">替换角色</option></select></label>
            <label class="mci-field"><span>角色Id（逗号分隔）</span><input v-model.trim="accessForm.RoleIds" placeholder="role-id-1, role-id-2" /></label>
            <label class="mci-field"><span>用户组</span><select v-model="accessForm.GroupId"><option value="">不使用用户组</option><option v-for="item in groups" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }}（{{ item.MemberCount || 0 }}）</option></select></label>
            <label class="mci-field"><span>用户Id（逗号分隔）</span><input v-model.trim="accessForm.UserIds" :disabled="!!accessForm.GroupId" placeholder="user-id-1, user-id-2" /></label>
            <label class="mci-field full"><span>审批/工单引用</span><input v-model.trim="accessForm.ApprovalRef" placeholder="可选，但生产授权建议填写" /></label>
            <div class="mci-section__actions full"><button type="button" class="mci-button mci-button--primary" :disabled="action.status === 'loading'" @click="planAccess">生成授权计划</button></div>
          </div>
          <div class="plan-surface">
            <MciStatePanel v-if="!accessPlan" state="empty" title="尚未预览授权变化" message="计划不会写入角色关系。" />
            <template v-else><div class="plan-metrics"><div><strong>{{ accessPlan.Summary.Requested }}</strong><small>请求用户</small></div><div><strong>{{ accessPlan.Summary.Found }}</strong><small>已找到</small></div><div><strong>{{ accessPlan.Summary.Changed }}</strong><small>将变化</small></div><div><strong>{{ accessPlan.Summary.Missing }}</strong><small>未找到</small></div></div><code class="mci-code">PlanHash: {{ accessPlan.PlanHash }}</code><div class="mci-section__actions"><button type="button" class="mci-button" @click="accessPlan = null">取消</button><button type="button" class="mci-button mci-button--primary" @click="accessConfirmOpen = true">执行计划</button></div></template>
          </div>
        </div>
      </article>

      <article class="mci-card mci-section span-12">
        <div class="mci-section__head"><div><h2>访问申请与临时权限</h2><p>申请、审批、权益证据、到期回收和人工撤销形成完整状态机。</p></div><span class="mci-badge">{{ accessRequests.length }} 项</span></div>
        <MciStatePanel v-if="!accessRequests.length" state="empty" title="暂无访问申请" action="提交访问申请" @action="requestOpen = true" />
        <MciDataTable v-else :rows="accessRequests" :columns="requestColumns">
          <template #actions="{ row }"><div class="table-actions"><button type="button" :disabled="String(row.Status) !== 'Pending'" @click="prepareRequestDecision(row, 'Approve')">批准</button><button type="button" :disabled="String(row.Status) !== 'Pending'" @click="prepareRequestDecision(row, 'Reject')">拒绝</button><button type="button" :disabled="!['Applied','PartiallyApplied'].includes(String(row.Status))" @click="prepareRequestDecision(row, 'Revoke')">撤销</button></div></template>
        </MciDataTable>
        <div v-if="entitlements.length" class="entitlement-strip"><span>生效权益 {{ entitlements.filter((item) => item.Status === 'Active').length }}</span><span>已到期 {{ entitlements.filter((item) => item.Status === 'Expired').length }}</span><span>回收冲突 {{ entitlements.filter((item) => item.Status === 'Conflict').length }}</span></div>
      </article>

      <article class="mci-card mci-section span-12">
        <div class="mci-section__head"><div><h2>授权变更与条件回滚</h2><p>若账号角色在授权后又被修改，回滚会报告冲突而不是覆盖新状态。</p></div><span class="mci-badge">{{ changes.length }} 批</span></div>
        <MciStatePanel v-if="!changes.length" state="empty" title="暂无授权变更" />
        <MciDataTable v-else :rows="changes" :columns="changeColumns"><template #actions="{ row }"><button type="button" :disabled="!['Applied','PartiallyApplied'].includes(String(row.Status)) || action.status === 'loading'" @click="confirmRollback(row)">条件回滚</button></template></MciDataTable>
        <div v-if="action.message" class="feedback" :data-state="action.status" role="status">{{ action.message }}</div>
      </article>
    </div>

    <MciDialog :open="groupOpen" title="新建动态用户组" confirm-text="创建用户组" :busy="action.status === 'loading'" @cancel="groupOpen = false" @confirm="createGroup">
      <div class="form-grid"><label class="mci-field"><span>用户组Key</span><input v-model.trim="groupForm.GroupKey" placeholder="sales-east" /></label><label class="mci-field"><span>用户组名称</span><input v-model.trim="groupForm.Name" placeholder="华东销售团队" /></label><label class="mci-field"><span>类型</span><select v-model="groupForm.GroupType"><option>Dynamic</option><option>Static</option><option>Directory</option></select></label><label class="mci-field"><span>负责人</span><input v-model.trim="groupForm.Owner" /></label><label class="mci-field full"><span>安全规则 JSON</span><textarea v-model="groupForm.RuleJson" spellcheck="false"></textarea></label></div>
      <p>示例：<code>{"Where":[["DeptId","=","部门Id"]]}</code>；静态组可用 <code>{"UserIds":["用户Id"]}</code>。</p>
    </MciDialog>
    <MciDialog :open="tagOpen" title="新建用户标签" confirm-text="创建标签" :busy="action.status === 'loading'" @cancel="tagOpen = false" @confirm="createTag">
      <div class="form-grid"><label class="mci-field"><span>标签Key</span><input v-model.trim="tagForm.TagKey" placeholder="region-east" /></label><label class="mci-field"><span>标签名称</span><input v-model.trim="tagForm.Name" placeholder="华东区域" /></label><label class="mci-field"><span>分类</span><input v-model.trim="tagForm.Category" placeholder="区域" /></label><label class="mci-field"><span>值类型</span><select v-model="tagForm.ValueType"><option>Boolean</option><option>String</option><option>Number</option><option>Json</option></select></label><label class="mci-field"><span>作用域</span><select v-model="tagForm.Scope"><option>Tenant</option><option>Application</option><option>Directory</option></select></label><label class="mci-field"><span>负责人</span><input v-model.trim="tagForm.Owner" /></label><label class="mci-field full"><span>说明</span><textarea v-model="tagForm.Description"></textarea></label></div>
    </MciDialog>
    <MciDialog :open="tagAssignOpen" title="维护用户标签" confirm-text="执行标签维护" :busy="action.status === 'loading'" @cancel="tagAssignOpen = false" @confirm="assignTag">
      <div class="form-grid"><label class="mci-field"><span>动作</span><select v-model="tagAssignForm.Action"><option>Assign</option><option>Revoke</option></select></label><label class="mci-field"><span>标签</span><select v-model="tagAssignForm.TagId"><option v-for="item in tags" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }}</option></select></label><label class="mci-field full"><span>用户Id（逗号分隔）</span><input v-model.trim="tagAssignForm.UserIds" /></label><label class="mci-field"><span>到期时间</span><input v-model.trim="tagAssignForm.ExpiresAt" placeholder="yyyy-MM-dd HH:mm:ss，可空" /></label><label class="mci-field"><span>来源引用</span><input v-model.trim="tagAssignForm.SourceRef" /></label><label class="mci-field full"><span>标签值 JSON</span><textarea v-model="tagAssignForm.ValueJson"></textarea></label></div>
    </MciDialog>
    <MciDialog :open="requestOpen" title="提交访问申请" confirm-text="提交申请" :busy="action.status === 'loading'" @cancel="requestOpen = false" @confirm="submitAccessRequest">
      <div class="form-grid"><label class="mci-field"><span>目标</span><select v-model="requestForm.TargetType"><option value="Self">本人</option><option value="Users">指定用户</option><option value="Group">用户组</option></select></label><label class="mci-field"><span>角色Id（逗号分隔）</span><input v-model.trim="requestForm.RoleIds" /></label><label v-if="requestForm.TargetType === 'Users'" class="mci-field full"><span>用户Id（逗号分隔）</span><input v-model.trim="requestForm.UserIds" /></label><label v-if="requestForm.TargetType === 'Group'" class="mci-field full"><span>用户组</span><select v-model="requestForm.GroupId"><option v-for="item in groups" :key="String(item.Id)" :value="String(item.Id)">{{ item.Name }}</option></select></label><label class="mci-field"><span>授权到期时间</span><input v-model.trim="requestForm.ExpiresAt" placeholder="可空，最长366天" /></label><label class="mci-field full"><span>申请原因</span><textarea v-model="requestForm.Reason"></textarea></label></div>
    </MciDialog>
    <MciDialog :open="requestDecisionOpen" :title="requestDecisionTitle" :confirm-text="requestDecisionConfirm" :busy="action.status === 'loading'" @cancel="requestDecisionOpen = false" @confirm="applyRequestDecision">
      <p>申请：<code>{{ requestDecisionTarget?.RequestKey }}</code> · 状态 {{ requestDecisionTarget?.Status }}</p>
      <div class="form-grid"><label v-if="requestDecisionAction === 'Approve'" class="mci-field full"><span>审批 / 工单引用</span><input v-model.trim="requestDecisionForm.ApprovalRef" /></label><label class="mci-field full"><span>决策意见</span><textarea v-model="requestDecisionForm.DecisionReason"></textarea></label></div>
    </MciDialog>
    <MciDialog :open="refreshOpen" title="刷新用户组成员快照" confirm-text="切换生效快照" :busy="action.status === 'loading'" @cancel="refreshOpen = false" @confirm="refreshGroup">
      <p>即将以当前预览结果创建不可变成员快照，并原子切换用户组的生效快照指针。</p><code class="mci-code">Group: {{ refreshTarget?.Name }}\nRuleHash: {{ groupPreview?.RuleHash }}\nMembers: {{ groupPreview?.MemberCount || 0 }}</code>
    </MciDialog>
    <MciDialog :open="accessConfirmOpen" title="确认批量授权" confirm-text="应用授权变更" :busy="action.status === 'loading'" @cancel="accessConfirmOpen = false" @confirm="applyAccess">
      <p>将对 {{ accessPlan?.Summary.Changed || 0 }} 个用户执行 {{ accessForm.ActionType }}。计划内容由哈希固定，相同幂等键只执行一次。</p><code class="mci-code">PlanHash: {{ accessPlan?.PlanHash }}\nIdempotencyKey: {{ accessIdempotencyKey }}</code>
    </MciDialog>
    <MciDialog :open="rollbackOpen" title="条件回滚授权变更" confirm-text="执行条件回滚" :busy="action.status === 'loading'" @cancel="rollbackOpen = false" @confirm="rollbackAccess">
      <p>只回滚角色版本仍等于该批次写入结果的用户；后续人工变更不会被覆盖。</p><code class="mci-code">ChangeKey: {{ rollbackTarget?.ChangeKey }}\nPlanHash: {{ rollbackTarget?.PlanHash }}</code>
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
interface GroupPreview { GroupId: string; GroupKey: string; RuleHash: string; MemberCount: number; Sample: Row[]; MemberIds: string[] }
interface AccessPlan { PlanHash: string; Summary: { Requested: number; Found: number; Changed: number; Missing: number }; Plan: Row }
const groups = ref<Row[]>([]), snapshots = ref<Row[]>([]), changes = ref<Row[]>([]), tags = ref<Row[]>([]), tagAssignments = ref<Row[]>([]), accessRequests = ref<Row[]>([]), entitlements = ref<Row[]>([])
const state = ref<'loading' | 'ready' | 'error'>('loading'), error = ref(''), action = reactive<ActionState>({ status: 'idle' })
const groupOpen = ref(false), refreshOpen = ref(false), accessConfirmOpen = ref(false), rollbackOpen = ref(false), tagOpen = ref(false), tagAssignOpen = ref(false), requestOpen = ref(false), requestDecisionOpen = ref(false)
const groupForm = reactive({ GroupKey: '', Name: '', GroupType: 'Dynamic', Owner: '', RuleJson: '{\n  "Where": [["Status", "=", 1]]\n}' })
const accessForm = reactive({ ActionType: 'GrantRole', RoleIds: '', GroupId: '', UserIds: '', ApprovalRef: '' })
const tagForm = reactive({ TagKey: '', Name: '', Category: '', ValueType: 'Boolean', Scope: 'Tenant', Owner: '', Description: '' })
const tagAssignForm = reactive({ Action: 'Assign', TagId: '', UserIds: '', ExpiresAt: '', SourceRef: '', ValueJson: '{}' })
const requestForm = reactive({ TargetType: 'Self', RoleIds: '', UserIds: '', GroupId: '', ExpiresAt: '', Reason: '' })
const requestDecisionForm = reactive({ ApprovalRef: '', DecisionReason: '' }), requestDecisionTarget = ref<Row | null>(null), requestDecisionAction = ref<'Approve' | 'Reject' | 'Revoke'>('Approve')
const groupPreview = ref<GroupPreview | null>(null), refreshTarget = ref<Row | null>(null), accessPlan = ref<AccessPlan | null>(null), rollbackTarget = ref<Row | null>(null)
const accessIdempotencyKey = ref('')
const previewAccounts = computed(() => (groupPreview.value?.Sample || []).slice(0, 12).map((item) => item.Account || item.Name || item.UserId).join(' · ') || '没有匹配成员')
const requestDecisionTitle = computed(() => requestDecisionAction.value === 'Approve' ? '批准访问申请' : (requestDecisionAction.value === 'Reject' ? '拒绝访问申请' : '撤销生效权限'))
const requestDecisionConfirm = computed(() => requestDecisionAction.value === 'Approve' ? '批准并应用' : (requestDecisionAction.value === 'Reject' ? '拒绝申请' : '安全撤销'))
const groupColumns = [{ key: 'Name', label: '用户组' }, { key: 'GroupType', label: '类型', tone: true }, { key: 'MemberCount', label: '成员' }, { key: 'Owner', label: '负责人' }, { key: 'LastEvaluatedTime', label: '最近评估' }]
const tagColumns = [{ key: 'Name', label: '标签' }, { key: 'TagKey', label: 'Key' }, { key: 'Category', label: '分类' }, { key: 'Scope', label: '作用域' }, { key: 'Enabled', label: '启用', tone: true }]
const tagAssignmentColumns = [{ key: 'Account', label: '账号' }, { key: 'TagId', label: '标签Id' }, { key: 'SourceType', label: '来源' }, { key: 'Status', label: '状态', tone: true }, { key: 'ExpiresAt', label: '到期' }]
const changeColumns = [{ key: 'ChangeKey', label: '变更Key' }, { key: 'ActionType', label: '动作' }, { key: 'TargetType', label: '目标' }, { key: 'Status', label: '状态', tone: true }, { key: 'SuccessCount', label: '成功' }, { key: 'ConflictCount', label: '冲突' }, { key: 'AppliedTime', label: '执行时间' }]
const requestColumns = [{ key: 'RequestKey', label: '申请Key' }, { key: 'RequesterName', label: '申请人' }, { key: 'TargetType', label: '目标' }, { key: 'Status', label: '状态', tone: true }, { key: 'ExpiresAt', label: '到期' }, { key: 'ApprovedBy', label: '审批人' }]
const list = (value: string) => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]
function parseJson(text: string) { try { return JSON.parse(text || '{}') } catch { throw new Error('规则必须是有效 JSON。') } }
async function load() { state.value = 'loading'; error.value = ''; try { const [g, s, c, t, ta, ar, en] = await Promise.all([getTable<Row>(props.context, 'mci_identity_group'), getTable<Row>(props.context, 'mci_org_snapshot', { _OrderBy: 'SnapshotTime', _OrderByType: 'DESC' }), getTable<Row>(props.context, 'mci_access_change_set'), getTable<Row>(props.context, 'mci_identity_tag'), getTable<Row>(props.context, 'mci_identity_tag_assignment'), getTable<Row>(props.context, 'mci_access_request'), getTable<Row>(props.context, 'mci_access_entitlement')]); groups.value = g.rows; snapshots.value = s.rows; changes.value = c.rows; tags.value = t.rows; tagAssignments.value = ta.rows; accessRequests.value = ar.rows; entitlements.value = en.rows; if (!tagAssignForm.TagId && tags.value.length) tagAssignForm.TagId = String(tags.value[0].Id); state.value = 'ready' } catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } }
async function act<T>(work: () => Promise<T>, success: string) { action.status = 'loading'; action.message = ''; try { const result = await work(); action.status = 'success'; action.message = success; return result } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '执行失败'; return null } }
async function createGroup() { if (!groupForm.GroupKey || !groupForm.Name) { action.status = 'error'; action.message = '用户组Key和名称不能为空。'; return } let rule: unknown; try { rule = parseJson(groupForm.RuleJson) } catch (e) { action.status = 'error'; action.message = (e as Error).message; return } const result = await act(() => addRow(props.context, 'mci_identity_group', { ...groupForm, RuleJson: JSON.stringify(rule), RuleHash: '', ActiveSnapshotId: '', MemberCount: 0, Enabled: 1 }), '用户组已创建。'); if (result) { groupOpen.value = false; await load() } }
async function createTag() { if (!tagForm.TagKey || !tagForm.Name) { action.status = 'error'; action.message = '标签Key和名称不能为空。'; return } const result = await act(() => addRow(props.context, 'mci_identity_tag', { ...tagForm, Color: '', Enabled: 1 }), '用户标签已创建。'); if (result) { tagOpen.value = false; await load() } }
async function assignTag() { const userIds = list(tagAssignForm.UserIds); if (!tagAssignForm.TagId || !userIds.length) { action.status = 'error'; action.message = '标签和用户Id不能为空。'; return } let value: unknown; try { value = parseJson(tagAssignForm.ValueJson) } catch (e) { action.status = 'error'; action.message = (e as Error).message; return } const result = await act(() => runEngine(props.context, 'mci-identity-tag-assign', { ...tagAssignForm, UserIds: userIds, ValueJson: value, SourceType: 'Manual' }), '用户标签维护完成。'); if (result) { tagAssignOpen.value = false; await load() } }
async function submitAccessRequest() { const roleIds = list(requestForm.RoleIds); if (!roleIds.length || requestForm.Reason.trim().length < 6) { action.status = 'error'; action.message = '角色Id不能为空，申请原因至少6个字符。'; return } const result = await act(() => runEngine(props.context, 'mci-access-request', { Action: 'Submit', ...requestForm, RoleIds: roleIds, UserIds: list(requestForm.UserIds), RequestKey: `request-${Date.now()}-${Math.random().toString(16).slice(2)}` }), '访问申请已提交。'); if (result) { requestOpen.value = false; await load() } }
function prepareRequestDecision(row: Row, decision: 'Approve' | 'Reject' | 'Revoke') { requestDecisionTarget.value = row; requestDecisionAction.value = decision; Object.assign(requestDecisionForm, { ApprovalRef: '', DecisionReason: '' }); requestDecisionOpen.value = true }
async function applyRequestDecision() { if (!requestDecisionTarget.value) return; const result = await act(() => runEngine(props.context, 'mci-access-request', { Action: requestDecisionAction.value, RequestId: requestDecisionTarget.value?.Id, ...requestDecisionForm }), `${requestDecisionTitle.value}已执行。`); if (result) { requestDecisionOpen.value = false; await load() } }
async function previewGroup(row: Row) { const result = await act(() => runEngine<GroupPreview>(props.context, 'mci-identity-group-preview', { GroupId: row.Id }), '用户组预览已生成。'); if (result) groupPreview.value = result }
async function prepareRefresh(row: Row) { const result = await act(() => runEngine<GroupPreview>(props.context, 'mci-identity-group-preview', { GroupId: row.Id }), '用户组快照已预检。'); if (result) { groupPreview.value = result; refreshTarget.value = row; refreshOpen.value = true } }
async function refreshGroup() { if (!refreshTarget.value || !groupPreview.value) return; const result = await act(() => runEngine(props.context, 'mci-identity-group-refresh', { GroupId: refreshTarget.value?.Id, ExpectedRuleHash: groupPreview.value?.RuleHash }), '成员快照已刷新。'); if (result) { refreshOpen.value = false; await load() } }
async function captureOrganization() { const result = await act(() => runEngine(props.context, 'mci-org-snapshot', { Source: 'Manual', ChangeSummary: '治理中心手工快照' }), '组织结构快照已保存。'); if (result) await load() }
async function planAccess() { const roleIds = list(accessForm.RoleIds), userIds = list(accessForm.UserIds); if (!roleIds.length || (!accessForm.GroupId && !userIds.length)) { action.status = 'error'; action.message = '至少填写一个角色Id，并选择用户组或填写用户Id。'; return } const result = await act(() => runEngine<AccessPlan>(props.context, 'mci-access-change-plan', { ActionType: accessForm.ActionType, RoleIds: roleIds, GroupId: accessForm.GroupId, UserIds: userIds }), '授权计划已生成。'); if (result) { accessPlan.value = result; accessIdempotencyKey.value = `access-${result.PlanHash.slice(0, 32)}` } }
async function applyAccess() { if (!accessPlan.value) return; const result = await act(() => runEngine(props.context, 'mci-access-change-apply', { ActionType: accessForm.ActionType, RoleIds: list(accessForm.RoleIds), GroupId: accessForm.GroupId, UserIds: list(accessForm.UserIds), ExpectedPlanHash: accessPlan.value?.PlanHash, IdempotencyKey: accessIdempotencyKey.value, ApprovalRef: accessForm.ApprovalRef }), '授权变更已执行。'); if (result) { accessConfirmOpen.value = false; accessPlan.value = null; await load() } }
function confirmRollback(row: Row) { rollbackTarget.value = row; rollbackOpen.value = true }
async function rollbackAccess() { if (!rollbackTarget.value) return; const result = await act(() => runEngine(props.context, 'mci-access-change-rollback', { ChangeSetId: rollbackTarget.value?.Id, ExpectedPlanHash: rollbackTarget.value?.PlanHash }), '授权变更已条件回滚。'); if (result) { rollbackOpen.value = false; await load() } }
onMounted(load)
</script>

<style scoped>
.table-actions { display: flex; gap: 6px; }.table-actions button { min-height: 32px; padding: 0 9px; }.preview-panel { display: grid; grid-template-columns: 110px minmax(0,1fr); gap: 12px; margin-top: 14px; }.preview-panel > div { display: grid; place-content: center; padding: 12px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); text-align: center; }.preview-panel strong { font-family: var(--mci-font-mono); font-size: 30px; }.preview-panel small { color: var(--mci-text-tertiary); }.snapshot-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }.snapshot-list li { display: grid; grid-template-columns: 12px minmax(0,1fr); gap: 10px; }.snapshot-list li > span { width: 10px; height: 10px; margin-top: 4px; border: 2px solid var(--mci-color-primary); border-radius: 50%; box-shadow: 0 0 0 4px var(--mci-color-primary-glow); }.snapshot-list div { display: grid; gap: 3px; }.snapshot-list small { color: var(--mci-text-secondary); }.snapshot-list code { color: var(--mci-text-tertiary); font-size: 10px; }.access-layout { display: grid; grid-template-columns: minmax(0,1fr) minmax(360px,.9fr); gap: 18px; }.form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.form-grid .full { grid-column: 1 / -1; }.plan-surface { min-height: 248px; padding: 14px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-card); background: var(--mci-bg-soft); }.plan-surface .mci-section__actions { margin-top: 12px; }.plan-metrics { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 7px; margin-bottom: 12px; }.plan-metrics div { display: grid; gap: 3px; padding: 10px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-input); background: var(--mci-bg-elevated); }.plan-metrics strong { font-family: var(--mci-font-mono); font-size: 22px; }.plan-metrics small { color: var(--mci-text-tertiary); }.feedback { margin-top: 12px; padding: 10px; border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.feedback[data-state="error"] { color: var(--mci-color-danger); }.feedback[data-state="success"] { color: var(--mci-color-success); }
.entitlement-strip { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }.entitlement-strip span { padding: 7px 10px; border: 1px solid var(--mci-border-color); border-radius: 999px; color: var(--mci-text-secondary); background: var(--mci-bg-soft); font-size: 12px; }
@media (max-width: 980px) { .access-layout { grid-template-columns: 1fr; } }
@media (max-width: 640px) { .form-grid, .preview-panel { grid-template-columns: 1fr; }.form-grid .full { grid-column: auto; }.plan-metrics { grid-template-columns: repeat(2,minmax(0,1fr)); } }
</style>
