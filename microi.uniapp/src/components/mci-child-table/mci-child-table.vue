<template>
  <view class="child-table mci-fade-up">
    <view class="child-table__header" hover-class="child-table__pressed" @tap="toggleExpanded">
      <view class="child-table__heading">
        <view class="child-table__bar"></view>
        <view class="child-table__title-wrap">
          <text class="child-table__title">{{ sectionTitle }}</text>
          <text v-if="expanded && !loading" class="child-table__count">{{ rows.length }} 条</text>
        </view>
      </view>
      <view class="child-table__commands">
        <view v-if="canMaintain" class="child-table__add" hover-class="child-table__pressed" @tap.stop="addRow">
          <text class="child-table__add-icon">＋</text>
          <text>新增</text>
        </view>
        <text class="child-table__toggle" :class="{ expanded }">›</text>
      </view>
    </view>

    <view v-if="expanded">
      <view v-if="!relationValue" class="child-table__empty child-table__empty--pending">
        <text>保存主表后可维护{{ sectionTitle }}</text>
      </view>

      <view v-else-if="loading" class="child-table__loading">
        <view v-for="item in 2" :key="item" class="child-skeleton">
          <view class="child-skeleton__title"></view>
          <view class="child-skeleton__line"></view>
          <view class="child-skeleton__line short"></view>
        </view>
      </view>

      <view v-else-if="error" class="child-table__empty">
        <text class="child-table__error">{{ error }}</text>
        <text class="child-table__retry" @tap="loadRows(true)">重新加载</text>
      </view>

      <view v-else-if="rows.length" class="child-table__rows">
        <view
          v-for="(row, index) in rows"
          :key="row.Id || index"
          class="child-row"
          hover-class="child-table__pressed"
          @tap="openRow(row)"
        >
          <view class="child-row__index"><text>{{ index + 1 }}</text></view>
          <view class="child-row__content">
            <text class="child-row__title">{{ rowTitle(row) }}</text>
            <view v-for="column in secondaryColumns" :key="column.Name" class="child-row__line">
              <text class="child-row__label">{{ column.Label || column.Name }}</text>
              <text class="child-row__value">{{ display(column, row[column.Name]) }}</text>
            </view>
          </view>
          <view class="child-row__actions">
            <text class="child-row__arrow">›</text>
          </view>
          <view v-if="canMaintain" class="child-row__delete" hover-class="child-row__delete--pressed"
            @tap.stop="deleteRow(row)">
            <text class="child-row__delete-icon">×</text>
            <text>删除此条</text>
          </view>
        </view>
      </view>

      <view v-else class="child-table__empty">
        <text>暂无{{ sectionTitle }}</text>
        <text v-if="canMaintain" class="child-table__retry" @tap="addRow">添加第一条</text>
      </view>
    </view>
  </view>
</template>

<script>
import { V8 } from '@/utils/request.js'
import { fieldDisplayValue, loadNativeFormDefinition, loadNativeTableModel } from '@/platform/native-form.js'
import { openForm } from '@/platform/business-runtime.js'

const EXCLUDED_COLUMNS = new Set([
  'Id', 'CreateTime', 'UpdateTime', 'CreateUserId', 'UpdateUserId', 'OsClient',
  'TableChild', 'JoinForm', 'RichText', 'CodeEditor', 'FileUpload', 'ImgUpload', 'Map'
])

function unwrapValue(value) {
  if (value && typeof value === 'object') return value.Id ?? value.Value ?? value.value ?? ''
  return value ?? ''
}

