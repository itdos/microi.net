<template>
  <div class="engine-renderer">
    <!-- 视口（全画面） -->
    <div class="renderer-viewport" ref="containerRef">
      <!-- 浮动播放控制条 -->
      <Transition name="fade-up">
        <div v-if="waypoints.length >= 2" class="playbar">
          <button class="pb-btn" :class="{ active: isPlaying && !isPaused }" @click="togglePlay">
            <svg v-if="isPlaying && !isPaused" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
          </button>
          <button v-if="isPlaying" class="pb-btn" @click="stopPath" title="停止">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
          </button>
          <div v-if="isPlaying" class="pb-info">
            <span class="pb-dot"></span>
            <span>{{ isPaused ? '已暂停' : '播放中' }} · {{ currentWpIndex + 1 }}/{{ waypoints.length }}</span>
          </div>
        </div>
      </Transition>

      <!-- 右上角按钮 -->
      <div class="top-actions">
        <button class="float-btn" @click="resetView">重置视角</button>
        <button class="float-btn" @click="toggleFullscreen">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
        </button>
      </div>

      <!-- 加载 -->
      <div v-if="loading" class="loading-overlay">
        <div class="ring"></div>
        <div class="lt">加载中...</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { Engine } from './core/Engine';

const route = useRoute();
let engine = null;
const containerRef = ref(null);
const loading = ref(false);
const isPlaying = ref(false);
const isPaused = ref(false);
const currentWpIndex = ref(0);
const waypoints = ref([]);

onMounted(async () => {
  await nextTick();
  if (!containerRef.value) return;
  engine = new Engine(containerRef.value, { readonly: true });
  engine.applyPreset('outdoor');

  engine.on('loadStart', () => { loading.value = true; });
  engine.on('loadEnd', () => { loading.value = false; });
  engine.cameraPath.on('start', () => { isPlaying.value = true; isPaused.value = false; });
  engine.cameraPath.on('stop', () => { isPlaying.value = false; isPaused.value = false; currentWpIndex.value = 0; });
  engine.cameraPath.on('stateChanged', (s) => { isPlaying.value = s.playing; isPaused.value = s.paused; });
  engine.cameraPath.on('waypointReached', (i) => { currentWpIndex.value = i; });

  // URL 参数
  const configParam = route.query.config;
  if (configParam) { try { await loadConfig(JSON.parse(decodeURIComponent(configParam))); } catch (e) {} }
  const modelUrl = route.query.model;
  if (modelUrl) { try { await engine.loadModel(decodeURIComponent(modelUrl)); } catch (e) {} }
});
onBeforeUnmount(() => { if (engine) { engine.dispose(); engine = null; } });

async function loadConfig(config) {
  if (!engine) return;
  if (config.preset) engine.applyPreset(config.preset);
  if (config.waypoints?.length) {
    const THREE = await import('three');
    config.waypoints.forEach(wp => {
      engine.cameraPath.addWaypoint(
        new THREE.Vector3(...wp.position),
        new THREE.Vector3(...wp.target),
        wp.name,
        { speed: wp.speed || 2000, stayDuration: wp.stayDuration || 1500 },
      );
    });
    waypoints.value = [...engine.cameraPath.waypoints];
  }
  if (config.objects) {
    for (const obj of config.objects) { if (obj.url) await engine.loadModel(obj.url, { name: obj.name }); }
  }
}

function togglePlay() {
  if (!engine) return;
  if (isPlaying.value && !isPaused.value) engine.cameraPath.pause();
  else if (isPlaying.value && isPaused.value) engine.cameraPath.resume();
  else engine.cameraPath.play();
}
function stopPath() { engine?.cameraPath.stop(); }
function resetView() { engine?.resetCamera(); }
function toggleFullscreen() {
  const el = containerRef.value?.parentElement;
  if (!el) return;
  if (document.fullscreenElement) document.exitFullscreen();
  else el.requestFullscreen?.();
}

defineExpose({
  getEngine: () => engine,
  loadModel: (f) => engine?.loadModel(f),
  applyPreset: (n) => engine?.applyPreset(n),
});
</script>

<style scoped>
.engine-renderer {
  width: 100%; height: calc(100vh - 84px);
  display: flex; flex-direction: column; background: #0a0a18; overflow: hidden;
}
.renderer-viewport { flex: 1; overflow: hidden; position: relative; }

/* === 播放条 === */
.playbar {
  position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 6px;
  padding: 6px 14px;
  background: rgba(10,10,26,0.85); backdrop-filter: blur(12px);
  border: 1px solid rgba(56,189,248,0.15); border-radius: 24px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 16px rgba(56,189,248,0.05);
  z-index: 30;
}
.pb-btn {
  width: 32px; height: 32px; border: none; border-radius: 50%;
  background: rgba(255,255,255,0.06); color: #94a3b8;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: all 0.2s;
}
.pb-btn:hover { background: rgba(56,189,248,0.15); color: #e2e8f0; }
.pb-btn.active { background: rgba(56,189,248,0.2); color: #38bdf8; }
.pb-info { display: flex; align-items: center; gap: 6px; font-size: 11px; color: #64748b; padding: 0 4px; white-space: nowrap; }
.pb-dot { width: 6px; height: 6px; border-radius: 50%; background: #38bdf8; animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }

/* === 右上按钮 === */
.top-actions {
  position: absolute; top: 12px; right: 12px;
  display: flex; gap: 6px; z-index: 20;
}
.float-btn {
  padding: 5px 10px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;
  background: rgba(10,10,26,0.7); backdrop-filter: blur(8px);
  color: #8892a6; font-size: 11px; cursor: pointer; transition: all 0.2s;
  display: flex; align-items: center; gap: 4px;
}
.float-btn:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; border-color: rgba(56,189,248,0.2); }

/* === 加载 === */
.loading-overlay {
  position: absolute; inset: 0; background: rgba(10,10,26,0.75);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px;
  z-index: 25; backdrop-filter: blur(4px);
}
.ring {
  width: 32px; height: 32px; border: 2px solid rgba(56,189,248,0.1);
  border-top-color: #38bdf8; border-radius: 50%; animation: spin 0.8s linear infinite;
}
.lt { font-size: 12px; color: #64748b; }
@keyframes spin { to { transform: rotate(360deg); } }

.fade-up-enter-active, .fade-up-leave-active { transition: all 0.3s ease; }
.fade-up-enter-from, .fade-up-leave-to { opacity: 0; transform: translateX(-50%) translateY(12px); }
</style>
