<template>
  <view class="list-filter-control">
    <input v-if="field.type === 'text'" class="filter-input" :value="modelValue || ''" :placeholder="field.placeholder || `请输入${field.label}`" @input="emit($event.detail.value)" />
    <view v-else-if="field.type === 'range'" class="filter-range">
      <input :value="part('min')" type="digit" placeholder="最小值" @input="setPart('min', $event.detail.value)" />
      <text>至</text><input :value="part('max')" type="digit" placeholder="最大值" @input="setPart('max', $event.detail.value)" />
      <text class="clear" @tap="emit({})">×</text>
    </view>
    <view v-else-if="field.type === 'date-range'" class="date-range">
      <view v-for="side in ['start', 'end']" :key="side" class="date-row">
        <text class="date-label">{{ side === 'start' ? '开始' : '结束' }}</text>
        <picker v-if="dateSpec.dateFields" mode="date" :fields="dateSpec.dateFields" :value="datePart(side)" @change="setDatePart(side, 'date', $event.detail.value)">
          <view class="date-input" :class="{ placeholder: !datePart(side) }">{{ datePart(side) || datePlaceholder }}</view>
        </picker>
        <picker v-if="dateSpec.timeColumns" mode="multiSelector" :range="timeColumns" :value="timeIndexes(side)" @change="changeTime(side, $event)">
          <view class="date-input" :class="{ placeholder: !timePart(side) }">{{ timePart(side) || timePlaceholder }}</view>
        </picker>
        <text class="clear" @tap="setPart(side, '')">×</text>
      </view>
    </view>
    <view v-else-if="field.type === 'address'" class="region-row">
      <picker mode="multiSelector" :range="region.columns" range-key="name" :value="region.indexes" @columnchange="changeRegionColumn" @change="emit(regionPickerSelection(region, $event.detail.value))">
        <view class="date-input" :class="{ placeholder: !Array.isArray(modelValue) || !modelValue.length }">{{ Array.isArray(modelValue) && modelValue.length ? modelValue.join(' / ') : '请选择省 / 市 / 区' }}</view>
      </picker>
      <text class="clear" @tap="emit([])">×</text>
    </view>
    <view v-else-if="field.type === 'toggle'" class="toggle-row">
      <text>{{ field.description || field.label }}</text><switch :checked="!!modelValue" color="#087da8" @change="emit($event.detail.value)" />
    </view>
    <template v-else-if="isDropdown">
      <mci-native-field :field="selectorField" :model-value="modelValue" :option-loader="loadOptions" :tree-loader="loadTreeChildren" :tree-linkage="!!field.tree?.ParentChildLinkage"
        :selector-portal="true" :selector-z-index="10100" :menu-id="menuId" :module-engine-key="moduleEngineKey" :table-child-auth="tableChildAuth" :form-data="formData" @update:model-value="emit" />
      <view v-if="selectionLabels.length" class="selected-tags">
        <view v-for="(item, index) in selectionLabels" :key="index" class="selected-tag" @tap="removeSelection(index)"><text>{{ item }}</text><text>×</text></view>
      </view>
    </template>
    <view v-else class="chips-control">
      <view class="filter-options">
        <view v-for="option in chipOptions" :key="String(option.value)" class="filter-option" :class="{ active: selected(option) }" @tap="selectChip(option)">
          <view v-if="field.multiple" class="filter-check" :class="{ checked: selected(option) }"><text v-if="selected(option)">✓</text></view>
          <text v-else-if="field.component === 'Radio'" class="radio-mark">{{ selected(option) ? '●' : '○' }}</text><text>{{ option.label }}</text>
        </view>
      </view>
      <text v-if="chipLoading" class="option-state">正在加载…</text>
      <text v-else-if="chipError" class="option-state" @tap="loadChips">{{ chipError }}，点击重试</text>
      <text v-else-if="chipHasMore" class="option-state" @tap="loadChips">加载更多选项</text>
      <text v-else-if="!chipOptions.length" class="option-state">暂无可选项</text>
    </view>
  </view>
</template>

