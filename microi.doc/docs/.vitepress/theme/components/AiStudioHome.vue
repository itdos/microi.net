<template>
  <main class="microi-ai-studio-home">
    <section class="ai-studio-hero" aria-labelledby="ai-studio-title">
      <p class="ai-studio-brand"><span aria-hidden="true"></span>Microi AI Studio</p>
      <h1 id="ai-studio-title">{{ copy.title }}</h1>
      <a
        v-if="locale === 'zh-CN'"
        class="ai-studio-proof-link"
        href="https://blog.csdn.net/qq973702/article/details/163763831"
        target="_blank"
        rel="noopener noreferrer"
      >查看可复现实测与适用边界 →</a>

      <div class="ai-studio-chat" :class="{ 'has-messages': messages.length }">
        <div v-if="messages.length" ref="messageArea" class="ai-studio-messages" aria-live="polite">
          <div v-for="(message, index) in messages" :key="index" class="ai-studio-message" :class="message.role">
            <span>{{ message.role === 'assistant' ? 'AI' : '你' }}</span>
            <p>{{ message.content }}</p>
          </div>
          <div v-if="isThinking" class="ai-studio-message assistant thinking"><span>AI</span><p><i></i><i></i><i></i></p></div>
        </div>

        <textarea
          v-model="inputText"
          rows="3"
          maxlength="2000"
          :disabled="!isAuthed || isThinking"
          :placeholder="copy.placeholder"
          :aria-label="copy.chatLabel"
          @keydown.enter.exact.prevent="sendMessage"
        ></textarea>
        <div class="ai-studio-chat-actions">
          <div class="ai-studio-prompts" aria-label="快捷问题">
            <button type="button" :title="copy.aboutTitle" :disabled="!isAuthed" @click="usePrompt(copy.aboutPrompt)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5v-16Z"/><path d="M4 18.5A2.5 2.5 0 0 1 6.5 16H20"/></svg>
            </button>
            <button type="button" :title="copy.archTitle" :disabled="!isAuthed" @click="usePrompt(copy.archPrompt)">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/></svg>
            </button>
            <button type="button" :title="copy.appsTitle" :disabled="!isAuthed" @click="scrollToApps">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </button>
          </div>
          <span class="ai-studio-safety">{{ copy.safety }}</span>
          <button class="ai-studio-send" type="button" :disabled="!isAuthed || isThinking || !inputText.trim()" aria-label="发送" @click="sendMessage">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m0 0-6 6m6-6 6 6"/></svg>
          </button>
        </div>

        <div v-if="!isAuthed" class="ai-studio-login-mask">
          <div>
            <span class="ai-studio-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
            </span>
            <strong>{{ copy.loginTitle }}</strong>
            <p>{{ copy.loginDesc }}</p>
            <a :href="loginUrl">{{ copy.loginAction }}</a>
          </div>
        </div>
      </div>
      <p v-if="chatError" class="ai-studio-error" role="alert">{{ chatError }}</p>
    </section>

    <MciNugetStats variant="home" :locale="locale" />
    <ProductShowcase :locale="locale" />
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vitepress'
import ProductShowcase from './ProductShowcase.vue'
import MciNugetStats from './MciNugetStats.vue'

const route = useRoute()
const inputText = ref('')
const messages = ref([])
const isThinking = ref(false)
const authToken = ref('')
const currentUser = ref(null)
const chatError = ref('')
const PROFILE_AI_PREFILL_KEY = 'microi_profile_ai_prefill'

const isAuthed = computed(() => Boolean(authToken.value && currentUser.value?.Id))
const loginUrl = computed(() => `/login.html?redirect=${encodeURIComponent(route.path || '/')}`)
const locale = computed(() => /^\/en(?:\/|$)/.test(route.path || '') ? 'en-US' : 'zh-CN')
const copy = computed(() => locale.value === 'en-US' ? {
  title: 'Your all-purpose AI for work, creation, and imagination',
  placeholder: 'Describe what you want to create, understand, analyze, or accomplish...',
  chatLabel: 'Chat with Microi AI',
  aboutTitle: 'About Microi', aboutPrompt: 'What enterprise applications is Microi best suited for?',
  archTitle: 'Architecture', archPrompt: 'Explain the Microi architecture and V8 engine.',
  appsTitle: 'Browse AI apps', safety: 'Public knowledge only — no business database access',
  loginTitle: 'Sign in to continue in Microi AI',
  loginDesc: 'The official-site AI never reads or changes private tenant data.',
  loginAction: 'Sign in / Register'
} : {
  title: '相比传统 AI 开发：Token 更省 10 倍+、交付更快 10 倍+、20+ 成熟引擎开箱复用；深度融合 V8 引擎，业务逻辑无需编译发布。',
  placeholder: '描述你想创造、了解、分析或完成的任何事情...',
  chatLabel: '与 Microi AI 对话',
  aboutTitle: '了解 Microi吾码', aboutPrompt: 'Microi吾码适合开发哪些企业应用？',
  archTitle: '了解技术架构', archPrompt: '介绍一下 Microi吾码的技术架构和 V8 引擎。',
  appsTitle: '查看 AI 应用', safety: '仅回答公开内容，不连接业务数据库',
  loginTitle: '登录后开始与 Microi AI 对话',
  loginDesc: '官网 AI 只使用公开知识，不读取或修改主租户业务数据。',
  loginAction: '登录 / 注册'
})

