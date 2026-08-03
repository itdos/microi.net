<template>
	<view class="detail-page" :class="{ 'detail-page--related-filter-open': standaloneRelatedFilterOpen }"
		:style="mciTokenStyle">
		<view class="page-nav mci-safe-top">
			<view class="nav-row mci-safe-nav-row">
				<view class="nav-button" hover-class="nav-button--pressed" @tap="goBack">‹</view>
				<text class="nav-title">{{ pageTitle }}</text>
				<view class="nav-button nav-button--edit" hover-class="nav-button--pressed" @tap="openFullForm">编辑
				</view>
			</view>
		</view>

		<scroll-view class="detail-scroll" scroll-y refresher-enabled :refresher-triggered="refreshing"
			@refresherrefresh="refresh">
			<view v-if="loading" class="loading-state">
				<view class="skeleton skeleton--hero"></view>
				<view class="skeleton skeleton--line" v-for="index in 8" :key="index"></view>
			</view>

			<view v-else-if="error" class="error-state">
				<image class="state-image" src="/static/xjy/business/sh.png" mode="aspectFit" />
				<text class="state-title">详情加载失败</text>
				<text class="state-desc">{{ error }}</text>
				<button class="state-button" @tap="loadDetail">重新加载</button>
			</view>

			<template v-else>
				<view class="hero-band">
					<image class="hero-water" :src="preset.background || xjyAssets.waterHero" mode="aspectFill" />
					<view class="hero-shade"></view>
					<view class="hero-topline">
						<image class="hero-icon" :src="heroIcon" mode="aspectFit" />
						<view class="hero-copy">
							<text class="hero-title">{{ primaryTitle }}</text>
							<text class="hero-meta">{{ heroMeta }}</text>
						</view>
						<text v-if="statusText" class="status-pill" :class="statusClass">{{ statusText }}</text>
					</view>
					<view v-if="heroMetrics.length" class="metric-row">
						<view class="metric-item" v-for="metric in heroMetrics" :key="metric.label">
							<text class="metric-value">{{ metric.value }}</text>
							<text class="metric-label">{{ metric.label }}</text>
						</view>
					</view>
				</view>

				<!-- <view v-if="key === 'customers'" class="quick-band">
					<view class="quick-action" hover-class="quick-action--pressed" @tap="addCustomerVisit">
						<image src="/static/xjy/business/baifang.png" mode="aspectFit" />
						<text>新增跟进</text>
					</view>
					<view class="quick-action" hover-class="quick-action--pressed"
						@tap="openRelated('orders', 'KehuID', detail.Id)">
						<image src="/static/xjy/business/dingdan.png" mode="aspectFit" />
						<text>合同订单</text>
					</view>
					<view class="quick-action" hover-class="quick-action--pressed"
						@tap="openRelated('devices', 'KehuID', detail.Id)">
						<image src="/static/xjy/business/shebei.png" mode="aspectFit" />
						<text>客户设备</text>
					</view>
					<view class="quick-action" hover-class="quick-action--pressed"
						@tap="openRelated('tasks', 'KehuID', detail.Id)">
						<image src="/static/xjy/repair/renwu.png" mode="aspectFit" />
						<text>售后任务</text>
					</view>
				</view> -->
				<view v-if="dynamicActions.length" class="quick-band quick-band--dynamic">
					<view
						v-for="action in dynamicActions"
						:key="action.Key"
						class="quick-action"
						hover-class="quick-action--pressed"
						@tap="runDynamicAction(action)"
					>
						<image v-if="isActionImage(action.Icon)" :src="action.Icon" mode="aspectFit" />
						<view v-else class="quick-action__symbol">+</view>
						<text>{{ action.Label }}</text>
					</view>
				</view>

				<mci-related-tabs v-if="formTabs.length > 1" :items="formTabs"
					:active-key="activeFormTabKey" @select="selectFormTab" />

				<view class="info-band" :class="{ 'info-band--ungrouped': section.source === 'Ungrouped' }"
					v-for="(section, sectionIndex) in visibleSections" :key="section.key">
					<view v-if="section.source === 'CollapseGroup'"
						class="section-heading section-heading--toggle" hover-class="section-heading--pressed"
						@tap="toggleSection(section, sectionIndex)">
						<view class="section-heading__copy">
							<view class="section-mark"></view>
							<view class="section-heading__text">
								<text>{{ section.title }}</text>
								<text v-if="section.description" class="section-description">{{ section.description }}</text>
							</view>
							<text v-if="section.showFieldCount !== false && section.fields.length" class="section-count">{{ section.fields.length }} 项</text>
						</view>
						<text class="section-toggle"
							:class="{ expanded: isSectionExpanded(section, sectionIndex) }">›</text>
					</view>
					<view v-if="isSectionExpanded(section, sectionIndex)" class="field-list section-body-enter">
						<view class="field-row"
							:class="{ 'field-row--map': tenantDetailFieldPresentation(field).type === 'map' }"
							v-for="field in section.fields" :key="`${section.key}:${field.name}`">
							<text class="field-label">{{ field.label }}</text>
							<view class="field-value-wrap">
								<view v-if="tenantDetailFieldPresentation(field).type === 'map'"
									class="detail-field-map">
									<map
										v-if="tenantDetailFieldPresentation(field).latitude && tenantDetailFieldPresentation(field).longitude"
										class="detail-field-map__canvas"
										:latitude="tenantDetailFieldPresentation(field).latitude"
										:longitude="tenantDetailFieldPresentation(field).longitude"
										:markers="tenantDetailMapMarkers(field)" :show-location="false"
										:scale="16" :enable-zoom="true" />
									<view v-else class="detail-field-map__placeholder">
										<text class="detail-field-map__pin">⌖</text>
										<text>{{ tenantDetailFieldPresentation(field).emptyText || '暂无位置信息' }}</text>
									</view>
									<text v-if="tenantDetailFieldPresentation(field).address"
										class="detail-field-map__address">
										{{ tenantDetailFieldPresentation(field).address }}
									</text>
									<text
										v-if="tenantDetailFieldPresentation(field).latitude && tenantDetailFieldPresentation(field).longitude"
										class="detail-field-map__coordinate">
										经度 {{ Number(tenantDetailFieldPresentation(field).longitude).toFixed(6) }}，纬度
										{{ Number(tenantDetailFieldPresentation(field).latitude).toFixed(6) }}
									</text>
								</view>
								<mci-native-field v-else-if="usesNativeDisplay(field)"
									class="field-value field-value--native" :field="field.nativeField"
									:model-value="detail[field.name]" :table-name="moduleConfig.table"
									:form-data="detail" :menu-id="menuId" readonly />
								<rich-text v-else-if="isFieldRich(field)" class="field-value field-value--rich"
									:nodes="fieldRichHtml(field)" />
								<text v-else class="field-value">{{ displayField(field) }}</text>
								<view v-if="field.format === 'phone' && detail[field.name]" class="inline-action"
									@tap="callPhone(detail[field.name])">拨打</view>
							</view>
						</view>
						<mci-business-related-list
							v-for="relatedTab in section.relatedTabs"
							:key="relatedTab.key"
							class="section-related-preview"
							:field="relatedTab.field"
							:parent-id="detail.Id || id"
							:parent-form="detail"
							:parent-menu-id="menuId"
							:parent-table-id="definition && definition.table ? definition.table.Id : ''"
							parent-mode="View"
							display-mode="preview"
							:preview-limit="2"
						/>
					</view>
				</view>

				<view v-for="relatedTab in standaloneRelatedTabs" :key="relatedTab.key" class="related-tab-panel">
					<mci-business-related-list v-if="relatedTab.type === 'child'" ref="standaloneRelatedList"
						:field="relatedTab.field"
						:parent-id="detail.Id || id" :parent-form="detail" :parent-menu-id="menuId"
						:parent-table-id="definition && definition.table ? definition.table.Id : ''"
						parent-mode="View" display-mode="preview" show-preview-header :preview-limit="2"
						:show-floating-add="false"
						@floating-add-state="setStandaloneRelatedAddState(relatedTab, $event)"
						@filter-open-state="setStandaloneRelatedFilterState(relatedTab, $event)" />
					<mci-join-form v-else-if="relatedTab.type === 'join'" :field="relatedTab.field"
						:parent-form="detail" parent-mode="View" readonly />
					<mci-table-selector v-else-if="relatedTab.type === 'openTable'" :field="relatedTab.field"
						:parent-table="moduleConfig.table" :parent-id="detail.Id || id"
						:parent-form="detail" :parent-menu-id="menuId" readonly />
					<mci-related-table v-else-if="relatedTab.type === 'joinTable'" :field="relatedTab.field"
						:parent-form="detail" :parent-menu-id="menuId" />
				</view>

				<view v-if="summaryBlocks.length" class="info-band">
					<view class="section-heading">
						<view class="section-mark"></view>
						<text>补充说明</text>
					</view>
					<view class="summary-block" v-for="block in summaryBlocks" :key="block.label">
						<text class="summary-label">{{ block.label }}</text>
						<rich-text v-if="block.rich" class="summary-text summary-text--rich" :nodes="block.html" />
						<text v-else class="summary-text">{{ block.value }}</text>
					</view>
				</view>

				<view v-if="key === 'tasks' && showMerchantAcceptance" class="acceptance-band">
					<view>
						<text class="acceptance-title">商家验收</text>
						<text class="acceptance-desc">请确认服务结果与现场记录后再验收</text>
					</view>
					<view class="acceptance-actions">
						<button class="acceptance-button acceptance-button--reject"
							@tap="showRejectDialog = true">不通过</button>
						<button class="acceptance-button acceptance-button--pass" @tap="acceptTaskResult">通过</button>
					</view>
				</view>

				<view class="content-spacer"></view>
			</template>
		</scroll-view>

		<!-- zhy：客户详情 Tab 的新增按钮必须挂在 scroll-view 外，避免随列表内容滚动。 -->
		<view v-if="showStandaloneRelatedAdd" class="related-floating-add"
			:style="relatedFloatingStyle" hover-class="related-floating-add--pressed"
			@tap="openStandaloneRelatedAdd"><text>＋</text></view>

		<!-- zhy：子表筛选打开时收起详情页外置业务操作栏，让遮罩完整覆盖到底部安全区。 -->
		<view v-if="!loading && !error && hasBottomActions && !standaloneRelatedFilterOpen"
			class="bottom-actions">
			<template v-if="key === 'tasks'">
				<button v-if="canAcceptTask" class="action-button action-button--primary" :disabled="submitting"
					@tap="claimTask">接单</button>
				<button v-if="canCheckIn" class="action-button action-button--secondary" @tap="goCheckIn">到场打卡</button>
				<button v-if="canSubmitService" class="action-button action-button--primary"
					@tap="openServiceFeedback">服务反馈</button>
				<button v-if="canCancelTask" class="action-button action-button--plain" :disabled="submitting"
					@tap="cancelTask">撤销</button>
			</template>
			<template v-else-if="key === 'orders' && canApproveOrder">
				<button class="action-button action-button--plain" @tap="openOrderApproval('reject')">驳回</button>
				<button class="action-button action-button--primary" @tap="openOrderApproval('approve')">同意</button>
			</template>
			<template v-else-if="key === 'devices'">
				<button v-if="canCancelDeviceRepair" class="action-button action-button--plain" :disabled="submitting"
					@tap="cancelDeviceRepair">取消报修</button>
				<button class="action-button action-button--secondary" @tap="openDeviceRepair">一键报修</button>
			</template>
			<template v-else-if="key === 'customers'">
				<button v-if="canClaimCustomer"
					class="action-button action-button--primary action-button--with-icon" :disabled="submitting"
					@tap="claimCustomer">
					<image class="action-button__icon" :src="customerClaimIcon" mode="aspectFit" />
					<text>{{ submitting ? '领取中...' : '领取客户' }}</text>
				</button>
				<button v-if="canReleaseCustomer"
					class="action-button action-button--plain action-button--with-icon" :disabled="submitting"
					@tap="releaseCustomer">
					<image class="action-button__icon" :src="customerReleaseIcon" mode="aspectFit" />
					<text>{{ submitting ? '移入中...' : '移入公海' }}</text>
				</button>
				<button v-if="canGeneratePeriodicTasks" class="action-button action-button--secondary"
					:disabled="submitting" @tap="generatePeriodicTasks">生成任务</button>
			</template>
			<template v-else-if="key === 'leads'">
				<button v-if="canClaimLead" class="action-button action-button--primary" :disabled="submitting"
					@tap="claimLead">领取线索</button>
				<button v-if="canConvertLead" class="action-button action-button--secondary" :disabled="submitting"
					@tap="convertLead">转为客户</button>
			</template>
			<template v-else>
				<button v-if="primaryPhone" class="action-button action-button--secondary"
					@tap="callPhone(primaryPhone)">联系</button>
			</template>
		</view>

		<view v-if="showRejectDialog" class="dialog-mask" @tap.self="showRejectDialog = false">
			<view class="dialog-panel">
				<text class="dialog-title">验收不通过</text>
				<text class="dialog-desc">请填写明确原因，便于服务人员重新处理。</text>
				<textarea v-model="rejectReason" class="dialog-textarea" maxlength="300" placeholder="请输入不通过原因" />
				<view class="dialog-actions">
					<button class="dialog-button" @tap="showRejectDialog = false">取消</button>
					<button class="dialog-button dialog-button--confirm" :disabled="submitting"
						@tap="rejectTaskResult">确认提交</button>
				</view>
			</view>
		</view>

		<view v-if="showOrderApprovalDialog" class="dialog-mask" @tap.self="showOrderApprovalDialog = false">
			<view class="dialog-panel">
				<text class="dialog-title">{{ approvalMode === 'approve' ? '同意订单' : '驳回订单' }}</text>
				<text
					class="dialog-desc">{{ approvalMode === 'approve' ? '审批通过后订单将进入后续合同与服务流程。' : '请说明驳回原因，便于订单发起人调整。' }}</text>
				<textarea v-model="approvalOpinion" class="dialog-textarea" maxlength="300"
					:placeholder="approvalMode === 'approve' ? '可填写审批意见（选填）' : '请输入审批意见（必填）'" />
				<scroll-view v-if="approvalOpinions.length" class="approval-opinions" scroll-x :show-scrollbar="false">
					<view class="approval-opinions__row">
						<view v-for="item in approvalOpinions" :key="item" class="approval-opinion"
							@tap="approvalOpinion = item"><text>{{ item }}</text></view>
					</view>
				</scroll-view>
				<view class="dialog-actions">
					<button class="dialog-button" @tap="showOrderApprovalDialog = false">取消</button>
					<button class="dialog-button dialog-button--confirm" :disabled="submitting"
						@tap="submitOrderApproval">确认提交</button>
				</view>
			</view>
		</view>
		<mci-ai-launcher />
	</view>
