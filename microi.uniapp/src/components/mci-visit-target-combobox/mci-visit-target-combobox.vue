<template>
  <view class="visit-target-combobox" :class="{ 'visit-target-combobox--open': open }">
    <view class="visit-target-combobox__control" :class="{ focused: open }">
      <view class="visit-target-combobox__search-icon"></view>
      <input
        class="visit-target-combobox__input"
        :value="modelValue"
        :disabled="readonly"
        confirm-type="search"
        :placeholder="`选择已有${targetLabel}或输入新对象`"
        @focus="openOptions"
        @input="handleInput"
        @confirm="searchNow"
      />
      <view v-if="modelValue && !readonly" class="visit-target-combobox__clear" @tap.stop="clear"><text>×</text></view>
      <view v-else class="visit-target-combobox__clear-placeholder"></view>
      <text v-if="!readonly" class="visit-target-combobox__arrow" :class="{ open }" @tap.stop="toggleOptions">›</text>
    </view>

    <view v-if="open" class="visit-target-combobox__dropdown">
      <scroll-view class="visit-target-combobox__list" scroll-y lower-threshold="80" @scrolltolower="loadMore">
        <view v-if="loading && !rows.length" class="visit-target-combobox__state"><text>正在检索{{ targetLabel }}…</text></view>
        <view v-else-if="error && !rows.length" class="visit-target-combobox__state">
          <text>{{ error }}</text>
          <text class="visit-target-combobox__state-note">仍可保留当前输入并直接提交</text>
        </view>
        <view v-else-if="!rows.length" class="visit-target-combobox__state">
          <text>{{ normalizedValue ? '未找到匹配数据' : `暂无可选${targetLabel}` }}</text>
          <text v-if="normalizedValue" class="visit-target-combobox__state-note">“{{ normalizedValue }}”将作为新拜访对象</text>
        </view>
        <view v-else>
          <view
            v-for="row in rows"
            :key="row.Id"
            class="visit-target-combobox__option"
            :class="{ selected: String(row.Id) === String(selectedId) }"
            hover-class="visit-target-combobox__option--pressed"
            @tap.stop="select(row)"
          >
            <view class="visit-target-combobox__option-main">
              <text class="visit-target-combobox__name">{{ targetName(row) }}</text>
              <text class="visit-target-combobox__meta">{{ targetMeta(row) }}</text>
            </view>
          </view>
          <view class="visit-target-combobox__footer">
            <text>{{ loading ? '正在加载…' : finished ? `共 ${total} 条` : '上拉加载更多' }}</text>
          </view>
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script>
import { getBusinessModule } from '@/platform/business.js'
import { findMenu, formatFieldValue, loadModuleRows } from '@/platform/business-runtime.js'

