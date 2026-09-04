<template>
  <view v-if="hasConfiguration" class="join-form mci-fade-up">
    <view class="join-form__heading" hover-class="join-form__pressed" @tap="toggleExpanded">
      <view class="join-form__bar"></view>
      <view class="join-form__copy">
        <text class="join-form__title">{{ field.Label || '关联表单' }}</text>
        <text class="join-form__subtitle">{{ tableLabel }}</text>
      </view>
      <text class="join-form__arrow" :class="{ expanded }">›</text>
    </view>
    <view v-if="expanded">
      <view v-if="loading || snapshotLoading" class="join-form__state"><text>{{ snapshotLoading ? '正在读取物联网快照...' : '正在读取关联配置...' }}</text></view>
      <view v-else-if="snapshotError" class="join-form__state join-form__state--error"><text>{{ snapshotError }}</text></view>
      <view v-else-if="error" class="join-form__state join-form__state--error"><text>{{ error }}</text></view>
      <view v-else-if="usesSnapshot" class="join-form__snapshot">
        <view class="join-form__notice" :class="`join-form__notice--${snapshotStatus}`"><text>{{ snapshotMessage }}</text></view>
        <view v-for="section in snapshotSections" :key="section.Name" class="join-form__section">
          <text class="join-form__section-title">{{ section.Name }}</text>
          <view class="join-form__grid">
            <view v-for="item in section.Fields" :key="`${section.Name}:${item.Label}`" class="join-form__metric">
              <text class="join-form__metric-label">{{ item.Label }}</text>
              <text class="join-form__metric-value" :class="`join-form__metric-value--${item.Tone || 'default'}`">{{ item.Value }}{{ item.Value !== '--' ? item.Unit || '' : '' }}</text>
            </view>
          </view>
        </view>
        <view v-if="joinId && tableName" class="join-form__action join-form__action--compact" hover-class="join-form__pressed" @tap="openRelated">
          <text class="join-form__action-hint">查看后台完整设备快照</text><text class="join-form__button">打开</text>
        </view>
      </view>
      <view v-else-if="joinId" class="join-form__action" hover-class="join-form__pressed" @tap="openRelated">
        <view>
          <text class="join-form__action-title">{{ readonly ? '查看关联信息' : '维护关联信息' }}</text>
          <text class="join-form__action-hint">字段配置变更后会自动应用</text>
        </view>
        <text class="join-form__button">打开</text>
      </view>
      <view v-else-if="configuredMode === 'Add' && !readonly" class="join-form__action" hover-class="join-form__pressed" @tap="openRelated">
        <view>
          <text class="join-form__action-title">新增关联信息</text>
          <text class="join-form__action-hint">保存后再回到当前表单继续填写</text>
        </view>
        <text class="join-form__button">新增</text>
      </view>
      <view v-else class="join-form__state"><text>当前记录尚未关联数据</text></view>
    </view>
  </view>
</template>

<script>
import { openForm } from '@/platform/business-runtime.js'
import { loadNativeTableModel } from '@/platform/native-form.js'
import { V8 } from '@/utils/request.js'

function unwrapValue(value) {
  if (value && typeof value === 'object') return value.Id ?? value.Value ?? value.value ?? ''
  return value ?? ''
}

export default {
  name: 'MciJoinForm',
  props: {
    field: { type: Object, required: true },
    parentForm: { type: Object, default: () => ({}) },
    parentMode: { type: String, default: 'View' },
    readonly: { type: Boolean, default: false }
  },
  data() { return { table: null, expanded: false, loading: false, error: '', snapshotLoading: false, snapshot: null, snapshotError: '' } },
  computed: {
    config() { return (this.field.config && this.field.config.JoinForm) || {} },
    snapshotApiEngineKey() { return String(this.config.SnapshotApiEngineKey || '') },
    usesSnapshot() { return Boolean(this.snapshotApiEngineKey) },
    hasConfiguration() { return Boolean(this.config.TableId || this.config.TableName || this.snapshotApiEngineKey) },
    configuredMode() { return this.config.FormMode || this.parentMode || 'View' },
    joinId() {
      return unwrapValue(this.config.JoinFieldName ? this.parentForm[this.config.JoinFieldName] : this.config.Id)
    },
    tableName() { return this.config.TableName || (this.table && this.table.Name) || '' },
    tableLabel() { return (this.table && (this.table.Description || this.table.Name)) || this.config.TableLabel || this.config.TableName || '关联业务信息' },
    snapshotSections() { return this.snapshot && Array.isArray(this.snapshot.Sections) ? this.snapshot.Sections : [] },
    snapshotMessage() { return this.snapshot && this.snapshot.Message ? this.snapshot.Message : '尚无可展示的关联数据。' },
    snapshotStatus() { return this.snapshot && this.snapshot.DataStatus ? this.snapshot.DataStatus : 'empty' }
  },
  async mounted() {
    if (!this.usesSnapshot) return
    this.expanded = true
    if (!this.tableName && this.config.TableId) await this.resolveTable()
    await this.loadSnapshot()
  },
  methods: {
    async toggleExpanded() {
      this.expanded = !this.expanded
      if (!this.expanded) return
      if (!this.tableName && this.config.TableId && !this.loading) await this.resolveTable()
      if (this.usesSnapshot && !this.snapshot && !this.snapshotLoading) await this.loadSnapshot()
    },
    async loadSnapshot() {
      const parentId = unwrapValue(this.parentForm && this.parentForm.Id)
      if (!parentId) {
        this.snapshotError = '请先保存主表记录后再查看关联信息'
        return
      }
      this.snapshotLoading = true
      this.snapshotError = ''
      try {
        const result = await V8.ApiEngine.Run(this.snapshotApiEngineKey, { ParentId: parentId })
        if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '关联快照读取失败')
        this.snapshot = result.Data || { Sections: [], Message: result.Msg || '' }
      } catch (error) {
        this.snapshotError = error.message || error.Msg || '关联快照读取失败'
      } finally {
        this.snapshotLoading = false
      }
    },
    async resolveTable() {
      if (this.config.TableName) return
      this.loading = true
      this.error = ''
      try {
        this.table = await loadNativeTableModel(this.config.TableId)
      } catch (error) {
        this.error = error.message || error.Msg || '关联表配置读取失败'
      } finally {
        this.loading = false
      }
    },
    async openRelated() {
      if (!this.tableName && this.config.TableId) await this.resolveTable()
      if (!this.tableName) return
      const mode = this.joinId ? (this.readonly ? 'View' : 'Edit') : 'Add'
      openForm({
        table: this.tableName,
        rowId: this.joinId,
        mode,
        title: `${mode === 'Add' ? '新增' : mode === 'Edit' ? '维护' : '查看'}${this.field.Label || this.tableLabel}`,
        includeRelated: false
      })
    }
  }
}
</script>

