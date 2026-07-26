<template>
  <section class="profile-ai-chat" aria-labelledby="profile-ai-chat-title">
    <header class="ai-chat-head">
      <div>
        <span class="ai-chat-brand"><i aria-hidden="true"></i>Microi AI</span>
        <h2 id="profile-ai-chat-title">{{ copy.title }}</h2>
        <p>{{ copy.desc }}</p>
      </div>
      <button class="new-chat" type="button" @click="newConversation">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        {{ copy.newChat }}
      </button>
    </header>

    <div class="ai-chat-layout">
      <aside class="ai-chat-history" aria-label="AI 对话历史">
        <div class="history-title">
          <span>{{ copy.history }}</span>
          <small>{{ conversations.length }}</small>
        </div>
        <button
          v-for="item in conversations"
          :key="item.id"
          type="button"
          :class="{ active: item.id === activeConversationId }"
          @click="selectConversation(item.id)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ formatHistoryTime(item.updatedAt) }}</span>
        </button>
        <p v-if="!conversations.length" class="history-empty">{{ copy.noHistory }}</p>
      </aside>

      <div class="ai-chat-main">
        <div class="ai-chat-toolbar">
          <label>
            <span>{{ copy.model }}</span>
            <select v-model="selectedModel" :disabled="loadingModels || sending">
              <option v-for="item in models" :key="item.id" :value="item.id">{{ item.name }}</option>
            </select>
          </label>
          <span class="api-status"><i></i>{{ copy.sameApi }}</span>
        </div>

        <div ref="messageArea" class="ai-chat-messages" aria-live="polite">
          <div v-if="!activeMessages.length" class="ai-chat-welcome">
            <span>AI</span>
            <h3>{{ copy.welcome }}</h3>
            <p>{{ copy.welcomeDesc }}</p>
            <div class="quick-prompts">
              <button v-for="prompt in quickPrompts" :key="prompt" type="button" @click="usePrompt(prompt)">{{ prompt }}</button>
            </div>
          </div>
          <article v-for="message in activeMessages" :key="message.id" class="ai-chat-message" :class="message.role">
            <span class="message-avatar">{{ message.role === 'assistant' ? 'AI' : '你' }}</span>
            <div>
              <strong>{{ message.role === 'assistant' ? 'Microi AI' : copy.you }}</strong>
              <p>{{ message.content }}<i v-if="message.streaming" class="stream-caret"></i></p>
            </div>
          </article>
        </div>

        <p v-if="errorMessage" class="ai-chat-error" role="alert">{{ errorMessage }}</p>
        <div class="ai-chat-composer">
          <textarea
            v-model="inputText"
            rows="3"
            maxlength="8000"
            :placeholder="copy.placeholder"
            :disabled="sending"
            @keydown.enter.exact.prevent="sendMessage"
          ></textarea>
          <div class="composer-bottom">
            <span>{{ copy.boundary }}</span>
            <button v-if="sending" class="send-button stop" type="button" @click="stopRequest">{{ copy.stop }}</button>
            <button v-else class="send-button" type="button" :disabled="!canSend" @click="sendMessage">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>
              {{ copy.send }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  apiBase: { type: String, required: true },
  osClient: { type: String, default: 'iTdos' },
  authToken: { type: String, required: true },
  userId: { type: String, default: '' },
  locale: { type: String, default: 'zh-CN' }
})

const emit = defineEmits(['token-refreshed', 'refresh-quota'])
const models = ref([])
const selectedModel = ref('')
const loadingModels = ref(false)
const conversations = ref([])
const activeConversationId = ref('')
const inputText = ref('')
const sending = ref(false)
const errorMessage = ref('')
const messageArea = ref(null)
const pendingHomePrefill = ref('')
let abortController = null
const PROFILE_AI_PREFILL_KEY = 'microi_profile_ai_prefill'

