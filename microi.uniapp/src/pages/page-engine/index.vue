<template>
  <view class="page-engine-page" :style="mciTokenStyle">
    <view class="page-engine-header mci-safe-top">
      <view class="page-engine-nav mci-safe-nav-row">
        <view class="page-engine-nav__button" hover-class="page-engine-pressed" aria-label="返回" @tap="goBack"><view class="page-engine-nav__back" /></view>
        <view class="page-engine-nav__copy">
          <text class="page-engine-nav__title">{{ pageTitle }}</text>
          <text class="page-engine-nav__subtitle">原生界面 · 当前角色权限</text>
        </view>
        <view class="page-engine-nav__button" hover-class="page-engine-pressed" aria-label="刷新页面" @tap="refreshData"><view class="page-engine-nav__refresh" /></view>
      </view>
    </view>

    <scroll-view class="page-engine-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="reloadPage">
      <mci-skeleton v-if="loading" type="list" :rows="7" />

      <view v-else-if="error" class="page-engine-state">
        <mci-symbol name="info" tone="danger" :size="92" />
        <text class="page-engine-state__title">界面页面加载失败</text>
        <text class="page-engine-state__text">{{ error }}</text>
        <view class="page-engine-state__button" hover-class="page-engine-pressed" @tap="reloadPage">
          <view class="page-engine-state__refresh" /><text>重新加载</text>
        </view>
      </view>

      <view v-else-if="manifest" class="page-engine-content">
        <view v-if="manifest.page.description || manifest.page.number" class="page-engine-intro">
          <view class="page-engine-intro__mark" />
          <view><text>{{ manifest.page.description || '由 Microi 界面引擎配置并在移动端安全渲染' }}</text><text v-if="manifest.page.number">{{ manifest.page.number }}</text></view>
        </view>

        <view v-if="manifest.filters.length" class="page-engine-filter-card">
          <view class="page-engine-section-heading">
            <view><text>筛选条件</text><text>筛选将同步应用到本页动态组件</text></view>
          </view>
          <view class="page-engine-filters">
            <view v-for="filter in manifest.filters" :key="filter.prop" class="page-engine-filter">
              <text class="page-engine-filter__label">{{ filter.label }}</text>
              <picker v-if="filter.type === 'select'" :range="filter.options" range-key="label" @change="selectFilter(filter, $event)">
                <view class="page-engine-filter__control" hover-class="page-engine-pressed">
                  <text>{{ filterLabel(filter) }}</text><view class="page-engine-filter__chevron" />
                </view>
              </picker>
              <input v-else v-model="filterValues[filter.prop]" class="page-engine-filter__input" :placeholder="`请输入${filter.label}`" maxlength="100" confirm-type="search" />
            </view>
          </view>
          <view class="page-engine-filter-actions">
            <view class="page-engine-filter-actions__secondary" hover-class="page-engine-pressed" @tap="resetFilters"><view class="page-engine-filter-actions__reset" /><text>重置</text></view>
            <view class="page-engine-filter-actions__primary" hover-class="page-engine-pressed" @tap="refreshData"><view class="page-engine-filter-actions__search" /><text>{{ dataLoading ? '查询中' : '查询' }}</text></view>
          </view>
        </view>

        <view v-if="manifest.warnings.length" class="page-engine-warning">
          <mci-symbol name="info" tone="plain" :size="42" /><text>本页有 {{ manifest.warnings.length }} 类组件尚未移动化，已安全降级显示。</text>
        </view>

        <mci-page-engine-renderer :manifest="manifest" />

        <view v-if="!manifest.wrappers.length" class="page-engine-empty">
          <image src="/static/microi-blue-256.png" mode="aspectFit" />
          <text>页面还没有可展示的移动组件</text>
          <text>请在 PC 界面设计器中添加平台支持的组件</text>
        </view>

        <view class="page-engine-footnote">
          <view class="page-engine-footnote__shield"><view /></view>
          <text>布局固定按手机满宽重排；接口、页面和数据仍受当前菜单、角色与租户权限约束。</text>
        </view>
        <view class="page-engine-safe-bottom" />
      </view>
    </scroll-view>
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { getToken } from '@/utils/request.js'
import MciPageEngineRenderer from '@/components/mci-page-engine-renderer/mci-page-engine-renderer.vue'
import { loadAuthorizedPageEngine, refreshPageEngineData } from '@/platform/page-engine-runtime.js'
import { pageEngineFilterValues } from '@/platform/page-engine-core.mjs'

