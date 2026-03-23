<template>
  <div class="cad-viewer">
    <div class="viewer-toolbar">
      <el-button-group>
        <el-button :icon="ZoomIn" size="small" @click="zoomIn">放大</el-button>
        <el-button :icon="ZoomOut" size="small" @click="zoomOut">缩小</el-button>
        <el-button :icon="Refresh" size="small" @click="resetView">重置</el-button>
        <el-button v-if="fileType === 'dxf'" size="small" @click="toggleViewMode">
          {{ isTopView ? '3D旋转' : '俯视图' }}
        </el-button>
      </el-button-group>
      <el-button :icon="FullScreen" size="small" @click="toggleFullScreen">全屏</el-button>
      <span class="view-mode-tip">{{ viewModeTip }}</span>
    </div>
    <div ref="viewerContainer" class="viewer-container">
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading" :size="40"><Loading /></el-icon>
        <p>正在加载 CAD 文件...</p>
      </div>
      <div v-else-if="error" class="error-message">
        <el-icon :size="60" color="#f56c6c"><CircleClose /></el-icon>
        <h3>文件加载失败</h3>
        <p>{{ errorMessage }}</p>
        <p class="tip">DWG/STEP/STP 文件需要服务端转换后才能预览</p>
      </div>
      <canvas ref="canvas" v-show="!loading && !error"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { ZoomIn, ZoomOut, Refresh, FullScreen, Loading, CircleClose } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import DxfParser from 'dxf-parser'

const props = defineProps({
  filePath: { type: String, required: true },
  fileName: { type: String, default: '' }
})

const viewerContainer = ref(null)
const canvas = ref(null)
const loading = ref(true)
const error = ref(false)
const errorMessage = ref('')
const isTopView = ref(false)

// 根据文件路径推断类型（处理可能带查询参数的URL）
const getExtFromUrl = (url) => {
  if (!url) return ''
  const pathOnly = url.split('?')[0]
  return pathOnly.split('.').pop().toLowerCase()
}

const fileType = computed(() => {
  const ext = getExtFromUrl(props.filePath)
  if (ext === 'stl') return 'stl'
  if (ext === 'glb' || ext === 'gltf') return 'glb'
  return 'dxf'
})

const viewModeTip = computed(() => {
  if (fileType.value !== 'dxf') return '当前: 3D模型'
  return isTopView.value ? '当前: 固定俯视图模式（2D平面图最佳视角）' : '当前: 3D旋转模式'
})

let scene = null
let camera = null
let renderer = null
let controls = null
let animationId = null

// ====== 内存管理：统一资源清理 ======
const disposeObject = (obj) => {
  if (!obj) return
  if (obj.geometry) {
    obj.geometry.dispose()
  }
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      obj.material.forEach(m => {
        if (m.map) m.map.dispose()
        m.dispose()
      })
    } else {
      if (obj.material.map) obj.material.map.dispose()
      obj.material.dispose()
    }
  }
}

const disposeScene = () => {
  if (!scene) return
  scene.traverse(disposeObject)
  while (scene.children.length > 0) {
    scene.remove(scene.children[0])
  }
}

const cleanup = () => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
  disposeScene()
  if (controls) { controls.dispose(); controls = null }
  if (renderer) {
    renderer.dispose()
    renderer.forceContextLoss()
    renderer = null
  }
  scene = null
  camera = null
}

// ====== 场景初始化 ======
const initScene = () => {
  if (!canvas.value) return

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f5f5)

  const w = viewerContainer.value.clientWidth
  const h = viewerContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1e8)
  camera.position.set(0, 0, 100)

  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(window.devicePixelRatio)

  scene.add(new THREE.AmbientLight(0xffffff, 0.6))
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.4)
  dirLight.position.set(10, 10, 10)
  scene.add(dirLight)

  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc)
  scene.add(gridHelper)

  const axesHelper = new THREE.AxesHelper(50)
  scene.add(axesHelper)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  animate()
}

const animate = () => {
  animationId = requestAnimationFrame(animate)
  if (controls) controls.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
}

// ====== 文件加载 ======
const loadFile = async () => {
  loading.value = true
  error.value = false

  try {
    const fp = props.filePath
    const ext = getExtFromUrl(fp)

    if (ext === 'stl') {
      await loadSTL(fp)
    } else {
      // dxf 文本格式
      await loadDXF(fp)
    }
  } catch (err) {
    console.error('加载 CAD 文件失败:', err)
    error.value = true
    errorMessage.value = err.message || '文件格式不支持或文件损坏'
  } finally {
    loading.value = false
  }
}

// ====== DXF 加载 ======
const loadDXF = async (url) => {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('文件加载失败: HTTP ' + resp.status)
  const text = await resp.text()

  if (!text.includes('SECTION') && !text.includes('ENTITIES')) {
    throw new Error('文件不是 DXF 格式，DWG 格式需要转换为 DXF 才能预览')
  }

  const parser = new DxfParser()
  const dxf = parser.parseSync(text)
  if (!dxf || !dxf.entities || dxf.entities.length === 0) {
    throw new Error('DXF 文件解析失败或无图形内容')
  }

  const group = new THREE.Group()
  dxf.entities.forEach(entity => {
    const obj = createDxfEntity(entity)
    if (obj) group.add(obj)
  })

  if (group.children.length === 0) throw new Error('无法渲染任何图形实体')

  scene.add(group)
  adjustGridAndAxes(group)
  fitCameraToObject(group)
}

