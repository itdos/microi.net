<template>
  <view class="selector-field">
    <view class="selector-field__button" :class="{ disabled: readonly }" hover-class="selector-field__pressed" @tap="openSelector">
      <view class="selector-field__icon"><text>＋</text></view>
      <view class="selector-field__copy">
        <text class="selector-field__title">{{ buttonTitle }}</text>
        <text class="selector-field__hint">从{{ tableLabel || '业务数据' }}中选择</text>
      </view>
      <text class="selector-field__arrow">›</text>
    </view>

    <view v-if="visible" class="selector-mask" @tap="closeSelector">
      <view class="selector-panel" @tap.stop>
        <view class="selector-panel__handle"></view>
        <view class="selector-panel__header">
          <view class="selector-panel__heading">
            <text class="selector-panel__title">{{ buttonTitle }}</text>
            <text class="selector-panel__subtitle">{{ multiple ? `已选 ${selectedIds.length} 项` : '请选择一项' }}</text>
          </view>
          <text class="selector-panel__close" @tap="closeSelector">×</text>
        </view>

        <view class="selector-search">
          <text class="selector-search__icon">⌕</text>
          <input v-model="keyword" class="selector-search__input" placeholder="搜索名称、编号或关键词" confirm-type="search" @confirm="loadRows(true)" />
          <text v-if="keyword" class="selector-search__clear" @tap="clearSearch">×</text>
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
            <view v-for="(row, index) in rows" :key="row.Id || index" class="selector-row" hover-class="selector-field__pressed" @tap="toggleRow(row)">
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
  </view>
</template>

<script>
import { V8 } from '@/utils/request.js'
import { fieldDisplayValue, loadNativeFormDefinition, loadNativeTableModel } from '@/platform/native-form.js'
import {
  getOpenTableWhere,
  submitOpenTableSelection,
  validateOpenTableContext
} from '@/platform/native-table.js'

const HEAVY_COMPONENTS = new Set(['TableChild', 'JoinForm', 'JoinTable', 'OpenTable', 'RichText', 'CodeEditor', 'ImgUpload', 'FileUpload', 'Map'])

