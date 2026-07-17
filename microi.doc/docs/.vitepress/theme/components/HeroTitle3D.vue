<template>
  <ClientOnly>
    <div v-if="isHomePage" ref="anchorRef" class="hero-title-3d-anchor"></div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

const isHomePage = ref(false)
const anchorRef = ref(null)
const route = useRoute()

let brandEl = null      // 挂在 document.body 上的 fixed 容器
let brandInner = null
let glowLayer = null
let nameEl = null        // 缓存 .VPHero .name 引用
let animId = null
let retryTimers = []
const brandMouse = { x: 0, y: 0, targetX: 0, targetY: 0 }

const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

function inject3DTitle() {
  if (typeof window === 'undefined') return
  nameEl = document.querySelector('.VPHero .name')
  if (!nameEl || nameEl.dataset.injected3d) return

  nameEl.dataset.injected3d = 'true'
  // 隐藏原有文字内容
  const origChildren = Array.from(nameEl.childNodes)
  origChildren.forEach(c => {
    if (c.nodeType === 1) c.style.display = 'none'
    else if (c.nodeType === 3) {
      const wrap = document.createElement('span')
      wrap.style.display = 'none'
      wrap.textContent = c.textContent
      c.replaceWith(wrap)
    }
  })

  const fontBase = "font:700 48px/1.2 'SF Pro Display','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:2px;white-space:nowrap;"
  const microHTML = 'Micro'
  const iHTML = 'i'
  const wumaHTML = '吾码'

  // ── 挂到 document.body 的 fixed 容器（完全脱离 VitePress DOM 层级，避免祖先 CSS 压平 preserve-3d）──
  brandEl = document.createElement('div')
  brandEl.style.cssText = 'position:fixed;z-index:100;pointer-events:none;perspective:600px;'

  brandInner = document.createElement('div')
  brandInner.style.cssText = 'transform-style:preserve-3d;will-change:transform;position:relative;transform-origin:center center;'

  // ── 深层阴影 ──
  const shadow3 = document.createElement('div')
  shadow3.innerHTML = '<span style="color:rgba(50,15,100,0.12)">' + microHTML + '</span><span style="color:rgba(120,15,15,0.12)">' + iHTML + '</span><span style="color:rgba(50,15,100,0.12)">' + wumaHTML + '</span>'
  shadow3.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(-28px) translateX(6px) translateY(6px);filter:blur(6px);`
  brandInner.appendChild(shadow3)

  // ── 8 层挤出 ──
  const extrudeColors = [
    'rgba(55,20,110,0.35)', 'rgba(65,25,130,0.33)', 'rgba(75,30,150,0.30)', 'rgba(85,35,165,0.27)',
    'rgba(100,42,185,0.24)', 'rgba(115,50,200,0.20)', 'rgba(125,58,210,0.16)', 'rgba(138,65,226,0.12)',
  ]
  const extrudeIColors = [
    'rgba(160,15,15,0.35)', 'rgba(175,18,18,0.33)', 'rgba(190,20,20,0.30)', 'rgba(200,22,22,0.27)',
    'rgba(215,25,25,0.24)', 'rgba(225,28,28,0.20)', 'rgba(235,32,32,0.16)', 'rgba(245,35,35,0.12)',
  ]
  const extrudeWumaColors = [
    'rgba(55,20,110,0.35)', 'rgba(65,25,130,0.33)', 'rgba(75,30,150,0.30)', 'rgba(85,35,165,0.27)',
    'rgba(100,42,185,0.24)', 'rgba(115,50,200,0.20)', 'rgba(125,58,210,0.16)', 'rgba(138,65,226,0.12)',
  ]
  for (let ei = 0; ei < 8; ei++) {
    const t = ei / 7
    const z = -22 + t * 22
    const ox = (1 - t) * 3.5
    const oy = (1 - t) * 3.5
    const layer = document.createElement('div')
    layer.innerHTML = '<span style="color:' + extrudeColors[ei] + '">' + microHTML + '</span><span style="color:' + extrudeIColors[ei] + '">' + iHTML + '</span><span style="color:' + extrudeWumaColors[ei] + '">' + wumaHTML + '</span>'
    layer.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(${z}px) translateX(${ox}px) translateY(${oy}px);`
    brandInner.appendChild(layer)
  }

  // ── 辉光层 ──
  glowLayer = document.createElement('div')
  glowLayer.innerHTML = '<span style="color:rgba(138,80,226,0.45)">' + microHTML + '</span><span style="color:rgba(255,50,50,0.5)">' + iHTML + '</span><span style="color:rgba(138,80,226,0.45)">' + wumaHTML + '</span>'
  glowLayer.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(138,80,226,0.45);transform:translateZ(2px);filter:blur(10px);`
  brandInner.appendChild(glowLayer)

  // ── 主文字层 ──
  const mainText = document.createElement('div')
  mainText.innerHTML = '<span style="background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed,#6366f1,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + microHTML + '</span><span style="color:#ff2828;text-shadow:0 0 12px rgba(255,40,40,0.6),0 0 24px rgba(255,40,40,0.2);">' + iHTML + '</span><span style="background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed,#6366f1,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + wumaHTML + '</span>'
  mainText.style.cssText = `position:relative;${fontBase}transform:translateZ(14px);`
  brandInner.appendChild(mainText)

  // ── 顶部高光反射层 ──
  const highlight = document.createElement('div')
  highlight.innerHTML = microHTML + iHTML + wumaHTML
  highlight.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(20px);background:linear-gradient(170deg,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0.08) 30%,transparent 50%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;`
  brandInner.appendChild(highlight)

  brandEl.appendChild(brandInner)
  document.body.appendChild(brandEl)

  startAnimation()
}

