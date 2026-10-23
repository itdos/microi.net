<template>
  <section ref="host" class="engine-city-stage" :data-theme="isDark ? 'dark' : 'light'" aria-label="吾码引擎之城：三维技术架构导览">
    <iframe v-if="activate" ref="frame" :src="entry" title="吾码 · 引擎之城：六大街区、119 栋可进入建筑、48 项引擎能力与馆内三维文档牌" allow="fullscreen" allowfullscreen @load="sendTheme" />
    <div v-else class="engine-city-placeholder"><span>MICROI · ENGINE CITY</span><strong>一座城，读懂吾码技术架构</strong><p>48 座能力地标 · 140 项功能 · AI 低代码 · V8 · 全端交付</p></div>
  </section>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useData } from 'vitepress'
const { isDark } = useData()
const baseEntry = 'https://static.itdos.com/itdos/micro-app/microi-engine-city/index.html?v=1.13.0'
const entryOrigin = new URL(baseEntry).origin
const entry = ref(baseEntry)
const host = ref(null), frame = ref(null), activate = ref(false)
let observer
function sendTheme() { frame.value?.contentWindow?.postMessage({ type: 'microi-engine-city:theme', theme: isDark.value ? 'dark' : 'light' }, entryOrigin) }
function receiveTheme(event) {
  // CDN origin 与当前 iframe Window 必须同时匹配，其他 iframe/网页不能代替展城切换官网主题。
  if (event.origin !== entryOrigin || event.source !== frame.value?.contentWindow) return
  if (event.data?.type === 'microi-engine-city:theme-ready') { sendTheme(); return }
  if (event.data?.type !== 'microi-engine-city:theme-change' || !['light', 'dark'].includes(event.data.theme)) return
  const dark = event.data.theme === 'dark'
  // VitePress 的 isDark 是官网主题单一事实源，watch 回发确认；相同值不再写入，避免往返循环。
  if (isDark.value !== dark) isDark.value = dark
}
watch(isDark, sendTheme, { flush: 'post' })
onMounted(() => {
  window.addEventListener('message', receiveTheme)
  observer = new IntersectionObserver(([item]) => { if (item.isIntersecting) {
    const initial = new URL(baseEntry); initial.searchParams.set('theme', isDark.value ? 'dark' : 'light'); entry.value = initial.href
    activate.value = true; observer.disconnect()
  } }, { rootMargin: '240px' })
  if (host.value) observer.observe(host.value)
})
onBeforeUnmount(() => { observer?.disconnect(); window.removeEventListener('message', receiveTheme) })
</script>

<style scoped>
.engine-city-stage{width:min(1440px,calc(100% - 48px));height:clamp(620px,46vw,720px);margin:24px auto 0;border:1px solid rgba(113,187,224,.28);border-radius:22px;overflow:hidden;background:#061529;box-shadow:0 28px 80px #0003;isolation:isolate}
.engine-city-stage iframe{display:block;width:100%;height:100%;border:0;color-scheme:dark}
.engine-city-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#e1f8ff;background:radial-gradient(ellipse at center,#153c61,#061529 70%);text-align:center;padding:30px}
.engine-city-placeholder span{font-size:12px;letter-spacing:4px;color:#75bdd9}.engine-city-placeholder strong{font-size:clamp(22px,3vw,38px);margin-top:20px}.engine-city-placeholder p{font-size:14px;color:#a4bed6}
.engine-city-stage[data-theme=light]{background:#e8f3fa;border-color:#96b9d0}
.engine-city-stage[data-theme=light] iframe{color-scheme:light}
.engine-city-stage[data-theme=light] .engine-city-placeholder{color:#163c57;background:radial-gradient(ellipse at center,#fff,#dceef8 70%)}
.engine-city-stage[data-theme=light] .engine-city-placeholder span,.engine-city-stage[data-theme=light] .engine-city-placeholder p{color:#3e6880}
@media(max-width:760px){.engine-city-stage{height:600px;border-radius:15px;margin-top:18px}}
@media(max-width:640px){.engine-city-stage{width:calc(100% - 28px)}}
</style>
