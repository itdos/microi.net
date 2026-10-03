<template>
  <view class="mci-symbol" :class="[`mci-symbol--${name}`, `mci-symbol--${tone}`]" :style="symbolStyle" aria-hidden="true">
    <view class="mci-symbol__glyph"><view /><view /><view /></view>
  </view>
</template>

<script>
export default {
  name: 'MciSymbol',
  props: {
    name: { type: String, default: 'info' },
    tone: { type: String, default: 'soft' },
    size: { type: Number, default: 56 }
  },
  computed: {
    symbolStyle() {
      const size = Math.max(44, Number(this.size) || 56)
      return { width: `${size}rpx`, height: `${size}rpx` }
    }
  }
}
</script>

<style scoped>
.mci-symbol { --symbol-color: var(--mci-color-primary, #087da8); position: relative; flex: none; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: 16rpx; color: var(--symbol-color); background: var(--mci-color-primary-soft, rgba(8,125,168,.09)); }
.mci-symbol--plain { background: transparent; }
.mci-symbol--inverse { --symbol-color: var(--mci-text-on-primary, #fff); background: var(--mci-surface-on-primary, rgba(255,255,255,.1)); }
.mci-symbol--danger { --symbol-color: var(--mci-color-danger, #c74a3a); background: var(--mci-color-danger-soft, #f8e8e5); }
.mci-symbol__glyph { position: relative; width: 32rpx; height: 32rpx; color: currentColor; }
.mci-symbol__glyph > view { position: absolute; box-sizing: border-box; }

.mci-symbol--profile .mci-symbol__glyph > view:first-child,
.mci-symbol--customer .mci-symbol__glyph > view:first-child { top: 1rpx; left: 10rpx; width: 13rpx; height: 13rpx; border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--profile .mci-symbol__glyph > view:nth-child(2),
.mci-symbol--customer .mci-symbol__glyph > view:nth-child(2) { right: 3rpx; bottom: 1rpx; left: 3rpx; height: 14rpx; border: 3rpx solid currentColor; border-bottom: 0; border-radius: 16rpx 16rpx 0 0; }

.mci-symbol--password .mci-symbol__glyph > view:first-child { top: 1rpx; left: 8rpx; width: 16rpx; height: 16rpx; border: 3rpx solid currentColor; border-bottom: 0; border-radius: 12rpx 12rpx 0 0; }
.mci-symbol--password .mci-symbol__glyph > view:nth-child(2) { right: 3rpx; bottom: 1rpx; left: 3rpx; height: 18rpx; border: 3rpx solid currentColor; border-radius: 5rpx; }
.mci-symbol--password .mci-symbol__glyph > view:nth-child(3) { bottom: 7rpx; left: 15rpx; width: 3rpx; height: 6rpx; border-radius: 3rpx; background: currentColor; }

.mci-symbol--reminders .mci-symbol__glyph > view:first-child { top: 4rpx; left: 7rpx; width: 18rpx; height: 21rpx; border: 3rpx solid currentColor; border-radius: 12rpx 12rpx 5rpx 5rpx; }
.mci-symbol--reminders .mci-symbol__glyph > view:nth-child(2) { bottom: 2rpx; left: 13rpx; width: 7rpx; height: 4rpx; border-radius: 0 0 8rpx 8rpx; background: currentColor; }
.mci-symbol--reminders .mci-symbol__glyph > view:nth-child(3) { top: 1rpx; left: 14rpx; width: 5rpx; height: 5rpx; border-radius: 50%; background: currentColor; }

.mci-symbol--info .mci-symbol__glyph { border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--info .mci-symbol__glyph > view:first-child { top: 6rpx; left: 13rpx; width: 4rpx; height: 4rpx; border-radius: 50%; background: currentColor; }
.mci-symbol--info .mci-symbol__glyph > view:nth-child(2) { top: 13rpx; left: 13rpx; width: 4rpx; height: 11rpx; border-radius: 4rpx; background: currentColor; }

.mci-symbol--scan .mci-symbol__glyph { border: 3rpx solid currentColor; border-top-color: transparent; border-bottom-color: transparent; border-radius: 3rpx; }
.mci-symbol--scan .mci-symbol__glyph::before,
.mci-symbol--scan .mci-symbol__glyph::after { position: absolute; right: 3rpx; left: 3rpx; height: 7rpx; border-right: 3rpx solid currentColor; border-left: 3rpx solid currentColor; content: ''; }
.mci-symbol--scan .mci-symbol__glyph::before { top: -3rpx; border-top: 3rpx solid currentColor; }
.mci-symbol--scan .mci-symbol__glyph::after { bottom: -3rpx; border-bottom: 3rpx solid currentColor; }
.mci-symbol--scan .mci-symbol__glyph > view:first-child { top: 14rpx; right: 3rpx; left: 3rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; }

.mci-symbol--service .mci-symbol__glyph > view:first-child { top: 3rpx; left: 14rpx; width: 5rpx; height: 26rpx; border-radius: 3rpx; background: currentColor; transform: rotate(45deg); }
.mci-symbol--service .mci-symbol__glyph > view:nth-child(2) { top: 2rpx; right: 2rpx; width: 13rpx; height: 13rpx; border: 4rpx solid currentColor; border-top-color: transparent; border-left-color: transparent; border-radius: 50%; transform: rotate(-8deg); }
.mci-symbol--service .mci-symbol__glyph > view:nth-child(3) { bottom: 1rpx; left: 2rpx; width: 9rpx; height: 9rpx; border: 3rpx solid currentColor; border-radius: 50%; }

.mci-symbol--leads .mci-symbol__glyph::before { position: absolute; top: 8rpx; left: 8rpx; width: 17rpx; height: 16rpx; border-bottom: 3rpx solid currentColor; border-left: 3rpx solid currentColor; content: ''; transform: skewY(-30deg); }
.mci-symbol--leads .mci-symbol__glyph > view { width: 8rpx; height: 8rpx; border: 3rpx solid currentColor; border-radius: 50%; background: var(--mci-app-surface, #fff); }
.mci-symbol--leads .mci-symbol__glyph > view:first-child { top: 1rpx; left: 1rpx; }
.mci-symbol--leads .mci-symbol__glyph > view:nth-child(2) { top: 10rpx; right: 1rpx; }
.mci-symbol--leads .mci-symbol__glyph > view:nth-child(3) { bottom: 1rpx; left: 5rpx; }

.mci-symbol--points .mci-symbol__glyph::before { position: absolute; top: 4rpx; left: 5rpx; width: 22rpx; height: 22rpx; border: 3rpx solid currentColor; border-radius: 6rpx; content: ''; transform: rotate(45deg); }
.mci-symbol--points .mci-symbol__glyph > view:first-child { top: 14rpx; left: 14rpx; width: 5rpx; height: 5rpx; border-radius: 50%; background: currentColor; }

.mci-symbol--invite .mci-symbol__glyph > view:first-child { top: 1rpx; left: 3rpx; width: 12rpx; height: 12rpx; border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--invite .mci-symbol__glyph > view:nth-child(2) { bottom: 1rpx; left: 0; width: 19rpx; height: 13rpx; border: 3rpx solid currentColor; border-bottom: 0; border-radius: 14rpx 14rpx 0 0; }
.mci-symbol--invite .mci-symbol__glyph > view:nth-child(3) { top: 13rpx; right: 0; width: 13rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; }
.mci-symbol--invite .mci-symbol__glyph > view:nth-child(3)::after { position: absolute; top: -5rpx; left: 5rpx; width: 3rpx; height: 13rpx; border-radius: 2rpx; background: currentColor; content: ''; }

.mci-symbol--business .mci-symbol__glyph { border: 3rpx solid currentColor; border-radius: 3rpx; }
.mci-symbol--business .mci-symbol__glyph::before { position: absolute; top: 5rpx; right: 5rpx; left: 5rpx; height: 3rpx; background: currentColor; box-shadow: 0 7rpx 0 currentColor, 0 14rpx 0 currentColor; content: ''; }
.mci-symbol--business .mci-symbol__glyph::after { position: absolute; top: 3rpx; bottom: 3rpx; left: 14rpx; width: 3rpx; background: currentColor; content: ''; }

.mci-symbol--team .mci-symbol__glyph > view { border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--team .mci-symbol__glyph > view:first-child { top: 3rpx; left: 9rpx; width: 12rpx; height: 12rpx; }
.mci-symbol--team .mci-symbol__glyph > view:nth-child(2) { top: 9rpx; left: 0; width: 9rpx; height: 9rpx; }
.mci-symbol--team .mci-symbol__glyph > view:nth-child(3) { top: 9rpx; right: 0; width: 9rpx; height: 9rpx; }
.mci-symbol--team .mci-symbol__glyph::after { position: absolute; right: 1rpx; bottom: 1rpx; left: 1rpx; height: 10rpx; border: 3rpx solid currentColor; border-bottom: 0; border-radius: 15rpx 15rpx 0 0; content: ''; }

.mci-symbol--app .mci-symbol__glyph > view,
.mci-symbol--app .mci-symbol__glyph::before { position: absolute; width: 11rpx; height: 11rpx; box-sizing: border-box; border: 3rpx solid currentColor; border-radius: 3rpx; content: ''; }
.mci-symbol--app .mci-symbol__glyph::before { top: 2rpx; left: 2rpx; }
.mci-symbol--app .mci-symbol__glyph > view:first-child { top: 2rpx; right: 2rpx; }
.mci-symbol--app .mci-symbol__glyph > view:nth-child(2) { bottom: 2rpx; left: 2rpx; }
.mci-symbol--app .mci-symbol__glyph > view:nth-child(3) { right: 2rpx; bottom: 2rpx; }

.mci-symbol--calendar .mci-symbol__glyph,
.mci-symbol--leave .mci-symbol__glyph { border: 3rpx solid currentColor; border-radius: 5rpx; }
.mci-symbol--calendar .mci-symbol__glyph::before,
.mci-symbol--leave .mci-symbol__glyph::before { position: absolute; top: 7rpx; right: 0; left: 0; height: 3rpx; background: currentColor; content: ''; }
.mci-symbol--calendar .mci-symbol__glyph > view:first-child,
.mci-symbol--calendar .mci-symbol__glyph > view:nth-child(2),
.mci-symbol--leave .mci-symbol__glyph > view:first-child,
.mci-symbol--leave .mci-symbol__glyph > view:nth-child(2) { top: -6rpx; width: 3rpx; height: 9rpx; border-radius: 2rpx; background: currentColor; }
.mci-symbol--calendar .mci-symbol__glyph > view:first-child,
.mci-symbol--leave .mci-symbol__glyph > view:first-child { left: 6rpx; }
.mci-symbol--calendar .mci-symbol__glyph > view:nth-child(2),
.mci-symbol--leave .mci-symbol__glyph > view:nth-child(2) { right: 6rpx; }
.mci-symbol--calendar .mci-symbol__glyph > view:nth-child(3) { right: 5rpx; bottom: 5rpx; left: 5rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; box-shadow: 0 -6rpx 0 currentColor; }
.mci-symbol--leave .mci-symbol__glyph > view:nth-child(3) { right: 5rpx; bottom: 6rpx; width: 13rpx; height: 7rpx; border-bottom: 3rpx solid currentColor; border-left: 3rpx solid currentColor; transform: rotate(-45deg); }

.mci-symbol--notice .mci-symbol__glyph,
.mci-symbol--message .mci-symbol__glyph { height: 24rpx; margin-top: -4rpx; border: 3rpx solid currentColor; border-radius: 7rpx; }
.mci-symbol--notice .mci-symbol__glyph::after,
.mci-symbol--message .mci-symbol__glyph::after { position: absolute; bottom: -8rpx; left: 5rpx; width: 9rpx; height: 9rpx; box-sizing: border-box; border-bottom: 3rpx solid currentColor; border-left: 3rpx solid currentColor; transform: skewY(-38deg); content: ''; }
.mci-symbol--notice .mci-symbol__glyph > view:first-child,
.mci-symbol--notice .mci-symbol__glyph > view:nth-child(2) { top: 6rpx; left: 6rpx; width: 15rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; box-shadow: 0 6rpx 0 currentColor; }

.mci-symbol--travel .mci-symbol__glyph { height: 24rpx; margin-top: 4rpx; border: 3rpx solid currentColor; border-radius: 5rpx; }
.mci-symbol--travel .mci-symbol__glyph::before { position: absolute; top: -9rpx; left: 8rpx; width: 11rpx; height: 9rpx; box-sizing: border-box; border: 3rpx solid currentColor; border-bottom: 0; border-radius: 5rpx 5rpx 0 0; content: ''; }
.mci-symbol--travel .mci-symbol__glyph > view:first-child { top: 8rpx; right: -3rpx; left: -3rpx; height: 3rpx; background: currentColor; }

.mci-symbol--clock .mci-symbol__glyph { border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--clock .mci-symbol__glyph::before { position: absolute; top: 6rpx; left: 13rpx; width: 3rpx; height: 10rpx; border-radius: 2rpx; background: currentColor; content: ''; }
.mci-symbol--clock .mci-symbol__glyph::after { position: absolute; top: 14rpx; left: 14rpx; width: 8rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; transform: rotate(24deg); transform-origin: left center; content: ''; }

.mci-symbol--trend .mci-symbol__glyph,
.mci-symbol--chart .mci-symbol__glyph { border-bottom: 3rpx solid currentColor; border-left: 3rpx solid currentColor; }
.mci-symbol--trend .mci-symbol__glyph::before { position: absolute; top: 7rpx; left: 4rpx; width: 22rpx; height: 14rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; transform: skewY(-30deg); content: ''; }
.mci-symbol--trend .mci-symbol__glyph::after { position: absolute; top: 2rpx; right: -1rpx; width: 9rpx; height: 9rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; content: ''; }
.mci-symbol--chart .mci-symbol__glyph > view { bottom: 2rpx; width: 5rpx; border-radius: 3rpx 3rpx 0 0; background: currentColor; }
.mci-symbol--chart .mci-symbol__glyph > view:first-child { left: 4rpx; height: 11rpx; }
.mci-symbol--chart .mci-symbol__glyph > view:nth-child(2) { left: 13rpx; height: 19rpx; }
.mci-symbol--chart .mci-symbol__glyph > view:nth-child(3) { left: 22rpx; height: 15rpx; }

.mci-symbol--document .mci-symbol__glyph,
.mci-symbol--contract .mci-symbol__glyph { width: 25rpx; margin-right: 3rpx; border: 3rpx solid currentColor; border-radius: 4rpx; }
.mci-symbol--document .mci-symbol__glyph::before,
.mci-symbol--contract .mci-symbol__glyph::before { position: absolute; top: 7rpx; right: 4rpx; left: 4rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; box-shadow: 0 7rpx 0 currentColor, 0 14rpx 0 currentColor; content: ''; }
.mci-symbol--contract .mci-symbol__glyph::after { position: absolute; right: -7rpx; bottom: 1rpx; width: 4rpx; height: 17rpx; border-radius: 3rpx; background: currentColor; transform: rotate(38deg); content: ''; }

.mci-symbol--supplier .mci-symbol__glyph,
.mci-symbol--inventory .mci-symbol__glyph { width: 28rpx; height: 25rpx; margin-top: 5rpx; border: 3rpx solid currentColor; border-radius: 3rpx; }
.mci-symbol--supplier .mci-symbol__glyph::before { position: absolute; top: -10rpx; right: 3rpx; left: 3rpx; height: 10rpx; border: 3rpx solid currentColor; border-bottom: 0; content: ''; }
.mci-symbol--supplier .mci-symbol__glyph::after { position: absolute; top: 5rpx; bottom: 0; left: 6rpx; width: 3rpx; background: currentColor; box-shadow: 8rpx 0 0 currentColor; content: ''; }
.mci-symbol--inventory .mci-symbol__glyph::before { position: absolute; top: -3rpx; right: -3rpx; left: -3rpx; height: 8rpx; border-bottom: 3rpx solid currentColor; background: transparent; content: ''; }
.mci-symbol--inventory .mci-symbol__glyph::after { position: absolute; top: 4rpx; bottom: 0; left: 11rpx; width: 3rpx; background: currentColor; content: ''; }

.mci-symbol--finance .mci-symbol__glyph > view { right: 3rpx; left: 3rpx; height: 10rpx; border: 3rpx solid currentColor; border-radius: 50%; background: var(--mci-app-surface, #fff); }
.mci-symbol--finance .mci-symbol__glyph > view:first-child { top: 2rpx; }
.mci-symbol--finance .mci-symbol__glyph > view:nth-child(2) { top: 10rpx; }
.mci-symbol--finance .mci-symbol__glyph > view:nth-child(3) { top: 18rpx; }

.mci-symbol--project .mci-symbol__glyph > view { width: 10rpx; height: 10rpx; border: 3rpx solid currentColor; border-radius: 3rpx; }
.mci-symbol--project .mci-symbol__glyph > view:first-child { top: 0; left: 11rpx; }
.mci-symbol--project .mci-symbol__glyph > view:nth-child(2) { bottom: 0; left: 1rpx; }
.mci-symbol--project .mci-symbol__glyph > view:nth-child(3) { right: 1rpx; bottom: 0; }
.mci-symbol--project .mci-symbol__glyph::before { position: absolute; top: 9rpx; left: 15rpx; width: 3rpx; height: 12rpx; background: currentColor; content: ''; }
.mci-symbol--project .mci-symbol__glyph::after { position: absolute; top: 18rpx; right: 6rpx; left: 6rpx; height: 3rpx; background: currentColor; content: ''; }

.mci-symbol--workflow .mci-symbol__glyph > view { width: 9rpx; height: 9rpx; border: 3rpx solid currentColor; border-radius: 50%; }
.mci-symbol--workflow .mci-symbol__glyph > view:first-child { top: 1rpx; left: 1rpx; }
.mci-symbol--workflow .mci-symbol__glyph > view:nth-child(2) { top: 1rpx; right: 1rpx; }
.mci-symbol--workflow .mci-symbol__glyph > view:nth-child(3) { right: 11rpx; bottom: 1rpx; }
.mci-symbol--workflow .mci-symbol__glyph::before { position: absolute; top: 6rpx; right: 8rpx; left: 8rpx; height: 3rpx; background: currentColor; content: ''; }
.mci-symbol--workflow .mci-symbol__glyph::after { position: absolute; top: 8rpx; left: 15rpx; width: 3rpx; height: 14rpx; background: currentColor; content: ''; }

.mci-symbol--settings .mci-symbol__glyph::before,
.mci-symbol--settings .mci-symbol__glyph::after,
.mci-symbol--settings .mci-symbol__glyph > view:first-child { position: absolute; right: 1rpx; left: 1rpx; height: 3rpx; border-radius: 2rpx; background: currentColor; content: ''; }
.mci-symbol--settings .mci-symbol__glyph::before { top: 6rpx; }
.mci-symbol--settings .mci-symbol__glyph::after { top: 15rpx; }
.mci-symbol--settings .mci-symbol__glyph > view:first-child { top: 24rpx; }
.mci-symbol--settings .mci-symbol__glyph > view:nth-child(2),
.mci-symbol--settings .mci-symbol__glyph > view:nth-child(3) { width: 7rpx; height: 7rpx; border: 3rpx solid currentColor; border-radius: 50%; background: var(--mci-app-surface, #fff); }
.mci-symbol--settings .mci-symbol__glyph > view:nth-child(2) { top: 2rpx; left: 7rpx; box-shadow: 11rpx 9rpx 0 -3rpx var(--mci-app-surface, #fff), 11rpx 9rpx 0 0 currentColor; }
.mci-symbol--settings .mci-symbol__glyph > view:nth-child(3) { top: 20rpx; left: 12rpx; }

.mci-symbol--connection .mci-symbol__glyph > view:first-child,
.mci-symbol--connection .mci-symbol__glyph > view:nth-child(2) { width: 15rpx; height: 10rpx; border: 3rpx solid currentColor; border-radius: 8rpx; }
.mci-symbol--connection .mci-symbol__glyph > view:first-child { top: 3rpx; left: 1rpx; transform: rotate(-38deg); }
.mci-symbol--connection .mci-symbol__glyph > view:nth-child(2) { right: 1rpx; bottom: 3rpx; transform: rotate(-38deg); }
.mci-symbol--connection .mci-symbol__glyph > view:nth-child(3) { top: 14rpx; left: 9rpx; width: 14rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; transform: rotate(-38deg); }
</style>