</template>

<script>
	import {
		themeMixin
	} from '@/utils/theme.js'
	import {
		getUser,
		V8
	} from '@/utils/request.js'
	import {
		getBusinessModule,
		getBusinessEntry,
		getRoleProfile
	} from '@/platform/business.js'
	import {
		callApiEngine,
		findMenu,
		formatFieldValue,
		openForm
	} from '@/platform/business-runtime.js'
	import {
		isHtmlValue,
		normalizeRichTextHtml,
		normalizeUploadItems,
		publicAssetUrl
	} from '@/platform/display.js'
	import {
		loadNativeFormDefinition
	} from '@/platform/native-form.js'
	import {
		getTenantFormFieldPresentation
	} from '@/platform/form-extension.js'
	import {
		compileDetailPreset,
		loadModuleViewManifest
	} from '@/platform/view-manifest.js'
	import {
		executeViewAction,
		isActionVisible
	} from '@/platform/view-actions.js'
	import {
		loadViewMetricValues
	} from '@/platform/view-metrics.js'
	import {
		loadApprovalOpinions
	} from './utils/xjy-row-actions.js'
	import MciBusinessRelatedList from '@/components/mci-business-related-list/mci-business-related-list.vue'

	const icon = (path) => `/static/xjy/${path}`
	const DETAIL_EXCLUDED_FIELDS = new Set(['Id', 'CreateUserId', 'UpdateUserId', 'OsClient'])
	const DETAIL_NATIVE_COMPONENTS = new Set([
		'ImgUpload', 'FileUpload', 'RichText', 'Html', 'Address', 'Map', 'MapArea',
		'Select', 'MultipleSelect', 'Radio', 'Checkbox', 'Department', 'SelectTree',
		'TreeCheckbox', 'Cascader', 'ColorPicker', 'Progress', 'Rate', 'Qrcode', 'Alert'
	])

	function detailFieldFormat(field) {
		const component = String(field.component || field.Component || '')
		const text = `${field.Name || ''} ${field.Label || ''}`
		if (['RichText', 'Html'].includes(component)) return 'richtext'
		if (component === 'Address') return 'region'
		if (/手机|电话|phone|mobile|tel/i.test(text)) return 'phone'
		if (/金额|价格|费用|分佣|收入|支出|余额|money|amount|price|fee/i.test(text)) return 'money'
		if (component === 'DateTime') return /时间|time/i.test(text) ? 'datetime' : 'date'
		return ''
	}

	const presets = {
		customers: {
			title: '客户详情',
			icon: icon('business/kehu.png'),
			titleField: 'KehuMC',
			statusField: 'Zhuangtai',
			metaField: 'KehuLX',
			phoneFields: ['LianxiDH', 'FuzeRDH', 'ZhuanshuKFDH'],
			metrics: [{
					label: '设备',
					field: 'ShebeiSL',
					suffix: '台'
				},
				{
					label: '订单',
					field: 'DingdanSL',
					suffix: '份'
				},
				{
					label: '综合评价',
					field: 'KehuZHPJ',
					suffix: '分'
				}
			],
			sections: [{
					title: '客户信息',
					fields: [{
							label: '客户名称',
							name: 'KehuMC'
						}, {
							label: '联系人',
							name: 'LianxiR'
						},
						{
							label: '联系电话',
							name: 'LianxiDH',
							format: 'phone'
						}, {
							label: '客户类型',
							name: 'KehuLX'
						},
						{
							label: '所在城市',
							name: 'Chengshi',
							format: 'region'
						}, {
							label: '详细地址',
							name: 'XiangxiDZ'
						},
						{
							label: '所属片区',
							name: 'SuoshuPQ'
						}
					]
				},
				{
					title: '开发与跟进',
					fields: [{
							label: '负责人',
							name: 'FuzeR'
						}, {
							label: '负责人电话',
							name: 'FuzeRDH',
							format: 'phone'
						},
						{
							label: '跟进状态',
							name: 'KehuGJZT'
						}, {
							label: '预期交易额',
							name: 'YuqiJYJE',
							format: 'money'
						},
						{
							label: '预期交易时间',
							name: 'YuqiJYSJ',
							format: 'date'
						}, {
							label: '下次跟进',
							name: 'XiaciGJRQ',
							format: 'date'
						}
					]
				},
				{
					title: '合作与服务',
					fields: [{
							label: '合作方式',
							name: 'HezuoFS'
						}, {
							label: '合作开始',
							name: 'HezuoKSSJ',
							format: 'date'
						},
						{
							label: '合作结束',
							name: 'HezuoJSSJ',
							format: 'date'
						}, {
							label: '服务开始',
							name: 'FuwuKSSJ',
							format: 'date'
						},
						{
							label: '服务结束',
							name: 'FuwuJSSJ',
							format: 'date'
						}, {
							label: '售后人员',
							name: 'ShouhouRY'
						},
						{
							label: '专属客服',
							name: 'ZhuanshuKF'
						}, {
							label: '所属商家',
							name: 'TenantName'
						}
					]
				}
			],
			summaries: [{
				label: '客户概况',
				field: 'KehuGK'
			}, {
				label: '备注',
				field: 'Beizhu'
			}]
		},
		orders: {
			title: '合同订单详情',
			icon: icon('business/dingdan.png'),
			titleField: 'DingdanBH',
			statusField: 'DingdanZT',
			metaField: 'KehuMC',
			phoneFields: ['LianxiDH', 'YewuYDH', 'ShouhouRYDH'],
			metrics: [{
					label: '订单金额',
					field: 'DingdanJE',
					format: 'money'
				},
				{
					label: '合作方式',
					field: 'DingdanHZFS'
				},
				{
					label: '合同状态',
					field: 'HetongZT'
				}
			],
			sections: [{
					title: '订单信息',
					fields: [{
							label: '订单编号',
							name: 'DingdanBH'
						}, {
							label: '合同编号',
							name: 'HetongBH'
						},
						{
							label: '订单类型',
							name: 'XinLDD'
						}, {
							label: '合作方式',
							name: 'DingdanHZFS'
						},
						{
							label: '订单金额',
							name: 'DingdanJE',
							format: 'money'
						}, {
							label: '下单日期',
							name: 'XiadanRQ',
							format: 'date'
						},
						{
							label: '预计收款',
							name: 'YujiSKSJ',
							format: 'date'
						}
					]
				},
				{
					title: '客户与负责人',
					fields: [{
							label: '客户名称',
							name: 'KehuMC'
						}, {
							label: '联系人',
							name: 'LianxiR'
						},
						{
							label: '联系电话',
							name: 'LianxiDH',
							format: 'phone'
						}, {
							label: '负责人',
							name: 'YewuY'
						},
						{
							label: '负责人电话',
							name: 'YewuYDH',
							format: 'phone'
						}, {
							label: '所属商家',
							name: 'TenantName'
						}
					]
				},
				{
					title: '合同与服务',
					fields: [{
							label: '合同开始',
							name: 'HetongKSSJ',
							format: 'date'
						}, {
							label: '合同结束',
							name: 'HetongJSSJ',
							format: 'date'
						},
						{
							label: '服务开始',
							name: 'FuwuKSSJ',
							format: 'date'
						}, {
							label: '服务结束',
							name: 'FuwuJSSJ',
							format: 'date'
						},
						{
							label: '保养周期',
							name: 'BaoyangZQ'
						}, {
							label: '水检周期',
							name: 'ShuizhiJCZQ'
						},
						{
							label: '售后人员',
							name: 'ShouhouRY'
						}, {
							label: '售后电话',
							name: 'ShouhouRYDH',
							format: 'phone'
						}
					]
				}
			],
			summaries: [{
				label: '安装条件备注',
				field: 'AnzhuangTJBZ'
			}, {
				label: '订单备注',
				field: 'Beizhu'
			}]
		},
		devices: {
			title: '设备详情',
			icon: icon('business/shebei.png'),
			titleField: 'ShebeiBH',
			fallbackTitleField: 'ShangpinMC',
			statusField: 'ShebeiZT',
			metaField: 'KehuMC',
			phoneFields: [],
			metrics: [{
					label: '设备型号',
					field: 'ShebeiXH'
				},
				{
					label: '工作状态',
					field: 'ShebeiGZZT'
				},
				{
					label: '合作方式',
					field: 'HezuoFS'
				}
			],
			sections: [{
					title: '设备信息',
					fields: [{
							label: '设备编号',
							name: 'ShebeiBH'
						}, {
							label: '设备名称',
							name: 'ShangpinMC'
						},
						{
							label: '设备型号',
							name: 'ShebeiXH'
						}, {
							label: '设备状态',
							name: 'ShebeiZT'
						},
						{
							label: '工作状态',
							name: 'ShebeiGZZT'
						}, {
							label: '合作方式',
							name: 'HezuoFS'
						}
					]
				},
				{
					title: '客户与位置',
					fields: [{
							label: '客户名称',
							name: 'KehuMC'
						}, {
							label: '安装位置',
							name: 'AnzhuangWZ'
						},
						{
							label: '订单编号',
							name: 'DingdanBH'
						}, {
							label: '所属商家',
							name: 'TenantName'
						}
					]
				},
				{
					title: '服务周期',
					fields: [{
							label: '服务开始',
							name: 'FuwuKSSJ',
							format: 'date'
						}, {
							label: '服务结束',
							name: 'FuwuJSSJ',
							format: 'date'
						},
						{
							label: '最近服务',
							name: 'ZuijinFWSJ',
							format: 'date'
						}, {
							label: '质保时间',
							name: 'ZhibaoSJ'
						}
					]
				}
			],
			summaries: [{
				label: '设备备注',
				field: 'Beizhu'
			}]
		},
		tasks: {
			title: '售后任务详情',
			icon: icon('repair/renwu.png'),
			titleField: 'ShouhouFWBH',
			statusField: 'Zhuangtai',
			metaField: 'KehuMC',
			phoneFields: ['KehuDH', 'ShouhouRYDH'],
			metrics: [{
					label: '服务类型',
					field: 'Leixing'
				},
				{
					label: '计划服务',
					field: 'YujiSHSJ',
					format: 'date'
				},
				{
					label: '服务费用',
					field: 'ShouhouFY',
					format: 'money'
				}
			],
			sections: [{
					title: '任务信息',
					fields: [{
							label: '服务编号',
							name: 'ShouhouFWBH'
						}, {
							label: '服务类型',
							name: 'Leixing'
						},
						{
							label: '任务状态',
							name: 'Zhuangtai'
						}, {
							label: '订单编号',
							name: 'DingdanBH'
						},
						{
							label: '计划服务',
							name: 'YujiSHSJ',
							format: 'datetime'
						}, {
							label: '预约时间',
							name: 'YuyueSJ',
							format: 'datetime'
						},
						{
							label: '接单时间',
							name: 'JiedanSJ',
							format: 'datetime'
						}, {
							label: '完成时间',
							name: 'FinishTime',
							format: 'datetime'
						}
					]
				},
				{
					title: '客户信息',
					fields: [{
							label: '客户名称',
							name: 'KehuMC'
						}, {
							label: '客户联系人',
							name: 'KehuLXRR'
						},
						{
							label: '客户电话',
							name: 'KehuDH',
							format: 'phone'
						}, {
							label: '所在城市',
							name: 'Chengshi',
							format: 'region'
						},
						{
							label: '服务地址',
							name: 'Dizhi'
						}, {
							label: '安装位置',
							name: 'AnzhuangWZ'
						}
					]
				},
				{
					title: '服务信息',
					fields: [{
							label: '服务人员',
							name: 'ShouhouRY'
						}, {
							label: '服务电话',
							name: 'ShouhouRYDH',
							format: 'phone'
						},
						{
							label: '所属片区',
							name: 'SuoshuPQ'
						}, {
							label: '指派人',
							name: 'ZhipaiR'
						},
						{
							label: '指派时间',
							name: 'ZhipaiSJ',
							format: 'datetime'
						}, {
							label: '商家验收',
							name: 'ShangjiaYSZT'
						},
						{
							label: '客户验收',
							name: 'KehuYSZT'
						}, {
							label: '综合评价',
							name: 'Pingjia'
						}
					]
				}
			],
			summaries: [{
					label: '报修/服务内容',
					field: 'Neirong'
				}, {
					label: '处理结果',
					field: 'Jieguo'
				},
				{
					label: '商家验收意见',
					field: 'ShangjiaYSYJ'
				}, {
					label: '客户验收意见',
					field: 'KehuYSYJ'
				}
			]
		},
		recruitment: {
			title: '应聘档案',
			icon: icon('business/yingpin.png'),
			titleField: 'Xingming',
			statusField: 'YixiangGW',
			metaField: 'Dianhua',
			phoneFields: ['Dianhua'],
			metrics: [{
				label: '年龄',
				field: 'Nianling'
			}, {
				label: '工作年限',
				field: 'GongzuoSJ'
			}, {
				label: '期望薪资',
				field: 'QiwangXZ'
			}],
			sections: [{
					title: '基本资料',
					fields: [{
							label: '姓名',
							name: 'Xingming'
						}, {
							label: '性别',
							name: 'Xingbie'
						}, {
							label: '出生日期',
							name: 'Shengri',
							format: 'date'
						},
						{
							label: '联系电话',
							name: 'Dianhua',
							format: 'phone'
						}, {
							label: '电子邮箱',
							name: 'DianziYX'
						}, {
							label: '现住地址',
							name: 'XianzhuDZ'
						}
					]
				},
				{
					title: '教育与求职',
					fields: [{
							label: '毕业学校',
							name: 'BiyeXX'
						}, {
							label: '专业',
							name: 'Zhuanye'
						}, {
							label: '毕业时间',
							name: 'BiyeSJ',
							format: 'date'
						},
						{
							label: '意向岗位',
							name: 'YixiangGW'
						}, {
							label: '期望薪资',
							name: 'QiwangXZ'
						}, {
							label: '到岗时间',
							name: 'DaogangSJ',
							format: 'date'
						}
					]
				}
			],
			summaries: [{
				label: '兴趣爱好',
				field: 'XingquAH'
			}, {
				label: '备注',
				field: 'Beizhu'
			}]
		},
		stores: {
			title: '商家详情',
			icon: icon('business/sj.png'),
			titleField: 'TenantName',
			statusField: 'Zhuangtai',
			metaField: 'Chengshi',
			phoneFields: ['LianxiRDH'],
			metrics: [{
				label: '商家评分',
				field: 'ShangjiaPF'
			}, {
				label: '服务比例',
				field: 'KefuBL'
			}, {
				label: '营业开始',
				field: 'YingyeKSSJ'
			}],
			sections: [{
					title: '商家信息',
					fields: [{
							label: '商家名称',
							name: 'TenantName'
						}, {
							label: '联系人',
							name: 'LianxiR'
						}, {
							label: '联系电话',
							name: 'LianxiRDH',
							format: 'phone'
						},
						{
							label: '所在城市',
							name: 'Chengshi',
							format: 'region'
						}, {
							label: '详细地址',
							name: 'Dizhi'
						}, {
							label: '主营产品',
							name: 'ZhuyingCP'
						}
					]
				},
				{
					title: '营业信息',
					fields: [{
						label: '所属行业',
						name: 'SuoshuHY'
					}, {
						label: '营业开始',
						name: 'YingyeKSSJ'
					}, {
						label: '营业结束',
						name: 'YingyeJSSJ'
					}, {
						label: '商家评分',
						name: 'ShangjiaPF'
					}]
				}
			],
			summaries: [{
				label: '商家介绍',
				field: 'ShangjiaJS'
			}, {
				label: '备注',
				field: 'Beizhu'
			}]
		},
		providers: {
			title: '服务商详情',
			icon: icon('business/sj.png'),
			titleField: 'TenantName',
			statusField: 'Zhuangtai',
			metaField: 'Chengshi',
			phoneFields: ['LianxiRDH'],
			metrics: [],
			sections: [{
				title: '服务商信息',
				fields: [{
						label: '服务商名称',
						name: 'TenantName'
					}, {
						label: '联系人',
						name: 'LianxiR'
					}, {
						label: '联系电话',
						name: 'LianxiRDH',
						format: 'phone'
					},
					{
						label: '所在城市',
						name: 'Chengshi',
						format: 'region'
					}, {
						label: '详细地址',
						name: 'Dizhi'
					}, {
						label: '主营产品',
						name: 'ZhuyingCP'
					}
				]
			}],
			summaries: [{
				label: '商家介绍',
				field: 'ShangjiaJS'
			}]
		},
		demands: {
			title: '需求详情',
			icon: icon('business/xuqiu.png'),
			titleField: 'Xuqiu',
			metaField: 'FabuR',
			phoneFields: ['FabuRLXDH'],
			metrics: [{
				label: '指定行业',
				field: 'ZhidingHY'
			}, {
				label: '所属片区',
				field: 'SuoshuPQ'
			}, {
				label: '响应结果',
				field: 'Jieguo'
			}],
			sections: [{
				title: '发布信息',
				fields: [{
						label: '需求名称',
						name: 'Xuqiu'
					}, {
						label: '发布人',
						name: 'FabuR'
					}, {
						label: '联系电话',
						name: 'FabuRLXDH',
						format: 'phone'
					},
					{
						label: '地区',
						name: 'Diqu'
					}, {
						label: '指定行业',
						name: 'ZhidingHY'
					}, {
						label: '所属片区',
						name: 'SuoshuPQ'
					}
				]
			}],
			summaries: [{
				label: '需求内容',
				field: 'XuqiuNR'
			}, {
				label: '业务结果',
				field: 'BusinessJG'
			}]
		},
		leads: {
			title: '线索详情',
			icon: icon('business/xiansuo.png'),
			titleField: 'XiansuoMC',
			statusField: 'Zhuangtai',
			metaField: 'KehuMC',
			phoneFields: ['ShoujiH', 'LianxiDH'],
			metrics: [{
					label: '线索状态',
					field: 'Zhuangtai'
				},
				{
					label: '负责人',
					field: 'FuzeR'
				},
				{
					label: '领取时间',
					field: 'LingquSJ',
					format: 'date'
				}
			],
			sections: [{
					title: '线索信息',
					fields: [{
							label: '线索名称',
							name: 'XiansuoMC'
						}, {
							label: '客户名称',
							name: 'KehuMC'
						},
						{
							label: '联系人',
							name: 'LianxiR'
						}, {
							label: '联系电话',
							name: 'ShoujiH',
							format: 'phone'
						},
						{
							label: '部门',
							name: 'Bumen'
						}, {
							label: '所属商家',
							name: 'TenantName'
						}
					]
				},
				{
					title: '跟进与转化',
					fields: [{
							label: '负责人',
							name: 'FuzeR'
						}, {
							label: '领取时间',
							name: 'LingquSJ',
							format: 'datetime'
						},
						{
							label: '转换时间',
							name: 'ZhuanhuanSJ',
							format: 'datetime'
						}, {
							label: '创建时间',
							name: 'CreateTime',
							format: 'datetime'
						}
					]
				}
			],
			summaries: [{
				label: '线索需求',
				field: 'XiansuoXQ'
			}, {
				label: '备注',
				field: 'Beizhu'
			}]
		}
	}

	export default {
		components: { MciBusinessRelatedList },
		mixins: [themeMixin],
		data() {
			return {
				statusBarHeight: 0,
				key: 'customers',
				id: '',
				menuId: '',
				detail: {},
				loading: true,
				refreshing: false,
				error: '',
				submitting: false,
				showRejectDialog: false,
				rejectReason: '',
				showOrderApprovalDialog: false,
				approvalMode: 'approve',
				approvalOpinion: '',
				approvalOpinions: [],
				currentUser: {},
				roleProfile: {},
				deviceActiveTask: {},
				definition: null,
				viewManifest: null,
				metricValues: {},
				expandedSections: {},
				activeFormTabKey: '',
				standaloneRelatedAddKey: '',
				standaloneRelatedAddAvailable: false,
				standaloneRelatedFilterKey: '',
				standaloneRelatedFilterOpen: false,
				customerClaimIcon: icon('business/kehu.png'),
				customerReleaseIcon: icon('business/xiezuo.png')
			}
		},
		computed: {
			preset() {
				const module = this.moduleConfig || {}
				const entry = getBusinessEntry(this.key) || {}
				const base = presets[this.key] || {
					title: module.title || '业务详情',
					icon: entry.icon || icon('business/kehu.png'),
					titleField: module.titleField || 'Name',
					fallbackTitleField: 'Name',
					statusField: module.statusField || 'Status',
					metaField: 'CreateTime',
					phoneFields: [module.phoneField, 'Phone', 'ShoujiH'].filter(Boolean),
					metrics: [],
					sections: [],
					summaries: module.summaryField ? [{
						label: '详细说明',
						field: module.summaryField
					}] : []
				}
				const dynamic = compileDetailPreset(this.viewManifest)
				if (!dynamic) return {
					...base,
					sections: []
				}
				return {
					...base,
					...dynamic,
					icon: dynamic.icon || base.icon,
					background: dynamic.background || base.background,
					titleField: dynamic.titleField || base.titleField,
					fallbackTitleField: dynamic.fallbackTitleField || base.fallbackTitleField,
					statusField: dynamic.statusField || base.statusField,
					metaField: dynamic.metaField || base.metaField,
					phoneFields: dynamic.phoneFields?.length ? dynamic.phoneFields : base.phoneFields,
					metrics: dynamic.metrics?.length ? dynamic.metrics : base.metrics,
					sections: [],
					summaries: dynamic.summaries?.length ? dynamic.summaries : base.summaries
				}
			},
			moduleConfig() {
				return getBusinessModule(this.key) || getBusinessModule('customers')
			},
			pageTitle() {
				return this.preset.title
			},
			primaryTitle() {
				return this.detail[this.preset.titleField] || this.detail[this.preset.fallbackTitleField] || this.pageTitle
			},
			heroIcon() {
				const imageField = this.preset.imageField
				const upload = imageField ? normalizeUploadItems(this.detail[imageField])[0] : null
				return upload && upload.Path ? publicAssetUrl(upload.Path) : this.preset.icon
			},
			statusText() {
				return this.detail[this.preset.statusField] || ''
			},
			heroMeta() {
				const value = this.detail[this.preset.metaField]
				if (value) return formatFieldValue(value, '', {
					empty: ''
				})
				return formatFieldValue(this.detail.TenantName || this.detail.CreateTime || '集福鲤业务档案', '', {
					empty: ''
				})
			},
			statusClass() {
				const value = String(this.statusText)
				if (/结束|完成|合作|正常|通过/.test(value)) return 'status-pill--success'
				if (/取消|作废|故障|驳回|不通过/.test(value)) return 'status-pill--danger'
				if (/待|跟进|处理中|预约/.test(value)) return 'status-pill--warning'
				return 'status-pill--info'
			},
			heroMetrics() {
				return (this.preset.metrics || []).map((metric) => {
					const key = metric.key || metric.field || metric.apiEngineKey
					const remote = String(metric.source || '').toLowerCase() === 'apiengine'
					const raw = remote ? this.metricValues[key] : this.detail[metric.field]
					const value = raw === null || raw === undefined || raw === '' || raw === '-' ?
						'-' :
						`${formatFieldValue(raw, metric.format)}${metric.suffix || ''}`
					return {
						...metric,
						value
					}
				})
			},
			dynamicActions() {
				return (this.preset.actions || []).filter((action) => isActionVisible(action, this.detail))
			},
			fieldDefinitionMap() {
				const map = new Map();
				(this.definition?.fields || []).forEach((field) => map.set(String(field.Name || '').toLowerCase(), field))
				return map
			},
			visibleSections() {
				const groups = this.definition?.relatedGroups || this.definition?.groups || []
				const activeGroups = this.formTabs.length
					? groups.filter((group) => group.tabKey === this.activeFormTabKey)
					: groups
				return activeGroups.map((group, index) => {
					const rows = (group.fields || []).filter((field) => {
						const name = String(field.Name || '')
						return name && !DETAIL_EXCLUDED_FIELDS.has(name)
					}).map((field) => ({
						label: field.Label || field.Name,
						name: field.Name,
						format: detailFieldFormat(field),
						nativeField: field
					})).filter((field) => !this.isTenantMapCoordinateHelper(field))
					return {
						title: group.name || '',
						fields: rows,
						relatedTabs: this.activeRelatedTabs.filter((item) =>
							this.isEmbeddedChildRelated(item) && item.field.layoutGroupKey === group.key
						),
						source: group.source,
						description: group.description || '',
						showFieldCount: group.showFieldCount,
						defaultExpanded: group.defaultExpanded !== false,
						key: group.key || `${group.name || 'ungrouped'}:${index}`
					}
				})
				.filter((section) => section.fields.length || section.relatedTabs.length)
			},
			formTabs() {
				return (this.definition?.formTabs || []).map((tab) => ({
					...tab,
					label: tab.name
				}))
			},
			relatedTabs() {
				const definition = this.definition || {}
				const toTabs = (fields, type) => (fields || []).map((field) => ({
					key: `${type}:${field.Id || field.Name}`,
					label: field.Label || field.Name || '关联业务',
					type,
					field
				}))
				return [
					...toTabs(definition.childFields, 'child'),
					...toTabs(definition.joinFields, 'join'),
					...toTabs(definition.openTableFields, 'openTable'),
					...toTabs(definition.joinTableFields, 'joinTable')
				]
			},
			activeRelatedTabs() {
				if (!this.formTabs.length) return this.relatedTabs
				return this.relatedTabs.filter((item) => item.field.formTabKey === this.activeFormTabKey)
			},
			standaloneRelatedTabs() {
				return this.activeRelatedTabs.filter((item) => !this.isEmbeddedChildRelated(item))
			},
			standaloneChildTab() {
				return this.standaloneRelatedTabs.find((item) => item.type === 'child') || null
			},
			showStandaloneRelatedAdd() {
				return !this.loading && !this.error && !this.standaloneRelatedFilterOpen &&
					this.standaloneRelatedAddAvailable &&
					Boolean(this.standaloneChildTab && this.standaloneRelatedAddKey === this.standaloneChildTab.key)
			},
			relatedFloatingStyle() {
				return {
					bottom: this.hasBottomActions
						? 'calc(132rpx + var(--mci-safe-bottom))'
						: 'calc(34rpx + var(--mci-safe-bottom))'
				}
			},
			summaryBlocks() {
				return (this.preset.summaries || []).map((item) => {
					const raw = this.detail[item.field]
					const rich = isHtmlValue(raw)
					return {
						label: item.label,
						raw,
						rich,
						html: rich ? normalizeRichTextHtml(raw) : '',
						value: rich ? '' : formatFieldValue(raw, item.format)
					}
				}).filter((item) => item.raw !== undefined && item.raw !== null && item.raw !== '')
			},
			primaryPhone() {
				const field = (this.preset.phoneFields || []).find((name) => this.detail[name])
				return field ? this.detail[field] : ''
			},
			hasBottomActions() {
				if (this.key === 'tasks') return this.canAcceptTask || this.canCheckIn || this.canSubmitService || this
					.canCancelTask
				if (this.key === 'orders') return this.canApproveOrder
				if (this.key === 'devices') return true
				if (this.key === 'customers') return this.canClaimCustomer || this.canReleaseCustomer || this
					.canGeneratePeriodicTasks
				if (this.key === 'leads') return this.canClaimLead || this.canConvertLead
				return Boolean(this.primaryPhone)
			},
			relationActions() {
				if (this.key === 'customers') {
					return [
						// {
						// 	label: '分享客户给商家',
						// 	type: 'customer-share',
						// 	icon: icon('business/xiezuo.png')
						// },
						{
							label: '客户地址管理',
							type: 'list',
							key: 'customerAddresses',
							field: 'KehuID',
							value: this.detail.Id,
							icon: icon('business/dw.png')
						},
						{
							label: '联系人',
							type: 'list',
							key: 'contacts',
							field: 'KehuID',
							value: this.detail.Id,
							// zhy: 从客户详情进入联系人列表时，同时携带客户Id和客户名称作为新增默认值。
							defaultValues: {
								KehuID: this.detail.Id,
								SuoshuKH: this.detail.KehuMC
							},
							icon: icon('business/lianxiren.png')
						},
						{
							label: '跟进记录',
							type: 'list',
							key: 'visits',
							field: 'KehuID',
							value: this.detail.Id,
							defaultValues: {
								KehuID: this.detail.Id,
								KehuMC: this.detail.KehuMC
							},
							icon: icon('business/baifang.png')
						},
						{
							label: '商机',
							type: 'list',
							key: 'opportunities',
							field: 'KehuID',
							value: this.detail.Id,
							icon: icon('business/xiansuo.png')
						},
						{
							label: '客户方案',
							type: 'list',
							key: 'proposals',
							field: 'KehuID',
							value: this.detail.Id,
							icon: icon('business/shenqing.png')
						},
						{
							label: '客户案例',
							type: 'list',
							key: 'cases',
							field: 'KehuID',
							value: this.detail.Id,
							icon: icon('business/anlice.png')
						},
						{
							label: '生成服务记录表',
							type: 'service-record-add',
							icon: icon('business/fwjllb.png')
						},
						{
							label: '客户服务记录表',
							type: 'list',
							key: 'serviceForms',
							field: 'KehuID',
							value: this.detail.Id,
							icon: icon('business/fwjllb.png')
						}
					]
				}
				if (this.key === 'orders') {
					return [
						this.detail.KehuID && {
							label: '查看客户',
							type: 'detail',
							key: 'customers',
							id: this.detail.KehuID,
							icon: icon('business/kehu.png')
						},
						{
							label: '订单商品',
							type: 'list',
							key: 'orderGoods',
							field: 'DingdanID',
							value: this.detail.Id,
							icon: icon('business/goods.png')
						},
						{
							label: '安装位置',
							type: 'list',
							key: 'installationPositions',
							field: 'DingdanID',
							value: this.detail.Id,
							icon: icon('business/dw.png')
						},
						{
							label: '分佣明细',
							type: 'list',
							key: 'orderCommissions',
							field: 'DingdanID',
							value: this.detail.Id,
							icon: icon('business/shouyi.png')
						},
						{
							label: '自动计算分佣',
							type: 'order-commission-calc',
							icon: icon('business/yeji.png')
						},
						{
							label: '订单设备',
							type: 'list',
							key: 'devices',
							field: 'DingdanID',
							value: this.detail.Id,
							icon: icon('business/shebei.png')
						},
						{
							label: '售后任务',
							type: 'list',
							key: 'tasks',
							field: 'DingdanID',
							value: this.detail.Id,
							icon: icon('repair/renwu.png')
						}
					].filter(Boolean)
				}
				if (this.key === 'devices') {
					return [
						this.detail.KehuID && {
							label: '查看客户',
							type: 'detail',
							key: 'customers',
							id: this.detail.KehuID,
							icon: icon('business/kehu.png')
						},
						this.detail.DingdanID && {
							label: '查看订单',
							type: 'detail',
							key: 'orders',
							id: this.detail.DingdanID,
							icon: icon('business/dingdan.png')
						},
						{
							label: '设备耗材',
							type: 'device-consumables',
							icon: icon('business/lvxin.png')
						},
						this.deviceActiveTask.Id && {
							label: '维修中的任务',
							type: 'detail',
							key: 'tasks',
							id: this.deviceActiveTask.Id,
							icon: icon('repair/renwu.png')
						},
						{
							label: '设备服务记录',
							type: 'list',
							key: 'taskDevices',
							field: 'KehuSBID',
							value: this.detail.Id,
							icon: icon('business/fwjllb.png')
						}
					].filter((item) => item && (item.type !== 'list' || !!item.value))
				}
				if (this.key === 'tasks') {
					return [
						this.detail.KehuID && {
							label: '查看客户',
							type: 'detail',
							key: 'customers',
							id: this.detail.KehuID,
							icon: icon('business/kehu.png')
						},
						this.detail.DingdanID && {
							label: '查看订单',
							type: 'detail',
							key: 'orders',
							id: this.detail.DingdanID,
							icon: icon('business/dingdan.png')
						}
					].filter(Boolean)
				}
				if (this.key === 'leads') {
					return [{
							label: '新增线索跟进',
							type: 'lead-visit-add',
							icon: icon('business/baifang.png')
						},
						{
							label: '查看跟进记录',
							type: 'list',
							key: 'leadVisits',
							field: 'XiansuoID',
							value: this.detail.Id,
							icon: icon('business/fwjllb.png')
						},
						this.detail.KehuID && {
							label: '查看正式客户',
							type: 'detail',
							key: 'customers',
							id: this.detail.KehuID,
							icon: icon('business/kehu.png')
						}
					].filter(Boolean)
				}
				if (this.key === 'recruitment') {
					return [{
							label: '家庭背景',
							type: 'list',
							key: 'applicantFamily',
							field: 'GuanlianID',
							value: this.detail.Id,
							icon: icon('business/yingpin.png')
						},
						{
							label: '教育经历',
							type: 'list',
							key: 'applicantEducation',
							field: 'GuanlianID',
							value: this.detail.Id,
							icon: icon('business/yingpin.png')
						},
						{
							label: '工作经历',
							type: 'list',
							key: 'applicantWork',
							field: 'GuanlianID',
							value: this.detail.Id,
							icon: icon('business/yingpin.png')
						},
						{
							label: '专业证书',
							type: 'list',
							key: 'applicantCertificates',
							field: 'GuanlianID',
							value: this.detail.Id,
							icon: icon('business/yingpin.png')
						}
					]
				}
				if (this.key === 'demands') {
					return [{
						label: '商家响应',
						type: 'list',
						key: 'demandResponses',
						field: 'GuanlianXQFBID',
						value: this.detail.Id,
						icon: icon('business/xuqiu.png')
					}]
				}
				if (this.key === 'stores' || this.key === 'providers') {
					return [{
						label: '商家商品',
						type: 'list',
						key: 'merchantProducts',
						field: 'TenantId',
						value: this.detail.Id,
						icon: icon('business/goods.png')
					}]
				}
				return []
			},
			isTaskOwner() {
				return !!this.currentUser.Id && String(this.detail.ShouhouRYID || '') === String(this.currentUser.Id)
			},
			isTaskTerminal() {
				return /已结束|已完成|已取消|已作废/.test(String(this.statusText))
			},
			canAcceptTask() {
				return this.key === 'tasks' && !this.isTaskTerminal && !this.detail.ShouhouRYID && /待|未领取|未接单/.test(String(
					this.statusText || '待接单'))
			},
			canCheckIn() {
				return this.key === 'tasks' && this.isTaskOwner && !this.isTaskTerminal
			},
			canSubmitService() {
				return this.key === 'tasks' && this.isTaskOwner && !this.isTaskTerminal
			},
			canCancelTask() {
				return this.key === 'tasks' && this.isTaskOwner && !this.isTaskTerminal
			},
			canCancelDeviceRepair() {
				return this.key === 'devices' && !!this.deviceActiveTask.Id && /维修中|故障/.test(String(this.detail
					.ShebeiGZZT || ''))
			},
			showMerchantAcceptance() {
				return this.key === 'tasks' && this.roleProfile.isInternal && /待商家验收/.test(String(this.statusText)) && !
					this.detail.ShangjiaYSZT
			},
			canApproveOrder() {
				return this.key === 'orders' && this.roleProfile.isInternal && /待审批/.test(String(this.statusText))
			},
			customerFollowScope() {
				const status = String(this.detail.KehuGJZT || '').trim()
				if (status.includes('公海')) return 'public'
				if (status.includes('私有')) return 'private'
				const statusValue = Number(this.detail.KehuGJZTZ || 0)
				if (statusValue === 2) return 'public'
				if (statusValue === 1) return 'private'
				if (this.detail.FuzeRID || this.detail.FuzeR) return 'private'
				return ''
			},
			canManageCustomerFollowScope() {
				return this.key === 'customers' && !!this.currentUser.Id && !this.roleProfile.isCustomer
			},
			canClaimCustomer() {
				return this.canManageCustomerFollowScope && this.customerFollowScope === 'public'
			},
			canReleaseCustomer() {
				if (!this.canManageCustomerFollowScope || this.customerFollowScope !== 'private') return false
				if (this.roleProfile.isAdmin) return true
				const ownerId = String(this.detail.FuzeRID || '').trim()
				const currentUserId = String(this.currentUser.Id || '').trim()
				if (ownerId && currentUserId && ownerId === currentUserId) return true
				const normalizeName = (value) => String(value || '')
					.replace(/\s+/g, '')
					.replace(/[（(]/g, '(')
					.replace(/[）)]/g, ')')
				const ownerName = normalizeName(this.detail.FuzeR)
				const currentUserName = normalizeName(this.currentUser.Name)
				return !!ownerName && !!currentUserName && ownerName === currentUserName
			},
			canGeneratePeriodicTasks() {
				if (this.key !== 'customers' || !this.roleProfile.isInternal || this.canClaimCustomer) return false
				return ['BaoyangZQ', 'DanganCXZQ', 'HuifangZQ', 'ShuizhiJCZQ', 'ShoukuanZQ']
					.some((field) => Number(this.detail[field] || 0) > 0)
			},
			canClaimLead() {
				return this.key === 'leads' && this.roleProfile.isInternal && Number(this.detail.ZhuangtaiZ || 0) === 1
			},
			canConvertLead() {
				if (this.key !== 'leads' || Number(this.detail.ZhuangtaiZ || 0) !== 2) return false
				return this.roleProfile.isAdmin || String(this.detail.FuzeRID || '') === String(this.currentUser.Id || '')
			}
		},
		onLoad(options) {
			try {
				const info = uni.getWindowInfo()
				this.statusBarHeight = info.statusBarHeight || 0
			} catch (e) {
				try {
					this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0
				} catch (error) {}
			}
			this.key = options.key && getBusinessModule(options.key) ? options.key : 'customers'
			this.id = decodeURIComponent(options.id || '')
			this.menuId = decodeURIComponent(options.menuId || '')
			this.currentUser = getUser() || {}
			this.roleProfile = getRoleProfile(this.currentUser)
			this.loadDetail()
		},
		onShow() {
			if (!this.loading && this.id) this.loadDetail(false)
		},
		methods: {
			async loadDetail(showLoading = true, refreshManifest = false) {
				if (!this.id) {
					this.error = '缺少业务数据编号'
					this.loading = false
					return
				}
				if (showLoading) this.loading = true
				this.error = ''
				try {
					await this.loadViewManifest(refreshManifest)
					const [result, definitionResult] = await Promise.all([
						V8.FormEngine.GetFormData(this.moduleConfig.table, {
							Id: this.id,
							...(this.menuId ? { _SysMenuId: this.menuId } : {})
						}),
						loadNativeFormDefinition(this.moduleConfig.table).catch(() => null)
					])
					if (!result || result.Code !== 1 || !result.Data) throw new Error((result && result.Msg) ||
						'未找到该条业务数据')
					this.detail = result.Data
					if (definitionResult) {
						this.definition = definitionResult
						this.initializeFormTabs()
					}
					this.metricValues = await loadViewMetricValues(this.preset.metrics || [], {
						form: this.detail,
						user: this.currentUser,
						menu: {
							Id: this.menuId,
							ModuleEngineKey: this.viewManifest?.Module?.ModuleEngineKey || ''
						}
					})
					if (!Object.keys(this.expandedSections).length) {
						this.$nextTick(() => {
							const first = this.visibleSections[0]
							if (first) this.expandedSections = {
								[first.key]: true
							}
						})
					}
					if (this.key === 'devices') await this.loadDeviceActiveTask()
				} catch (error) {
					this.error = error.message || '业务数据加载失败'
				} finally {
					this.loading = false
					this.refreshing = false
				}
			},
			async refresh() {
				this.refreshing = true
				try {
					await this.loadDetail(false, true)
				} finally {
					this.refreshing = false
				}
			},
			async loadViewManifest(refresh = false) {
				try {
					let menuId = this.menuId
					if (!menuId) {
						const menu = await findMenu(
							this.moduleConfig.menuAliases || [],
							this.moduleConfig.table,
							refresh
						)
						menuId = menu && menu.Id || ''
					}
					const manifest = await loadModuleViewManifest({
						...this.moduleConfig,
						menuId
					}, {
						scene: 'Detail',
						device: 'Mobile',
						user: this.currentUser,
						refresh
					})
					if (manifest) {
						this.viewManifest = manifest
						this.menuId = manifest.Module?.Id || menuId
					} else {
						this.menuId = menuId
					}
				} catch (error) {}
			},
			isActionImage(value) {
				return /^(https?:|\/|static\/)/i.test(String(value || ''))
			},
			async runDynamicAction(action) {
				await executeViewAction(action, {
					form: this.detail,
					user: this.currentUser,
					menu: {
						Id: this.menuId || this.viewManifest?.Module?.Id || '',
						ModuleEngineKey: this.viewManifest?.Module?.ModuleEngineKey || ''
					},
					tableName: this.moduleConfig?.table,
					refresh: async () => {
						await this.loadDetail(true, true)
					}
				})
			},
			async loadDeviceActiveTask() {
				this.deviceActiveTask = {}
				try {
					const linkResult = await V8.FormEngine.GetTableData('diy_shouhousp', {
						_Where: [{
							Name: 'KehuSBID',
							Type: '=',
							Value: this.id
						}],
						_SelectFields: ['ShouhouDDID'],
						_OrderBy: 'CreateTime',
						_OrderByType: 'DESC',
						_PageIndex: 1,
						_PageSize: 20
					})
					const ids = [...new Set((linkResult && Array.isArray(linkResult.Data) ? linkResult.Data : []).map((
						item) => item.ShouhouDDID).filter(Boolean))]
					if (!ids.length) return
					const taskResult = await V8.FormEngine.GetTableData('Diy_ShouhouDD', {
						_Where: [{
							Name: 'Id',
							Type: 'In',
							Value: ids
						}],
						_OrderBy: 'CreateTime',
						_OrderByType: 'DESC',
						_PageIndex: 1,
						_PageSize: 20
					})
					this.deviceActiveTask = (taskResult && Array.isArray(taskResult.Data) ? taskResult.Data : []).find(
						(item) => !/已结束|已完成|已取消|已作废/.test(String(item.Zhuangtai || ''))) || {}
				} catch (error) {
					this.deviceActiveTask = {}
				}
			},
			displayField(field) {
				return formatFieldValue(this.detail[field.name], field.format, {
					empty: '-'
				})
			},
			usesNativeDisplay(field) {
				return Boolean(field.nativeField && DETAIL_NATIVE_COMPONENTS.has(String(field.nativeField.component ||
					field.nativeField.Component || '')))
			},
			tenantDetailFieldPresentation(field) {
				if (!field || !field.nativeField) return {}
				return getTenantFormFieldPresentation({
					tableName: this.moduleConfig && this.moduleConfig.table || '',
					menuId: this.menuId,
					rowId: this.detail && this.detail.Id || this.id,
					mode: 'View',
					definition: this.definition,
					form: this.detail || {},
					state: {}
				}, field.nativeField)
			},
			hasTenantDetailMap(field) {
				const presentation = this.tenantDetailFieldPresentation(field)
				return presentation.type === 'map' &&
					Boolean(Number(presentation.latitude) && Number(presentation.longitude))
			},
			isTenantMapCoordinateHelper(field) {
				const name = String(field && field.name || '')
				const match = name.match(/^(.+)_(Lat|Lng)$/i)
				if (!match) return false
				const mapField = this.fieldDefinitionMap.get(match[1].toLowerCase())
				if (!mapField) return false
				return this.tenantDetailFieldPresentation({
					name: mapField.Name,
					nativeField: mapField
				}).type === 'map'
			},
			tenantDetailMapMarkers(field) {
				const presentation = this.tenantDetailFieldPresentation(field)
				if (!presentation.latitude || !presentation.longitude) return []
				return [{
					id: 1,
					latitude: Number(presentation.latitude),
					longitude: Number(presentation.longitude),
					width: 32,
					height: 40
				}]
			},
			isFieldRich(field) {
				return field.format === 'richtext' || isHtmlValue(this.detail[field.name])
			},
			fieldRichHtml(field) {
				return normalizeRichTextHtml(this.detail[field.name])
			},
			isSectionExpanded(section, index) {
				if (section.source === 'Ungrouped') return true
				if (Object.prototype.hasOwnProperty.call(this.expandedSections, section.key)) return this.expandedSections[
					section.key]
				return section.defaultExpanded !== false
			},
			toggleSection(section, index) {
				if (section.source !== 'CollapseGroup') return
				this.expandedSections = {
					...this.expandedSections,
					[section.key]: !this.isSectionExpanded(section, index)
				}
			},
			isEmbeddedChildRelated(item) {
				return item?.type === 'child' && Boolean(item.field?.layoutGroupKey)
			},
			callPhone(phone) {
				if (phone) uni.makePhoneCall({
					phoneNumber: String(phone)
				})
			},
			openFullForm() {
				openForm({
					table: this.moduleConfig.table,
					rowId: this.detail.Id || this.id,
					mode: 'Edit',
					title: this.pageTitle,
					menuId: this.menuId,
					menuAliases: this.moduleConfig.menuAliases || []
				})
			},
			addCustomerVisit() {
				openForm({
					table: 'Diy_GenjinJL',
					mode: 'Add',
					title: '新增跟进记录',
					menuAliases: ['跟进记录', '拜访记录'],
					defaultValues: {
						KehuID: this.detail.Id,
						KehuMC: this.detail.KehuMC
					}
				})
			},
			openRelated(key, field, value, defaultValues = null) {
				if (!value) return
				// zhy: 将关联业务提供的新增默认值透传给目标列表，供其继续传入新增表单。
				const params = [
					`key=${encodeURIComponent(key)}`,
					`whereField=${encodeURIComponent(field)}`,
					`whereValue=${encodeURIComponent(value)}`
				]
				if (defaultValues && Object.keys(defaultValues).length) {
					params.push(`defaults=${encodeURIComponent(JSON.stringify(defaultValues))}`)
				}
				uni.navigateTo({
					url: `/pages/business/list?${params.join('&')}`
				})
			},
			selectFormTab(tab) {
				if (!tab || !tab.key) return
				this.standaloneRelatedAddAvailable = false
				this.standaloneRelatedAddKey = ''
				this.standaloneRelatedFilterOpen = false
				this.standaloneRelatedFilterKey = ''
				this.activeFormTabKey = tab.key
			},
			setStandaloneRelatedAddState(tab, available) {
				if (!tab || !this.standaloneChildTab || tab.key !== this.standaloneChildTab.key) return
				this.standaloneRelatedAddKey = tab.key
				this.standaloneRelatedAddAvailable = Boolean(available)
			},
			// zhy：详情页 Tab 子表筛选打开时提升列表层级，并压住外置悬浮按钮。
			setStandaloneRelatedFilterState(tab, open) {
				if (!tab || !this.standaloneChildTab || tab.key !== this.standaloneChildTab.key) return
				this.standaloneRelatedFilterKey = open ? tab.key : ''
				this.standaloneRelatedFilterOpen = Boolean(open)
			},
			openStandaloneRelatedAdd() {
				const tab = this.standaloneChildTab
				if (!tab) return
				const refs = this.$refs.standaloneRelatedList
				const candidates = Array.isArray(refs) ? refs : [refs]
				const target = candidates.find((item) =>
					item && item.field && String(item.field.Id || item.field.id || '') ===
						String(tab.field && (tab.field.Id || tab.field.id) || '')
				) || candidates.find(Boolean)
				if (target && typeof target.openAdd === 'function') target.openAdd()
			},
			initializeFormTabs() {
				if (!this.formTabs.some((item) => item.key === this.activeFormTabKey)) {
					this.activeFormTabKey = this.formTabs[0]?.key || ''
				}
			},
			async runRelation(action) {
				if (action.type === 'detail') {
					uni.navigateTo({
						url: `/pages/business/detail?key=${encodeURIComponent(action.key)}&id=${encodeURIComponent(action.id)}`
					})
				} else if (action.type === 'lead-visit-add') {
					this.addLeadVisit()
				} else if (action.type === 'order-commission-calc') {
					await this.calculateOrderCommission()
				} else if (action.type === 'customer-share') {
					uni.navigateTo({
						url: `/pages/native/customer-share?customerId=${encodeURIComponent(this.detail.Id || this.id)}`
					})
				} else if (action.type === 'service-record-add') {
					uni.navigateTo({
						url: `/pages/native/service-record?customerId=${encodeURIComponent(this.detail.Id || this.id)}`
					})
				} else if (action.type === 'device-consumables') {
					uni.navigateTo({
						url: `/pages/task/consumable?deviceId=${encodeURIComponent(this.detail.Id || this.id)}&source=device`
					})
				} else {
					this.openRelated(action.key, action.field, action.value, action.defaultValues)
				}
			},
			addLeadVisit() {
				openForm({
					table: 'Diy_XiansuoGJJL',
					mode: 'Add',
					title: '新增线索跟进',
					menuAliases: ['线索跟进', '线索跟进记录'],
					defaultValues: {
						XiansuoID: this.detail.Id,
						XiansuoMC: this.detail.XiansuoMC
					}
				})
			},
			goCheckIn() {
				const params =
					`customer=${encodeURIComponent(this.detail.KehuMC || '')}&taskId=${encodeURIComponent(this.detail.Id || this.id)}`
				uni.navigateTo({
					url: `/pages/native/checkin?${params}`
				})
			},
			openServiceFeedback() {
				const query = [
					`taskId=${encodeURIComponent(this.detail.Id || this.id)}`,
					`taskNo=${encodeURIComponent(this.detail.ShouhouFWBH || '')}`,
					`customer=${encodeURIComponent(this.detail.KehuMC || '')}`,
					`taskType=${encodeURIComponent(this.detail.Leixing || '')}`
				].join('&')
				uni.navigateTo({
					url: `/pages/native/task-feedback?${query}`,
					success: (result) => {
						if (result.eventChannel) result.eventChannel.on('taskFinished', () => this.loadDetail(
							false))
					}
				})
			},
			openDeviceRepair() {
				uni.navigateTo({
					url: `/pages/native/repair?deviceId=${encodeURIComponent(this.detail.Id || this.id)}`
				})
			},
			async cancelDeviceRepair() {
				if (!this.deviceActiveTask.Id) return
				const confirmed = await this.confirm('确定取消当前设备的报修任务吗？')
				if (!confirmed) return
				await this.runTaskEngine('repair_cancel', {
					Id: this.deviceActiveTask.Id
				}, '报修已取消')
			},
			openOrderApproval(mode) {
				this.approvalMode = mode
				this.approvalOpinion = ''
				this.showOrderApprovalDialog = true
				this.approvalOpinions = []
				loadApprovalOpinions().then((items) => {
					if (this.showOrderApprovalDialog) this.approvalOpinions = items
				})
			},
			confirm(content) {
				return new Promise((resolve) => {
					uni.showModal({
						title: '请确认',
						content,
						success: (result) => resolve(!!result.confirm),
						fail: () => resolve(false)
					})
				})
			},
			async runTaskEngine(engine, payload, successMessage, refreshAfter = true) {
				if (this.submitting) return false
				this.submitting = true
				uni.showLoading({
					title: '正在提交',
					mask: true
				})
				try {
					const result = await callApiEngine(engine, payload)
					if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '操作未成功')
					uni.showToast({
						title: successMessage,
						icon: 'success'
					})
					if (refreshAfter) await this.loadDetail(false)
					return true
				} catch (error) {
					uni.showToast({
						title: error.message || '操作失败',
						icon: 'none'
					})
					return false
				} finally {
					uni.hideLoading()
					this.submitting = false
				}
			},
			async claimCustomer() {
				const confirmed = await this.confirm('领取后该客户将进入您的客户列表。')
				if (!confirmed) return
				await this.runTaskEngine('linqu_GongHaiKeHu', {
					Id: this.detail.Id || this.id
				}, '客户领取成功')
			},
			async releaseCustomer() {
				const confirmed = await this.confirm('确定将该客户移入公海吗？移入后其他业务人员可以领取。')
				if (!confirmed) return
				await this.runTaskEngine('kehu2gonghai', {
					Id: this.detail.Id || this.id
				}, '已移入公海')
			},
			async generatePeriodicTasks() {
				const confirmed = await this.confirm('将按客户及客户设备的服务周期生成售后任务。请确认服务周期已经维护完整。')
				if (!confirmed) return
				await this.runTaskEngine('kehu_dingqirw', {
					Id: this.detail.Id || this.id,
					BaoyangZQ: this.detail.BaoyangZQ,
					DanganCXZQ: this.detail.DanganCXZQ,
					HuifangZQ: this.detail.HuifangZQ,
					ShuizhiJCZQ: this.detail.ShuizhiJCZQ,
					FuwuKSSJ: this.detail.FuwuKSSJ,
					FuwuJSSJ: this.detail.FuwuJSSJ,
					ShoukuanZQ: this.detail.ShoukuanZQ
				}, '周期任务已生成')
			},
			async calculateOrderCommission() {
				const confirmed = await this.confirm('将按当前订单金额、业务人员和专属客服配置重新计算分佣，确认继续吗？')
				if (!confirmed) return
				const done = await this.runTaskEngine('AddOrderFY', {
					TenantId: this.detail.TenantId || this.currentUser.TenantId,
					KehuID: this.detail.KehuID,
					DingdanBH: this.detail.DingdanBH,
					Id: this.detail.Id || this.id,
					DingdanJE: Number(this.detail.DingdanJE || 0),
					ZhaunshuKF: {
						Name: this.detail.ZhaunshuKF || this.detail.ZhuanshuKF || ''
					},
					ZhuanshuKFDH: this.detail.ZhuanshuKFDH || '',
					ZhaunshuKFID: this.detail.ZhaunshuKFID || this.detail.ZhuanshuKFID || '',
					YewuY: {
						Name: this.detail.YewuY || ''
					},
					YewuYDH: this.detail.YewuYDH || '',
					YewuYID: this.detail.YewuYID || ''
				}, '分佣计算完成', false)
				if (done) this.openRelated('orderCommissions', 'DingdanID', this.detail.Id || this.id)
			},
			async claimLead() {
				const confirmed = await this.confirm('确定领取该线索吗？')
				if (!confirmed) return
				await this.runTaskEngine('linqu_xiansuo', {
					Id: this.detail.Id || this.id
				}, '线索领取成功')
			},
			async convertLead() {
				const confirmed = await this.confirm('确定将该线索转为正式客户吗？')
				if (!confirmed) return
				const done = await this.runTaskEngine('xiansuo2kehu', {
					Id: this.detail.Id || this.id
				}, '已转为正式客户', false)
				if (done) setTimeout(() => this.goBack(), 500)
			},
			async claimTask() {
				const confirmed = await this.confirm('领取后该任务将进入您的待服务列表。')
				if (!confirmed) return
				await this.runTaskEngine('shouhoudd_lingqu', {
					Id: this.detail.Id || this.id,
					ShouhouRYID: this.currentUser.Id,
					ShouhouRY: this.currentUser.Name || this.currentUser.Account || '',
					ShouhouRYDH: this.currentUser.Phone || this.currentUser.Mobile || ''
				}, '接单成功')
			},
			async cancelTask() {
				const confirmed = await this.confirm('确定撤销当前接单吗？撤销后任务将重新进入待领取状态。')
				if (!confirmed) return
				await this.runTaskEngine('shouhoudd_chexiao', {
					Id: this.detail.Id || this.id,
					ShouhouRYID: this.currentUser.Id
				}, '撤销成功')
			},
			async acceptTaskResult() {
				const confirmed = await this.confirm('确认服务结果符合要求并通过商家验收吗？')
				if (!confirmed) return
				await this.runTaskEngine('task_acceptance', {
					Id: this.detail.Id || this.id,
					ShangjiaYSZT: '通过',
					type: 1
				}, '验收通过')
			},
			async rejectTaskResult() {
				const reason = this.rejectReason.trim()
				if (!reason) {
					uni.showToast({
						title: '请填写不通过原因',
						icon: 'none'
					})
					return
				}
				const done = await this.runTaskEngine('task_acceptance', {
					Id: this.detail.Id || this.id,
					ShangjiaYSYJ: reason,
					ShangjiaYSZT: '不通过',
					type: 3
				}, '已退回处理')
				if (done) {
					this.showRejectDialog = false
					this.rejectReason = ''
				}
			},
			async submitOrderApproval() {
				const opinion = this.approvalOpinion.trim()
				if (this.approvalMode === 'reject' && !opinion) {
					uni.showToast({
						title: '请填写审批意见',
						icon: 'none'
					})
					return
				}
				if (this.submitting) return
				this.submitting = true
				uni.showLoading({
					title: '正在审批',
					mask: true
				})
				try {
					const isApprove = this.approvalMode === 'approve'
					const result = isApprove ?
						await callApiEngine('dingdan_shenpi', {
							Id: this.detail.Id || this.id,
							formData: {
								ShenpiYJ: opinion
							}
						}) :
						await callApiEngine('DingdanApproveReject', {
							rejectData: {
								Id: this.detail.Id || this.id
							},
							formData: {
								ShenpiYJ: opinion
							}
						})
					if (!result || Number(result.Code) !== 1) throw new Error((result && result.Msg) || '审批未成功')
					if (!isApprove) {
						const updateResult = await V8.FormEngine.UptFormData('Diy_Dingdan', {
							Id: this.detail.Id || this.id,
							DingdanZT: '已驳回',
							DingdanZTZ: 6
						})
						if (!updateResult || Number(updateResult.Code) !== 1) throw new Error((updateResult &&
							updateResult.Msg) || '订单状态更新失败')
					}
					this.showOrderApprovalDialog = false
					this.approvalOpinion = ''
					uni.showToast({
						title: isApprove ? '审批通过' : '订单已驳回',
						icon: 'success'
					})
					await this.loadDetail(false)
				} catch (error) {
					uni.showToast({
						title: error.message || '审批失败',
						icon: 'none'
					})
				} finally {
					uni.hideLoading()
					this.submitting = false
				}
			},
			goBack() {
				uni.navigateBack({
					fail: () => uni.switchTab({
						url: '/pages/workspace/index'
					})
				})
			}
		}
	}
