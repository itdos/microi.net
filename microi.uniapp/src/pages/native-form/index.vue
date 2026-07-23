<template>
	<mci-page-shell class="native-form-page" :style="mciTokenStyle" :title="pageTitle" :subtitle="tableDescription"
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

			<view v-for="(group, groupIndex) in groups" :key="group.name + groupIndex" class="form-section mci-fade-up"
				:style="{ animationDelay: `${Math.min(groupIndex, 6) * 45}ms` }">
				<view class="form-section__header">
					<view class="form-section__bar"></view>
					<text>{{ group.name }}</text>
				</view>

				<view v-for="field in group.fields" :key="field.Id || field.Name" class="form-field"
					:class="{ 'form-field--readonly': isReadonly(field) }">
					<view class="form-field__label">
						<text>{{ field.Label || field.Name }}</text>
						<text v-if="field.required && !isReadonly(field)" class="form-field__required">*</text>
					</view>

					<mci-native-field v-model="form[field.Name]" :field="field" :readonly="isReadonly(field)"
						:table-name="tableName" :form-data="form" :menu-id="menuId"
						:module-engine-key="moduleEngineKey" :table-child-auth="tableChildAuth"
						@select="handleNativeFieldSelect" />

					<view v-if="tenantFieldActions(field).length" class="tenant-field-actions">
						<view v-for="action in tenantFieldActions(field)" :key="action.key"
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
			</view>

			<mci-child-table v-for="field in childFields" :key="field.Id || field.Name" :field="field"
				:parent-id="rowId" :parent-form="form" :parent-menu-id="menuId"
				:parent-table-id="definition && definition.table ? definition.table.Id : ''"
				:parent-mode="mode" :readonly="mode === 'View'" />

			<mci-join-form v-for="field in joinFields" :key="field.Id || field.Name" :field="field" :parent-form="form"
				:parent-mode="mode" :readonly="mode === 'View'" />

			<mci-table-selector v-for="field in openTableFields" :key="field.Id || field.Name" :field="field"
				:parent-table="tableName" :parent-id="rowId" :parent-form="form"
				:parent-menu-id="menuId"
				:readonly="mode === 'View' || Number(field.Readonly || 0) === 1" @change="handleRelatedChange" />

			<mci-related-table v-for="field in joinTableFields" :key="field.Id || field.Name" :field="field"
				:parent-form="form" :parent-menu-id="menuId" />

			<view class="form-bottom-space"></view>
		</view>

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
		scopeNativeFormDefinition
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
		createTenantFormState,
		getTenantFormFieldActions,
		handleTenantFormFieldSelect,
		initializeTenantForm,
		notifyTenantFormSaved,
		prepareTenantFormSubmit,
		runTenantFormFieldAction,
		tenantFormBusyMessage
	} from '@/platform/form-extension.js'

	export default {
		mixins: [themeMixin],
		data() {
			return {
				tableName: '',
				menuId: '',
				rowId: '',
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
				viewManifest: null
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
				return this.definition ? this.definition.groups : []
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
			this.moduleEngineKey = decodeURIComponent(options.moduleEngineKey || '')
			this.tableChildAuth = parseJson(decodeURIComponent(options.tableChildAuth || ''), null)
			this.tenantFormState = createTenantFormState(this.tenantFormContext())
			this.loadForm()
		},
		methods: {
			async loadForm(refresh = false) {
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
					await hydrateNativeFormOptions(definition, this.form, {
						menuId: this.menuId,
						moduleEngineKey: this.moduleEngineKey,
						tableChildAuth: this.tableChildAuth
					})
					this.definition = definition
					await this.$nextTick()
					await initializeTenantForm(this.tenantFormContext())
				} catch (error) {
					this.error = error.message || error.Msg || '表单加载失败'
				} finally {
					this.loading = false
				}
			},
			isReadonly(field) {
				return this.mode === 'View' || !field.editable
			},
			handleRelatedChange() {
				this.form = {
					...this.form
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
			async runTenantFieldAction(field, action) {
				if (!action || action.disabled) return
				await runTenantFormFieldAction(this.tenantFormContext(), field, action)
			},
			async handleNativeFieldSelect(payload) {
				await handleTenantFormFieldSelect(this.tenantFormContext(), payload)
			},
			async submit() {
				if (this.saving) return
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
						fields: this.definition.fields,
						extraValues: {
							...nativeFormDefaultSubmitValues(this.definition, this.defaultValues),
							...tenantSubmitValues
						},
						menuId: this.menuId,
						tableChildAuth: this.tableChildAuth
					})
					if (!this.rowId && result.Data) this.rowId = result.Data.Id || result.Data
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
					const changedEvent = {
						table: this.tableName,
						id: this.rowId
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

	.stale-tip {
		margin-bottom: 16rpx;
		padding: 16rpx 20rpx;
		border-left: 3px solid #d99b1f;
		color: #7d5b16;
		background: #fff9e8;
		font-size: 23rpx;
	}

	.form-section {
		margin-bottom: 20rpx;
		background: var(--mci-bg-card, #fff);
		border: 1px solid var(--mci-border, #e4ecef);
		border-radius: 8px;
		overflow: hidden;
		animation: mciNativeFormEnter .32s ease both;
	}

	.form-section__header {
		height: 84rpx;
		display: flex;
		align-items: center;
		gap: 14rpx;
		padding: 0 24rpx;
		border-bottom: 1px solid var(--mci-border, #e7eef0);
		font-size: 29rpx;
		font-weight: 700;
	}

	.form-section__bar {
		width: 7rpx;
		height: 30rpx;
		border-radius: 4rpx;
		background: linear-gradient(180deg, #0b86d4, #20b6b2);
	}

	.form-field {
		padding: 24rpx;
		border-bottom: 1px solid #edf2f4;
	}

	.form-field:last-child {
		border-bottom: 0;
	}

	.form-field__label {
		display: flex;
		align-items: center;
		gap: 5rpx;
		margin-bottom: 14rpx;
		color: var(--mci-text-primary, #17313b);
		font-size: 26rpx;
		font-weight: 600;
	}

	.form-field__required {
		color: #e54625;
	}

	.tenant-field-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12rpx;
		justify-content: flex-end;
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

	@media (prefers-reduced-motion: reduce) {
		.form-section {
			animation: none;
		}
	}
</style>
