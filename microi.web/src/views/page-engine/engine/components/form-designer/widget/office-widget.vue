<template>
  <div class="office-widget" ref="officeWidgetRef">
    <component
      class="office-component"
      :is="currentComponent"
      :src="filePath"
      @rendered="onRendered"
      :style="{ height: widgetObj.widgetOption.height + 'px' }"
    />
  </div>
</template>

<script setup name="office-widget">
import { ref, computed, defineAsyncComponent } from 'vue'
import { useRoute } from 'vue-router'
import { useWidget } from '../../../hooks/useWidget'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
const pageEngineStore = usePageEngineStore()
const { formData, curWidget, components } = storeToRefs(pageEngineStore)

import '@vue-office/docx/lib/index.css'
import '@vue-office/excel/lib/index.css'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const route = useRoute()
const filePath = computed(() => {
  const parentUrlParams = new URLSearchParams(window.parent.location.hash)
  const iframePath = parentUrlParams.get('filePath')
  console.log('iframePath', iframePath)
  if (iframePath) {
    return decodeURIComponent(iframePath)
  }
  if (formData.value.filePath) {
    console.log('formData.value.filePath', formData.value.filePath)
    return decodeURIComponent(formData.value.filePath)
  }
  if (!route.query.filePath) {
    return decodeURIComponent(
      props.widgetObj.widgetParams[0].typeOptions.dataJson?.filePath
    )
  }
  return decodeURIComponent(route.query.filePath)
})

const officeWidgetRef = ref()

const currentComponent = computed(() => {
  let filePath = route.query.filePath
  if (!filePath) {
    filePath = props.widgetObj.widgetParams[0].typeOptions.dataJson.filePath
  }
  if (filePath && filePath.toLowerCase().includes('doc')) {
    return defineAsyncComponent(() => import('@vue-office/docx'))
  } else if (filePath && filePath.toLowerCase().includes('xls')) {
    return defineAsyncComponent(() => import('@vue-office/excel'))
  } else if (filePath && filePath.toLowerCase().includes('pdf')) {
    return defineAsyncComponent(() => import('@vue-office/pdf'))
  }
  return null // 默认返回 null 或其他默认组件
})

//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

//设置临时数据
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

const onRendered = () => {
  console.log('office-widget 已加载完成')
}
</script>

<style lang="scss">
.microi-page-engine {
  .office-widget {
    width: 100%;
    margin-bottom: 20px;
  }

  // .x-spreadsheet-table {
  //   height: 400px !important;
  //   overflow: auto;
  // }
}
</style>
