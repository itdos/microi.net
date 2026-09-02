<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type DeckPanel = '' | 'help'

const pdfDownloadPath = '/downloads/microi-ai-development-framework-training-syllabus.pdf'

const slideMeta = [
  { id: 'opening', chapter: '00', nav: '开场', title: 'Microi吾码 AI 开发框架', summary: '从需求蓝图到生产上线的一体化技术培训。' },
  { id: 'acceleration', chapter: '01', nav: '10× 方法', title: '让 AI 复用平台，而不是重复发明系统', summary: 'Schema、MCP、Skills 与成熟引擎共同压缩上下文、代码量和返工。' },
  { id: 'positioning', chapter: '02', nav: '连续开发', title: '四层连续开发，复杂度逐级上移', summary: 'AI 低代码、V8、微服务与专业源码在同一框架内协作。' },
  { id: 'architecture', chapter: '03', nav: '技术架构', title: '一套底座，承接多端与多租户', summary: '客户端、引擎层、运行时与数据基础设施职责清晰。' },
  { id: 'mcp-delivery', chapter: '04', nav: 'MCP 智能交付', title: 'MCP 让 AI 真正理解、操作并验收平台', summary: '从真实结构到 Dry Run、受控写入与结果回读，形成可审计交付闭环。' },
  { id: 'engine-map', chapter: '05', nav: '引擎全景', title: '20+ 成熟引擎组成平台能力矩阵', summary: '围绕业务建模、自动化、集成、AI 与交付形成完整闭环。' },
  { id: 'form-engine', chapter: '06', nav: '表单引擎', title: '万物皆表单引擎', summary: '从物理表到字段、表单、列表、权限与跨端呈现。' },
  { id: 'v8-engine', chapter: '07', nav: 'V8 / API', title: '在线编程，把差异化逻辑留在业务现场', summary: '统一访问数据、缓存、HTTP、文件、消息与当前租户上下文。' },
  { id: 'experience-engines', chapter: '08', nav: '体验引擎', title: '模块、界面、报表、打印共同塑造业务体验', summary: '同一份数据模型可以被组织成多种可用界面。' },
  { id: 'automation', chapter: '09', nav: '流程自动化', title: '让流程、任务与消息可靠地流动', summary: '审批工作流、任务调度、消息队列与通知中心协同运行。' },
  { id: 'ai-engine', chapter: '10', nav: 'AI 引擎', title: 'AI 不是外挂，而是进入开发链路', summary: '从 Schema 理解、代码生成到知识与智能工作流，始终受权限约束。' },
  { id: 'data-integration', chapter: '11', nav: '数据集成', title: '连接企业数据、设备与外部服务', summary: '结构化数据、文件、Office、搜索、IoT 与第三方协议统一编排。' },
  { id: 'saas-security', chapter: '12', nav: 'SaaS 与安全', title: '租户隔离、权限与审计从第一天进入设计', summary: '身份、菜单、字段、数据范围和敏感操作共同构成安全边界。' },
  { id: 'multi-end', chapter: '13', nav: '多端与微服务', title: '一套业务能力，进入每一个终端', summary: 'PC、WebOS、H5、UniApp、小程序与独立微应用共享平台能力。' },
  { id: 'deployment', chapter: '14', nav: '部署运维', title: '从开发环境到可观测的生产集群', summary: 'Docker、Windows、滚动升级、共享依赖与运行监控组成交付底座。' },
  { id: 'workshop', chapter: '15', nav: '实战工作坊', title: '用一个真实业务闭环完成能力串联', summary: '蓝图、建模、逻辑、流程、多端和验收在同一个练习中完成。' },
  { id: 'schedule', chapter: '16', nav: '课程安排', title: '建议 3 天 · 18 学时 · 1 个结业作品', summary: '可以按团队角色和项目阶段裁剪为基础、进阶或专项课程。' },
  { id: 'closing', chapter: '17', nav: '结业目标', title: '从会使用，到能独立交付', summary: '把平台能力转化为可复用的方法、工程资产与验收证据。' },
] as const

const accelerationLevers = [
  { code: 'SCHEMA', title: '上下文更短', text: '只读真实表、字段、菜单与权限。' },
  { code: 'ENGINE', title: '生成量更少', text: '20+ 引擎直接复用成熟能力。' },
  { code: 'VERIFY', title: '返工更少', text: 'Dry Run、校验与回读形成闭环。' },
]

const architectureLayers = [
  { label: '体验端', note: '面向用户与场景', items: ['PC 管理端', 'WebOS', 'MicroService', 'UniApp / H5', '小程序', 'Unity / 3D'] },
  { label: '开发面', note: '面向业务交付', items: ['AI Studio', '表单 / 模块', 'V8 / API', '工作流', 'MCP + Skills', 'VS Code'] },
  { label: '引擎层', note: '面向能力复用', items: ['数据与缓存', '文件与 Office', '消息与任务', '搜索与采集', '报表与打印', 'AI 与知识'] },
  { label: '运行时', note: '面向生产治理', items: ['.NET 10', 'Vue 3', 'Redis', '多数据库', '对象存储', '可观测性'] },
]

const mcpDeliverySteps = [
  { no: '01', name: '理解', detail: 'Schema + 蓝图' },
  { no: '02', name: '规划', detail: 'Manifest' },
  { no: '03', name: '预演', detail: 'Dry Run' },
  { no: '04', name: '执行', detail: '受控写入' },
  { no: '05', name: '验收', detail: '回读 + 测试' },
]

const mcpCapabilityGroups = ['表 / 字段', '模块 / 权限', 'V8 / 工作流', '微服务 / 发布', '验证 / 回读']

