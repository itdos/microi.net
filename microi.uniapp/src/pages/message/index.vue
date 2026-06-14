<template>
	<view class="message-container"
		:style="[mciTokenStyle, { '--theme': themeColor, '--theme-light': themeColorLight, '--theme-gradient': themeGradient }]">
		<!-- 顶部导航栏 -->
		<view class="msg-header" :style="{ paddingTop: statusBarHeight + 'px', background: themeGradient }">
			<view class="header-inner">
				<text class="header-title">{{ t('message.title') }}</text>
				<view class="header-action" v-if="isLoggedIn" @tap="showNewChat = true">
					<text class="action-icon">✚</text>
				</view>
			</view>
			<!-- Tab 切换（仅登录后显示） -->
			<view class="msg-tabs">
				<view class="msg-tab" :class="{ active: activeTab === 'messages' }" @tap="activeTab = 'messages'">
					<text>{{ t('message.title') }}</text>
					<view class="tab-line" v-if="activeTab === 'messages'"></view>
				</view>
				<view class="msg-tab" :class="{ active: activeTab === 'contacts' }" @tap="switchToContacts">
					<text>{{ t('message.contacts') }}</text>
					<view class="tab-line" v-if="activeTab === 'contacts'"></view>
				</view>
			</view>
		</view>

		<!-- 未登录提示 -->
		<view v-if="!isLoggedIn" class="message-auth-wrap">
			<mci-auth-prompt
				:title="t('common.loginFirst')"
				:desc="t('message.loginHint')"
				:action-text="t('common.loginNow')"
				:gradient="themeGradient"
				@action="goLogin"
			/>
		</view>

		<!-- 搜索栏 -->
		<view class="search-section" v-if="isLoggedIn">
			<view class="search-wrap">
				<text class="search-icon">🔍</text>
				<input class="search-input"
					:placeholder="activeTab === 'messages' ? t('message.searchMsg') : t('message.searchContact')"
					placeholder-style="color:#bbb;font-size:13px;" v-model="searchKeyword" @confirm="doSearch"
					@input="onSearchInput" />
				<view v-if="searchKeyword" class="search-clear" @tap="clearSearch">✕</view>
			</view>
		</view>
		 <!-- zhy自定义多选下拉：通讯录人员类型筛选 -->
		  <view class="filter-section" v-if="isLoggedIn && activeTab === 'contacts'">
			<view class="filter-button">
			  <view class="filter-lef" @tap="showTypeDropdown = !showTypeDropdown">
			  	<text class="filter-bt">人员角色：</text>
			  	<view class="filter-label">
			  		<text class="">{{selectedTypes.length?selectedTypesString : ' 请选择 '}}</text>
			  	</view>
			  	<text class="chev-top" v-if="showTypeDropdown">▲</text>
			  	<text class="chev-top" v-else>▼</text>
			  </view>
			  <view class="filter-rig" @tap="handDelet">
			  	<text class="filter-delet">清除</text>
			  </view>
			</view>
			<!-- 遮罩层：覆盖页面，点击关闭下拉 -->
			<view v-if="showTypeDropdown" class="dropdown-mask" @tap="showTypeDropdown = false"></view>
			<view v-if="showTypeDropdown" class="type-dropdown">
			  <view
				v-for="type in personTypes"
				:key="type.id"
				class="type-option"
				@tap="toggleTypeSelection(type.id,type.label)"
			  >
				<view class="checkbox" :class="{ checked: isTypeSelected(type.id) }">
				  <text v-if="isTypeSelected(type.id)">✔</text>
				</view>
				<text class="type-text">{{ type.label }}</text>
			  </view>
			</view>
		  </view>
	
		<!-- 消息列表 -->
		<scroll-view class="msg-scroll" scroll-y v-if="isLoggedIn && activeTab === 'messages'" :refresher-enabled="true"
			:refresher-triggered="refreshing" @refresherrefresh="onRefresh">
			<!-- 骨架屏 -->
			<view v-if="loading && messageList.length === 0" class="skeleton-list">
				<view class="sk-item" v-for="i in 5" :key="i">
					<view class="sk-avatar"></view>
					<view class="sk-content">
						<view class="sk-line sk-name"></view>
						<view class="sk-line sk-msg"></view>
					</view>
				</view>
			</view>

			<!-- 消息条目 -->
			<view v-for="msg in filteredMessageList" :key="msg.ContactUserId" class="msg-item" @tap="openChat(msg)">
				<view class="msg-avatar-wrap">
					<view class="msg-avatar">
						<text class="avatar-text">{{ (msg.ContactUserName || '?').charAt(0) }}</text>
					</view>
					<view class="unread-badge" v-if="msg.UnRead > 0">
						<text>{{ msg.UnRead > 99 ? '99+' : msg.UnRead }}</text>
					</view>
				</view>
				<view class="msg-body">
					<view class="msg-top">
						<text class="msg-name">{{ msg.ContactUserName }}</text>
						<text class="msg-time">{{ formatTime(msg.UpdateTime) }}</text>
					</view>
					<view class="msg-bottom">
						<text class="msg-preview">{{ stripHtml(msg.LastMessage) }}</text>
					</view>
				</view>
			</view>

			<!-- 空状态 -->
			<view class="empty-state" v-if="!loading && filteredMessageList.length === 0">
				<text class="empty-icon">💬</text>
				<text class="empty-text">{{ t('message.noMessages') }}</text>
				<view class="empty-btn" @tap="showNewChat = true">
					<text>{{ t('message.startChat') }}</text>
				</view>
			</view>
		</scroll-view>

		<!-- 通讯录列表 -->
		<scroll-view class="msg-scroll" scroll-y v-if="isLoggedIn && activeTab === 'contacts'"
			@scrolltolower="onContactScrollToLower" lower-threshold="100">
			<!-- 骨架屏 -->
			<view v-if="contactLoading && contactList.length === 0" class="skeleton-list">
				<view class="sk-item" v-for="i in 8" :key="i">
					<view class="sk-avatar sk-avatar-sm"></view>
					<view class="sk-content">
						<view class="sk-line sk-name"></view>
						<view class="sk-line sk-dept"></view>
					</view>
				</view>
			</view>

			<view v-for="contact in contactList" :key="contact.Id" class="contact-item" @tap="startChat(contact)">
				<view class="contact-avatar">
					<text class="avatar-text">{{ (contact.Name || '?').charAt(0) }}</text>
				</view>
				<view class="contact-info">
					<text class="contact-name">{{ contact.Name }}</text>
					<text class="contact-dept" v-if="contact.DepartmentName">{{ contact.DepartmentName }}</text>
				</view>
			</view>

			<!-- 加载更多提示 -->
			<view v-if="contactLoadingMore" class="loading-more-hint">
				<text>加载中...</text>
			</view>
			<view v-else-if="!contactHasMore && contactList.length > 0" class="loading-more-hint">
				<text>已加载全部联系人</text>
			</view>

			<!-- 空状态 -->
			<view class="empty-state" v-if="!contactLoading && contactList.length === 0">
				<text class="empty-icon">📇</text>
				<text class="empty-text">{{ t('message.noContacts') }}</text>
			</view>
		</scroll-view>

		<!-- 新建聊天弹窗 -->
		<view class="new-chat-mask" v-if="showNewChat" @tap="showNewChat = false">
			<view class="new-chat-panel" @tap.stop>
				<view class="panel-header">
					<text class="panel-title">{{ t('message.selectContact') }}</text>
					<text class="panel-close" @tap="showNewChat = false">✕</text>
				</view>
				<view class="panel-search">
					<input class="panel-search-input" :placeholder="t('message.searchContact')"
						placeholder-style="color:#bbb;font-size:13px;" v-model="dialogKeyword"
						@input="searchDialogContacts" />
				</view>
				<scroll-view class="panel-list" scroll-y>
					<view v-for="c in dialogContactList" :key="c.Id" class="panel-contact-item"
						@tap="startDialogChat(c)">
						<view class="panel-contact-avatar">
							<text class="avatar-text">{{ (c.Name || '?').charAt(0) }}</text>
						</view>
						<view class="panel-contact-info">
							<text class="panel-contact-name">{{ c.Name }}</text>
							<text class="panel-contact-dept" v-if="c.DepartmentName">{{ c.DepartmentName }}</text>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>
	</view>
