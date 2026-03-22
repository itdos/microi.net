<template>
  <ClientOnly>
    <div v-if="isHomePage" ref="containerRef" class="hero-3d-background">
      <canvas ref="canvasRef"></canvas>
    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, shallowRef } from 'vue'
import { useRoute } from 'vitepress'

const isHomePage = ref(false)
const containerRef = ref(null)
const canvasRef = ref(null)
const route = useRoute()

// 使用 shallowRef 避免 Vue 深度代理 three.js 对象
const sceneCtx = shallowRef(null)

const checkHomePage = () => {
  if (typeof window === 'undefined') return false
  const path = route.path || window.location.pathname
  return path === '/' || path === '/index.html' || path === '/index'
}

// 检测移动端
const isMobile = () => {
  if (typeof window === 'undefined') return false
  return window.innerWidth < 768
}

async function initScene() {
  if (!canvasRef.value || typeof window === 'undefined') return

  const THREE = await import('three')

  const canvas = canvasRef.value
  const width = window.innerWidth
  const height = window.innerHeight

  // --- 渲染器 ---
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isMobile(),
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setClearColor(0x000000, 0)

  // --- 场景 ---
  const scene = new THREE.Scene()
  // 可选：添加雾气效果增加景深感
  scene.fog = new THREE.FogExp2(0x0a0a14, 0.0008)

  // --- 相机 ---
  const camera = new THREE.PerspectiveCamera(60, width / height, 1, 2000)
  camera.position.set(0, 0, 500)

  // --- 粒子数量根据设备调整 ---
  const particleCount = isMobile() ? 1500 : 4000

  // ========================
  // 1. 主星场粒子系统
  // ========================
  const starsGeo = new THREE.BufferGeometry()
  const starsPositions = new Float32Array(particleCount * 3)
  const starsSizes = new Float32Array(particleCount)
  const starsColors = new Float32Array(particleCount * 3)

  // 配色方案：紫色 + 蓝色 + 粉色（与现有 home-glow 配色一致）
  const colorPalette = [
    new THREE.Color(0x8a2be2), // 紫色
    new THREE.Color(0x00bfff), // 蓝色
    new THREE.Color(0xff0080), // 粉色
    new THREE.Color(0x6a5acd), // 板岩蓝
    new THREE.Color(0x00ced1), // 深青色
  ]

  for (let i = 0; i < particleCount; i++) {
    // 球形分布
    const radius = 300 + Math.random() * 800
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    
    starsPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta)
    starsPositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
    starsPositions[i * 3 + 2] = radius * Math.cos(phi) - 200

    starsSizes[i] = Math.random() * 3 + 0.5

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
    starsColors[i * 3] = color.r
    starsColors[i * 3 + 1] = color.g
    starsColors[i * 3 + 2] = color.b
  }

  starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPositions, 3))
  starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1))
  starsGeo.setAttribute('color', new THREE.BufferAttribute(starsColors, 3))

  // 自定义着色器材质 - 发光粒子
  const starsMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;
      uniform float uPixelRatio;
      
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // 基于时间的呼吸闪烁
        float twinkle = sin(uTime * 1.5 + position.x * 0.05 + position.y * 0.03) * 0.3 + 0.7;
        vOpacity = twinkle;
        
        gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z) * twinkle;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      
      void main() {
        // 圆形软边粒子
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        
        // 发光衰减
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        glow = pow(glow, 1.5);
        
        gl_FragColor = vec4(vColor, glow * vOpacity * 0.85);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  const stars = new THREE.Points(starsGeo, starsMaterial)
  scene.add(stars)

  // ========================
  // 2. 星云/光雾效果 (大型半透明粒子)
  // ========================
  const nebulaCount = isMobile() ? 30 : 80
  const nebulaGeo = new THREE.BufferGeometry()
  const nebulaPositions = new Float32Array(nebulaCount * 3)
  const nebulaSizes = new Float32Array(nebulaCount)
  const nebulaColors = new Float32Array(nebulaCount * 3)

  for (let i = 0; i < nebulaCount; i++) {
    nebulaPositions[i * 3] = (Math.random() - 0.5) * 1200
    nebulaPositions[i * 3 + 1] = (Math.random() - 0.5) * 800
    nebulaPositions[i * 3 + 2] = (Math.random() - 0.5) * 600 - 100

    nebulaSizes[i] = Math.random() * 80 + 40

    const color = colorPalette[Math.floor(Math.random() * colorPalette.length)]
    nebulaColors[i * 3] = color.r
    nebulaColors[i * 3 + 1] = color.g
    nebulaColors[i * 3 + 2] = color.b
  }

  nebulaGeo.setAttribute('position', new THREE.BufferAttribute(nebulaPositions, 3))
  nebulaGeo.setAttribute('size', new THREE.BufferAttribute(nebulaSizes, 1))
  nebulaGeo.setAttribute('color', new THREE.BufferAttribute(nebulaColors, 3))

  const nebulaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: `
      attribute float size;
      attribute vec3 color;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uTime;
      uniform float uPixelRatio;
      
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        float pulse = sin(uTime * 0.4 + position.x * 0.01) * 0.15 + 0.85;
        vOpacity = pulse;
        
        gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vOpacity;
      
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;
        
        // 柔和径向渐变
        float glow = 1.0 - smoothstep(0.0, 0.5, dist);
        glow = pow(glow, 3.0);
        
        gl_FragColor = vec4(vColor, glow * vOpacity * 0.12);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })

  const nebula = new THREE.Points(nebulaGeo, nebulaMaterial)
  scene.add(nebula)

  // ========================
  // 3. 连线网络 (科技感网格)
  // ========================
  const lineCount = isMobile() ? 100 : 300
  const lineGeo = new THREE.BufferGeometry()
  const linePositions = new Float32Array(lineCount * 3)
  const lineVelocities = []

  for (let i = 0; i < lineCount; i++) {
    linePositions[i * 3] = (Math.random() - 0.5) * 800
    linePositions[i * 3 + 1] = (Math.random() - 0.5) * 600
    linePositions[i * 3 + 2] = (Math.random() - 0.5) * 400

    lineVelocities.push({
      x: (Math.random() - 0.5) * 0.3,
      y: (Math.random() - 0.5) * 0.3,
      z: (Math.random() - 0.5) * 0.15
    })
  }

  lineGeo.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))

  const nodesMaterial = new THREE.PointsMaterial({
    color: 0x8a2be2,
    size: 2,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  })
  const nodes = new THREE.Points(lineGeo, nodesMaterial)
  scene.add(nodes)

  // 连线 - 动态生成
  let linesObj = null
  const maxConnections = isMobile() ? 150 : 400
  const connectionDistance = isMobile() ? 120 : 100

  // ========================
  // 4. 左下角 "Microi" 3D 品牌水印 (DOM + CSS 3D Transform)
  // ========================
  const brandEl = document.createElement('div')
  brandEl.style.cssText = 'position:fixed;bottom:18px;right:18px;z-index:2;pointer-events:none;perspective:600px;'

  const brandInner = document.createElement('div')
  brandInner.style.cssText = 'transform-style:preserve-3d;will-change:transform;position:relative;transform-origin:center center;'

  const fontBase = "font:700 28px/1 'SF Pro Display','Inter','Segoe UI',system-ui,sans-serif;letter-spacing:1.5px;white-space:nowrap;"
  const microHTML = 'Micro'
  const iHTML = 'i'

  // ── 深层阴影 (最远, 背面投影) ──
  const shadow3 = document.createElement('div')
  shadow3.innerHTML = microHTML + '<span style="color:rgba(120,15,15,0.12)">' + iHTML + '</span>'
  shadow3.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(50,15,100,0.12);transform:translateZ(-28px) translateX(6px) translateY(6px);filter:blur(6px);`

  // ── 挤出层 (模拟3D厚度侧面) ──
  const extrudeColors = [
    'rgba(55,20,110,0.35)',
    'rgba(65,25,130,0.33)',
    'rgba(75,30,150,0.30)',
    'rgba(85,35,165,0.27)',
    'rgba(100,42,185,0.24)',
    'rgba(115,50,200,0.20)',
    'rgba(125,58,210,0.16)',
    'rgba(138,65,226,0.12)',
  ]
  const extrudeIColors = [
    'rgba(160,15,15,0.35)',
    'rgba(175,18,18,0.33)',
    'rgba(190,20,20,0.30)',
    'rgba(200,22,22,0.27)',
    'rgba(215,25,25,0.24)',
    'rgba(225,28,28,0.20)',
    'rgba(235,32,32,0.16)',
    'rgba(245,35,35,0.12)',
  ]
  const extrudeCount = 8
  for (let ei = 0; ei < extrudeCount; ei++) {
    const t = ei / (extrudeCount - 1)
    const z = -22 + t * 22  // -22 到 0
    const ox = (1 - t) * 3.5
    const oy = (1 - t) * 3.5
    const layer = document.createElement('div')
    layer.innerHTML = '<span style="color:' + extrudeColors[ei] + '">' + microHTML + '</span><span style="color:' + extrudeIColors[ei] + '">' + iHTML + '</span>'
    layer.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(${z}px) translateX(${ox}px) translateY(${oy}px);`
    brandInner.appendChild(layer)
  }

  // ── 辉光层 (扩散柔光) ──
  const glowLayer = document.createElement('div')
  glowLayer.innerHTML = microHTML + '<span style="color:rgba(255,50,50,0.5)">' + iHTML + '</span>'
  glowLayer.style.cssText = `position:absolute;top:0;left:0;${fontBase}color:rgba(138,80,226,0.45);transform:translateZ(2px);filter:blur(10px);`

  // ── 主文字层 (最前面) ──
  const mainText = document.createElement('div')
  mainText.innerHTML = '<span style="background:linear-gradient(135deg,#c084fc,#a855f7,#7c3aed,#6366f1,#38bdf8);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">' + microHTML + '</span><span style="color:#ff2828;text-shadow:0 0 12px rgba(255,40,40,0.6),0 0 24px rgba(255,40,40,0.2);">' + iHTML + '</span>'
  mainText.style.cssText = `position:relative;${fontBase}transform:translateZ(14px);`

  // ── 顶部高光反射层 ──
  const highlight = document.createElement('div')
  highlight.innerHTML = microHTML + iHTML
  highlight.style.cssText = `position:absolute;top:0;left:0;${fontBase}transform:translateZ(20px);background:linear-gradient(170deg,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0.08) 30%,transparent 50%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;`

  // ── 底部装饰线 ──
  const brandLine = document.createElement('div')
  brandLine.style.cssText = 'position:absolute;bottom:-9px;left:0;width:115px;height:1px;background:linear-gradient(90deg,rgba(138,43,226,0.6),rgba(99,102,241,0.35),rgba(56,189,248,0.2),transparent);transform:translateZ(6px);'

  brandInner.appendChild(shadow3)
  brandInner.appendChild(glowLayer)
  brandInner.appendChild(mainText)
  brandInner.appendChild(highlight)
  brandInner.appendChild(brandLine)
  brandEl.appendChild(brandInner)
  containerRef.value.appendChild(brandEl)

  // 品牌3D倾斜的平滑鼠标状态
  const brandMouse = { x: 0, y: 0, targetX: 0, targetY: 0 }

  // ========================
  // 交互：鼠标跟踪
  // ========================
  const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }

  const onMouseMove = (e) => {
    mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2
    mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2
    // 品牌水印：以文字中心为基准
    brandMouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2
    brandMouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2
  }
  window.addEventListener('mousemove', onMouseMove, { passive: true })

  // 滚动视差
  let scrollY = 0
  const onScroll = () => {
    scrollY = window.scrollY
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  // ========================
  // 动画循环
  // ========================
  let animId = null
  const clock = new THREE.Clock()

  const animate = () => {
    animId = requestAnimationFrame(animate)
    const elapsed = clock.getElapsedTime()

    // 更新 uniforms
    starsMaterial.uniforms.uTime.value = elapsed
    nebulaMaterial.uniforms.uTime.value = elapsed

    // 鼠标平滑跟踪
    mouse.x += (mouse.targetX - mouse.x) * 0.05
    mouse.y += (mouse.targetY - mouse.y) * 0.05

    // 相机跟随鼠标微动 + 滚动视差
    camera.position.x = mouse.x * 30
    camera.position.y = -mouse.y * 20 + scrollY * 0.1
    camera.lookAt(0, scrollY * 0.05, 0)

    // 星场缓慢旋转
    stars.rotation.y = elapsed * 0.02
    stars.rotation.x = elapsed * 0.01

    // 星云浮动
    nebula.rotation.y = -elapsed * 0.01
    nebula.rotation.z = elapsed * 0.005

    // 左下角3D品牌水印 - 以文字中心为旋转轴，跟随鼠标倾斜
    brandMouse.x += (brandMouse.targetX - brandMouse.x) * 0.08
    brandMouse.y += (brandMouse.targetY - brandMouse.y) * 0.08
    const tiltX = -brandMouse.y * 25
    const tiltY = brandMouse.x * 25
    const glowPulse = Math.sin(elapsed * 1.5) * 0.15 + 0.85
    brandInner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`
    glowLayer.style.opacity = glowPulse

    // 节点移动
    const positions = lineGeo.attributes.position.array
    for (let i = 0; i < lineCount; i++) {
      positions[i * 3] += lineVelocities[i].x
      positions[i * 3 + 1] += lineVelocities[i].y
      positions[i * 3 + 2] += lineVelocities[i].z

      // 边界反弹
      if (Math.abs(positions[i * 3]) > 400) lineVelocities[i].x *= -1
      if (Math.abs(positions[i * 3 + 1]) > 300) lineVelocities[i].y *= -1
      if (Math.abs(positions[i * 3 + 2]) > 200) lineVelocities[i].z *= -1
    }
    lineGeo.attributes.position.needsUpdate = true

    // 动态连线
    if (linesObj) scene.remove(linesObj)
    const lineSegments = []
    let connCount = 0
    for (let i = 0; i < lineCount && connCount < maxConnections; i++) {
      for (let j = i + 1; j < lineCount && connCount < maxConnections; j++) {
        const dx = positions[i * 3] - positions[j * 3]
        const dy = positions[i * 3 + 1] - positions[j * 3 + 1]
        const dz = positions[i * 3 + 2] - positions[j * 3 + 2]
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)

        if (dist < connectionDistance) {
          lineSegments.push(
            positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
            positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
          )
          connCount++
        }
      }
    }

    if (lineSegments.length > 0) {
      const lGeo = new THREE.BufferGeometry()
      lGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineSegments, 3))
      const lMat = new THREE.LineBasicMaterial({
        color: 0x8a2be2,
        transparent: true,
        opacity: 0.15,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
      linesObj = new THREE.LineSegments(lGeo, lMat)
      scene.add(linesObj)
    }

    renderer.render(scene, camera)
  }

  animate()

  // ========================
  // 窗口大小调整
  // ========================
  const onResize = () => {
    const w = window.innerWidth
    const h = window.innerHeight
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  // 保存上下文以便销毁
  sceneCtx.value = {
    renderer,
    animId,
    onMouseMove,
    onScroll,
    onResize,
    scene,
    brandEl
  }
}

