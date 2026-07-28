<template>
  <view class="list-page" :style="mciTokenStyle">
    <view class="page-header mci-safe-top">
      <view class="nav-row mci-safe-nav-row">
        <view class="nav-icon" hover-class="nav-icon--pressed" @tap="goBack"><text>‹</text></view>
        <text class="nav-title">{{ config.title || '业务列表' }}</text>
        <view class="nav-icon" hover-class="nav-icon--pressed" @tap="openAdd"><text>＋</text></view>
      </view>

      <view class="search-row" :class="{ 'search-row--simple': !filterFields.length }">
        <input
          v-model="keyword"
          class="search-input"
          type="text"
          confirm-type="search"
          :placeholder="`搜索${config.title || '业务数据'}`"
          @confirm="search"
        />
        <view v-if="filterFields.length" class="filter-button" :class="{ active: activeFilterCount > 0 }" @tap="openAdvancedFilters">
          <text>筛选</text><text v-if="activeFilterCount">{{ activeFilterCount }}</text>
        </view>
        <view class="search-button" @tap="search">搜索</view>
      </view>

      <scroll-view class="period-tabs" scroll-x :show-scrollbar="false">
        <view class="period-tabs__inner">
        <view
          v-for="item in periods"
          :key="item.value"
          class="period-item"
          :class="{ active: period === item.value }"
          @tap="changePeriod(item.value)"
        ><text>{{ item.label }}</text><text class="period-item__count">{{ periodCount(item) }}</text></view>
        </view>
      </scroll-view>

      <view v-if="period === 'custom'" class="custom-range">
        <picker mode="date" :value="customStart" @change="customStart = $event.detail.value"><view>{{ customStart || '开始日期' }}</view></picker>
        <text>至</text>
        <picker mode="date" :value="customEnd" @change="customEnd = $event.detail.value"><view>{{ customEnd || '结束日期' }}</view></picker>
        <view class="custom-range__apply" @tap="applyCustomRange">确定</view>
      </view>

      <scroll-view v-if="statusOptions.length" class="status-scroll" scroll-x :show-scrollbar="false">
        <view class="status-tabs">
          <view class="status-item" :class="{ active: !status }" @tap="changeStatus('')">全部状态</view>
          <view
            v-for="item in statusOptions"
            :key="item"
            class="status-item"
            :class="{ active: status === item }"
            @tap="changeStatus(item)"
          >{{ item }}</view>
        </view>
      </scroll-view>
    </view>

    <view class="summary-strip">
      <view class="summary-main">
        <text class="summary-value">{{ loading && pageIndex === 1 ? '--' : count }}</text>
        <text class="summary-label">{{ periodLabel }}记录</text>
      </view>
      <view v-if="config.statisticsField" class="summary-side">
        <text class="summary-side-value">{{ statisticsValue }}</text>
        <text class="summary-label">{{ config.statisticsLabel }}</text>
      </view>
      <image class="summary-icon" :src="entry.icon" mode="aspectFit" />
    </view>

    <scroll-view
      class="data-scroll"
      scroll-y
      :scroll-top="mciScrollCommand"
      :refresher-enabled="true"
      :refresher-triggered="refreshing"
      @scroll="handleMciListScroll"
      @refresherrefresh="refresh"
      @scrolltolower="loadMore"
    >
      <view v-if="loading && pageIndex === 1" class="skeleton-list">
        <view v-for="item in 5" :key="item" class="skeleton-card">
          <view class="skeleton-line wide"></view>
          <view class="skeleton-line"></view>
          <view class="skeleton-line short"></view>
        </view>
      </view>

      <view v-else-if="rows.length" class="data-list">
        <view
          v-for="(row, index) in rows"
          :key="row.Id || index"
          class="data-card"
          hover-class="data-card--pressed"
          @tap="openDetail(row)"
        >
          <view class="card-top">
            <view class="card-title-wrap">
              <text class="card-index">{{ index + 1 }}</text>
              <text class="card-title">{{ getTitle(row) }}</text>
            </view>
            <text v-if="getStatus(row)" class="status-chip" :class="getStatusClass(row)">{{ getStatus(row) }}</text>
          </view>

          <view v-if="getTags(row).length" class="tag-row">
            <text v-for="tag in getTags(row)" :key="tag" class="data-tag">{{ tag }}</text>
          </view>

          <view class="field-list">
            <view v-for="line in visibleLines(row)" :key="line.field" class="field-row">
              <text class="field-label">{{ line.label }}</text>
              <text class="field-value">{{ displayValue(row, line) }}</text>
              <view v-if="line.format === 'phone' && row[line.field]" class="phone-action" @tap.stop="callPhone(row[line.field])">
                <image src="/static/xjy/UI-call.png" mode="aspectFit" />
              </view>
            </view>
          </view>

          <text v-if="config.summaryField && row[config.summaryField]" class="card-summary">{{ summaryValue(row) }}</text>

          <view v-if="rowActions(row).length" class="card-actions" @tap.stop>
            <view
              v-for="action in rowActions(row)"
              :key="action.key"
              class="card-action"
              :class="[`card-action--${action.tone || 'default'}`]"
              hover-class="card-action--pressed"
              @tap.stop="triggerRowAction(action, row)"
            ><text>{{ action.label }}</text></view>
          </view>

          <view class="card-bottom">
            <text>{{ formatCreateTime(row.CreateTime || row.UpdateTime) }}</text>
            <text class="detail-link">查看详情 ›</text>
          </view>
        </view>

        <view class="load-state">
          <text v-if="loading">正在加载...</text>
          <text v-else-if="finished">已加载全部 {{ count }} 条</text>
          <text v-else>继续上拉加载</text>
        </view>
      </view>

      <view v-else class="empty-state">
        <image :src="entry.icon" mode="aspectFit" />
        <text class="empty-title">暂无{{ config.title }}数据</text>
        <text class="empty-text">可调整搜索条件，或使用右上角新增</text>
      </view>
    </scroll-view>

    <view class="floating-add" hover-class="floating-add--pressed" @tap="openAdd"><text>＋</text></view>

    <view v-if="filterOpen" class="filter-mask" @tap="closeAdvancedFilters">
      <view class="filter-sheet" @tap.stop>
        <view class="filter-sheet__head">
          <view><text>更多筛选</text><text>{{ config.title }} · {{ activeFilterCount }} 项已选</text></view>
          <view class="filter-sheet__close" @tap="closeAdvancedFilters"><text>×</text></view>
        </view>
        <scroll-view class="filter-sheet__scroll" scroll-y>
          <view v-if="filterLoading" class="filter-loading">
            <view v-for="item in 4" :key="item"><view></view><view></view></view>
          </view>
          <view v-else>
            <view v-for="field in filterFields" :key="field.key" class="filter-field">
              <view class="filter-field__head"><text>{{ field.label }}</text><text v-if="field.hint">{{ field.hint }}</text></view>
              <input
                v-if="field.type === 'text'"
                v-model="filterValues[field.key]"
                class="filter-input"
                :placeholder="field.placeholder || `请输入${field.label}`"
                confirm-type="done"
              />
              <view v-else-if="field.type === 'range'" class="filter-range">
                <input :value="rangeFilterValue(field, 'min')" type="digit" :placeholder="field.minPlaceholder || '最小值'" @input="setRangeFilter(field, 'min', $event.detail.value)" />
                <text>至</text>
                <input :value="rangeFilterValue(field, 'max')" type="digit" :placeholder="field.maxPlaceholder || '最大值'" @input="setRangeFilter(field, 'max', $event.detail.value)" />
              </view>
              <view v-else-if="field.type === 'toggle'" class="filter-toggle">
                <text>{{ field.description || field.label }}</text>
                <switch :checked="Boolean(filterValues[field.key])" color="#0b86d4" @change="setToggleFilter(field, $event.detail.value)" />
              </view>
              <view v-else class="filter-options">
                <view
                  v-for="option in filterOptionsFor(field)"
                  :key="`${field.key}-${option.value}`"
                  class="filter-option"
                  :class="{ active: isFilterOptionSelected(field, option) }"
                  hover-class="filter-option--pressed"
                  @tap="selectFilterOption(field, option)"
                ><text>{{ option.label }}</text></view>
                <text v-if="!filterOptionsFor(field).length" class="filter-no-options">暂无可选项</text>
              </view>
            </view>
          </view>
          <view class="filter-sheet__safe"></view>
        </scroll-view>
        <view class="filter-sheet__footer">
          <view @tap="resetAdvancedFilters"><text>重置</text></view>
          <view @tap="applyAdvancedFilters"><text>查看结果</text></view>
        </view>
      </view>
    </view>

    <view v-if="activeAction" class="action-mask" @tap="closeActionInput">
      <view class="action-dialog" @tap.stop>
        <view class="action-dialog__head">
          <view>
            <text>{{ activeAction.inputTitle || activeAction.label }}</text>
            <text>{{ getTitle(activeRow) }}</text>
          </view>
          <view class="action-dialog__close" @tap="closeActionInput"><text>×</text></view>
        </view>
        <textarea
          v-model="actionInput"
          class="action-dialog__textarea"
          :placeholder="activeAction.inputPlaceholder || '请输入处理意见'"
          :maxlength="500"
          auto-height
        />
        <scroll-view v-if="approvalOpinions.length" class="approval-opinions" scroll-x :show-scrollbar="false">
          <view class="approval-opinions__row">
            <view v-for="item in approvalOpinions" :key="item" class="approval-opinion" @tap="actionInput = item"><text>{{ item }}</text></view>
          </view>
        </scroll-view>
        <view class="action-dialog__footer">
          <view @tap="closeActionInput"><text>取消</text></view>
          <view :class="{ disabled: actionSubmitting }" @tap="submitActionInput"><text>{{ actionSubmitting ? '处理中' : '确认提交' }}</text></view>
        </view>
      </view>
    </view>
    <mci-ai-launcher />
  </view>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser, post } from '@/utils/request.js'
