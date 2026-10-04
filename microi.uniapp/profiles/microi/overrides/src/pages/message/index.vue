<template>
	<view class="message-container"
		:style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]">
		<view class="msg-header mci-safe-top">
			<view class="header-inner">
				<text class="header-title" role="heading" aria-level="1">{{ t('message.title') }}</text>
				<view class="header-menu" hover-class="header-menu--pressed" role="button" tabindex="0" aria-label="消息操作" @tap="openMessageMenu" @keyup.enter="openMessageMenu" @keyup.space.prevent="openMessageMenu">
					<view class="more-symbol" aria-hidden="true"><view /><view /><view /></view>
				</view>
			</view>
		</view>

		<view v-if="!isLoggedIn" class="message-auth-wrap">
			<mci-auth-prompt
				:title="t('common.loginFirst')"
				:desc="t('message.loginHint')"
				:action-text="t('common.loginNow')"
				:gradient="themeGradient"
				@action="goLogin"
			/>
		</view>

		<template v-else>
			<view class="message-overview">
				<view class="search-section">
					<view class="search-wrap">
						<view class="search-icon" aria-hidden="true" />
						<input class="search-input"
							:placeholder="t('message.searchMsg')"
							placeholder-class="message-search-placeholder"
							confirm-type="search"
							aria-label="搜索消息"
							v-model="searchKeyword"
							@confirm="doSearch" />
						<view v-if="searchKeyword" class="search-clear" hover-class="search-clear--pressed" role="button" tabindex="0" aria-label="清空搜索" @tap="searchKeyword = ''" @keyup.enter="searchKeyword = ''" @keyup.space.prevent="searchKeyword = ''"><view aria-hidden="true" /></view>
					</view>
				</view>

				<view class="message-channels" role="tablist" aria-label="消息分类">
					<view v-for="channel in channelItems" :key="channel.key"
						class="message-channel"
						:class="[`message-channel--${channel.tone}`, { 'message-channel--active': activeChannel === channel.key }]"
						hover-class="message-channel--pressed"
						role="tab" tabindex="0"
						:aria-selected="activeChannel === channel.key"
						:aria-label="`${channel.title}${channel.count ? `，${channel.count}条` : '，暂无消息'}`"
						@tap="selectMessageChannel(channel.key)"
						@keyup.enter="selectMessageChannel(channel.key)"
						@keyup.space.prevent="selectMessageChannel(channel.key)">
						<view class="message-channel__icon">
							<text v-if="channel.key === 'mentions'" class="channel-at" aria-hidden="true">@</text>
							<view v-else class="channel-glyph" :class="`channel-glyph--${channel.key}`" aria-hidden="true"><view /><view /></view>
							<text v-if="channel.count" class="channel-count">{{ channel.count > 99 ? '99+' : channel.count }}</text>
						</view>
						<text class="message-channel__label">{{ channel.title }}</text>
					</view>
				</view>
			</view>

			<view v-if="!wsConnected && !loading" class="connection-note" role="status">
				<view aria-hidden="true" />
				<text>实时连接未就绪，当前显示缓存消息并自动重试</text>
			</view>

			<scroll-view class="msg-scroll" scroll-y :refresher-enabled="true"
				:refresher-triggered="refreshing" :aria-busy="loading" @refresherrefresh="onRefresh">
				<view v-if="loading && messageList.length === 0" class="skeleton-list" aria-hidden="true">
					<view class="sk-item" v-for="i in 6" :key="i">
						<view class="sk-avatar" />
						<view class="sk-content"><view class="sk-line sk-name" /><view class="sk-line sk-msg" /></view>
					</view>
				</view>

				<view v-for="(msg, index) in filteredMessageList" :key="msg.ContactUserId || msg.Id || index"
					class="msg-item" hover-class="msg-item--pressed" role="button" tabindex="0"
					@tap="openChat(msg)" @keyup.enter="openChat(msg)" @keyup.space.prevent="openChat(msg)">
					<view class="msg-avatar-wrap">
						<view class="msg-avatar" :class="messageAvatarTone(msg)">
							<image v-if="msg.ContactUserAvatarUrl" :src="msg.ContactUserAvatarUrl" mode="aspectFill" @error="handleAvatarError(msg)" />
							<text v-else class="avatar-text">{{ isAiIdentity(msg) ? 'AI' : (msg.ContactUserName || '?').charAt(0) }}</text>
						</view>
						<view class="unread-badge" v-if="Number(msg.UnRead || 0) > 0"><text>{{ msg.UnRead > 99 ? '99+' : msg.UnRead }}</text></view>
					</view>
					<view class="msg-body">
						<view class="msg-top"><text class="msg-name">{{ msg.ContactUserName || '消息' }}</text><text class="msg-time">{{ formatTime(msg.UpdateTime) }}</text></view>
						<view class="msg-bottom"><text class="msg-preview">{{ stripHtml(msg.LastMessage) || '暂无消息内容' }}</text></view>
					</view>
				</view>

				<view class="empty-state" v-if="!loading && filteredMessageList.length === 0">
					<view class="empty-message-symbol" aria-hidden="true"><view /><view /><view /></view>
					<text class="empty-text">{{ emptyTitle }}</text>
					<text class="empty-note">{{ emptyNote }}</text>
					<view v-if="searchKeyword || activeChannel" class="empty-action" hover-class="empty-action--pressed" role="button" tabindex="0" aria-label="显示全部消息" @tap="clearMessageFilters" @keyup.enter="clearMessageFilters" @keyup.space.prevent="clearMessageFilters">
						<view class="empty-action__icon" aria-hidden="true" /><text>显示全部</text>
					</view>
				</view>
				<view class="mci-tabbar-spacer" aria-hidden="true" />
			</scroll-view>
		</template>
		<mci-ai-launcher />
	</view>
