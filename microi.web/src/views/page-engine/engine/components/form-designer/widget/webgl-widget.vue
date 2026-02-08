<template>
  <div class="canvas-container" ref="canvasContainer">
    <div ref="container"></div>
  </div>
</template>

<script setup name="webgl-widget">
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js' // GUI 控制器
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader' // 用于加载 glTF 模型
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js' // 轨道控制器
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js' // 用于加载 HDR 环境贴图
import { useWidget } from '../../../hooks/useWidget'

const props = defineProps({
  widgetObj: {
    type: Object,
    required: true,
  },
})

//日期区间
const dateRange = ref()
//是否加载中
const loading = ref(false)

// //设置临时数据
// const dynamicData = ref()
// dynamicData.value = props.widgetObj.widgetParams[0].typeOptions.dataJson
const { loadRemoteData } = useWidget(
  props.widgetObj,
  props.widgetObj.widgetParams[0].typeOptions.dataJson,
  dateRange,
  loading
)
await loadRemoteData()

// 声明全局变量
let scene, camera, renderer // 场景、相机和渲染器
let gui // GUI 控制器
let controls // 轨道控制器

// const raycaster = new THREE.Raycaster()
// const mouse = new THREE.Vector2()
let model = null

// 渲染容器
const container = ref()
const canvasContainer = ref()
// 定义初始状态
const state = {
  variant: props.widgetObj.widgetParams[0].typeOptions.dataJson.variant,
} // 初始变体设置为 'midnight'

// 默认选择背景贴图
const selHdr = ref(props.widgetObj.widgetParams[0].typeOptions.dataJson.hdrPath)

const selGltf = ref(
  props.widgetObj.widgetParams[0].typeOptions.dataJson.gltfPath
)

// 画布宽度
const width = ref(0)
// 画布高度
const height = ref(props.widgetObj.widgetOption.height)
// 缩放
const scale = ref(props.widgetObj.widgetParams[1].value)

// 初始化相机参数
const cameraParams = reactive({
  fov: props.widgetObj.widgetParams[2].value, // 相机视野角度
  aspect: width.value / height.value, // 相机宽高比
  near: props.widgetObj.widgetParams[3].value, // 近裁剪面
  far: props.widgetObj.widgetParams[4].value, // 远裁剪面
  position: {
    x: props.widgetObj.widgetParams[5].value, // 相机位置 x
    y: props.widgetObj.widgetParams[6].value, // 相机位置 y
    z: props.widgetObj.widgetParams[7].value, // 相机位置 z
  },
})

const initOrbitControls = () => {
  if (!controls) {
    controls = new OrbitControls(camera, renderer.domElement)
    controls.addEventListener('change', render) // 当控制器改变时重新渲染
    controls.minDistance = 2 // 设置最小距离
    controls.maxDistance = 10 // 设置最大距离
    controls.target.set(0, 0.5, -0.2) // 设置目标点
  }
}

// 渲染循环
const animate = () => {
  requestAnimationFrame(animate)
  cameraParams.fov = camera.fov
  cameraParams.aspect = camera.aspect
  cameraParams.near = camera.near
  cameraParams.far = camera.far
  cameraParams.position.x = camera.position.x
  cameraParams.position.y = camera.position.y
  cameraParams.position.z = camera.position.z

  controls.update() // 更新 OrbitControls
  renderer.render(scene, camera)
}

// 创建透视相机并设置其属性
function createCamera() {
  camera = new THREE.PerspectiveCamera(
    cameraParams.fov, // 视野角度
    cameraParams.aspect, // 宽高比
    cameraParams.near, // 近裁剪面
    cameraParams.far // 远裁剪面
  )
  camera.position.set(
    cameraParams.position.x,
    cameraParams.position.y,
    cameraParams.position.z
  ) // 设置相机位置
}

