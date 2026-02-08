<template>
  <video
    ref="videoPlayer"
    crossOrigin="Anonymous"
    :src="widgetObj.widgetParams[0]?.value"
    type="video/mp4"
    :controls="widgetObj.widgetParams[1]?.value"
    :autoplay="widgetObj.widgetParams[2]?.value"
    :loop="widgetObj.widgetParams[3]?.value"
    :muted="widgetObj.widgetParams[4]?.value"
    poster=""
    style="object-fit: fill; width: 100%; height: 100%"
  ></video>
</template>

<script setup name="video-widget">
const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})
</script>
