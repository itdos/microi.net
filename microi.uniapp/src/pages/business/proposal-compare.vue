<template>
  <view class="compare-page mci-safe-top" :style="mciTokenStyle">
    <view class="compare-nav mci-safe-nav-row"><view @tap="goBack">‹</view><text>方案比价结果</text><view></view></view>
    <view v-if="loading" class="compare-state"><text>正在生成比价结果...</text></view>
    <view v-else-if="errorMessage" class="compare-state compare-state--error"><text>{{ errorMessage }}</text><view @tap="loadComparison">重新加载</view></view>
    <scroll-view v-else class="compare-scroll" scroll-y>
      <view class="compare-content">
        <view class="comparison-controls">
          <text class="section-title">成本推荐</text>
          <text class="compare-note">先确认需求，再比较相同使用年数的总成本。</text>
          <view class="control-row">
            <text>统一使用年数</text>
            <input v-model="yearsInput" class="years-input" type="number" maxlength="3" aria-label="统一使用年数" />
            <text>年</text>
            <button size="mini" :disabled="recalculating" @tap="applyComparison">重新比价</button>
          </view>
          <picker :range="rows" range-key="FanganMC" :value="referenceIndex" :disabled="recalculating" @change="changeReference">
            <view class="reference-picker"><text>需求基准</text><text>{{ referenceName }} ›</text></view>
          </picker>
          <checkbox-group @change="confirmRequirements">
            <label class="requirement-confirm">
              <checkbox value="confirmed" :checked="requirementsConfirmed" :disabled="recalculating" color="#087fb4" />
              <text>我已确认所选设备组合均满足客户实际用水需求</text>
            </label>
          </checkbox-group>
          <text class="compare-note">设备供水能力及适配由业务人员确认；系统核对同一客户、点位、人数与已填用水要求。</text>
        </view>
        <view v-if="recalculating" class="comparison-notice">正在按统一周期重新计算...</view>
        <view v-else-if="comparison" class="comparison-summary">
          <view v-if="!comparison.RequirementsConfirmed" class="comparison-notice">请先勾选需求确认，再生成成本推荐。</view>
          <template v-else>
            <text class="section-title">{{ comparison.Years }}年成本结论</text>
            <view v-if="comparison.Status === 'no-candidates'" class="comparison-notice">暂无可推荐选项，请查看下方各方案的未参与原因。</view>
            <view v-if="comparison.Status === 'limited'" class="comparison-notice">本次可评估{{ comparison.EligiblePlanCount }}/{{ comparison.SelectedPlanCount }}个方案；存在未评估方案或合作方式，结论仅覆盖已满足条件的选项。</view>
            <view v-for="card in conclusionCards" :key="card.key" class="conclusion-card" :class="{ 'conclusion-card--best': card.key === 'Best' }">
              <text class="conclusion-label">{{ card.title }}</text>
              <text class="conclusion-name">{{ card.names }}</text>
              <text class="conclusion-cost">{{ money(card.cost) }} / {{ comparison.Years }}年</text>
              <text v-if="card.gap !== null" class="compare-note">比下一档可评估选项少{{ money(card.gap) }}{{ card.percent !== null ? `（${card.percent}%）` : '' }}</text>
              <text v-for="upfront in card.upfront" :key="upfront" class="compare-note">{{ upfront }}</text>
            </view>
          </template>
          <text class="compare-note">{{ comparison.Basis }}</text>
          <text class="compare-note">{{ comparison.Warning }}</text>
        </view>
        <text class="table-hint">左右滑动查看各方案；买断年运行费不含一次性设备款。</text>
        <scroll-view scroll-x class="compare-table-scroll">
          <view class="compare-table">
          <view class="compare-row compare-head"><text>对比项</text><text v-for="item in rows" :key="item.Id">{{ item.FanganMC }}</text></view>
          <view class="compare-row"><text>租赁成本排名</text><text v-for="item in rows" :key="`rent-rank-${item.Id}`">{{ rankText(item, 'Rental') }}</text></view>
          <view class="compare-row"><text>买断成本排名</text><text v-for="item in rows" :key="`buy-rank-${item.Id}`">{{ rankText(item, 'Buyout') }}</text></view>
          <view v-for="metric in metrics" :key="metric.key" class="compare-row">
            <text>{{ metric.label }}</text><text v-for="item in rows" :key="`${metric.key}-${item.Id}`">{{ display(item, metric) }}</text>
          </view>
          </view>
        </scroll-view>
        <view v-for="item in rows" :key="`points-${item.Id}`" class="point-card">
          <text class="point-title">{{ item.FanganMC }} · 安装点位</text>
          <text v-for="(issue, issueIndex) in reviewIssues(item)" :key="`issue-${issueIndex}`" class="review-issue">{{ issue }}</text>
          <view v-for="(point, index) in item.Locations" :key="point.Id || index">
            <text>{{ point.AnzhuangCS || `点位${index + 1}` }}</text>
            <text>{{ [point.ShebeiMC, point.ShebeiXH].filter(Boolean).join(' · ') || '未选设备' }}</text>
            <text>{{ point.ShebeiSL }} 台 · {{ point.Renshu }} 人</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { buildFriendShare, buildTimelineShare } from '@/utils/share.js'
