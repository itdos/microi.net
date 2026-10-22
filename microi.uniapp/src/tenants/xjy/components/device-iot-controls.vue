<template>
  <view class="device-controls">
    <view class="device-controls__heading">
      <view><text class="device-controls__title">远程控制</text><text class="device-controls__subtitle">按当前设备已确认能力显示</text></view>
      <text class="device-controls__badge" :class="{ 'device-controls__badge--ready': state.descriptor?.Ready }">{{ availability }}</text>
    </view>
    <view class="device-controls__tools">
      <button class="device-controls__tool" :disabled="state.busy || state.loading" @tap="refresh"><view class="control-icon control-icon--reset"></view>刷新快照</button>
      <button v-if="hasStatus" class="device-controls__tool" :disabled="state.busy || state.loading" @tap="queryStatus"><view class="control-icon control-icon--status"></view>控制状态 / 最近指令</button>
    </view>
    <view v-if="state.loading && !state.descriptor" class="device-controls__skeleton"><view></view><view></view></view>
    <view v-for="group in groups" :key="group.name" class="device-controls__group">
      <text class="device-controls__group-title">{{ group.name }}</text>
      <view class="device-controls__grid">
        <button v-for="action in group.actions" :key="action.key" class="device-control-action"
          :class="[`device-control-action--${action.tone}`, { 'device-control-action--wide': group.actions.length === 1 }]"
          :disabled="disabled(action)" hover-class="device-control-action--pressed" @tap="execute(action)">
          <view class="control-icon" :class="`control-icon--${action.icon}`"></view><text>{{ action.label }}</text>
        </button>
      </view>
      <text v-if="group.name === '维护操作' && state.descriptor?.FilterReset?.Ready === false" class="device-controls__subtitle">{{ state.descriptor.FilterReset.Message }}</text>
    </view>
    <button v-if="extraCount" class="device-controls__more" :aria-expanded="expanded" @tap="expanded = !expanded">{{ expanded ? '收起更多控制' : `更多控制（${extraCount}）` }}<text>{{ expanded ? '⌃' : '⌄' }}</text></button>
    <view class="device-controls__feedback" :class="{ 'device-controls__feedback--error': state.error, 'device-controls__feedback--success': state.command?.Success === true }" aria-live="polite">
      <text class="device-controls__feedback-title">{{ feedbackTitle }}</text>
      <text>{{ feedback }}</text>
      <text v-if="state.command?.CommandId || state.uncertainId" class="device-controls__command">指令编号：{{ state.uncertainId || state.command.CommandId }}</text>
      <text v-if="state.command?.Verification" class="device-controls__verification">{{ state.command.Verification.Message }}</text>
    </view>
  </view>
</template>

<script>
import { V8 } from '@/utils/request.js'
import { createDeviceControlSession, deviceControlActions, deviceControlFields } from '../device-iot-control.mjs'

const modal = options => new Promise(resolve => uni.showModal({ ...options, success: value => resolve(value.confirm), fail: () => resolve(false) }))

