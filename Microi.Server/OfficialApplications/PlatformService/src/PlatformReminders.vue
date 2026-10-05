<template>
  <main class="mci-reminders" data-mci-ui-root :style="theme" :data-embedded="embedded">
    <header class="mci-reminders__header">
      <div class="mci-reminders__identity"><span class="mci-reminders__brand-icon"><MciMessageIcon name="bell"/></span><div><h1>消息通知</h1><p>系统公告与多渠道业务通知，统一配置与管理。</p></div></div>
      <div class="mci-reminders__header-actions"><button v-if="hasChanges" type="button" :disabled="busy || businessBusy" @click="requestDiscard">放弃修改</button><button type="button" :disabled="loading || busy || businessBusy" @click="refreshCurrent"><MciMessageIcon name="refresh"/>刷新</button></div>
    </header>
    <section v-if="loading" class="mci-reminders__skeleton" aria-label="正在加载提醒"><i v-for="n in 5" :key="n"></i></section>
    <section v-else-if="fatal" class="mci-reminders__empty" role="alert"><h2>暂时无法加载提醒</h2><p>{{ fatal }}</p><button @click="initialize">重新加载</button></section>
    <section v-else-if="!capabilities.Administrator" class="mci-reminders__empty"><h2>需要系统管理员权限</h2><p>请由当前租户的系统管理员维护系统提醒。</p></section>
    <template v-else>
      <nav class="mci-reminders__sections" aria-label="消息通知区域"><button v-for="item in sections" :key="item.key" type="button" :class="{'is-selected':activeSection===item.key}" :aria-current="activeSection===item.key?'page':undefined" :disabled="busy || businessBusy" @click="changeSection(item.key)"><MciMessageIcon :name="item.icon"/><span>{{ item.name }}</span></button></nav>
      <LicenseExpirySettings v-if="activeSection==='LicenseExpiry'" ref="businessRef" :capabilities="capabilities" @notify="notify" @dirty="businessDirty=$event" @busy="businessBusy=$event"/>
      <BusinessNotifications v-else-if="activeSection!=='Announcements'" ref="businessRef" :view="activeSection" :scope-key="host.osClient" @notify="notify" @dirty="businessDirty=$event" @busy="businessBusy=$event"/>
      <template v-else>
      <div class="mci-reminders__toolbar">
        <label class="mci-reminders__search"><MciMessageIcon name="search"/><span class="mci-reminders__sr">搜索提醒</span><input v-model.trim="keyword" type="search" placeholder="搜索公告标题" @keyup.enter="loadRules(1)"></label>
        <button :disabled="busy" @click="loadRules(1)">查询</button>
        <button class="is-primary" :disabled="busy || readOnly || unsavedTenant" @click="navigateSafely(newRule)"><MciMessageIcon name="plus"/>新建公告</button>
      </div>
      <p v-if="unsavedTenant" class="mci-reminders__notice">请先保存租户，再为它配置系统提醒。</p>
      <p v-if="Number(capabilities.ProtocolVersion || 1)<2" class="mci-reminders__notice">当前平台版本暂不支持按超级管理员或后端重启限定提醒，请先升级平台。</p>
      <div class="mci-reminders__workspace">
        <aside class="mci-reminders__list" aria-label="提醒规则">
          <p v-if="!rules.length" class="mci-reminders__empty">暂无公告。点击“新建公告”开始配置。</p>
          <button v-for="row in rules" :key="row.Id" type="button" class="mci-reminders__row" :class="{ 'is-selected': selected.Id === row.Id }" :disabled="busy" @click="navigateSafely(()=>editRule(row))">
            <span class="mci-reminders__row-title"><MciMessageIcon :name="row.ReminderType==='Scheduled'?'clock':'bell'"/><strong>{{ row.Title }}</strong></span><span class="mci-reminders__row-meta"><i :data-status="row.Status">{{ statusName(row.Status) }}</i>{{ kindName(row.ReminderType) }}</span>
            <small>{{ scopeName(row.ScopeType) }} · 第 {{ row.Revision }} 版</small>
          </button>
          <div v-if="total > 100" class="mci-reminders__pages"><button :disabled="page === 1 || busy" @click="loadRules(page - 1)">上一页</button><span>{{ page }}</span><button :disabled="page * 100 >= total || busy" @click="loadRules(page + 1)">下一页</button></div>
        </aside>
        <section v-if="editorOpen" class="mci-reminders__editor">
          <nav class="mci-reminders__tabs" aria-label="提醒内容"><button v-for="step in editorSteps" :key="step.key" :class="{ 'is-selected': tab === 'edit' && editorStep===step.key }" @click="tab='edit';editorStep=step.key"><MciMessageIcon :name="step.icon"/>{{ step.name }}</button><button :class="{ 'is-selected': tab === 'preview' }" @click="tab = 'preview'">效果预览</button><button :disabled="!selected.Id" :class="{ 'is-selected': tab === 'history' }" @click="loadHistory">发布历史</button></nav>
          <form v-if="tab === 'edit'" ref="formRef" novalidate @submit.prevent="save">
            <fieldset :disabled="busy || readOnly || unsavedTenant">
              <section v-show="editorStep==='content'" data-form-step="content">
              <div class="mci-reminders__grid">
                <label class="is-wide"><span>提醒标题 <b>*</b></span><input v-model.trim="draft.Title" required maxlength="200" placeholder="例如：系统维护通知"></label>
                <label class="is-wide"><span>提醒内容 <b>*</b></span><textarea v-model.trim="draft.Content" required maxlength="8000" rows="4" placeholder="请输入需要告知用户的内容，支持换行。"></textarea><small>{{ draft.Content.length }} / 8000</small></label>
                <label><span>图标</span><select v-model="draft.Icon"><option v-for="(label, key) in icons" :key="key" :value="key">{{ label }}</option></select></label>
                <label><span>提醒等级</span><select v-model="draft.Severity"><option value="info">普通</option><option value="success">好消息</option><option value="warning">重要</option><option value="error">紧急</option></select></label>
                <label><span>详情链接</span><input v-model.trim="draft.LinkUrl" maxlength="500" placeholder="https:// 或系统内页面路径"></label><label><span>链接文字</span><input v-model.trim="draft.LinkText" maxlength="30"></label>
              </div>
              </section>
              <section v-show="editorStep==='audience'" data-form-step="audience">
              <h2>接收对象</h2>
              <div class="mci-reminders__grid">
                <label><span>发送范围</span><select v-model="draft.ScopeType" :disabled="lockedScope" @change="changeScope"><option value="Users">当前租户用户</option><option v-if="capabilities.IsMainTenant" value="Tenants">子租户</option><option v-if="capabilities.IsOfficialPlatform" value="Editions">吾码产品版本</option></select></label>
                <label><span>接收帐号</span><select v-model="draft.AccountScope"><option value="AllAccounts">所有系统帐号</option><option value="SuperAdmins" :disabled="Number(capabilities.ProtocolVersion || 1)<2">仅超级管理员</option></select><small v-if="draft.ScopeType!=='Users'">由接收服务器核验帐号身份。</small></label>
                <label v-if="draft.ScopeType !== 'Editions' && draft.ReminderType !== 'Trial' && !lockedTargets" class="mci-reminders__check"><input v-model="draft.AllTargets" type="checkbox"><span>{{ draft.ScopeType === 'Tenants' ? '全部启用的子租户' : '当前租户全部用户' }}</span></label>
              </div>
              <p v-if="draft.ScopeType === 'Editions'" class="mci-reminders__notice">此提醒将发送到选定版本的吾码服务器。请逐项选择版本，并在发布前核对内容与有效期。</p>
              <div v-if="!draft.AllTargets" class="mci-reminders__recipients">
                <div class="mci-reminders__toolbar"><input v-model.trim="recipientKeyword" aria-label="搜索接收对象" placeholder="搜索接收对象" @keyup.enter="loadRecipients"><button type="button" :disabled="recipientLoading" @click="loadRecipients">查询</button><span>已选 {{ draft.TargetKeys.length }}</span></div>
                <div v-if="recipientLoading" class="mci-reminders__skeleton"><i></i></div>
                <div v-else class="mci-reminders__options">
                  <label v-for="item in filteredRecipients" :key="item.Key" class="mci-reminders__check"><input v-model="draft.TargetKeys" type="checkbox" :value="item.Key" :disabled="lockedTargets || (draft.ReminderType === 'Trial' && draft.TargetKeys.length >= 1 && !draft.TargetKeys.includes(item.Key))"><span>{{ item.Name }}<small>{{ item.Key }}</small></span></label>
                  <p v-if="!filteredRecipients.length">未找到接收对象。</p>
                </div>
                <div v-if="selectedMissing.length" class="mci-reminders__tags"><span v-for="key in selectedMissing" :key="key">{{ key }}<button v-if="!lockedTargets" type="button" :aria-label="`取消选择 ${key}`" @click="draft.TargetKeys = draft.TargetKeys.filter(x => x !== key)">×</button></span></div>
                <small v-if="draft.ScopeType === 'Users'">每次最多展示 100 位用户，可按姓名搜索。已选择的对象会保留。</small>
              </div>
              </section>
              <section v-show="editorStep==='schedule'" data-form-step="schedule">
              <h2>时间计划</h2><p class="mci-reminders__hint">时间使用您当前浏览器的时区：{{ timeZone }}。重复提醒按固定时间间隔执行。</p>
              <p v-if="draft.DisplayMode==='AfterServerRestart'" class="mci-reminders__notice">后端重启后的首次登录访问可收到此公告。同一帐号多开页面只领取一次，刷新页面不会再次提醒。</p>
              <div class="mci-reminders__grid">
                <label><span>提醒类型</span><select v-model="draft.ReminderType" @change="changeKind"><option value="Announcement">公告提醒</option><option value="Scheduled">定时提醒</option><option v-if="capabilities.IsMainTenant && draft.ScopeType === 'Tenants'" value="Trial">试用到期提醒</option></select></label>
                <label><span>显示频率</span><select v-model="draft.DisplayMode" @change="changeDisplayMode"><option value="Once">每位用户每次计划提示一次</option><option value="EveryEntry">每次进入或刷新系统都提示</option><option value="AfterServerRestart" :disabled="Number(capabilities.ProtocolVersion || 1)<2">每次后端重启后提示一次</option></select></label>
                <template v-if="draft.ReminderType === 'Trial'"><label><span>试用到期时间 <b>*</b></span><input v-model="times.trial" type="datetime-local" required></label><label><span>提前提醒（分钟）</span><input v-model.number="draft.AdvanceMinutes" type="number" min="0" max="525600"></label></template>
                <label v-else><span>开始时间 <b>*</b></span><input v-model="times.start" type="datetime-local" required></label>
                <label><span>结束时间 <b>*</b></span><input v-model="times.end" type="datetime-local" required></label>
                <template v-if="draft.ReminderType === 'Scheduled'"><label><span>重复计划</span><select v-model="draft.RepeatMode" :disabled="draft.DisplayMode==='AfterServerRestart'"><option value="None">不重复</option><option value="Daily">每 24 小时</option><option value="Weekly">每 7 天</option><option value="Interval">自定义间隔</option></select></label><label v-if="draft.RepeatMode === 'Interval'"><span>间隔（分钟）</span><input v-model.number="draft.IntervalMinutes" type="number" min="1" max="525600" required></label></template>
                <label><span>优先级（0–100）</span><input v-model.number="draft.Priority" type="number" min="0" max="100" required></label>
              </div>
              </section>
            </fieldset>
            <div class="mci-reminders__actions"><span>{{ dirty ? '有未保存的修改' : selected.Id ? '草稿已保存' : '尚未保存' }}{{ selected.PublishedBatchId && selected.Status === 'Draft' ? '，旧版仍在生效' : '' }}</span><button type="submit" class="is-primary" :disabled="busy || readOnly || unsavedTenant">{{ busy ? '处理中…' : '保存草稿' }}</button></div>
          </form>
          <section v-else-if="tab === 'preview'" class="mci-reminders__preview"><div class="mci-reminders__preview-card"><span class="mci-reminders__preview-icon"><MciMessageIcon :name="draft.Icon"/></span><h2>{{ draft.Title || '提醒标题' }}</h2><p>{{ draft.Content || '提醒内容将在这里展示。' }}</p><div class="mci-reminders__actions"><span v-if="draft.LinkUrl">{{ draft.LinkText }} ↗</span><button type="button" @click="notify('这是效果预览。正式提醒可由接收用户关闭。')">我知道了</button></div></div><small>预览不会保存或向用户发送提醒。</small></section>
          <section v-else class="mci-reminders__history"><p v-if="!history.length">暂无发布记录。</p><article v-for="record in history" :key="record.Id"><strong>第 {{ record.Revision }} 版 · {{ statusName(record.State) }}</strong><p>{{ formatDate(record.StartsAt) }} — {{ formatDate(record.EndsAt) }}</p><small>{{ record.Title }}</small></article></section>
          <footer class="mci-reminders__publish"><p>{{ targetSummary }}<small>用户离线时，登录后将在有效期内收到提醒。撤回后停止投递。</small></p><button v-if="selected.PublishedBatchId" :disabled="busy || readOnly" @click="ask('Withdraw')">撤回提醒</button><button class="is-primary" :disabled="busy || !selected.Id || dirty || readOnly" @click="ask('Publish')">发布提醒</button></footer>
        </section>
        <section v-else class="mci-reminders__empty"><h2>让重要消息及时被看见</h2><p>选择左侧提醒查看配置，或新建一条提醒。</p></section>
      </div>
      </template>
    </template>
    <Teleport to="body">
      <div v-if="toast" class="mci-reminders__toast" role="status" :style="theme"><span>{{ toast }}</span><button aria-label="关闭提示" @click="toast = ''">×</button></div>
      <dialog ref="confirmRef" class="mci-reminders__confirm" :style="[theme, { transform: `translate(${drag.x}px, ${drag.y}px)` }]" @cancel.prevent="cancelConfirmation">
        <header @pointerdown="startDrag"><h2>{{ confirmationTitle }}</h2><button aria-label="取消" @click="cancelConfirmation">×</button></header>
        <template v-if="confirmation==='Discard'"><p>当前修改尚未保存。放弃后将恢复已保存的配置。</p></template><template v-else><p><strong>{{ draft.Title }}</strong></p><p>{{ targetSummary }}</p><p>{{ confirmation === 'Withdraw' ? '确认停止此提醒的后续投递？已显示的提醒将在下次同步时关闭。' : '确认发布当前已保存的版本？接收者将在计划时间内看到提醒。' }}</p></template>
        <footer><button @click="cancelConfirmation">取消</button><button class="is-primary" :disabled="busy" @click="executeConfirmation">{{ confirmation==='Discard'?'放弃修改':confirmation==='Withdraw'?'确认撤回':'确认发布' }}</button></footer>
      </dialog>
    </Teleport>
  </main>
