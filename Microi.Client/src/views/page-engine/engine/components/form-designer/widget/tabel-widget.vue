<template>
  <div v-show="widgetObj.widgetParams[1]?.value" class="date-range">
    <el-space wrap>
      <template
        v-for="(item, index) in widgetObj.widgetParams[0].typeOptions.dataJson
          ?.searchData"
      >
        <el-input
          :key="index"
          v-if="item.type == 'input'"
          v-model="selectedValues[index]"
          size="small"
          :placeholder="'请输入' + item.label"
          clearable
          @keyup.enter="btnSearch"
        />

        <el-select
          class="pagesearch"
          style="min-width: 120px"
          v-else-if="item.type == 'select'"
          :key="index + 'select'"
          v-model="selectedValues[index]"
          @change="btnSearch"
          size="small"
          :placeholder="'请选择' + item.label"
          clearable
          filterable
          :remote="item.remote"
          :remote-method="(query) => remoteMethod(query, item, index)"
          :loading="selLoading"
          @keyup.enter="btnSearch"
        >
          <el-option
            v-for="(option, index) in item.options"
            :value="option.value"
            :label="option.label"
            :key="index + option.value"
          />
        </el-select>
      </template>

      <el-date-picker
        v-model="dateRange"
        v-if="widgetObj.widgetParams[13]?.value"
        size="small"
        unlink-panels
        type="monthrange"
        range-separator="至"
        start-placeholder="起始年月"
        end-placeholder="结束年月"
        format="YYYY-MM"
        value-format="YYYY-MM"
      />
      <el-button
        :icon="Search"
        size="small"
        :loading="loading"
        circle
        @click="btnSearch"
      >
      </el-button>
    </el-space>
  </div>

  <el-table
    ref="tableRef"
    class="page-engine-tabel-widget"
    :data="widgetObj.widgetParams[0].typeOptions.dataJson.bodyData || []"
    :height="tableHeight"
    :stripe="widgetObj.widgetParams[2]?.value"
    :border="widgetObj.widgetParams[3]?.value"
    :size="widgetObj.widgetParams[4]?.value"
    :span-method="objectSpanMethod"
    :show-summary="widgetObj.widgetParams[8]?.value"
    :style="{
      '--el-table-border-color': widgetObj.widgetParams[9]?.value,
    }"
    :header-cell-style="{
      background: widgetObj.widgetParams[10]?.value,
      color: widgetObj.widgetParams[11]?.value,
    }"
    :cell-style="{
      color: widgetObj.widgetParams[12]?.value,
    }"
  >
    <template #default>
      <!-- 递归生成表头 -->
      <recursive-table-column
        v-for="(column, index) in generateColumns(
          widgetObj.widgetParams[0].typeOptions.dataJson.headerData
          || []
        )"
        :key="index"
        :column="column"
        :widget-obj="widgetObj"
      />
    </template>
  </el-table>

  <div style="margin-top: 12px; display: flex; justify-content: flex-end">
    <el-pagination
      v-if="showPagination"
      layout="prev, pager, next"
      background
      size="small"
      :hide-on-single-page="false"
      :total="widgetObj.widgetParams[0].typeOptions.dataJson.total || 0"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup name="tabel-widget">
import { ref, computed, onMounted, nextTick, onBeforeUnmount, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useWidget } from '../../../hooks/useWidget'
import RecursiveTableColumn from '../../RecursiveTableColum/RecursiveTableColumn.vue'
import { get } from '../../../utils/axiosInstance'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

//是否开启搜索
const selLoading = ref(false)
const options = ref([])

//远程加载数据
const remoteMethod = async (query, item, index) => {
  if (query && item.remote && item.optionUrl) {
    selLoading.value = true
    let params = {}
    try {
      const response = await get(item.optionUrl + query, params)
      if (response && response.length > 0)
        props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData[
          index
        ].options = response
      selLoading.value = false
    } catch (error) {
      console.error('Error fetching data:', error)
      // item.options = []
    } finally {
      selLoading.value = false
    }
  } else {
    // options.value = []
  }
}

