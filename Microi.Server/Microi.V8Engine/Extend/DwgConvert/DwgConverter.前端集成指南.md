# DWG/DXF 前端集成完整指南

## 🔍 为什么只看到平面？

### 2D vs 3D 图纸说明

**2D平面图（建筑平面图、施工图等）**
- ✅ 所有元素都在同一个平面（XY平面）上
- ✅ 包含：线条、圆、弧、文字、尺寸标注等
- ✅ 前端显示：旋转时看到的是一个平面在转动
- ✅ **这是正常的！** 平面图本身就应该是平面

**3D模型（建筑模型、机械零件等）**
- ✅ 包含三维实体：长方体、圆柱、球体等
- ✅ 有高度、厚度、体积
- ✅ 前端显示：旋转时能看到立体效果

## 📋 如何检查你的DWG文件类型

```csharp
// 方法1：获取详细信息
string info = DwgConverter.GetDwgDetailedInfo("你的文件.dwg");
Console.WriteLine(info);

// 方法2：直接判断
bool is3D = DwgConverter.Is3DModel("你的文件.dwg");
if (is3D)
{
    Console.WriteLine("这是3D模型");
}
else
{
    Console.WriteLine("这是2D平面图（前端显示平面是正常的）");
}
```

## 🎨 Vue3 + Three.js 完整集成方案

### 1. 安装依赖

```bash
npm install three dxf-parser
# 或
yarn add three dxf-parser
```

### 2. 创建DXF查看器组件

