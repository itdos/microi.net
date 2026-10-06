<template>
  <view class="ai-assistant" :style="mciTokenStyle">
    <view class="ai-assistant__overlay">
      <view class="ai-assistant__panel">
        <view class="ai-assistant__header" :style="aiHeaderStyle">
          <view class="ai-assistant__grid"></view>
          <view class="ai-assistant__scan"></view>
          <view class="ai-assistant__identity">
            <view class="ai-assistant__avatar-wrap">
              <image class="ai-assistant__avatar" src="/static/mci/ai/assistant-robot.png" mode="aspectFit" />
              <view class="ai-assistant__online"></view>
            </view>
            <view class="ai-assistant__heading">
              <text class="ai-assistant__title">{{ appConfig.aiAssistantName }}</text>
              <text class="ai-assistant__scope">{{ headerScopeText }}</text>
            </view>
          </view>
          <view class="ai-assistant__header-actions">
            <view v-if="isAuthenticated && ready && enabled && consentGranted" class="ai-assistant__icon-button" hover-class="ai-assistant__icon-button--pressed" role="button" tabindex="0" aria-label="AI隐私设置" @tap="privacyVisible = true" @keydown.enter="privacyVisible = true">
              <view class="ai-assistant__privacy-icon" aria-hidden="true"><view /></view>
            </view>
            <view v-if="isAuthenticated && ready && enabled" class="ai-assistant__icon-button" hover-class="ai-assistant__icon-button--pressed" role="button" tabindex="0" aria-label="对话记录" @tap="openHistory" @keydown.enter="openHistory">
              <view class="ai-assistant__history-icon" aria-hidden="true"><view /><view /><view /></view>
            </view>
            <view v-if="isAuthenticated && ready && enabled" class="ai-assistant__icon-button" hover-class="ai-assistant__icon-button--pressed" role="button" tabindex="0" aria-label="新建对话" @tap="newConversation" @keydown.enter="newConversation">
              <view class="ai-assistant__plus-icon" aria-hidden="true" />
            </view>
            <view class="ai-assistant__icon-button" hover-class="ai-assistant__icon-button--pressed" role="button" tabindex="0" aria-label="关闭" @tap="closePanel" @keydown.enter="closePanel">
              <view class="ai-assistant__close-icon" aria-hidden="true" />
            </view>
          </view>
        </view>

        <view v-if="!isAuthenticated" class="ai-assistant__auth-state">
          <mci-auth-prompt
            title="登录后使用AI数据分析"
            desc="AI助手会严格按照账号角色和数据权限回答。登录前不会读取、分析或展示任何业务数据。"
            action-text="去登录"
            @action="goLogin"
          />
        </view>

        <view v-else-if="!ready" class="ai-assistant__loading-state" aria-label="AI助手加载中">
          <view v-for="index in 4" :key="index" class="ai-assistant__loading-card">
            <view class="ai-assistant__loading-line ai-assistant__loading-line--short" />
            <view class="ai-assistant__loading-line" />
          </view>
        </view>

        <view v-else-if="!enabled" class="ai-assistant__auth-state">
          <mci-auth-prompt
            title="当前角色暂未开通AI助手"
            desc="AI数据分析由后台按角色配置模型、业务域和数据范围，未授权账号无法查询任何数据。"
            action-text="返回"
            @action="closePanel"
          />
        </view>

        <scroll-view v-else-if="!consentGranted" class="ai-assistant__consent-scroll" scroll-y>
          <view class="ai-assistant__consent">
            <view class="ai-assistant__consent-shield" aria-hidden="true"><view /></view>
            <text class="ai-assistant__consent-title">使用 AI 前，请确认数据说明</text>
            <text class="ai-assistant__consent-copy">AI 助手会把你的问题和完成回答所需的授权业务数据，发送给平台后台配置的模型服务。当前选择：{{ selectedModelName }}。</text>
            <view class="ai-assistant__consent-list">
              <view><view class="ai-assistant__consent-dot" /><text>仅在你主动发送问题后调用，不会在后台自行读取数据。</text></view>
              <view><view class="ai-assistant__consent-dot" /><text>查询仍受当前租户、角色和数据权限约束。</text></view>
              <view><view class="ai-assistant__consent-dot" /><text>不会把登录密码、Token 或连接密钥放入 AI 问题。</text></view>
              <view><view class="ai-assistant__consent-dot" /><text>AI 结果可能不准确，请勿直接作为审批、财务或法律结论。</text></view>
            </view>
            <view class="ai-assistant__consent-link" role="button" tabindex="0" @tap="openPrivacyPolicy" @keydown.enter="openPrivacyPolicy">查看隐私政策</view>
            <view class="ai-assistant__consent-button" hover-class="ai-assistant__consent-button--pressed" role="button" tabindex="0" @tap="acceptConsent" @keydown.enter="acceptConsent">
              <view class="ai-assistant__consent-check" aria-hidden="true" />
              <text>同意并进入 AI 助手</text>
            </view>
            <text class="ai-assistant__consent-note">同意记录只保存在当前设备、当前企业连接和当前账号下，可随时在顶部隐私设置中撤回。</text>
          </view>
        </scroll-view>

        <view v-else class="ai-assistant__workspace">
        <view class="ai-assistant__generation-notice" role="note">
          <text class="ai-assistant__generation-badge">AI</text>
          <text>内容由人工智能生成，请注意甄别</text>
        </view>
        <view v-if="showAiModel" class="ai-assistant__toolbar">
          <picker
            v-if="relayOptions.length"
            class="ai-assistant__picker ai-assistant__picker--runtime"
            :range="relayOptions"
            range-key="label"
            :value="relayIndex"
            @change="changeRelayModel"
          >
            <view class="ai-assistant__model">
              <text class="ai-assistant__model-dot"></text>
              <view class="ai-assistant__model-copy">
                <text class="ai-assistant__model-label">运行模型</text>
                <text class="ai-assistant__model-name">{{ selectedRuntimeName }}</text>
              </view>
              <view class="ai-assistant__model-arrow" aria-hidden="true" />
            </view>
          </picker>
          <picker
            class="ai-assistant__picker"
            :range="modelOptions"
            range-key="label"
            :value="modelIndex"
            @change="changeModel"
          >
            <view class="ai-assistant__model">
              <view class="ai-assistant__model-copy">
                <text class="ai-assistant__model-label">模型通道</text>
                <text class="ai-assistant__model-name">{{ selectedModelName }}</text>
              </view>
              <view class="ai-assistant__model-arrow" aria-hidden="true" />
            </view>
          </picker>
          <picker
            v-if="supportsReasoning"
            class="ai-assistant__reasoning-picker"
            :range="reasoningOptions"
            range-key="label"
            :value="reasoningIndex"
            @change="changeReasoning"
          >
            <view class="ai-assistant__reasoning"><text>{{ reasoningLabel }}</text><view class="ai-assistant__model-arrow" aria-hidden="true" /></view>
          </picker>
        </view>

        <view v-if="conversationId" class="ai-assistant__conversation-bar">
          <view class="ai-assistant__conversation-title">
            <text class="ai-assistant__conversation-kicker">当前对话</text>
            <text class="ai-assistant__conversation-name">{{ conversationTitle }}</text>
          </view>
          <view class="ai-assistant__conversation-action" role="button" tabindex="0" @tap="requestRenameCurrent" @keyup.enter="requestRenameCurrent" @keyup.space.prevent="requestRenameCurrent">改名</view>
        </view>

        <scroll-view class="ai-assistant__messages" scroll-y :scroll-top="scrollTop" :scroll-with-animation="true">
          <view class="ai-assistant__welcome">
            <view class="ai-assistant__welcome-status">
              <text class="ai-assistant__welcome-pulse"></text>
              <text>安全分析通道已连接</text>
            </view>
            <text class="ai-assistant__welcome-title">你好，我已准备好分析你的业务数据</text>
            <text class="ai-assistant__welcome-copy">查询范围由当前租户、角色和数据权限共同决定。</text>
          </view>

          <view v-if="!messages.length" class="ai-assistant__prompts">
            <view v-for="prompt in prompts" :key="prompt" class="ai-assistant__prompt" hover-class="ai-assistant__prompt--pressed" role="button" tabindex="0" @tap="usePrompt(prompt)" @keydown.enter="usePrompt(prompt)">
              <text>{{ prompt }}</text>
              <view class="ai-assistant__prompt-arrow" aria-hidden="true" />
            </view>
          </view>

          <view
            v-for="(message, index) in messages"
            :key="message.id"
            class="ai-assistant__message"
            :class="'ai-assistant__message--' + message.role"
          >
            <view class="ai-assistant__bubble">
              <view v-if="message.loading" class="ai-assistant__thinking-live">
                <view class="ai-assistant__thinking-mark"><text></text><text></text><text></text></view>
                <text>正在思考</text>
              </view>
              <text v-else class="ai-assistant__message-text" user-select>{{ readableText(message.text) }}</text>

              <view v-if="message.thinking && message.thinking.length" class="ai-assistant__thinking">
                <view class="ai-assistant__thinking-head" role="button" tabindex="0" @tap="toggleThinking(index)" @keyup.enter="toggleThinking(index)" @keyup.space.prevent="toggleThinking(index)">
                  <text>{{ message.thinkingOpen ? '收起思考过程' : '查看思考过程' }}</text>
                  <view class="ai-assistant__thinking-arrow" :class="{ 'ai-assistant__thinking-arrow--open': message.thinkingOpen }" aria-hidden="true" />
                </view>
                <view v-if="message.thinkingOpen" class="ai-assistant__thinking-steps">
                  <view
                    v-for="(step, stepIndex) in message.thinking"
                    :key="message.id + '-' + stepIndex"
                    class="ai-assistant__thinking-step"
                  >
                    <text class="ai-assistant__thinking-index">{{ stepIndex + 1 }}</text>
                    <text>{{ step }}</text>
                  </view>
                </view>
              </view>

              <view v-if="!message.loading && message.text" class="ai-assistant__message-actions">
                <text role="button" tabindex="0" @tap="copyMessage(message.text)" @keyup.enter="copyMessage(message.text)" @keyup.space.prevent="copyMessage(message.text)">复制</text>
                <text v-if="message.role === 'assistant'" role="button" tabindex="0" @tap="reportMessage(message)" @keyup.enter="reportMessage(message)" @keyup.space.prevent="reportMessage(message)">{{ message.feedbackSubmitted ? '已反馈' : '内容反馈' }}</text>
              </view>
            </view>
          </view>
          <view class="ai-assistant__messages-spacer"></view>
        </scroll-view>

        <view class="ai-assistant__composer">
          <textarea
            v-model="question"
            class="ai-assistant__input"
            :maxlength="500"
            :disabled="sending"
            :auto-height="true"
            placeholder="询问业务数据、待办、流程或应用使用"
            confirm-type="send"
            @confirm="sendQuestion"
          />
          <view class="ai-assistant__send" :class="{ 'ai-assistant__send--disabled': !canSend }" hover-class="ai-assistant__send--pressed" role="button" tabindex="0" aria-label="发送问题" @tap="sendQuestion" @keydown.enter="sendQuestion">
            <view class="ai-assistant__send-icon" aria-hidden="true" />
          </view>
        </view>

        <view v-if="historyVisible" class="ai-assistant__drawer-mask" @tap="closeHistory">
          <view class="ai-assistant__drawer" :style="drawerStyle" @tap.stop>
            <view class="ai-assistant__drawer-head">
              <view>
                <text class="ai-assistant__drawer-title">对话记录</text>
                <text class="ai-assistant__drawer-subtitle">仅显示当前账号的会话</text>
              </view>
              <view class="ai-assistant__drawer-close" role="button" tabindex="0" aria-label="关闭记录" @tap="closeHistory" @keyup.enter="closeHistory" @keyup.space.prevent="closeHistory"><view aria-hidden="true" /></view>
            </view>
            <view class="ai-assistant__drawer-create" hover-class="ai-assistant__drawer-create--pressed" role="button" tabindex="0" @tap="newConversation" @keyup.enter="newConversation" @keyup.space.prevent="newConversation">
              <view class="ai-assistant__drawer-create-icon" aria-hidden="true" />
              <text>新建AI对话</text>
            </view>
            <view class="ai-assistant__history-tabs">
              <view :class="{ 'ai-assistant__history-tab--active': historyTab === 'current' }" class="ai-assistant__history-tab" role="tab" tabindex="0" :aria-selected="historyTab === 'current'" @tap="historyTab = 'current'" @keyup.enter="historyTab = 'current'" @keyup.space.prevent="historyTab = 'current'">AI对话</view>
              <view :class="{ 'ai-assistant__history-tab--active': historyTab === 'archived' }" class="ai-assistant__history-tab" role="tab" tabindex="0" :aria-selected="historyTab === 'archived'" @tap="historyTab = 'archived'" @keyup.enter="historyTab = 'archived'" @keyup.space.prevent="historyTab = 'archived'">已归档</view>
            </view>
            <view class="ai-assistant__history-search">
              <view class="ai-assistant__history-search-icon" aria-hidden="true" />
              <input v-model="historyQuery" placeholder="搜索对话标题" confirm-type="search" />
            </view>
            <scroll-view class="ai-assistant__history-list" scroll-y>
              <view v-if="loadingHistory" class="ai-assistant__history-loading">
                <view class="ai-assistant__thinking-mark"><text></text><text></text><text></text></view>
                <text>正在读取对话记录</text>
              </view>
              <view v-else-if="!filteredConversations.length" class="ai-assistant__history-empty">
                <text>{{ historyTab === 'archived' ? '暂无已归档对话' : '暂无对话记录' }}</text>
              </view>
              <view
                v-for="item in filteredConversations"
                :key="item.Id"
                class="ai-assistant__history-item"
                :class="{ 'ai-assistant__history-item--active': item.Id === conversationId }"
                role="button"
                tabindex="0"
                @tap="selectConversation(item)"
                @keyup.enter="selectConversation(item)"
                @keyup.space.prevent="selectConversation(item)"
              >
                <view class="ai-assistant__history-copy">
                  <text class="ai-assistant__history-title">{{ item.Title || '新对话' }}</text>
                  <text class="ai-assistant__history-meta">{{ formatHistoryMeta(item) }}</text>
                </view>
                <view class="ai-assistant__history-actions">
                  <text role="button" tabindex="0" title="修改标题" @tap.stop="requestRename(item)" @keyup.enter.stop="requestRename(item)">改名</text>
                  <text v-if="item.Archived" role="button" tabindex="0" title="还原对话" @tap.stop="toggleArchive(item, false)" @keyup.enter.stop="toggleArchive(item, false)">还原</text>
                  <text v-else role="button" tabindex="0" title="归档对话" @tap.stop="toggleArchive(item, true)" @keyup.enter.stop="toggleArchive(item, true)">归档</text>
                </view>
              </view>
            </scroll-view>
          </view>
        </view>

        <view v-if="renameVisible" class="ai-assistant__dialog-mask" @tap="cancelRename">
          <view class="ai-assistant__dialog" @tap.stop>
            <text class="ai-assistant__dialog-title">修改对话标题</text>
            <input v-model="renameTitle" class="ai-assistant__dialog-input" :maxlength="60" focus placeholder="请输入对话标题" />
            <view class="ai-assistant__dialog-actions">
              <view class="ai-assistant__dialog-button" role="button" tabindex="0" @tap="cancelRename" @keyup.enter="cancelRename">取消</view>
              <view class="ai-assistant__dialog-button ai-assistant__dialog-button--primary" role="button" tabindex="0" @tap="confirmRename" @keyup.enter="confirmRename">保存</view>
            </view>
          </view>
        </view>
        <view v-if="privacyVisible" class="ai-assistant__dialog-mask" @tap="privacyVisible = false">
          <view class="ai-assistant__dialog ai-assistant__privacy-dialog" @tap.stop>
            <view class="ai-assistant__privacy-dialog-head">
              <view class="ai-assistant__consent-shield ai-assistant__consent-shield--small" aria-hidden="true"><view /></view>
              <text class="ai-assistant__dialog-title">AI 数据与隐私</text>
            </view>
            <text class="ai-assistant__privacy-dialog-copy">已允许当前账号向平台配置的 AI 模型发送问题及回答所需的授权业务数据。撤回后将立即阻止新的 AI 提问，但不会自动删除服务端已有对话记录。</text>
            <view class="ai-assistant__privacy-dialog-link" role="link" tabindex="0" @tap="openPrivacyPolicy" @keyup.enter="openPrivacyPolicy">查看完整隐私政策</view>
            <view class="ai-assistant__dialog-actions">
              <view class="ai-assistant__dialog-button" role="button" tabindex="0" @tap="privacyVisible = false" @keyup.enter="privacyVisible = false">关闭</view>
              <view class="ai-assistant__dialog-button ai-assistant__dialog-button--danger" role="button" tabindex="0" @tap="confirmRevokeConsent" @keyup.enter="confirmRevokeConsent">撤回同意</view>
            </view>
          </view>
        </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
