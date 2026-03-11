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
      :id="canvasId"
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
// Unity Emscripten 内部通过 canvas.id 做 querySelector，必须有唯一 id
const canvasId = `unity-canvas-${props.chartConfig.id}`
// 控制 canvas DOM 的创建/销毁（WebGL 上下文 lost 后无法恢复，必须新建 canvas）
const canvasAlive = ref(true)
const loading = ref(false)
const progress = ref(0)
const errorMsg = ref('')

let unityInstance: any = null
let loadedLoaderUrl = ''
let loaderScript: HTMLScriptElement | null = null

// 清理 Unity 实例（不销毁 canvas DOM，用于 URL 变更时的重新加载）
const cleanupUnity = async () => {
  if (unityInstance) {
    try {
      await unityInstance.Quit()
    } catch (_) {}
    unityInstance = null
  }

  if (loaderScript) {
    loaderScript.remove()
    loaderScript = null
  }

  delete (window as any).createUnityInstance
  loadedLoaderUrl = ''
}

// 完全销毁 Unity 并释放 GPU/WASM 内存（路由切走 / 组件卸载时调用）
const destroyUnity = async () => {
  if (unityInstance) {
    try {
      await unityInstance.Quit()
    } catch (_) {}

    // 清理 Emscripten Module 引用，释放 WASM 堆内存
    try {
      const module = unityInstance.Module
      if (module) {
        if (module.ctx) {
          const loseCtx = module.ctx.getExtension('WEBGL_lose_context')
          if (loseCtx) loseCtx.loseContext()
        }
        if (module.HEAPU8) module.HEAPU8 = null
        if (module.wasmMemory) module.wasmMemory = null
      }
    } catch (_) {}

    unityInstance = null
  }

  if (loaderScript) {
    loaderScript.remove()
    loaderScript = null
  }

  delete (window as any).createUnityInstance

  // 销毁 canvas DOM（WebGL 上下文 lost 后不可复用，下次需新建）
  canvasAlive.value = false

  loadedLoaderUrl = ''
  console.log('[Unity3D] Instance destroyed and memory released')
}

// 初始化 Unity
const initUnity = async () => {
  const url = loaderUrl.value
  if (!url || !dataUrl.value || !frameworkUrl.value || !codeUrl.value) return
  if (!canvasRef.value) return

  // 如果已加载相同 loader，先清理旧实例
  await cleanupUnity()

  loading.value = true
  progress.value = 0
  errorMsg.value = ''

  try {
    // 动态加载 loader.js
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.onload = () => resolve()
      script.onerror = () => reject(new Error('Loader JS 加载失败'))
      document.head.appendChild(script)
      loaderScript = script
    })

    loadedLoaderUrl = url

    // 调用 createUnityInstance
    const createFn = (window as any).createUnityInstance
    if (typeof createFn !== 'function') {
      throw new Error('createUnityInstance 未找到，请检查 Loader JS 地址')
    }

    const config = {
      dataUrl: dataUrl.value,
      frameworkUrl: frameworkUrl.value,
      codeUrl: codeUrl.value,
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
  async () => {
    if (loaderUrl.value && dataUrl.value && frameworkUrl.value && codeUrl.value) {
      await nextTick()
      initUnity()
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  destroyUnity()
})

// keep-alive 场景：路由切走时销毁 Unity 释放内存
onDeactivated(() => {
  destroyUnity()
})

// keep-alive 场景：路由切回时重新创建 canvas 并初始化 Unity
onActivated(async () => {
  canvasAlive.value = true
  await nextTick()
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