export default {
  name: 'NativePageEnginePage',
  components: { MciPageEngineRenderer },
  mixins: [themeMixin],
  data() {
    return {
      menuId: '',
      menu: null,
      manifest: null,
      filterValues: {},
      loading: true,
      dataLoading: false,
      refreshing: false,
      error: '',
      requestId: 0,
      refreshTimer: null
    }
  },
  computed: {
    pageTitle() { return this.manifest?.page?.title || '界面页面' }
  },
  onLoad(options) {
    this.menuId = decodeURIComponent(options.menuId || '')
    if (!getToken()) {
      this.loading = false
      uni.redirectTo({ url: `/pages/login/index?redirect=${encodeURIComponent(`/pages/page-engine/index?menuId=${this.menuId}`)}` })
      return
    }
    this.loadPage()
  },
  onShow() { this.startAutoRefresh() },
  onHide() { this.stopAutoRefresh() },
  onUnload() { this.stopAutoRefresh() },
  methods: {
    async loadPage(refresh = false) {
      if (!this.menuId) {
        this.loading = false
        this.error = '缺少已授权的菜单标识'
        return
      }
      const requestId = ++this.requestId
      this.loading = !refresh
      this.error = ''
      try {
        const result = await loadAuthorizedPageEngine(this.menuId, { refresh })
        if (requestId !== this.requestId) return
        this.menu = result.menu
        this.manifest = result.manifest
        this.filterValues = pageEngineFilterValues(this.manifest)
        this.startAutoRefresh()
      } catch (error) {
        if (requestId === this.requestId) this.error = error && (error.message || error.Msg) || '界面页面加载失败'
      } finally {
        if (requestId === this.requestId) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    async reloadPage() {
      this.refreshing = true
      await this.loadPage(true)
    },
    async refreshData() {
      if (!this.manifest || !this.menu || this.dataLoading) return
      this.dataLoading = true
      try {
        await refreshPageEngineData(this.manifest, this.menu, { ...this.filterValues })
        this.manifest = { ...this.manifest }
      } catch (error) {
        uni.showToast({ title: error.message || '界面数据刷新失败', icon: 'none' })
      } finally {
        this.dataLoading = false
        this.refreshing = false
      }
    },
    filterLabel(filter) {
      const value = this.filterValues[filter.prop]
      const option = filter.options.find((item) => String(item.value) === String(value))
      return option?.label || '请选择'
    },
    selectFilter(filter, event) {
      const option = filter.options[Number(event.detail.value)]
      if (option) this.filterValues = { ...this.filterValues, [filter.prop]: option.value }
    },
    resetFilters() {
      const values = {}
      this.manifest.filters.forEach((filter) => { values[filter.prop] = filter.defaultValue })
      this.filterValues = values
      this.refreshData()
    },
    startAutoRefresh() {
      this.stopAutoRefresh()
      const seconds = Number(this.manifest?.config?.autoRefresh || 0)
      if (seconds <= 0) return
      this.refreshTimer = setInterval(() => this.refreshData(), Math.max(30, seconds) * 1000)
    },
    stopAutoRefresh() {
      if (this.refreshTimer) clearInterval(this.refreshTimer)
      this.refreshTimer = null
    },
    goBack() { uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) }) }
  }
}
</script>

