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

    <!-- 控制面板 -->
    <div
      v-if="(showControls !== false) && unityReady && !loading && !errorMsg"
      class="unity-controls"
      :class="{ 'unity-controls-collapsed': controlsCollapsed }"
      @mousedown.stop
      @pointerdown.stop
    >
      <!-- 折叠/展开按钮 -->
      <button class="ctrl-toggle" @click.stop="controlsCollapsed = !controlsCollapsed" title="展开/收起控制面板">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path v-if="controlsCollapsed" d="M8 5v14l11-7z"/>
          <path v-else d="M7 7h10v10H7z" opacity="0.6"/>
        </svg>
      </button>

      <template v-if="!controlsCollapsed">
        <!-- 播放控制 -->
        <div class="ctrl-group">
          <button class="ctrl-btn" @click.stop="sendMessage('StartPlayback')" title="播放/恢复 (Space)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <button class="ctrl-btn" @click.stop="sendMessage('PausePlayback')" title="暂停 (Space)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
          </button>
          <button class="ctrl-btn" @click.stop="sendMessage('StopPlayback')" title="停止 (Esc)">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>
          </button>
          <button class="ctrl-btn" @click.stop="sendMessage('RestartPlayback')" title="重新播放">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
          </button>
        </div>

        <div class="ctrl-divider"></div>

        <!-- 路径点快速跳转 -->
        <div v-if="(waypointCount || 0) > 0" class="ctrl-group ctrl-waypoints">
          <button
            v-for="i in (waypointCount || 0)"
            :key="i"
            class="ctrl-btn ctrl-btn-sm"
            @click.stop="sendMessage('JumpToPosition', 'position_' + i)"
            :title="'跳转到路径点 ' + i + ' (按键' + i + ')'"
          >{{ i }}</button>
        </div>

        <div v-if="(waypointCount || 0) > 0" class="ctrl-divider"></div>

        <!-- 快捷键提示 -->
        <button class="ctrl-btn" @click.stop="showHelp = !showHelp" title="操作帮助">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z"/></svg>
        </button>
      </template>
    </div>

    <!-- 快捷键帮助浮层 -->
    <div v-if="showHelp" class="unity-help-overlay" @click="showHelp = false">
      <div class="unity-help-card" @click.stop>
        <div class="unity-help-title">操作说明</div>
        <div class="unity-help-section">
          <div class="unity-help-subtitle">鼠标操作</div>
          <div class="unity-help-row"><kbd>左键拖动</kbd><span>轨道旋转（围绕模型）</span></div>
          <div class="unity-help-row"><kbd>右键拖动</kbd><span>平移视角</span></div>
          <div class="unity-help-row"><kbd>中键拖动</kbd><span>平移视角</span></div>
          <div class="unity-help-row"><kbd>滚轮</kbd><span>缩放（拉近/拉远）</span></div>
        </div>
        <div class="unity-help-section">
          <div class="unity-help-subtitle">键盘操作</div>
          <div class="unity-help-row"><kbd>W A S D</kbd><span>前后左右移动</span></div>
          <div class="unity-help-row"><kbd>Q / E</kbd><span>上下移动</span></div>
          <div class="unity-help-row"><kbd>Shift</kbd><span>加速移动</span></div>
          <div class="unity-help-row"><kbd>Space</kbd><span>开始/暂停播放</span></div>
          <div class="unity-help-row"><kbd>R</kbd><span>重置到起点</span></div>
          <div class="unity-help-row"><kbd>1-9</kbd><span>跳转到路径点</span></div>
          <div class="unity-help-row"><kbd>Esc</kbd><span>停止播放</span></div>
        </div>
        <div class="unity-help-section">
          <div class="unity-help-subtitle">触摸操作</div>
          <div class="unity-help-row"><kbd>单指拖动</kbd><span>旋转视角</span></div>
          <div class="unity-help-row"><kbd>双指缩放</kbd><span>拉近/拉远</span></div>
        </div>
        <button class="unity-help-close" @click="showHelp = false">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { PropType, ref, toRefs, watch, onBeforeUnmount, onActivated, onDeactivated, onMounted, nextTick } from 'vue'
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
  backgroundColor,
  showControls,
  gameManagerName,
  waypointCount,
  instanceName
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
const unityReady = ref(false)
const controlsCollapsed = ref(false)
const showHelp = ref(false)

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
  unityReady.value = false
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
    unityReady.value = true
    emit('ready', publicApi)
  } catch (e: any) {
    loading.value = false
    errorMsg.value = 'Unity 加载失败: ' + (e?.message || e)
    console.error('[Unity3D]', e)
    emit('error', e)
  }
}

