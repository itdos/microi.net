<template>
  <ClientOnly>
    <div
      class="site-style-switch"
      :class="{ 'site-style-switch--floating': floating }"
      role="group"
      :aria-label="labels.group"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        class="site-style-switch__option"
        :class="{ active: siteStyle === option.value }"
        :aria-pressed="siteStyle === option.value"
        @click="setSiteStyle(option.value)"
      >
        {{ option.label }}
      </button>
    </div>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import { setSiteStyle, siteStyle, type SiteStyle } from '../site-style'

defineProps<{ floating?: boolean }>()

const route = useRoute()
const isEnglish = computed(() => route.path.startsWith('/en/'))
const labels = computed(() => isEnglish.value
  ? { group: 'Website style', mainstream: 'Mainstream', classic: 'Classic' }
  : { group: '官网风格', mainstream: '主流', classic: '经典' })

const options = computed<Array<{ label: string; value: SiteStyle }>>(() => [
  { label: labels.value.mainstream, value: 'mainstream' },
  { label: labels.value.classic, value: 'classic' }
])
</script>