const engineGroups = [
  { key: 'build', label: '业务构建', count: '6', items: ['表单', '模块', '工作流', '界面', '报表', '打印'] },
  { key: 'data', label: '数据与集成', count: '7', items: ['数据源', '缓存', '搜索', '文件', 'Office', 'OCR', '多数据库'] },
  { key: 'connect', label: '连接与自动化', count: '7', items: ['任务', 'MQ', 'MQTT', '通知', '翻译', '采集', 'HTTP / TCP'] },
  { key: 'intelligence', label: 'AI 与交付', count: '6+', items: ['AI', 'AI 工作流', '业务蓝图', '微服务', '应用商城', '系统观测'] },
]

const formStages = ['创建物理表', '设计字段与布局', '生成表单 / 列表', '绑定模块与菜单', '配置角色与数据范围']

const experienceCards = [
  { code: 'MODULE', title: '模块引擎', text: '把表格、表单、按钮、搜索、排序与权限组织成业务入口。', tags: ['Diy', 'Component', 'Iframe', 'SecondMenu'] },
  { code: 'PAGE', title: '界面引擎', text: '组合指标、图表、列表与交互，构建工作台和驾驶舱。', tags: ['Layout', 'Chart', 'DataSource'] },
  { code: 'REPORT', title: '报表引擎', text: '用数据源、字典与参数形成可查询、可导出的业务报表。', tags: ['Query', 'Dictionary', 'Export'] },
  { code: 'PRINT', title: '打印引擎', text: '在线制作模板，将业务数据转换为合同、标签与业务单据。', tags: ['Template', 'Preview', 'Output'] },
]

const aiCapabilities = [
  { name: 'AI Studio', text: '从自然语言进入业务方案与开发任务。' },
  { name: 'Schema 理解', text: '关键词扩展、权限感知检索与精确字段回读。' },
  { name: 'AI 编程', text: '生成并校验 V8、接口、表单与微服务代码。' },
  { name: 'NL2SQL / NL2V8', text: '将业务问题转成受约束的数据查询与逻辑。' },
  { name: '知识与模型', text: '统一模型路由、知识检索与可选语义召回。' },
  { name: 'AI 工作流', text: '用有界节点编排模型、工具、数据与人工环节。' },
]

const integrationSources = ['MySQL / SQL Server / Oracle', 'MongoDB / Redis', 'OSS / MinIO / S3', 'Excel / Word / PowerPoint', 'HTTP / TCP / gRPC', 'MQ / MQTT / IoT']
const integrationOutputs = ['接口引擎', '数据源', '搜索索引', '任务调度', '消息通知', '业务报表']

const devices = [
  { glyph: '▣', title: 'PC 管理端', text: '高密度业务管理、设计与运营' },
  { glyph: '◇', title: 'WebOS', text: '桌面化入口与多任务体验' },
  { glyph: '◫', title: 'MicroService', text: '独立运行或嵌入平台的复杂页面' },
  { glyph: '▥', title: 'UniApp / H5', text: 'App、移动网页与混合容器' },
  { glyph: '⌁', title: '小程序', text: '微信、支付宝等轻量终端' },
  { glyph: '⬡', title: 'Unity / 3D', text: '数字孪生、WebGL 与沉浸场景' },
]

const workshopSteps = [
  { no: '01', title: '业务蓝图', text: '明确角色、状态机、数据实体、菜单与验收口径。' },
  { no: '02', title: '模型生成', text: '创建表、字段、索引、表单 Banner、菜单与权限。' },
  { no: '03', title: '逻辑编排', text: '用 V8 完成校验、事务、外部接口和业务动作。' },
  { no: '04', title: '流程自动化', text: '接入审批、任务、通知与异常补偿。' },
  { no: '05', title: '多端体验', text: '交付 PC 列表、移动端入口与一个微服务页面。' },
  { no: '06', title: '发布验收', text: '完成构建、权限、业务闭环、截图与发布回读。' },
]

const scheduleDays = [
  { day: 'DAY 01', title: '平台与业务建模', hours: '6 学时', items: ['平台定位与技术架构', '环境搭建与租户模型', '业务蓝图与数据建模', '表单、模块、菜单与权限'] },
  { day: 'DAY 02', title: '逻辑与自动化', hours: '6 学时', items: ['V8 / 接口引擎', '事务、缓存与外部集成', '工作流与任务调度', '报表、打印与消息通知'] },
  { day: 'DAY 03', title: 'AI 与生产交付', hours: '6 学时', items: ['AI Studio 与 Schema', '微服务与多端开发', '部署、观测与安全', '综合实战与结业评审'] },
]

const deckRef = ref<HTMLElement | null>(null)
const panelCloseRef = ref<HTMLButtonElement | null>(null)
const thumbnailRailRef = ref<HTMLElement | null>(null)
const pdfDownloadRef = ref<HTMLAnchorElement | null>(null)
const activeIndex = ref(0)
const direction = ref<'next' | 'prev'>('next')
const activePanel = ref<DeckPanel>('')
const isFullscreen = ref(false)
const isPaused = ref(false)
const isArtifactCapture = ref(false)
const captureScale = ref(1)
const notice = ref('')
const currentSlide = computed(() => slideMeta[activeIndex.value])
const progress = computed(() => ((activeIndex.value + 1) / slideMeta.length) * 100)

let wheelLockedUntil = 0
let pointerStart: { id: number; x: number; y: number } | null = null
let noticeTimer = 0
let focusBeforePanel: HTMLElement | null = null

function padSlide(index: number) {
  return String(index + 1).padStart(2, '0')
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest('a, button, input, textarea, select, [contenteditable="true"]'))
}

function announce(message: string) {
  notice.value = message
  window.clearTimeout(noticeTimer)
  noticeTimer = window.setTimeout(() => { notice.value = '' }, 2600)
}

