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

    <!-- 环境贴图 -->
    <div v-if="!selectedObject" class="panel-section">
      <div class="sec-header"><span><span class="sec-dot env"></span>环境贴图</span></div>
      <div class="btn-row">
        <label class="act-btn accent upload-label">
          上传 HDR
          <input type="file" accept=".hdr" style="display:none" @change="onHDRUpload" />
        </label>
      </div>
      <div class="hdr-tip">推荐从 polyhaven.com 下载免费 HDR 文件</div>
    </div>

    <!-- 后处理效果 -->
    <div v-if="!selectedObject" class="panel-section">
      <div class="sec-header"><span><span class="sec-dot pp"></span>后处理效果</span></div>
      <div class="prop-row">
        <span class="prop-label">启用</span>
        <el-switch v-model="ppEnabled" size="small" @change="onPPToggle" />
      </div>
      <template v-if="ppEnabled">
        <div class="prop-row">
          <span class="prop-label">泛光强度</span>
          <div class="slider-wrap"><el-slider v-model="ppBloom" :min="0" :max="3" :step="0.05" size="small" @change="onPPChange" /></div>
        </div>
        <div class="prop-row">
          <span class="prop-label">泛光阈值</span>
          <div class="slider-wrap"><el-slider v-model="ppThreshold" :min="0" :max="1" :step="0.05" size="small" @change="onPPChange" /></div>
        </div>
        <div class="prop-row">
          <span class="prop-label">泛光半径</span>
          <div class="slider-wrap"><el-slider v-model="ppRadius" :min="0" :max="1" :step="0.05" size="small" @change="onPPChange" /></div>
        </div>
        <div class="prop-row">
          <span class="prop-label">抗锯齿</span>
          <el-switch v-model="ppSMAA" size="small" @change="onPPChange" />
        </div>
      </template>
    </div>

    <!-- 材质列表 -->
    <div v-if="materials.length" class="panel-section">
      <div class="sec-header">
        <span><span class="sec-dot material"></span>材质列表</span>
        <span class="part-count">{{ materials.length }}</span>
      </div>
      <div class="mat-sort-bar">
        <button class="sort-btn" :class="{active: matSort==='name'}" @click="matSort='name'">名称</button>
        <button class="sort-btn" :class="{active: matSort==='type'}" @click="matSort='type'">类型</button>
        <button class="sort-btn" :class="{active: matSort==='count'}" @click="matSort='count'">数量</button>
      </div>
      <div class="mat-list">
        <div v-for="m in sortedMaterials" :key="m.uuid" class="mat-item" :class="{ active: selectedMaterial?.uuid === m.uuid }" @click="$emit('material:select', m)">
          <span class="mat-swatch" :style="{ background: '#' + (m.material.color?.getHexString() || 'ccc') }"></span>
          <span class="mat-label">{{ m.name }}</span>
          <span class="mat-badge" v-if="m.meshes.length > 1">{{ m.meshes.length }}</span>
        </div>
      </div>
    </div>

    <!-- 材质编辑 -->
    <div v-if="selectedMaterial" class="panel-section">
      <div class="sec-header"><span class="sec-dot material"></span><span>材质编辑</span></div>
      <div class="mat-name">{{ selectedMaterial.name }}</div>
      <div class="prop-row">
        <span class="prop-label">颜色</span>
        <el-color-picker v-model="matColor" size="small" @change="onMatProp('color', $event)" />
      </div>
      <div class="prop-row">
        <span class="prop-label">金属度</span>
        <div class="slider-wrap"><el-slider v-model="matMetalness" :min="0" :max="1" :step="0.01" size="small" @change="onMatProp('metalness', $event)" /></div>
      </div>
      <div class="prop-row">
        <span class="prop-label">粗糙度</span>
        <div class="slider-wrap"><el-slider v-model="matRoughness" :min="0" :max="1" :step="0.01" size="small" @change="onMatProp('roughness', $event)" /></div>
      </div>
      <div class="prop-row">
        <span class="prop-label">透明度</span>
        <div class="slider-wrap"><el-slider v-model="matOpacity" :min="0" :max="1" :step="0.05" size="small" @change="onMatProp('opacity', $event)" /></div>
      </div>
      <div class="prop-row">
        <span class="prop-label">线框</span>
        <el-switch v-model="matWireframe" size="small" @change="onMatProp('wireframe', $event)" />
      </div>
      <!-- 预设材质 -->
      <div class="mat-presets-label">预设材质</div>
      <div class="mat-presets">
        <button v-for="p in materialPresets" :key="p.key" class="mat-preset-btn" @click="$emit('material:applyPreset', { material: selectedMaterial.material, preset: p.key })" :title="p.label">
          <span>{{ p.icon }}</span>
          <span>{{ p.label }}</span>
        </button>
      </div>
      <!-- 贴图上传 -->
      <div class="mat-presets-label">自定义贴图</div>
      <div class="btn-row">
        <label class="act-btn upload-label">
          颜色贴图
          <input type="file" accept="image/*" style="display:none" @change="onTextureUpload($event, 'map')" />
        </label>
        <label class="act-btn upload-label">
          法线贴图
          <input type="file" accept="image/*" style="display:none" @change="onTextureUpload($event, 'normalMap')" />
        </label>
      </div>
    </div>

    <!-- 模型分解 -->
    <div v-if="explodeInfo.hasTarget" class="panel-section">
      <div class="sec-header"><span class="sec-dot explode"></span><span>模型分解</span><span class="part-count">{{ explodeInfo.partCount }} 零件</span></div>
      <div class="prop-row">
        <span class="prop-label">分解程度</span>
        <div class="slider-wrap"><el-slider v-model="explodeFactor" :min="0" :max="100" :step="1" size="small" @change="onExplodeChange" /></div>
      </div>
      <div class="btn-row">
        <button class="act-btn" @click="$emit('explode:reset')">组装</button>
        <button class="act-btn accent" @click="$emit('explode:full')">完全分解</button>
      </div>
    </div>

    <!-- 相机路径 -->
    <div class="panel-section">
      <div class="sec-header">
        <span><span class="sec-dot camera"></span>相机路径</span>
        <button class="add-btn" @click="$emit('waypoint:add')">+ 当前视角</button>
      </div>

      <div v-if="waypoints.length" class="wp-list">
        <div v-for="(wp, i) in waypoints" :key="i" class="wp-card">
          <div class="wp-top">
            <span class="wp-idx">{{ i + 1 }}</span>
            <input
              class="wp-name-input"
              :value="wp.name"
              @blur="onWpNameChange(i, $event)"
              @keydown.enter="$event.target.blur()"
            />
            <button class="wp-goto" @click="$emit('waypoint:goto', i)" title="跳转">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="wp-del" @click="$emit('waypoint:remove', i)">×</button>
          </div>
          <div class="wp-config">
            <div class="wp-field">
              <span>速度</span>
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
import { reactive, ref, watch, computed } from 'vue';
const RAD = Math.PI / 180;

