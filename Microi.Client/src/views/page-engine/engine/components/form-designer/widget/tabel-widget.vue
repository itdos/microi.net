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
    :data="widgetObj.widgetParams[0].typeOptions.dataJson.bodyData"
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
        )"
        :key="index"
        :column="column"
        :widget-obj="widgetObj"
      />
    </template>
  </el-table>

  <div style="margin-top: 12px; display: flex; justify-content: flex-end">
    <el-pagination
      v-if="widgetObj.widgetParams[7] && widgetObj.widgetParams[7]?.value != -1"
      layout="prev, pager, next"
      background
      size="small"
      :hide-on-single-page="false"
      :total="widgetObj.widgetParams[0].typeOptions.dataJson.total"
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
  </div>
</template>

<script setup name="tabel-widget">
import { ref, computed, onMounted } from 'vue'
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

const pageSize = computed(() => {
  let pageSize = 10
  if (props.widgetObj.widgetParams[7])
    pageSize = props.widgetObj.widgetParams[7]?.value
  return pageSize
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
    if (
      props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData[index]
    ) {
      props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData[
        index
      ].value = value
    }
  }

  await loadRemoteData()
}
// 搜索
const btnSearch = async (val) => {
  currentPage.value = 1
  await reloadRoadRemoteData()
}

// 每页条数变更事件
const handleSizeChange = async (val) => {
  currentPage.value = 1
  await reloadRoadRemoteData()
}
// 当前页变更事件
const handleCurrentChange = async (val) => {
  await reloadRoadRemoteData()
}

const allData = []
allData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson.bodyData

// 日期区间
const dateRange = ref()
// 是否加载中
const loading = ref(false)

const { loadRemoteData } = useWidget(
  props.widgetObj,
  allData.value,
  dateRange,
  loading,
  currentPage
)
await loadRemoteData()

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
  let tableData = props.widgetObj.widgetParams[0].typeOptions.dataJson.bodyData
  let headerData =
    props.widgetObj.widgetParams[0].typeOptions.dataJson.headerData
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
  margin-bottom: 10px;
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
