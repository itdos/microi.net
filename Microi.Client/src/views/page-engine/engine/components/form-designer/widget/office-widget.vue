<template>
  <div class="office-widget" ref="officeWidgetRef" @wheel.capture="handleOfficeWheel">
    <div v-if="loading" class="office-state">文档加载中...</div>
    <div v-else-if="error" class="office-state office-state-error">{{ error }}</div>
    <iframe
      v-else-if="isPdfPreview && previewSrc"
      ref="pdfFrameRef"
      class="office-component office-pdf-component office-pdf-frame"
      :src="pdfFrameSrc"
      :style="{ height: widgetHeight }"
      tabindex="0"
      @load="onPdfFrameLoaded"
      @mouseenter="focusPdfFrame"
      @pointerenter="focusPdfFrame"
    ></iframe>
    <component
      v-else-if="currentComponent && previewSrc"
      class="office-component"
      :is="currentComponent"
      :src="previewSrc"
      :style="{ height: widgetHeight }"
      @rendered="onRendered"
      @error="onError"
    />
    <iframe
      v-else-if="previewSrc"
      class="office-component"
      :src="previewSrc"
      :style="{ height: widgetHeight }"
      @load="onRendered"
    ></iframe>
    <div v-else class="office-state">未配置预览文件</div>
  </div>
</template>

<script setup name="office-widget">
import { ref, computed, defineAsyncComponent, inject, nextTick, onMounted, onBeforeUnmount, watch } from 'vue'
import { routeLocationKey } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { getFile, resolveRuntimeUrl } from '../../../utils/axiosInstance'

import '@vue-office/docx/lib/index.css'
import '@vue-office/excel/lib/index.css'

const DocxPreview = defineAsyncComponent(() => import('@vue-office/docx'))
const ExcelPreview = defineAsyncComponent(() => import('@vue-office/excel'))

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const route = inject(routeLocationKey, { query: {} })
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

const officeWidgetRef = ref()
const pdfFrameRef = ref()
const loading = ref(false)
const error = ref('')
const previewSrc = ref('')
const previewFileType = ref('')
const currentPage = ref(1)
const currentFileKey = ref('')
let previewObjectUrl = ''
let refreshTimer = null
let pageScrollAppliedKey = ''
let pdfUserScrolled = false
let isProgrammaticPdfScroll = false
let pdfProgrammaticScrollTimer = null
let pdfScrollUpdateFrame = null
let pdfScrollContainer = null

const widgetHeight = computed(() => `${props.widgetObj.widgetOption.height || 720}px`)

const getParamValue = (index, fallback = '') => {
  const item = props.widgetObj.widgetParams?.[index]
  return item && item.value !== undefined && item.value !== null && item.value !== ''
    ? item.value
    : fallback
}

const dataSourceUrl = computed(() => getParamValue(0, ''))
const staticFilePath = computed(() => {
  const routeQuery = route.query || {}
  const routeFile = safeDecode(routeQuery.filePath || '')
  if (routeFile) return routeFile

  const parentFile = getParentQueryValue('filePath')
  if (parentFile) return parentFile

  if (formData.value?.filePath) return safeDecode(formData.value.filePath)

  return (
    getParamValue(1, '') ||
    props.widgetObj.widgetParams?.[0]?.typeOptions?.dataJson?.filePath ||
    ''
  )
})
const configuredFileType = computed(() => normalizeFileType(getParamValue(2, 'auto')))
const configuredPage = computed(() => {
  const routeQuery = route.query || {}
  return normalizePage(routeQuery.page || routeQuery.pageNumber || getParamValue(3, 1))
})
const refreshSeconds = computed(() => {
  const seconds = Number(getParamValue(4, 0))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
})

