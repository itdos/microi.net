<template>
  <view class="data-card" hover-class="data-card--pressed" @tap="$emit('open', row)">
    <view class="card-top">
      <view class="card-title-wrap">
        <text class="card-index">{{ index + 1 }}</text>
        <text class="card-title">{{ title }}</text>
      </view>
      <text v-if="status" class="status-chip" :class="statusClass">{{ status }}</text>
    </view>

    <view v-if="tags.length" class="tag-row">
      <text v-for="tag in tags" :key="tag" class="data-tag">{{ tag }}</text>
    </view>

    <view v-if="lines.length" class="field-list">
      <view v-for="line in lines" :key="line.field" class="field-row">
        <text class="field-label">{{ line.label }}</text>
        <text class="field-value">{{ line.value }}</text>
        <view v-if="line.format === 'phone' && line.rawValue" class="phone-action"
          @tap.stop="$emit('phone', line.rawValue)">
          <image src="/static/xjy/UI-call.png" mode="aspectFit" />
        </view>
      </view>
    </view>

    <text v-if="summary" class="card-summary">{{ summary }}</text>

    <view v-if="actions.length" class="card-actions" @tap.stop>
      <view v-for="action in actions" :key="action.key" class="card-action"
        :class="[`card-action--${action.tone || 'default'}`]"
        hover-class="card-action--pressed" @tap.stop="$emit('action', action, row)">
        <text>{{ action.label }}</text>
      </view>
    </view>

    <view class="card-bottom">
      <text>{{ time }}</text>
      <text class="detail-link">查看详情 ›</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'MciBusinessCard',
  props: {
    row: { type: Object, required: true },
    index: { type: Number, default: 0 },
    title: { type: String, default: '-' },
    status: { type: String, default: '' },
    statusClass: { type: String, default: 'is-info' },
    tags: { type: Array, default: () => [] },
    lines: { type: Array, default: () => [] },
    summary: { type: String, default: '' },
    actions: { type: Array, default: () => [] },
    time: { type: String, default: '' }
  },
  emits: ['open', 'phone', 'action']
}
</script>

<style scoped>
.data-card { margin-bottom: 18rpx; padding: 22rpx 24rpx 18rpx; border: 1rpx solid #e3edf1; border-radius: 16rpx; background: #fff; box-shadow: 0 6rpx 18rpx rgba(25, 78, 101, .05); transition: transform 150ms ease, box-shadow 150ms ease; }
.data-card--pressed { transform: scale(.985); box-shadow: 0 2rpx 8rpx rgba(25, 78, 101, .04); }
.card-top, .card-title-wrap, .field-row, .card-bottom { display: flex; align-items: center; }
.card-top { justify-content: space-between; gap: 18rpx; }
.card-title-wrap { min-width: 0; }
.card-index { flex: 0 0 auto; width: 36rpx; height: 36rpx; margin-right: 12rpx; border-radius: 50%; color: #0b86d4; background: #eaf5fa; font-size: 20rpx; line-height: 36rpx; text-align: center; }
.card-title { overflow: hidden; color: #18313d; font-size: 29rpx; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.status-chip, .data-tag { flex: 0 0 auto; border-radius: 8rpx; }
.status-chip { max-width: 190rpx; padding: 7rpx 12rpx; overflow: hidden; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.status-chip.is-success { color: #16865c; background: #e9f7f0; }
.status-chip.is-danger { color: #d6462a; background: #fff0ed; }
.status-chip.is-warning { color: #b9780a; background: #fff7e8; }
.status-chip.is-info { color: #0b78ba; background: #eaf5fa; }
.tag-row { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; }
.data-tag { padding: 5rpx 10rpx; color: #647c87; background: #f1f4f8; font-size: 20rpx; }
.field-list { margin-top: 16rpx; padding-top: 12rpx; border-top: 1rpx solid #edf3f5; }
.field-row { min-height: 48rpx; line-height: 34rpx; }
.field-label { flex: 0 0 138rpx; color: #8197a0; font-size: 23rpx; }
.field-value { flex: 1; min-width: 0; overflow: hidden; color: #365663; font-size: 24rpx; text-overflow: ellipsis; white-space: nowrap; }
.phone-action { display: flex; align-items: center; justify-content: center; width: 52rpx; height: 44rpx; }
.phone-action image { width: 28rpx; height: 28rpx; }
.card-summary { display: -webkit-box; margin-top: 12rpx; overflow: hidden; color: #607b87; font-size: 23rpx; line-height: 36rpx; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.card-actions { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx solid #edf3f5; }
.card-action { min-width: 90rpx; height: 50rpx; padding: 0 16rpx; border: 1rpx solid #dce8ed; border-radius: 8rpx; color: #58727d; background: #f8fbfc; font-size: 21rpx; line-height: 50rpx; text-align: center; transition: transform 140ms ease, background 140ms ease; }
.card-action--primary { border-color: rgba(11, 134, 212, .3); color: #0b78ba; background: #eaf5fa; }
.card-action--danger { border-color: rgba(217, 71, 43, .24); color: #cb4329; background: #fff1ee; }
.card-action--pressed { transform: scale(.94); }
.card-bottom { justify-content: space-between; margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx solid #edf3f5; color: #9aabb2; font-size: 21rpx; }
.detail-link { color: #0b86d4; }
@media (prefers-reduced-motion: reduce) { .data-card, .card-action { transition: none; } }
</style>