export default {
  name: 'MciVisitTargetCombobox',
  props: {
    modelValue: { type: String, default: '' },
    selectedId: { type: [String, Number], default: '' },
    moduleKey: { type: String, required: true },
    targetType: { type: String, default: '' },
    readonly: { type: Boolean, default: false }
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
    targetLabel() { return String(this.targetType || '拜访对象').trim() || '拜访对象' },
    finished() { return this.total > 0 && this.rows.length >= this.total }
  },
  watch: {
    moduleKey() { this.resetDataSource() },
    targetType() { this.resetDataSource() }
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
    this.requestId += 1
  },
  methods: {
    resetDataSource() {
      clearTimeout(this.searchTimer)
      this.requestId += 1
      this.moduleConfig = null
      this.rows = []
      this.pageIndex = 1
      this.total = 0
      this.loading = false
      this.error = ''
      if (this.open && this.moduleKey) this.$nextTick(() => this.loadRows(true))
    },
    targetName(row) {
      const field = this.moduleConfig && this.moduleConfig.titleField
      return String(row && (row[field] || row.Name || row.Bianhao) || `未命名${this.targetLabel}`)
    },
    targetMeta(row) {
      const lines = Array.isArray(this.moduleConfig && this.moduleConfig.lines)
        ? this.moduleConfig.lines
        : []
      const values = lines.slice(0, 3).map((line) => {
        const value = formatFieldValue(row && row[line.field], line.format, { empty: '' })
        return value ? `${line.label}：${value}` : ''
      }).filter(Boolean)
      return values.join(' · ') || `${this.targetLabel}资料`
    },
    async resolveModuleConfig() {
      if (this.moduleConfig) return this.moduleConfig
      const base = getBusinessModule(this.moduleKey)
      if (!base) throw new Error(`${this.targetLabel}模块未配置`)
      let menu = null
      try {
        menu = await findMenu(base.menuAliases || [], base.table)
      } catch (error) {}
      // 角色刚被授予菜单时刷新一次授权树，避免旧的十分钟本地缓存遮住新权限。
      if (!menu) {
        try {
          menu = await findMenu(base.menuAliases || [], base.table, true)
        } catch (error) {}
      }
      const menuId = menu && menu.Id || ''
      if (!menuId) throw new Error(`当前账号没有可用的${this.targetLabel}查看权限`)
      this.moduleConfig = { ...base, menuId }
      return this.moduleConfig
    },
    openOptions() {
      if (this.readonly) return
      this.open = true
      this.$emit('open-change', true)
      this.loadRows(true)
    },
    toggleOptions() {
      if (this.readonly) return
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
      if (this.readonly) return
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
      if (this.readonly) return
      this.$emit('update:modelValue', '')
      this.$emit('clear')
      this.open = true
      this.loadRows(true, '')
    },
    async loadRows(reset = false, keyword = this.modelValue) {
      if (!this.moduleKey) {
        this.rows = []
        this.error = '请先选择拜访对象类型'
        return
      }
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
        if (currentRequest === this.requestId) {
          this.error = error.message || error.Msg || `${this.targetLabel}加载失败`
        }
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
      const payload = { id: row.Id, name: this.targetName(row), row, targetType: this.targetType }
      this.$emit('update:modelValue', payload.name)
      this.$emit('select', payload)
      this.open = false
      this.$emit('open-change', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.visit-target-combobox { position: relative; z-index: 1; width: 100%; }
.visit-target-combobox--open { z-index: 20; }
.visit-target-combobox__control { box-sizing: border-box; height: 76rpx; display: grid; grid-template-columns: 44rpx minmax(0, 1fr) 42rpx 38rpx; align-items: center; padding: 0 10rpx 0 12rpx; border: 2rpx solid #d8e6eb; border-radius: 12rpx; background: #fff; }
.visit-target-combobox__control.focused { border-color: #28a7cf; box-shadow: 0 0 0 4rpx rgba(40, 167, 207, .08); }
.visit-target-combobox__search-icon { position: relative; width: 22rpx; height: 22rpx; margin-left: 4rpx; border: 3rpx solid #75909a; border-radius: 50%; }
.visit-target-combobox__search-icon::after { position: absolute; right: -10rpx; bottom: -6rpx; width: 13rpx; height: 3rpx; border-radius: 2rpx; background: #75909a; transform: rotate(45deg); content: ''; }
.visit-target-combobox__input { width: 100%; height: 72rpx; color: #233f4b; font-size: 25rpx; }
.visit-target-combobox__clear, .visit-target-combobox__clear-placeholder { display: flex; align-items: center; justify-content: center; height: 56rpx; color: #82969e; font-size: 33rpx; }
.visit-target-combobox__arrow { align-self: center; justify-self: center; color: #81969e; font-size: 38rpx; line-height: 1; transform: rotate(90deg); transform-origin: center; transition: transform .18s ease; }
.visit-target-combobox__arrow.open { transform: rotate(-90deg); }
.visit-target-combobox__dropdown { position: absolute; top: 84rpx; right: 0; left: 0; overflow: hidden; border: 1rpx solid #dce8ec; border-radius: 12rpx; background: #fff; box-shadow: 0 14rpx 38rpx rgba(22, 63, 79, .16); }
.visit-target-combobox__list { max-height: 430rpx; }
.visit-target-combobox__option { min-height: 82rpx; display: flex; align-items: center; padding: 12rpx 18rpx; border-bottom: 1rpx solid #edf3f5; }
.visit-target-combobox__option.selected { background: #eef9fc; }
.visit-target-combobox__option--pressed { background: #f0f7f9; }
.visit-target-combobox__option-main { min-width: 0; flex: 1; }
.visit-target-combobox__name, .visit-target-combobox__meta { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.visit-target-combobox__name { color: #274550; font-size: 24rpx; font-weight: 620; }
.visit-target-combobox__meta { margin-top: 5rpx; color: #82969e; font-size: 20rpx; }
.visit-target-combobox__state { min-height: 150rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20rpx; color: #5f7882; font-size: 23rpx; text-align: center; }
.visit-target-combobox__state-note { margin-top: 10rpx; color: #879ba3; font-size: 21rpx; }
.visit-target-combobox__footer { height: 62rpx; display: flex; align-items: center; justify-content: center; color: #8a9da4; font-size: 20rpx; }
@media (prefers-reduced-motion: reduce) { .visit-target-combobox__arrow { transition: none; } }
</style>
