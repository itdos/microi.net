<template>
  <el-steps
    :space="widgetObj.widgetParams[1]?.value"
    :direction="widgetObj.widgetParams[2]?.value"
    :active="widgetObj.widgetParams[0].typeOptions.dataJson.activeIndex"
    :align-center="widgetObj.widgetParams[3]?.value"
    :simple="widgetObj.widgetParams[4]?.value"
  >
    <template
      v-for="(item, index) in widgetObj.widgetParams[0].typeOptions.dataJson
        .stepArr"
      :key="index"
    >
      <el-step :status="item.status" :icon="item.icon">
        <template #title>
          {{ item.title }}
          <div class="description">
            {{ item.description }}
          </div>
          <div
            class="description"
            style="color: var(--el-text-color-placeholder)"
          >
            {{ item.timestamp }}
          </div>
        </template>
        <template #description>
          <el-timeline>
            <el-timeline-item
              v-for="(subitem, index) in item.subdata"
              :key="index"
              :timestamp="subitem.timestamp"
              :color="subitem.color"
            >
              <span
                class="subitem"
                @click="handleClick(subitem.id, subitem.router)"
              >
                {{ subitem.content }}
              </span>
            </el-timeline-item>
          </el-timeline>
        </template>
      </el-step>
    </template>
  </el-steps>
</template>

<script setup name="steps-widget">
import { ref } from 'vue'
import { EventBus } from '../../../utils/eventBus.js'
import { useWidget } from '../../../hooks/useWidget'
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
const handleClick = (id, linkUrl) => {
  if (formData.value.JsonObj.formConfig.link) {
    EventBus.emit('stepsWidget', id, linkUrl)
    window.parent?.postMessage({ key: 'stepsWidget', value: linkUrl }, '*')
    console.log('步骤组件触发连接', id, linkUrl)
  } else {
    console.log('链接跳转已禁用')
  }
}
</script>

<style lang="scss">
.microi-page-engine {
  .el-step__icon {
    background: var(--el-bg-color-overlay) !important;
  }
  .el-step__title {
    font-size: 14px;
    line-height: 30px;
  }
  .el-timeline {
    // max-width: 600px;
    padding-left: 0;
    margin-top: 20px;
  }
}
</style>

<style scoped lang="scss">
.description {
  font-size: 13px;
  line-height: 22px;
}
.subitem {
  cursor: pointer;
  font-size: 12px;
}
</style>
