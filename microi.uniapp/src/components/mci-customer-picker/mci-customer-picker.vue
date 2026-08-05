<template>
  <root-portal v-if="visible">
    <view class="customer-picker__mask" @tap="close">
      <view class="customer-picker__sheet" @tap.stop>
        <view class="customer-picker__handle"></view>
        <view class="customer-picker__header">
          <view>
            <text class="customer-picker__title">选择客户</text>
            <text class="customer-picker__subtitle">仅展示当前账号有权查看的客户</text>
          </view>
          <view class="customer-picker__close" hover-class="is-pressed" @tap="close"><text>×</text></view>
        </view>

        <view class="customer-picker__search">
          <view class="customer-picker__search-icon"></view>
          <input
            v-model="keyword"
            class="customer-picker__search-input"
            confirm-type="search"
            placeholder="搜索客户名称、联系人或电话"
            @input="scheduleSearch"
            @confirm="search"
          />
          <view v-if="keyword" class="customer-picker__clear" @tap="clearSearch"><text>×</text></view>
        </view>

        <scroll-view class="customer-picker__list" scroll-y lower-threshold="100" @scrolltolower="loadMore">
          <mci-skeleton v-if="loading && !rows.length" type="list" :rows="5" />
          <view v-else-if="error && !rows.length" class="customer-picker__state">
            <text>{{ error }}</text>
            <view class="customer-picker__retry" @tap="loadRows(true)"><text>重新加载</text></view>
          </view>
          <view v-else-if="!rows.length" class="customer-picker__state">
            <text class="customer-picker__state-title">未找到匹配客户</text>
            <text class="customer-picker__state-note">可关闭窗口后直接手动输入拜访对象</text>
          </view>
          <view v-else class="customer-picker__rows">
            <view
              v-for="row in rows"
              :key="row.Id"
              class="customer-picker__row"
              :class="{ selected: String(row.Id) === String(selectedId) }"
              hover-class="is-pressed"
              @tap="select(row)"
            >
              <view class="customer-picker__avatar"><text>{{ customerName(row).slice(0, 1) || '客' }}</text></view>
              <view class="customer-picker__main">
                <view class="customer-picker__name-line">
                  <text class="customer-picker__name">{{ customerName(row) }}</text>
                  <text v-if="scopeLabel(row)" class="customer-picker__scope">{{ scopeLabel(row) }}</text>
                </view>
                <text class="customer-picker__meta">{{ customerMeta(row) }}</text>
              </view>
              <view class="customer-picker__check" :class="{ selected: String(row.Id) === String(selectedId) }">
                <text>{{ String(row.Id) === String(selectedId) ? '✓' : '›' }}</text>
              </view>
            </view>
            <view class="customer-picker__footer">
              <text>{{ loading ? '正在加载…' : finished ? `共 ${total} 条` : '上拉加载更多' }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
  </root-portal>
</template>

<script>
import { getBusinessModule } from '@/platform/business.js'
import { findMenu, loadModuleRows } from '@/platform/business-runtime.js'
import { formatRegionValue } from '@/platform/display.js'
import { getUser } from '@/utils/request.js'

export default {
  name: 'MciCustomerPicker',
  props: {
    visible: { type: Boolean, default: false },
    selectedId: { type: [String, Number], default: '' }
  },
  emits: ['close', 'select'],
  data() {
    return {
      keyword: '',
      rows: [],
      pageIndex: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      error: '',
      searchTimer: null,
      loadRequestId: 0,
      moduleConfig: null
    }
  },
  computed: {
    finished() { return this.total > 0 && this.rows.length >= this.total }
  },
  watch: {
    visible(value) {
      if (value && !this.rows.length) this.loadRows(true)
      if (!value) clearTimeout(this.searchTimer)
    }
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
  },
  methods: {
    close() { this.$emit('close') },
    customerName(row) { return String(row.KehuMC || row.Name || row.Bianhao || '未命名客户') },
    customerMeta(row) {
      const region = formatRegionValue(row.Chengshi || '')
      return [row.LianxiR, row.ShoujiH || row.Phone, region, row.Zhuangtai].filter(Boolean).join(' · ') || '客户资料'
    },
    scopeLabel(row) {
      const followState = String(row.KehuGJZT || row.GenjinZT || '')
      if (/公海/.test(followState)) return '公海'
      const user = getUser() || {}
      const ownerId = String(row.FuzeRID || row.FuzeRId || row.UserId || '')
      const ownerName = String(row.FuzeR || row.UserName || '')
      if ((ownerId && ownerId === String(user.Id || '')) || (ownerName && ownerName === String(user.Name || ''))) return '我的'
      return ownerId || ownerName ? '权限内' : ''
    },
    async resolveModuleConfig() {
      if (this.moduleConfig) return this.moduleConfig
      const base = getBusinessModule('customers')
      if (!base) throw new Error('客户模块未配置')
      let menuId = ''
      try {
        const menu = await findMenu(base.menuAliases || [], base.table)
        menuId = menu && menu.Id || ''
      } catch (error) {}
      // 客户选择必须绑定当前账号真实授权菜单；找不到时关闭查询能力，保留手动输入。
      if (!menuId) throw new Error('当前账号没有可用的客户查看权限，可直接手动输入拜访对象')
      this.moduleConfig = { ...base, menuId }
      return this.moduleConfig
    },
    search() {
      clearTimeout(this.searchTimer)
      this.loadRows(true)
    },
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadRows(true), 320)
    },
    clearSearch() {
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.loadRows(true)
    },
    async loadRows(reset = false) {
      if (this.loading && !reset) return
      const requestId = ++this.loadRequestId
      if (reset) {
        this.pageIndex = 1
        this.rows = []
        this.total = 0
      }
      this.loading = true
      this.error = ''
      try {
        const config = await this.resolveModuleConfig()
        const result = await loadModuleRows(config, {
          pageIndex: this.pageIndex,
          pageSize: this.pageSize,
          keyword: this.keyword.trim(),
          refresh: reset
        })
        if (requestId !== this.loadRequestId) return
        this.rows = reset ? result.rows : this.rows.concat(result.rows)
        this.total = Number(result.count || this.rows.length)
      } catch (error) {
        if (requestId === this.loadRequestId) this.error = error.message || error.Msg || '客户加载失败'
      } finally {
        if (requestId === this.loadRequestId) this.loading = false
      }
    },
    loadMore() {
      if (this.loading || this.finished || !this.rows.length) return
      this.pageIndex += 1
      this.loadRows()
    },
    select(row) {
      this.$emit('select', { id: row.Id, name: this.customerName(row), row })
    }
  }
}
</script>