function normalizeToken(raw) {
  return String(raw || '').replace(/^Bearer\s+/i, '').trim()
}

function syncAuth() {
  if (typeof window === 'undefined') return
  authToken.value = normalizeToken(localStorage.getItem('microi_doc_token'))
  try { currentUser.value = JSON.parse(localStorage.getItem('microi_doc_user') || 'null') } catch (_) { currentUser.value = null }
}

function usePrompt(value) {
  inputText.value = value
}

function scrollToApps() {
  document.querySelector('#ai-apps')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function sendMessage() {
  const prompt = inputText.value.trim()
  if (!prompt || !isAuthed.value || isThinking.value) return
  chatError.value = ''
  try {
    sessionStorage.setItem(PROFILE_AI_PREFILL_KEY, prompt.slice(0, 8000))
    window.location.href = '/profile.html#/ai'
  } catch (_) {
    chatError.value = locale.value === 'en-US' ? 'Unable to open the AI workspace. Please try again.' : '暂时无法打开 AI 工作台，请稍后重试。'
  }
}

function syncHomeClass() {
  if (typeof document === 'undefined') return
  const isHome = ['/', '/index', '/index.html', '/en/', '/en/index', '/en/index.html'].includes(route.path || window.location.pathname)
  document.documentElement.classList.toggle('microi-ai-studio-page', isHome)
}

function handleAuthChange() {
  syncAuth()
}

if (typeof document !== 'undefined') syncHomeClass()

onMounted(() => {
  syncHomeClass()
  syncAuth()
  window.addEventListener('storage', handleAuthChange)
  window.addEventListener('microi-login-success', handleAuthChange)
  window.addEventListener('microi-logout', handleAuthChange)
  window.addEventListener('microi-token-refreshed', handleAuthChange)
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove('microi-ai-studio-page')
  window.removeEventListener('storage', handleAuthChange)
  window.removeEventListener('microi-login-success', handleAuthChange)
  window.removeEventListener('microi-logout', handleAuthChange)
  window.removeEventListener('microi-token-refreshed', handleAuthChange)
})
</script>

<style scoped>
.microi-ai-studio-home { min-height: 100vh; overflow: hidden; background: #141414; color: #f7f7f7; }
.ai-studio-hero { width: min(920px, calc(100% - 40px)); margin: 0 auto; padding: 154px 0 38px; text-align: center; }
.ai-studio-brand { display: inline-flex; align-items: center; gap: 15px; min-height: 76px; margin: 0 0 16px; padding: 0 16px; border: 1px solid rgba(244,211,94,.2); border-radius: 999px; background: linear-gradient(180deg, rgba(244,211,94,.09), rgba(255,255,255,.025)); color: #fff4c8; box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 10px 30px rgba(0,0,0,.18); font-size: 50px; font-weight: 760; letter-spacing: .015em; }
.ai-studio-brand span { width: 28px; height: 28px; border: 2px solid rgba(255,244,200,.72); border-radius: 50%; background: #f4d35e; box-shadow: 0 0 0 4px rgba(244,211,94,.1), 0 0 22px rgba(244,211,94,.62); }
.ai-studio-hero h1 { max-width: 860px; margin: 16px auto 14px; color: #f7f7f7; font-size: clamp(26px, 3.2vw, 26px); font-weight: 680; line-height: 1.32; letter-spacing: -.035em; }
.ai-studio-proof-link { display: inline-flex; align-items: center; min-height: 34px; margin: 0 auto 24px; padding: 0 14px; border: 1px solid rgba(244,211,94,.28); border-radius: 999px; background: rgba(244,211,94,.08); color: #f7df86; font-size: 12px; font-weight: 650; text-decoration: none; transition: background-color .18s, border-color .18s, transform .18s; }
.ai-studio-proof-link:hover { border-color: rgba(244,211,94,.55); background: rgba(244,211,94,.14); transform: translateY(-1px); }
.ai-studio-chat { position: relative; width: min(760px, 100%); min-height: 156px; margin: 0 auto; overflow: hidden; border: 1px solid #3b3b3b; border-radius: 18px; background: #242424; box-shadow: 0 18px 50px rgba(0,0,0,.22); text-align: left; }
.ai-studio-chat.has-messages { min-height: 320px; }
.ai-studio-messages { max-height: 300px; overflow-y: auto; padding: 22px 22px 4px; scrollbar-width: thin; scrollbar-color: #515151 transparent; }
.ai-studio-message { display: grid; grid-template-columns: 26px minmax(0, 1fr); gap: 10px; margin-bottom: 16px; }
.ai-studio-message > span { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: #333; color: #aaa; font-size: 10px; font-weight: 700; }
.ai-studio-message.assistant > span { background: #ececec; color: #181818; }
.ai-studio-message p { margin: 2px 0 0; color: #d6d6d6; font-size: 14px; line-height: 1.7; white-space: pre-wrap; }
.ai-studio-message.user p { color: #aaa; }
.ai-studio-message.thinking p { display: flex; gap: 5px; padding-top: 7px; }
.ai-studio-message.thinking i { width: 5px; height: 5px; border-radius: 50%; background: #aaa; animation: chat-thinking 1s ease-in-out infinite alternate; }
.ai-studio-message.thinking i:nth-child(2) { animation-delay: .16s; }
.ai-studio-message.thinking i:nth-child(3) { animation-delay: .32s; }
.ai-studio-chat textarea { width: 100%; min-height: 96px; resize: none; display: block; box-sizing: border-box; padding: 19px 20px 8px; border: 0; outline: 0; background: transparent; color: #f2f2f2; font: inherit; font-size: 14px; line-height: 1.6; }
.ai-studio-chat textarea::placeholder { color: #747474; }
.ai-studio-chat-actions { min-height: 50px; display: flex; align-items: center; gap: 8px; padding: 5px 8px 9px 13px; }
.ai-studio-prompts { display: flex; gap: 3px; }
.ai-studio-prompts button, .ai-studio-send { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: 10px; background: transparent; color: #848484; cursor: pointer; }
.ai-studio-prompts button:hover:not(:disabled) { background: #303030; color: #ddd; }
.ai-studio-prompts svg, .ai-studio-send svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.ai-studio-safety { margin-left: 4px; color: #696969; font-size: 11px; }
.ai-studio-send { margin-left: auto; border-radius: 11px; background: #b7b7b7; color: #1e1e1e; transition: background-color .18s, transform .18s; }
.ai-studio-send:hover:not(:disabled) { background: #f1f1f1; transform: translateY(-1px); }
.ai-studio-send:disabled, .ai-studio-prompts button:disabled { opacity: .38; cursor: not-allowed; }
.ai-studio-login-mask { position: absolute; z-index: 3; inset: 0; display: flex; align-items: center; justify-content: center; padding: 12px 20px; background: rgba(20,20,20,.36); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); text-align: center; }
.ai-studio-login-mask > div { min-height: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.ai-studio-lock { width: 32px; height: 32px; display: grid; place-items: center; margin-bottom: 7px; border: 1px solid rgba(255,255,255,.14); border-radius: 10px; background: rgba(255,255,255,.07); color: #ddd; }
.ai-studio-lock svg { width: 17px; fill: none; stroke: currentColor; stroke-width: 1.7; }
.ai-studio-login-mask strong { color: #f4f4f4; font-size: 14px; }
.ai-studio-login-mask p { margin: 4px 0 9px; color: #999; font-size: 11px; }
.ai-studio-login-mask a { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; padding: 0 16px; border-radius: 9px; background: #efefef; color: #151515; font-size: 12px; font-weight: 650; line-height: 1; text-decoration: none; }
.ai-studio-error { margin: 12px auto 0; color: #ff8b8b; font-size: 12px; }
@keyframes chat-thinking { to { opacity: .25; transform: translateY(-3px); } }
@media (max-width: 767px) { .ai-studio-hero { width: min(100% - 28px, 920px); padding-top: 52px; } .ai-studio-brand { min-height: 42px; gap: 10px; padding: 0 14px; font-size: 22px; } .ai-studio-brand span { width: 18px; height: 18px; } .ai-studio-hero h1 { max-width: 560px; margin: 18px auto 12px; font-size: 21px; line-height: 1.42; letter-spacing: -.025em; } .ai-studio-proof-link { margin-bottom: 20px; } .ai-studio-safety { display: none; } .ai-studio-chat { border-radius: 15px; } }
@media (prefers-reduced-motion: reduce) { .ai-studio-message.thinking i, .ai-studio-send { animation: none; transition: none; } }
</style>