function updateHash(index: number) {
  if (typeof window === 'undefined') return
  const nextHash = `#slide-${padSlide(index)}`
  if (window.location.hash !== nextHash) window.history.replaceState(null, '', nextHash)
}

function goTo(index: number, nextDirection?: 'next' | 'prev') {
  const nextIndex = Math.max(0, Math.min(slideMeta.length - 1, index))
  if (nextIndex === activeIndex.value) return
  direction.value = nextDirection || (nextIndex > activeIndex.value ? 'next' : 'prev')
  activeIndex.value = nextIndex
  activePanel.value = ''
  updateHash(nextIndex)
  scrollActiveThumbnail()
}

function scrollActiveThumbnail(moveFocus = false) {
  nextTick(() => {
    const button = thumbnailRailRef.value?.querySelector<HTMLButtonElement>(`[data-slide-index="${activeIndex.value}"]`)
    button?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    if (moveFocus) button?.focus()
  })
}

function nextSlide() {
  goTo(activeIndex.value + 1, 'next')
}

function previousSlide() {
  goTo(activeIndex.value - 1, 'prev')
}

function openPanel(panel: Exclude<DeckPanel, ''>) {
  focusBeforePanel = document.activeElement instanceof HTMLElement ? document.activeElement : null
  activePanel.value = panel
  nextTick(() => panelCloseRef.value?.focus())
}

function closePanel() {
  activePanel.value = ''
  nextTick(() => focusBeforePanel?.focus())
}

async function toggleFullscreen() {
  if (!deckRef.value) return
  try {
    if (!document.fullscreenElement) await deckRef.value.requestFullscreen()
    else await document.exitFullscreen()
  } catch {
    announce('当前浏览器未允许全屏，请使用浏览器菜单进入全屏。')
  }
}

function downloadPdf() {
  activePanel.value = ''
  pdfDownloadRef.value?.click()
}

function handleKeydown(event: KeyboardEvent) {
  const key = event.key
  if (key === 'Escape' && activePanel.value) {
    event.preventDefault()
    closePanel()
    return
  }
  if (activePanel.value) return
  if (isInteractiveTarget(event.target) && (key === ' ' || key === 'Enter')) return

  if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(key)) {
    event.preventDefault()
    nextSlide()
  } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(key)) {
    event.preventDefault()
    previousSlide()
  } else if (key === 'Home') {
    event.preventDefault()
    goTo(0, 'prev')
  } else if (key === 'End') {
    event.preventDefault()
    goTo(slideMeta.length - 1, 'next')
  } else if (key.toLowerCase() === 'o') {
    event.preventDefault()
    scrollActiveThumbnail(true)
  } else if (key === '?' || key.toLowerCase() === 'h') {
    event.preventDefault()
    openPanel('help')
  } else if (key.toLowerCase() === 'f') {
    event.preventDefault()
    void toggleFullscreen()
  } else if (key.toLowerCase() === 'p' && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    downloadPdf()
  }
}

function handleWheel(event: WheelEvent) {
  if (activePanel.value || Date.now() < wheelLockedUntil) return
  if (event.target instanceof Element && event.target.closest('.mci-training-deck__rail')) return
  const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX
  if (Math.abs(primaryDelta) < 36) return

  if (Math.abs(event.deltaY) >= Math.abs(event.deltaX) && event.target instanceof Element) {
    const frame = event.target.closest('.mci-training-slide.is-active .mci-training-slide__frame') as HTMLElement | null
    if (frame && frame.scrollHeight > frame.clientHeight + 2) {
      const atStart = frame.scrollTop <= 1
      const atEnd = frame.scrollTop + frame.clientHeight >= frame.scrollHeight - 1
      if ((event.deltaY > 0 && !atEnd) || (event.deltaY < 0 && !atStart)) return
    }
  }

  wheelLockedUntil = Date.now() + 620
  if (primaryDelta > 0) nextSlide()
  else previousSlide()
}

function handlePointerDown(event: PointerEvent) {
  if (activePanel.value || isInteractiveTarget(event.target) || event.button !== 0) return
  pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY }
  deckRef.value?.setPointerCapture?.(event.pointerId)
}

function handlePointerUp(event: PointerEvent) {
  if (!pointerStart || pointerStart.id !== event.pointerId) return
  const deltaX = event.clientX - pointerStart.x
  const deltaY = event.clientY - pointerStart.y
  pointerStart = null
  if (Math.abs(deltaX) < 58 || Math.abs(deltaX) < Math.abs(deltaY) * 1.1) return
  if (deltaX < 0) nextSlide()
  else previousSlide()
}

function handleFullscreenChange() {
  isFullscreen.value = document.fullscreenElement === deckRef.value
}

function handleVisibilityChange() {
  isPaused.value = document.hidden
}

function handleHashChange() {
  const match = /^#slide-(\d{2})$/u.exec(window.location.hash)
  if (!match) return
  const index = Number(match[1]) - 1
  if (index >= 0 && index < slideMeta.length && index !== activeIndex.value) goTo(index)
}

onMounted(() => {
  isArtifactCapture.value = new URLSearchParams(window.location.search).has('artifact-capture')
  if (isArtifactCapture.value) captureScale.value = Math.min(window.innerWidth / 1600, window.innerHeight / 900)
  handleHashChange()
  scrollActiveThumbnail()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('hashchange', handleHashChange)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('hashchange', handleHashChange)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.clearTimeout(noticeTimer)
})
</script>

