<template>
  <mci-page-shell class="workbench-page" :style="mciTokenStyle" tone="light" title="工作台" :subtitle="workbenchSubtitle" :back="false" :show-dock="false">
    <template #right>
      <view v-if="isLoggedIn && runtimeBusinessGroups.length" class="workbench-all-categories" hover-class="workbench-all-categories--pressed" role="button" tabindex="0" aria-label="查看全部应用分类" @tap="categorySheetVisible = true" @keyup.enter="categorySheetVisible = true" @keyup.space.prevent="categorySheetVisible = true">分类</view>
    </template>
    <view class="workbench-body">
      <view v-if="isLoggedIn" class="workbench-search">
        <view class="workbench-search__icon" aria-hidden="true"><view /></view>
        <input v-model="keyword" confirm-type="search" placeholder="搜索应用或业务模块" maxlength="40" @confirm="blurSearch" />
        <view v-if="keyword" class="workbench-search__clear" hover-class="workbench-search__clear--pressed" role="button" tabindex="0" aria-label="清空搜索" @tap="keyword = ''" @keyup.enter="keyword = ''"><view class="mci-icon-close" aria-hidden="true" /></view>
        <view v-else-if="isLoggedIn" class="workbench-search__refresh" :class="{ 'workbench-search__refresh--loading': refreshing }" hover-class="workbench-search__refresh--pressed" role="button" tabindex="0" aria-label="刷新应用" @tap="refreshModules" @keyup.enter="refreshModules"><view aria-hidden="true" /></view>
      </view>

      <view v-if="!isLoggedIn" class="workbench-auth">
        <mci-auth-prompt title="登录后查看工作台" desc="应用入口、菜单和数据范围均由当前账号权限决定" action-text="立即登录" @action="goLogin" />
      </view>

      <view v-else class="workbench-browser">
        <view v-if="!keyword && runtimeBusinessGroups.length" class="workbench-filters" aria-label="应用分类">
          <view class="workbench-filter-track">
            <view class="workbench-filter" :class="{ 'workbench-filter--active': !activeGroupKey }" hover-class="workbench-filter--pressed" role="button" tabindex="0" :aria-expanded="categoryFiltersExpanded" :aria-label="categoryFiltersExpanded ? '收起应用分类' : '展开应用分类'" @tap="toggleCategoryFilters" @keyup.enter="toggleCategoryFilters" @keyup.space.prevent="toggleCategoryFilters">
              <mci-symbol name="app" tone="plain" :size="34" />
              <text>全部</text>
              <view class="workbench-filter__toggle mci-icon-chevron mci-icon-chevron--down" :class="{ 'mci-icon-chevron--open': categoryFiltersExpanded }" aria-hidden="true" />
            </view>
            <block v-if="categoryFiltersExpanded">
              <view v-for="group in runtimeBusinessGroups" :key="group.key" class="workbench-filter" :class="{ 'workbench-filter--active': group.key === activeGroupKey }" hover-class="workbench-filter--pressed" role="button" tabindex="0" @tap="selectGroup(group.key)" @keyup.enter="selectGroup(group.key)">
                <mci-symbol :name="semanticIcon(group)" tone="plain" :size="34" />
                <text>{{ group.title }}</text>
              </view>
            </block>
          </view>
        </view>
        <view class="workbench-results">
          <view class="workbench-content">
            <mci-skeleton v-if="loading && !runtimeBusinessGroups.length" type="list" :rows="6" />

            <view v-else-if="!visibleGroups.length" class="workbench-empty">
              <mci-symbol name="app" :size="96" />
              <text class="workbench-empty__title">{{ keyword ? '没有匹配的应用' : '暂无可用应用' }}</text>
              <text class="workbench-empty__text">{{ keyword ? '换一个业务名称试试' : '请联系管理员检查菜单与角色权限' }}</text>
              <view v-if="keyword" class="workbench-empty__button" hover-class="workbench-empty__button--pressed" role="button" tabindex="0" @tap="keyword = ''" @keyup.enter="keyword = ''">
                <view class="workbench-empty__button-icon" aria-hidden="true" />
                <text>清空搜索</text>
              </view>
            </view>

            <view v-else class="workbench-groups">
              <view v-for="(group, groupIndex) in visibleGroups" :key="group.key" class="workbench-group" :style="{ animationDelay: `${Math.min(groupIndex, 5) * 42}ms` }">
                <view class="workbench-group__heading" hover-class="workbench-group__heading--pressed" role="button" tabindex="0" :aria-expanded="isGroupExpanded(group)" :aria-label="`${isGroupExpanded(group) ? '收起' : '展开'}${group.title}`" @tap="toggleGroup(group.key)" @keyup.enter="toggleGroup(group.key)" @keyup.space.prevent="toggleGroup(group.key)">
                  <view class="workbench-group__identity">
                    <mci-symbol :name="semanticIcon(group)" :size="58" />
                    <view class="workbench-group__copy">
                      <text class="workbench-group__title">{{ group.title }}</text>
                      <text class="workbench-group__subtitle">{{ group.items.length }} 个应用</text>
                    </view>
                  </view>
                  <view class="workbench-group__aside">
                    <text v-if="keyword" class="workbench-group__result">匹配</text>
                    <view class="workbench-group__toggle mci-icon-chevron mci-icon-chevron--down" :class="{ 'mci-icon-chevron--open': isGroupExpanded(group) }" aria-hidden="true" />
                  </view>
                </view>
                <view v-if="isGroupExpanded(group)" class="workbench-list" role="list" :aria-label="`${group.title}应用`">
                  <view v-for="item in group.items" :key="item.key" class="workbench-item" hover-class="workbench-item--pressed" role="button" tabindex="0" @tap="openModule(item)" @keyup.enter="openModule(item)">
                    <view v-if="hasUsableIcon(item.icon)" class="workbench-item__asset" :style="{ backgroundColor: `${item.accent || group.accent || '#087da8'}10` }">
                      <image :src="safeIcon(item.icon)" mode="aspectFit" aria-hidden="true" />
                    </view>
                    <mci-symbol v-else :name="semanticIcon(item)" :size="70" />
                    <view class="workbench-item__copy">
                      <text class="workbench-item__title">{{ item.title }}</text>
                    </view>
                  </view>
                </view>
              </view>
            </view>
            <view v-if="pageCredit" class="workbench-credit" aria-label="平台技术支持">
              <text>{{ pageCredit }}</text>
            </view>
            <view class="mci-tabbar-spacer" aria-hidden="true" />
          </view>
        </view>
      </view>
    </view>
    <view v-if="categorySheetVisible" class="workbench-category-mask" @tap="categorySheetVisible = false">
      <view class="workbench-category-sheet" role="dialog" aria-modal="true" aria-label="全部应用分类" @tap.stop>
        <view class="workbench-category-sheet__head">
          <view><text>全部分类</text><text>{{ runtimeBusinessGroups.length }} 个业务空间</text></view>
          <view class="workbench-category-sheet__close" role="button" tabindex="0" aria-label="关闭分类" @tap="categorySheetVisible = false" @keyup.enter="categorySheetVisible = false" @keyup.space.prevent="categorySheetVisible = false"><view class="mci-icon-close" aria-hidden="true" /></view>
        </view>
        <scroll-view class="workbench-category-sheet__scroll" scroll-y>
          <view class="workbench-category-sheet__grid">
            <view class="workbench-category-sheet__item" :class="{ 'workbench-category-sheet__item--active': !activeGroupKey }" role="button" tabindex="0" @tap="selectGroupFromSheet('')" @keyup.enter="selectGroupFromSheet('')" @keyup.space.prevent="selectGroupFromSheet('')">
              <mci-symbol name="app" tone="plain" :size="42" />
              <view><text>全部应用</text><text>{{ runtimeBusinessGroups.length }} 个业务空间</text></view>
            </view>
            <view v-for="group in runtimeBusinessGroups" :key="group.key" class="workbench-category-sheet__item" :class="{ 'workbench-category-sheet__item--active': group.key === activeGroupKey }" role="button" tabindex="0" @tap="selectGroupFromSheet(group.key)" @keyup.enter="selectGroupFromSheet(group.key)" @keyup.space.prevent="selectGroupFromSheet(group.key)">
              <mci-symbol :name="semanticIcon(group)" tone="plain" :size="42" />
              <view><text>{{ group.title }}</text><text>{{ group.items.length }} 个应用</text></view>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </mci-page-shell>
  <mci-ai-launcher />