const copy = computed(() => props.locale === 'en-US' ? {
  title: 'AI Workspace', desc: 'Chat with the same authenticated Microi AI service used by the admin console.', newChat: 'New chat',
  history: 'Recent chats', noHistory: 'No conversations yet', model: 'Model', sameApi: 'Shared account API',
  welcome: 'How can I help?', welcomeDesc: 'Ask about Microi architecture, V8 development, deployment, or delivery.',
  you: 'You', placeholder: 'Message Microi AI...', boundary: 'Tenant data and system changes require your SaaS workspace permissions.',
  stop: 'Stop', send: 'Send'
} : {
  title: 'AI 对话工作台', desc: '与吾码后台共用登录身份和 AI 中转接口，在个人中心直接开始对话。', newChat: '新建对话',
  history: '最近对话', noHistory: '还没有对话记录', model: '模型', sameApi: '共用后台账号接口',
  welcome: '今天想一起解决什么？', welcomeDesc: '可以询问吾码架构、V8 开发、部署运维与企业应用交付。',
  you: '你', placeholder: '输入消息，Enter 发送，Shift + Enter 换行...', boundary: '租户数据分析和系统修改仍以你的 SaaS 工作台权限为准。',
  stop: '停止', send: '发送'
})

const quickPrompts = computed(() => props.locale === 'en-US'
  ? ['Explain Microi architecture', 'Write a safe V8 API example', 'Plan a production deployment']
  : ['介绍 Microi吾码 的核心架构', '写一个安全的 V8 接口示例', '给我一份生产部署检查清单'])

const activeConversation = computed(() => conversations.value.find(item => item.id === activeConversationId.value) || null)
const activeMessages = computed(() => activeConversation.value?.messages || [])
const canSend = computed(() => Boolean(inputText.value.trim() && selectedModel.value && props.authToken && !sending.value))
const storageKey = computed(() => `microi_profile_ai_conversations:${props.userId || 'anonymous'}`)

function makeId(prefix = 'chat') {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function normalizeToken(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim()
}

function normalizeModel(item) {
  const id = String(item?.id || item?.ModelId || item?.AiModel || '').trim()
  return { id, name: String(item?.name || item?.Name || id).trim() || id }
}

function loadStoredConversations() {
  if (typeof window === 'undefined' || !props.userId) return
  try {
    const rows = JSON.parse(localStorage.getItem(storageKey.value) || '[]')
    conversations.value = Array.isArray(rows)
      ? rows.filter(item => item?.id && Array.isArray(item.messages)).slice(0, 20).map(item => ({
          ...item,
          messages: item.messages.map(message => ({
            id: message.id || makeId('msg'),
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: stripThinking(message.content)
          }))
        }))
      : []
  } catch (_) {
    conversations.value = []
  }
  activeConversationId.value = conversations.value[0]?.id || ''
}

function persistConversations() {
  if (typeof window === 'undefined' || !props.userId) return
  const safeRows = conversations.value.slice(0, 20).map(item => ({
    ...item,
    messages: item.messages
      .filter(message => !message.streaming)
      .slice(-50)
      .map(message => ({ id: message.id, role: message.role, content: stripThinking(message.content) }))
  }))
  try { localStorage.setItem(storageKey.value, JSON.stringify(safeRows)) } catch (_) {}
}

function ensureConversation() {
  let current = activeConversation.value
  if (current) return current
  current = { id: makeId(), title: copy.value.newChat, updatedAt: new Date().toISOString(), messages: [] }
  conversations.value.unshift(current)
  activeConversationId.value = current.id
  return current
}

function newConversation() {
  stopRequest()
  activeConversationId.value = ''
  inputText.value = ''
  errorMessage.value = ''
}

function selectConversation(id) {
  if (sending.value) return
  activeConversationId.value = id
  errorMessage.value = ''
  scrollMessages()
}

function firstLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 32) || copy.value.newChat
}

function formatHistoryTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(props.locale === 'en-US' ? 'en-US' : 'zh-CN', { month: 'short', day: 'numeric' }).format(date)
}

function usePrompt(value) {
  inputText.value = value
}

function scrollMessages() {
  nextTick(() => {
    if (messageArea.value) messageArea.value.scrollTop = messageArea.value.scrollHeight
  })
}

async function loadModels() {
  loadingModels.value = true
  try {
    const response = await fetch(`${props.apiBase}/apiengine/official_ai_relay_models?OsClient=${props.osClient}`)
    const result = await response.json()
    if (!response.ok || Number(result?.Code) !== 1) throw new Error(result?.Msg || 'AI 模型读取失败')
    models.value = (Array.isArray(result.Data) ? result.Data : []).map(normalizeModel).filter(item => item.id)
    if (!models.value.some(item => item.id === selectedModel.value)) selectedModel.value = models.value[0]?.id || ''
  } catch (error) {
    errorMessage.value = error?.message || 'AI 模型读取失败'
  } finally {
    loadingModels.value = false
  }
}

