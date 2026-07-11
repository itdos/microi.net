<template>
  <div class="pageengine-widget" :style="{ height: iframeHeight }">
    <button
      v-if="pageId && canDesignPage"
      type="button"
      class="nested-page-design-btn"
      aria-label="界面设计"
      @click="openNestedPageDesigner"
    >
      <el-icon><EditPen /></el-icon>
      <span>界面设计</span>
    </button>
    <div v-if="!pageId" class="pageengine-widget__placeholder">
      <el-icon :size="34"><DataBoard /></el-icon>
      <span>请选择要嵌入的界面引擎</span>
    </div>
    <iframe
      v-else
      ref="iframeRef"
      :key="'pageengine_' + widgetObj.widgetOption.number + '_' + pageId"
      :src="embedUrl"
      :title="'界面引擎 ' + pageId"
      frameborder="0"
      loading="lazy"
      scrolling="no"
      sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
      :style="{ height: iframeHeight }"
      @load="handleIframeLoad"
    ></iframe>
  </div>
</template>

<script setup name="pageengine-widget">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDiyStore } from '@/pinia'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const pageId = computed(() => props.widgetObj.widgetParams?.[0]?.value || '')
const router = useRouter()
const diyStore = useDiyStore()
const iframeRef = ref(null)
const iframeHeight = ref('360px')
let resizeObserver = null
let mutationObserver = null
let resizeTimer = null

const canDesignPage = computed(() => {
  const user = diyStore.GetCurrentUser || {}
  const adminValue = String(user._IsAdmin ?? '').toLowerCase()
  const isAdmin = user._IsAdmin === true || Number(user._IsAdmin) === 1 || adminValue === 'true'
  return isAdmin || Number(user.Level || 0) >= 9999
})

const openNestedPageDesigner = () => {
  if (!pageId.value || !canDesignPage.value) return
  router.push({ path: '/mic/autopage', query: { Id: pageId.value } })
}

const handlePageDesignerMessage = (event) => {
  if (event.origin && event.origin !== window.location.origin && event.origin !== 'null') return
  const data = event.data || {}
  if (data.key !== 'openPageDesigner' || !data.pageId || !canDesignPage.value) return
  router.push({ path: '/mic/autopage', query: { Id: data.pageId } })
}

const clearObservers = () => {
  if (resizeObserver) resizeObserver.disconnect()
  if (mutationObserver) mutationObserver.disconnect()
  if (resizeTimer) clearInterval(resizeTimer)
  resizeObserver = null
  mutationObserver = null
  resizeTimer = null
}

const syncIframeHeight = () => {
  const frame = iframeRef.value
  if (!frame) return
  try {
    const doc = frame.contentDocument
    if (!doc) return
    const bodyHeight = doc.body?.scrollHeight || 0
    const documentHeight = doc.documentElement?.scrollHeight || 0
    const nextHeight = Math.max(240, bodyHeight, documentHeight)
    iframeHeight.value = `${nextHeight}px`
  } catch (error) {
    console.warn('[PageEngineWidget] 自动同步嵌套页面高度失败:', error?.message || error)
  }
}

const handleIframeLoad = async () => {
  clearObservers()
  await nextTick()
  syncIframeHeight()
  try {
    const doc = iframeRef.value?.contentDocument
    if (!doc) return
    resizeObserver = new ResizeObserver(syncIframeHeight)
    if (doc.documentElement) resizeObserver.observe(doc.documentElement)
    if (doc.body) resizeObserver.observe(doc.body)
    mutationObserver = new MutationObserver(syncIframeHeight)
    mutationObserver.observe(doc.body || doc.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })
    resizeTimer = setInterval(syncIframeHeight, 1200)
  } catch (error) {
    console.warn('[PageEngineWidget] 嵌套页面高度监听初始化失败:', error?.message || error)
  }
}

const embedUrl = computed(() => {
  if (!pageId.value || typeof window === 'undefined') return ''
  const baseUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
  return `${baseUrl}#/mic/renderer-embed/${encodeURIComponent(pageId.value)}?embedded=1`
})

onMounted(() => window.addEventListener('message', handlePageDesignerMessage))
onBeforeUnmount(() => {
  clearObservers()
  window.removeEventListener('message', handlePageDesignerMessage)
})
</script>

<style lang="scss" scoped>
.pageengine-widget {
  position: relative;
  width: 100%;
  height: auto;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color);
}

.nested-page-design-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 5;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, var(--el-color-primary) 28%, var(--el-border-color-lighter));
  border-radius: 999px;
  background: color-mix(in srgb, var(--el-color-primary) 7%, var(--el-bg-color));
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: background-color .18s ease, border-color .18s ease, transform .18s ease;
}

.nested-page-design-btn:hover {
  border-color: color-mix(in srgb, var(--el-color-primary) 52%, var(--el-border-color));
  background: color-mix(in srgb, var(--el-color-primary) 12%, var(--el-bg-color));
  transform: translateY(-1px);
}

@media screen and (max-width: 768px) {
  .nested-page-design-btn {
    top: 78px;
    right: 12px;
    height: 28px;
    padding: 0 7px;
    font-size: 12px;
  }
}

.pageengine-widget iframe {
  display: block;
  width: 100%;
  min-height: 240px;
  overflow: hidden;
}

.pageengine-widget__placeholder {
  display: flex;
  height: 100%;
  min-height: 180px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--el-text-color-secondary);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--mci-shape-panel, 8px);
}
</style>