import { getToken, getUser } from '@/utils/request.js'
import { getAiModelEnabled } from '@/utils/sysconfig.js'
import { themeMixin } from '@/utils/theme.js'
import appConfig from '@/config.js'
import { grantAiConsent, readAiConsent, revokeAiConsent } from '@/platform/ai-consent.mjs'
import {
  formatAiModelName,
  formatRelayModelName,
  isRelayStation,
  loadAiBootstrap,
  loadAiConversation,
  loadAiHistory,
  makeAiId,
  modelSupportsReasoning,
  renameAiConversation,
  sendAiQuestion,
  setAiConversationArchived,
  submitAiContentFeedback
} from '@/pages/ai/utils/mci-ai.js'

const SELECTION_KEY = 'mci_ai_model_selection'
const LEGACY_SELECTION_KEY = ''

const REASONING_OPTIONS = [
  { value: 'auto', label: '自动推理' },
  { value: 'low', label: '简洁推理' },
  { value: 'medium', label: '标准推理' },
  { value: 'high', label: '深度推理' }
]

export default {
  name: 'MciAiAssistant',
  mixins: [themeMixin],
  emits: ['close'],
  data() {
    return {
      appConfig,
      ready: false,
      enabled: false,
      showAiModel: false,
      isAuthenticated: false,
      scopeLabel: '',
      roleText: '',
      models: [],
      relayModels: [],
      modelIndex: 0,
      relayIndex: 0,
      reasoningOptions: REASONING_OPTIONS,
      reasoningIndex: 0,
      prompts: [],
      question: '',
      messages: [],
      sending: false,
      scrollTop: 0,
      conversationId: '',
      conversationTitle: '新对话',
      conversations: [],
      historyVisible: false,
      historyTab: 'current',
      historyQuery: '',
      loadingHistory: false,
      historyLoaded: false,
      renameVisible: false,
      renameTarget: null,
      renameTitle: '',
      consentGranted: false,
      privacyVisible: false,
      feedbackRunning: false,
      typeTimer: null,
      progressTimer: null,
      loadedUserId: ''
    }
  },
  computed: {
    selectedModel() {
      return this.models[this.modelIndex] || null
    },
    selectedRelay() {
      return this.relayModels[this.relayIndex] || null
    },
    modelOptions() {
      return this.models.map((item) => ({ label: formatAiModelName(item) }))
    },
    relayOptions() {
      if (!isRelayStation(this.selectedModel)) return []
      return this.relayModels.map((item) => ({ label: formatRelayModelName(item) }))
    },
    selectedModelName() {
      return formatAiModelName(this.selectedModel)
    },
    selectedRuntimeName() {
      if (isRelayStation(this.selectedModel)) return formatRelayModelName(this.selectedRelay)
      return String((this.selectedModel && this.selectedModel.AiModel) || '跟随模型通道')
    },
    supportsReasoning() {
      const runtime = this.selectedRelay && this.selectedRelay.Id
      return modelSupportsReasoning(this.selectedModel, runtime || '')
    },
    reasoningLabel() {
      const item = this.reasoningOptions[this.reasoningIndex]
      return item ? item.label : '自动推理'
    },
    canSend() {
      const relayReady = !isRelayStation(this.selectedModel) || !!this.selectedRelay
      return this.consentGranted && !this.sending && !!this.question.trim() && !!this.selectedModel && relayReady
    },
    headerScopeText() {
      if (!this.isAuthenticated) return '登录后启用 · 匿名状态不读取数据'
      if (!this.ready) return '正在校验账号与数据权限'
      if (!this.enabled) return '当前角色未授权'
      if (!this.consentGranted) return '等待确认 AI 数据说明'
      return `${this.scopeLabel || '当前角色'} · 数据权限已校验`
    },
    aiHeaderStyle() {
      const safe = this._safeAreaMetrics || {}
      const statusBottom = Number(safe.statusBarHeight || 0) + 8
      const capsuleBottom = Number(safe.capsuleTop || 0) + Number(safe.capsuleHeight || 0) + 8
      return { paddingTop: `${Math.max(statusBottom, capsuleBottom)}px` }
    },
    drawerStyle() {
      const safe = this._safeAreaMetrics || {}
      const statusBottom = Number(safe.statusBarHeight || 0) + 10
      const capsuleBottom = Number(safe.capsuleTop || 0) + Number(safe.capsuleHeight || 0) + 10
      return { paddingTop: `${Math.max(statusBottom, capsuleBottom)}px` }
    },
    filteredConversations() {
      const archived = this.historyTab === 'archived'
      const keyword = String(this.historyQuery || '').trim().toLowerCase()
      return this.conversations.filter((item) => {
        const matchesState = Boolean(item.Archived) === archived
        const matchesKeyword = !keyword || String(item.Title || '').toLowerCase().includes(keyword)
        return matchesState && matchesKeyword
      })
    }
  },
  mounted() {
    if (uni.$on) uni.$on('mci:auth-changed', this.handleAuthChanged)
    this.resolveModelVisibility()
    this.loadBootstrap()
  },
  beforeUnmount() {
    this.clearTimers()
    if (uni.$off) uni.$off('mci:auth-changed', this.handleAuthChanged)
  },
  methods: {
    async resolveModelVisibility() {
      this.showAiModel = await getAiModelEnabled({ refresh: true })
    },
    restoreSelections() {
      let saved = {}
      try {
        saved = uni.getStorageSync(SELECTION_KEY) || uni.getStorageSync(LEGACY_SELECTION_KEY) || {}
      } catch (error) {}
      const modelIndex = this.models.findIndex((item) => String(item.Id) === String(saved.modelId || ''))
      const relayIndex = this.relayModels.findIndex((item) => String(item.Id) === String(saved.relayModel || ''))
      const reasoningIndex = this.reasoningOptions.findIndex((item) => item.value === saved.reasoningEffort)
      this.modelIndex = modelIndex >= 0 ? modelIndex : 0
      this.relayIndex = relayIndex >= 0 ? relayIndex : 0
      this.reasoningIndex = reasoningIndex >= 0 ? reasoningIndex : 0
    },
    saveSelections() {
      try {
        uni.setStorageSync(SELECTION_KEY, {
          modelId: this.selectedModel && this.selectedModel.Id,
          relayModel: this.selectedRelay && this.selectedRelay.Id,
          reasoningEffort: this.reasoningOptions[this.reasoningIndex].value
        })
      } catch (error) {}
    },
    async loadBootstrap(force = false) {
      const user = getUser() || {}
      const userId = String(user.Id || '')
      this.loadedUserId = userId
      this.isAuthenticated = !!getToken() && !!userId
      if (!this.isAuthenticated) {
        this.enabled = false
        this.ready = true
        return
      }
      try {
        const data = await loadAiBootstrap(userId, force)
        this.enabled = data.Enabled === true || Number(data.Enabled) === 1
        this.scopeLabel = data.ScopeLabel || '当前角色'
        this.roleText = data.RoleText || '已授权用户'
        this.models = Array.isArray(data.Models) ? data.Models : []
        this.relayModels = Array.isArray(data.RelayModels) ? data.RelayModels : []
        this.prompts = Array.isArray(data.Prompts) ? data.Prompts : []
        this.restoreSelections()
        this.consentGranted = Boolean(readAiConsent(appConfig.apiBase, appConfig.osClient, userId))
        if (!this.models.length) this.enabled = false
      } catch (error) {
        this.enabled = false
      } finally {
        this.ready = true
      }
    },
    handleAuthChanged() {
      this.enabled = false
      this.ready = false
      this.isAuthenticated = false
      this.messages = []
      this.conversationId = ''
      this.conversations = []
      this.historyLoaded = false
      this.question = ''
      this.consentGranted = false
      this.privacyVisible = false
      this.loadBootstrap(true)
    },
    closePanel() {
      if (this.renameVisible) {
        this.cancelRename()
        return
      }
      if (this.privacyVisible) {
        this.privacyVisible = false
        return
      }
      if (this.historyVisible) {
        this.closeHistory()
        return
      }
      this.historyVisible = false
      this.renameVisible = false
      this.$emit('close')
    },
    handleBack() {
      if (this.renameVisible) {
        this.cancelRename()
        return true
      }
      if (this.privacyVisible) {
        this.privacyVisible = false
        return true
      }
      if (this.historyVisible) {
        this.closeHistory()
        return true
      }
      return false
    },
    goLogin() {
      uni.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent('/pages/ai/index')}` })
    },
    openPrivacyPolicy() {
      uni.navigateTo({ url: '/pages/privacy/index' })
    },
    acceptConsent() {
      const userId = String((getUser() || {}).Id || '')
      if (!grantAiConsent(appConfig.apiBase, appConfig.osClient, userId)) {
        uni.showToast({ title: '无法保存同意状态，请检查设备存储权限', icon: 'none' })
        return
      }
      this.consentGranted = true
    },
    confirmRevokeConsent() {
      uni.showModal({
        title: '撤回 AI 数据同意',
        content: '撤回后不能继续发送新问题；已有服务端对话不会自动删除。',
        confirmText: '确认撤回',
        confirmColor: '#c9432b',
        success: (result) => {
          if (!result.confirm) return
          const userId = String((getUser() || {}).Id || '')
          revokeAiConsent(appConfig.apiBase, appConfig.osClient, userId)
          this.clearTimers()
          this.consentGranted = false
          this.privacyVisible = false
          this.question = ''
          this.messages = []
          this.conversationId = ''
          this.conversationTitle = '新对话'
          uni.showToast({ title: '已撤回 AI 数据同意', icon: 'none' })
        }
      })
    },
    changeModel(event) {
      const next = Number(event.detail && event.detail.value)
      if (!Number.isFinite(next) || !this.models[next]) return
      this.modelIndex = next
      this.relayIndex = 0
      if (!this.supportsReasoning) this.reasoningIndex = 0
      this.saveSelections()
    },
    changeRelayModel(event) {
      const next = Number(event.detail && event.detail.value)
      if (!Number.isFinite(next) || !this.relayModels[next]) return
      this.relayIndex = next
      if (!this.supportsReasoning) this.reasoningIndex = 0
      this.saveSelections()
    },
    changeReasoning(event) {
      const next = Number(event.detail && event.detail.value)
      if (Number.isFinite(next) && this.reasoningOptions[next]) {
        this.reasoningIndex = next
        this.saveSelections()
      }
    },
    usePrompt(prompt) {
      if (this.sending) return
      this.question = prompt
      this.sendQuestion()
    },
    toggleThinking(index) {
      const message = this.messages[index]
      if (message) message.thinkingOpen = !message.thinkingOpen
    },
    readableText(value) {
      return String(value || '')
        .replace(/^#{1,6}\s+/gm, '')
        .replace(/\*\*/g, '')
        .replace(/\x60/g, '')
    },
    copyMessage(value) {
      uni.setClipboardData({
        data: String(value || ''),
        success: () => uni.showToast({ title: '已复制', icon: 'success' })
      })
    },
    reportMessage(message) {
      if (this.feedbackRunning || !message || message.role !== 'assistant' || message.feedbackSubmitted) return
      const reasons = ['结果不准确', '内容不适当', '泄露敏感信息', '其他问题']
      uni.showActionSheet({
        itemList: reasons,
        success: async (result) => {
          const reason = reasons[Number(result.tapIndex)]
          if (!reason) return
          this.feedbackRunning = true
          try {
            await submitAiContentFeedback({
              ConversationId: this.conversationId,
              MessageId: message.id,
              Reason: reason
            })
            message.feedbackSubmitted = true
            uni.showToast({ title: '反馈已提交', icon: 'success' })
          } catch (error) {
            uni.showToast({ title: error.message || '反馈提交失败，请稍后重试', icon: 'none' })
          } finally {
            this.feedbackRunning = false
          }
        }
      })
    },
    clearTimers() {
      if (this.typeTimer) clearInterval(this.typeTimer)
      if (this.progressTimer) clearInterval(this.progressTimer)
      this.typeTimer = null
      this.progressTimer = null
    },
    bumpScroll() {
      this.$nextTick(() => {
        this.scrollTop += 100000
      })
    },
    beginProgress(message) {
      const steps = ['正在验证角色与数据权限', '正在应用租户和业务范围', '正在汇总授权业务数据', '正在等待所选模型生成结论']
      let cursor = 0
      message.thinking = [steps[cursor]]
      this.progressTimer = setInterval(() => {
        cursor += 1
        if (cursor < steps.length && message.loading) {
          message.thinking.push(steps[cursor])
          this.bumpScroll()
        } else {
          clearInterval(this.progressTimer)
          this.progressTimer = null
        }
      }, 1100)
    },
    startTypewriter(message, fullText) {
      const content = String(fullText || '')
      let cursor = 0
      message.text = ''
      this.typeTimer = setInterval(() => {
        cursor = Math.min(content.length, cursor + 3)
        message.text = content.slice(0, cursor)
        if (cursor % 30 === 0) this.bumpScroll()
        if (cursor >= content.length) {
          clearInterval(this.typeTimer)
          this.typeTimer = null
          this.bumpScroll()
        }
      }, 18)
    },
    openHistory() {
      this.historyVisible = true
      this.refreshHistory(true)
    },
    closeHistory() {
      this.historyVisible = false
    },
    async refreshHistory(force = false) {
      if (this.loadingHistory || (this.historyLoaded && !force)) return
      this.loadingHistory = true
      try {
        const data = await loadAiHistory()
        this.conversations = Array.isArray(data.Conversations) ? data.Conversations : []
        this.historyLoaded = true
      } catch (error) {
        if (force) uni.showToast({ title: error.message || '记录加载失败', icon: 'none' })
      } finally {
        this.loadingHistory = false
      }
    },
    async selectConversation(item) {
      if (!item || !item.Id) return
      this.loadingHistory = true
      try {
        const data = await loadAiConversation(item.Id)
        const rows = Array.isArray(data.Messages) ? data.Messages : []
        this.messages = rows.map((row) => ({
          id: row.Id || makeAiId('history'),
          role: row.Role === 'assistant' ? 'assistant' : 'user',
          text: row.Content || '',
          loading: false,
          thinking: Array.isArray(row.Thinking) ? row.Thinking : [],
          thinkingOpen: false
        }))
        this.conversationId = String(item.Id)
        this.conversationTitle = item.Title || '新对话'
        this.historyVisible = false
        this.bumpScroll()
      } catch (error) {
        uni.showToast({ title: error.message || '对话加载失败', icon: 'none' })
      } finally {
        this.loadingHistory = false
      }
    },
    newConversation() {
      this.clearTimers()
      this.messages = []
      this.question = ''
      this.conversationId = ''
      this.conversationTitle = '新对话'
      this.historyVisible = false
      this.renameVisible = false
      this.bumpScroll()
    },
    requestRename(item) {
      this.renameTarget = item
      this.renameTitle = String((item && item.Title) || '')
      this.renameVisible = true
    },
    requestRenameCurrent() {
      if (!this.conversationId) return
      this.requestRename({ Id: this.conversationId, Title: this.conversationTitle })
    },
    cancelRename() {
      this.renameVisible = false
      this.renameTarget = null
      this.renameTitle = ''
    },
    async confirmRename() {
      const target = this.renameTarget
      const title = String(this.renameTitle || '').trim()
      if (!target || !target.Id || !title) {
        uni.showToast({ title: '请输入对话标题', icon: 'none' })
        return
      }
      try {
        await renameAiConversation(target.Id, title)
        this.conversations.forEach((item) => {
          if (item.Id === target.Id) item.Title = title
        })
        if (this.conversationId === target.Id) this.conversationTitle = title
        this.cancelRename()
        uni.showToast({ title: '标题已更新', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '标题更新失败', icon: 'none' })
      }
    },
    async toggleArchive(item, archived) {
      if (!item || !item.Id) return
      try {
        await setAiConversationArchived(item.Id, archived)
        item.Archived = archived
        if (archived && item.Id === this.conversationId) this.newConversation()
        uni.showToast({ title: archived ? '已归档' : '已还原', icon: 'success' })
      } catch (error) {
        uni.showToast({ title: error.message || '操作失败', icon: 'none' })
      }
    },
    formatHistoryMeta(item) {
      const count = Number(item.MessageCount || 0)
      const time = String(item.LastTime || '').replace('T', ' ').slice(0, 16)
      return (time || '刚刚') + ' · ' + count + ' 条消息'
    },
    async sendQuestion() {
      if (!this.canSend) return
      const content = this.question.trim()
      this.question = ''
      this.sending = true
      const userMessage = { id: makeAiId('user'), role: 'user', text: content, loading: false, thinking: [] }
      const answerMessage = { id: makeAiId('assistant'), role: 'assistant', text: '', loading: true, thinking: [], thinkingOpen: true }
      this.messages.push(userMessage, answerMessage)
      this.bumpScroll()
      this.beginProgress(answerMessage)
      try {
        const effort = this.supportsReasoning ? this.reasoningOptions[this.reasoningIndex].value : 'auto'
        const data = await sendAiQuestion({
          Question: content,
          AiModelId: this.selectedModel.Id,
          RelayModel: isRelayStation(this.selectedModel) && this.selectedRelay ? this.selectedRelay.Id : '',
          ReasoningEffort: effort,
          ConversationId: this.conversationId,
          RequestId: makeAiId('request'),
          Title: this.conversationId ? this.conversationTitle : content
        })
        answerMessage.loading = false
        answerMessage.thinking = Array.isArray(data.Thinking) ? data.Thinking : answerMessage.thinking
        answerMessage.thinkingOpen = false
        this.conversationId = String(data.ConversationId || this.conversationId)
        this.conversationTitle = data.Title || this.conversationTitle || content.slice(0, 28)
        this.clearTimers()
        this.startTypewriter(answerMessage, data.Answer || '暂未获得分析结果')
        this.historyLoaded = false
        this.refreshHistory()
      } catch (error) {
        answerMessage.loading = false
        answerMessage.thinkingOpen = false
        answerMessage.text = error.message || '分析服务暂时不可用，请稍后重试'
        this.clearTimers()
      } finally {
        this.sending = false
        this.bumpScroll()
      }
    }
  }
}
</script>

<style scoped>
.ai-assistant { position: fixed; inset: 0; z-index: 1000; }
.ai-assistant__overlay { position: fixed; inset: 0; z-index: 1000; background: #f3f7f9; animation: aiFade .18s ease-out both; }
.ai-assistant__panel { width: 100%; height: 100%; min-height: 100vh; overflow: hidden; display: flex; flex-direction: column; background: #f3f7f9; animation: aiEnter .24s cubic-bezier(.2, .75, .25, 1) both; }
.ai-assistant__header { position: relative; flex: none; min-height: 164rpx; padding: 12rpx max(20rpx, var(--mci-safe-right, 0px)) 18rpx max(22rpx, var(--mci-safe-left, 0px)); box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; overflow: hidden; background: #063f59; color: #fff; }
.ai-assistant__grid { position: absolute; inset: 0; opacity: .17; background-image: linear-gradient(rgba(96, 219, 229, .24) 1rpx, transparent 1rpx), linear-gradient(90deg, rgba(96, 219, 229, .16) 1rpx, transparent 1rpx); background-size: 44rpx 44rpx; }
.ai-assistant__scan { position: absolute; top: 0; bottom: 0; left: -20%; width: 16%; opacity: 0; background: linear-gradient(90deg, transparent, rgba(125, 241, 236, .18), transparent); transform: skewX(-12deg); animation: aiScan 5.4s ease-in-out infinite; }
.ai-assistant__identity { position: relative; z-index: 1; min-width: 0; display: flex; align-items: center; gap: 16rpx; }
.ai-assistant__avatar-wrap { position: relative; flex: none; width: 74rpx; height: 74rpx; overflow: visible; border-radius: 18rpx; background: #fff; box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, .2); }
.ai-assistant__avatar { width: 74rpx; height: 74rpx; }
.ai-assistant__online { position: absolute; right: -3rpx; bottom: -3rpx; width: 16rpx; height: 16rpx; border: 4rpx solid #063f59; border-radius: 50%; background: #20cf8c; animation: aiOnline 2.2s ease-in-out infinite; }
.ai-assistant__heading { min-width: 0; display: flex; flex-direction: column; }
.ai-assistant__title { font-size: 31rpx; line-height: 42rpx; font-weight: 700; white-space: nowrap; }
.ai-assistant__scope { max-width: 420rpx; margin-top: 2rpx; overflow: hidden; color: rgba(255, 255, 255, .7); font-size: 20rpx; white-space: nowrap; text-overflow: ellipsis; }
.ai-assistant__header-actions { position: relative; z-index: 1; flex: none; display: flex; gap: 9rpx; }
.ai-assistant__icon-button { width: 58rpx; height: 58rpx; border: 1rpx solid rgba(255, 255, 255, .17); border-radius: 50%; background: rgba(255, 255, 255, .09); display: flex; align-items: center; justify-content: center; }
.ai-assistant__icon-button--pressed { transform: scale(.94); background: rgba(255, 255, 255, .18); }
.ai-assistant__history-icon { font-size: 35rpx; line-height: 1; }
.ai-assistant__plus-icon { font-size: 34rpx; line-height: 1; }
.ai-assistant__close-icon { font-size: 41rpx; line-height: 1; }
.ai-assistant__privacy-icon { position: relative; width: 25rpx; height: 29rpx; border: 3rpx solid currentColor; border-radius: 11rpx 11rpx 13rpx 13rpx; box-sizing: border-box; }
.ai-assistant__privacy-icon view { width: 8rpx; height: 5rpx; margin: 7rpx auto 0; border-left: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; transform: rotate(-45deg); }
.ai-assistant__workspace { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.ai-assistant__generation-notice { flex: none; min-height: 54rpx; padding: 8rpx 20rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 10rpx; border-bottom: 1rpx solid #d7e7ea; background: #e9f6f8; color: #315f69; font-size: 21rpx; font-weight: 600; }
.ai-assistant__generation-badge { min-width: 38rpx; height: 30rpx; padding: 0 6rpx; border-radius: 6rpx; background: #087f98; color: #fff; font-size: 18rpx; line-height: 30rpx; text-align: center; }
.ai-assistant__auth-state { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; padding-bottom: max(28rpx, var(--mci-safe-bottom, 0px)); box-sizing: border-box; }
.ai-assistant__consent-scroll { flex: 1; min-height: 0; }
.ai-assistant__consent { min-height: 100%; padding: 54rpx 38rpx calc(46rpx + var(--mci-safe-bottom, 0px)); display: flex; flex-direction: column; align-items: center; box-sizing: border-box; }
.ai-assistant__consent-shield { width: 86rpx; height: 96rpx; border: 6rpx solid #087da8; border-radius: 32rpx 32rpx 38rpx 38rpx; box-sizing: border-box; background: rgba(8,125,168,.06); }
.ai-assistant__consent-shield view { width: 27rpx; height: 15rpx; margin: 29rpx auto 0; border-left: 7rpx solid #087da8; border-bottom: 7rpx solid #087da8; transform: rotate(-45deg); }
.ai-assistant__consent-title { margin-top: 31rpx; color: #17313b; font-size: 34rpx; line-height: 46rpx; font-weight: 750; text-align: center; }
.ai-assistant__consent-copy { margin-top: 18rpx; color: #526c76; font-size: 24rpx; line-height: 39rpx; text-align: left; }
.ai-assistant__consent-list { width: 100%; margin-top: 26rpx; padding: 23rpx 22rpx; border: 1rpx solid #dae7ea; border-radius: 10rpx; background: #fff; box-sizing: border-box; }
.ai-assistant__consent-list > view { display: grid; grid-template-columns: 16rpx minmax(0, 1fr); gap: 13rpx; color: #42616d; font-size: 22rpx; line-height: 34rpx; }
.ai-assistant__consent-list > view + view { margin-top: 15rpx; }
.ai-assistant__consent-dot { width: 12rpx; height: 12rpx; margin-top: 10rpx; border-radius: 50%; background: #18a6b8; }
.ai-assistant__consent-link { align-self: flex-start; min-height: 64rpx; margin-top: 13rpx; display: flex; align-items: center; color: #087da8; font-size: 22rpx; text-decoration: underline; }
.ai-assistant__consent-button { width: 100%; height: 84rpx; margin-top: 12rpx; display: flex; align-items: center; justify-content: center; gap: 14rpx; border-radius: 10rpx; color: #fff; background: #087da8; box-shadow: 0 10rpx 24rpx rgba(8,125,168,.2); font-size: 27rpx; font-weight: 700; }
.ai-assistant__consent-button--pressed { opacity: .72; transform: scale(.985); }
.ai-assistant__consent-check { width: 24rpx; height: 13rpx; border-left: 4rpx solid currentColor; border-bottom: 4rpx solid currentColor; transform: rotate(-45deg) translateY(-2rpx); }
.ai-assistant__consent-note { margin-top: 18rpx; color: #7e9097; font-size: 19rpx; line-height: 30rpx; text-align: center; }
.ai-assistant__loading-state { flex: 1; min-height: 0; padding: 28rpx 24rpx; box-sizing: border-box; overflow: hidden; }
.ai-assistant__loading-card { height: 142rpx; margin-bottom: 20rpx; padding: 28rpx; box-sizing: border-box; border: 1rpx solid #e1ebee; border-radius: 8rpx; background: #fff; }
.ai-assistant__loading-line { height: 28rpx; margin-top: 24rpx; border-radius: 6rpx; background: linear-gradient(90deg, #eaf1f3 25%, #f7fafb 45%, #eaf1f3 65%); background-size: 320% 100%; animation: aiSkeleton 1.45s ease-in-out infinite; }
.ai-assistant__loading-line--short { width: 36%; margin-top: 0; }
.ai-assistant__toolbar { flex: none; min-height: 82rpx; padding: 11rpx 20rpx; box-sizing: border-box; display: flex; align-items: center; gap: 10rpx; overflow-x: auto; background: #fff; border-bottom: 1rpx solid #dfeaec; }
.ai-assistant__picker { min-width: 0; max-width: 44%; }
.ai-assistant__picker--runtime { max-width: 38%; }
.ai-assistant__model { min-height: 56rpx; padding: 5rpx 13rpx; box-sizing: border-box; display: flex; align-items: center; gap: 9rpx; border: 1rpx solid #d5e4e8; border-radius: 7rpx; background: #f6fafb; }
.ai-assistant__model-dot { flex: none; width: 11rpx; height: 11rpx; border-radius: 50%; background: #16a8ba; box-shadow: 0 0 12rpx rgba(22, 168, 186, .56); animation: aiOnline 2.2s ease-in-out infinite; }
.ai-assistant__model-copy { min-width: 0; display: flex; flex-direction: column; }
.ai-assistant__model-label { color: #819299; font-size: 17rpx; line-height: 21rpx; }
.ai-assistant__model-name { overflow: hidden; color: #17313b; font-size: 21rpx; line-height: 27rpx; white-space: nowrap; text-overflow: ellipsis; }
.ai-assistant__model-arrow { flex: none; color: #637b84; font-size: 21rpx; }
.ai-assistant__reasoning-picker { flex: none; }
.ai-assistant__reasoning { height: 52rpx; padding: 0 13rpx; border: 1rpx solid #d5e4e8; border-radius: 7rpx; background: #f6fafb; color: #496873; font-size: 19rpx; line-height: 52rpx; white-space: nowrap; }
.ai-assistant__conversation-bar { flex: none; min-height: 62rpx; padding: 9rpx 24rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 18rpx; background: #ebf5f7; border-bottom: 1rpx solid #dbe9ec; }
.ai-assistant__conversation-title { min-width: 0; display: flex; align-items: baseline; gap: 12rpx; }
.ai-assistant__conversation-kicker { flex: none; color: #77909a; font-size: 18rpx; }
.ai-assistant__conversation-name { overflow: hidden; color: #17313b; font-size: 22rpx; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.ai-assistant__conversation-action { flex: none; color: #087da8; font-size: 20rpx; }
.ai-assistant__messages { flex: 1; min-height: 0; padding: 22rpx 24rpx 0; box-sizing: border-box; }
.ai-assistant__welcome { margin-bottom: 20rpx; padding: 21rpx 23rpx; border-left: 6rpx solid #18a6b8; background: #fff; box-shadow: 0 5rpx 18rpx rgba(12, 69, 90, .06); animation: aiRise .34s ease-out both; }
.ai-assistant__welcome-status { margin-bottom: 8rpx; display: flex; align-items: center; gap: 9rpx; color: #4d7f8d; font-size: 18rpx; }
.ai-assistant__welcome-pulse { width: 10rpx; height: 10rpx; border-radius: 50%; background: #1ecf91; box-shadow: 0 0 0 0 rgba(30, 207, 145, .3); animation: aiStatus 2.4s ease-out infinite; }
.ai-assistant__welcome-title { display: block; color: #17313b; font-size: 27rpx; line-height: 40rpx; font-weight: 650; }
.ai-assistant__welcome-copy { display: block; margin-top: 5rpx; color: #73868d; font-size: 22rpx; line-height: 34rpx; }
.ai-assistant__prompts { display: flex; flex-direction: column; gap: 12rpx; }
.ai-assistant__prompt { min-height: 70rpx; padding: 0 22rpx; display: flex; align-items: center; justify-content: space-between; gap: 16rpx; border: 1rpx solid #dce8ec; border-radius: 7rpx; background: #fff; color: #245363; font-size: 24rpx; box-shadow: 0 4rpx 12rpx rgba(7, 70, 96, .04); animation: aiRise .34s ease-out both; }
.ai-assistant__prompt:nth-child(2) { animation-delay: .05s; }
.ai-assistant__prompt:nth-child(3) { animation-delay: .1s; }
.ai-assistant__prompt--pressed { transform: translateY(2rpx); background: #edf8fa; }
.ai-assistant__prompt-arrow { flex: none; color: #0b88b1; font-size: 34rpx; }
.ai-assistant__message { margin-top: 22rpx; display: flex; animation: aiMessage .22s ease-out both; }
.ai-assistant__message--user { justify-content: flex-end; }
.ai-assistant__message--assistant { justify-content: flex-start; }
.ai-assistant__bubble { max-width: 88%; padding: 18rpx 20rpx; box-sizing: border-box; border-radius: 8rpx; box-shadow: 0 5rpx 18rpx rgba(12, 69, 90, .07); }
.ai-assistant__message--user .ai-assistant__bubble { border-bottom-right-radius: 2rpx; background: #0b86a8; color: #fff; }
.ai-assistant__message--assistant .ai-assistant__bubble { border: 1rpx solid #e3ecef; border-bottom-left-radius: 2rpx; background: #fff; color: #18313d; }
.ai-assistant__message-text { display: block; font-size: 25rpx; line-height: 1.72; white-space: pre-wrap; word-break: break-word; }
.ai-assistant__thinking-live { min-width: 190rpx; display: flex; align-items: center; gap: 16rpx; color: #286477; font-size: 24rpx; }
.ai-assistant__thinking-mark { display: flex; align-items: center; gap: 7rpx; }
.ai-assistant__thinking-mark text { width: 10rpx; height: 10rpx; border-radius: 50%; background: #18a6b8; animation: aiDot 1.2s ease-in-out infinite; }
.ai-assistant__thinking-mark text:nth-child(2) { animation-delay: .16s; }
.ai-assistant__thinking-mark text:nth-child(3) { animation-delay: .32s; }
.ai-assistant__thinking { margin-top: 14rpx; padding-top: 12rpx; border-top: 1rpx solid #e7eef1; }
.ai-assistant__thinking-head { display: flex; align-items: center; justify-content: space-between; color: #488091; font-size: 21rpx; }
.ai-assistant__thinking-arrow { transition: transform .18s ease; }
.ai-assistant__thinking-arrow--open { transform: rotate(180deg); }
.ai-assistant__thinking-steps { margin-top: 12rpx; padding: 14rpx; border-radius: 6rpx; background: #f0f7f9; }
.ai-assistant__thinking-step { display: flex; align-items: flex-start; gap: 12rpx; color: #52717c; font-size: 21rpx; line-height: 32rpx; }
.ai-assistant__thinking-step + .ai-assistant__thinking-step { margin-top: 10rpx; }
.ai-assistant__thinking-index { flex: none; width: 28rpx; height: 28rpx; border-radius: 50%; background: #d9eff3; color: #087da8; font-size: 18rpx; line-height: 28rpx; text-align: center; }
.ai-assistant__message-actions { margin-top: 12rpx; display: flex; justify-content: flex-end; gap: 24rpx; color: #428194; font-size: 21rpx; }
.ai-assistant__message--user .ai-assistant__message-actions { color: rgba(255, 255, 255, .78); }
.ai-assistant__messages-spacer { height: 28rpx; }
.ai-assistant__composer { flex: none; min-height: 104rpx; padding: 14rpx max(20rpx, var(--mci-safe-right, 0px)) max(14rpx, calc(var(--mci-safe-bottom, env(safe-area-inset-bottom, 0px)) + 10rpx)) max(20rpx, var(--mci-safe-left, 0px)); box-sizing: border-box; display: flex; align-items: flex-end; gap: 14rpx; background: #fff; border-top: 1rpx solid #dce8ec; }
.ai-assistant__input { flex: 1; min-height: 72rpx; max-height: 180rpx; padding: 16rpx 20rpx; box-sizing: border-box; border: 1rpx solid #d5e3e8; border-radius: 8rpx; background: #f6fafb; color: #18313d; font-size: 25rpx; line-height: 36rpx; }
.ai-assistant__send { flex: none; width: 72rpx; height: 72rpx; border-radius: 50%; background: #e54625; color: #fff; box-shadow: 0 8rpx 20rpx rgba(229, 70, 37, .24); display: flex; align-items: center; justify-content: center; font-size: 38rpx; font-weight: 700; transition: transform .15s ease, opacity .15s ease; }
.ai-assistant__send--disabled { opacity: .35; box-shadow: none; }
.ai-assistant__send--pressed { transform: scale(.94); }
.ai-assistant__drawer-mask { position: absolute; inset: 0; z-index: 5; background: rgba(4, 28, 39, .42); animation: aiFade .16s ease-out both; }
.ai-assistant__drawer { width: min(650rpx, 88%); height: 100%; padding: calc(var(--mci-status-bar-height, 0px) + 20rpx) 22rpx max(20rpx, var(--mci-safe-bottom, 0px)); box-sizing: border-box; display: flex; flex-direction: column; background: #f7fafb; box-shadow: 18rpx 0 46rpx rgba(4, 40, 57, .18); animation: aiDrawer .24s cubic-bezier(.2, .75, .25, 1) both; }
.ai-assistant__drawer-head { flex: none; display: flex; align-items: center; justify-content: space-between; }
.ai-assistant__drawer-title { display: block; color: #17313b; font-size: 31rpx; line-height: 42rpx; font-weight: 700; }
.ai-assistant__drawer-subtitle { display: block; margin-top: 2rpx; color: #7a8d94; font-size: 19rpx; }
.ai-assistant__drawer-close { width: 56rpx; height: 56rpx; border-radius: 50%; background: #e8f0f2; color: #41616d; font-size: 37rpx; line-height: 52rpx; text-align: center; }
.ai-assistant__drawer-create { flex: none; height: 72rpx; margin-top: 24rpx; border: 1rpx solid #b9dfe6; border-radius: 7rpx; background: #ebf8fa; color: #087da8; display: flex; align-items: center; justify-content: center; gap: 8rpx; font-size: 24rpx; font-weight: 600; }
.ai-assistant__drawer-create--pressed { transform: translateY(2rpx); background: #dff3f6; }
.ai-assistant__drawer-create-icon { font-size: 30rpx; }
.ai-assistant__history-tabs { flex: none; height: 70rpx; margin-top: 20rpx; display: flex; border-bottom: 1rpx solid #dbe7ea; }
.ai-assistant__history-tab { position: relative; flex: 1; color: #70858d; font-size: 23rpx; line-height: 70rpx; text-align: center; }
.ai-assistant__history-tab--active { color: #087da8; font-weight: 650; }
.ai-assistant__history-tab--active::after { content: ""; position: absolute; right: 26%; bottom: 0; left: 26%; height: 5rpx; border-radius: 3rpx; background: #13a5b7; }
.ai-assistant__history-search { flex: none; height: 64rpx; margin-top: 16rpx; padding: 0 16rpx; border: 1rpx solid #d7e5e9; border-radius: 7rpx; background: #fff; display: flex; align-items: center; gap: 10rpx; }
.ai-assistant__history-search-icon { color: #64808b; font-size: 27rpx; }
.ai-assistant__history-search input { flex: 1; min-width: 0; color: #233d47; font-size: 22rpx; }
.ai-assistant__history-list { flex: 1; min-height: 0; margin-top: 12rpx; }
.ai-assistant__history-loading, .ai-assistant__history-empty { min-height: 180rpx; color: #80939a; display: flex; align-items: center; justify-content: center; gap: 15rpx; font-size: 22rpx; }
.ai-assistant__history-item { min-height: 104rpx; padding: 15rpx 8rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 12rpx; border-bottom: 1rpx solid #e2ebee; }
.ai-assistant__history-item--active { background: #e8f6f8; }
.ai-assistant__history-copy { min-width: 0; display: flex; flex-direction: column; }
.ai-assistant__history-title { overflow: hidden; color: #243f49; font-size: 23rpx; line-height: 32rpx; font-weight: 600; white-space: nowrap; text-overflow: ellipsis; }
.ai-assistant__history-meta { margin-top: 5rpx; color: #87979d; font-size: 18rpx; }
.ai-assistant__history-actions { flex: none; display: flex; gap: 16rpx; color: #1382a3; font-size: 20rpx; }
.ai-assistant__dialog-mask { position: absolute; inset: 0; z-index: 8; padding: 24rpx; background: rgba(4, 28, 39, .52); display: flex; align-items: center; justify-content: center; animation: aiFade .16s ease-out both; }
.ai-assistant__dialog { width: 100%; max-width: 620rpx; padding: 28rpx; box-sizing: border-box; border-radius: 8rpx; background: #fff; box-shadow: 0 22rpx 60rpx rgba(0, 34, 49, .2); animation: aiDialog .2s ease-out both; }
.ai-assistant__dialog-title { display: block; color: #17313b; font-size: 28rpx; font-weight: 700; }
.ai-assistant__dialog-input { height: 78rpx; margin-top: 24rpx; padding: 0 18rpx; box-sizing: border-box; border: 1rpx solid #cfdee3; border-radius: 7rpx; background: #f7fafb; color: #18313d; font-size: 24rpx; }
.ai-assistant__dialog-actions { margin-top: 25rpx; display: flex; justify-content: flex-end; gap: 14rpx; }
.ai-assistant__dialog-button { width: 128rpx; height: 66rpx; border: 1rpx solid #d4e0e4; border-radius: 7rpx; color: #526b75; font-size: 23rpx; line-height: 66rpx; text-align: center; }
.ai-assistant__dialog-button--primary { border-color: #0b88a9; background: #0b88a9; color: #fff; }
.ai-assistant__privacy-dialog-head { display: flex; align-items: center; gap: 18rpx; }
.ai-assistant__consent-shield--small { flex: none; width: 48rpx; height: 54rpx; border-width: 4rpx; border-radius: 18rpx 18rpx 21rpx 21rpx; }
.ai-assistant__consent-shield--small view { width: 14rpx; height: 8rpx; margin-top: 15rpx; border-width: 0 0 4rpx 4rpx; }
.ai-assistant__privacy-dialog-copy { display: block; margin-top: 24rpx; color: #536d77; font-size: 23rpx; line-height: 38rpx; }
.ai-assistant__privacy-dialog-link { min-height: 64rpx; display: flex; align-items: center; color: #087da8; font-size: 22rpx; text-decoration: underline; }
.ai-assistant__dialog-button--danger { width: 160rpx; border-color: #c9432b; color: #c9432b; background: #fff5f2; }
@keyframes aiOnline { 0%, 100% { transform: scale(.82); opacity: .68; } 50% { transform: scale(1); opacity: 1; } }
@keyframes aiStatus { 0% { box-shadow: 0 0 0 0 rgba(30, 207, 145, .35); } 70%, 100% { box-shadow: 0 0 0 12rpx rgba(30, 207, 145, 0); } }
@keyframes aiDot { 0%, 80%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-7rpx); opacity: 1; } }
@keyframes aiScan { 0%, 58% { transform: translateX(0) skewX(-12deg); opacity: 0; } 64% { opacity: .72; } 82% { transform: translateX(760%) skewX(-12deg); opacity: 0; } 100% { opacity: 0; } }
@keyframes aiFade { from { opacity: 0; } to { opacity: 1; } }
@keyframes aiEnter { from { transform: translate3d(28rpx, 0, 0); opacity: .75; } to { transform: translate3d(0, 0, 0); opacity: 1; } }
@keyframes aiRise { from { transform: translateY(10rpx); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes aiMessage { from { transform: translateY(8rpx); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@keyframes aiDrawer { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes aiDialog { from { transform: translateY(14rpx) scale(.98); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
@keyframes aiSkeleton { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
@media (prefers-reduced-motion: reduce) {
  .ai-assistant__online,
  .ai-assistant__model-dot,
  .ai-assistant__welcome-pulse,
  .ai-assistant__thinking-mark text,
  .ai-assistant__scan,
  .ai-assistant__loading-line { animation: none !important; }
  .ai-assistant__panel,
  .ai-assistant__overlay,
  .ai-assistant__welcome,
  .ai-assistant__prompt,
  .ai-assistant__message,
  .ai-assistant__drawer,
  .ai-assistant__dialog { animation-duration: .01ms !important; }
}
</style>

<style scoped>
/* Light Field focus mode: calm, permission-aware and free of decorative scan effects. */
.ai-assistant__overlay, .ai-assistant__panel { background: var(--mci-app-canvas, #f4f6f5); }
.ai-assistant__header { min-height: 160rpx; padding-bottom: 24rpx; background: var(--mci-gradient-primary); }
.ai-assistant__grid, .ai-assistant__scan { display: none; }
.ai-assistant__avatar-wrap { width: 72rpx; height: 72rpx; border-radius: 22rpx; background: var(--mci-app-surface, #fefffe); box-shadow: none; }
.ai-assistant__avatar { width: 72rpx; height: 72rpx; }
.ai-assistant__online { border-color: var(--mci-color-primary-dark, #063b5c); background: var(--mci-color-success, #14855f); animation: none; }
.ai-assistant__title { color: var(--mci-text-on-primary, #fff); font-size: 32rpx; font-weight: 720; }
.ai-assistant__scope { color: var(--mci-text-on-primary-soft, rgba(255,255,255,.76)); font-size: 20rpx; }
.ai-assistant__header-actions { gap: 4rpx; }
.ai-assistant__icon-button { width: 88rpx; height: 88rpx; border: 0; background: transparent; }
.ai-assistant__icon-button--pressed { background: var(--mci-surface-on-primary, rgba(255,255,255,.1)); }
.ai-assistant__history-icon { width: 30rpx; height: 28rpx; display: flex; flex-direction: column; justify-content: space-between; }
.ai-assistant__history-icon > view { width: 100%; height: 3rpx; border-radius: 3rpx; background: currentColor; }
.ai-assistant__plus-icon, .ai-assistant__close-icon, .ai-assistant__drawer-create-icon { position: relative; width: 28rpx; height: 28rpx; }
.ai-assistant__plus-icon::before, .ai-assistant__plus-icon::after, .ai-assistant__drawer-create-icon::before, .ai-assistant__drawer-create-icon::after { position: absolute; top: 12rpx; left: 1rpx; width: 26rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; }
.ai-assistant__plus-icon::after, .ai-assistant__drawer-create-icon::after { transform: rotate(90deg); }
.ai-assistant__close-icon::before, .ai-assistant__close-icon::after, .ai-assistant__drawer-close > view::before, .ai-assistant__drawer-close > view::after { position: absolute; top: 12rpx; left: 1rpx; width: 26rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; }
.ai-assistant__close-icon::before, .ai-assistant__drawer-close > view::before { transform: rotate(45deg); }.ai-assistant__close-icon::after, .ai-assistant__drawer-close > view::after { transform: rotate(-45deg); }
.ai-assistant__generation-notice { min-height: 64rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); background: var(--mci-color-info-soft, #e5f0f4); color: var(--mci-color-info, #176f96); }
.ai-assistant__generation-badge { background: var(--mci-color-info, #176f96); }
.ai-assistant__consent { padding: 42rpx 28rpx calc(42rpx + var(--mci-safe-bottom)); }
.ai-assistant__consent-shield { border-color: var(--mci-color-primary, #087da8); background: var(--mci-color-primary-soft, rgba(8,125,168,.09)); }
.ai-assistant__consent-list { padding: 24rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); }
.ai-assistant__consent-button { height: 88rpx; border-radius: 22rpx; background: var(--mci-gradient-primary); box-shadow: var(--mci-shadow-button); }
.ai-assistant__loading-card { border-color: var(--mci-divider, rgba(20,65,84,.1)); border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); }
.ai-assistant__toolbar { min-height: 92rpx; padding: 12rpx 20rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); background: var(--mci-app-surface, #fefffe); }
.ai-assistant__model { min-height: 68rpx; padding: 7rpx 15rpx; border: 0; border-radius: 18rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__model-dot { box-shadow: none; animation: none; }
.ai-assistant__model-label { color: var(--mci-text-tertiary, rgba(23,49,61,.46)); }
.ai-assistant__model-name { color: var(--mci-text-primary, #17313d); }
.ai-assistant__model-arrow { flex: none; width: 12rpx; height: 12rpx; border-right: 3rpx solid currentColor; border-bottom: 3rpx solid currentColor; color: var(--mci-text-secondary, rgba(23,49,61,.66)); transform: rotate(45deg) translateY(-3rpx); }
.ai-assistant__scope,
.ai-assistant__generation-badge,
.ai-assistant__consent-note,
.ai-assistant__model-label,
.ai-assistant__reasoning,
.ai-assistant__conversation-kicker,
.ai-assistant__conversation-action,
.ai-assistant__welcome-status,
.ai-assistant__thinking-index,
.ai-assistant__drawer-subtitle,
.ai-assistant__history-meta,
.ai-assistant__history-actions { font-size: 22rpx; }
.ai-assistant__reasoning { height: 68rpx; padding: 0 16rpx; display: flex; align-items: center; gap: 10rpx; border: 0; border-radius: 18rpx; background: var(--mci-app-surface-soft, #eef3f2); color: var(--mci-text-secondary, rgba(23,49,61,.66)); line-height: normal; }
.ai-assistant__conversation-bar { min-height: 72rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__messages { padding: 24rpx 24rpx 0; }
.ai-assistant__welcome { margin-bottom: 20rpx; padding: 24rpx; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-left-width: 1rpx; border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); box-shadow: none; }
.ai-assistant__welcome-pulse { background: var(--mci-color-success, #14855f); box-shadow: none; animation: none; }
.ai-assistant__prompts { gap: 0; overflow: hidden; border: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); }
.ai-assistant__prompt { min-height: 88rpx; padding: 0 24rpx; border: 0; border-bottom: 1rpx solid var(--mci-divider, rgba(20,65,84,.1)); border-radius: 0; background: transparent; box-shadow: none; }
.ai-assistant__prompt:last-child { border-bottom: 0; }
.ai-assistant__prompt-arrow, .ai-assistant__thinking-arrow { flex: none; width: 13rpx; height: 13rpx; border-top: 3rpx solid currentColor; border-right: 3rpx solid currentColor; color: var(--mci-color-primary, #087da8); transform: rotate(45deg); }
.ai-assistant__thinking-arrow { transform: rotate(135deg); }.ai-assistant__thinking-arrow--open { transform: rotate(-45deg); }
.ai-assistant__bubble { border-radius: 20rpx; box-shadow: none; }
.ai-assistant__message--user .ai-assistant__bubble { border-bottom-right-radius: 6rpx; background: var(--mci-color-primary, #087da8); }
.ai-assistant__message--assistant .ai-assistant__bubble { border-color: var(--mci-divider, rgba(20,65,84,.1)); border-bottom-left-radius: 6rpx; background: var(--mci-app-surface, #fefffe); }
.ai-assistant__thinking-steps { border-radius: 16rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__composer { min-height: 116rpx; border-color: var(--mci-divider, rgba(20,65,84,.1)); background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-dock); }
.ai-assistant__input { min-height: 80rpx; padding: 18rpx 20rpx; border: 0; border-radius: 22rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__send { width: 80rpx; height: 80rpx; background: var(--mci-color-brand, #e54625); box-shadow: none; }
.ai-assistant__send-icon { position: relative; width: 26rpx; height: 30rpx; border-top: 4rpx solid currentColor; }
.ai-assistant__send-icon::before, .ai-assistant__send-icon::after { position: absolute; top: -3rpx; width: 16rpx; height: 4rpx; border-radius: 3rpx; background: currentColor; content: ''; }
.ai-assistant__send-icon::before { left: -1rpx; transform: rotate(-42deg); transform-origin: left center; }.ai-assistant__send-icon::after { right: -1rpx; transform: rotate(42deg); transform-origin: right center; }
.ai-assistant__drawer { background: var(--mci-app-canvas, #f4f6f5); }
.ai-assistant__drawer-close { width: 88rpx; height: 88rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__drawer-close > view { position: relative; width: 28rpx; height: 28rpx; }
.ai-assistant__drawer-create { min-height: 88rpx; height: 88rpx; border: 0; border-radius: 20rpx; background: var(--mci-color-info-soft, #e5f0f4); color: var(--mci-color-info, #176f96); }
.ai-assistant__history-search { min-height: 76rpx; height: 76rpx; border: 0; border-radius: 18rpx; background: var(--mci-app-surface, #fefffe); }
.ai-assistant__history-search-icon { position: relative; width: 24rpx; height: 24rpx; border: 3rpx solid currentColor; border-radius: 50%; color: var(--mci-text-secondary, rgba(23,49,61,.66)); }
.ai-assistant__history-search-icon::after { position: absolute; right: -8rpx; bottom: -4rpx; width: 10rpx; height: 3rpx; border-radius: 3rpx; background: currentColor; content: ''; transform: rotate(45deg); }
.ai-assistant__history-item { border-bottom-color: var(--mci-divider, rgba(20,65,84,.1)); }
.ai-assistant__history-item--active { background: var(--mci-color-info-soft, #e5f0f4); }
.ai-assistant__dialog { border-radius: 24rpx; background: var(--mci-app-surface, #fefffe); box-shadow: var(--mci-shadow-deck); }
.ai-assistant__dialog-input { min-height: 88rpx; height: 88rpx; border: 0; border-radius: 18rpx; background: var(--mci-app-surface-soft, #eef3f2); }
.ai-assistant__dialog-button { min-height: 88rpx; height: 88rpx; border-radius: 18rpx; line-height: 88rpx; }
@media (prefers-reduced-motion: reduce) { .ai-assistant__prompt, .ai-assistant__message { animation: none; } }
</style>

<style scoped src="./mci-ai-assistant-signal.css"></style>