import { themeMixin } from '@/utils/theme.js'
import { V8 } from '@/utils/request.js'
export default {
  onShareAppMessage() { return buildFriendShare(this, 'pages/business/proposal-compare') },
  onShareTimeline() { return buildTimelineShare(this, 'pages/business/proposal-compare') },
  mixins: [themeMixin],
  data() { return { rows: [], proposalIds: [], loading: true, recalculating: false, errorMessage: '',
    comparison: null, yearsInput: '5', referenceIndex: 0, requirementsConfirmed: false, requestSequence: 0, metrics: [
    { key: 'Years', label: '统一使用年数' },
    { key: 'YujiHZSJ', label: '预计合作时间' }, { key: 'PointCount', label: '点位数量' },
    { key: 'DeviceCount', label: '设备数量' }, { key: 'PeopleCount', label: '覆盖人数' },
    { key: 'RentalPriceTotal', label: '租赁设备合计', money: true }, { key: 'BuyoutPriceTotal', label: '买断设备合计', money: true },
    { key: 'FilterPriceTotal', label: '年滤芯合计', money: true }, { key: 'CurrentAnnualCost', label: '当前年成本', money: true },
    { key: 'RentalAnnualCost', label: '租赁年成本', money: true }, { key: 'BuyoutAnnualCost', label: '买断年运行费', money: true },
    { key: 'RentalMultiYearCost', label: '租赁多年成本', money: true }, { key: 'BuyoutMultiYearCost', label: '买断多年成本', money: true }
  ] } },
  onLoad(options) {
    try { this.proposalIds = decodeURIComponent(options.ids || '').split(',').filter(Boolean) }
    catch (error) { this.proposalIds = [] }
    this.loadComparison()
  },
  onUnload() { this.requestSequence++ },
  computed: {
    referenceName() { return this.rows[this.referenceIndex]?.FanganMC || '首个所选方案' },
    conclusionCards() {
      if (!this.comparison?.RequirementsConfirmed) return []
      return [['Best', '当前可评估组合中的最低成本'], ['Rental', '租赁最低成本'], ['Buyout', '买断最低成本']].map(([key, title]) => {
        const result = this.comparison[key]
        if (!result?.Winners?.length) return null
        const winners = result.Winners
        return { key, title: `${title}${winners.length > 1 ? '（并列）' : ''}`, cost: winners[0].Cost,
          names: winners.map(item => key === 'Best' ? `${item.Name} · ${item.ModeName}` : item.Name).join('、'),
          gap: result.GapToNext, percent: result.SavingPercent,
          upfront: winners.filter(item => item.Mode === 'Buyout').map(item => `${item.Name}一次性设备款：${this.money(item.UpfrontCost)}`) }
      }).filter(Boolean)
    }
  },
  methods: {
    goBack() { uni.navigateBack() },
    applyComparison() {
      if (!/^[0-9]{1,3}$/.test(String(this.yearsInput)) || Number(this.yearsInput) < 1 || Number(this.yearsInput) > 100) {
        uni.showToast({ title: '请输入1至100的整数年数', icon: 'none' }); return
      }
      return this.loadComparison(true)
    },
    changeReference(event) {
      this.referenceIndex = Number(event.detail.value)
      this.requirementsConfirmed = false
      return this.applyComparison()
    },
    confirmRequirements(event) {
      this.requirementsConfirmed = event.detail.value.includes('confirmed')
      return this.applyComparison()
    },
    async loadComparison(explicitYears = false) {
      if (this.proposalIds.length < 2) { this.loading = false; this.errorMessage = '请返回并至少选择两个方案'; return }
      const sequence = ++this.requestSequence
      this.loading = !this.rows.length; this.recalculating = !!this.rows.length; this.errorMessage = ''; this.comparison = null
      try {
        // 使用已验证的接口引擎路由，业务失败原样展示，避免旧路由重试覆盖真实原因。
        const params = { Ids: this.proposalIds, RequirementsConfirmed: this.requirementsConfirmed }
        if (explicitYears) params.Years = Number(this.yearsInput)
        if (this.rows[this.referenceIndex]) params.ReferenceId = this.rows[this.referenceIndex].Id
        const result = await V8.ApiEngine.Run('xjy_compare_customer_proposals', params, { checkCode: false })
        if (sequence !== this.requestSequence) return
        if (!result || Number(result.Code) !== 1) throw new Error(result && result.Msg || '方案比价失败')
        this.rows = result.Data || []
        this.comparison = result.DataAppend?.Comparison || null
        if (!this.comparison) throw new Error('比价接口尚未支持成本推荐，请联系管理员更新')
        this.yearsInput = String(this.comparison.Years)
        this.referenceIndex = Math.max(0, this.rows.findIndex(row => row.Id === this.comparison.ReferenceId))
      } catch (error) {
        if (sequence !== this.requestSequence) return
        this.errorMessage = error && (error.message || error.Msg || error.errMsg) || '方案比价失败，请稍后重试'
      } finally { if (sequence === this.requestSequence) { this.loading = false; this.recalculating = false } }
    },
    money(value) { return value === null || value === undefined || !Number.isFinite(Number(value)) ? '-' : `¥${Number(value).toFixed(2)}` },
    rankText(item, mode) {
      if (this.recalculating) return '计算中'
      if (!this.comparison?.RequirementsConfirmed) return '待确认需求'
      const rank = item.CostReview?.[`${mode}Rank`]
      return rank ? `第${rank}名` : '暂不参与'
    },
    reviewIssues(item) {
      const review = item.CostReview
      return review ? [...review.ScopeReasons, ...review.RentalIssues.map(text => `租赁：${text}`), ...review.BuyoutIssues.map(text => `买断：${text}`)] : []
    },
    display(item, metric) {
      const value = item[metric.key], review = item.CostReview
      // 部分点位缺价的合计仍保留给旧调用方，此页明确标记，避免被误读为完整报价。
      if (review && metric.key.startsWith('Rental') && review.RentalIssues.length) return '报价待完善'
      if (review && (metric.key.startsWith('Buyout') || metric.key === 'FilterPriceTotal') && review.BuyoutIssues.length) return '报价待完善'
      if (value === null || value === undefined || value === '') return '-'
      return metric.money ? this.money(value) : value
    }
  }
}
</script>