const getPositiveNumber = (value, fallback) => {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue > 0
    ? numberValue
    : fallback
}

const basePageSize = computed(() =>
  getPositiveNumber(props.widgetObj.widgetParams[7]?.value, 10)
)

const scrollDirection = computed(
  () => props.widgetObj.widgetParams[17]?.value || 'off'
)

const isAutoScroll = computed(() =>
  ['up', 'down'].includes(scrollDirection.value)
)

const scrollSpeed = computed(() =>
  getPositiveNumber(props.widgetObj.widgetParams[18]?.value, 20)
)

const isAutoPage = computed(
  () => !isAutoScroll.value && props.widgetObj.widgetParams[19]?.value === true
)

const autoPageInterval = computed(() =>
  getPositiveNumber(props.widgetObj.widgetParams[20]?.value, 5)
)

const requestPageSize = computed(() => {
  if (isAutoScroll.value) return basePageSize.value
  if (isAutoPage.value) return basePageSize.value

  const configuredPageSize = Number(props.widgetObj.widgetParams[7]?.value)
  return Number.isFinite(configuredPageSize) && configuredPageSize > 0
    ? configuredPageSize
    : -1
})

const pageSize = computed({
  get() {
    return basePageSize.value
  },
  set(value) {
    if (props.widgetObj.widgetParams[7]) {
      props.widgetObj.widgetParams[7].value = value
    }
  },
})

const showPagination = computed(() => {
  const configuredPageSize = Number(props.widgetObj.widgetParams[7]?.value)
  return (
    Number.isFinite(configuredPageSize) &&
    configuredPageSize > 0 &&
    !isAutoScroll.value
  )
})

const tableHeight = computed(() => {
  if (!isAutoScroll.value) return undefined

  const searchHeight = props.widgetObj.widgetParams[1]?.value ? 38 : 0
  const widgetHeight = getPositiveNumber(props.widgetObj.widgetOption.height, 310)
  return Math.max(120, widgetHeight - searchHeight) + 'px'
})

//当前页
const currentPage = ref(1)

const selectedValues = ref({})

onMounted(() => {
  props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData?.forEach(
    (item, index) => {
      selectedValues.value[index] = item.value
    }
  )
})

const reloadRoadRemoteData = async () => {
  // 保存当前选中的值
  const savedValues = { ...selectedValues.value }

  // 恢复选中的值
  for (const [index, value] of Object.entries(savedValues)) {
    const searchData =
      props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData || []
    if (searchData[index]) {
      searchData[index].value = value
    }
  }

  await loadRemoteData()
}
// 搜索
const btnSearch = async (val) => {
  currentPage.value = 1
  await restartRuntimeTasks(true)
}

// 每页条数变更事件
const handleSizeChange = async (val) => {
  currentPage.value = 1
  await restartRuntimeTasks(true)
}
// 当前页变更事件
const handleCurrentChange = async (val) => {
  if (runtimePageChanging) return
  await reloadRoadRemoteData()
  await restartRuntimeTasks(false)
}

const allData = ref(
  props.widgetObj.widgetParams[0].typeOptions.dataJson.bodyData || []
)

// 日期区间
const dateRange = ref()
// 是否加载中
const loading = ref(false)

const { loadRemoteData } = useWidget(
  props.widgetObj,
  allData.value,
  dateRange,
  loading,
  currentPage,
  requestPageSize
)

const getActivePageSize = () => {
  const activePageSize = Number(requestPageSize.value)
  return Number.isFinite(activePageSize) && activePageSize > 0
    ? activePageSize
    : basePageSize.value
}

const restoreSelectedSearchValues = () => {
  const savedValues = { ...selectedValues.value }
  const searchData =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData || []

  for (const [index, value] of Object.entries(savedValues)) {
    if (searchData[index]) {
      searchData[index].value = value
    }
  }
}

