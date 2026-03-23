<template>
  <div class="dwg-viewer">
    <div class="viewer-toolbar">
      <el-button-group>
        <el-button :icon="ZoomIn" size="small" @click="zoomIn">放大</el-button>
        <el-button :icon="ZoomOut" size="small" @click="zoomOut">缩小</el-button>
        <el-button :icon="Refresh" size="small" @click="resetView">重置</el-button>
        <el-button size="small" @click="toggleViewMode">
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
        <p class="tip">DWG 文件需要转换为 DXF 格式才能在线预览，或者使用专业的 CAD 软件打开</p>
      </div>
      <canvas ref="canvas" v-show="!loading && !error"></canvas>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { ZoomIn, ZoomOut, Refresh, FullScreen, Loading, CircleClose } from '@element-plus/icons-vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import DxfParser from 'dxf-parser'

const props = defineProps({
  filePath: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    default: ''
  }
})

const viewerContainer = ref(null)
const canvas = ref(null)
const loading = ref(true)
const error = ref(false)
const errorMessage = ref('')
const isTopView = ref(false)
const viewModeTip = ref('当前: 3D旋转模式')

let scene, camera, renderer, controls
let animationId = null

// 初始化 Three.js 场景
const initScene = () => {
  if (!canvas.value) return

  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf5f5f5)

  // 创建相机
  const width = viewerContainer.value.clientWidth
  const height = viewerContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100000000)
  camera.position.set(0, 0, 100)

  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ canvas: canvas.value, antialias: true })
  renderer.setSize(width, height)
  renderer.setPixelRatio(window.devicePixelRatio)

  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
  directionalLight.position.set(10, 10, 10)
  scene.add(directionalLight)

  // 添加网格辅助线
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc)
  scene.add(gridHelper)

  // 添加坐标轴
  const axesHelper = new THREE.AxesHelper(50)
  scene.add(axesHelper)

  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  
  // 优化2D平面图查看体验
  // 如果想固定俯视图，取消下面两行注释：
  // controls.enableRotate = false  // 禁用旋转
  // controls.maxPolarAngle = 0     // 锁定俯视角度

  // 开始渲染循环
  animate()
}

// 动画循环
const animate = () => {
  animationId = requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

// 加载 DWG/DXF 文件
const loadCADFile = async () => {
  loading.value = true
  error.value = false

  try {
    console.log('开始加载文件:', props.filePath)
    const response = await fetch(props.filePath)
    if (!response.ok) {
      throw new Error('文件加载失败: HTTP ' + response.status)
    }

    const text = await response.text()
    console.log('文件内容长度:', text.length)
    console.log('文件内容前500字符:', text.substring(0, 500))
    
    // 检查是否是 DXF 格式（文本格式）
    if (text.includes('SECTION') || text.includes('ENTITIES')) {
      console.log('检测到 DXF 格式，开始解析...')
      parseDXF(text)
    } else {
      // DWG 是二进制格式，无法直接在浏览器中解析
      console.log('文件不是 DXF 格式')
      throw new Error('DWG 格式需要转换为 DXF 才能预览')
    }
  } catch (err) {
    console.error('加载 CAD 文件失败:', err)
    error.value = true
    errorMessage.value = err.message || '文件格式不支持或文件损坏'
  } finally {
    loading.value = false
  }
}

// 解析 DXF 文件
const parseDXF = (dxfString) => {
  try {
    const parser = new DxfParser()
    const dxf = parser.parseSync(dxfString)

    console.log('DXF 解析结果:', dxf)
    
    if (!dxf) {
      throw new Error('DXF 文件解析失败')
    }

    if (!dxf.entities || dxf.entities.length === 0) {
      console.warn('DXF 文件中没有实体数据')
      errorMessage.value = '文件中没有可显示的图形内容'
      error.value = true
      return
    }

    console.log('找到实体数量:', dxf.entities.length)

    // 创建图形组
    const group = new THREE.Group()

    // 解析实体
    let successCount = 0
    dxf.entities.forEach((entity, index) => {
      console.log(`解析实体 ${index}:`, entity.type, entity)
      const object = createEntityObject(entity)
      if (object) {
        group.add(object)
        successCount++
      }
    })

    if (successCount === 0) {
      throw new Error('无法渲染任何图形实体')
    }

    // 添加到场景
    scene.add(group)

    // 计算包围盒并调整网格和坐标轴
    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    
    // 移除旧的网格和坐标轴
    const oldGrid = scene.children.find(child => child.type === 'GridHelper')
    const oldAxes = scene.children.find(child => child.type === 'AxesHelper')
    if (oldGrid) scene.remove(oldGrid)
    if (oldAxes) scene.remove(oldAxes)
    
    // 添加新的网格辅助线（在图形中心）
    const maxDim = Math.max(size.x, size.y, size.z)
    const gridSize = maxDim * 1.5
    const divisions = 20
    const newGrid = new THREE.GridHelper(gridSize, divisions, 0x888888, 0xcccccc)
    // GridHelper默认在XZ平面，旋转到XY平面以匹配2D CAD图
    newGrid.rotation.x = Math.PI / 2
    newGrid.position.set(center.x, center.y, 0)
    scene.add(newGrid)
    
    // 添加新的坐标轴（在图形中心）
    const axesSize = maxDim * 0.3
    const newAxes = new THREE.AxesHelper(axesSize)
    newAxes.position.set(center.x, center.y, 0)
    scene.add(newAxes)

    // 自适应视图
    fitCameraToObject(group)

    loading.value = false
  } catch (err) {
    console.error('DXF 解析错误:', err)
    error.value = true
    errorMessage.value = '文件解析失败: ' + err.message
  }
}

// 创建实体对象
const createEntityObject = (entity) => {
  const material = new THREE.LineBasicMaterial({ 
    color: entity.color !== undefined ? entity.color : 0x000000,
    linewidth: 2 // 虽然大多数平台不支持，但还是设置
  })

  try {
    switch (entity.type) {
      case 'LINE':
        return createLine(entity, material)
      case 'LWPOLYLINE':
      case 'POLYLINE':
        return createPolyline(entity, material)
      case 'CIRCLE':
        return createCircle(entity, material)
      case 'ARC':
        return createArc(entity, material)
      default:
        console.log(`未支持的实体类型: ${entity.type}`)
        return null
    }
  } catch (err) {
    console.error(`创建实体失败 (${entity.type}):`, err, entity)
    return null
  }
}

// 创建线段
const createLine = (entity, material) => {
  const geometry = new THREE.BufferGeometry()
  const vertices = new Float32Array([
    entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z || 0,
    entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z || 0
  ])
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
  return new THREE.Line(geometry, material)
}

// 创建多段线
const createPolyline = (entity, material) => {
  const points = entity.vertices.map(v => new THREE.Vector3(v.x, v.y, v.z || 0))
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.Line(geometry, material)
}

// 创建圆
const createCircle = (entity, material) => {
  const geometry = new THREE.CircleGeometry(entity.radius, 32)
  geometry.translate(entity.center.x, entity.center.y, entity.center.z || 0)
  return new THREE.LineLoop(geometry, material)
}

// 创建圆弧
const createArc = (entity, material) => {
  const curve = new THREE.EllipseCurve(
    entity.center.x, entity.center.y,
    entity.radius, entity.radius,
    entity.startAngle, entity.endAngle,
    false, 0
  )
  const points = curve.getPoints(50)
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.Line(geometry, material)
}

// 自适应相机视图
const fitCameraToObject = (object) => {
  const box = new THREE.Box3().setFromObject(object)
  const center = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3())

  console.log('包围盒中心:', center)
  console.log('包围盒尺寸:', size)
  console.log('最小点:', box.min)
  console.log('最大点:', box.max)

  const maxDim = Math.max(size.x, size.y, size.z)
  console.log('最大尺寸:', maxDim)

  if (maxDim === 0) {
    console.warn('对象尺寸为0，使用默认视图')
    return
  }

  const fov = camera.fov * (Math.PI / 180)
  let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))

  cameraZ *= 1.5 // 添加一些边距

  console.log('计算的相机Z位置:', cameraZ)

  camera.position.set(center.x, center.y, center.z + cameraZ)
  camera.lookAt(center)
  controls.target.copy(center)
  controls.update()

  console.log('相机位置已设置为:', camera.position)
  console.log('相机朝向:', center)
}

