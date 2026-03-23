<template>
  <n-button quaternary @click="changeTheme" title="主题">
    <n-icon size="20" :depth="1">
      <moon-icon v-if="designStore.darkTheme"></moon-icon>
      <sunny-icon v-else></sunny-icon>
    </n-icon>
  </n-button>
</template>

<script lang="ts" setup>
import { useDesignStore } from '@goview/store/modules/designStore/designStore'
import { setHtmlTheme } from '@goview/utils'
import { icon } from '@goview/plugins'
const { MoonIcon, SunnyIcon } = icon.ionicons5
const designStore = useDesignStore()

// 改变样式
const changeTheme = () => {
  designStore.changeTheme()
  setHtmlTheme()
}
</script>