<script>
import MciNativeField from '@/components/mci-native-field/mci-native-field.vue'
import { loadNativeFieldOptionPage, isRemoteNativeFieldOptions, filterNativeFieldOptions } from '@/platform/native-form.js'
import { dateFilterSpec } from '@/platform/list-filter-date.mjs'
import { filterOptionRows, filterTreeOptions } from '@/platform/list-filter-options.mjs'
import { createRegionPickerState, updateRegionPickerState, regionPickerSelection } from '@/platform/region-picker.mjs'
import { V8, post } from '@/utils/request.js'

export default {
  name: 'MciListFilterField',
  components: { MciNativeField },
  props: { field: { type: Object, required: true }, modelValue: { default: '' }, menuId: { type: String, default: '' }, moduleEngineKey: { type: String, default: '' }, tableChildAuth: { type: Object, default: null }, formData: { type: Object, default: () => ({}) } },
  emits: ['update:modelValue'],
  data() { return { region: createRegionPickerState([]), chipOptions: [], chipPage: 1, chipHasMore: false, chipLoading: false, chipError: '', treeCache: null, sourceCache: null } },
  computed: {
    isDropdown() { return this.field.type === 'options' && (this.field.presentation === 'dropdown' || ['Select', 'MultipleSelect', 'Checkbox', 'Autocomplete', 'Cascader', 'SelectTree', 'TreeCheckbox', 'Department', 'Transfer'].includes(this.field.component)) },
    selectorField() { return { ...this.field.nativeField, Name: this.field.field, Label: this.field.label, component: 'Select', placeholder: `请选择${this.field.label}`, options: [], config: { MultipleSelect: !!this.field.multiple, SelectSaveFormat: 'Json', SelectSaveField: '_filterKey', SelectLabel: '_filterLabel' } } },
    dateSpec() { return this.field.date || dateFilterSpec() },
    datePlaceholder() { return this.dateSpec.dateFields === 'year' ? '选择年份' : this.dateSpec.dateFields === 'month' ? '选择年月' : '选择日期' },
    timePlaceholder() { return ['选择小时', '选择时分', '选择时分秒'][this.dateSpec.timeColumns - 1] },
    timeColumns() { return Array.from({ length: this.dateSpec.timeColumns }, (_, index) => Array.from({ length: index ? 60 : 24 }, (_, value) => `${String(value).padStart(2, '0')}${['时', '分', '秒'][index]}`)) },
    selectionLabels() { return (this.field.multiple ? (Array.isArray(this.modelValue) ? this.modelValue : []) : this.modelValue === '' || this.modelValue == null ? [] : [this.modelValue]).map((item) => item?._filterLabel ?? String(item)) }
  },
  watch: { modelValue: { immediate: true, handler(value) { if (this.field.type === 'address') this.region = createRegionPickerState(Array.isArray(value) ? value : []) } } },
  mounted() { if (!this.isDropdown && ['options', 'sort'].includes(this.field.type)) this.loadChips() },
  methods: {
    regionPickerSelection,
    emit(value) { this.$emit('update:modelValue', value) },
    part(key) { return this.modelValue?.[key] ?? '' },
    setPart(key, value) { this.emit({ ...(this.modelValue || {}), [key]: value }) },
    datePart(side) { return this.dateSpec.dateFields ? String(this.part(side)).split(' ')[0] : '' },
    timePart(side) { return String(this.part(side)).split(' ')[this.dateSpec.dateFields ? 1 : 0] || '' },
    timeIndexes(side) { const values = this.timePart(side).split(':'); return Array.from({ length: this.dateSpec.timeColumns }, (_, index) => Number(values[index]) || 0) },
    changeTime(side, event) { this.setDatePart(side, 'time', event.detail.value.map((value) => String(value).padStart(2, '0')).join(':')) },
    setDatePart(side, kind, value) {
      const spec = this.dateSpec
      const length = spec.dateFields === 'year' ? 4 : spec.dateFields === 'month' ? 7 : 10
      const now = new Date(); const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      const date = kind === 'date' ? String(value).slice(0, length) : this.datePart(side) || today.slice(0, length)
      const time = kind === 'time' ? value : this.timePart(side) || Array(spec.timeColumns).fill('00').join(':')
      this.setPart(side, [spec.dateFields ? date : '', spec.timeColumns ? time : ''].filter(Boolean).join(' '))
    },
    changeRegionColumn(event) { this.region = updateRegionPickerState(this.region, event.detail.column, event.detail.value) },
    removeSelection(index) { this.emit(this.field.multiple ? this.modelValue.filter((_, position) => position !== index) : '') },
    chipValue(option) { return this.field.storage === 'object' ? filterOptionRows(this.field, [option])[0].raw : option.value },
    chipKey(value) { return String(value?._filterKey ?? value ?? '') },
    chipSelections() { return Array.isArray(this.modelValue) ? this.modelValue : this.modelValue === '' || this.modelValue == null ? [] : [this.modelValue] },
    selected(option) { const key = this.chipKey(this.chipValue(option)); return this.field.multiple ? this.chipSelections().some((value) => this.chipKey(value) === key) : this.chipKey(this.modelValue) === key },
    selectChip(option) { const value = this.chipValue(option); if (this.field.multiple) { const values = this.chipSelections(); this.emit(this.selected(option) ? values.filter((item) => this.chipKey(item) !== this.chipKey(value)) : [...values, value]) } else this.emit(this.selected(option) ? '' : value) },
    async sourcePage(options) {
      const field = this.field
      const native = field.nativeField
      if (native && (field.source === 'native-field' || isRemoteNativeFieldOptions(native))) return loadNativeFieldOptionPage(native, this.formData, { ...options, menuId: this.menuId, moduleEngineKey: this.moduleEngineKey, tableChildAuth: this.tableChildAuth, preserveTree: !!field.tree, timeoutMs: 15000 })
      if (native || !field.source) {
        const rows = filterNativeFieldOptions(field.options || [], options.keyword || '')
        const start = (options.pageIndex - 1) * options.pageSize
        return { options: rows.slice(start, start + options.pageSize), treeRows: (field.options || []).map((option) => option.raw), total: rows.length, totalKnown: true, hasMore: !field.tree && start + options.pageSize < rows.length }
      }
      let result
      if (field.source === 'baseData') {
        if (!this.sourceCache) this.sourceCache = await post('/apiengine/platform-sys-base-data?Action=GetSysBaseData', { ParentKey: field.parentKey }, true)
        result = this.sourceCache
      } else if (field.source === 'table') result = await V8.FormEngine.GetTableData(field.table, { _PageIndex: options.pageIndex, _PageSize: options.pageSize, _OrderBy: field.orderBy || 'CreateTime', _OrderByType: field.orderType || 'DESC', _Where: options.keyword ? [[field.labelField || 'Name', 'Like', options.keyword]] : [] })
      else if (field.source === 'api-engine') result = await V8.ApiEngine.Run(field.apiEngineKey, { _PageIndex: options.pageIndex, _PageSize: options.pageSize, _Keyword: options.keyword || '' }, { checkCode: false })
      if (!result || Number(result.Code) !== 1) { this.sourceCache = null; throw new Error(result?.Msg || '选项加载失败') }
      const rows = (Array.isArray(result.Data) ? result.Data : []).map((raw) => ({ value: raw[field.valueField || (field.source === 'baseData' ? 'Key' : 'Id')], label: String(raw[field.labelField || (field.source === 'baseData' ? 'Value' : 'Name')] ?? ''), raw })).filter((row) => row.value != null)
      const unpaged = field.source === 'baseData' || rows.length > options.pageSize
      const filtered = filterNativeFieldOptions(rows, options.keyword || '')
      return { options: filtered, clientPaging: unpaged, total: unpaged ? filtered.length : Number(result.DataCount || 0), totalKnown: unpaged || result.DataCount != null, hasMore: !unpaged && (result.DataCount != null ? options.pageIndex * options.pageSize < Number(result.DataCount) : rows.length >= options.pageSize) }
    },
    async treeRows(parent) {
      const rows = []; const seen = new Set(); let pageIndex = 1
      while (true) {
        const page = await this.sourcePage({ pageIndex, pageSize: 200, keyword: '', parentValue: parent?.treeParentValue })
        const next = page.treeRows || page.options.map((option) => option.raw)
        const fresh = next.filter((row) => row && !seen.has(String(row[this.field.tree.valueKey])))
        fresh.forEach((row) => seen.add(String(row[this.field.tree.valueKey])))
        rows.push(...fresh)
        if (!page.hasMore || page.clientPaging) break
        if (!fresh.length || pageIndex >= 100) throw new Error('树数据分页不完整，请检查数据源')
        pageIndex += 1
      }
      return rows
    },
    async loadTreeChildren(parent) { return filterTreeOptions(this.field, await this.treeRows(parent), parent) },
    async loadOptions(options) {
      if (this.field.tree) {
        if (!this.treeCache) this.treeCache = filterTreeOptions(this.field, await this.treeRows())
        const keyword = String(options.keyword || '').toLowerCase()
        const rows = keyword ? this.treeCache.filter((option) => option.label.toLowerCase().includes(keyword)) : this.treeCache
        return { options: rows.map((row) => ({ ...row })), total: rows.length, totalKnown: true, hasMore: false }
      }
      const page = await this.sourcePage(options)
      return { ...page, options: filterOptionRows({ ...this.field, storage: this.field.storage || (this.field.multiValueLike ? 'array' : 'scalar') }, page.options) }
    },
    async loadChips() {
      if (this.chipLoading) return
      this.chipLoading = true; this.chipError = ''
      try {
        const page = await this.sourcePage({ pageIndex: this.chipPage, pageSize: 20, keyword: '' })
        const keys = new Set(this.chipOptions.map((option) => String(option.value)))
        this.chipOptions.push(...page.options.filter((option) => !keys.has(String(option.value))))
        this.chipHasMore = page.hasMore && !page.clientPaging; this.chipPage += 1
      } catch (error) { this.chipError = error.message || '加载失败' } finally { this.chipLoading = false }
    }
  }
}
</script>

