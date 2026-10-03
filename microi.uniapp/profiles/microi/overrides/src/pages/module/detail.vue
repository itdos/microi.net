<template>
  <mci-page-shell class="module-detail" :class="{ 'module-detail--with-actions': !loading && !error && row.Id }"
    :style="mciTokenStyle" :title="pageTitle" :subtitle="pageSubtitle" @back="goBack">
    <mci-skeleton v-if="loading" type="detail" :rows="8" />
    <view v-else-if="error" class="state-panel">
      <text class="state-panel__title">详情加载失败</text>
      <text class="state-panel__text">{{ error }}</text>
      <view class="mci-btn" @tap="loadDetail(true)">重新加载</view>
    </view>
    <view v-else class="detail-content">
      <view class="entity-hero" :class="{ 'entity-hero--compact': compactHero }">
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
          <view class="action-grid__icon" aria-hidden="true"><view /><view /><view /></view>
          <text>{{ action.Label }}</text>
        </view>
      </view>

      <view v-for="workflow in workflowBlocks" :key="workflow.key" class="workflow-card">
        <view class="workflow-card__head">
          <view class="workflow-card__icon" aria-hidden="true"><view /><view /><view /></view>
          <view>
            <text>{{ workflow.title }}</text>
            <text v-if="workflow.subtitle">{{ workflow.subtitle }}</text>
          </view>
        </view>
        <view class="workflow-card__steps">
          <view v-for="(item, index) in workflow.fields" :key="item.name" class="workflow-card__step">
            <view class="workflow-card__rail">
              <view class="workflow-card__dot" />
              <view v-if="index < workflow.fields.length - 1" class="workflow-card__line" />
            </view>
            <view class="workflow-card__step-copy">
              <text>{{ item.label || item.name }}</text>
              <text>{{ display(item.name, row[item.name]) }}</text>
            </view>
          </view>
        </view>
        <view v-if="workflow.actions.length" class="workflow-card__actions">
          <view v-for="action in workflow.actions" :key="action.Key" hover-class="action-grid__item--pressed" @tap="runAction(action)">
            <view class="workflow-card__action-icon" aria-hidden="true" />
            <text>{{ action.Label }}</text>
          </view>
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
          <view v-if="group.selectorTabs.length" class="detail-section__selector-grid">
            <mci-table-selector v-for="relatedTab in group.selectorTabs" :key="relatedTab.key"
              :field="relatedTab.field" :parent-table="config.table" :parent-id="rowId"
              :parent-form="row" :parent-menu-id="config.menuId" readonly compact />
          </view>
          <view v-for="field in group.fields" :key="field.Id || field.Name" class="detail-field">
            <text class="detail-field__label">{{ field.Label || field.Name }}</text>
            <view class="detail-field__value">
              <mci-native-field :model-value="row[field.Name]" :field="field" readonly :table-name="config.table" :form-data="row" :menu-id="config.menuId"
                :display-context="{ moduleTitle: config.title }" />
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
          parent-mode="View" display-mode="full" />
        <mci-join-form v-else-if="relatedTab.type === 'join'" :field="relatedTab.field"
          :parent-form="row" parent-mode="View" readonly />
        <mci-table-selector v-else-if="relatedTab.type === 'openTable'" :field="relatedTab.field"
          :parent-table="config.table" :parent-id="rowId" :parent-form="row" readonly />
        <mci-related-table v-else-if="relatedTab.type === 'joinTable'" :field="relatedTab.field"
          :parent-form="row" />
      </view>
      <view class="detail-bottom-space"></view>
    </view>
    <view v-if="!loading && !error && row.Id" class="detail-action-bar">
      <button class="edit-command" hover-class="edit-command--pressed" @tap="openEdit"><view class="edit-command__icon" aria-hidden="true" /><text>编辑</text></button>
    </view>
  </mci-page-shell>
</template>