<template>
  <div
    ref="deckRef"
    class="mci-training-deck mci-page"
    data-mci-ui-root="training-syllabus-deck"
    data-mci-shape="rounded"
    :data-direction="direction"
    :class="{ 'is-paused': isPaused, 'is-fullscreen': isFullscreen, 'is-artifact-capture': isArtifactCapture }"
    :style="isArtifactCapture ? { '--mci-deck-capture-scale': captureScale } : undefined"
    role="region"
    aria-label="Microi吾码 AI 开发框架技术培训幻灯片"
    @wheel="handleWheel"
    @pointerdown="handlePointerDown"
    @pointerup="handlePointerUp"
    @pointercancel="pointerStart = null"
  >
    <div class="mci-training-deck__atmosphere" aria-hidden="true">
      <i></i><i></i><i></i>
    </div>

    <a class="mci-training-deck__skip" href="#mci-training-controls">跳到演示控制</a>

    <header class="mci-training-deck__topbar">
      <button class="mci-training-brand" type="button" aria-label="返回第一张幻灯片" @click="goTo(0, 'prev')">
        <img src="/icon.png" alt="" aria-hidden="true">
        <span><strong>Microi吾码</strong><small>AI DEVELOPMENT FRAMEWORK</small></span>
      </button>
      <div class="mci-training-deck__top-actions" aria-label="演示工具">
        <button type="button" aria-label="查看操作帮助" aria-keyshortcuts="H" title="操作帮助（H / ?）" @click="openPanel('help')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.2 2.26c-.7.32-1 .76-1 1.49M12 17h.01"/></svg>
          <span>帮助</span>
        </button>
        <button type="button" aria-label="切换全屏" aria-keyshortcuts="F" :title="`${isFullscreen ? '退出' : '进入'}全屏（F）`" @click="toggleFullscreen">
          <svg v-if="!isFullscreen" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>
          <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>
          <span>{{ isFullscreen ? '退出' : '全屏' }}</span>
        </button>
        <a ref="pdfDownloadRef" class="is-primary" :href="pdfDownloadPath" download aria-label="下载预生成 PDF" aria-keyshortcuts="P" title="下载 PDF（P）">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7zM14 3v5h5M10 15h4M12 11v7m0 0-2-2m2 2 2-2"/></svg>
          <span>下载 PDF</span>
        </a>
      </div>
    </header>

    <aside class="mci-training-deck__rail mci-screen-only" aria-label="幻灯片缩略图导航">
      <header><span>SLIDES</span><strong>{{ slideMeta.length }}</strong></header>
      <nav ref="thumbnailRailRef">
        <button
          v-for="(slide, index) in slideMeta"
          :key="`thumbnail-${slide.id}`"
          type="button"
          :data-slide-index="index"
          :class="{ 'is-active': index === activeIndex }"
          :aria-current="index === activeIndex ? 'page' : undefined"
          :aria-label="`第 ${index + 1} 页：${slide.title}`"
          @click="goTo(index)"
        >
          <span class="mci-training-deck__thumbnail">
            <img :src="`/images/training-deck/thumbs/slide-${padSlide(index)}.webp`" :alt="`${slide.title}预览图`" loading="lazy">
            <i>{{ padSlide(index) }}</i>
          </span>
          <span class="mci-training-deck__thumbnail-copy"><strong>{{ slide.nav }}</strong><small>{{ slide.title }}</small></span>
        </button>
      </nav>
    </aside>

    <main class="mci-training-deck__stage" aria-live="off">
      <section
        v-for="(slide, index) in slideMeta"
        :key="slide.id"
        :id="`mci-training-${slide.id}`"
        class="mci-training-slide"
        :class="[`is-${slide.id}`, { 'is-active': index === activeIndex }]"
        :aria-hidden="index === activeIndex ? 'false' : 'true'"
        :inert="index === activeIndex ? undefined : true"
        role="group"
        aria-roledescription="slide"
        :aria-label="`${index + 1} / ${slideMeta.length}，${slide.title}`"
      >
        <div class="mci-training-slide__frame">
          <template v-if="slide.id === 'opening'">
            <div class="mci-deck-cover-copy">
              <p class="mci-deck-eyebrow mci-deck-reveal">MICROI · TECHNICAL TRAINING 2026</p>
              <h1 class="mci-deck-cover-title mci-deck-reveal">
                <span>Microi吾码</span>
                <strong>AI 开发框架</strong>
                <em>技术培训大纲</em>
              </h1>
              <p class="mci-deck-cover-lead mci-deck-reveal">从业务蓝图、AI 低代码、V8 在线编程，到微服务、多端体验与生产交付。</p>
              <div class="mci-deck-cover-metrics mci-deck-reveal" aria-label="培训核心数据">
                <span><strong>20+</strong> 成熟引擎</span>
                <span><strong>4</strong> 层开发路径</span>
                <span><strong>1</strong> 个完整实战</span>
              </div>
              <button class="mci-deck-start mci-deck-reveal mci-screen-only" type="button" @click="nextSlide">
                开始演示
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
              </button>
            </div>
            <div class="mci-deck-core-visual mci-deck-reveal" aria-label="Microi 四层开发能力示意图">
              <div class="mci-deck-core-orbit is-outer"><span>专业源码</span><i></i><i></i></div>
              <div class="mci-deck-core-orbit is-middle"><span>微服务</span><i></i><i></i></div>
              <div class="mci-deck-core-orbit is-inner"><span>V8</span><i></i></div>
              <div class="mci-deck-core-mark"><img src="/icon.png" alt="Microi吾码"><strong>AI</strong><small>LOW-CODE CORE</small></div>
            </div>
          </template>

          <template v-else-if="slide.id === 'acceleration'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · WHY 10×</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div>
              <span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-acceleration">
              <div class="mci-deck-acceleration__compare mci-deck-reveal" aria-label="传统 AI 开发与 Microi AI 开发相对工作量示意">
                <article class="is-traditional">
                  <header><span>传统 AI 开发</span><strong>100</strong><small>相对工作量</small></header>
                  <div><i></i></div>
                  <p>重复读上下文 · 重写基础设施 · 反复联调</p>
                </article>
                <div class="mci-deck-acceleration__gain"><span>UP TO</span><strong>10×+</strong><small>更省 Token · 更快交付</small></div>
                <article class="is-microi">
                  <header><span>Microi + MCP</span><strong>≤ 10</strong><small>相对工作量</small></header>
                  <div><i></i></div>
                  <p>真实 Schema · 成熟引擎 · 受控执行与回读</p>
                </article>
              </div>
              <div class="mci-deck-acceleration__levers">
                <article v-for="(lever, leverIndex) in accelerationLevers" :key="lever.code" class="mci-deck-reveal" :style="{ '--mci-deck-order': leverIndex + 1 }"><span>{{ lever.code }}</span><strong>{{ lever.title }}</strong><small>{{ lever.text }}</small></article>
              </div>
            </div>
            <p class="mci-deck-footnote mci-deck-reveal"><strong>适用边界</strong>：10×+ 指平台能力高复用的典型企业场景，实际收益取决于需求、团队与基线，不构成无条件承诺。</p>
          </template>

          <template v-else-if="slide.id === 'positioning'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · PLATFORM DNA</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-positioning">
              <div class="mci-deck-thesis mci-deck-reveal">
                <p>唯一主定位</p><strong>开源 AI 开发框架</strong>
                <blockquote>让成熟平台能力承接通用工作，让团队把时间留给真正有差异的业务。</blockquote>
              </div>
              <div class="mci-deck-continuum-map mci-deck-reveal" aria-label="连续开发体系">
                <article><span>01</span><strong>AI 低代码</strong><small>可视化建模</small></article>
                <i aria-hidden="true"></i>
                <article><span>02</span><strong>V8 引擎</strong><small>在线业务逻辑</small></article>
                <i aria-hidden="true"></i>
                <article><span>03</span><strong>微服务</strong><small>复杂交互体验</small></article>
                <i aria-hidden="true"></i>
                <article><span>04</span><strong>专业源码</strong><small>底层能力扩展</small></article>
              </div>
            </div>
            <div class="mci-deck-proof-strip mci-deck-reveal">
              <span><strong>20+</strong> 引擎开箱即用</span><span><strong>10 倍+</strong> Token 更省*</span><span><strong>10 倍+</strong> 交付更快*</span><small>* 典型平台能力高复用场景，不构成无条件性能承诺。</small>
            </div>
          </template>

          <template v-else-if="slide.id === 'architecture'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · ARCHITECTURE</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-architecture">
              <article v-for="(layer, layerIndex) in architectureLayers" :key="layer.label" class="mci-deck-architecture__layer mci-deck-reveal" :style="{ '--mci-deck-order': layerIndex }">
                <div><span>0{{ layerIndex + 1 }}</span><strong>{{ layer.label }}</strong><small>{{ layer.note }}</small></div>
                <ul><li v-for="item in layer.items" :key="item">{{ item }}</li></ul>
              </article>
            </div>
            <div class="mci-deck-architecture__base mci-deck-reveal"><span>OsClient 租户边界</span><i></i><span>DiyToken 身份上下文</span><i></i><span>应用商城声明式升级</span></div>
          </template>

          <template v-else-if="slide.id === 'mcp-delivery'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · MCP DELIVERY LOOP</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-mcp-layout">
              <div class="mci-deck-mcp-loop mci-deck-reveal" aria-label="MCP 智能交付闭环">
                <div class="mci-deck-mcp-loop__core"><span>MICROI</span><strong>MCP</strong><small>TOOLS · SCHEMA · CONTEXT</small><i></i></div>
                <article v-for="(step, stepIndex) in mcpDeliverySteps" :key="step.no" :class="`is-step-${stepIndex + 1}`" :style="{ '--mci-deck-order': stepIndex }"><span>{{ step.no }}</span><strong>{{ step.name }}</strong><small>{{ step.detail }}</small></article>
              </div>
              <div class="mci-deck-mcp-stack">
                <article class="mci-deck-reveal"><span>01 · TOOLS</span><strong>可操作</strong><small>AI 直接调用平台工具，不靠猜测生成 SQL。</small><ul><li v-for="group in mcpCapabilityGroups" :key="group">{{ group }}</li></ul></article>
                <article class="mci-deck-reveal"><span>02 · SKILLS</span><strong>有方法</strong><small>把建模、安全、交付和验收规则注入每次开发。</small><div><i>事实源</i><i>租户边界</i><i>安全门禁</i><i>质量证据</i></div></article>
              </div>
            </div>
            <div class="mci-deck-rule mci-deck-reveal"><span>交付闭环</span><strong>读取事实 → 生成计划 → Dry Run → 授权执行 → 远端回读 → 自动化验收</strong></div>
          </template>

          <template v-else-if="slide.id === 'engine-map'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · ENGINE MATRIX</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-engine-groups">
              <article v-for="(group, groupIndex) in engineGroups" :key="group.key" class="mci-deck-engine-group mci-deck-reveal" :class="`is-${group.key}`" :style="{ '--mci-deck-order': groupIndex }">
                <header><span>{{ group.count }}</span><div><small>ENGINE DOMAIN</small><h3>{{ group.label }}</h3></div></header>
                <ul><li v-for="item in group.items" :key="item">{{ item }}</li></ul>
              </article>
            </div>
            <p class="mci-deck-footnote mci-deck-reveal"><strong>关键认识</strong>：引擎不是孤岛；数据、身份、租户、权限、事件和发布过程贯穿所有能力。</p>
          </template>

          <template v-else-if="slide.id === 'form-engine'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · FORM ENGINE</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-form-flow mci-deck-reveal">
              <template v-for="(stage, stageIndex) in formStages" :key="stage">
                <article><span>0{{ stageIndex + 1 }}</span><strong>{{ stage }}</strong></article><i v-if="stageIndex < formStages.length - 1" aria-hidden="true">→</i>
              </template>
            </div>
            <div class="mci-deck-feature-grid is-three">
              <article class="mci-deck-feature mci-deck-reveal"><span>FIELD</span><h3>40+ 控件与字段能力</h3><p>文本、选择、关联、子表、上传、富文本、地图、代码与布局控件。</p></article>
              <article class="mci-deck-feature mci-deck-reveal"><span>EVENT</span><h3>前后端 V8 事件体系</h3><p>初始化、提交校验、事务前后处理、数据过滤与关闭回调。</p></article>
              <article class="mci-deck-feature mci-deck-reveal"><span>VIEW</span><h3>一表多模块、多视图</h3><p>同一实体可面向不同角色形成列表、卡片、详情、流程和报表。</p></article>
            </div>
          </template>

          <template v-else-if="slide.id === 'v8-engine'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · V8 & API ENGINE</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-v8-layout">
              <div class="mci-deck-code-window mci-deck-reveal" aria-label="V8 接口引擎代码示例">
                <header><i></i><i></i><i></i><span>order-query.js</span><small>SERVER · JINT</small></header>
                <pre><code><b>var</b> result = V8.FormEngine.GetTableData(
  <em>'Biz_Order'</em>, {
    _Where: [[<em>'Status'</em>, <em>'='</em>, V8.Param.Status]],
    _SelectFields: [<em>'Id'</em>, <em>'OrderNo'</em>, <em>'Amount'</em>],
    _PageIndex: 1,
    _PageSize: 20
  }
);