</template>

<script>
	import {
		getToken,
		getUser
	} from '@/utils/request.js'
	import {
		post
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

	export default {
		components: {
			MciAuthPrompt
		},
		mixins: [themeMixin],
		data() {
			return {
				statusBarHeight: 44,
				isLoggedIn: false,
				activeTab: 'messages',
				searchKeyword: '',
				dialogKeyword: '',
				showNewChat: false,
				loading: true,
				contactLoading: false,
				refreshing: false,
				messageList: [],
				contactList: [],
				dialogContactList: [],
				wsConnected: false,
				// 通讯录分页
				contactPageIndex: 1,
				contactPageSize: 20,
				contactHasMore: true,
				contactLoadingMore: false,
				// 搜索防抖 timer
				contactSearchTimer: null,
				// SignalR 事件回调引用（方便移除）
				_onReceiveLastContacts: null,
				_onReceiveMessage: null,
				_onReceiveUnreadCount: null  ,
				  // zhy自定义人员类型筛选，待对接接口后
				  personTypes: [
					{ id: 'employee', label: '员工' },
					{ id: 'external', label: '外部' },
					{ id: 'manager', label: '管理' },
					{ id: 'supplier', label: '供应商' },
					{ id: 'customer', label: '客户' }
				  ],
				  selectedTypes: [],//id数组
				  selectedTypesLabelArry:[],//label数组
				  selectedTypesString:'',//label字符串
				  showTypeDropdown: false
			}
		},

		computed: {
			currentUser() {
				return getUser() || {}
			},
			filteredMessageList() {
				if (!this.searchKeyword) return this.messageList
				const kw = this.searchKeyword.toLowerCase()
				return this.messageList.filter(m =>
					(m.ContactUserName || '').toLowerCase().includes(kw) ||
					(m.LastMessage || '').toLowerCase().includes(kw)
				)
			} 
		},

		onLoad() {
			try {
				const info = uni.getWindowInfo()
				this.statusBarHeight = info.statusBarHeight || 44
			} catch (e) {
				try {
					this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
				} catch (e2) {}
			}
		},

		onShow() {
			this.checkLoginAndLoad()
		},

		methods: {
			// zhy多选人员角色筛选方法
			    toggleTypeSelection(typeId,typeLabel) {
			      const idx = this.selectedTypes.indexOf(typeId);
			      if (idx === -1) {
					  this.selectedTypes.push(typeId);
					  this.selectedTypesLabelArry.push(typeLabel);
				  }
			      else {
					  this.selectedTypes.splice(idx, 1);
					   this.selectedTypesLabelArry.splice(idx, 1);
				  }
				  this.selectedTypesString = this.selectedTypesLabelArry.join(',');
			      // 关闭下拉（保留为可按需调整，这里不自动关闭以便多选）
			    },
			    //选中数据打勾
			    isTypeSelected(typeId) {
			      return this.selectedTypes.indexOf(typeId) !== -1;
			    },
				//清空筛选
				handDelet(){
					this.selectedTypes = [];
					this.selectedTypesLabelArry = [];
					this.selectedTypesString = '';
					this.searchKeyword = '';
					this.contactPageIndex = 1;
					this.contactHasMore = true;
					this.loadContacts(false);
				},
			
			checkLoginAndLoad() {
				const token = getToken()
				this.isLoggedIn = !!token
				if (!token) {
					this.loading = false
					this.messageList = []
					return
				}
				this.initSignalR()
			},

			// 初始化 SignalR 连接并注册事件
			async initSignalR() {
				this.loading = true
				// 先停止可能存在的旧轮询，避免重复启动
				this.stopPolling()
				try {
					const client = await connectSignalR()
					this.wsConnected = client.isConnected

					// 注册事件（先移除旧的避免重复）
					this.cleanupSignalREvents()

					// 接收最近联系人列表
					this._onReceiveLastContacts = (data) => {
						console.log('[Message] ReceiveSendLastContacts:', data?.length || 0)
						if (Array.isArray(data)) {
							this.messageList = data
							this.ensureAIFirst()
						}
						this.loading = false
						this.refreshing = false
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

					// 请求最近联系人
					this.requestLastContacts()

					// 超时保护：如果8秒内没收到回调，关闭loading并显示空状态
					this._loadingTimeout = setTimeout(() => {
						if (this.loading) {
							console.warn('[Message] 加载超时，关闭loading')
							this.loading = false
							this.refreshing = false
							this.ensureAIFirst()
						}
					}, 8000)

					// 如果 SignalR 连接失败，使用轮询兜底
					if (!client.isConnected) {
						console.warn('[Message] SignalR未连接，启动轮询兜底')
						this.loading = false
						this.ensureAIFirst()
						this.startPollingFallback()
					}
				} catch (e) {
					console.error('[Message] initSignalR error:', e)
					this.loading = false
					this.refreshing = false
					// 连接失败兜底
					this.ensureAIFirst()
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
				} else {
					console.warn('[Message] requestLastContacts: SignalR未连接')
					this.loading = false
					this.refreshing = false
					this.ensureAIFirst()
				}
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

			ensureAIFirst() {
				const idx = this.messageList.findIndex(m => m.ContactUserId === 'AI')
				if (idx === -1) {
					this.messageList.unshift({
						ContactUserId: 'AI',
						ContactUserName: 'AI助手',
						ContactUserAvatar: '',
						LastMessage: '我是您的AI助手，有什么可以帮您？',
						UpdateTime: new Date().toISOString(),
						UnRead: 0
					})
				} else if (idx > 0) {
					const ai = this.messageList.splice(idx, 1)[0]
					this.messageList.unshift(ai)
				}
			},

			// 加载通讯录（支持分页和远端搜索）
			async loadContacts(isLoadMore = false) {
				if (isLoadMore) {
					this.contactLoadingMore = true
				} else {
					this.contactLoading = true
				}
				try {
					const res = await post('/api/SysUser/GetSysUserPublicInfo', {
						State: 1,
						_PageIndex: this.contactPageIndex,
						_PageSize: this.contactPageSize,
						_Keyword: this.searchKeyword || ''
					}, true)
					if (res.Code === 1 && res.Data) {
						const data = res.Data || []
						if (isLoadMore) {
							this.contactList = this.contactList.concat(data)
						} else {
							if (!this.searchKeyword) {
								this.contactList = [{
										Id: 'AI',
										Name: 'AI助手',
										DepartmentName: '系统'
									},
									...data
								]
							} else {
								this.contactList = data
							}
						}
						// 判断是否还有更多
						const aiOffset = (!this.searchKeyword && this.contactPageIndex === 1) ? 1 : 0
						const loadedCount = this.contactList.length - aiOffset
						this.contactHasMore = loadedCount < (res.Total || 0)
					}
				} catch (e) {
					console.error('[Message] loadContacts error:', e)
				} finally {
					this.contactLoading = false
					this.contactLoadingMore = false
				}
			},

			// 通讯录滚动到底部加载更多
			onContactScrollToLower() {
			// 此处contactHasMore判断是否还有数据错误
				if (this.contactHasMore && !this.contactLoadingMore && !this.contactLoading) {
					this.contactPageIndex++
					this.loadContacts(true)
				}
			},

			// 搜索输入事件（通讯录远端搜索）
			onSearchInput() {
				if (this.activeTab !== 'contacts') return
				clearTimeout(this.contactSearchTimer)
				this.contactSearchTimer = setTimeout(() => {
					this.contactPageIndex = 1
					this.contactHasMore = true
					this.loadContacts(false)
				}, 300)
			},

			// 清除搜索
			clearSearch() {
				this.searchKeyword = ''
				if (this.activeTab === 'contacts') {
					this.contactPageIndex = 1
					this.contactHasMore = true
					this.loadContacts(false)
				}
			},

			// 搜索弹窗联系人
			async searchDialogContacts() {
				try {
					const res = await post('/api/SysUser/GetSysUserPublicInfo', {
						State: 1,
						_PageIndex: 1,
						_PageSize: 15,
						_Keyword: this.dialogKeyword
					}, true)
					if (res.Code === 1 && res.Data) {
						this.dialogContactList = res.Data || []
					}
				} catch (e) {
					console.error('[Message] searchDialogContacts error:', e)
				}
			},

			switchToContacts() {
				this.activeTab = 'contacts'
				if (this.contactList.length === 0) {
					this.contactPageIndex = 1
					this.contactHasMore = true
					this.loadContacts(false)
				}
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
				uni.navigateTo({
					url: `/pages/message/chat?id=${msg.ContactUserId}&name=${encodeURIComponent(msg.ContactUserName)}`
				})
			},

			startChat(contact) {
				uni.navigateTo({
					url: `/pages/message/chat?id=${contact.Id}&name=${encodeURIComponent(contact.Name)}`
				})
			},

			startDialogChat(contact) {
				this.showNewChat = false
				uni.navigateTo({
					url: `/pages/message/chat?id=${contact.Id}&name=${encodeURIComponent(contact.Name)}`
				})
			},

			onRefresh() {
				this.refreshing = true
				this.requestLastContacts()
				// 超时保护
				setTimeout(() => {
					this.refreshing = false
				}, 5000)
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
			this.cleanupSignalREvents()
		},

		onUnload() {
			this.stopPolling()
			this.cleanupSignalREvents()
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
	}

	.header-title {
		font-size: 34rpx;
		font-weight: 600;
		color: #fff;
	}

	.header-action {
		position: absolute;
		right: 32rpx;
		top: 50%;
		transform: translateY(-50%);
	}

	.action-icon {
		font-size: 36rpx;
		color: var(--theme, #6C2BD9);
	}

	/* Tab */
	.msg-tabs {
		display: flex;
		padding: 0 48rpx;
	}

	.msg-tab {
		flex: 1;
		text-align: center;
		padding: 16rpx 0 20rpx;
		position: relative;
		font-size: 28rpx;
		color: #fff;

		&.active {
			// color: var(--theme, #6C2BD9);
			font-weight: 600;
		}
	}

	.tab-line {
		position: absolute;
		bottom: 0;
		left: 50%;
		transform: translateX(-50%);
		width: 48rpx;
		height: 6rpx;
		border-radius: 3rpx;
		background: var(--theme, #6C2BD9);
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
		padding-bottom: env(safe-area-inset-bottom);
	}

	/* zhy筛选下拉样式 */
	.filter-section {
	  margin: 12rpx 0;
	  // padding: 16rpx 24rpx;
	  position: relative;
	}
	.filter-button {
	  display: flex;
	  align-items: center;
	  justify-content: flex-start;
	  background: #fff;
	  // border-radius: 32rpx;
	  padding: 12rpx 18rpx;
	  height: 56rpx;
	}
	.filter-lef{
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.filter-label {
	  max-width: 250rpx;
	  color: #4c4c4c;
	  font-size: 26rpx;
	  overflow: hidden;
	  text-overflow: ellipsis;
	  white-space: nowrap;
	}
	.chev-top {
	  color: #000;
	  font-size: 22rpx;
	  margin-left: 12rpx;
	}
	.filter-rig{
		margin-left: 22rpx;
		padding: 4px 13px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1rpx solid #5a5a5a ;
		border-radius: 20px;
		background: #fff;
		color: #565656;
		font-size: 24rpx;
		
	}

	.type-dropdown {
	  position: absolute;
	  left: 0;
	  right: 0;
	  top: 72rpx;
	  background: #fff;
	  border-radius: 12rpx;
	  box-shadow: 0 8rpx 24rpx rgba(0,0,0,0.08);
	  padding: 12rpx;
	  z-index: 50;
	}

	/* 下拉遮罩，位于页面之上但低于下拉内容 */
	.dropdown-mask {
	  position: fixed;
	  left: 0;
	  top: 0;
	  right: 0;
	  bottom: 0;
	  background: rgba(0,0,0,0.3);
	  z-index: 45;
	}
	.type-option {
	  display: flex;
	  align-items: center;
	  padding: 10rpx 8rpx;
	  border-radius: 8rpx;
	}
	.checkbox {
	  width: 36rpx;
	  height: 36rpx;
	  border-radius: 6rpx;
	  border: 1rpx solid #ddd;
	  display: flex;
	  align-items: center;
	  justify-content: center;
	  margin-right: 12rpx;
	  color: #fff;
	}
	.checkbox.checked {
	  background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
	  border-color: transparent;
	}
	.type-text {
	  font-size: 26rpx;
	  color: #333;
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
		font-size: 24rpx;
		margin-right: 12rpx;
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
		height: 0;
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

	/* 通讯录 */
	.contact-item {
		display: flex;
		align-items: center;
		padding: 20rpx 32rpx;
		background: #fff;
		border-bottom: 1rpx solid #f5f5f5;
	}

	.contact-avatar {
		width: 80rpx;
		height: 80rpx;
		border-radius: 50%;
		background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 20rpx;
		flex-shrink: 0;
	}

	.contact-info {
		flex: 1;
		min-width: 0;
	}

	.contact-name {
		font-size: 28rpx;
		font-weight: 500;
		color: #333;
		display: block;
	}

	.contact-dept {
		font-size: 22rpx;
		color: #999;
		margin-top: 4rpx;
		display: block;
	}

	/* 空状态 */
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 120rpx 0;
	}

	/* 加载更多提示 */
	.loading-more-hint {
		text-align: center;
		padding: 24rpx 0;
		color: #999;
		font-size: 24rpx;
	}

	.empty-icon {
		font-size: 80rpx;
		margin-bottom: 24rpx;
	}

	.empty-text {
		font-size: 28rpx;
		color: #999;
		margin-bottom: 32rpx;
	}

	.empty-btn {
		background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
		padding: 16rpx 48rpx;
		border-radius: 40rpx;

		text {
			color: #fff;
			font-size: 28rpx;
		}
	}

	/* 新建聊天弹窗 */
	.new-chat-mask {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.45);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.new-chat-panel {
		width: 85%;
		max-height: 70vh;
		background: #fff;
		border-radius: 24rpx;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 28rpx 32rpx;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.panel-title {
		font-size: 32rpx;
		font-weight: 600;
		color: #333;
	}

	.panel-close {
		font-size: 32rpx;
		color: #999;
	}

	.panel-search {
		padding: 16rpx 24rpx;
		border-bottom: 1rpx solid #f5f5f5;
	}

	.panel-search-input {
		background: #f5f7fa;
		border-radius: 32rpx;
		padding: 0 24rpx;
		height: 68rpx;
		font-size: 26rpx;
	}

	.panel-list {
		flex: 1;
		max-height: 50vh;
	}

	.panel-contact-item {
		display: flex;
		align-items: center;
		padding: 20rpx 28rpx;
		border-bottom: 1rpx solid #f8f8f8;
	}

	.panel-contact-avatar {
		width: 72rpx;
		height: 72rpx;
		border-radius: 50%;
		background: var(--theme-gradient, linear-gradient(135deg, #6C2BD9, #8B5CF6));
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 20rpx;
	}

	.panel-contact-info {
		flex: 1;
	}

	.panel-contact-name {
		font-size: 28rpx;
		color: #333;
		display: block;
	}

	.panel-contact-dept {
		font-size: 22rpx;
		color: #999;
		margin-top: 4rpx;
		display: block;
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
