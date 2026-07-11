<template>
  <div class="pageengine-widget" :style="{ height: iframeHeight }">
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
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const pageId = computed(() => props.widgetObj.widgetParams?.[0]?.value || '')
const iframeRef = ref(null)
const iframeHeight = ref('360px')
let resizeObserver = null
let mutationObserver = null
let resizeTimer = null

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

onBeforeUnmount(clearObservers)
</script>

<style lang="scss" scoped>
.pageengine-widget {
  width: 100%;
  height: auto;
  min-height: 0;
  overflow: hidden;
  background: var(--el-bg-color);
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
