<template>
  <view class="related-business-list" :class="{ 'related-business-list--preview': isPreview }">
    <view v-if="!isPreview" class="search-row" :class="{ 'search-row--simple': !filterFields.length }">
      <view class="search-input-wrap">
        <input v-model="keyword" class="search-input" type="text" confirm-type="search"
          :placeholder="`搜索${config.title || sectionTitle}`"
          :adjust-position="false" :hold-keyboard="true" :cursor-spacing="16"
          @input="scheduleSearch" @confirm="search" />
        <view v-if="keyword" class="search-clear" hover-class="search-clear--pressed" @tap.stop="clearKeyword">
          <text>×</text>
        </view>
      </view>
      <view v-if="filterFields.length" class="filter-button" :class="{ active: activeFilterCount > 0 }"
        @tap="openAdvancedFilters">
        <text>筛选</text><text v-if="activeFilterCount">{{ activeFilterCount }}</text>
      </view>
      <view class="search-button" @tap="resetSearch"><text>重置</text></view>
    </view>

    <view v-if="loading && pageIndex === 1 && !waitingForParentSave" class="related-skeleton">
      <view v-for="item in (isPreview ? previewLimit : 3)" :key="item" class="skeleton-card">
        <view class="skeleton-line wide"></view>
        <view class="skeleton-line"></view>
        <view class="skeleton-line short"></view>
      </view>
    </view>

    <view v-else-if="rows.length" class="related-data-list">
      <template v-if="moduleKey === 'tasks'">
        <mci-task-card v-for="(row, index) in displayedRows" :key="row.Id || index"
          :item="taskCardRow(row)" :index="index" :state-class="taskStatusClass(row)"
          @open="openDetail" @phone="callPhone" />
      </template>
      <template v-else>
        <mci-business-card v-for="(row, index) in displayedRows" :key="row.Id || index"
          :row="row" :index="index" :title="getTitle(row)" :status="getStatus(row)"
          :status-class="getStatusClass(row)" :tags="getTags(row)" :lines="cardLines(row)"
          :summary="config.summaryField ? summaryValue(row) : ''" :actions="rowActions(row)"
          :time="formatCreateTime(row.CreateTime || row.UpdateTime)"
          @open="openDetail" @phone="callPhone" @action="triggerRowAction" />
      </template>
      <view v-if="!isPreview && !finished" class="load-more" hover-class="load-more--pressed" @tap="loadMore">
        <text>{{ loading ? '正在加载' : '加载更多' }}</text>
      </view>
      <view v-else-if="!isPreview" class="load-finished"><text>共 {{ count }} 条</text></view>
    </view>

    <view v-else-if="error" class="related-empty">
      <text>{{ error }}</text>
      <view @tap="loadData(true, true)"><text>重新加载</text></view>
    </view>

    <view v-else class="related-empty">
      <template v-if="waitingForParentSave">
        <text>保存当前表单后可新增{{ config.title || sectionTitle }}</text>
      </template>
      <template v-else>
        <text>暂无{{ config.title || sectionTitle }}</text>
        <text v-if="canAdd && !isPreview">点击右下角加号新增</text>
      </template>
    </view>

    <view v-if="showFloatingAdd && canAdd && !isPreview" class="floating-add" :style="floatingStyle"
      hover-class="floating-add--pressed" @tap="openAdd"><text>＋</text></view>

    <view v-if="isPreview && !waitingForParentSave" class="preview-actions"
      :class="{ 'preview-actions--single': !canAdd }">
      <view class="preview-action preview-action--more" hover-class="preview-action--pressed" @tap="openMore">
        <text class="preview-action__icon">···</text><text>查看更多</text>
      </view>
      <view v-if="canAdd" class="preview-action preview-action--add" hover-class="preview-action--pressed" @tap="openAdd">
        <text class="preview-action__icon">＋</text><text>新增</text>
      </view>
    </view>

    <!-- zhy：筛选弹窗必须脱离详情页 scroll-view，否则微信端上滑时 fixed 遮罩会被滚动容器裁剪。 -->
    <root-portal v-if="filterOpen && !isPreview">
      <view class="filter-mask" @tap="closeAdvancedFilters" @touchmove.stop.prevent="noop">
      <view class="filter-sheet" @tap.stop @touchmove.stop>
        <view class="filter-sheet__head">
          <view><text>更多筛选</text><text>{{ config.title }} · {{ activeFilterCount }} 项已选</text></view>
          <view class="filter-sheet__close" @tap="closeAdvancedFilters"><text>×</text></view>
        </view>
        <scroll-view class="filter-sheet__scroll" scroll-y>
          <view v-if="filterLoading" class="filter-loading">
            <view v-for="item in 4" :key="item"><view></view><view></view></view>
          </view>
          <view v-else>
            <view v-for="filterField in filterFields" :key="filterField.key" class="filter-field">
              <view class="filter-field__head">
                <text>{{ filterField.label }}</text><text v-if="filterField.hint">{{ filterField.hint }}</text>
              </view>
              <input v-if="filterField.type === 'text'" v-model="filterValues[filterField.key]"
                class="filter-input" :placeholder="filterField.placeholder || `请输入${filterField.label}`"
                confirm-type="done" />
              <view v-else-if="filterField.type === 'range'" class="filter-range">
                <input :value="rangeFilterValue(filterField, 'min')" type="digit"
                  :placeholder="filterField.minPlaceholder || '最小值'"
                  @input="setRangeFilter(filterField, 'min', $event.detail.value)" />
                <text>至</text>
                <input :value="rangeFilterValue(filterField, 'max')" type="digit"
                  :placeholder="filterField.maxPlaceholder || '最大值'"
                  @input="setRangeFilter(filterField, 'max', $event.detail.value)" />
              </view>
              <view v-else-if="filterField.type === 'toggle'" class="filter-toggle">
                <text>{{ filterField.description || filterField.label }}</text>
                <switch :checked="Boolean(filterValues[filterField.key])" color="#0b86d4"
                  @change="setToggleFilter(filterField, $event.detail.value)" />
              </view>
              <view v-else class="filter-options">
                <view v-for="option in filterOptionsFor(filterField)"
                  :key="`${filterField.key}-${option.value}`" class="filter-option"
                  :class="{ active: isFilterOptionSelected(filterField, option) }"
                  hover-class="filter-option--pressed" @tap="selectFilterOption(filterField, option)">
                  <text>{{ option.label }}</text>
                </view>
                <text v-if="!filterOptionsFor(filterField).length" class="filter-no-options">暂无可选项</text>
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
    </root-portal>

    <view v-if="activeAction" class="action-mask" @tap="closeActionInput">
      <view class="action-dialog" @tap.stop>
        <view class="action-dialog__head">
          <view>
            <text>{{ activeAction.inputTitle || activeAction.label }}</text>
            <text>{{ getTitle(activeRow) }}</text>
          </view>
          <view class="action-dialog__close" @tap="closeActionInput"><text>×</text></view>
        </view>
        <textarea v-model="actionInput" class="action-dialog__textarea"
          :placeholder="activeAction.inputPlaceholder || '请输入处理意见'" :maxlength="500" auto-height />
        <scroll-view v-if="approvalOpinions.length" class="approval-opinions" scroll-x :show-scrollbar="false">
          <view class="approval-opinions__row">
            <view v-for="item in approvalOpinions" :key="item" class="approval-opinion"
              @tap="actionInput = item"><text>{{ item }}</text></view>
          </view>
        </scroll-view>
        <view class="action-dialog__footer">
          <view @tap="closeActionInput"><text>取消</text></view>
          <view :class="{ disabled: actionSubmitting }" @tap="submitActionInput">
            <text>{{ actionSubmitting ? '处理中' : '确认提交' }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { businessModules } from '@/platform/business.js'
import {
  findMenu,
  formatDateTime,
  formatFieldValue,
  loadModuleRows,
  openForm
} from '@/platform/business-runtime.js'
import { compileListConfig, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { loadNativeFormDefinition, loadNativeTableModel, parseJson } from '@/platform/native-form.js'
import { V8, getUser, post } from '@/utils/request.js'
import MciBusinessCard from '@/components/mci-business-card/mci-business-card.vue'
import MciTaskCard from '@/components/mci-task-card/mci-task-card.vue'
import {
  executeBusinessRowAction,
  getBusinessRowActions,
  loadApprovalOpinions
} from '@/pages/business/utils/xjy-row-actions.js'

const LAYOUT_COMPONENTS = new Set(['Divider', 'CollapseGroup', 'Tabs', 'Alert', 'StaticText', 'Html'])
const RANGE_FIELD_TYPES = /^(int|integer|long|short|float|double|decimal|number|numeric|money)$/i
const RANGE_COMPONENTS = new Set(['NumberText'])
const KEYWORD_EXCLUDED_COMPONENTS = new Set([
  'ImgUpload', 'FileUpload', 'VideoUpload', 'AudioUpload', 'RichText', 'Map', 'MapArea',
  'DateTime', 'Date', 'Time', 'TableChild', 'JoinTable', 'OpenTable'
])

function unwrapValue(value) {
  if (value && typeof value === 'object') return value.Id ?? value.Value ?? value.value ?? ''
  return value ?? ''
}

function relationshipId() {
  let seed = Date.now()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
    const value = (seed + Math.random() * 16) % 16 | 0
    seed = Math.floor(seed / 16)
    return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16)
  })
}