<style lang="scss" scoped>
.page-engine-page { height: 100vh; display: flex; flex-direction: column; overflow: hidden; color: var(--mci-text-primary,#18313d); background: var(--mci-bg-base,#f4f8fa); }
.page-engine-header { flex: none; border-bottom: 1rpx solid var(--mci-border-color,#e4ecef); background: var(--mci-bg-elevated,#fff); }
.page-engine-nav { min-height: 94rpx; padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx; display: grid; grid-template-columns: 70rpx minmax(0,1fr) 70rpx; align-items: center; box-sizing: border-box; }
.page-engine-nav__button { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 16rpx; }
.page-engine-nav__copy { min-width: 0; display: flex; flex-direction: column; align-items: center; }.page-engine-nav__title { max-width: 100%; overflow: hidden; font-size: 31rpx; font-weight: 760; text-overflow: ellipsis; white-space: nowrap; }.page-engine-nav__subtitle { margin-top: 2rpx; color: var(--mci-text-secondary,#748991); font-size: 18rpx; }
.page-engine-nav__back { width: 22rpx; height: 22rpx; border-left: 4rpx solid currentColor; border-bottom: 4rpx solid currentColor; transform: rotate(45deg); }.page-engine-nav__refresh,.page-engine-state__refresh { width: 28rpx; height: 28rpx; border: 3rpx solid currentColor; border-left-color: transparent; border-radius: 50%; box-sizing: border-box; }
.page-engine-scroll { flex: 1; min-height: 0; }.page-engine-content { padding: 22rpx 22rpx 0; }.page-engine-intro { min-height: 86rpx; margin-bottom: 18rpx; padding: 15rpx 18rpx; display: grid; grid-template-columns: 7rpx minmax(0,1fr); align-items: center; gap: 15rpx; box-sizing: border-box; border-radius: 17rpx; background: linear-gradient(135deg,rgba(8,125,168,.09),rgba(49,108,235,.05)); }.page-engine-intro__mark { width: 7rpx; height: 48rpx; border-radius: 5rpx; background: var(--mci-gradient-primary,linear-gradient(#087da8,#18a6b8)); }.page-engine-intro > view:last-child { min-width: 0; display: flex; flex-direction: column; gap: 4rpx; }.page-engine-intro > view:last-child text:first-child { font-size: 22rpx; line-height: 32rpx; }.page-engine-intro > view:last-child text:last-child { color: var(--mci-text-tertiary,#8da0a8); font-size: 18rpx; }
.page-engine-filter-card { margin-bottom: 20rpx; padding: 20rpx; border: 1rpx solid var(--mci-border-color,#dfe9ed); border-radius: 20rpx; background: var(--mci-bg-elevated,#fff); }.page-engine-section-heading > view { display: flex; flex-direction: column; gap: 4rpx; }.page-engine-section-heading text:first-child { font-size: 27rpx; font-weight: 710; }.page-engine-section-heading text:last-child { color: var(--mci-text-secondary,#748991); font-size: 19rpx; }.page-engine-filters { margin-top: 18rpx; display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 15rpx; }.page-engine-filter { min-width: 0; }.page-engine-filter__label { display: block; margin: 0 0 7rpx 4rpx; color: var(--mci-text-secondary,#647d87); font-size: 20rpx; }.page-engine-filter__control,.page-engine-filter__input { width: 100%; height: 76rpx; padding: 0 16rpx; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; border: 1rpx solid var(--mci-border-color,#dce6ea); border-radius: 14rpx; background: var(--mci-bg-base,#f7fafb); color: var(--mci-text-primary,#18313d); font-size: 22rpx; }.page-engine-filter__chevron { width: 13rpx; height: 13rpx; border-right: 3rpx solid var(--mci-text-tertiary,#8da0a8); border-bottom: 3rpx solid var(--mci-text-tertiary,#8da0a8); transform: rotate(45deg) translateY(-4rpx); }.page-engine-filter-actions { margin-top: 18rpx; display: grid; grid-template-columns: 1fr 1.35fr; gap: 14rpx; }.page-engine-filter-actions > view { min-height: 78rpx; display: flex; align-items: center; justify-content: center; gap: 10rpx; border-radius: 39rpx; font-size: 23rpx; font-weight: 650; }.page-engine-filter-actions__secondary { border: 1rpx solid var(--mci-border-color,#d8e4e8); color: var(--mci-text-secondary,#647d87); }.page-engine-filter-actions__primary { color: #fff; background: var(--mci-gradient-primary,linear-gradient(135deg,#087da8,#18a6b8)); box-shadow: 0 8rpx 19rpx rgba(8,125,168,.18); }.page-engine-filter-actions__reset { width: 23rpx; height: 23rpx; border: 3rpx solid currentColor; border-top-color: transparent; border-radius: 50%; }.page-engine-filter-actions__search { position: relative; width: 23rpx; height: 23rpx; border: 3rpx solid currentColor; border-radius: 50%; box-sizing: border-box; }.page-engine-filter-actions__search::after { position: absolute; right: -8rpx; bottom: -4rpx; width: 10rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; transform: rotate(45deg); content: ''; }
.page-engine-warning { min-height: 74rpx; margin-bottom: 18rpx; padding: 13rpx 17rpx; display: flex; align-items: center; gap: 12rpx; box-sizing: border-box; border: 1rpx solid rgba(210,134,25,.23); border-radius: 15rpx; color: #8a5b10; background: rgba(210,134,25,.08); }.page-engine-warning view { flex: none; width: 32rpx; height: 32rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid currentColor; border-radius: 50%; font-size: 18rpx; font-weight: 740; }.page-engine-warning text { font-size: 20rpx; line-height: 30rpx; }
.page-engine-state { min-height: 70vh; padding: 70rpx 42rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; text-align: center; }.page-engine-state__icon { width: 92rpx; height: 92rpx; display: flex; align-items: center; justify-content: center; border-radius: 26rpx; color: #d75a43; background: rgba(215,90,67,.1); font-size: 42rpx; font-weight: 780; }.page-engine-state__title { margin-top: 24rpx; font-size: 30rpx; font-weight: 730; }.page-engine-state__text { margin-top: 10rpx; color: var(--mci-text-secondary,#748991); font-size: 22rpx; line-height: 34rpx; }.page-engine-state__button { min-width: 230rpx; min-height: 82rpx; margin-top: 30rpx; display: flex; align-items: center; justify-content: center; gap: 11rpx; border-radius: 42rpx; color: #fff; background: var(--mci-gradient-primary,linear-gradient(135deg,#087da8,#18a6b8)); font-size: 24rpx; font-weight: 650; }.page-engine-state__button .page-engine-state__refresh { width: 24rpx; height: 24rpx; }
.page-engine-empty { min-height: 360rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; }.page-engine-empty image { width: 104rpx; height: 104rpx; opacity: .7; }.page-engine-empty text:nth-child(2) { margin-top: 18rpx; font-size: 26rpx; font-weight: 680; }.page-engine-empty text:last-child { margin-top: 7rpx; color: var(--mci-text-secondary,#748991); font-size: 21rpx; }.page-engine-footnote { margin: 26rpx 10rpx 0; display: flex; align-items: flex-start; gap: 13rpx; color: var(--mci-text-secondary,#748991); font-size: 19rpx; line-height: 30rpx; }.page-engine-footnote__shield { flex: none; width: 27rpx; height: 31rpx; border: 3rpx solid var(--mci-color-primary,#087da8); border-radius: 11rpx 11rpx 13rpx 13rpx; box-sizing: border-box; }.page-engine-footnote__shield view { width: 8rpx; height: 5rpx; margin: 8rpx auto 0; border-left: 3rpx solid var(--mci-color-primary,#087da8); border-bottom: 3rpx solid var(--mci-color-primary,#087da8); transform: rotate(-45deg); }.page-engine-safe-bottom { height: calc(42rpx + var(--mci-safe-bottom)); }.page-engine-pressed { opacity: .7; transform: scale(.96); }
@media (prefers-reduced-motion: reduce) { .page-engine-pressed { transform: none; } }
</style>

<style lang="scss" scoped>
/* Microi Blue Suite Page Engine: native white navigation and modular report cards. */
.page-engine-page, .page-engine-scroll { background: var(--mci-app-canvas, #f8fafc); }
.page-engine-header { position: relative; overflow: hidden; border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); background: #fff; }
.page-engine-header::after { display: none; }
.page-engine-nav { position: relative; z-index: 1; min-height: 92rpx; }
.page-engine-nav__button { width: 72rpx; height: 72rpx; border-radius: 50%; color: var(--mci-color-primary, #2563eb); }
.page-engine-nav__title { color: var(--mci-text-primary, #111827); font-size: 31rpx; font-weight: 750; letter-spacing: 0; }
.page-engine-nav__subtitle { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 29rpx; letter-spacing: 0; }
.page-engine-content { padding: 20rpx 22rpx 0; }
.page-engine-intro { min-height: 84rpx; margin: 0 0 16rpx; padding: 15rpx 18rpx; grid-template-columns: 6rpx minmax(0,1fr); border: 0; border-radius: 20rpx; background: var(--mci-color-primary-faint, #eff6ff); box-shadow: none; }
.page-engine-intro__mark { width: 6rpx; height: 42rpx; border-radius: 6rpx; background: var(--mci-color-primary, #2563eb); }
.page-engine-intro > view:last-child text:first-child { color: var(--mci-text-primary, #111827); font-size: 23rpx; line-height: 32rpx; }
.page-engine-intro > view:last-child text:last-child { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 30rpx; letter-spacing: 0; }
.page-engine-filter-card { margin-bottom: 16rpx; padding: 22rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.page-engine-section-heading { padding-bottom: 13rpx; border-bottom: 1rpx solid var(--mci-divider, #e5e7eb); }
.page-engine-section-heading text:first-child { color: var(--mci-text-primary, #111827); font-size: 27rpx; font-weight: 750; }
.page-engine-section-heading text:last-child { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 30rpx; }
.page-engine-filters { gap: 14rpx; }
.page-engine-filter__label { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 30rpx; }
.page-engine-filter__control, .page-engine-filter__input { min-height: 84rpx; height: 84rpx; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 18rpx; background: #f8fafc; }
.page-engine-filter-actions > view { min-height: 84rpx; border-radius: 18rpx; }
.page-engine-filter-actions__secondary { border-color: var(--mci-divider, #e5e7eb); color: var(--mci-text-secondary, #667280); background: #fff; }
.page-engine-filter-actions__primary { color: #fff; background: var(--mci-color-primary, #2563eb); box-shadow: none; }
.page-engine-warning { min-height: 84rpx; border-color: rgba(245,158,11,.28); border-radius: 18rpx; color: #92400e; background: #fffbeb; }
.page-engine-state__icon { border-radius: 22rpx; color: #dc2626; background: #fee2e2; }
.page-engine-state__button { min-height: 88rpx; border-radius: 18rpx; background: var(--mci-color-primary, #2563eb); }
.page-engine-empty { border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; }
.page-engine-footnote { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 33rpx; }
.page-engine-footnote__shield { border-color: var(--mci-color-primary, #2563eb); border-radius: 10rpx; }
</style>
