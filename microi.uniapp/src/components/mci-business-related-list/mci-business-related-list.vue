<template>
  <view class="related-business-list" :class="{
    'related-business-list--preview': isPreview,
    'related-business-list--section': isPreview && showPreviewHeader,
    'related-business-list--independent-scroll': independentScroll && !isPreview,
    'related-business-list--collection': isCollectionCardLayout
  }" :style="independentRootStyle">
    <view v-if="isPreview && showPreviewHeader" class="preview-section-header"
      hover-class="preview-section-header--pressed" @tap="previewExpanded = !previewExpanded">
      <view class="preview-section-header__main">
        <text class="preview-section-header__bar"></text>
        <text class="preview-section-header__title">{{ sectionTitle }}</text>
        <text v-if="!loading" class="preview-section-header__count">{{ count }} 项</text>
      </view>
      <!-- zhy：关联区折叠图标与详情“基本信息”分组统一，避免使用字形不稳定的上下箭头。 -->
      <text class="preview-section-header__arrow" :class="{ expanded: previewExpanded }">›</text>
    </view>

    <view v-if="isCollectionCardLayout" class="collection-heading">
      <view class="collection-heading__title"><text>{{ presentation.title || sectionTitle }}</text><text>{{ count }}</text></view>
      <button v-if="canAdd" class="collection-heading__add" hover-class="collection-heading__add--pressed" @tap="openAdd">
        <text>＋</text><text>{{ presentation.addLabel || '添加' }}</text>
      </button>
    </view>

    <view v-if="latestSummaryEnabled && (latestSummaryLoading || latestSummaryError || latestSummaryRow)"
      class="latest-record-summary">
      <view class="latest-record-summary__head">
        <text>{{ config.latestRecordSummary.title }}</text>
        <button v-if="latestSummaryRow && !latestSummaryLoading" class="latest-record-summary__detail"
          hover-class="latest-record-summary__detail--pressed" @tap="openDetail(latestSummaryRow)">
          <text>查看详情</text><text aria-hidden="true">›</text>
        </button>
      </view>
      <view v-if="latestSummaryLoading" class="latest-record-summary__skeleton">
        <view v-for="index in 4" :key="index"></view>
      </view>
      <view v-else-if="latestSummaryError" class="latest-record-summary__error">
        <text>{{ latestSummaryError }}</text>
        <button @tap="refreshData">重试</button>
      </view>
      <view v-else class="latest-record-summary__fields">
        <view v-for="item in config.latestRecordSummary.fields" :key="item.field" class="latest-record-summary__field">
          <text class="latest-record-summary__label">{{ item.label }}</text>
          <text class="latest-record-summary__value">{{ latestSummaryValue(item) }}</text>
        </view>
      </view>
    </view>

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

    <view v-if="!isPreview && relatedMetrics.length" class="related-metrics">
      <view v-for="metric in relatedMetrics" :key="metric.key" class="related-metric"
        :class="`related-metric--${metric.tone || 'neutral'}`">
        <view class="related-metric__value">
          <text>{{ metric.value }}</text><text>{{ metric.unit }}</text>
        </view>
        <text class="related-metric__label">{{ metric.label }}</text>
      </view>
    </view>

    <view v-if="proposalInstallationBatchAvailable" class="proposal-batch-tools">
      <view v-if="!proposalBatchSelecting" class="proposal-batch-entry"
        hover-class="proposal-batch-entry--pressed" @tap="startProposalInstallationBatchSelection">
        <text class="proposal-batch-entry__icon">▦</text>
        <view><text>批量配置安装点位</text><text>选择多个点位后统一修改全部业务字段</text></view>
        <text>›</text>
      </view>
      <template v-else>
        <view class="proposal-batch-select-all" :class="{ active: proposalBatchAllLoadedSelected }"
          @tap="toggleAllProposalBatchRows">
          <text>{{ proposalBatchAllLoadedSelected ? '✓' : '' }}</text>
          <view><text>{{ proposalBatchAllLoadedSelected ? '取消全选' : '全选已加载' }}</text>
            <text>已选 {{ proposalBatchSelectedRows.length }} 项</text></view>
        </view>
        <view class="proposal-batch-tool-button" @tap="cancelProposalInstallationBatchSelection"><text>取消</text></view>
        <view class="proposal-batch-tool-button proposal-batch-tool-button--primary"
          :class="{ disabled: proposalBatchSelectedRows.length < 2 }"
          hover-class="proposal-batch-tool-button--pressed" @tap="openProposalInstallationBatchEditor">
          <text>统一配置</text><text v-if="proposalBatchSelectedRows.length">{{ proposalBatchSelectedRows.length }}</text>
        </view>
      </template>
      <text v-if="proposalBatchSelecting && rows.length < count" class="proposal-batch-load-hint">
        当前已加载 {{ rows.length }}/{{ count }}，继续下拉可选择更多点位
      </text>
    </view>

    <scroll-view class="related-list-body" :class="{ 'related-list-body--scroll': independentScroll && !isPreview }"
      :style="relatedListBodyStyle"
      :scroll-y="independentScroll && !isPreview"
      :enable-flex="independentScroll && !isPreview"
      :show-scrollbar="false"
      :lower-threshold="120" @scrolltolower="loadMore">
    <view class="related-list-scroll-content">
    <!-- zhy：客户详情“需求方案”Tab 与首页普通列表保持同一套比价入口和选择规则。 -->
    <view v-if="proposalCompareEnabled" class="proposal-compare-tools">
      <view class="proposal-select-all" :class="{ active: areAllProposalsSelected }"
        @tap="toggleAllProposals">
        <text>{{ areAllProposalsSelected ? '✓' : '' }}</text>
        <text>{{ areAllProposalsSelected ? '取消全选' : '全选' }}</text>
      </view>
      <view class="proposal-compare-button"
        :class="{ disabled: proposalSelection.length < 2 || proposalComparing }"
        hover-class="proposal-compare-button--pressed" @tap="compareProposals">
        <text>{{ proposalComparing ? '比价中...' : '一键比价' }}</text>
        <text v-if="proposalSelection.length">{{ proposalSelection.length }}</text>
      </view>
    </view>


    <view v-if="previewContentVisible && loading && pageIndex === 1 && !waitingForParentSave" class="related-skeleton">
      <view v-for="item in (isPreview ? previewLimit : 3)" :key="item" class="skeleton-card">
        <view class="skeleton-line wide"></view>
        <view class="skeleton-line"></view>
        <view class="skeleton-line short"></view>
      </view>
    </view>

    <view v-else-if="previewContentVisible && rows.length" class="related-data-list">
      <template v-if="isCollectionCardLayout">
        <view v-for="(row, index) in displayedRows" :key="row.Id || index" class="collection-card"
          hover-class="collection-card--pressed" @tap="openDetail(row)">
          <view class="collection-card__head">
            <text class="collection-card__title">{{ collectionTitle(row) }}</text>
            <button v-if="collectionCanRemove(row)" class="collection-card__delete"
              :loading="collectionDeletingId === String(row.Id)"
              :disabled="Boolean(collectionDeletingId)"
              @tap.stop="removeCollectionRow(row)">删除</button>
          </view>
          <text v-if="collectionSubtitle(row)" class="collection-card__subtitle">{{ collectionSubtitle(row) }}</text>
          <view v-if="collectionLines(row).length" class="collection-card__lines">
            <view v-for="line in collectionLines(row)" :key="line.field">
              <text>{{ line.label }}</text><text>{{ line.value }}</text>
            </view>
          </view>
          <view v-if="collectionPhotos(row).length" class="collection-card__photos">
            <image v-for="(photo, photoIndex) in collectionPhotos(row).slice(0, 3)" :key="photo"
              :src="photo" mode="aspectFill" @tap.stop="previewCollectionPhotos(row, photoIndex)" />
            <view v-if="collectionPhotos(row).length > 3" class="collection-card__photo-more">
              <text>+{{ collectionPhotos(row).length - 3 }}</text>
            </view>
          </view>
          <view class="collection-card__foot">
            <text>{{ collectionFooterLabel }}</text><text>›</text>
          </view>
        </view>
      </template>
      <template v-else-if="isProposalInstallationQuickMode">
        <view v-for="(row, index) in displayedRows" :key="row.Id" class="proposal-point-card">
          <view class="proposal-point-card__title">
            <text>点位{{ index + 1 }}</text>
          </view>
          <view v-for="item in proposalInstallationVisibleQuickFields" :key="`${row.Id}-${item.key}`"
            class="proposal-point-field">
            <text class="proposal-point-field__label">{{ item.label }}</text>
            <mci-native-field v-if="item.key === 'deviceModel'"
              class="proposal-point-field__control"
              :model-value="row[item.name]" :field="item.field"
              :readonly="!proposalPointCanEdit(row)" :table-name="config.table"
              :form-data="row" :form-data-id="row.Id" :menu-id="menuId"
              :table-child-auth="tableChildAuth"
              @change="updateProposalPointValue(row, item.name, $event)"
              @select="selectProposalPointDevice(row, $event)" />
            <input v-else-if="proposalPointCanEdit(row) && item.key !== 'deviceName'"
              class="proposal-point-field__input" :value="row[item.name]"
              :type="item.numeric ? 'number' : 'text'" :placeholder="item.placeholder"
              @input="updateProposalPointValue(row, item.name, $event.detail.value)"
              @blur="saveProposalPointField(row, item.name, $event.detail.value)" />
            <text v-else class="proposal-point-field__value"
              :class="{ 'proposal-point-field__value--empty': proposalPointValueEmpty(row[item.name]) }">
              {{ proposalPointDisplayValue(row, item) }}
            </text>
          </view>
          <view class="proposal-point-actions">
            <view v-if="proposalPointCanEdit(row)" class="proposal-point-action" hover-class="proposal-point-action--pressed"
              @tap.stop="openProposalPointEdit(row)">
              <text>✎ 编辑</text>
            </view>
            <view v-if="proposalPointCanDelete(row)" class="proposal-point-action proposal-point-action--delete"
              hover-class="proposal-point-action--pressed" @tap.stop="deleteProposalPoint(row)">
              <text>× 删除</text>
            </view>
            <view v-if="canAdd" class="proposal-point-action proposal-point-action--copy"
              hover-class="proposal-point-action--pressed" @tap.stop="copyProposalPoint(row)">
              <text>⧉ 复制</text>
            </view>
          </view>
        </view>
      </template>
      <template v-else-if="moduleKey === 'tasks'">
        <mci-task-card v-for="(row, index) in displayedRows" :key="row.Id || index"
          :item="taskCardRow(row)" :index="index" :state-class="taskStatusClass(row)"
          @open="openDetail" @phone="callPhone" />
      </template>
      <template v-else-if="isProposalInstallationContext && !isPreview">
        <view v-for="(row, index) in displayedRows" :key="row.Id || index"
          class="proposal-batch-card" :class="{ selected: isProposalBatchRowSelected(row) }">
          <view v-if="proposalBatchSelecting" class="proposal-batch-card__select"
            :class="{ active: isProposalBatchRowSelected(row) }" @tap.stop="toggleProposalBatchRow(row)">
            <text>{{ isProposalBatchRowSelected(row) ? '✓' : '' }}</text>
          </view>
          <mci-business-card
            :row="row" :index="index" :title="getTitle(row)" :status="getStatus(row)"
            :status-class="getStatusClass(row)" :tags="getTags(row)" :lines="cardLines(row)"
            :summary="config.summaryField ? summaryValue(row) : ''"
            :summary-lines="config.summaryLines || 3" :actions="proposalBatchSelecting ? [] : rowActions(row)"
            :time="cardBottomText(row)"
            @open="openProposalInstallationBatchRow(row)" @phone="callPhone" @action="triggerRowAction" />
        </view>
      </template>
      <template v-else>
        <!-- zhy：关联列表中的跟进卡片同步使用摘要最大行数。 -->
        <view v-for="(row, index) in displayedRows" :key="row.Id || index" class="selectable-card">
          <view v-if="proposalCompareEnabled" class="proposal-select"
            :class="{ active: isProposalSelected(row) }" @tap.stop="toggleProposal(row)">
            <text>{{ isProposalSelected(row) ? '✓' : '' }}</text>
          </view>
          <mci-business-card
            :row="row" :index="index" :title="getTitle(row)" :status="getStatus(row)"
            :status-class="getStatusClass(row)" :tags="getTags(row)" :lines="cardLines(row)"
            :summary="config.summaryField ? summaryValue(row) : ''"
            :summary-lines="config.summaryLines || 3" :actions="rowActions(row)"
            :time="cardBottomText(row)"
            @open="openDetail" @phone="callPhone" @action="triggerRowAction" />
        </view>
      </template>
      <block v-if="!isCollectionCardLayout">
        <view v-if="!isPreview && !finished" class="load-more" hover-class="load-more--pressed" @tap="loadMore">
          <text>{{ loading ? '正在加载' : '加载更多' }}</text>
        </view>
        <view v-else-if="!isPreview" class="load-finished"><text>共 {{ count }} 条</text></view>
      </block>
    </view>

    <view v-else-if="previewContentVisible && error" class="related-empty">
      <text>{{ error }}</text>
      <view @tap="loadData(true, true)"><text>重新加载</text></view>
    </view>

    <view v-else-if="previewContentVisible" class="related-empty">
      <template v-if="waitingForParentSave">
        <text>保存当前表单后可新增{{ config.title || sectionTitle }}</text>
      </template>
      <template v-else>
        <text>暂无{{ config.title || sectionTitle }}</text>
        <text v-if="canAdd && !isPreview && !isCollectionCardLayout">点击右下角加号新增</text>
      </template>
    </view>
    </view>
    </scroll-view>

    <view v-if="showFloatingAdd && canAdd && !isPreview && !isCollectionCardLayout && !proposalBatchSelecting" class="floating-add" :style="floatingStyle"
      hover-class="floating-add--pressed" @tap="openAdd"><text>＋</text></view>

    <view v-if="previewContentVisible && isPreview && !waitingForParentSave && previewActionCount" class="preview-actions"
      :class="{ 'preview-actions--single': previewActionCount === 1, 'preview-actions--three': previewActionCount === 3 }">
      <view v-if="proposalInstallationBatchPreviewAvailable"
        class="preview-action preview-action--batch" hover-class="preview-action--pressed"
        @tap="openProposalInstallationBatch">
        <text class="preview-action__icon">▦</text><text>批量配置</text>
      </view>
      <view v-if="showPreviewFooterMore"
        class="preview-action preview-action--more" hover-class="preview-action--pressed" @tap="openMore">
        <text class="preview-action__icon">···</text><text>查看更多</text>
      </view>
      <view v-if="canAdd" class="preview-action preview-action--add"
        hover-class="preview-action--pressed" @tap="openAdd">
        <text class="preview-action__icon">＋</text><text>新增</text>
      </view>
    </view>

    <root-portal v-if="collectionPickerOpen">
      <view class="collection-picker-mask" @tap="closeCollectionPicker" @touchmove.stop.prevent="noop">
        <view class="collection-picker-sheet" @tap.stop @touchmove.stop>
          <view class="collection-picker-handle"></view>
          <view class="collection-picker-head">
            <view>
              <text>{{ collectionPickerConfig.title || '选择记录' }}</text>
              <text v-if="collectionSelectedIds.length">已选 {{ collectionSelectedIds.length }}</text>
            </view>
            <button class="collection-picker-close" @tap="closeCollectionPicker">×</button>
          </view>
          <view class="collection-picker-search">
            <text>⌕</text>
            <input v-model="collectionSourceKeyword" confirm-type="search"
              :placeholder="collectionPickerConfig.searchPlaceholder || '搜索记录'"
              @confirm="searchCollectionSources" />
            <button v-if="collectionSourceKeyword" @tap="clearCollectionSourceKeyword">×</button>
          </view>
          <scroll-view class="collection-picker-list" scroll-y :show-scrollbar="false"
            :lower-threshold="100" @scrolltolower="loadMoreCollectionSources">
            <view v-if="collectionSourceLoading && !collectionSourceRows.length" class="collection-picker-loading">
              <view v-for="item in 5" :key="item"><view></view><view></view></view>
            </view>
            <button v-for="item in collectionSourceRows" :key="item.Id" class="collection-picker-row"
              :class="{
                'collection-picker-row--selected': collectionSourceSelected(item),
                'collection-picker-row--added': collectionSourceAlreadyAdded(item)
              }"
              :disabled="collectionSourceAlreadyAdded(item)"
              @tap="toggleCollectionSource(item)">
              <view class="collection-picker-check"><text>{{ collectionSourceAlreadyAdded(item) || collectionSourceSelected(item) ? '✓' : '' }}</text></view>
              <view class="collection-picker-main">
                <text>{{ collectionSourceTitle(item) }}</text>
                <text>{{ collectionSourceSubtitle(item) }}{{ collectionSourceAlreadyAdded(item) ? ' · 已收录' : '' }}</text>
              </view>
            </button>
            <view v-if="!collectionSourceLoading && !collectionSourceRows.length" class="collection-picker-empty">
              <text>{{ collectionPickerConfig.emptyText || '未找到可选记录' }}</text>
            </view>
            <view v-if="collectionSourceLoading && collectionSourceRows.length" class="collection-picker-more"><text>加载中…</text></view>
          </scroll-view>
          <view class="collection-picker-submit">
            <button :loading="collectionAdding" :disabled="!collectionSelectedIds.length || collectionAdding"
              @tap="addSelectedCollectionSources">
              <text>＋</text><text>{{ collectionAdding ? '正在添加' : `添加${collectionSelectedIds.length ? ` ${collectionSelectedIds.length}` : ''}` }}</text>
            </button>
          </view>
        </view>
      </view>
    </root-portal>

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

    <root-portal v-if="proposalBatchEditorOpen">
      <view class="proposal-batch-mask" @tap="closeProposalInstallationBatchEditor" @touchmove.stop.prevent="noop">
        <view class="proposal-batch-sheet" @tap.stop @touchmove.stop>
          <view class="proposal-batch-sheet__head">
            <view>
              <text>统一配置安装点位</text>
              <text>已选 {{ proposalBatchSelectedRows.length }} 个点位 · 已启用 {{ proposalBatchEnabledCount }} 个字段</text>
            </view>
            <view class="proposal-batch-sheet__close" @tap="closeProposalInstallationBatchEditor"><text>×</text></view>
          </view>
          <view class="proposal-batch-tip">
            <text>只修改已勾选的字段；未勾选字段保持原值。勾选后留空表示统一清空。</text>
          </view>
          <scroll-view class="proposal-batch-sheet__scroll" scroll-y :show-scrollbar="false">
            <view v-for="group in proposalInstallationBatchGroups" :key="group.key" class="proposal-batch-group">
              <view class="proposal-batch-group__title">
                <text>{{ group.name }}</text><text>{{ group.fields.length }} 项</text>
              </view>
              <view v-for="batchField in group.fields" :key="batchField.Id || batchField.Name"
                class="proposal-batch-field" :class="{ enabled: proposalBatchFieldEnabled(batchField), 'selector-open': proposalBatchActiveSelector === batchField.Name }">
                <view class="proposal-batch-field__head" @tap="toggleProposalBatchField(batchField)">
                  <view class="proposal-batch-field__check" :class="{ active: proposalBatchFieldEnabled(batchField) }">
                    <text>{{ proposalBatchFieldEnabled(batchField) ? '✓' : '' }}</text>
                  </view>
                  <view><text>{{ batchField.Label || batchField.Name }}</text>
                    <text>{{ proposalBatchFieldEnabled(batchField) ? '将统一修改' : '保持各点位原值' }}</text></view>
                  <text v-if="batchField.required">必填</text>
                </view>
                <view v-if="proposalBatchFieldEnabled(batchField)" class="proposal-batch-field__body">
                  <mci-native-field
                    :model-value="proposalBatchForm[batchField.Name]" :field="batchField" :readonly="false"
                    :table-name="config.table" :form-data="proposalBatchControlForm"
                    :menu-id="menuId" :module-engine-key="config.moduleEngineKey"
                    :table-child-auth="tableChildAuth"
                    @change="setProposalBatchFieldValue(batchField, $event)"
                    @select="selectProposalBatchFieldOption(batchField, $event)"
                    @selector-toggle="setProposalBatchSelectorState(batchField, $event)"
                    @upload-state="setProposalBatchUploadState(batchField, $event)" />
                  <view class="proposal-batch-field__clear" hover-class="proposal-batch-field__clear--pressed"
                    @tap="clearProposalBatchField(batchField)"><text>清空该字段</text></view>
                </view>
              </view>
            </view>
            <view class="proposal-batch-sheet__safe"></view>
          </scroll-view>
          <view class="proposal-batch-sheet__footer">
            <view @tap="resetProposalBatchFields"><text>重置字段</text></view>
            <view :class="{ disabled: !proposalBatchCanSubmit }" @tap="submitProposalInstallationBatch">
              <text>{{ proposalBatchSubmitting ? '保存中...' : `确认配置 ${proposalBatchSelectedRows.length} 个点位` }}</text>
            </view>
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
  openForm,
  statisticsFieldValue
} from '@/platform/business-runtime.js'
import { compileListConfig, loadModuleViewManifest } from '@/platform/view-manifest.js'
import { executeViewAction, isActionVisible } from '@/platform/view-actions.js'
import { appendStandardDeleteAction } from '@/platform/module-delete.js'
import { canDeleteMenuRecord } from '@/platform/menu-permission.js'
import {
  fieldDisplayValue,
  hydrateNativeFormOptions,
  loadNativeFormDefinition,
  loadNativeTableModel,
  parseJson
} from '@/platform/native-form.js'
import { createMenuModuleDefinition, loadModuleDefinition } from '@/platform/module-registry.js'
import { cardFieldKey, filterVisibleCardLines } from '@/platform/card-field-policy.mjs'
import { buildTableChildDefaultValues } from '@/platform/table-child-defaults.js'
import { childDraftGroup } from '@/platform/child-form-drafts.mjs'
import { V8, getUser, post } from '@/utils/request.js'
import MciBusinessCard from '@/components/mci-business-card/mci-business-card.vue'
import MciTaskCard from '@/components/mci-task-card/mci-task-card.vue'
import MciNativeField from '@/components/mci-native-field/mci-native-field.vue'
import {
  PROPOSAL_INSTALLATION_FIELDS,
  PROPOSAL_INSTALLATION_BATCH_ENGINE,
  createProposalInstallationId,
  isProposalInstallationQuickContext,
  proposalInstallationBatchFields,
  proposalInstallationBatchPatch,
  proposalInstallationCopyValues,
  proposalInstallationDeviceBatchValues,
  proposalInstallationDeviceValues,
  proposalInstallationDraft,
  proposalInstallationWriteValues
} from '@/tenants/xjy/proposal-installation-points.mjs'
import {
  canAddMenuRecord,
  canEditMenuRecord,
  executeBusinessRowAction,
  getBusinessRowActions,
  hydrateInstallationPositionRows,
  openInstallationPositionDevice,
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
  components: { MciBusinessCard, MciTaskCard, MciNativeField },
  props: {
    field: { type: Object, required: true },
    parentId: { type: [String, Number], default: '' },
    parentForm: { type: Object, default: () => ({}) },
    parentMenuId: { type: String, default: '' },
    parentTableId: { type: String, default: '' },
    parentTableName: { type: String, default: '' },
    parentMode: { type: String, default: 'View' },
    displayMode: { type: String, default: 'full' },
    showLatestRecordSummary: { type: Boolean, default: false },
    previewLimit: { type: Number, default: 2 },
    showPreviewHeader: { type: Boolean, default: false },
    moreInGroupHeader: { type: Boolean, default: false },
    relationValueOverride: { type: [String, Number], default: '' },
    presentation: { type: Object, default: () => ({}) },
    showFloatingAdd: { type: Boolean, default: true },
    independentScroll: { type: Boolean, default: false },
    viewportHeight: { type: Number, default: 0 },
    parentTableChildAuth: { type: Object, default: null },
    batchEntryMode: { type: String, default: '' }
  },
  emits: ['floating-add-state', 'filter-open-state', 'data-count', 'title-change', 'preview-more-state'],
  data() {
    return {
      table: null,
      definition: null,
      menu: null,
      moduleKey: '',
      config: {},
      menuId: '',
      viewManifest: null,
      presentationRequestId: 0,
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
      previewExpanded: true,
      searchTimer: null,
      loadRequestId: 0,
      appliedRequestId: 0,
      latestSummaryRequestId: 0,
      latestSummaryRow: null,
      latestSummaryLoading: false,
      latestSummaryError: '',
      metricLoading: false,
      metricValues: {},
      listBodyHeight: 0,
      layoutMeasureTimers: [],
      proposalPointSavingId: '',
      proposalSelection: [],
      proposalComparing: false,
      proposalBatchSelecting: false,
      proposalBatchSelection: [],
      proposalBatchEditorOpen: false,
      proposalBatchForm: {},
      proposalBatchEnabled: {},
      proposalBatchDependencies: {},
      proposalBatchUploadStates: {},
      proposalBatchActiveSelector: '',
      proposalBatchSubmitting: false,
      proposalBatchOptionsLoading: false,
      proposalBatchRequestId: '',
      collectionPickerOpen: false,
      collectionSourceRows: [],
      collectionSourceCount: 0,
      collectionSourcePage: 1,
      collectionSourceKeyword: '',
      collectionSourceLoading: false,
      collectionSourceMenuId: '',
      collectionSelectedIds: [],
      collectionAdding: false,
      collectionDeletingId: ''
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
    isCollectionCardLayout() { return String(this.presentation.layout || '').toLowerCase() === 'collection-cards' },
    collectionFooterLabel() { return this.presentation.footerLabel || '查看详情' },
    collectionPickerConfig() {
      const picker = this.presentation && this.presentation.picker
      return picker && typeof picker === 'object' ? picker : {}
    },
    collectionPickerEnabled() {
      return this.isCollectionCardLayout && Boolean(this.collectionPickerConfig.sourceTable)
    },
    isPreview() { return String(this.displayMode || '').toLowerCase() === 'preview' },
    previewContentVisible() { return !this.isPreview || !this.showPreviewHeader || this.previewExpanded },
    proposalCompareEnabled() { return !this.isPreview && this.moduleKey === 'proposals' },
    latestSummaryEnabled() {
      return this.showLatestRecordSummary && !this.isPreview &&
        Boolean(this.config.latestRecordSummary?.fields?.length)
    },
    areAllProposalsSelected() {
      return Boolean(this.rows.length) && this.rows.every((row) => this.isProposalSelected(row))
    },
    displayedRows() {
      if (this.proposalDraftGroup) return this.rows
      return this.isPreview
        ? this.rows.slice(0, Math.max(1, this.previewLimit))
        : this.rows
    },
    isProposalInstallationContext() {
      return isProposalInstallationQuickContext(this.parentTableName, this.config.table || this.table?.Name)
    },
    proposalDraftGroup() {
      if (!this.isProposalInstallationContext || String(this.parentMode).toLowerCase() !== 'add') return null
      return childDraftGroup(this.parentId, this.field.Id, {
        tableName: this.config.table || this.table?.Name,
        fieldConfig: this.fieldConfig,
        fkField: this.childFkField,
        primaryField: this.childConfig.PrimaryTableFieldName || '',
        parentForm: this.parentForm,
        menuId: this.menuId,
        auth: this.tableChildAuth
      })
    },
    isProposalInstallationQuickMode() {
      // zhy：安装点位只有嵌入需求方案详情的预览区使用快速编辑卡片；
      // “查看更多”独立列表必须回到通用子表卡片，完整遵循后台 ViewSchema/菜单字段配置。
      return this.isPreview && this.isProposalInstallationContext
    },
    proposalInstallationBatchAvailable() {
      if (this.proposalDraftGroup) return false
      return !this.isPreview && this.isProposalInstallationContext && Boolean(this.relationValue) &&
        Number(this.count || this.rows.length) >= 2 &&
        Boolean(canEditMenuRecord(this.parentMenuId || this.menuId || this.childMenuId, this.currentUser))
    },
    proposalInstallationBatchPreviewAvailable() {
      if (this.proposalDraftGroup) return false
      return this.isProposalInstallationQuickMode && Number(this.count || this.rows.length) >= 2 &&
        Boolean(canEditMenuRecord(this.parentMenuId || this.menuId || this.childMenuId, this.currentUser))
    },
    previewActionCount() {
      return Number(this.proposalInstallationBatchPreviewAvailable) +
        Number(this.showPreviewFooterMore) +
        Number(this.canAdd)
    },
    previewMoreInGroupHeader() {
      return this.moreInGroupHeader && this.isProposalInstallationQuickMode
    },
    previewMoreNavigation() {
      return this.previewMoreInGroupHeader && this.proposalInstallationHasMore && !this.waitingForParentSave
        ? this.relatedListNavigation('') : null
    },
    showPreviewFooterMore() {
      return !this.previewMoreInGroupHeader && (!this.isProposalInstallationQuickMode || this.proposalInstallationHasMore)
    },
    proposalBatchSelectedRows() {
      const currentRows = new Map(this.rows.map((row) => [String(row?.Id || ''), row]))
      return this.proposalBatchSelection.map((row) => currentRows.get(String(row?.Id || '')) || row).filter((row) => row?.Id)
    },
    proposalBatchAllLoadedSelected() {
      return Boolean(this.rows.length) && this.rows.every((row) => this.isProposalBatchRowSelected(row))
    },
    proposalBatchFields() {
      return proposalInstallationBatchFields(this.definition?.fields || [])
    },
    proposalInstallationBatchGroups() {
      const allowed = new Set(this.proposalBatchFields.map((field) => String(field.Name || '').toLowerCase()))
      const groups = (this.definition?.groups || []).map((group, index) => ({
        key: group.key || `batch-group-${index}`,
        name: group.name || '其他信息',
        fields: (group.fields || []).filter((field) => allowed.has(String(field.Name || '').toLowerCase()))
      })).filter((group) => group.fields.length)
      const grouped = new Set(groups.flatMap((group) => group.fields.map((field) => String(field.Name || '').toLowerCase())))
      const remaining = this.proposalBatchFields.filter((field) => !grouped.has(String(field.Name || '').toLowerCase()))
      if (remaining.length) groups.push({ key: 'batch-group-other', name: '其他信息', fields: remaining })
      return groups
    },
    proposalBatchEnabledCount() {
      return Object.keys(this.proposalBatchEnabled || {}).filter((name) => this.proposalBatchEnabled[name] === true).length
    },
    proposalBatchHasPendingUploads() {
      return Object.values(this.proposalBatchUploadStates || {}).some((state) => Number(state?.pendingCount || 0) > 0)
    },
    proposalBatchCanSubmit() {
      return this.proposalBatchSelectedRows.length >= 2 && this.proposalBatchEnabledCount > 0 &&
        !this.proposalBatchHasPendingUploads && !this.proposalBatchSubmitting
    },
    proposalBatchControlForm() {
      const firstPoint = this.proposalBatchSelectedRows[0] || {}
      return {
        ...this.parentForm,
        ...firstPoint,
        ...this.proposalBatchForm,
        // 远程选项的数据源可能引用当前子表记录字段，批量配置必须沿用安装点位表单上下文，
        // 不能把需求方案 Id 伪装成安装点位 Id。
        Id: firstPoint.Id || this.relationValue
      }
    },
    proposalInstallationHasMore() {
      if (this.proposalDraftGroup) return false
      return this.isProposalInstallationQuickMode &&
        Number(this.count || this.rows.length) > Math.max(1, this.previewLimit)
    },
    proposalInstallationQuickFields() {
      const definitions = this.definition?.fields || []
      const resolve = (key, label, fallback = {}) => {
        const expectedName = PROPOSAL_INSTALLATION_FIELDS[key]
        const field = definitions.find((item) => String(item.Name || '').toLowerCase() === expectedName.toLowerCase()) ||
          definitions.find((item) => String(item.Label || '').trim() === label) || {}
        return {
          key,
          name: field.Name || expectedName,
          label,
          placeholder: key === 'deviceModel' ? '请选择设备型号' : `请填写${label}`,
          numeric: ['deviceQuantity', 'people'].includes(key),
          field: {
            Name: field.Name || expectedName,
            Label: field.Label || label,
            component: field.component || (key === 'deviceModel' ? 'Select' : 'Text'),
            options: field.options || [],
            config: field.config || {},
            ...fallback,
            ...field
          }
        }
      }
      return [
        resolve('place', '安装场所'),
        resolve('deviceModel', '设备型号'),
        resolve('deviceName', '设备名称'),
        // resolve('deviceQuantity', '设备数量'),
        // resolve('people', '人数')
      ]
    },
    proposalInstallationVisibleQuickFields() {
      // 暂时注释设备字段的卡片展示入口；完整字段定义及选择、保存联动保留，取消注释即可恢复。
      const visibleKeys = [
        'place',
        // 'deviceModel',
        // 'deviceName',
      ]
      return this.proposalInstallationQuickFields.filter((item) => visibleKeys.includes(item.key))
    },
    proposalInstallationFieldNames() {
      return this.proposalInstallationQuickFields.reduce((result, item) => ({
        ...result,
        [item.key]: item.name
      }), {
        deviceQuantity: this.proposalInstallationDefinitionField('deviceQuantity', '设备数量')?.Name || PROPOSAL_INSTALLATION_FIELDS.deviceQuantity,
        people: this.proposalInstallationDefinitionField('people', '人数')?.Name || PROPOSAL_INSTALLATION_FIELDS.people,
        deviceModelId: this.proposalInstallationDefinitionField('deviceModelId', '设备型号Id')?.Name || ''
      })
    },
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
      return Boolean(
        this.relationValue &&
        this.childFkField &&
        this.config.table &&
        canAddMenuRecord(this.menuId || this.childMenuId, this.currentUser)
      )
    },
    filterFields() { return this.config.filterFields || [] },
    relatedMetricDefinitions() {
      if (this.config.relatedMetrics?.length) return this.config.relatedMetrics
      return [{ key: 'total', label: `${this.config.title || this.sectionTitle}总量`, tone: 'neutral' }]
    },
    relatedMetrics() {
      return this.relatedMetricDefinitions.map((metric) => {
        const raw = this.metricValues[metric.key]
        const loading = this.metricLoading && (raw === undefined || raw === null)
        return {
          ...metric,
          value: loading ? '—' : this.formatRelatedMetric(raw, metric),
          unit: loading ? '' : (metric.unit !== undefined ? metric.unit : (metric.format === 'compactMoney' ? '' : '条'))
        }
      })
    },
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
    },
    independentRootStyle() {
      if (!this.independentScroll || this.isPreview) return {}
      if (this.viewportHeight < 120) return { height: '100%', maxHeight: '100%' }
      return {
        height: `${Math.floor(this.viewportHeight)}px`,
        maxHeight: `${Math.floor(this.viewportHeight)}px`
      }
    },
    relatedListBodyStyle() {
      if (!this.independentScroll || this.isPreview || this.listBodyHeight < 80) return {}
      return { height: `${this.listBodyHeight}px`, maxHeight: `${this.listBodyHeight}px` }
    }
  },
  watch: {
    // 展示状态单独上报，首次加载即可显示入口，且不会触发 data-count 的业务写回。
    previewMoreNavigation: {
      immediate: true,
      handler(navigation) { this.$emit('preview-more-state', navigation) }
    },
    viewportHeight: {
      immediate: true,
      handler() {
        this.scheduleListBodyMeasure()
      }
    },
    canAdd: {
      immediate: true,
      handler(value) {
        this.$emit('floating-add-state', Boolean(value && !this.isPreview))
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
          this.latestSummaryRequestId += 1
          this.latestSummaryRow = null
          this.latestSummaryLoading = false
          this.latestSummaryError = ''
          this.rows = []
          this.loading = false
        } else if (this.config.table) {
          this.loadData(true, false, false, true)
        }
      }
    }
  },
  created() {
    uni.$on('microi:data-changed', this.handleDataChanged)
    this.initialize()
  },
  mounted() {
    this.scheduleListBodyMeasure()
  },
  beforeUnmount() {
    this.latestSummaryRequestId += 1
    this.presentationRequestId += 1
    uni.$off('microi:data-changed', this.handleDataChanged)
    clearTimeout(this.searchTimer)
    this.clearLayoutMeasureTimers()
    this.$emit('filter-open-state', false)
  },
  methods: {
    isProposalBatchRowSelected(row) {
      return Boolean(row?.Id) && this.proposalBatchSelection.some((item) => String(item?.Id) === String(row.Id))
    },
    startProposalInstallationBatchSelection() {
      if (!this.proposalInstallationBatchAvailable) {
        uni.showToast({ title: '当前账号没有批量修改权限', icon: 'none' })
        return
      }
      this.proposalBatchSelecting = true
      this.proposalBatchSelection = []
      this.resetProposalBatchFields()
    },
    cancelProposalInstallationBatchSelection() {
      this.proposalBatchSelecting = false
      this.proposalBatchSelection = []
      this.proposalBatchEditorOpen = false
      this.resetProposalBatchFields()
    },
    toggleProposalBatchRow(row) {
      if (!row?.Id || !this.proposalBatchSelecting) return
      const index = this.proposalBatchSelection.findIndex((item) => String(item?.Id) === String(row.Id))
      if (index >= 0) this.proposalBatchSelection.splice(index, 1)
      else this.proposalBatchSelection.push(row)
    },
    toggleAllProposalBatchRows() {
      if (!this.proposalBatchSelecting) return
      const loadedIds = new Set(this.rows.map((row) => String(row?.Id || '')).filter(Boolean))
      if (this.proposalBatchAllLoadedSelected) {
        this.proposalBatchSelection = this.proposalBatchSelection.filter((row) => !loadedIds.has(String(row?.Id || '')))
        return
      }
      const selected = new Map(this.proposalBatchSelection.map((row) => [String(row?.Id || ''), row]))
      this.rows.forEach((row) => { if (row?.Id) selected.set(String(row.Id), row) })
      this.proposalBatchSelection = [...selected.values()]
    },
    openProposalInstallationBatchRow(row) {
      if (this.proposalBatchSelecting) {
        this.toggleProposalBatchRow(row)
        return
      }
      this.openDetail(row)
    },
    proposalBatchEmptyValue(field) {
      if (field?.multiple || ['ImgUpload', 'FileUpload'].includes(field?.component)) return []
      if (field?.component === 'Switch') return false
      return ''
    },
    cloneProposalBatchValue(value) {
      if (!value || typeof value !== 'object') return value
      try { return JSON.parse(JSON.stringify(value)) } catch (error) { return value }
    },
    proposalBatchCommonValue(field) {
      const rows = this.proposalBatchSelectedRows
      if (!rows.length) return this.proposalBatchEmptyValue(field)
      const values = rows.map((row) => row?.[field.Name])
      const signature = (value) => {
        try { return JSON.stringify(value ?? null) } catch (error) { return String(value ?? '') }
      }
      const first = signature(values[0])
      return values.every((value) => signature(value) === first)
        ? this.cloneProposalBatchValue(values[0])
        : this.proposalBatchEmptyValue(field)
    },
    proposalBatchFieldEnabled(field) {
      return Boolean(field?.Name && this.proposalBatchEnabled[field.Name] === true)
    },
    toggleProposalBatchField(field) {
      if (!field?.Name || this.proposalBatchSubmitting) return
      const enabled = !this.proposalBatchFieldEnabled(field)
      this.proposalBatchEnabled = { ...this.proposalBatchEnabled, [field.Name]: enabled }
      if (enabled && !Object.prototype.hasOwnProperty.call(this.proposalBatchForm, field.Name)) {
        this.proposalBatchForm = { ...this.proposalBatchForm, [field.Name]: this.proposalBatchCommonValue(field) }
      }
      if (!enabled && String(field.Name).toLowerCase() === PROPOSAL_INSTALLATION_FIELDS.deviceModel.toLowerCase()) {
        const dependencies = { ...this.proposalBatchDependencies }
        delete dependencies[PROPOSAL_INSTALLATION_FIELDS.deviceModelId]
        this.proposalBatchDependencies = dependencies
      }
      this.proposalBatchRequestId = ''
    },
    setProposalBatchFieldValue(field, value) {
      if (!field?.Name) return
      this.proposalBatchForm = { ...this.proposalBatchForm, [field.Name]: value }
      this.proposalBatchRequestId = ''
    },
    clearProposalBatchField(field) {
      if (!field?.Name) return
      this.setProposalBatchFieldValue(field, this.proposalBatchEmptyValue(field))
      if (String(field.Name).toLowerCase() === PROPOSAL_INSTALLATION_FIELDS.deviceModel.toLowerCase()) {
        this.selectProposalBatchFieldOption(field, { cleared: true })
      }
    },
    selectProposalBatchFieldOption(field, selection = {}) {
      if (!field?.Name || String(field.Name).toLowerCase() !== PROPOSAL_INSTALLATION_FIELDS.deviceModel.toLowerCase()) return
      const values = proposalInstallationDeviceBatchValues(selection)
      const dependencies = { ...this.proposalBatchDependencies }
      Object.keys(values).forEach((name) => {
        if (name === PROPOSAL_INSTALLATION_FIELDS.deviceModelId) {
          dependencies[name] = values[name]
          return
        }
        const target = this.proposalBatchFields.find((item) => String(item.Name || '').toLowerCase() === name.toLowerCase())
        if (!target) return
        this.proposalBatchForm = { ...this.proposalBatchForm, [target.Name]: values[name] }
        this.proposalBatchEnabled = { ...this.proposalBatchEnabled, [target.Name]: true }
      })
      this.proposalBatchDependencies = dependencies
      this.proposalBatchRequestId = ''
    },
    setProposalBatchUploadState(field, state = {}) {
      if (!field?.Name) return
      this.proposalBatchUploadStates = { ...this.proposalBatchUploadStates, [field.Name]: state || {} }
    },
    setProposalBatchSelectorState(field, open) {
      this.proposalBatchActiveSelector = open && field?.Name ? field.Name : ''
    },
    resetProposalBatchFields() {
      this.proposalBatchForm = {}
      this.proposalBatchEnabled = {}
      this.proposalBatchDependencies = {}
      this.proposalBatchUploadStates = {}
      this.proposalBatchActiveSelector = ''
      this.proposalBatchRequestId = ''
    },
    async openProposalInstallationBatchEditor() {
      if (this.proposalBatchSelectedRows.length < 2) {
        uni.showToast({ title: '请至少选择两个安装点位', icon: 'none' })
        return
      }
      if (this.proposalBatchOptionsLoading) return
      this.proposalBatchOptionsLoading = true
      uni.showLoading({ title: '正在加载配置项', mask: true })
      try {
        // Radio/Checkbox 的 Data 允许为空并由 SQL、数据源或接口引擎实时供数。
        // 批量编辑器复用普通表单的同一加载器，确保水质要求、加热方式等字段先有选项再渲染。
        await hydrateNativeFormOptions(this.definition, this.proposalBatchControlForm, {
          menuId: this.menuId,
          moduleEngineKey: this.config.moduleEngineKey,
          tableChildAuth: this.tableChildAuth,
          timeoutMs: 8000
        })
        this.proposalBatchEditorOpen = true
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '配置项加载失败，请稍后重试', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.proposalBatchOptionsLoading = false
      }
    },
    closeProposalInstallationBatchEditor() {
      if (this.proposalBatchSubmitting) return
      this.proposalBatchEditorOpen = false
    },
    proposalBatchValueEmpty(value) {
      if (value === null || value === undefined || value === '') return true
      if (Array.isArray(value)) return value.length === 0
      if (typeof value === 'object') return Object.keys(value).length === 0
      return false
    },
    async submitProposalInstallationBatch() {
      if (!this.proposalBatchCanSubmit) {
        const title = this.proposalBatchHasPendingUploads
          ? '请等待文件上传完成'
          : (this.proposalBatchEnabledCount ? '请至少选择两个安装点位' : '请先勾选要统一修改的字段')
        uni.showToast({ title, icon: 'none' })
        return
      }
      const enabledFields = this.proposalBatchFields.filter((field) => this.proposalBatchFieldEnabled(field))
      const invalid = enabledFields.find((field) => field.required && this.proposalBatchValueEmpty(this.proposalBatchForm[field.Name]))
      if (invalid) {
        uni.showToast({ title: `${invalid.Label || invalid.Name}不能为空`, icon: 'none' })
        return
      }
      if (!(await this.confirmAction(`确定将 ${enabledFields.length} 个字段统一配置到 ${this.proposalBatchSelectedRows.length} 个点位吗？`))) return

      const rows = this.proposalBatchSelectedRows
      const patches = proposalInstallationBatchPatch(
        this.proposalBatchForm,
        this.proposalBatchEnabled,
        this.proposalBatchDependencies
      )
      if (!this.proposalBatchRequestId) {
        this.proposalBatchRequestId = `batch-${createProposalInstallationId().replace(/-/g, '')}`
      }
      this.proposalBatchSubmitting = true
      uni.showLoading({ title: '正在统一配置', mask: true })
      try {
        const result = await V8.ApiEngine.Run(PROPOSAL_INSTALLATION_BATCH_ENGINE, {
          Action: 'BatchUpdate',
          RequestId: this.proposalBatchRequestId,
          ParentId: this.relationValue,
          // 接口引擎中的 .NET 集合不是标准 JavaScript Array/Object；显式 JSON 化可避免
          // 微信端、HTTP 参数绑定和 Jint 三端对嵌套参数产生不同判定。
          Ids: JSON.stringify(rows.map((row) => row.Id)),
          Versions: JSON.stringify(rows.map((row) => ({ Id: row.Id, UpdateTime: row.UpdateTime || '' }))),
          Patches: JSON.stringify(patches)
        })
        if (!result || Number(result.Code) !== 1) {
          this.proposalBatchRequestId = ''
          throw new Error(result?.Msg || '安装点位批量配置失败')
        }
        const updated = Number(result.Data?.Updated || rows.length)
        this.proposalBatchEditorOpen = false
        this.proposalBatchSelecting = false
        this.proposalBatchSelection = []
        this.resetProposalBatchFields()
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
        uni.showToast({ title: `已统一配置 ${updated} 个点位`, icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '安装点位批量配置失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.proposalBatchSubmitting = false
      }
    },
    isProposalSelected(row) {
      return Boolean(row && row.Id) && this.proposalSelection.some((item) => String(item.Id) === String(row.Id))
    },
    toggleProposal(row) {
      if (!row || !row.Id) return
      const index = this.proposalSelection.findIndex((item) => String(item.Id) === String(row.Id))
      if (index >= 0) this.proposalSelection.splice(index, 1)
      else this.proposalSelection.push(row)
    },
    toggleAllProposals() {
      if (this.areAllProposalsSelected) {
        const visibleIds = new Set(this.rows.map((row) => String(row.Id)))
        this.proposalSelection = this.proposalSelection.filter((item) => !visibleIds.has(String(item.Id)))
        return
      }
      const selectedIds = new Set(this.proposalSelection.map((item) => String(item.Id)))
      this.rows.forEach((row) => {
        if (row && row.Id && !selectedIds.has(String(row.Id))) this.proposalSelection.push(row)
      })
    },
    async compareProposals() {
      if (this.proposalComparing) return
      if (this.proposalSelection.length < 2) {
        uni.showToast({ title: '请至少选择两个方案', icon: 'none' })
        return
      }
      this.proposalComparing = true
      try {
        const ids = this.proposalSelection.map((item) => item.Id).filter(Boolean).join(',')
        await new Promise((resolve, reject) => uni.navigateTo({
          url: `/pages/business/proposal-compare?ids=${encodeURIComponent(ids)}`,
          success: resolve,
          fail: reject
        }))
      } catch (error) {
        uni.showToast({ title: error.message || '打开比价失败', icon: 'none' })
      } finally {
        this.proposalComparing = false
      }
    },
    noop() {},
    refreshData() {
      if (!this.relationValue || !this.config.table) return Promise.resolve()
      return Promise.all([this.loadData(true, true, false, true), this.loadRelatedMetrics(true)])
    },
    async hydrateProposalInstallationPointRows(rows = []) {
      if (!this.isProposalInstallationQuickMode || !rows.length) return rows
      // zhy：安装点位列表接口会按列表契约裁剪字段，而编辑页 GetFormData 返回完整表单。
      // 卡片只展示两条，逐条补齐详情可确保型号、名称、人数与编辑页保存值一致。
      return Promise.all(rows.map(async (row) => {
        if (!row?.Id) return row
        try {
          const detail = await V8.FormEngine.GetFormData(this.config.table, {
            Id: row.Id,
            ...(this.menuId ? { _SysMenuId: this.menuId } : {}),
            ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {})
          })
          return detail && Number(detail.Code) === 1 && detail.Data
            ? { ...row, ...detail.Data, Id: detail.Data.Id || row.Id }
            : row
        } catch (error) {
          return row
        }
      }))
    },
    proposalInstallationDefinitionField(key, label) {
      const expectedName = PROPOSAL_INSTALLATION_FIELDS[key]
      return (this.definition?.fields || []).find((item) =>
        String(item.Name || '').toLowerCase() === String(expectedName || '').toLowerCase()
      ) || (this.definition?.fields || []).find((item) => String(item.Label || '').trim() === label) || null
    },
    proposalPointCanEdit(row) {
      if (this.proposalDraftGroup) return this.canAdd
      return Boolean(canEditMenuRecord(this.menuId || this.childMenuId, this.currentUser))
    },
    proposalPointCanDelete(row) {
      if (this.proposalDraftGroup) return this.canAdd
      return Boolean(canDeleteMenuRecord(this.menuId || this.childMenuId, this.currentUser))
    },
    proposalPointValueEmpty(value) {
      return value === undefined || value === null || value === ''
    },
    proposalPointDisplayValue(row, item) {
      const value = row && row[item.name]
      if (!this.proposalPointValueEmpty(value)) return value
      return item.key === 'deviceName' ? '选择设备型号后自动带出' : '-'
    },
    updateProposalPointValue(row, name, value) {
      if (!row || !name) return
      row[name] = value
      if (this.proposalDraftGroup) this.syncProposalDraftRows()
    },
    async selectProposalPointDevice(row, selection = {}) {
      const values = proposalInstallationDeviceValues(selection)
      const names = this.proposalInstallationFieldNames
      row[names.deviceModel] = values[PROPOSAL_INSTALLATION_FIELDS.deviceModel]
      row[names.deviceName] = values[PROPOSAL_INSTALLATION_FIELDS.deviceName]
      if (names.deviceModelId) {
        row[names.deviceModelId] = values[PROPOSAL_INSTALLATION_FIELDS.deviceModelId]
      }
      await this.saveProposalPoint(row)
    },
    saveProposalPointField(row, name, value) {
      this.updateProposalPointValue(row, name, value)
      return this.saveProposalPoint(row)
    },
    openProposalPointEdit(row) {
      if (!row?.Id) return
      openForm({
        table: this.config.table,
        rowId: row.Id,
        mode: 'Edit',
        title: `编辑${this.config.title || this.sectionTitle}`,
        menuId: this.menuId,
        menuAliases: this.config.menuAliases || [],
        tableChildAuth: this.tableChildAuth,
        includeRelated: !this.proposalDraftGroup,
        draftRelation: this.proposalDraftGroup?.key || ''
      })
    },
    proposalPointCopyValues(row) {
      return proposalInstallationCopyValues(row, this.definition?.fields || [])
    },
    proposalPointWriteEnvelope(row, id, copyAllFields = false) {
      const quickValues = proposalInstallationWriteValues(row, this.proposalInstallationFieldNames)
      const values = copyAllFields
        ? { ...this.proposalPointCopyValues(row), ...quickValues }
        : quickValues
      const defaults = this.callbackDefaults()
      return {
        FormEngineKey: this.config.table,
        Id: id,
        ...(this.menuId ? { _SysMenuId: this.menuId } : {}),
        ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
        _InvokeType: 'Client',
        _RowModel: { ...values, ...defaults, Id: id }
      }
    },
    async saveProposalPoint(row) {
      if (!row?.Id || !this.proposalPointCanEdit(row)) return
      if (this.proposalDraftGroup) {
        this.syncProposalDraftRows()
        return
      }
      const id = String(row.Id)
      this.proposalPointSavingId = id
      try {
        const values = proposalInstallationWriteValues(row, this.proposalInstallationFieldNames)
        const result = await V8.FormEngine.UptFormData(this.config.table, {
          Id: id,
          ...values,
          ...(this.menuId ? { _SysMenuId: this.menuId } : {}),
          ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
          _InvokeType: 'Client'
        })
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '安装点位保存失败')
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '安装点位保存失败', icon: 'none' })
      } finally {
        this.proposalPointSavingId = ''
      }
    },
    async copyProposalPoint(row) {
      if (!row?.Id || this.proposalPointSavingId) return
      const id = createProposalInstallationId()
      if (this.proposalDraftGroup) {
        this.rows = [{ ...JSON.parse(JSON.stringify(row)), Id: id }, ...this.rows]
        this.syncProposalDraftRows()
        return
      }
      this.proposalPointSavingId = id
      uni.showLoading({ title: '正在复制', mask: true })
      try {
        const result = await V8.FormEngine.AddFormData(this.proposalPointWriteEnvelope(row, id, true))
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '安装点位复制失败')
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
        const copied = this.rows.find((item) => String(item.Id) === id) || { ...row, Id: id }
        this.rows = [copied, ...this.rows.filter((item) => String(item.Id) !== id)]
        uni.showToast({ title: '复制成功', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '安装点位复制失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.proposalPointSavingId = ''
      }
    },
    async deleteProposalPoint(row) {
      if (!row?.Id || this.proposalPointSavingId) return
      if (!(await this.confirmAction('删除后无法恢复，是否继续？'))) return
      if (this.proposalDraftGroup) {
        this.proposalDraftGroup.deleted.add(String(row.Id))
        this.rows = this.rows.filter(item => String(item.Id) !== String(row.Id))
        this.syncProposalDraftRows()
        return
      }
      this.proposalPointSavingId = String(row.Id)
      uni.showLoading({ title: '正在删除', mask: true })
      try {
        const result = await V8.FormEngine.DelFormData({
          FormEngineKey: this.config.table,
          Id: row.Id,
          ...(this.menuId ? { _SysMenuId: this.menuId } : {}),
          ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
          _InvokeType: 'Client'
        })
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '安装点位删除失败')
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
        uni.showToast({ title: '删除成功', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '安装点位删除失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.proposalPointSavingId = ''
      }
    },
    clearLayoutMeasureTimers() {
      this.layoutMeasureTimers.forEach((timer) => clearTimeout(timer))
      this.layoutMeasureTimers = []
    },
    scheduleListBodyMeasure() {
      if (!this.independentScroll || this.isPreview) return
      this.clearLayoutMeasureTimers()
      this.layoutMeasureTimers = [0, 80, 220].map((delay) => setTimeout(() => {
        this.measureListBody()
      }, delay))
    },
    measureListBody() {
      if (!this.independentScroll || this.isPreview || typeof uni.createSelectorQuery !== 'function') return
      this.$nextTick(() => {
        const query = uni.createSelectorQuery().in(this)
        query.select('.related-business-list').boundingClientRect()
        query.select('.related-list-body').boundingClientRect()
        query.exec((rects = []) => {
          const root = rects[0]
          const body = rects[1]
          if (!root || !body) return
          const height = Math.floor(Number(root.bottom) - Number(body.top))
          if (Number.isFinite(height) && height >= 80 && height !== this.listBodyHeight) {
            this.listBodyHeight = height
          }
        })
      })
    },
    async initialize(refresh = false) {
      this.presentationRequestId += 1
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
          tableChildAuth: this.tableChildAuth,
          tableModel: this.table
        })
        const matched = this.resolveBusinessModule(this.table.Name)
        this.moduleKey = matched.key
        const menu = await findMenu(
          matched.config.menuAliases || [],
          this.table.Name,
          refresh,
          this.childMenuId,
          this.table.Id
        )
        this.menu = menu || null
        this.menuId = menu?.Id || this.childMenuId || ''
        const menuConfig = menu
          ? createMenuModuleDefinition(menu, this.definition, this.table)
          : null
        const platformCardConfig = menuConfig
          ? {
              title: menuConfig.title,
              definition: menuConfig.definition,
              titleField: menuConfig.titleField,
              statusField: menuConfig.statusField,
              statusOptions: menuConfig.statusOptions,
              tagFields: menuConfig.tagFields,
              bottomFields: menuConfig.bottomFields,
              hasConfiguredCardFields: menuConfig.hasConfiguredCardFields,
              hasConfiguredMobileFields: menuConfig.hasConfiguredMobileFields,
              hasConfiguredTagFields: menuConfig.hasConfiguredTagFields,
              hasConfiguredBottomFields: menuConfig.hasConfiguredBottomFields,
              cardFields: menuConfig.cardFields,
              lines: menuConfig.lines
            }
          : {}
        this.config = {
          ...matched.config,
          ...platformCardConfig,
          menu,
          table: this.table.Name,
          tableId: this.table.Id,
          menuId: this.menuId,
          moduleEngineKey: menu?.ModuleEngineKey || ''
        }
        this.emitTitleChange()
        this.applyMenuSearchFields(menu?.SearchFieldIds)
        if (this.waitingForParentSave) {
          this.rows = []
          this.count = 0
          this.finished = true
          this.loading = false
          return
        }
        // 展示配置与关联数据并行加载。完整菜单或 ViewSchema 暂时不可用时，
        // 先用当前授权菜单的本地编译结果展示数据，不能让配置请求把页面卡在骨架屏。
        void this.loadPresentationConfig(refresh)
        await Promise.all([this.loadData(true, refresh, false, true), this.loadRelatedMetrics(refresh)])
        if (String(this.batchEntryMode || '').toLowerCase() === 'installation-batch' && this.proposalInstallationBatchAvailable) {
          this.startProposalInstallationBatchSelection()
        }
        this.scheduleListBodyMeasure()
      } catch (error) {
        this.error = error.message || error.Msg || '关联数据加载失败'
        this.loading = false
      }
    },
    applyCardPresentationConfig(menuConfig) {
      if (!menuConfig || String(menuConfig.table || '').toLowerCase() !== String(this.table?.Name || '').toLowerCase()) return
      const presentationFields = [
        'menu', 'definition', 'titleField', 'title', 'statusField', 'statusOptions', 'tagFields',
        'bottomFields', 'hasConfiguredCardFields', 'hasConfiguredMobileFields',
        'hasConfiguredTagFields', 'hasConfiguredBottomFields', 'cardFields', 'lines',
        'selectFields', 'summaryField', 'imageField', 'periodField'
      ]
      const next = { ...this.config }
      presentationFields.forEach((name) => {
        if (menuConfig[name] !== undefined) next[name] = menuConfig[name]
      })
      // 与普通业务列表保持一致：后台菜单字段完整接管卡片后不再使用租户摘要占位。
      next.summaryField = ''
      this.config = next
      this.emitTitleChange()
    },
    emitTitleChange() {
      const title = String(this.config?.title || this.menu?.Name || this.sectionTitle || '').trim()
      if (title) this.$emit('title-change', title)
    },
    async loadPresentationConfig(refresh = false) {
      const requestId = ++this.presentationRequestId
      let manifestRefresh = refresh
      try {
        if (this.menuId) {
          // 客户详情可能在后台配置更新前已打开，展示配置必须主动刷新；
          // 数据查询仍并行执行，因此刷新元数据不会让列表停留在骨架屏。
          const menuConfig = await loadModuleDefinition(this.menuId, true, { includeHidden: true })
          if (requestId !== this.presentationRequestId) return
          this.applyCardPresentationConfig(menuConfig)
          manifestRefresh = true
        }
      } catch (error) {
        // 子表菜单仍负责权限；完整展示配置失败时保留初始化阶段的安全回退配置。
      }
      if (requestId !== this.presentationRequestId) return
      await this.loadViewConfig(manifestRefresh, requestId)
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
      const lines = fields.filter((field) => field !== titleField).map((field) => ({
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
    async loadViewConfig(refresh = false, expectedRequestId = 0) {
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
        if (expectedRequestId && expectedRequestId !== this.presentationRequestId) return
        this.applyMenuSearchFields(manifest?.Legacy?.SearchFieldIds)
        const dynamic = compileListConfig(manifest, this.definition?.fields || [])
        if (!dynamic) return
        this.viewManifest = manifest
        const merged = { ...this.config }
        if (!merged.hasConfiguredMobileFields && dynamic.lines?.length) merged.lines = dynamic.lines
        if (!merged.hasConfiguredMobileFields && dynamic.bottomFields?.length) merged.bottomFields = dynamic.bottomFields
        if (dynamic.tagsFromViewSchema) merged.tagFields = dynamic.tagFields || []
        ;['titleField', 'statusField', 'summaryField', 'periodField'].forEach((name) => {
          if (name === 'titleField' && merged.hasConfiguredMobileFields) return
          if (merged.hasConfiguredCardFields && name === 'summaryField') return
          if (dynamic[name] !== undefined && dynamic[name] !== null && dynamic[name] !== '') merged[name] = dynamic[name]
        })
        if (dynamic.statusFromViewSchema) {
          merged.statusField = dynamic.statusField || ''
          merged.statusOptions = dynamic.statusOptions || []
        }
        merged.selectFields = [...new Set([
          ...(merged.selectFields || []),
          ...(dynamic.requiredFields || [])
        ].filter(Boolean))]
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
    relatedSelectFields() {
      // TableChild 授权查询仍由 _TableChildAuth 限定父记录范围；这里只补齐当前子菜单
      // 卡片实际引用的字段，避免服务端按 SelectFields 裁剪掉 MobileListFields 中的列。
      return [...new Set([
        ...(this.config.selectFields || []),
        ...(this.isCollectionCardLayout ? [
          this.presentation.titleField,
          this.presentation.subtitleField,
          this.presentation.imageField,
          ...(this.presentation.lineFields || []).map((item) => item && item.field)
        ] : []),
        this.childFkField,
        'Id',
        'CreateTime',
        'UpdateTime'
      ].filter(Boolean))]
    },
    latestSummaryValue(item) {
      const value = this.latestSummaryRow?.[item.field]
      if (value === undefined || value === null || value === '') return '—'
      if (item.format) return formatFieldValue(value, item.format)
      const field = (this.definition?.fields || []).find((entry) => entry.Name === item.field)
      return field ? fieldDisplayValue(field, value) : formatFieldValue(value)
    },
    async loadLatestRecordSummary() {
      const requestId = ++this.latestSummaryRequestId
      const relationValue = this.relationValue
      this.latestSummaryRow = null
      this.latestSummaryError = ''
      this.latestSummaryLoading = false
      if (!this.latestSummaryEnabled || !relationValue || !this.childFkField || !this.config.table) return
      this.latestSummaryLoading = true
      // 摘要与列表筛选、分页完全独立；权限沿用同一父子授权链，不能扩大到其他客户。
      const authorization = this.tableChildAuth
        ? { _TableChildAuth: this.tableChildAuth }
        : (this.menuId ? { _SysMenuId: this.menuId } : {})
      const isCurrent = () => requestId === this.latestSummaryRequestId && relationValue === this.relationValue
      try {
        const result = await V8.FormEngine.GetTableData(this.config.table, {
          ...authorization,
          _Where: [{ Name: this.childFkField, Type: '=', Value: relationValue }],
          _PageIndex: 1,
          _PageSize: 1,
          _OrderBy: 'CreateTime',
          _OrderByType: 'DESC',
          _OrderBys: { CreateTime: 'DESC', Id: 'DESC' },
          _SelectFields: ['Id', 'CreateTime']
        })
        if (!isCurrent()) return
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '最新信息加载失败')
        const row = Array.isArray(result.Data) ? result.Data[0] : null
        if (!row?.Id) return
        // 列表接口可能裁剪成本字段，按最新 Id 读取完整详情，保持摘要与详情的数据口径一致。
        const detail = await V8.FormEngine.GetFormData(this.config.table, { ...authorization, Id: row.Id })
        if (!isCurrent()) return
        if (!detail || Number(detail.Code) !== 1 || !detail.Data) {
          throw new Error(detail?.Msg || '最新信息加载失败')
        }
        this.latestSummaryRow = { ...detail.Data, Id: row.Id }
      } catch (error) {
        if (isCurrent()) this.latestSummaryError = error.message || error.Msg || '最新信息加载失败'
      } finally {
        if (isCurrent()) {
          this.latestSummaryLoading = false
          this.scheduleListBodyMeasure()
        }
      }
    },
    async loadData(reset = false, refresh = false, notifyCount = false, refreshSummary = notifyCount) {
      if (this.proposalDraftGroup) {
        this.rows = [...this.proposalDraftGroup.rows]
        this.count = this.rows.length
        this.loading = false
        this.finished = true
        this.error = ''
        if (notifyCount) this.emitDataCount()
        return
      }
      if (!this.relationValue || !this.config.table || (this.loading && !reset) || (!reset && this.finished)) return
      // 首次进入、返回刷新和真实增删改才回读摘要；搜索、筛选、翻页沿用当前摘要。
      const latestSummaryTask = refreshSummary ? this.loadLatestRecordSummary() : null
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
            _SelectFields: this.relatedSelectFields(),
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
        const rawIncomingRows = Array.isArray(result.rows) ? result.rows : []
        let incomingRows = this.moduleKey === 'installationPositions'
          ? await hydrateInstallationPositionRows(rawIncomingRows)
          : rawIncomingRows
        incomingRows = await this.hydrateProposalInstallationPointRows(incomingRows)
        incomingRows = await this.hydrateCollectionRows(incomingRows)
        // Keep the newest completed response. A later request starting must not discard every
        // usable response and leave the related tab permanently displaying its skeleton.
        if (requestId < this.appliedRequestId) return
        this.appliedRequestId = requestId
        const combinedRows = uniqueRowsById(reset ? incomingRows : [...this.rows, ...incomingRows])
        const combinedSourceCount = reset ? incomingRows.length : this.rows.length + incomingRows.length
        this.duplicateRowCount += Math.max(0, combinedSourceCount - combinedRows.length)
        this.rows = combinedRows
        this.count = Math.max(this.rows.length, Number(result.count || 0) - this.duplicateRowCount)
        this.finished = this.rows.length >= this.count || incomingRows.length < pageSize
        if (!this.finished) this.pageIndex += 1
        if (notifyCount) this.emitDataCount()
      } catch (error) {
        if (requestId >= this.appliedRequestId) this.error = error.message || error.Msg || '关联数据加载失败'
      } finally {
        await latestSummaryTask
        this.loading = false
      }
    },
    monthRange() {
      const now = new Date()
      const pad = (value) => String(value).padStart(2, '0')
      const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01 00:00:00`
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      const end = `${next.getFullYear()}-${pad(next.getMonth() + 1)}-01 00:00:00`
      return { start, end }
    },
    formatRelatedMetric(value, metric) {
      const numeric = Number(value || 0)
      if (metric.format !== 'compactMoney') return Number.isFinite(numeric) ? Math.floor(numeric) : 0
      const absolute = Math.abs(numeric)
      if (absolute >= 10000) return `¥${(numeric / 10000).toFixed(absolute >= 100000 ? 0 : 1).replace(/\.0$/, '')}万`
      return `¥${numeric.toLocaleString()}`
    },
    async loadRelatedMetrics(refresh = false) {
      if (this.proposalDraftGroup) return
      const metrics = this.relatedMetricDefinitions
      if (!metrics.length || !this.relationValue || !this.config.table) return
      this.metricLoading = true
      const range = this.monthRange()
      const baseWhere = [
        { Name: this.childFkField, Type: '=', Value: this.relationValue },
        ...(this.config.fixedWhere || [])
      ]
      try {
        const values = {}
        await Promise.all(metrics.map(async (metric) => {
          const where = [...baseWhere, ...(metric.where || [])]
          if (metric.monthField) {
            where.push({ Name: metric.monthField, Type: '>=', Value: range.start })
            where.push({ Name: metric.monthField, Type: '<', Value: range.end })
          }
          if (metric.aggregateField) {
            const summary = await loadModuleRows(this.config, {
              pageIndex: 1,
              pageSize: 1,
              refresh,
              cacheAge: 0,
              tableChildAuth: this.tableChildAuth,
              extraWhere: where
            })
            values[metric.key] = Number(statisticsFieldValue(summary.append, metric.aggregateField, 0)) || 0
            return
          }
          const payload = {
            _PageIndex: 1,
            _PageSize: 1,
            _Where: where,
            _TableChildAuth: this.tableChildAuth
          }
          const response = await V8.FormEngine.GetTableData(this.config.table, payload)
          if (!response || Number(response.Code) !== 1) throw new Error(response?.Msg || '统计加载失败')
          values[metric.key] = Number(response.DataCount || 0)
        }))
        this.metricValues = values
      } catch (error) {
        // 统计失败不阻断关联列表，保留可读的零值并允许下次数据刷新重试。
        this.metricValues = metrics.reduce((values, metric) => ({ ...values, [metric.key]: 0 }), {})
      } finally {
        this.metricLoading = false
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
    openProposalInstallationBatch() {
      this.openRelatedList('installation-batch')
    },
    openMore() {
      this.openRelatedList('')
    },
    openRelatedList(entryMode = '') {
      const navigation = this.relatedListNavigation(entryMode)
      uni.navigateTo({
        url: navigation.url,
        success: (result) => result.eventChannel?.emit('related-list-context', navigation.context)
      })
    },
    relatedListNavigation(entryMode = '') {
      const query = [
        `fieldId=${encodeURIComponent(this.field.Id || '')}`,
        `parentId=${encodeURIComponent(this.parentId || '')}`,
        `parentMenuId=${encodeURIComponent(this.parentMenuId || '')}`,
        `parentTableId=${encodeURIComponent(this.parentTableId || '')}`,
        `parentTableName=${encodeURIComponent(this.parentTableName || '')}`,
        `relationValue=${encodeURIComponent(this.relationValue || '')}`,
        `parentTableChildAuth=${encodeURIComponent(JSON.stringify(this.parentTableChildAuth || null))}`,
        `title=${encodeURIComponent(this.config.title || this.sectionTitle || '关联列表')}`,
        `entryMode=${encodeURIComponent(entryMode || '')}`
      ].join('&')
      // 折叠后预览组件会卸载，外层标题栏保留同一份导航上下文，仍可直接进入完整子表。
      return {
        url: `/pages/business/related-list?${query}`,
        context: {
          field: this.field,
          parentId: this.parentId,
          parentForm: this.parentForm,
          parentMenuId: this.parentMenuId,
          parentTableId: this.parentTableId,
          parentTableName: this.parentTableName,
          parentMode: this.parentMode,
          parentTableChildAuth: this.parentTableChildAuth,
          relationValue: this.relationValue,
          title: this.config.title || this.sectionTitle,
          entryMode
        }
      }
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
            const result = await post('/apiengine/platform-sys-base-data?Action=GetSysBaseData', { ParentKey: field.parentKey }, true)
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
    isCustomerOrderList() {
      // 该组件只负责详情页关联列表。实际客户详情没有传 parentTableName，
      // 因此直接以已授权的订单子表识别，不能再让缺失的父表参数使规则失效。
      const tableName = this.config.table || this.table?.Name || ''
      return String(tableName).toLowerCase() === 'diy_dingdan'
    },
    effectiveTitleField() {
      // 客户详情订单卡片禁止使用订单编号作为标题。即使旧缓存或旧 ViewSchema
      // 仍返回 DingdanBH，也只能在正文“订单编号”一行展示。
      return this.isCustomerOrderList() ? 'KehuMC' : this.config.titleField
    },
    getTitle(row) {
      const titleField = this.effectiveTitleField()
      const configured = this.configuredFieldValue(row, titleField)
      if (configured && configured !== '-') return configured
      if (this.isCustomerOrderList()) {
        const parentCustomerName = this.configuredFieldValue(this.parentForm || {}, 'KehuMC')
        return parentCustomerName && parentCustomerName !== '-' ? parentCustomerName : '订单'
      }
      const fallback = ['Name', 'Title', 'Biaoti', 'KehuMC', 'DingdanBH', 'ShouhouFWBH', 'Xingming']
        .find((field) => row[field])
      return fallback ? this.configuredFieldValue(row, fallback) : `记录 ${String(row.Id || '').slice(-6)}`
    },
    getStatus(row) {
      if (this.moduleKey === 'customerAddresses') {
        const defaultAddressCode = String(this.parentForm?.AddressBH || '')
        if (defaultAddressCode && String(row.AddressBH || '') === defaultAddressCode) return '默认地址'
      }
      const value = this.config.statusField
        ? this.configuredFieldValue(row, this.config.statusField)
        : ''
      return value === '-' ? '' : value
    },
    getStatusClass(row) {
      const text = String(this.getStatus(row))
      if (/完成|结束|正常|合作|通过|审批/.test(text)) return 'is-success'
      if (/取消|作废|驳回|故障|超时/.test(text)) return 'is-danger'
      if (/待|处理中|跟进|预约/.test(text)) return 'is-warning'
      return 'is-info'
    },
    getTags(row) {
      const usedFields = new Set([
        cardFieldKey(this.effectiveTitleField()),
        cardFieldKey(this.config.statusField)
      ].filter(Boolean))
      return (this.config.tagFields || []).filter((field) => {
        const key = cardFieldKey(field)
        if (!key || usedFields.has(key)) return false
        usedFields.add(key)
        return true
      })
        .map((field) => this.configuredFieldValue(row, field))
        .filter((value) => value && value !== '-')
        .slice(0, 3)
    },
    visibleLines(row) {
      return filterVisibleCardLines(this.config.lines || [], row, [
        this.effectiveTitleField(),
        this.config.statusField,
        this.config.summaryField,
        ...(this.config.tagFields || [])
      ])
    },
    fieldDefinition(name) {
      return (this.config.definition?.fields || []).find((field) => field.Name === name)
    },
    configuredFieldValue(row, name, format = '') {
      const field = this.fieldDefinition(name)
      return field
        ? fieldDisplayValue(field, row[name])
        : formatFieldValue(row[name], format, { empty: '' })
    },
    cardLines(row) {
      return this.visibleLines(row).map((line) => ({
        ...line,
        value: this.configuredFieldValue(row, line.field, line.format),
        rawValue: row[line.field],
        // zhy：动态清单把摘要字段作为普通行返回时，限制为配置的最大行数。
        maxLines: String(line.field || '').toLowerCase() === String(this.config.summaryField || '').toLowerCase()
          ? (Number(this.config.summaryLines) || 3)
          : (Number(line.maxLines) || 1)
      }))
    },
    summaryValue(row) {
      // zhy：摘要已经作为带标签字段行展示时，不在卡片底部重复输出。
      const summaryField = String(this.config.summaryField || '').toLowerCase()
      const renderedAsLine = this.visibleLines(row).some((line) => String(line.field || '').toLowerCase() === summaryField)
      return renderedAsLine ? '' : this.configuredFieldValue(row, this.config.summaryField)
    },
    cardBottomText(row) {
      try {
        const values = (this.config.bottomFields || [])
          .map((item) => {
            const descriptor = typeof item === 'string' ? { field: item } : (item || {})
            if (!descriptor.field) return ''
            return this.configuredFieldValue(row, descriptor.field, descriptor.format)
          })
          .filter((value) => value && value !== '-')
        if (values.length) return values.join(' · ')
      } catch (error) {}
      return this.config.hasConfiguredMobileFields
        ? ''
        : this.formatCreateTime(row.CreateTime || row.UpdateTime)
    },
    collectionTitle(row) {
      return this.configuredFieldValue(row, this.presentation.titleField) || '客户案例'
    },
    collectionSubtitle(row) {
      return this.configuredFieldValue(row, this.presentation.subtitleField)
    },
    collectionLines(row) {
      return (this.presentation.lineFields || []).map((item) => ({
        ...item,
        value: this.configuredFieldValue(row, item.field, item.format)
      })).filter((item) => item.field && item.value && item.value !== '-')
    },
    collectionPhotos(row) {
      return Array.isArray(row && row._collectionPhotos) ? row._collectionPhotos : []
    },
    async hydrateCollectionRows(rows = []) {
      if (!this.isCollectionCardLayout || !this.presentation.imageField) return rows
      const imageFieldName = String(this.presentation.imageField)
      const field = (this.definition?.fields || []).find((item) =>
        String(item.Name || '').toLowerCase() === imageFieldName.toLowerCase()
      )
      const sysMenuId = this.menuId || this.childMenuId
      if (!field?.Id || !sysMenuId) return rows.map((row) => ({ ...row, _collectionPhotos: [] }))
      return Promise.all(rows.map(async (row) => {
        const paths = V8.normalizeUploadValue(row[imageFieldName])
        const context = {
          formEngineKey: this.config.table,
          formDataId: row.Id,
          fieldId: field.Id,
          sysMenuId,
          tableChildAuth: this.tableChildAuth
        }
        const photos = await Promise.all(paths.slice(0, 10).map((path) =>
          V8.resolveFileUrl(path, context).catch(() => '')
        ))
        return { ...row, _collectionPhotos: photos.filter(Boolean) }
      }))
    },
    collectionCanRemove(row) {
      if (!row?.Id || String(this.parentMode || '').toLowerCase() === 'view') return false
      const policy = String(this.presentation.removePermission || 'child-delete').toLowerCase()
      if (policy === 'parent-edit') {
        return Boolean(canEditMenuRecord(this.parentMenuId, this.currentUser))
      }
      return Boolean(canDeleteMenuRecord(this.menuId || this.childMenuId, this.currentUser))
    },
    async removeCollectionRow(row) {
      if (!this.collectionCanRemove(row) || this.collectionDeletingId) {
        if (!this.collectionCanRemove(row)) uni.showToast({ title: '当前账号没有移除权限', icon: 'none' })
        return
      }
      const title = this.collectionTitle(row)
      if (!(await this.confirmAction(`确定将“${title}”移出${this.presentation.title || this.sectionTitle}吗？`))) return
      this.collectionDeletingId = String(row.Id)
      uni.showLoading({ title: '正在移除', mask: true })
      try {
        const policy = String(this.presentation.removePermission || 'child-delete').toLowerCase()
        const payload = {
          FormEngineKey: this.config.table,
          Id: row.Id,
          ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
          ...(policy !== 'parent-edit' && (this.menuId || this.childMenuId)
            ? { _SysMenuId: this.menuId || this.childMenuId }
            : {}),
          _InvokeType: 'Client'
        }
        const result = await V8.FormEngine.DelFormData(payload)
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '移除失败')
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
        uni.showToast({ title: '已移出', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '移除失败', icon: 'none' })
      } finally {
        uni.hideLoading()
        this.collectionDeletingId = ''
      }
    },
    collectionSourceId(item) {
      return String(item && item.Id || '')
    },
    collectionSourceSelected(item) {
      const id = this.collectionSourceId(item)
      return Boolean(id) && this.collectionSelectedIds.includes(id)
    },
    collectionSourceTitle(item) {
      const field = this.collectionPickerConfig.titleField || 'Name'
      return this.configuredFieldValue(item, field) || '未命名记录'
    },
    collectionSourceSubtitle(item) {
      const fields = this.collectionPickerConfig.subtitleFields || []
      for (const field of (Array.isArray(fields) ? fields : [fields])) {
        const value = this.configuredFieldValue(item, field)
        if (value && value !== '-') return value
      }
      return this.collectionPickerConfig.emptySubtitle || '未关联客户'
    },
    collectionSourceAlreadyAdded(item) {
      const pairs = Array.isArray(this.collectionPickerConfig.duplicateFields)
        ? this.collectionPickerConfig.duplicateFields
        : []
      if (!pairs.length) return false
      return this.rows.some((row) => pairs.every((pair) => {
        const sourceValue = item && item[pair.source]
        const targetValue = row && row[pair.target]
        return String(targetValue ?? '').trim() === String(sourceValue ?? '').trim()
      }))
    },
    toggleCollectionSource(item) {
      if (this.collectionSourceAlreadyAdded(item)) return
      const id = this.collectionSourceId(item)
      if (!id) return
      const index = this.collectionSelectedIds.indexOf(id)
      if (index >= 0) this.collectionSelectedIds.splice(index, 1)
      else this.collectionSelectedIds.push(id)
    },
    collectionMappedValue(item, sourceFields) {
      const fields = Array.isArray(sourceFields) ? sourceFields : [sourceFields]
      for (const field of fields) {
        const value = item && item[field]
        if (value !== undefined && value !== null && value !== '') return value
      }
      return ''
    },
    collectionSourceSelectFields() {
      const picker = this.collectionPickerConfig
      return [...new Set([
        'Id',
        picker.titleField,
        ...(Array.isArray(picker.subtitleFields) ? picker.subtitleFields : [picker.subtitleFields]),
        ...(picker.duplicateFields || []).map((item) => item && item.source),
        ...Object.values(picker.fieldMap || {}).flatMap((fields) => Array.isArray(fields) ? fields : [fields])
      ].filter(Boolean))]
    },
    collectionSourceSnapshot(item) {
      const result = {}
      Object.entries(this.collectionPickerConfig.fieldMap || {}).forEach(([target, sourceFields]) => {
        result[target] = this.collectionMappedValue(item, sourceFields)
      })
      Object.entries(this.collectionPickerConfig.userFields || {}).forEach(([target, sourceField]) => {
        result[target] = this.currentUser && this.currentUser[sourceField] || ''
      })
      return {
        ...result,
        ...this.callbackDefaults(),
        [this.childFkField]: this.relationValue
      }
    },
    openCollectionPicker() {
      this.collectionPickerOpen = true
      this.collectionSelectedIds = []
      if (!this.collectionSourceRows.length) this.searchCollectionSources()
    },
    closeCollectionPicker() {
      if (this.collectionAdding) return
      this.collectionPickerOpen = false
      this.collectionSelectedIds = []
    },
    clearCollectionSourceKeyword() {
      this.collectionSourceKeyword = ''
      this.searchCollectionSources()
    },
    async searchCollectionSources() {
      this.collectionSourcePage = 1
      this.collectionSourceRows = []
      await this.loadCollectionSources()
    },
    async loadMoreCollectionSources() {
      if (this.collectionSourceLoading || this.collectionSourceRows.length >= this.collectionSourceCount) return
      this.collectionSourcePage += 1
      await this.loadCollectionSources()
    },
    async loadCollectionSources() {
      if (this.collectionSourceLoading || !this.collectionPickerConfig.sourceTable) return
      this.collectionSourceLoading = true
      try {
        if (!this.collectionSourceMenuId) {
          const sourceMenu = await findMenu(
            this.collectionPickerConfig.menuAliases || [],
            this.collectionPickerConfig.sourceTable
          )
          this.collectionSourceMenuId = String(sourceMenu && sourceMenu.Id || '')
        }
        const result = await V8.FormEngine.GetTableData(this.collectionPickerConfig.sourceTable, {
          _Keyword: this.collectionSourceKeyword.trim(),
          _OrderBy: this.collectionPickerConfig.orderBy || 'UpdateTime',
          _OrderByType: this.collectionPickerConfig.orderByType || 'DESC',
          _PageIndex: this.collectionSourcePage,
          _PageSize: Number(this.collectionPickerConfig.pageSize || 20),
          _SelectFields: this.collectionSourceSelectFields(),
          ...(this.collectionSourceMenuId ? { _SysMenuId: this.collectionSourceMenuId } : {})
        })
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '可选记录加载失败')
        const incoming = Array.isArray(result.Data) ? result.Data : []
        this.collectionSourceRows = this.collectionSourcePage === 1
          ? incoming
          : uniqueRowsById(this.collectionSourceRows.concat(incoming))
        this.collectionSourceCount = Number(result.DataCount || this.collectionSourceRows.length)
      } catch (error) {
        if (this.collectionSourcePage > 1) this.collectionSourcePage -= 1
        uni.showToast({ title: error.message || error.Msg || '可选记录加载失败', icon: 'none' })
      } finally {
        this.collectionSourceLoading = false
      }
    },
    async addSelectedCollectionSources() {
      if (!this.collectionSelectedIds.length || this.collectionAdding) return
      const selected = this.collectionSourceRows.filter((item) =>
        this.collectionSelectedIds.includes(this.collectionSourceId(item)) && !this.collectionSourceAlreadyAdded(item)
      )
      if (!selected.length) {
        this.collectionSelectedIds = []
        uni.showToast({ title: '所选记录已收录', icon: 'none' })
        return
      }
      this.collectionAdding = true
      try {
        const batch = selected.map((item) => ({
          FormEngineKey: this.config.table,
          ...(this.menuId || this.childMenuId ? { _SysMenuId: this.menuId || this.childMenuId } : {}),
          ...(this.tableChildAuth ? { _TableChildAuth: this.tableChildAuth } : {}),
          _InvokeType: 'Client',
          _RowModel: this.collectionSourceSnapshot(item)
        }))
        const result = await V8.FormEngine.AddTableData(batch)
        if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '添加失败')
        this.collectionPickerOpen = false
        this.collectionSelectedIds = []
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
        uni.showToast({ title: `已添加 ${selected.length} 个案例`, icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || error.Msg || '添加失败', icon: 'none' })
      } finally {
        this.collectionAdding = false
      }
    },
    previewCollectionPhotos(row, index) {
      const urls = this.collectionPhotos(row)
      if (!urls.length) return
      uni.previewImage({ current: urls[index] || urls[0], urls })
    },
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
      const nativeActions = this.moduleKey
        ? getBusinessRowActions(this.moduleKey, row, this.currentUser, this.menuId || this.childMenuId)
        : []
      const nativeKeys = new Set(nativeActions.map((action) => String(action.key || '').toLowerCase()))
      const configuredViewActions = (this.config.actionSchema || [])
        .filter((action) => isActionVisible(action, row))
        .filter((action) => !nativeKeys.has(String(action.Key || '').toLowerCase()))
      const viewActions = appendStandardDeleteAction(nativeActions.concat(configuredViewActions), {
        row,
        user: this.currentUser,
        menuId: this.menuId || this.childMenuId,
        tableName: this.config.table,
        moduleEngineKey: this.config.moduleEngineKey || this.menu?.ModuleEngineKey || '',
        title: this.getTitle(row)
      }).filter((action) => !nativeActions.includes(action))
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
              ModuleEngineKey: this.config.moduleEngineKey || this.viewManifest?.Module?.ModuleEngineKey || ''
            },
            tableName: this.config.table,
            tableChildAuth: this.tableChildAuth,
            refreshData: () => Promise.all([
              this.loadData(true, true, true),
              this.loadRelatedMetrics(true)
            ]),
            refresh: () => this.refreshData()
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
      if (action.key === 'position-device') {
        this.actionSubmitting = true
        uni.showLoading({ title: '正在打开设备', mask: true })
        try {
          await openInstallationPositionDevice(row)
        } catch (error) {
          uni.showToast({ title: error.message || '设备详情打开失败', icon: 'none' })
        } finally {
          uni.hideLoading()
          this.actionSubmitting = false
        }
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
        await executeBusinessRowAction(action.key, row, input, this.currentUser, {
          menuId: this.menuId || this.childMenuId,
          moduleEngineKey: this.config.moduleEngineKey || this.menu?.ModuleEngineKey || '',
          tableChildAuth: this.tableChildAuth
        })
        this.activeAction = null
        this.activeRow = {}
        this.actionInput = ''
        this.approvalOpinions = []
        uni.showToast({ title: `${action.label}成功`, icon: 'success' })
        await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
      } catch (error) {
        uni.showToast({ title: error.message || `${action.label}失败`, icon: 'none' })
      } finally {
        uni.hideLoading()
        this.actionSubmitting = false
      }
    },
    callbackDefaults() {
      // zhy：同时读取新版 FieldRelations 和旧版 TableChildCallbackField，避免配置升级后客户名称默认值丢失。
      const result = buildTableChildDefaultValues({
        fieldConfig: this.fieldConfig,
        parentForm: this.parentForm,
        childFkField: this.childFkField,
        relationValue: this.relationValue
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
    async openAdd() {
      if (this.proposalPointSavingId) return
      if (!this.canAdd) {
        uni.showToast({ title: '当前账号没有新增权限', icon: 'none' })
        return
      }
      if (this.collectionPickerEnabled) {
        this.openCollectionPicker()
        return
      }
      if (this.isProposalInstallationQuickMode) {
        const id = createProposalInstallationId()
        const source = proposalInstallationDraft(id)
        const names = this.proposalInstallationFieldNames
        const draft = {
          Id: id,
          [names.place]: source[PROPOSAL_INSTALLATION_FIELDS.place],
          [names.deviceModel]: source[PROPOSAL_INSTALLATION_FIELDS.deviceModel],
          [names.deviceName]: source[PROPOSAL_INSTALLATION_FIELDS.deviceName],
          [names.deviceQuantity]: source[PROPOSAL_INSTALLATION_FIELDS.deviceQuantity],
          [names.people]: source[PROPOSAL_INSTALLATION_FIELDS.people]
        }
        if (names.deviceModelId) {
          draft[names.deviceModelId] = source[PROPOSAL_INSTALLATION_FIELDS.deviceModelId]
        }
        if (this.proposalDraftGroup) {
          this.rows = [{ ...draft, ...this.callbackDefaults() }, ...this.rows]
          this.syncProposalDraftRows()
          return
        }
        this.proposalPointSavingId = id
        uni.showLoading({ title: '正在新增', mask: true })
        try {
          const result = await V8.FormEngine.AddFormData(this.proposalPointWriteEnvelope(draft, id))
          if (!result || Number(result.Code) !== 1) throw new Error(result?.Msg || '安装点位新增失败')
          await Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
          const created = this.rows.find((item) => String(item.Id) === id) || draft
          this.rows = [created, ...this.rows.filter((item) => String(item.Id) !== id)]
          uni.showToast({ title: '新增成功，可直接填写', icon: 'success' })
        } catch (error) {
          uni.showToast({ title: error.message || error.Msg || '安装点位新增失败', icon: 'none' })
        } finally {
          uni.hideLoading()
          this.proposalPointSavingId = ''
        }
        return
      }
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
      const requestedMode = String(this.presentation.openMode || 'View')
      const mode = requestedMode === 'Edit' && canEditMenuRecord(this.menuId || this.childMenuId, this.currentUser)
        ? 'Edit'
        : 'View'
      openForm({
        table: this.config.table,
        rowId: row.Id,
        mode,
        title: `${mode === 'Edit' ? '编辑' : ''}${this.config.title || this.sectionTitle}${mode === 'View' ? '详情' : ''}`,
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
    syncProposalDraftRows() {
      const group = this.proposalDraftGroup
      if (!group) return
      group.rows = this.rows
      this.count = this.rows.length
      this.loading = false
      this.error = ''
      this.emitDataCount()
    },
    handleDataChanged(payload = {}) {
      if (this.proposalDraftGroup) {
        if (payload.draftRelation === this.proposalDraftGroup.key) this.loadData(true, false, true)
        return
      }
      if (String(payload.table || '').toLowerCase() === String(this.config.table || '').toLowerCase()) {
        // zhy：草稿父记录优先使用保存回传数据，避免空的远程查询覆盖刚新增的联系人。
        if (this.mergeDraftChangedRow(payload)) return
        // zhy：编辑子表返回前先把保存事件中的完整记录合并到当前卡片，
        // 随后 onShow 再从服务端回读，避免导航返回期间旧请求把字段短暂覆盖为空。
        const changedId = String(payload.id || payload.row?.Id || '')
        if (changedId && payload.row && typeof payload.row === 'object') {
          this.rows = this.rows.map((item) =>
            String(item.Id || '') === changedId ? { ...item, ...payload.row, Id: changedId } : item
          )
        }
        // zhy：只有子表真实保存后才通知父表更新派生总数，普通打开、搜索和筛选不改主表字段。
        Promise.all([this.loadData(true, true, true), this.loadRelatedMetrics(true)])
      }
    }
  }
}
</script>

<style scoped>
.related-business-list { position: relative; min-height: 180rpx; padding: 18rpx 22rpx calc(118rpx + var(--mci-safe-bottom)); background: var(--mci-bg-base, #f4f8fa); }
.related-business-list--preview { min-height: 0; padding: 10rpx 0 0; background: transparent; }
.related-business-list--section { padding-top: 0; padding-bottom: 22rpx; border: 1rpx solid var(--mci-border, #e6edf0); border-radius: 16rpx; overflow: hidden; background: var(--mci-bg-card, #fff); }
.related-business-list--independent-scroll { box-sizing: border-box; display: flex; flex-direction: column; height: 100%; padding-bottom: 0; overflow: hidden; }
.related-business-list--collection { padding: 0 22rpx; }
.related-business-list--collection.related-business-list--independent-scroll { padding-bottom: 0; }
.related-business-list--collection .search-row,
.related-business-list--collection .related-metrics { display: none; }
.collection-heading { display: flex; flex: none; align-items: center; justify-content: space-between; min-height: 96rpx; }
.collection-heading__title { display: flex; align-items: baseline; min-width: 0; }
.collection-heading__title text:first-child { overflow: hidden; color: #34525e; font-size: 27rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.collection-heading__title text:last-child { margin-left: 10rpx; color: #81969e; font-size: 22rpx; }
.collection-heading__add { display: flex; align-items: center; justify-content: center; gap: 5rpx; min-width: 150rpx; height: 72rpx; margin: 0; padding: 0 16rpx; border: 1rpx solid #bedce6; border-radius: 6rpx; color: #087fbd; background: #fff; font-size: 22rpx; line-height: 72rpx; transition: transform 150ms ease, background-color 150ms ease; }
.collection-heading__add::after, .collection-card__delete::after { border: none; }
.collection-heading__add--pressed { background: #f0f8fb; transform: scale(.97); }
.collection-card { margin-bottom: 16rpx; padding: 22rpx 24rpx 16rpx; border: 1rpx solid #dfe9ed; border-radius: 8rpx; background: #fff; transition: background-color 160ms ease; }
.collection-card--pressed { background: #f3f8fa; }
.collection-card__head { display: flex; align-items: center; justify-content: space-between; gap: 18rpx; }
.collection-card__title { min-width: 0; overflow: hidden; color: #193844; font-size: 28rpx; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.collection-card__delete { flex: none; height: 56rpx; margin: -4rpx -6rpx -4rpx 0; padding: 0 10rpx; color: #c84d42; background: transparent; font-size: 20rpx; line-height: 56rpx; }
.collection-card__subtitle { display: block; margin-top: 6rpx; color: #0c7fac; font-size: 22rpx; }
.collection-card__lines { margin-top: 16rpx; padding: 12rpx 16rpx; border-radius: 6rpx; background: #f5f8f9; }
.collection-card__lines view { display: grid; grid-template-columns: 116rpx minmax(0, 1fr); padding: 5rpx 0; font-size: 21rpx; line-height: 31rpx; }
.collection-card__lines view text:first-child { color: #778d95; }
.collection-card__lines view text:last-child { overflow: hidden; color: #405c66; text-overflow: ellipsis; white-space: nowrap; }
.collection-card__photos { position: relative; display: grid; grid-template-columns: repeat(3, 112rpx); gap: 10rpx; margin-top: 14rpx; }
.collection-card__photos image, .collection-card__photo-more { width: 112rpx; height: 88rpx; border-radius: 6rpx; background: #e9eff1; }
.collection-card__photo-more { position: absolute; right: 0; display: flex; align-items: center; justify-content: center; color: #fff; background: rgba(24,54,64,.74); font-size: 23rpx; }
.collection-card__foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14rpx; padding-top: 13rpx; border-top: 1rpx solid #edf2f4; color: #84979e; font-size: 20rpx; }
.collection-card__foot text:last-child { margin-left: 18rpx; color: #0b82ba; font-size: 30rpx; }
.collection-picker-mask { position: fixed; inset: 0; z-index: 10020; display: flex; align-items: flex-end; width: 100vw; height: 100vh; overflow: hidden; background: rgba(16,35,43,.44); }
.collection-picker-sheet { box-sizing: border-box; width: 100%; height: min(78vh, 1120rpx); display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto; overflow: hidden; border-radius: 16rpx 16rpx 0 0; background: #fff; animation: collection-sheet-up 180ms ease-out; }
.collection-picker-handle { width: 72rpx; height: 7rpx; margin: 12rpx auto 2rpx; border-radius: 4rpx; background: #d6e1e5; }
.collection-picker-head { min-height: 84rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 0 24rpx; }
.collection-picker-head > view { min-width: 0; display: flex; align-items: baseline; }
.collection-picker-head > view text:first-child { color: #183640; font-size: 28rpx; font-weight: 750; }
.collection-picker-head > view text:last-child { margin-left: 14rpx; color: #087fbd; font-size: 21rpx; }
.collection-picker-close { flex: none; width: 64rpx; height: 64rpx; margin: 0; padding: 0; border: none; color: #78909a; background: transparent; font-size: 38rpx; line-height: 64rpx; }
.collection-picker-close::after, .collection-picker-search button::after, .collection-picker-row::after, .collection-picker-submit button::after { border: none; }
.collection-picker-search { box-sizing: border-box; height: 72rpx; display: grid; grid-template-columns: 36rpx minmax(0, 1fr) 48rpx; align-items: center; margin: 0 24rpx 10rpx; padding: 0 14rpx; border: 1rpx solid #dce7eb; border-radius: 8rpx; background: #f5f8f9; }
.collection-picker-search > text { color: #78919a; font-size: 28rpx; }
.collection-picker-search input { min-width: 0; height: 70rpx; color: #203c46; font-size: 24rpx; }
.collection-picker-search button { width: 48rpx; height: 56rpx; margin: 0; padding: 0; color: #78909a; background: transparent; font-size: 30rpx; line-height: 56rpx; }
.collection-picker-list { height: 100%; padding: 0 24rpx; box-sizing: border-box; }
.collection-picker-row { box-sizing: border-box; width: 100%; min-height: 112rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr); gap: 14rpx; align-items: center; margin: 0; padding: 14rpx 2rpx; border-bottom: 1rpx solid #edf2f4; border-radius: 0; color: inherit; background: #fff; line-height: normal; text-align: left; }
.collection-picker-row--selected { background: #f5fbfd; }
.collection-picker-row--added { opacity: .56; }
.collection-picker-check { box-sizing: border-box; width: 34rpx; height: 34rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #b7cbd3; border-radius: 5rpx; color: transparent; font-size: 22rpx; }
.collection-picker-row--selected .collection-picker-check { border-color: #0b86d4; color: #fff; background: #0b86d4; }
.collection-picker-row--added .collection-picker-check { border-color: #8fbecf; color: #fff; background: #8fbecf; }
.collection-picker-main { min-width: 0; }
.collection-picker-main text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.collection-picker-main text:first-child { color: #264651; font-size: 25rpx; font-weight: 700; }
.collection-picker-main text:last-child { margin-top: 8rpx; color: #82969e; font-size: 20rpx; }
.collection-picker-empty, .collection-picker-more { min-height: 160rpx; display: flex; align-items: center; justify-content: center; color: #8ca0a8; font-size: 23rpx; }
.collection-picker-more { min-height: 64rpx; }
.collection-picker-loading { padding: 2rpx 0; }
.collection-picker-loading > view { min-height: 104rpx; padding: 18rpx 4rpx; border-bottom: 1rpx solid #edf2f4; }
.collection-picker-loading > view > view { height: 20rpx; margin: 8rpx 0; border-radius: 5rpx; background: linear-gradient(90deg, #edf3f5 25%, #f8fafb 50%, #edf3f5 75%); background-size: 300% 100%; animation: shimmer 1.4s infinite; }
.collection-picker-loading > view > view:first-child { width: 62%; height: 25rpx; }
.collection-picker-loading > view > view:last-child { width: 38%; }
.collection-picker-submit { padding: 14rpx max(24rpx, var(--mci-safe-right)) calc(14rpx + var(--mci-safe-bottom)) max(24rpx, var(--mci-safe-left)); border-top: 1rpx solid #e1eaed; background: #fff; }
.collection-picker-submit button { height: 82rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; margin: 0; border-radius: 8rpx; color: #fff; background: #087fbd; font-size: 27rpx; font-weight: 700; line-height: 82rpx; }
.collection-picker-submit button[disabled] { color: #fff; background: #a8c6d1; opacity: 1; }
@keyframes collection-sheet-up { from { transform: translateY(18rpx); opacity: .4; } to { transform: translateY(0); opacity: 1; } }
.related-list-body { width: 100%; }
.related-list-body--scroll { flex: 1; min-height: 0; height: 100%; box-sizing: border-box; }
.related-list-body--scroll .related-list-scroll-content { min-height: 100%; padding-bottom: calc(138rpx + var(--mci-safe-bottom)); box-sizing: border-box; }
/* zhy：隐藏客户详情各列表 Tab 右侧原生滚动指示条，保留触摸滚动与触底分页。 */
.related-list-body--scroll,
.related-list-body--scroll scroll-view { scrollbar-width: none; -ms-overflow-style: none; }
.related-list-body--scroll::-webkit-scrollbar,
.related-list-body--scroll scroll-view::-webkit-scrollbar,
.related-list-body--scroll ::-webkit-scrollbar { display: none; width: 0; height: 0; color: transparent; background: transparent; }
.preview-section-header { min-height: 82rpx; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; padding: 0 28rpx; border-bottom: 1rpx solid #edf2f4; background: #fff; transition: background 150ms ease; }
.preview-section-header--pressed { background: #f7fafb; }
.preview-section-header__main { min-width: 0; display: flex; align-items: center; gap: 12rpx; }
.preview-section-header__bar { flex: 0 0 auto; width: 6rpx; height: 28rpx; border-radius: 3rpx; background: var(--mci-color-primary, #e94b2c); }
.preview-section-header__title { overflow: hidden; color: #17313b; font-size: 28rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.preview-section-header__count { flex: 0 0 auto; color: #8aa0a9; font-size: 21rpx; font-weight: 500; }
.preview-section-header__arrow { flex: 0 0 auto; color: #81969e; font-size: 40rpx; line-height: 1; transform: rotate(90deg); transition: transform .18s ease; }
.preview-section-header__arrow.expanded { transform: rotate(-90deg); }
/* zhy：列表宽度不能在 100% 基础上再叠加左右 margin；首卡与标题之间保持和基础信息正文一致的呼吸感。 */
.preview-section-header ~ .related-data-list,
.preview-section-header ~ .related-skeleton,
.preview-section-header ~ .related-empty { width: auto; margin: 18rpx 22rpx 0; }
.preview-section-header ~ .preview-actions { margin-right: 22rpx; margin-left: 22rpx; }
.related-metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10rpx;
  margin: -2rpx -2rpx 16rpx;
}
.related-metric {
  min-width: 0;
  padding: 17rpx 8rpx 15rpx;
  border: 1rpx solid #e1eaf0;
  border-radius: 12rpx;
  background: #fff;
  text-align: center;
}
.related-metric__value { display: flex; align-items: baseline; justify-content: center; gap: 3rpx; color: #263e49; }
.related-metric__value > text:first-child { overflow: hidden; font-size: 29rpx; font-weight: 750; text-overflow: ellipsis; white-space: nowrap; }
.related-metric__value > text:last-child { flex: 0 0 auto; font-size: 18rpx; }
.related-metric__label { display: block; overflow: hidden; margin-top: 5rpx; color: #6c828c; font-size: 19rpx; text-overflow: ellipsis; white-space: nowrap; }
.related-metric--warning { border-color: #f4e5b9; background: #fffaf0; }
.related-metric--warning .related-metric__value { color: #b56800; }
.related-metric--success { border-color: #ccebdd; background: #f1fbf6; }
.related-metric--success .related-metric__value { color: #008660; }
.related-metric--primary { border-color: #d8e5fa; background: #f2f7ff; }
.related-metric--primary .related-metric__value { color: #1768d8; }
.latest-record-summary { flex: none; margin-bottom: 16rpx; padding: 16rpx 20rpx 20rpx; border: 1rpx solid var(--mci-border-color, #e1eaf0); border-radius: 12rpx; background: var(--mci-bg-card, #fff); }
.latest-record-summary__head { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; min-height: 52rpx; margin-bottom: 10rpx; color: var(--mci-text-primary, #263e49); font-size: 24rpx; font-weight: 600; }
.latest-record-summary__detail { display: flex; flex: none; align-items: center; gap: 8rpx; margin: 0; padding: 0 10rpx; min-height: 56rpx; border: none; border-radius: 6rpx; color: var(--mci-color-primary, #087fbd); background: transparent; font-size: 22rpx; line-height: 56rpx; }
.latest-record-summary__detail::after, .latest-record-summary__error button::after { border: none; }
.latest-record-summary__detail--pressed { opacity: .65; }
.latest-record-summary__fields, .latest-record-summary__skeleton { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18rpx 20rpx; }
.latest-record-summary__field { min-width: 0; }
.latest-record-summary__label { display: block; color: var(--mci-text-secondary, #6c828c); font-size: 21rpx; line-height: 30rpx; }
.latest-record-summary__value { display: block; margin-top: 5rpx; color: var(--mci-text-primary, #263e49); font-size: 26rpx; font-weight: 600; line-height: 36rpx; overflow-wrap: anywhere; word-break: break-all; }
.latest-record-summary__skeleton > view { height: 72rpx; border-radius: 6rpx; background: var(--mci-bg-base, #f4f8fa); }
.latest-record-summary__error { display: flex; align-items: center; gap: 16rpx; color: var(--mci-text-secondary, #6c828c); font-size: 22rpx; }
.latest-record-summary__error > text { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.latest-record-summary__error button { flex: none; margin: 0; padding: 0 12rpx; color: var(--mci-color-primary, #087fbd); background: transparent; font-size: 22rpx; }
.proposal-compare-tools {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 28rpx;
  min-height: 72rpx;
  margin: -2rpx 2rpx 16rpx;
}
.proposal-compare-button {
  box-sizing: border-box;
  min-width: 190rpx;
  height: 68rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 0 28rpx;
  border-radius: 14rpx;
  color: #fff;
  background: linear-gradient(135deg, #0787c9, #17b5a6);
  box-shadow: 0 8rpx 20rpx rgba(7, 135, 201, .2);
  font-size: 25rpx;
  font-weight: 700;
}
.proposal-compare-button > text:last-child:not(:first-child) {
  min-width: 30rpx;
  height: 30rpx;
  padding: 0 5rpx;
  border-radius: 15rpx;
  color: #0787c9;
  background: #fff;
  font-size: 19rpx;
  line-height: 30rpx;
  text-align: center;
}
.proposal-compare-button.disabled { opacity: .48; box-shadow: none; }
.proposal-compare-button--pressed { transform: scale(.97); }
.proposal-select-all { height: 64rpx; display: flex; align-items: center; gap: 10rpx; color: #607d8b; font-size: 25rpx; }
.proposal-select-all > text:first-child,
.proposal-select { box-sizing: border-box; width: 38rpx; height: 38rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #aebfc7; border-radius: 10rpx; }
.proposal-select-all.active { color: #0787c9; font-weight: 650; }
.proposal-select-all.active > text:first-child,
.proposal-select.active { border-color: #0787c9; color: #fff; background: #0787c9; }
.selectable-card { position: relative; }
.proposal-select { position: absolute; top: 16rpx; right: 16rpx; z-index: 5; color: transparent; background: rgba(255, 255, 255, .96); box-shadow: 0 3rpx 10rpx rgba(21, 68, 88, .12); }
.proposal-batch-tools { display: flex; flex-wrap: wrap; align-items: center; gap: 12rpx; margin: -2rpx 0 16rpx; }
.proposal-batch-entry { box-sizing: border-box; width: 100%; min-height: 88rpx; display: grid; grid-template-columns: 58rpx minmax(0, 1fr) 30rpx; gap: 12rpx; align-items: center; padding: 12rpx 18rpx; border: 1rpx solid #f0d6d0; border-radius: 14rpx; color: #cc442b; background: #fff8f6; transition: transform 150ms ease, opacity 150ms ease; }
.proposal-batch-entry--pressed { transform: scale(.985); opacity: .82; }
.proposal-batch-entry__icon { width: 48rpx; height: 48rpx; border-radius: 12rpx; color: #fff; background: #e94b2c; font-size: 28rpx; line-height: 48rpx; text-align: center; }
.proposal-batch-entry > view { min-width: 0; }
.proposal-batch-entry > view text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proposal-batch-entry > view text:first-child { color: #8c2e1c; font-size: 25rpx; font-weight: 700; }
.proposal-batch-entry > view text:last-child { margin-top: 4rpx; color: #a87166; font-size: 20rpx; }
.proposal-batch-entry > text:last-child { color: #d99384; font-size: 38rpx; text-align: right; }
.proposal-batch-select-all { flex: 1 1 250rpx; min-height: 76rpx; display: flex; align-items: center; gap: 12rpx; }
.proposal-batch-select-all > text:first-child { box-sizing: border-box; width: 42rpx; height: 42rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #aebfc7; border-radius: 10rpx; color: transparent; background: #fff; }
.proposal-batch-select-all.active > text:first-child { border-color: #e94b2c; color: #fff; background: #e94b2c; }
.proposal-batch-select-all > view text { display: block; }
.proposal-batch-select-all > view text:first-child { color: #405963; font-size: 24rpx; font-weight: 650; }
.proposal-batch-select-all > view text:last-child { margin-top: 3rpx; color: #81949c; font-size: 19rpx; }
.proposal-batch-tool-button { flex: 0 0 auto; min-width: 100rpx; height: 68rpx; padding: 0 18rpx; border-radius: 12rpx; color: #647a83; background: #eaf1f4; font-size: 23rpx; font-weight: 650; line-height: 68rpx; text-align: center; }
.proposal-batch-tool-button--primary { display: flex; align-items: center; justify-content: center; gap: 8rpx; min-width: 152rpx; color: #fff; background: #e94b2c; }
.proposal-batch-tool-button--primary > text:last-child:not(:first-child) { min-width: 28rpx; height: 28rpx; padding: 0 4rpx; border-radius: 14rpx; color: #e94b2c; background: #fff; font-size: 18rpx; line-height: 28rpx; }
.proposal-batch-tool-button.disabled { opacity: .45; }
.proposal-batch-tool-button--pressed { transform: scale(.97); }
.proposal-batch-load-hint { flex: 0 0 100%; color: #879aa2; font-size: 20rpx; }
.proposal-batch-card { position: relative; margin-bottom: 16rpx; border: 2rpx solid transparent; border-radius: 18rpx; transition: border-color 150ms ease, background 150ms ease; }
.proposal-batch-card.selected { border-color: #e94b2c; background: #fff5f2; }
.proposal-batch-card__select { position: absolute; top: 0; right: 0; z-index: 8; box-sizing: border-box; width: 84rpx; height: 84rpx; display: flex; align-items: center; justify-content: center; color: transparent; }
.proposal-batch-card__select::before { content: ''; position: absolute; width: 40rpx; height: 40rpx; border: 2rpx solid #aebfc7; border-radius: 10rpx; background: rgba(255,255,255,.96); box-shadow: 0 3rpx 10rpx rgba(21,68,88,.12); }
.proposal-batch-card__select text { position: relative; z-index: 1; font-size: 24rpx; }
.proposal-batch-card__select.active { color: #fff; }
.proposal-batch-card__select.active::before { border-color: #e94b2c; background: #e94b2c; }
@media (max-width: 360px) {
  .related-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
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
.proposal-point-card {
  margin-bottom: 18rpx;
  padding: 22rpx 22rpx 18rpx;
  border: 1rpx solid #e5ecef;
  border-radius: 18rpx;
  background: #fff;
  box-shadow: 0 5rpx 18rpx rgba(32, 67, 81, .05);
}
.proposal-point-card__title {
  min-height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  border-bottom: 1rpx solid #edf1f3;
  color: #c83d25;
}
.proposal-point-card__title > text:first-child { font-size: 29rpx; font-weight: 750; }
.proposal-point-field {
  min-height: 72rpx;
  display: grid;
  grid-template-columns: 176rpx minmax(0, 1fr);
  gap: 14rpx;
  align-items: center;
  border-bottom: 1rpx solid #edf1f3;
}
.proposal-point-field__label { color: #30393d; font-size: 24rpx; }
.proposal-point-field__control { min-width: 0; }
.proposal-point-field__input {
  box-sizing: border-box;
  width: 100%;
  height: 64rpx;
  padding: 0 14rpx;
  border-radius: 8rpx;
  color: #24343b;
  background: #f7f9fa;
  font-size: 23rpx;
}
.proposal-point-field__value {
  overflow: hidden;
  color: #3a4b52;
  font-size: 23rpx;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.proposal-point-field__value--empty { color: #aab4b8; }
.proposal-point-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10rpx;
  padding-top: 16rpx;
}
.proposal-point-action {
  height: 64rpx;
  border: 1rpx solid #aab4b8;
  border-radius: 8rpx;
  color: #46555b;
  font-size: 22rpx;
  line-height: 64rpx;
  text-align: center;
  transition: transform 150ms ease, opacity 150ms ease;
}
.proposal-point-action--delete { border-color: rgba(226, 63, 59, .55); color: #d83e3b; background: rgba(226, 63, 59, .04); }
.proposal-point-action--copy { border-color: #d9472b; color: #fff; background: #d9472b; }
.proposal-point-action--pressed { transform: scale(.97); opacity: .8; }
.proposal-point-field :deep(.native-field) { min-height: 64rpx; }
.proposal-point-field :deep(.native-select),
.proposal-point-field :deep(.native-input) { min-height: 64rpx; background: #f7f9fa; }
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
.preview-actions--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.preview-action { height: 76rpx; display: flex; align-items: center; justify-content: center; gap: 8rpx; border: 1rpx solid rgba(229, 70, 37, .45); border-radius: 10rpx; color: #d9472b; background: rgba(229, 70, 37, .05); font-size: 25rpx; font-weight: 650; transition: transform 150ms ease, opacity 150ms ease; }
.preview-actions--three .preview-action { gap: 5rpx; font-size: 22rpx; }
.preview-action--batch { border-color: rgba(11, 134, 212, .38); color: #087dad; background: #edf8fc; }
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
.proposal-batch-mask { position: fixed; inset: 0; z-index: 10000; display: flex; align-items: flex-end; overflow: hidden; background: rgba(13, 37, 48, .48); }
.proposal-batch-sheet { box-sizing: border-box; width: 100%; height: min(92vh, 1420rpx); display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; border-radius: 20rpx 20rpx 0 0; overflow: hidden; background: #f5f8f9; }
.proposal-batch-sheet__head { min-height: 104rpx; display: flex; align-items: center; justify-content: space-between; gap: 20rpx; padding: 0 26rpx; border-bottom: 1rpx solid #e5ecef; background: #fff; }
.proposal-batch-sheet__head > view:first-child { min-width: 0; }
.proposal-batch-sheet__head > view:first-child text { display: block; }
.proposal-batch-sheet__head > view:first-child text:first-child { color: #17313b; font-size: 30rpx; font-weight: 750; }
.proposal-batch-sheet__head > view:first-child text:last-child { margin-top: 5rpx; color: #7d929b; font-size: 21rpx; }
.proposal-batch-sheet__close { flex: 0 0 auto; width: 58rpx; height: 58rpx; border-radius: 50%; color: #69818b; background: #eff5f7; font-size: 34rpx; line-height: 56rpx; text-align: center; }
.proposal-batch-tip { padding: 14rpx 26rpx; color: #8c5c2c; background: #fff8e8; font-size: 21rpx; line-height: 1.55; }
.proposal-batch-sheet__scroll { height: 100%; }
.proposal-batch-group { margin: 18rpx 20rpx 0; }
.proposal-batch-group__title { display: flex; align-items: center; justify-content: space-between; padding: 0 4rpx 10rpx; }
.proposal-batch-group__title text:first-child { color: #36515c; font-size: 25rpx; font-weight: 750; }
.proposal-batch-group__title text:last-child { color: #91a2a9; font-size: 19rpx; }
.proposal-batch-field { position: relative; margin-bottom: 12rpx; border: 1rpx solid #e1e9ec; border-radius: 14rpx; background: #fff; }
.proposal-batch-field.enabled { border-color: rgba(233,75,44,.38); box-shadow: 0 5rpx 14rpx rgba(58,79,88,.05); }
.proposal-batch-field.selector-open { z-index: 30; }
.proposal-batch-field__head { box-sizing: border-box; min-height: 88rpx; display: grid; grid-template-columns: 48rpx minmax(0, 1fr) auto; gap: 12rpx; align-items: center; padding: 12rpx 18rpx; }
.proposal-batch-field__check { box-sizing: border-box; width: 40rpx; height: 40rpx; display: flex; align-items: center; justify-content: center; border: 2rpx solid #afbec5; border-radius: 10rpx; color: transparent; }
.proposal-batch-field__check.active { border-color: #e94b2c; color: #fff; background: #e94b2c; }
.proposal-batch-field__head > view:nth-child(2) { min-width: 0; }
.proposal-batch-field__head > view:nth-child(2) text { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.proposal-batch-field__head > view:nth-child(2) text:first-child { color: #29434e; font-size: 24rpx; font-weight: 650; }
.proposal-batch-field__head > view:nth-child(2) text:last-child { margin-top: 4rpx; color: #91a0a6; font-size: 19rpx; }
.proposal-batch-field__head > text:last-child { color: #d9472b; font-size: 19rpx; }
.proposal-batch-field__body { position: relative; padding: 0 18rpx 18rpx 78rpx; }
.proposal-batch-field__clear { min-height: 56rpx; display: flex; align-items: center; justify-content: flex-end; color: #8a9ba2; font-size: 20rpx; }
.proposal-batch-field__clear--pressed { color: #d9472b; }
.proposal-batch-sheet__safe { height: 24rpx; }
.proposal-batch-sheet__footer { display: grid; grid-template-columns: minmax(0, .72fr) minmax(0, 1.28fr); gap: 14rpx; padding: 16rpx max(24rpx, var(--mci-safe-right)) calc(16rpx + var(--mci-safe-bottom)) max(24rpx, var(--mci-safe-left)); border-top: 1rpx solid #e4ebee; background: #fff; }
.proposal-batch-sheet__footer > view { height: 78rpx; border-radius: 10rpx; color: #5e737c; background: #edf3f5; font-size: 24rpx; font-weight: 700; line-height: 78rpx; text-align: center; }
.proposal-batch-sheet__footer > view:last-child { color: #fff; background: #e94b2c; }
.proposal-batch-sheet__footer > view.disabled { opacity: .46; }
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