// 放大
const zoomIn = () => {
  camera.position.multiplyScalar(0.8)
  controls.update()
}

// 缩小
const zoomOut = () => {
  camera.position.multiplyScalar(1.2)
  controls.update()
}

// 重置视图
const resetView = () => {
  camera.position.set(0, 0, 100)
  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

// 切换视图模式（2D俯视 vs 3D旋转）
const toggleViewMode = () => {
  isTopView.value = !isTopView.value
  
  if (isTopView.value) {
    // 切换到俯视图模式（适合2D平面图）
    controls.enableRotate = false
    
    // 将相机移到正上方俯视
    const target = controls.target.clone()
    const distance = camera.position.distanceTo(target)
    camera.position.set(target.x, target.y, distance)
    camera.lookAt(target)
    controls.update()
    
    viewModeTip.value = '当前: 固定俯视图模式（2D平面图最佳视角）'
  } else {
    // 切换到3D旋转模式
    controls.enableRotate = true
    viewModeTip.value = '当前: 3D旋转模式'
  }
}

// 全屏切换
const toggleFullScreen = () => {
  if (!document.fullscreenElement) {
    viewerContainer.value.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
}

// 窗口大小调整
const handleResize = () => {
  if (!viewerContainer.value || !camera || !renderer) return

  const width = viewerContainer.value.clientWidth
  const height = viewerContainer.value.clientHeight

  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

// 监听文件路径变化
watch(() => props.filePath, () => {
  if (scene) {
    // 清除旧的对象
    while (scene.children.length > 0) {
      scene.remove(scene.children[0])
    }
    initScene()
  }
  loadCADFile()
}, { immediate: false })

onMounted(() => {
  initScene()
  loadCADFile()
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  if (renderer) {
    renderer.dispose()
  }
  if (controls) {
    controls.dispose()
  }
})
</script>

<style scoped lang="scss">
.dwg-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
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

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.95);
      z-index: 10;

      p {
        margin-top: 16px;
        color: #64748b;
        font-size: 14px;
      }
    }

    .error-message {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px;
      text-align: center;

      h3 {
        margin: 16px 0 8px;
        color: #1e293b;
        font-size: 18px;
      }

      p {
        color: #64748b;
        font-size: 14px;
        margin: 4px 0;
        max-width: 500px;
      }

      .tip {
        margin-top: 16px;
        padding: 12px 16px;
        background: #fef3c7;
        border-radius: 6px;
        color: #92400e;
        font-size: 13px;
      }
    }
  }
}

.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
