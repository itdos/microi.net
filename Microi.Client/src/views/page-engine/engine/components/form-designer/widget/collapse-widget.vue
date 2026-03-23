<template>
  <el-collapse v-model="activeNames" accordion>
    <template
      v-for="(activity, index) in widgetObj.widgetParams[0].typeOptions
        .dataJson"
      :key="index"
    >
      <el-collapse-item :title="activity.title" :name="index">
        <div :style="contentStyle">
          {{ activity.content }}
        </div>
      </el-collapse-item>
    </template>
  </el-collapse>
</template>

<script setup name="collapse-widget">
import { ref, computed } from 'vue'
import { useWidget } from '../../../hooks/useWidget'
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

// //设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

const activeNames = ref(['1'])

const contentStyle = computed(() => {
  return {
    padding: props.widgetObj.widgetParams[1]?.value,
    fontSize: props.widgetObj.widgetParams[2]?.value,
    color: props.widgetObj.widgetParams[3]?.value,
  }
})
</script>

<style lang="scss" scoped></style>