const buildTableRequestParams = (pageIndex, pageSizeValue) => {
  const params = {}

  if (dateRange.value) {
    params.start = dateRange.value[0]
    params.end = dateRange.value[1]
  }

  if (pageIndex !== -1 && pageSizeValue > 0) {
    params.currentPage = pageIndex
    params.pageSize = pageSizeValue
  }

  const searchData =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData || []
  searchData.forEach((item) => {
    params[item.prop] = item.value
  })

  return params
}

const normalizeTableDataJson = (response) => {
  if (Array.isArray(response)) {
    return {
      ...getDataJson(),
      bodyData: response,
      total: response.length,
    }
  }

  if (response && response instanceof Object) {
    return {
      ...getDataJson(),
      ...response,
      bodyData: Array.isArray(response.bodyData) ? response.bodyData : [],
    }
  }

  return {
    ...getDataJson(),
    bodyData: [],
    total: 0,
  }
}

const fetchTablePage = async (pageIndex, pageSizeValue = getActivePageSize()) => {
  restoreSelectedSearchValues()

  if (props.widgetObj.widgetParams[0].value) {
    const response = await get(
      props.widgetObj.widgetParams[0].value,
      buildTableRequestParams(pageIndex, pageSizeValue)
    )
    return normalizeTableDataJson(response)
  }

  const start = (pageIndex - 1) * pageSizeValue
  const bodyData = Array.isArray(allData.value)
    ? allData.value.slice(start, start + pageSizeValue)
    : []

  return {
    ...getDataJson(),
    bodyData,
    total: Array.isArray(allData.value) ? allData.value.length : bodyData.length,
  }
}

const setTableDataJson = (dataJson) => {
  props.widgetObj.widgetParams[0].typeOptions.dataJson = dataJson || {}
}

const tableRef = ref(null)
const scrollEdgeThreshold = 48
const scrollMaxSegments = 3
let scrollAnimationId = 0
let scrollRunId = 0
let lastScrollFrameTime = 0
let scrollPageLoading = false
let autoPageTimerId = null
let autoPageLoading = false
let runtimePageChanging = false
let scrollPosition = 0
let scrollBufferRunId = 0
let scrollSegments = []
let scrollDataJsonTemplate = null
let scrollNextPage = 1
let scrollPreviousPage = 1
let scrollPrefetchPromise = null

const getDataJson = () =>
  props.widgetObj.widgetParams[0].typeOptions.dataJson || {}

const getTotalPageCount = () => {
  const dataJson = getDataJson()
  const total = Number(dataJson.total)
  const activePageSize = requestPageSize.value

  if (Number.isFinite(total) && total > 0 && activePageSize > 0) {
    return Math.max(1, Math.ceil(total / activePageSize))
  }

  const loadedRows = Array.isArray(dataJson.bodyData)
    ? dataJson.bodyData.length
    : 0
  if (activePageSize > 0 && loadedRows < activePageSize) return currentPage.value

  return Math.max(1, currentPage.value + 1)
}

const getNextPageNumber = () => {
  const totalPageCount = getTotalPageCount()
  return currentPage.value >= totalPageCount ? 1 : currentPage.value + 1
}

const getScrollTotalPageCount = () => {
  const dataJson = scrollDataJsonTemplate || getDataJson()
  const total = Number(dataJson.total)
  const activePageSize = getActivePageSize()

  if (Number.isFinite(total) && total > 0 && activePageSize > 0) {
    return Math.max(1, Math.ceil(total / activePageSize))
  }

  const lastSegment = scrollSegments[scrollSegments.length - 1]
  if (lastSegment?.rows?.length && lastSegment.rows.length < activePageSize) {
    return lastSegment.page
  }

  return Math.max(1, lastSegment?.page || 1)
}

const getScrollNextPageNumber = (pageNumber) => {
  const totalPageCount = getScrollTotalPageCount()
  return pageNumber >= totalPageCount ? 1 : pageNumber + 1
}