// 创建 WebGL 渲染器
function createWebGLRenderer(container) {
  renderer = new THREE.WebGLRenderer({ antialias: true }) // 开启抗锯齿
  renderer.setPixelRatio(window.devicePixelRatio) // 设置像素比例
  renderer.setSize(width.value, height.value) // 设置渲染器大小
  renderer.toneMapping = THREE.ACESFilmicToneMapping // 设置色调映射
  renderer.toneMappingExposure = 1 // 设置曝光值
  container.appendChild(renderer.domElement) // 将渲染器添加到容器中
}

/**
 * 初始化 Three.js 场景
 */
function init() {
  createCamera() // 创建透视相机并设置其属性

  scene = new THREE.Scene() // 创建场景

  // 加载环境贴图 (HDR 图像)，第二个参数表示是否加载gltf模型
  renderHdr(true)

  // 创建 WebGL 渲染器
  createWebGLRenderer(container.value)

  // 创建轨道控制器
  initOrbitControls()

  // 开始渲染循环
  animate()
}

/**
 * 根据选择的变体更新场景中的材质
 * @param {THREE.Scene} scene - 场景对象
 * @param {Object} parser - GLTF 解析器
 * @param {Object} extension - KHR_materials_variants 扩展信息
 * @param {string} variantName - 变体名称
 */
function selectVariant(scene, parser, extension, variantName) {
  const variantIndex = extension.variants.findIndex((v) =>
    v.name.includes(variantName)
  ) // 查找变体索引
  scene.traverse(async (object) => {
    if (!object.isMesh || !object.userData.gltfExtensions) return // 如果不是网格或没有扩展信息，跳过
    const meshVariantDef =
      object.userData.gltfExtensions['KHR_materials_variants']
    if (!meshVariantDef) return // 如果没有变体定义，跳过
    if (!object.userData.originalMaterial) {
      object.userData.originalMaterial = object.material // 保存原始材质
    }
    const mapping = meshVariantDef.mappings.find((mapping) =>
      mapping.variants.includes(variantIndex)
    )
    if (mapping) {
      object.material = await parser.getDependency('material', mapping.material) // 更新材质
      parser.assignFinalMaterial(object) // 分配最终材质
    } else {
      object.material = object.userData.originalMaterial // 恢复原始材质
    }
    render() // 重新渲染场景
  })
}

// 渲染背景贴图, IsRenderGltf 判断是否需要渲染模型
function renderHdr(IsRenderGltf) {
  new RGBELoader().load(selHdr.value, function (texture) {
    texture.mapping = THREE.EquirectangularReflectionMapping
    scene.background = texture
    scene.environment = texture
    render() // 重新渲染场景

    if (IsRenderGltf) {
      renderGltf()
    }
  })
}

// 渲染模型
function renderGltf() {
  // 清除之前的模型
  scene.remove(...scene.children.filter((child) => child.type === 'Group'))

  // 加载 glTF 模型
  const loader = new GLTFLoader() // 设置模型路径
  loader.load(selGltf.value, function (gltf) {
    gltf.scene.scale.set(scale.value, scale.value, scale.value) // 缩放模型
    model = gltf.scene
    scene.add(model) // 将模型添加到场景中
    gui = new GUI({ autoPlace: false }) // 创建 GUI 控制器
    canvasContainer.value.appendChild(gui.domElement)

    // 调整 GUI 样式
    gui.domElement.style.position = 'absolute'
    gui.domElement.style.right = '10px'
    gui.domElement.style.top = '20px'
    gui.domElement.style.zIndex = '1000'

    if (Object.keys(gltf.userData).length > 0) {
      // 获取 KHR_materials_variants 扩展信息
      const parser = gltf.parser

      const variantsExtension =
        gltf.userData?.gltfExtensions['KHR_materials_variants']

      if (variantsExtension) {
        const variants = variantsExtension.variants.map(
          (variant) => variant.name
        )
        const variantsCtrl = gui.add(state, 'variant', variants).name('Variant')

        // 根据当前选择的变体更新场景
        selectVariant(scene, parser, variantsExtension, state.variant)

        variantsCtrl.onChange((value) =>
          selectVariant(scene, parser, variantsExtension, value)
        )
      }
    }
    render() // 重新渲染场景
  })
}

/**
 * 渲染场景
 */
function render() {
  renderer.render(scene, camera) // 使用渲染器渲染场景
}