function syncResponseToken(response) {
  const token = normalizeToken(response?.headers?.get?.('authorization'))
  if (token && token !== normalizeToken(props.authToken)) emit('token-refreshed', token)
}

function stripThinking(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<think>[\s\S]*$/gi, '')
    .replace(/<\/think>/gi, '')
    .trimStart()
}

function consumeOpenAiData(data, assistant) {
  if (!data || data === '[DONE]') return
  let payload
  try { payload = JSON.parse(data) } catch (_) { return }
  if (payload?.error?.message) throw new Error(payload.error.message)
  const delta = payload?.choices?.[0]?.delta?.content || payload?.choices?.[0]?.message?.content || ''
  if (delta) {
    assistant.rawContent = `${assistant.rawContent || ''}${String(delta)}`
    assistant.content = stripThinking(assistant.rawContent)
    scrollMessages()
  }
}

async function readOpenAiStream(response, assistant) {
  if (!response.body) throw new Error('当前浏览器不支持流式响应')
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('data:')) consumeOpenAiData(line.slice(5).trim(), assistant)
      }
    }
    if (done) break
  }
  for (const line of buffer.split(/\r?\n/)) {
    if (line.startsWith('data:')) consumeOpenAiData(line.slice(5).trim(), assistant)
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || !canSend.value) return
  const isHomePrefill = Boolean(pendingHomePrefill.value && pendingHomePrefill.value === text)
  errorMessage.value = ''
  const conversation = ensureConversation()
  const userMessage = { id: makeId('msg'), role: 'user', content: text }
  const assistantMessage = { id: makeId('msg'), role: 'assistant', content: '', rawContent: '', streaming: true }
  conversation.messages.push(userMessage, assistantMessage)
  conversation.title = conversation.messages.filter(item => item.role === 'user').length === 1 ? firstLine(text) : conversation.title
  conversation.updatedAt = new Date().toISOString()
  conversations.value = [conversation, ...conversations.value.filter(item => item.id !== conversation.id)]
  inputText.value = ''
  sending.value = true
  scrollMessages()

  abortController = new AbortController()
  try {
    const history = conversation.messages
      .filter(item => item.id !== assistantMessage.id && item.content)
      .slice(-24)
      .map(item => ({ role: item.role, content: item.content }))
    const response = await fetch(`${props.apiBase}/api/Ai/ProxyChatStream?OsClient=${props.osClient}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${normalizeToken(props.authToken)}`,
        Token: normalizeToken(props.authToken),
        lang: props.locale
      },
      body: JSON.stringify({ model: selectedModel.value, messages: history, stream: true }),
      signal: abortController.signal
    })
    syncResponseToken(response)
    if (!response.ok) throw new Error(`AI 请求失败（${response.status}）`)
    if (isHomePrefill) {
      pendingHomePrefill.value = ''
      try { sessionStorage.removeItem(PROFILE_AI_PREFILL_KEY) } catch (_) {}
    }
    await readOpenAiStream(response, assistantMessage)
    if (!assistantMessage.content.trim()) throw new Error('AI 暂未返回内容')
    emit('refresh-quota')
  } catch (error) {
    if (error?.name === 'AbortError') {
      if (!assistantMessage.content) assistantMessage.content = '已停止生成。'
    } else {
      assistantMessage.content = assistantMessage.content || (error?.message || 'AI 请求失败，请稍后重试')
      errorMessage.value = error?.message || 'AI 请求失败，请稍后重试'
    }
  } finally {
    assistantMessage.streaming = false
    conversation.updatedAt = new Date().toISOString()
    sending.value = false
    abortController = null
    persistConversations()
    scrollMessages()
  }
}

function stopRequest() {
  abortController?.abort()
}

watch(() => props.userId, loadStoredConversations)

onMounted(async () => {
  loadStoredConversations()
  let prefill = ''
  try {
    prefill = String(sessionStorage.getItem(PROFILE_AI_PREFILL_KEY) || '').trim().slice(0, 8000)
  } catch (_) {}
  if (prefill) {
    // 首页入口始终代表一条全新的任务，不能把首页问题追加到历史会话。
    newConversation()
    pendingHomePrefill.value = prefill
    inputText.value = prefill
  }
  await loadModels()
  if (prefill && canSend.value) await sendMessage()
})