const getScrollPreviousPageNumber = (pageNumber) => {
  const totalPageCount = getScrollTotalPageCount()
  return pageNumber <= 1 ? totalPageCount : pageNumber - 1
}

const getScrollRows = () =>
  scrollSegments.reduce((rows, segment) => rows.concat(segment.rows), [])

const applyScrollSegmentsToDataJson = () => {
  const currentDataJson = getDataJson()
  const template = scrollDataJsonTemplate || currentDataJson
  setTableDataJson({
    ...currentDataJson,
    ...template,
    bodyData: getScrollRows(),
  })
}

const resetScrollBuffer = () => {
  scrollBufferRunId++
  scrollSegments = []
  scrollDataJsonTemplate = null
  scrollNextPage = 1
  scrollPreviousPage = 1
  scrollPrefetchPromise = null
  scrollPosition = 0
}

const appendScrollSegment = (pageNumber, dataJson) => {
  const rows = Array.isArray(dataJson?.bodyData) ? dataJson.bodyData : []
  if (!rows.length) return false

  scrollDataJsonTemplate = {
    ...getDataJson(),
    ...dataJson,
    bodyData: [],
  }
  scrollSegments.push({
    page: pageNumber,
    rows,
  })
  scrollNextPage = getScrollNextPageNumber(pageNumber)
  scrollPreviousPage = getScrollPreviousPageNumber(scrollSegments[0].page)
  applyScrollSegmentsToDataJson()
  return true
}

const prependScrollSegment = (pageNumber, dataJson) => {
  const rows = Array.isArray(dataJson?.bodyData) ? dataJson.bodyData : []
  if (!rows.length) return 0

  scrollDataJsonTemplate = {
    ...getDataJson(),
    ...dataJson,
    bodyData: [],
  }
  scrollSegments.unshift({
    page: pageNumber,
    rows,
  })
  while (scrollSegments.length > scrollMaxSegments) {
    scrollSegments.pop()
  }
  scrollPreviousPage = getScrollPreviousPageNumber(pageNumber)
  scrollNextPage = getScrollNextPageNumber(
    scrollSegments[scrollSegments.length - 1].page
  )
  applyScrollSegmentsToDataJson()
  return rows.length
}

const padScrollSegmentsForLoop = () => {
  const reusableSegments = scrollSegments.filter(
    (segment) => Array.isArray(segment.rows) && segment.rows.length
  )
  if (!reusableSegments.length || scrollSegments.length >= scrollMaxSegments) {
    return false
  }

  let index = 0
  while (scrollSegments.length < scrollMaxSegments) {
    const segment = reusableSegments[index % reusableSegments.length]
    scrollSegments.push({
      page: segment.page,
      rows: segment.rows,
    })
    index++
  }

  scrollPreviousPage = getScrollPreviousPageNumber(scrollSegments[0].page)
  scrollNextPage = getScrollNextPageNumber(
    scrollSegments[scrollSegments.length - 1].page
  )
  applyScrollSegmentsToDataJson()
  return true
}

const fillScrollBuffer = async () => {
  const runId = scrollBufferRunId
  if (scrollPrefetchPromise) return scrollPrefetchPromise

  scrollPrefetchPromise = (async () => {
    while (
      runId === scrollBufferRunId &&
      isAutoScroll.value &&
      scrollSegments.length < scrollMaxSegments
    ) {
      const pageNumber = scrollNextPage
      const dataJson = await fetchTablePage(pageNumber, getActivePageSize())

      if (runId !== scrollBufferRunId || !isAutoScroll.value) return

      let appended = appendScrollSegment(pageNumber, dataJson)
      if (!appended && pageNumber !== 1) {
        scrollNextPage = 1
        continue
      }
      if (!appended) return

      await nextTick()
      tableRef.value?.doLayout?.()
    }

    if (
      runId === scrollBufferRunId &&
      isAutoScroll.value &&
      scrollSegments.length < scrollMaxSegments
    ) {
      padScrollSegmentsForLoop()
      await nextTick()
      tableRef.value?.doLayout?.()
    }
  })()

  try {
    await scrollPrefetchPromise
  } finally {
    if (runId === scrollBufferRunId) {
      scrollPrefetchPromise = null
    }
  }
}

