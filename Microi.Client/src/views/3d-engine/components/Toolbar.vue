<template>
  <div class="engine-toolbar">
    <div class="toolbar-left">
      <div class="tool-group">
        <button class="tool-btn" :class="{ active: transformMode==='translate' }" @click="$emit('transform','translate')" title="平移 (W)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/></svg>
        </button>
        <button class="tool-btn" :class="{ active: transformMode==='rotate' }" @click="$emit('transform','rotate')" title="旋转 (E)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/><path d="M21 3v6h-6"/></svg>
        </button>
        <button class="tool-btn" :class="{ active: transformMode==='scale' }" @click="$emit('transform','scale')" title="缩放 (R)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
        </button>
      </div>

      <div class="tool-sep"></div>

      <div class="tool-group">
        <button class="tool-btn text" @click="$emit('camera','front')">前</button>
        <button class="tool-btn text" @click="$emit('camera','left')">左</button>
        <button class="tool-btn text" @click="$emit('camera','top')">顶</button>
        <button class="tool-btn text" @click="$emit('camera','perspective')">透视</button>
      </div>
    </div>

    <div class="toolbar-right">
      <button class="tool-btn" @click="$emit('autoSetup')" title="自动设置">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
        <span>自动</span>
      </button>
      <button class="tool-btn" @click="$emit('screenshot')" title="截图">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <button class="tool-btn primary" @click="$emit('import')" title="导入模型">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>导入</span>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({ transformMode: { type: String, default: 'translate' } });
defineEmits(['transform', 'camera', 'autoSetup', 'screenshot', 'import']);
</script>

<style scoped>
.engine-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 8px;
  background: linear-gradient(180deg, rgba(20,20,40,0.95), rgba(14,14,30,0.98));
  border-bottom: 1px solid rgba(56,189,248,0.08);
  flex-shrink: 0;
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 2;
}
/* 底部发光线 */
.engine-toolbar::after {
  content: '';
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(56,189,248,0.15) 30%, rgba(139,92,246,0.15) 70%, transparent);
}
.toolbar-left, .toolbar-right {
  display: flex;
  align-items: center;
  gap: 2px;
}
.tool-group {
  display: flex;
  align-items: center;
  gap: 1px;
  background: rgba(255,255,255,0.03);
  border-radius: 6px;
  padding: 2px;
}
.tool-sep {
  width: 1px;
  height: 16px;
  background: rgba(255,255,255,0.08);
  margin: 0 6px;
}
.tool-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: #8892a6;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.tool-btn:hover { background: rgba(255,255,255,0.06); color: #c8d0e0; }
.tool-btn.active {
  background: rgba(56,189,248,0.12);
  color: #38bdf8;
  box-shadow: 0 0 8px rgba(56,189,248,0.15);
}
.tool-btn.text { font-size: 11px; padding: 4px 6px; }
.tool-btn.primary {
  background: linear-gradient(135deg, rgba(56,189,248,0.15), rgba(139,92,246,0.12));
  color: #a5b4fc;
  border: 1px solid rgba(139,92,246,0.2);
}
.tool-btn.primary:hover {
  background: linear-gradient(135deg, rgba(56,189,248,0.25), rgba(139,92,246,0.2));
  color: #c4b5fd;
}
.tool-btn svg { flex-shrink: 0; }
</style>
