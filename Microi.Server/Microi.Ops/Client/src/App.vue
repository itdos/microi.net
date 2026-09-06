<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';
import { MciButton, MciCard, MciFormField, MciModal, MciDataState, MciThemePanel } from '@microi/mci-ui';
import { api, states, formatTime, formatBytes } from './api.js';

const session = ref(null), snapshot = ref(null), error = ref(''), notice = ref(''), busy = ref(false), tab = ref('overview');
const credentials = reactive({ account: '', password: '' });
const connection = reactive({ account: '', password: '', captchaId: '', captchaValue: '', acceptPrivacy: false });
const platformConfig = ref(null), captcha = ref(null), entries = ref([]), selected = ref([]), targets = reactive({});
const localOnly = ref(false), includeStopped = ref(false), plan = ref(null), planOpen = ref(false), confirmInterruption = ref(false), requestId = ref('');
const policy = reactive({ mode: 'Notify', intervalSeconds: 3600, timeZone: 'Asia/Shanghai', windowStartHour: 2, windowEndHour: 5 });
const policyLoaded = ref(false), log = ref(''), logTitle = ref(''), logOpen = ref(false), restoreTask = ref(null), restoreConfirm = ref(false);
const watchOpen = ref(false), watchEnabled = ref(false), watchConfirm = ref('');
const themeOpen = ref(false);
const taskId = ref(location.hash.slice(1));
function showTask(id) { taskId.value = id; location.hash = id; }
function hashChanged() { taskId.value = location.hash.slice(1); }
let timer, polling = false;
const nav = [ ['overview', '运行总览'], ['updates', '容器更新'], ['tasks', '更新任务'], ['policy', '自动更新'], ['platform', '平台连接'], ['logs', '运维日志'] ];
const modes = { Manual: '仅手动', Notify: '检查并通知', Download: '自动下载', Automatic: '维护窗口自动更新' };
const active = computed(() => snapshot.value?.tasks.find(x => ['Queued', 'Running', 'Recovering', 'NeedsAttention'].includes(x.state)));
const runningCount = computed(() => snapshot.value?.containers.filter(x => x.state === 'running').length || 0);
const available = computed(() => plan.value?.services.filter(x => x.changed) || []);
const selectedTask = computed(() => snapshot.value?.tasks.find(x => x.id === taskId.value) || active.value);

