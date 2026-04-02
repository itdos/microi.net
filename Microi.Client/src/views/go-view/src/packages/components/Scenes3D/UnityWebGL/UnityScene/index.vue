<template>
  <div
    class="unity-scene-container"
    :style="{ width: w + 'px', height: h + 'px', backgroundColor: backgroundColor }"
  >
    <!-- 未配置时的占位提示 -->
    <div v-if="!loaderUrl" class="unity-placeholder">
      <div class="unity-placeholder-icon">
        <svg viewBox="0 0 120 120" width="48" height="48">
          <polygon points="60,10 20,30 20,80 60,100 100,80 100,30" fill="none" stroke="#51d6a9" stroke-width="3"/>
          <line x1="60" y1="10" x2="60" y2="55" stroke="#51d6a9" stroke-width="3" opacity=".5"/>
          <line x1="20" y1="30" x2="60" y2="55" stroke="#51d6a9" stroke-width="3" opacity=".5"/>
          <line x1="100" y1="30" x2="60" y2="55" stroke="#51d6a9" stroke-width="3" opacity=".5"/>
        </svg>
      </div>
      <span class="unity-placeholder-text">请在右侧配置 Unity WebGL 资源地址</span>
    </div>

    <!-- 加载进度 -->
    <div v-if="loading && loaderUrl" class="unity-loading">
      <div class="unity-loading-text">3D 场景加载中... {{ Math.round(progress * 100) }}%</div>
      <div class="unity-loading-bar">
        <div class="unity-loading-bar-fill" :style="{ width: (progress * 100) + '%' }"></div>
      </div>
    </div>

    <!-- 加载失败 -->
    <div v-if="errorMsg" class="unity-error">
      <span>{{ errorMsg }}</span>
    </div>

    <!-- Unity Canvas（销毁后需要重建，用 v-if 控制） -->
    <canvas
      v-if="canvasAlive"
      :id="currentCanvasId"
      ref="canvasRef"
      :style="{ display: loaderUrl && !errorMsg ? 'block' : 'none', width: '100%', height: '100%' }"
      tabindex="-1"
    ></canvas>
  </div>
</template>

<script setup lang="ts">
import { PropType, ref, toRefs, watch, onBeforeUnmount, onActivated, onDeactivated, nextTick } from 'vue'
import { CreateComponentType } from '@goview/packages/index.d'

const props = defineProps({
  chartConfig: {
    type: Object as PropType<CreateComponentType>,
    required: true
  }
})

const { w, h } = toRefs(props.chartConfig.attr)
const {
  loaderUrl,
  dataUrl,
  frameworkUrl,
  codeUrl,
  productName,
  productVersion,
  companyName,
  streamingAssetsUrl,
  backgroundColor
} = toRefs(props.chartConfig.option)

const canvasRef = ref<HTMLCanvasElement | null>(null)
// 每次 init 使用自增版本号生成唯一 canvas id，确保 Unity 拿到干净的 WebGL 上下文
let _initVersion = 0
const currentCanvasId = ref(`unity-canvas-${props.chartConfig.id}-0`)
// 控制 canvas DOM 的创建/销毁（canvasAlive=false 时 Vue 会移除 canvas 元素）
const canvasAlive = ref(false)
const loading = ref(false)
const progress = ref(0)
const errorMsg = ref('')

let unityInstance: any = null
let loaderScript: HTMLScriptElement | null = null
let loadedLoaderUrl = ''
let blobUrls: string[] = []
// 追踪正在进行的 destroy promise，用于防止 destroy / init 并发竞争
let destroyPromise: Promise<void> | null = null

const cleanupBlobUrls = () => {
  blobUrls.forEach(u => URL.revokeObjectURL(u))
  blobUrls = []
}

/**
 * 针对 .gz 压缩构建的服务端双重解压问题：
 * CDN/Nginx 见到 .js.gz 会自动加 Content-Encoding: gzip，浏览器解压一次，
 * Unity loader 再解压一次，导致 "Unable to load file" 错误。
 * 解决办法：预取文件 → 检测魔数 → 必要时手动解压 → 创建无扩展名 Blob URL 传给 Unity。
 */
const fetchGzAsBlob = async (url: string, mimeType: string): Promise<string> => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`无法获取文件 ${url}，状态码: ${response.status}`)
  const buffer = await response.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // gzip 魔数: 0x1f 0x8b
  // 若仍为 gzip（服务端未加 Content-Encoding）则手动解压；否则浏览器已自动解压，直接使用
  const isStillGzip = bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
  let finalBuffer: ArrayBuffer

  if (isStillGzip) {
    const ds = new DecompressionStream('gzip')
    const writer = ds.writable.getWriter()
    const reader = ds.readable.getReader()
    writer.write(bytes)
    writer.close()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const total = chunks.reduce((n, c) => n + c.length, 0)
    const merged = new Uint8Array(total)
    let off = 0
    for (const c of chunks) { merged.set(c, off); off += c.length }
    finalBuffer = merged.buffer
  } else {
    finalBuffer = buffer
  }

  const blob = new Blob([finalBuffer], { type: mimeType })
  const blobUrl = URL.createObjectURL(blob)
  blobUrls.push(blobUrl)
  return blobUrl
}

// .gz 文件返回解压后的 Blob URL；其他文件原样返回
const getEffectiveUrl = async (url: string, mimeType: string): Promise<string> => {
  if (url.endsWith('.gz')) return fetchGzAsBlob(url, mimeType)
  return url
}

/**
 * 销毁 Unity 实例，释放 GPU/WASM 内存。
 * 关键设计：所有状态清零必须在第一个 await 之前（同步阶段）完成，
 * 防止 onActivated 的 initUnity 与本函数的 async 尾部产生竞争。
 */
