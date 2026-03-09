<template>
  <view class="chat-container" :style="'--theme:' + themeColor + ';--theme-light:' + themeColorLight + ';--theme-gradient:' + themeGradient">
    <!-- 顶部导航 -->
    <view class="chat-header" :style="{ paddingTop: statusBarHeight + 'px', background: themeGradient }">
      <view class="header-inner">
        <view class="header-back" @tap="goBack">
          <text class="back-arrow">‹</text>
          <text class="back-text">{{ t('common.back') }}</text>
        </view>
        <text class="header-title">{{ chatName }}</text>
        <view class="header-right" @tap="showSettings = true">
          <text class="more-icon">⋯</text>
        </view>
      </view>
    </view>

    <!-- 聊天消息区域 -->
    <scroll-view
      class="chat-messages"
      scroll-y
      :scroll-into-view="scrollToId"
      :scroll-with-animation="true"
    >
      <!-- 加载更多 -->
      <view class="load-more-hint" v-if="loadingMore">
        <text>{{ t('common.loading') }}</text>
      </view>

      <!-- 消息列表 -->
      <view
        v-for="(msg, index) in messages"
        :key="msg.id"
        :id="'msg-' + msg.id"
        class="message-wrapper"
      >
        <!-- 时间分隔 -->
        <view class="time-divider" v-if="shouldShowTime(msg, index)">
          <text>{{ formatMsgTime(msg.SendTime) }}</text>
        </view>

        <!-- 消息气泡 -->
        <view class="message-row" :class="msg.isSelf ? 'is-self' : 'is-other'">
          <!-- 对方头像 -->
          <view class="msg-avatar" v-if="!msg.isSelf">
            <text class="avatar-char">{{ (msg.senderName || '?').charAt(0) }}</text>
          </view>

          <view class="bubble-area">
            <text class="sender-label" v-if="!msg.isSelf && chatType === 'group'">{{ msg.senderName }}</text>
            <view class="bubble" :class="msg.isSelf ? 'bubble-self' : 'bubble-other'">
              <text class="bubble-text">{{ msg.Content }}</text>
              <text class="streaming-cursor" v-if="msg.isStreaming">▌</text>
            </view>
            <view class="bubble-meta">
              <text class="bubble-time">{{ formatBubbleTime(msg.SendTime) }}</text>
              <!-- Bug#5: 发送失败指示器 -->
              <text class="send-failed" v-if="msg.sendStatus === 'failed'" @tap="resendMessage(msg)">⚠ {{ t('message.sendFailed') }}</text>
            </view>
          </view>

          <!-- 自己头像 -->
          <view class="msg-avatar" v-if="msg.isSelf">
            <text class="avatar-char">{{ (currentUser.Name || '我').charAt(0) }}</text>
          </view>
        </view>
      </view>

      <view :id="scrollToId || 'msg-bottom'"></view>
    </scroll-view>

    <!-- 底部输入区域 -->
    <view class="chat-input-area">
      <view class="input-row">
        <view class="input-wrap">
          <textarea
            class="chat-textarea"
            v-model="inputMessage"
            :auto-height="true"
            :maxlength="2000"
            :placeholder="t('message.inputMsg')"
            placeholder-style="color:#bbb;font-size:14px;"
            @confirm="sendMessage"
            :confirm-type="'send'"
            :adjust-position="true"
          />
        </view>
        <view class="send-area">
          <view v-if="inputMessage.trim()" class="send-btn" :style="{ background: themeColor }" @tap="sendMessage">
            <text>{{ t('common.send') }}</text>
          </view>
          <view v-else class="more-btn" @tap="showMorePanel = !showMorePanel">
            <text class="plus-icon">＋</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 更多功能面板 -->
    <view class="more-panel" v-if="showMorePanel">
      <view class="panel-grid">
        <view class="panel-item" @tap="handleAction('image')">
          <view class="panel-icon-wrap">
            <text class="panel-icon">🖼️</text>
          </view>
          <text class="panel-label">{{ t('message.image') }}</text>
        </view>
        <view class="panel-item" @tap="handleAction('camera')">
          <view class="panel-icon-wrap">
            <text class="panel-icon">📷</text>
          </view>
          <text class="panel-label">{{ t('message.camera') }}</text>
        </view>
        <view class="panel-item" @tap="handleAction('file')">
          <view class="panel-icon-wrap">
            <text class="panel-icon">📁</text>
          </view>
          <text class="panel-label">{{ t('message.file') }}</text>
        </view>
        <view class="panel-item" @tap="handleAction('location')">
          <view class="panel-icon-wrap">
            <text class="panel-icon">📍</text>
          </view>
          <text class="panel-label">{{ t('message.location') }}</text>
        </view>
      </view>
    </view>

    <!-- 设置抽屉 -->
    <view class="settings-mask" v-if="showSettings" @tap="showSettings = false">
      <view class="settings-panel" @tap.stop>
        <view class="settings-header">
          <text class="settings-title">{{ t('message.chatInfo') }}</text>
        </view>
        <view class="settings-list">
          <view class="settings-item">
            <text>{{ t('message.muteNotification') }}</text>
            <switch :checked="chatMuted" @change="chatMuted = $event.detail.value" color="#4e6ef2" />
          </view>
          <view class="settings-item">
            <text>{{ t('message.pinChat') }}</text>
            <switch :checked="chatPinned" @change="chatPinned = $event.detail.value" color="#4e6ef2" />
          </view>
          <view class="settings-item danger" @tap="clearHistory">
            <text>{{ t('message.clearHistory') }}</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken, getUser } from '@/utils/request.js'