</template>

<script>
	import {
		getToken,
		getUser,
		removeToken,
		V8
	} from '@/utils/request.js'
	import appConfig from '@/config.js'
	import {
		themeMixin
	} from '@/utils/theme.js'
	import MciAuthPrompt from '@/components/mci-auth-prompt/mci-auth-prompt.vue'
	import {
		getSignalR,
		connectSignalR
	} from '@/utils/signalr.js'
	import { readCache, writeCache } from '@/platform/cache.js'
	import { getAiAssistantEnabled } from '@/utils/sysconfig.js'
	import { reLaunchToLogin } from '@/platform/auth-entry.mjs'
	import {
		buildMessageCacheKey,
		buildMessageChannelItems,
		filterMessageItems
	} from '@/platform/message-center.mjs'

	export default {
		components: {
			MciAuthPrompt
		},
		mixins: [themeMixin],
		data() {
			return {
				statusBarHeight: 0,
				aiAssistantEnabled: false,
				isLoggedIn: false,
				searchKeyword: '',
				activeChannel: '',
				loading: true,
				refreshing: false,
				messageList: [],
				wsConnected: false,
				// SignalR 事件回调引用（方便移除）
				_onReceiveLastContacts: null,
				_onReceiveMessage: null,
				_onReceiveUnreadCount: null
			}
		},

		computed: {
			currentUser() {
				return getUser() || {}
			},
			channelItems() {
				return buildMessageChannelItems(
					this.aiAssistantEnabled ? this.messageList : this.messageList.filter((item) => !this.isAiIdentity(item)),
					this.currentUser.Name || this.currentUser.NickName || this.currentUser.Account || ''
				)
			},
			filteredMessageList() {
				return filterMessageItems(this.messageList, {
					query: this.searchKeyword,
					channel: this.activeChannel,
					currentUserName: this.currentUser.Name || this.currentUser.NickName || this.currentUser.Account || '',
					aiEnabled: this.aiAssistantEnabled
				})
			},
			emptyTitle() {
				if (this.searchKeyword) return '没有找到匹配消息'
				const channel = this.channelItems.find((item) => item.key === this.activeChannel)
				return channel ? `暂无${channel.title}消息` : this.t('message.noMessages')
			},
			emptyNote() {
				if (this.searchKeyword || this.activeChannel) return '可清除搜索或分类后查看全部真实会话'
				return '消息将按当前账号权限同步，可下拉刷新'
			}
		},

		onLoad() {
			try {
				const info = uni.getWindowInfo()
				this.statusBarHeight = info.statusBarHeight || 0
			} catch (e) {
				try {
					this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 0
				} catch (e2) {}
			}
			this.restoreMessageCache()
		},

		onShow() {
			uni.$emit('mci:tab-route', 'pages/message/index')
			this.checkLoginAndLoad()
			this.refreshAiAssistantVisibility()
		},

		methods: {
			messageCacheKey() {
				const user = getUser() || {}
				return buildMessageCacheKey({
					profileId: appConfig.profileId,
					apiBase: appConfig.apiBase,
					osClient: appConfig.osClient,
					identity: user.Id || user.Account || 'anonymous'
				})
			},
			restoreMessageCache() {
				const cached = readCache(this.messageCacheKey(), 24 * 60 * 60 * 1000)
				if (!cached || !cached.data) return
				this.messageList = Array.isArray(cached.data.messageList) ? cached.data.messageList : []
				this.syncAiEntries()
				this.resolveMessageAvatars()
				if (this.messageList.length) {
					this.loading = false
				}
			},
			persistMessageCache() {
				writeCache(this.messageCacheKey(), {
					messageList: this.messageList.map(({ ContactUserAvatarUrl, ...item }) => item)
				})
			},

			checkLoginAndLoad() {
				const token = getToken()
				const user = getUser() || {}
				this.isLoggedIn = !!token && !!user.Id
				if (!this.isLoggedIn) {
					if (token) removeToken()
					this.loading = false
					this.messageList = []
					reLaunchToLogin()
					return
				}
				if (!this.messageList.length) this.restoreMessageCache()
				this.initSignalR()
			},

			// 初始化 SignalR 连接并注册事件
			async initSignalR() {
				if (this._messageInitializing) return
				const existing = getSignalR()
				if (this._messageInitialized && existing && existing.isConnected) {
					this.wsConnected = true
					this.loading = false
					this.requestLastContacts()
					return
				}
				this._messageInitializing = true
				this.loading = this.messageList.length === 0
				// 先停止可能存在的旧轮询，避免重复启动
				this.stopPolling()
				try {
					const client = await connectSignalR()
					this.wsConnected = client.isConnected

					// 页面在 tab 切换时不会销毁，事件只注册一次。
					if (this._messageInitialized) {
						this.loading = false
						this.requestLastContacts()
						return
					}
					this.cleanupSignalREvents()

					// 接收最近联系人列表
					this._onReceiveLastContacts = (data) => {
						console.log('[Message] ReceiveSendLastContacts:', data?.length || 0)
						if (Array.isArray(data)) {
							this.messageList = data
							this.syncAiEntries()
							this.persistMessageCache()
							this.resolveMessageAvatars()
						}
						this.loading = false
						this.finishMessageRefresh()
					}
					client.on('ReceiveSendLastContacts', this._onReceiveLastContacts)

					// 接收新消息（实时推送）
					this._onReceiveMessage = (message) => {
						console.log('[Message] ReceiveSendToUser:', message)
						if (message) {
							this.handleNewMessage(message)
						}
					}
					client.on('ReceiveSendToUser', this._onReceiveMessage)

					// 接收未读数
					this._onReceiveUnreadCount = (count) => {
						console.log('[Message] ReceiveSendUnreadCountToUser:', count)
					}
					client.on('ReceiveSendUnreadCountToUser', this._onReceiveUnreadCount)

					// 监听重连恢复事件，自动刷新数据
					this._onReconnected = () => {
						console.log('[Message] SignalR重连成功，刷新数据')
						this.wsConnected = true
						this.requestLastContacts()
					}
					client.on('_connected', this._onReconnected)
					this._messageInitialized = true

					// 请求最近联系人
					this.requestLastContacts()

					// 超时保护：如果8秒内没收到回调，关闭loading并显示空状态
					this._loadingTimeout = setTimeout(() => {
						if (this.loading) {
							this.loading = false
							this.refreshing = false
							this.syncAiEntries()
						}
					}, this.messageList.length ? 1200 : 3500)

					// 如果 SignalR 连接失败，使用轮询兜底
					if (!client.isConnected) {
						console.warn('[Message] SignalR未连接，启动轮询兜底')
						this.loading = false
						this.syncAiEntries()
						this.startPollingFallback()
					}
				} catch (e) {
					console.error('[Message] initSignalR error:', e)
					this.loading = false
					this.refreshing = false
					// 连接失败兜底
					this.syncAiEntries()
				} finally {
					this._messageInitializing = false
				}
			},

			// 请求最近联系人（通过 SignalR）
			requestLastContacts() {
				const user = getUser() || {}
				const client = getSignalR()
				if (client.isConnected) {
					client.send('SendLastContacts', {
						UserId: user.Id || '',
						ContactUserId: '',
						OsClient: appConfig.osClient
					})
					return true
				} else {
					console.warn('[Message] requestLastContacts: SignalR未连接')
					this.loading = false
					this.finishMessageRefresh()
					this.syncAiEntries()
					return false
				}
			},

			finishMessageRefresh() {
				if (this._refreshTimeout) {
					clearTimeout(this._refreshTimeout)
					this._refreshTimeout = null
				}
				this.refreshing = false
			},

			// 处理新消息推送
			handleNewMessage(message) {
				const user = getUser() || {}
				// 判断是发给我的消息
				if (message.ToUserId === user.Id || message.FromUserId === user.Id) {
					// 刷新联系人列表以获取最新排序和未读数
					this.requestLastContacts()
				}
			},

			// 兜底轮询（SignalR 连接失败时使用）
			startPollingFallback() {
				// 防止重复启动导致内存泄漏与多次请求
				if (this._pollTimer) return
				this._pollTimer = setInterval(() => {
					if (getToken()) {
						// 若 SignalR 已恢复连接则停止轮询
						try {
							const c = getSignalR()
							if (c && c.isConnected) {
								this.stopPolling()
								return
							}
						} catch (e) {}
						this.requestLastContacts()
					}
				}, 30000)
			},

			isAiIdentity(item) {
				if (!item) return false
				const id = item.ContactUserId || item.Id || ''
				return String(id).trim().toUpperCase() === 'AI'
			},

			stripAiEntries() {
				this.messageList = this.messageList.filter(item => !this.isAiIdentity(item))
			},

			syncAiEntries() {
				const existingAi = this.messageList.find(item => this.isAiIdentity(item))
				this.stripAiEntries()
				if (!this.aiAssistantEnabled) return
				this.messageList.unshift(existingAi || {
						ContactUserId: 'AI',
						ContactUserName: 'AI助手',
						ContactUserAvatar: '',
						LastMessage: '我是您的AI助手，有什么可以帮您？',
						UpdateTime: new Date().toISOString(),
						UnRead: 0
					})
			},

			async refreshAiAssistantVisibility() {
				const enabled = await getAiAssistantEnabled({ refresh: true })
				if (enabled === this.aiAssistantEnabled) return
				this.aiAssistantEnabled = enabled
				this.syncAiEntries()
				this.persistMessageCache()
				this.resolveMessageAvatars()
			},

			async resolveMessageAvatars() {
				const version = (this._avatarResolveVersion || 0) + 1
				this._avatarResolveVersion = version
				const resolved = await Promise.all(this.messageList.map(async (item) => {
					const source = item.ContactUserAvatar || item.Avatar || item.HeadImg || ''
					if (!source || this.isAiIdentity(item)) return { ...item, ContactUserAvatarUrl: '' }
					try {
						const url = await V8.resolveAvatarUrl(source, {
							resourceKind: 'UserAvatar',
							resourceId: item.ContactUserId || item.Id || ''
						})
						return { ...item, ContactUserAvatarUrl: url || '' }
					} catch (error) {
						return { ...item, ContactUserAvatarUrl: '' }
					}
				}))
				if (this._avatarResolveVersion === version) this.messageList = resolved
			},

			handleAvatarError(item) {
				if (item) item.ContactUserAvatarUrl = ''
			},

			messageAvatarTone(item) {
				if (this.isAiIdentity(item)) return 'msg-avatar--ai'
				const source = String(item && (item.ContactUserId || item.ContactUserName) || '')
				const score = Array.from(source).reduce((total, char) => total + char.charCodeAt(0), 0)
				return `msg-avatar--tone-${score % 4}`
			},

			selectMessageChannel(key) {
				this.activeChannel = this.activeChannel === key ? '' : key
			},

			clearMessageFilters() {
				this.searchKeyword = ''
				this.activeChannel = ''
			},

			openMessageMenu() {
				uni.showActionSheet({
					itemList: ['刷新消息', '查看连接状态'],
					success: ({ tapIndex }) => {
						if (tapIndex === 0) this.onRefresh()
						if (tapIndex === 1) {
							uni.showModal({
								title: '连接状态',
								content: this.wsConnected ? '实时消息连接已就绪。' : '实时连接未就绪，当前使用缓存消息并自动尝试恢复。',
								showCancel: false
							})
						}
					}
				})
			},

			// 清理 SignalR 事件
			cleanupSignalREvents() {
				if (this._loadingTimeout) {
					clearTimeout(this._loadingTimeout)
					this._loadingTimeout = null
				}
				try {
					const client = getSignalR()
					if (this._onReceiveLastContacts) {
						client.off('ReceiveSendLastContacts', this._onReceiveLastContacts)
						this._onReceiveLastContacts = null
					}
					if (this._onReceiveMessage) {
						client.off('ReceiveSendToUser', this._onReceiveMessage)
						this._onReceiveMessage = null
					}
					if (this._onReceiveUnreadCount) {
						client.off('ReceiveSendUnreadCountToUser', this._onReceiveUnreadCount)
						this._onReceiveUnreadCount = null
					}
					if (this._onReconnected) {
						client.off('_connected', this._onReconnected)
						this._onReconnected = null
					}
				} catch (e) {
					console.warn('[Message] cleanupSignalREvents error:', e)
				}
			},

			stopPolling() {
				if (this._pollTimer) {
					clearInterval(this._pollTimer)
					this._pollTimer = null
				}
			},

			goLogin() {
				uni.navigateTo({
					url: '/pages/login/index'
				})
			},

			openChat(msg) {
				if (this.isAiIdentity(msg) && !this.aiAssistantEnabled) return
				uni.navigateTo({
					url: `/pages/message/chat?id=${msg.ContactUserId}&name=${encodeURIComponent(msg.ContactUserName)}`
				})
			},

			onRefresh() {
				this.refreshing = true
				if (!this.requestLastContacts()) return
				this._refreshTimeout = setTimeout(() => this.finishMessageRefresh(), 1800)
			},

			doSearch() {
				// 搜索由 computed 属性自动处理
			},

			// 格式化时间
			formatTime(dateStr) {
				if (!dateStr) return ''
				const date = new Date(dateStr)
				const now = new Date()
				const diffMs = now - date
				const diffMin = Math.floor(diffMs / 60000)
				const diffHour = Math.floor(diffMs / 3600000)

				if (diffMin < 1) return '刚刚'
				if (diffMin < 60) return diffMin + '分钟前'
				if (date.toDateString() === now.toDateString()) {
					return date.toLocaleTimeString('zh-CN', {
						hour: '2-digit',
						minute: '2-digit'
					})
				}
				const yesterday = new Date(now)
				yesterday.setDate(yesterday.getDate() - 1)
				if (date.toDateString() === yesterday.toDateString()) {
					return '昨天'
				}
				return `${date.getMonth() + 1}/${date.getDate()}`
			},

			stripHtml(html) {
				if (!html) return ''
				return html.replace(/<[^>]+>/g, '').substring(0, 50)
			}
		},

		onHide() {
			this.stopPolling()
		},

		onUnload() {
			this.stopPolling()
			this.finishMessageRefresh()
			this.cleanupSignalREvents()
			this._messageInitialized = false
		}
	}