const isPdfPreview = computed(() => previewFileType.value === 'pdf')
const useNativePdfPreview = computed(() => isPdfPreview.value)
const pdfFrameSrc = computed(() => {
  if (!isPdfPreview.value || !previewSrc.value) return ''
  const cleanSrc = String(previewSrc.value).replace(/#.*$/, '')
  return `${cleanSrc}#page=${normalizePage(currentPage.value || configuredPage.value)}`
})
const currentComponent = computed(() => {
  if (previewFileType.value === 'docx') return DocxPreview
  if (previewFileType.value === 'xlsx') return ExcelPreview
  return null
})

const safeDecode = (value) => {
  if (!value) return ''
  try {
    return decodeURIComponent(value)
  } catch (e) {
    return value
  }
}

const getParentQueryValue = (key) => {
  try {
    const hash = window.parent?.location?.hash || ''
    const queryString = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
    return safeDecode(new URLSearchParams(queryString).get(key) || '')
  } catch (e) {
    return ''
  }
}

const normalizePage = (value) => {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

const normalizeFileType = (value) => {
  const type = String(value || '').toLowerCase()
  if (!type || type === 'auto') return 'auto'
  if (['pdf'].includes(type)) return 'pdf'
  if (['doc', 'docx', 'word'].includes(type)) return 'docx'
  if (['xls', 'xlsx', 'excel'].includes(type)) return 'xlsx'
  if (['ppt', 'pptx', 'slide'].includes(type)) return 'pptx'
  return type
}

const inferFileType = ({ url = '', fileName = '', contentType = '' } = {}) => {
  if (configuredFileType.value !== 'auto') return configuredFileType.value

  const lowerContentType = String(contentType || '').toLowerCase()
  if (lowerContentType.includes('pdf')) return 'pdf'
  if (lowerContentType.includes('word') || lowerContentType.includes('officedocument.wordprocessingml')) return 'docx'
  if (lowerContentType.includes('excel') || lowerContentType.includes('spreadsheetml')) return 'xlsx'
  if (lowerContentType.includes('powerpoint') || lowerContentType.includes('presentationml')) return 'pptx'

  const target = String(fileName || url || '').split('?')[0].split('#')[0].toLowerCase()
  const ext = target.includes('.') ? target.split('.').pop() : ''
  return normalizeFileType(ext)
}

const revokeObjectUrl = () => {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = ''
  }
}

const setPreview = ({ src, fileType, page, fileKey }) => {
  previewSrc.value = src || ''
  previewFileType.value = fileType || inferFileType({ url: src })
  pdfUserScrolled = false
  currentPage.value = normalizePage(page || configuredPage.value)
  currentFileKey.value = fileKey || src || ''
  pageScrollAppliedKey = ''
  if (useNativePdfPreview.value) unbindPdfScrollContainer()
  else schedulePdfInitialScroll()
  nextTick(() => {
    if (!useNativePdfPreview.value) bindPdfScrollContainer()
  })
}

const base64ToBlob = (base64, contentType = 'application/pdf') => {
  const raw = String(base64 || '').includes(',')
    ? String(base64).split(',').pop()
    : String(base64 || '')
  const binary = atob(raw)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: contentType })
}

const blobToPreviewUrl = (blob) => {
  revokeObjectUrl()
  previewObjectUrl = URL.createObjectURL(blob)
  return previewObjectUrl
}

const findScrollContainer = (target) => {
  let node = target
  while (node && node !== officeWidgetRef.value) {
    const style = window.getComputedStyle(node)
    if (
      /(auto|scroll)/.test(`${style.overflow}${style.overflowY}`) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node
    }
    node = node.parentElement
  }
  return officeWidgetRef.value?.querySelector('.office-pdf-component') || officeWidgetRef.value
}

const beginProgrammaticPdfScroll = () => {
  isProgrammaticPdfScroll = true
  if (pdfProgrammaticScrollTimer) window.clearTimeout(pdfProgrammaticScrollTimer)
  pdfProgrammaticScrollTimer = window.setTimeout(() => {
    isProgrammaticPdfScroll = false
    pdfProgrammaticScrollTimer = null
  }, 260)
}

const updateCurrentPdfPageFromScroll = () => {
  if (!isPdfPreview.value || useNativePdfPreview.value || !officeWidgetRef.value) return
  const container = officeWidgetRef.value.querySelector('.office-pdf-component')
  const canvases = Array.from(container?.querySelectorAll('canvas') || [])
  if (!container || !canvases.length) return

  const viewportTop = container.getBoundingClientRect().top
  const probeY = viewportTop + Math.min(container.clientHeight * 0.35, 220)
  let nextPage = currentPage.value
  let bestDistance = Number.MAX_SAFE_INTEGER

  canvases.forEach((canvas, index) => {
    const rect = canvas.getBoundingClientRect()
    const distance = rect.top <= probeY && rect.bottom >= probeY
      ? 0
      : Math.min(Math.abs(rect.top - probeY), Math.abs(rect.bottom - probeY))
    if (distance < bestDistance) {
      bestDistance = distance
      nextPage = index + 1
    }
  })

  if (nextPage !== currentPage.value) currentPage.value = nextPage
}