export default {
  name: 'XjyDeviceIoTControls',
  props: {
    definition: { type: Object, default: () => ({}) }, user: { type: Object, default: () => ({}) },
    parentId: { type: String, required: true }, menuId: { type: String, default: '' }, tabKey: { type: String, default: '' }
  },
  emits: ['refresh'],
  data() { return { state: {}, session: null, expanded: false } },
  computed: {
    fields() { return deviceControlFields(this.definition, this.user, this.tabKey) },
    authorized() { return Boolean(this.user.Id && Number(this.user.Level || 0) >= 9999 && this.user._AccessKeySession !== true) },
    actions() { return deviceControlActions(this.fields, this.state.descriptor) },
    hasStatus() { return this.fields.some(field => String(field.Name).toLowerCase() === 'iotcontrolstatus') },
    extraCount() { return this.actions.length > 4 ? this.actions.filter(action => !action.primary).length : 0 },
    groups() {
      const actions = this.extraCount && !this.expanded ? this.actions.filter(action => action.primary) : this.actions
      return ['电源控制', '温度控制', '维护操作'].map(name => ({ name, actions: actions.filter(action => action.group === name) })).filter(group => group.actions.length)
    },
    availability() { return this.state.loading ? '读取中' : this.state.descriptor?.Ready ? '可控制' : '暂不可控' },
    feedbackTitle() { return this.state.busy ? '正在处理，请勿重复操作' : this.state.command?.StateLabel || '远程控制反馈' },
    feedback() {
      if (!this.authorized) return '远程控制仅向当前平台管理员开放。'
      return this.state.error || this.state.message || this.state.descriptor?.Message || this.state.command?.Message
        || this.state.descriptor?.Capabilities?.Message || '正在读取设备控制能力与最近指令…'
    }
  },
  watch: {
    parentId() { this.start() },
    authorized() { this.start() }
  },
  mounted() { this.start() },
  beforeUnmount() { this.session?.dispose() },
  methods: {
    start() {
      this.session?.dispose()
      this.state = {}
      this.expanded = false
      if (!this.authorized || !this.parentId) return
      this.session = createDeviceControlSession({
        parentId: this.parentId, menuId: this.menuId,
        call: (key, params) => V8.ApiEngine.Run(key, params),
        canOperate: operation => this.authorized && this.actions.some(action => action.key === operation && !action.readonly),
        changed: state => { this.state = state }, refreshSnapshot: () => this.$emit('refresh')
      })
      this.session.inspect()
    },
    disabled(action) {
      return !this.authorized || action.readonly || this.state.busy || this.state.loading || Boolean(this.state.uncertainId)
        || !this.state.descriptor?.Ready || (action.key === 'filter-reset' && !this.state.descriptor?.FilterReset?.Ready)
    },
    async refresh() { if (this.authorized) await this.session?.status(); this.$emit('refresh') },
    async queryStatus() { if (this.authorized) await this.session?.status() },
    async execute(action) {
      if (this.disabled(action)) return
      await this.session.execute(action.key, {
        selectFilter: filters => new Promise(resolve => {
          if (!filters.length) { resolve(null); return }
          // 不默认选择关键耗材；只允许服务端返回的级别与参数依据，客户端不编辑提醒值。
          uni.showActionSheet({ itemList: filters.map(filter => `第${filter.Level}级滤芯（累计 ${filter.Used} / 提醒 ${filter.Threshold}）`),
            success: result => resolve(filters[result.tapIndex] || null), fail: () => resolve(null) })
        }),
        confirm: reset => modal({ title: reset ? `第${reset.Level}级滤芯复位` : action.label,
          content: reset ? `确认将第${reset.Level}级滤芯累计值清零？将保持当前提示开关及提醒设定值 ${reset.Threshold}。结果以设备回执和后续耗材上报为准。`
            : `确认对当前设备执行“${action.label}”？执行结果以设备回执为准。`,
          confirmText: '确认执行', confirmColor: action.tone === 'danger' ? '#b6372c' : '#087da8' })
      })
    }
  }
}
</script>

