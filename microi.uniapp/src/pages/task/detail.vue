<template>
  <mci-page-shell class="detail-page" :style="mciTokenStyle" title="任务详情" :subtitle="task.no" @back="goBack">
    <template #right><view v-if="task.Id" class="nav-more" hover-class="nav-more--pressed" @tap="openFullForm"><text>•••</text></view></template>

    <mci-skeleton v-if="loading" type="detail" :rows="7" />
    <view v-else-if="error" class="error-state"><text class="error-state__mark">!</text><text class="error-state__title">任务加载失败</text><text class="error-state__text">{{ error }}</text><view class="error-state__button" @tap="loadAll(true)"><text>重新加载</text></view></view>

    <scroll-view v-else class="detail-scroll" scroll-y :refresher-enabled="true" :refresher-triggered="refreshing" @refresherrefresh="refresh">
      <view v-if="stale" class="offline-tip"><text>当前先展示最近缓存，联网后下拉可刷新</text></view>

      <view class="hero-band">
        <image class="hero-band__water" :src="xjyAssets.waterHero" mode="aspectFill" />
        <view class="hero-band__shade"></view>
        <view class="hero-band__main">
          <view class="hero-band__type"><text>{{ shortType }}</text></view>
          <view class="hero-band__copy"><text class="hero-band__title">{{ task.customer || '售后服务任务' }}</text><text class="hero-band__no">{{ task.no || '暂无任务编号' }}</text></view>
          <text class="hero-band__status" :class="taskStateClass(task.state)">{{ task.state || '状态未知' }}</text>
        </view>
        <view class="hero-band__meta"><view><text>{{ task.type || '-' }}</text><text>服务类型</text></view><view><text>{{ task.serviceUser || '待领取' }}</text><text>服务人员</text></view><view><text>{{ completedDeviceCount }}/{{ devices.length }}</text><text>设备完成</text></view></view>
      </view>

      <scroll-view class="timeline-scroll" scroll-x :show-scrollbar="false">
        <view class="timeline-row">
          <view v-for="(step, index) in timeline" :key="step.name" class="timeline-step" :class="{ active: step.active, current: step.current }">
            <view class="timeline-step__line"></view><view class="timeline-step__dot"><text v-if="step.active">✓</text></view><text class="timeline-step__name">{{ step.name }}</text><text class="timeline-step__time">{{ step.time || '—' }}</text>
          </view>
        </view>
      </scroll-view>

      <view class="action-band">
        <view v-for="action in quickActions" :key="action.key" class="quick-action" hover-class="quick-action--pressed" @tap="runQuickAction(action.key)">
          <view class="quick-action__icon" :class="`tone-${action.tone || 'blue'}`"><text>{{ action.icon }}</text></view><text>{{ action.label }}</text>
        </view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view class="section-heading__mark"></view><text>客户与现场</text></view>
        <view class="info-row"><text class="info-row__label">客户名称</text><text class="info-row__value">{{ task.customer || '-' }}</text></view>
        <view class="info-row"><text class="info-row__label">联系人</text><view class="info-row__value-wrap"><text class="info-row__value">{{ task.contact || '-' }}</text><view v-if="task.phone" class="inline-icon" @tap="callPhone"><text>☎</text></view></view></view>
        <view class="info-row info-row--multiline"><text class="info-row__label">服务地址</text><view class="info-row__value-wrap"><text class="info-row__value">{{ task.address || '-' }}</text><view v-if="task.address" class="inline-icon" @tap="copyAddress"><text>复</text></view></view></view>
        <view class="info-row"><text class="info-row__label">所属商家</text><text class="info-row__value">{{ task.TenantName || '-' }}</text></view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view class="section-heading__mark"></view><text>服务时间</text><text class="section-heading__hint">服务人员可更新</text></view>
        <view v-for="item in timeRows" :key="item.field" class="time-row" :class="{ editable: canEditWorkTime(item.field) }" @tap="editTime(item)">
          <view><text class="time-row__label">{{ item.label }}</text><text class="time-row__value">{{ formatTime(task[item.field]) || '暂未填写' }}</text></view><text v-if="canEditWorkTime(item.field)" class="time-row__action">修改 ›</text>
        </view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view class="section-heading__mark"></view><text>任务设备</text><text class="section-heading__hint">{{ completedDeviceCount }}/{{ devices.length }} 已完成</text></view>
        <view v-if="devicesLoading" class="device-skeleton"><view v-for="item in 3" :key="item"></view></view>
        <view v-else-if="devices.length" class="device-list">
          <view v-for="device in devices" :key="device.Id" class="device-row" hover-class="device-row--pressed" @tap="openDevice(device)">
            <image src="/static/xjy/business/shebei.png" mode="aspectFit" /><view class="device-row__copy"><text class="device-row__name">{{ device.name }}</text><text class="device-row__meta">{{ [device.model, device.code, device.position].filter(Boolean).join(' · ') || '点击处理设备任务' }}</text></view><text class="device-row__status" :class="{ complete: device.status === '已完成' }">{{ device.status }}</text><text class="device-row__arrow">›</text>
          </view>
        </view>
        <view v-else class="empty-devices"><text>当前任务尚未关联设备</text></view>
        <view v-if="canManageDevices" class="section-command" @tap="addDevices"><text>＋ 添加售后设备</text></view>
      </view>

      <view class="section-band">
        <view class="section-heading"><view class="section-heading__mark"></view><text>服务内容</text></view>
        <view class="text-block"><text class="text-block__label">任务内容</text><text class="text-block__value">{{ task.content || '暂无服务内容' }}</text></view>
        <view v-if="task.result" class="text-block"><text class="text-block__label">处理结果</text><text class="text-block__value">{{ task.result }}</text></view>
        <view v-if="task.ShangjiaYSYJ" class="text-block text-block--warning"><text class="text-block__label">商家验收意见</text><text class="text-block__value">{{ task.ShangjiaYSYJ }}</text></view>
        <view v-if="task.KehuYSYJ" class="text-block text-block--warning"><text class="text-block__label">客户验收意见</text><text class="text-block__value">{{ task.KehuYSYJ }}</text></view>
      </view>

      <view v-for="(group, index) in metadataGroups" :key="`${group.name}:${index}`" class="section-band metadata-section">
        <view class="section-heading metadata-section__heading" @tap="toggleMetadataGroup(index)">
          <view class="section-heading__mark"></view>
          <text>{{ group.name }}</text>
          <text class="section-heading__hint">{{ group.fields.length }} 项</text>
          <text class="metadata-section__arrow">{{ expandedMetadata[index] ? '⌃' : '⌄' }}</text>
        </view>
        <view v-if="expandedMetadata[index]" class="metadata-section__body">
          <view v-for="field in group.fields" :key="field.Id || field.Name" class="metadata-field">
            <text class="metadata-field__label">{{ field.Label || field.Name }}</text>
            <view class="metadata-field__value">
              <mci-native-field :model-value="task[field.Name]" :field="field" readonly table-name="Diy_ShouhouDD" />
            </view>
          </view>
        </view>
      </view>

      <view class="detail-spacer"></view>
    </scroll-view>

    <view v-if="bottomActions.length" class="bottom-bar">
      <view v-for="action in bottomActions" :key="action.key" class="bottom-button" :class="`bottom-button--${action.style || 'plain'}`" :disabled="submitting" hover-class="bottom-button--pressed" @tap="runBottomAction(action.key)"><text>{{ action.label }}</text></view>
    </view>

    <view v-if="assignVisible" class="sheet-mask" @tap="assignVisible = false"><view class="bottom-sheet" @tap.stop><view class="sheet-handle"></view><view class="sheet-heading"><text>指派服务人员</text><view @tap="assignVisible = false"><text>×</text></view></view><view class="sheet-search"><input v-model="userKeyword" placeholder="搜索姓名、帐号或部门" confirm-type="search" @confirm="loadUsers" /><text @tap="loadUsers">搜索</text></view><scroll-view class="user-list" scroll-y><mci-skeleton v-if="usersLoading" type="list" :rows="4" /><template v-else><view v-for="user in users" :key="user.Id" class="user-row" :class="{ active: selectedUser && selectedUser.Id === user.Id }" @tap="selectedUser = user"><view class="user-avatar"><text>{{ (user.Name || user.Account || '人').slice(0,1) }}</text></view><view><text class="user-name">{{ user.Name || user.Account }}</text><text class="user-meta">{{ [user.DeptName, user.RoleName, user.Phone].filter(Boolean).join(' · ') }}</text></view><text class="user-check">{{ selectedUser && selectedUser.Id === user.Id ? '✓' : '' }}</text></view></template></scroll-view><view class="sheet-actions"><view class="sheet-button sheet-button--plain" @tap="assignVisible = false"><text>取消</text></view><view class="sheet-button sheet-button--primary" @tap="confirmAssign"><text>确认指派</text></view></view></view></view>

    <view v-if="timeVisible" class="sheet-mask" @tap="timeVisible = false"><view class="bottom-sheet bottom-sheet--compact" @tap.stop><view class="sheet-handle"></view><view class="sheet-heading"><text>{{ timeEditor.label }}</text><view @tap="timeVisible = false"><text>×</text></view></view><view class="datetime-grid"><picker mode="date" :value="editorDate" @change="editorDate = $event.detail.value"><view class="picker-control"><text>{{ editorDate || '选择日期' }}</text></view></picker><picker mode="time" :value="editorTime" @change="editorTime = $event.detail.value"><view class="picker-control"><text>{{ editorTime || '选择时间' }}</text></view></picker></view><view class="sheet-actions"><view class="sheet-button sheet-button--plain" @tap="timeVisible = false"><text>取消</text></view><view class="sheet-button sheet-button--primary" @tap="saveTime"><text>保存时间</text></view></view></view></view>

    <view v-if="rejectVisible" class="sheet-mask" @tap="rejectVisible = false"><view class="bottom-sheet bottom-sheet--compact" @tap.stop><view class="sheet-handle"></view><view class="sheet-heading"><text>{{ rejectMode === 'merchant' ? '商家验收不通过' : '客户验收不通过' }}</text><view @tap="rejectVisible = false"><text>×</text></view></view><textarea v-model="rejectReason" class="reason-textarea" maxlength="500" placeholder="请填写具体问题和返工要求" /><view class="sheet-actions"><view class="sheet-button sheet-button--plain" @tap="rejectVisible = false"><text>取消</text></view><view class="sheet-button sheet-button--danger" @tap="submitReject"><text>确认退回</text></view></view></view></view>

    <view v-if="evaluateVisible" class="sheet-mask" @tap="evaluateVisible = false"><view class="bottom-sheet" @tap.stop><view class="sheet-handle"></view><view class="sheet-heading"><text>服务评价</text><view @tap="evaluateVisible = false"><text>×</text></view></view><view v-for="item in ratingFields" :key="item.field" class="rating-row"><text>{{ item.label }}</text><view><text v-for="star in 5" :key="star" class="rating-star" :class="{ active: evaluation[item.field] >= star }" @tap="evaluation[item.field] = star">★</text></view></view><view class="evaluation-tags"><view v-for="tag in evaluationTags" :key="tag" :class="{ active: evaluation.tags.includes(tag) }" @tap="toggleEvaluationTag(tag)">{{ tag }}</view></view><textarea v-model="evaluation.content" class="reason-textarea" maxlength="500" placeholder="说说本次服务体验（选填）" /><view class="sheet-actions"><view class="sheet-button sheet-button--plain" @tap="evaluateVisible = false"><text>取消</text></view><view class="sheet-button sheet-button--primary" @tap="submitEvaluation"><text>提交评价</text></view></view></view></view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getUser } from '@/utils/request.js'
