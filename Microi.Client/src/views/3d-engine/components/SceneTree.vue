<template>
  <div class="scene-tree">
    <div class="tree-content">
      <!-- 模型 -->
      <div class="tree-group" v-if="objects.length">
        <div class="group-title"><span class="group-dot model"></span>模型 <span class="group-count">{{ objects.length }}</span></div>
        <div
          v-for="obj in objects" :key="obj.uuid"
          class="tree-item"
          :class="{ selected: selectedObject === obj }"
          @click="$emit('select', obj)"
        >
          <span class="item-icon">📦</span>
          <span class="item-name">{{ obj.userData?.name || '未命名' }}</span>
        </div>
      </div>

      <!-- 灯光 -->
      <div class="tree-group" v-if="lights.length">
        <div class="group-title"><span class="group-dot light"></span>灯光 <span class="group-count">{{ lights.length }}</span></div>
        <div
          v-for="light in lights" :key="light.uuid"
          class="tree-item"
          @click="$emit('selectLight', light)"
        >
          <span class="item-icon">💡</span>
          <span class="item-name">{{ light.userData?.name || light.userData?.lightType }}</span>
        </div>
      </div>

      <div v-if="objects.length === 0 && lights.length === 0" class="empty-state">
        <div class="empty-icon">📦</div>
        <div>拖放或导入 glTF 模型</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({ objects: { type: Array, default: () => [] }, lights: { type: Array, default: () => [] }, selectedObject: Object });
defineEmits(['select', 'selectLight']);
</script>

<style scoped>
.scene-tree { height: 100%; display: flex; flex-direction: column; }
.tree-content { flex: 1; overflow-y: auto; padding: 8px; }
.tree-group { margin-bottom: 6px; }
.group-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 4px 8px;
}
.group-dot { width: 6px; height: 6px; border-radius: 50%; }
.group-dot.model { background: #38bdf8; box-shadow: 0 0 6px rgba(56,189,248,0.4); }
.group-dot.light { background: #fbbf24; box-shadow: 0 0 6px rgba(251,191,36,0.4); }
.group-count { color: #475569; margin-left: 2px; }
.tree-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px 5px 20px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  color: #94a3b8;
}
.tree-item:hover { background: rgba(255,255,255,0.04); color: #cbd5e1; }
.tree-item.selected {
  background: linear-gradient(135deg, rgba(56,189,248,0.1), rgba(139,92,246,0.08));
  color: #e2e8f0;
}
.item-icon { font-size: 11px; }
.item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 32px 16px;
  font-size: 12px;
  color: #475569;
}
.empty-icon { font-size: 28px; opacity: 0.5; }
.tree-content::-webkit-scrollbar { width: 3px; }
.tree-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
</style>