<style scoped>
.join-form { margin: 0 22rpx 20rpx; border: 1px solid var(--mci-border, #e4ecef); border-radius: 8px; background: var(--mci-bg-card, #fff); overflow: hidden; animation: mciJoinEnter .3s ease both; }
.join-form__heading { min-height: 86rpx; display: grid; grid-template-columns: 7rpx minmax(0, 1fr) 30rpx; align-items: center; gap: 14rpx; padding: 0 22rpx; border-bottom: 1px solid #e9f0f2; }
.join-form__bar { width: 7rpx; height: 30rpx; border-radius: 4rpx; background: linear-gradient(180deg, #0b86d4, #20b6b2); }
.join-form__copy { min-width: 0; display: flex; align-items: baseline; gap: 12rpx; }
.join-form__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #17313b; font-size: 29rpx; font-weight: 700; }
.join-form__subtitle { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #8a9ca3; font-size: 21rpx; }
.join-form__arrow { color: #91a4ab; font-size: 38rpx; transform: rotate(90deg); transition: transform .18s ease; }
.join-form__arrow.expanded { transform: rotate(-90deg); }
.join-form__action { min-height: 116rpx; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 18rpx 22rpx; transition: transform .16s ease, opacity .16s ease; }
.join-form__action-title, .join-form__action-hint { display: block; }
.join-form__action-title { color: #31505b; font-size: 25rpx; font-weight: 650; }
.join-form__action-hint { margin-top: 7rpx; color: #8b9da4; font-size: 21rpx; }
.join-form__button { flex: none; min-width: 92rpx; height: 52rpx; display: flex; align-items: center; justify-content: center; border: 1px solid #a9d7e8; border-radius: 6px; color: #087fbf; background: #effaff; font-size: 23rpx; font-weight: 650; }
.join-form__state { min-height: 104rpx; display: flex; align-items: center; justify-content: center; padding: 20rpx; color: #84969d; font-size: 23rpx; }
.join-form__state--error { color: #b44935; }
.join-form__snapshot { padding: 18rpx 22rpx 6rpx; }
.join-form__notice { margin-bottom: 18rpx; padding: 14rpx 16rpx; border-radius: 6rpx; background: #eef7fa; color: #426b79; font-size: 21rpx; line-height: 1.5; }
.join-form__notice--unbound, .join-form__notice--pending-binding, .join-form__notice--bound { background: #fff8e8; color: #80632e; }
.join-form__section { margin-bottom: 20rpx; }
.join-form__section-title { display: block; margin-bottom: 10rpx; color: #2f505c; font-size: 23rpx; font-weight: 700; }
.join-form__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10rpx; }
.join-form__metric { min-width: 0; padding: 14rpx 16rpx; border: 1rpx solid #e5edf0; border-radius: 6rpx; background: #f8fafb; }
.join-form__metric-label, .join-form__metric-value { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.join-form__metric-label { color: #84969d; font-size: 19rpx; }
.join-form__metric-value { margin-top: 5rpx; color: #294752; font-size: 24rpx; font-weight: 650; }
.join-form__metric-value--success { color: #168557; }
.join-form__metric-value--warning { color: #b56b16; }
.join-form__metric-value--muted { color: #82939a; }
.join-form__action--compact { min-height: 82rpx; margin: 0 -2rpx; padding: 8rpx 0 12rpx; border-top: 1rpx solid #edf2f4; }
.join-form__pressed { transform: scale(.988); opacity: .82; }
@keyframes mciJoinEnter { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .join-form { animation: none; } }
</style>