import { getBusinessEntry, getBusinessModule } from '@/platform/business.js'
import { executeBusinessRowAction, getBusinessRowActions, loadApprovalOpinions } from './utils/xjy-row-actions.js'
import { listReturnMixin } from '@/platform/list-return.js'
import {
  compileListConfig,
  loadModuleViewManifest
} from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { parseJson } from '@/platform/native-form.js'
import {
  formatDateTime,
  formatFieldValue,
  formatMoney,
  PERIOD_OPTIONS,
  loadModulePeriodCounts,
  loadModuleRows,
  openForm,
  findMenu,
  statisticsFieldValue
} from '@/platform/business-runtime.js'

// zhy: 为客户主联系人和联系人子表生成同一个稳定关联编号，支持后续双向更新。
function createRelationshipId() {
  let seed = Date.now()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = (seed + Math.random() * 16) % 16 | 0
    seed = Math.floor(seed / 16)
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

export default {
  mixins: [themeMixin, listReturnMixin],
  data() {
    return {
      statusBarHeight: 0,
      key: '',
      menuId: '',
      config: {},
      baseConfig: {},
      entry: {},
      keyword: '',
      period: 'all',
      status: '',
      periods: PERIOD_OPTIONS,
      periodCounts: {},
      customStart: '',
      customEnd: '',
      rows: [],
      count: 0,
      dataAppend: {},
      pageIndex: 1,
      loading: false,
      refreshing: false,
      finished: false,
      whereField: '',
      whereValue: '',
      defaultValues: {},
      currentUser: {},
      activeAction: null,
      activeRow: {},
      actionInput: '',
      approvalOpinions: [],
      actionSubmitting: false,
      filterOpen: false,
      filterLoading: false,
      filterValues: {},
      filterOptions: {},
      viewManifest: null,
      loadRequestId: 0
    }
  },
  computed: {
    periodLabel() {
      const item = this.periods.find((option) => option.value === this.period)
      return item ? item.label : '全部'
    },
    statusOptions() {
      return this.config.statusOptions || []
    },
    filterFields() {
      return this.config.filterFields || []
    },
    activeFilterCount() {
      return this.filterFields.reduce((count, field) => {
        const value = this.filterValues[field.key]
        if (Array.isArray(value)) return count + (value.length ? 1 : 0)
        if (value && typeof value === 'object') return count + ([value.min, value.max].some((item) => item !== undefined && item !== null && item !== '') ? 1 : 0)
        return count + (value !== undefined && value !== null && value !== '' && value !== false ? 1 : 0)
      }, 0)
    },
    statisticsValue() {
      const value = statisticsFieldValue(this.dataAppend, this.config.statisticsField, 0)
      return formatMoney(value || 0)
    }
  },
  onLoad(options) {
    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 0
    } catch (e) {
      try { this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0 } catch (error) {}
    }
    this.key = options.key || 'customers'
    this.whereField = options.whereField ? decodeURIComponent(options.whereField) : ''
    this.whereValue = options.whereValue ? decodeURIComponent(options.whereValue) : ''
    // zhy: 接收客户详情透传的客户Id、客户名称等新增联系人默认值。
    this.defaultValues = parseJson(decodeURIComponent(options.defaults || ''), {}) || {}
    this.baseConfig = getBusinessModule(this.key) || getBusinessModule('customers')
    this.config = { ...this.baseConfig }
    this.entry = getBusinessEntry(this.key) || { icon: '/static/xjy/business/kehu.png', accent: '#0B86D4' }
    this.currentUser = getUser() || {}
    const restored = this.restoreMciListSnapshot()
    this.initializeList(restored)
  },
  methods: {
    async initializeList(restored = false, refresh = false) {
      try {
        const menu = await findMenu(
          this.baseConfig.menuAliases || [],
          this.baseConfig.table,
          refresh
        )
        if (menu && menu.Id) this.menuId = menu.Id
      } catch (error) {}
      this.baseConfig = { ...this.baseConfig, menuId: this.menuId }
      this.config = { ...this.config, menuId: this.menuId }
      await this.loadViewConfig(refresh)
      if (!restored) await this.loadData(true, refresh)
    },
    getMciListSnapshotKey() {
      return [this.key, this.whereField, this.whereValue].join('|')
    },
    getMciListSnapshot() {
      return {
        keyword: this.keyword,
        period: this.period,
        status: this.status,
        periodCounts: { ...this.periodCounts },
        customStart: this.customStart,
        customEnd: this.customEnd,
        rows: [...this.rows],
        count: this.count,
        dataAppend: { ...this.dataAppend },
        pageIndex: this.pageIndex,
        finished: this.finished,
        filterValues: { ...this.filterValues },
        filterOptions: { ...this.filterOptions }
      }
    },
    restoreMciListSnapshot() {
      const snapshot = this.mciConsumeListSnapshot(this.getMciListSnapshotKey())
      if (!snapshot) return false
      Object.assign(this, snapshot.payload || {})
      this.mciRestoreListPosition(snapshot.scrollTop)
      return true
    },
    async loadViewConfig(refresh = false) {
      try {
        let manifest = await loadModuleViewManifest(this.baseConfig, {
          scene: 'Card',
          device: 'Mobile',
          user: this.currentUser,
          refresh
        })
        if (!manifest) {
          manifest = await loadModuleViewManifest(this.baseConfig, {
            scene: 'List',
            device: 'Mobile',
            user: this.currentUser,
            refresh
          })
        }
        const dynamic = compileListConfig(manifest)
        if (!dynamic) return
        this.viewManifest = manifest
        if (manifest.Module && manifest.Module.Id) this.menuId = manifest.Module.Id
        const merged = { ...this.baseConfig }
        merged.menuId = this.menuId
        const arrayFields = ['tagFields', 'lines', 'statusOptions']
        arrayFields.forEach((name) => {
          if (dynamic[name]?.length) merged[name] = dynamic[name]
        })
        const scalarFields = [
          'titleField',
          'statusField',
          'summaryField',
          'imageField',
          'periodField',
          'statisticsField',
          'statisticsLabel',
          'statisticsFormat'
        ]
        scalarFields.forEach((name) => {
          if (dynamic[name] !== undefined && dynamic[name] !== null && dynamic[name] !== '') {
            merged[name] = dynamic[name]
          }
        })
        if (dynamic.actionSchema?.length) merged.actionSchema = dynamic.actionSchema
        this.config = merged
      } catch (error) {}
    },
    async loadData(reset = false, refresh = false) {
      if (this.loading && !reset) return
      if (!reset && this.finished) return
      const requestId = ++this.loadRequestId
      if (reset) {
        this.pageIndex = 1
        this.finished = false
      }
      this.loading = true
      const sort = this.selectedSort()
      const customRange = this.customStart && this.customEnd ? [`${this.customStart} 00:00:00`, `${this.customEnd} 23:59:59`] : null
      const options = {
        pageIndex: this.pageIndex,
        keyword: this.keyword.trim(),
        period: this.period,
        customRange,
        status: this.status,
        refresh,
        orderBy: sort.field,
        orderType: sort.order,
        extraWhere: this.buildFilterWhere()
      }
      try {
        const result = await loadModuleRows(this.config, options)
        if (requestId !== this.loadRequestId) return
        this.rows = reset ? result.rows : [...this.rows, ...result.rows]
        this.count = result.count
        this.dataAppend = result.append
        this.finished = this.rows.length >= result.count || result.rows.length < (this.config.pageSize || 15)
        if (!this.finished) this.pageIndex += 1
        this.loading = false
        if (reset) {
          loadModulePeriodCounts(this.config, {
            keyword: options.keyword,
            customRange,
            status: options.status,
            refresh,
            extraWhere: options.extraWhere
          }).then((counts) => {
            if (requestId === this.loadRequestId) this.periodCounts = counts
          }).catch(() => {})
        }
      } catch (error) {
        if (requestId === this.loadRequestId) uni.showToast({ title: error.message || '数据加载失败', icon: 'none' })
      } finally {
        if (requestId === this.loadRequestId) {
          this.loading = false
          this.refreshing = false
        }
      }
    },
    search() {
      this.loadData(true, true)
    },
    changePeriod(value) {
      if (this.period === value) return
      this.period = value
      if (value !== 'custom') this.loadData(true, true)
    },
    applyCustomRange() {
      if (!this.customStart || !this.customEnd) {
        uni.showToast({ title: '请选择完整时间范围', icon: 'none' })
        return
      }
      if (this.customStart > this.customEnd) {
        uni.showToast({ title: '开始日期不能晚于结束日期', icon: 'none' })
        return
      }
      this.loadData(true, true)
    },
    changeStatus(value) {
      if (this.status === value) return
      this.status = value
      this.loadData(true)
    },
    async refresh() {
      this.refreshing = true
      try {
        await this.loadViewConfig(true)
        await this.loadData(true, true)
      } finally {
        this.refreshing = false
      }
    },
    loadMore() {
      this.loadData(false)
    },
    buildFilterWhere() {
      const result = []
      if (this.whereField && this.whereValue) result.push({ Name: this.whereField, Type: '=', Value: this.whereValue })
      this.filterFields.forEach((field) => {
        if (field.type === 'sort') return
        const value = this.filterValues[field.key]
        if (field.type === 'range') {
          if (value && value.min !== undefined && value.min !== '') result.push({ Name: field.field, Type: '>=', Value: Number(value.min) })
          if (value && value.max !== undefined && value.max !== '') result.push({ Name: field.field, Type: '<=', Value: Number(value.max) })
          return
        }
        if (field.type === 'toggle') {
          if (!value) return
          const resolved = field.currentUserField ? this.currentUser[field.currentUserField] : field.value
          if (resolved !== undefined && resolved !== null && resolved !== '') {
            result.push({ Name: field.field, Type: field.operation || '=', Value: resolved })
          }
          return
        }
        if (Array.isArray(value)) {
          if (value.length) result.push({ Name: field.field, Type: field.operation || 'In', Value: value })
          return
        }
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          result.push({ Name: field.field, Type: field.operation || (field.type === 'text' ? 'Like' : '='), Value: typeof value === 'string' ? value.trim() : value })
        }
      })
      return result
    },
    selectedSort() {
      const field = this.filterFields.find((item) => item.type === 'sort')
      if (!field) return { field: '', order: '' }
      const option = this.filterOptionsFor(field).find((item) => String(item.value) === String(this.filterValues[field.key] || ''))
      return option ? { field: option.field || '', order: option.order || '' } : { field: '', order: '' }
    },
    async openAdvancedFilters() {
      this.filterOpen = true
      const pending = this.filterFields.filter((field) => field.source && !this.filterOptions[field.key])
      if (!pending.length) return
      this.filterLoading = true
      try {
        await Promise.all(pending.map(async (field) => {
          let rows = []
          if (field.source === 'baseData') {
            const result = await post('/api/SysBaseData/getSysBaseData', { ParentKey: field.parentKey }, true)
            if (result && Number(result.Code) === 1) rows = result.Data || []
          } else if (field.source === 'table') {
            const result = await V8.FormEngine.GetTableData(field.table, {
              _PageIndex: 1,
              _PageSize: field.pageSize || 200,
              _OrderBy: field.orderBy || 'CreateTime',
              _OrderByType: field.orderType || 'DESC',
              _SelectFields: ['Id', field.valueField || 'Id', field.labelField || 'Name']
            })
            if (result && Number(result.Code) === 1) rows = result.Data || []
          }
          this.filterOptions[field.key] = rows.map((row) => ({
            value: row[field.valueField || (field.source === 'baseData' ? 'Key' : 'Id')],
            label: row[field.labelField || (field.source === 'baseData' ? 'Value' : 'Name')]
          })).filter((item) => item.label !== undefined && item.label !== null && item.label !== '')
        }))
      } catch (error) {
        uni.showToast({ title: '部分筛选项加载失败', icon: 'none' })
      } finally {
        this.filterLoading = false
      }
    },
    closeAdvancedFilters() { this.filterOpen = false },
    filterOptionsFor(field) { return field.options || this.filterOptions[field.key] || [] },
    isFilterOptionSelected(field, option) {
      const value = this.filterValues[field.key]
      if (field.multiple) return Array.isArray(value) && value.some((item) => String(item) === String(option.value))
      return value !== undefined && value !== null && value !== '' && String(value) === String(option.value)
    },
    selectFilterOption(field, option) {
      if (field.multiple) {
        const values = Array.isArray(this.filterValues[field.key]) ? [...this.filterValues[field.key]] : []
        const index = values.findIndex((item) => String(item) === String(option.value))
        if (index >= 0) values.splice(index, 1)
        else values.push(option.value)
        this.filterValues[field.key] = values
      } else {
        this.filterValues[field.key] = this.isFilterOptionSelected(field, option) ? '' : option.value
      }
    },
    setToggleFilter(field, value) { this.filterValues[field.key] = value },
    rangeFilterValue(field, side) {
      const value = this.filterValues[field.key]
      return value && typeof value === 'object' ? value[side] : ''
    },
    setRangeFilter(field, side, value) {
      this.filterValues[field.key] = { ...(this.filterValues[field.key] || { min: '', max: '' }), [side]: value }
    },
    resetAdvancedFilters() { this.filterValues = {} },
    applyAdvancedFilters() {
      this.filterOpen = false
      this.loadData(true, true)
    },
    getTitle(row) {
      const configured = row[this.config.titleField]
      if (configured) return formatFieldValue(configured, '', { empty: '' })
      const fallbackKeys = ['Name', 'Title', 'Biaoti', 'KehuMC', 'DingdanBH', 'ShouhouFWBH', 'Xingming']
      const key = fallbackKeys.find((field) => row[field])
      return key ? formatFieldValue(row[key], '', { empty: '' }) : `记录 ${String(row.Id || '').slice(-6)}`
    },
    getStatus(row) {
      return formatFieldValue(row[this.config.statusField], '', { empty: '' })
    },
    getStatusClass(row) {
      const statusText = String(this.getStatus(row))
      if (/完成|结束|正常|合作|通过|审批/.test(statusText)) return 'is-success'
      if (/取消|作废|驳回|故障|超时/.test(statusText)) return 'is-danger'
      if (/待|处理中|跟进|预约/.test(statusText)) return 'is-warning'
      return 'is-info'
    },
    getTags(row) {
      return (this.config.tagFields || []).map((field) => formatFieldValue(row[field], '', { empty: '' })).filter(Boolean).slice(0, 3)
    },
    visibleLines(row) {
      return (this.config.lines || []).filter((line) => row[line.field] !== undefined && row[line.field] !== null && row[line.field] !== '').slice(0, 4)
    },
    displayValue(row, line) {
      return formatFieldValue(row[line.field], line.format)
    },
    periodCount(item) {
      if (Object.prototype.hasOwnProperty.call(this.periodCounts, item.value)) return this.periodCounts[item.value]
      if (this.period === item.value) return this.count
      return '·'
    },
    summaryValue(row) { return formatFieldValue(row[this.config.summaryField], '', { empty: '' }) },
    formatCreateTime(value) {
      return formatDateTime(value)
    },
    rowActions(row) {
      const nativeActions = getBusinessRowActions(this.key, row, this.currentUser)
      const nativeKeys = new Set(nativeActions.map((action) => String(action.key || '').toLowerCase()))
      const viewActions = (this.config.actionSchema || [])
        .filter((action) => isActionVisible(action, row))
        .filter((action) => !nativeKeys.has(String(action.Key || '').toLowerCase()))
        .map((action) => ({
          key: `view:${action.Key}`,
          label: action.Label,
          tone: ['primary', 'success', 'warning', 'danger'].includes(String(action.Tone || '').toLowerCase())
            ? String(action.Tone).toLowerCase()
            : 'default',
          __viewAction: action
        }))
      return nativeActions.concat(viewActions)
    },
    async triggerRowAction(action, row) {
      if (!action || !row || this.actionSubmitting) return
      if (action.__viewAction) {
        if (['OpenDetail', 'OpenForm', 'OpenList', 'Navigate'].includes(action.__viewAction.ActionType)) {
          this.mciMarkDetailReturn()
        }
        this.actionSubmitting = true
        try {
          await executeViewAction(action.__viewAction, {
            form: row,
            user: this.currentUser,
            menu: {
              Id: this.viewManifest?.Module?.Id || '',
              ModuleEngineKey: this.viewManifest?.Module?.ModuleEngineKey || ''
            },
            tableName: this.config.table,
            refresh: async () => {
              await this.loadViewConfig(true)
              await this.loadData(true, true)
            }
          })
        } finally {
          this.actionSubmitting = false
        }
        return
      }
      if (action.key === 'device-repair') {
        this.mciNavigateToDetail(`/pages/native/repair?deviceId=${encodeURIComponent(row.Id)}`)
        return
      }
      if (action.key === 'device-consumables') {
        this.mciNavigateToDetail(`/pages/task/consumable?deviceId=${encodeURIComponent(row.Id)}&source=device`)
        return
      }
      if (action.key === 'visit-care') {
        this.mciMarkDetailReturn()
        openForm({
          table: 'Diy_kehuguanhuai',
          mode: 'Add',
          title: '新增客户关怀',
          menuAliases: ['客户关怀', '关怀记录'],
          defaultValues: {
            KehuID: row.KehuID || row.KehuId || '',
            KehuMC: row.KehuMC || '',
            LianxiRID: row.LianxiRID || '',
            LianxiR: row.LianxiR || ''
          }
        })
        return
      }
      if (action.key === 'position-product' && row.ShangpinID) {
        this.mciNavigateToDetail(`/pages/mall/detail?id=${encodeURIComponent(row.ShangpinID)}`)
        return
      }
      if (action.input) {
        this.activeAction = action
        this.activeRow = row
        this.actionInput = ''
        this.approvalOpinions = []
        if (/^order-(approve|reject)$/.test(action.key)) {
          loadApprovalOpinions().then((items) => {
            if (this.activeAction && this.activeAction.key === action.key) this.approvalOpinions = items
          })
        }
        return
      }
      if (action.confirm) {
        const confirmed = await this.confirmAction(action.confirm)
        if (!confirmed) return
      }
      await this.runRowAction(action, row, '')
    },
    confirmAction(content) {
      return new Promise((resolve) => {
        uni.showModal({
          title: '请确认操作',
          content,
          confirmColor: '#D9472B',
          success: (result) => resolve(Boolean(result.confirm)),
          fail: () => resolve(false)
        })
      })
    },
    closeActionInput() {
      if (this.actionSubmitting) return
      this.activeAction = null
      this.activeRow = {}
      this.actionInput = ''
      this.approvalOpinions = []
    },
    async submitActionInput() {
      if (!this.activeAction || this.actionSubmitting) return
      const input = this.actionInput.trim()
      if (this.activeAction.input === 'required' && !input) {
        uni.showToast({ title: this.activeAction.inputPlaceholder || '请输入处理意见', icon: 'none' })
        return
      }
      await this.runRowAction(this.activeAction, this.activeRow, input)
    },
    async runRowAction(action, row, input) {
      if (this.actionSubmitting) return
      this.actionSubmitting = true
      uni.showLoading({ title: '正在处理', mask: true })
      try {
        const result = await executeBusinessRowAction(action.key, row, input, this.currentUser)
        if (result && result.rowPatch) this.patchListRow(row.Id, result.rowPatch)
        this.activeAction = null
        this.activeRow = {}
        this.actionInput = ''
        uni.showToast({ title: `${action.label}成功`, icon: 'success' })
        await this.loadData(true, true)
        if (result && result.rowPatch) this.patchListRow(row.Id, result.rowPatch)
      } catch (error) {
        uni.showToast({ title: error.message || `${action.label}失败`, icon: 'none' })
      } finally {
        uni.hideLoading()
        this.actionSubmitting = false
      }
    },
    patchListRow(id, patch) {
      this.rows = this.rows.map((item) => (
        String(item.Id || '') === String(id || '') ? { ...item, ...patch } : item
      ))
    },
    openDetail(row) {
      if (!row.Id) return
      if (this.key === 'serviceForms') {
        this.mciNavigateToDetail(`/pages/native/service-record?id=${encodeURIComponent(row.Id)}`)
        return
      }
      if (this.key === 'casebooks') {
        this.mciNavigateToDetail(`/pages/native/casebook?id=${encodeURIComponent(row.Id)}`)
        return
      }
      if (this.key === 'taskDevices' && row.ShouhouDDID) {
        this.mciNavigateToDetail(`/pages/task/detail?id=${encodeURIComponent(row.ShouhouDDID)}`)
        return
      }
      if (this.key === 'merchantProducts') {
        this.mciNavigateToDetail(`/pages/mall/detail?id=${encodeURIComponent(row.Id)}`)
        return
      }
      if (this.key === 'tasks') {
        this.mciNavigateToDetail(`/pages/task/detail?id=${encodeURIComponent(row.Id)}`)
        return
      }
      if (['customers', 'orders', 'devices', 'leads', 'recruitment', 'demands', 'stores', 'providers'].includes(this.key)) {
        this.mciNavigateToDetail(`/pages/business/detail?key=${encodeURIComponent(this.key)}&id=${encodeURIComponent(row.Id)}&menuId=${encodeURIComponent(this.menuId || '')}`)
        return
      }
      this.mciMarkDetailReturn()
      openForm({
        table: this.config.table,
        rowId: row.Id,
        mode: 'View',
        title: `${this.config.title}详情`,
        menuId: this.menuId,
        menuAliases: this.config.menuAliases || []
      })
    },
    onMciListDetailReturned(scrollTop) {
      const target = Math.max(0, Number(scrollTop || 0))
      this.mciScrollCommand = Math.max(0, target - 1)
      this.$nextTick(() => { this.mciScrollCommand = target })
    },
    shouldMciRefreshForDataChange(event = {}) {
      const changedTable = String(event.table || '').trim().toLowerCase()
      const listTable = String(this.config.table || this.baseConfig.table || '').trim().toLowerCase()
      return !changedTable || !listTable || changedTable === listTable
    },
    async onMciListDataChanged() {
      await this.loadViewConfig(true)
      await this.loadData(true, true)
    },
    openAdd() {
      if (this.key === 'members') {
        uni.navigateTo({ url: '/pages/native/member-edit' })
        return
      }
      if (this.key === 'serviceForms') {
        uni.navigateTo({ url: '/pages/native/service-record' })
        return
      }
      if (this.key === 'casebooks') {
        uni.navigateTo({ url: '/pages/native/casebook' })
        return
      }
      this.mciMarkDetailReturn()
      // zhy: 新增联系人时合并客户关联条件，并补充唯一关联编号后传入动态表单。
      const defaultValues = {
        ...this.defaultValues,
        ...(this.whereField && this.whereValue ? { [this.whereField]: this.whereValue } : {})
      }
      if (this.key === 'contacts' && !defaultValues.Guid70) {
        defaultValues.Guid70 = createRelationshipId()
      }
      openForm({
        table: this.config.table,
        mode: 'Add',
        title: `新增${this.config.title}`,
        menuId: this.menuId,
        menuAliases: this.config.menuAliases || [],
        defaultValues: Object.keys(defaultValues).length ? defaultValues : null
      })
    },
    callPhone(phone) {
      uni.makePhoneCall({ phoneNumber: String(phone) })
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style lang="scss" scoped>
.list-page {
  height: 100vh;
  overflow: hidden;
  background: #f4f8fa;
  color: #18313d;
}

.page-header {
  position: relative;
  z-index: 3;
  background: #fff;
  box-shadow: 0 4rpx 16rpx rgba(20, 74, 99, 0.06);
}

.nav-row {
  display: grid;
  grid-template-columns: 72rpx minmax(0, 1fr) 72rpx;
  align-items: center;
  min-height: 88rpx;
  padding: 0 calc(20rpx + var(--mci-capsule-right)) 0 20rpx;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  color: #214958;
  font-size: 42rpx;
  transition: background 150ms ease;
}

.nav-icon:last-child {
  color: #e94b2c;
}

.nav-icon--pressed {
  background: #edf5f8;
}

.nav-title {
  overflow: hidden;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 32rpx;
  font-weight: 650;
}

.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12rpx;
  padding: 8rpx 24rpx 16rpx;
}

.search-row--simple { grid-template-columns: minmax(0, 1fr) auto; }

.filter-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 78rpx;
  height: 72rpx;
  color: #607a85;
  font-size: 24rpx;
}

