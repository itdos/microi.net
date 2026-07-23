<template>
  <view class="related-table mci-fade-up">
    <view class="related-table__header" hover-class="related-row--pressed" @tap="toggleExpanded">
      <view class="related-table__bar"></view>
      <view class="related-table__heading">
        <text class="related-table__title">{{ sectionTitle }}</text>
        <text v-if="expanded && !loading" class="related-table__count">{{ rows.length }} 条</text>
      </view>
      <view class="related-table__commands">
        <text v-if="expanded && rows.length" class="related-table__refresh" @tap.stop="loadRows(true)">刷新</text>
        <text class="related-table__toggle" :class="{ expanded }">›</text>
      </view>
    </view>

    <view v-if="expanded">
      <view v-if="loading" class="related-table__loading">
        <view v-for="item in 2" :key="item" class="related-skeleton"><view></view><view></view></view>
      </view>
      <view v-else-if="error" class="related-table__state">
        <text class="related-table__error">{{ error }}</text>
        <text class="related-table__link" @tap="loadRows(true)">重新加载</text>
      </view>
      <view v-else-if="!rows.length" class="related-table__state"><text>暂无{{ sectionTitle }}</text></view>
      <view v-else class="related-table__rows">
        <view v-for="(row, index) in rows" :key="row.Id || index" class="related-row" hover-class="related-row--pressed" @tap="openRow(row)">
          <view class="related-row__order"><text>{{ index + 1 }}</text></view>
          <view class="related-row__content">
            <text class="related-row__title">{{ rowTitle(row) }}</text>
            <view v-for="column in secondaryColumns" :key="column.Name" class="related-row__line">
              <text>{{ column.Label || column.Name }}</text>
              <text>{{ display(column, row[column.Name]) }}</text>
            </view>
          </view>
          <text class="related-row__arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { V8 } from '@/utils/request.js'
import {
  fieldDisplayValue,
  loadNativeFormDefinition,
  loadNativeTableModel,
  parseJson
} from '@/platform/native-form.js'
import { parseTableWhere } from '@/platform/native-table.js'
import { openForm } from '@/platform/business-runtime.js'

const HEAVY = new Set(['TableChild', 'JoinForm', 'JoinTable', 'OpenTable', 'RichText', 'CodeEditor', 'ImgUpload', 'FileUpload', 'Map'])

export default {
  name: 'MciRelatedTable',
  props: {
    field: { type: Object, required: true },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' }
  },
  data() { return { table: null, definition: null, rows: [], expanded: false, loading: false, error: '' } },
  computed: {
    config() { return (this.field.config && this.field.config.JoinTable) || {} },
    targetMenuId() { return this.config.ModuleId || this.config.SysMenuId || '' },
    sectionTitle() { return this.field.Label || this.config.ModuleName || (this.table && this.table.Description) || '关联数据' },
    columns() {
      if (!this.definition) return []
      return this.definition.fields.filter((item) => item.visible && item.Name !== 'Id' && !HEAVY.has(item.component)).slice(0, 4)
    },
    titleColumn() {
      const preferred = /名称|标题|姓名|编号|型号|客户|商品|地址/
      return this.columns.find((item) => preferred.test(item.Label || '')) || this.columns[0] || null
    },
    secondaryColumns() { return this.columns.filter((item) => item !== this.titleColumn).slice(0, 3) }
  },
  created() {
    uni.$on('microi:data-changed', this.handleDataChanged)
  },
  beforeUnmount() { uni.$off('microi:data-changed', this.handleDataChanged) },
  methods: {
    async toggleExpanded() {
      this.expanded = !this.expanded
      if (this.expanded && !this.rows.length && !this.loading) await this.loadRows()
    },
    async resolveTable(refresh = false) {
      if (this.table && !refresh) return
      if (!this.config.TableId) throw new Error('关联表格未配置数据表')
      this.table = await loadNativeTableModel(this.config.TableId, {
        menuId: this.targetMenuId
      })
      this.definition = await loadNativeFormDefinition(this.table.Name, refresh, {
        menuId: this.targetMenuId
      })
    },
    buildWhere() {
      const where = parseTableWhere(this.config.Where || this.config.Search, this.parentForm)
      if (this.field.Name === 'GuanlianHC') {
        const values = parseJson(this.parentForm.GuanlianHC, [])
        const ids = (Array.isArray(values) ? values : []).map((item) => typeof item === 'object' ? item.Id : item).filter(Boolean)
        const idCondition = where.find((item) => item.Name === 'Id' && String(item.Type).toLowerCase() === 'in')
        if (idCondition) idCondition.Value = ids
      }
      return where
    },
    async loadRows(refresh = false) {
      this.loading = true
      this.error = ''
      try {
        await this.resolveTable(refresh)
        const result = await V8.FormEngine.GetTableData(this.table.Name, {
          _Where: this.buildWhere(),
          ...(this.targetMenuId ? { _SysMenuId: this.targetMenuId } : {}),
          _OrderBy: 'CreateTime',
          _OrderByType: 'DESC',
          _PageIndex: 1,
          _PageSize: 300
        })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '关联数据加载失败')
        this.rows = Array.isArray(result.Data) ? result.Data : []
      } catch (error) {
        this.error = error.message || error.Msg || '关联数据加载失败'
      } finally {
        this.loading = false
      }
    },
    display(field, value) { return fieldDisplayValue(field, value) },
    rowTitle(row) { return this.titleColumn ? this.display(this.titleColumn, row[this.titleColumn.Name]) : `记录 ${String(row.Id || '').slice(-6)}` },
    openRow(row) {
      if (this.table && row.Id) {
        openForm({
          table: this.table.Name,
          rowId: row.Id,
          mode: 'View',
          title: `${this.sectionTitle}详情`,
          menuId: this.targetMenuId,
          includeRelated: false
        })
      }
    },
    handleDataChanged(payload = {}) {
      if (this.expanded && this.table && String(payload.table || '').toLowerCase() === String(this.table.Name).toLowerCase()) this.loadRows(true)
    }
  }
}
</script>