function destroyScene() {
  const ctx = sceneCtx.value
  if (!ctx) return

  if (ctx.animId) cancelAnimationFrame(ctx.animId)
  window.removeEventListener('mousemove', ctx.onMouseMove)
  window.removeEventListener('scroll', ctx.onScroll)
  window.removeEventListener('resize', ctx.onResize)

  // 销毁所有 GPU 资源
  ctx.scene.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose()
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose())
      } else {
        obj.material.dispose()
      }
    }
  })
  ctx.renderer.dispose()
  if (ctx.brandEl && ctx.brandEl.parentNode) ctx.brandEl.parentNode.removeChild(ctx.brandEl)
  sceneCtx.value = null
}

watch(() => route.path, () => {
  const isHome = checkHomePage()
  isHomePage.value = isHome
  if (isHome) {
    // nextTick 后初始化
    setTimeout(initScene, 100)
  } else {
    destroyScene()
  }
}, { immediate: false })

onMounted(() => {
  isHomePage.value = checkHomePage()
  if (isHomePage.value) {
    setTimeout(initScene, 100)
  }
})

onUnmounted(() => {
  destroyScene()
})
</script>

<style scoped>
.hero-3d-background {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  z-index: 0;
  pointer-events: none;
  contain: layout style size;
}

.hero-3d-background canvas {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