<b>return</b> { Code: 1, Data: result.Data };</code></pre>
              </div>
              <div class="mci-deck-v8-capabilities">
                <article class="mci-deck-reveal"><span>DATA</span><strong>FormEngine · Db · MongoDb</strong><small>参数化查询、事务与多数据源。</small></article>
                <article class="mci-deck-reveal"><span>CONNECT</span><strong>Http · Tcp · MQ · MQTT</strong><small>连接服务、设备与异步消息。</small></article>
                <article class="mci-deck-reveal"><span>PLATFORM</span><strong>Cache · Office · File · AI</strong><small>复用平台级原子能力。</small></article>
                <article class="mci-deck-reveal"><span>CONTEXT</span><strong>CurrentUser · OsClient · DiyToken</strong><small>业务逻辑始终处在可信上下文。</small></article>
              </div>
            </div>
            <div class="mci-deck-transaction-note mci-deck-reveal"><strong>接口引擎事务语义</strong><span><code>Code = 1</code> 自动提交</span><span><code>Code ≠ 1</code> 自动回滚</span><small>业务异常返回可理解的 Msg，禁止手动提交或回滚。</small></div>
          </template>

          <template v-else-if="slide.id === 'experience-engines'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · EXPERIENCE ENGINES</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-experience-grid">
              <article v-for="(card, cardIndex) in experienceCards" :key="card.code" class="mci-deck-experience-card mci-deck-reveal" :style="{ '--mci-deck-order': cardIndex }">
                <span>{{ card.code }}</span><h3>{{ card.title }}</h3><p>{{ card.text }}</p><ul><li v-for="tag in card.tags" :key="tag">{{ tag }}</li></ul>
              </article>
            </div>
            <div class="mci-deck-rule mci-deck-reveal"><span>一表多用</span><strong>一张业务表 → 多个模块 → 多套权限 → 多个流程 → 多种报表与终端体验</strong></div>
          </template>

          <template v-else-if="slide.id === 'automation'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · PROCESS AUTOMATION</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-workflow mci-deck-reveal" aria-label="业务流程示意">
              <article><span>START</span><strong>业务提交</strong><small>表单事件校验</small></article><i>→</i>
              <article><span>ROUTE</span><strong>条件判断</strong><small>V8 决定走向</small></article><i>→</i>
              <article class="is-highlight"><span>APPROVE</span><strong>多级审批</strong><small>同意 / 退回 / 撤回</small></article><i>→</i>
              <article><span>ACTION</span><strong>业务落地</strong><small>状态与数据写入</small></article><i>→</i>
              <article><span>END</span><strong>归档闭环</strong><small>报表与审计</small></article>
            </div>
            <div class="mci-deck-automation-rails">
              <article class="mci-deck-reveal"><span>JOB</span><strong>时间驱动</strong><small>定时扫描、超时、补偿与批处理</small></article>
              <article class="mci-deck-reveal"><span>MQ</span><strong>事件驱动</strong><small>可靠投递、消费与幂等处理</small></article>
              <article class="mci-deck-reveal"><span>NOTICE</span><strong>人机协同</strong><small>站内信、待办与多通道通知</small></article>
            </div>
          </template>

          <template v-else-if="slide.id === 'ai-engine'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · AI NATIVE</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-ai-layout">
              <div class="mci-deck-ai-core mci-deck-reveal"><span>MICROI</span><strong>AI</strong><small>MODEL · DATA · TOOLS · KNOWLEDGE</small><i></i></div>
              <div class="mci-deck-ai-capabilities">
                <article v-for="(capability, capabilityIndex) in aiCapabilities" :key="capability.name" class="mci-deck-reveal" :style="{ '--mci-deck-order': capabilityIndex }"><span>0{{ capabilityIndex + 1 }}</span><div><strong>{{ capability.name }}</strong><small>{{ capability.text }}</small></div></article>
              </div>
            </div>
            <p class="mci-deck-footnote mci-deck-reveal"><strong>默认策略</strong>：优先使用权限感知的 Schema 检索与精确回读；向量服务仅作为高度模糊语义召回的可选增强。</p>
          </template>

          <template v-else-if="slide.id === 'data-integration'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · DATA & INTEGRATION</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-integration">
              <div class="mci-deck-integration__side is-source">
                <article v-for="(source, sourceIndex) in integrationSources" :key="source" class="mci-deck-reveal" :style="{ '--mci-deck-order': sourceIndex }"><span>IN</span><strong>{{ source }}</strong></article>
              </div>
              <div class="mci-deck-integration__hub mci-deck-reveal"><i></i><span>V8</span><strong>统一编排层</strong><small>鉴权 · 租户 · 事务 · 日志</small></div>
              <div class="mci-deck-integration__side is-output">
                <article v-for="(output, outputIndex) in integrationOutputs" :key="output" class="mci-deck-reveal" :style="{ '--mci-deck-order': outputIndex }"><strong>{{ output }}</strong><span>OUT</span></article>
              </div>
            </div>
            <div class="mci-deck-rule mci-deck-reveal"><span>集成原则</span><strong>普通单表优先 FormEngine；动态值参数化；密钥留在可信后端；外部副作用可审计、可幂等。</strong></div>
          </template>

          <template v-else-if="slide.id === 'saas-security'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · SAAS & SECURITY</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-security">
              <div class="mci-deck-security__shield mci-deck-reveal"><span>OsClient</span><strong>可信租户边界</strong><i></i><small>DiyToken</small></div>
              <div class="mci-deck-security__layers">
                <article class="mci-deck-reveal"><span>01</span><div><strong>身份与会话</strong><small>登录、Token、终端与一次性身份验证票据。</small></div></article>
                <article class="mci-deck-reveal"><span>02</span><div><strong>功能权限</strong><small>角色、用户、部门、菜单、按钮与接口入口。</small></div></article>
                <article class="mci-deck-reveal"><span>03</span><div><strong>数据权限</strong><small>表、字段、行范围、父子关系与可信服务端上下文。</small></div></article>
                <article class="mci-deck-reveal"><span>04</span><div><strong>安全治理</strong><small>敏感字段、私有文件、审计、幂等与最小权限。</small></div></article>
              </div>
            </div>
            <div class="mci-deck-saas-model mci-deck-reveal"><span>SaaS 三参数</span><strong>OsClient</strong><i>+</i><strong>OsClientType</strong><i>+</i><strong>OsClientNetwork</strong><small>一套程序驱动多个隔离租户与部署网络。</small></div>
          </template>

          <template v-else-if="slide.id === 'multi-end'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · MULTI-END EXPERIENCE</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-device-grid">
              <article v-for="(device, deviceIndex) in devices" :key="device.title" class="mci-deck-device mci-deck-reveal" :style="{ '--mci-deck-order': deviceIndex }"><span aria-hidden="true">{{ device.glyph }}</span><div><h3>{{ device.title }}</h3><p>{{ device.text }}</p></div></article>
            </div>
            <div class="mci-deck-microservice-band mci-deck-reveal"><span>MICROSERVICE</span><strong>独立运行</strong><i></i><strong>菜单直开</strong><i></i><strong>弹层打开</strong><i></i><strong>表单嵌入</strong><small>同一份前端发布物，多种业务落点。</small></div>
          </template>

          <template v-else-if="slide.id === 'deployment'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · PRODUCTION DELIVERY</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-deployment mci-deck-reveal" aria-label="Microi 生产部署拓扑">
              <article class="is-client"><span>CLIENT</span><strong>Web / App / API</strong></article><i>→</i>
              <article class="is-gateway"><span>ENTRY</span><strong>HTTPS / Gateway</strong></article><i>→</i>
              <div class="mci-deck-deployment__cluster"><article><span>NODE A</span><strong>API + Worker</strong></article><article><span>NODE B</span><strong>API + Worker</strong></article></div><i>→</i>
              <div class="mci-deck-deployment__data"><article><span>STATE</span><strong>Redis + DB</strong></article><article><span>FILES</span><strong>OSS / MinIO</strong></article></div>
            </div>
            <div class="mci-deck-deploy-cards">
              <article class="mci-deck-reveal"><span>INSTALL</span><strong>Docker / Windows / 源码</strong><small>按环境选择交付方式，配置进入租户事实源。</small></article>
              <article class="mci-deck-reveal"><span>RELEASE</span><strong>应用商城 + 滚动升级</strong><small>声明式资源、版本门与新旧版本兼容。</small></article>
              <article class="mci-deck-reveal"><span>OBSERVE</span><strong>日志 / 健康 / 监控</strong><small>区分存活、就绪、依赖降级与业务异常。</small></article>
            </div>
          </template>

          <template v-else-if="slide.id === 'workshop'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · CAPSTONE WORKSHOP</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-workshop">
              <div class="mci-deck-workshop__brief mci-deck-reveal"><span>实战题目</span><strong>AI 智能工单协同系统</strong><p>从客户提交、智能分类、派单、处理、审批到报告归档，覆盖一条真实业务链。</p><ul><li>角色：客户、客服、工程师、主管</li><li>对象：客户、设备、工单、记录、报告</li><li>终端：PC 管理端 + 移动端 + 微服务看板</li></ul></div>
              <div class="mci-deck-workshop__steps">
                <article v-for="(step, stepIndex) in workshopSteps" :key="step.no" class="mci-deck-reveal" :style="{ '--mci-deck-order': stepIndex }"><span>{{ step.no }}</span><div><strong>{{ step.title }}</strong><small>{{ step.text }}</small></div></article>
              </div>
            </div>
          </template>

          <template v-else-if="slide.id === 'schedule'">
            <header class="mci-training-slide__heading mci-deck-reveal">
              <div><p class="mci-deck-eyebrow">CHAPTER {{ slide.chapter }} · COURSE PLAN</p><h2>{{ slide.title }}</h2><p>{{ slide.summary }}</p></div><span>{{ padSlide(index) }}</span>
            </header>
            <div class="mci-deck-schedule">
              <article v-for="(day, dayIndex) in scheduleDays" :key="day.day" class="mci-deck-schedule__day mci-deck-reveal" :style="{ '--mci-deck-order': dayIndex }"><header><span>{{ day.day }}</span><small>{{ day.hours }}</small></header><h3>{{ day.title }}</h3><ol><li v-for="(item, itemIndex) in day.items" :key="item"><span>0{{ itemIndex + 1 }}</span>{{ item }}</li></ol></article>
            </div>
            <div class="mci-deck-assessment mci-deck-reveal"><span>结业评审</span><strong>30%</strong><small>架构与边界</small><strong>40%</strong><small>业务闭环</small><strong>20%</strong><small>质量与安全</small><strong>10%</strong><small>演示表达</small></div>
          </template>

          <template v-else-if="slide.id === 'closing'">
            <div class="mci-deck-closing">
              <div class="mci-deck-closing__signal mci-deck-reveal"><i></i><img src="/icon.png" alt="Microi吾码"><span>READY TO BUILD</span></div>
              <p class="mci-deck-eyebrow mci-deck-reveal">TRAINING OUTCOME · 18 / 18</p>
              <h2 class="mci-deck-reveal">从会使用，<br><strong>到能独立交付。</strong></h2>
              <p class="mci-deck-reveal">理解平台边界，掌握连续开发路径，完成一套可部署、可测试、可演进的 AI 业务系统。</p>
              <div class="mci-deck-outcomes mci-deck-reveal"><span>能建模</span><i></i><span>能开发</span><i></i><span>能集成</span><i></i><span>能上线</span><i></i><span>能验收</span></div>
              <div class="mci-deck-closing__actions mci-screen-only mci-deck-reveal">
                <a href="/doc/getting-started/start-use.html">进入快速开始</a>
                <a href="/doc/getting-started/source-code-architecture.html">查看源码架构</a>
                <a class="is-primary" :href="pdfDownloadPath" download>下载完整 PDF</a>
              </div>
              <small class="mci-deck-reveal">MICROI吾码 · OPEN-SOURCE AI DEVELOPMENT FRAMEWORK</small>
            </div>
          </template>
        </div>
      </section>
    </main>

    <button class="mci-training-deck__edge-nav is-previous mci-screen-only" type="button" :disabled="activeIndex === 0" aria-label="上一页" title="上一页（←）" @click="previousSlide">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>
    </button>
    <button class="mci-training-deck__edge-nav is-next mci-screen-only" type="button" :disabled="activeIndex === slideMeta.length - 1" aria-label="下一页" title="下一页（→）" @click="nextSlide">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>
    </button>

    <footer id="mci-training-controls" class="mci-training-deck__controls mci-screen-only">
      <div class="mci-training-deck__chapter"><span>{{ currentSlide.chapter }}</span><div><strong>{{ currentSlide.nav }}</strong><small>{{ currentSlide.title }}</small></div></div>
      <div class="mci-training-deck__progress" aria-label="幻灯片进度"><i :style="{ transform: `scaleX(${progress / 100})` }"></i></div>
      <div class="mci-training-deck__counter"><strong>{{ padSlide(activeIndex) }}</strong><span>/ {{ slideMeta.length }}</span></div>
    </footer>

    <div class="mci-training-deck__sr-status" aria-live="polite">第 {{ activeIndex + 1 }} 页，共 {{ slideMeta.length }} 页：{{ currentSlide.title }}</div>
    <Transition name="mci-deck-toast">
      <div v-if="notice" class="mci-training-deck__toast" role="status">{{ notice }}</div>
    </Transition>

    <div v-if="activePanel" class="mci-training-deck__overlay mci-screen-only" role="presentation" @click.self="closePanel">
      <section class="mci-training-deck__panel" role="dialog" aria-modal="true" aria-labelledby="mci-deck-help-title">
        <header>
          <div><p>MICROI PRESENTATION</p><h2 id="mci-deck-help-title">演示操作</h2></div>
          <button ref="panelCloseRef" type="button" aria-label="关闭" @click="closePanel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
        </header>
        <div class="mci-training-deck__help">
          <article><kbd>←</kbd><kbd>→</kbd><span><strong>上一页 / 下一页</strong><small>也支持 ↑ ↓、PageUp / PageDown</small></span></article>
          <article><kbd>Space</kbd><span><strong>继续演示</strong><small>空格键进入下一页</small></span></article>
          <article><kbd>Home</kbd><kbd>End</kbd><span><strong>首尾跳转</strong><small>快速回到封面或结业页</small></span></article>
          <article><kbd>O</kbd><span><strong>缩略图导航</strong><small>聚焦左侧当前页预览</small></span></article>
          <article><kbd>F</kbd><span><strong>切换全屏</strong><small>沉浸式培训演示</small></span></article>
          <article><kbd>P</kbd><span><strong>下载 PDF</strong><small>直接下载预生成的完整文件</small></span></article>
          <article><span class="mci-training-deck__gesture">↔</span><span><strong>鼠标 / 触控</strong><small>滚轮、两侧按钮或横向拖动切页</small></span></article>
        </div>
      </section>
    </div>
  </div>
</template>
