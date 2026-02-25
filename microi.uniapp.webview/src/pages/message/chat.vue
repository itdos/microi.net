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
            <text class="bubble-time">{{ formatBubbleTime(msg.SendTime) }}</text>
          </view>

          <!-- 自己头像 -->
          <view class="msg-avatar" v-if="msg.isSelf">
            <text class="avatar-char">{{ (currentUser.Name || '我').charAt(0) }}</text>
          </view>
        </view>
      </view>

      <view id="msg-bottom"></view>
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
import appConfig from '@/utils/config.js'
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
      const user = getUser() || {}
      try {
        const client = await connectSignalR()

        // 清理旧事件
        this.cleanupSignalREvents()

        // 注册接收聊天记录回调
        this._onReceiveChatRecord = (records) => {
          console.log('[Chat] ReceiveSendChatRecordToUser:', records?.length || 0)
          if (Array.isArray(records)) {
            this.messages = records.map(r => ({
              id: r.Id || (Date.now().toString() + Math.random()),
              Type: r.Type || 'text',
              Content: r.Content || '',
              SendTime: r.CreateTime || r.SendTime,
              FromUserId: r.FromUserId,
              ToUserId: r.ToUserId,
              isSelf: r.FromUserId === user.Id,
              senderName: r.FromUserId === user.Id ? '我' : (r.FromUserName || this.chatName),
              isStreaming: false
            }))
            this.$nextTick(() => this.scrollToBottom())
          }
        }
        client.on('ReceiveSendChatRecordToUser', this._onReceiveChatRecord)

        // 注册实时消息接收
        this._onReceiveMessage = (message) => {
          if (!message) return
          // 只处理与当前聊天相关的消息
          const isRelevant = (message.FromUserId === this.chatId && message.ToUserId === user.Id) ||
                             (message.FromUserId === user.Id && message.ToUserId === this.chatId)
          if (!isRelevant) return

          console.log('[Chat] ReceiveSendToUser (realtime):', message.Content?.substring(0, 30))
          // 检查是否已存在（避免重复）
          const exists = this.messages.some(m => m.id === message.Id)
          if (!exists) {
            this.messages.push({
              id: message.Id || (Date.now().toString() + Math.random()),
              Type: message.Type || 'text',
              Content: message.Content || '',
              SendTime: message.CreateTime || new Date().toISOString(),
              FromUserId: message.FromUserId,
              ToUserId: message.ToUserId,
              isSelf: message.FromUserId === user.Id,
              senderName: message.FromUserId === user.Id ? '我' : (message.FromUserName || this.chatName),
              isStreaming: false
            })
            this.$nextTick(() => this.scrollToBottom())
          }
        }
        client.on('ReceiveSendToUser', this._onReceiveMessage)

        // 注册 AI 流式响应
        this._onReceiveAIChunk = (chunk, fromUserId, toUserId, isComplete) => {
          if (toUserId !== user.Id) return
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
            this.currentStreamMessage.Content += chunk || ''
          }
          if (isComplete) {
            this.currentStreamMessage.isStreaming = false
            this.currentStreamMessage = null
          }
          this.$nextTick(() => this.scrollToBottom())
        }
        client.on('ReceiveAIChunk', this._onReceiveAIChunk)

        // 发送请求获取聊天记录
        if (client.isConnected) {
          client.send('SendChatRecordToUser', {
            FromUserId: user.Id || '',
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

      const user = getUser() || {}
      const newMsg = {
        id: Date.now().toString(),
        Type: 'text',
        Content: content,
        SendTime: new Date().toISOString(),
        FromUserId: user.Id,
        ToUserId: this.chatId,
        isSelf: true,
        senderName: this.t('message.me'),
        isStreaming: false
      }

      this.messages.push(newMsg)
      this.inputMessage = ''
      this.showMorePanel = false
      this.$nextTick(() => this.scrollToBottom())

      // 通过 SignalR 发送
      try {
        const client = getSignalR()
        if (client.isConnected) {
          client.send('SendToUser', {
            Content: content,
            OsClient: appConfig.osClient,
            ToUserId: this.chatId,
            ToUserName: this.chatName,
            ToUserAvatar: '',
            FromUserId: user.Id || '',
            FromUserName: user.Name || '',
            FromUserAvatar: user.Avatar || ''
          })
        } else {
          uni.showToast({ title: '连接已断开，正在重连...', icon: 'none' })
          // 尝试重连并重发
          await connectSignalR()
          const client2 = getSignalR()
          if (client2.isConnected) {
            client2.send('SendToUser', {
              Content: content,
              OsClient: appConfig.osClient,
              ToUserId: this.chatId,
              ToUserName: this.chatName,
              ToUserAvatar: '',
              FromUserId: user.Id || '',
              FromUserName: user.Name || '',
              FromUserAvatar: user.Avatar || ''
            })
          }
        }
      } catch (e) {
        console.error('[Chat] sendMessage error:', e)
        uni.showToast({ title: '发送失败', icon: 'none' })
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
      const client = getSignalR()
      if (this._onReceiveChatRecord) {
        client.off('ReceiveSendChatRecordToUser', this._onReceiveChatRecord)
      }
      if (this._onReceiveMessage) {
        client.off('ReceiveSendToUser', this._onReceiveMessage)
      }
      if (this._onReceiveAIChunk) {
        client.off('ReceiveAIChunk', this._onReceiveAIChunk)
      }
    },

    scrollToBottom() {
      this.scrollToId = ''
      this.$nextTick(() => {
        this.scrollToId = 'msg-bottom'
      })
    },

    shouldShowTime(msg, index) {
      if (index === 0) return true
      const prev = this.messages[index - 1]
      const diff = new Date(msg.SendTime) - new Date(prev.SendTime)
      return diff > 5 * 60 * 1000
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
      uni.showToast({ title: type + ' 功能开发中', icon: 'none' })
    },

    clearHistory() {
      uni.showModal({
        title: '提示',
        content: '确定要清空聊天记录吗？',
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
  color: #333;
  margin-right: 4rpx;
  line-height: 1;
}

.back-text {
  font-size: 28rpx;
  color: #333;
}

.header-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #333;
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
  color: #333;
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
    flex-direction: row-reverse;

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
