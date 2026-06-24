<template>
  <div v-show="showSearchPanel" class="page-engine-search-bar">
    <el-space wrap>
      <el-radio-group
        v-if="enableDateFilter"
        v-model="activePeriod"
        size="small"
        class="period-group"
        @change="handlePeriodChange"
      >
        <el-radio-button
          v-for="item in periodOptions"
          :key="item.value"
          :label="item.value"
          :value="item.value"
          @click="handlePeriodChange(item.value)"
        >
          {{ item.label }}
        </el-radio-button>
      </el-radio-group>

      <el-popover
        v-if="hasMoreSearch"
        trigger="click"
        placement="bottom-end"
        :width="360"
        :teleported="false"
      >
        <template #reference>
          <el-button :icon="Filter" size="small">更多</el-button>
        </template>

        <div class="more-search-panel">
          <template
            v-for="(item, index) in searchData"
            :key="`${item.prop || index}-${index}`"
          >
            <el-input
              v-if="item.type === 'input' && !isPeriodSearch(item)"
              v-model="selectedValues[index]"
              size="small"
              :placeholder="`请输入${item.label || ''}`"
              clearable
              @keyup.enter="btnSearch"
            />

            <el-select
              v-else-if="item.type === 'select' && !isPeriodSearch(item)"
              v-model="selectedValues[index]"
              class="search-field"
              size="small"
              :placeholder="`请选择${item.label || ''}`"
              clearable
              filterable
              :remote="item.remote"
              :remote-method="query => remoteMethod(query, item, index)"
              :loading="selLoading"
              :teleported="false"
              @change="btnSearch"
              @keyup.enter="btnSearch"
            >
              <el-option
                v-for="option in item.options || []"
                :key="`${option.value}`"
                :value="option.value"
                :label="option.label"
              />
            </el-select>
          </template>

          <el-date-picker
            v-if="enableDateFilter"
            v-model="dateRange"
            class="date-range-picker"
            size="small"
            unlink-panels
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            format="YYYY-MM-DD"
            value-format="YYYY-MM-DD"
            :teleported="false"
            @change="handleDateRangeChange"
          />

          <div class="search-actions">
            <el-button :icon="Refresh" size="small" @click="resetSearch">
              重置
            </el-button>
            <el-button
              :icon="Search"
              size="small"
              type="primary"
              :loading="loading"
              @click="btnSearch"
            >
              查询
            </el-button>
          </div>
        </div>
      </el-popover>

      <el-button
        :icon="Search"
        size="small"
        :loading="loading"
        circle
        @click="btnSearch"
      />
    </el-space>
  </div>
</template>

<script setup name="common-search">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { Filter, Refresh, Search } from '@element-plus/icons-vue'
import { useWidget } from '../../hooks/useWidget'
import { get } from '../../utils/axiosInstance'
import {
  defaultPeriod,
  periodOptions,
  resolvePeriodRange,
} from '../../utils/periodRange'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
  searchIndex: {
    type: Number,
    default: 0,
  },
  pickerIndex: {
    type: Number,
    default: 0,
  },
  currentPage: {
    type: Number,
    default: -1,
  },
})

const emit = defineEmits(['setData', 'resetData'])

const selLoading = ref(false)
const selectedValues = ref({})
const dateRange = ref([])
const loading = ref(false)
const activePeriod = ref(defaultPeriod)
let periodSearchTimer = null
let syncingPeriodRange = false

const dataJson = computed(
  () => props.widgetObj.widgetParams[0]?.typeOptions?.dataJson || {}
)

const searchData = computed(() =>
  Array.isArray(dataJson.value.searchData) ? dataJson.value.searchData : []
)

const autoPeriodWidgets = ['statistic', 'progress', 'bar', 'line', 'linebar', 'pie', 'funnel']
const hasRemoteDataSource = computed(
  () => !!props.widgetObj.widgetParams[0]?.value
)
const enableAutoPeriodSearch = computed(
  () => autoPeriodWidgets.includes(props.widgetObj.type) && hasRemoteDataSource.value
)

const enableSearch = computed(
  () =>
    props.widgetObj.widgetParams[props.searchIndex]?.value === true ||
    enableAutoPeriodSearch.value
)

const enableDateFilter = computed(
  () =>
    props.widgetObj.widgetParams[props.pickerIndex]?.value === true ||
    enableAutoPeriodSearch.value
)

