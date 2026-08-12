<template>
  <view class="customer-combobox" :class="{ 'customer-combobox--open': open }">
    <view class="customer-combobox__control" :class="{ focused: open }">
      <view class="customer-combobox__search-icon"></view>
      <input
        class="customer-combobox__input"
        :value="modelValue"
        confirm-type="search"
        placeholder="选择已有客户或输入新对象"
        @focus="openOptions"
        @input="handleInput"
        @confirm="searchNow"
      />
      <view v-if="modelValue" class="customer-combobox__clear" @tap.stop="clear"><text>×</text></view>
      <view v-else class="customer-combobox__clear-placeholder"></view>
      <text class="customer-combobox__arrow" :class="{ open }" @tap.stop="toggleOptions">›</text>
    </view>

    <view v-if="open" class="customer-combobox__dropdown">
      <scroll-view class="customer-combobox__list" scroll-y lower-threshold="80" @scrolltolower="loadMore">
        <view v-if="loading && !rows.length" class="customer-combobox__state"><text>正在检索客户…</text></view>
        <view v-else-if="error && !rows.length" class="customer-combobox__state">
          <text>{{ error }}</text>
          <text class="customer-combobox__state-note">仍可保留当前输入并直接提交</text>
        </view>
        <view v-else-if="!rows.length" class="customer-combobox__state">
          <text>{{ normalizedValue ? '未找到匹配数据' : '暂无可选客户' }}</text>
          <text v-if="normalizedValue" class="customer-combobox__state-note">“{{ normalizedValue }}”将作为新拜访对象</text>
        </view>
        <view v-else>
          <view
            v-for="row in rows"
            :key="row.Id"
            class="customer-combobox__option"
            :class="{ selected: String(row.Id) === String(selectedId) }"
            hover-class="customer-combobox__option--pressed"
            @tap.stop="select(row)"
          >
            <view class="customer-combobox__option-main">
              <text class="customer-combobox__name">{{ customerName(row) }}</text>
              <text class="customer-combobox__meta">{{ customerMeta(row) }}</text>
            </view>
          </view>
          <view class="customer-combobox__footer">
            <text>{{ loading ? '正在加载…' : finished ? `共 ${total} 条` : '上拉加载更多' }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { getBusinessModule } from '@/platform/business.js'
import { findMenu, loadModuleRows } from '@/platform/business-runtime.js'
import { formatRegionValue } from '@/platform/display.js'

export default {
  name: 'MciCustomerCombobox',
  props: {
    modelValue: { type: String, default: '' },
    selectedId: { type: [String, Number], default: '' }
  },
  emits: ['update:modelValue', 'select', 'clear', 'open-change'],
  data() {
    return {
      open: false,
      rows: [],
      pageIndex: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      error: '',
      searchTimer: null,
      requestId: 0,
      moduleConfig: null
    }
  },
  computed: {
    normalizedValue() { return String(this.modelValue || '').trim() },
    finished() { return this.total > 0 && this.rows.length >= this.total }
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
  },
  methods: {
    customerName(row) { return String(row.KehuMC || row.Name || row.Bianhao || '未命名客户') },
    customerMeta(row) {
      const region = formatRegionValue(row.Chengshi || '')
      return [row.LianxiR, row.ShoujiH || row.Phone, region].filter(Boolean).join(' · ') || '客户资料'
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
      if (!menuId) throw new Error('当前账号没有可用的客户查看权限')
      this.moduleConfig = { ...base, menuId }
      return this.moduleConfig
    },
    openOptions() {
      this.open = true
      this.$emit('open-change', true)
      this.loadRows(true)
    },
    toggleOptions() {
      this.open = !this.open
      this.$emit('open-change', this.open)
      if (this.open) this.loadRows(true)
    },
    closeOptions() {
      if (!this.open) return
      this.open = false
      this.$emit('open-change', false)
    },
    handleInput(event) {
      const value = String(event && event.detail && event.detail.value || '')
      this.$emit('update:modelValue', value)
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadRows(true, value), 320)
    },
    searchNow() {
      clearTimeout(this.searchTimer)
      this.loadRows(true)
    },
    clear() {
      this.$emit('update:modelValue', '')
      this.$emit('clear')
      this.open = true
      this.loadRows(true, '')
    },
    async loadRows(reset = false, keyword = this.modelValue) {
      if (this.loading && !reset) return
      const currentRequest = ++this.requestId
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
          keyword: String(keyword || '').trim(),
          refresh: reset
        })
        if (currentRequest !== this.requestId) return
        this.rows = reset ? result.rows : this.rows.concat(result.rows)
        this.total = Number(result.count || this.rows.length)
      } catch (error) {
        if (currentRequest === this.requestId) this.error = error.message || error.Msg || '客户加载失败'
      } finally {
        if (currentRequest === this.requestId) this.loading = false
      }
    },
    loadMore() {
      if (this.loading || this.finished || !this.rows.length) return
      this.pageIndex += 1
      this.loadRows()
    },
    select(row) {
      if (!row || !row.Id) return
      const payload = { id: row.Id, name: this.customerName(row), row }
      this.$emit('update:modelValue', payload.name)
      this.$emit('select', payload)
      this.open = false
      this.$emit('open-change', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.customer-combobox { position: relative; z-index: 1; width: 100%; }
.customer-combobox--open { z-index: 20; }
.customer-combobox__control { box-sizing: border-box; height: 76rpx; display: grid; grid-template-columns: 44rpx minmax(0, 1fr) 42rpx 38rpx; align-items: center; padding: 0 10rpx 0 12rpx; border: 2rpx solid #d8e6eb; border-radius: 12rpx; background: #fff; }
.customer-combobox__control.focused { border-color: #28a7cf; box-shadow: 0 0 0 4rpx rgba(40, 167, 207, .08); }
.customer-combobox__search-icon { position: relative; width: 22rpx; height: 22rpx; margin-left: 4rpx; border: 3rpx solid #75909a; border-radius: 50%; }
.customer-combobox__search-icon::after { position: absolute; right: -10rpx; bottom: -6rpx; width: 13rpx; height: 3rpx; border-radius: 2rpx; background: #75909a; transform: rotate(45deg); content: ''; }
.customer-combobox__input { width: 100%; height: 72rpx; color: #233f4b; font-size: 25rpx; }
.customer-combobox__clear, .customer-combobox__clear-placeholder { display: flex; align-items: center; justify-content: center; height: 56rpx; color: #82969e; font-size: 33rpx; }
.customer-combobox__arrow { align-self: center; justify-self: center; color: #81969e; font-size: 38rpx; line-height: 1; transform: rotate(90deg); transform-origin: center; transition: transform .18s ease; }
.customer-combobox__arrow.open { transform: rotate(-90deg); }
.customer-combobox__dropdown { position: absolute; top: 84rpx; right: 0; left: 0; overflow: hidden; border: 1rpx solid #dce8ec; border-radius: 12rpx; background: #fff; box-shadow: 0 14rpx 38rpx rgba(22, 63, 79, .16); }
.customer-combobox__list { max-height: 430rpx; }
.customer-combobox__option { min-height: 82rpx; display: flex; align-items: center; padding: 12rpx 18rpx; border-bottom: 1rpx solid #edf3f5; }
.customer-combobox__option.selected { background: #eef9fc; }
.customer-combobox__option--pressed { background: #f0f7f9; }
.customer-combobox__option-main { min-width: 0; flex: 1; }
.customer-combobox__name, .customer-combobox__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.customer-combobox__name { color: #274550; font-size: 24rpx; font-weight: 620; }
.customer-combobox__meta { margin-top: 5rpx; color: #82969e; font-size: 20rpx; }
.customer-combobox__state { min-height: 150rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20rpx; color: #5f7882; font-size: 23rpx; text-align: center; }
.customer-combobox__state-note { margin-top: 10rpx; color: #879ba3; font-size: 21rpx; }
.customer-combobox__footer { height: 62rpx; display: flex; align-items: center; justify-content: center; color: #8a9da4; font-size: 20rpx; }
@media (prefers-reduced-motion: reduce) { .customer-combobox__arrow { transition: none; } }
</style>
