<template>
  <div v-show="widgetObj.widgetParams[searchIndex]?.value" class="date-range">
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
        v-if="widgetObj.widgetParams[pickerIndex]?.value"
        v-model="dateRange"
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
</template>

<script setup name="progress-widget">
import { ref, onMounted, computed, watch } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { useWidget } from '../../hooks/useWidget'
import { get } from '../../utils/axiosInstance'
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

const selLoading = ref(false)

// 使用 defineEmits 定义要触发的事件
const emit = defineEmits(['setData', 'resetData'])

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
    } finally {
      selLoading.value = false
    }
  }
}

const selectedValues = ref({})
onMounted(async () => {
  props.widgetObj.widgetParams[0].typeOptions.dataJson.searchData?.forEach(
    (item, index) => {
      selectedValues.value[index] = item.value
    }
  )
  await loadRemoteData()
  emit('resetData', '')
})
// 搜索
const btnSearch = async (val) => {
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
  // 触发事件并可以传递参数
  emit('setData', '')
}
//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

const contentData = computed(() => {
  if (props.widgetObj.widgetParams[0].typeOptions.dataJson?.data) {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson?.data
  } else if (props.widgetObj.widgetParams[0].typeOptions.dataJson?.bodyData) {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson?.bodyData
  } else {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson
  }
})

// //设置临时数据
const { loadRemoteData } = useWidget(
  props.widgetObj,
  contentData,
  dateRange,
  loading,
  props.currentPage
)
await loadRemoteData()
</script>

<style lang="scss" scoped>
.date-range {
  margin-bottom: 10px;
  text-align: right;
}
</style>