</script>

<style lang="scss" scoped>
	.message-container {
		height: 100vh;
		background: #f5f7fa;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* 顶部导航 */
	.msg-header {
		position: relative;
		overflow: hidden;
		background: #fff;
		flex-shrink: 0;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.header-inner {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 88rpx;
		position: relative;
		z-index: 1;
		padding-right: var(--mci-capsule-right);
	}

	.header-title {
		font-size: 34rpx;
		font-weight: 600;
		color: #fff !important;
	}

	/* 搜索 */
	.search-section {
		background: #f5f7fa;
		padding: 16rpx 24rpx;
		flex-shrink: 0;
	}

	.message-auth-wrap {
		flex: 1;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding-bottom: calc(var(--mci-tabbar-height, 142rpx) + 28rpx + var(--mci-safe-bottom));
		box-sizing: border-box;
	}

	.search-wrap {
		display: flex;
		align-items: center;
		background: #fff;
		border-radius: 36rpx;
		padding: 0 24rpx;
		height: 68rpx;
	}

	.search-icon {
		position: relative;
		width: 22rpx;
		height: 22rpx;
		border: 3rpx solid #8a96a3;
		border-radius: 50%;
		margin-right: 12rpx;
	}

	.search-icon::after {
		content: '';
		position: absolute;
		width: 10rpx;
		height: 3rpx;
		right: -8rpx;
		bottom: -4rpx;
		border-radius: 3rpx;
		background: #8a96a3;
		transform: rotate(45deg);
	}

	.search-input {
		flex: 1;
		font-size: 26rpx;
		color: #333;
		height: 68rpx;
	}

	.search-clear {
		font-size: 22rpx;
		color: #999;
		padding: 8rpx;
	}

	/* 滚动区域 */
	.msg-scroll {
		flex: 1;
		min-height: 0;
		height: 0;
		background: #f5f7fa;
	}

	/* 消息条目 */
	.msg-item {
		display: flex;
		align-items: center;
		padding: 24rpx 32rpx;
		background: #fff;
		border-bottom: 1rpx solid #f5f5f5;
	}

	.msg-avatar-wrap {
		position: relative;
		margin-right: 24rpx;
		flex-shrink: 0;
	}

	.msg-avatar {
		width: 96rpx;
		height: 96rpx;
		border-radius: 50%;
		background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.avatar-text {
		font-size: 36rpx;
		color: #fff;
		font-weight: 600;
	}

	.unread-badge {
		position: absolute;
		top: -4rpx;
		right: -4rpx;
		min-width: 36rpx;
		height: 36rpx;
		border-radius: 18rpx;
		background: #ff4d4f;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0 8rpx;

		text {
			font-size: 20rpx;
			color: #fff;
			font-weight: 500;
		}
	}

	.msg-body {
		flex: 1;
		min-width: 0;
	}

	.msg-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8rpx;
	}

	.msg-name {
		font-size: 30rpx;
		font-weight: 500;
		color: #333;
	}

	.msg-time {
		font-size: 22rpx;
		color: #bbb;
		flex-shrink: 0;
	}

	.msg-bottom {
		display: flex;
		align-items: center;
	}

	.msg-preview {
		font-size: 26rpx;
		color: #999;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}

	/* 空状态 */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 120rpx 0;
	}

	.empty-icon {
		width: 104rpx;
		height: 104rpx;
		margin-bottom: 24rpx;
		opacity: 0.72;
	}

	.empty-text {
		font-size: 28rpx;
		color: #999;
		margin-bottom: 32rpx;
	}

	/* 骨架屏 */
	.skeleton-list {
		padding: 0;
	}

	.sk-item {
		display: flex;
		align-items: center;
		padding: 24rpx 32rpx;
		background: #fff;
		border-bottom: 1rpx solid #f5f5f5;
	}

	.sk-avatar {
		width: 96rpx;
		height: 96rpx;
		border-radius: 50%;
		background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
		background-size: 400% 100%;
		animation: shimmer 1.5s infinite;
		margin-right: 24rpx;
		flex-shrink: 0;

		&.sk-avatar-sm {
			width: 80rpx;
			height: 80rpx;
		}
	}

	.sk-content {
		flex: 1;
	}

	.sk-line {
		height: 24rpx;
		border-radius: 12rpx;
		background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
		background-size: 400% 100%;
		animation: shimmer 1.5s infinite;
		margin-bottom: 12rpx;
	}

	.sk-name {
		width: 40%;
	}

	.sk-msg {
		width: 70%;
	}

	.sk-dept {
		width: 50%;
		height: 20rpx;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}

		100% {
			background-position: -200% 0;
		}
	}
</style>

<style lang="scss" scoped>
/* Light Field message center: connection field + one continuous message rail. */
.message-container, .msg-scroll { background: var(--mci-app-canvas, #f4f6f5); }
.msg-header { min-height: 190rpx; border: 0; background: var(--mci-gradient-primary) !important; }
.header-inner { height: 132rpx; flex-direction: column; align-items: flex-start; justify-content: center; padding: 0 34rpx; }
.header-title { color: var(--mci-text-on-primary, #fff) !important; font-size: 38rpx; font-weight: 740; letter-spacing: -.02em; }
.header-subtitle { margin-top: 8rpx; color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 23rpx; }
.message-horizon { position: absolute; right: -12%; bottom: -79rpx; left: -12%; height: 112rpx; border-radius: 50% 50% 0 0; background: var(--mci-home-horizon, #fff1e4); transform: translateY(62rpx); }
.search-section { position: relative; z-index: 3; margin-top: -34rpx; padding: 0 24rpx 20rpx; background: transparent; }
.search-wrap { box-sizing: border-box; height: 92rpx; padding: 0 24rpx; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 28rpx; background: var(--mci-app-surface, #fefffe) !important; box-shadow: var(--mci-shadow-contact); }
.search-input { height: 88rpx; color: var(--mci-text-primary, #17313d); font-size: 27rpx; }
.search-icon { border-color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.search-icon::after { background: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.search-clear { width: 88rpx; height: 88rpx; margin-right: -20rpx; padding: 0; display: flex; align-items: center; justify-content: center; }
.search-clear > view { position: relative; width: 22rpx; height: 22rpx; }
.search-clear > view::before, .search-clear > view::after { position: absolute; top: 9rpx; left: 1rpx; width: 20rpx; height: 3rpx; border-radius: 3rpx; background: var(--mci-text-secondary, rgba(23,49,61,.66)); content: ''; }
.search-clear > view::before { transform: rotate(45deg); }.search-clear > view::after { transform: rotate(-45deg); }
.msg-scroll { padding: 0 24rpx; box-sizing: border-box; }
.msg-item, .sk-item { min-height: 124rpx; padding: 20rpx 8rpx; border-bottom-color: var(--mci-divider, rgba(20,65,84,.1)); background: transparent !important; box-shadow: none !important; }
.msg-item:first-of-type { border-top: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); }
.msg-avatar { width: 88rpx; height: 88rpx; border-radius: 24rpx; background: var(--mci-gradient-primary); }
.avatar-text { font-size: 32rpx; }
.msg-name { color: var(--mci-text-primary, #17313d); font-size: 29rpx; font-weight: 650; }
.msg-time { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); font-size: 21rpx; }
.msg-preview { color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 25rpx; }
.unread-badge { background: var(--mci-color-brand, #e54625); }
.empty-state { min-height: 420rpx; justify-content: center; padding: 70rpx 20rpx; }
.empty-icon { width: 88rpx; height: 88rpx; opacity: .54; }
.empty-text { margin: 0; color: var(--mci-text-primary, #17313d); font-size: 29rpx; font-weight: 650; }
.empty-note { max-width: 480rpx; margin-top: 12rpx; color: var(--mci-text-secondary, rgba(23,49,61,.66)); font-size: 23rpx; line-height: 1.6; text-align: center; }
.message-auth-wrap { padding: 24rpx 24rpx calc(var(--mci-tabbar-height, 142rpx) + 28rpx + var(--mci-safe-bottom)); }
@media (prefers-reduced-motion: reduce) { .sk-avatar, .sk-line { animation: none; } }
</style>

<style lang="scss" scoped src="./message-signal.scss"></style>
