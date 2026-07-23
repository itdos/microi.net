<template>
	<mci-page-shell class="native-form-page" :style="mciTokenStyle" :title="pageTitle" :subtitle="tableDescription"
		@back="goBack">
		<template #right><button v-if="!loading && !error && mode === 'View' && rowId" class="edit-command"
				@tap="mode = 'Edit'">编辑</button></template>
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
						:table-name="tableName" @select="handleNativeFieldSelect" />

					<view v-if="isCustomerAddressField(field)" class="customer-location">
						<view class="customer-location__button"
							:class="{ 'customer-location__button--disabled': customerLocating }"
							hover-class="customer-location__button--pressed" @tap="chooseCustomerLocation">
							<text class="customer-location__icon">⌖</text>
							<text>{{ customerLocating ? '定位中…' : '重新定位' }}</text>
						</view>
					</view>

					<text v-if="field.optionError" class="form-field__option-error">选项暂未加载，可稍后重试</text>
					<text v-if="field.Description" class="form-field__description">{{ field.Description }}</text>
				</view>
			</view>

			<mci-child-table v-for="field in childFields" :key="field.Id || field.Name" :field="field"
				:parent-id="rowId" :parent-form="form" :readonly="mode === 'View'" />

			<mci-join-form v-for="field in joinFields" :key="field.Id || field.Name" :field="field" :parent-form="form"
				:parent-mode="mode" :readonly="mode === 'View'" />

			<mci-table-selector v-for="field in openTableFields" :key="field.Id || field.Name" :field="field"
				:parent-table="tableName" :parent-id="rowId" :parent-form="form"
				:readonly="mode === 'View' || Number(field.Readonly || 0) === 1" @change="handleRelatedChange" />

			<mci-related-table v-for="field in joinTableFields" :key="field.Id || field.Name" :field="field"
				:parent-form="form" />

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
		V8,
		getUser,
		setUser
	} from '@/utils/request.js'
	import {
		defaultFormData,
		hydrateNativeFormOptions,
		loadNativeFormDefinition,
		nativeFormDefaultSubmitValues,
		parseJson,
		scopeNativeFormDefinition,
		saveNativeForm
	} from '@/platform/native-form.js'
	import {
		normalizeChosenLocation,
		reverseGeocode
	} from '@/platform/location.js'

	const CUSTOMER_TABLE = 'diy_kehu'
	const CUSTOMER_LOCATION_FIELDS = {
		region: 'Chengshi',
		address: 'XiangxiDZ',
		latitude: 'KehuDT_Lat',
		longitude: 'KehuDT_Lng'
	}
	const CUSTOMER_PERSONNEL_LINKS = [{
			sourceNames: ['FuzeR'],
			sourceLabels: ['负责人'],
			phoneName: 'FuzeRDH',
			phoneLabel: '负责人电话',
			idName: 'FuzeRID'
		},
		{
			sourceNames: ['ZhuanshuKF', 'ZhaunshuKF'],
			sourceLabels: ['专属客服'],
			phoneName: 'ZhuanshuKFDH',
			phoneLabel: '专属客服电话'
		},
		{
			sourceNames: ['ShouhouRY'],
			sourceLabels: ['售后人员'],
			phoneName: 'ShouhouRYDH',
			phoneLabel: '售后人员电话',
			idName: 'ShouhouRYID'
		}
	]
	const PERSON_ID_KEYS = ['Id', 'ID', 'id', 'UserId', 'UserID', 'userId', 'Value', 'value']
	const PERSON_PHONE_KEYS = [
		'Phone', 'phone', 'Mobile', 'mobile', 'MobilePhone', 'mobilePhone',
		'ShoujiH', 'Shouji', 'Tel', 'Telephone', 'LianxiDH', 'PhoneNumber'
	]

	export default {
		mixins: [themeMixin],
		data() {
			return {
				tableName: '',
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
				customerLocating: false,
				customerLocationInitialized: false,
				customerLocationValues: {},
				customerPersonnelValues: {}
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
			},
			isCustomerAdd() {
				return String(this.tableName || '').toLowerCase() === CUSTOMER_TABLE &&
					this.mode === 'Add' && !this.rowId
			}
		},
		onLoad(options) {
			this.tableName = decodeURIComponent(options.table || '')
			this.rowId = decodeURIComponent(options.id || '')
			this.mode = options.mode || (this.rowId ? 'View' : 'Add')
			this.title = decodeURIComponent(options.title || '')
			this.stayAfterAdd = String(options.stayAfterAdd || '0') === '1'
			this.showRelated = String(options.related ?? '1') !== '0'
			this.defaultValues = parseJson(decodeURIComponent(options.defaults || ''), {}) || {}
			this.includeNames = parseJson(decodeURIComponent(options.fields || ''), []) || []
			this.excludeNames = parseJson(decodeURIComponent(options.excludeFields || ''), []) || []
			this.readonlyNames = parseJson(decodeURIComponent(options.readonlyFields || ''), []) || []
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
					const tasks = [loadNativeFormDefinition(this.tableName, refresh)]
					if (this.rowId) tasks.push(V8.FormEngine.GetFormData(this.tableName, {
						Id: this.rowId
					}))
					const [rawDefinition, rowResult] = await Promise.all(tasks)
					if (this.rowId && (!rowResult || rowResult.Code !== 1)) throw new Error((rowResult && rowResult
						.Msg) || '数据不存在')
					const definition = scopeNativeFormDefinition(rawDefinition, {
						includeNames: this.includeNames,
						excludeNames: this.excludeNames,
						readonlyNames: this.readonlyNames
					})
					this.form = defaultFormData(definition, {
						...this.defaultValues,
						...(rowResult ? rowResult.Data : {})
					})
					await hydrateNativeFormOptions(definition, this.form)
					this.definition = definition
					if (this.isCustomerAdd && !this.customerLocationInitialized) {
						this.customerLocationInitialized = true
						this.$nextTick(() => this.locateCustomer(false))
					}
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
			personnelLinkForField(field) {
				const name = String(field && field.Name || '').toLowerCase()
				const label = String(field && field.Label || '').trim()
				return CUSTOMER_PERSONNEL_LINKS.find((link) =>
					link.sourceNames.some((item) => String(item).toLowerCase() === name) ||
					link.sourceLabels.includes(label)
				)
			},
			personValue(row, keys) {
				if (!row || typeof row !== 'object') return ''
				for (const key of keys) {
					const value = row[key]
					if (value !== undefined && value !== null && String(value).trim()) return value
				}
				return ''
			},
			selectedPersonId(payload, row) {
				const direct = this.personValue(row, PERSON_ID_KEYS)
				if (direct !== '') return direct
				const field = payload && payload.field || {}
				const config = field.config || {}
				const saveField = String(config.SelectSaveField || '')
				if (/id$/i.test(saveField) && payload.value !== undefined && payload.value !== null) {
					return payload.value
				}
				return ''
			},
			handleNativeFieldSelect(payload) {
				if (!this.isCustomerAdd || !payload || payload.multiple) return
				const link = this.personnelLinkForField(payload.field)
				if (!link) return
				const row = payload.raw && typeof payload.raw === 'object' ?
					payload.raw :
					(payload.option && payload.option.raw && typeof payload.option.raw === 'object' ?
						payload.option.raw : {})
				const phone = this.personValue(row, PERSON_PHONE_KEYS)
				const personId = this.selectedPersonId(payload, row)
				const phoneName = this.customerFieldName(link.phoneName, link.phoneLabel)
				const updates = {
					[phoneName]: phone
				}
				const submitValues = {
					[phoneName]: phone
				}

				if (link.idName && personId !== '') {
					const idName = this.customerFieldName(link.idName)
					updates[idName] = personId
					submitValues[idName] = personId
				}

				this.form = {
					...this.form,
					...updates
				}
				this.customerPersonnelValues = {
					...this.customerPersonnelValues,
					...submitValues
				}
			},
			isCustomerAddressField(field) {
				if (!this.isCustomerAdd || !field) return false
				const name = String(field.Name || '').toLowerCase()
				const label = String(field.Label || '').trim()
				return name === CUSTOMER_LOCATION_FIELDS.address.toLowerCase() || label === '详细地址'
			},
			requestCurrentLocation() {
				return new Promise((resolve, reject) => {
					uni.getLocation({
						type: 'gcj02',
						isHighAccuracy: true,
						highAccuracyExpireTime: 5000,
						success: resolve,
						fail: reject
					})
				})
			},
			requestChosenLocation() {
				return new Promise((resolve, reject) => {
					uni.chooseLocation({
						success: resolve,
						fail: reject
					})
				})
			},
			customerFieldName(expectedName, expectedLabel = '') {
				const fields = this.definition ?
					(this.definition.layoutFields || this.definition.fields || []) : []
				const expected = String(expectedName || '').toLowerCase()
				const field = fields.find((item) => String(item.Name || '').toLowerCase() === expected) ||
					(expectedLabel ? fields.find((item) => String(item.Label || '').trim() === expectedLabel) : null)
				return field && field.Name ? field.Name : expectedName
			},
			applyCustomerLocation(location) {
				const latitude = Number(location && location.latitude)
				const longitude = Number(location && location.longitude)
				const updates = {}
				const submitValues = {}
				const regionName = this.customerFieldName(CUSTOMER_LOCATION_FIELDS.region, '城市')
				const addressName = this.customerFieldName(CUSTOMER_LOCATION_FIELDS.address, '详细地址')
				const latitudeName = this.customerFieldName(CUSTOMER_LOCATION_FIELDS.latitude)
				const longitudeName = this.customerFieldName(CUSTOMER_LOCATION_FIELDS.longitude)

				if (Array.isArray(location.region) && location.region.length) {
					const regionValue = JSON.stringify(location.region)
					updates[regionName] = regionValue
					submitValues[regionName] = regionValue
				}
				if (location.address) {
					updates[addressName] = location.address
					submitValues[addressName] = location.address
				}
				if (Number.isFinite(latitude)) {
					updates[latitudeName] = latitude
					submitValues[latitudeName] = latitude
				}
				if (Number.isFinite(longitude)) {
					updates[longitudeName] = longitude
					submitValues[longitudeName] = longitude
				}

				this.form = {
					...this.form,
					...updates
				}
				this.customerLocationValues = {
					...this.customerLocationValues,
					...submitValues
				}
			},
			async locateCustomer(chooseFromMap = false) {
				if (!this.isCustomerAdd || this.customerLocating) return
				this.customerLocating = true
				try {
					const source = chooseFromMap ?
						await this.requestChosenLocation() :
						await this.requestCurrentLocation()
					let geocode = null
					try {
						geocode = await reverseGeocode(source.longitude, source.latitude)
					} catch (error) {
						// 地图选点本身会返回地址；逆地理编码失败时仍可用选点结果完成赋值。
					}
					const location = normalizeChosenLocation(source, geocode)
					this.applyCustomerLocation(location)
					if (chooseFromMap) {
						uni.showToast({
							title: '位置已更新',
							icon: 'success'
						})
					} else if (!location.address || !location.region.length) {
						uni.showToast({
							title: '已获取坐标，地址解析失败',
							icon: 'none'
						})
					}
				} catch (error) {
					const message = String(error && error.errMsg || error && error.message || '')
					if (!/cancel/i.test(message)) {
						uni.showToast({
							title: chooseFromMap ? '位置选择失败' : '自动定位失败，请点击重新定位',
							icon: 'none'
						})
					}
				} finally {
					this.customerLocating = false
				}
			},
			chooseCustomerLocation() {
				this.locateCustomer(true)
			},
			async submit() {
				if (this.saving) return
				if (this.customerLocating) {
					uni.showToast({
						title: '正在获取位置，请稍候',
						icon: 'none'
					})
					return
				}
				this.saving = true
				try {
					const wasAdd = !this.rowId
					const result = await saveNativeForm(
						this.tableName,
						this.rowId,
						this.form,
						this.definition.fields,
						{
							...nativeFormDefaultSubmitValues(this.definition, this.defaultValues),
							...(String(this.tableName || '').toLowerCase() === CUSTOMER_TABLE ?
								{
									...this.customerLocationValues,
									...this.customerPersonnelValues
								} : {})
						}
					)
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
					uni.$emit('xjy:data-changed', {
						table: this.tableName,
						id: this.rowId
					})
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

	.customer-location {
		display: flex;
		justify-content: flex-end;
		margin-top: 16rpx;
	}

	.customer-location__button {
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

	.customer-location__icon {
		font-size: 30rpx;
		line-height: 1;
	}

	.customer-location__button--disabled {
		opacity: .62;
	}

	.customer-location__button--pressed {
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
