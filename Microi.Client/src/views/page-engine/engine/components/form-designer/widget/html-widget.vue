<template>
  <div v-html="computedHtml" style="width: 100%; height: 100%"></div>
</template>

<script setup name="html-widget">
import { defineProps, ref, computed } from 'vue'
import { useWidget } from '../../../hooks/useWidget'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const computedHtml = computed(() => {
  const dataJson = props.widgetObj.widgetParams[0].typeOptions.dataJson
  const context = { ...dataJson } // 将 dataJson 展开为上下文对象
  return props.widgetObj.widgetParams[0].typeOptions.dataHtml.replace(
    /\${(\S+)}/g,
    (match, key) => {
      return context[key] ?? '' // 使用可选链操作符，避免 undefined
    }
  )
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
</script>

<style lang="scss" scoped></style>
