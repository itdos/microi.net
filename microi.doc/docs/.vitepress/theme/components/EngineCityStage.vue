<template>
  <section ref="host" class="engine-city-stage" aria-label="吾码引擎之城：三维技术架构导览">
    <iframe v-if="activate" ref="frame" :src="entry" title="吾码 · 引擎之城，六大展区与全部引擎机位" allow="fullscreen" allowfullscreen @load="sendTheme" />
    <div v-else class="engine-city-placeholder"><span>MICROI · ENGINE CITY</span><strong>一座城，读懂吾码技术架构</strong><p>30+ 成熟引擎 · AI 低代码 · V8 · 微服务 · 全端交付</p></div>
  </section>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
const entry = 'https://file.microi.net/itdos/micro-app/microi-engine-city/index.html'
const host = ref(null), frame = ref(null), activate = ref(false)
let observer, themeObserver
function sendTheme() { frame.value?.contentWindow?.postMessage({ type: 'microi-engine-city:theme', theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light' }, new URL(entry).origin) }
onMounted(() => {
  observer = new IntersectionObserver(([item]) => { if (item.isIntersecting) { activate.value = true; observer.disconnect() } }, { rootMargin: '240px' })
  if (host.value) observer.observe(host.value)
  themeObserver = new MutationObserver(sendTheme); themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => { observer?.disconnect(); themeObserver?.disconnect() })
</script>

<style scoped>
.engine-city-stage{width:min(1440px,calc(100% - 48px));height:clamp(720px,57vw,920px);margin:24px auto 0;border:1px solid rgba(113,187,224,.28);border-radius:22px;overflow:hidden;background:#061529;box-shadow:0 28px 80px #0003;isolation:isolate}
.engine-city-stage iframe{display:block;width:100%;height:100%;border:0;color-scheme:dark}
.engine-city-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e1f8ff;background:radial-gradient(ellipse at center,#153c61,#061529 70%);text-align:center;padding:30px}
.engine-city-placeholder span{font-size:12px;letter-spacing:4px;color:#75bdd9}.engine-city-placeholder strong{font-size:clamp(22px,3vw,38px);margin-top:20px}.engine-city-placeholder p{font-size:14px;color:#a4bed6}
@media(max-width:760px){.engine-city-stage{height:720px;border-radius:15px;margin-top:18px}}
@media(max-width:640px){.engine-city-stage{width:calc(100% - 28px)}}
</style>