const prependScrollBuffer = async () => {
  const runId = scrollBufferRunId
  if (scrollPrefetchPromise) return scrollPrefetchPromise

  scrollPrefetchPromise = (async () => {
    if (
      runId !== scrollBufferRunId ||
      !isAutoScroll.value ||
      scrollDirection.value !== 'down'
    ) {
      return
    }

    const pageNumber = scrollPreviousPage
    const dataJson = await fetchTablePage(pageNumber, getActivePageSize())

    if (
      runId !== scrollBufferRunId ||
      !isAutoScroll.value ||
      scrollDirection.value !== 'down'
    ) {
      return
    }

    const averageRowHeight = getAverageRowHeight()
    const rowsCount = prependScrollSegment(pageNumber, dataJson)
    if (!rowsCount) return

    scrollPosition += rowsCount * averageRowHeight
    await nextTick()
    tableRef.value?.doLayout?.()
    await nextTick()
    setTableScrollTop(scrollPosition)
  })()

  try {
    await scrollPrefetchPromise
  } finally {
    if (runId === scrollBufferRunId) {
      scrollPrefetchPromise = null
    }
  }
}

const getAverageRowHeight = () => {
  const tableEl = tableRef.value?.$el
  const rows = tableEl
    ? Array.from(tableEl.querySelectorAll('.el-table__body tbody tr'))
    : []
  const visibleRows = rows.filter((row) => row.getBoundingClientRect().height > 0)
  if (!visibleRows.length) return 0

  const totalHeight = visibleRows.reduce(
    (sum, row) => sum + row.getBoundingClientRect().height,
    0
  )
  return totalHeight / visibleRows.length
}

const trimScrolledHeadSegment = async () => {
  if (scrollSegments.length <= 1) {
    if (!padScrollSegmentsForLoop()) return false
    await nextTick()
    tableRef.value?.doLayout?.()
    await nextTick()
  }

  const firstSegment = scrollSegments[0]
  const averageRowHeight = getAverageRowHeight()
  if (!averageRowHeight) return false

  const firstSegmentHeight = firstSegment.rows.length * averageRowHeight
  const { maxScrollTop } = getTableScrollState()
  const isAtScrollableEnd =
    scrollDirection.value === 'up' &&
    maxScrollTop > 0 &&
    maxScrollTop - scrollPosition <= 1

  if (scrollPosition < firstSegmentHeight && !isAtScrollableEnd) return false

  scrollSegments.shift()
  scrollPosition =
    scrollPosition >= firstSegmentHeight
      ? Math.max(0, scrollPosition - firstSegmentHeight)
      : 0
  applyScrollSegmentsToDataJson()
  scrollPreviousPage = getScrollPreviousPageNumber(scrollSegments[0].page)
  await nextTick()
  tableRef.value?.doLayout?.()
  await nextTick()
  setTableScrollTop(scrollPosition)
  await fillScrollBuffer()
  return true
}

const initializeScrollBuffer = async () => {
  resetScrollBuffer()
  const runId = scrollBufferRunId
  const firstDataJson = await fetchTablePage(1, getActivePageSize())

  if (runId !== scrollBufferRunId || !isAutoScroll.value) return

  currentPage.value = 1
  appendScrollSegment(1, firstDataJson)
  await nextTick()
  tableRef.value?.doLayout?.()
  await nextTick()
  await fillScrollBuffer()
  await nextTick()
  tableRef.value?.doLayout?.()
  await nextTick()
  resetTableScrollPosition()
}