// zhy：把后台菜单 SearchFieldIds 转换为小程序通用筛选字段，并兼容旧版纯 Id 配置。
function resolveMenuSearchFields(value, definitionFields = []) {
  const source = parseJson(value, value)
  const items = Array.isArray(source) ? source : []
  return items.map((item, index) => {
    const config = item && typeof item === 'object' ? item : { Id: item }
    // zhy：PC 的 Out 仅表示字段展示在外部搜索区；小程序统一收进筛选面板，不能因此丢失按钮。
    if (config.Hide === true) return null
    const field = definitionFields.find((candidate) =>
      String(candidate.Id || '') === String(config.Id || '') ||
      (config.Name && String(candidate.Name || '').toLowerCase() === String(config.Name).toLowerCase())
    )
    if (!field || !field.Name || LAYOUT_COMPONENTS.has(field.component)) return null
    const options = (Array.isArray(field.options) ? field.options : []).map((option) => ({
      label: option.label ?? option.Label ?? option.Name ?? option.Value ?? option.value,
      value: option.value ?? option.Value ?? option.Id ?? option.Key ?? option.label
    })).filter((option) => option.label !== undefined && option.label !== null && option.label !== '')
    const isRange = RANGE_COMPONENTS.has(field.component) || RANGE_FIELD_TYPES.test(String(field.Type || ''))
    return {
      key: `menu-search-${field.Id || field.Name || index}`,
      label: config.Label || field.Label || field.Name,
      field: field.Name,
      type: isRange ? 'range' : (options.length ? 'options' : 'text'),
      multiple: options.length > 0,
      options,
      component: field.component || '',
      fieldType: field.Type || ''
    }
  }).filter(Boolean)
}

function mergeFilterFields(existing = [], configured = []) {
  const result = [...existing]
  configured.forEach((field) => {
    const index = result.findIndex((item) => String(item.field || '').toLowerCase() === String(field.field).toLowerCase())
    if (index < 0) result.push(field)
  })
  return result
}

// zhy：菜单 SqlJoin 可能因一对多子表返回重复主记录，关联卡片必须按主表 Id 去重。
function uniqueRowsById(rows = []) {
  const result = []
  const indexes = new Map()
  ;(Array.isArray(rows) ? rows : []).forEach((row) => {
    const id = String(row?.Id || '').trim().toLowerCase()
    if (!id) {
      result.push(row)
      return
    }
    if (!indexes.has(id)) {
      indexes.set(id, result.length)
      result.push(row)
      return
    }
    const index = indexes.get(id)
    result[index] = { ...result[index], ...row }
  })
  return result
}

