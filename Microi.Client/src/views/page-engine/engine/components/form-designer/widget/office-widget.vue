<template>
  <div class="office-widget" ref="officeWidgetRef">
    <div v-if="loading" class="office-state">文档加载中...</div>
    <div v-else-if="error" class="office-state office-state-error">{{ error }}</div>
    <iframe
      v-else-if="isPdfPreview && previewSrc"
      class="office-component"
      :src="pdfPreviewSrc"
      :style="{ height: widgetHeight }"
      @load="onRendered"
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
import { ref, computed, defineAsyncComponent, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'
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

const route = useRoute()
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

const officeWidgetRef = ref()
const loading = ref(false)
const error = ref('')
const previewSrc = ref('')
const previewFileType = ref('')
const currentPage = ref(1)
let previewObjectUrl = ''
let refreshTimer = null

const widgetHeight = computed(() => `${props.widgetObj.widgetOption.height || 720}px`)

const getParamValue = (index, fallback = '') => {
  const item = props.widgetObj.widgetParams?.[index]
  return item && item.value !== undefined && item.value !== null && item.value !== ''
    ? item.value
    : fallback
}

const dataSourceUrl = computed(() => getParamValue(0, ''))
const staticFilePath = computed(() => {
  const routeFile = safeDecode(route.query.filePath || '')
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
const configuredPage = computed(() => normalizePage(route.query.page || route.query.pageNumber || getParamValue(3, 1)))
const refreshSeconds = computed(() => {
  const seconds = Number(getParamValue(4, 0))
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
})

const isPdfPreview = computed(() => previewFileType.value === 'pdf')
const pdfPreviewSrc = computed(() => appendPdfPage(previewSrc.value, currentPage.value))
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

const appendPdfPage = (url, page) => {
  if (!url) return ''
  const baseUrl = String(url).split('#')[0]
  return `${baseUrl}#page=${normalizePage(page)}`
}

const revokeObjectUrl = () => {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = ''
  }
}

const setPreview = ({ src, fileType, page }) => {
  previewSrc.value = src || ''
  previewFileType.value = fileType || inferFileType({ url: src })
  currentPage.value = normalizePage(page || configuredPage.value)
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

  if (fileBase64) {
    const blob = base64ToBlob(fileBase64, contentType)
    setPreview({
      src: blobToPreviewUrl(blob),
      fileType: inferFileType({ fileName, contentType }),
      page
    })
    return
  }

  if (fileUrl || typeof data === 'string') {
    const src = resolveRuntimeUrl(fileUrl || data)
    setPreview({
      src,
      fileType: inferFileType({ url: src, fileName, contentType }),
      page
    })
    return
  }

  throw new Error('接口返回缺少 FileUrl 或 FileByteBase64')
}

const loadFromDataSource = async () => {
  const response = await getFile(dataSourceUrl.value, {
    PageNumber: configuredPage.value,
    WidgetNumber: props.widgetObj.widgetOption.number,
    _t: Date.now()
  })
  if (!response || !response.data) throw new Error('文件接口请求失败')

  const contentType = String(response.headers?.['content-type'] || response.data.type || '')
  const isJson = contentType.includes('application/json') || contentType.includes('text/json') || contentType.includes('text/plain')
  if (isJson) {
    const text = await readBlobText(response.data)
    applyJsonPayload(JSON.parse(text))
    return
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
    page
  })
}

const loadOfficeFile = async () => {
  loading.value = true
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
    error.value = e?.message || '文档加载失败'
  } finally {
    loading.value = false
  }
}

const setupRefreshTimer = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (refreshSeconds.value > 0) {
    refreshTimer = setInterval(() => {
      loadOfficeFile()
    }, refreshSeconds.value * 1000)
  }
}

const onRendered = () => {
  console.log('office-widget rendered')
}

const onError = () => {
  error.value = '文档预览渲染失败'
}

watch(
  () => formData.value.JsonObj?.formConfig?.lastRefreshTime,
  (newValue, oldValue) => {
    if (newValue !== oldValue) loadOfficeFile()
  }
)

watch(refreshSeconds, setupRefreshTimer)

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