// 向 Unity 发送消息
const sendMessage = (method: string, param?: string) => {
  if (!unityInstance) {
    console.warn('[Unity3D] SendMessage skipped: unityInstance is null, method:', method)
    return
  }
  const target = gameManagerName?.value || 'Main Camera';//GameManager
  console.log('[Unity3D] SendMessage →', target, method, param ?? '')
  try {
    if (param !== undefined) {
      unityInstance.SendMessage(target, method, param)
    } else {
      unityInstance.SendMessage(target, method)
    }
  } catch (e) {
    console.error('[Unity3D] SendMessage failed:', target, method, e)
  }
}

// ╔═══════════════════════════════════════════════════════════════╗
// ║   对外暴露的相机/播放控制 API（供其它 go-view 插件事件调用）   ║
// ╚═══════════════════════════════════════════════════════════════╝

type UnityEventName = 'reachPosition' | 'playbackComplete' | 'debug' | 'notification' | 'ready' | 'error'
const listeners: Record<UnityEventName, Function[]> = {
  reachPosition: [],
  playbackComplete: [],
  debug: [],
  notification: [],
  ready: [],
  error: []
}
const emit = (name: UnityEventName, ...args: any[]) => {
  ;(listeners[name] || []).slice().forEach(fn => {
    try { fn(...args) } catch (e) { console.error('[Unity3D] listener error:', name, e) }
  })
}
const on = (name: UnityEventName, fn: Function) => {
  if (!listeners[name]) return
  listeners[name].push(fn)
}
const off = (name: UnityEventName, fn?: Function) => {
  if (!listeners[name]) return
  if (!fn) { listeners[name].length = 0; return }
  const i = listeners[name].indexOf(fn)
  if (i >= 0) listeners[name].splice(i, 1)
}

/**
 * 公开 API：所有方法均可在其它插件的"基础事件/高级事件/交互事件"中调用
 * 调用方式：
 *   window.$microiUnity.first().jumpTo('position_1')
 *   window.$microiUnity.get('factory3D').play()
 *   window.$microiUnity.get('<chartId>').sendMessage('GameManager', 'CustomMethod', 'param')
 */
const publicApi = {
  /** 是否已加载完成 */
  isReady: () => unityReady.value && !loading.value && !errorMsg.value,
  /** Unity 原始实例（高级用途） */
  getInstance: () => unityInstance,
  /** 通用消息发送：对应 unityInstance.SendMessage */
  sendMessage: (methodOrTarget: string, methodOrParam?: string, param?: string) => {
    // 兼容两种调用方式：
    //   sendMessage('JumpToPosition', 'position_1')               → 用配置的 GameManager 名
    //   sendMessage('GameManager', 'JumpToPosition', 'position_1') → 自定义目标对象
    if (param !== undefined) {
      // 三参形式：自定义目标
      if (!unityInstance) return
      try { unityInstance.SendMessage(methodOrTarget, methodOrParam!, param) }
      catch (e) { console.error('[Unity3D] SendMessage failed:', e) }
    } else {
      sendMessage(methodOrTarget, methodOrParam)
    }
  },
  /** 播放（若处于暂停则恢复） */
  play: () => sendMessage('StartPlayback'),
  /** 暂停 */
  pause: () => sendMessage('PausePlayback'),
  /** 恢复 */
  resume: () => sendMessage('ResumePlayback'),
  /** 停止 */
  stop: () => sendMessage('StopPlayback'),
  /** 重新播放 */
  restart: () => sendMessage('RestartPlayback'),
  /**
   * 跳转到指定相机位置/路径点
   * @param positionId 路径点 positionId 字段，或 'position_N' 索引格式（N 从 1 开始）
   *                   也可以直接传数字 N，自动拼成 'position_N'
   */
  jumpTo: (positionId: string | number) => {
    const id = typeof positionId === 'number' ? `position_${positionId}` : positionId
    sendMessage('JumpToPosition', id)
  },
  /** 监听 Unity → JS 事件 */
  on,
  /** 取消监听 */
  off,
  /** 当前 chart id */
  chartId: props.chartConfig.id,
  /** 当前实例名（可在配置中设置） */
  get name() { return instanceName?.value || '' }
}

// 注册到全局，让其它插件事件可以访问
const ensureGlobalRegistry = () => {
  const w = window as any
  if (!w.$microiUnity) {
    const map: Record<string, any> = {}
    w.$microiUnity = {
      _map: map,
      register(key: string, api: any) { if (key) map[key] = api },
      unregister(key: string) { if (key) delete map[key] },
      get(key: string) { return map[key] },
      first() {
        const keys = Object.keys(map)
        return keys.length ? map[keys[0]] : null
      },
      all() { return { ...map } },
      list() { return Object.keys(map) }
    }
  }
  return w.$microiUnity
}