import { callApiEngine, formatDateTime, openForm } from '@/platform/business-runtime.js'
import { loadNativeFormDefinition } from '@/platform/native-form.js'
import {
  hasTaskPermission,
  loadServiceUsers,
  loadTask,
  loadTaskDevices,
  runTaskAction,
  taskStateClass,
  updateTask
} from '@/utils/xjy-task.js'

const TIMELINE_STATES = ['待接单', '待服务', '待商家验收', '待客户验收', '待评价', '已结束']
const CUSTOM_DETAIL_FIELDS = new Set([
  'ShouhouFWBH', 'DingdanBH', 'KehuMC', 'KehuID', 'KehuLXRR', 'LianxiR', 'KehuDH', 'LianxiDH',
  'Chengshi', 'Dizhi', 'TenantName', 'Leixing', 'ShouhouLX', 'Zhuangtai', 'ShouhouRY', 'ShouhouRYID',
  'YujiSHSJ', 'YuyueSJ', 'JiedanSJ', 'ShangmenSJ', 'FinishTime', 'Neirong', 'Jieguo',
  'ShangjiaYSSJ', 'KehuYSSJ', 'ShangjiaYSYJ', 'KehuYSYJ', 'Pingjia', 'ZhuipingNR',
  'CreateTime', 'UpdateTime', 'CreateUser', 'OsClient'
])

