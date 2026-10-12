<template>
  <view class="task-card mci-fade-up" :style="{ animationDelay: `${Math.min(index, 7) * 35}ms` }"
    hover-class="task-card--pressed" @tap="$emit('open', item)">
    <view class="task-card__top">
      <view class="task-card__identity">
        <view class="task-card__type"><text>{{ shortType }}</text></view>
        <view class="task-card__heading">
          <text class="task-card__title">{{ item.customer || item.no || '售后任务' }}</text>
          <text class="task-card__no">{{ item.no || '暂无任务编号' }}</text>
        </view>
      </view>
      <text class="status-pill" :class="stateClass">{{ item.state || '状态未知' }}</text>
    </view>

    <view class="task-card__content">
      <text v-if="item.content" class="task-card__summary">{{ item.content }}</text>
      <view class="task-card__line"><text class="line-icon">人</text><text class="line-label">客户联系人</text><text class="line-value">{{ item.contact || '未填写' }}</text></view>
      <view class="task-card__line">
        <text class="line-icon">☎</text><text class="line-label">客户电话</text>
        <view class="task-card__phone">
          <text class="line-value">{{ item.phone || '未填写' }}</text>
          <view v-if="item.phone" class="icon-action" hover-class="icon-action--pressed" @tap.stop="$emit('phone', item.phone)"><text>☎</text></view>
        </view>
      </view>
      <view class="task-card__line"><text class="line-icon">◷</text><text class="line-label">计划服务</text><text class="line-value">{{ item.planTimeText || '暂未安排' }}</text></view>
      <view class="task-card__line"><text class="line-icon">⌖</text><text class="line-label">服务地址</text><text class="line-value">{{ item.address || '暂无地址' }}</text></view>
      <view class="task-card__line"><text class="line-icon">人</text><text class="line-label">服务人员</text><text class="line-value">{{ item.serviceUser || '待领取/指派' }}</text></view>
      <view class="task-card__line"><text class="line-icon">▦</text><text class="line-label">设备数量</text><text class="line-value">{{ deviceCountText }}</text></view>
    </view>

    <view class="task-card__bottom">
      <text class="task-card__tag">{{ item.type }}</text>
      <view v-if="actions.length" class="task-card__actions" hover-class="task-card__actions--pressed" @tap.stop="showActionMenu">
        <view class="more-icon" aria-hidden="true"><view></view><view></view><view></view></view><text>更多</text>
      </view>
    </view>
  </view>
</template>

<script>
import { showRowActionSheet } from '@/platform/row-action-sheet.js'

export default {
  name: 'MciTaskCard',
  props: {
    item: { type: Object, required: true },
    index: { type: Number, default: 0 },
    stateClass: { type: String, default: '' },
    actions: { type: Array, default: () => [] }
  },
  emits: ['open', 'phone', 'action'],
  computed: {
    shortType() {
      return String(this.item.type || '服务').slice(0, 2)
    },
    deviceCountText() {
      const value = this.item.deviceCount
      return value !== null && value !== undefined && value !== '' ? `${value} 台` : '未获取'
    }
  },
  methods: {
    showActionMenu() {
      showRowActionSheet(this.actions, (action) => this.$emit('action', action, this.item))
    }
  }
}
</script>

<style scoped>
.task-card { margin-bottom: 16rpx; border: 1px solid #e2eaed; border-radius: 8px; overflow: hidden; background: #fff; box-shadow: 0 5rpx 16rpx rgba(20,65,84,.055); transition: transform .16s ease; }
.task-card--pressed { transform: scale(.988); }
.task-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16rpx; padding: 22rpx 22rpx 16rpx; }
.task-card__identity { display: flex; min-width: 0; gap: 14rpx; }
.task-card__type { flex: none; width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; color: #fff; background: linear-gradient(145deg,#087da8,#18a6b8); font-size: 22rpx; font-weight: 700; }
.task-card__heading { min-width: 0; }
.task-card__title, .task-card__no { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-card__title { color: #17333e; font-size: 28rpx; font-weight: 700; }
.task-card__no { margin-top: 7rpx; color: #81939a; font-size: 20rpx; }
.status-pill { flex: none; max-width: 170rpx; padding: 7rpx 12rpx; border-radius: 6px; overflow: hidden; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.status-pill--todo { color: #a96a00; background: #fff5de; }
.status-pill--doing { color: #087da8; background: #e8f6fb; }
.status-pill--success { color: #17845a; background: #e9f7f0; }
.status-pill--danger { color: #c6452e; background: #fff0ed; }
.task-card__content { padding: 0 22rpx 17rpx; }
.task-card__summary { display: -webkit-box; margin-bottom: 14rpx; overflow: hidden; color: #405f69; font-size: 24rpx; line-height: 1.55; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.task-card__line { display: grid; grid-template-columns: 34rpx 140rpx minmax(0,1fr); align-items: center; min-height: 48rpx; }
.line-icon { color: #18a6b8; font-size: 20rpx; }
.line-label { color: #82969e; font-size: 22rpx; }
.line-value { overflow: hidden; color: #385660; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.task-card__bottom { min-height: 70rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 20rpx 0 22rpx; border-top: 1px solid #edf2f4; background: #fbfcfd; }
.task-card__tag { padding: 5rpx 11rpx; border-radius: 5px; color: #765322; background: #fff5e6; font-size: 19rpx; }
.task-card__phone { display: flex; align-items: center; min-width: 0; gap: 12rpx; }
.icon-action { flex: none; width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #0d839b; background: #e9f8fa; font-size: 27rpx; }
.icon-action--pressed { opacity: .65; }
.task-card__actions { display: flex; align-items: center; justify-content: center; min-width: 100rpx; min-height: 64rpx; gap: 8rpx; border-radius: 6rpx; color: #526d78; font-size: 22rpx; }
.task-card__actions--pressed { background: #edf5f8; }
.more-icon { display: flex; gap: 4rpx; }
.more-icon > view { width: 6rpx; height: 6rpx; border-radius: 50%; background: currentColor; }
@media (prefers-reduced-motion: reduce) { .task-card { transition: none; } }
</style>
