<template>
  <main class="microi-ai-studio-home" data-mci-ui-root @pointermove="trackPointer" @pointerleave="resetPointer">
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
      <div class="ai-studio-summary" aria-label="Microi 平台价值与开发路径">
        <div class="ai-studio-summary__top">
          <div class="ai-studio-summary__values">
            <article v-for="item in copy.values" :key="item.kicker">
              <strong>{{ item.kicker }}</strong>
              <span>{{ item.title }}</span>
            </article>
          </div>
          <div class="ai-studio-summary__actions">
            <a class="is-primary" :href="locale === 'en-US' ? '/en/doc/about/microi-training-syllabus' : '/doc/about/microi-training-syllabus'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h10.5A2.5 2.5 0 0 1 18 7v12.5H7.5A2.5 2.5 0 0 1 5 17V4.5Z"/><path d="M5 17a2.5 2.5 0 0 1 2.5-2.5H18M9 8h5"/></svg>
              {{ copy.primaryAction }}
            </a>
            <a :href="MICROI_CODE_DOC_URL">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="12" rx="2"/><path d="M8 20h8M12 16v4m0-13v6m0 0 2.7-2.7M12 13l-2.7-2.7"/></svg>
              {{ copy.secondaryAction }}
            </a>
          </div>
        </div>

        <div class="ai-studio-summary__path">
          <header>
            <div><span>{{ copy.mapEyebrow }}</span><h2>{{ copy.mapTitle }}</h2></div>
            <p>{{ copy.mapDesc }}</p>
          </header>
          <div class="ai-studio-summary__modes">
            <article v-for="mode in copy.developmentModes" :key="mode.level">
              <span>{{ mode.level }} · {{ mode.label }}</span>
              <h3>{{ mode.title }}</h3>
              <p>{{ mode.description }}</p>
            </article>
          </div>
          <footer>
            <p><strong>{{ copy.foundationTitle }}</strong><span v-for="item in copy.foundations" :key="item">{{ item }}</span></p>
            <p><strong>{{ copy.outputTitle }}</strong><span v-for="item in copy.outputs" :key="item">{{ item }}</span></p>
          </footer>
        </div>
      </div>
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
const MICROI_CODE_DOC_URL = '/doc/v8-engine/vs-code-plugin.html'

