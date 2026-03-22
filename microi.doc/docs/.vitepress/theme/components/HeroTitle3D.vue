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

let brandEl = null
let brandInner = null
let glowLayer = null
let animId = null
const brandMouse = { x: 0, y: 0, targetX: 0, targetY: 0 }

const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

function inject3DTitle() {
  if (typeof window === 'undefined') return
  // 找到 VitePress 渲染的 hero .name 容器
  const nameEl = document.querySelector('.VPHero .name')
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

  // 构建 3D 容器
  brandEl = document.createElement('div')
  brandEl.style.cssText = 'display:inline-block;position:relative;perspective:800px;'

  brandInner = document.createElement('div')
  brandInner.style.cssText = 'transform-style:preserve-3d;will-change:transform;position:relative;transform-origin:center center;display:inline-block;'

  const fontBase = "font:700 48px/1.2 'SF Pro Display','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:2px;white-space:nowrap;"
  const microHTML = 'Micro'
  const iHTML = 'i'
  const wumaHTML = '吾码'

  // ── 最远深层阴影 (大偏移、强模糊，倾斜时清晰可见的投影) ──
  const shadow3 = document.createElement('div')
  shadow3.innerHTML = microHTML + '<span style="color:rgba(200,30,30,0.25)">' + iHTML + '</span><span style="color:rgba(80,30,160,0.2)">' + wumaHTML + '</span>'
  shadow3.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(80,30,160,0.2);transform:translateZ(-50px) translateX(14px) translateY(14px);filter:blur(14px);`

  // ── 第二层阴影 (中距离投影) ──
  const shadow2 = document.createElement('div')
  shadow2.innerHTML = microHTML + '<span style="color:rgba(180,20,20,0.22)">' + iHTML + '</span><span style="color:rgba(70,25,140,0.18)">' + wumaHTML + '</span>'
  shadow2.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(70,25,140,0.18);transform:translateZ(-35px) translateX(9px) translateY(9px);filter:blur(8px);`

  // ── 第三层阴影 (近距离投影，增加厚度感) ──
  const shadow1 = document.createElement('div')
  shadow1.innerHTML = microHTML + '<span style="color:rgba(160,15,15,0.2)">' + iHTML + '</span><span style="color:rgba(60,20,120,0.15)">' + wumaHTML + '</span>'
  shadow1.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(60,20,120,0.15);transform:translateZ(-20px) translateX(5px) translateY(5px);filter:blur(4px);`

  // ── 挤出层 ──
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
    const z = -28 + t * 28
    const ox = (1 - t) * 6
    const oy = (1 - t) * 6
    const layer = document.createElement('div')
    layer.innerHTML = '<span style="color:' + extrudeColors[ei] + '">' + microHTML + '</span><span style="color:' + extrudeIColors[ei] + '">' + iHTML + '</span><span style="color:' + extrudeWumaColors[ei] + '">' + wumaHTML + '</span>'
    layer.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(${z}px) translateX(${ox}px) translateY(${oy}px);`
    brandInner.appendChild(layer)
  }

  // ── 辉光层 ──
  glowLayer = document.createElement('div')
  glowLayer.innerHTML = microHTML + '<span style="color:rgba(255,60,60,0.7)">' + iHTML + '</span><span style="color:rgba(138,80,226,0.45)">' + wumaHTML + '</span>'
  glowLayer.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(138,80,226,0.45);transform:translateZ(2px);filter:blur(12px);`

  // ── 字母i专属辉光层 (额外红色发光，确保i清晰可见) ──
  const iGlow = document.createElement('div')
  iGlow.innerHTML = '<span style="-webkit-text-fill-color:transparent;">' + microHTML + '</span><span style="color:rgba(255,40,40,0.8)">' + iHTML + '</span><span style="-webkit-text-fill-color:transparent;">' + wumaHTML + '</span>'
  iGlow.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(3px);filter:blur(8px);`

  // ── 主文字层 ──
  const mainText = document.createElement('div')
  mainText.innerHTML = '<span style="background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed,#6366f1,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + microHTML + '</span><span style="color:#ff3333;-webkit-text-fill-color:#ff3333;text-shadow:0 0 18px rgba(255,40,40,0.8),0 0 36px rgba(255,40,40,0.4),0 0 60px rgba(255,30,30,0.15);">' + iHTML + '</span><span style="background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed,#6366f1,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + wumaHTML + '</span>'
  mainText.style.cssText = `position:relative;${fontBase}transform:translateZ(14px);`

  // ── 顶部高光反射层 ──
  const highlight = document.createElement('div')
  highlight.innerHTML = microHTML + iHTML + wumaHTML
  highlight.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(20px);background:linear-gradient(170deg,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0.08) 30%,transparent 50%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;`

  brandInner.appendChild(shadow3)
  brandInner.appendChild(shadow2)
  brandInner.appendChild(shadow1)
  brandInner.appendChild(iGlow)
  brandInner.appendChild(glowLayer)
  brandInner.appendChild(mainText)
  brandInner.appendChild(highlight)
  brandEl.appendChild(brandInner)
  nameEl.appendChild(brandEl)

  // 启动动画
  startAnimation()
}

function startAnimation() {
  let hasMouse = false
  const onMouseMove = (e) => {
    hasMouse = true
    brandMouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2
    brandMouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true })

  const startTime = Date.now()
  const animate = () => {
    animId = requestAnimationFrame(animate)
    const elapsed = (Date.now() - startTime) * 0.001

    // 自动悬浮动画（始终运行，鼠标叠加）
    const autoX = Math.sin(elapsed * 0.6) * 0.35 + Math.sin(elapsed * 1.1) * 0.15
    const autoY = Math.cos(elapsed * 0.5) * 0.3 + Math.cos(elapsed * 0.9) * 0.12

    if (hasMouse) {
      // 鼠标跟踪 + 自动悬浮叠加
      brandMouse.x += (brandMouse.targetX - brandMouse.x) * 0.08
      brandMouse.y += (brandMouse.targetY - brandMouse.y) * 0.08
    } else {
      // 纯自动悬浮
      brandMouse.x = 0
      brandMouse.y = 0
    }

    const totalX = brandMouse.y + autoY
    const totalY = brandMouse.x + autoX
    const tiltX = -totalX * 35
    const tiltY = totalY * 35
    const glowPulse = Math.sin(elapsed * 1.5) * 0.15 + 0.85
    if (brandInner) brandInner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
    if (glowLayer) glowLayer.style.opacity = glowPulse
  }
  animate()

  // 保存清理引用
  window.__heroTitle3D_cleanup = () => {
    window.removeEventListener('mousemove', onMouseMove)
    if (animId) cancelAnimationFrame(animId)
  }
}

function cleanup() {
  if (window.__heroTitle3D_cleanup) {
    window.__heroTitle3D_cleanup()
    delete window.__heroTitle3D_cleanup
  }
  if (animId) cancelAnimationFrame(animId)
  animId = null

  // 恢复原始 name 元素
  const nameEl = document.querySelector('.VPHero .name')
  if (nameEl && nameEl.dataset.injected3d) {
    delete nameEl.dataset.injected3d
    if (brandEl && brandEl.parentNode) brandEl.parentNode.removeChild(brandEl)
    // 恢复隐藏的子元素
    nameEl.querySelectorAll(':scope > span[style*="display: none"], :scope > span[style*="display:none"]').forEach(el => {
      el.style.display = ''
    })
  }
  brandEl = null
  brandInner = null
  glowLayer = null
}

function tryInject() {
  // 重试机制：等 VitePress 渲染完 .VPHero .name
  let attempts = 0
  const maxAttempts = 20
  const tryIt = () => {
    const nameEl = document.querySelector('.VPHero .name')
    if (nameEl && !nameEl.dataset.injected3d) {
      inject3DTitle()
    } else if (attempts < maxAttempts) {
      attempts++
      setTimeout(tryIt, 200)
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
