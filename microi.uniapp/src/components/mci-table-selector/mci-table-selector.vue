<template>
  <view class="selector-field" :class="{ 'selector-field--compact': compact, 'selector-field--primary': presentation.tone === 'primary' }">
    <view class="selector-field__button" :class="{ disabled: readonly }" hover-class="selector-field__pressed" @tap="openSelector">
      <view class="selector-field__icon"><view v-if="presentation.icon === 'images'" class="selector-field__images"><view></view></view><text v-else>＋</text></view>
      <view class="selector-field__copy">
        <text class="selector-field__title">{{ buttonTitle }}</text>
        <text class="selector-field__hint">{{ presentation.hint || `从${tableLabel || '业务数据'}中选择` }}</text>
      </view>
      <text class="selector-field__arrow">›</text>
    </view>

    <root-portal v-if="visible">
      <view class="selector-mask" @tap="closeSelector">
        <view class="selector-panel" @tap.stop>
        <view class="selector-panel__handle"></view>
        <view class="selector-panel__header">
          <view class="selector-panel__heading">
            <text class="selector-panel__title">{{ buttonTitle }}</text>
            <text class="selector-panel__subtitle">{{ multiple ? `已选 ${selectedIds.length} 项` : '请选择一项' }}</text>
          </view>
          <text class="selector-panel__close" @tap="closeSelector">×</text>
        </view>

        <view class="selector-search-row">
          <view class="selector-search">
            <text class="selector-search__icon">⌕</text>
            <input v-model="keyword" class="selector-search__input" :placeholder="searchPlaceholder" confirm-type="search" @input="scheduleSearch" @confirm="search" />
            <text v-if="keyword" class="selector-search__clear" @tap="clearSearch">×</text>
          </view>
          <template v-if="filterFields.length">
            <view class="selector-filter-button" :class="{ active: hasActiveFilters }" hover-class="selector-filter-button--pressed" @tap="openFilters">
              <view class="selector-filter-button__icon" aria-hidden="true"><view></view><view></view><view></view></view>
              <text>筛选</text><text v-if="hasActiveFilters" class="selector-filter-button__count">{{ activeFilterCount }}</text>
            </view>
            <view class="selector-reset-button" hover-class="selector-filter-button--pressed" @tap="resetSearch"><text>重置</text></view>
          </template>
        </view>

        <scroll-view class="selector-list" scroll-y @scrolltolower="loadMore">
          <view v-if="loading && !rows.length" class="selector-loading">
            <view v-for="item in 5" :key="item" class="selector-skeleton">
              <view class="selector-skeleton__dot"></view>
              <view class="selector-skeleton__copy"><view></view><view></view></view>
            </view>
          </view>
          <view v-else-if="error && !rows.length" class="selector-state">
            <text>{{ error }}</text>
            <text class="selector-state__action" @tap="loadRows(true)">重新加载</text>
          </view>
          <view v-else-if="!rows.length" class="selector-state"><text>没有符合条件的数据</text></view>
          <view v-else class="selector-rows">
            <view v-for="(row, index) in rows" :key="row.Id || index" class="selector-row" :class="{ 'selector-row--selected': isSelected(row) }" hover-class="selector-field__pressed" @tap="toggleRow(row)">
              <view class="selector-row__check" :class="{ selected: isSelected(row) }"><text>{{ isSelected(row) ? '✓' : '' }}</text></view>
              <view class="selector-row__content">
                <text class="selector-row__title">{{ rowTitle(row) }}</text>
                <view v-for="column in secondaryColumns" :key="column.Name" class="selector-row__line">
                  <text>{{ column.Label || column.Name }}</text>
                  <text>{{ display(column, row[column.Name]) }}</text>
                </view>
              </view>
            </view>
            <view class="selector-list__footer"><text>{{ loading ? '正在加载...' : finished ? `共 ${total} 条` : '上拉加载更多' }}</text></view>
          </view>
        </scroll-view>

        <view class="selector-actions">
          <view class="selector-actions__cancel" hover-class="selector-field__pressed" @tap="closeSelector"><text>取消</text></view>
          <view class="selector-actions__confirm" :class="{ disabled: submitting || !selectedIds.length }" hover-class="selector-field__pressed" @tap="confirmSelection">
            <text>{{ submitting ? '正在处理' : `确认选择${selectedIds.length ? `（${selectedIds.length}）` : ''}` }}</text>
          </view>
        </view>
        </view>
      </view>
      <view v-if="filterVisible" class="selector-mask selector-mask--filters" @tap="closeFilters">
        <view class="selector-panel selector-panel--filters" :class="{ 'selector-panel--filters-expanded': filterFields.length > 3 }" @tap.stop>
          <view class="selector-panel__handle"></view>
          <view class="selector-panel__header">
            <view class="selector-panel__heading">
              <text class="selector-panel__title">筛选条件</text>
              <text class="selector-panel__subtitle">选择条件后查看结果</text>
            </view>
            <text class="selector-panel__close" @tap="closeFilters">×</text>
          </view>
          <scroll-view class="selector-filter-scroll" scroll-y>
            <view class="selector-filters">
              <view v-for="filter in filterFields" :key="filter.key" class="selector-filter" :class="{ 'selector-filter--active': hasFilterValue(filter, draftFilterValues) }">
                <text class="selector-filter__label">{{ filter.label }}</text>
                <view v-if="filter.type === 'text'" class="selector-filter__input-wrap">
                  <input v-model="draftFilterValues[filter.key]" class="selector-filter__input" :placeholder="filter.placeholder || '请输入'" confirm-type="done" @confirm="applyFilters" />
                  <text v-if="hasFilterValue(filter, draftFilterValues)" class="selector-search__clear" @tap="clearFilter(filter)">×</text>
                </view>
                <view v-else-if="filter.type === 'datetime-range'" class="selector-filter__range">
                  <view v-for="bound in ['start', 'end']" :key="bound" class="selector-filter__range-bound">
                    <text class="selector-filter__range-label">{{ bound === 'start' ? '开始' : '结束' }}</text>
                    <view class="selector-filter__range-controls">
                      <picker class="selector-filter__select" mode="date" :value="dateTimeRangePart(filter, bound, 'date')" @change="changeDateTimeRange(filter, bound, 'date', $event)">
                        <view class="selector-filter__picker selector-filter__range-picker" :class="{ placeholder: !dateTimeRangePart(filter, bound, 'date') }"><text>{{ dateTimeRangePart(filter, bound, 'date') || '选择日期' }}</text></view>
                      </picker>
                      <picker class="selector-filter__select" mode="time" :value="dateTimeRangePart(filter, bound, 'time')" :disabled="!dateTimeRangePart(filter, bound, 'date')" @change="changeDateTimeRange(filter, bound, 'time', $event)">
                        <view class="selector-filter__picker selector-filter__range-picker" :class="{ placeholder: !dateTimeRangePart(filter, bound, 'date') }"><text>{{ dateTimeRangePart(filter, bound, 'date') ? dateTimeRangePart(filter, bound, 'time') : '时间' }}</text></view>
                      </picker>
                      <text v-if="dateTimeRangePart(filter, bound, 'date')" class="selector-search__clear" @tap="clearDateTimeRange(filter, bound)">×</text>
                    </view>
                  </view>
                </view>
                <picker v-else class="selector-filter__select" mode="selector" :range="filterOptionsFor(filter)" range-key="label" :value="filterOptionIndex(filter, draftFilterValues)" :disabled="filterLoading" @change="changeFilter(filter, $event)">
                  <view class="selector-filter__picker"><text>{{ filterLoading ? '加载中…' : filterOptionsFor(filter)[filterOptionIndex(filter, draftFilterValues)].label }}</text><view class="selector-filter__arrow"></view></view>
                </picker>
              </view>
              <text v-if="filterError" class="selector-filters__error" @tap="loadFilterOptions">{{ filterError }}，点击重试</text>
            </view>
          </scroll-view>
          <view class="selector-actions">
            <view class="selector-actions__cancel" hover-class="selector-field__pressed" @tap="resetDraftFilters"><text>重置</text></view>
            <view class="selector-actions__confirm" hover-class="selector-field__pressed" @tap="applyFilters"><text>查看结果</text></view>
          </view>
        </view>
      </view>
    </root-portal>
  </view>
