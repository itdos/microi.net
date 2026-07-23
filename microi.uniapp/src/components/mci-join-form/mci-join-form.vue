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
      <view v-if="loading" class="join-form__state"><text>正在读取关联配置...</text></view>
      <view v-else-if="error" class="join-form__state join-form__state--error"><text>{{ error }}</text></view>
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
  data() { return { table: null, expanded: false, loading: false, error: '' } },
  computed: {
    config() { return (this.field.config && this.field.config.JoinForm) || {} },
    hasConfiguration() { return Boolean(this.config.TableId || this.config.TableName) },
    configuredMode() { return this.config.FormMode || this.parentMode || 'View' },
    joinId() {
      return unwrapValue(this.config.JoinFieldName ? this.parentForm[this.config.JoinFieldName] : this.config.Id)
    },
    tableName() { return this.config.TableName || (this.table && this.table.Name) || '' },
    tableLabel() { return (this.table && (this.table.Description || this.table.Name)) || this.config.TableName || '关联业务信息' }
  },
  methods: {
    async toggleExpanded() {
      this.expanded = !this.expanded
      if (this.expanded && !this.tableName && this.config.TableId && !this.loading) await this.resolveTable()
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
.join-form__pressed { transform: scale(.988); opacity: .82; }
@keyframes mciJoinEnter { from { opacity: 0; transform: translateY(12rpx); } to { opacity: 1; transform: translateY(0); } }
@media (prefers-reduced-motion: reduce) { .join-form { animation: none; } }
</style>