<style scoped>
.list-filter-control { font-size: 25rpx; color: #284957; }
.filter-input, .filter-range, .date-input { min-height: 72rpx; box-sizing: border-box; border: 1px solid #dce6eb; border-radius: 12rpx; background: #fff; padding: 16rpx; }
.filter-range, .date-row, .region-row, .toggle-row { display: flex; align-items: center; gap: 14rpx; }
.filter-range input { flex: 1; width: 0; }
.date-range { display: flex; flex-direction: column; gap: 14rpx; }
.date-label { color: #67808b; font-size: 23rpx; flex-shrink: 0; }
.date-row picker, .region-row picker { flex: 1; min-width: 0; }
.date-input { display: flex; align-items: center; font-size: 23rpx; }
.clear { display: flex; align-items: center; justify-content: center; min-width: 48rpx; min-height: 64rpx; color: #7e949e; font-size: 34rpx; }
.placeholder { color: #8fa1a9; }
.toggle-row { justify-content: space-between; }
.filter-options, .selected-tags { display: flex; flex-wrap: wrap; gap: 12rpx; }
.filter-option { display: flex; align-items: center; gap: 8rpx; min-height: 64rpx; padding: 0 20rpx; border: 1px solid #dce6eb; border-radius: 12rpx; background: #f8fafb; }
.filter-option.active { color: #087da8; border-color: #70b9cd; background: #eaf5f8; }
.radio-mark { font-size: 29rpx; }
.filter-check { display: flex; flex-shrink: 0; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; border: 1px solid #b7cbd4; border-radius: 5rpx; background: #fff; }
.filter-check.checked { border-color: #087da8; background: #087da8; color: #fff; font-size: 22rpx; }
.selected-tags { margin-top: 14rpx; }
.selected-tag { display: flex; align-items: center; gap: 12rpx; max-width: 100%; padding: 10rpx 16rpx; color: #087da8; border-radius: 8rpx; background: #eaf5f8; font-size: 23rpx; }
.selected-tag text:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.option-state { display: block; padding: 20rpx 0; color: #67808b; }
</style>
