<template>
  <picker mode="multiSelector" :range="region.columns" range-key="name" :value="region.indexes"
    @tap="resetRegion" @cancel="resetRegion" @columnchange="changeColumn" @change="confirmRegion">
    <slot></slot>
  </picker>
</template>

<script>
import appConfig from '@/config.js'
import { createRegionPickerState, updateRegionPickerState, regionPickerSelection } from '@/platform/region-picker.mjs'

export default {
  name: 'MciRegionPicker',
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ['update:modelValue', 'change'],
  data() { return { region: createRegionPickerState(this.modelValue, appConfig.defaultRegion) } },
  watch: { modelValue: { deep: true, handler() { this.resetRegion() } } },
  methods: {
    // 滚轮草稿不写入业务值；取消或重新打开时回到已选值，空值才采用 Profile 默认地区。
    resetRegion() { this.region = createRegionPickerState(this.modelValue, appConfig.defaultRegion) },
    changeColumn(event) { this.region = updateRegionPickerState(this.region, event.detail.column, event.detail.value) },
    confirmRegion(event) {
      const value = regionPickerSelection(this.region, event.detail.value)
      this.$emit('update:modelValue', value)
      this.$emit('change', { detail: { value } })
    }
  }
}
</script>
