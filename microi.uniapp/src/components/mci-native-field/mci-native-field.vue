<template>
  <view class="native-control" :class="[`native-control--${component.toLowerCase()}`, { 'native-control--readonly': readonly, 'native-control--avatar': isAvatar, 'native-control--select-open': selectorOpen }]">
    <template v-if="readonly">
      <mci-media-uploader v-if="isImage" :model-value="modelValue" :max-count="mediaMaxCount" :shape="isAvatar ? 'circle' : 'square'" readonly />
      <mci-media-uploader v-else-if="isFile" :model-value="modelValue" media-type="file" readonly />
      <rich-text v-else-if="isRichDisplay" class="native-control__richtext" :nodes="richHtml" />
      <view v-else-if="component === 'Progress'" class="native-control__progress"><progress :percent="numberValue" activeColor="#087da8" /><text>{{ numberValue }}%</text></view>
      <view v-else-if="component === 'ColorPicker'" class="native-control__color-readonly"><view :style="{ backgroundColor: String(modelValue || '#ffffff') }"></view><text>{{ displayText }}</text></view>
      <image v-else-if="component === 'Qrcode' && qrcodeUrl" class="native-control__qrcode" :src="qrcodeUrl" mode="aspectFit" />
      <view v-else-if="component === 'Alert'" class="native-control__alert"><text>{{ displayText }}</text></view>
      <text v-else class="native-control__value">{{ displayText }}</text>
    </template>

    <textarea
      v-else-if="['Textarea', 'CodeEditor', 'JsonTable'].includes(component)"
      class="native-control__input native-control__textarea"
      :class="{ 'native-control__textarea--code': ['CodeEditor', 'JsonTable'].includes(component) }"
      :value="editableText"
      :placeholder="field.placeholder"
	  :auto-height="true"
      :maxlength="-1"
      @input="emitValue($event.detail.value)"
    />

    <editor
      v-else-if="component === 'RichText'"
      class="native-control__editor"
      :placeholder="field.placeholder"
      show-img-size
      show-img-toolbar
      show-img-resize
      @ready="editorReady"
      @input="emitValue($event.detail.html || '')"
    />

    <input
      v-else-if="component === 'NumberText'"
      class="native-control__input"
      type="digit"
      :value="modelValue"
      :placeholder="field.placeholder"
      @input="emitValue($event.detail.value)"
    />

    <switch
      v-else-if="component === 'Switch'"
      class="native-control__switch"
      :checked="booleanValue"
      color="#087da8"
      @change="emitValue($event.detail.value)"
    />

    <picker v-else-if="component === 'Address'" mode="region" :value="regionValue" @change="changeRegion">
      <view class="native-control__input native-control__picker"><text :class="{ placeholder: !regionText }">{{ regionText || field.placeholder }}</text><text>›</text></view>
    </picker>

    <view v-else-if="['Map', 'MapArea'].includes(component)" class="native-control__map" hover-class="native-control__pressed" @tap="chooseLocation">
      <view class="native-control__map-mark"><text>⌖</text></view>
      <view><text>{{ mapText || field.placeholder }}</text><text>{{ component === 'MapArea' ? '选择区域中心位置' : '调用系统地图定位' }}</text></view>
      <text>›</text>
    </view>

    <view v-else-if="component === 'DateTime'" class="native-control__datetime" :class="{ 'native-control__datetime--single': !dateHasTime }">
      <picker v-if="dateMode !== 'time'" mode="date" :fields="dateFields" :value="datePart" @change="changeDate">
        <view class="native-control__input native-control__picker"><text :class="{ placeholder: !datePart }">{{ datePart || field.placeholder }}</text><text>›</text></view>
      </picker>
      <picker v-if="dateHasTime || dateMode === 'time'" mode="time" :value="timePart" @change="changeTime">
        <view class="native-control__input native-control__picker"><text :class="{ placeholder: !timePart }">{{ timePart || '选择时间' }}</text><text>›</text></view>
      </picker>
    </view>

    <radio-group v-else-if="component === 'Radio' && field.options.length" class="native-control__options" @change="changeRadio">
      <label v-for="option in field.options" :key="String(option.value)" class="native-control__option" :class="{ active: isOptionSelected(option) }">
        <radio :value="String(option.value)" :checked="isOptionSelected(option)" color="#087da8" />
        <text>{{ option.label }}</text>
      </label>
    </radio-group>

    <view v-else-if="isDropdownOption" class="native-select">
      <view class="native-control__input native-select__trigger" :class="{ open: selectorOpen }" hover-class="native-control__pressed" @tap="openSelector">
        <view class="native-select__content">
          <view v-if="selectorOpen" class="native-select__inline-search" @tap.stop>
            <view v-if="isMultiple && selectedPreview.length" class="native-select__selection multiple">
              <text v-for="item in selectedPreview" :key="item.key" class="native-select__chip">{{ item.label }}</text>
              <text v-if="selectedExtraCount" class="native-select__more">+{{ selectedExtraCount }}</text>
            </view>
            <input v-model="searchKeyword" class="native-select__search-input" type="text" confirm-type="search"
              :focus="selectorOpen" :placeholder="hasSelection ? '' : '输入关键词检索'" @input="scheduleSearch"
              @confirm="loadOptionPage(true)" />
          </view>
          <view v-else-if="selectedPreview.length" class="native-select__selection" :class="{ multiple: isMultiple }">
            <text v-for="item in selectedPreview" :key="item.key" :class="{ 'native-select__chip': isMultiple }">{{ item.label }}</text>
            <text v-if="selectedExtraCount" class="native-select__more">+{{ selectedExtraCount }}</text>
          </view>
          <text v-else class="placeholder">{{ field.placeholder }}</text>
        </view>

        <text v-if="hasSelection || searchKeyword" class="native-select__clear" @tap.stop="clearDropdownSelection">×</text>
        <text class="native-select__chevron">›</text>
      </view>

      <view v-if="selectorOpen" class="native-select__backdrop" @tap="closeSelector"></view>
      <view v-if="selectorOpen" class="native-select__popover" :class="{ above: selectorPlacement === 'top' }" @tap.stop>
        <view class="native-select__pointer"></view>
        <scroll-view class="native-select__list" scroll-y :lower-threshold="60" @scrolltolower="loadMoreOptions">
          <view v-if="optionLoading && !selectorOptions.length" class="native-select__loading">
            <view v-for="index in 4" :key="index"></view>
          </view>
          <view v-else-if="optionError && !selectorOptions.length" class="native-select__state">
            <text>{{ optionError }}</text>
            <text class="native-select__retry" @tap="loadOptionPage(true)">重新加载</text>
          </view>
          <view v-else-if="!selectorOptions.length" class="native-select__state">
            <text>{{ searchKeyword ? '没有匹配的选项' : '暂无可选数据' }}</text>
            <text v-if="!optionFinished" class="native-select__retry" @tap="loadMoreOptions">继续检索后续数据</text>
          </view>
          <view v-else>
            <view v-for="option in selectorOptions" :key="String(option.value)" class="native-select__option"
              :class="{ selected: isDraftSelected(option), multiple: isMultiple }" hover-class="native-select__option--pressed"
              @tap="selectDropdownOption(option)">
              <view v-if="isMultiple" class="native-select__checkbox" :class="{ checked: isDraftSelected(option) }">
                <text>{{ isDraftSelected(option) ? '✓' : '' }}</text>
              </view>
              <text class="native-select__option-label">{{ option.label }}</text>
              <text v-if="!isMultiple && isDraftSelected(option)" class="native-select__check">✓</text>
            </view>
            <view class="native-select__footer">
              <text>{{ optionLoading ? '正在加载…' : optionFinished ? `共 ${optionTotal || selectorOptions.length} 项` : '上拉加载更多' }}</text>
            </view>
          </view>
        </scroll-view>

      </view>
    </view>

    <view v-else-if="isOptionComponent" class="native-control__unavailable"><text>{{ field.optionError || '暂无可选数据，请稍后重试' }}</text></view>

    <view v-else-if="component === 'Rate'" class="native-control__rate">
      <text v-for="star in 5" :key="star" :class="{ active: numberValue >= star }" @tap="emitValue(star)">★</text>
      <text>{{ numberValue ? `${numberValue} 分` : '未评分' }}</text>
    </view>

    <view v-else-if="['Slider', 'Progress'].includes(component)" class="native-control__slider">
      <slider :value="numberValue" :min="sliderMin" :max="sliderMax" activeColor="#087da8" backgroundColor="#dce8ed" show-value @change="emitValue($event.detail.value)" />
    </view>

    <view v-else-if="component === 'ColorPicker'" class="native-control__colors">
      <view v-for="color in colors" :key="color" :class="{ active: String(modelValue).toLowerCase() === color.toLowerCase() }" :style="{ backgroundColor: color }" @tap="emitValue(color)"><text>✓</text></view>
    </view>

    <view v-else-if="component === 'TagInput'" class="native-control__tags">
      <view v-for="(tag, index) in tagValues" :key="`${tag}-${index}`"><text>{{ tag }}</text><text @tap="removeTag(index)">×</text></view>
      <input v-model="tagDraft" type="text" confirm-type="done" placeholder="输入后回车添加" @confirm="addTag" />
    </view>

    <mci-media-uploader
      v-else-if="isImage"
      :model-value="modelValue"
      :max-count="mediaMaxCount"
      :shape="isAvatar ? 'circle' : 'square'"
      :upload-path="uploadPath"
      @update:model-value="emitValue"
    />

    <mci-media-uploader
      v-else-if="isFile"
      :model-value="modelValue"
      media-type="file"
      :max-count="mediaMaxCount"
      :upload-path="uploadPath"
      @update:model-value="emitValue"
    />

    <rich-text v-else-if="component === 'Html' && modelValue" class="native-control__richtext" :nodes="richHtml" />

    <view v-else-if="['StaticText', 'Alert', 'Qrcode', 'FontAwesome'].includes(component)" class="native-control__alert"><text>{{ displayText }}</text></view>

    <input
      v-else
      class="native-control__input"
      :type="inputType"
      :password="field.inputMode === 'password'"
      :value="modelValue"
      :placeholder="field.placeholder"
      @input="emitValue($event.detail.value)"
    />
  </view>