onBeforeUnmount(stopRequest)
</script>

<style scoped>
.profile-ai-chat { margin-bottom: 18px; overflow: hidden; border: 1px solid rgba(148,163,184,.18); border-radius: 20px; background: linear-gradient(150deg, #111827, #0b1220); box-shadow: 0 18px 44px rgba(0,0,0,.22); color: #e5e7eb; }
.ai-chat-head { min-height: 112px; display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 22px 24px; border-bottom: 1px solid rgba(148,163,184,.14); background: radial-gradient(circle at 8% 0, rgba(99,102,241,.18), transparent 24rem); }
.ai-chat-head h2 { margin: 6px 0 4px; color: #f8fafc; font-size: 22px; }
.ai-chat-head p { margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6; }
.ai-chat-brand { display: inline-flex; align-items: center; gap: 8px; color: #c7d2fe; font-size: 11px; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
.ai-chat-brand i, .api-status i { width: 7px; height: 7px; border-radius: 50%; background: #818cf8; box-shadow: 0 0 14px rgba(129,140,248,.8); }
.new-chat, .send-button { min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 0 14px; border: 1px solid rgba(129,140,248,.38); border-radius: 11px; background: rgba(79,70,229,.22); color: #e0e7ff; cursor: pointer; font: inherit; font-size: 12px; font-weight: 750; }
.new-chat svg, .send-button svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; }
.ai-chat-layout { display: grid; grid-template-columns: 220px minmax(0,1fr); min-height: 560px; }
.ai-chat-history { padding: 16px 12px; border-right: 1px solid rgba(148,163,184,.14); background: rgba(5,10,19,.38); }
.history-title { display: flex; align-items: center; justify-content: space-between; padding: 0 8px 10px; color: #94a3b8; font-size: 11px; font-weight: 750; }
.history-title small { min-width: 22px; padding: 2px 6px; border-radius: 999px; background: rgba(148,163,184,.12); text-align: center; }
.ai-chat-history > button { width: 100%; display: grid; gap: 5px; margin-bottom: 5px; padding: 11px 10px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: #94a3b8; cursor: pointer; text-align: left; }
.ai-chat-history > button:hover, .ai-chat-history > button.active { border-color: rgba(129,140,248,.2); background: rgba(99,102,241,.1); color: #e2e8f0; }
.ai-chat-history strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ai-chat-history span { font-size: 10px; color: #64748b; }
.history-empty { margin: 22px 8px; color: #64748b; font-size: 11px; line-height: 1.6; }
.ai-chat-main { min-width: 0; display: grid; grid-template-rows: auto minmax(280px,1fr) auto auto; }
.ai-chat-toolbar { min-height: 54px; display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 0 18px; border-bottom: 1px solid rgba(148,163,184,.12); }
.ai-chat-toolbar label { display: flex; align-items: center; gap: 9px; color: #64748b; font-size: 11px; }
.ai-chat-toolbar select { max-width: 260px; min-height: 32px; padding: 0 30px 0 10px; border: 1px solid rgba(148,163,184,.18); border-radius: 9px; outline: none; background: #0b1220; color: #e2e8f0; font: inherit; font-size: 12px; color-scheme: dark; }
.api-status { display: inline-flex; align-items: center; gap: 7px; color: #64748b; font-size: 10px; }
.api-status i { width: 6px; height: 6px; background: #34d399; box-shadow: 0 0 12px rgba(52,211,153,.65); }
.ai-chat-messages { min-height: 0; max-height: 540px; overflow-y: auto; padding: 22px 24px; scrollbar-width: thin; scrollbar-color: #334155 transparent; }
.ai-chat-welcome { min-height: 300px; display: grid; place-content: center; justify-items: center; text-align: center; }
.ai-chat-welcome > span { width: 46px; height: 46px; display: grid; place-items: center; border: 1px solid rgba(129,140,248,.35); border-radius: 15px; background: linear-gradient(145deg, rgba(79,70,229,.3), rgba(14,165,233,.15)); color: #e0e7ff; font-size: 13px; font-weight: 850; }
.ai-chat-welcome h3 { margin: 16px 0 6px; color: #f8fafc; font-size: 20px; }
.ai-chat-welcome p { max-width: 500px; margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.7; }
.quick-prompts { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 18px; }
.quick-prompts button { min-height: 34px; padding: 0 12px; border: 1px solid rgba(148,163,184,.16); border-radius: 999px; background: rgba(148,163,184,.06); color: #cbd5e1; cursor: pointer; font: inherit; font-size: 11px; }
.quick-prompts button:hover { border-color: rgba(129,140,248,.38); background: rgba(99,102,241,.12); color: #fff; }
.ai-chat-message { display: grid; grid-template-columns: 32px minmax(0,1fr); gap: 11px; margin-bottom: 22px; }
.ai-chat-message.user { direction: rtl; }
.ai-chat-message.user > * { direction: ltr; }
.message-avatar { width: 32px; height: 32px; display: grid; place-items: center; border: 1px solid rgba(148,163,184,.18); border-radius: 10px; background: #182235; color: #94a3b8; font-size: 10px; font-weight: 800; }
.ai-chat-message.assistant .message-avatar { background: linear-gradient(145deg, #4f46e5, #2563eb); color: #fff; }
.ai-chat-message > div { min-width: 0; }
.ai-chat-message strong { display: block; margin: 1px 0 6px; color: #94a3b8; font-size: 10px; }
.ai-chat-message.user strong { text-align: right; }
.ai-chat-message p { width: fit-content; max-width: min(760px,90%); margin: 0; padding: 11px 14px; border: 1px solid rgba(148,163,184,.13); border-radius: 4px 14px 14px; background: rgba(148,163,184,.06); color: #e2e8f0; font-size: 13px; line-height: 1.75; white-space: pre-wrap; overflow-wrap: anywhere; }
.ai-chat-message.user p { margin-left: auto; border-color: rgba(99,102,241,.2); border-radius: 14px 4px 14px 14px; background: rgba(79,70,229,.16); }
.stream-caret { display: inline-block; width: 2px; height: 14px; margin-left: 3px; background: #a5b4fc; vertical-align: -2px; animation: caret-blink .8s steps(1) infinite; }
.ai-chat-error { margin: 0 18px 10px; color: #fda4af; font-size: 11px; }
.ai-chat-composer { margin: 0 18px 18px; overflow: hidden; border: 1px solid rgba(148,163,184,.18); border-radius: 15px; background: rgba(7,12,22,.7); }
.ai-chat-composer:focus-within { border-color: rgba(129,140,248,.55); box-shadow: 0 0 0 3px rgba(99,102,241,.08); }
.ai-chat-composer textarea { width: 100%; min-height: 82px; display: block; resize: none; box-sizing: border-box; padding: 14px 15px 8px; border: 0; outline: 0; background: transparent; color: #f1f5f9; font: inherit; font-size: 13px; line-height: 1.6; }
.ai-chat-composer textarea::placeholder { color: #56647a; }
.composer-bottom { min-height: 45px; display: flex; align-items: center; gap: 12px; padding: 5px 7px 8px 14px; }
.composer-bottom > span { flex: 1; color: #56647a; font-size: 10px; line-height: 1.4; }
.send-button { min-width: 78px; border: 0; background: #6366f1; color: #fff; }
.send-button.stop { background: rgba(244,63,94,.16); color: #fda4af; }
.send-button:disabled { opacity: .42; cursor: not-allowed; }
@keyframes caret-blink { 50% { opacity: 0; } }
@media (max-width: 880px) { .ai-chat-layout { grid-template-columns: 1fr; } .ai-chat-history { display: flex; gap: 7px; overflow-x: auto; border-right: 0; border-bottom: 1px solid rgba(148,163,184,.14); } .history-title { flex: 0 0 auto; display: grid; place-content: center; } .ai-chat-history > button { flex: 0 0 160px; margin: 0; } .history-empty { margin: 10px; } }
@media (max-width: 620px) { .ai-chat-head { align-items: flex-start; flex-direction: column; padding: 20px; } .new-chat { width: 100%; } .ai-chat-toolbar { align-items: flex-start; flex-direction: column; gap: 8px; padding: 10px 14px; } .ai-chat-toolbar label, .ai-chat-toolbar select { width: 100%; } .ai-chat-messages { padding: 18px 14px; } .composer-bottom > span { display: none; } .send-button { margin-left: auto; } }
@media (prefers-reduced-motion: reduce) { .stream-caret { animation: none; } }
</style>
