<template>
  <ClientOnly>
    <section v-if="isVisible" class="mainstream-home-band" aria-label="Microi 平台概览">
      <div class="mainstream-proof-grid">
        <article v-for="item in proofItems" :key="item.label" class="mainstream-proof-item">
          <strong>{{ item.value }}</strong>
          <span>{{ item.label }}</span>
        </article>
      </div>
      <div class="mainstream-section-intro">
        <span class="mainstream-section-kicker">CORE CAPABILITIES</span>
        <h2>从业务想法到企业级应用，一套平台完成</h2>
        <p>围绕 AI 编程、低代码建模、系统集成与私有化交付，提供清晰、可扩展的数字化能力底座。</p>
      </div>
    </section>
  </ClientOnly>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()
const isVisible = computed(() => {
  const path = route.path || '/'
  return path === '/' || path === '/index' || path === '/index.html'
})

const proofItems = [
  { value: '10+ 年', label: '持续产品演进' },
  { value: '20+', label: '核心系统引擎' },
  { value: 'AI', label: '零代码AI编程' },
  { value: 'MIT', label: '开放源码协议' }
]
</script>