</template>

<script>
import {
  filterNativeFieldOptions,
  fieldDisplayValue,
  isNativeFieldMultiple,
  isRemoteNativeFieldOptions,
  loadNativeFieldOptionPage,
  parseJson
} from '@/platform/native-form.js'
import { V8 } from '@/utils/request.js'
import { isHtmlValue, normalizeRichTextHtml } from '@/platform/display.js'

const OPTION_COMPONENTS = new Set(['Select', 'MultipleSelect', 'Radio', 'Checkbox', 'Autocomplete', 'Cascader', 'SelectTree', 'TreeCheckbox', 'Department', 'Transfer'])
export default {
  name: 'MciNativeField',
  props: {
    field: { type: Object, required: true },
    modelValue: { type: [String, Number, Boolean, Array, Object], default: '' },
    readonly: { type: Boolean, default: false },
    tableName: { type: String, default: '' },
    formData: { type: Object, default: () => ({}) },
    menuId: { type: String, default: '' },
    moduleEngineKey: { type: String, default: '' },
    tableChildAuth: { type: Object, default: null }
  },
  // zhy: 通知表单页同步下拉框的打开状态，便于提升外层卡片层级。
  emits: ['update:modelValue', 'change', 'select', 'selector-toggle'],
  data() {
    return {
      tagDraft: '',
      editorContext: null,
      colors: ['#087da8', '#18a6b8', '#16a36f', '#e5a523', '#e54625', '#7a5ab6', '#344b5a', '#ffffff'],
      selectorOpen: false,
      searchKeyword: '',
      selectorOptions: [],
      knownOptions: [],
      optionPageIndex: 1,
      optionPageSize: 20,
      optionTotal: 0,
      optionFinished: false,
      optionLoading: false,
      optionError: '',
      clientOptionRows: [],
      selectorPlacement: 'bottom',
      draftIds: [],
      draftValues: {},
      searchTimer: null,
      optionRequestId: 0
    }
  },
  computed: {
    component() { return String(this.field.component || 'Text') },
    isImage() { return this.component === 'ImgUpload' },
    isFile() { return this.component === 'FileUpload' },
    isAvatar() { return /avatar|headimg|touxiang/i.test(String(this.field.Name || '')) || /头像/.test(String(this.field.Label || '')) },
    isMultiple() { return isNativeFieldMultiple(this.field) },
    isOptionComponent() { return OPTION_COMPONENTS.has(this.component) },
    isDropdownOption() { return this.isOptionComponent && this.component !== 'Radio' },
    hasRemoteOptions() { return isRemoteNativeFieldOptions(this.field) },
    isRichDisplay() { return !!this.modelValue && (['RichText', 'Html'].includes(this.component) || isHtmlValue(this.modelValue)) },
    richHtml() { return normalizeRichTextHtml(this.modelValue) },
    qrcodeUrl() { return this.component === 'Qrcode' ? V8.assetUrl(this.modelValue) : '' },
    displayText() { return fieldDisplayValue(this.field, this.modelValue) },
    editableText() {
      if (this.component !== 'JsonTable') return String(this.modelValue || '')
      const parsed = parseJson(this.modelValue, this.modelValue)
      return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed || '')
    },
    booleanValue() { return this.modelValue === true || this.modelValue === 1 || this.modelValue === '1' || String(this.modelValue).toLowerCase() === 'true' },
    numberValue() { const value = Number(this.modelValue || 0); return Number.isFinite(value) ? value : 0 },
    inputType() { return ['tel', 'number', 'digit', 'idcard'].includes(this.field.inputMode) ? this.field.inputMode : 'text' },
    uploadPath() {
      if (this.isAvatar) return 'avatar'
      return this.isImage ? 'img' : 'file'
    },
    mediaMaxCount() {
      if (this.isAvatar) return 1
      const config = this.field.config || {}
      return Math.max(1, Number(config.UploadLimit || config.ImgUploadLimit || config.FileUploadLimit || 9))
    },
    regionValue() {
      const value = parseJson(this.modelValue, this.modelValue)
      if (Array.isArray(value)) return value
      if (value && typeof value === 'object') return [value.Province || value.province, value.City || value.city, value.Area || value.area || value.District || value.district].filter(Boolean)
      return []
    },
    regionText() { return this.regionValue.join('') },
    mapValue() { return parseJson(this.modelValue, {}) || {} },
    mapText() { return this.mapValue.address || this.mapValue.Address || this.mapValue.name || this.mapValue.Name || (typeof this.modelValue === 'string' && !this.modelValue.trim().startsWith('{') ? this.modelValue : '') },
    dateMode() {
      const raw = String((this.field.config && this.field.config.DateTimeType) || 'date').toLowerCase()
      if (raw === 'hh:mm' || raw === 'hh:mm:ss' || raw === 'time') return 'time'
      if (raw.startsWith('datetime')) return 'datetime'
      if (raw === 'months') return 'month'
      if (raw === 'years') return 'year'
      if (raw === 'dates' || raw === 'week') return 'date'
      return raw
    },
    dateHasTime() { return this.dateMode === 'datetime' },
    dateFields() { return this.dateMode === 'year' ? 'year' : this.dateMode === 'month' ? 'month' : 'day' },
    datePart() { return this.modelValue ? String(this.modelValue).replace('T', ' ').slice(0, this.dateMode === 'year' ? 4 : this.dateMode === 'month' ? 7 : 10) : '' },
    timePart() { const value = this.modelValue ? String(this.modelValue).replace('T', ' ') : ''; return value.length >= 16 ? value.slice(11, 16) : this.dateMode === 'time' ? value.slice(0, 5) : '' },
    selectedLabel() {
      const value = parseJson(this.modelValue, this.modelValue)
      const option = this.knownOptions.find((item) => String(item.value) === String(this.singleValue))
      return option ? option.label : (value && typeof value === 'object' ? value.Name || value.Value || value.Label || '' : String(value || ''))
    },
    singleValue() {
      const value = parseJson(this.modelValue, this.modelValue)
      const config = this.field.config || {}
      return value && typeof value === 'object'
        ? (value[config.SelectSaveField] ?? value.Id ?? value.Key ?? value.value ?? value.Value)
        : value
    },
    multipleValues() {
      const value = parseJson(this.modelValue, this.modelValue)
      const config = this.field.config || {}
      return (Array.isArray(value) ? value : value ? [value] : []).map((item) => String(item && typeof item === 'object' ? (item[config.SelectSaveField] ?? item.Id ?? item.Key ?? item.value) : item))
    },
    selectionItems() {
      const parsed = parseJson(this.modelValue, this.modelValue)
      const values = this.isMultiple
        ? (Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
        : (parsed === null || parsed === undefined || parsed === '' ? [] : [parsed])
      const config = this.field.config || {}
      return values.map((raw, index) => {
        const key = raw && typeof raw === 'object'
          ? (raw[config.SelectSaveField] ?? raw.Id ?? raw.Key ?? raw.value ?? raw.Value)
          : raw
        const option = this.knownOptions.find((item) =>
          String(item.value) === String(key) ||
          (typeof raw !== 'object' && String(item.label) === String(raw))
        )
        const fallback = raw && typeof raw === 'object'
          ? (raw[config.SelectLabel] ?? raw[config.LabelField] ?? raw.Name ?? raw.Value ?? raw.Label ?? key)
          : raw
        return {
          key: `${String(key)}:${index}`,
          value: String(key),
          label: option ? option.label : String(fallback ?? '')
        }
      }).filter((item) => item.label)
    },
    selectedPreview() { return this.selectionItems.slice(0, this.isMultiple ? 2 : 1) },
    selectedExtraCount() { return this.isMultiple ? Math.max(0, this.selectionItems.length - this.selectedPreview.length) : 0 },
    hasSelection() { return this.currentSelectionValues().length > 0 },
    tagValues() {
      const value = parseJson(this.modelValue, this.modelValue)
      if (Array.isArray(value)) return value.map(String).filter(Boolean)
      return String(value || '').split(/[,，]/).map((item) => item.trim()).filter(Boolean)
    },
    sliderMin() { return Number((this.field.config && this.field.config.Min) || 0) },
    sliderMax() { return Number((this.field.config && this.field.config.Max) || 100) }
  },
  watch: {
    'field.options': {
      immediate: true,
      deep: true,
      handler(options) { this.rememberOptions(Array.isArray(options) ? options : []) }
    }
  },
  beforeUnmount() {
    if (this.searchTimer) clearTimeout(this.searchTimer)
    // zhy: 分组折叠销毁控件时终止尚未完成的下拉选项请求。
    this.selectorOpen = false
    this.optionRequestId += 1
  },
  methods: {
    emitValue(value) { this.$emit('update:modelValue', value); this.$emit('change', value) },
    optionValue(option) {
      const config = this.field.config || {}
      const raw = option.raw
      // zhy：多选与平台保持一致，保存数据源返回的完整行对象，不按 SelectSaveField 裁剪。
      if (this.isMultiple && raw && typeof raw === 'object') return raw
      return String(config.SelectSaveFormat || '').toLowerCase() === 'json' ? raw : option.value
    },
    isOptionSelected(option) { return this.multipleValues.includes(String(option.value)) || (!this.isMultiple && String(this.singleValue) === String(option.value)) },
    changeOption(event) { const option = this.field.options[Number(event.detail.value)]; if (option) this.emitValue(this.optionValue(option)) },
    changeRadio(event) { const option = this.field.options.find((item) => String(item.value) === String(event.detail.value)); this.emitValue(option ? this.optionValue(option) : event.detail.value) },
    changeMultiple(event) {
      const values = event.detail.value || []
      this.emitValue(values.map((value) => { const option = this.field.options.find((item) => String(item.value) === String(value)); return option ? this.optionValue(option) : value }))
    },
    rememberOptions(options) {
      const map = new Map(this.knownOptions.map((item) => [String(item.value), item]))
      ;(Array.isArray(options) ? options : []).forEach((item) => {
        if (item) map.set(String(item.value), item)
      })
      this.knownOptions = [...map.values()]
    },
    currentSelectionValues() {
      const parsed = parseJson(this.modelValue, this.modelValue)
      return this.isMultiple
        ? (Array.isArray(parsed) ? parsed : parsed ? [parsed] : [])
        : (parsed === null || parsed === undefined || parsed === '' ? [] : [parsed])
    },
    selectionKey(value) {
      const config = this.field.config || {}
      return String(value && typeof value === 'object'
        ? (value[config.SelectSaveField] ?? value.Id ?? value.Key ?? value.value ?? value.Value)
        : value)
    },
    initializeDraftSelection() {
      const values = this.currentSelectionValues()
      this.draftIds = []
      this.draftValues = {}
      values.forEach((value) => {
        const rawKey = this.selectionKey(value)
        const known = this.knownOptions.find((option) =>
          String(option.value) === rawKey ||
          (typeof value !== 'object' && String(option.label) === String(value))
        )
        const key = known ? String(known.value) : rawKey
        if (!key || this.draftIds.includes(key)) return
        this.draftIds.push(key)
        this.draftValues[key] = value
      })
    },
    async openSelector() {
      if (this.readonly || this.selectorOpen) return
      const config = this.field.config || {}
      const configuredPageSize = Number(config.SelectPageSize || config.PageSize || 20)
      this.optionPageSize = Number.isFinite(configuredPageSize)
        ? Math.min(100, Math.max(10, configuredPageSize))
        : 20
      this.selectorOpen = true
      this.selectorPlacement = 'bottom'
      this.searchKeyword = ''
      this.selectorOptions = []
      this.clientOptionRows = []
      this.optionPageIndex = 1
      this.optionTotal = 0
      this.optionFinished = false
      this.optionError = ''
      this.initializeDraftSelection()
      // zhy: 下拉打开后让所在表单卡片解除裁切并显示在最上层。
      this.$emit('selector-toggle', true)
      this.$nextTick(() => this.updateSelectorPlacement())
      await this.loadOptionPage(true)
    },
    updateSelectorPlacement() {
      try {
        const windowInfo = uni.getWindowInfo ? uni.getWindowInfo() : uni.getSystemInfoSync()
        uni.createSelectorQuery().in(this).select('.native-select__trigger').boundingClientRect((rect) => {
          if (!rect) return
          const below = Number(windowInfo.windowHeight || windowInfo.screenHeight || 0) - Number(rect.bottom || 0)
          this.selectorPlacement = below < 350 && Number(rect.top || 0) > below ? 'top' : 'bottom'
        }).exec()
      } catch (error) {
        this.selectorPlacement = 'bottom'
      }
    },
    closeSelector() {
      if (!this.selectorOpen) return
      this.selectorOpen = false
      // zhy: 下拉关闭后恢复表单卡片原有层级。
      this.$emit('selector-toggle', false)
      this.optionRequestId += 1
      if (this.searchTimer) {
        clearTimeout(this.searchTimer)
        this.searchTimer = null
      }
      this.searchKeyword = ''
    },
    scheduleSearch() {
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => {
        this.searchTimer = null
        this.loadOptionPage(true)
      }, 300)
    },
    clearSearch(reload = true) {
      this.searchKeyword = ''
      if (this.searchTimer) clearTimeout(this.searchTimer)
      this.searchTimer = null
      if (reload && this.selectorOpen) this.loadOptionPage(true)
    },
    clearDropdownSelection() {
      this.draftIds = []
      this.draftValues = {}
      this.emitValue(this.isMultiple ? [] : '')
      this.$emit('select', {
        field: this.field,
        value: this.isMultiple ? [] : '',
        options: [],
        raw: this.isMultiple ? [] : null,
        multiple: this.isMultiple,
        cleared: true
      })
      this.clearSearch()
    },
    filterLocalOptions(options) {
      return filterNativeFieldOptions(options, this.searchKeyword)
    },
    appendSelectorOptions(options, reset = false) {
      const rows = reset ? [] : [...this.selectorOptions]
      const keys = new Set(rows.map((item) => String(item.value)))
      ;(Array.isArray(options) ? options : []).forEach((item) => {
        const key = String(item.value)
        if (!keys.has(key)) {
          keys.add(key)
          rows.push(item)
        }
      })
      this.selectorOptions = rows
      this.rememberOptions(options)
      if (this.isMultiple && this.draftIds.length) {
        const values = { ...this.draftValues }
        ;(Array.isArray(options) ? options : []).forEach((option) => {
          const key = String(option && option.value)
          if (this.draftIds.includes(key) && option.raw && typeof option.raw === 'object') {
            values[key] = option.raw
          }
        })
        this.draftValues = values
      }
    },
    loadClientOptionPage(reset = false) {
      const source = this.clientOptionRows.length
        ? this.clientOptionRows
        : this.filterLocalOptions(this.field.options || [])
      const start = (this.optionPageIndex - 1) * this.optionPageSize
      const rows = source.slice(start, start + this.optionPageSize)
      this.appendSelectorOptions(rows, reset)
      this.optionTotal = source.length
      this.optionFinished = start + rows.length >= source.length
    },
    async loadOptionPage(reset = false) {
      if (this.optionLoading && !reset) return
      if (reset) {
        this.optionPageIndex = 1
        this.selectorOptions = []
        this.clientOptionRows = []
        this.optionTotal = 0
        this.optionFinished = false
      }
      if (!this.hasRemoteOptions) {
        this.loadClientOptionPage(reset)
        return
      }

      const requestId = ++this.optionRequestId
      this.optionLoading = true
      this.optionError = ''
      try {
        const page = await loadNativeFieldOptionPage(this.field, this.formData, {
          keyword: this.searchKeyword,
          pageIndex: this.optionPageIndex,
          pageSize: this.optionPageSize,
          menuId: this.menuId,
          moduleEngineKey: this.moduleEngineKey,
          tableChildAuth: this.tableChildAuth
        })
        if (!this.selectorOpen || requestId !== this.optionRequestId) return
        if (page.clientPaging) {
          this.clientOptionRows = this.filterLocalOptions(page.options)
          this.loadClientOptionPage(true)
        } else {
          const before = this.selectorOptions.length
          this.appendSelectorOptions(page.options, reset)
          this.optionTotal = page.totalKnown ? Number(page.total || 0) : this.selectorOptions.length
          this.optionFinished = !page.hasMore || (!reset && this.selectorOptions.length === before)
          if (this.searchKeyword && !this.selectorOptions.length && !this.optionFinished) {
            await this.scanFollowingOptionPages(requestId, 4)
          }
        }
      } catch (error) {
        if (requestId !== this.optionRequestId) return
        this.optionError = error.message || error.Msg || '选项加载失败'
      } finally {
        if (requestId === this.optionRequestId) this.optionLoading = false
      }
    },
    loadMoreOptions() {
      if (this.optionLoading || this.optionFinished) return
      this.optionPageIndex += 1
      if (this.clientOptionRows.length || !this.hasRemoteOptions) this.loadClientOptionPage()
      else this.loadOptionPage()
    },
    async scanFollowingOptionPages(requestId, remaining) {
      while (remaining > 0 && this.selectorOpen && requestId === this.optionRequestId && !this.optionFinished && !this.selectorOptions.length) {
        this.optionPageIndex += 1
        const page = await loadNativeFieldOptionPage(this.field, this.formData, {
          keyword: this.searchKeyword,
          pageIndex: this.optionPageIndex,
          pageSize: this.optionPageSize,
          menuId: this.menuId,
          moduleEngineKey: this.moduleEngineKey,
          tableChildAuth: this.tableChildAuth
        })
        if (!this.selectorOpen || requestId !== this.optionRequestId) return
        if (page.clientPaging) {
          this.clientOptionRows = this.filterLocalOptions(page.options)
          this.optionPageIndex = 1
          this.loadClientOptionPage(true)
          return
        }
        this.appendSelectorOptions(page.options)
        this.optionTotal = page.totalKnown ? Number(page.total || 0) : this.selectorOptions.length
        this.optionFinished = !page.hasMore
        remaining -= 1
      }
    },
    isDraftSelected(option) { return this.draftIds.includes(String(option.value)) },
    selectDropdownOption(option) {
      const key = String(option.value)
      this.rememberOptions([option])
      if (!this.isMultiple) {
        const value = this.optionValue(option)
        this.draftIds = [key]
        this.draftValues = { [key]: value }
        this.emitValue(value)
        this.$emit('select', {
          field: this.field,
          value,
          option,
          raw: option.raw,
          multiple: false
        })
        this.closeSelector()
        return
      }
      const index = this.draftIds.indexOf(key)
      if (index >= 0) {
        this.draftIds.splice(index, 1)
        const values = { ...this.draftValues }
        delete values[key]
        this.draftValues = values
      } else {
        this.draftIds.push(key)
        this.draftValues = { ...this.draftValues, [key]: this.optionValue(option) }
      }
      const values = this.draftIds.map((key) => Object.prototype.hasOwnProperty.call(this.draftValues, key) ? this.draftValues[key] : key)
      const options = this.draftIds.map((key) => this.knownOptions.find((option) => String(option.value) === key)).filter(Boolean)
      this.emitValue(values)
      this.$emit('select', {
        field: this.field,
        value: values,
        options,
        raw: options.map((option) => option.raw),
        multiple: true
      })
    },
    changeRegion(event) { this.emitValue(JSON.stringify(event.detail.value || [])) },
    chooseLocation() {
      uni.chooseLocation({ success: (location) => this.emitValue(JSON.stringify({ address: location.address || location.name, name: location.name, latitude: location.latitude, longitude: location.longitude })) })
    },
    changeDate(event) {
      const value = event.detail.value
      if (this.dateHasTime) this.emitValue(`${value} ${this.timePart || '00:00'}:00`)
      else this.emitValue(value)
    },
    changeTime(event) {
      if (this.dateMode === 'time') this.emitValue(event.detail.value)
      else this.emitValue(`${this.datePart || new Date().toISOString().slice(0, 10)} ${event.detail.value}:00`)
    },
    addTag() {
      const value = this.tagDraft.trim()
      if (!value || this.tagValues.includes(value)) return
      this.emitValue(JSON.stringify([...this.tagValues, value]))
      this.tagDraft = ''
    },
    removeTag(index) { const values = [...this.tagValues]; values.splice(index, 1); this.emitValue(JSON.stringify(values)) },
    editorReady() {
      const query = uni.createSelectorQuery().in(this)
      query.select('.native-control__editor').context((result) => {
        this.editorContext = result && result.context
        if (this.editorContext && this.modelValue) this.editorContext.setContents({ html: String(this.modelValue) })
      }).exec()
    }
  }
}
</script>

