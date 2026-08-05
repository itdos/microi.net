<template>
	<!-- zhy: 下拉打开时提升表单正文层级，避免被固定栏和悬浮入口遮挡。 -->
	<mci-page-shell class="native-form-page" :class="{ 'native-form-page--select-open': !!openSelectorField }"
		:style="mciTokenStyle" :title="pageTitle" :subtitle="tableDescription"
		@back="goBack">
		<template #right><button v-if="!loading && !error && mode === 'View' && rowId" class="edit-command"
				@tap="switchToEdit">编辑</button></template>
		<mci-skeleton v-if="loading" type="form" :rows="7" />

		<view v-else-if="error" class="form-state">
			<text class="form-state__icon">!</text>
			<text class="form-state__title">表单加载失败</text>
			<text class="form-state__text">{{ error }}</text>
			<view class="mci-btn form-state__button" hover-class="mci-btn--pressed" @tap="loadForm(true)">
				<text>重新加载</text></view>
		</view>

		<view v-else class="native-form">
			<view v-if="stale" class="stale-tip"><text>当前展示了缓存配置，网络恢复后将自动更新</text></view>

			<view v-if="tenantFormPresentation.clock || tenantFormPresentation.location"
				class="tenant-form-presentation">
				<view v-if="tenantFormPresentation.clock" class="tenant-form-clock">
					<text class="tenant-form-clock__value">{{ tenantFormPresentation.clock.value }}</text>
					<text v-if="tenantFormPresentation.clock.note" class="tenant-form-clock__note">
						{{ tenantFormPresentation.clock.note }}
					</text>
				</view>

				<view v-if="tenantFormPresentation.location" class="tenant-form-location">
					<view class="tenant-form-location__heading">
						<text class="tenant-form-location__title">
							{{ tenantFormPresentation.location.title || '现场位置' }}
						</text>
						<view v-if="tenantFormPresentation.location.actionKey" class="tenant-form-location__action"
							@tap="runTenantPresentationAction(tenantFormPresentation.location.actionKey)">
							{{ tenantFormPresentation.location.actionLabel || '重新定位' }}
						</view>
					</view>
					<view class="tenant-form-location__map-wrap"
						@tap="runTenantPresentationAction(tenantFormPresentation.location.actionKey)">
						<map v-if="tenantFormPresentation.location.mapReady && tenantFormPresentation.location.latitude && tenantFormPresentation.location.longitude"
							class="tenant-form-location__map"
							:latitude="tenantFormPresentation.location.latitude"
							:longitude="tenantFormPresentation.location.longitude"
							:markers="tenantFormPresentationMarkers" :show-location="true" :enable-zoom="true" />
						<view v-else class="tenant-form-location__placeholder">
							<text class="tenant-form-location__pin">⌖</text>
							<text>
								{{ tenantFormPresentation.location.locating
									? '正在获取当前位置…'
									: tenantFormPresentation.location.emptyText || '点击获取当前位置' }}
							</text>
						</view>
					</view>
					<text class="tenant-form-location__address">
						{{ tenantFormPresentation.location.address || '正在获取并解析签到地点…' }}
					</text>
					<text v-if="tenantFormPresentation.location.latitude && tenantFormPresentation.location.longitude"
						class="tenant-form-location__coordinate">
						经度 {{ Number(tenantFormPresentation.location.longitude).toFixed(6) }}，纬度
						{{ Number(tenantFormPresentation.location.latitude).toFixed(6) }}
					</text>
				</view>
			</view>

			<mci-related-tabs v-if="formTabs.length > 1" class="form-tabs--full" :items="formTabs" :active-key="activeFormTabKey"
				@select="selectFormTab" />

			<!-- zhy: 当前下拉所在分组临时解除卡片裁切。 -->
			<view v-for="(group, groupIndex) in groups" :key="group.key || group.name + groupIndex"
				class="form-section mci-fade-up"
				:class="{ 'form-section--ungrouped': group.source === 'Ungrouped', 'form-section--select-open': isSelectorGroupOpen(group), 'form-section--collapsed': !isGroupExpanded(group, groupIndex) }"
				:style="{ animationDelay: `${Math.min(groupIndex, 6) * 45}ms` }">
				<view v-if="group.source === 'CollapseGroup'" class="form-section__header"
					:class="{ expanded: isGroupExpanded(group, groupIndex) }"
					hover-class="form-section__header--pressed"
					@tap="toggleGroup(group, groupIndex)">
					<view class="form-section__heading">
						<view class="form-section__bar"></view>
						<view class="form-section__copy">
							<text class="form-section__title">{{ group.name }}</text>
							<text v-if="group.description" class="form-section__description">{{ group.description }}</text>
						</view>
						<text v-if="group.showFieldCount !== false" class="form-section__count">{{ group.fields.length }} 项</text>
					</view>
					<text class="form-section__toggle" :class="{ expanded: isGroupExpanded(group, groupIndex) }">›</text>
				</view>

				<!-- zhy: 折叠后按需移除字段控件，已填写值仍保存在 form 中。 -->
				<view v-if="isGroupExpanded(group, groupIndex)" class="form-section__content">
					<view v-if="embeddedOpenTableRelatedForGroup(group).length"
						class="form-section__selector-grid">
						<mci-table-selector v-for="relatedTab in embeddedOpenTableRelatedForGroup(group)"
							:key="relatedTab.key" :field="relatedTab.field" :parent-table="tableName"
							:parent-id="relationParentId" :parent-form="form" :parent-menu-id="menuId"
							:readonly="mode === 'View' || isConfiguredReadonly(relatedTab.field)" compact
							@change="handleRelatedChange" />
					</view>
					<view v-for="field in group.fields" :key="field.Id || field.Name" class="form-field"
						v-show="tenantFieldPresentation(field).visible !== false"
						:class="{ 'form-field--readonly': isReadonly(field), 'form-field--select-open': openSelectorField === field.Name }">
						<view class="form-field__label">
							<view class="form-field__label-copy">
								<text>{{ field.Label || field.Name }}</text>
								<text v-if="field.required && !isReadonly(field)" class="form-field__required">*</text>
							</view>
							<view v-if="tenantLabelFieldActions(field).length" class="tenant-field-label-actions">
								<view v-for="action in tenantLabelFieldActions(field)" :key="action.key"
									class="tenant-field-label-action"
									:class="{ 'tenant-field-label-action--disabled': action.disabled }"
									hover-class="tenant-field-action--pressed" @tap="runTenantFieldAction(field, action)">
									<view v-if="action.iconType === 'search'" class="tenant-field-label-action__search"></view>
									<text v-else-if="action.icon" class="tenant-field-action__icon">{{ action.icon }}</text>
									<text>{{ action.label }}</text>
								</view>
							</view>
						</view>

						<view v-if="tenantFieldPresentation(field).type === 'map'" class="tenant-field-map">
							<map v-if="tenantFieldPresentation(field).latitude && tenantFieldPresentation(field).longitude"
								class="tenant-field-map__canvas"
								:latitude="tenantFieldPresentation(field).latitude"
								:longitude="tenantFieldPresentation(field).longitude"
								:markers="tenantFieldMapMarkers(field)" :show-location="false" :enable-zoom="true" />
							<view v-else class="tenant-field-map__placeholder">
								<text class="tenant-field-map__pin">⌖</text>
								<text>{{ tenantFieldPresentation(field).emptyText || '暂无位置信息' }}</text>
							</view>
							<text v-if="tenantFieldPresentation(field).address" class="tenant-field-map__address">
								{{ tenantFieldPresentation(field).address }}
							</text>
							<text v-if="tenantFieldPresentation(field).latitude && tenantFieldPresentation(field).longitude"
								class="tenant-field-map__coordinate">
								经度 {{ Number(tenantFieldPresentation(field).longitude).toFixed(6) }}，纬度
								{{ Number(tenantFieldPresentation(field).latitude).toFixed(6) }}
							</text>
						</view>

						<!-- zhy: 接收下拉开关状态并同步外层层叠样式。 -->
						<!-- zhy：详情模式下给租户配置的长文本字段传入最大可视行数。 -->
						<view v-else class="tenant-field-control-wrap"
							:class="{ 'tenant-field-control-wrap--clearable': tenantFieldPresentation(field).clearable }">
							<mci-native-field v-model="form[field.Name]" :field="field" :readonly="isReadonly(field)"
								:readonly-max-lines="readonlyMaxLines(field)"
								:table-name="tableName" :form-data="form" :menu-id="menuId"
								:module-engine-key="moduleEngineKey" :table-child-auth="tableChildAuth"
								@change="handleNativeFieldChange(field, $event)"
								@select="handleNativeFieldSelect"
								@selector-toggle="handleSelectorToggle(field, $event)" />
							<view v-if="tenantFieldPresentation(field).clearable && !isReadonly(field) && form[field.Name]"
								class="tenant-field-clear" hover-class="tenant-field-clear--pressed"
								@tap="clearTenantField(field)"><text>×</text></view>
						</view>

						<view v-if="tenantBottomFieldActions(field).length" class="tenant-field-actions">
							<view v-for="action in tenantBottomFieldActions(field)" :key="action.key"
								class="tenant-field-action"
								:class="{ 'tenant-field-action--disabled': action.disabled }"
								hover-class="tenant-field-action--pressed" @tap="runTenantFieldAction(field, action)">
								<text v-if="action.icon" class="tenant-field-action__icon">{{ action.icon }}</text>
								<text>{{ action.label }}</text>
							</view>
						</view>

						<text v-if="field.optionError" class="form-field__option-error">选项暂未加载，可稍后重试</text>
						<text v-if="field.Description" class="form-field__description">{{ field.Description }}</text>
					</view>
					<mci-business-related-list
						v-for="relatedTab in embeddedChildRelatedForGroup(group)"
						:key="relatedTab.key"
						class="form-section__related-preview"
						:field="relatedTab.field"
						:parent-id="relationParentId"
						:parent-form="form"
						:parent-menu-id="menuId"
						:parent-table-id="definition && definition.table ? definition.table.Id : ''"
						:parent-table-child-auth="tableChildAuth"
						:parent-mode="mode"
						display-mode="preview"
						:preview-limit="2"
						@data-count="handleRelatedCount"
					/>
				</view>
			</view>

			<!-- 平台同一 Tab 中的普通字段按 Sort 展示在关联子表标题之前。 -->
			<view v-for="relatedTab in standaloneRelatedTabs" :key="relatedTab.key" class="related-tab-panel">
				<mci-business-related-list v-if="relatedTab.type === 'child'" :field="relatedTab.field"
					:parent-id="relationParentId" :parent-form="form" :parent-menu-id="menuId"
					:parent-table-id="definition && definition.table ? definition.table.Id : ''"
					:parent-table-child-auth="tableChildAuth"
					:parent-mode="mode"
					:display-mode="mode === 'View' ? 'preview' : 'full'"
					:show-preview-header="mode === 'View'"
					:preview-limit="2" @data-count="handleRelatedCount" />
				<mci-join-form v-else-if="relatedTab.type === 'join'" :field="relatedTab.field"
					:parent-form="form" :parent-mode="mode" :readonly="mode === 'View'" />
				<mci-table-selector v-else-if="relatedTab.type === 'openTable'" :field="relatedTab.field"
					:parent-table="tableName" :parent-id="relationParentId" :parent-form="form" :parent-menu-id="menuId"
					:readonly="mode === 'View' || isConfiguredReadonly(relatedTab.field)"
					@change="handleRelatedChange" />
				<mci-related-table v-else-if="relatedTab.type === 'joinTable'" :field="relatedTab.field"
					:parent-form="form" :parent-menu-id="menuId" />
			</view>

			<view class="form-bottom-space"></view>
		</view>

		<mci-customer-picker :visible="customerPickerVisible" :selected-id="selectedCustomerPickerId"
			@close="closeCustomerPicker" @select="selectCustomerFromPicker" />

		<template #fixed>
			<view v-if="!loading && !error && mode !== 'View'" class="form-actions">
				<view class="form-actions__secondary" hover-class="form-actions__pressed" @tap="goBack"><text>取消</text>
				</view>
				<view class="form-actions__primary" :class="{ disabled: saving }" hover-class="form-actions__pressed"
					@tap="submit"><text>{{ saving ? '正在保存' : '保存' }}</text></view>
			</view>
		</template>
	</mci-page-shell>
