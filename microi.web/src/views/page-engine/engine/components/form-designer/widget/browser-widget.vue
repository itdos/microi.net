<template>
  <div
    :style="[
      { width: '100%' },
      { height: widgetObj.widgetOption.height + 'px' },
    ]"
    class="iframe-container"
  >
    <iframe
      :src="widgetObj.widgetParams[0]?.value"
      frameborder="0"
      allowfullscreen
    >
      <p>你的浏览器不支持iframe标签</p>
    </iframe>

    <!-- 遮罩层 -->
    <div
      v-show="formData.JsonObj.formConfig.mask"
      class="mask"
      @click="handleSetCurWidget"
    ></div>
  </div>
</template>

<script setup name="browser-widget">
import { storeToRefs } from 'pinia'
import { usePageEngineStore } from '../../../stores/pageEngine'
const pageEngineStore = usePageEngineStore()
const { formData } = storeToRefs(pageEngineStore)
const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
</script>

<style lang="scss" scoped>
.mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.1); /* 半透明黑色背景 */
  z-index: 8; /* 确保遮罩层在最上层 */
}

.iframe-container {
  position: relative;
}

.iframe-container iframe {
  // pointer-events: none;
  position: absolute;
  left: 0;
  top: 0;
  margin: 0px;
  width: 100%;
  height: 100%;
}
</style>