export default {
  name: 'MciTableSelector',
  props: {
    field: { type: Object, required: true },
    parentTable: { type: String, default: '' },
    parentId: { type: [String, Number], default: '' },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' },
    readonly: { type: Boolean, default: false }
  },
  emits: ['change'],
  data() {
    return {
      visible: false,
      table: null,
      definition: null,
      rows: [],
      selectedIds: [],
      selectedRows: [],
      keyword: '',
      pageIndex: 1,
      pageSize: 20,
      total: 0,
      loading: false,
      submitting: false,
      error: ''
    }
  },
  computed: {
    config() { return (this.field.config && this.field.config.OpenTable) || {} },
    targetMenuId() { return this.config.SysMenuId || this.config.ModuleId || '' },
    multiple() { return this.config.MultipleSelect !== false },
    buttonTitle() { return this.config.BtnName || this.config.BtnText || this.field.Label || '选择数据' },
    tableLabel() { return (this.table && (this.table.Description || this.table.Name)) || this.config.SysMenuName || '' },
    finished() { return this.rows.length >= this.total && this.total > 0 },
    columns() {
      if (!this.definition) return []
      return this.definition.fields.filter((item) => item.visible && item.Name !== 'Id' && !HEAVY_COMPONENTS.has(item.component)).slice(0, 4)
    },
    titleColumn() {
      const preferred = /名称|标题|姓名|编号|型号|客户|商品|地址/
      return this.columns.find((item) => preferred.test(item.Label || '')) || this.columns[0] || null
    },
    secondaryColumns() { return this.columns.filter((item) => item !== this.titleColumn).slice(0, 2) }
  },
  methods: {
    async resolveTable() {
      if (this.table && this.definition) return
      const tableId = this.config.TableId
      if (!tableId && !this.config.TableName) throw new Error('选择组件未配置数据表')
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
      this.selectedIds = []
      this.selectedRows = []
      this.rows = []
      this.pageIndex = 1
      await this.loadRows(true)
    },
    closeSelector() { if (!this.submitting) this.visible = false },
    clearSearch() { this.keyword = ''; this.loadRows(true) },
    async loadRows(reset = false) {
      if (this.loading) return
      if (reset) { this.pageIndex = 1; this.rows = []; this.total = 0 }
      this.loading = true
      this.error = ''
      try {
        await this.resolveTable()
        const result = await V8.FormEngine.GetTableData(this.table.Name, {
          _Keyword: this.keyword.trim(),
          _Where: getOpenTableWhere(this.field, this.parentForm),
          ...(this.targetMenuId ? { _SysMenuId: this.targetMenuId } : {}),
          _OrderBy: 'CreateTime',
          _OrderByType: 'DESC',
          _PageIndex: this.pageIndex,
          _PageSize: this.pageSize
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '数据加载失败')
        const nextRows = Array.isArray(result.Data) ? result.Data : []
        this.rows = reset ? nextRows : [...this.rows, ...nextRows]
        this.total = Number(result.DataCount || this.rows.length)
      } catch (error) {
        this.error = error.message || error.Msg || '数据加载失败'
      } finally {
        this.loading = false
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
.selector-mask { position: fixed; z-index: 950; inset: 0; display: flex; align-items: flex-end; background: rgba(10, 31, 39, .44); }
.selector-panel { box-sizing: border-box; width: 100%; height: 84vh; max-height: 1180rpx; display: flex; flex-direction: column; padding-bottom: var(--mci-safe-bottom, env(safe-area-inset-bottom)); border-radius: 16px 16px 0 0; background: #f7fafb; animation: mciSelectorUp .24s ease both; }
.selector-panel__handle { width: 74rpx; height: 7rpx; flex: none; margin: 14rpx auto 4rpx; border-radius: 4rpx; background: #c8d4d8; }
.selector-panel__header { min-height: 90rpx; flex: none; display: flex; align-items: center; justify-content: space-between; padding: 0 24rpx; }
.selector-panel__heading { min-width: 0; }
.selector-panel__title, .selector-panel__subtitle { display: block; }
.selector-panel__title { color: #17343e; font-size: 31rpx; font-weight: 750; }
.selector-panel__subtitle { margin-top: 4rpx; color: #7f939b; font-size: 21rpx; }
.selector-panel__close { width: 64rpx; height: 64rpx; display: flex; align-items: center; justify-content: center; color: #6d838c; font-size: 42rpx; }
.selector-search { height: 78rpx; flex: none; display: grid; grid-template-columns: 44rpx minmax(0, 1fr) 42rpx; align-items: center; margin: 0 22rpx 14rpx; padding: 0 16rpx; border: 1px solid #dce7ea; border-radius: 8px; background: #fff; }
.selector-search__icon { color: #6f8790; font-size: 34rpx; }
.selector-search__input { min-width: 0; height: 76rpx; color: #25434d; font-size: 25rpx; }
.selector-search__clear { display: flex; justify-content: center; color: #8ca0a7; font-size: 32rpx; }
.selector-list { min-height: 0; flex: 1; }
.selector-rows { padding: 0 22rpx; }
.selector-row { min-height: 126rpx; display: grid; grid-template-columns: 50rpx minmax(0, 1fr); align-items: start; gap: 16rpx; margin-bottom: 12rpx; padding: 20rpx; border: 1px solid #e1e9ec; border-radius: 8px; background: #fff; transition: transform .16s ease, opacity .16s ease; }
.selector-row__check { width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; border: 1px solid #b9cbd1; border-radius: 50%; color: #fff; font-size: 24rpx; }
.selector-row__check.selected { border-color: #0786c8; background: #0786c8; }
.selector-row__content { min-width: 0; }
.selector-row__title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #193640; font-size: 27rpx; font-weight: 700; }
.selector-row__line { display: grid; grid-template-columns: 128rpx minmax(0, 1fr); gap: 12rpx; margin-top: 8rpx; color: #6f858d; font-size: 22rpx; }
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
