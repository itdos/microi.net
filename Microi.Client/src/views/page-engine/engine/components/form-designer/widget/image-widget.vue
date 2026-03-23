<template>
  <el-image
    :src="widgetObj.widgetParams[0]?.value"
    fit="fill"
    style="width: 100%; height: 100%"
  ></el-image>
</template>

<script setup name="image-widget">
import { defineProps } from 'vue'
const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
</script>

<style lang="scss" scoped></style>