const isAuthed = computed(() => Boolean(authToken.value && currentUser.value?.Id))
const loginUrl = computed(() => `/login.html?redirect=${encodeURIComponent(route.path || '/')}`)
const locale = computed(() => /^\/en(?:\/|$)/.test(route.path || '') ? 'en-US' : 'zh-CN')
const copy = computed(() => locale.value === 'en-US' ? {
  eyebrow: 'Open-source AI development framework',
  titleLeadParts: ['Open-source AI', 'development framework'],
  titleEmphasisLines: ['30+ mature engines'],
  lead: 'AI low-code, microservices, and the V8 engine share one delivery path. In high-reuse business scenarios, AI development can use 10×+ fewer tokens and move 10×+ faster.',
  primaryAction: 'Training syllabus', secondaryAction: 'Download Microi Code',
  proofAction: 'See the reproducible 10×+ benchmark and scope', proofLabel: 'Platform facts',
  proofPoints: ['Evolving since 2014', 'MIT open source', 'AI low-code + microservices', '30+ mature engines'],
  mapEyebrow: 'DEVELOPMENT CONTINUUM', mapTitle: 'Use the right layer for each problem',
  mapDesc: 'Low-code, V8, and microservices share one AI-ready foundation.',
  aiLayer: 'AI collaboration', aiTools: ['Microi Code', 'Codex', 'Copilot', 'Cursor', 'Claude', 'MCP + Skills'],
  developmentModes: [
    { level: '01', label: 'Standard workflows', title: 'AI low-code development', description: '30+ engines · forms · modules · workflows · reports', note: 'READY' },
    { level: '02', label: 'Business differentiation', title: 'V8 engine AI coding', description: 'APIs · events · integrations · automation · instant activation', note: 'TOKEN-SMART', featured: true },
    { level: '03', label: 'Deep customization', title: 'Microservice customization', description: 'Vue · UniApp · Unity · .NET extensions', note: 'DELIVER' }
  ],
  foundationTitle: 'Shared enterprise foundation', foundations: ['Tenancy & identity', 'Data & cache', 'Workflow & messaging', 'Delivery & governance'],
  outputTitle: 'Build once, deliver everywhere', outputs: ['PC / WebOS', 'H5 / UniApp', 'SaaS / on-prem', 'AI apps / agents'],
  valueLabel: 'Why teams choose Microi',
  values: [
    { kicker: 'Ready out of the box', title: 'Reuse 30+ mature engines', description: 'AI low-code, identity, workflow, data, integration, and delivery capabilities start from a proven foundation.' },
    { kicker: 'Use 10×+ fewer tokens', title: 'Let AI focus on business change', description: 'MCP, Skills, schemas, and V8 reduce repeated framework and boilerplate generation.' },
    { kicker: 'Develop 10×+ faster', title: 'Deliver working applications sooner', description: 'Visual modeling, V8, microservices, and source extensions form one continuous delivery path.' }
  ],
  chatTitle: 'Open-source AI development framework, built on 30+ mature engines',
  chatDesc: 'AI low-code, V8, and microservices share one delivery foundation, so teams can focus on real business change.',
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
  titleEmphasisLines: ['30+ 成熟引擎'],
  lead: '融合 AI 低代码、微服务与 V8 引擎；在平台能力高度复用的典型业务场景中，让 AI 开发更省 Token 10 倍+、速度提升 10 倍+，更快交付企业应用。',
  primaryAction: '查看培训大纲', secondaryAction: '下载 Microi Code',
  proofAction: '查看 10 倍+ 实测与适用边界', proofLabel: '平台事实',
  proofPoints: ['始于 2014', 'MIT 开源', 'AI 低代码 + 微服务', '30+ 成熟引擎'],
  mapEyebrow: 'DEVELOPMENT CONTINUUM', mapTitle: '用合适的层，解决合适的问题',
  mapDesc: '低代码、V8 与微服务共用一套可复用的 AI 开发底座。',
  aiLayer: 'AI 协作层', aiTools: ['Microi Code', 'Codex', 'Copilot', 'Cursor', 'Claude', 'MCP + Skills'],
  developmentModes: [
    { level: '01', label: '标准业务', title: 'AI 低代码开发', description: '30+ 引擎 · 表单 · 模块 · 流程 · 报表', note: '开箱即用' },
    { level: '02', label: '差异逻辑', title: 'V8 引擎 AI 编程', description: '接口 · 事件 · 集成 · 自动化 · 保存即生效', note: '更省 Token', featured: true },
    { level: '03', label: '深度定制', title: '微服务定制', description: 'Vue · UniApp · Unity · .NET 扩展', note: '更快交付' }
  ],
  foundationTitle: '共享企业级底座', foundations: ['多租户与权限', '数据与缓存', '工作流与消息', '发布与治理'],
  outputTitle: '一次构建，多端交付', outputs: ['PC / WebOS', 'H5 / UniApp', 'SaaS / 私有化', 'AI 应用 / Agent'],
  valueLabel: '选择 Microi吾码的核心理由',
  values: [
    { kicker: '开箱即用', title: '复用 30+ 成熟引擎', description: 'AI 低代码、权限、流程、数据、集成与交付能力从成熟底座起步，不再重复造轮子。' },
    { kicker: 'Token 更省 10 倍+', title: '让 AI 聚焦业务增量', description: 'MCP、Skills、实时 Schema 与 V8 减少框架解释、胶水代码和重复生成。' },
    { kicker: '速度提升 10 倍+', title: '更快交付可运行应用', description: '可视化建模、V8、微服务与源码扩展贯通一条连续开发和验收链。' }
  ],
  chatTitle: '开源 AI 开发框架，让 AI 站在 30+ 成熟引擎上，更快交付',
  chatDesc: 'AI 低代码、V8 与微服务共用一套成熟底座，减少重复生成，直接进入业务交付。',
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

function trackPointer(event) {
  if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const root = event.currentTarget
  const rect = root.getBoundingClientRect()
  root.style.setProperty('--mci-home-pointer-x', `${event.clientX - rect.left}px`)
  root.style.setProperty('--mci-home-pointer-y', `${event.clientY - rect.top}px`)
  root.style.setProperty('--mci-home-pointer-opacity', '.72')
}

function resetPointer(event) {
  event.currentTarget.style.setProperty('--mci-home-pointer-opacity', '.28')
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