<style scoped lang="scss">
.compare-page{height:100vh;display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;background:#f2f7f9}.compare-nav{flex-shrink:0;height:var(--mci-nav-height, 44px);padding:0 28rpx;display:grid;grid-template-columns:60rpx 1fr 60rpx;align-items:center;background:#fff}.compare-nav>view{font-size:54rpx}.compare-nav>text{text-align:center;font-weight:700}.compare-scroll{flex:1;min-height:0;height:0}.compare-content{padding:22rpx;padding-bottom:calc(22rpx + var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)));box-sizing:border-box}.compare-table{display:table;min-width:1100rpx;border-radius:22rpx;overflow:hidden;background:#fff}.compare-row{display:table-row}.compare-row>text{display:table-cell;min-width:240rpx;padding:22rpx;border-right:1rpx solid #e5edef;border-bottom:1rpx solid #e5edef;text-align:center}.compare-row>text:first-child{min-width:190rpx;text-align:left;font-weight:650;color:#45606d}.compare-head>text{color:#fff!important;background:#087fb4}.point-card{margin-top:22rpx;padding:24rpx;border-radius:20rpx;background:#fff}.point-title{display:block;margin-bottom:12rpx;font-weight:700;color:#087fb4}.point-card>view{display:grid;grid-template-columns:1fr 1.5fr auto;gap:14rpx;padding:16rpx 0;border-top:1rpx solid #edf2f3;font-size:25rpx}
.compare-state{display:flex;flex:1;min-height:0;flex-direction:column;align-items:center;justify-content:center;gap:24rpx;padding:40rpx;color:#607d8b;box-sizing:border-box}.compare-state--error>view{padding:16rpx 32rpx;border-radius:14rpx;color:#fff;background:#0787c9}
.comparison-controls,.comparison-summary{padding:24rpx;margin-bottom:20rpx;border-radius:14rpx;background:#fff;color:#274555}.section-title{display:block;font-size:32rpx;font-weight:700;margin-bottom:12rpx}.compare-note{display:block;font-size:24rpx;line-height:1.65;color:#516b79;margin-top:10rpx}.control-row{display:flex;align-items:center;gap:12rpx;margin-top:24rpx;font-size:26rpx;flex-wrap:wrap}.years-input{width:90rpx;height:64rpx;padding:0 12rpx;text-align:center;border:1px solid #b4cbd6;border-radius:8rpx;box-sizing:border-box}.control-row button{margin:0 0 0 auto;background:#087fb4;color:#fff}.control-row button[disabled]{opacity:.5}.reference-picker{display:flex;gap:20rpx;justify-content:space-between;padding:24rpx 0;font-size:26rpx}.reference-picker>text:last-child{flex:1;text-align:right;overflow-wrap:anywhere;color:#087fb4}.requirement-confirm{display:flex;align-items:flex-start;font-size:26rpx;line-height:1.6;gap:10rpx}.requirement-confirm checkbox{flex-shrink:0;transform:scale(.85);transform-origin:left top}.comparison-notice{padding:18rpx;margin:12rpx 0;border-radius:8rpx;background:#fff5df;color:#765000;font-size:25rpx;line-height:1.6}.conclusion-card{padding:20rpx;margin-top:16rpx;border:1px solid #d4e3e9;border-radius:12rpx}.conclusion-card--best{background:#edf8f6;border-color:#91c9bf}.conclusion-label{display:block;color:#526c77;font-size:24rpx}.conclusion-name{display:block;font-weight:700;font-size:28rpx;margin-top:12rpx;overflow-wrap:anywhere}.conclusion-cost{display:block;font-size:32rpx;font-weight:700;color:#086d66;margin-top:12rpx}.table-hint{display:block;font-size:23rpx;color:#516b79;margin:24rpx 0 12rpx}.compare-table-scroll{width:100%;min-width:0}.review-issue{display:block;color:#8a4a18;font-size:24rpx;line-height:1.6;padding-bottom:8rpx}.compare-content{min-width:0}.point-card>view{grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) auto}.point-card>view>text{overflow-wrap:anywhere}
</style>