const props = defineProps({
  selectedObject: Object,
  sceneConfig: Object,
  waypoints: { type: Array, default: () => [] },
  materials: { type: Array, default: () => [] },
  selectedMaterial: { type: Object, default: null },
  materialPresets: { type: Array, default: () => [] },
  explodeInfo: { type: Object, default: () => ({ hasTarget: false, partCount: 0 }) },
  postProcessing: { type: Object, default: () => ({ enabled: false, bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 }, smaa: true }) },
});

const emit = defineEmits([
  'update:background', 'update:exposure', 'update:grid', 'update:shadows', 'update:fog',
  'focus', 'delete',
  'waypoint:add', 'waypoint:remove', 'waypoint:goto', 'waypoint:play', 'waypoint:autoGenerate', 'waypoint:update',
  'material:select', 'material:prop', 'material:applyPreset', 'material:texture',
  'hdr:upload', 'postProcessing:update',
  'explode:change', 'explode:reset', 'explode:full',
]);

const sceneProps = reactive({ background: '#1a1a2e', exposure: 1.0, showGrid: true, shadows: true, fog: false });
const objPos = reactive({ x: 0, y: 0, z: 0 });
const objRot = reactive({ x: 0, y: 0, z: 0 });
const objScl = reactive({ x: 1, y: 1, z: 1 });

// 材质属性
const matColor = ref('#ffffff');
const matMetalness = ref(0);
const matRoughness = ref(0.5);
const matOpacity = ref(1);
const matWireframe = ref(false);

// 分解
const explodeFactor = ref(0);

