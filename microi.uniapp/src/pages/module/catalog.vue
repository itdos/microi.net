<template>
  <mci-page-shell class="module-catalog" :style="mciTokenStyle" title="全部应用" subtitle="按当前账号权限动态展示" @back="goBack">
    <mci-skeleton v-if="loading" type="list" :rows="6" />
    <view v-else-if="error" class="state-panel">
      <text class="state-panel__title">应用加载失败</text>
      <text class="state-panel__text">{{ error }}</text>
      <view class="mci-btn" @tap="loadModules(true)">重新加载</view>
    </view>
    <view v-else-if="groups.length" class="catalog-content">
      <view v-for="(group, index) in groups" :key="group.key" class="module-group mci-fade-up"
        :style="{ animationDelay: `${Math.min(index, 6) * 45}ms` }">
        <view class="module-group__header">
          <view class="module-group__mark" :style="{ backgroundColor: group.accent }"></view>
          <view>
            <text class="module-group__title">{{ group.title }}</text>
            <text class="module-group__subtitle">{{ group.subtitle }}</text>
          </view>
        </view>
        <view class="module-grid">
          <view v-for="item in group.items" :key="item.key" class="module-item"
            hover-class="module-item--pressed" @tap="openModule(item)">
            <view class="module-item__icon" :style="{ backgroundColor: `${item.accent}14` }">
              <image :src="item.icon" mode="aspectFit" />
            </view>
            <text class="module-item__name">{{ item.title }}</text>
          </view>
        </view>
      </view>
    </view>
    <view v-else class="state-panel">
      <text class="state-panel__title">暂无可用应用</text>
      <text class="state-panel__text">当前账号尚未分配移动端业务菜单</text>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { requireLogin } from '@/platform/business-runtime.js'
import { loadAccessibleModuleGroups } from '@/platform/module-registry.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      loading: true,
      groups: [],
      error: ''
    }
  },
  onShow() {
    if (!requireLogin()) {
      this.loading = false
      return
    }
    this.loadModules()
  },
  methods: {
    async loadModules(refresh = false) {
      this.loading = true
      this.error = ''
      try {
        this.groups = await loadAccessibleModuleGroups(refresh)
      } catch (error) {
        this.error = error.message || '应用加载失败'
      } finally {
        this.loading = false
      }
    },
    openModule(item) {
      uni.navigateTo({
        url: `/pages/module/list?menuId=${encodeURIComponent(item.menuId || item.key)}`
      })
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style scoped>
.module-catalog { min-height: 100vh; background: #f4f8fa; }
.catalog-content { padding: 20rpx 22rpx calc(40rpx + var(--mci-safe-bottom)); }
.module-group { margin-bottom: 20rpx; overflow: hidden; border: 1px solid var(--mci-border, #e3ecef); border-radius: 8px; background: #fff; }
.module-group__header { display: flex; align-items: center; gap: 14rpx; padding: 24rpx; border-bottom: 1px solid #edf2f4; }
.module-group__mark { width: 7rpx; height: 42rpx; border-radius: 4rpx; }
.module-group__header > view:last-child { min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }
.module-group__title { color: #17313b; font-size: 29rpx; font-weight: 750; }
.module-group__subtitle { color: #81949c; font-size: 21rpx; }
.module-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx 4rpx; padding: 24rpx 12rpx; }
.module-item { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 12rpx; padding: 12rpx 4rpx; transition: transform .16s ease, opacity .16s ease; }
.module-item--pressed { opacity: .78; transform: scale(.97); }
.module-item__icon { width: 82rpx; height: 82rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; }
.module-item__icon image { width: 58rpx; height: 58rpx; }
.module-item__name { width: 100%; overflow: hidden; color: #29454f; font-size: 23rpx; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.state-panel { min-height: 62vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 40rpx; text-align: center; }
.state-panel__title { color: #17313b; font-size: 31rpx; font-weight: 750; }
.state-panel__text { max-width: 560rpx; color: #7b8f97; font-size: 24rpx; line-height: 1.6; }
.state-panel .mci-btn { min-width: 220rpx; margin-top: 12rpx; }
@media (prefers-reduced-motion: reduce) { .module-item { transition: none; } }
</style>