</template>

<script>
	import {
		themeMixin
	} from '@/utils/theme.js'
	import {
		getUser,
		setUser
	} from '@/utils/request.js'
	import {
		defaultFormData,
		applyNativeFormViewDefinition,
		hydrateNativeFormOptions,
		nativeFormDefaultSubmitValues,
		parseJson,
		scopeNativeFormDefinition,
		validateNativeForm
	} from '@/platform/native-form.js'
	import {
		isFormEngineRecordAdapter,
		loadNativeFormRecordDefinition,
		loadNativeFormRecord,
		normalizeFormRecordAdapter,
		saveNativeFormRecord
	} from '@/platform/form-record-adapter.js'
	import {
		compileFormConfig,
		loadModuleViewManifest
	} from '@/platform/view-manifest.js'
	import {
		businessModules
	} from '@/platform/business.js'
	import {
		createTenantFormState,
		disposeTenantForm,
		getTenantFormFieldActions,
		getTenantFormFieldPresentation,
		getTenantFormPresentation,
		handleTenantFormFieldSelect,
		handleTenantFormFieldChange,
		handleTenantFormRelatedCount,
		initializeTenantForm,
		notifyTenantFormSaved,
		prepareTenantFormSubmit,
		refreshTenantFormDerivedValues,
		runTenantFormFieldAction,
		runTenantFormPresentationAction,
		tenantFormBusyMessage
	} from '@/platform/form-extension.js'
	import MciBusinessRelatedList from '@/components/mci-business-related-list/mci-business-related-list.vue'
	import MciCustomerPicker from '@/components/mci-customer-picker/mci-customer-picker.vue'

	function createDraftRowId() {
		let seed = Date.now()
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (token) => {
			const value = (seed + Math.random() * 16) % 16 | 0
			seed = Math.floor(seed / 16)
			return (token === 'x' ? value : (value & 0x3) | 0x8).toString(16)
		})
	}

	export default {
		components: { MciBusinessRelatedList, MciCustomerPicker },
		mixins: [themeMixin],
		data() {
			return {
				tableName: '',
				menuId: '',
				rowId: '',
				draftRowId: '',
				mode: 'View',
				title: '',
				definition: null,
				form: {},
				loading: true,
				saving: false,
				stale: false,
				error: '',
				defaultValues: {},
				stayAfterAdd: false,
				showRelated: true,
				includeNames: [],
				excludeNames: [],
				readonlyNames: [],
				recordAdapter: 'form-engine',
				moduleEngineKey: '',
				tableChildAuth: null,
				tenantFormState: {},
				viewManifest: null,
				// zhy: 记录当前打开下拉框的字段名。
				openSelectorField: '',
				customerPickerVisible: false,
				customerPickerConfig: null,
				// zhy: 保存新增和编辑页已展开的字段分组。
				expandedGroupKeys: [],
				activeFormTabKey: '',
				// zhy: 标识最近一次表单加载，防止编辑或重试并发时旧响应覆盖新页面。
				formLoadId: 0
			}
		},
		computed: {
			pageTitle() {
				return this.title || (this.mode === 'Add' ? '新增' : this.mode === 'Edit' ? '编辑' : '详情')
			},
			tableDescription() {
				return this.definition && this.definition.table ? this.definition.table.Description || '' : ''
			},
			groups() {
				const groups = this.definition ? this.definition.relatedGroups || this.definition.groups || [] : []
				const visibleGroups = groups.filter((group) =>
					(group.fields || []).length || this.embeddedRelatedForGroup(group).length
				)
				if (!this.formTabs.length) return visibleGroups
				return visibleGroups.filter((group) => group.tabKey === this.activeFormTabKey)
			},
			formTabs() {
				return (this.definition?.formTabs || []).map((tab) => ({
					...tab,
					label: tab.name
				}))
			},
			isEditableMode() {
				return this.mode === 'Add' || this.mode === 'Edit'
			},
			relationParentId() {
				return this.rowId || this.draftRowId || ''
			},
			childFields() {
				return this.showRelated && this.definition ? this.definition.childFields || [] : []
			},
			joinFields() {
				return this.showRelated && this.definition ? this.definition.joinFields || [] : []
			},
			openTableFields() {
				return this.showRelated && this.definition ? this.definition.openTableFields || [] : []
			},
			joinTableFields() {
				return this.showRelated && this.definition ? this.definition.joinTableFields || [] : []
			},
			hasRelatedFields() {
				return this.childFields.length + this.joinFields.length + this.openTableFields.length + this
					.joinTableFields.length > 0
			},
			relatedTabs() {
				const toTabs = (fields, type) => fields.map((field) => ({
					key: `${type}:${field.Id || field.Name}`,
					label: field.Label || field.Name || '关联业务',
					type,
					field
				}))
				return [
					...toTabs(this.childFields, 'child'),
					...toTabs(this.joinFields, 'join'),
					...toTabs(this.openTableFields, 'openTable'),
					...toTabs(this.joinTableFields, 'joinTable')
				]
			},
			activeRelatedTabs() {
				if (!this.formTabs.length) return this.relatedTabs
				return this.relatedTabs.filter((item) => item.field.formTabKey === this.activeFormTabKey)
			},
			selectedCustomerPickerId() {
				const fieldName = this.customerPickerConfig && this.customerPickerConfig.idFieldName
				return fieldName ? this.form[fieldName] || '' : ''
			},
			standaloneRelatedTabs() {
				return this.activeRelatedTabs.filter((item) => !this.isEmbeddedRelated(item))
			},
			tenantFormPresentation() {
				return getTenantFormPresentation(this.tenantFormContext())
			},
			tenantFormPresentationMarkers() {
				const location = this.tenantFormPresentation.location || {}
				if (!location.latitude || !location.longitude) return []
				return [{
					id: 1,
					latitude: Number(location.latitude),
					longitude: Number(location.longitude),
					width: 28,
					height: 36
				}]
			}
		},
		onLoad(options) {
			this.tableName = decodeURIComponent(options.table || '')
			this.menuId = decodeURIComponent(options.menuId || '')
			this.rowId = decodeURIComponent(options.id || '')
			this.mode = options.mode || (this.rowId ? 'View' : 'Add')
			this.title = decodeURIComponent(options.title || '')
			this.stayAfterAdd = String(options.stayAfterAdd || '0') === '1'
			this.showRelated = String(options.related ?? '1') !== '0'
			this.defaultValues = parseJson(decodeURIComponent(options.defaults || ''), {}) || {}
			this.includeNames = parseJson(decodeURIComponent(options.fields || ''), []) || []
			this.excludeNames = parseJson(decodeURIComponent(options.excludeFields || ''), []) || []
			this.readonlyNames = parseJson(decodeURIComponent(options.readonlyFields || ''), []) || []
			this.recordAdapter = normalizeFormRecordAdapter(decodeURIComponent(options.recordAdapter || 'form-engine'))
			if (this.mode === 'Add' && !this.rowId && isFormEngineRecordAdapter(this.recordAdapter)) {
				this.draftRowId = String(this.defaultValues.Id || this.defaultValues.id || createDraftRowId())
				this.defaultValues = {
					...this.defaultValues,
					Id: this.draftRowId
				}
			}
			this.moduleEngineKey = decodeURIComponent(options.moduleEngineKey || '')
			this.tableChildAuth = parseJson(decodeURIComponent(options.tableChildAuth || ''), null)
			this.tenantFormState = createTenantFormState(this.tenantFormContext())
			this.loadForm()
		},
		onShow() {
			if (this.loading || !this.definition) return
			refreshTenantFormDerivedValues(this.tenantFormContext()).catch(() => {})
		},
		onUnload() {
			// zhy: 页面销毁后作废仍在执行的异步加载，避免卸载后继续写入页面状态。
			this.formLoadId += 1
			this.openSelectorField = ''
			disposeTenantForm(this.tenantFormContext())
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
			async loadForm(refresh = false) {
				// zhy: 每次加载分配递增编号，仅允许最后一次请求更新表单。
				const loadId = ++this.formLoadId
				this.openSelectorField = ''
				if (!this.tableName) {
					this.error = '缺少表单名称'
					this.loading = false
					return
				}
				this.loading = true
				this.error = ''
				try {
					const manifestPromise = loadModuleViewManifest({
						table: this.tableName,
						menuId: this.menuId,
						menuAliases: this.title ? [this.title.replace(/^(新增|编辑|查看)/, '')] : []
					}, {
						scene: this.mode === 'View' ? 'Detail' : 'Edit',
						device: 'Mobile',
						refresh
					}).catch(() => null)
					let manifest = null
					if (!this.menuId && isFormEngineRecordAdapter(this.recordAdapter)) {
						manifest = await manifestPromise
						if (manifest && manifest.Module && manifest.Module.Id) {
							this.menuId = manifest.Module.Id
						}
					}
					const context = {
						adapter: this.recordAdapter,
						tableName: this.tableName,
						rowId: this.rowId,
						menuId: this.menuId,
						moduleEngineKey: this.moduleEngineKey,
						tableChildAuth: this.tableChildAuth,
						refresh
					}
					const definitionPromise = loadNativeFormRecordDefinition(context)
					const rowPromise = (this.rowId || !isFormEngineRecordAdapter(this.recordAdapter))
						? loadNativeFormRecord({
							...context,
							adapter: this.recordAdapter,
							tableName: this.tableName,
							rowId: this.rowId,
							menuId: this.menuId
						})
						: null
					const [rawDefinition, resolvedManifest, rowResult] = await Promise.all([
						definitionPromise,
						manifest ? Promise.resolve(manifest) : manifestPromise,
						rowPromise || Promise.resolve(null)
					])
					if (loadId !== this.formLoadId) return
					manifest = resolvedManifest
					this.viewManifest = manifest
					if ((this.rowId || !isFormEngineRecordAdapter(this.recordAdapter)) &&
						(!rowResult || Number(rowResult.Code) !== 1)) throw new Error((rowResult && rowResult
						.Msg) || '数据不存在')
					if (rowResult && rowResult.Data && rowResult.Data.Id) this.rowId = rowResult.Data.Id
					const scopedDefinition = scopeNativeFormDefinition(rawDefinition, {
						includeNames: this.includeNames,
						excludeNames: this.excludeNames,
						readonlyNames: this.readonlyNames
					})
					const definition = applyNativeFormViewDefinition(
						scopedDefinition,
						compileFormConfig(manifest)
					)
					this.form = defaultFormData(definition, {
						...this.defaultValues,
						...(rowResult ? rowResult.Data : {})
					})
					// zhy: 核心定义和记录成功后立即结束整页骨架屏，选项数据在页面显示后补齐。
					this.definition = definition
					// zhy: 初始化新增和编辑页的字段分组折叠状态。
					this.initializeGroupExpansion(definition.groups || [])
					this.initializeFormTabs()
					this.loading = false
					await this.$nextTick()
					// 必须更新页面持有的响应式定义。直接修改上面的原始 definition 会绕过
					//zhy Vue 代理，导致接口已有数据但 Radio/Checkbox 等控件仍保留空选项。
					const liveDefinition = this.definition
					await Promise.all([
						hydrateNativeFormOptions(liveDefinition, this.form, {
							menuId: this.menuId,
							moduleEngineKey: this.moduleEngineKey,
							tableChildAuth: this.tableChildAuth,
							timeoutMs: 8000
						}),
						initializeTenantForm(this.tenantFormContext())
					])
					if (loadId !== this.formLoadId) return
				} catch (error) {
					if (loadId !== this.formLoadId) return
					this.error = error.message || error.Msg || '表单加载失败'
				} finally {
					if (loadId === this.formLoadId) this.loading = false
				}
			},
			isReadonly(field) {
				return this.mode === 'View' || !field.editable
			},
			readonlyMaxLines(field) {
				// zhy：按当前物理表匹配租户业务模块，仅限制其 summaryField，普通字段保持原展示方式。
				if (this.mode !== 'View') return 0
				const module = Object.values(businessModules || {}).find((item) =>
					String(item?.table || '').toLowerCase() === String(this.tableName || '').toLowerCase()
				)
				if (!module || String(field?.Name || '').toLowerCase() !== String(module.summaryField || '').toLowerCase()) return 0
				return Math.min(20, Math.max(1, Number(module.detailSummaryLines) || 11))
			},
			isConfiguredReadonly(field) {
				const value = field && (field.Readonly ?? field.ReadOnly)
				return value === true || Number(value) === 1 || String(value).toLowerCase() === 'true'
			},
			// zhy: 使用名称和序号生成稳定的分组折叠标识。
			groupKey(group, groupIndex) {
				return String(group && group.key || `${String(group && group.name || 'group')}:${groupIndex}`)
			},
			isGroupExpanded(group, groupIndex) {
				if (group && group.source === 'Ungrouped') return true
				return this.expandedGroupKeys.includes(this.groupKey(group, groupIndex))
			},
			initializeGroupExpansion(groups) {
				if (!groups.length) {
					this.expandedGroupKeys = []
					return
				}
				this.expandedGroupKeys = groups.reduce((keys, group, index) => {
					if (group.source === 'Ungrouped' || group.defaultExpanded !== false) {
						keys.push(this.groupKey(group, index))
					}
					return keys
				}, [])
			},
			toggleGroup(group, groupIndex) {
				if (!group || group.source !== 'CollapseGroup') return
				const key = this.groupKey(group, groupIndex)
				const expanded = this.expandedGroupKeys.includes(key)
				this.expandedGroupKeys = expanded
					? this.expandedGroupKeys.filter((item) => item !== key)
					: [...this.expandedGroupKeys, key]
				// zhy: 收起包含已打开下拉框的分组时同步恢复页面层级。
				if (expanded && this.isSelectorGroupOpen(group)) this.openSelectorField = ''
			},
			initializeFormTabs() {
				if (!this.formTabs.some((item) => item.key === this.activeFormTabKey)) {
					this.activeFormTabKey = this.formTabs[0]?.key || ''
				}
			},
			selectFormTab(tab) {
				if (!tab || !tab.key) return
				this.activeFormTabKey = tab.key
				this.initializeGroupExpansion(this.groups)
			},
			// zhy: 必填校验失败时自动展开对应分组，方便用户直接补充字段。
			expandFirstInvalidGroup() {
				const allGroups = this.definition?.groups || []
				const groupIndex = allGroups.findIndex((group) =>
					group.fields.some((field) => Boolean(validateNativeForm(this.form, [field])))
				)
				if (groupIndex < 0) return
				const group = allGroups[groupIndex]
				if (group.tabKey) this.activeFormTabKey = group.tabKey
				const key = this.groupKey(group, groupIndex)
				if (!this.expandedGroupKeys.includes(key)) {
					this.expandedGroupKeys = [...this.expandedGroupKeys, key]
				}
			},
			handleRelatedChange() {
				this.form = {
					...this.form
				}
			},
			async handleRelatedCount(payload) {
				try {
					await handleTenantFormRelatedCount(this.tenantFormContext(), payload)
				} catch (error) {
					uni.showToast({
						title: error.message || error.Msg || '关联数量同步失败',
						icon: 'none'
					})
				}
			},
			async switchToEdit() {
				this.mode = 'Edit'
				await this.loadForm()
			},
			tenantFormContext(extra = {}) {
				return {
					tableName: this.tableName,
					menuId: this.menuId,
					rowId: this.rowId,
					mode: this.mode,
					recordAdapter: this.recordAdapter,
					definition: this.definition,
					form: this.form,
					defaultValues: this.defaultValues,
					state: this.tenantFormState,
					patchForm: (updates = {}) => {
						this.form = {
							...this.form,
							...updates
						}
					},
					...extra
				}
			},
			tenantFieldActions(field) {
				return getTenantFormFieldActions(this.tenantFormContext(), field)
			},
			tenantLabelFieldActions(field) {
				return this.tenantFieldActions(field).filter((action) => action.position === 'label')
			},
			tenantBottomFieldActions(field) {
				return this.tenantFieldActions(field).filter((action) => action.position !== 'label')
			},
			tenantFieldPresentation(field) {
				return getTenantFormFieldPresentation(this.tenantFormContext(), field)
			},
			tenantFieldMapMarkers(field) {
				const presentation = this.tenantFieldPresentation(field)
				if (!presentation.latitude || !presentation.longitude) return []
				return [{
					id: 1,
					latitude: Number(presentation.latitude),
					longitude: Number(presentation.longitude),
					width: 32,
					height: 40
				}]
			},
			async runTenantFieldAction(field, action) {
				if (!action || action.disabled) return
				const result = await runTenantFormFieldAction(this.tenantFormContext(), field, action)
				if (result && result.customerPicker) {
					this.customerPickerConfig = result.customerPicker
					this.customerPickerVisible = true
				}
			},
			closeCustomerPicker() {
				this.customerPickerVisible = false
			},
			async selectCustomerFromPicker(payload) {
				const config = this.customerPickerConfig || {}
				if (!config.fieldName) return
				this.form = {
					...this.form,
					[config.fieldName]: String(payload && payload.name || ''),
					...(config.idFieldName ? { [config.idFieldName]: String(payload && payload.id || '') } : {})
				}
				this.customerPickerVisible = false
			},
			async clearTenantField(field) {
				const presentation = this.tenantFieldPresentation(field)
				const updates = { [field.Name]: '' }
				;(presentation.clearFields || []).forEach((name) => { if (name) updates[name] = '' })
				this.form = { ...this.form, ...updates }
				await handleTenantFormFieldChange(this.tenantFormContext(), { field, value: '' })
			},
			async runTenantPresentationAction(actionKey) {
				if (!actionKey) return
				await runTenantFormPresentationAction(this.tenantFormContext(), {
					key: actionKey
				})
			},
			async handleNativeFieldSelect(payload) {
				await handleTenantFormFieldSelect(this.tenantFormContext(), payload)
			},
			async handleNativeFieldChange(field, value) {
				await handleTenantFormFieldChange(this.tenantFormContext(), {
					field,
					value
				})
			},
			// zhy: 根据下拉开关状态提升或恢复对应表单分组。
			handleSelectorToggle(field, open) {
				const fieldName = String(field && field.Name || '')
				if (open) {
					this.openSelectorField = fieldName
				} else if (this.openSelectorField === fieldName) {
					this.openSelectorField = ''
				}
			},
			isSelectorGroupOpen(group) {
				if (!this.openSelectorField || !group || !Array.isArray(group.fields)) return false
				return group.fields.some((field) => field.Name === this.openSelectorField)
			},
			async submit() {
				if (this.saving) return
				// 租户声明式规则隐藏的字段不参与必填校验；显示字段仍按平台元数据校验并保存。
				const submitFields = (this.definition ? this.definition.fields : [])
					.filter((field) => this.tenantFieldPresentation(field).visible !== false)
				const validationError = validateNativeForm(this.form, submitFields)
				if (validationError) {
					this.expandFirstInvalidGroup()
					await this.$nextTick()
					uni.showToast({ title: validationError, icon: 'none' })
					return
				}
				const busyMessage = tenantFormBusyMessage(this.tenantFormContext())
				if (busyMessage) {
					uni.showToast({
						title: busyMessage,
						icon: 'none'
					})
					return
				}
				this.saving = true
				try {
					const wasAdd = !this.rowId
					const tenantSubmitValues = await prepareTenantFormSubmit(this.tenantFormContext())
					const result = await saveNativeFormRecord({
						adapter: this.recordAdapter,
						tableName: this.tableName,
						rowId: this.rowId,
						form: this.form,
						fields: submitFields,
						extraValues: {
							...nativeFormDefaultSubmitValues(this.definition, this.defaultValues),
							...tenantSubmitValues,
							...(wasAdd && this.draftRowId ? { Id: this.draftRowId } : {})
						},
						menuId: this.menuId,
						tableChildAuth: this.tableChildAuth
					})
					if (!this.rowId) {
						this.rowId = result.Data?.Id ||
							(typeof result.Data === 'string' ? result.Data : '') ||
							this.draftRowId
					}
					const currentUser = getUser() || {}
					if (String(this.tableName).toLowerCase() === 'sys_user' && currentUser.Id && String(currentUser
						.Id) === String(this.rowId)) {
						const changed = {}
						this.definition.fields.forEach((field) => {
							if (this.form[field.Name] !== undefined) changed[field.Name] = this.form[field
								.Name]
						})
						setUser({
							...currentUser,
							...changed
						})
					}
					uni.showToast({
						title: '保存成功',
						icon: 'success'
					})
					// zhy：把本次保存后的完整记录随事件带回上一页，供未保存主表的关联列表即时回显。
					const savedRow = {
						...this.form,
						...tenantSubmitValues,
						...(result.Data && typeof result.Data === 'object' && !Array.isArray(result.Data)
							? result.Data
							: {}),
						Id: this.rowId
					}
					const changedEvent = {
						table: this.tableName,
						id: this.rowId,
						row: savedRow,
						parentRowId: this.tableChildAuth?.ParentRowId || '',
						parentValue: this.tableChildAuth?.ParentValue || ''
					}
					uni.$emit('microi:data-changed', changedEvent)
					await notifyTenantFormSaved(this.tenantFormContext({
						wasAdd,
						changedEvent
					}), result)
					if (wasAdd && this.rowId && this.hasRelatedFields && this.stayAfterAdd) {
						this.mode = 'Edit'
						await this.loadForm(true)
						return
					}
					setTimeout(() => this.goBack(), 450)
				} catch (error) {
					uni.showToast({
						title: error.message || error.Msg || '保存失败',
						icon: 'none'
					})
				} finally {
					this.saving = false
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

<style scoped>
	.native-form-page {
		--form-control-height: 82rpx;
	}

	/* zhy: 下拉打开时让正文高于固定底栏和 AI 悬浮入口。 */
	.native-form-page--select-open :deep(.mci-page-shell__body) {
		z-index: 1000;
	}

	.edit-command {
		width: 70rpx;
		height: 58rpx;
		margin: 0;
		padding: 0;
		border: 0;
		border-radius: 6rpx;
		background: #edf7fa;
		color: #087fbd;
		font-size: 22rpx;
		font-weight: 650;
		line-height: 58rpx;
	}

	.edit-command::after {
		border: none;
	}

	.native-form {
		padding: 20rpx 22rpx 0;
	}

	.form-tabs--full {
		width: calc(100% + 44rpx);
		margin-right: -22rpx;
		margin-bottom: 18rpx;
		margin-left: -22rpx;
	}

	.stale-tip {
		margin-bottom: 16rpx;
		padding: 16rpx 20rpx;
		border-left: 3px solid #d99b1f;
		color: #7d5b16;
		background: #fff9e8;
		font-size: 23rpx;
	}

	.tenant-form-presentation {
		margin-bottom: 20rpx;
	}

	.tenant-form-clock {
		display: flex;
		flex-direction: column;
		padding: 28rpx;
		border-radius: 8px;
		color: var(--mci-text-inverse, #fff);
		background: var(--mci-gradient-primary, linear-gradient(120deg, #0b86d4, #12a6b3 65%, #31af81));
		box-shadow: var(--mci-shadow-md, 0 10rpx 28rpx rgba(11, 134, 212, .16));
	}

	.tenant-form-clock__value {
		font-size: 37rpx;
		font-weight: 700;
		line-height: 1.25;
	}

	.tenant-form-clock__note {
		margin-top: 8rpx;
		color: rgba(255, 255, 255, .8);
		font-size: 22rpx;
	}

	.tenant-form-location {
		margin-top: 20rpx;
		padding: 22rpx;
		border: 1px solid var(--mci-border, #e1ebef);
		border-radius: 8px;
		background: var(--mci-bg-card, #fff);
		box-shadow: var(--mci-shadow-sm, 0 6rpx 18rpx rgba(24, 76, 98, .05));
	}

	.tenant-form-location__heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 16rpx;
	}

	.tenant-form-location__title {
		color: var(--mci-text-primary, #17313b);
		font-size: 28rpx;
		font-weight: 700;
	}

	.tenant-form-location__action {
		min-height: 64rpx;
		display: flex;
		align-items: center;
		padding: 0 0 0 24rpx;
		color: var(--mci-color-primary, #0b86d4);
		font-size: 23rpx;
		transition: transform .18s ease;
	}

	.tenant-form-location__action:active {
		transform: scale(.96);
	}

	.tenant-form-location__map-wrap {
		width: 100%;
		height: 310rpx;
		overflow: hidden;
		border-radius: 8px;
		background: var(--mci-bg-muted, #eaf3f6);
	}

	.tenant-form-location__map {
		width: 100%;
		height: 100%;
	}

	.tenant-form-location__placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: var(--mci-text-secondary, #718994);
		font-size: 23rpx;
	}

	.tenant-form-location__pin {
		margin-bottom: 10rpx;
		color: var(--mci-color-danger, #e94b2c);
		font-size: 68rpx;
		line-height: 1;
	}

	.tenant-form-location__address,
	.tenant-form-location__coordinate {
		display: block;
		margin-top: 14rpx;
		color: var(--mci-text-secondary, #4d6975);
		font-size: 23rpx;
		line-height: 34rpx;
		overflow-wrap: anywhere;
	}

	.tenant-form-location__coordinate {
		margin-top: 5rpx;
		color: var(--mci-text-tertiary, #84969d);
		font-size: 21rpx;
	}

	.form-section {
		position: relative;
		z-index: 0;
		margin-bottom: 20rpx;
		background: var(--mci-bg-card, #fff);
		border: 1px solid var(--mci-border, #e4ecef);
		border-radius: 8px;
		overflow: hidden;
		/* zhy: 只在首次进入前应用起始帧，结束后释放 transform 层叠上下文。 */
		animation: mciNativeFormEnter .32s ease backwards;
	}

	/* zhy: 解除当前卡片裁切；不切换 animation，避免关闭下拉时重新播放入场动画造成页面抖动。 */
	.form-section--select-open {
		z-index: 100;
		overflow: visible;
	}

	.form-section__header {
		min-height: 84rpx;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14rpx;
		padding: 0 24rpx;
		border-bottom: 0;
		font-size: 29rpx;
		font-weight: 700;
		transition: background-color .16s ease, opacity .16s ease;
	}

	.form-section__header.expanded {
		border-bottom: 1px solid var(--mci-border, #e7eef0);
	}

	.form-section__header--pressed {
		background: var(--mci-bg-muted, #f4f8fa);
		opacity: .82;
	}

	.form-section__heading {
		min-width: 0;
		flex: 1;
		display: flex;
		align-items: center;
		gap: 14rpx;
	}

	.form-section__copy {
		min-width: 0;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 5rpx;
		padding: 14rpx 0;
	}

	.form-section__title {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.form-section__description {
		display: block;
		overflow: hidden;
		color: var(--mci-text-tertiary, #84969d);
		font-size: 20rpx;
		font-weight: 400;
		line-height: 1.35;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.form-section__count {
		flex: none;
		color: var(--mci-text-tertiary, #84969d);
		font-size: 21rpx;
		font-weight: 500;
	}

	.form-section__toggle {
		flex: none;
		color: #80969e;
		font-size: 42rpx;
		line-height: 1;
		transform: rotate(90deg);
		transition: transform .18s ease;
	}

	.form-section__toggle.expanded {
		transform: rotate(-90deg);
	}

	/* zhy: 展开字段分组时使用克制动效，保持与子表折叠交互一致。 */
	.form-section__content {
		animation: mciFormSectionExpand .18s ease both;
	}

	.form-section__selector-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14rpx;
		padding: 18rpx 22rpx;
		border-bottom: 1px solid var(--mci-border, #e5eef1);
		background: linear-gradient(180deg, #f8fbfc, #fbfdfd);
	}

	.form-section__related-preview {
		display: block;
		margin: 8rpx 22rpx 22rpx;
	}

	.form-section__bar {
		width: 7rpx;
		height: 30rpx;
		border-radius: 4rpx;
		background: linear-gradient(180deg, #0b86d4, #20b6b2);
	}

	.form-field {
		position: relative;
		padding: 24rpx;
		border-bottom: 1px solid #edf2f4;
	}

	/* zhy: 保证当前字段中的下拉浮层高于同组其它字段。 */
	.form-field--select-open {
		z-index: 101;
	}

	.form-field:last-child {
		border-bottom: 0;
	}

	.form-field__label {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 14rpx;
		color: var(--mci-text-primary, #17313b);
		font-size: 26rpx;
		font-weight: 600;
	}

	.form-field__label-copy {
		display: flex;
		align-items: center;
		gap: 5rpx;
		min-width: 0;
	}

	.form-field__required {
		color: #e54625;
	}

	.tenant-field-label-actions {
		display: flex;
		align-items: center;
		gap: 10rpx;
		margin-right: 16rpx;
	}

	.tenant-field-label-action {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7rpx;
		min-height: 44rpx;
		padding: 0 12rpx;
		border: 1px solid #b9dce8;
		border-radius: 6px;
		color: var(--mci-color-primary, #087fae);
		background: #edf8fb;
		font-size: 21rpx;
		font-weight: 500;
	}

	.tenant-field-label-action__search {
		position: relative;
		width: 18rpx;
		height: 18rpx;
		border: 2rpx solid currentColor;
		border-radius: 50%;
	}

	.tenant-field-label-action__search::after {
		position: absolute;
		right: -8rpx;
		bottom: -5rpx;
		width: 9rpx;
		height: 2rpx;
		border-radius: 1rpx;
		background: currentColor;
		transform: rotate(45deg);
		content: '';
	}

	.tenant-field-label-action--disabled {
		opacity: .58;
	}

	.tenant-field-control-wrap {
		position: relative;
	}

	.tenant-field-control-wrap--clearable :deep(.native-control__input) {
		padding-right: 70rpx;
	}

	.tenant-field-clear {
		position: absolute;
		top: 15rpx;
		right: 8rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 52rpx;
		height: 52rpx;
		border-radius: 50%;
		color: #81959d;
		font-size: 32rpx;
		line-height: 1;
		transition: transform .15s ease, opacity .15s ease;
	}

	.tenant-field-clear--pressed {
		transform: scale(.9);
		opacity: .65;
	}

	.tenant-field-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
		justify-content: flex-start;
		margin-top: 16rpx;
	}

	.tenant-field-action {
		min-width: 190rpx;
		height: 66rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8rpx;
		padding: 0 22rpx;
		border-radius: 8px;
		color: #fff;
		background: linear-gradient(135deg, #0b86d4, #16aaa4);
		box-shadow: 0 6rpx 16rpx rgba(9, 126, 172, .18);
		font-size: 24rpx;
		font-weight: 650;
		transition: transform .18s ease, opacity .18s ease;
	}

	.tenant-field-action__icon {
		font-size: 30rpx;
		line-height: 1;
	}

	.tenant-field-action--disabled {
		opacity: .62;
	}

	.tenant-field-action--pressed {
		transform: scale(.97);
	}

	.tenant-field-map {
		width: 100%;
		overflow: hidden;
		border: 1px solid var(--mci-border, #dce7eb);
		border-radius: 8px;
		background: var(--mci-bg-muted, #f4f8fa);
	}

	.tenant-field-map__canvas,
	.tenant-field-map__placeholder {
		width: 100%;
		height: 330rpx;
	}

	.tenant-field-map__placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		color: var(--mci-text-secondary, #718994);
		font-size: 23rpx;
	}

	.tenant-field-map__pin {
		margin-bottom: 10rpx;
		color: var(--mci-color-primary, #0b86d4);
		font-size: 68rpx;
		line-height: 1;
	}

	.tenant-field-map__address,
	.tenant-field-map__coordinate {
		display: block;
		padding: 14rpx 18rpx 0;
		color: var(--mci-text-secondary, #4d6975);
		font-size: 23rpx;
		line-height: 34rpx;
		overflow-wrap: anywhere;
	}

	.tenant-field-map__coordinate {
		padding-top: 4rpx;
		padding-bottom: 14rpx;
		color: var(--mci-text-tertiary, #84969d);
		font-size: 21rpx;
	}

	.tenant-field-map__address:last-child {
		padding-bottom: 14rpx;
	}

	.form-field__description {
		display: block;
		margin-top: 10rpx;
		color: var(--mci-text-tertiary, #84969d);
		font-size: 22rpx;
		line-height: 1.55;
	}

	.form-field__option-error {
		display: block;
		margin-top: 10rpx;
		color: #b36a22;
		font-size: 21rpx;
	}

	.form-field__value {
		display: block;
		color: #425b64;
		font-size: 27rpx;
		line-height: 1.65;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.form-control {
		box-sizing: border-box;
		width: 100%;
		height: var(--form-control-height);
		padding: 0 22rpx;
		border: 1px solid #dce7eb;
		border-radius: 8px;
		color: #18343e;
		background: #f9fbfc;
		font-size: 27rpx;
	}

	.form-control--textarea {
		min-height: 190rpx;
		padding-top: 18rpx;
		padding-bottom: 18rpx;
		line-height: 1.6;
	}

	.form-control--picker {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #425b64;
	}

	.form-control__arrow {
		color: #7d929a;
		font-size: 38rpx;
		line-height: 1;
	}

	.form-switch {
		transform: scale(.9);
		transform-origin: left center;
	}

	.datetime-grid {
		display: grid;
		grid-template-columns: 1.35fr 1fr;
		gap: 14rpx;
	}

	.checkbox-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14rpx;
	}

	.checkbox-option {
		min-height: 72rpx;
		display: flex;
		align-items: center;
		gap: 10rpx;
		padding: 0 16rpx;
		border: 1px solid #e0e9ec;
		border-radius: 8px;
		color: #38535d;
		background: #fafcfd;
		font-size: 25rpx;
	}

	.rate-control {
		display: flex;
		gap: 14rpx;
	}

	.rate-star {
		color: #ccd8dc;
		font-size: 48rpx;
		line-height: 1;
	}

	.rate-star.active {
		color: #f4ad23;
	}

	.map-control {
		min-height: 94rpx;
		display: grid;
		grid-template-columns: 62rpx minmax(0, 1fr) 30rpx;
		align-items: center;
		gap: 14rpx;
		padding: 12rpx 18rpx;
		border: 1px solid #dce7eb;
		border-radius: 8px;
		background: #f8fbfc;
		transition: transform .18s ease;
	}

	.map-control--pressed {
		transform: scale(.985);
	}

	.map-control__icon {
		width: 58rpx;
		height: 58rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #fff;
		background: #0b86d4;
		font-size: 34rpx;
	}

	.map-control__content {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 4rpx;
	}

	.map-control__title {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		color: #31505b;
		font-size: 25rpx;
	}

	.map-control__hint {
		color: #8ca0a7;
		font-size: 21rpx;
	}

	.form-bottom-space {
		height: calc(132rpx + var(--mci-safe-bottom));
	}

	.form-actions {
		position: fixed;
		z-index: 40;
		left: var(--mci-safe-left);
		right: var(--mci-safe-right);
		bottom: 0;
		display: grid;
		grid-template-columns: 220rpx minmax(0, 1fr);
		gap: 16rpx;
		padding: 18rpx 22rpx calc(18rpx + var(--mci-safe-bottom));
		border-top: 1px solid #dfe8eb;
		background: rgba(255, 255, 255, .98);
	}

	.form-actions__secondary,
	.form-actions__primary {
		height: 84rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		font-size: 28rpx;
		font-weight: 700;
		transition: transform .18s ease, opacity .18s ease;
	}

	.form-actions__secondary {
		color: #526b74;
		border: 1px solid #d7e2e6;
		background: #fff;
	}

	.form-actions__primary {
		color: #fff;
		background: linear-gradient(135deg, #087fbd, #15a7a0);
		box-shadow: 0 8rpx 20rpx rgba(9, 126, 172, .2);
	}

	.form-actions__primary.disabled {
		opacity: .62;
	}

	.form-actions__pressed {
		transform: scale(.98);
	}

	.form-state {
		min-height: 62vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40rpx;
		text-align: center;
	}

	.form-state__icon {
		width: 86rpx;
		height: 86rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		color: #fff;
		background: #e54625;
		font-size: 48rpx;
		font-weight: 800;
	}

	.form-state__title {
		margin-top: 22rpx;
		font-size: 31rpx;
		font-weight: 700;
	}

	.form-state__text {
		max-width: 560rpx;
		margin-top: 12rpx;
		color: #73878f;
		font-size: 24rpx;
		line-height: 1.6;
	}

	.form-state__button {
		margin-top: 28rpx;
		min-width: 220rpx;
	}

	@keyframes mciNativeFormEnter {
		from {
			opacity: 0;
			transform: translateY(14rpx);
		}

		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes mciFormSectionExpand {
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
		.form-section,
		.form-section__header,
		.form-section__toggle,
		.form-section__content {
			animation: none;
			transition: none;
		}
	}
</style>