// 后处理
const ppEnabled = ref(false);
const ppBloom = ref(0.5);
const ppThreshold = ref(0.85);
const ppRadius = ref(0.4);
const ppSMAA = ref(true);

// 材质排序
const matSort = ref('name');
const sortedMaterials = computed(() => {
  const list = [...props.materials];
  switch (matSort.value) {
    case 'name': return list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    case 'type': return list.sort((a, b) => (a.material?.type || '').localeCompare(b.material?.type || ''));
    case 'count': return list.sort((a, b) => (b.meshes?.length || 0) - (a.meshes?.length || 0));
    default: return list;
  }
});

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

watch(() => props.selectedMaterial, (m) => {
  if (!m?.material) return;
  const mat = m.material;
  matColor.value = '#' + (mat.color?.getHexString() || 'ffffff');
  matMetalness.value = mat.metalness ?? 0;
  matRoughness.value = mat.roughness ?? 0.5;
  matOpacity.value = mat.opacity ?? 1;
  matWireframe.value = mat.wireframe || false;
}, { immediate: true });

watch(() => props.postProcessing, (pp) => {
  if (!pp) return;
  ppEnabled.value = pp.enabled || false;
  ppBloom.value = pp.bloom?.strength ?? 0.5;
  ppThreshold.value = pp.bloom?.threshold ?? 0.85;
  ppRadius.value = pp.bloom?.radius ?? 0.4;
  ppSMAA.value = pp.smaa !== false;
}, { immediate: true, deep: true });

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

function onWpNameChange(index, event) {
  const name = event.target.value.trim();
  if (name) emit('waypoint:update', { index, name });
}

function onMatProp(prop, value) {
  if (!props.selectedMaterial?.material) return;
  emit('material:prop', { material: props.selectedMaterial.material, prop, value });
}

function onTextureUpload(event, mapType) {
  const file = event.target.files?.[0];
  if (!file || !props.selectedMaterial?.material) return;
  emit('material:texture', { material: props.selectedMaterial.material, file, mapType });
  event.target.value = '';
}

function onExplodeChange(val) {
  emit('explode:change', val / 100);
}

function onHDRUpload(event) {
  const file = event.target.files?.[0];
  if (file) emit('hdr:upload', file);
  event.target.value = '';
}

function onPPToggle(val) {
  ppEnabled.value = val;
  onPPChange();
}