</template>

<script setup>
import { computed, ref, reactive, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { configureV8, getContext, subscribeContext, dispatch } from './microi'
import { createPlatformReminderClient } from './platform-reminder-api'
import BusinessNotifications from './BusinessNotifications.vue'
import LicenseExpirySettings from './LicenseExpirySettings.vue'
import MciMessageIcon from './MciMessageIcon.vue'
const props=defineProps({initialSection:{type:String,default:'Announcements'}})
const activeSection=ref(props.initialSection),businessRef=ref(),businessDirty=ref(false),businessBusy=ref(false)
const sections=computed(()=>[{key:'Announcements',name:'系统公告',icon:'bell'},{key:'Business',name:'业务通知',icon:'mail'},{key:'Logs',name:'投递记录',icon:'history'},...(capabilities.value.IsMainTenant?[{key:'LicenseExpiry',name:'授权到期提醒',icon:'clock'}]:[])])
const editorStep=ref('content'),editorSteps=[{key:'content',name:'内容',icon:'mail'},{key:'audience',name:'接收对象',icon:'users'},{key:'schedule',name:'时间计划',icon:'clock'}]
const host = ref(getContext()), capabilities = ref({}), loading = ref(true), busy = ref(false), fatal = ref('')
const rules = ref([]), total = ref(0), page = ref(1), keyword = ref(''), selected = ref({}), draft = ref({}), times = reactive({start:'',end:'',trial:''})
const editorOpen = ref(false), tab = ref('edit'), saved = ref(''), history = ref([]), formRef = ref(), confirmRef = ref(), confirmation = ref(''), toast = ref('')
const recipients = ref([]), recipientKeyword = ref(''), recipientLoading = ref(false), drag = reactive({x:0,y:0})
let disposed = false, generation = 0, unsubscribe, toastTimer, releaseDrag, resizeObserver
let pendingNavigation,draftRequestId=crypto.randomUUID()
const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
const icons = {bell:'通知铃铛',clock:'时间',warning:'注意',maintenance:'维护',info:'信息',gift:'礼物'}
const embedded = computed(() => !!host.value.componentMode)
const input = computed(() => embedded.value ? {TenantKey:host.value.componentData?.FormData?.OsClient, TenantId:host.value.componentData?.TableRowId} : host.value.dialogData || {})
const lockedScope = computed(() => embedded.value || !!input.value.ScopeType || !!input.value.TenantKey || !!input.value.TenantKeys)
const lockedTargets = computed(() => !!input.value.TenantKey || !!input.value.TenantKeys)
const unsavedTenant = computed(() => embedded.value && (!input.value.TenantKey || !input.value.TenantId))
const readOnly = computed(() => embedded.value && (host.value.componentData?.FieldReadonly || host.value.componentData?.FormMode === 'View'))
const scopeCaption = computed(() => input.value.TenantKey ? `租户 ${input.value.TenantKey}` : '公告、试用到期与定时提醒')
const theme = computed(() => {
  const dark = host.value.themeMode === 'dark'
  return {'--mci-primary':host.value.themeColor,'--mci-on-primary':host.value.themeOnPrimary,'--mci-primary-text':host.value.themePrimaryText,
    '--mci-bg':dark?'#141923':'#f5f7fa','--mci-card':dark?'#202632':'#ffffff','--mci-soft':dark?'#2a3240':'#f1f4f8','--mci-text':dark?'#edf2fa':'#233044','--mci-muted':dark?'#aab6c8':'#617087','--mci-border':dark?'#3b4556':'#dce3ed','--mci-success':dark?'#71dbb2':'#087753','--mci-warning':dark?'#efbf6e':'#966000','color-scheme':dark?'dark':'light'}
})
const fingerprint = () => JSON.stringify({draft:draft.value,times})
const dirty = computed(() => editorOpen.value && fingerprint() !== saved.value)
const hasChanges=computed(()=>activeSection.value==='Announcements'?dirty.value:businessDirty.value)
const confirmationTitle=computed(()=>({Withdraw:'撤回提醒',Publish:'发布提醒',Discard:'放弃未保存的修改'}[confirmation.value]||'确认操作'))
const filteredRecipients = computed(() => recipients.value.filter(x => `${x.Name} ${x.Key}`.toLowerCase().includes(recipientKeyword.value.toLowerCase())))
const selectedMissing = computed(() => (draft.value.TargetKeys || []).filter(key => !recipients.value.some(x => x.Key === key)))
const targetSummary = computed(() => `${scopeName(draft.value.ScopeType)}：${draft.value.AllTargets ? '全部' : (draft.value.TargetKeys || []).map(key => recipients.value.find(x => x.Key === key)?.Name || key).join('、') || '尚未选择'} · ${draft.value.AccountScope==='SuperAdmins'?'仅超级管理员':'所有系统帐号'}`)
const statusName = key => ({Draft:'草稿',Published:'已发布',Withdrawn:'已撤回',Superseded:'已被新版替换'}[key] || key)
const kindName = key => ({Announcement:'公告',Scheduled:'定时',Trial:'试用到期'}[key] || key)
const scopeName = key => ({Users:'当前租户用户',Tenants:'子租户',Editions:'吾码产品版本'}[key] || '')
const localTime = value => {const date=new Date(value);if(!Number.isFinite(date.getTime())) return '';return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16)}
const formatDate = value => new Date(value).toLocaleString()
function notify(message) {toast.value=String(message);clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toast.value=''},9000)}
function navigateSafely(action){if(busy.value)return;if(hasChanges.value){pendingNavigation=action;ask('Discard')}else action()}
function changeSection(section){if(section===activeSection.value)return;navigateSafely(()=>{activeSection.value=section;businessDirty.value=false})}
function discardCurrent(){if(activeSection.value==='Announcements'){const current=rules.value.find(x=>x.Id===selected.value.Id);if(current)editRule(current);else newRule()}else businessRef.value?.discard()}
function requestDiscard(){navigateSafely(()=>{})}
function refreshCurrent(){navigateSafely(async()=>{if(activeSection.value==='Announcements'){await initialize();const current=rules.value.find(x=>x.Id===selected.value.Id);if(current)editRule(current)}else await businessRef.value?.refresh()})}
const run = createPlatformReminderClient(configureV8)
async function initialize() {
  const current=++generation;loading.value=true;fatal.value=''
  try {const result=await run('Capabilities');if(disposed||current!==generation)return;capabilities.value=result.Data||{};if(capabilities.value.Administrator){await loadRules(1);if(!editorOpen.value)newRule()}}
  catch(error){if(!disposed&&current===generation)fatal.value=error.message}
  finally{if(!disposed&&current===generation)loading.value=false}
}
async function loadRules(index=1) {try{const result=await run('List',{Keyword:keyword.value,PageIndex:index,TargetKey:input.value.TenantKey||'',ScopeType:lockedScope.value?'Tenants':''});if(disposed)return;rules.value=result.Data||[];total.value=result.DataCount||0;page.value=index}catch(error){notify(error.message)}}
function newRule(){draftRequestId=crypto.randomUUID();editorStep.value='content';selected.value={};draft.value={Title:'',Content:'',Icon:'bell',Severity:'info',ReminderType:'Announcement',DisplayMode:'Once',ScopeType:lockedScope.value?'Tenants':'Users',AccountScope:lockedScope.value?'SuperAdmins':'AllAccounts',AllTargets:input.value.AllTargets===true,TargetKeys:input.value.TenantKeys|| (input.value.TenantKey?[input.value.TenantKey]:[]),RepeatMode:'None',IntervalMinutes:60,AdvanceMinutes:4320,Priority:0,LinkUrl:'',LinkText:'查看详情'};times.start=localTime(Date.now());times.end=localTime(Date.now()+7*86400000);times.trial='';saved.value=fingerprint();editorOpen.value=true;tab.value='edit';void loadRecipients()}
function editRule(row){try{editorStep.value='content';draft.value={AccountScope:'AllAccounts',...JSON.parse(row.RuleJson)};selected.value={...row};times.start=localTime(draft.value.StartsAt);times.end=localTime(draft.value.EndsAt);times.trial=localTime(draft.value.TrialExpiresAt);editorOpen.value=true;tab.value='edit';saved.value=fingerprint();void loadRecipients()}catch{notify('规则内容无法读取，请刷新后重试。')}}
async function loadRecipients(){recipientLoading.value=true;try{const scope=draft.value.ScopeType;const result=await run('Recipients',{ScopeType:scope,Keyword:recipientKeyword.value});if(!disposed&&draft.value.ScopeType===scope)recipients.value=result.Data||[]}catch(error){notify(error.message)}finally{recipientLoading.value=false}}
function changeScope(){draft.value.AllTargets=false;draft.value.TargetKeys=[];draft.value.AccountScope=draft.value.ScopeType==='Users'?'AllAccounts':'SuperAdmins';if(draft.value.ScopeType!=='Tenants'&&draft.value.ReminderType==='Trial')draft.value.ReminderType='Announcement';recipientKeyword.value='';void loadRecipients()}
function changeKind(){if(draft.value.ReminderType!=='Scheduled'){draft.value.RepeatMode='None';draft.value.IntervalMinutes=0}if(draft.value.ReminderType==='Trial'){draft.value.AllTargets=false;draft.value.TargetKeys=draft.value.TargetKeys.slice(0,1)}}
function changeDisplayMode(){if(draft.value.DisplayMode==='AfterServerRestart'){draft.value.RepeatMode='None';draft.value.IntervalMinutes=0}}
async function save(){
  if(busy.value||readOnly.value)return
  if(formRef.value&&!formRef.value.checkValidity()){
    const invalid=[...formRef.value.elements].find(element=>element.validity&&!element.validity.valid)
    editorStep.value=invalid?.closest('[data-form-step]')?.dataset.formStep||'content'
    await nextTick();formRef.value.reportValidity();return
  }
  busy.value=true
  try{
    const Rule={...draft.value,StartsAt:new Date(times.start).toISOString(),EndsAt:new Date(times.end).toISOString(),TrialExpiresAt:times.trial?new Date(times.trial).toISOString():''}
    const result=await run('Save',{Rule,Id:selected.value.Id,ExpectedRevision:selected.value.Revision,RequestId:draftRequestId})
    selected.value={...selected.value,...result.Data,Status:'Draft',RuleJson:JSON.stringify(Rule)};saved.value=fingerprint();await loadRules(page.value)
    notify('草稿已保存。核对预览后，点击“发布提醒”。')
  }catch(error){if(/接收|对象|帐号/.test(error.message))editorStep.value='audience';notify(error.message)}
  finally{busy.value=false}
}
async function loadHistory(){tab.value='history';try{history.value=(await run('History',{Id:selected.value.Id})).Data||[]}catch(error){notify(error.message)}}
function overlay(visible){dispatch('micro-app:host-action',{action:'setGlobalOverlay',requestId:`reminders-${Date.now()}`,visible,blur:!host.value.disableFormMaskBlur,lockScroll:visible,nativeTopLayer:false,mask:visible,promote:visible,silent:true},{force:true})}
function ask(action){if(action==='Publish'&&dirty.value){notify('请先保存当前修改。');return}confirmation.value=action;drag.x=drag.y=0;overlay(true);confirmRef.value?.showModal()}
function cancelConfirmation(){confirmRef.value?.close();confirmation.value='';pendingNavigation=undefined;overlay(false)}
async function executeConfirmation(){if(busy.value)return;const action=confirmation.value,navigate=pendingNavigation;cancelConfirmation();if(action==='Discard'){discardCurrent();navigate?.();return}busy.value=true;try{const result=await run(action,{Id:selected.value.Id,ExpectedRevision:selected.value.Revision,RequestId:crypto.randomUUID()});await loadRules(page.value);const updated=rules.value.find(x=>x.Id===selected.value.Id);if(updated)editRule(updated);notify(result.Msg||'操作成功。')}catch(error){notify(error.message);await loadRules(page.value)}finally{busy.value=false}}
function startDrag(event){if(event.target.closest('button')||event.button!==0)return;const start={x:event.clientX,y:event.clientY,dx:drag.x,dy:drag.y};const bounds=confirmRef.value.getBoundingClientRect();const move=e=>{drag.x=Math.min(innerWidth-bounds.right+start.dx,Math.max(-bounds.left+start.dx,start.dx+e.clientX-start.x));drag.y=Math.min(innerHeight-bounds.bottom+start.dy,Math.max(-bounds.top+start.dy,start.dy+e.clientY-start.y))};releaseDrag=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',releaseDrag)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',releaseDrag,{once:true})}
onMounted(()=>{let identity='';unsubscribe=subscribeContext(context=>{host.value=context;const next=`${context.osClient}|${context.currentUser?.Id}|${context.componentData?.TableRowId||''}|${context.dialogData?.TenantKey||''}`;if(next!==identity){identity=next;editorOpen.value=false;void initialize()}});resizeObserver=new ResizeObserver(()=>{if(embedded.value)dispatch('dev-component:resize',{height:Math.min(1400,Math.max(520,document.querySelector('.mci-reminders')?.scrollHeight||520))},{force:true})});resizeObserver.observe(document.querySelector('.mci-reminders'))})
onBeforeUnmount(()=>{disposed=true;generation++;resizeObserver?.disconnect();unsubscribe?.();releaseDrag?.();clearTimeout(toastTimer);cancelConfirmation()})
</script>