export default {
  name: 'MciChildTable',
  props: {
    field: { type: Object, required: true },
    parentId: { type: [String, Number], default: '' },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' },
    parentTableId: { type: String, default: '' },
    parentMode: { type: String, default: 'View' },
    readonly: { type: Boolean, default: false }
  },
  data() {
    return {
      table: null,
      definition: null,
      rows: [],
      expanded: false,
      loading: false,
      error: ''
    }
  },
  computed: {
    config() { return this.field.config || {} },
    childConfig() { return this.config.TableChild || {} },
    sectionTitle() {
      return this.field.Label || this.config.TableChildSysMenuName || this.childConfig.Title || this.table?.Description || this.table?.Name || this.field.Name || '关联数据'
    },
    childTableId() { return this.config.TableChildTableId || '' },
    childMenuId() { return this.config.TableChildSysMenuId || '' },
    childFkField() { return this.config.TableChildFkFieldName || '' },
    relationValue() {
      const parentField = this.childConfig.PrimaryTableFieldName
      return unwrapValue(parentField ? this.parentForm[parentField] : this.parentId)
    },
    tableChildAuth() {
      if (!this.field.Id || !this.parentTableId || !this.parentMenuId || !this.parentId || !this.relationValue) return null
      return {
        ParentFieldId: this.field.Id,
        ParentTableId: this.parentTableId,
        ParentSysMenuId: this.parentMenuId,
        ParentRowId: String(this.parentId),
        ParentValue: String(this.relationValue),
        ParentFormMode: this.parentMode || (this.readonly ? 'View' : 'Edit')
      }
    },
    canMaintain() { return !this.readonly && Boolean(this.relationValue && this.childFkField && (this.childTableName || this.childTableId)) },
    childTableName() { return this.table ? this.table.Name : '' },
    visibleColumns() {
      if (!this.definition) return []
      return this.definition.fields.filter((item) => {
        if (!item.visible || !item.Name || item.Name === this.childFkField) return false
        return !EXCLUDED_COLUMNS.has(item.Name) && !EXCLUDED_COLUMNS.has(item.component)
      }).slice(0, 4)
    },
    titleColumn() {
      const preferred = /名称|标题|姓名|地址|编号|内容|型号|商品|客户/
      return this.visibleColumns.find((item) => preferred.test(item.Label || '')) || this.visibleColumns[0] || null
    },
    secondaryColumns() { return this.visibleColumns.filter((item) => item !== this.titleColumn).slice(0, 3) }
  },
  watch: {
    relationValue: {
      immediate: true,
      handler(value) {
        if (!value) this.rows = []
        else if (this.expanded) this.loadRows()
      }
    }
  },
  created() { uni.$on('microi:data-changed', this.handleDataChanged) },
  beforeUnmount() { uni.$off('microi:data-changed', this.handleDataChanged) },
  methods: {
    async toggleExpanded() {
      this.expanded = !this.expanded
      if (this.expanded && this.relationValue && !this.rows.length && !this.loading) await this.loadRows()
    },
    async resolveDefinition(refresh = false) {
      if (!this.childTableId) throw new Error('子表未配置数据表')
      this.table = await loadNativeTableModel(this.childTableId, {
        menuId: this.childMenuId,
        tableChildAuth: this.tableChildAuth
      })
      this.definition = await loadNativeFormDefinition(this.table.Name, refresh, {
        menuId: this.childMenuId,
        tableChildAuth: this.tableChildAuth,
        tableModel: this.table
      })
    },
    async loadRows(refresh = false) {
      if (!this.relationValue) return
      this.loading = true
      this.error = ''
      try {
        if (!this.table || refresh) await this.resolveDefinition(refresh)
        if (!this.childFkField) throw new Error('子表未配置关联字段')
        const result = await V8.FormEngine.GetTableData(this.childTableName, {
          _Where: [{ Name: this.childFkField, Type: '=', Value: this.relationValue }],
          ...(this.childMenuId ? { _SysMenuId: this.childMenuId } : {}),
          ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
          _OrderBy: 'CreateTime',
          _OrderByType: 'DESC',
          _PageIndex: 1,
          _PageSize: 300
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '明细加载失败')
        this.rows = Array.isArray(result.Data) ? result.Data : []
      } catch (error) {
        this.error = error.message || error.Msg || '明细加载失败'
      } finally {
        this.loading = false
      }
    },
    display(field, value) { return fieldDisplayValue(field, value) },
    rowTitle(row) {
      if (!this.titleColumn) return `明细 ${row.Id ? String(row.Id).slice(-6) : ''}`
      return this.display(this.titleColumn, row[this.titleColumn.Name])
    },
    openRow(row) {
      if (!this.childTableName || !row.Id) return
      openForm({
        table: this.childTableName,
        rowId: row.Id,
        mode: this.readonly ? 'View' : 'Edit',
        title: `${this.sectionTitle}详情`,
        menuId: this.childMenuId,
        tableChildAuth: this.tableChildAuth,
        includeRelated: true
      })
    },
    async addRow() {
      if (!this.canMaintain) return
      if (!this.childTableName) {
        try { await this.resolveDefinition() } catch (error) {
          uni.showToast({ title: error.message || '子表配置加载失败', icon: 'none' })
          return
        }
      }
      openForm({
        table: this.childTableName,
        mode: 'Add',
        title: `新增${this.sectionTitle}`,
        menuId: this.childMenuId,
        tableChildAuth: this.tableChildAuth,
        defaultValues: { [this.childFkField]: this.relationValue },
        includeRelated: true
      })
    },
    deleteRow(row) {
      if (!this.canMaintain || !row.Id) return
      uni.showModal({
        title: '删除明细',
        content: '删除后无法恢复，确认继续吗？',
        confirmColor: '#D9472B',
        success: async ({ confirm }) => {
          if (!confirm) return
          try {
            const result = await V8.FormEngine.DelFormData({
              FormEngineKey: this.childTableName,
              Id: row.Id,
              _InvokeType: 'Client',
              ...(this.childMenuId ? { _SysMenuId: this.childMenuId } : {}),
              ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {})
            })
            if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '删除失败')
            uni.showToast({ title: '已删除', icon: 'success' })
            await this.loadRows(true)
          } catch (error) {
            uni.showToast({ title: error.message || error.Msg || '删除失败', icon: 'none' })
          }
        }
      })
    },
    handleDataChanged(payload = {}) {
      if (this.childTableName && String(payload.table || '').toLowerCase() === String(this.childTableName).toLowerCase()) {
        this.loadRows(true)
      }
    }
  }
}
</script>