const destroyUnity = (): Promise<void> => {
  // === 同步阶段：立即捕获并清零所有模块状态 ===
  const inst = unityInstance
  const script = loaderScript
  unityInstance = null
  loaderScript = null
  loadedLoaderUrl = ''
  canvasAlive.value = false   // 立即移除 canvas，不等 Quit 完成
  cleanupBlobUrls()

  // === 异步阶段：执行耗时的 Quit 和 GPU 释放 ===
  return (async () => {
    if (inst) {
      try { await inst.Quit() } catch (_) {}
      try {
        const mod = inst.Module
        if (mod) {
          if (mod.ctx) {
            const ext = mod.ctx.getExtension('WEBGL_lose_context')
            if (ext) ext.loseContext()
          }
          if (mod.HEAPU8) mod.HEAPU8 = null
          if (mod.wasmMemory) mod.wasmMemory = null
        }
      } catch (_) {}
    }
    // 移除捕获的旧脚本（新 initUnity 可能已添加新脚本，不能用模块变量）
    if (script) script.remove()
    console.log('[Unity3D] Instance destroyed and memory released')
  })()
}

// 初始化 Unity
const initUnity = async () => {
  // 等待任何正在进行的 destroy 完成，防止并发竞争
  if (destroyPromise) {
    try { await destroyPromise } catch (_) {}
    destroyPromise = null
  }

  const url = loaderUrl.value
  if (!url || !dataUrl.value || !frameworkUrl.value || !codeUrl.value) return

  // 每次 init 生成新唯一 canvas ID，保证 Unity 拿到全新 WebGL 上下文
  _initVersion++
  currentCanvasId.value = `unity-canvas-${props.chartConfig.id}-${_initVersion}`

  // 重建 canvas DOM（false→nextTick→true，确保旧 canvas 完全移除后再创建新 canvas）
  canvasAlive.value = false
  await nextTick()
  canvasAlive.value = true
  await nextTick()

  if (!canvasRef.value) return

  loading.value = true
  progress.value = 0
  errorMsg.value = ''

  try {
    // 仅在 loaderUrl 变更时重新加载脚本，相同 URL 复用已执行的 createUnityInstance
    if (loadedLoaderUrl !== url) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script')
        script.src = url
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Loader JS 加载失败'))
        document.head.appendChild(script)
        loaderScript = script
      })
      loadedLoaderUrl = url
    }

    const createFn = (window as any).createUnityInstance
    if (typeof createFn !== 'function') {
      throw new Error('createUnityInstance 未找到，请检查 Loader JS 地址')
    }

    // 预处理 .gz 压缩资源：解压后生成 Blob URL，避免服务端双重压缩导致 Unity loader 解析失败
    const [effectiveData, effectiveFramework, effectiveCode] = await Promise.all([
      getEffectiveUrl(dataUrl.value, 'application/octet-stream'),
      getEffectiveUrl(frameworkUrl.value, 'text/javascript'),
      getEffectiveUrl(codeUrl.value, 'application/wasm')
    ])

    // 异步加载期间若用户已离开（canvas 已被销毁），则放弃
    if (!canvasRef.value) return

    const config = {
      dataUrl: effectiveData,
      frameworkUrl: effectiveFramework,
      codeUrl: effectiveCode,
      streamingAssetsUrl: streamingAssetsUrl.value,
      companyName: companyName.value,
      productName: productName.value,
      productVersion: productVersion.value
    }

    unityInstance = await createFn(canvasRef.value, config, (p: number) => {
      progress.value = p
    })

    loading.value = false
  } catch (e: any) {
    loading.value = false
    errorMsg.value = 'Unity 加载失败: ' + (e?.message || e)
    console.error('[Unity3D]', e)
  }
}

// 监听核心 URL 变化，重新加载 Unity
watch(
  [loaderUrl, dataUrl, frameworkUrl, codeUrl],
  () => {
    if (loaderUrl.value && dataUrl.value && frameworkUrl.value && codeUrl.value) {
      // 有存量实例时先 destroy，initUnity 内部会 await destroyPromise
      if (unityInstance || loaderScript || loadedLoaderUrl) {
        destroyPromise = destroyUnity()
      }
      initUnity()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  destroyPromise = destroyUnity()
})

// keep-alive 场景：路由切走时销毁 Unity 释放内存
onDeactivated(() => {
  destroyPromise = destroyUnity()
})

// keep-alive 场景：路由切回时重新初始化 Unity
onActivated(async () => {
  // 等待 onDeactivated 触发的 destroy 完成后再 init
  if (destroyPromise) {
    try { await destroyPromise } catch (_) {}
    destroyPromise = null
  }
  if (loaderUrl.value && dataUrl.value && frameworkUrl.value && codeUrl.value) {
    initUnity()
  }
})
</script>

<style scoped>
.unity-scene-container {
  position: relative;
  overflow: hidden;
}

.unity-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: rgba(0, 0, 0, 0.6);
}

.unity-placeholder-icon {
  opacity: 0.7;
}

.unity-placeholder-text {
  color: #888;
  font-size: 13px;
}

.unity-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.75);
  z-index: 10;
}

.unity-loading-text {
  color: #51d6a9;
  font-size: 14px;
}

.unity-loading-bar {
  width: 200px;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
  overflow: hidden;
}

.unity-loading-bar-fill {
  height: 100%;
  background: #51d6a9;
  border-radius: 2px;
  transition: width 0.3s ease;
}

.unity-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  color: #e88080;
  font-size: 13px;
  padding: 20px;
  text-align: center;
  z-index: 10;
}
</style>