// zhy：物理表子表查询不会自动解析菜单 _Keyword，这里按 SearchFieldIds 生成同组 OR 模糊条件。
function buildKeywordWhere(fields = [], keyword = '') {
  const value = String(keyword || '').trim()
  if (!value) return []
  const searchable = fields.filter((field) =>
    field.field &&
    !['range', 'sort', 'toggle'].includes(field.type) &&
    !RANGE_FIELD_TYPES.test(String(field.fieldType || '')) &&
    !RANGE_COMPONENTS.has(field.component) &&
    !KEYWORD_EXCLUDED_COMPONENTS.has(field.component)
  )
  return searchable.map((field, index) => ({
    Name: field.field,
    Type: 'Like',
    Value: value,
    AndOr: index === 0 ? 'AND' : 'OR',
    GroupStart: index === 0,
    GroupEnd: index === searchable.length - 1
  }))
}

export default {
  name: 'MciBusinessRelatedList',
  components: { MciBusinessCard, MciTaskCard },
  props: {
    field: { type: Object, required: true },
    parentId: { type: [String, Number], default: '' },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' },
    parentTableId: { type: String, default: '' },
    parentMode: { type: String, default: 'View' },
    displayMode: { type: String, default: 'full' },
    previewLimit: { type: Number, default: 2 },
    relationValueOverride: { type: [String, Number], default: '' },
    showFloatingAdd: { type: Boolean, default: true },
    parentTableChildAuth: { type: Object, default: null }
  },
  emits: ['floating-add-state', 'filter-open-state', 'data-count'],
  data() {
    return {
      table: null,
      definition: null,
      menu: null,
      moduleKey: '',
      config: {},
      menuId: '',
      viewManifest: null,
      rows: [],
      count: 0,
      duplicateRowCount: 0,
      pageIndex: 1,
      loading: true,
      finished: false,
      error: '',
      keyword: '',
      filterOpen: false,
      filterLoading: false,
      filterValues: {},
      filterOptions: {},
      keywordSearchFields: [],
      currentUser: getUser() || {},
      activeAction: null,
      activeRow: {},
      actionInput: '',
      approvalOpinions: [],
      actionSubmitting: false,
      searchTimer: null,
      loadRequestId: 0
    }
  },
  computed: {
    fieldConfig() { return this.field.config || {} },
    childConfig() { return this.fieldConfig.TableChild || {} },
    childTableId() { return this.fieldConfig.TableChildTableId || '' },
    childMenuId() { return this.fieldConfig.TableChildSysMenuId || '' },
    childFkField() { return this.fieldConfig.TableChildFkFieldName || '' },
    sectionTitle() {
      return this.field.Label || this.fieldConfig.TableChildSysMenuName || this.table?.Description || this.field.Name || '关联数据'
    },
    isPreview() { return String(this.displayMode || '').toLowerCase() === 'preview' },
    displayedRows() { return this.isPreview ? this.rows.slice(0, Math.max(1, this.previewLimit)) : this.rows },
    relationValue() {
      if (this.relationValueOverride !== '' && this.relationValueOverride !== null && this.relationValueOverride !== undefined) {
        return unwrapValue(this.relationValueOverride)
      }
      const parentField = this.childConfig.PrimaryTableFieldName
      return unwrapValue(parentField ? this.parentForm[parentField] : this.parentId)
    },
    waitingForParentSave() {
      return String(this.parentMode || '').toLowerCase() === 'add' && !this.relationValue
    },
    tableChildAuth() {
      if (!this.field.Id || !this.parentTableId || !this.parentMenuId || !this.parentId || !this.relationValue) return null
      const result = {
        ParentFieldId: this.field.Id,
        ParentTableId: this.parentTableId,
        ParentSysMenuId: this.parentMenuId,
        ParentRowId: String(this.parentId),
        ParentValue: String(this.relationValue),
        ParentFormMode: this.parentMode || 'View'
      }
      // zhy：嵌套子表必须保留上一级 TableChild 授权链，例如
      // 客户 -> 项目合伙人跟进记录 -> 客户关怀；否则孙表虽能新增落库，
      // 详情查询会因服务端无法验证父记录来源而返回空列表。
      if (this.parentTableChildAuth) result.Parent = this.parentTableChildAuth
      return result
    },
    canAdd() {
      return Boolean(this.relationValue && this.childFkField && this.config.table)
    },
    filterFields() { return this.config.filterFields || [] },
    activeFilterCount() {
      return this.filterFields.reduce((count, field) => {
        const value = this.filterValues[field.key]
        if (Array.isArray(value)) return count + (value.length ? 1 : 0)
        if (value && typeof value === 'object') {
          return count + ([value.min, value.max].some((item) =>
            item !== undefined && item !== null && item !== ''
          ) ? 1 : 0)
        }
        return count + (value !== undefined && value !== null && value !== '' && value !== false ? 1 : 0)
      }, 0)
    },
    floatingStyle() {
      return {
        bottom: this.parentMode === 'View'
          ? 'calc(34rpx + var(--mci-safe-bottom))'
          : 'calc(132rpx + var(--mci-safe-bottom))'
      }
    }
  },
  watch: {
    canAdd: {
      immediate: true,
      handler(value) {
        this.$emit('floating-add-state', Boolean(value))
      }
    },
    // zhy：将筛选遮罩开关同步给外层详情页，统一处理跨组件固定层级。
    filterOpen: {
      immediate: true,
      handler(value) {
        this.$emit('filter-open-state', Boolean(value))
      }
    },
    relationValue: {
      immediate: true,
      handler(value) {
        if (!value) {
          this.rows = []
          this.loading = false
        } else if (this.config.table) {
          this.loadData(true)
        }
      }
    }
  },
  created() {
    uni.$on('microi:data-changed', this.handleDataChanged)
    this.initialize()
  },
  beforeUnmount() {
    uni.$off('microi:data-changed', this.handleDataChanged)
    clearTimeout(this.searchTimer)
    this.$emit('filter-open-state', false)
  },
  methods: {
    noop() {},
    async initialize(refresh = false) {
      if (!this.childTableId) {
        this.error = '关联表未配置数据表'
        this.loading = false
        return
      }
      this.loading = true
      try {
        this.table = await loadNativeTableModel(this.childTableId, {
          menuId: this.childMenuId,
          tableChildAuth: this.tableChildAuth,
          refresh
        })
        this.definition = await loadNativeFormDefinition(this.table.Name, refresh, {
          menuId: this.childMenuId,
          tableChildAuth: this.tableChildAuth
        })
        const matched = this.resolveBusinessModule(this.table.Name)
        this.moduleKey = matched.key
        const menu = await findMenu(
          matched.config.menuAliases || [],
          this.table.Name,
          refresh,
          this.childMenuId
        )
        this.menu = menu || null
        this.menuId = menu?.Id || this.childMenuId || ''
        this.config = {
          ...matched.config,
          table: this.table.Name,
          menuId: this.menuId,
          moduleEngineKey: menu?.ModuleEngineKey || ''
        }
        this.applyMenuSearchFields(menu?.SearchFieldIds)
        await this.loadViewConfig(refresh)
        if (this.waitingForParentSave) {
          this.rows = []
          this.count = 0
          this.finished = true
          this.loading = false
          return
        }
        await this.loadData(true, refresh)
      } catch (error) {
        this.error = error.message || error.Msg || '关联数据加载失败'
        this.loading = false
      }
    },
    resolveBusinessModule(tableName) {
      const targetTable = String(tableName || '').toLowerCase()
      const menuName = String(this.fieldConfig.TableChildSysMenuName || this.field.Label || '').trim()
      const candidates = Object.entries(businessModules)
        .filter(([, item]) => item && String(item.table || '').toLowerCase() === targetTable)
        .map(([key, item]) => {
          const names = [item.title, ...(item.menuAliases || [])].map((name) => String(name || '').trim())
          return { key, config: item, score: names.includes(menuName) ? 10 : 0 }
        })
        .sort((left, right) => right.score - left.score)
      if (candidates.length) return candidates[0]

      const fields = (this.definition?.fields || []).filter((field) =>
        field.visible && field.Name && !LAYOUT_COMPONENTS.has(field.component)
      )
      const titleField = fields.find((field) => /名称|标题|姓名|编号|客户/.test(field.Label || '')) || fields[0]
      const lines = fields.filter((field) => field !== titleField).slice(0, 4).map((field) => ({
        label: field.Label || field.Name,
        field: field.Name
      }))
      return {
        key: '',
        config: {
          title: menuName || this.table?.Description || tableName,
          table: tableName,
          menuAliases: menuName ? [menuName] : [],
          titleField: titleField?.Name || 'Name',
          lines
        }
      }
    },
    async loadViewConfig(refresh = false) {
      try {
        let manifest = await loadModuleViewManifest(this.config, {
          scene: 'Card',
          device: 'Mobile',
          user: this.currentUser,
          refresh
        })
        if (!manifest) {
          manifest = await loadModuleViewManifest(this.config, {
            scene: 'List',
            device: 'Mobile',
            user: this.currentUser,
            refresh
          })
        }
        this.applyMenuSearchFields(manifest?.Legacy?.SearchFieldIds)
        const dynamic = compileListConfig(manifest)
        if (!dynamic) return
        this.viewManifest = manifest
        const merged = { ...this.config }
        ;['tagFields', 'lines', 'statusOptions'].forEach((name) => {
          if (dynamic[name]?.length) merged[name] = dynamic[name]
        })
        ;['titleField', 'statusField', 'summaryField', 'periodField'].forEach((name) => {
          if (dynamic[name] !== undefined && dynamic[name] !== null && dynamic[name] !== '') merged[name] = dynamic[name]
        })
        if (dynamic.actionSchema?.length) merged.actionSchema = dynamic.actionSchema
        this.config = merged
      } catch (error) {}
    },
    applyMenuSearchFields(value) {
      const configured = resolveMenuSearchFields(value, this.definition?.fields || [])
      if (!configured.length) return
      this.keywordSearchFields = configured
      this.config = {
        ...this.config,
        filterFields: mergeFilterFields(this.config.filterFields || [], configured)
      }
    },
    async loadData(reset = false, refresh = false, notifyCount = false) {
      if (!this.relationValue || !this.config.table || (this.loading && !reset) || (!reset && this.finished)) return
      const requestId = ++this.loadRequestId
      if (reset) {
        this.pageIndex = 1
        this.finished = false
        this.duplicateRowCount = 0
      }
      this.loading = true
      this.error = ''
      try {
        const pageSize = this.isPreview ? Math.max(1, this.previewLimit) : (this.config.pageSize || 15)
        const keywordWhere = buildKeywordWhere(
          this.keywordSearchFields.length ? this.keywordSearchFields : this.filterFields,
          this.keyword
        )
        const extraWhere = [
          { Name: this.childFkField, Type: '=', Value: this.relationValue },
          ...this.buildFilterWhere(),
          ...keywordWhere
        ]
        let result
        if (this.tableChildAuth) {
          // zhy：TableChild 列表必须通过表单引擎携带完整父子授权链查询。
          // ModuleEngine 的子菜单数据范围会把已经正确绑定的孙表记录过滤成 0 条；
          // 此处不传子菜单 Id，由后端按 _TableChildAuth 逐层校验并用外键条件限定数据。
          const response = await V8.FormEngine.GetTableData(this.config.table, {
            _PageIndex: this.pageIndex,
            _PageSize: pageSize,
            _Keyword: keywordWhere.length ? '' : this.keyword.trim(),
            _OrderBy: this.config.defaultOrderBy || 'CreateTime',
            _OrderByType: this.config.defaultOrderType || 'DESC',
            _Where: extraWhere,
            _TableChildAuth: this.tableChildAuth
          })
          if (!response || Number(response.Code) !== 1) {
            throw new Error((response && response.Msg) || '关联数据加载失败')
          }
          result = {
            rows: Array.isArray(response.Data) ? response.Data : [],
            count: Number(response.DataCount || 0)
          }
        } else {
          result = await loadModuleRows(this.config, {
            pageIndex: this.pageIndex,
            pageSize,
            keyword: this.keyword.trim(),
            refresh,
            cacheAge: 0,
            extraWhere
          })
        }
        if (requestId !== this.loadRequestId) return
        const incomingRows = Array.isArray(result.rows) ? result.rows : []
        const combinedRows = uniqueRowsById(reset ? incomingRows : [...this.rows, ...incomingRows])
        const combinedSourceCount = reset ? incomingRows.length : this.rows.length + incomingRows.length
        this.duplicateRowCount += Math.max(0, combinedSourceCount - combinedRows.length)
        this.rows = combinedRows
        this.count = Math.max(this.rows.length, Number(result.count || 0) - this.duplicateRowCount)
        this.finished = this.rows.length >= this.count || incomingRows.length < pageSize
        if (!this.finished) this.pageIndex += 1
        if (notifyCount) this.emitDataCount()
      } catch (error) {
        if (requestId === this.loadRequestId) this.error = error.message || error.Msg || '关联数据加载失败'
      } finally {
        if (requestId === this.loadRequestId) this.loading = false
      }
    },
    search() {
      clearTimeout(this.searchTimer)
      this.loadData(true, true)
    },
    // zhy：搜索词输入后防抖自动检索，减少逐字请求并避免依赖搜索按钮。
    scheduleSearch() {
      clearTimeout(this.searchTimer)
      this.searchTimer = setTimeout(() => this.loadData(true, true), 350)
    },
    // zhy：右侧重置同时清空关键词与子菜单筛选面板中的全部条件。
    resetSearch() {
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.filterValues = {}
      this.filterOpen = false
      this.loadData(true, true)
    },
    clearKeyword() {
      if (!this.keyword) return
      clearTimeout(this.searchTimer)
      this.keyword = ''
      this.loadData(true, true)
    },
    // zhy：将接口返回的完整 DataCount 交给父表单做字段联动；筛选状态一并上送，避免误用局部数量。
    emitDataCount() {
      const count = Number(this.count)
      this.$emit('data-count', {
        field: this.field,
        table: this.config.table || this.table?.Name || '',
        title: this.config.title || this.sectionTitle || '',
        count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 0,
        filtered: Boolean(String(this.keyword || '').trim() || this.activeFilterCount)
      })
    },
    loadMore() { this.loadData(false) },
    openMore() {
      const query = [
        `fieldId=${encodeURIComponent(this.field.Id || '')}`,
        `parentId=${encodeURIComponent(this.parentId || '')}`,
        `parentMenuId=${encodeURIComponent(this.parentMenuId || '')}`,
        `parentTableId=${encodeURIComponent(this.parentTableId || '')}`,
        `relationValue=${encodeURIComponent(this.relationValue || '')}`,
        `parentTableChildAuth=${encodeURIComponent(JSON.stringify(this.parentTableChildAuth || null))}`,
        `title=${encodeURIComponent(this.config.title || this.sectionTitle || '关联列表')}`
      ].join('&')
      uni.navigateTo({
        url: `/pages/business/related-list?${query}`,
        success: (result) => {
          result.eventChannel?.emit('related-list-context', {
            field: this.field,
            parentId: this.parentId,
            parentForm: this.parentForm,
            parentMenuId: this.parentMenuId,
            parentTableId: this.parentTableId,
            parentMode: this.parentMode,
            parentTableChildAuth: this.parentTableChildAuth,
            relationValue: this.relationValue,
            title: this.config.title || this.sectionTitle
          })
        }
      })
    },
    buildFilterWhere() {
      const result = []
      this.filterFields.forEach((field) => {
        if (field.type === 'sort') return
        const value = this.filterValues[field.key]
        if (field.type === 'range') {
          if (value && value.min !== undefined && value.min !== '') {
            result.push({ Name: field.field, Type: '>=', Value: Number(value.min) })
          }
          if (value && value.max !== undefined && value.max !== '') {
            result.push({ Name: field.field, Type: '<=', Value: Number(value.max) })
          }
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
          result.push({
            Name: field.field,
            Type: field.operation || (field.type === 'text' ? 'Like' : '='),
            Value: typeof value === 'string' ? value.trim() : value
          })
        }
      })
      return result
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
      if (field.multiple) {
        return Array.isArray(value) && value.some((item) => String(item) === String(option.value))
      }
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
      this.filterValues[field.key] = {
        ...(this.filterValues[field.key] || { min: '', max: '' }),
        [side]: value
      }
    },
    resetAdvancedFilters() { this.filterValues = {} },
    applyAdvancedFilters() {
      this.filterOpen = false
      this.loadData(true, true)
    },
    getTitle(row) {
      const configured = row[this.config.titleField]
      if (configured) return formatFieldValue(configured, '', { empty: '' })
      const fallback = ['Name', 'Title', 'Biaoti', 'KehuMC', 'DingdanBH', 'ShouhouFWBH', 'Xingming']
        .find((field) => row[field])
      return fallback ? formatFieldValue(row[fallback], '', { empty: '' }) : `记录 ${String(row.Id || '').slice(-6)}`
    },
    getStatus(row) {
      if (this.moduleKey === 'customerAddresses') {
        const defaultAddressCode = String(this.parentForm?.AddressBH || '')
        if (defaultAddressCode && String(row.AddressBH || '') === defaultAddressCode) return '默认地址'
      }
      return formatFieldValue(row[this.config.statusField], '', { empty: '' })
    },
    getStatusClass(row) {
      const text = String(this.getStatus(row))
      if (/完成|结束|正常|合作|通过|审批/.test(text)) return 'is-success'
      if (/取消|作废|驳回|故障|超时/.test(text)) return 'is-danger'
      if (/待|处理中|跟进|预约/.test(text)) return 'is-warning'
      return 'is-info'
    },
    getTags(row) {
      return (this.config.tagFields || [])
        .map((field) => formatFieldValue(row[field], '', { empty: '' }))
        .filter(Boolean)
        .slice(0, 3)
    },
    visibleLines(row) {
      return (this.config.lines || [])
        .filter((line) => row[line.field] !== undefined && row[line.field] !== null && row[line.field] !== '')
        .slice(0, 4)
    },
    cardLines(row) {
      return this.visibleLines(row).map((line) => ({
        ...line,
        value: formatFieldValue(row[line.field], line.format),
        rawValue: row[line.field]
      }))
    },
    summaryValue(row) { return formatFieldValue(row[this.config.summaryField], '', { empty: '' }) },
    formatCreateTime(value) { return formatDateTime(value) },
    taskCardRow(row) {
      return {
        ...row,
        customer: row.KehuMC || row.customer || '',
        no: row.ShouhouFWBH || row.no || '',
        state: row.Zhuangtai || row.state || '',
        type: row.Leixing || row.type || '售后',
        content: row.Neirong || row.content || '',
        planTimeText: formatDateTime(row.YujiSHSJ || row.planTime),
        address: row.XiangxiDZ || row.address || '',
        serviceUser: row.ShouhouRY || row.serviceUser || '',
        phone: row.LianxiDH || row.phone || ''
      }
    },
    taskStatusClass(row) {
      const state = String(row.Zhuangtai || row.state || '')
      if (/结束|完成/.test(state)) return 'status-pill--success'
      if (/取消|作废/.test(state)) return 'status-pill--danger'
      if (/接单|服务|验收|评价|处理中/.test(state)) return 'status-pill--doing'
      return 'status-pill--todo'
    },
    rowActions(row) {
      const nativeActions = this.moduleKey ? getBusinessRowActions(this.moduleKey, row, this.currentUser) : []
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
        this.actionSubmitting = true
        try {
          await executeViewAction(action.__viewAction, {
            form: row,
            user: this.currentUser,
            menu: {
              Id: this.viewManifest?.Module?.Id || this.menuId,
              ModuleEngineKey: this.viewManifest?.Module?.ModuleEngineKey || ''
            },
            tableName: this.config.table,
            refresh: () => this.loadData(true, true)
          })
        } finally {
          this.actionSubmitting = false
        }
        return
      }
      if (action.key === 'device-repair') {
        uni.navigateTo({ url: `/pages/native/repair?deviceId=${encodeURIComponent(row.Id)}` })
        return
      }
      if (action.key === 'device-consumables') {
        uni.navigateTo({ url: `/pages/task/consumable?deviceId=${encodeURIComponent(row.Id)}&source=device` })
        return
      }
      if (action.key === 'visit-care') {
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
      if (action.input) {
        this.activeAction = action
        this.activeRow = row
        this.actionInput = ''
        this.approvalOpinions = []
        if (/^order-(approve|reject)$/.test(action.key)) {
          this.approvalOpinions = await loadApprovalOpinions()
        }
        return
      }
      if (action.confirm && !(await this.confirmAction(action.confirm))) return
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
      this.actionSubmitting = true
      uni.showLoading({ title: '正在处理', mask: true })
      try {
        await executeBusinessRowAction(action.key, row, input, this.currentUser)
        this.activeAction = null
        this.activeRow = {}
        this.actionInput = ''
        this.approvalOpinions = []
        uni.showToast({ title: `${action.label}成功`, icon: 'success' })
        await this.loadData(true, true, true)
      } catch (error) {
        uni.showToast({ title: error.message || `${action.label}失败`, icon: 'none' })
      } finally {
        uni.hideLoading()
        this.actionSubmitting = false
      }
    },
    callbackDefaults() {
      const result = { [this.childFkField]: this.relationValue }
      const callbacks = parseJson(this.fieldConfig.TableChildCallbackField, [])
      ;(Array.isArray(callbacks) ? callbacks : []).forEach((item) => {
        const father = item.Father || item.father
        const child = item.Child || item.child
        if (father && child && this.parentForm[father] !== undefined) result[child] = this.parentForm[father]
      })
      if (this.moduleKey === 'customerCare') {
        const rawContacts = parseJson(this.parentForm.BeibaiFR, this.parentForm.BeibaiFR)
        const contact = Array.isArray(rawContacts) ? rawContacts[0] : rawContacts
        const contactRow = contact && typeof contact === 'object' ? contact : {}
        const contactText = typeof contact === 'string' ? contact.trim() : ''
        const contactTextIsId = /^[0-9a-f-]{32,36}$/i.test(contactText) || /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(contactText)
        if (!result.KehuID) result.KehuID = this.parentForm.KehuID || ''
        if (!result.KehuMC) result.KehuMC = this.parentForm.KehuMC || ''
        if (!result.LianxiRID) {
          result.LianxiRID = contactRow.Id || contactRow.id || (contactTextIsId ? contactText : '')
        }
        if (!result.LianxiR) result.LianxiR = Array.isArray(rawContacts) ? rawContacts : (contact ? [contact] : [])
      }
      if (this.moduleKey === 'contacts' && !result.Guid70) result.Guid70 = relationshipId()
      return result
    },
    openAdd() {
      if (!this.canAdd) return
      if (this.moduleKey === 'members') {
        uni.navigateTo({ url: '/pages/native/member-edit' })
        return
      }
      if (this.moduleKey === 'serviceForms') {
        uni.navigateTo({
          url: `/pages/native/service-record?customerId=${encodeURIComponent(this.parentId)}`
        })
        return
      }
      if (this.moduleKey === 'casebooks') {
        uni.navigateTo({ url: '/pages/native/casebook' })
        return
      }
      openForm({
        table: this.config.table,
        mode: 'Add',
        title: `新增${this.config.title || this.sectionTitle}`,
        menuId: this.menuId,
        menuAliases: this.config.menuAliases || [],
        defaultValues: this.callbackDefaults(),
        tableChildAuth: this.tableChildAuth,
        includeRelated: true
      })
    },
    openDetail(row) {
      if (!row?.Id) return
      if (this.moduleKey === 'tasks') {
        uni.navigateTo({ url: `/pages/task/detail?id=${encodeURIComponent(row.Id)}` })
        return
      }
      if (this.moduleKey === 'serviceForms') {
        uni.navigateTo({ url: `/pages/native/service-record?id=${encodeURIComponent(row.Id)}` })
        return
      }
      if (this.moduleKey === 'casebooks') {
        uni.navigateTo({ url: `/pages/native/casebook?id=${encodeURIComponent(row.Id)}` })
        return
      }
      if (this.moduleKey === 'taskDevices' && row.ShouhouDDID) {
        uni.navigateTo({ url: `/pages/task/detail?id=${encodeURIComponent(row.ShouhouDDID)}` })
        return
      }
      if (this.moduleKey === 'merchantProducts') {
        uni.navigateTo({ url: `/pages/mall/detail?id=${encodeURIComponent(row.Id)}` })
        return
      }
      if (['customers', 'orders', 'devices', 'leads', 'recruitment', 'demands', 'stores', 'providers']
        .includes(this.moduleKey)) {
        uni.navigateTo({
          url: `/pages/business/detail?key=${encodeURIComponent(this.moduleKey)}&id=${encodeURIComponent(row.Id)}&menuId=${encodeURIComponent(this.menuId || '')}`
        })
        return
      }
      openForm({
        table: this.config.table,
        rowId: row.Id,
        mode: 'View',
        title: `${this.config.title || this.sectionTitle}详情`,
        menuId: this.menuId,
        menuAliases: this.config.menuAliases || [],
        tableChildAuth: this.tableChildAuth,
        includeRelated: true
      })
    },
    callPhone(phone) { uni.makePhoneCall({ phoneNumber: String(phone) }) },
    // zhy：未保存主表时，后端关联查询尚不能以父记录完成授权，直接合并子表保存事件中的真实记录。
    mergeDraftChangedRow(payload = {}) {
      if (String(this.parentMode || '').toLowerCase() !== 'add') return false
      const row = payload.row && typeof payload.row === 'object' ? payload.row : null
      if (!row) return false
      const payloadRelation = payload.parentValue || row[this.childFkField] || ''
      if (!payloadRelation || String(payloadRelation) !== String(this.relationValue)) return false
      const rowId = row.Id || payload.id
      if (!rowId) return false
      const savedRow = { ...row, Id: rowId }
      const index = this.rows.findIndex((item) => String(item.Id || '') === String(rowId))
      if (index >= 0) {
        this.rows = this.rows.map((item, itemIndex) =>
          itemIndex === index ? { ...item, ...savedRow } : item
        )
      } else {
        this.rows = [savedRow, ...this.rows]
      }
      this.count = this.rows.length
      this.error = ''
      this.loading = false
      this.emitDataCount()
      return true
    },
    handleDataChanged(payload = {}) {
      if (String(payload.table || '').toLowerCase() === String(this.config.table || '').toLowerCase()) {
        // zhy：草稿父记录优先使用保存回传数据，避免空的远程查询覆盖刚新增的联系人。
        if (this.mergeDraftChangedRow(payload)) return
        // zhy：只有子表真实保存后才通知父表更新派生总数，普通打开、搜索和筛选不改主表字段。
        this.loadData(true, true, true)
      }
    }
  }
}
</script>

