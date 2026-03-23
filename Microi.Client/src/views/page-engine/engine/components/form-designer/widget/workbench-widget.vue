<template>
  <div class="container">
    <img
      :src="widgetObj.widgetParams[0].typeOptions.dataJson.icon"
      alt="头像"
      class="avatar"
    />
    <div class="content">
      <div class="title">
        {{ widgetObj.widgetParams[0].typeOptions.dataJson.title }}
      </div>
      <div class="subtitle">
        {{ widgetObj.widgetParams[0].typeOptions.dataJson.subTitle }}
      </div>
    </div>
  </div>
</template>

<script setup name="workbench-widget">
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
.container {
  display: flex;
  align-items: center;
  padding: 20px;
  // background-color: #fff;
}
.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  margin-right: 20px;
}
.content {
  display: flex;
  flex-direction: column;
}
.title {
  font-size: 1.2em;
  font-weight: bold;
  margin-bottom: 5px;
}
.subtitle {
  font-size: 0.9em;
  // color: #666;
}
</style>
