<template>
  <main class="microi-ai-studio-home" data-mci-ui-root>
    <section class="ai-studio-stage ai-studio-stage--lead" aria-labelledby="ai-studio-chat-title">
      <div class="mci-home-section-heading">
        <p class="ai-studio-brand"><span aria-hidden="true"></span>Microi AI Studio</p>
        <h2 id="ai-studio-chat-title">{{ copy.chatTitle }}</h2>
        <span>{{ copy.chatDesc }}</span>
      </div>

      <div class="ai-studio-chat" :class="{ 'has-messages': messages.length }">
        <div v-if="messages.length" ref="messageArea" class="ai-studio-messages" aria-live="polite">
          <div v-for="(message, index) in messages" :key="index" class="ai-studio-message" :class="message.role">
            <span>{{ message.role === 'assistant' ? 'AI' : (locale === 'en-US' ? 'You' : '你') }}</span>
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
          <div class="ai-studio-prompts" :aria-label="copy.quickLabel">
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
          <button class="ai-studio-send" type="button" :disabled="!isAuthed || isThinking || !inputText.trim()" :aria-label="copy.sendLabel" @click="sendMessage">
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

    <section class="mci-home-hero" aria-labelledby="mci-home-title">
      <div class="mci-home-hero__copy">
        <p class="mci-home-eyebrow"><span aria-hidden="true"></span>{{ copy.eyebrow }}</p>
        <h1 id="mci-home-title">
          <span class="mci-home-title-lead"><span v-for="part in copy.titleLeadParts" :key="part">{{ part }}</span></span>
          <strong><span v-for="line in copy.titleEmphasisLines" :key="line">{{ line }}</span></strong>
        </h1>
        <p class="mci-home-hero__lead">{{ copy.lead }}</p>

        <div class="mci-home-actions">
          <a class="mci-home-action mci-home-action--primary" href="/doc/getting-started/start-use">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>
            {{ copy.primaryAction }}
          </a>
          <a class="mci-home-action mci-home-action--secondary" href="/doc/getting-started/source-code-architecture">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 4.5-8 4.5-8-4.5L12 3Z"/><path d="m4 12 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5"/></svg>
            {{ copy.secondaryAction }}
          </a>
        </div>

        <a
          v-if="locale === 'zh-CN'"
          class="mci-home-proof-link"
          href="https://blog.csdn.net/qq973702/article/details/163763831"
          target="_blank"
          rel="noopener noreferrer"
        >{{ copy.proofAction }} <span aria-hidden="true">↗</span></a>

        <ul class="mci-home-proof-points" :aria-label="copy.proofLabel">
          <li v-for="item in copy.proofPoints" :key="item"><span aria-hidden="true"></span>{{ item }}</li>
        </ul>
      </div>

      <div class="mci-home-map" role="group" aria-labelledby="mci-home-map-title">
        <div class="mci-home-map__header">
          <div>
            <span>{{ copy.mapEyebrow }}</span>
            <h2 id="mci-home-map-title">{{ copy.mapTitle }}</h2>
          </div>
          <p>{{ copy.mapDesc }}</p>
        </div>

        <div class="mci-home-map__ai">
          <span>{{ copy.aiLayer }}</span>
          <ul>
            <li v-for="tool in copy.aiTools" :key="tool">{{ tool }}</li>
          </ul>
        </div>

        <div class="mci-home-map__flow" aria-hidden="true"><i></i><i></i><i></i></div>

        <div class="mci-home-modes">
          <article v-for="mode in copy.developmentModes" :key="mode.level" :class="{ 'is-featured': mode.featured }">
            <div class="mci-home-mode__top"><span>{{ mode.level }}</span><em>{{ mode.label }}</em></div>
            <h3>{{ mode.title }}</h3>
            <p>{{ mode.description }}</p>
            <strong>{{ mode.note }}</strong>
          </article>
        </div>

        <div class="mci-home-map__flow mci-home-map__flow--down" aria-hidden="true"><i></i><i></i><i></i></div>

        <div class="mci-home-foundation">
          <span>{{ copy.foundationTitle }}</span>
          <ul><li v-for="item in copy.foundations" :key="item">{{ item }}</li></ul>
        </div>

        <div class="mci-home-outputs">
          <span>{{ copy.outputTitle }}</span>
          <ul><li v-for="item in copy.outputs" :key="item">{{ item }}</li></ul>
        </div>
      </div>
    </section>

    <section class="mci-home-values" :aria-label="copy.valueLabel">
      <article v-for="(item, index) in copy.values" :key="item.kicker">
        <span>0{{ index + 1 }}</span>
        <div>
          <p>{{ item.kicker }}</p>
          <h2>{{ item.title }}</h2>
          <small>{{ item.description }}</small>
        </div>
      </article>
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
  eyebrow: 'Open-source AI development framework',
  titleLeadParts: ['Open-source AI', 'development framework'],
  titleEmphasisLines: ['20+ mature engines'],
  lead: 'AI low-code, microservices, and the V8 engine share one delivery path. In high-reuse business scenarios, AI development can use 10×+ fewer tokens and move 10×+ faster.',
  primaryAction: 'Start building', secondaryAction: 'Explore the architecture',
  proofAction: 'See the reproducible 10×+ benchmark and scope', proofLabel: 'Platform facts',
  proofPoints: ['Evolving since 2014', 'MIT open source', 'AI low-code + microservices', '20+ mature engines'],
  mapEyebrow: 'DEVELOPMENT CONTINUUM', mapTitle: 'Use the right layer for each problem',
  mapDesc: 'Reuse standard work, keep differentiated logic flexible, and extend the foundation in source code.',
  aiLayer: 'AI collaboration', aiTools: ['Codex', 'Copilot', 'Cursor', 'Claude', 'MCP + Skills'],
  developmentModes: [
    { level: '01', label: 'Standard workflows', title: 'Visual low-code', description: 'Forms · modules · workflows · reports', note: 'FAST' },
    { level: '02', label: 'Business differentiation', title: 'Online V8 coding', description: 'APIs · events · integrations · automation', note: 'FLEXIBLE', featured: true },
    { level: '03', label: 'Deep extension', title: 'Professional code', description: '.NET · Vue · microservices · SDKs', note: 'DEEP' }
  ],
  foundationTitle: 'Shared enterprise foundation', foundations: ['Tenancy & identity', 'Data & cache', 'Workflow & messaging', 'Delivery & governance'],
  outputTitle: 'Build once, deliver everywhere', outputs: ['PC / WebOS', 'H5 / UniApp', 'SaaS / on-prem', 'AI apps / agents'],
  valueLabel: 'Why teams choose Microi',
  values: [
    { kicker: 'Ready out of the box', title: 'Reuse 20+ mature engines', description: 'AI low-code, identity, workflow, data, integration, and delivery capabilities start from a proven foundation.' },
    { kicker: 'Use 10×+ fewer tokens', title: 'Let AI focus on business change', description: 'MCP, Skills, schemas, and V8 reduce repeated framework and boilerplate generation.' },
    { kicker: 'Develop 10×+ faster', title: 'Deliver working applications sooner', description: 'Visual modeling, V8, microservices, and source extensions form one continuous delivery path.' }
  ],
  chatTitle: 'Let AI build on 20+ mature engines and deliver faster',
  chatDesc: 'Microi combines AI low-code, microservices, and the V8 engine. In high-reuse business scenarios, it can use 10×+ fewer tokens and move 10×+ faster than building from scratch.',
  placeholder: 'Describe what you want to create, understand, analyze, or accomplish...',
  chatLabel: 'Chat with Microi AI', quickLabel: 'Quick questions', sendLabel: 'Send',
  aboutTitle: 'About Microi', aboutPrompt: 'What enterprise applications is Microi best suited for?',
  archTitle: 'Architecture', archPrompt: 'Explain the Microi architecture and V8 engine.',
  appsTitle: 'Browse AI apps', safety: 'Public knowledge only — no business database access',
  loginTitle: 'Sign in to continue in Microi AI',
  loginDesc: 'The official-site AI never reads or changes private tenant data.',
  loginAction: 'Sign in / Register'
} : {
  eyebrow: '开源 AI 开发框架',
  titleLeadParts: ['开源 AI', '开发框架'],
  titleEmphasisLines: ['20+ 成熟引擎'],
  lead: '融合 AI 低代码、微服务与 V8 引擎；在平台能力高度复用的典型业务场景中，让 AI 开发更省 Token 10 倍+、速度提升 10 倍+，更快交付企业应用。',
  primaryAction: '免费开始开发', secondaryAction: '查看源码架构',
  proofAction: '查看 10 倍+ 实测与适用边界', proofLabel: '平台事实',
  proofPoints: ['始于 2014', 'MIT 开源', 'AI 低代码 + 微服务', '20+ 成熟引擎'],
  mapEyebrow: 'DEVELOPMENT CONTINUUM', mapTitle: '用合适的层，解决合适的问题',
  mapDesc: '标准业务不重复写，差异逻辑不受限，底层能力可源码扩展。',
  aiLayer: 'AI 协作层', aiTools: ['Codex', 'Copilot', 'Cursor', 'Claude', 'MCP + Skills'],
  developmentModes: [
    { level: '01', label: '标准业务', title: '可视化低代码', description: '表单 · 模块 · 流程 · 报表', note: '快' },
    { level: '02', label: '差异业务', title: 'V8 在线编程', description: '接口 · 事件 · 集成 · 自动化', note: '活', featured: true },
    { level: '03', label: '深度扩展', title: '专业代码', description: '.NET · Vue · 微服务 · SDK', note: '深' }
  ],
  foundationTitle: '共享企业级底座', foundations: ['多租户与权限', '数据与缓存', '工作流与消息', '发布与治理'],
  outputTitle: '一次构建，多端交付', outputs: ['PC / WebOS', 'H5 / UniApp', 'SaaS / 私有化', 'AI 应用 / Agent'],
  valueLabel: '选择 Microi吾码的核心理由',
  values: [
    { kicker: '开箱即用', title: '复用 20+ 成熟引擎', description: 'AI 低代码、权限、流程、数据、集成与交付能力从成熟底座起步，不再重复造轮子。' },
    { kicker: 'Token 更省 10 倍+', title: '让 AI 聚焦业务增量', description: 'MCP、Skills、实时 Schema 与 V8 减少框架解释、胶水代码和重复生成。' },
    { kicker: '速度提升 10 倍+', title: '更快交付可运行应用', description: '可视化建模、V8、微服务与源码扩展贯通一条连续开发和验收链。' }
  ],
  chatTitle: '让 AI 站在 20+ 成熟引擎上，更快交付',
  chatDesc: 'Microi吾码融合 AI 低代码、微服务与 V8 引擎；典型业务场景下，相比从零定制开发，Token 更省 10 倍+、开发速度提升 10 倍+，开箱即可进入业务开发。',
  placeholder: '描述你想创造、了解、分析或完成的任何事情...',
  chatLabel: '与 Microi AI 对话', quickLabel: '快捷问题', sendLabel: '发送',
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
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  document.querySelector('#ai-apps')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
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