const markPdfUserScrolled = () => {
  if (!isPdfPreview.value || useNativePdfPreview.value || isProgrammaticPdfScroll) return
  pdfUserScrolled = true
  if (pdfScrollUpdateFrame) window.cancelAnimationFrame(pdfScrollUpdateFrame)
  pdfScrollUpdateFrame = window.requestAnimationFrame(() => {
    pdfScrollUpdateFrame = null
    updateCurrentPdfPageFromScroll()
  })
}

const scrollPdfToPage = () => {
  if (!isPdfPreview.value || useNativePdfPreview.value || !officeWidgetRef.value) return false
  const page = normalizePage(currentPage.value)
  const root = officeWidgetRef.value
  const selectors = [
    `[data-page-number="${page}"]`,
    `[data-page="${page}"]`,
    `.page[data-page-number="${page}"]`
  ]
  const target =
    selectors.map((selector) => root.querySelector(selector)).find(Boolean) ||
    root.querySelectorAll('canvas')[page - 1]

  const container = findScrollContainer(target || root)
  if (!container) return false

  if (target) {
    const containerTop = container.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    beginProgrammaticPdfScroll()
    container.scrollTop += targetTop - containerTop
    return true
  }

  if (container.scrollHeight > container.clientHeight) {
    const renderedPageCount = Math.max(root.querySelectorAll('canvas').length, page)
    const ratio = renderedPageCount > 1 ? Math.max(page - 1, 0) / (renderedPageCount - 1) : 0
    beginProgrammaticPdfScroll()
    container.scrollTop = ratio * (container.scrollHeight - container.clientHeight)
    return true
  }
  return false
}

const schedulePdfInitialScroll = (attempt = 0) => {
  if (!isPdfPreview.value || useNativePdfPreview.value) return
  if (pdfUserScrolled) return
  const scrollKey = `${currentFileKey.value || previewSrc.value}|${currentPage.value}`
  if (pageScrollAppliedKey === scrollKey) return
  nextTick(() => {
    window.setTimeout(() => {
      window.requestAnimationFrame(() => {
        if (pdfUserScrolled) return
        const applied = scrollPdfToPage()
        if ((applied && attempt >= 8) || attempt >= 24) {
          pageScrollAppliedKey = scrollKey
          return
        }
        schedulePdfInitialScroll(attempt + 1)
      })
    }, Math.min(80 + attempt * 120, 1200))
  })
}

const handleOfficeWheel = (event) => {
  if (!isPdfPreview.value || useNativePdfPreview.value || event.ctrlKey || !officeWidgetRef.value) return
  const container = officeWidgetRef.value.querySelector('.office-pdf-component')
  if (!container || !container.contains(event.target)) return
  if (container.scrollHeight <= container.clientHeight) return

  const lineHeight = 16
  const pageHeight = container.clientHeight || 1
  const deltaY =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * pageHeight
        : event.deltaY
  const deltaX =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaX * lineHeight
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaX * pageHeight
        : event.deltaX
  const maxTop = container.scrollHeight - container.clientHeight
  const maxLeft = container.scrollWidth - container.clientWidth
  const nextTop = Math.max(0, Math.min(maxTop, container.scrollTop + deltaY))
  const nextLeft = Math.max(0, Math.min(maxLeft, container.scrollLeft + deltaX))
  const changed = nextTop !== container.scrollTop || nextLeft !== container.scrollLeft

  if (changed) {
    container.scrollTop = nextTop
    container.scrollLeft = nextLeft
    markPdfUserScrolled()
    event.preventDefault()
    event.stopPropagation()
  }
}

const handlePdfScroll = () => {
  markPdfUserScrolled()
}

const bindPdfScrollContainer = () => {
  if (useNativePdfPreview.value) return
  const container = officeWidgetRef.value?.querySelector('.office-pdf-component') || null
  if (pdfScrollContainer === container) return
  if (pdfScrollContainer) pdfScrollContainer.removeEventListener('scroll', handlePdfScroll)
  pdfScrollContainer = container
  if (pdfScrollContainer) pdfScrollContainer.addEventListener('scroll', handlePdfScroll, { passive: true })
}

