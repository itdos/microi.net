<template>
  <div class="timeline-widget">
    <el-timeline>
      <template
        v-for="(activity, index) in widgetObj.widgetParams[0].typeOptions
          .dataJson"
        :key="index"
      >
        <el-timeline-item
          :timestamp="activity.date"
          :type="
            index == widgetObj.widgetParams[0].typeOptions.dataJson.length - 1
              ? 'success'
              : 'info'
          "
          :size="
            index == widgetObj.widgetParams[0].typeOptions.dataJson.length - 1
              ? 'large'
              : 'normal'
          "
          placement="top"
        >
          <el-card>
            <h4>{{ activity.title }}</h4>
            <p class="content">{{ activity.content }}</p>
          </el-card>
        </el-timeline-item>
      </template>
    </el-timeline>
  </div>
</template>

<script setup name="timeline-widget">
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

<style lang="scss" scoped>
.timeline-widget {
  ul {
    padding-inline-start: 20px;
  }

  h4 {
    font-size: 13px;
    display: block;
    margin-block-start: 1.1em;
    margin-block-end: 1.1em;
    margin-inline-start: 0px;
    margin-inline-end: 0px;
    font-weight: bold;
    unicode-bidi: isolate;
  }
  .content {
    font-size: 12px;
    color: #909399;
  }

  .el-timeline-item:last-child {
    padding-bottom: 0px !important;
  }
}
</style>
