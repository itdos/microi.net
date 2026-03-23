<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="26"
    :pickerIndex="27"
    :key="widgetObj.widgetOption.number"
  ></CommonSearch>

  <el-row style="width: 100%">
    <template v-for="(item, index) in contentData" :key="index">
      <el-col
        class="el-col"
        :xs="24"
        :span="widgetObj.widgetParams[1]?.value"
        :style="dynamicStyle"
      >
        <div v-show="widgetObj.widgetParams[12]?.value" :style="titleStyle">
          {{ item.title }}
        </div>
        <div :style="valueStyle">
          {{ item.value }}
        </div>
        <div v-show="widgetObj.widgetParams[7]?.value" :style="progressPadding">
          <el-progress
            :percentage="item.percentage"
            :type="widgetObj.widgetParams[5]?.value"
            :strokeWidth="widgetObj.widgetParams[6]?.value"
            :showText="widgetObj.widgetParams[7]?.value"
            :textInside="widgetObj.widgetParams[8]?.value"
            :width="widgetObj.widgetParams[10]?.value"
            :color="item.color == '' ? '#409EFF' : item.color"
          >
          </el-progress>
        </div>
        <div v-show="widgetObj.widgetParams[21]?.value" :style="subtitleStyle">
          {{ item.subTitle }}
        </div>
      </el-col>
    </template>
  </el-row>
</template>

<script setup name="progress-widget">
import { computed } from 'vue'

import CommonSearch from '../../CommonSearch/CommonSearch.vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const dynamicStyle = computed(() => {
  return {
    backgroundColor: props.widgetObj.widgetParams[2]?.value,
    padding: props.widgetObj.widgetParams[3]?.value,
    textAlign: props.widgetObj.widgetParams[4]?.value,
  }
})

const titleStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[13]?.value,
    fontWeight: props.widgetObj.widgetParams[14]?.value,
    color: props.widgetObj.widgetParams[15]?.value,
    margin: props.widgetObj.widgetParams[16]?.value,
  }
})

const subtitleStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[22]?.value,
    fontWeight: props.widgetObj.widgetParams[23]?.value,
    color: props.widgetObj.widgetParams[24]?.value,
    margin: props.widgetObj.widgetParams[25]?.value,
  }
})

const valueStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[17]?.value,
    fontWeight: props.widgetObj.widgetParams[18]?.value,
    color: props.widgetObj.widgetParams[19]?.value,
    margin: props.widgetObj.widgetParams[20]?.value,
  }
})

const progressPadding = computed(() => {
  return { padding: props.widgetObj.widgetParams[11]?.value }
})

const contentData = computed(() => {
  if (!props.widgetObj.widgetParams[0].typeOptions.dataJson?.data) {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson
  }
  return props.widgetObj.widgetParams[0].typeOptions.dataJson.data
})
</script>

<style lang="scss" scoped>
.date-range {
  margin-bottom: 10px;
  text-align: right;
}
</style>