function onPPChange() {
  emit('postProcessing:update', {
    enabled: ppEnabled.value,
    bloom: { strength: ppBloom.value, threshold: ppThreshold.value, radius: ppRadius.value },
    smaa: ppSMAA.value,
  });
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
.sec-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.sec-dot.scene { background: #38bdf8; }
.sec-dot.object { background: #a78bfa; }
.sec-dot.camera { background: #34d399; }
.sec-dot.material { background: #f59e0b; }
.sec-dot.explode { background: #f97316; }
.part-count { font-size: 10px; font-weight: 400; color: #64748b; }
.prop-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 4px 0; font-size: 11px; color: #8892a6;
}
.prop-label { min-width: 44px; flex-shrink: 0; }
.slider-wrap { flex: 1; margin-left: 8px; }
.vec-group { margin-bottom: 5px; }
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
  text-align: center;
}
.act-btn:hover { background: rgba(255,255,255,0.06); color: #c8d0e0; }
.act-btn.danger { border-color: rgba(239,68,68,0.2); color: #f87171; }
.act-btn.danger:hover { background: rgba(239,68,68,0.1); }
.act-btn.accent { border-color: rgba(56,189,248,0.3); color: #38bdf8; background: rgba(56,189,248,0.06); }
.act-btn.accent:hover { background: rgba(56,189,248,0.12); }
.upload-label { cursor: pointer; }
.add-btn {
  padding: 2px 8px; border: 1px dashed rgba(52,211,153,0.3); border-radius: 4px;
  background: transparent; color: #34d399; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.add-btn:hover { background: rgba(52,211,153,0.08); }

/* 材质 */
.mat-name { font-size: 11px; color: #94a3b8; margin-bottom: 8px; padding: 3px 6px; background: rgba(255,255,255,0.03); border-radius: 4px; }
.mat-presets-label { font-size: 10px; color: #64748b; margin: 10px 0 6px; font-weight: 500; }
.mat-presets { display: flex; flex-wrap: wrap; gap: 4px; }
.mat-preset-btn {
  padding: 3px 8px; border: 1px solid rgba(255,255,255,0.06); border-radius: 5px;
  background: rgba(255,255,255,0.02); color: #8892a6; font-size: 10px; cursor: pointer;
  display: flex; align-items: center; gap: 3px; transition: all 0.15s;
}
.mat-preset-btn:hover { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.2); color: #e2e8f0; }

/* 相机路径 */
.wp-list { display: flex; flex-direction: column; gap: 6px; max-height: 320px; overflow-y: auto; }
.wp-card {
  border: 1px solid rgba(255,255,255,0.05); border-radius: 6px;
  background: rgba(255,255,255,0.02); overflow: hidden;
}
.wp-top {
  display: flex; align-items: center; gap: 4px; padding: 6px 8px;
}
.wp-idx {
  width: 20px; height: 20px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700; background: rgba(52,211,153,0.12); color: #34d399; flex-shrink: 0;
}
.wp-name-input {
  flex: 1; min-width: 0; border: 1px solid transparent; border-radius: 4px;
  background: transparent; color: #cbd5e1; font-size: 11px; padding: 2px 6px;
  outline: none; transition: all 0.15s;
}
.wp-name-input:hover { background: rgba(255,255,255,0.03); }
.wp-name-input:focus { background: rgba(255,255,255,0.06); border-color: rgba(52,211,153,0.3); }
.wp-goto {
  width: 22px; height: 22px; border: none; border-radius: 4px; background: transparent;
  color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.wp-goto:hover { background: rgba(52,211,153,0.1); color: #34d399; }
.wp-del {
  width: 22px; height: 22px; border: none; border-radius: 4px; background: transparent;
  color: #64748b; font-size: 13px; cursor: pointer; display: flex; align-items: center; justify-content: center;
  transition: all 0.15s; flex-shrink: 0;
}
.wp-del:hover { background: rgba(239,68,68,0.12); color: #f87171; }
.wp-config {
  display: flex; gap: 8px; padding: 6px 8px 8px; border-top: 1px solid rgba(255,255,255,0.03);
}
.wp-field {
  flex: 1; display: flex; align-items: center; gap: 4px; font-size: 10px; color: #64748b;
}
.wp-field :deep(.el-input-number) { width: 68px; }
.wp-field :deep(.el-input__inner) { text-align: center; padding: 0 2px; font-size: 10px; }
.unit { color: #475569; font-size: 9px; }
.wp-actions { display: flex; gap: 6px; margin-top: 10px; }
.empty-wp { font-size: 11px; color: #475569; text-align: center; padding: 12px 0; }

/* 滚动条 */
.property-panel :deep(.el-slider) { padding: 0; }
.property-panel :deep(.el-switch) { --el-switch-on-color: #38bdf8; }
.property-panel::-webkit-scrollbar { width: 3px; }
.property-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }
.wp-list::-webkit-scrollbar { width: 2px; }
.wp-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }

/* 环境贴图 */
.sec-dot.env { background: #06b6d4; }
.sec-dot.pp { background: #e879f9; }
.hdr-tip { font-size: 10px; color: #475569; margin-top: 8px; font-style: italic; }

/* 材质列表 */
.mat-sort-bar { display: flex; gap: 4px; margin-bottom: 8px; }
.sort-btn {
  padding: 2px 8px; border: 1px solid rgba(255,255,255,0.06); border-radius: 4px;
  background: transparent; color: #64748b; font-size: 10px; cursor: pointer; transition: all 0.15s;
}
.sort-btn:hover { background: rgba(255,255,255,0.04); color: #94a3b8; }
.sort-btn.active { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.2); color: #f59e0b; }
.mat-list { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; }
.mat-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; border-radius: 5px;
  cursor: pointer; transition: all 0.15s;
  font-size: 11px; color: #94a3b8;
}
.mat-item:hover { background: rgba(255,255,255,0.04); }
.mat-item.active {
  background: linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04));
  color: #e2e8f0;
}
.mat-swatch {
  width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.1);
  box-shadow: inset 0 1px 2px rgba(0,0,0,0.3);
}
.mat-label { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.mat-badge {
  font-size: 9px; padding: 0 4px; background: rgba(255,255,255,0.06);
  border-radius: 6px; color: #64748b;
}
.mat-list::-webkit-scrollbar { width: 2px; }
.mat-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 2px; }
</style>