const getTableScrollElement = () => {
  const tableEl = tableRef.value?.$el
  if (!tableEl) return null

  const candidates = Array.from(
    tableEl.querySelectorAll(
      [
        '.el-table__body-wrapper .el-scrollbar__wrap',
        '.el-table__body-wrapper .el-scrollbar__wrap--hidden-default',
        '.el-table__body-wrapper',
        '.el-scrollbar__wrap',
      ].join(',')
    )
  )

  return (
    candidates
      .filter((item) => item.scrollHeight - item.clientHeight > 1)
      .sort(
        (a, b) =>
          (b.scrollHeight - b.clientHeight) -
          (a.scrollHeight - a.clientHeight)
      )[0] ||
    candidates[0] ||
    null
  )
}

const getTableScrollState = () => {
  const scrollElement = getTableScrollElement()
  if (!scrollElement) {
    return {
      scrollElement: null,
      maxScrollTop: 0,
      scrollTop: 0,
      clientHeight: 0,
    }
  }

  return {
    scrollElement,
    maxScrollTop: Math.max(0, scrollElement.scrollHeight - scrollElement.clientHeight),
    scrollTop: scrollElement.scrollTop,
    clientHeight: scrollElement.clientHeight,
  }
}

const setTableScrollTop = (value) => {
  const scrollElement = getTableScrollElement()
  const nextScrollTop = Math.max(0, value)

  if (typeof tableRef.value?.setScrollTop === 'function') {
    tableRef.value.setScrollTop(nextScrollTop)
  }

  if (scrollElement) {
    scrollElement.scrollTop = nextScrollTop
  }
}

const resetTableScrollPosition = () => {
  const { maxScrollTop } = getTableScrollState()
  scrollPosition = scrollDirection.value === 'down' ? maxScrollTop : 0
  setTableScrollTop(scrollPosition)
}

const stopAutoScroll = () => {
  scrollRunId++
  lastScrollFrameTime = 0
  scrollPageLoading = false
  if (scrollAnimationId) {
    cancelAnimationFrame(scrollAnimationId)
    scrollAnimationId = 0
  }
}

const stopAutoPage = () => {
  autoPageLoading = false
  if (autoPageTimerId) {
    clearInterval(autoPageTimerId)
    autoPageTimerId = null
  }
}

const loadNextRuntimePage = async () => {
  if (scrollPageLoading || autoPageLoading || loading.value) return

  runtimePageChanging = true
  scrollPageLoading = true
  autoPageLoading = true
  try {
    currentPage.value = getNextPageNumber()
    await reloadRoadRemoteData()
    await nextTick()
    tableRef.value?.doLayout?.()
    await nextTick()
    if (isAutoScroll.value) resetTableScrollPosition()
  } finally {
    scrollPageLoading = false
    autoPageLoading = false
    runtimePageChanging = false
  }
}

const startAutoScroll = async () => {
  if (!isAutoScroll.value) return

  const runId = ++scrollRunId
  await nextTick()
  tableRef.value?.doLayout?.()
  await nextTick()
  if (!scrollSegments.length) {
    await initializeScrollBuffer()
  } else {
    const { scrollTop } = getTableScrollState()
    scrollPosition = scrollTop
  }

  const scrollFrame = async (timestamp) => {
    if (runId !== scrollRunId || !isAutoScroll.value) return

    const { maxScrollTop, scrollTop, clientHeight } = getTableScrollState()
    if (maxScrollTop <= 0) {
      fillScrollBuffer()
      scrollAnimationId = requestAnimationFrame(scrollFrame)
      return
    }

    if (scrollPosition > maxScrollTop || Math.abs(scrollPosition - scrollTop) > 2) {
      scrollPosition = scrollTop
    }

    if (!lastScrollFrameTime) lastScrollFrameTime = timestamp
    const deltaSeconds = Math.min((timestamp - lastScrollFrameTime) / 1000, 0.2)
    lastScrollFrameTime = timestamp

    if (!scrollPageLoading) {
      const distance = scrollSpeed.value * deltaSeconds
      const edgeThreshold = Math.max(
        clientHeight * 1.5,
        scrollSpeed.value * 2,
        scrollEdgeThreshold
      )
      if (scrollDirection.value === 'down') {
        scrollPosition = Math.max(0, scrollPosition - distance)
        setTableScrollTop(scrollPosition)
        if (scrollPosition <= edgeThreshold) {
          await prependScrollBuffer()
        }
      } else {
        scrollPosition = Math.min(maxScrollTop, scrollPosition + distance)
        setTableScrollTop(scrollPosition)
        if (maxScrollTop - scrollPosition <= edgeThreshold) {
          fillScrollBuffer()
        }
        if (await trimScrolledHeadSegment()) {
          fillScrollBuffer()
        }
      }
    }

    if (runId === scrollRunId && isAutoScroll.value) {
      scrollAnimationId = requestAnimationFrame(scrollFrame)
    }
  }

  scrollAnimationId = requestAnimationFrame(scrollFrame)
}