export default {
  mixins: [themeMixin],
  data() {
    return {
      id: '', task: {}, devices: [], currentUser: {}, loading: true, devicesLoading: true, refreshing: false,
      stale: false, error: '', submitting: false, assignVisible: false, usersLoading: false, users: [],
      metadataDefinition: null, expandedMetadata: {},
      selectedUser: null, userKeyword: '', timeVisible: false, timeEditor: {}, editorDate: '', editorTime: '',
      rejectVisible: false, rejectMode: 'merchant', rejectReason: '', evaluateVisible: false,
      evaluation: { rate: 5, deviceRate: 5, staffRate: 5, tags: [], content: '' },
      evaluationTags: ['响应及时', '技术专业', '服务热情', '现场整洁', '问题解决'],
      ratingFields: [{ field: 'rate', label: '总体评价' }, { field: 'deviceRate', label: '设备评价' }, { field: 'staffRate', label: '人员评价' }]
    }
  },
  computed: {
    shortType() { return String(this.task.type || '服务').slice(0, 2) },
    isOwner() { return !!(this.currentUser.Id && String(this.currentUser.Id) === String(this.task.serviceUserId)) },
    isAdmin() { return Number(this.currentUser.Level || 0) >= 999 || /管理员/.test(this.currentUser.RoleName || '') },
    completedDeviceCount() { return this.devices.filter((item) => item.status === '已完成').length },
    canManageDevices() { return this.task.state === '待服务' && (this.isOwner || this.isAdmin) },
    metadataGroups() {
      const groups = this.metadataDefinition && this.metadataDefinition.groups || []
      return groups.map((group) => ({
        name: group.name || '更多业务信息',
        fields: (group.fields || []).filter((field) => !CUSTOM_DETAIL_FIELDS.has(field.Name))
      })).filter((group) => group.fields.length)
    },
    timeline() {
      const currentIndex = Math.max(0, TIMELINE_STATES.indexOf(this.task.state))
      const times = [this.task.CreateTime, this.task.acceptedTime, this.task.finishTime, this.task.ShangjiaYSSJ, this.task.KehuYSSJ, this.task.UpdateTime]
      return TIMELINE_STATES.map((name, index) => ({ name, active: index <= currentIndex, current: index === currentIndex, time: formatDateTime(times[index], true) }))
    },
    timeRows() {
      return [
        { field: 'planTime', source: 'YujiSHSJ', label: '计划服务时间' },
        { field: 'appointmentTime', source: 'YuyueSJ', label: '预约时间' },
        { field: 'acceptedTime', source: 'JiedanSJ', label: '接单时间' },
        { field: 'visitTime', source: 'ShangmenSJ', label: '上门时间' },
        { field: 'finishTime', source: 'FinishTime', label: '完成时间' }
      ]
    },
    quickActions() {
      const result = [
        { key: 'customer', label: '客户详情', icon: '客', tone: 'blue' },
        { key: 'phone', label: '联系客户', icon: '☎', tone: 'green' },
        { key: 'checkin', label: '现场打卡', icon: '⌖', tone: 'orange' },
        { key: 'devices', label: '设备处理', icon: '器', tone: 'violet' }
      ]
      if (!this.task.phone) result[1] = { key: 'form', label: '完整信息', icon: '单', tone: 'green' }
      return result
    },
    bottomActions() {
      const state = this.task.state
      if (state === '待接单') {
        const actions = []
        if (hasTaskPermission('指派', this.currentUser) || this.isAdmin) actions.push({ key: 'assign', label: this.task.serviceUserId ? '改派' : '指派', style: 'plain' })
        if ((!this.task.serviceUserId || this.isOwner) && (hasTaskPermission('接单', this.currentUser) || this.isAdmin)) actions.push({ key: 'claim', label: '立即接单', style: 'primary' })
        return actions
      }
      if (state === '待服务' && (this.isOwner || this.isAdmin)) return [{ key: 'cancel', label: '撤销接单', style: 'plain' }, { key: 'finish', label: '去完成服务', style: 'primary' }]
      if (state === '待商家验收' && (hasTaskPermission('验收', this.currentUser) || this.isAdmin)) return [{ key: 'merchantReject', label: '退回处理', style: 'danger-plain' }, { key: 'merchantPass', label: '验收通过', style: 'success' }]
      if (state === '待客户验收') return [{ key: 'customerReject', label: '退回处理', style: 'danger-plain' }, { key: 'customerPass', label: '确认验收', style: 'success' }]
      if (state === '待评价') return [{ key: 'evaluate', label: '评价本次服务', style: 'primary' }]
      if (/已结束|已完成/.test(String(state)) && this.task.Pingjia && !this.task.ZhuipingNR) return [{ key: 'followUp', label: '追加评价', style: 'plain' }]
      return []
    }
  },
  onLoad(options) {
    this.id = decodeURIComponent(options.id || '')
    this.currentUser = getUser() || {}
    this.loadAll()
  },
  onShow() { if (!this.loading && this.id) this.loadAll(true, false) },
  methods: {
    taskStateClass,
    async loadAll(refresh = false, showLoading = true) {
      if (!this.id) { this.error = '缺少任务编号'; this.loading = false; return }
      if (showLoading) this.loading = true
      this.devicesLoading = true
      this.error = ''
      try {
        const definitionRequest = loadNativeFormDefinition('Diy_ShouhouDD', refresh).catch(() => this.metadataDefinition)
        const [taskResult, devices, definition] = await Promise.all([
          loadTask(this.id, refresh),
          loadTaskDevices(this.id, refresh),
          definitionRequest
        ])
        this.task = taskResult.task
        this.devices = devices
        this.metadataDefinition = definition || null
        this.expandedMetadata = {}
        this.stale = taskResult.stale
      } catch (error) {
        this.error = error.message || '任务加载失败'
      } finally {
        this.loading = false; this.devicesLoading = false; this.refreshing = false
      }
    },
    async refresh() { this.refreshing = true; try { await this.loadAll(true, false) } finally { this.refreshing = false } },
    formatTime: formatDateTime,
    toggleMetadataGroup(index) {
      this.expandedMetadata[index] = !this.expandedMetadata[index]
    },
    canEditWorkTime(field) { return ['planTime', 'appointmentTime', 'visitTime'].includes(field) && this.task.state === '待服务' && (this.isOwner || this.isAdmin) },
    editTime(item) {
      if (!this.canEditWorkTime(item.field)) return
      const value = String(this.task[item.field] || '').replace('T', ' ')
      const now = new Date(); const pad = (n) => String(n).padStart(2, '0')
      this.editorDate = value.slice(0, 10) || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
      this.editorTime = value.length >= 16 ? value.slice(11, 16) : `${pad(now.getHours())}:${pad(now.getMinutes())}`
      this.timeEditor = item
      this.timeVisible = true
    },
    async saveTime() {
      if (!this.editorDate || !this.editorTime) { uni.showToast({ title: '请选择完整时间', icon: 'none' }); return }
      await this.withSubmit(async () => {
        await updateTask(this.id, { [this.timeEditor.source]: `${this.editorDate} ${this.editorTime}:00` })
        this.timeVisible = false
        await this.loadAll(true, false)
        uni.showToast({ title: '时间已更新', icon: 'success' })
      })
    },
    runQuickAction(key) {
      if (key === 'customer' && this.task.KehuID) return uni.navigateTo({ url: `/pages/business/detail?key=customers&id=${encodeURIComponent(this.task.KehuID)}` })
      if (key === 'phone') return this.callPhone()
      if (key === 'form') return this.openFullForm()
      if (key === 'checkin') {
        if (!this.isOwner && !this.isAdmin) return uni.showToast({ title: '仅当前服务人员可打卡', icon: 'none' })
        const query = `customer=${encodeURIComponent(this.task.customer || '')}&customerId=${encodeURIComponent(this.task.KehuID || '')}&taskId=${encodeURIComponent(this.id)}`
        return uni.navigateTo({ url: `/pages/native/checkin?${query}` })
      }
      if (key === 'devices') {
        if (this.devices.length) return this.openDevice(this.devices[0])
        if (this.canManageDevices) return this.addDevices()
        return uni.showToast({ title: '当前任务暂无设备', icon: 'none' })
      }
    },
    async runBottomAction(key) {
      if (this.submitting) return
      if (key === 'assign') { this.assignVisible = true; this.loadUsers(); return }
      if (key === 'finish') {
        if (!this.task.visitTime) { uni.showToast({ title: '请先填写上门时间或完成现场打卡', icon: 'none' }); return }
        const pending = this.devices.filter((item) => item.status !== '已完成')
        if (pending.length) { uni.showModal({ title: '设备尚未处理完', content: `还有 ${pending.length} 台设备未完成，请先逐台处理。`, showCancel: false }); return }
        return this.openFeedback()
      }
      if (key === 'merchantReject' || key === 'customerReject') { this.rejectMode = key.startsWith('merchant') ? 'merchant' : 'customer'; this.rejectReason = ''; this.rejectVisible = true; return }
      if (key === 'evaluate') { this.evaluateVisible = true; return }
      if (key === 'followUp') { uni.navigateTo({ url: `/pages/native/task-follow-up?id=${encodeURIComponent(this.id)}` }); return }
      const confirms = { claim: '确认领取当前任务吗？', cancel: '确认撤销接单并将任务退回待接单吗？', merchantPass: '确认服务结果符合要求并通过商家验收吗？', customerPass: '确认服务结果符合要求并通过客户验收吗？' }
      if (!(await this.confirm(confirms[key] || '确认执行该操作吗？'))) return
      await this.withSubmit(async () => { await runTaskAction(key, this.task); await this.loadAll(true, false); uni.showToast({ title: '操作成功', icon: 'success' }) })
    },
    async loadUsers() {
      this.usersLoading = true
      try { this.users = await loadServiceUsers(this.userKeyword.trim()) } catch (error) { uni.showToast({ title: error.message || '人员加载失败', icon: 'none' }) } finally { this.usersLoading = false }
    },
    async confirmAssign() {
      if (!this.selectedUser) { uni.showToast({ title: '请选择服务人员', icon: 'none' }); return }
      await this.withSubmit(async () => {
        await runTaskAction('assign', this.task, { ShouhouRY: this.selectedUser.Name || this.selectedUser.Account, ShouhouRYID: this.selectedUser.Id, ShouhouRYDH: this.selectedUser.Phone || '' })
        this.assignVisible = false
        await this.loadAll(true, false)
        uni.showToast({ title: '指派成功', icon: 'success' })
      })
    },
    async submitReject() {
      if (!this.rejectReason.trim()) { uni.showToast({ title: '请填写不通过原因', icon: 'none' }); return }
      const action = this.rejectMode === 'merchant' ? 'merchantReject' : 'customerReject'
      await this.withSubmit(async () => { await runTaskAction(action, this.task, { reason: this.rejectReason.trim() }); this.rejectVisible = false; await this.loadAll(true, false); uni.showToast({ title: '已退回处理', icon: 'success' }) })
    },
    toggleEvaluationTag(tag) { const index = this.evaluation.tags.indexOf(tag); if (index >= 0) this.evaluation.tags.splice(index, 1); else this.evaluation.tags.push(tag) },
    async submitEvaluation() {
      if (!this.evaluation.rate || !this.evaluation.deviceRate || !this.evaluation.staffRate) { uni.showToast({ title: '请完成三项星级评价', icon: 'none' }); return }
      await this.withSubmit(async () => {
        const result = await callApiEngine('shouhoudd_pingjia', {
          Id: this.id, Pingjia: this.evaluation.rate, ShebeiPJ: this.evaluation.deviceRate, RenyuanPJ: this.evaluation.staffRate,
          PingjiaNR: this.evaluation.content.trim(), PingjiaBQ: JSON.stringify(this.evaluation.tags)
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '评价提交失败')
        this.evaluateVisible = false
        await this.loadAll(true, false)
        uni.showToast({ title: '感谢您的评价', icon: 'success' })
      })
    },
    openDevice(device) { uni.navigateTo({ url: `/pages/task/device?id=${encodeURIComponent(device.Id)}&taskId=${encodeURIComponent(this.id)}&taskType=${encodeURIComponent(this.task.type || '')}` }) },
    addDevices() { uni.navigateTo({ url: `/pages/task/add-devices?taskId=${encodeURIComponent(this.id)}&customerId=${encodeURIComponent(this.task.KehuID || '')}` }) },
    openFeedback() {
      const query = [`taskId=${encodeURIComponent(this.id)}`, `taskNo=${encodeURIComponent(this.task.no || '')}`, `customer=${encodeURIComponent(this.task.customer || '')}`, `taskType=${encodeURIComponent(this.task.type || '')}`].join('&')
      uni.navigateTo({ url: `/pages/native/task-feedback?${query}` })
    },
    openFullForm() { openForm({ table: 'Diy_ShouhouDD', rowId: this.id, mode: 'Edit', title: '完整售后任务', menuAliases: ['售后任务', '售后订单'] }) },
    callPhone() { if (this.task.phone) uni.makePhoneCall({ phoneNumber: String(this.task.phone) }); else uni.showToast({ title: '未维护联系电话', icon: 'none' }) },
    copyAddress() { uni.setClipboardData({ data: this.task.address || '', success: () => uni.showToast({ title: '地址已复制', icon: 'success' }) }) },
    confirm(content) { return new Promise((resolve) => uni.showModal({ title: '请确认', content, success: (result) => resolve(!!result.confirm), fail: () => resolve(false) })) },
    async withSubmit(handler) {
      this.submitting = true; uni.showLoading({ title: '正在提交', mask: true })
      try { await handler() } catch (error) { uni.showToast({ title: error.message || error.Msg || '操作失败', icon: 'none' }) } finally { uni.hideLoading(); this.submitting = false }
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style scoped>
.detail-page { height: 100vh; overflow: hidden; }
.nav-more { width: 70rpx; height: 62rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #315563; font-size: 26rpx; letter-spacing: 2rpx; transition: transform .18s ease, background .18s ease; }
.nav-more--pressed { transform: scale(.94); background: #edf5f8; }
.detail-scroll { height: calc(100vh - var(--mci-safe-top) - 92rpx - 112rpx - var(--mci-safe-bottom)); }
.offline-tip { padding: 12rpx 22rpx; color: #7c5b1c; background: #fff8e6; font-size: 21rpx; }
.hero-band { position: relative; overflow: hidden; min-height: 276rpx; padding: 30rpx 26rpx 26rpx; color: #fff; background: #063b5c; box-sizing: border-box; }
.hero-band__water, .hero-band__shade { position: absolute; inset: 0; width: 100%; height: 100%; }
.hero-band__water { opacity: .48; }
.hero-band__shade { background: linear-gradient(105deg,rgba(4,48,70,.97),rgba(4,91,118,.78)); }
.hero-band__main { position: relative; z-index: 1; display: flex; align-items: center; gap: 16rpx; }
.hero-band__type { flex: none; width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,.42); border-radius: 8px; background: rgba(255,255,255,.15); font-size: 23rpx; font-weight: 750; }
.hero-band__copy { flex: 1; min-width: 0; }
.hero-band__title, .hero-band__no { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hero-band__title { font-size: 32rpx; font-weight: 750; }
.hero-band__no { margin-top: 6rpx; color: rgba(255,255,255,.68); font-size: 21rpx; }
.hero-band__status { flex: none; max-width: 170rpx; padding: 8rpx 12rpx; border-radius: 6px; background: rgba(227,152,38,.9); font-size: 20rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.hero-band__status.is-progress { background: rgba(20,141,176,.9); }.hero-band__status.is-review { background: rgba(117,86,180,.9); }.hero-band__status.is-success { background: rgba(20,118,83,.9); }.hero-band__status.is-danger { background: rgba(181,65,59,.9); }
.hero-band__meta { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); margin-top: 34rpx; }
.hero-band__meta view { min-width: 0; padding: 0 12rpx; border-right: 1px solid rgba(255,255,255,.24); text-align: center; }.hero-band__meta view:last-child { border-right: none; }
.hero-band__meta text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.hero-band__meta text:first-child { font-size: 25rpx; font-weight: 700; }.hero-band__meta text:last-child { margin-top: 6rpx; color: rgba(255,255,255,.65); font-size: 19rpx; }
.timeline-scroll { width: 100%; border-bottom: 1px solid #e5edef; background: #fff; white-space: nowrap; }
.timeline-row { display: inline-flex; padding: 22rpx 25rpx 18rpx; }
.timeline-step { position: relative; width: 144rpx; text-align: center; }
.timeline-step__line { position: absolute; top: 15rpx; left: 0; width: 100%; height: 3rpx; background: #dfe8eb; }.timeline-step:first-child .timeline-step__line { left: 50%; width: 50%; }.timeline-step:last-child .timeline-step__line { width: 50%; }
.timeline-step__dot { position: relative; z-index: 1; width: 31rpx; height: 31rpx; margin: 0 auto; border: 4rpx solid #fff; border-radius: 50%; color: #fff; background: #c9d5d9; box-shadow: 0 0 0 2rpx #c9d5d9; font-size: 16rpx; line-height: 31rpx; box-sizing: border-box; }
.timeline-step.active .timeline-step__line, .timeline-step.active .timeline-step__dot { background: #087da8; }.timeline-step.active .timeline-step__dot { box-shadow: 0 0 0 2rpx #087da8; }.timeline-step.current .timeline-step__dot { box-shadow: 0 0 0 5rpx rgba(8,125,168,.18); }
.timeline-step__name, .timeline-step__time { display: block; }.timeline-step__name { margin-top: 10rpx; color: #66808a; font-size: 20rpx; }.timeline-step.active .timeline-step__name { color: #24505f; font-weight: 650; }.timeline-step__time { margin-top: 4rpx; color: #9aaab0; font-size: 17rpx; }
.action-band { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); padding: 18rpx 12rpx; background: #fff; }
.quick-action { min-width: 0; min-height: 112rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; transition: background .16s ease; }.quick-action--pressed { background: #edf5f8; }
.quick-action__icon { width: 52rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #087da8; background: #e8f6fa; font-size: 23rpx; font-weight: 700; }.quick-action__icon.tone-green { color: #167658; background: #e8f7f1; }.quick-action__icon.tone-orange { color: #bd6813; background: #fff2df; }.quick-action__icon.tone-violet { color: #6d4ba5; background: #f1ecfa; }
.quick-action > text { max-width: 100%; margin-top: 9rpx; overflow: hidden; color: #45636e; text-overflow: ellipsis; white-space: nowrap; font-size: 21rpx; }
.section-band { margin-top: 14rpx; padding: 0 26rpx; background: #fff; }
.section-heading { min-height: 82rpx; display: flex; align-items: center; border-bottom: 1px solid #edf2f4; color: #244954; font-size: 27rpx; font-weight: 700; }.section-heading__mark { width: 7rpx; height: 28rpx; margin-right: 13rpx; border-radius: 3rpx; background: #e54625; }.section-heading__hint { flex: 1; color: #8a9ca3; font-size: 20rpx; font-weight: 400; text-align: right; }
.metadata-section__heading { cursor: pointer; }
.metadata-section__arrow { width: 38rpx; margin-left: 10rpx; color: #82969d; font-size: 24rpx; text-align: right; }
.metadata-section__body { padding-bottom: 4rpx; }
.metadata-field { min-height: 84rpx; display: grid; grid-template-columns: 190rpx minmax(0, 1fr); gap: 18rpx; align-items: start; padding: 19rpx 0; border-bottom: 1px solid #edf2f4; box-sizing: border-box; }
.metadata-field:last-child { border-bottom: 0; }
.metadata-field__label { color: #82949b; font-size: 23rpx; line-height: 1.55; }
.metadata-field__value { min-width: 0; color: #294750; font-size: 24rpx; line-height: 1.55; overflow-wrap: anywhere; }
.metadata-field__value :deep(.native-control--readonly) { min-height: auto; padding: 0; border: 0; background: transparent; }
.info-row { min-height: 75rpx; display: grid; grid-template-columns: 160rpx minmax(0,1fr); gap: 16rpx; align-items: center; border-bottom: 1px solid #f0f4f5; box-sizing: border-box; }.info-row:last-child { border-bottom: none; }.info-row--multiline { padding: 17rpx 0; align-items: start; }
.info-row__label { color: #71868f; font-size: 23rpx; }.info-row__value-wrap { display: flex; align-items: center; justify-content: flex-end; min-width: 0; gap: 10rpx; }.info-row__value { color: #294b57; font-size: 24rpx; line-height: 1.55; text-align: right; word-break: break-all; }.inline-icon { flex: none; width: 49rpx; height: 49rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #087da8; background: #eaf6f9; font-size: 20rpx; }
.time-row { min-height: 82rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #f0f4f5; }.time-row:last-child { border-bottom: none; }.time-row__label, .time-row__value { display: block; }.time-row__label { color: #71868f; font-size: 21rpx; }.time-row__value { margin-top: 5rpx; color: #294b57; font-size: 24rpx; }.time-row__action { color: #087da8; font-size: 21rpx; }.time-row.editable { cursor: pointer; }
.device-skeleton { padding: 10rpx 0; }.device-skeleton view { height: 94rpx; margin: 8rpx 0; background: #e4edef; animation: pulse 1.2s ease-in-out infinite; }
.device-row { min-height: 100rpx; display: grid; grid-template-columns: 50rpx minmax(0,1fr) auto 24rpx; gap: 12rpx; align-items: center; border-bottom: 1px solid #edf2f4; transition: background .16s ease; }.device-row--pressed { background: #f0f7f9; }.device-row image { width: 43rpx; height: 43rpx; }.device-row__copy { min-width: 0; }.device-row__name, .device-row__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.device-row__name { color: #294b57; font-size: 24rpx; font-weight: 650; }.device-row__meta { margin-top: 6rpx; color: #82959d; font-size: 20rpx; }.device-row__status { padding: 6rpx 10rpx; border-radius: 5px; color: #b36b19; background: #fff1df; font-size: 19rpx; }.device-row__status.complete { color: #147351; background: #e9f7f1; }.device-row__arrow { color: #9babb1; font-size: 31rpx; }.empty-devices { padding: 28rpx 0; color: #84979e; font-size: 23rpx; text-align: center; }.section-command { height: 74rpx; color: #087da8; font-size: 23rpx; line-height: 74rpx; text-align: center; }
.text-block { padding: 19rpx 0; border-bottom: 1px solid #f0f4f5; }.text-block:last-child { border-bottom: none; }.text-block__label, .text-block__value { display: block; }.text-block__label { color: #71868f; font-size: 21rpx; }.text-block__value { margin-top: 8rpx; color: #294b57; font-size: 24rpx; line-height: 1.68; white-space: pre-wrap; word-break: break-all; }.text-block--warning { margin: 13rpx 0; padding: 17rpx; border-left: 3px solid #cf6d2d; background: #fff6ed; }.detail-spacer { height: 35rpx; }
.bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 30; display: flex; gap: 13rpx; padding: 15rpx 21rpx calc(15rpx + var(--mci-safe-bottom)); border-top: 1px solid #e3ebee; background: rgba(255,255,255,.97); }.bottom-button { flex: 1; min-width: 0; height: 82rpx; border-radius: 7px; color: #486670; background: #edf3f5; font-size: 25rpx; font-weight: 700; line-height: 82rpx; text-align: center; transition: transform .16s ease; }.bottom-button--primary { color: #fff; background: #e54625; }.bottom-button--success { color: #fff; background: #137657; }.bottom-button--danger-plain { color: #b4433e; background: #fff0ef; }.bottom-button--pressed { transform: scale(.98); }
.error-state { min-height: 70vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 50rpx; text-align: center; }.error-state__mark { width: 78rpx; height: 78rpx; border-radius: 50%; color: #fff; background: #c34c47; font-size: 42rpx; line-height: 78rpx; }.error-state__title { margin-top: 20rpx; font-size: 29rpx; font-weight: 700; }.error-state__text { margin-top: 9rpx; color: #788c94; font-size: 23rpx; }.error-state__button { margin-top: 26rpx; padding: 16rpx 34rpx; border-radius: 6px; color: #fff; background: #087da8; font-size: 23rpx; }
.sheet-mask { position: fixed; inset: 0; z-index: 90; display: flex; align-items: flex-end; background: rgba(11,32,40,.5); }.bottom-sheet { width: 100%; max-height: 82vh; padding: 12rpx 25rpx calc(22rpx + var(--mci-safe-bottom)); border-radius: 8px 8px 0 0; background: #fff; box-sizing: border-box; animation: sheetUp .22s ease-out both; }.bottom-sheet--compact { max-height: 64vh; }.sheet-handle { width: 70rpx; height: 8rpx; margin: 0 auto 18rpx; border-radius: 4rpx; background: #d5e0e4; }.sheet-heading { min-height: 64rpx; display: flex; align-items: center; justify-content: space-between; color: #17333e; font-size: 30rpx; font-weight: 750; }.sheet-heading > view { width: 54rpx; height: 54rpx; border-radius: 50%; color: #698089; background: #f0f5f7; font-size: 34rpx; line-height: 54rpx; text-align: center; }.sheet-search { display: grid; grid-template-columns: minmax(0,1fr) 90rpx; align-items: center; height: 72rpx; margin: 15rpx 0; padding-left: 20rpx; border: 1px solid #dce7eb; border-radius: 7px; background: #f6f9fa; }.sheet-search input { width: 100%; font-size: 23rpx; }.sheet-search > text { color: #087da8; font-size: 22rpx; text-align: center; }.user-list { max-height: 48vh; }.user-row { min-height: 88rpx; display: grid; grid-template-columns: 54rpx minmax(0,1fr) 42rpx; gap: 13rpx; align-items: center; padding: 6rpx 10rpx; border-bottom: 1px solid #edf2f4; box-sizing: border-box; }.user-row.active { background: #edf8fb; }.user-avatar { width: 50rpx; height: 50rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: #087da8; font-size: 22rpx; }.user-name, .user-meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.user-name { color: #294b57; font-size: 24rpx; font-weight: 650; }.user-meta { margin-top: 4rpx; color: #84969d; font-size: 19rpx; }.user-check { color: #087da8; font-size: 27rpx; text-align: center; }.sheet-actions { display: grid; grid-template-columns: 1fr 1.7fr; gap: 13rpx; margin-top: 22rpx; }.sheet-button { height: 80rpx; border-radius: 7px; font-size: 25rpx; font-weight: 700; line-height: 80rpx; text-align: center; }.sheet-button--plain { color: #496671; background: #edf3f5; }.sheet-button--primary { color: #fff; background: #e54625; }.sheet-button--danger { color: #fff; background: #b4433e; }.datetime-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin: 24rpx 0; }.picker-control { height: 78rpx; padding: 0 18rpx; border: 1px solid #dce7eb; border-radius: 7px; color: #294b57; background: #f6f9fa; font-size: 24rpx; line-height: 78rpx; text-align: center; }.reason-textarea { width: 100%; height: 190rpx; margin-top: 20rpx; padding: 18rpx; border: 1px solid #dce7eb; border-radius: 7px; background: #f6f9fa; box-sizing: border-box; font-size: 24rpx; line-height: 1.6; }.rating-row { min-height: 72rpx; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #edf2f4; color: #405f69; font-size: 23rpx; }.rating-star { margin-left: 10rpx; color: #d7e0e3; font-size: 37rpx; }.rating-star.active { color: #efac28; }.evaluation-tags { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }.evaluation-tags view { padding: 10rpx 15rpx; border: 1px solid #dce7eb; border-radius: 6px; color: #607982; background: #f7fafb; font-size: 21rpx; }.evaluation-tags view.active { border-color: #087da8; color: #087da8; background: #edf8fb; }
@keyframes pulse { 0%,100%{opacity:.5}50%{opacity:1} } @keyframes sheetUp { from{transform:translateY(100%);opacity:.7}to{transform:translateY(0);opacity:1} }
@media (prefers-reduced-motion: reduce) { .bottom-sheet, .bottom-button, .quick-action { animation: none; transition: none; } }
</style>