<style lang="scss" scoped>
.customer-picker__mask { position: fixed; z-index: 9999; inset: 0; display: flex; align-items: flex-end; overflow: hidden; background: rgba(9, 29, 37, .48); }
.customer-picker__sheet { box-sizing: border-box; width: 100%; height: 78vh; max-height: 1120rpx; display: flex; flex-direction: column; padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom)); border-radius: 26rpx 26rpx 0 0; background: #f7fafb; animation: customerPickerUp .22s ease-out both; }
.customer-picker__handle { width: 72rpx; height: 8rpx; flex: none; margin: 14rpx auto 4rpx; border-radius: 6rpx; background: #cad7dc; }
.customer-picker__header { min-height: 96rpx; display: flex; flex: none; align-items: center; justify-content: space-between; padding: 0 24rpx; }
.customer-picker__title, .customer-picker__subtitle { display: block; }
.customer-picker__title { color: #183640; font-size: 31rpx; font-weight: 750; }
.customer-picker__subtitle { margin-top: 5rpx; color: #7d929a; font-size: 21rpx; }
.customer-picker__close { display: flex; align-items: center; justify-content: center; width: 62rpx; height: 62rpx; border-radius: 50%; background: #edf3f5; color: #647c85; font-size: 40rpx; }
.customer-picker__search { height: 78rpx; display: grid; flex: none; grid-template-columns: 46rpx minmax(0, 1fr) 48rpx; align-items: center; margin: 4rpx 24rpx 16rpx; padding: 0 15rpx; border: 1rpx solid #d9e6ea; border-radius: 14rpx; background: #fff; }
.customer-picker__search-icon { position: relative; width: 25rpx; height: 25rpx; margin-left: 4rpx; border: 3rpx solid #758d96; border-radius: 50%; }
.customer-picker__search-icon::after { position: absolute; right: -11rpx; bottom: -7rpx; width: 14rpx; height: 3rpx; border-radius: 2rpx; background: #758d96; transform: rotate(45deg); content: ''; }
.customer-picker__search-input { width: 100%; height: 76rpx; color: #243f49; font-size: 25rpx; }
.customer-picker__clear { display: flex; align-items: center; justify-content: center; height: 52rpx; color: #83979e; font-size: 34rpx; }
.customer-picker__list { width: 100%; height: 0; min-height: 0; flex: 1; }
.customer-picker__rows { padding: 0 24rpx; }
.customer-picker__row { min-height: 104rpx; display: grid; grid-template-columns: 58rpx minmax(0, 1fr) 48rpx; gap: 15rpx; align-items: center; margin-bottom: 12rpx; padding: 14rpx 18rpx; border: 1rpx solid #e0eaed; border-radius: 14rpx; background: #fff; transition: transform .15s ease, opacity .15s ease; }
.customer-picker__row.selected { border-color: #52aacb; background: #eef9fc; }
.customer-picker__avatar { display: flex; align-items: center; justify-content: center; width: 56rpx; height: 56rpx; border-radius: 50%; background: linear-gradient(135deg, #0b86d4, #19a79c); color: #fff; font-size: 23rpx; font-weight: 700; }
.customer-picker__main { min-width: 0; }
.customer-picker__name-line { display: flex; align-items: center; gap: 10rpx; }
.customer-picker__name { min-width: 0; overflow: hidden; color: #1c3944; font-size: 26rpx; font-weight: 680; text-overflow: ellipsis; white-space: nowrap; }
.customer-picker__scope { flex: none; padding: 4rpx 9rpx; border-radius: 8rpx; background: #e9f5f8; color: #087fae; font-size: 18rpx; }
.customer-picker__meta { display: block; margin-top: 7rpx; overflow: hidden; color: #7c929a; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }
.customer-picker__check { display: flex; align-items: center; justify-content: center; width: 42rpx; height: 42rpx; border-radius: 50%; color: #8ba0a7; font-size: 30rpx; }
.customer-picker__check.selected { background: #0b86c5; color: #fff; font-size: 23rpx; }
.customer-picker__state { min-height: 48vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 30rpx; color: #70878f; font-size: 24rpx; text-align: center; }
.customer-picker__state-title { color: #425f69; font-size: 26rpx; font-weight: 650; }
.customer-picker__state-note { margin-top: 12rpx; color: #8ca0a7; font-size: 21rpx; }
.customer-picker__retry { margin-top: 20rpx; padding: 14rpx 28rpx; border-radius: 12rpx; background: #e9f5f8; color: #087fae; }
.customer-picker__footer { height: 70rpx; display: flex; align-items: center; justify-content: center; color: #8a9da4; font-size: 21rpx; }
.is-pressed { transform: scale(.98); opacity: .78; }
@keyframes customerPickerUp { from { opacity: 0; transform: translateY(38rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .customer-picker__sheet { animation: none; } }
</style>
