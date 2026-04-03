<template>
  <div class="property-panel">
    <!-- 场景属性 -->
    <div v-if="!selectedObject" class="panel-section">
      <div class="sec-header"><span class="sec-dot scene"></span><span>场景</span></div>
      <div class="prop-row">
        <span class="prop-label">背景色</span>
        <el-color-picker v-model="sceneProps.background" size="small" @change="$emit('update:background', $event)" />
      </div>
      <div class="prop-row">
        <span class="prop-label">曝光度</span>
        <div class="slider-wrap"><el-slider v-model="sceneProps.exposure" :min="0.1" :max="3" :step="0.1" size="small" @change="$emit('update:exposure', $event)" /></div>
      </div>
      <div class="prop-row">
        <span class="prop-label">网格</span>
        <el-switch v-model="sceneProps.showGrid" size="small" @change="$emit('update:grid', $event)" />
      </div>
      <div class="prop-row">
        <span class="prop-label">阴影</span>
        <el-switch v-model="sceneProps.shadows" size="small" @change="$emit('update:shadows', $event)" />
      </div>
      <div class="prop-row">
        <span class="prop-label">雾效</span>
        <el-switch v-model="sceneProps.fog" size="small" @change="$emit('update:fog', $event)" />
      </div>
    </div>

    <!-- 对象属性 -->
    <div v-if="selectedObject" class="panel-section">
      <div class="sec-header"><span class="sec-dot object"></span><span>{{ selectedObject.userData?.name || '对象' }}</span></div>
      <div class="vec-group">
        <div class="vec-label">位置</div>
        <div class="vec3-row">
          <div class="vi"><span class="vl x">X</span><el-input-number v-model="objPos.x" :step="0.1" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl y">Y</span><el-input-number v-model="objPos.y" :step="0.1" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl z">Z</span><el-input-number v-model="objPos.z" :step="0.1" :controls="false" size="small" @change="updateTransform" /></div>
        </div>
      </div>
      <div class="vec-group">
        <div class="vec-label">旋转 °</div>
        <div class="vec3-row">
          <div class="vi"><span class="vl x">X</span><el-input-number v-model="objRot.x" :step="1" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl y">Y</span><el-input-number v-model="objRot.y" :step="1" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl z">Z</span><el-input-number v-model="objRot.z" :step="1" :controls="false" size="small" @change="updateTransform" /></div>
        </div>
      </div>
      <div class="vec-group">
        <div class="vec-label">缩放</div>
        <div class="vec3-row">
          <div class="vi"><span class="vl x">X</span><el-input-number v-model="objScl.x" :step="0.1" :min="0.01" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl y">Y</span><el-input-number v-model="objScl.y" :step="0.1" :min="0.01" :controls="false" size="small" @change="updateTransform" /></div>
          <div class="vi"><span class="vl z">Z</span><el-input-number v-model="objScl.z" :step="0.1" :min="0.01" :controls="false" size="small" @change="updateTransform" /></div>
        </div>
      </div>
      <div class="btn-row">
        <button class="act-btn" @click="$emit('focus')">聚焦</button>
        <button class="act-btn danger" @click="$emit('delete')">删除</button>
      </div>
    </div>

    <!-- 相机路径 -->
    <div class="panel-section">
      <div class="sec-header">
        <span><span class="sec-dot camera"></span>相机路径</span>
        <button class="add-btn" @click="$emit('waypoint:add')">+ 添加当前视角</button>
      </div>

      <div v-if="waypoints.length" class="wp-list">
        <div v-for="(wp, i) in waypoints" :key="i" class="wp-card">
          <div class="wp-top" @click="$emit('waypoint:goto', i)">
            <span class="wp-idx">{{ i + 1 }}</span>
            <span class="wp-name">{{ wp.name }}</span>
            <button class="wp-del" @click.stop="$emit('waypoint:remove', i)">×</button>
          </div>
          <div class="wp-config">
            <div class="wp-field">
              <span>移动</span>
              <el-input-number v-model="wp.speed" :min="200" :max="10000" :step="200" :controls="false" size="small" @change="onWpUpdate(i, 'speed', $event)" />
              <span class="unit">ms</span>
            </div>
            <div class="wp-field">
              <span>停留</span>
              <el-input-number v-model="wp.stayDuration" :min="0" :max="30000" :step="500" :controls="false" size="small" @change="onWpUpdate(i, 'stayDuration', $event)" />
              <span class="unit">ms</span>
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty-wp">暂无点位，点击上方按钮或自动生成</div>

      <div class="wp-actions">
        <button class="act-btn" @click="$emit('waypoint:autoGenerate')">自动生成</button>
        <button v-if="waypoints.length >= 2" class="act-btn accent" @click="$emit('waypoint:play')">▶ 播放</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, watch } from 'vue';
const RAD = Math.PI / 180;

const props = defineProps({
  selectedObject: Object,
  sceneConfig: Object,
  waypoints: { type: Array, default: () => [] },
});

const emit = defineEmits([
  'update:background', 'update:exposure', 'update:grid', 'update:shadows', 'update:fog',
  'focus', 'delete',
  'waypoint:add', 'waypoint:remove', 'waypoint:goto', 'waypoint:play', 'waypoint:autoGenerate', 'waypoint:update',
]);

const sceneProps = reactive({ background: '#1a1a2e', exposure: 1.0, showGrid: true, shadows: true, fog: false });
const objPos = reactive({ x: 0, y: 0, z: 0 });
const objRot = reactive({ x: 0, y: 0, z: 0 });
const objScl = reactive({ x: 1, y: 1, z: 1 });