.filter-button.active { color: #0b86d4; font-weight: 650; }
.filter-button > text:last-child:not(:first-child) { min-width: 28rpx; height: 28rpx; margin-left: 5rpx; padding: 0 4rpx; border-radius: 14rpx; color: #fff; background: #e94b2c; font-size: 18rpx; line-height: 28rpx; text-align: center; }

.search-input {
  box-sizing: border-box;
  height: 72rpx;
  padding: 0 24rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 14rpx;
  background: #f4f8fa;
  font-size: 26rpx;
}

.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 96rpx;
  height: 72rpx;
  color: #0b86d4;
  font-size: 26rpx;
  font-weight: 600;
}

.period-tabs {
  width: calc(100% - 48rpx);
  margin: 0 24rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 12rpx;
  overflow: hidden;
  white-space: nowrap;
  box-sizing: border-box;
}

.period-tabs__inner {
  display: inline-flex;
  min-width: 100%;
}

.custom-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30rpx minmax(0, 1fr) 84rpx;
  gap: 8rpx;
  align-items: center;
  padding: 13rpx 24rpx 2rpx;
}

.custom-range picker > view {
  height: 60rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 7rpx;
  color: #56727d;
  background: #f4f8fa;
  font-size: 21rpx;
  line-height: 60rpx;
  text-align: center;
}