// 防抖工具函数
const debounce = (func, delay) => {
  let timeoutId
  return function (...args) {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func.apply(this, args), delay)
  }
}

// 防抖重新渲染函数
const debouncedRender = debounce((newValues) => {
  if (height.value !== newValues.height) {
    if (camera && renderer) {
      console.log('height changed', newValues.height)
      camera.aspect = width.value / newValues.height
      camera.updateProjectionMatrix()
      renderer.setSize(width.value, newValues.height)
      render()
    }
  }

  //重新渲染缩放
  if (scale.value !== newValues.scale && model) {
    model.scale.set(newValues.scale, newValues.scale, newValues.scale)
    render()
  }
  if (selHdr.value !== newValues.selHdr && scene && newValues.selHdr) {
    // 重新渲染背景贴图
    renderHdr()
  }
  // 重新渲染模型
  if (selGltf.value !== newValues.selGltf && scene && newValues.selGltf) {
    // 清除之前的模型
    scene.remove(...scene.children.filter((child) => child.type === 'Group'))
    // 重新渲染模型
    renderGltf()
  }
  // 重新渲染相机参数
  if (
    cameraParams.fov !== newValues.cameraParams.fov ||
    cameraParams.near !== newValues.cameraParams.near ||
    cameraParams.far !== newValues.cameraParams.far ||
    cameraParams.position.x !== newValues.cameraParams.position.x ||
    cameraParams.position.y !== newValues.cameraParams.position.y ||
    cameraParams.position.z !== newValues.cameraParams.position.z
  ) {
    if (camera && renderer) {
      // 更新相机参数
      camera.fov = newValues.cameraParams.fov
      camera.near = newValues.cameraParams.near
      camera.far = newValues.cameraParams.far
      camera.position.set(
        newValues.cameraParams.position.x,
        newValues.cameraParams.position.y,
        newValues.cameraParams.position.z
      )
      // 更新投影矩阵
      camera.updateProjectionMatrix()
      // 重新渲染场景
      render()
    }
  }

  // 你可以在这里调用其他方法来响应变化
}, 1000) // 1000ms 防抖延迟

// 监听画布宽高变化
watch(
  () => ({
    height: props.widgetObj.widgetOption.height,
    scale: props.widgetObj.widgetParams[1].value,
    selHdr: props.widgetObj.widgetParams[0].typeOptions.dataJson.hdrPath,
    selGltf: props.widgetObj.widgetParams[0].typeOptions.dataJson.gltfPath,
    cameraParams: {
      fov: props.widgetObj.widgetParams[2].value,
      near: props.widgetObj.widgetParams[3].value,
      far: props.widgetObj.widgetParams[4].value,
      position: {
        x: props.widgetObj.widgetParams[5].value,
        y: props.widgetObj.widgetParams[6].value,
        z: props.widgetObj.widgetParams[7].value,
      },
    },
    // 添加其他需要监听的属性
  }),
  (newValues) => {
    // 使用防抖函数替代直接重新渲染
    debouncedRender(newValues)
  },
  { deep: true }
)

let resizeObserver

onMounted(() => {
  // 初始化场景
  init()

  // 渲染场景
  render()

  // 使用 ResizeObserver 监听容器宽度变化
  resizeObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (width.value !== entry.contentRect.width) {
        width.value = entry.contentRect.width

        if (camera && renderer) {
          camera.aspect = width.value / height.value
          camera.updateProjectionMatrix()
          renderer.setSize(width.value, height.value)
          render()
        }
      }
    }
  })

  if (container.value) {
    resizeObserver.observe(container.value)
  }
})

onUnmounted(() => {
  // 清理资源
  renderer.dispose()

  // 清理 ResizeObserver
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})
</script>

<style scoped>
/* 设置画布容器样式 */
.canvas-container {
  width: 100%; /* 宽度占满父容器 */
  height: 100vh; /* 高度占满视口 */
  margin: 0; /* 移除外边距 */
  overflow: hidden; /* 隐藏溢出内容 */
  position: relative; /* 设置相对定位 */
}
</style>