```vue
<!-- DxfViewer.vue -->
<template>
  <div class="dxf-viewer-container">
    <div class="toolbar">
      <button @click="handleFileUpload">上传DWG</button>
      <input 
        ref="fileInput" 
        type="file" 
        accept=".dwg" 
        style="display: none" 
        @change="onFileChange"
      />
      <button @click="resetView">重置视图</button>
      <button @click="toggleWireframe">{{ wireframe ? '实体' : '线框' }}</button>
      <span class="info">{{ fileInfo }}</span>
    </div>
    <div ref="viewerContainer" class="viewer"></div>
    <div v-if="loading" class="loading">转换中...</div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import DxfParser from 'dxf-parser'

const viewerContainer = ref(null)
const fileInput = ref(null)
const loading = ref(false)
const error = ref('')
const fileInfo = ref('')
const wireframe = ref(false)

let scene, camera, renderer, controls, mesh

// 初始化Three.js场景
const initScene = () => {
  // 场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0xf0f0f0)

  // 相机
  const aspect = viewerContainer.value.clientWidth / viewerContainer.value.clientHeight
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 10000)
  camera.position.set(100, 100, 100)
  camera.lookAt(0, 0, 0)

  // 渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(viewerContainer.value.clientWidth, viewerContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  viewerContainer.value.appendChild(renderer.domElement)

  // 控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // 网格辅助线
  const gridHelper = new THREE.GridHelper(200, 20, 0x888888, 0xcccccc)
  scene.add(gridHelper)

  // 坐标轴
  const axesHelper = new THREE.AxesHelper(100)
  scene.add(axesHelper)

  // 环境光
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)

  // 方向光
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4)
  directionalLight.position.set(100, 100, 50)
  scene.add(directionalLight)

  // 开始渲染
  animate()
}

// 动画循环
const animate = () => {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

// 处理文件上传
const handleFileUpload = () => {
  fileInput.value.click()
}

// 文件选择变化
const onFileChange = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  loading.value = true
  error.value = ''
  fileInfo.value = `文件: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`

  try {
    // 上传到服务器转换
    const formData = new FormData()
    formData.append('dwgFile', file)

    const response = await fetch('/api/dwg/convert', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('转换失败')
    }

    // 获取DXF文本内容
    const dxfText = await response.text()

    // 解析并显示
    parseDxf(dxfText)
  } catch (err) {
    error.value = err.message
    console.error('转换错误:', err)
  } finally {
    loading.value = false
  }
}

// 解析DXF文件
const parseDxf = (dxfText) => {
  try {
    // 移除之前的模型
    if (mesh) {
      scene.remove(mesh)
      mesh.geometry.dispose()
      mesh.material.dispose()
    }

    // 解析DXF
    const parser = new DxfParser()
    const dxf = parser.parseSync(dxfText)

    console.log('DXF解析结果:', dxf)

    // 创建几何体组
    const group = new THREE.Group()

    // 处理实体
    if (dxf.entities) {
      dxf.entities.forEach(entity => {
        const obj = createEntityObject(entity)
        if (obj) {
          group.add(obj)
        }
      })
    }

    // 添加到场景
    scene.add(group)
    mesh = group

    // 计算边界盒并调整相机
    const box = new THREE.Box3().setFromObject(group)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2))
    cameraZ *= 1.5 // 放大一点

    camera.position.set(center.x + cameraZ, center.y + cameraZ, center.z + cameraZ)
    camera.lookAt(center)
    controls.target.copy(center)
    controls.update()

    fileInfo.value += ` | 实体数: ${dxf.entities.length}`
  } catch (err) {
    error.value = '解析DXF失败: ' + err.message
    console.error('DXF解析错误:', err)
  }
}

// 创建实体对象
const createEntityObject = (entity) => {
  const material = new THREE.LineBasicMaterial({ 
    color: entity.color || 0x000000,
    linewidth: 1
  })

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
    case 'SPLINE':
      return createSpline(entity, material)
    default:
      console.log('未处理的实体类型:', entity.type)
      return null
  }
}

// 创建直线
const createLine = (entity, material) => {
  const points = [
    new THREE.Vector3(entity.vertices[0].x, entity.vertices[0].y, entity.vertices[0].z || 0),
    new THREE.Vector3(entity.vertices[1].x, entity.vertices[1].y, entity.vertices[1].z || 0)
  ]
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.Line(geometry, material)
}

// 创建多段线
const createPolyline = (entity, material) => {
  const points = entity.vertices.map(v => 
    new THREE.Vector3(v.x, v.y, v.z || 0)
  )
  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  return new THREE.Line(geometry, material)
}

// 创建圆
const createCircle = (entity, material) => {
  const curve = new THREE.EllipseCurve(
    entity.center.x, entity.center.y,
    entity.radius, entity.radius,
    0, 2 * Math.PI,
    false, 0
  )
  const points = curve.getPoints(50)
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(p => new THREE.Vector3(p.x, p.y, entity.center.z || 0))
  )
  return new THREE.Line(geometry, material)
}

// 创建弧
const createArc = (entity, material) => {
  const startAngle = entity.startAngle * Math.PI / 180
  const endAngle = entity.endAngle * Math.PI / 180
  const curve = new THREE.EllipseCurve(
    entity.center.x, entity.center.y,
    entity.radius, entity.radius,
    startAngle, endAngle,
    false, 0
  )
  const points = curve.getPoints(50)
  const geometry = new THREE.BufferGeometry().setFromPoints(
    points.map(p => new THREE.Vector3(p.x, p.y, entity.center.z || 0))
  )
  return new THREE.Line(geometry, material)
}

// 创建样条曲线
const createSpline = (entity, material) => {
  if (!entity.controlPoints || entity.controlPoints.length < 2) return null
  
  const points = entity.controlPoints.map(p => 
    new THREE.Vector3(p.x, p.y, p.z || 0)
  )
  const curve = new THREE.CatmullRomCurve3(points)
  const curvePoints = curve.getPoints(50)
  const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints)
  return new THREE.Line(geometry, material)
}

// 重置视图
const resetView = () => {
  camera.position.set(100, 100, 100)
  camera.lookAt(0, 0, 0)
  controls.target.set(0, 0, 0)
  controls.update()
}

// 切换线框模式
const toggleWireframe = () => {
  wireframe.value = !wireframe.value
  if (mesh) {
    mesh.traverse(child => {
      if (child.material) {
        child.material.wireframe = wireframe.value
      }
    })
  }
}

// 窗口大小变化
const onWindowResize = () => {
  if (!viewerContainer.value) return
  camera.aspect = viewerContainer.value.clientWidth / viewerContainer.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(viewerContainer.value.clientWidth, viewerContainer.value.clientHeight)
}

onMounted(() => {
  initScene()
  window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize)
  if (renderer) {
    renderer.dispose()
  }
})
</script>

<style scoped>
.dxf-viewer-container {
  width: 100%;
  height: 100%;
  position: relative;
}

.toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: flex;
  gap: 10px;
  background: rgba(255, 255, 255, 0.9);
  padding: 10px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.toolbar button {
  padding: 6px 12px;
  border: 1px solid #ccc;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.toolbar button:hover {
  background: #f0f0f0;
}

.info {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.viewer {
  width: 100%;
  height: 100%;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 20px 40px;
  border-radius: 4px;
  font-size: 16px;
}

.error {
  position: absolute;
  top: 70px;
  left: 10px;
  background: #f44336;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  max-width: 400px;
}
</style>
```

### 3. 创建后端API控制器