</template>

<script>
import MciAuthPrompt from '@/components/mci-auth-prompt/mci-auth-prompt.vue'
import MciSymbol from '@/components/mci-symbol/mci-symbol.vue'
import { getToken, getUser, removeToken } from '@/utils/request.js'
import { themeMixin } from '@/utils/theme.js'
import { loadAccessibleModuleGroups } from '@/platform/module-registry.js'
import { rememberRecentModule } from '@/platform/home-recent.js'
import { openModuleEntry } from '@/platform/module-navigation.mjs'
import { getProfileRoute } from '@/platform/profile/index.js'
import { publicAssetUrl } from '@/platform/display.js'
import { resolveSemanticIcon } from '@/platform/semantic-icon.mjs'
import shareMixin from '@/utils/share.js'
import appConfig from '@/config.js'
import { reLaunchToLogin } from '@/platform/auth-entry.mjs'
import {
  expandWorkspaceGroup,
  initialExpandedWorkspaceGroups,
  normalizeExpandedWorkspaceGroups,
  toggleWorkspaceCategoryFilters,
  toggleWorkspaceGroup
} from '@/platform/workspace-group-state.mjs'

export default {
  name: 'NativeWorkbenchPage',
  components: { MciAuthPrompt, MciSymbol },
  mixins: [themeMixin, shareMixin],
  data() {
    return {
      isLoggedIn: false,
      currentUser: {},
      runtimeBusinessGroups: [],
      activeGroupKey: '',
      expandedGroupKeys: [],
      workspaceGroupsInitialized: false,
      categoryFiltersExpanded: false,
      keyword: '',
      loading: false,
      refreshing: false,
      categorySheetVisible: false,
      requestId: 0
    }
  },
  computed: {
    pageCredit() { return String(appConfig.pageCredit || '') },
    workbenchSubtitle() {
      return this.isLoggedIn
        ? `${this.runtimeBusinessGroups.reduce((count, group) => count + group.items.length, 0)} 个授权应用`
        : this.runtimeBranding.platformName
    },
    filteredGroups() {
      const keyword = this.keyword.trim().toLowerCase()
      if (!keyword) return this.runtimeBusinessGroups
      return this.runtimeBusinessGroups.map((group) => ({
        ...group,
        items: (group.items || []).filter((item) => [item.title, item.description, item.table, item.parentName]
          .some((value) => String(value || '').toLowerCase().includes(keyword)))
      })).filter((group) => group.items.length)
    },
    visibleGroups() {
      if (this.keyword.trim()) return this.filteredGroups
      if (!this.activeGroupKey) return this.runtimeBusinessGroups
      const group = this.runtimeBusinessGroups.find((item) => item.key === this.activeGroupKey)
      return group ? [group] : this.runtimeBusinessGroups
    }
  },
  onShow() {
    uni.$emit('mci:tab-route', 'pages/workspace/index')
    const token = getToken()
    const user = getUser() || {}
    this.isLoggedIn = !!token && !!user.Id
    this.currentUser = this.isLoggedIn ? user : {}
    if (!this.isLoggedIn) {
      if (token) removeToken()
      this.requestId += 1
      this.runtimeBusinessGroups = []
      this.expandedGroupKeys = []
      this.workspaceGroupsInitialized = false
      this.categoryFiltersExpanded = false
      this.loading = false
      reLaunchToLogin()
      return
    }
    this.loadModules()
  },
  methods: {
    hasUsableIcon(value) {
      const source = String(value || '').trim()
      return /^(?:https?:|data:|\/|static\/)/i.test(source) && !/microi-blue-256/i.test(source)
    },
    semanticIcon(source) { return resolveSemanticIcon(source) },
    safeIcon(value) {
      const source = String(value || '').trim()
      if (!source || !/^(?:https?:|data:|\/|static\/)/i.test(source)) return '/static/microi-blue-256.png'
      return publicAssetUrl(source)
    },
    async loadModules(refresh = false) {
      if (this.loading && !refresh) return
      const requestId = ++this.requestId
      this.loading = true
      try {
        const groups = await loadAccessibleModuleGroups(refresh)
        if (requestId === this.requestId) {
          this.runtimeBusinessGroups = groups
          if (!this.workspaceGroupsInitialized && groups.length) {
            this.expandedGroupKeys = initialExpandedWorkspaceGroups(groups)
            this.workspaceGroupsInitialized = true
          } else {
            this.expandedGroupKeys = normalizeExpandedWorkspaceGroups(this.expandedGroupKeys, groups)
          }
          const app = typeof getApp === 'function' ? getApp() : null
          const requestedKey = String(app?.globalData?.mciWorkspaceGroupHint || '')
          if (app?.globalData) app.globalData.mciWorkspaceGroupHint = ''
          if (requestedKey && groups.some((group) => group.key === requestedKey)) {
            this.activeGroupKey = requestedKey
            this.expandedGroupKeys = expandWorkspaceGroup(this.expandedGroupKeys, groups, requestedKey)
          }
          else if (this.activeGroupKey && !groups.some((group) => group.key === this.activeGroupKey)) this.activeGroupKey = ''
        }
      } catch (error) {
        if (requestId === this.requestId) {
          console.warn('[Microi Workbench] 应用加载失败:', error && (error.message || error))
          uni.showToast({ title: '工作台加载失败，下拉可重试', icon: 'none' })
        }
      } finally {
        if (requestId === this.requestId) this.loading = false
      }
    },
    openModule(item) {
      rememberRecentModule(item)
      openModuleEntry(item)
    },
    isGroupExpanded(group) {
      if (this.keyword.trim()) return true
      return this.expandedGroupKeys.includes(String(group && group.key || ''))
    },
    toggleGroup(key) {
      if (this.keyword.trim()) return
      this.expandedGroupKeys = toggleWorkspaceGroup(this.expandedGroupKeys, this.runtimeBusinessGroups, key)
    },
    toggleCategoryFilters() {
      this.activeGroupKey = ''
      this.categoryFiltersExpanded = toggleWorkspaceCategoryFilters(this.categoryFiltersExpanded)
    },
    selectGroup(key) {
      const groupKey = String(key || '')
      if (!groupKey) {
        this.activeGroupKey = ''
        return
      }
      this.activeGroupKey = groupKey
      this.expandedGroupKeys = expandWorkspaceGroup(this.expandedGroupKeys, this.runtimeBusinessGroups, groupKey)
    },
    selectGroupFromSheet(key) {
      this.selectGroup(key)
      this.categorySheetVisible = false
    },
    goLogin() { uni.navigateTo({ url: getProfileRoute('login', '/pages/login/index') }) },
    blurSearch() { try { uni.hideKeyboard() } catch (error) {} },
    async refreshModules() {
      this.refreshing = true
      try { await this.loadModules(true) } finally { this.refreshing = false }
    }
  }
}
</script>

