<template>
  <section class="mci-page-enter">
    <MciPageIntro eyebrow="PORTAL COMPOSER" title="门户编排与不可变版本" description="项目、插槽与资源保持可编辑草稿；发布时生成确定性快照，回滚只移动受审计的活动版本指针。">
      <button type="button" class="mci-button" @click="createOpen = true">新建门户</button>
      <button type="button" class="mci-button mci-button--primary" :disabled="!selectedId || action.status === 'loading'" @click="planPublish">发布预检</button>
    </MciPageIntro>

    <MciStatePanel v-if="state === 'loading'" state="loading" />
    <MciStatePanel v-else-if="state === 'error'" state="error" :message="error" @retry="load" />
    <div v-else class="mci-grid">
      <article class="mci-card mci-section span-4 project-panel">
        <div class="mci-section__head"><div><h2>门户项目</h2><p>选择一个项目查看发布状态。</p></div><span class="mci-badge">{{ projects.length }}</span></div>
        <MciStatePanel v-if="!projects.length" state="empty" title="还没有门户项目" action="创建第一个门户" @action="createOpen = true" />
        <div v-else class="project-list">
          <button v-for="project in projects" :key="String(project.Id)" type="button" :class="{ active: selectedId === project.Id }" @click="selectProject(String(project.Id))">
            <span><strong>{{ project.Name }}</strong><small>{{ project.ProjectKey }}</small></span>
            <span class="mci-badge" :data-tone="project.Status === 'Published' ? 'success' : 'warning'">{{ project.Status || 'Draft' }}</span>
          </button>
        </div>
      </article>

      <div class="span-8 detail-stack">
        <article class="mci-card mci-section">
          <MciStatePanel v-if="!selected" state="empty" title="选择门户项目" message="选中项目后可预检、发布、比较和回滚。" />
          <template v-else>
            <div class="mci-section__head">
              <div><h2>{{ selected.Name }}</h2><p>{{ selected.Description || '尚未填写项目说明。' }}</p></div>
              <div class="mci-section__actions"><span class="mci-badge" :data-tone="selected.Status === 'Published' ? 'success' : 'warning'">{{ selected.Status }}</span><button type="button" class="mci-button" :disabled="action.status === 'loading'" @click="planPublish">重新预检</button></div>
            </div>
            <div class="project-facts">
              <div><small>项目Key</small><strong>{{ selected.ProjectKey }}</strong></div>
              <div><small>当前版本</small><strong>{{ selected.ActiveVersionId || '尚未发布' }}</strong></div>
              <div><small>内容哈希</small><strong class="mono">{{ shortHash(selected.PublishedHash) }}</strong></div>
              <div><small>发布时间</small><strong>{{ selected.PublishedTime || '—' }}</strong></div>
            </div>
            <div v-if="action.message" class="feedback" :data-state="action.status" role="status">{{ action.message }}</div>
          </template>
        </article>

        <article class="mci-card mci-section">
          <div class="mci-section__head"><div><h2>版本时间线</h2><p>版本快照不可变；回滚会创建一条新的回滚版本。</p></div></div>
          <MciStatePanel v-if="selected && !versions.length" state="empty" title="暂无发布版本" message="先完成一次发布预检和确认。" />
          <MciDataTable v-else-if="versions.length" :rows="versions" :columns="versionColumns">
            <template #actions="{ row }"><button type="button" :disabled="row.Id === selected?.ActiveVersionId || action.status === 'loading'" @click="openRollback(row)">回滚到此版本</button></template>
          </MciDataTable>
        </article>
      </div>
    </div>

    <MciDialog :open="createOpen" title="新建门户项目" confirm-text="创建草稿" :busy="action.status === 'loading'" @cancel="createOpen = false" @confirm="createProject">
      <div class="form-grid"><label class="mci-field"><span>项目Key</span><input v-model.trim="createForm.ProjectKey" placeholder="例如 company-portal" /></label><label class="mci-field"><span>项目名称</span><input v-model.trim="createForm.Name" placeholder="例如 企业门户" /></label><label class="mci-field full"><span>项目说明</span><textarea v-model.trim="createForm.Description" placeholder="说明目标用户与门户用途"></textarea></label></div>
      <p>创建后只产生草稿记录，不会立即对外发布。</p>
    </MciDialog>

    <MciDialog :open="publishOpen" title="确认发布门户版本" confirm-text="发布不可变版本" :busy="action.status === 'loading'" @cancel="publishOpen = false" @confirm="publishPortal">
      <p>即将发布门户项目 <strong>{{ selected?.Name }}</strong>。本次快照包含 {{ publishPlan?.Counts?.Slots ?? 0 }} 个插槽、{{ publishPlan?.Counts?.Assets ?? 0 }} 个资源；服务端会再次计算哈希，草稿变化时自动拒绝。</p>
      <label class="mci-field"><span>变更摘要</span><textarea v-model.trim="changeSummary" placeholder="说明本次发布的业务变化"></textarea></label>
      <code class="mci-code">SnapshotHash: {{ publishPlan?.SnapshotHash }}</code>
      <ul v-if="publishPlan?.Issues?.length" class="issues"><li v-for="(issue, index) in publishPlan.Issues" :key="index"><span class="mci-badge" :data-tone="issue.Level === 'Error' ? 'danger' : 'warning'">{{ issue.Level }}</span>{{ issue.Message }}</li></ul>
    </MciDialog>

    <MciDialog :open="rollbackOpen" title="确认回滚门户版本" confirm-text="创建回滚版本" danger :busy="action.status === 'loading'" @cancel="rollbackOpen = false" @confirm="rollbackPortal">
      <p>即将把 <strong>{{ selected?.Name }}</strong> 恢复到版本 <strong>{{ rollbackTarget?.VersionNo }}</strong>。系统会校验当前发布哈希，若其他管理员已发布新版本则拒绝本次操作。</p>
      <label class="mci-field"><span>回滚说明</span><textarea v-model.trim="rollbackSummary" placeholder="记录回滚原因与影响范围"></textarea></label>
      <code class="mci-code">ExpectedCurrentHash: {{ selected?.PublishedHash }}\nTargetHash: {{ rollbackTarget?.ContentHash }}</code>
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
interface PublishPlan { CanPublish: boolean; SnapshotHash: string; Counts: { Slots: number; Assets: number }; Issues: { Level: string; Message: string }[] }
const projects = ref<Row[]>([]), versions = ref<Row[]>([])
const selectedId = ref('')
const state = ref<'loading' | 'ready' | 'error'>('loading'), error = ref('')
const action = reactive<ActionState>({ status: 'idle' })
const createOpen = ref(false), publishOpen = ref(false), rollbackOpen = ref(false)
const createForm = reactive({ ProjectKey: '', Name: '', Description: '' })
const publishPlan = ref<PublishPlan | null>(null), changeSummary = ref(''), rollbackTarget = ref<Row | null>(null), rollbackSummary = ref('')
const selected = computed(() => projects.value.find((item) => String(item.Id) === selectedId.value) ?? null)
const versionColumns = [{ key: 'VersionNo', label: '版本' }, { key: 'ChangeSummary', label: '变更摘要' }, { key: 'ContentHash', label: '内容哈希' }, { key: 'PublishedTime', label: '发布时间' }, { key: 'Status', label: '状态', tone: true }]
function shortHash(value: unknown) { const text = String(value || ''); return text ? `${text.slice(0, 12)}…${text.slice(-6)}` : '—' }
async function load() { state.value = 'loading'; error.value = ''; try { projects.value = (await getTable<Row>(props.context, 'mci_portal_project')).rows; if (!selectedId.value && projects.value.length) selectedId.value = String(projects.value[0].Id); await loadVersions(); state.value = 'ready' } catch (e) { error.value = e instanceof Error ? e.message : '加载失败'; state.value = 'error' } }
async function loadVersions() { if (!selectedId.value) { versions.value = []; return } versions.value = (await getTable<Row>(props.context, 'mci_resource_version', { _Where: [['ResourceType', '=', 'Portal'], ['AND', 'ResourceId', '=', selectedId.value]], _OrderBy: 'CreateTime', _OrderByType: 'DESC' })).rows }
async function selectProject(id: string) { selectedId.value = id; publishPlan.value = null; await loadVersions() }
async function runAction<T>(work: () => Promise<T>, success: string) { action.status = 'loading'; action.message = ''; try { const result = await work(); action.status = 'success'; action.message = success; return result } catch (e) { action.status = 'error'; action.message = e instanceof Error ? e.message : '执行失败'; return null } }
async function createProject() { if (!createForm.ProjectKey || !createForm.Name) { action.status = 'error'; action.message = '项目Key和名称不能为空。'; return } const result = await runAction(() => addRow(props.context, 'mci_portal_project', { ...createForm, Status: 'Draft', ThemeJson: '{}', SeoJson: '{}' }), '门户草稿已创建。'); if (result) { createOpen.value = false; Object.assign(createForm, { ProjectKey: '', Name: '', Description: '' }); await load() } }
async function planPublish() { if (!selectedId.value) return; const result = await runAction(() => runEngine<PublishPlan>(props.context, 'mci-portal-publish-plan', { ProjectId: selectedId.value }), '发布预检完成。'); if (result) { publishPlan.value = result; changeSummary.value ||= `发布 ${selected.value?.Name || ''} 门户配置`; publishOpen.value = true } }
async function publishPortal() { if (!publishPlan.value || !selectedId.value) return; if (!publishPlan.value.CanPublish) { action.status = 'error'; action.message = '预检存在阻断问题，不能发布。'; return } const result = await runAction(() => runEngine(props.context, 'mci-portal-publish', { ProjectId: selectedId.value, ExpectedSnapshotHash: publishPlan.value?.SnapshotHash, ChangeSummary: changeSummary.value }), '门户版本发布成功。'); if (result) { publishOpen.value = false; await load() } }
function openRollback(row: Row) { rollbackTarget.value = row; rollbackSummary.value = `回滚到版本 ${row.VersionNo}`; rollbackOpen.value = true }
async function rollbackPortal() { if (!selected.value || !rollbackTarget.value || !rollbackSummary.value) { action.status = 'error'; action.message = '回滚说明不能为空。'; return } const result = await runAction(() => runEngine(props.context, 'mci-resource-rollback', { ResourceType: 'Portal', ResourceId: selected.value?.Id, TargetVersionId: rollbackTarget.value?.Id, ExpectedCurrentHash: selected.value?.PublishedHash, ChangeSummary: rollbackSummary.value }), '门户版本回滚成功。'); if (result) { rollbackOpen.value = false; await load() } }
onMounted(load)
</script>