<style scoped>
.child-table { margin: 0 22rpx 20rpx; border: 1px solid var(--mci-border, #e4ecef); border-radius: 8px; background: var(--mci-bg-card, #fff); overflow: hidden; animation: mciChildEnter .3s ease both; }
.child-table__header { min-height: 86rpx; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 0 22rpx; border-bottom: 1px solid #e9f0f2; }
.child-table__heading, .child-table__title-wrap, .child-table__commands, .child-table__add { display: flex; align-items: center; }
.child-table__heading { min-width: 0; gap: 13rpx; }
.child-table__title-wrap { min-width: 0; gap: 10rpx; }
.child-table__bar { width: 7rpx; height: 30rpx; border-radius: 4rpx; background: linear-gradient(180deg, #0b86d4, #20b6b2); }
.child-table__title { max-width: 360rpx; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #17313b; font-size: 29rpx; font-weight: 700; }
.child-table__count { color: #8699a0; font-size: 21rpx; font-weight: 500; }
.child-table__add { flex: none; min-height: 58rpx; gap: 5rpx; padding: 0 16rpx; border-radius: 29rpx; color: #087fbf; background: #edf8fc; font-size: 24rpx; font-weight: 700; transition: transform .16s ease, opacity .16s ease; box-sizing: border-box; }
.child-table__add-icon { font-size: 30rpx; line-height: 1; }
.child-table__commands { flex: none; gap: 26rpx; }
.child-table__toggle { width: 42rpx; color: #80969e; font-size: 42rpx; line-height: 1; text-align: center; transform: rotate(90deg); transition: transform .18s ease; }
.child-table__toggle.expanded { transform: rotate(-90deg); }
.child-table__rows { padding: 0 20rpx; }
.child-row { min-height: 130rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr) 42rpx; align-items: start; gap: 14rpx; padding: 22rpx 0; border-bottom: 1px solid #edf2f4; transition: transform .16s ease, opacity .16s ease; }
.child-row:last-child { border-bottom: 0; }
.child-row__index { width: 44rpx; height: 44rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #087fbf; background: #eaf7fc; font-size: 21rpx; font-weight: 700; }
.child-row__content { min-width: 0; }
.child-row__title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #193640; font-size: 27rpx; font-weight: 700; }
.child-row__line { min-width: 0; display: grid; grid-template-columns: 132rpx minmax(0, 1fr); gap: 10rpx; margin-top: 8rpx; font-size: 22rpx; line-height: 1.45; }
.child-row__label { color: #899ba2; }
.child-row__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #506972; }
.child-row__actions { min-height: 44rpx; display: flex; align-items: flex-start; justify-content: flex-end; }
.child-row__arrow { color: #91a4ab; font-size: 38rpx; line-height: 1; }
.child-row__delete { grid-column: 1 / -1; min-height: 64rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; margin-top: 10rpx; border: 1px solid #f2c9c1; border-radius: 8rpx; color: #bd402e; background: #fff4f1; font-size: 23rpx; font-weight: 700; transition: transform .16s ease, background-color .16s ease; }
.child-row__delete-icon { width: 28rpx; height: 28rpx; border-radius: 50%; color: #fff; background: #d6533d; font-size: 22rpx; font-weight: 800; line-height: 26rpx; text-align: center; }
.child-row__delete--pressed { background: #ffe9e4; transform: scale(.985); }
.child-table__empty { min-height: 160rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 28rpx; color: #84969d; font-size: 24rpx; text-align: center; }
.child-table__empty--pending { min-height: 112rpx; background: #fafcfd; }
.child-table__retry { color: #087fbf; font-weight: 650; }
.child-table__error { color: #b44935; }
.child-table__loading { padding: 12rpx 20rpx; }
.child-skeleton { padding: 20rpx 0; border-bottom: 1px solid #edf2f4; }
.child-skeleton:last-child { border-bottom: 0; }
.child-skeleton__title, .child-skeleton__line { height: 24rpx; border-radius: 4px; background: linear-gradient(90deg, #eef3f5 25%, #f8fafb 40%, #eef3f5 60%); background-size: 400% 100%; animation: mciChildShimmer 1.4s ease infinite; }
.child-skeleton__title { width: 46%; height: 29rpx; }
.child-skeleton__line { width: 88%; margin-top: 15rpx; }
.child-skeleton__line.short { width: 62%; }
.child-table__pressed { transform: scale(.986); opacity: .82; }
@keyframes mciChildShimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@keyframes mciChildEnter { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .child-table, .child-skeleton__title, .child-skeleton__line { animation: none; } }
</style>