const startAutoPage = () => {
  if (!isAutoPage.value) return

  autoPageTimerId = setInterval(() => {
    loadNextRuntimePage()
  }, autoPageInterval.value * 1000)
}

const restartRuntimeTasks = async (reloadData = false) => {
  stopAutoScroll()
  stopAutoPage()

  if (reloadData) {
    runtimePageChanging = true
    try {
      currentPage.value = 1
      if (isAutoScroll.value) {
        await initializeScrollBuffer()
      } else {
        resetScrollBuffer()
        await reloadRoadRemoteData()
      }
      await nextTick()
      tableRef.value?.doLayout?.()
    } finally {
      runtimePageChanging = false
    }
  } else if (isAutoScroll.value && !scrollSegments.length) {
    await initializeScrollBuffer()
  }

  await nextTick()
  if (isAutoScroll.value) {
    await startAutoScroll()
  } else if (isAutoPage.value) {
    startAutoPage()
  }
}

onMounted(async () => {
  await restartRuntimeTasks(true)
})

watch(
  [isAutoScroll, scrollDirection, isAutoPage, requestPageSize],
  () => {
    restartRuntimeTasks(true)
  },
  { flush: 'post' }
)

watch(
  [scrollSpeed, autoPageInterval],
  () => {
    restartRuntimeTasks(false)
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  stopAutoScroll()
  stopAutoPage()
})

// 递归生成表头
const generateColumns = (columns) => {
  return columns?.map((column) => {
    if (column.children) {
      return {
        ...column,
        children: generateColumns(column.children),
      }
    }
    return column
  })
}

//首列合并
const objectSpanMethod = ({ row, column, rowIndex, columnIndex }) => {
  let mergeColumnKey = props.widgetObj.widgetParams[6]?.value
  if (!mergeColumnKey) return { rowspan: 1, colspan: 1 }
  let tableData =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.bodyData || []
  let headerData =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.headerData || []
  let mergetIndex = headerData.findIndex((item) => item.prop == mergeColumnKey)

  if (columnIndex === mergetIndex) {
    const prevRow = tableData[rowIndex - 1]
    const nextRow = tableData[rowIndex + 1]
    if (prevRow && prevRow[mergeColumnKey] === row[mergeColumnKey]) {
      return { rowspan: 0, colspan: 0 }
    }
    let rowspan = 1
    for (let i = rowIndex + 1; i < tableData.length; i++) {
      if (tableData[i][mergeColumnKey] === row[mergeColumnKey]) {
        rowspan++
      } else {
        break
      }
    }
    return { rowspan, colspan: 1 }
  }
}
</script>

<style lang="scss" scoped>
.date-range {
  margin-bottom: 5px;
  text-align: right;
}
.icons {
  width: 13px;
  margin-top: 2px;
}
</style>

<style lang="scss">
.microi-page-engine {
  .el-select-dropdown__wrap {
    max-height: 200px;
    overflow-y: auto;
  }
}
</style>