</template>

<script>
import { V8, post } from '@/utils/request.js'
import { fieldDisplayValue, loadNativeFormDefinition, loadNativeTableModel } from '@/platform/native-form.js'
import { loadGrantedMenuDefinition } from '@/platform/module-registry.js'
import {
  getOpenTableWhere,
  submitOpenTableSelection,
  validateOpenTableContext
} from '@/platform/native-table.js'

const HEAVY_COMPONENTS = new Set(['TableChild', 'JoinForm', 'JoinTable', 'OpenTable', 'RichText', 'CodeEditor', 'ImgUpload', 'FileUpload', 'Map'])

// 用 UTC 做纯日历运算，不将用户选择的本地服务时间换算为另一个时区。
function filterDateTimeMillis(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(String(value || ''))
  if (!match) return NaN
  const [, year, month, day, hour, minute] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || date.getUTCHours() !== hour || date.getUTCMinutes() !== minute) return NaN
  return date.getTime()
}

export default {
  name: 'MciTableSelector',
  props: {
    field: { type: Object, required: true },
    parentTable: { type: String, default: '' },
    parentId: { type: [String, Number], default: '' },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    presentation: { type: Object, default: () => ({}) },
    compact: { type: Boolean, default: false }
  },
  emits: ['change'],
  data() {
    return {
      visible: false,
      table: null,
      definition: null,
      menuDefinition: null,
      rows: [],
      selectedIds: [],
      selectedRows: [],
      confirmedRows: [],
      confirmedScope: '',
      keyword: '',
      filterValues: {},
      draftFilterValues: {},
      filterVisible: false,
      filterOptions: {},
      filterLoading: false,
      filterError: '',
      pageIndex: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      submitting: false,
      error: '',
      searchTimer: null,
      loadRequestId: 0
    }
  },
  computed: {
    config() { return (this.field.config && this.field.config.OpenTable) || {} },
    targetMenuId() { return this.config.SysMenuId || this.config.ModuleId || '' },
    multiple() { return this.config.MultipleSelect !== false },
    buttonTitle() { return this.config.BtnName || this.config.BtnText || this.field.Label || '选择数据' },
    tableLabel() { return (this.table && (this.table.Description || this.table.Name)) || this.config.SysMenuName || '' },
    finished() { return this.rows.length >= this.total && this.total > 0 },
    filterFields() {
      return (this.presentation.filters || []).filter((item) => item.key && item.field && ['select', 'text', 'datetime-range'].includes(item.type))
    },
    filterWhere() {
      return this.filterFields.filter((field) => this.hasFilterValue(field)).flatMap((field) => {
        const value = this.filterValues[field.key]
        if (field.type === 'datetime-range') {
          const conditions = []
          if (value.start) conditions.push({ Name: field.field, Type: '>=', Value: value.start })
          // 结束边界为下一分钟（不含），同时兼容保存到分钟和保存到秒的数据。
          if (value.end) conditions.push({ Name: field.field, Type: '<', Value: new Date(filterDateTimeMillis(value.end) + 60000).toISOString().slice(0, 16).replace('T', ' ') })
          return conditions
        }
        return [{ Name: field.field, Type: field.operation || (field.type === 'text' ? 'Like' : '='), Value: typeof value === 'string' ? value.trim() : value }]
      })
    },
    activeFilterCount() { return this.filterFields.filter((field) => this.hasFilterValue(field)).length },
    hasActiveFilters() { return this.activeFilterCount > 0 },
    selectionScope() {
      return JSON.stringify([this.parentTable, this.parentId, this.field.Name, this.targetMenuId,
        ...(this.presentation.selectionScopeFields || []).map((name) => this.parentForm[name] ?? '')])
    },
    columns() {
      if (!this.definition) return []
      const available = this.definition.fields.filter((item) =>
        item.visible && item.Name !== 'Id' && !HEAVY_COMPONENTS.has(item.component)
      )
      const byName = new Map(available.map((item) => [String(item.Name || '').toLowerCase(), item]))
      const configured = (this.menuDefinition && this.menuDefinition.cardFields || [])
        .map((name) => byName.get(String(name || '').toLowerCase()))
        .filter(Boolean)
      return configured.length ? configured : available.slice(0, 4)
    },
    titleColumn() {
      const configuredTitle = this.menuDefinition && this.menuDefinition.titleField
      if (configuredTitle) {
        const field = this.columns.find((item) =>
          String(item.Name || '').toLowerCase() === String(configuredTitle).toLowerCase()
        )
        if (field) return field
      }
      const preferred = /名称|标题|姓名|编号|型号|客户|商品|地址/
      return this.columns.find((item) => preferred.test(item.Label || '')) || this.columns[0] || null
    },
    secondaryColumns() { return this.columns.filter((item) => item !== this.titleColumn) },
    searchPlaceholder() {
      const fields = this.menuDefinition && this.menuDefinition.searchFields || []
      if (!fields.length || !this.definition) return '搜索名称、编号或关键词'
      const byName = new Map(this.definition.fields.map((item) => [String(item.Name || '').toLowerCase(), item]))
      const labels = fields.map((name) => byName.get(String(name || '').toLowerCase()))
        .filter(Boolean).map((item) => item.Label || item.Name).slice(0, 3)
      return labels.length ? `搜索${labels.join('、')}` : '搜索关键词'
    }
  },
  beforeUnmount() {
    clearTimeout(this.searchTimer)
  },
  methods: {
    async resolveTable() {
      if (this.table && this.definition) return
      const tableId = this.config.TableId
      if (!tableId && !this.config.TableName) throw new Error('选择组件未配置数据表')
      if (this.targetMenuId) {
        try {
          this.menuDefinition = await loadGrantedMenuDefinition(this.targetMenuId)
          this.definition = this.menuDefinition.definition
          this.table = this.definition.table
          return
        } catch (error) {
          // 兼容历史 OpenTable：菜单配置暂时不可用时仍可按表元数据选择。
          this.menuDefinition = null
        }
      }
      this.table = await loadNativeTableModel(tableId || this.config.TableName, {
        menuId: this.targetMenuId
      })
      this.definition = await loadNativeFormDefinition(this.table.Name, false, {
        menuId: this.targetMenuId
      })
    },
    async openSelector() {
      if (this.readonly) return
      const validationMessage = validateOpenTableContext(this.field, this.parentForm)
      if (validationMessage) {
        uni.showToast({ title: validationMessage, icon: 'none' })
        return
      }
      this.visible = true
      this.filterVisible = false
      // 只恢复已确认的选择；取消时的临时勾选不会覆盖它，也不会串到其他主记录。
      if (!this.presentation.rememberSelection || this.confirmedScope !== this.selectionScope) {
        this.confirmedRows = []
      }
      this.selectedRows = this.confirmedRows.slice()
      this.selectedIds = this.selectedRows.map((row) => String(row.Id))
      this.rows = []
      this.pageIndex = 1
      await Promise.all([this.loadFilterOptions(), this.loadRows(true)])
    },
    closeSelector() {
      if (this.submitting) return
      clearTimeout(this.searchTimer)
      this.closeFilters()
      this.visible = false
    },
    search() {
      clearTimeout(this.searchTimer)
      return this.loadRows(true)
    },
    // zhy：通用开表选择器输入关键词后自动防抖检索。
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadRows(true), 350)
    },
    clearSearch() {
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.loadRows(true)
    },
    async openFilters() {
      if (!this.filterFields.length) return
      this.draftFilterValues = JSON.parse(JSON.stringify(this.filterValues))
      this.filterVisible = true
      await this.loadFilterOptions()
    },
    closeFilters() {
      this.filterVisible = false
      this.draftFilterValues = {}
    },
    applyFilters() {
      for (const field of this.filterFields.filter((item) => item.type === 'datetime-range')) {
        const value = this.draftFilterValues[field.key] || {}
        if ([value.start, value.end].some((part) => part && !Number.isFinite(filterDateTimeMillis(part)))) {
          uni.showToast({ title: `${field.label}格式不正确`, icon: 'none' })
          return
        }
        if (value.start && value.end && filterDateTimeMillis(value.start) > filterDateTimeMillis(value.end)) {
          uni.showToast({ title: '开始时间不能晚于结束时间', icon: 'none' })
          return
        }
      }
      this.filterValues = JSON.parse(JSON.stringify(this.draftFilterValues))
      this.closeFilters()
      return this.search()
    },
    resetDraftFilters() { this.draftFilterValues = {} },
    hasFilterValue(field, values = this.filterValues) {
      const value = values[field.key]
      if (field.type === 'datetime-range') return Boolean(value && (value.start || value.end))
      return value !== undefined && value !== null && String(value).trim() !== ''
    },
    dateTimeRangePart(field, bound, part) {
      const value = String((this.draftFilterValues[field.key] || {})[bound] || '')
      return part === 'date' ? value.slice(0, 10) : value.slice(11, 16) || (bound === 'end' ? '23:59' : '00:00')
    },
    changeDateTimeRange(field, bound, part, event) {
      const date = part === 'date' ? event.detail.value : this.dateTimeRangePart(field, bound, 'date')
      if (!date) return
      const time = part === 'time' ? event.detail.value : this.dateTimeRangePart(field, bound, 'time')
      this.draftFilterValues[field.key] = { ...this.draftFilterValues[field.key], [bound]: `${date} ${time}` }
    },
    clearDateTimeRange(field, bound) {
      this.draftFilterValues[field.key] = { ...this.draftFilterValues[field.key], [bound]: '' }
    },
    filterOptionsFor(field) {
      return [{ value: '', label: '全部' }, ...(field.options || this.filterOptions[field.key] || [])]
    },
    filterOptionIndex(field, values = this.filterValues) {
      return Math.max(0, this.filterOptionsFor(field).findIndex((item) => String(item.value) === String(values[field.key] ?? '')))
    },
    async loadFilterOptions() {
      if (this.filterLoading) return
      const pending = this.filterFields.filter((field) => field.source === 'baseData' && !this.filterOptions[field.key])
      if (!pending.length) return
      this.filterLoading = true
      this.filterError = ''
      try {
        // 各字典独立回读；单项失败可重试，不把接口错误当成空字典缓存。
        await Promise.all(pending.map(async (field) => {
          try {
            const result = await post('/apiengine/platform-sys-base-data?Action=GetSysBaseData', { ParentKey: field.parentKey }, true)
            if (!result || Number(result.Code) !== 1 || !Array.isArray(result.Data)) throw new Error('筛选选项加载失败')
            this.filterOptions[field.key] = result.Data.map((row) => ({
              value: row[field.valueField || 'Key'],
              label: row[field.labelField || 'Value']
            })).filter((item) => item.value !== undefined && item.value !== null && item.value !== '' && item.label)
          } catch (error) {
            this.filterError = '筛选选项加载失败'
          }
        }))
      } finally {
        this.filterLoading = false
      }
    },
    changeFilter(field, event) {
      const option = this.filterOptionsFor(field)[Number(event.detail.value)]
      if (!option) return
      this.draftFilterValues[field.key] = option.value
    },
    clearFilter(field) {
      this.draftFilterValues[field.key] = ''
    },
    resetSearch() {
      this.keyword = ''
      this.filterValues = {}
      this.closeFilters()
      return this.search()
    },
    async loadRows(reset = false) {
      if (this.loading && !reset) return
      const requestId = ++this.loadRequestId
      if (reset) { this.pageIndex = 1; this.rows = []; this.total = 0 }
      this.loading = true
      this.error = ''
      try {
        await this.resolveTable()
        const result = await V8.FormEngine.GetTableData(this.table.Name, {
          _Keyword: this.keyword.trim(),
          _Where: [...getOpenTableWhere(this.field, this.parentForm), ...this.filterWhere],
          ...(this.targetMenuId ? { _SysMenuId: this.targetMenuId } : {}),
          _OrderBy: 'CreateTime',
          _OrderByType: 'DESC',
          _PageIndex: this.pageIndex,
          _PageSize: this.pageSize
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '数据加载失败')
        if (requestId !== this.loadRequestId) return
        const nextRows = Array.isArray(result.Data) ? result.Data : []
        this.rows = reset ? nextRows : [...this.rows, ...nextRows]
        const refreshedRows = new Map(nextRows.map((row) => [String(row.Id), row]))
        this.selectedRows = this.selectedRows.map((row) => refreshedRows.get(String(row.Id)) || row)
        this.total = Number(result.DataCount || this.rows.length)
      } catch (error) {
        if (requestId === this.loadRequestId) this.error = error.message || error.Msg || '数据加载失败'
      } finally {
        if (requestId === this.loadRequestId) this.loading = false
      }
    },
    loadMore() {
      if (this.loading || this.finished || !this.rows.length) return
      this.pageIndex += 1
      this.loadRows()
    },
    isSelected(row) { return this.selectedIds.includes(String(row.Id)) },
    toggleRow(row) {
      const id = String(row.Id)
      if (!this.multiple) {
        this.selectedIds = [id]
        this.selectedRows = [row]
        return
      }
      const index = this.selectedIds.indexOf(id)
      if (index >= 0) {
        this.selectedIds.splice(index, 1)
        this.selectedRows.splice(index, 1)
      } else {
        this.selectedIds.push(id)
        this.selectedRows.push(row)
      }
    },
    display(field, value) { return fieldDisplayValue(field, value) },
    rowTitle(row) { return this.titleColumn ? this.display(this.titleColumn, row[this.titleColumn.Name]) : `记录 ${String(row.Id || '').slice(-6)}` },
    async confirmSelection() {
      if (this.submitting || !this.selectedRows.length) return
      this.submitting = true
      try {
        const result = await submitOpenTableSelection({
          tableName: this.parentTable,
          parentId: this.parentId,
          field: this.field,
          form: this.parentForm,
          rows: this.selectedRows
        })
        if (result && result.handled === false) return
        if (this.presentation.rememberSelection) {
          this.confirmedRows = this.selectedRows.slice()
          this.confirmedScope = this.selectionScope
        }
        this.$emit('change', result || {})
        uni.showToast({ title: '操作成功', icon: 'success' })
        this.visible = false
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '操作失败', icon: 'none' })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.selector-field { margin: 0 22rpx 20rpx; }
.selector-field__button { min-height: 112rpx; display: grid; grid-template-columns: 64rpx minmax(0, 1fr) 30rpx; align-items: center; gap: 16rpx; padding: 14rpx 20rpx; border: 1px solid #cfe3e9; border-radius: 8px; background: #f7fcfd; transition: transform .16s ease, opacity .16s ease; }
.selector-field__button.disabled { opacity: .56; }
.selector-field__icon { width: 58rpx; height: 58rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #fff; background: linear-gradient(135deg, #0786c8, #17a69d); font-size: 34rpx; }
.selector-field__copy { min-width: 0; }
.selector-field__title, .selector-field__hint { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selector-field__title { color: #21424d; font-size: 27rpx; font-weight: 700; }
.selector-field__hint { margin-top: 6rpx; color: #84979e; font-size: 21rpx; }
.selector-field__arrow { color: #8399a1; font-size: 38rpx; }
.selector-field__pressed { transform: scale(.986); opacity: .82; }
.selector-field--compact { min-width: 0; margin: 0; }
.selector-field--compact .selector-field__button { min-height: 90rpx; grid-template-columns: 46rpx minmax(0, 1fr) 18rpx; gap: 10rpx; padding: 12rpx 14rpx; border-color: #c9e1e7; background: linear-gradient(135deg, #f3fafc, #f8fcfc); box-shadow: 0 5rpx 14rpx rgba(18, 105, 131, .07); }
.selector-field--compact .selector-field__icon { width: 46rpx; height: 46rpx; font-size: 27rpx; }
.selector-field--compact .selector-field__title { font-size: 24rpx; line-height: 1.35; }
.selector-field--compact .selector-field__hint { display: none; }
.selector-field--compact .selector-field__arrow { font-size: 29rpx; }
.selector-field--primary .selector-field__button { min-height: 112rpx; grid-template-columns: 64rpx minmax(0, 1fr) 24rpx; gap: 18rpx; padding: 16rpx 22rpx; border-color: transparent; background: linear-gradient(115deg, var(--mci-primary, #0786c8), #119d9d); box-shadow: 0 6rpx 16rpx rgba(8, 134, 174, .16); }
.selector-field--primary .selector-field__icon { width: 62rpx; height: 62rpx; border-radius: 8px; color: #fff; background: rgba(255, 255, 255, .18); }
.selector-field--primary .selector-field__title { color: #fff; font-size: 28rpx; line-height: 1.4; }
.selector-field--primary .selector-field__hint { display: block; margin-top: 6rpx; color: rgba(255, 255, 255, .9); font-size: 21rpx; line-height: 1.4; white-space: normal; }
.selector-field--primary .selector-field__arrow { color: #fff; }
/* 本地图形避免字体符号在小程序中变成空框，山形与圆点表达照片操作。 */
.selector-field__images { position: relative; box-sizing: border-box; width: 34rpx; height: 30rpx; border: 2px solid currentColor; border-radius: 3px; }
.selector-field__images::before { content: ''; position: absolute; width: 5rpx; height: 5rpx; top: 4rpx; right: 4rpx; border-radius: 50%; background: currentColor; }
.selector-field__images view { position: absolute; width: 14rpx; height: 14rpx; left: 4rpx; bottom: 1rpx; border-left: 2px solid currentColor; border-top: 2px solid currentColor; transform: rotate(45deg); }
.selector-mask { position: fixed; z-index: 9999; inset: 0; width: 100vw; height: 100vh; display: flex; align-items: flex-end; overflow: hidden; background: rgba(10, 31, 39, .44); }
.selector-panel { box-sizing: border-box; width: 100%; height: 84vh; max-height: 1180rpx; display: flex; flex-direction: column; padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; background: #f7fafb; animation: mciSelectorUp .24s ease both; }
.selector-panel__handle { width: 74rpx; height: 7rpx; flex: none; margin: 14rpx auto 4rpx; border-radius: 4rpx; background: #c8d4d8; }
.selector-panel__header { min-height: 90rpx; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 24rpx; }
.selector-panel__heading { min-width: 0; }
.selector-panel__title, .selector-panel__subtitle { display: block; }
.selector-panel__title { color: #17343e; font-size: 31rpx; font-weight: 750; }
.selector-panel__subtitle { margin-top: 4rpx; color: #7f939b; font-size: 21rpx; }
.selector-panel__close { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; color: #6d838c; font-size: 42rpx; }
.selector-search-row { flex: none; display: flex; align-items: center; gap: 12rpx; margin: 0 22rpx 14rpx; }
.selector-search { min-width: 0; height: 78rpx; flex: 1; display: grid; grid-template-columns: 32rpx minmax(0, 1fr) 32rpx; align-items: center; padding: 0 12rpx; border: 1px solid #dce7ea; border-radius: 8px; background: #f4f8fa; }
.selector-search__icon { color: #6f8790; font-size: 34rpx; }
.selector-search__input { min-width: 0; height: 76rpx; color: #25434d; font-size: 25rpx; }
.selector-search__clear { display: flex; justify-content: center; color: #8ca0a7; font-size: 32rpx; }
.selector-filter-button, .selector-reset-button { flex: none; display: flex; align-items: center; justify-content: center; min-width: 78rpx; height: 80rpx; color: #607a85; font-size: 24rpx; transition: color .14s ease, background-color .14s ease, transform .14s ease; }
.selector-filter-button.active { color: var(--mci-primary, #0786c8); font-weight: 650; }
.selector-filter-button--pressed { border-radius: 5px; background: #edf6fa; transform: scale(.96); }
.selector-filter-button__icon { display: flex; flex-direction: column; align-items: flex-start; gap: 4rpx; width: 24rpx; margin-right: 7rpx; }
.selector-filter-button__icon view { height: 3rpx; border-radius: 2rpx; background: currentColor; }
.selector-filter-button__icon view:nth-child(1) { width: 24rpx; }
.selector-filter-button__icon view:nth-child(2) { width: 16rpx; }
.selector-filter-button__icon view:nth-child(3) { width: 8rpx; }
.selector-filter-button__count { min-width: 28rpx; height: 28rpx; margin-left: 5rpx; padding: 0 4rpx; border-radius: 14rpx; color: #fff; background: #e94b2c; font-size: 18rpx; line-height: 28rpx; text-align: center; }
.selector-reset-button { min-width: 80rpx; color: var(--mci-primary, #0786c8); font-size: 26rpx; font-weight: 600; }
.selector-mask--filters { z-index: 10000; }
.selector-panel--filters { height: min(76vh, 640rpx); }
.selector-panel--filters-expanded { height: min(80vh, 1040rpx); }
.selector-filter-scroll { flex: 1; height: 0; min-height: 0; }
.selector-filters { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20rpx; margin: 16rpx 24rpx 24rpx; }
.selector-filter { min-width: 0; display: grid; grid-template-columns: 164rpx minmax(0, 1fr); align-items: center; gap: 16rpx; }
.selector-filter--active .selector-filter__picker, .selector-filter--active .selector-filter__input-wrap { border-color: #8bbdd3; background: #e4f2fa; }
.selector-filter__label { display: block; color: #405b65; font-size: 26rpx; font-weight: 500; line-height: 1.5; white-space: nowrap; }
.selector-filter__select { min-width: 0; }
.selector-filter__picker, .selector-filter__input-wrap { box-sizing: border-box; min-width: 0; min-height: 84rpx; padding: 0 20rpx; border: 1px solid #d4e2ea; border-radius: 8px; background: #edf4f8; }
.selector-filter__picker { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; color: #25434d; font-size: 26rpx; }
.selector-filter__picker text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.selector-filter__arrow { flex: none; width: 10rpx; height: 10rpx; margin: 0 4rpx 6rpx; border-right: 1px solid #78919b; border-bottom: 1px solid #78919b; transform: rotate(45deg); }
.selector-filter__input-wrap { display: grid; grid-template-columns: minmax(0, 1fr) 36rpx; align-items: center; }
.selector-filter__input { min-width: 0; height: 80rpx; color: #25434d; font-size: 26rpx; }
.selector-filter__range { min-width: 0; display: grid; gap: 14rpx; }
.selector-filter__range-label { display: block; margin-bottom: 8rpx; color: #6f858d; font-size: 22rpx; }
.selector-filter__range-controls { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr) 30rpx; align-items: center; gap: 8rpx; }
.selector-filter__range-picker { min-height: 76rpx; justify-content: center; padding: 0 8rpx; font-size: 23rpx; }
.selector-filter__range-picker.placeholder { color: #8198a3; }
.selector-filters__error { padding: 8rpx 0; color: #b24b3d; font-size: 24rpx; }
.selector-list { width: 100%; height: 0; min-height: 0; flex: 1; }
.selector-rows { padding: 0 22rpx; }
.selector-row { min-height: 126rpx; display: grid; grid-template-columns: 50rpx minmax(0, 1fr); align-items: start; gap: 16rpx; margin-bottom: 12rpx; padding: 20rpx; border: 1px solid #e1e9ec; border-radius: 8px; background: #fff; transition: transform .16s ease, opacity .16s ease; }
.selector-row__check { width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; border: 1px solid #b9cbd1; border-radius: 50%; color: #fff; font-size: 24rpx; }
.selector-row__check.selected { border-color: #0786c8; background: #0786c8; }
.selector-row--selected { border-color: var(--mci-primary, #0786c8); background: #edf8fd; }
.selector-row__content { min-width: 0; }
.selector-row__title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #193640; font-size: 27rpx; font-weight: 700; }
.selector-row__line { display: grid; grid-template-columns: 154rpx minmax(0, 1fr); gap: 12rpx; margin-top: 8rpx; color: #6f858d; font-size: 22rpx; }
.selector-row__line text:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #405b65; }
.selector-state { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18rpx; color: #7f939b; font-size: 24rpx; }
.selector-state__action { color: #0786c8; font-weight: 650; }
.selector-loading { padding: 0 22rpx; }
.selector-skeleton { height: 126rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr); gap: 16rpx; align-items: center; margin-bottom: 12rpx; padding: 0 20rpx; border-radius: 8px; background: #fff; }
.selector-skeleton__dot, .selector-skeleton__copy view { border-radius: 6px; background: linear-gradient(90deg, #eaf0f2 25%, #f8fafb 40%, #eaf0f2 60%); background-size: 400% 100%; animation: mciSelectorShimmer 1.35s ease infinite; }
.selector-skeleton__dot { width: 44rpx; height: 44rpx; border-radius: 50%; }
.selector-skeleton__copy view { width: 70%; height: 25rpx; }
.selector-skeleton__copy view:last-child { width: 48%; height: 20rpx; margin-top: 14rpx; }
.selector-list__footer { height: 70rpx; display: flex; align-items: center; justify-content: center; color: #8a9ca3; font-size: 21rpx; }
.selector-actions { flex: none; display: grid; grid-template-columns: 200rpx minmax(0, 1fr); gap: 16rpx; padding: 16rpx 22rpx; border-top: 1px solid #dfe8eb; background: #fff; }
.selector-actions__cancel, .selector-actions__confirm { height: 82rpx; display: flex; align-items: center; justify-content: center; border-radius: 8px; font-size: 27rpx; font-weight: 700; transition: transform .16s ease, opacity .16s ease; }
.selector-actions__cancel { color: #526b74; border: 1px solid #d7e2e6; }
.selector-actions__confirm { color: #fff; background: linear-gradient(135deg, #087fbd, #15a7a0); }
.selector-actions__confirm.disabled { opacity: .48; }
@keyframes mciSelectorUp { from { opacity: 0; transform: translateY(36rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes mciSelectorShimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .selector-panel, .selector-skeleton__dot, .selector-skeleton__copy view { animation: none; } }
</style>