function startAnimation() {
  if (animId) return
  let hasMouse = false
  const onMouseMove = (e) => {
    hasMouse = true
    brandMouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2
    brandMouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true })

  const startTime = performance.now()
  const animate = () => {
    animId = requestAnimationFrame(animate)
    const elapsed = (performance.now() - startTime) * 0.001

    // 跟踪 .VPHero .name 的位置，把 3D 标题对齐上去
    if (nameEl && brandEl) {
      const rect = nameEl.getBoundingClientRect()
      brandEl.style.left = rect.left + 'px'
      brandEl.style.top = rect.top + 'px'
    }

    // 自动悬浮动画
    const autoX = Math.sin(elapsed * 0.6) * 0.35 + Math.sin(elapsed * 1.1) * 0.15
    const autoY = Math.cos(elapsed * 0.5) * 0.3 + Math.cos(elapsed * 0.9) * 0.12

    if (hasMouse) {
      brandMouse.x += (brandMouse.targetX - brandMouse.x) * 0.08
      brandMouse.y += (brandMouse.targetY - brandMouse.y) * 0.08
    } else {
      brandMouse.x = 0
      brandMouse.y = 0
    }

    const totalX = brandMouse.y + autoY
    const totalY = brandMouse.x + autoX
    const tiltX = -totalX * 25
    const tiltY = totalY * 25
    const glowPulse = Math.sin(elapsed * 1.5) * 0.15 + 0.85
    if (brandInner) brandInner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
    if (glowLayer) glowLayer.style.opacity = glowPulse
  }
  animate()

  window.__heroTitle3D_cleanup = () => {
    window.removeEventListener('mousemove', onMouseMove)
    if (animId) cancelAnimationFrame(animId)
    animId = null
  }
}

function cleanup() {
  retryTimers.forEach(id => clearTimeout(id))
  retryTimers = []

  if (window.__heroTitle3D_cleanup) {
    window.__heroTitle3D_cleanup()
    delete window.__heroTitle3D_cleanup
  }
  if (animId) cancelAnimationFrame(animId)
  animId = null

  // 移除 body 上的 3D 元素
  if (brandEl && brandEl.parentNode) brandEl.parentNode.removeChild(brandEl)

  // 恢复 .VPHero .name
  const el = nameEl || document.querySelector('.VPHero .name')
  if (el && el.dataset.injected3d) {
    delete el.dataset.injected3d
    el.querySelectorAll(':scope > span[style*="display: none"], :scope > span[style*="display:none"]').forEach(s => {
      s.style.display = ''
    })
  }
  nameEl = null
  brandEl = null
  brandInner = null
  glowLayer = null
}

function tryInject() {
  let attempts = 0
  const maxAttempts = 20
  const tryIt = () => {
    const el = document.querySelector('.VPHero .name')
    if (el && !el.dataset.injected3d) {
      inject3DTitle()
    } else if (attempts < maxAttempts) {
      attempts++
      const tid = setTimeout(tryIt, 200)
      retryTimers.push(tid)
    }
  }
  tryIt()
}

watch(() => route.path, () => {
  const isHome = checkHomePage()
  isHomePage.value = isHome
  if (isHome) {
    nextTick(() => tryInject())
  } else {
    cleanup()
  }
}, { immediate: false })

onMounted(() => {
  isHomePage.value = checkHomePage()
  if (isHomePage.value) {
    nextTick(() => tryInject())
  }
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scoped>
.hero-title-3d-anchor {
  display: none;
}
</style>
