<template>
  <div class="preset-gallery">
    <div class="gallery-list">
      <div
        v-for="(item, key) in presets"
        :key="key"
        class="preset-card"
        :class="{ active: currentPreset === key }"
        @click="$emit('select', key)"
      >
        <div class="preset-thumb" :style="{ background: item.thumb }">
          <span class="preset-emoji">{{ item.icon }}</span>
        </div>
        <div class="preset-meta">
          <div class="preset-name">{{ item.label }}</div>
          <div class="preset-desc">{{ item.desc }}</div>
        </div>
        <div v-if="currentPreset === key" class="active-dot"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { PRESETS } from '../core/Presets';

defineProps({ currentPreset: String });
defineEmits(['select']);

const presets = {};
Object.entries(PRESETS).forEach(([key, val]) => {
  let thumb;
  if (val.background?.type === 'sky') {
    // 根据不同天空参数生成不同缩略色
    const elev = val.skyParams?.elevation || 30;
    if (elev <= 10) thumb = 'linear-gradient(180deg, #2a1530 0%, #cc6633 40%, #553322 100%)';
    else if (elev <= 35) thumb = 'linear-gradient(180deg, #4a7ab5 0%, #8ab8d0 40%, #6a8a5a 100%)';
    else thumb = 'linear-gradient(180deg, #2a6ad4 0%, #87ceeb 45%, #6aaa5a 100%)';
  } else if (val.background?.type === 'gradient') {
    thumb = `linear-gradient(180deg, ${val.background.topColor}, ${val.background.bottomColor})`;
  } else {
    thumb = val.background?.color || '#1a1a2e';
  }
  presets[key] = { label: val.label, desc: val.desc, icon: val.icon, thumb, category: val.category };
});
</script>

<style scoped>
.preset-gallery { height: 100%; display: flex; flex-direction: column; }
.gallery-list { flex: 1; overflow-y: auto; padding: 8px; display: flex; flex-direction: column; gap: 4px; }
.preset-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  position: relative;
}
.preset-card:hover {
  background: rgba(255,255,255,0.04);
  border-color: rgba(255,255,255,0.08);
}
.preset-card.active {
  background: linear-gradient(135deg, rgba(56,189,248,0.08), rgba(139,92,246,0.08));
  border-color: rgba(56,189,248,0.3);
}
.preset-thumb {
  width: 40px;
  height: 40px;
  min-width: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06);
}
.preset-emoji { filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); }
.preset-meta { flex: 1; min-width: 0; }
.preset-name {
  font-size: 12px;
  font-weight: 500;
  color: #e2e8f0;
  line-height: 1.3;
}
.preset-desc {
  font-size: 10px;
  color: #64748b;
  margin-top: 1px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #38bdf8;
  box-shadow: 0 0 6px rgba(56,189,248,0.6);
  flex-shrink: 0;
}
.gallery-list::-webkit-scrollbar { width: 3px; }
.gallery-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
</style>
