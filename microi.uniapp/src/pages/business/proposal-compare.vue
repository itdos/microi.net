<template>
  <view class="compare-page mci-safe-top" :style="mciTokenStyle">
    <view class="compare-nav mci-safe-nav-row"><view @tap="goBack">‹</view><text>方案比价结果</text><view></view></view>
    <view v-if="loading" class="compare-state"><text>正在生成比价结果...</text></view>
    <view v-else-if="errorMessage" class="compare-state compare-state--error"><text>{{ errorMessage }}</text><view @tap="loadComparison">重新加载</view></view>
    <scroll-view v-else class="compare-scroll" scroll-x scroll-y>
      <view class="compare-table">
        <view class="compare-row compare-head"><text>对比项</text><text v-for="item in rows" :key="item.Id">{{ item.FanganMC }}</text></view>
        <view v-for="metric in metrics" :key="metric.key" class="compare-row">
          <text>{{ metric.label }}</text><text v-for="item in rows" :key="`${metric.key}-${item.Id}`">{{ display(item[metric.key], metric) }}</text>
        </view>
      </view>
      <view v-for="item in rows" :key="`points-${item.Id}`" class="point-card">
        <text class="point-title">{{ item.FanganMC }} · 安装点位</text>
        <view v-for="(point, index) in item.Locations" :key="point.Id || index">
          <text>{{ point.AnzhuangCS || `点位${index + 1}` }}</text>
          <text>{{ [point.ShebeiMC, point.ShebeiXH].filter(Boolean).join(' · ') || '未选设备' }}</text>
          <text>{{ point.ShebeiSL }} 台 · {{ point.Renshu }} 人</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { callApiEngine } from '@/platform/business-runtime.js'
export default {
  mixins: [themeMixin],
  data() { return { rows: [], proposalIds: [], loading: true, errorMessage: '', metrics: [
    { key: 'YujiHZSJ', label: '预计合作时间' }, { key: 'PointCount', label: '点位数量' },
    { key: 'DeviceCount', label: '设备数量' }, { key: 'PeopleCount', label: '覆盖人数' },
    { key: 'RentalPriceTotal', label: '租赁设备合计', money: true }, { key: 'BuyoutPriceTotal', label: '买断设备合计', money: true },
    { key: 'FilterPriceTotal', label: '年滤芯合计', money: true }, { key: 'CurrentAnnualCost', label: '当前年成本', money: true },
    { key: 'RentalAnnualCost', label: '租赁年成本', money: true }, { key: 'BuyoutAnnualCost', label: '买断年成本', money: true },
    { key: 'RentalMultiYearCost', label: '租赁多年成本', money: true }, { key: 'BuyoutMultiYearCost', label: '买断多年成本', money: true }
  ] } },
  onLoad(options) {
    this.proposalIds = decodeURIComponent(options.ids || '').split(',').filter(Boolean)
    this.loadComparison()
  },
  methods: {
    goBack() { uni.navigateBack() },
    async loadComparison() {
      if (this.proposalIds.length < 2) { this.loading = false; this.errorMessage = '请返回并至少选择两个方案'; return }
      this.loading = true; this.errorMessage = ''
      try {
        const result = await callApiEngine('xjy_compare_customer_proposals', { Ids: this.proposalIds })
        if (!result || Number(result.Code) !== 1) throw new Error(result && result.Msg || '方案比价失败')
        this.rows = result.Data || []
      } catch (error) {
        this.errorMessage = error && error.message || '方案比价失败，请稍后重试'
      } finally { this.loading = false }
    },
    display(value, metric) { if (value === null || value === undefined || value === '') return '-'; return metric.money ? `¥${Number(value || 0).toFixed(2)}` : value }
  }
}
</script>

<style scoped lang="scss">
.compare-page{min-height:100vh;background:#f2f7f9}.compare-nav{height:88rpx;padding:0 28rpx;display:grid;grid-template-columns:60rpx 1fr 60rpx;align-items:center;background:#fff}.compare-nav>view{font-size:54rpx}.compare-nav>text{text-align:center;font-weight:700}.compare-scroll{height:calc(100vh - 88rpx - env(safe-area-inset-top));padding:22rpx;box-sizing:border-box}.compare-table{display:table;min-width:1100rpx;border-radius:22rpx;overflow:hidden;background:#fff}.compare-row{display:table-row}.compare-row>text{display:table-cell;min-width:240rpx;padding:22rpx;border-right:1rpx solid #e5edef;border-bottom:1rpx solid #e5edef;text-align:center}.compare-row>text:first-child{min-width:190rpx;text-align:left;font-weight:650;color:#45606d}.compare-head>text{color:#fff!important;background:#087fb4}.point-card{margin-top:22rpx;padding:24rpx;border-radius:20rpx;background:#fff}.point-title{display:block;margin-bottom:12rpx;font-weight:700;color:#087fb4}.point-card>view{display:grid;grid-template-columns:1fr 1.5fr auto;gap:14rpx;padding:16rpx 0;border-top:1rpx solid #edf2f3;font-size:25rpx}
.compare-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24rpx;height:calc(100vh - 88rpx - env(safe-area-inset-top));padding:40rpx;color:#607d8b;box-sizing:border-box}.compare-state--error>view{padding:16rpx 32rpx;border-radius:14rpx;color:#fff;background:#0787c9}
</style>