<style scoped>
.related-business-list { position: relative; min-height: 180rpx; padding: 18rpx 22rpx calc(118rpx + var(--mci-safe-bottom)); background: var(--mci-bg-base, #f4f8fa); }
.related-business-list--preview { min-height: 0; padding: 10rpx 0 0; background: transparent; }
.search-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: 12rpx;
  margin: -2rpx -2rpx 16rpx;
}
.search-row--simple { grid-template-columns: minmax(0, 1fr) auto; }
.search-input-wrap { position: relative; min-width: 0; }
.search-input {
  box-sizing: border-box;
  width: 100%;
  height: 72rpx;
  padding: 0 68rpx 0 24rpx;
  border: 1rpx solid #dce8ed;
  border-radius: 14rpx;
  background: #fff;
  font-size: 26rpx;
}
.search-clear {
  position: absolute;
  top: 50%;
  right: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 38rpx;
  height: 38rpx;
  border-radius: 50%;
  color: #fff;
  background: #a9b7bd;
  font-size: 28rpx;
  line-height: 38rpx;
  transform: translateY(-50%);
}
.search-clear--pressed { opacity: .68; }
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
.related-data-list, .related-skeleton { width: 100%; }
.skeleton-card { margin-bottom: 18rpx; padding: 22rpx 24rpx; border: 1rpx solid #e3edf1; border-radius: 16rpx; background: #fff; }
.skeleton-line { width: 58%; height: 24rpx; margin: 18rpx 0; border-radius: 6rpx; background: linear-gradient(90deg, #eef3f5 25%, #f7fafb 50%, #eef3f5 75%); background-size: 300% 100%; animation: shimmer 1.4s infinite; }
.skeleton-line.wide { width: 82%; height: 30rpx; }
.skeleton-line.short { width: 40%; }
.related-empty { min-height: 220rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; color: #879aa2; font-size: 24rpx; text-align: center; }
.related-empty view, .related-empty text:last-child:not(:first-child), .load-more { color: #0b86d4; }
.load-more, .load-finished { min-height: 72rpx; display: flex; align-items: center; justify-content: center; color: #8298a1; font-size: 23rpx; }
.load-more--pressed { opacity: .7; }
.preview-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.preview-actions--single { grid-template-columns: 1fr; }
.preview-action { height: 76rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; border: 1rpx solid rgba(229, 70, 37, .45); border-radius: 10rpx; color: #d9472b; background: rgba(229, 70, 37, .05); font-size: 25rpx; font-weight: 650; transition: transform 150ms ease, opacity 150ms ease; }
.preview-action--add { border-color: #d9472b; color: #fff; background: #d9472b; }
.preview-action__icon { font-size: 28rpx; line-height: 1; }
.preview-action--pressed { transform: scale(.98); opacity: .82; }
.floating-add { position: fixed; right: 28rpx; z-index: 12; width: 92rpx; height: 92rpx; display: flex; align-items: center; justify-content: center; border: 4rpx solid rgba(255, 255, 255, .88); border-radius: 50%; color: #fff; background: #e94b2c; box-shadow: 0 10rpx 28rpx rgba(233, 75, 44, .3); font-size: 44rpx; transition: transform 150ms ease; }
.floating-add--pressed { transform: scale(.9); }
.filter-mask { position: fixed; inset: 0; width: 100vw; height: 100vh; z-index: 9999; display: flex; align-items: flex-end; overflow: hidden; background: rgba(13, 37, 48, .42); }
.filter-sheet { box-sizing: border-box; width: 100%; height: min(82vh, 1160rpx); display: grid; grid-template-rows: auto minmax(0, 1fr) auto; border-radius: 16rpx 16rpx 0 0; overflow: hidden; background: #fff; }
.filter-sheet__head { display: flex; align-items: center; justify-content: space-between; gap: 20rpx; min-height: 104rpx; padding: 0 26rpx; border-bottom: 1rpx solid #e8eff2; }
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
.filter-option.active { border-color: rgba(11, 134, 212, .38); color: #087dad; background: #e9f6fa; font-weight: 650; }
.filter-option--pressed { transform: scale(.96); }
.filter-no-options { color: #94a5ab; font-size: 21rpx; }
.filter-toggle { min-height: 72rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; margin-top: 8rpx; }
.filter-toggle > text { color: #6a828c; font-size: 22rpx; }
.filter-toggle switch { transform: scale(.78); transform-origin: right center; }
.filter-sheet__safe { height: 22rpx; }
.filter-sheet__footer { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 14rpx; padding: 16rpx max(26rpx, var(--mci-safe-right)) calc(16rpx + var(--mci-safe-bottom)) max(26rpx, var(--mci-safe-left)); border-top: 1rpx solid #e8eff2; background: #fff; }
.filter-sheet__footer view { height: 76rpx; border-radius: 8rpx; color: #536e79; background: #edf3f5; font-size: 25rpx; font-weight: 650; line-height: 76rpx; text-align: center; }
.filter-sheet__footer view:last-child { color: #fff; background: #0b86d4; }
.filter-loading { padding: 22rpx 26rpx; }
.filter-loading > view { padding: 18rpx 0; }
.filter-loading > view > view { height: 22rpx; margin-bottom: 14rpx; border-radius: 5rpx; background: linear-gradient(90deg, #eef3f5 25%, #f7fafb 50%, #eef3f5 75%); background-size: 300% 100%; animation: shimmer 1.4s infinite; }
.filter-loading > view > view:first-child { width: 28%; }
.filter-loading > view > view:last-child { width: 72%; height: 54rpx; }
.action-mask { position: fixed; inset: 0; z-index: 30; display: flex; align-items: flex-end; background: rgba(13, 37, 48, .42); }
.action-dialog { width: 100%; padding: 28rpx 28rpx calc(24rpx + var(--mci-safe-bottom)); border-radius: 20rpx 20rpx 0 0; background: #fff; box-sizing: border-box; }
.action-dialog__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20rpx; }
.action-dialog__head > view:first-child { min-width: 0; display: flex; flex-direction: column; gap: 6rpx; }
.action-dialog__head > view:first-child text:first-child { color: #17313b; font-size: 30rpx; font-weight: 700; }
.action-dialog__head > view:first-child text:last-child { overflow: hidden; color: #8498a1; font-size: 22rpx; text-overflow: ellipsis; white-space: nowrap; }
.action-dialog__close { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #6f858e; background: #f1f6f8; font-size: 34rpx; }
.action-dialog__textarea { box-sizing: border-box; width: 100%; min-height: 190rpx; margin-top: 24rpx; padding: 20rpx; border: 1rpx solid #dce8ed; border-radius: 12rpx; color: #294955; background: #f8fbfc; font-size: 25rpx; }
.approval-opinions { width: 100%; margin-top: 18rpx; white-space: nowrap; }
.approval-opinions__row { display: inline-flex; gap: 12rpx; }
.approval-opinion { flex: 0 0 auto; padding: 10rpx 16rpx; border-radius: 8rpx; color: #56717d; background: #eef5f7; font-size: 22rpx; }
.action-dialog__footer { display: grid; grid-template-columns: 1fr 1.5fr; gap: 16rpx; margin-top: 24rpx; }
.action-dialog__footer > view { height: 76rpx; display: flex; align-items: center; justify-content: center; border-radius: 12rpx; color: #5f7781; background: #eef4f6; font-size: 25rpx; font-weight: 650; }
.action-dialog__footer > view:last-child { color: #fff; background: linear-gradient(110deg, #0b86d4, #1aada1); }
.action-dialog__footer .disabled { opacity: .55; }
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .skeleton-line, .floating-add, .filter-option { animation: none; transition: none; } }
</style>