const unbindPdfScrollContainer = () => {
  if (pdfScrollContainer) pdfScrollContainer.removeEventListener('scroll', handlePdfScroll)
  pdfScrollContainer = null
}

const focusPdfFrame = () => {
  nextTick(() => {
    const frame = pdfFrameRef.value
    if (!frame) return
    try {
      frame.focus({ preventScroll: true })
    } catch (e) {
      try {
        frame.focus()
      } catch (err) {}
    }
    try {
      frame.contentWindow?.focus?.()
    } catch (e) {}
  })
}

const readBlobText = (blob) => {
  if (blob && typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsText(blob)
  })
}

const pickFirst = (...values) => values.find((value) => value !== undefined && value !== null && value !== '')

const isExplicitFalse = (value) => {
  if (value === false || value === 0) return true
  return String(value).toLowerCase() === 'false'
}

const isNotModifiedPayload = (data = {}, result = {}) => {
  const notModified = pickFirst(
    data.NotModified,
    data.notModified,
    data.NotChanged,
    data.notChanged,
    result.NotModified,
    result.DataAppend?.NotModified
  )
  if (notModified === true || String(notModified).toLowerCase() === 'true') return true

  const refresh = pickFirst(
    data.Refresh,
    data.refresh,
    data.NeedRefresh,
    data.needRefresh,
    data.Changed,
    data.changed,
    result.Refresh,
    result.DataAppend?.Refresh
  )
  return refresh !== undefined && isExplicitFalse(refresh)
}

const pickFileKey = (data = {}, result = {}, fallback = '') => {
  return pickFirst(
    data.FileKey,
    data.fileKey,
    data.CacheKey,
    data.cacheKey,
    data.Version,
    data.version,
    data.ETag,
    data.etag,
    result.FileKey,
    result.CacheKey,
    result.Version,
    fallback
  )
}

const parseContentDispositionFileName = (contentDisposition = '') => {
  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8Match) return safeDecode(utf8Match[1])
  const match = contentDisposition.match(/filename="?([^"]+)"?/i)
  return match ? safeDecode(match[1]) : ''
}

const applyJsonPayload = (result) => {
  if (!result) throw new Error('接口未返回文件数据')
  if (result.Code !== undefined && result.Code !== 1) {
    throw new Error(result.Msg || '接口返回失败')
  }

  const data = result.Data || result
  if (isNotModifiedPayload(data, result)) return false

  const fileName = pickFirst(data.FileName, data.fileName, result.FileName, result.fileName, '')
  const contentType = pickFirst(data.ContentType, data.contentType, result.ContentType, result.contentType, 'application/pdf')
  const page = pickFirst(
    data.PageNumber,
    data.pageNumber,
    data.InitialPage,
    data.initialPage,
    data.Page,
    data.page,
    result.PageNumber,
    result.InitialPage,
    result.Page,
    result.DataAppend?.PageNumber
  )
  const fileUrl = pickFirst(data.FileUrl, data.fileUrl, data.Url, data.url, data.FilePath, data.filePath, '')
  const fileBase64 = pickFirst(data.FileByteBase64, data.fileByteBase64, data.Base64, data.base64, '')
  const fileKey = pickFileKey(data, result, fileUrl || fileName)

  if (fileBase64) {
    const blob = base64ToBlob(fileBase64, contentType)
    setPreview({
      src: blobToPreviewUrl(blob),
      fileType: inferFileType({ fileName, contentType }),
      page,
      fileKey
    })
    return true
  }

  if (fileUrl || typeof data === 'string') {
    const src = resolveRuntimeUrl(fileUrl || data)
    setPreview({
      src,
      fileType: inferFileType({ url: src, fileName, contentType }),
      page,
      fileKey: pickFileKey(data, result, src)
    })
    return true
  }

  throw new Error('接口返回缺少 FileUrl 或 FileByteBase64')
}