<style scoped>
.project-panel { align-self: start; }.project-list { display: grid; gap: 7px; }.project-list button { display: flex; width: 100%; min-height: 64px; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; border-color: var(--mci-border-color); text-align: left; }.project-list button.active { border-color: var(--mci-color-primary); background: color-mix(in srgb, var(--mci-color-primary) 7%, var(--mci-bg-elevated)); }.project-list button > span:first-child { display: grid; gap: 4px; min-width: 0; }.project-list small { overflow: hidden; color: var(--mci-text-tertiary); font-family: var(--mci-font-mono); font-size: 10px; text-overflow: ellipsis; }.detail-stack { display: grid; gap: 16px; }.project-facts { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 10px; }.project-facts div { display: grid; gap: 5px; padding: 11px; border: 1px solid var(--mci-border-color); border-radius: var(--mci-shape-input); background: var(--mci-bg-soft); }.project-facts small { color: var(--mci-text-tertiary); }.project-facts strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.mono { font-family: var(--mci-font-mono); }.feedback { margin-top: 12px; padding: 10px 12px; border-radius: var(--mci-shape-input); color: var(--mci-text-secondary); background: var(--mci-bg-soft); }.feedback[data-state="error"] { color: var(--mci-color-danger); }.feedback[data-state="success"] { color: var(--mci-color-success); }.form-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 13px; }.form-grid .full { grid-column: 1 / -1; }.issues { display: grid; gap: 8px; padding: 0; list-style: none; }.issues li { display: flex; align-items: center; gap: 8px; }
@media (max-width: 640px) { .project-facts, .form-grid { grid-template-columns: 1fr; }.form-grid .full { grid-column: auto; } }
</style>