watch(() => props.sceneConfig, (c) => { if (c) Object.assign(sceneProps, c); }, { immediate: true, deep: true });
watch(() => props.selectedObject, (obj) => {
  if (!obj) return;
  objPos.x = Math.round(obj.position.x * 100) / 100;
  objPos.y = Math.round(obj.position.y * 100) / 100;
  objPos.z = Math.round(obj.position.z * 100) / 100;
  objRot.x = Math.round(obj.rotation.x / RAD * 10) / 10;
  objRot.y = Math.round(obj.rotation.y / RAD * 10) / 10;
  objRot.z = Math.round(obj.rotation.z / RAD * 10) / 10;
  objScl.x = Math.round(obj.scale.x * 100) / 100;
  objScl.y = Math.round(obj.scale.y * 100) / 100;
  objScl.z = Math.round(obj.scale.z * 100) / 100;
}, { immediate: true });

function updateTransform() {
  const obj = props.selectedObject;
  if (!obj) return;
  obj.position.set(objPos.x, objPos.y, objPos.z);
  obj.rotation.set(objRot.x * RAD, objRot.y * RAD, objRot.z * RAD);
  obj.scale.set(objScl.x, objScl.y, objScl.z);
}

function onWpUpdate(index, field, value) {
  emit('waypoint:update', { index, [field]: value });
}
</script>

<style scoped>
.property-panel { height: 100%; overflow-y: auto; }
.panel-section { padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); }
.sec-header {
  display: flex; align-items: center; justify-content: space-between; gap: 6px;
  font-size: 12px; font-weight: 600; color: #c8d0e0; margin-bottom: 12px;
}
.sec-header > span { display: flex; align-items: center; gap: 6px; }
.sec-dot { width: 6px; height: 6px; border-radius: 50%; }
.sec-dot.scene { background: #38bdf8; }
.sec-dot.object { background: #a78bfa; }
.sec-dot.camera { background: #34d399; }
.prop-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0; font-size: 11px; color: #8892a6;
}
.prop-label { min-width: 44px; }
.slider-wrap { flex: 1; margin-left: 8px; }
.vec-group { margin-bottom: 10px; }
.vec-label { font-size: 10px; color: #64748b; margin-bottom: 4px; font-weight: 500; }
.vec3-row { display: flex; gap: 4px; }
.vi { flex: 1; display: flex; align-items: center; gap: 2px; }
.vl { font-size: 9px; font-weight: 700; width: 12px; text-align: center; flex-shrink: 0; }
.vl.x { color: #ef4444; } .vl.y { color: #22c55e; } .vl.z { color: #3b82f6; }
.vi :deep(.el-input-number) { width: 100%; }
.vi :deep(.el-input__inner) { text-align: center; padding: 0 3px; font-size: 11px; }
.btn-row { display: flex; gap: 6px; margin-top: 10px; }
.act-btn {
  flex: 1; padding: 5px 0; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;
  background: rgba(255,255,255,0.03); color: #8892a6; font-size: 11px; cursor: pointer; transition: all 0.15s;
}
.act-btn:hover { background: rgba(255,255,255,0.06); color: #c8d0e0; }
.act-btn.danger { border-color: rgba(239,68,68,0.2); color: #f87171; }
.act-btn.danger:hover { background: rgba(239,68,68,0.1); }
.act-btn.accent { border-color: rgba(56,189,248,0.3); color: #38bdf8; background: rgba(56,189,248,0.06); }
.act-btn.accent:hover { background: rgba(56,189,248,0.12); }
.add-btn {
  padding: 2px 8px; border: 1px dashed rgba(52,211,153,0.3); border-radius: 4px;
  background: transparent; color: #34d399; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.add-btn:hover { background: rgba(52,211,153,0.08); }
.wp-list { display: flex; flex-direction: column; gap: 6px; max-height: 260px; overflow-y: auto; }
.wp-card {
  border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;
  background: rgba(255,255,255,0.02); overflow: hidden;
}
.wp-top {
  display: flex; align-items: center; gap: 6px; padding: 5px 8px; cursor: pointer;
  transition: background 0.15s;
}
.wp-top:hover { background: rgba(255,255,255,0.03); }
.wp-idx {
  width: 18px; height: 18px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; background: rgba(52,211,153,0.12); color: #34d399; flex-shrink: 0;
}
.wp-name { flex: 1; font-size: 11px; color: #94a3b8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wp-del {
  width: 18px; height: 18px; border: none; border-radius: 4px; background: transparent;
  color: #64748b; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.wp-del:hover { background: rgba(239,68,68,0.12); color: #f87171; }
.wp-config {
  display: flex; gap: 6px; padding: 4px 8px 6px; border-top: 1px solid rgba(255,255,255,0.03);
}
.wp-field {
  flex: 1; display: flex; align-items: center; gap: 3px; font-size: 10px; color: #64748b;
}
.wp-field :deep(.el-input-number) { width: 60px; }
.wp-field :deep(.el-input__inner) { text-align: center; padding: 0 2px; font-size: 10px; }
.unit { color: #475569; font-size: 9px; }
.wp-actions { display: flex; gap: 6px; margin-top: 10px; }
.empty-wp { font-size: 11px; color: #475569; text-align: center; padding: 12px 0; }
.property-panel :deep(.el-slider) { padding: 0; }
.property-panel :deep(.el-switch) { --el-switch-on-color: #38bdf8; }
.property-panel::-webkit-scrollbar { width: 3px; }
.property-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
.wp-list::-webkit-scrollbar { width: 2px; }
.wp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
</style>
