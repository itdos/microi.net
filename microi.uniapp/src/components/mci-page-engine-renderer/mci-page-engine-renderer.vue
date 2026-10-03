<template>
  <view class="pe-renderer">
    <view v-for="wrapper in manifest.wrappers" :key="wrapper.key" class="pe-wrapper">
      <template v-if="wrapper.type === 'tabs'">
        <view v-if="wrapper.title" class="pe-wrapper__title">{{ wrapper.title }}</view>
        <view class="pe-tabs" role="tablist">
          <view v-for="tab in wrapper.tabs" :key="tab.key" class="pe-tabs__item"
            :class="{ 'pe-tabs__item--active': activeTab(wrapper) === tab.key }"
            hover-class="pe-tabs__item--pressed" role="tab" @tap="selectTab(wrapper, tab.key)">
            {{ tab.label }}
          </view>
        </view>
        <view v-for="tab in wrapper.tabs" v-show="activeTab(wrapper) === tab.key" :key="`${wrapper.key}:${tab.key}`" class="pe-wrapper__body">
          <template v-for="widget in tab.widgets" :key="widget.key">
            <mci-page-engine-renderer v-if="widget.type === 'pageengine' && widget.child" class="pe-embedded" :manifest="widget.child" />
            <mci-page-engine-widget v-else :widget="widget" />
          </template>
        </view>
      </template>
      <template v-else>
        <view v-if="wrapper.title" class="pe-wrapper__title">{{ wrapper.title }}</view>
        <view class="pe-wrapper__body">
          <template v-for="widget in wrapper.widgets" :key="widget.key">
            <mci-page-engine-renderer v-if="widget.type === 'pageengine' && widget.child" class="pe-embedded" :manifest="widget.child" />
            <mci-page-engine-widget v-else :widget="widget" />
          </template>
        </view>
      </template>
    </view>
  </view>
</template>

<script>
import MciPageEngineWidget from '@/components/mci-page-engine-widget/mci-page-engine-widget.vue'

export default {
  name: 'MciPageEngineRenderer',
  components: { MciPageEngineWidget },
  props: {
    manifest: { type: Object, required: true }
  },
  data() {
    return { activeTabs: {} }
  },
  methods: {
    activeTab(wrapper) {
      return this.activeTabs[wrapper.key] || wrapper.activeTab || wrapper.tabs?.[0]?.key || ''
    },
    selectTab(wrapper, key) {
      this.activeTabs = { ...this.activeTabs, [wrapper.key]: key }
    }
  }
}
</script>

<style lang="scss" scoped>
.pe-renderer { display: flex; flex-direction: column; gap: 20rpx; }
.pe-wrapper { overflow: hidden; border: 1rpx solid var(--mci-border-color, #dfe9ed); border-radius: 22rpx; background: var(--mci-bg-elevated, #fff); box-shadow: 0 8rpx 24rpx rgba(17,74,101,.05); }
.pe-wrapper__title { min-height: 70rpx; padding: 18rpx 24rpx 14rpx; box-sizing: border-box; border-bottom: 1rpx solid var(--mci-border-color, #edf2f4); color: var(--mci-text-primary, #18313d); font-size: 28rpx; line-height: 38rpx; font-weight: 720; }
.pe-wrapper__body { display: flex; flex-direction: column; gap: 18rpx; padding: 20rpx; }
.pe-tabs { display: flex; gap: 10rpx; padding: 16rpx 18rpx 0; overflow-x: auto; border-bottom: 1rpx solid var(--mci-border-color, #edf2f4); }
.pe-tabs__item { position: relative; flex: none; min-height: 70rpx; padding: 0 20rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; color: var(--mci-text-secondary, #647d87); font-size: 25rpx; font-weight: 620; }
.pe-tabs__item::after { position: absolute; right: 18rpx; bottom: 0; left: 18rpx; height: 5rpx; border-radius: 4rpx 4rpx 0 0; background: transparent; content: ''; }
.pe-tabs__item--active { color: var(--mci-color-primary, #087da8); }
.pe-tabs__item--active::after { background: var(--mci-color-primary, #087da8); }
.pe-tabs__item--pressed { opacity: .72; }
.pe-embedded { padding: 4rpx; border-radius: 18rpx; background: var(--mci-bg-base, #f4f8fa); }
@media (prefers-reduced-motion: reduce) { .pe-tabs__item { transition: none; } }
</style>

<style lang="scss" scoped>
.pe-renderer { gap: 14rpx; }
.pe-wrapper { border-color: var(--mci-ops-line, #ccd8dd); border-radius: var(--mci-ops-radius, 10rpx); background: var(--mci-ops-panel-strong, #fff); box-shadow: none; }
.pe-wrapper__title { min-height: 78rpx; padding: 18rpx 20rpx; border-bottom-color: var(--mci-ops-line-soft, #dce5e8); color: var(--mci-ops-ink, #102634); font-size: 27rpx; font-weight: 760; }
.pe-wrapper__body { gap: 16rpx; padding: 20rpx; }
.pe-tabs { gap: 0; padding: 0; border-bottom-color: var(--mci-ops-line-soft, #dce5e8); background: #f2f6f7; }
.pe-tabs__item { min-height: 82rpx; padding: 0 22rpx; color: var(--mci-ops-muted, #687d87); }
.pe-tabs__item--active { color: #176f83; background: #fff; }
.pe-tabs__item--active::after { right: 0; left: 0; height: 4rpx; border-radius: 0; background: var(--mci-ops-accent, #11a7bd); }
.pe-embedded { padding: 0; background: transparent; }
</style>
