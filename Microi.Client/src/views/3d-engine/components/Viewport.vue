<template>
  <div
    class="viewport-container"
    @dragover.prevent="onDragOver"
    @dragleave="onDragLeave"
    @drop.prevent="onDrop"
  >
    <div ref="canvasRef" class="viewport-canvas"></div>

    <!-- 浮动播放控制条（视口底部居中） -->
    <Transition name="fade">
      <div v-if="showPlaybar" class="playbar">
        <button class="pb-btn" :class="{ active: isPlaying && !isPaused }" @click="onPlay" :title="isPlaying && !isPaused ? '暂停' : '播放'">
          <svg v-if="isPlaying && !isPaused" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>
        </button>
        <button v-if="isPlaying" class="pb-btn" @click="$emit('playback:stop')" title="停止">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
        </button>
        <div v-if="isPlaying" class="pb-info">
          <span class="pb-dot"></span>
          <span>{{ isPaused ? '已暂停' : '播放中' }} · 点位 {{ currentIndex + 1 }}/{{ waypointCount }}</span>
        </div>
      </div>
    </Transition>

    <!-- 拖放提示 -->
    <div v-if="isDragOver" class="drop-overlay">
      <div class="drop-hint">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>释放以导入模型</span>
      </div>
    </div>

    <!-- 加载 -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-ring">
        <div class="ring"></div>
      </div>
      <div class="loading-text">加载中...</div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const canvasRef = ref(null);
const isDragOver = ref(false);
const loading = ref(false);

defineProps({
  showPlaybar: { type: Boolean, default: false },
  isPlaying: Boolean,
  isPaused: Boolean,
  currentIndex: { type: Number, default: 0 },
  waypointCount: { type: Number, default: 0 },
});

const emit = defineEmits(['drop', 'playback:play', 'playback:pause', 'playback:stop']);

defineExpose({
  canvasRef,
  setLoading: (v) => { loading.value = v; },
});

function onPlay() { emit(/* 由外部根据状态决定 */ 'playback:play'); }
function onDragOver() { isDragOver.value = true; }
function onDragLeave() { isDragOver.value = false; }
function onDrop(e) {
  isDragOver.value = false;
  const files = e.dataTransfer?.files;
  if (files?.length) emit('drop', files[0]);
}
</script>

<style scoped>
.viewport-container { width: 100%; height: 100%; position: relative; overflow: hidden; background: #0a0a18; }
.viewport-canvas { width: 100%; height: 100%; }

/* === 播放控制条 === */
.playbar {
  position: absolute;
  bottom: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: rgba(10,10,26,0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(56,189,248,0.15);
  border-radius: 24px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(56,189,248,0.05);
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
.pb-info {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; color: #64748b; padding: 0 4px; white-space: nowrap;
}
.pb-dot {
  width: 6px; height: 6px; border-radius: 50%; background: #38bdf8;
  animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }

/* === 拖放 === */
.drop-overlay {
  position: absolute; inset: 0;
  background: rgba(56,189,248,0.04);
  border: 2px dashed rgba(56,189,248,0.3);
  display: flex; align-items: center; justify-content: center;
  pointer-events: none; z-index: 20;
}
.drop-hint {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  font-size: 13px; color: #38bdf8;
  padding: 24px 40px; background: rgba(10,10,26,0.8); border-radius: 12px;
  backdrop-filter: blur(8px); border: 1px solid rgba(56,189,248,0.15);
}

/* === 加载 === */
.loading-overlay {
  position: absolute; inset: 0;
  background: rgba(10,10,26,0.75);
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  z-index: 25; backdrop-filter: blur(4px);
}
.loading-ring { position: relative; width: 36px; height: 36px; }
.ring {
  width: 36px; height: 36px;
  border: 2px solid rgba(56,189,248,0.1);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.loading-text { font-size: 12px; color: #64748b; }
@keyframes spin { to { transform: rotate(360deg); } }

/* Transition */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s, transform 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateX(-50%) translateY(10px); }
</style>
