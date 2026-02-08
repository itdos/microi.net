<template>
  <el-row style="width: 100%">
    <template
      v-for="(item, index) in widgetObj.widgetParams[0].typeOptions.dataJson"
      :key="index"
    >
      <el-col
        class="el-col"
        :span="widgetObj.widgetParams[1]?.value"
        :style="dynamicStyle"
        style="text-align: center"
      >
        <div style="cursor: pointer">
          <img
            @click="handleMoreClick(item.linkUrl)"
            :style="iconStyle"
            :src="item.iconUrl == '' ? defaultIcon : item.iconUrl"
          />
        </div>
        <div :style="fontStyle">
          {{ item.title }}
        </div>
      </el-col>
    </template>
  </el-row>
</template>

<script setup name="links-widget">
import { ref, computed } from 'vue'
import { useWidget } from '../../../hooks/useWidget'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
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

const dynamicStyle = computed(() => {
  return {
    backgroundColor: props.widgetObj.widgetParams[2]?.value,
    padding: props.widgetObj.widgetParams[3]?.value,
  }
})

const fontStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[4]?.value,
    fontWeight: props.widgetObj.widgetParams[5]?.value,
    color: props.widgetObj.widgetParams[6]?.value,
    margin: props.widgetObj.widgetParams[7]?.value,
  }
})

const iconStyle = computed(() => {
  return {
    width: props.widgetObj.widgetParams[8]?.value,
    height: props.widgetObj.widgetParams[9]?.value,
  }
})

const defaultIcon = ''

const handleMoreClick = (linkUrl) => {
  if (formData.value.JsonObj.formConfig.link) {
    EventBus.emit('linkWidget', linkUrl, props.widgetObj.widgetParams.linktype)
    window.parent?.postMessage({ key: 'linkWidget', value: linkUrl }, '*')
    console.log('链接触发', linkUrl)
  } else {
    console.log('链接跳转已禁用')
  }
}
</script>

<style lang="scss" scoped></style>