<script>
import { themeMixin } from '@/utils/theme.js'
import { V8, getToken, getUser } from '@/utils/request.js'
import { formatFieldValue, openForm } from '@/platform/business-runtime.js'
import { normalizeUploadItems, publicAssetUrl } from '@/platform/display.js'
import { fieldDisplayValue, hydrateNativeFormOptions } from '@/platform/native-form.js'
import { loadModuleDefinition } from '@/platform/module-registry.js'
import { compileDetailPreset, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { hasExactMenuPermission } from '@/platform/menu-permission.js'
import { getTenantModuleRowActions } from '@/platform/module-extension.js'
import { loadViewMetricValues } from '@/platform/view-metrics.js'
import MciBusinessRelatedList from '@/components/mci-business-related-list/mci-business-related-list.vue'
import { userFacingFallback } from '@/platform/user-facing-display.mjs'

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
    pageSubtitle() {
      const subtitle = String(this.config.description || '').trim()
      const title = String(this.config.title || '').trim()
      return subtitle && !title.includes(subtitle) ? subtitle : ''
    },
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
    compactHero() {
      return !this.heroBackground && !this.heroMeta && !this.heroStatus && !this.metrics.length && !this.preset.imageField
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
      const user = getUser() || {}
      return [
        ...(this.preset.actions || []).filter((action) => isActionVisible(action, this.row)),
        ...getTenantModuleRowActions({
          tableName: this.config.table,
          menuId: this.config.menuId || this.menuId,
          user,
          canApprove: hasExactMenuPermission(this.config.menuId || this.menuId, ['审批'], user)
        }, this.row)
      ]
    },
    workflowBlocks() {
      return (this.preset.workflow || []).map((workflow) => ({
        ...workflow,
        fields: (workflow.fields || []).filter((field) => field && field.name),
        actions: (workflow.actions || []).filter((action) => isActionVisible(action, this.row))
      })).filter((workflow) => workflow.fields.length || workflow.actions.length)
    },
    groups() {
      const groups = this.config.definition?.relatedGroups || this.config.definition?.groups || []
      const activeGroups = this.formTabs.length
        ? groups.filter((group) => group.tabKey === this.activeFormTabKey)
        : groups
      return activeGroups.map((group) => ({
        ...group,
        relatedTabs: this.embeddedChildRelatedForGroup(group),
        selectorTabs: this.embeddedOpenTableRelatedForGroup(group)
      })).filter((group) => (group.fields || []).length || group.relatedTabs.length || group.selectorTabs.length)
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
      return this.activeRelatedTabs.filter((item) => !this.isEmbeddedRelated(item))
    }
  },
  onLoad(options) {
    this.menuId = decodeURIComponent(options.menuId || '')
    this.rowId = decodeURIComponent(options.id || '')
    if (!getToken()) {
      this.loading = false
      uni.redirectTo({ url: '/pages/login/index' })
      return
    }
    this.loadDetail()
  },
  methods: {
    isEmbeddedChildRelated(item) {
      return item?.type === 'child' && Boolean(item.field?.layoutGroupKey)
    },
    isEmbeddedOpenTableRelated(item) {
      return item?.type === 'openTable' && Boolean(item.field?.layoutGroupKey)
    },
    isEmbeddedRelated(item) {
      return this.isEmbeddedChildRelated(item) || this.isEmbeddedOpenTableRelated(item)
    },
    embeddedRelatedForGroup(group) {
      return this.activeRelatedTabs.filter((item) =>
        this.isEmbeddedRelated(item) && item.field.layoutGroupKey === group.key
      )
    },
    embeddedChildRelatedForGroup(group) {
      return this.embeddedRelatedForGroup(group).filter((item) => item.type === 'child')
    },
    embeddedOpenTableRelatedForGroup(group) {
      return this.embeddedRelatedForGroup(group).filter((item) => item.type === 'openTable')
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
        const displayFields = (this.config.definition?.fields || []).map((field) => field.Name).filter(Boolean)
        const [, metricValues] = await Promise.all([
          hydrateNativeFormOptions(this.config.definition, this.row, {
            eagerDropdowns: true,
            fieldNames: displayFields,
            pageSize: 100,
            maxPages: 5,
            menuId: this.config.menuId,
            moduleEngineKey: this.config.key,
            timeoutMs: 8000
          }),
          loadViewMetricValues(this.preset.metrics || [], {
            form: this.row,
            user: getUser() || {},
            menu: this.config.menu || { Id: this.config.menuId }
          })
        ])
        this.metricValues = metricValues
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
      return field ? fieldDisplayValue(field, value, { moduleTitle: this.config.title }) : userFacingFallback(value)
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
.edit-command { width: 100%; height: 82rpx; margin: 0; padding: 0; border: 0; border-radius: 8rpx; color: #fff; background: #e94b2c; font-size: 25rpx; font-weight: 700; line-height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 14rpx; transition: transform .15s ease; }
.edit-command::after { border: 0; }
.edit-command--pressed { transform: scale(.98); }
.edit-command__icon { position: relative; width: 27rpx; height: 27rpx; border: 3rpx solid currentColor; border-radius: 4rpx; box-sizing: border-box; }
.edit-command__icon::after { position: absolute; top: -6rpx; right: -5rpx; width: 15rpx; height: 5rpx; border: 3rpx solid currentColor; border-radius: 3rpx; background: #e94b2c; transform: rotate(-45deg); content: ''; }
.detail-content { padding-bottom: calc(128rpx + var(--mci-safe-bottom)); }
.detail-action-bar { position: fixed; right: var(--mci-safe-right, 0px); bottom: 0; left: var(--mci-safe-left, 0px); z-index: 30; min-height: calc(var(--mci-fixed-action-height, 128rpx) + var(--mci-safe-bottom)); padding: 16rpx 22rpx calc(16rpx + var(--mci-safe-bottom)); border-top: 1rpx solid #e5edef; background: #fff; box-sizing: border-box; }
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
.action-grid__icon { height: 40rpx; display: flex; align-items: flex-end; gap: 5rpx; color: #087da8; }
.action-grid__icon view { width: 7rpx; border-radius: 4rpx 4rpx 1rpx 1rpx; background: currentColor; }
.action-grid__icon view:nth-child(1) { height: 18rpx; }.action-grid__icon view:nth-child(2) { height: 34rpx; }.action-grid__icon view:nth-child(3) { height: 25rpx; }
.workflow-card { margin: 16rpx 18rpx 0; overflow: hidden; border: 1rpx solid #dce8eb; border-radius: 18rpx; background: #fff; box-shadow: 0 6rpx 18rpx rgba(17,74,101,.05); }
.workflow-card__head { min-height: 92rpx; padding: 18rpx 22rpx; display: flex; align-items: center; gap: 16rpx; border-bottom: 1rpx solid #e9f0f2; background: linear-gradient(110deg, rgba(8,125,168,.08), rgba(24,166,184,.025)); box-sizing: border-box; }
.workflow-card__head > view:last-child { min-width: 0; display: flex; flex-direction: column; }
.workflow-card__head > view:last-child text:first-child { font-size: 27rpx; font-weight: 720; }
.workflow-card__head > view:last-child text:last-child { margin-top: 3rpx; overflow: hidden; color: #7d9097; font-size: 20rpx; text-overflow: ellipsis; white-space: nowrap; }
.workflow-card__icon { flex: none; width: 48rpx; height: 48rpx; display: flex; flex-direction: column; align-items: center; justify-content: space-between; }
.workflow-card__icon view { width: 12rpx; height: 12rpx; border: 3rpx solid #087da8; border-radius: 50%; box-sizing: border-box; }
.workflow-card__icon view + view { position: relative; }
.workflow-card__icon view + view::before { position: absolute; left: 2rpx; bottom: 9rpx; width: 3rpx; height: 10rpx; background: #91c9d6; content: ''; }
.workflow-card__steps { padding: 20rpx 22rpx 4rpx; }
.workflow-card__step { min-height: 74rpx; display: grid; grid-template-columns: 32rpx minmax(0, 1fr); gap: 12rpx; }
.workflow-card__rail { position: relative; display: flex; flex-direction: column; align-items: center; }
.workflow-card__dot { position: relative; z-index: 1; width: 18rpx; height: 18rpx; margin-top: 7rpx; border: 5rpx solid #d9f0f4; border-radius: 50%; background: #087da8; box-sizing: border-box; }
.workflow-card__line { width: 3rpx; flex: 1; min-height: 42rpx; background: #dbe9ed; }
.workflow-card__step-copy { min-width: 0; padding-bottom: 18rpx; display: flex; flex-direction: column; }
.workflow-card__step-copy text:first-child { color: #7f939a; font-size: 21rpx; }
.workflow-card__step-copy text:last-child { margin-top: 5rpx; overflow-wrap: anywhere; color: #294750; font-size: 25rpx; line-height: 35rpx; }
.workflow-card__actions { padding: 14rpx 18rpx 18rpx; display: flex; flex-wrap: wrap; gap: 12rpx; border-top: 1rpx solid #e9f0f2; }
.workflow-card__actions > view { min-height: 88rpx; padding: 0 20rpx; display: flex; align-items: center; gap: 10rpx; border: 1rpx solid rgba(8,125,168,.26); border-radius: 11rpx; color: #087da8; background: rgba(8,125,168,.06); font-size: 22rpx; }
.workflow-card__action-icon { width: 18rpx; height: 10rpx; border-left: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(-45deg) translateY(-2rpx); }
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
.detail-section__selector-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14rpx; padding: 18rpx 0; border-bottom: 1px solid #e5eef1; background: linear-gradient(180deg, #f8fbfc, #fbfdfd); }
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

<style scoped>
/* Microi Blue Suite detail: branded identity, calm information groups and one clear action. */
.module-detail { background: var(--mci-app-canvas, #f8fafc); }
.module-detail--with-actions { height: 100vh; min-height: 100vh; overflow: hidden; }
.module-detail--with-actions :deep(.mci-page-shell__body) { height: calc(100vh - var(--mci-header-height, 44px) - 1rpx - var(--mci-fixed-action-height, 128rpx) - var(--mci-safe-bottom)); min-height: 0; overflow-x: hidden; overflow-y: auto; -webkit-overflow-scrolling: touch; }
.detail-content { padding: 16rpx 22rpx 0; }
.entity-hero { min-height: 212rpx; margin: 0; border: 0; border-radius: 28rpx; background: linear-gradient(135deg, var(--mci-color-primary-dark, #1749b6), var(--mci-color-primary, #2563eb), var(--mci-color-primary-light, #5b8cff)); box-shadow: 0 16rpx 38rpx rgba(37,99,235,.18); }
.entity-hero--compact { min-height: 136rpx; }
.entity-hero--compact .entity-hero__main { min-height: 136rpx; padding-top: 20rpx; padding-bottom: 20rpx; box-sizing: border-box; }
.entity-hero--compact .entity-hero__icon { width: 70rpx; height: 70rpx; }
.entity-hero::before { display: none; }
.entity-hero__background { opacity: .1; filter: none; }
.entity-hero__shade { background: linear-gradient(100deg, rgba(23,73,182,.9), rgba(37,99,235,.7)); }
.entity-hero__main { padding: 26rpx 24rpx 18rpx; }
.entity-hero__icon { width: 78rpx; height: 78rpx; border: 1rpx solid rgba(255,255,255,.3); border-radius: 18rpx; background: rgba(255,255,255,.16); }
.entity-hero__title { font-size: 31rpx; font-weight: 780; }
.entity-hero__meta { color: rgba(255,255,255,.76); font-size: 24rpx; }
.entity-hero__status { border: 1rpx solid rgba(255,255,255,.32); border-radius: 12rpx; color: #fff; background: rgba(255,255,255,.14); }
.entity-hero__status, .metric-strip text:last-child { font-size: 22rpx; }
.metric-strip { padding: 0 22rpx 20rpx; border-top-color: rgba(255,255,255,.16); }
.metric-strip > view { padding-top: 14rpx; border-right-color: rgba(255,255,255,.18); }
.metric-strip > view text:first-child { font-size: 28rpx; }
.action-grid { gap: 12rpx; margin: 16rpx 0; padding: 14rpx; overflow: hidden; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.action-grid > view { min-height: 90rpx; border: 0; border-radius: 18rpx; color: var(--mci-color-primary, #2563eb); background: var(--mci-color-primary-faint, #eff6ff); }
.action-grid__item--pressed { background: var(--mci-color-primary-soft, #dbeafe); }
.workflow-card, .detail-section, .related-tab-panel { margin: 0 0 16rpx; overflow: hidden; border: 1rpx solid var(--mci-divider, #e5e7eb); border-radius: 24rpx; background: #fff; box-shadow: var(--mci-shadow-card, 0 8rpx 28rpx rgba(15,23,42,.06)); }
.workflow-card__head, .detail-section__header { min-height: 92rpx; border-bottom-color: var(--mci-divider, #e5e7eb); }
.workflow-card__head > view:last-child text:last-child,
.workflow-card__step-copy text:first-child,
.detail-section__copy text:last-child:not(:first-child),
.detail-section__header > view text:last-child { font-size: 22rpx; line-height: 30rpx; }
.workflow-card__dot { background: var(--mci-color-primary, #2563eb); }
.workflow-card__line { background: var(--mci-divider, #e5e7eb); }
.detail-section__bar { width: 5rpx; height: 34rpx; border-radius: 6rpx; background: var(--mci-color-primary, #2563eb); }
.detail-section__copy > text:first-child { color: var(--mci-text-primary, #111827); font-weight: 750; }
.detail-field { min-height: 84rpx; border-bottom-color: var(--mci-divider, #e5e7eb); }
.detail-field__label { color: var(--mci-text-secondary, #667280); }
.detail-field__value { color: var(--mci-text-primary, #111827); }
.detail-action-bar { padding: 12rpx 22rpx calc(12rpx + var(--mci-safe-bottom)); border-top-color: var(--mci-divider, #e5e7eb); background: rgba(255,255,255,.98); box-shadow: 0 -8rpx 28rpx rgba(15,23,42,.08); }
.edit-command { min-height: 88rpx; border-radius: 18rpx; background: var(--mci-color-primary, #2563eb); box-shadow: none; }
.edit-command__icon::after { background: var(--mci-color-primary, #2563eb); }
</style>