.custom-range > text { color: #8b9ba2; font-size: 20rpx; text-align: center; }
.custom-range__apply { height: 60rpx; border-radius: 7rpx; color: #fff; background: #0b86d4; font-size: 21rpx; line-height: 60rpx; text-align: center; }

.period-item {
  flex: 1 0 104rpx;
  min-width: 104rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  border-right: 1rpx solid #dce8ed;
  color: #708993;
  font-size: 21rpx;
  text-align: center;
  box-sizing: border-box;
}

.period-item__count { font-size: 18rpx; opacity: .72; }

.period-item:last-child {
  border-right: none;
}

.period-item.active {
  background: #e94b2c;
  color: #fff;
  font-weight: 600;
}

.status-scroll {
  width: 100%;
  padding: 14rpx 0 16rpx;
  white-space: nowrap;
}

.status-tabs {
  display: inline-flex;
  gap: 12rpx;
  padding: 0 24rpx;
}

.status-item {
  flex: 0 0 auto;
  min-width: 110rpx;
  height: 54rpx;
  padding: 0 18rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 12rpx;
  color: #68838f;
  font-size: 22rpx;
  line-height: 54rpx;
  text-align: center;
}

.status-item.active {
  border-color: #0b86d4;
  background: rgba(11, 134, 212, 0.08);
  color: #0b86d4;
  font-weight: 600;
}

.summary-strip {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 118rpx;
  margin: 18rpx 24rpx;
  padding: 18rpx 120rpx 18rpx 24rpx;
  border-radius: 16rpx;
  overflow: hidden;
  background: linear-gradient(110deg, #0b86d4, #16a3ad 62%, #2aaf80);
  color: #fff;
  box-shadow: 0 10rpx 26rpx rgba(11, 134, 212, 0.16);
}

.summary-main,
.summary-side {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.summary-side {
  margin-left: 46rpx;
}

.summary-value {
  font-size: 42rpx;
  line-height: 48rpx;
  font-weight: 700;
}

.summary-side-value {
  max-width: 240rpx;
  overflow: hidden;
  font-size: 28rpx;
  line-height: 42rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-label {
  margin-top: 4rpx;
  color: rgba(255, 255, 255, 0.78);
  font-size: 21rpx;
}

.summary-icon {
  position: absolute;
  right: 24rpx;
  width: 74rpx;
  height: 74rpx;
  opacity: 0.9;
}

.data-scroll {
  height: calc(100vh - 438rpx - var(--mci-safe-top));
}

.data-list,
.skeleton-list {
  padding: 0 24rpx calc(140rpx + var(--mci-safe-bottom));
}

.data-card,
.skeleton-card {
  margin-bottom: 18rpx;
  padding: 22rpx 24rpx 18rpx;
  border: 1rpx solid #e3edf1;
  border-radius: 16rpx;
  background: #fff;
  box-shadow: 0 6rpx 18rpx rgba(25, 78, 101, 0.05);
}

.data-card {
  transition: transform 150ms ease, box-shadow 150ms ease;
}

.data-card--pressed {
  transform: scale(0.985);
  box-shadow: 0 2rpx 8rpx rgba(25, 78, 101, 0.04);
}

.card-top,
.card-title-wrap,
.field-row,
.card-bottom {
  display: flex;
  align-items: center;
}

.card-top {
  justify-content: space-between;
  gap: 18rpx;
}

.card-title-wrap {
  min-width: 0;
}

.card-index {
  flex: 0 0 auto;
  width: 36rpx;
  height: 36rpx;
  margin-right: 12rpx;
  border-radius: 50%;
  background: #eaf5fa;
  color: #0b86d4;
  font-size: 20rpx;
  line-height: 36rpx;
  text-align: center;
}

.card-title {
  overflow: hidden;
  color: #18313d;
  font-size: 29rpx;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip,
.data-tag {
  flex: 0 0 auto;
  border-radius: 8rpx;
}

.status-chip {
  max-width: 190rpx;
  padding: 7rpx 12rpx;
  overflow: hidden;
  font-size: 21rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-chip.is-success { background: #e9f7f0; color: #16865c; }
.status-chip.is-danger { background: #fff0ed; color: #d6462a; }
.status-chip.is-warning { background: #fff7e8; color: #b9780a; }
.status-chip.is-info { background: #eaf5fa; color: #0b78ba; }

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
}

.data-tag {
  padding: 5rpx 10rpx;
  background: #f1f4f8;
  color: #647c87;
  font-size: 20rpx;
}

.field-list {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top: 1rpx solid #edf3f5;
}

.field-row {
  min-height: 48rpx;
  line-height: 34rpx;
}

.field-label {
  flex: 0 0 138rpx;
  color: #8197a0;
  font-size: 23rpx;
}

.field-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: #365663;
  font-size: 24rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.phone-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 44rpx;
}

.phone-action image {
  width: 28rpx;
  height: 28rpx;
}

.card-summary {
  display: -webkit-box;
  margin-top: 12rpx;
  overflow: hidden;
  color: #607b87;
  font-size: 23rpx;
  line-height: 36rpx;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf3f5;
}

.card-action {
  min-width: 90rpx;
  height: 50rpx;
  padding: 0 16rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 8rpx;
  color: #58727d;
  background: #f8fbfc;
  font-size: 21rpx;
  line-height: 50rpx;
  text-align: center;
  transition: transform 140ms ease, background 140ms ease;
}

.card-action--primary { border-color: rgba(11, 134, 212, 0.3); color: #0b78ba; background: #eaf5fa; }
.card-action--danger { border-color: rgba(217, 71, 43, 0.24); color: #cb4329; background: #fff1ee; }
.card-action--pressed { transform: scale(0.94); }

.card-bottom {
  justify-content: space-between;
  margin-top: 14rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid #edf3f5;
  color: #9aabb2;
  font-size: 21rpx;
}

.detail-link {
  color: #0b86d4;
}

.load-state {
  padding: 22rpx 0 40rpx;
  color: #91a4ac;
  font-size: 22rpx;
  text-align: center;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 100rpx 50rpx 180rpx;
}

.empty-state image {
  width: 110rpx;
  height: 110rpx;
  opacity: 0.58;
}

.empty-title {
  margin-top: 24rpx;
  color: #4b6874;
  font-size: 28rpx;
  font-weight: 600;
}

.empty-text {
  margin-top: 10rpx;
  color: #91a4ac;
  font-size: 22rpx;
  text-align: center;
}

.skeleton-line {
  width: 58%;
  height: 24rpx;
  margin: 18rpx 0;
  border-radius: 6rpx;
  background: linear-gradient(90deg, #eef3f5 25%, #f7fafb 50%, #eef3f5 75%);
  background-size: 300% 100%;
  animation: shimmer 1.4s infinite;
}

.skeleton-line.wide { width: 82%; height: 30rpx; }
.skeleton-line.short { width: 40%; }

.floating-add {
  position: fixed;
  right: 28rpx;
  bottom: calc(34rpx + var(--mci-safe-bottom));
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 92rpx;
  height: 92rpx;
  border: 4rpx solid rgba(255, 255, 255, 0.88);
  border-radius: 50%;
  background: #e94b2c;
  color: #fff;
  box-shadow: 0 10rpx 28rpx rgba(233, 75, 44, 0.3);
  font-size: 44rpx;
  transition: transform 150ms ease;
}

.floating-add--pressed {
  transform: scale(0.9);
}

.action-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  background: rgba(13, 37, 48, 0.42);
  animation: fade-in 160ms ease-out;
}

.filter-mask {
  position: fixed;
  inset: 0;
  z-index: 28;
  display: flex;
  align-items: flex-end;
  background: rgba(13, 37, 48, 0.42);
  animation: fade-in 160ms ease-out;
}

.filter-sheet {
  box-sizing: border-box;
  width: 100%;
  height: min(82vh, 1160rpx);
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  border-radius: 16rpx 16rpx 0 0;
  overflow: hidden;
  background: #fff;
  animation: sheet-in 190ms ease-out;
}

.filter-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  min-height: 104rpx;
  padding: 0 26rpx;
  border-bottom: 1rpx solid #e8eff2;
}

.filter-sheet__head > view:first-child { min-width: 0; }
.filter-sheet__head > view:first-child text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.filter-sheet__head > view:first-child text:first-child { color: #18313d; font-size: 30rpx; font-weight: 700; }
.filter-sheet__head > view:first-child text:last-child { margin-top: 5rpx; color: #7a919b; font-size: 21rpx; }
.filter-sheet__close { flex: 0 0 auto; width: 58rpx; height: 58rpx; border-radius: 50%; color: #69818b; background: #eff5f7; font-size: 34rpx; line-height: 56rpx; text-align: center; }
.filter-sheet__scroll { height: 100%; }

.filter-field { padding: 22rpx 26rpx; border-bottom: 1rpx solid #edf2f4; }
.filter-field__head { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; }
.filter-field__head text:first-child { color: #365864; font-size: 24rpx; font-weight: 650; }
.filter-field__head text:last-child { color: #94a5ab; font-size: 19rpx; }
.filter-input { box-sizing: border-box; width: 100%; height: 68rpx; margin-top: 14rpx; padding: 0 18rpx; border: 1rpx solid #dce8ed; border-radius: 8rpx; color: #294b57; background: #f7fafb; font-size: 23rpx; }
.filter-range { display: grid; grid-template-columns: minmax(0, 1fr) 38rpx minmax(0, 1fr); gap: 8rpx; align-items: center; margin-top: 14rpx; }
.filter-range input { box-sizing: border-box; width: 100%; height: 68rpx; padding: 0 16rpx; border: 1rpx solid #dce8ed; border-radius: 8rpx; color: #294b57; background: #f7fafb; font-size: 23rpx; text-align: center; }
.filter-range text { color: #8b9da4; font-size: 21rpx; text-align: center; }
.filter-options { display: flex; flex-wrap: wrap; gap: 12rpx; margin-top: 14rpx; }
.filter-option { min-width: 132rpx; height: 58rpx; padding: 0 16rpx; border: 1rpx solid #dce8ed; border-radius: 8rpx; color: #607a85; background: #f8fbfc; font-size: 21rpx; line-height: 58rpx; text-align: center; transition: transform 140ms ease, background 140ms ease; }
.filter-option.active { border-color: rgba(11, 134, 212, 0.38); color: #087dad; background: #e9f6fa; font-weight: 650; }
.filter-option--pressed { transform: scale(0.96); }
.filter-no-options { color: #94a5ab; font-size: 21rpx; }
.filter-toggle { min-height: 72rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 8rpx; }
.filter-toggle > text { color: #6a828c; font-size: 22rpx; }
.filter-toggle switch { transform: scale(0.78); transform-origin: right center; }
.filter-sheet__safe { height: 22rpx; }

.filter-sheet__footer {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 14rpx;
  padding: 16rpx max(26rpx, var(--mci-safe-right)) calc(16rpx + var(--mci-safe-bottom)) max(26rpx, var(--mci-safe-left));
  border-top: 1rpx solid #e8eff2;
  background: #fff;
}

.filter-sheet__footer view { height: 76rpx; border-radius: 8rpx; color: #536e79; background: #edf3f5; font-size: 25rpx; font-weight: 650; line-height: 76rpx; text-align: center; }
.filter-sheet__footer view:last-child { color: #fff; background: #0b86d4; }
.filter-loading { padding: 22rpx 26rpx; }
.filter-loading > view { padding: 18rpx 0; }
.filter-loading > view > view { height: 22rpx; margin-bottom: 14rpx; border-radius: 5rpx; background: linear-gradient(90deg, #eef3f5 25%, #f7fafb 50%, #eef3f5 75%); background-size: 300% 100%; animation: shimmer 1.4s infinite; }
.filter-loading > view > view:first-child { width: 28%; }
.filter-loading > view > view:last-child { width: 72%; height: 54rpx; }

.action-dialog {
  box-sizing: border-box;
  width: 100%;
  padding: 26rpx 26rpx calc(24rpx + var(--mci-safe-bottom));
  border-radius: 16rpx 16rpx 0 0;
  background: #fff;
  animation: sheet-in 190ms ease-out;
}

.action-dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}

.action-dialog__head > view:first-child { min-width: 0; }
.action-dialog__head > view:first-child text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-dialog__head > view:first-child text:first-child { color: #18313d; font-size: 30rpx; font-weight: 700; }
.action-dialog__head > view:first-child text:last-child { margin-top: 7rpx; color: #7a919b; font-size: 22rpx; }

.action-dialog__close {
  flex: 0 0 auto;
  width: 58rpx;
  height: 58rpx;
  border-radius: 50%;
  color: #69818b;
  background: #eff5f7;
  font-size: 34rpx;
  line-height: 56rpx;
  text-align: center;
}

.action-dialog__textarea {
  box-sizing: border-box;
  width: 100%;
  min-height: 190rpx;
  max-height: 360rpx;
  margin-top: 24rpx;
  padding: 20rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 10rpx;
  color: #294b57;
  background: #f6f9fa;
  font-size: 25rpx;
  line-height: 38rpx;
}

.approval-opinions { width: 100%; margin-top: 16rpx; white-space: nowrap; }
.approval-opinions__row { display: inline-flex; gap: 10rpx; padding-right: 12rpx; }
.approval-opinion { flex: none; max-width: 360rpx; padding: 10rpx 15rpx; overflow: hidden; border: 1rpx solid #d9e7eb; border-radius: 6rpx; color: #476773; background: #f2f7f8; font-size: 21rpx; text-overflow: ellipsis; white-space: nowrap; }

.action-dialog__footer {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 14rpx;
  margin-top: 22rpx;
}

.action-dialog__footer view {
  height: 76rpx;
  border-radius: 8rpx;
  color: #536e79;
  background: #edf3f5;
  font-size: 25rpx;
  font-weight: 650;
  line-height: 76rpx;
  text-align: center;
}

.action-dialog__footer view:last-child { color: #fff; background: #0b86d4; }
.action-dialog__footer .disabled { opacity: 0.58; }

@keyframes shimmer {
  to { background-position: -200% 0; }
}

@keyframes fade-in { from { opacity: 0; } }
@keyframes sheet-in { from { transform: translateY(26rpx); opacity: 0.65; } }

@media (prefers-reduced-motion: reduce) {
  .data-card,
  .floating-add,
  .card-action,
  .filter-option,
  .filter-mask,
  .filter-sheet,
  .action-mask,
  .action-dialog { transition: none; animation: none; }
}
</style>