const showSearchPanel = computed(
  () => enableSearch.value || enableDateFilter.value
)

const hasMoreSearch = computed(
  () =>
    enableDateFilter.value ||
    searchData.value.some(item => !isPeriodSearch(item))
)

const isPeriodSearch = item =>
  item?.prop === 'period' || item?.prop === '_period'

const ensureSearchData = () => {
  if (!Array.isArray(dataJson.value.searchData)) {
    dataJson.value.searchData = []
  }
  return dataJson.value.searchData
}

const setSearchDataValue = (prop, value) => {
  const items = ensureSearchData()
  const target = items.find(item => item.prop === prop)
  if (target) {
    target.value = value
    return
  }
  if (isPeriodSearch({ prop })) {
    items.push({
      prop,
      value,
      defaultValue: defaultPeriod,
      label: prop === 'period' ? '统计周期' : '_period',
      type: 'select',
      remote: false,
      options: periodOptions.map(item => ({ ...item })),
    })
  }
}

const getSearchDataValue = prop => {
  const target = searchData.value.find(item => item.prop === prop)
  return target?.value
}

const syncPeriodToSearchData = () => {
  setSearchDataValue('period', activePeriod.value)
  setSearchDataValue('_period', activePeriod.value)
}

const applyPeriod = period => {
  activePeriod.value = period || defaultPeriod
  const range = resolvePeriodRange(activePeriod.value)
  syncingPeriodRange = true
  dateRange.value = [range.start, range.end]
  syncPeriodToSearchData()
  setTimeout(() => {
    syncingPeriodRange = false
  }, 0)
}

const initializeSelectedValues = () => {
  searchData.value.forEach((item, index) => {
    selectedValues.value[index] = item.value
  })
}

const remoteMethod = async (query, item, index) => {
  if (!query || !item.remote || !item.optionUrl) return

  selLoading.value = true
  try {
    const response = await get(item.optionUrl + query, {})
    if (response && response.length > 0 && searchData.value[index]) {
      searchData.value[index].options = response
    }
  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    selLoading.value = false
  }
}

const contentData = computed(() => {
  if (dataJson.value?.data) return dataJson.value.data
  if (dataJson.value?.bodyData) return dataJson.value.bodyData
  return dataJson.value
})

const { loadRemoteData } = useWidget(
  props.widgetObj,
  contentData,
  dateRange,
  loading,
  props.currentPage,
  undefined,
  activePeriod
)

const syncSelectedValuesToSearchData = () => {
  const savedValues = { ...selectedValues.value }
  for (const [index, value] of Object.entries(savedValues)) {
    if (searchData.value[index]) {
      searchData.value[index].value = value
    }
  }
  syncPeriodToSearchData()
}

const btnSearch = async () => {
  syncSelectedValuesToSearchData()
  await loadRemoteData()
  emit('setData', '')
}

const handlePeriodChange = period => {
  applyPeriod(period)
  if (periodSearchTimer) clearTimeout(periodSearchTimer)
  periodSearchTimer = setTimeout(async () => {
    await btnSearch()
    periodSearchTimer = null
  }, 0)
}

const handleDateRangeChange = async value => {
  if (syncingPeriodRange) return
  if (value && value.length === 2) {
    activePeriod.value = 'custom'
    syncPeriodToSearchData()
    await btnSearch()
  }
}

const resetSearch = async () => {
  searchData.value.forEach((item, index) => {
    if (isPeriodSearch(item)) {
      selectedValues.value[index] = defaultPeriod
      item.value = defaultPeriod
      return
    }
    selectedValues.value[index] = item.defaultValue || ''
    item.value = item.defaultValue || ''
  })
  if (enableDateFilter.value) applyPeriod(defaultPeriod)
  await btnSearch()
}

onMounted(async () => {
  initializeSelectedValues()
  if (enableDateFilter.value) {
    applyPeriod(getSearchDataValue('period') || getSearchDataValue('_period'))
  }
  await loadRemoteData()
  emit('resetData', '')
})

onBeforeUnmount(() => {
  if (periodSearchTimer) clearTimeout(periodSearchTimer)
})
</script>

<style lang="scss" scoped>
.page-engine-search-bar {
  margin-bottom: 8px;
  display: flex;
  justify-content: flex-end;
}

.period-group {
  margin-right: 2px;
}

.more-search-panel {
  display: grid;
  gap: 10px;
}

.search-field,
.date-range-picker {
  width: 100%;
}

.search-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
