<template>
  <view class="mci-water-motion" aria-hidden="true">
    <video
      v-if="mode === 'hero' && motionEnabled && videoUrl && !videoFailed"
      class="mci-water-motion__video"
      :src="videoUrl"
      :poster="posterUrl"
      :autoplay="true"
      :loop="true"
      :muted="true"
      :controls="false"
      :show-center-play-btn="false"
      :show-play-btn="false"
      :show-fullscreen-btn="false"
      :show-mute-btn="false"
      :enable-progress-gesture="false"
      :enable-play-gesture="false"
      object-fit="cover"
      @error="handleVideoError"
    />
  </view>
</template>

<script>
import config from '@/config.js'

export default {
  name: 'MciWaterMotion',
  props: {
    tone: { type: String, default: 'dark' },
    mode: { type: String, default: 'hero' }
  },
  data() {
    return {
      videoFailed: false,
      motionEnabled: false,
      activationTimer: null
    }
  },
  computed: {
    videoUrl() {
      return (config.cdnAssets && config.cdnAssets.waterMotion) || ''
    },
    posterUrl() {
      return (config.cdnAssets && config.cdnAssets.waterHero) || ''
    }
  },
  mounted() {
    this.scheduleMotion()
  },
  beforeUnmount() {
    if (this.activationTimer) clearTimeout(this.activationTimer)
    this.activationTimer = null
  },
  methods: {
    scheduleMotion() {
      let info = {}
      try {
        info = uni.getDeviceInfo ? uni.getDeviceInfo() : uni.getSystemInfoSync()
      } catch (error) {}
      const benchmark = Number(info.benchmarkLevel || 0)
      const memory = Number(info.deviceMemory || info.memorySize || 0)
      const lowEnd = (benchmark > 0 && benchmark < 12) || (memory > 0 && memory < 3)
      if (lowEnd || !this.videoUrl) return
      this.activationTimer = setTimeout(() => {
        this.motionEnabled = true
        this.activationTimer = null
      }, 720)
    },
    handleVideoError() {
      this.videoFailed = true
    }
  }
}
</script>

<style scoped>
.mci-water-motion {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}
.mci-water-motion__video {
  position: absolute;
  inset: -2%;
  width: 104%;
  height: 104%;
  opacity: .58;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .mci-water-motion__video { display: none; }
}
</style>
