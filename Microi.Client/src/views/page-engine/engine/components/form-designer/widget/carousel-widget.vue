<template>
  <el-carousel
    :interval="widgetObj.widgetParams[1]?.value"
    :direction="widgetObj.widgetParams[2]?.value"
    :indicator-position="widgetObj.widgetParams[3]?.value"
    :type="widgetObj.widgetParams[4]?.value"
    :autoplay="widgetObj.widgetParams[5]?.value"
    :height="widgetObj.widgetOption.height + 'px'"
  >
    <el-carousel-item
      v-for="(item, index) in widgetObj.widgetParams[0].typeOptions.dataJson"
      :key="'carousel' + index"
    >
      <el-image
        class="carousel-img"
        style="width: 100%; height: 100%"
        :src="item.url"
        fit="fill"
        crossOrigin="anonymous"
      ></el-image>
    </el-carousel-item>
  </el-carousel>
</template>

<script setup name="carousel-widget">
import { ref } from 'vue'
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
</script>
