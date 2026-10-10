<template>
  <view class="contract-totals" :class="{ 'contract-totals--compact': compact, 'contract-totals--collapsed': collapsible && !expanded }">
    <view class="contract-totals__heading">
      <text class="contract-totals__title">合同金额</text>
      <button v-if="collapsible" class="contract-totals__toggle" :aria-expanded="expanded"
        :aria-label="(expanded ? '收起' : '展开') + '合同金额'"
        hover-class="contract-totals__toggle--pressed" @tap.stop="expanded = !expanded">
        <text>{{ expanded ? '收起' : '展开' }}</text>
        <text class="contract-totals__arrow" :class="{ expanded }" aria-hidden="true">›</text>
      </button>
    </view>
    <template v-if="!collapsible || expanded">
      <text class="contract-totals__hint">当前有效合同期内 / 所有合同累计</text>
      <view v-if="state.status === 'loading'" class="contract-totals__loading" aria-label="合同金额加载中" aria-busy="true">
        <view v-for="item in 3" :key="item"></view>
      </view>
      <template v-else>
        <view v-for="group in groups" :key="group.key" class="contract-totals__group">
          <text class="contract-totals__group-title">{{ group.title }}</text>
          <view class="contract-totals__amounts">
            <view v-for="item in group.items" :key="item.key" class="contract-totals__amount">
              <text class="contract-totals__label">{{ compact && item.key === 'current' ? '当前有效' : item.label }}</text>
              <text class="contract-totals__value" :class="{ 'contract-totals__value--missing': item.value === '未获取' }">{{ item.value }}</text>
            </view>
          </view>
        </view>
        <view v-if="state.message" class="contract-totals__error" @tap.stop="$emit('retry')">
          <text>{{ state.message }}</text>
          <view class="contract-totals__retry"><view class="contract-totals__retry-icon" aria-hidden="true"></view><text>重试</text></view>
        </view>
        <text v-if="!compact && scopeNote" class="contract-totals__scope">{{ scopeNote }}</text>
      </template>
    </template>
  </view>
</template>

<script>
import { buildCustomerContractGroups } from '../customer-contract-totals.mjs'

export default {
  name: 'XjyCustomerContractTotals',
  props: {
    state: { type: Object, default: () => ({ status: 'loading' }) },
    compact: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false }
  },
  emits: ['retry'],
  data() { return { expanded: true } },
  computed: {
    groups() { return buildCustomerContractGroups(this.state) },
    scopeNote() { return [...new Set([this.state.explanation, this.state.scope].filter(Boolean))].join('；') }
  }
}
</script>

<style scoped>
.contract-totals { margin: 20rpx 0rpx; padding: 24rpx; border: 1rpx solid var(--mci-border-color, #e3edf1); border-radius: 14rpx; background: var(--mci-bg-elevated, #fff); }
.contract-totals__heading { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; min-height: 52rpx; }
.contract-totals__title { color: var(--mci-text-primary, #18313d); font-size: 27rpx; font-weight: 700; }
.contract-totals__toggle { display: flex; flex: none; align-items: center; justify-content: center; gap: 10rpx; min-width: 88rpx; min-height: 80rpx; margin: -12rpx -8rpx -12rpx 0; padding: 0 8rpx; border: none; border-radius: 6rpx; color: var(--mci-text-secondary, #647c87); background: transparent; font-size: 22rpx; line-height: normal; }
.contract-totals__toggle::after { border: none; }
.contract-totals__toggle--pressed { opacity: .65; }
.contract-totals__arrow { font-size: 36rpx; line-height: 1; transform: rotate(90deg); transition: transform .18s ease; }
.contract-totals__arrow.expanded { transform: rotate(-90deg); }
.contract-totals__hint, .contract-totals__label, .contract-totals__scope { color: var(--mci-text-secondary, #647c87); font-size: 24rpx; line-height: 1.5; }
.contract-totals__hint { display: block; padding-bottom: 10rpx; }
.contract-totals__group { display: grid; grid-template-columns: 152rpx minmax(0, 1fr); gap: 12rpx; align-items: center; padding: 16rpx 0; border-top: 1rpx solid var(--mci-border-color, #e3edf1); }
.contract-totals__group-title { color: var(--mci-text-primary, #18313d); font-size: 24rpx; font-weight: 600; line-height: 1.6; }
.contract-totals__amounts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; min-width: 0; }
.contract-totals__amount { display: flex; flex-direction: column; gap: 6rpx; min-width: 0; }
.contract-totals__value { color: var(--mci-color-primary, #087fba); font-size: 27rpx; font-weight: 700; line-height: 1.5; word-break: break-all; }
.contract-totals__value--missing { color: var(--mci-text-secondary, #647c87); font-size: 24rpx; font-weight: 400; }
.contract-totals__error { display: flex; gap: 14rpx; align-items: center; justify-content: space-between; padding-top: 12rpx; color: #af4c24; font-size: 24rpx; line-height: 1.6; }
.contract-totals__retry { display: flex; gap: 8rpx; align-items: center; flex: 0 0 auto; min-height: 64rpx; padding: 8rpx 12rpx; color: var(--mci-color-primary, #087fba); }
.contract-totals__retry-icon { position: relative; width: 17rpx; height: 17rpx; border: 3rpx solid currentColor; border-right-color: transparent; border-radius: 50%; }
.contract-totals__retry-icon::after { position: absolute; top: -5rpx; right: -4rpx; content: ''; width: 0; height: 0; border-left: 7rpx solid currentColor; border-top: 5rpx solid transparent; border-bottom: 5rpx solid transparent; }
.contract-totals__scope { display: block; padding-top: 6rpx; }
.contract-totals__loading { display: flex; flex-direction: column; gap: 18rpx; padding: 14rpx 0; }
.contract-totals__loading view { height: 66rpx; border-radius: 6rpx; background: linear-gradient(90deg, var(--mci-skeleton-base, #edf2f5) 25%, var(--mci-skeleton-highlight, #f7fafb) 50%, var(--mci-skeleton-base, #edf2f5) 75%); background-size: 200% 100%; animation: contract-shimmer 1.5s ease-in-out infinite; }
.contract-totals--compact { margin: 0; padding: 16rpx 0 0; border: 0; border-top: 1rpx solid var(--mci-border-color, #e3edf1); border-radius: 0; }
.contract-totals--compact .contract-totals__title { font-size: 24rpx; }
.contract-totals--compact .contract-totals__group { grid-template-columns: 144rpx minmax(0, 1fr); padding: 12rpx 0; }
.contract-totals--compact .contract-totals__group-title { font-size: 24rpx; }
.contract-totals--compact .contract-totals__value { font-size: 24rpx; }
.contract-totals--collapsed { padding-top: 16rpx; padding-bottom: 16rpx; }
@keyframes contract-shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .contract-totals__loading view { animation: none; } .contract-totals__arrow { transition: none; } }
</style>
