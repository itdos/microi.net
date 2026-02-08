<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="18"
    :pickerIndex="19"
    :key="widgetObj.widgetOption.number"
  ></CommonSearch>
  <el-row style="width: 100%">
    <template v-for="(item, index) in contentData" :key="index">
      <el-col
        :xs="24"
        class="el-col"
        :span="widgetObj.widgetParams[1]?.value"
        :style="blockStyle"
      >
        <el-statistic
          :style="[
            {
              backgroundColor: item.bgColor
                ? item.bgColor
                : widgetObj.widgetParams[4]?.value?.split(',')[
                    index > 7 ? 0 : index
                  ],
            },
            { padding: widgetObj.widgetParams[5]?.value },
            { borderRadius: widgetObj.widgetParams[6]?.value },
            {
              backgroundImage: item.bgImage
                ? item.bgImage
                : 'url(' + widgetObj.widgetParams[17]?.value + ')',
            },
          ]"
          :value-style="valueStyle"
          :value="item.value"
          :precision="widgetObj.widgetParams[20]?.value"
        >
          <template #title>
            <div @click="handleMoreClick(item.linkUrl)" :style="titleStyle">
              <span>{{ item.name }}</span>
            </div>
          </template>

          <template
            v-if="widgetObj.widgetParams[14]?.value == 'prefix'"
            #prefix
          >
            <el-icon :style="iconStyle">
              <component :is="item.icon"></component>
            </el-icon>
          </template>

          <template v-else #suffix>
            <el-icon :style="iconStyle">
              <component :is="item.icon"></component>
            </el-icon>
          </template>
        </el-statistic>
      </el-col>
    </template>
  </el-row>
</template>

<script setup name="statistic-widget">
import { computed } from 'vue'
import { EventBus } from '../../../utils/eventBus.js'
import { usePageEngineStore } from '../../../stores/pageEngine'
import { storeToRefs } from 'pinia'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
import CommonSearch from '../../CommonSearch/CommonSearch.vue'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

const blockStyle = computed(() => {
  return {
    backgroundColor: props.widgetObj.widgetParams[2]?.value,
    padding: props.widgetObj.widgetParams[3]?.value,
  }
})

const titleStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[7]?.value,
    fontWeight: props.widgetObj.widgetParams[8]?.value,
    color: props.widgetObj.widgetParams[9]?.value,
    margin: props.widgetObj.widgetParams[10]?.value,
  }
})

const valueStyle = computed(() => {
  return {
    fontSize: props.widgetObj.widgetParams[11]?.value,
    fontWeight: props.widgetObj.widgetParams[12]?.value,
    color: props.widgetObj.widgetParams[13]?.value,
    padding: props.widgetObj.widgetParams[21]?.value,
    margin: props.widgetObj.widgetParams[22]?.value,
  }
})

const iconStyle = computed(() => {
  return {
    color: props.widgetObj.widgetParams[15]?.value,
    fontSize: props.widgetObj.widgetParams[16]?.value,
    margin: props.widgetObj.widgetParams[23]?.value,
  }
})

const contentData = computed(() => {
  if (!props.widgetObj.widgetParams[0].typeOptions.dataJson?.data) {
    return props.widgetObj.widgetParams[0].typeOptions.dataJson
  }
  return props.widgetObj.widgetParams[0].typeOptions.dataJson.data
})

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

<style lang="scss" scoped>
.el-statistic {
  background-size: cover;
  background-position: center; /* 可选，确保图片居中 */
  background-repeat: no-repeat; /* 默认值，确保不重复 */
}
.date-range {
  margin-bottom: 10px;
  text-align: right;
}
</style>