<style scoped>
.device-controls { margin: 16rpx 22rpx; padding: 24rpx; border: 1rpx solid var(--mci-border, #e2eaee); border-radius: 8px; background: var(--mci-bg-card, #fff); color: var(--mci-text, #244451); }
.device-controls__heading { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; margin-bottom: 20rpx; }
.device-controls__title,.device-controls__subtitle { display: block; }
.device-controls__title { font-size: 29rpx; font-weight: 700; }
.device-controls__subtitle { margin-top: 7rpx; color: var(--mci-text-secondary, #647c87); font-size: 21rpx; }
.device-controls__badge { flex-shrink: 0; padding: 6rpx 12rpx; border-radius: 6rpx; background: var(--mci-bg-muted, #f2f5f7); color: var(--mci-text-secondary, #647c87); font-size: 21rpx; }
.device-controls__badge--ready { background: #eaf6ee; color: #187044; }
.device-controls__tools { display: flex; flex-wrap: wrap; gap: 12rpx; }
.device-controls__tool { display: flex; align-items: center; justify-content: center; gap: 10rpx; flex: 1 1 auto; margin: 0; padding: 0 12rpx; min-height: 44px; border: 1rpx solid var(--mci-border, #dce7ec); border-radius: 6px; background: var(--mci-bg-muted, #f6f9fb); color: var(--mci-text, #315767); font-size: 22rpx; line-height: 1.4; }
.device-controls button::after { border: 0; }
.device-controls__group { margin-top: 22rpx; }
.device-controls__group-title { display: block; margin-bottom: 12rpx; color: var(--mci-text-secondary, #647c87); font-size: 22rpx; font-weight: 600; }
.device-controls__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; }
.device-control-action { display: flex; align-items: center; justify-content: center; gap: 12rpx; box-sizing: border-box; width: 100%; min-width: 0; min-height: 46px; padding: 12rpx 14rpx; margin: 0; border: 1rpx solid var(--mci-border, #dce7ec); border-radius: 6px; font-size: 25rpx; font-weight: 600; line-height: 1.4; white-space: normal; background: var(--mci-bg-muted, #f6f9fb); color: var(--mci-text, #315767); transition: transform .15s ease, opacity .15s ease; }
.device-control-action--wide { grid-column: 1 / -1; }
.device-control-action--success { color: #187044; background: #ecf8f0; border-color: #bfdfca; }
.device-control-action--danger { color: #af332c; background: #fff0ed; border-color: #efd0ca; }
.device-control-action--primary { color: #086d99; background: #edf7fc; border-color: #bedeea; }
.device-control-action--warning { color: #8d5810; background: #fff6e8; border-color: #e9d3b0; }
.device-control-action--pressed { transform: scale(.98); opacity: .85; }
.device-controls button[disabled] { opacity: .5; }
.device-controls__more { display: flex; align-items: center; justify-content: center; gap: 12rpx; min-height: 44px; margin: 16rpx 0 0; padding: 0 12rpx; border-radius: 6px; background: var(--mci-bg-muted, #f6f9fb); color: var(--mci-primary, #087da8); font-size: 23rpx; line-height: 1.4; }
.device-controls__feedback { margin-top: 20rpx; padding: 18rpx; border-radius: 6px; background: var(--mci-bg-muted, #f4f8fa); color: var(--mci-text-secondary, #526c78); font-size: 22rpx; line-height: 1.6; overflow-wrap: anywhere; word-break: break-all; }
.device-controls__feedback text { display: block; }
.device-controls__feedback-title { margin-bottom: 6rpx; color: var(--mci-text, #244451); font-weight: 650; }
.device-controls__feedback--error { border-left: 3px solid #c85b38; }
.device-controls__feedback--success { border-left: 3px solid #23885b; }
.device-controls__command,.device-controls__verification { margin-top: 10rpx; font-size: 21rpx; }
.device-controls__skeleton { display: grid; grid-template-columns: 1fr 1fr; gap: 14rpx; padding-top: 20rpx; }
.device-controls__skeleton view { height: 46px; border-radius: 6px; background: var(--mci-bg-muted, #edf2f5); }
.control-icon { position: relative; display: inline-block; width: 26rpx; height: 26rpx; flex-shrink: 0; box-sizing: border-box; color: inherit; }
.control-icon--power { border: 2px solid currentColor; border-top-color: transparent; border-radius: 50%; }
.control-icon--power::after { content: ''; position: absolute; left: calc(50% - 1px); top: -3px; width: 2px; height: 60%; background: currentColor; }
.control-icon--reset { border: 1.5px solid currentColor; border-right-color: transparent; border-radius: 50%; }
.control-icon--reset::after { content: ''; position: absolute; right: -1px; top: -2px; border-left: 4px solid currentColor; border-top: 3px solid transparent; border-bottom: 3px solid transparent; transform: rotate(-35deg); }
.control-icon--pause { border-left: 3px solid currentColor; border-right: 3px solid currentColor; width: 18rpx; }
.control-icon--cool::before,.control-icon--cool::after { content: ''; position: absolute; top: 45%; left: 0; width: 100%; height: 2px; background: currentColor; transform: rotate(45deg); }
.control-icon--cool::after { transform: rotate(-45deg); }
.control-icon--heat { border: 1.5px solid currentColor; border-radius: 65% 20% 60% 45%; transform: rotate(-25deg); }
.control-icon--status { border: 1.5px solid currentColor; border-radius: 50%; }
.control-icon--status::after { content: ''; position: absolute; left: 45%; top: 30%; width: 2px; height: 45%; background: currentColor; }
@media (prefers-reduced-motion: reduce) { .device-control-action { transition: none; } }
</style>