<style scoped>
.mci-reminders,.mci-reminders__toast,.mci-reminders__confirm{font-family:"Microsoft YaHei",system-ui,sans-serif;color:var(--mci-text);font-size:14px;box-sizing:border-box}
.mci-reminders{min-height:100vh;padding:20px;background:var(--mci-bg);animation:mciReminderEnter .24s ease-out}.mci-reminders[data-embedded=true]{min-height:520px;padding:12px}
.mci-reminders :is(button,input,select,textarea),.mci-reminders__confirm button,.mci-reminders__toast button{font:inherit;color:var(--mci-text);border:1px solid var(--mci-border);border-radius:8px;background:var(--mci-card);min-width:0}
.mci-reminders button,.mci-reminders__confirm button,.mci-reminders__toast button{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 14px;cursor:pointer;line-height:1.3;transition:background .15s,transform .15s}
.mci-reminders button:hover,.mci-reminders__confirm button:hover{background:var(--mci-soft);border-color:var(--mci-primary)}.mci-reminders button:active{transform:translateY(1px)}.mci-reminders :focus-visible,.mci-reminders__confirm :focus-visible{outline:2px solid var(--mci-primary);outline-offset:2px}
.mci-reminders button:disabled,.mci-reminders__confirm button:disabled{opacity:.5;cursor:not-allowed}.mci-reminders .is-primary,.mci-reminders__confirm .is-primary{color:var(--mci-on-primary);background:var(--mci-primary);border-color:var(--mci-primary)}
.mci-reminders__header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px}.mci-reminders h1{font-size:22px;margin:0 0 5px;line-height:1.5}.mci-reminders h2{font-size:15px;margin:20px 0 12px}.mci-reminders__header p,.mci-reminders__hint{margin:0;color:var(--mci-muted);line-height:1.6;font-size:13px}
.mci-reminders__toolbar{display:flex;align-items:center;gap:8px;margin:12px 0;flex-wrap:wrap}.mci-reminders__toolbar>label{flex:1}.mci-reminders input:not([type=checkbox]),.mci-reminders select,.mci-reminders textarea{width:100%;padding:9px 10px;box-sizing:border-box}.mci-reminders textarea{resize:vertical;line-height:1.7}.mci-reminders__toolbar>input{flex:1;width:auto}
.mci-reminders__workspace{display:grid;grid-template-columns:minmax(200px,27%) minmax(0,1fr);gap:16px;align-items:start}.mci-reminders__list{display:grid;gap:8px;max-height:70vh;overflow:auto}.mci-reminders .mci-reminders__row{display:flex;align-items:flex-start;flex-direction:column;gap:7px;text-align:left;padding:14px;white-space:normal;overflow-wrap:anywhere;min-height:93px}.mci-reminders__row strong{font-size:14px}.mci-reminders__row span,.mci-reminders small{font-size:12px;color:var(--mci-muted);line-height:1.6}.mci-reminders .is-selected{background:color-mix(in srgb,var(--mci-primary) 10%,var(--mci-card));border-color:var(--mci-primary);color:var(--mci-primary-text)}
.mci-reminders__editor{padding:18px;border:1px solid var(--mci-border);border-radius:12px;background:var(--mci-card);box-shadow:0 5px 20px #14253a06;min-width:0}.mci-reminders__tabs{display:flex;gap:6px;padding-bottom:16px;flex-wrap:wrap}.mci-reminders fieldset{padding:0;margin:0;border:0;min-width:0}.mci-reminders__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mci-reminders__grid>label{display:flex;flex-direction:column;gap:7px;min-width:0}.mci-reminders__grid>label>span{font-size:13px;font-weight:600}.mci-reminders__grid .is-wide{grid-column:1/-1}.mci-reminders b{color:var(--mci-primary-text)}
.mci-reminders__recipients{margin-top:12px;padding:12px;border:1px solid var(--mci-border);border-radius:8px;background:var(--mci-bg)}.mci-reminders__options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-height:200px;overflow:auto}.mci-reminders .mci-reminders__check{display:flex;flex-direction:row;align-items:center;gap:8px;min-height:36px;line-height:1.6;overflow-wrap:anywhere}.mci-reminders__check input{accent-color:var(--mci-primary);width:16px;height:16px;flex:none}.mci-reminders__check small{display:block}.mci-reminders__tags{display:flex;gap:8px;flex-wrap:wrap}.mci-reminders__tags>span{background:var(--mci-soft);padding:4px 8px;border-radius:6px;font-size:12px}.mci-reminders__tags button{padding:0 5px;min-height:24px}.mci-reminders__notice{padding:12px;background:var(--mci-soft);border-radius:8px;line-height:1.7;color:var(--mci-primary-text)}.mci-reminders__hint{margin-bottom:12px}.mci-reminders details{margin-top:20px}.mci-reminders summary{cursor:pointer;margin-bottom:12px;color:var(--mci-muted)}
.mci-reminders__actions,.mci-reminders__publish{position:static;display:flex;align-items:center;justify-content:flex-end;gap:10px;margin:18px 0 0;padding:15px 0 0;border-top:1px solid var(--mci-border);background:var(--mci-card)}.mci-reminders__actions>span{font-size:12px;color:var(--mci-muted);margin-right:auto}.mci-reminders__publish p{margin:0 auto 0 0;font-size:13px;line-height:1.7;overflow-wrap:anywhere;max-width:60%}.mci-reminders__publish small{display:block}.mci-reminders__publish button{flex:none}.mci-reminders__pages{display:flex;justify-content:center;align-items:center;gap:8px;padding:10px}
.mci-reminders__empty{display:grid;align-content:center;justify-items:center;min-height:160px;padding:24px;text-align:center;line-height:1.8;color:var(--mci-muted)}.mci-reminders__preview{padding:25px 12px;text-align:center;background:var(--mci-bg);border-radius:8px}.mci-reminders__preview-card{margin:0 auto 12px;max-width:500px;padding:24px;border:1px solid var(--mci-border);border-radius:14px;background:var(--mci-card);text-align:left}.mci-reminders__preview-card h2{font-size:19px;margin:14px 0}.mci-reminders__preview-card p{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.85;max-height:340px;overflow:auto}.mci-reminders__preview-icon{font-size:28px;color:var(--mci-primary-text)}.mci-reminders__history article{padding:16px 0;border-bottom:1px solid var(--mci-border);line-height:1.8}.mci-reminders__history p{margin:5px 0;color:var(--mci-muted)}
.mci-reminders__skeleton{display:grid;gap:14px}.mci-reminders__skeleton i{height:72px;border-radius:8px;background:linear-gradient(100deg,var(--mci-soft),var(--mci-card),var(--mci-soft));background-size:250% 100%;animation:mciReminderSkeleton 1.5s infinite}.mci-reminders__sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.mci-reminders__toast{position:fixed;z-index:2147483647;top:50%;left:50%;transform:translate(-50%,-50%);display:flex;align-items:center;gap:14px;max-width:min(520px,calc(100vw - 32px));padding:16px 20px;background:var(--mci-card);border:1px solid var(--mci-border);border-radius:12px;box-shadow:0 14px 50px #0003;line-height:1.7}.mci-reminders__toast button{border:0;font-size:20px;padding:4px;flex:none}
.mci-reminders__confirm{position:fixed;inset:0;margin:auto;width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 32px);padding:24px;border:1px solid var(--mci-border);border-radius:14px;background:var(--mci-card);box-shadow:0 18px 64px #0004;line-height:1.8;overflow:auto}.mci-reminders__confirm::backdrop{background:#0006}.mci-reminders__confirm header{display:flex;align-items:center;justify-content:space-between;cursor:move}.mci-reminders__confirm h2{margin:0;font-size:19px}.mci-reminders__confirm p{white-space:pre-wrap;overflow-wrap:anywhere}.mci-reminders__confirm footer{position:static;display:flex;justify-content:flex-end;gap:10px;margin:20px 0 0;padding:0;border:0;background:transparent}
.mci-reminders{padding:16px;max-width:1760px;margin:0 auto}.mci-reminders svg{width:17px;height:17px;flex:none}.mci-reminders button{gap:6px;font-size:13px;min-height:34px}.mci-reminders__header{margin:0 0 14px;padding:14px 16px;border:1px solid var(--mci-border);border-radius:12px;background:linear-gradient(115deg,color-mix(in srgb,var(--mci-primary) 5%,var(--mci-card)),var(--mci-card) 65%)}.mci-reminders__identity{display:flex;align-items:center;gap:12px}.mci-reminders__brand-icon{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:12px;color:var(--mci-primary-text);background:color-mix(in srgb,var(--mci-primary) 12%,var(--mci-card));flex:none}.mci-reminders__brand-icon svg{width:25px;height:25px}.mci-reminders h1{font-size:20px;line-height:1.4;margin-bottom:3px}.mci-reminders__header p{font-size:12px}.mci-reminders__header-actions{display:flex;gap:8px;flex:none;flex-wrap:wrap}.mci-reminders__header-actions button{white-space:nowrap}.mci-reminders__sections{display:flex;gap:5px;padding:5px;margin-bottom:16px;border:1px solid var(--mci-border);border-radius:10px;background:var(--mci-card);width:fit-content;max-width:100%}.mci-reminders__sections button{border-color:transparent;gap:7px;padding:9px 18px}.mci-reminders__sections .is-selected{font-weight:600}.mci-reminders__toolbar{margin:0 0 14px}.mci-reminders__search{display:flex;align-items:center;gap:8px;padding:0 10px;max-width:480px;background:var(--mci-card);border:1px solid var(--mci-border);border-radius:8px;color:var(--mci-muted)}.mci-reminders__search input{border:0;background:transparent}.mci-reminders__workspace{grid-template-columns:280px minmax(0,1fr);gap:14px}.mci-reminders .mci-reminders__row{padding:12px;min-height:90px;gap:7px}.mci-reminders__row-title{display:flex;gap:7px;align-items:flex-start}.mci-reminders__row-title svg{margin-top:2px;color:var(--mci-primary-text)}.mci-reminders__row-title strong{font-size:13px;color:var(--mci-text)}.mci-reminders__row-meta{display:flex;align-items:center;gap:8px}.mci-reminders__row-meta i{font-style:normal;font-size:10px;padding:2px 6px;border-radius:4px;background:var(--mci-soft)}.mci-reminders__row-meta i[data-status=Published]{color:var(--mci-success,#087753);background:color-mix(in srgb,var(--mci-success,#087753) 10%,var(--mci-card))}.mci-reminders__tabs{border-bottom:1px solid var(--mci-border);padding-bottom:12px;margin-bottom:16px}.mci-reminders__tabs button{border-color:transparent;font-size:12px;padding:7px 10px}.mci-reminders__grid{gap:12px}.mci-reminders__grid>label{gap:5px}.mci-reminders__grid>label>span{font-size:12px}.mci-reminders input:not([type=checkbox]),.mci-reminders select,.mci-reminders textarea{font-size:13px;padding:8px 10px}.mci-reminders__editor{padding:16px}.mci-reminders__editor h2{margin:0 0 10px}.mci-reminders__recipients{padding:10px}.mci-reminders__options{grid-template-columns:repeat(3,minmax(0,1fr))}.mci-reminders__notice{font-size:12px;padding:10px;margin:10px 0}.mci-reminders__preview-card{border-radius:14px;box-shadow:0 8px 30px color-mix(in srgb,var(--mci-text) 6%,transparent)}.mci-reminders__preview-icon{display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:color-mix(in srgb,var(--mci-primary) 10%,var(--mci-card))}.mci-reminders__preview-icon svg{width:26px;height:26px}.mci-reminders__actions,.mci-reminders__publish{margin-top:14px;padding-top:12px}.mci-reminders__publish p{font-size:12px}.mci-reminders__publish small{font-size:11px}
@media(max-width:1050px){.mci-reminders__workspace{grid-template-columns:230px minmax(0,1fr)}.mci-reminders__options{grid-template-columns:repeat(2,minmax(0,1fr))}.mci-reminders__tabs{gap:3px}}
@keyframes mciReminderSkeleton{to{background-position:-200% 0}}@keyframes mciReminderEnter{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
@media(max-width:760px){.mci-reminders{padding:12px}.mci-reminders__workspace{grid-template-columns:1fr}.mci-reminders__list{max-height:230px}.mci-reminders__grid{grid-template-columns:1fr}.mci-reminders__options{grid-template-columns:1fr}.mci-reminders__editor{padding:14px}.mci-reminders__publish{flex-wrap:wrap}.mci-reminders__publish p{max-width:100%;flex-basis:100%;margin-bottom:5px}.mci-reminders button{min-height:42px}.mci-reminders__header h1{font-size:19px}}
@media(prefers-reduced-motion:reduce){.mci-reminders,.mci-reminders__skeleton i{animation:none}.mci-reminders button{transition:none}}
</style>