// ====== STL 加载 (STEP/STP 转换后) ======
const loadSTL = async (url) => {
  const loader = new STLLoader()
  const geometry = await new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })

  const material = new THREE.MeshStandardMaterial({
    color: 0x4488cc,
    metalness: 0.3,
    roughness: 0.6,
    side: THREE.DoubleSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  scene.add(mesh)
  fitCameraToObject(mesh)
}

// ====== DXF 实体创建 ======
const createDxfEntity = (entity) => {
  const material = new THREE.LineBasicMaterial({
    color: entity.color !== undefined ? entity.color : 0x000000,
    linewidth: 2
  })
  try {
    switch (entity.type) {
      case 'LINE': {
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
          entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z || 0,
          entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z || 0
        ]), 3))
        return new THREE.Line(geo, material)
      }
      case 'LWPOLYLINE':
      case 'POLYLINE': {
        const pts = entity.vertices.map(v => new THREE.Vector3(v.x, v.y, v.z || 0))
        return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), material)
      }
      case 'CIRCLE': {
        const geo = new THREE.CircleGeometry(entity.radius, 32)
        geo.translate(entity.center.x, entity.center.y, entity.center.z || 0)
        return new THREE.LineLoop(geo, material)
      }
      case 'ARC': {
        const curve = new THREE.EllipseCurve(
          entity.center.x, entity.center.y,
          entity.radius, entity.radius,
          entity.startAngle, entity.endAngle, false, 0
        )
        return new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(50)), material)
      }
      default:
        return null
    }
  } catch { return null }
}

// ====== 视图工具 ======
const adjustGridAndAxes = (group) => {
  const box = new THREE.Box3().setFromObject(group)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  const oldGrid = scene.children.find(c => c.type === 'GridHelper')
  const oldAxes = scene.children.find(c => c.type === 'AxesHelper')
  if (oldGrid) { scene.remove(oldGrid); disposeObject(oldGrid) }
  if (oldAxes) { scene.remove(oldAxes); disposeObject(oldAxes) }

  const maxDim = Math.max(size.x, size.y, size.z)
  const grid = new THREE.GridHelper(maxDim * 1.5, 20, 0x888888, 0xcccccc)
  grid.rotation.x = Math.PI / 2
  grid.position.set(center.x, center.y, 0)
  scene.add(grid)

  const axes = new THREE.AxesHelper(maxDim * 0.3)
  axes.position.set(center.x, center.y, 0)
  scene.add(axes)
}

const fitCameraToObject = (object) => {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  if (maxDim === 0) return

  const fov = camera.fov * (Math.PI / 180)
  const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5

  camera.position.set(center.x, center.y, center.z + dist)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()
}

const zoomIn = () => { camera.position.multiplyScalar(0.8); controls.update() }
const zoomOut = () => { camera.position.multiplyScalar(1.2); controls.update() }

const resetView = () => {
  camera.position.set(0, 0, 100)
  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

const toggleViewMode = () => {
  isTopView.value = !isTopView.value
  if (isTopView.value) {
    controls.enableRotate = false
    const target = controls.target.clone()
    const distance = camera.position.distanceTo(target)
    camera.position.set(target.x, target.y, distance)
    camera.lookAt(target)
    controls.update()
  } else {
    controls.enableRotate = true
  }
}

const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    viewerContainer.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

const handleResize = () => {
  if (!viewerContainer.value || !camera || !renderer) return
  const w = viewerContainer.value.clientWidth
  const h = viewerContainer.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

// 文件切换时：先清理旧内容，再重新加载
watch(() => props.filePath, () => {
  disposeScene()
  initScene()
  loadFile()
}, { immediate: false })

onMounted(() => {
  initScene()
  loadFile()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  cleanup()
})
</script>

<style scoped lang="scss">
.cad-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;

  .viewer-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    gap: 12px;
    .view-mode-tip {
      font-size: 12px;
      color: #64748b;
      padding: 4px 12px;
      background: #fff;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
  }

  .viewer-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #f5f5f5;
    canvas { width: 100%; height: 100%; display: block; }
    .loading-overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.95); z-index: 10;
      p { margin-top: 16px; color: #64748b; font-size: 14px; }
    }
    .error-message {
      position: absolute; inset: 0;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 40px; text-align: center;
      h3 { margin: 16px 0 8px; color: #1e293b; font-size: 18px; }
      p { color: #64748b; font-size: 14px; margin: 4px 0; max-width: 500px; }
      .tip {
        margin-top: 16px; padding: 12px 16px;
        background: #fef3c7; border-radius: 6px; color: #92400e; font-size: 13px;
      }
    }
  }
}
.is-loading { animation: rotating 2s linear infinite; }
@keyframes rotating { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