<style scoped>
.related-table { margin: 0 22rpx 20rpx; border: 1px solid var(--mci-border, #e4ecef); border-radius: 8px; background: #fff; overflow: hidden; animation: mciRelatedEnter .3s ease both; }
.related-table__header { min-height: 86rpx; display: grid; grid-template-columns: 7rpx minmax(0, 1fr) auto; align-items: center; gap: 13rpx; padding: 0 22rpx; border-bottom: 1px solid #e9f0f2; }
.related-table__bar { width: 7rpx; height: 30rpx; border-radius: 4rpx; background: linear-gradient(180deg, #0b86d4, #20b6b2); }
.related-table__heading { min-width: 0; display: flex; align-items: center; gap: 10rpx; }
.related-table__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #17313b; font-size: 29rpx; font-weight: 700; }
.related-table__count { flex: none; color: #8699a0; font-size: 21rpx; }
.related-table__refresh { color: #087fbf; font-size: 22rpx; text-align: right; }
.related-table__commands { display: flex; align-items: center; gap: 14rpx; }
.related-table__toggle { color: #80969e; font-size: 42rpx; line-height: 1; transform: rotate(90deg); transition: transform .18s ease; }
.related-table__toggle.expanded { transform: rotate(-90deg); }
.related-table__rows { padding: 0 20rpx; }
.related-row { min-height: 126rpx; display: grid; grid-template-columns: 46rpx minmax(0, 1fr) 26rpx; gap: 14rpx; padding: 22rpx 0; border-bottom: 1px solid #edf2f4; transition: transform .16s ease, opacity .16s ease; }
.related-row:last-child { border-bottom: 0; }
.related-row__order { width: 42rpx; height: 42rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #087fbf; background: #eaf7fc; font-size: 20rpx; font-weight: 700; }
.related-row__content { min-width: 0; }
.related-row__title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #193640; font-size: 27rpx; font-weight: 700; }
.related-row__line { display: grid; grid-template-columns: 126rpx minmax(0, 1fr); gap: 10rpx; margin-top: 8rpx; color: #899ba2; font-size: 22rpx; }
.related-row__line text:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #506972; }
.related-row__arrow { color: #91a4ab; font-size: 36rpx; }
.related-row--pressed { transform: scale(.988); opacity: .82; }
.related-table__state { min-height: 150rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 13rpx; padding: 24rpx; color: #84969d; font-size: 23rpx; }
.related-table__error { color: #b44935; }
.related-table__link { color: #087fbf; font-weight: 650; }
.related-table__loading { padding: 10rpx 20rpx; }
.related-skeleton { padding: 20rpx 0; border-bottom: 1px solid #edf2f4; }
.related-skeleton view { width: 54%; height: 27rpx; border-radius: 5px; background: linear-gradient(90deg, #edf2f4 25%, #fafbfc 40%, #edf2f4 60%); background-size: 400% 100%; animation: mciRelatedShimmer 1.35s ease infinite; }
.related-skeleton view:last-child { width: 78%; height: 21rpx; margin-top: 15rpx; }
@keyframes mciRelatedEnter { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
@keyframes mciRelatedShimmer { from { background-position: 100% 0; } to { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) { .related-table, .related-skeleton view { animation: none; } }
</style>
