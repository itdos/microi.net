<template>
	<view class="related-list-page" :style="mciTokenStyle">
		<view class="page-nav mci-safe-top">
			<view class="nav-row mci-safe-nav-row">
				<view class="nav-button" hover-class="nav-button--pressed" @tap="goBack">‹</view>
				<text class="nav-title">{{ pageTitle }}</text>
				<view class="nav-placeholder"></view>
			</view>
		</view>

		<scroll-view class="related-list-scroll" scroll-y>
			<view v-if="contextLoading" class="context-skeleton">
				<view v-for="item in 4" :key="item" class="context-skeleton__card">
					<view></view><view></view><view></view>
				</view>
			</view>
			<view v-else-if="contextError" class="context-error">
				<text>{{ contextError }}</text>
				<view hover-class="context-error__retry--pressed" @tap="restoreContext">
					<text>↻</text><text>重新加载</text>
				</view>
			</view>
			<mci-business-related-list
				v-else-if="field"
				:field="field"
				:parent-id="parentId"
				:parent-form="parentForm"
				:parent-menu-id="parentMenuId"
				:parent-table-id="parentTableId"
				:parent-table-name="parentTableName"
				:parent-table-child-auth="parentTableChildAuth"
				:parent-mode="parentMode"
				:relation-value-override="relationValue"
				:batch-entry-mode="batchEntryMode"
			/>
		</scroll-view>
	</view>
</template>

<script>
	import { themeMixin } from '@/utils/theme.js'
	import { loadNativeFormDefinition, loadNativeTableModel } from '@/platform/native-form.js'
	import MciBusinessRelatedList from '@/components/mci-business-related-list/mci-business-related-list.vue'

	function decodeOption(value) {
		try {
			return decodeURIComponent(String(value || ''))
		} catch (error) {
			return String(value || '')
		}
	}

	export default {
		name: 'BusinessRelatedListPage',
		components: { MciBusinessRelatedList },
		mixins: [themeMixin],
		data() {
			return {
				field: null,
				fieldId: '',
				parentId: '',
				parentForm: {},
				parentMenuId: '',
				parentTableId: '',
				parentTableName: '',
				parentTableChildAuth: null,
				parentMode: 'View',
				relationValue: '',
				batchEntryMode: '',
				pageTitle: '关联列表',
				contextLoading: true,
				contextError: ''
			}
		},
		onLoad(options = {}) {
			this.fieldId = decodeOption(options.fieldId)
			this.parentId = decodeOption(options.parentId)
			this.parentMenuId = decodeOption(options.parentMenuId)
			this.parentTableId = decodeOption(options.parentTableId)
			this.parentTableName = decodeOption(options.parentTableName)
			try {
				this.parentTableChildAuth = JSON.parse(decodeOption(options.parentTableChildAuth) || 'null')
			} catch (error) {
				this.parentTableChildAuth = null
			}
			this.relationValue = decodeOption(options.relationValue)
			this.batchEntryMode = decodeOption(options.entryMode)
			this.pageTitle = decodeOption(options.title) || '关联列表'
			this.parentForm = { Id: this.parentId }

			const channel = typeof this.getOpenerEventChannel === 'function'
				? this.getOpenerEventChannel()
				: null
			if (channel && typeof channel.once === 'function') {
				channel.once('related-list-context', (context = {}) => {
					this.applyContext(context)
				})
			}
			setTimeout(() => {
				if (!this.field) this.restoreContext()
			}, 0)
		},
		methods: {
			applyContext(context = {}) {
				this.field = context.field || this.field
				this.parentId = context.parentId || this.parentId
				this.parentForm = context.parentForm || this.parentForm
				this.parentMenuId = context.parentMenuId || this.parentMenuId
				this.parentTableId = context.parentTableId || this.parentTableId
				this.parentTableName = context.parentTableName || this.parentTableName
				this.parentTableChildAuth = context.parentTableChildAuth || this.parentTableChildAuth
				this.parentMode = context.parentMode || this.parentMode
				this.relationValue = context.relationValue ?? this.relationValue
				this.batchEntryMode = context.entryMode || this.batchEntryMode
				this.pageTitle = context.title || this.pageTitle
				this.contextLoading = false
				this.contextError = ''
			},
			async restoreContext() {
				if (this.field) {
					this.contextLoading = false
					return
				}
				if (!this.fieldId || !this.parentTableId) {
					this.contextLoading = false
					this.contextError = '缺少关联列表上下文，请返回详情页后重试'
					return
				}
				this.contextLoading = true
				this.contextError = ''
				try {
					const table = await loadNativeTableModel(this.parentTableId, {
						menuId: this.parentMenuId
					})
					this.parentTableName = table.Name || this.parentTableName
					const definition = await loadNativeFormDefinition(table.Name, false, {
						menuId: this.parentMenuId
					})
					const fields = [...(definition.layoutFields || []), ...(definition.fields || [])]
					this.field = fields.find((item) => String(item.Id || '') === this.fieldId) || null
					if (!this.field) throw new Error('未找到关联子表配置')
				} catch (error) {
					this.contextError = error.message || error.Msg || '关联列表上下文加载失败'
				} finally {
					this.contextLoading = false
				}
			},
			goBack() {
				uni.navigateBack({
					fail: () => uni.redirectTo({ url: '/pages/business/list?key=customers' })
				})
			}
		}
	}