<style scoped>
.native-control { position: relative; }
.native-control--select-open { z-index: 90; }
.native-control__input { box-sizing: border-box; width: 100%; height: 82rpx; padding: 0 22rpx; border: 1px solid #dce7eb; border-radius: 8px; color: #18343e; background: #f9fbfc; font-size: 27rpx; }
.native-control__textarea { min-height: 190rpx; padding-top: 18rpx; padding-bottom: 18rpx; line-height: 1.6; }
.native-control__textarea--code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; font-size: 23rpx; }
.native-control__editor { box-sizing: border-box; min-height: 260rpx; padding: 18rpx; border: 1px solid #dce7eb; border-radius: 8px; background: #f9fbfc; }
.native-control__picker { display: flex; align-items: center; justify-content: space-between; line-height: 82rpx; }
.native-control__picker > text:last-child { color: #7d929a; font-size: 38rpx; }
.placeholder { color: #9aa9af; }
.native-select { position: relative; }
.native-select__trigger { display: flex; align-items: center; gap: 12rpx; padding-right: 16rpx; transition: border-color .16s ease, box-shadow .16s ease, background-color .16s ease; }
.native-select__trigger.open { border-color: #087da8; background: #fff; box-shadow: 0 0 0 2rpx rgba(8,125,168,.10); }
.native-select__content { flex: 1; min-width: 0; overflow: hidden; }
.native-select__content > .placeholder { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-select__selection { width: 100%; min-width: 0; display: flex; align-items: center; gap: 9rpx; overflow: hidden; }
.native-select__selection > text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-select__selection.multiple > text:first-child,.native-select__selection.multiple > text:nth-child(2) { flex: 0 1 auto; }
.native-select__chip { max-width: 42%; padding: 8rpx 12rpx; border-radius: 6px; color: #365864; background: #edf3f6; font-size: 22rpx; line-height: 30rpx; }
.native-select__more { flex: none; color: #087da8; font-size: 23rpx; font-weight: 650; }
.native-select__inline-search { width: 100%; min-width: 0; display: flex; align-items: center; gap: 9rpx; }
.native-select__inline-search .native-select__selection { width: auto; flex: none; max-width: 68%; }
.native-select__search-input { flex: 1; min-width: 72rpx; height: 74rpx; color: #294954; font-size: 24rpx; }
.native-select__clear { width: 34rpx; height: 34rpx; flex: none; border: 1px solid #9aabb2; border-radius: 50%; color: #82959c; font-size: 27rpx; line-height: 30rpx; text-align: center; box-sizing: border-box; }
.native-select__chevron { flex: none; color: #7d929a; font-size: 34rpx; line-height: 1; transform: rotate(90deg); transition: transform .16s ease; }
.native-select__trigger.open .native-select__chevron { transform: rotate(-90deg); }
.native-select__backdrop { position: fixed; inset: 0; z-index: 1; background: transparent; }
.native-select__popover { position: absolute; top: calc(100% + 14rpx); right: 0; left: 0; z-index: 2; overflow: visible; border: 1px solid #d9e3e7; border-radius: 8px; background: #fff; box-shadow: 0 14rpx 38rpx rgba(24,55,68,.16); animation: nativeSelectIn .16s ease both; }
.native-select__popover.above { top: auto; bottom: calc(100% + 14rpx); }
.native-select__pointer { position: absolute; top: -11rpx; left: 50%; width: 20rpx; height: 20rpx; border-top: 1px solid #d9e3e7; border-left: 1px solid #d9e3e7; background: #fff; transform: translateX(-50%) rotate(45deg); }
.native-select__popover.above .native-select__pointer { top: auto; bottom: -11rpx; border: 0; border-right: 1px solid #d9e3e7; border-bottom: 1px solid #d9e3e7; }
.native-select__list { height: 420rpx; }
.native-select__option { min-height: 78rpx; display: grid; grid-template-columns: minmax(0,1fr) 44rpx; align-items: center; gap: 12rpx; padding: 0 22rpx; border-bottom: 1px solid #edf2f4; color: #405a64; background: #fff; font-size: 25rpx; transition: background-color .14s ease; box-sizing: border-box; }
.native-select__option.multiple { grid-template-columns: 48rpx minmax(0,1fr); }
.native-select__option.selected { color: #1b566c; background: #f0f6f9; }
.native-select__option--pressed { background: #eaf3f7; }
.native-select__option-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-select__check { color: #087da8; font-size: 29rpx; font-weight: 700; text-align: right; }
.native-select__checkbox { width: 36rpx; height: 36rpx; display: flex; align-items: center; justify-content: center; border: 1px solid #ccd9de; border-radius: 5px; color: #fff; background: #fff; box-sizing: border-box; }
.native-select__checkbox.checked { border-color: #087da8; background: #087da8; }
.native-select__checkbox text { font-size: 24rpx; line-height: 1; }
.native-select__footer { height: 64rpx; display: flex; align-items: center; justify-content: center; color: #8a9ba2; font-size: 20rpx; }
.native-select__state { min-height: 270rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16rpx; color: #84969d; font-size: 23rpx; }
.native-select__retry { color: #087da8; font-weight: 650; }
.native-select__loading { padding: 8rpx 20rpx; }
.native-select__loading view { height: 62rpx; margin-bottom: 10rpx; border-radius: 6px; background: linear-gradient(90deg,#edf2f4 25%,#f8fafb 42%,#edf2f4 62%); background-size: 400% 100%; animation: nativeSelectShimmer 1.2s ease infinite; }
.native-control__switch { transform: scale(.9); transform-origin: left center; }
.native-control__datetime { display: grid; grid-template-columns: 1.35fr 1fr; gap: 14rpx; }
.native-control__datetime--single { grid-template-columns: 1fr; }
.native-control__map { min-height: 92rpx; display: grid; grid-template-columns: 58rpx minmax(0,1fr) 28rpx; gap: 13rpx; align-items: center; padding: 0 18rpx; border: 1px solid #dce7eb; border-radius: 8px; background: #f8fbfc; transition: transform .16s ease; }
.native-control__map-mark { width: 50rpx; height: 50rpx; border-radius: 50%; color: #fff; background: #087da8; font-size: 34rpx; line-height: 50rpx; text-align: center; }
.native-control__map > view:nth-child(2) text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.native-control__map > view:nth-child(2) text:first-child { color: #365864; font-size: 24rpx; }
.native-control__map > view:nth-child(2) text:last-child { margin-top: 4rpx; color: #8a9ca3; font-size: 19rpx; }
.native-control__map > text { color: #91a3aa; font-size: 34rpx; }
.native-control__pressed { transform: scale(.985); }
.native-control__options { display: flex; flex-wrap: wrap; gap: 12rpx; }
.native-control__option { min-height: 62rpx; display: flex; align-items: center; padding: 0 17rpx; border: 1px solid #dce7eb; border-radius: 7px; color: #58727c; background: #f8fbfc; font-size: 23rpx; }
.native-control__option.active { border-color: rgba(8,125,168,.4); color: #087da8; background: #eaf6f9; }
.native-control__option radio,.native-control__option checkbox { transform: scale(.78); }
.native-control__rate { min-height: 66rpx; display: flex; align-items: center; gap: 10rpx; }
.native-control__rate > text { color: #d5dfe2; font-size: 42rpx; }
.native-control__rate > text.active { color: #efac28; }
.native-control__rate > text:last-child { margin-left: 12rpx; color: #71868f; font-size: 22rpx; }
.native-control__slider { padding: 8rpx 0; }
.native-control__colors { display: flex; flex-wrap: wrap; gap: 14rpx; }
.native-control__colors > view { width: 58rpx; height: 58rpx; border: 3px solid transparent; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(20,60,76,.14); }
.native-control__colors > view.active { border-color: #087da8; }
.native-control__colors text { display: none; color: #fff; font-size: 28rpx; line-height: 58rpx; text-align: center; text-shadow: 0 1px 2px rgba(0,0,0,.3); }
.native-control__colors > view.active text { display: block; }
.native-control__tags { display: flex; flex-wrap: wrap; gap: 10rpx; }
.native-control__tags > view { height: 54rpx; display: flex; align-items: center; gap: 9rpx; padding: 0 13rpx; border-radius: 6px; color: #087da8; background: #eaf6f9; font-size: 21rpx; }
.native-control__tags > view text:last-child { font-size: 28rpx; }
.native-control__tags input { flex: 1; min-width: 210rpx; height: 58rpx; padding: 0 14rpx; border-bottom: 1px solid #dce7eb; font-size: 23rpx; }
.native-control__unavailable,.native-control__alert { padding: 17rpx 19rpx; border-left: 3px solid #d99b1f; color: #6f5b2d; background: #fff9e8; font-size: 22rpx; line-height: 1.6; }
.native-control__value { display: block; color: #425b64; font-size: 27rpx; line-height: 1.65; white-space: pre-wrap; overflow-wrap: anywhere; }
.native-control__richtext { display: block; color: #425b64; font-size: 25rpx; line-height: 1.7; overflow-wrap: anywhere; }
.native-control__progress { display: grid; grid-template-columns: minmax(0,1fr) 70rpx; gap: 14rpx; align-items: center; }
.native-control__progress text { color: #58727c; font-size: 22rpx; text-align: right; }
.native-control__color-readonly { display: flex; align-items: center; gap: 14rpx; color: #425b64; font-size: 24rpx; }
.native-control__color-readonly view { width: 46rpx; height: 46rpx; border: 1px solid #dce7eb; border-radius: 50%; }
.native-control__qrcode { width: 260rpx; height: 260rpx; }
.native-control--avatar { max-width: 190rpx; }
@keyframes nativeSelectIn { from { opacity: 0; transform: translateY(-8rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes nativeSelectShimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .native-control__map,.native-select__trigger,.native-select__chevron { transition: none; }
  .native-select__popover,.native-select__loading view { animation: none; }
}
</style>
