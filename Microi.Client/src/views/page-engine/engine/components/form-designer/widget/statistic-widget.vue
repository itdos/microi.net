<template>
  <CommonSearch
    :widgetObj="widgetObj"
    :searchIndex="18"
    :pickerIndex="19"
    :key="widgetObj.widgetOption.number"
  ></CommonSearch>
  <div v-if="appearance !== 'cards'" class="pe-summary" :class="{ 'pe-summary--detail': appearance === 'detail' }" :style="{ '--pe-metric-columns': summaryColumns }">
    <div v-for="(item, index) in contentData" :key="index" class="pe-summary-metric">
      <div v-if="appearance === 'summary' && item.icon" class="pe-summary-icon" :style="{ color: item.iconColor || 'var(--el-color-primary)' }">
        <el-icon><component :is="item.icon" /></el-icon>
      </div>
      <div class="pe-summary-copy">
        <strong>{{ formatStatisticValue(item.value, normalizeStatisticValue(item.value)) }}</strong>
        <a v-if="item.linkUrl" class="pe-summary-label" href="#" @click.prevent="handleMoreClick(item.linkUrl)">{{ displayStatisticTitle(item.name) }}</a>
        <span v-else class="pe-summary-label">{{ displayStatisticTitle(item.name) }}</span>
      </div>
    </div>
  </div>
  <el-row v-else style="width: 100%">
    <template v-for="(item, index) in contentData" :key="index">
      <el-col
        :xs="24"
        class="el-col pe-stat-col"
        :span="widgetObj.widgetParams[1]?.value"
        :style="blockStyle"
      >
        <el-statistic
          class="pe-stat-card"
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
          :value="normalizeStatisticValue(item.value)"
          :formatter="(value) => formatStatisticValue(item.value, value)"
          :precision="widgetObj.widgetParams[20]?.value"
        >
          <template #title>
            <div @click="handleMoreClick(item.linkUrl)" :style="titleStyle">
              <span>{{ displayStatisticTitle(item.name) }}</span>
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
import {
  formatPeriodTitle,
  getDataJsonPeriod,
} from '../../../utils/periodDisplay'

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
  const dataJson = props.widgetObj.widgetParams[0].typeOptions.dataJson
  const rawData = dataJson?.data || dataJson
  return Array.isArray(rawData) ? rawData : []
})

const appearance = computed(() => props.widgetObj.widgetParams[24]?.value || 'cards')
const summaryColumns = computed(() => Math.max(1, Math.min(6, Math.floor(Number(props.widgetObj.widgetParams[25]?.value) || 24 / (Number(props.widgetObj.widgetParams[1]?.value) || 8)))))

const activePeriod = computed(() =>
  getDataJsonPeriod(props.widgetObj.widgetParams[0].typeOptions.dataJson)
)

const displayStatisticTitle = title =>
  formatPeriodTitle(title, activePeriod.value)

const normalizeStatisticValue = (value) => {
  if (typeof value === 'number' || typeof value === 'object') return value
  if (typeof value !== 'string') return 0
  const parsed = Number.parseFloat(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

const formatStatisticValue = (sourceValue, value) => {
  if (typeof sourceValue === 'string') return sourceValue
  return value
}

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
.pe-summary { display: grid; grid-template-columns: repeat(var(--pe-metric-columns), minmax(0, 1fr)); gap: 20px 0; padding: 16px 0; }
.pe-summary-metric { display: flex; align-items: center; gap: 12px; padding: 0 18px; min-width: 0; border-inline-end: 1px solid var(--el-border-color-extra-light); }
.pe-summary-metric:last-child { border-inline-end: 0; }
.pe-summary-icon { flex: 0 0 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 25px; background: var(--el-fill-color-light); }
.pe-summary-copy { display: flex; flex-direction: column; gap: 9px; min-width: 0; }
.pe-summary-copy strong { font-size: 27px; font-weight: 650; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--el-text-color-primary); overflow-wrap: anywhere; }
.pe-summary-label { font-size: 14px; color: var(--el-text-color-secondary); line-height: 1.4; }
.pe-summary--detail { gap: 24px 0; border-top: 1px solid var(--el-border-color-extra-light); padding-top: 24px; }
.pe-summary--detail .pe-summary-metric { border: 0; padding: 0 10px; }
.pe-summary--detail .pe-summary-copy { gap: 4px; }
.pe-summary--detail strong { font-size: 18px; }
@media (max-width: 767px) { .pe-summary { grid-template-columns: repeat(2,minmax(0,1fr)); } .pe-summary-metric { padding: 0 8px; border: 0; } .pe-summary-copy strong { font-size: 22px; } }
.el-statistic {
  background-size: cover;
  background-position: center; /* 可选，确保图片居中 */
  background-repeat: no-repeat; /* 默认值，确保不重复 */
}
.date-range {
  margin-bottom: 5px;
  text-align: right;
}

.pe-stat-col {
  box-sizing: border-box;
}

.pe-stat-card {
  min-height: 78px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}

.pe-stat-card :deep(.el-statistic__head) {
  min-width: 0;
  line-height: 1.25;
}

.pe-stat-card :deep(.el-statistic__content) {
  min-width: 0;
  line-height: 1.1;
}

.pe-stat-card :deep(.el-statistic__head span),
.pe-stat-card :deep(.el-statistic__number) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