</script>

<style lang="scss" scoped>
	.detail-page {
		display: flex;
		flex-direction: column;
		height: 100vh;
		overflow: hidden;
		background: #f1f6f8;
		color: #17333e;
	}

	.page-nav {
		flex: none;
		background: #fff;
		box-shadow: 0 4rpx 16rpx rgba(24, 69, 86, 0.06);
		z-index: 5;
	}

	.nav-row {
		display: grid;
		grid-template-columns: 88rpx minmax(0, 1fr) 88rpx;
		align-items: center;
		min-height: 88rpx;
		padding: 0 calc(18rpx + var(--mci-capsule-right)) 0 18rpx;
	}

	.nav-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 72rpx;
		height: 64rpx;
		border-radius: 50%;
		color: #214b5b;
		font-size: 44rpx;
	}

	.nav-button--edit {
		width: 88rpx;
		border-radius: 10rpx;
		color: #e94b2c;
		font-size: 25rpx;
		font-weight: 650;
	}

	.nav-button--pressed {
		background: #edf5f8;
	}

	.nav-title {
		overflow: hidden;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 31rpx;
		font-weight: 650;
	}

	.detail-scroll {
		flex: 1;
		min-height: 0;
	}

	/* zhy：筛选遮罩位于子表组件内，打开时将整个滚动内容提升到外置新增按钮和底部操作栏之上。 */
	.detail-page--related-filter-open .detail-scroll {
		position: relative;
		z-index: 40;
	}

	.detail-page--related-filter-open .page-nav {
		z-index: 45;
	}

	.related-floating-add {
		position: fixed;
		right: 28rpx;
		z-index: 18;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 92rpx;
		height: 92rpx;
		border: 4rpx solid rgba(255, 255, 255, .88);
		border-radius: 50%;
		color: #fff;
		background: #e94b2c;
		box-shadow: 0 10rpx 28rpx rgba(233, 75, 44, .3);
		font-size: 44rpx;
		transition: transform 150ms ease;
	}

	.related-floating-add--pressed {
		transform: scale(.9);
	}

	.loading-state {
		padding: 24rpx;
	}

	.skeleton {
		background: #dfe9ed;
		animation: skeletonPulse 1.2s ease-in-out infinite;
	}

	.skeleton--hero {
		height: 260rpx;
		margin-bottom: 28rpx;
		border-radius: 8rpx;
	}

	.skeleton--line {
		height: 74rpx;
		margin-bottom: 2rpx;
	}

	.error-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		box-sizing: border-box;
		min-height: 72vh;
		padding: 48rpx;
		text-align: center;
	}

	.state-image {
		width: 116rpx;
		height: 116rpx;
		opacity: 0.7;
	}

	.state-title {
		margin-top: 24rpx;
		font-size: 31rpx;
		font-weight: 650;
	}

	.state-desc {
		margin-top: 12rpx;
		color: #728b95;
		font-size: 25rpx;
		line-height: 1.65;
	}

	.state-button {
		width: 240rpx;
		height: 76rpx;
		margin-top: 32rpx;
		border: none;
		border-radius: 8rpx;
		background: #e94b2c;
		color: #fff;
		font-size: 26rpx;
		line-height: 76rpx;
	}

	.state-button::after {
		border: none;
	}

	.hero-band {
		position: relative;
		overflow: hidden;
		padding: 34rpx 28rpx 30rpx;
		background: #063b5c;
		color: #fff;
	}

	.hero-water,
	.hero-shade {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
	}

	.hero-water {
		opacity: 0.72;
	}

	.hero-shade {
		background: linear-gradient(100deg, rgba(3, 48, 73, 0.95) 0%, rgba(3, 60, 88, 0.78) 48%, rgba(4, 89, 119, 0.34) 100%);
	}

	.hero-topline {
		position: relative;
		display: flex;
		align-items: flex-start;
		gap: 20rpx;
		z-index: 1;
	}

	.hero-icon {
		flex: none;
		width: 74rpx;
		height: 74rpx;
		padding: 10rpx;
		border-radius: 14rpx;
		background: rgba(255, 255, 255, 0.94);
	}

	.hero-copy {
		flex: 1;
		min-width: 0;
		padding-top: 3rpx;
	}

	.hero-title {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 34rpx;
		font-weight: 700;
	}

	.hero-meta {
		display: block;
		overflow: hidden;
		margin-top: 8rpx;
		color: rgba(255, 255, 255, 0.82);
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 24rpx;
	}

	.status-pill {
		flex: none;
		max-width: 170rpx;
		padding: 8rpx 14rpx;
		border-radius: 8rpx;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 21rpx;
	}

	.status-pill--success {
		background: rgba(15, 118, 85, 0.92);
	}

	.status-pill--warning {
		background: rgba(216, 126, 22, 0.94);
	}

	.status-pill--danger {
		background: rgba(193, 59, 57, 0.94);
	}

	.status-pill--info {
		background: rgba(49, 70, 104, 0.8);
	}

	.metric-row {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 30rpx;
		z-index: 1;
	}

	.metric-item {
		min-width: 0;
		padding: 0 14rpx;
		border-right: 1rpx solid rgba(255, 255, 255, 0.25);
		text-align: center;
	}

	.metric-item:first-child {
		padding-left: 0;
	}

	.metric-item:last-child {
		padding-right: 0;
		border-right: none;
	}

	.metric-value {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 27rpx;
		font-weight: 700;
	}

	.metric-label {
		display: block;
		margin-top: 8rpx;
		color: rgba(255, 255, 255, 0.72);
		font-size: 21rpx;
	}

	.quick-band {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		padding: 24rpx 14rpx;
		background: #fff;
	}

	.quick-band--dynamic {
		margin-top: 12rpx;
		border-top: 1rpx solid #edf2f4;
		animation: sectionBodyEnter .2s ease both;
	}

	.quick-action {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-width: 0;
		height: 116rpx;
		border-radius: 8rpx;
	}

	.quick-action image {
		width: 48rpx;
		height: 48rpx;
	}

	.quick-action__symbol {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48rpx;
		height: 48rpx;
		border-radius: 8rpx;
		background: #e8f6f8;
		color: #1098ad;
		font-size: 34rpx;
		font-weight: 600;
		line-height: 1;
	}

	.quick-action text {
		max-width: 100%;
		margin-top: 10rpx;
		overflow: hidden;
		color: #355864;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 22rpx;
	}

	.quick-action--pressed {
		background: #edf6f8;
	}

	.relation-band {
		padding: 0;
		background: #fff;
		animation: sectionBodyEnter .2s ease both;
	}

	.relation-panel {
		padding-bottom: 8rpx;
	}

	.relation-item {
		display: grid;
		grid-template-columns: 48rpx minmax(0, 1fr) 34rpx;
		align-items: center;
		min-height: 92rpx;
		border-bottom: 1rpx solid #edf2f4;
	}

	.relation-item:last-child {
		border-bottom: none;
	}

	.relation-item image {
		width: 40rpx;
		height: 40rpx;
	}

	.relation-item text {
		margin-left: 16rpx;
		font-size: 26rpx;
	}

	.relation-item .relation-arrow {
		margin-left: 0;
		color: #9aadb5;
		font-size: 38rpx;
		text-align: right;
	}

	.relation-item--pressed {
		background: #f3f8fa;
	}

	.related-tab-panel {
		margin-top: 14rpx;
		background: #fff;
	}

	.info-band {
		margin-top: 14rpx;
		padding: 0 28rpx 10rpx;
		background: #fff;
	}

	.section-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 82rpx;
		border-bottom: 1rpx solid #edf2f4;
		font-size: 27rpx;
		font-weight: 650;
	}

	.section-heading__copy {
		min-width: 0;
		flex: 1;
		display: flex;
		align-items: center;
	}

	.section-heading__text {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
		padding: 12rpx 0;
	}

	.section-heading__text>text:first-child {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.section-description {
		overflow: hidden;
		color: #8ca0a8;
		font-size: 20rpx;
		font-weight: 400;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.section-heading--toggle {
		transition: opacity .16s ease, background-color .16s ease;
	}

	.section-heading--pressed {
		opacity: .72;
		background: #f5f9fa;
	}

	.section-count {
		margin-left: 10rpx;
		color: #8ca0a8;
		font-size: 21rpx;
		font-weight: 500;
	}

	.section-toggle {
		flex: none;
		color: #81969e;
		font-size: 40rpx;
		line-height: 1;
		transform: rotate(90deg);
		transition: transform .18s ease;
	}

	.section-toggle.expanded {
		transform: rotate(-90deg);
	}

	.section-mark {
		width: 7rpx;
		height: 28rpx;
		margin-right: 14rpx;
		border-radius: 4rpx;
		background: #e94b2c;
	}

	.section-body-enter {
		animation: sectionBodyEnter .2s ease both;
	}

	.field-row {
		display: grid;
		grid-template-columns: 190rpx minmax(0, 1fr);
		gap: 18rpx;
		align-items: start;
		min-height: 72rpx;
		padding: 18rpx 0;
		border-bottom: 1rpx solid #f0f4f6;
		box-sizing: border-box;
	}

	.field-row:last-child {
		border-bottom: none;
	}

	.field-row--map {
		grid-template-columns: minmax(0, 1fr);
		gap: 12rpx;
	}

	.field-row--map .field-value-wrap {
		display: block;
		width: 100%;
	}

	.detail-field-map {
		width: 100%;
		min-width: 0;
	}

	.detail-field-map__canvas,
	.detail-field-map__placeholder {
		width: 100%;
		height: 330rpx;
		overflow: hidden;
		border-radius: var(--mci-radius-md);
		background: var(--mci-bg-surface);
	}

	.detail-field-map__placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12rpx;
		color: var(--mci-text-tertiary);
		font-size: 24rpx;
	}

	.detail-field-map__pin {
		color: var(--mci-color-primary);
		font-size: 44rpx;
		line-height: 1;
	}

	.detail-field-map__address,
	.detail-field-map__coordinate {
		display: block;
		margin-top: 12rpx;
		color: var(--mci-text-secondary);
		font-size: 23rpx;
		line-height: 34rpx;
		word-break: break-all;
	}

	.detail-field-map__coordinate {
		margin-top: 4rpx;
		color: var(--mci-text-tertiary);
		font-size: 21rpx;
	}

	.field-value--rich {
		display: block;
		width: 100%;
		min-width: 0;
		line-height: 1.7;
	}

	.field-label {
		color: #718791;
		font-size: 24rpx;
		line-height: 36rpx;
	}

	.field-value-wrap {
		display: flex;
		align-items: flex-start;
		justify-content: flex-end;
		min-width: 0;
		gap: 14rpx;
	}

	.field-value {
		min-width: 0;
		color: #203f4a;
		font-size: 25rpx;
		line-height: 36rpx;
		text-align: right;
		word-break: break-all;
	}

	.field-value--native {
		width: 100%;
		text-align: left;
	}

	.field-value--native :deep(.native-control__value) {
		text-align: right;
	}

	.inline-action {
		flex: none;
		min-width: 74rpx;
		height: 42rpx;
		border: 1rpx solid #8cc9e9;
		border-radius: 7rpx;
		color: #0b86d4;
		font-size: 21rpx;
		line-height: 42rpx;
		text-align: center;
	}

	.summary-block {
		padding: 22rpx 0;
		border-bottom: 1rpx solid #f0f4f6;
	}

	.summary-block:last-child {
		border-bottom: none;
	}

	.summary-label {
		display: block;
		color: #718791;
		font-size: 23rpx;
	}

	.summary-text {
		display: block;
		margin-top: 10rpx;
		color: #203f4a;
		font-size: 25rpx;
		line-height: 1.7;
		word-break: break-all;
	}

	.summary-text--rich {
		width: 100%;
		min-width: 0;
	}

	.acceptance-band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20rpx;
		margin-top: 14rpx;
		padding: 26rpx 28rpx;
		background: #fff;
	}

	.acceptance-title {
		display: block;
		font-size: 27rpx;
		font-weight: 650;
	}

	.acceptance-desc {
		display: block;
		max-width: 350rpx;
		margin-top: 8rpx;
		color: #718791;
		font-size: 21rpx;
		line-height: 1.5;
	}

	.acceptance-actions {
		display: flex;
		flex: none;
		gap: 12rpx;
	}

	.acceptance-button {
		width: 112rpx;
		height: 64rpx;
		margin: 0;
		border-radius: 8rpx;
		font-size: 23rpx;
		line-height: 64rpx;
	}

	.acceptance-button::after {
		border: none;
	}

	.acceptance-button--reject {
		background: #fff0ee;
		color: #c13b39;
	}

	.acceptance-button--pass {
		background: #0f7655;
		color: #fff;
	}

	.content-spacer {
		height: 30rpx;
	}

	.bottom-actions {
		display: flex;
		flex: none;
		gap: 14rpx;
		padding: 16rpx 22rpx calc(16rpx + var(--mci-safe-bottom));
		border-top: 1rpx solid #e5edef;
		background: #fff;
		z-index: 5;
	}

	.action-button {
		flex: 1;
		min-width: 0;
		height: 82rpx;
		margin: 0;
		border-radius: 8rpx;
		font-size: 25rpx;
		font-weight: 650;
		line-height: 82rpx;
	}

	.action-button::after {
		border: none;
	}

	.action-button--with-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10rpx;
		line-height: 1;
	}

	.action-button__icon {
		width: 34rpx;
		height: 34rpx;
		padding: 4rpx;
		box-sizing: border-box;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.92);
	}

	.action-button--primary {
		background: #e94b2c;
		color: #fff;
	}

	.action-button--secondary {
		background: #0b86d4;
		color: #fff;
	}

	.action-button--plain {
		background: #edf3f5;
		color: #476570;
	}

	.action-button[disabled] {
		opacity: 0.56;
	}

	.dialog-mask {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 24rpx;
		box-sizing: border-box;
		background: rgba(13, 39, 49, 0.48);
		z-index: 20;
	}

	.dialog-panel {
		width: 100%;
		max-width: 720rpx;
		padding: 30rpx 28rpx calc(24rpx + var(--mci-safe-bottom));
		border-radius: 8rpx 8rpx 0 0;
		background: #fff;
		box-sizing: border-box;
	}

	.dialog-title {
		display: block;
		font-size: 31rpx;
		font-weight: 700;
	}

	.dialog-desc {
		display: block;
		margin-top: 10rpx;
		color: #718791;
		font-size: 23rpx;
		line-height: 1.55;
	}

	.dialog-textarea {
		width: 100%;
		height: 190rpx;
		margin-top: 24rpx;
		padding: 20rpx;
		border: 1rpx solid #dce7eb;
		border-radius: 8rpx;
		background: #f5f8f9;
		box-sizing: border-box;
		font-size: 25rpx;
		line-height: 1.6;
	}

	.approval-opinions {
		width: 100%;
		margin-top: 16rpx;
		white-space: nowrap;
	}

	.approval-opinions__row {
		display: inline-flex;
		gap: 10rpx;
		padding-right: 12rpx;
	}

	.approval-opinion {
		flex: none;
		max-width: 360rpx;
		padding: 10rpx 15rpx;
		overflow: hidden;
		border: 1rpx solid #d9e7eb;
		border-radius: 6rpx;
		color: #476773;
		background: #f2f7f8;
		font-size: 21rpx;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.dialog-actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16rpx;
		margin-top: 24rpx;
	}

	.dialog-button {
		height: 76rpx;
		margin: 0;
		border-radius: 8rpx;
		background: #edf3f5;
		color: #476570;
		font-size: 25rpx;
		line-height: 76rpx;
	}

	.dialog-button::after {
		border: none;
	}

	.dialog-button--confirm {
		background: #e94b2c;
		color: #fff;
	}

	@keyframes skeletonPulse {

		0%,
		100% {
			opacity: 0.52;
		}

		50% {
			opacity: 1;
		}
	}

	@keyframes sectionBodyEnter {
		from {
			opacity: 0;
			transform: translateY(-6rpx);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (prefers-reduced-motion: reduce) {

		.relation-band,
		.section-body-enter {
			animation: none;
		}

		.section-toggle {
			transition: none;
		}
	}
</style>