const loadFromDataSource = async () => {
  const response = await getFile(dataSourceUrl.value, {
    PageNumber: configuredPage.value,
    CurrentPageNumber: currentPage.value,
    CurrentFileKey: currentFileKey.value,
    CurrentFileUrl: previewSrc.value,
    WidgetNumber: props.widgetObj.widgetOption.number,
    _t: Date.now()
  })
  if (!response || !response.data) throw new Error('文件接口请求失败')

  const contentType = String(response.headers?.['content-type'] || response.data.type || '')
  const isJson = contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('text/plain')
  if (isJson) {
    const text = await readBlobText(response.data)
    if (!text) return false
    const changed = applyJsonPayload(JSON.parse(text))
    if (changed === false && !pdfUserScrolled) schedulePdfInitialScroll()
    return changed
  }

  const fileName = parseContentDispositionFileName(response.headers?.['content-disposition'] || '')
  const page = pickFirst(
    response.headers?.['x-page-number'],
    response.headers?.['x-initial-page'],
    response.headers?.['x-microi-page'],
    configuredPage.value
  )
  setPreview({
    src: blobToPreviewUrl(response.data),
    fileType: inferFileType({ fileName, contentType, url: dataSourceUrl.value }),
    page,
    fileKey: pickFirst(
      response.headers?.['x-file-key'],
      response.headers?.['x-cache-key'],
      response.headers?.etag,
      fileName
    )
  })
}

const loadOfficeFile = async (options = {}) => {
  const silent = options.silent === true || !!previewSrc.value
  if (!silent) loading.value = true
  error.value = ''
  try {
    if (dataSourceUrl.value) {
      await loadFromDataSource()
    } else {
      const src = resolveRuntimeUrl(staticFilePath.value)
      setPreview({
        src,
        fileType: inferFileType({ url: src }),
        page: configuredPage.value
      })
    }
  } catch (e) {
    if (silent && previewSrc.value) return
    error.value = e?.message || '文档加载失败'
  } finally {
    if (!silent) loading.value = false
  }
}

const setupRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (refreshSeconds.value > 0) {
    refreshTimer = setInterval(() => {
      loadOfficeFile({ silent: true })
    }, refreshSeconds.value * 1000)
  }
}

const onRendered = () => {
  console.log('office-widget rendered')
  if (useNativePdfPreview.value) return
  bindPdfScrollContainer()
  if (!pdfUserScrolled) schedulePdfInitialScroll()
}

const onPdfFrameLoaded = () => {
  console.log('office-widget rendered')
  focusPdfFrame()
  window.setTimeout(focusPdfFrame, 120)
  window.setTimeout(focusPdfFrame, 500)
}

const onError = () => {
  error.value = '文档预览渲染失败'
}

watch(
  () => formData.value.JsonObj?.formConfig?.lastRefreshTime,
  (newValue, oldValue) => {
    if (newValue !== oldValue) loadOfficeFile({ silent: !!previewSrc.value })
  }
)

watch(refreshSeconds, setupRefreshTimer)

watch(currentPage, () => {
  pageScrollAppliedKey = ''
  if (!useNativePdfPreview.value && !pdfUserScrolled) schedulePdfInitialScroll()
})

watch(
  () => [dataSourceUrl.value, staticFilePath.value, configuredFileType.value, configuredPage.value],
  () => loadOfficeFile()
)

onMounted(() => {
  loadOfficeFile()
  setupRefreshTimer()
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
  if (pdfProgrammaticScrollTimer) window.clearTimeout(pdfProgrammaticScrollTimer)
  if (pdfScrollUpdateFrame) window.cancelAnimationFrame(pdfScrollUpdateFrame)
  unbindPdfScrollContainer()
  revokeObjectUrl()
})
</script>

<style lang="scss">
.microi-page-engine {
  .office-widget {
    width: 100%;
    min-height: 160px;
    margin-bottom: 20px;
  }

  .office-component {
    width: 100%;
    min-height: 160px;
    border: 0;
    display: block;
    background: #fff;
  }

  .office-pdf-component {
    overflow: auto;
  }

  .office-pdf-frame {
    cursor: auto;
    user-select: text;
  }

  .office-state {
    width: 100%;
    min-height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--el-text-color-secondary);
    background: var(--el-fill-color-lighter);
    border: 1px solid var(--el-border-color-light);
    border-radius: 6px;
  }

  .office-state-error {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
    border-color: var(--el-color-danger-light-7);
  }
}
</style>