```csharp
using Microsoft.AspNetCore.Mvc;

namespace Microi.net.Api.Controllers
{
    [ApiController]
    [Route("api/dwg")]
    public class DwgController : ControllerBase
    {
        /// <summary>
        /// 转换DWG为DXF
        /// </summary>
        [HttpPost("convert")]
        public async Task<IActionResult> ConvertDwgToDxf(IFormFile dwgFile)
        {
            if (dwgFile == null || dwgFile.Length == 0)
            {
                return BadRequest("请上传DWG文件");
            }

            try
            {
                using (var dwgStream = dwgFile.OpenReadStream())
                using (var dxfStream = new MemoryStream())
                {
                    // 转换为ASCII格式的DXF（前端更容易解析）
                    bool success = DwgConverter.ConvertDwgToDxf(dwgStream, dxfStream, false);

                    if (success)
                    {
                        dxfStream.Position = 0;
                        using (var reader = new StreamReader(dxfStream))
                        {
                            var dxfContent = await reader.ReadToEndAsync();
                            return Content(dxfContent, "text/plain");
                        }
                    }
                    
                    return StatusCode(500, "转换失败");
                }
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"转换出错: {ex.Message}");
            }
        }

        /// <summary>
        /// 检查DWG文件信息
        /// </summary>
        [HttpPost("info")]
        public IActionResult GetDwgInfo(IFormFile dwgFile)
        {
            if (dwgFile == null || dwgFile.Length == 0)
            {
                return BadRequest("请上传DWG文件");
            }

            try
            {
                // 保存临时文件
                var tempPath = Path.GetTempFileName();
                using (var stream = new FileStream(tempPath, FileMode.Create))
                {
                    dwgFile.CopyTo(stream);
                }

                // 获取详细信息
                var info = DwgConverter.GetDwgDetailedInfo(tempPath);
                var is3D = DwgConverter.Is3DModel(tempPath);

                // 删除临时文件
                System.IO.File.Delete(tempPath);

                return Ok(new
                {
                    fileName = dwgFile.FileName,
                    fileSize = dwgFile.Length,
                    is3D = is3D,
                    detailedInfo = info
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"获取信息失败: {ex.Message}");
            }
        }
    }
}
```

### 4. 在页面中使用

```vue
<template>
  <div class="page-container">
    <h1>DWG/DXF 文件查看器</h1>
    <div class="viewer-wrapper">
      <DxfViewer />
    </div>
  </div>
</template>

<script setup>
import DxfViewer from '@/components/DxfViewer.vue'
</script>

<style scoped>
.page-container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.viewer-wrapper {
  flex: 1;
  min-height: 0;
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}
</style>
```

## 📚 其他推荐的DXF查看库

### 1. three-dxf (推荐)

```bash
npm install three-dxf
```

```javascript
import * as THREE from 'three'
import { DxfViewer } from 'three-dxf'

const viewer = new DxfViewer(container, {
  clearColor: new THREE.Color('#fff'),
  autoResize: true,
  colorCorrect: true
})

// 加载DXF
viewer.Load({
  url: 'path/to/file.dxf'
})
```

### 2. dxf-viewer

专门的DXF查看器，功能更强大：

```bash
npm install dxf-viewer
```

## 💡 常见问题解答

### Q1: 为什么只看到平面？
**A:** 因为你的DWG文件是2D平面图（建筑平面图、施工图等），不是3D模型。这是**正常现象**！

### Q2: 如何确认文件类型？
**A:** 使用 `DwgConverter.Is3DModel()` 或 `DwgConverter.GetDwgDetailedInfo()` 方法检查。

### Q3: 如何获得3D效果？
**A:** 需要使用3D建模软件（如AutoCAD 3D、Revit、SketchUp等）创建的包含3D实体的DWG文件。

### Q4: 2D平面图如何更好地展示？
**A:** 
- 使用正交视图（俯视图）而不是透视视图
- 禁用旋转，只允许平移和缩放
- 添加测量工具、标注显示等功能

### Q5: 转换后看不到内容？
**A:** 可能原因：
- DXF解析器不支持某些实体类型
- 坐标系或单位问题
- 检查浏览器控制台的错误信息

## 🎯 优化建议

### 对于2D平面图的优化

```javascript
// 使用正交相机更适合平面图
camera = new THREE.OrthographicCamera(
  width / -2, width / 2,
  height / 2, height / -2,
  0.1, 1000
)

// 固定视角为俯视图
camera.position.set(0, 0, 100)
camera.lookAt(0, 0, 0)

// 限制控制器只允许平移和缩放
controls.enableRotate = false  // 禁用旋转
controls.enablePan = true       // 允许平移
controls.enableZoom = true      // 允许缩放
```

### 性能优化

```javascript
// 对于大型图纸，使用实例化减少绘制调用
const instancedMesh = new THREE.InstancedMesh(geometry, material, count)

// 使用LOD（细节层次）
const lod = new THREE.LOD()
lod.addLevel(highDetailMesh, 0)
lod.addLevel(mediumDetailMesh, 50)
lod.addLevel(lowDetailMesh, 100)
```

## 📞 技术支持

如有问题，请查看：
- Three.js 文档: https://threejs.org/docs/
- dxf-parser GitHub: https://github.com/gdsestimating/dxf-parser
- Microi官网: https://microi.net
