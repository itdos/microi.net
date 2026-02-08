<template>
  <el-calendar>
    <template #date-cell="{ data }">
      <el-tooltip
        :raw-content="true"
        :show-after="200"
        :content="curEvent(data.day)"
      >
        <div @click="handleDayClick(data.day)">
          <el-badge is-dot :hidden="!hasEvent(data.day)">
            {{ data.day.split('-')[2] }}
          </el-badge>

          {{ data.isSelected ? '✔️' : '' }}
        </div>
      </el-tooltip>
    </template>
  </el-calendar>
</template>

<script setup name="calendar-widget">
import { ref } from 'vue'
import { useWidget } from '../../../hooks/useWidget'
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { EventBus } from '../../../utils/eventBus'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

//设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

const hasEvent = (date) => {
  let index = props.widgetObj.widgetParams[0].typeOptions.dataJson.findIndex(
    (item) => item.date == date
  )
  return index > -1
}
const curEvent = (date) => {
  let index = props.widgetObj.widgetParams[0].typeOptions.dataJson.findIndex(
    (item) => item.date == date
  )
  return props.widgetObj.widgetParams[0].typeOptions.dataJson[index]?.content ==
    null
    ? '无事件'
    : props.widgetObj.widgetParams[0].typeOptions.dataJson[index]?.content
}

const handleDayClick = (data) => {
  if (formData.value.JsonObj.formConfig.link) {
    //触发事件总线
    EventBus.emit('calendarSelDate', data)

    // 通过 postMessage 方式向父窗口通信
    window.parent?.postMessage({ key: 'calendarSelDate', value: data }, '*')

    console.log('触发日历事件总线，当前点击日期：', data)
  }
}
</script>

<style lang="scss">
.microi-page-engine {
  .el-calendar {
    text-align: center;
    --el-calendar-cell-width: 38px !important;
  }
  .el-calendar-day {
    padding-top: 8px;
  }
  .el-calendar__body {
    padding: 0;
  }
  .el-calendar__header {
    padding: 5px 20px;
  }
}
</style>

<style lang="scss" scoped></style>