</script>

<style scoped>
	.related-list-page {
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--mci-bg-base, #f4f8fa);
	}

	.page-nav {
		flex: none;
		background: #fff;
		border-bottom: 1rpx solid #e9eff2;
	}

	.nav-row {
		display: grid;
		grid-template-columns: 72rpx minmax(0, 1fr) 72rpx;
		align-items: center;
		min-height: 88rpx;
		padding: 0 22rpx;
	}

	.nav-button,
	.nav-placeholder {
		width: 64rpx;
		height: 64rpx;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.nav-button {
		border-radius: 50%;
		color: #254b59;
		font-size: 46rpx;
		transition: background-color 150ms ease, transform 150ms ease;
	}

	.nav-button--pressed {
		background: #edf4f6;
		transform: scale(.94);
	}

	.nav-title {
		overflow: hidden;
		color: #173743;
		font-size: 30rpx;
		font-weight: 700;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.related-list-scroll {
		flex: 1;
		min-height: 0;
		height: 100%;
	}

	.context-skeleton {
		padding: 24rpx;
	}

	.context-skeleton__card {
		margin-bottom: 18rpx;
		padding: 24rpx;
		border-radius: 16rpx;
		background: #fff;
	}

	.context-skeleton__card view {
		width: 76%;
		height: 24rpx;
		margin-bottom: 16rpx;
		border-radius: 8rpx;
		background: linear-gradient(90deg, #edf3f5 25%, #f8fafb 50%, #edf3f5 75%);
		background-size: 300% 100%;
		animation: relatedShimmer 1.4s infinite;
	}

	.context-skeleton__card view:first-child { width: 48%; height: 30rpx; }
	.context-skeleton__card view:last-child { width: 36%; margin-bottom: 0; }

	.context-error {
		min-height: 420rpx;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 22rpx;
		padding: 36rpx;
		color: #7b9099;
		font-size: 25rpx;
		text-align: center;
	}

	.context-error view {
		height: 72rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8rpx;
		padding: 0 28rpx;
		border-radius: 10rpx;
		color: #fff;
		background: #d9472b;
		font-weight: 650;
	}

	.context-error__retry--pressed { opacity: .78; }

	@keyframes relatedShimmer {
		from { background-position: 100% 0; }
		to { background-position: 0 0; }
	}

	@media (prefers-reduced-motion: reduce) {
		.context-skeleton__card view,
		.nav-button { animation: none; transition: none; }
	}
</style>