async function act(fn) {
  if (busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try { await fn(); } catch (e) { error.value = e.message; if (e.status === 401) session.value = await api('session'); }
  finally { busy.value = false; }
}
async function refresh() {
  if (!session.value?.authenticated || polling) return;
  polling = true;
  try {
    snapshot.value = await api('snapshot');
    if (!policyLoaded.value) { Object.assign(policy, snapshot.value.policy); policyLoaded.value = true; }
    if (tab.value === 'logs') entries.value = await api('events');
  } catch (e) { error.value = e.message; if (e.status === 401) session.value = await api('session'); }
  finally { polling = false; }
}
async function login() {
  await act(async () => {
    try { await api('login', credentials); } finally { credentials.password = ''; }
    session.value = await api('session'); await refresh();
  });
}
async function logout() { await act(async () => { await api('logout', {}); snapshot.value = null; session.value = await api('session'); }); }
async function chooseTab(value) {
  // 登录初始化和其它受控操作尚未结束时不切页，避免 act 的忙碌保护吞掉目标页加载。
  if (busy.value) return;
  tab.value = value;
  if (value === 'platform' && !platformConfig.value) await loadPlatform();
  if (value === 'logs') await act(async () => { entries.value = await api('events'); });
}
async function loadPlatform() {
  await act(async () => { platformConfig.value = await api('platform/config'); await renewCaptcha(); });
}
async function renewCaptcha() {
  captcha.value = null; connection.captchaId = ''; connection.captchaValue = '';
  if (platformConfig.value?.enableCaptcha) { captcha.value = await api('platform/captcha'); connection.captchaId = captcha.value.id || ''; }
}
async function platformLogin() {
  await act(async () => {
    try { await api('platform/login', connection); notice.value = '平台登录成功，待投递运维日志将自动补投。'; await refresh(); }
    catch (e) { await (async () => { platformConfig.value = await api('platform/config'); await renewCaptcha(); })().catch(() => {}); throw e; }
    finally { connection.password = ''; connection.captchaValue = ''; }
  });
}
async function checkUpdates() {
  await act(async () => {
    plan.value = await api('plans', { services: selected.value, targets: Object.fromEntries(Object.entries(targets).filter(([, v]) => v)), localOnly: localOnly.value, includeStopped: includeStopped.value });
    requestId.value = crypto.randomUUID(); confirmInterruption.value = false; planOpen.value = true;
  });
}
async function submit(downloadOnly) {
  await act(async () => {
    const result = await api('tasks', { planId: plan.value.id, fingerprint: plan.value.fingerprint, requestId: requestId.value, confirmInterruption: confirmInterruption.value, downloadOnly });
    planOpen.value = false; tab.value = 'tasks'; showTask(result.id); await refresh();
  });
}
async function savePolicy() { await act(async () => { Object.assign(policy, await api('policy', policy, 'PUT')); notice.value = '更新策略已保存，重启后仍然有效。'; await refresh(); }); }
async function viewLogs(container) { await act(async () => { const result = await api(`containers/${encodeURIComponent(container.name)}/logs`); log.value = result.content; logTitle.value = container.name; logOpen.value = true; }); }
async function copyUrl() { await act(async () => { await navigator.clipboard.writeText(session.value.publicUrl); notice.value = '独立访问地址已复制。'; }); }
async function restore() { await act(async () => { await api(`tasks/${restoreTask.value.id}/restore`, { confirm: restoreTask.value.id, databaseCompatible: restoreConfirm.value }); restoreTask.value = null; await refresh(); }); }
async function watchtower() { await act(async () => { await api('watchtower', { confirm: watchConfirm.value, enabled: watchEnabled.value }); watchOpen.value = false; notice.value = '旧更新器状态已修改，请按迁移说明核对原编排。'; await refresh(); }); }
onMounted(async () => {
  await act(async () => { session.value = await api('session'); await refresh(); if (location.hash) tab.value = 'tasks'; });
  timer = setInterval(refresh, 3000);
  window.addEventListener('hashchange', hashChanged);
});
onUnmounted(() => { clearInterval(timer); window.removeEventListener('hashchange', hashChanged); });
</script>

<template>
  <div class="ops-shell">
    <header class="topbar"><div class="brand-mark">M</div><div class="brand-copy"><strong>吾码平台运维中心</strong><small>Microi.Ops · 独立运维服务</small></div><div class="topbar-actions"><MciButton variant="ghost" @click="themeOpen = true">主题</MciButton><template v-if="session?.authenticated"><span>{{ session.account }}</span><MciButton variant="ghost" @click="logout">退出</MciButton></template></div></header>
    <div v-if="error" class="banner danger" role="alert">{{ error }}<button aria-label="关闭错误提示" @click="error = ''">×</button></div>
    <div v-if="notice" class="banner success" role="status">{{ notice }}</div>
    <div v-if="!session" class="loading"><MciDataState title="正在连接运维中心" description="读取独立服务状态…" /></div>
    <main v-else-if="!session.authenticated" class="login-layout">
      <div class="login-copy"><span class="eyebrow">KEEP YOUR PLATFORM RUNNING</span><h1>每一次更新，<br>进度都在掌握。</h1><p>查看服务、检查镜像、追踪更新与恢复。<br>平台维护期间，也能从这里继续操作。</p><div class="status-pill">● 独立于吾码 API / Web 运行</div></div>
      <MciCard class="login-card"><h2>登录运维中心</h2><p class="muted">使用部署时配置的独立运维账号。</p><form @submit.prevent="login" class="form-stack"><MciFormField v-model="credentials.account" label="运维账号" required /><MciFormField v-model="credentials.password" label="运维密码" type="password" required /><button class="primary submit" type="submit" :disabled="busy">{{ busy ? '正在验证…' : '登录运维中心' }}</button></form><p class="muted fine">在平台中打开时，如浏览器限制嵌入登录，请使用独立地址。</p><a :href="session.publicUrl" target="_blank" rel="noopener noreferrer">独立窗口打开 ↗</a></MciCard>
    </main>
    <div v-else class="workspace">
      <aside><nav aria-label="运维功能"><button v-for="[id, label] in nav" :key="id" :class="{ active: tab === id }" :disabled="busy" @click="chooseTab(id)"><span>{{ label }}</span><span v-if="id === 'tasks' && active" class="dot">●</span></button></nav><div class="aside-note">版本 {{ session.version }}<br>任务持续在服务端运行</div></aside>
      <main class="content">
        <div class="address-strip"><span>独立访问地址</span><a :href="session.publicUrl" target="_blank" rel="noopener noreferrer">{{ session.publicUrl }} ↗</a><button @click="copyUrl">复制</button></div>
        <MciDataState v-if="!snapshot" title="正在读取部署状态" description="连接 Docker 引擎…" />
        <template v-else>
          <div class="page-heading"><div><span class="eyebrow">{{ snapshot.deployment.name }}</span><h1>{{ nav.find(x => x[0] === tab)?.[1] }}</h1></div><MciButton variant="secondary" :disabled="busy" @click="refresh">刷新状态</MciButton></div>
          <div v-if="snapshot.dockerError" class="banner danger">{{ snapshot.dockerError }}</div>
          <div v-if="snapshot.logWarning" class="banner danger">{{ snapshot.logWarning }}</div>
          <template v-if="tab === 'overview'">
            <div class="metrics"><MciCard><span class="muted">相关容器运行中</span><strong class="metric">{{ runningCount }}<small> / {{ snapshot.containers.length }}</small></strong></MciCard><MciCard><span class="muted">更新策略</span><strong class="metric words">{{ modes[snapshot.policy.mode] }}</strong><small>{{ snapshot.policy.nextCheck ? '下次检查 ' + formatTime(snapshot.policy.nextCheck) : '等待检查' }}</small></MciCard><MciCard><span class="muted">平台日志连接</span><strong class="metric words">{{ snapshot.platform.connected ? '已登录' : '未登录' }}</strong><small>{{ snapshot.platform.pendingEvents }} 条日志等待平台回执</small></MciCard></div>
            <MciCard v-if="active" class="task-highlight"><div class="row"><h2>{{ states[active.state] }}</h2><MciButton @click="tab = 'tasks'">查看任务</MciButton></div><p>{{ active.phase }}</p><progress :value="active.progress" max="100" /></MciCard>
            <MciCard><h2>容器状态</h2><div class="table-scroll"><table><thead><tr><th>容器</th><th>镜像</th><th>状态</th><th>管理范围</th><th>操作</th></tr></thead><tbody><tr v-for="item in snapshot.containers" :key="item.id"><td><strong>{{ item.name }}</strong></td><td class="image-name">{{ item.image }}</td><td><span class="status-pill" :class="item.state === 'running' ? 'good' : ''">{{ item.status }}</span></td><td>{{ item.managed ? '受管服务' : '仅查看' }}</td><td><MciButton v-if="item.managed || item.name === snapshot.deployment.watchtowerName" variant="ghost" @click="viewLogs(item)">查看日志</MciButton><span v-else>—</span></td></tr></tbody></table></div><MciDataState v-if="!snapshot.containers.length" title="暂无相关容器" description="请按部署说明登记需要管理的 API/Web 服务。" /></MciCard>
          </template>
          <template v-if="tab === 'updates'">
            <MciCard><h2>选择更新服务</h2><p class="muted">先检查并核对目标版本，再启动更新。镜像准备完成后才会切换服务。</p><div v-for="service in snapshot.deployment.services" :key="service.name" class="service-option"><label class="check"><input v-model="selected" type="checkbox" :value="service.name" />{{ service.name }} <span class="muted">{{ service.role.toUpperCase() }}</span></label><MciFormField v-model="targets[service.name]" :label="service.name + ' 目标镜像（可选）'" :placeholder="service.repository + ':' + service.tag" /></div><p v-if="!snapshot.deployment.services.length" class="muted">尚未登记受管服务，请先完成部署清单配置。</p><div class="form-stack compact"><label class="check"><input v-model="localOnly" type="checkbox" />使用已导入的本地镜像（离线更新）</label><label class="check"><input v-model="includeStopped" type="checkbox" />包含已停止的容器（替换后仍保持停止）</label></div><MciButton :disabled="busy || !selected.length || !!active" :loading="busy" @click="checkUpdates">检查更新并生成计划</MciButton><p v-if="active" class="muted">请先完成或恢复当前任务。</p></MciCard>
          </template>
          <template v-if="tab === 'tasks'">
            <MciCard v-if="selectedTask"><div class="row"><h2>{{ states[selectedTask.state] }}</h2><span class="status-pill">{{ selectedTask.progress }}%</span></div><p>{{ selectedTask.phase }}</p><progress :value="selectedTask.progress" max="100" /><p class="muted">{{ selectedTask.estimatedSeconds != null ? '下载预计剩余约 ' + Math.ceil(selectedTask.estimatedSeconds) + ' 秒' : '切换与就绪检测耗时取决于实际服务状态' }}</p><p v-if="Object.keys(selectedTask.downloaded).length">已传输 {{ formatBytes(Object.values(selectedTask.downloaded).reduce((a, b) => a + b, 0)) }}</p><p v-if="selectedTask.error" class="danger-text">{{ selectedTask.error }}</p><code>任务 {{ selectedTask.id }}</code><p class="muted fine">关闭或刷新页面不会取消已提交任务。发生服务中断时，请保留此独立地址。</p></MciCard>
            <MciCard><h2>任务记录</h2><div class="table-scroll"><table><thead><tr><th>时间</th><th>进度</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="task in snapshot.tasks" :key="task.id"><td>{{ formatTime(task.created) }}</td><td>{{ task.phase }}</td><td>{{ states[task.state] }}</td><td><div class="row"><button @click="showTask(task.id)">详情</button><button v-if="['Succeeded','NeedsAttention','Failed'].includes(task.state) && Object.keys(task.steps).length" @click="restoreTask = task; restoreConfirm = false">恢复原容器</button></div></td></tr></tbody></table></div><MciDataState v-if="!snapshot.tasks.length" title="暂无更新任务" description="从“容器更新”检查目标镜像后开始。" /></MciCard>
          </template>
          <template v-if="tab === 'policy'">
            <MciCard><h2>选择更新方式</h2><div class="mode-grid"><label v-for="(label, mode) in modes" :key="mode" class="mode-option" :class="{ chosen: policy.mode === mode }"><input v-model="policy.mode" type="radio" name="mode" :value="mode" /><strong>{{ label }}</strong><small>{{ { Manual: '只接受管理员手动提交', Notify: '发现新镜像后记录通知', Download: '提前准备镜像，等待手动切换', Automatic: '按兼容声明在维护窗口切换' }[mode] }}</small></label></div><div class="form-grid"><MciFormField label="检查间隔（秒，最少 60）"><input v-model.number="policy.intervalSeconds" type="number" min="60" max="604800" /></MciFormField><MciFormField v-model="policy.timeZone" label="时区" /><MciFormField label="维护窗口开始小时"><input v-model.number="policy.windowStartHour" type="number" min="0" max="23" /></MciFormField><MciFormField label="维护窗口结束小时"><input v-model.number="policy.windowEndHour" type="number" min="0" max="23" /></MciFormField></div><p class="muted">自动切换只适用于部署清单已允许自动更新且声明镜像回退兼容的服务。窗口起止相同表示全天。</p><p v-if="snapshot.policy.lastError" class="danger-text">{{ snapshot.policy.lastError }}</p><MciButton :disabled="busy" @click="savePolicy">保存更新策略</MciButton></MciCard>
            <MciCard v-if="snapshot.deployment.watchtowerName"><h2>旧 Watchtower 迁移</h2><p class="muted">{{ snapshot.deployment.watchtowerName }} · 当前版本仅允许启停确认只管理本部署的旧更新器。</p><div class="row"><MciButton variant="secondary" @click="watchOpen = true; watchEnabled = false; watchConfirm = ''">暂停旧自动更新</MciButton><MciButton variant="ghost" @click="watchOpen = true; watchEnabled = true; watchConfirm = ''">恢复旧自动更新</MciButton></div></MciCard>
          </template>
          <template v-if="tab === 'platform'">
            <MciCard><h2>吾码平台连接</h2><p class="muted">登录后，将必要运维事件同步到平台“系统日志/监控”。平台不可用时，日志保留在运维中心等待补投。</p><dl><dt>平台 API</dt><dd>{{ snapshot.platform.apiBase || '尚未配置' }}</dd><dt>应用标识</dt><dd>{{ snapshot.platform.osClient || '尚未配置' }}</dd><dt>当前连接</dt><dd>{{ snapshot.platform.connected ? snapshot.platform.name : '未登录' }}</dd><dt>最近同步</dt><dd>{{ formatTime(snapshot.platform.lastSync) }}</dd><dt>待投递日志</dt><dd>{{ snapshot.platform.pendingEvents }}</dd></dl><p v-if="snapshot.platform.lastError" class="danger-text">{{ snapshot.platform.lastError }}</p><MciButton v-if="snapshot.platform.connected" variant="secondary" @click="act(async () => { await api('platform/disconnect', {}); await refresh(); })">断开平台连接</MciButton></MciCard>
            <MciCard class="connection-card"><h2>{{ snapshot.platform.connected ? '更换平台登录' : '登录吾码平台' }}</h2><MciButton v-if="!platformConfig" variant="secondary" :disabled="busy" @click="loadPlatform">读取平台登录设置</MciButton><form v-else class="form-stack" @submit.prevent="platformLogin"><MciFormField v-model="connection.account" label="平台账号" required /><MciFormField v-model="connection.password" label="平台密码" type="password" required /><div v-if="platformConfig.enableCaptcha" class="captcha-row"><MciFormField v-model="connection.captchaValue" label="平台验证码" required /><button type="button" aria-label="刷新平台验证码" @click="act(renewCaptcha)"><img v-if="captcha?.image" :src="captcha.image" alt="平台验证码" /><span v-else>刷新验证码</span></button></div><label v-if="platformConfig.enablePrivacyPolicy" class="check"><input v-model="connection.acceptPrivacy" type="checkbox" />我已阅读并同意{{ platformConfig.privacyPolicyName || '平台隐私协议' }}（请在平台登录页查看协议）</label><button class="primary submit" type="submit" :disabled="busy">{{ busy ? '正在连接…' : '登录并连接平台' }}</button></form><p class="muted fine">平台登录仅用于日志同步，容器操作始终使用独立运维权限。</p></MciCard>
          </template>
          <template v-if="tab === 'logs'">
            <MciCard><h2>运维事件</h2><p class="muted">TXT 日志目录：<code>{{ snapshot.logDirectory }}</code></p><p class="muted">平台查看路径：系统引擎 → 系统日志/监控，筛选来源 Microi.Ops。</p><div class="events"><article v-for="entry in entries" :key="entry.eventId"><div class="row"><strong>{{ entry.action }}</strong><span class="muted">{{ formatTime(entry.occurredAt) }}</span></div><p>{{ entry.message }}</p><small class="muted">{{ entry.actor }} · {{ entry.success ? '成功' : '需关注' }} · {{ entry.eventId }}</small></article></div><MciDataState v-if="!entries.length" title="暂无运维事件" description="登录、策略修改、镜像更新与恢复均会在此记录。" /></MciCard>
          </template>
        </template>
      </main>
    </div>
    <MciModal v-model="planOpen" title="确认更新计划" size="lg" :close-on-mask="false"><template v-if="plan"><p>{{ available.length ? '以下服务将使用已经确认的镜像摘要。' : '当前版本一致，无需重复更新。' }}</p><article v-for="service in plan.services" :key="service.name" class="plan-service"><strong>{{ service.name }} · {{ service.changed ? '有更新' : '无需更新' }}</strong><p class="muted">{{ service.wasRunning ? '运行中的服务会短暂中断' : '当前已停止，更新后保持停止' }}</p><code>{{ service.targetImage }}</code><p class="fine">{{ service.rollbackAllowed ? '部署已声明镜像回退兼容' : '未声明数据兼容，失败时保留现场等待处理' }}</p></article><label class="check"><input v-model="confirmInterruption" type="checkbox" />我已确认目标版本、备份与本次服务中断范围</label><p class="muted fine">此计划 30 分钟内有效。正在下载不代表服务已完成更新。</p></template><template #footer><MciButton variant="secondary" :disabled="busy || !available.length" @click="submit(true)">仅下载镜像</MciButton><MciButton :disabled="busy || !confirmInterruption || !available.length" :loading="busy" @click="submit(false)">开始更新</MciButton></template></MciModal>
    <MciModal v-model="themeOpen" title="外观设置" size="sm"><MciThemePanel /></MciModal>
    <MciModal v-model="logOpen" :title="logTitle + ' · 最近日志'" size="lg"><pre class="log-content">{{ log }}</pre></MciModal>
    <MciModal :model-value="!!restoreTask" title="恢复原容器" @update:model-value="restoreTask = null"><p>确认恢复所选任务保留的原容器。恢复过程中服务可能中断。</p><label class="check"><input v-model="restoreConfirm" type="checkbox" />我已核对数据库与原镜像的兼容性，知道此操作不会恢复数据库</label><template #footer><MciButton :disabled="busy || !restoreConfirm" @click="restore">确认恢复</MciButton></template></MciModal>
    <MciModal v-model="watchOpen" :title="watchEnabled ? '恢复旧自动更新' : '暂停旧自动更新'"><p>请输入登记的容器名称：{{ snapshot?.deployment.watchtowerName }}</p><MciFormField v-model="watchConfirm" label="Watchtower 容器名" /><template #footer><MciButton :disabled="busy || watchConfirm !== snapshot?.deployment.watchtowerName" @click="watchtower">确认{{ watchEnabled ? '恢复' : '暂停' }}</MciButton></template></MciModal>
  </div>
</template>
