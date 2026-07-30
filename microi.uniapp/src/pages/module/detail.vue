<template>
  <mci-page-shell class="module-detail" :style="mciTokenStyle" :title="pageTitle" :subtitle="config.description || ''" @back="goBack">
    <template #right>
      <button v-if="!loading && !error && row.Id" class="edit-command" @tap="openEdit">编辑</button>
    </template>
    <mci-skeleton v-if="loading" type="detail" :rows="8" />
    <view v-else-if="error" class="state-panel">
      <text class="state-panel__title">详情加载失败</text>
      <text class="state-panel__text">{{ error }}</text>
      <view class="mci-btn" @tap="loadDetail(true)">重新加载</view>
    </view>
    <view v-else class="detail-content">
      <view class="entity-hero">
        <image v-if="heroBackground" class="entity-hero__background" :src="heroBackground" mode="aspectFill" />
        <view class="entity-hero__shade"></view>
        <view class="entity-hero__main">
          <image class="entity-hero__icon" :src="heroImage" mode="aspectFill" />
          <view class="entity-hero__copy">
            <text class="entity-hero__title">{{ heroTitle }}</text>
            <text v-if="heroMeta" class="entity-hero__meta">{{ heroMeta }}</text>
          </view>
          <text v-if="heroStatus" class="entity-hero__status">{{ heroStatus }}</text>
        </view>
        <view v-if="metrics.length" class="metric-strip">
          <view v-for="metric in metrics" :key="metric.key">
            <text>{{ metric.value }}</text><text>{{ metric.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="actions.length" class="action-grid">
        <view v-for="action in actions" :key="action.Key" hover-class="action-grid__item--pressed"
          @tap="runAction(action)">
          <text class="action-grid__icon">{{ action.Icon || '⌁' }}</text>
          <text>{{ action.Label }}</text>
        </view>
      </view>

      <mci-related-tabs v-if="formTabs.length > 1" :items="formTabs" :active-key="activeFormTabKey"
        @select="selectFormTab" />

      <view v-for="(group, index) in groups" :key="group.key || group.name + index"
        class="detail-section mci-fade-up"
        :class="{ 'detail-section--ungrouped': group.source === 'Ungrouped' }"
        :style="{ animationDelay: `${Math.min(index, 6) * 45}ms` }">
        <view v-if="group.source === 'CollapseGroup'" class="detail-section__header" @tap="toggleGroup(group, index)">
          <view>
            <text class="detail-section__bar"></text>
            <view class="detail-section__copy">
              <text>{{ group.name }}</text>
              <text v-if="group.description">{{ group.description }}</text>
            </view>
            <text v-if="group.showFieldCount !== false">{{ group.fields.length }} 项</text>
          </view>
          <text>{{ expanded[index] ? '⌃' : '⌄' }}</text>
        </view>
        <view v-if="group.source === 'Ungrouped' || expanded[index]" class="detail-section__body">
          <view v-for="field in group.fields" :key="field.Id || field.Name" class="detail-field">
            <text class="detail-field__label">{{ field.Label || field.Name }}</text>
            <view class="detail-field__value">
              <mci-native-field :model-value="row[field.Name]" :field="field" readonly :table-name="config.table" />
            </view>
          </view>
          <mci-business-related-list
            v-for="relatedTab in group.relatedTabs"
            :key="relatedTab.key"
            class="detail-section__related-preview"
            :field="relatedTab.field"
            :parent-id="rowId"
            :parent-form="row"
            :parent-menu-id="config.menuId"
            :parent-table-id="config.definition && config.definition.table ? config.definition.table.Id : ''"
            parent-mode="View"
            display-mode="preview"
            :preview-limit="2"
          />
        </view>
      </view>
      <view v-for="relatedTab in standaloneRelatedTabs" :key="relatedTab.key" class="related-tab-panel">
        <mci-business-related-list v-if="relatedTab.type === 'child'" :field="relatedTab.field"
          :parent-id="rowId" :parent-form="row" :parent-menu-id="config.menuId"
          :parent-table-id="config.definition && config.definition.table ? config.definition.table.Id : ''"
          parent-mode="View" />
        <mci-join-form v-else-if="relatedTab.type === 'join'" :field="relatedTab.field"
          :parent-form="row" parent-mode="View" readonly />
        <mci-table-selector v-else-if="relatedTab.type === 'openTable'" :field="relatedTab.field"
          :parent-table="config.table" :parent-id="rowId" :parent-form="row" readonly />
        <mci-related-table v-else-if="relatedTab.type === 'joinTable'" :field="relatedTab.field"
          :parent-form="row" />
      </view>
      <view class="detail-bottom-space"></view>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getUser } from '@/utils/request.js'
import { formatFieldValue, openForm } from '@/platform/business-runtime.js'
import { normalizeUploadItems, publicAssetUrl } from '@/platform/display.js'
import { fieldDisplayValue } from '@/platform/native-form.js'
import { loadModuleDefinition } from '@/platform/module-registry.js'
import { compileDetailPreset, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { loadViewMetricValues } from '@/platform/view-metrics.js'
import MciBusinessRelatedList from '@/components/mci-business-related-list/mci-business-related-list.vue'

export default {
  components: { MciBusinessRelatedList },
  mixins: [themeMixin],
  data() {
    return {
      menuId: '',
      rowId: '',
      config: {},
      row: {},
      preset: {},
      loading: true,
      error: '',
      expanded: {},
      activeFormTabKey: '',
      actionRunning: false,
      metricValues: {}
    }
  },
  computed: {
    pageTitle() { return this.config.title ? `${this.config.title}详情` : '业务详情' },
    heroTitle() {
      const field = this.preset.titleField || this.config.titleField
      return field && this.row[field] ? this.display(field, this.row[field]) : this.pageTitle
    },
    heroMeta() {
      const field = this.preset.metaField
      return field && this.row[field] ? this.display(field, this.row[field]) : ''
    },
    heroStatus() {
      const field = this.preset.statusField || this.config.statusField
      return field && this.row[field] ? this.display(field, this.row[field]) : ''
    },
    heroBackground() {
      return this.preset.background ? publicAssetUrl(this.preset.background) : ''
    },
    heroImage() {
      const field = this.preset.imageField
      const upload = field ? normalizeUploadItems(this.row[field])[0] : null
      return upload && upload.Path ? publicAssetUrl(upload.Path) : (this.preset.icon || this.config.icon || '/static/microi-blue-256.png')
    },
    metrics() {
      return (this.preset.metrics || []).map((metric) => {
        const key = metric.key || metric.field || metric.apiEngineKey
        const remote = String(metric.source || '').toLowerCase() === 'apiengine'
        const rawValue = remote ? this.metricValues[key] : this.row[metric.field]
        const formatted = formatFieldValue(rawValue, metric.format)
        return {
          key,
          label: metric.label || metric.field,
          value: formatted === '-' ? '-' : `${formatted}${metric.suffix || ''}`
        }
      }).filter((item) => item.value && item.value !== '-')
    },
    actions() {
      return (this.preset.actions || []).filter((action) => isActionVisible(action, this.row))
    },
    groups() {
      const groups = this.config.definition?.relatedGroups || this.config.definition?.groups || []
      const activeGroups = this.formTabs.length
        ? groups.filter((group) => group.tabKey === this.activeFormTabKey)
        : groups
      return activeGroups.map((group) => ({
        ...group,
        relatedTabs: this.embeddedChildRelatedForGroup(group)
      })).filter((group) => (group.fields || []).length || group.relatedTabs.length)
    },
    formTabs() {
      return (this.config.definition?.formTabs || []).map((tab) => ({
        ...tab,
        label: tab.name
      }))
    },
    related() {
      const definition = this.config.definition || {}
      return {
        childFields: definition.childFields || [],
        joinFields: definition.joinFields || [],
        openTableFields: definition.openTableFields || [],
        joinTableFields: definition.joinTableFields || []
      }
    },
    relatedTabs() {
      const toTabs = (fields, type) => fields.map((field) => ({
        key: `${type}:${field.Id || field.Name}`,
        label: field.Label || field.Name || '关联业务',
        type,
        field
      }))
      return [
        ...toTabs(this.related.childFields, 'child'),
        ...toTabs(this.related.joinFields, 'join'),
        ...toTabs(this.related.openTableFields, 'openTable'),
        ...toTabs(this.related.joinTableFields, 'joinTable')
      ]
    },
    activeRelatedTabs() {
      if (!this.formTabs.length) return this.relatedTabs
      return this.relatedTabs.filter((item) => item.field.formTabKey === this.activeFormTabKey)
    },
    standaloneRelatedTabs() {
      return this.activeRelatedTabs.filter((item) => !this.isEmbeddedChildRelated(item))
    }
  },
  onLoad(options) {
    this.menuId = decodeURIComponent(options.menuId || '')
    this.rowId = decodeURIComponent(options.id || '')
    this.loadDetail()
  },
  methods: {
    isEmbeddedChildRelated(item) {
      return item?.type === 'child' && Boolean(item.field?.layoutGroupKey)
    },
    embeddedChildRelatedForGroup(group) {
      return this.activeRelatedTabs.filter((item) =>
        this.isEmbeddedChildRelated(item) && item.field.layoutGroupKey === group.key
      )
    },
    async loadDetail(refresh = false) {
      this.loading = true
      this.error = ''
      try {
        this.config = await loadModuleDefinition(this.menuId, refresh)
        const [rowResult, manifest] = await Promise.all([
          V8.FormEngine.GetFormData(this.config.table, {
            Id: this.rowId,
            _SysMenuId: this.config.menuId
          }),
          loadModuleViewManifest(this.config, {
            scene: 'Detail',
            device: 'Mobile',
            user: getUser() || {},
            refresh
          })
        ])
        if (!rowResult || Number(rowResult.Code) !== 1) {
          throw new Error(rowResult && rowResult.Msg || '数据不存在或无权访问')
        }
        this.row = rowResult.Data || {}
        this.preset = compileDetailPreset(manifest) || {}
        this.metricValues = await loadViewMetricValues(this.preset.metrics || [], {
          form: this.row,
          user: getUser() || {},
          menu: this.config.menu || { Id: this.config.menuId }
        })
        this.expanded = {}
        this.$nextTick(() => {
          this.initializeFormTabs()
          this.groups.forEach((group, index) => {
            this.expanded[index] = group.source === 'Ungrouped' || group.defaultExpanded !== false
          })
        })
      } catch (error) {
        this.error = error.message || '详情加载失败'
      } finally {
        this.loading = false
      }
    },
    field(name) {
      return (this.config.definition?.fields || []).find((field) => field.Name === name)
    },
    display(name, value) {
      const field = this.field(name)
      return field ? fieldDisplayValue(field, value) : String(value ?? '-')
    },
    toggleGroup(group, index) {
      if (!group || group.source !== 'CollapseGroup') return
      this.expanded[index] = !this.expanded[index]
    },
    initializeFormTabs() {
      if (!this.formTabs.some((item) => item.key === this.activeFormTabKey)) {
        this.activeFormTabKey = this.formTabs[0]?.key || ''
      }
    },
    selectFormTab(tab) {
      if (!tab || !tab.key) return
      this.activeFormTabKey = tab.key
      this.expanded = {}
      this.$nextTick(() => {
        this.groups.forEach((group, index) => {
          this.expanded[index] = group.source === 'Ungrouped' || group.defaultExpanded !== false
        })
      })
    },
    async runAction(action) {
      if (this.actionRunning) return
      this.actionRunning = true
      try {
        await executeViewAction(action, {
          form: this.row,
          user: getUser() || {},
          menu: this.config.menu || {},
          tableName: this.config.table,
          refresh: () => this.loadDetail(true)
        })
      } finally {
        this.actionRunning = false
      }
    },
    openEdit() {
      openForm({
        table: this.config.table,
        rowId: this.rowId,
        mode: 'Edit',
        title: `编辑${this.config.title}`,
        menuId: this.config.menuId,
        menuAliases: this.config.menuAliases
      })
    },
    goBack() {
      uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/workspace/index' }) })
    }
  }
}
</script>

<style scoped>
.module-detail { min-height: 100vh; background: #f4f8fa; }
.edit-command { width: 70rpx; height: 58rpx; margin: 0; padding: 0; border: 0; border-radius: 6rpx; color: #087fbd; background: #edf7fa; font-size: 22rpx; font-weight: 700; line-height: 58rpx; }
.edit-command::after { border: 0; }
.detail-content { padding-bottom: calc(32rpx + var(--mci-safe-bottom)); }
.entity-hero { position: relative; min-height: 280rpx; overflow: hidden; color: #fff; background: #064b69; }
.entity-hero__background { position: absolute; inset: 0; width: 100%; height: 100%; }
.entity-hero__shade { position: absolute; inset: 0; background: linear-gradient(105deg, rgba(3, 43, 63, .96), rgba(5, 88, 105, .72)); }
.entity-hero__main { position: relative; z-index: 1; display: flex; align-items: center; gap: 20rpx; padding: 34rpx 28rpx 24rpx; }
.entity-hero__icon { flex: 0 0 auto; width: 94rpx; height: 94rpx; border: 5rpx solid rgba(255, 255, 255, .76); border-radius: 8px; background: #fff; }
.entity-hero__copy { min-width: 0; display: flex; flex: 1; flex-direction: column; gap: 8rpx; }
.entity-hero__title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 34rpx; font-weight: 800; }
.entity-hero__meta { overflow: hidden; opacity: .82; text-overflow: ellipsis; white-space: nowrap; font-size: 24rpx; }
.entity-hero__status { flex: 0 0 auto; align-self: flex-start; padding: 9rpx 14rpx; border-radius: 6px; background: rgba(229, 70, 37, .88); font-size: 21rpx; }
.metric-strip { position: relative; z-index: 1; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0 24rpx 28rpx; }
.metric-strip > view { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 5rpx; border-right: 1px solid rgba(255, 255, 255, .2); }
.metric-strip > view:last-child { border-right: 0; }
.metric-strip text:first-child { overflow: hidden; width: 100%; text-align: center; text-overflow: ellipsis; white-space: nowrap; font-size: 29rpx; font-weight: 750; }
.metric-strip text:last-child { opacity: .72; font-size: 21rpx; }
.action-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8rpx; padding: 20rpx 18rpx; background: #fff; }
.action-grid > view { min-width: 0; display: flex; flex-direction: column; align-items: center; gap: 8rpx; padding: 10rpx 2rpx; color: #35525c; font-size: 22rpx; transition: transform .16s ease; }
.action-grid__item--pressed { transform: scale(.96); }
.action-grid__icon { color: #087da8; font-size: 36rpx; }
.related-tab-panel { margin-top: 14rpx; background: #fff; }
.detail-section { margin-top: 16rpx; border-top: 1px solid #e5edef; border-bottom: 1px solid #e5edef; background: #fff; }
.detail-section__header { min-height: 86rpx; display: flex; align-items: center; justify-content: space-between; padding: 0 26rpx; color: #17313b; font-size: 28rpx; font-weight: 750; }
.detail-section__header > view { display: flex; align-items: center; gap: 12rpx; }
.detail-section__bar { width: 7rpx; height: 32rpx; border-radius: 4rpx; background: linear-gradient(180deg, #e54625, #ff7b42); }
.detail-section__copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 4rpx; }
.detail-section__copy text:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detail-section__copy text:last-child:not(:first-child) { overflow: hidden; color: #94a3a8; font-size: 20rpx; font-weight: 400; text-overflow: ellipsis; white-space: nowrap; }
.detail-section__header > view text:last-child { color: #94a3a8; font-size: 20rpx; font-weight: 500; }
.detail-section__header > text { color: #81969d; font-size: 26rpx; }
.detail-section__body { padding: 0 26rpx; }
.detail-field { display: grid; grid-template-columns: 190rpx minmax(0, 1fr); gap: 20rpx; align-items: start; padding: 20rpx 0; border-top: 1px solid #edf2f4; }
.detail-field__label { color: #82949b; font-size: 24rpx; line-height: 1.6; }
.detail-field__value { min-width: 0; color: #294750; font-size: 25rpx; line-height: 1.6; overflow-wrap: anywhere; }
.detail-field__value :deep(.native-control--readonly) { min-height: auto; padding: 0; border: 0; background: transparent; }
.detail-bottom-space { height: calc(40rpx + var(--mci-safe-bottom)); }
.state-panel { min-height: 62vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14rpx; padding: 40rpx; text-align: center; }
.state-panel__title { color: #17313b; font-size: 31rpx; font-weight: 750; }
.state-panel__text { color: #7b8f97; font-size: 24rpx; }
.state-panel .mci-btn { min-width: 220rpx; margin-top: 12rpx; }
@media (prefers-reduced-motion: reduce) { .action-grid > view { transition: none; } }
</style>