import { post } from '@/utils/request.js'
import appConfig from '@/config.js'
import { themeMixin } from '@/utils/theme.js'
import { getSignalR, connectSignalR } from '@/utils/signalr.js'

export default {
  mixins: [themeMixin],
  data() {
    return {
      statusBarHeight: 44,
      chatId: '',
      chatName: '聊天',
      chatType: 'private',
      inputMessage: '',
      messages: [],
      showMorePanel: false,
      showSettings: false,
      chatMuted: false,
      chatPinned: false,
      loadingMore: false,
      scrollToId: '',
      currentStreamMessage: null,
      _pollTimer: null,
      // SignalR 事件回调引用
      _onReceiveChatRecord: null,
      _onReceiveMessage: null,
      _onReceiveAIChunk: null
    }
  },

  computed: {
    currentUser() {
      return getUser() || {}
    }
  },

  onLoad(options) {
    this.chatId = options.id || ''
    this.chatName = decodeURIComponent(options.name || '聊天')
    this.chatType = options.type || 'private'

    try {
      const info = uni.getWindowInfo()
      this.statusBarHeight = info.statusBarHeight || 44
    } catch (e) {
      try {
        this.statusBarHeight = uni.getSystemInfoSync().statusBarHeight || 44
      } catch (e2) {}
    }

    // Bug#13: 登录状态检查
    const user = getUser()
    const token = getToken()
    if (!user || !user.Id || !token) {
      uni.showToast({ title: this.t('common.loginFirst'), icon: 'none' })
      setTimeout(() => {
        uni.navigateTo({ url: '/pages/login/index' })
      }, 1000)
      return
    }

    this.loadChatRecord()
  },

  onUnload() {
    this.stopPolling()
    this.cleanupSignalREvents()
  },

  methods: {
    goBack() {
      uni.navigateBack({
        fail: () => {
          uni.switchTab({ url: '/pages/message/index' })
        }
      })
    },

    // 加载聊天记录（通过 SignalR）
    async loadChatRecord() {
      try {
        const client = await connectSignalR()

        // Bug#12: 检查连接是否成功
        if (!client.isConnected) {
          uni.showToast({ title: this.t('message.reconnecting'), icon: 'none' })
          return
        }

        // 清理旧事件
        this.cleanupSignalREvents()

        // 注册接收聊天记录回调
        this._onReceiveChatRecord = (records) => {
          console.log('[Chat] ReceiveSendChatRecordToUser:', records?.length || 0)
          if (Array.isArray(records)) {
            const userId = this.currentUser.Id // Bug#9: 使用computed属性获取最新用户
            this.messages = records.map(r => ({
              id: r.Id || (Date.now().toString() + Math.random()),
              Type: r.Type || 'text',
              Content: r.Content || '',
              SendTime: r.CreateTime || r.SendTime,
              FromUserId: r.FromUserId,
              ToUserId: r.ToUserId,
              isSelf: r.FromUserId === userId,
              senderName: r.FromUserId === userId ? this.t('message.me') : (r.FromUserName || this.chatName),
              isStreaming: false
            }))
            this.$nextTick(() => this.scrollToBottom())
          }
        }
        client.on('ReceiveSendChatRecordToUser', this._onReceiveChatRecord)

        // 注册实时消息接收
        this._onReceiveMessage = (message) => {
          if (!message) return
          const userId = this.currentUser.Id // Bug#9: 使用computed属性
          // 只处理与当前聊天相关的消息
          const isRelevant = (message.FromUserId === this.chatId && message.ToUserId === userId) ||
                             (message.FromUserId === userId && message.ToUserId === this.chatId)
          if (!isRelevant) return

          // 如果是自己发送的消息，跳过（已在sendMessage中本地添加过）
          if (message.FromUserId === userId) return

          console.log('[Chat] ReceiveSendToUser (realtime):', message.Content?.substring(0, 30))
          // Bug#7: 优先用消息ID去重，回退到内容+时间窗口
          const isDuplicate = this.messages.some(m => {
            // 优先用服务端ID匹配
            if (message.Id && m.id === message.Id) return true
            // 回退：内容+发送者+时间窗口
            if (m.FromUserId !== message.FromUserId) return false
            if (m.Content !== message.Content) return false
            const timeDiff = Math.abs(new Date(m.SendTime) - new Date(message.CreateTime || new Date()))
            return timeDiff < 2000
          })
          if (!isDuplicate) {
            this.messages.push({
              id: message.Id || (Date.now().toString() + Math.random()),
              Type: message.Type || 'text',
              Content: message.Content || '',
              SendTime: message.CreateTime || new Date().toISOString(),
              FromUserId: message.FromUserId,
              ToUserId: message.ToUserId,
              isSelf: message.FromUserId === userId,
              senderName: message.FromUserId === userId ? this.t('message.me') : (message.FromUserName || this.chatName),
              isStreaming: false
            })
            this.$nextTick(() => this.scrollToBottom())
          }
        }
        client.on('ReceiveSendToUser', this._onReceiveMessage)

        // 注册 AI 流式响应
        this._onReceiveAIChunk = (chunk, fromUserId, toUserId, isComplete) => {
          const userId = this.currentUser.Id // Bug#9: 使用computed属性
          if (toUserId !== userId) return
          // Bug#1: isComplete类型容错
          const complete = isComplete === true || isComplete === 'true'
          if (!this.currentStreamMessage) {
            // 创建新的流式消息
            this.currentStreamMessage = {
              id: 'ai-stream-' + Date.now(),
              Type: 'text',
              Content: chunk || '',
              SendTime: new Date().toISOString(),
              FromUserId: fromUserId,
              ToUserId: toUserId,
              isSelf: false,
              senderName: this.chatName,
              isStreaming: true
            }
            this.messages.push(this.currentStreamMessage)
          } else {
            // Bug#2: 使用$set确保Vue响应式更新
            const idx = this.messages.findIndex(m => m.id === this.currentStreamMessage.id)
            if (idx !== -1) {
              this.$set(this.messages[idx], 'Content', (this.messages[idx].Content || '') + (chunk || ''))
              this.currentStreamMessage = this.messages[idx]
            } else {
              this.currentStreamMessage.Content += chunk || ''
            }
          }
          if (complete) {
            if (this.currentStreamMessage) {
              const idx = this.messages.findIndex(m => m.id === this.currentStreamMessage.id)
              if (idx !== -1) {
                this.$set(this.messages[idx], 'isStreaming', false)
              }
            }
            this.currentStreamMessage = null
          }
          this.$nextTick(() => this.scrollToBottom())
        }
        client.on('ReceiveAIChunk', this._onReceiveAIChunk)

        // 发送请求获取聊天记录
        if (client.isConnected) {
          const userId = this.currentUser.Id // Bug#9
          client.send('SendChatRecordToUser', {
            FromUserId: userId || '',
            ToUserId: this.chatId,
            OsClient: appConfig.osClient
          })
        }
      } catch (e) {
        console.error('[Chat] loadChatRecord error:', e)
      }
    },

    // 发送消息（通过 SignalR）
    async sendMessage() {
      const content = this.inputMessage.trim()
      if (!content) return

      const user = this.currentUser // Bug#9: 使用computed属性
      const newMsg = {
        id: Date.now().toString(),
        Type: 'text',
        Content: content,
        SendTime: new Date().toISOString(),
        FromUserId: user.Id,
        ToUserId: this.chatId,
        isSelf: true,
        senderName: this.t('message.me'),
        isStreaming: false,
        sendStatus: 'sending' // Bug#5: 跟踪发送状态
      }

      this.messages.push(newMsg)
      this.inputMessage = ''
      this.showMorePanel = false
      this.$nextTick(() => this.scrollToBottom())

      // 通过 SignalR 发送
      const msgPayload = {
        Content: content,
        OsClient: appConfig.osClient,
        ToUserId: this.chatId,
        ToUserName: this.chatName,
        ToUserAvatar: '',
        FromUserId: user.Id || '',
        FromUserName: user.Name || '',
        FromUserAvatar: user.Avatar || ''
      }

      try {
        const client = getSignalR()
        if (client.isConnected) {
          client.send('SendToUser', msgPayload)
          // Bug#5: 标记发送成功
          const idx = this.messages.findIndex(m => m.id === newMsg.id)
          if (idx !== -1) this.$set(this.messages[idx], 'sendStatus', 'sent')
        } else {
          uni.showToast({ title: this.t('message.reconnecting'), icon: 'none' })
          // 尝试重连并重发
          await connectSignalR()
          const client2 = getSignalR()
          if (client2.isConnected) {
            client2.send('SendToUser', msgPayload)
            const idx = this.messages.findIndex(m => m.id === newMsg.id)
            if (idx !== -1) this.$set(this.messages[idx], 'sendStatus', 'sent')
          } else {
            // Bug#5: 重连后仍然无法发送，标记失败
            const idx = this.messages.findIndex(m => m.id === newMsg.id)
            if (idx !== -1) this.$set(this.messages[idx], 'sendStatus', 'failed')
            uni.showToast({ title: this.t('message.sendFailed'), icon: 'none' })
          }
        }
      } catch (e) {
        console.error('[Chat] sendMessage error:', e)
        // Bug#5: 发送异常，标记失败
        const idx = this.messages.findIndex(m => m.id === newMsg.id)
        if (idx !== -1) this.$set(this.messages[idx], 'sendStatus', 'failed')
        uni.showToast({ title: this.t('message.sendFailed'), icon: 'none' })
      }
    },

    // 停止轮询
    stopPolling() {
      if (this._pollTimer) {
        clearInterval(this._pollTimer)
        this._pollTimer = null
      }
    },

    // 清理 SignalR 事件
    cleanupSignalREvents() {
      // Bug#6: 检查是否有需要清理的事件回调
      if (!this._onReceiveChatRecord && !this._onReceiveMessage && !this._onReceiveAIChunk) return
      try {
        const client = getSignalR()
        if (this._onReceiveChatRecord) {
          client.off('ReceiveSendChatRecordToUser', this._onReceiveChatRecord)
          this._onReceiveChatRecord = null
        }
        if (this._onReceiveMessage) {
          client.off('ReceiveSendToUser', this._onReceiveMessage)
          this._onReceiveMessage = null
        }
        if (this._onReceiveAIChunk) {
          client.off('ReceiveAIChunk', this._onReceiveAIChunk)
          this._onReceiveAIChunk = null
        }
      } catch (e) {
        console.warn('[Chat] cleanupSignalREvents error:', e)
      }
    },

    // Bug#3: 使用唯一值确保scroll-view每次都能触发滚动
    scrollToBottom() {
      this.scrollToId = ''
      this.$nextTick(() => {
        this.scrollToId = 'msg-bottom-' + Date.now()
      })
    },

    shouldShowTime(msg, index) {
      if (index === 0) return true
      const prev = this.messages[index - 1]
      const diff = new Date(msg.SendTime) - new Date(prev.SendTime)
      return diff > 5 * 60 * 1000
    },

    // Bug#5: 重发失败的消息
    async resendMessage(msg) {
      const idx = this.messages.findIndex(m => m.id === msg.id)
      if (idx === -1) return

      this.$set(this.messages[idx], 'sendStatus', 'sending')

      const user = this.currentUser
      const msgPayload = {
        Content: msg.Content,
        OsClient: appConfig.osClient,
        ToUserId: this.chatId,
        ToUserName: this.chatName,
        ToUserAvatar: '',
        FromUserId: user.Id || '',
        FromUserName: user.Name || '',
        FromUserAvatar: user.Avatar || ''
      }

      try {
        let client = getSignalR()
        if (!client.isConnected) {
          await connectSignalR()
          client = getSignalR()
        }
        if (client.isConnected) {
          client.send('SendToUser', msgPayload)
          this.$set(this.messages[idx], 'sendStatus', 'sent')
        } else {
          this.$set(this.messages[idx], 'sendStatus', 'failed')
          uni.showToast({ title: this.t('message.sendFailed'), icon: 'none' })
        }
      } catch (e) {
        console.error('[Chat] resendMessage error:', e)
        this.$set(this.messages[idx], 'sendStatus', 'failed')
        uni.showToast({ title: this.t('message.sendFailed'), icon: 'none' })
      }
    },

    formatMsgTime(time) {
      if (!time) return ''
      const date = new Date(time)
      const now = new Date()
      if (date.toDateString() === now.toDateString()) {
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      }
      return `${date.getMonth() + 1}月${date.getDate()}日 ${date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    },

    formatBubbleTime(time) {
      if (!time) return ''
      return new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    },

    handleAction(type) {
      this.showMorePanel = false
      uni.showToast({ title: type + ' ' + this.t('message.featureDev'), icon: 'none' })
    },

    clearHistory() {
      uni.showModal({
        title: this.t('common.tip'),
        content: this.t('message.clearHistoryConfirm'),
        success: (res) => {
          if (res.confirm) {
            this.messages = []
            this.showSettings = false
          }
        }
      })
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #ededed;
  overflow: hidden;
}

/* 顶部导航 */
.chat-header {
  background: #fff;
  border-bottom: 1rpx solid #e5e5e5;
  flex-shrink: 0;
  z-index: 100;
}

.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88rpx;
  padding: 0 24rpx;
}

.header-back {
  display: flex;
  align-items: center;
  min-width: 120rpx;
}

.back-arrow {
  font-size: 44rpx;
  color: #fff;
  margin-right: 4rpx;
  line-height: 1;
}

.back-text {
  font-size: 28rpx;
  color: #fff;
}

.header-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #fff;
  flex: 1;
  text-align: center;
}

.header-right {
  min-width: 120rpx;
  display: flex;
  justify-content: flex-end;
}

.more-icon {
  font-size: 40rpx;
  color: #fff;
}

/* 消息区域 */
.chat-messages {
  flex: 1;
  height: 0;
  padding: 20rpx 24rpx;
}

.load-more-hint {
  text-align: center;
  padding: 16rpx 0;
  text {
    font-size: 24rpx;
    color: #999;
  }
}

/* 时间分隔 */
.time-divider {
  text-align: center;
  padding: 16rpx 0 24rpx;
  text {
    font-size: 22rpx;
    color: #999;
    background: rgba(0,0,0,0.04);
    padding: 4rpx 16rpx;
    border-radius: 8rpx;
  }
}

/* 消息行 */
.message-row {
  display: flex;
  align-items: flex-start;
  margin-bottom: 28rpx;

  &.is-self {
    justify-content: flex-end;

    .bubble-area {
      align-items: flex-end;
    }
    .bubble-self {
      background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
      color: #fff;
      border-radius: 20rpx 4rpx 20rpx 20rpx;
    }
    .bubble-time {
      text-align: right;
    }
  }

  &.is-other {
    .bubble-other {
      background: #fff;
      color: #333;
      border-radius: 4rpx 20rpx 20rpx 20rpx;
    }
  }
}

.msg-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin: 0 16rpx;
}

.avatar-char {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.bubble-area {
  display: flex;
  flex-direction: column;
  max-width: 65%;
}

.sender-label {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 6rpx;
}

.bubble {
  display: inline-block;
  padding: 18rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.05);
  word-break: break-word;
  border-radius: 20rpx; /* Bug#14: 默认圆角 */
}

.bubble-text {
  font-size: 28rpx;
  line-height: 1.6;
}

.streaming-cursor {
  display: inline;
  animation: blink 1s infinite;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.bubble-time {
  font-size: 20rpx;
  color: #bbb;
  margin-top: 6rpx;
}

.bubble-meta {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 6rpx;
}

.send-failed {
  font-size: 22rpx;
  color: #ff4d4f;
  cursor: pointer;
}

/* 底部输入区域 */
.chat-input-area {
  background: #f5f5f5;
  border-top: 1rpx solid #e5e5e5;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  flex-shrink: 0;
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 16rpx;
}

.input-wrap {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 12rpx 20rpx;
  min-height: 72rpx;
  max-height: 240rpx;
}

.chat-textarea {
  width: 100%;
  font-size: 28rpx;
  color: #333;
  line-height: 1.5;
  min-height: 44rpx;
}

.send-area {
  flex-shrink: 0;
}

.send-btn {
  background: var(--theme-gradient, linear-gradient(135deg, #4e6ef2, #6b8aff));
  padding: 14rpx 28rpx;
  border-radius: 16rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;

  text {
    color: #fff;
    font-size: 28rpx;
    font-weight: 500;
  }
}

.more-btn {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plus-icon {
  font-size: 40rpx;
  color: #666;
}

/* 更多面板 */
.more-panel {
  background: #f5f5f5;
  padding: 32rpx 24rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  flex-shrink: 0;
}

.panel-grid {
  display: flex;
  gap: 32rpx;
}

.panel-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.panel-icon-wrap {
  width: 100rpx;
  height: 100rpx;
  background: #fff;
  border-radius: 20rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10rpx;
}

.panel-icon {
  font-size: 44rpx;
}

.panel-label {
  font-size: 22rpx;
  color: #666;
}

/* 设置面板 */
.settings-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.45);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.settings-panel {
  width: 560rpx;
  background: #fff;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.settings-header {
  padding: 48rpx 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.settings-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
}

.settings-list {
  padding: 0 32rpx;
}

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 0;
  border-bottom: 1rpx solid #f5f5f5;

  text {
    font-size: 30rpx;
    color: #333;
  }

  &.danger text {
    color: #ff4d4f;
  }

  .arrow {
    font-size: 36rpx;
    color: #ccc;
  }
}
</style>
