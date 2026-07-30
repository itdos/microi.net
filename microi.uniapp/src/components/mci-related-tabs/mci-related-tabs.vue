<template>
  <view v-if="items.length" class="related-tabs">
    <scroll-view class="related-tabs__scroll" scroll-x :show-scrollbar="false">
      <view class="related-tabs__track">
        <view
          v-for="item in items"
          :key="item.key"
          class="related-tabs__item"
          :class="{ 'related-tabs__item--active': item.key === activeKey }"
          hover-class="related-tabs__item--pressed"
          @tap="$emit('select', item)"
        >
          <image v-if="item.icon" class="related-tabs__icon" :src="item.icon" mode="aspectFit" />
          <text class="related-tabs__label">{{ item.label }}</text>
          <text v-if="item.count !== undefined && item.count !== null" class="related-tabs__count">
            {{ item.count }}
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
export default {
  name: 'MciRelatedTabs',
  props: {
    items: {
      type: Array,
      default: () => []
    },
    activeKey: {
      type: String,
      default: ''
    }
  },
  emits: ['select']
}
</script>

<style scoped>
.related-tabs {
  position: relative;
  z-index: 2;
  display: block;
  width: 100%;
  margin: 0;
  border-bottom: 1px solid var(--mci-border, #e5edef);
  background: var(--mci-card, #fff);
  box-sizing: border-box;
}

.related-tabs__scroll {
  display: block;
  width: 100%;
  white-space: nowrap;
}

.related-tabs__track {
  display: inline-flex;
  min-width: 100%;
  padding: 0;
  box-sizing: border-box;
}

.related-tabs__item {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 132rpx;
  height: 82rpx;
  padding: 0 18rpx;
  color: var(--mci-text-secondary, #607983);
  box-sizing: border-box;
  transition: color .16s ease, background .16s ease, transform .16s ease;
}

.related-tabs__item::after {
  position: absolute;
  right: 18rpx;
  bottom: 0;
  left: 18rpx;
  height: 5rpx;
  border-radius: 5rpx 5rpx 0 0;
  background: transparent;
  content: '';
}

.related-tabs__item--active {
  color: var(--mci-primary, #087da8);
  font-weight: 700;
}

.related-tabs__item--active::after {
  background: linear-gradient(90deg, var(--mci-primary, #087da8), var(--mci-accent, #e54625));
}

.related-tabs__item--pressed {
  background: var(--mci-fill-light, #f1f7f9);
  transform: scale(.98);
}

.related-tabs__icon {
  width: 34rpx;
  height: 34rpx;
}

.related-tabs__label {
  font-size: 23rpx;
  line-height: 1;
}

.related-tabs__count {
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 7rpx;
  border-radius: 15rpx;
  color: var(--mci-primary, #087da8);
  background: var(--mci-primary-soft, #eaf6fa);
  font-size: 18rpx;
  line-height: 30rpx;
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .related-tabs__item {
    transition: none;
  }
}
</style>
