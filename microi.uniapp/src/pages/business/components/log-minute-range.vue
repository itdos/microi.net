<template>
  <view class="query-time-panel" :style="mciTokenStyle">
    <view v-for="bound in ['start', 'end']" :key="bound" class="query-time-row">
      <text>{{ bound === 'start' ? '开始时间' : '结束时间' }}</text>
      <picker mode="date" :start="queryDateBounds.first" :end="queryDateBounds.last"
        :value="queryTimeDraft[bound + 'Date'] || queryDateBounds.first" @change="changeQueryTime(bound, 'Date', $event)">
        <view class="query-time-value">{{ queryTimeDraft[bound + 'Date'] || '选择日期' }}</view>
      </picker>
      <picker mode="time" :value="queryTimeDraft[bound + 'Time'] || (bound === 'start' ? '00:00' : '23:59')"
        @change="changeQueryTime(bound, 'Time', $event)">
        <view class="query-time-value">{{ queryTimeDraft[bound + 'Time'] || '时:分' }}</view>
      </picker>
    </view>
    <view class="query-time-actions">
      <button class="query-time-reset" @tap="resetQueryTime">重置</button>
      <button class="query-time-apply" @tap="applyQueryTime">查询</button>
    </view>
    <text v-if="queryTimeError" class="query-time-error">{{ queryTimeError }}</text>
  </view>
</template>

<script>
import { queryMonthValue } from '@/platform/configured-read-api.mjs'
import { queryMonthDateBounds, minuteRangeWhere } from './minute-range.mjs'
import { themeMixin } from '@/utils/theme.js'

export default {
  mixins: [themeMixin],
  props: { month: { type: String, required: true }, field: { type: String, required: true } },
  emits: ['query'],
  data() { return { queryTimeDraft: {}, queryTimeError: '' } },
  computed: { queryDateBounds() { return queryMonthDateBounds(this.month) } },
  watch: { month() { this.queryTimeDraft = {}; this.queryTimeError = '' } },
  methods: {
    changeQueryTime(bound, part, event) {
      this.queryTimeError = ''
      this.queryTimeDraft = { ...this.queryTimeDraft, [bound + part]: String(event?.detail?.value || '') }
      if (part === 'Date' && !this.queryTimeDraft[bound + 'Time']) this.queryTimeDraft[bound + 'Time'] = bound === 'start' ? '00:00' : '23:59'
      if (part === 'Time' && !this.queryTimeDraft[bound + 'Date']) {
        const today = new Date()
        const month = queryMonthValue(this.month)
        this.queryTimeDraft[bound + 'Date'] = `${month.slice(0, 4)}-${month.slice(4)}-${String(month === queryMonthValue('', today) ? today.getDate() : 1).padStart(2, '0')}`
      }
    },
    applyQueryTime() {
      let where
      try { where = minuteRangeWhere(this.field, this.month, this.queryTimeDraft) }
      catch (error) { this.queryTimeError = error.message; return }
      this.queryTimeError = ''
      this.$emit('query', where)
    },
    resetQueryTime() { this.queryTimeDraft = {}; this.applyQueryTime() }
  }
}
</script>

<style scoped>
.query-time-panel { padding: 0 24rpx 18rpx; background: #fff; }
.query-time-row { display: flex; align-items: center; gap: 16rpx; padding-bottom: 14rpx; font-size: 24rpx; color: #526575; }
.query-time-row picker { flex: 1; min-width: 0; }
.query-time-row picker:last-child { flex: 0 0 134rpx; }
.query-time-value { min-height: 64rpx; display: flex; align-items: center; justify-content: center; padding: 0 12rpx; border: 1rpx solid #dce6ed; border-radius: 8rpx; color: #243e50; background: #f7fafc; }
.query-time-actions { display: flex; gap: 16rpx; }
.query-time-actions button { flex: 1; margin: 0; height: 64rpx; line-height: 64rpx; font-size: 26rpx; border-radius: 8rpx; }
.query-time-reset { color: #526575; background: #f2f6f8; }
.query-time-apply { color: #fff; background: var(--mci-primary, #087da8); }
.query-time-error { display: block; padding-top: 12rpx; color: #dc442c; font-size: 24rpx; }
</style>