const registerApi = () => {
  const reg = ensureGlobalRegistry()
  reg.register(props.chartConfig.id, publicApi)
  if (instanceName?.value) reg.register(instanceName.value, publicApi)
}
const unregisterApi = () => {
  const reg = (window as any).$microiUnity
  if (!reg) return
  reg.unregister(props.chartConfig.id)
  if (instanceName?.value) reg.unregister(instanceName.value)
}

// instanceName 变化时重新注册
watch(() => instanceName?.value, (v, old) => {
  const reg = (window as any).$microiUnity
  if (!reg) return
  if (old) reg.unregister(old)
  if (v) reg.register(v, publicApi)
})

// 设置 Unity → JS 全局回调（jslib 中通过 window.onUnityXxx 调用）
// 注意：多个 Unity 实例共用同一组全局回调，因此用聚合方式分发
const installGlobalUnityCallbacks = () => {
  const w = window as any
  const dispatch = (event: UnityEventName, ...args: any[]) => {
    const reg = w.$microiUnity
    if (!reg) return
    Object.values(reg._map || {}).forEach((api: any) => {
      try { (api as any)[`__emit_${event}`]?.(...args) } catch (_) {}
    })
  }
  if (!w.__microiUnityCallbacksInstalled) {
    w.__microiUnityCallbacksInstalled = true
    const prevReach = w.onUnityReachPosition
    w.onUnityReachPosition = (pos: string) => {
      try { prevReach && prevReach(pos) } catch (_) {}
      dispatch('reachPosition', pos)
    }
    const prevDone = w.onUnityPlaybackComplete
    w.onUnityPlaybackComplete = () => {
      try { prevDone && prevDone() } catch (_) {}
      dispatch('playbackComplete')
    }
    const prevDebug = w.onUnityDebug
    w.onUnityDebug = (msg: string) => {
      try { prevDebug && prevDebug(msg) } catch (_) {}
      dispatch('debug', msg)
    }
    const prevNotify = w.onUnityNotification
    w.onUnityNotification = (title: string, msg: string) => {
      try { prevNotify && prevNotify(title, msg) } catch (_) {}
      dispatch('notification', title, msg)
    }
  }
}

// 给 publicApi 挂上分发钩子
;(publicApi as any).__emit_reachPosition = (p: string) => emit('reachPosition', p)
;(publicApi as any).__emit_playbackComplete = () => emit('playbackComplete')
;(publicApi as any).__emit_debug = (m: string) => emit('debug', m)
;(publicApi as any).__emit_notification = (t: string, m: string) => emit('notification', t, m)

onMounted(() => {
  installGlobalUnityCallbacks()
  registerApi()
})

// 同时通过 defineExpose 暴露，让 go-view 高级事件也可通过 components[id].exposed 访问
defineExpose(publicApi)

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
  unregisterApi()
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
  font-size: 13px;
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

/* ===== 控制面板 ===== */
.unity-controls {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 20;
  transition: all 0.25s ease;
  user-select: none;
}

.unity-controls-collapsed {
  padding: 6px;
  gap: 0;
}

.ctrl-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.ctrl-toggle:hover {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ctrl-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.75);
  cursor: pointer;
  transition: all 0.2s;
  pointer-events: auto;
}
.ctrl-btn:hover {
  background: rgba(81, 214, 169, 0.25);
  color: #51d6a9;
}
.ctrl-btn:active {
  transform: scale(0.92);
}

.ctrl-btn-sm {
  width: 26px;
  height: 26px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
}

.ctrl-waypoints {
  gap: 1px;
}

.ctrl-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 4px;
  flex-shrink: 0;
}

/* ===== 帮助浮层 ===== */
.unity-help-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 30;
}

.unity-help-card {
  background: rgba(30, 34, 44, 0.95);
  backdrop-filter: blur(12px);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px 24px;
  min-width: 320px;
  max-width: 400px;
  color: #ddd;
}

.unity-help-title {
  font-size: 15px;
  font-weight: 600;
  color: #51d6a9;
  margin-bottom: 14px;
  text-align: center;
}

.unity-help-section {
  margin-bottom: 12px;
}

.unity-help-subtitle {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.unity-help-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 0;
  font-size: 13px;
}

.unity-help-row kbd {
  display: inline-block;
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
  color: #fff;
  min-width: 60px;
  text-align: center;
}

.unity-help-row span {
  color: rgba(255, 255, 255, 0.65);
}

.unity-help-close {
  display: block;
  width: 100%;
  padding: 8px 0;
  margin-top: 10px;
  border: none;
  border-radius: 7px;
  background: rgba(81, 214, 169, 0.15);
  color: #51d6a9;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.2s;
}
.unity-help-close:hover {
  background: rgba(81, 214, 169, 0.28);
}
</style>