<style lang="scss" scoped>
.workbench-page { min-height: 100vh; height: auto; overflow: visible; background: var(--mci-app-canvas, #f4f6f5); }
.workbench-body { min-height: calc(100vh - var(--mci-header-height, 44px) - var(--mci-safe-top)); height: auto; display: flex; flex-direction: column; overflow: visible; }
.workbench-search { position: relative; z-index: 3; flex: none; min-height: 88rpx; margin: -10rpx 24rpx 20rpx; padding: 0 18rpx; display: grid; grid-template-columns: 42rpx minmax(0, 1fr) 72rpx; align-items: center; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 22rpx; background: var(--mci-app-surface, #fff); box-shadow: var(--mci-shadow-contact); }
.workbench-search__icon { position: relative; width: 30rpx; height: 30rpx; box-sizing: border-box; border: 3rpx solid var(--mci-text-tertiary, #879aa3); border-radius: 50%; }
.workbench-search__icon view { position: absolute; right: -9rpx; bottom: -5rpx; width: 13rpx; height: 3rpx; border-radius: 3rpx; background: var(--mci-text-tertiary, #879aa3); transform: rotate(45deg); }
.workbench-search input { width: 100%; height: 86rpx; padding: 0 14rpx; box-sizing: border-box; color: var(--mci-text-primary, #17313b); font-size: 27rpx; }
.workbench-search__clear { width: 72rpx; height: 72rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--mci-text-secondary, #657b85); font-size: 34rpx; line-height: 1; }
.workbench-search__clear--pressed { background: rgba(8,125,168,.08); transform: scale(.93); }
.workbench-search__refresh { position: relative; width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: var(--mci-color-primary, #2563eb); }
.workbench-search__refresh > view { width: 25rpx; height: 25rpx; box-sizing: border-box; border: 3rpx solid currentColor; border-left-color: transparent; border-radius: 50%; }
.workbench-search__refresh > view::after { position: absolute; top: 16rpx; right: 14rpx; width: 9rpx; height: 9rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; transform: rotate(17deg); content: ''; }
.workbench-search__refresh--pressed { background: var(--mci-color-primary-faint, rgba(37,99,235,.06)); transform: scale(.93); }
.workbench-search__refresh--loading > view { animation: workbenchRefresh .7s linear infinite; }
.workbench-auth { flex: 1; min-height: 0; display: flex; padding-bottom: calc(var(--mci-tabbar-height, 142rpx) + 28rpx + var(--mci-safe-bottom, 0px)); box-sizing: border-box; }
.workbench-browser { flex: 1 0 auto; min-height: 0; display: flex; overflow: visible; border-top: 1rpx solid var(--mci-divider, rgba(20,65,84,.08)); }
.workbench-categories { flex: none; width: 170rpx; height: 100%; background: var(--mci-app-surface-soft, #eef3f2); }
.workbench-category { position: relative; min-height: 120rpx; padding: 16rpx 12rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7rpx; box-sizing: border-box; color: var(--mci-text-secondary, #657b85); text-align: center; transition: background-color .16s ease, color .16s ease; }
.workbench-category::before { position: absolute; top: 27rpx; bottom: 27rpx; left: 0; width: 6rpx; border-radius: 0 6rpx 6rpx 0; background: transparent; content: ''; }
.workbench-category > text { max-width: 132rpx; overflow: hidden; font-size: 22rpx; line-height: 29rpx; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.workbench-category--active { color: var(--mci-color-primary, #087da8); background: var(--mci-app-surface, #fff); }
.workbench-category--active::before { background: var(--mci-color-primary, #087da8); }
.workbench-category--pressed { background: var(--mci-color-primary-faint, rgba(8,125,168,.06)); }
.workbench-results { flex: 1; min-width: 0; height: 100%; background: var(--mci-app-canvas, #f4f6f5); }
.workbench-content { min-height: 100%; padding: 22rpx 20rpx 24rpx; box-sizing: border-box; }
.workbench-groups { display: flex; flex-direction: column; gap: 28rpx; }
.workbench-group { overflow: hidden; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 20rpx; background: var(--mci-app-surface, #fff); box-shadow: 0 8rpx 24rpx rgba(17,74,101,.045); animation: none; }
.workbench-group__heading { min-height: 88rpx; padding: 8rpx 16rpx; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; transition: background-color .15s ease; }
.workbench-group__heading--pressed { background: var(--mci-color-primary-faint, rgba(8,125,168,.052)); }
.workbench-group__identity { min-width: 0; display: flex; align-items: center; gap: 12rpx; }
.workbench-group__copy { min-width: 0; display: flex; flex-direction: column; }
.workbench-group__title { max-width: 340rpx; overflow: hidden; color: var(--mci-text-primary, #17313d); font-size: 30rpx; line-height: 38rpx; font-weight: 720; text-overflow: ellipsis; white-space: nowrap; }
.workbench-group__subtitle { margin-top: 2rpx; color: var(--mci-text-secondary, #75909c); font-size: 21rpx; }
.workbench-group__aside { flex: none; display: flex; align-items: center; gap: 12rpx; }
.workbench-group__result { flex: none; color: var(--mci-color-primary, #087da8); font-size: 20rpx; }
.workbench-group__toggle, .workbench-filter__toggle { flex: none; color: var(--mci-text-tertiary, #8da0a8); transition: transform .15s ease; }
.workbench-group__toggle { width: 28rpx; height: 28rpx; }
.workbench-filter__toggle { width: 24rpx; height: 24rpx; margin-left: -2rpx; }
.workbench-list { overflow: hidden; border-top: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); background: var(--mci-app-surface, #fff); }
.workbench-item { min-width: 0; min-height: 112rpx; padding: 15rpx 16rpx; display: grid; grid-template-columns: 64rpx minmax(0, 1fr) 30rpx; align-items: center; gap: 14rpx; box-sizing: border-box; border-bottom: 1rpx solid var(--mci-divider, rgba(20,65,84,.09)); transition: transform .15s ease, background-color .15s ease; }
.workbench-item:last-child { border-bottom: 0; }
.workbench-item--pressed { transform: scale(.99); background: var(--mci-color-primary-faint, rgba(8,125,168,.052)); }
.workbench-item__asset { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; border-radius: 18rpx; }
.workbench-item__asset image { width: 46rpx; height: 46rpx; }
.workbench-item__copy { min-width: 0; display: flex; flex-direction: column; }
.workbench-item__title, .workbench-item__desc { width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workbench-item__title { color: var(--mci-text-primary, #284652); font-size: 26rpx; line-height: 35rpx; font-weight: 680; }
.workbench-item__desc { margin-top: 3rpx; color: var(--mci-text-tertiary, #8da0a8); font-size: 20rpx; line-height: 29rpx; }
.workbench-item__arrow { width: 12rpx; height: 12rpx; border-top: 3rpx solid var(--mci-text-tertiary, #8da0a8); border-right: 3rpx solid var(--mci-text-tertiary, #8da0a8); transform: rotate(45deg); }
.workbench-credit { min-height: 92rpx; margin: 34rpx -20rpx 0; padding: 22rpx 20rpx; display: flex; align-items: center; justify-content: center; box-sizing: border-box; border-top: 1rpx solid var(--mci-divider, #e5e7eb); background: linear-gradient(180deg, var(--mci-color-primary-faint, rgba(37,99,235,.045)), transparent); }
.workbench-credit text { color: var(--mci-text-secondary, #667280); font-size: 22rpx; line-height: 32rpx; font-weight: 500; letter-spacing: .4rpx; text-align: center; }
.workbench-empty { min-height: 620rpx; padding: 70rpx 36rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; box-sizing: border-box; }
.workbench-empty__title { margin-top: 24rpx; font-size: 31rpx; font-weight: 700; }
.workbench-empty__text { margin-top: 10rpx; color: var(--mci-text-secondary, #657b85); font-size: 24rpx; text-align: center; }
.workbench-empty__button { min-width: 220rpx; min-height: 88rpx; margin-top: 34rpx; padding: 0 32rpx; display: flex; align-items: center; justify-content: center; gap: 12rpx; box-sizing: border-box; border-radius: 20rpx; background: var(--mci-color-primary, #087da8); color: #fff; box-shadow: 0 8rpx 22rpx rgba(8,125,168,.18); transition: transform .15s ease; }
.workbench-empty__button--pressed { transform: scale(.96); }
.workbench-empty__button-icon { position: relative; width: 27rpx; height: 27rpx; border: 3rpx solid currentColor; border-radius: 50%; box-sizing: border-box; }
.workbench-empty__button-icon::after { position: absolute; top: -6rpx; right: -5rpx; width: 11rpx; height: 11rpx; border-top: 3rpx solid currentColor; transform: rotate(20deg); content: ''; }
.workbench-empty__button text { font-size: 27rpx; font-weight: 650; }
@keyframes workbenchRefresh { to { transform: rotate(360deg); } }
@media (max-width: 340px) { .workbench-categories { width: 148rpx; }.workbench-category > text { max-width: 112rpx; }.workbench-content { padding-right: 14rpx; padding-left: 14rpx; } }
@media (prefers-reduced-motion: reduce) { .workbench-group { animation: none; } .workbench-item, .workbench-empty__button, .workbench-category, .workbench-group__heading, .workbench-group__toggle, .workbench-filter__toggle { transition: none; } }
</style>

<style lang="scss" scoped src="./workspace-signal.scss"></style>
