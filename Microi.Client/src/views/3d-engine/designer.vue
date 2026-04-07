<template>
  <div class="engine-designer">
    <Toolbar
      :transformMode="transformMode"
      @transform="setTransformMode"
      @camera="setCameraView"
      @autoSetup="autoSetup"
      @screenshot="takeScreenshot"
      @import="triggerImport"
    />

    <div class="engine-body">
      <!-- 左面板（合并了预设+场景+材质） -->
      <div class="left-panel">
        <div class="lp-scroll">
          <!-- 场景预设 -->
          <div class="lp-section">
            <div class="lp-title">场景预设</div>
            <PresetGallery :currentPreset="currentPreset" @select="applyPreset" />
          </div>

          <!-- 场景对象 -->
          <div class="lp-section">
            <div class="lp-title">场景对象</div>
            <SceneTree :objects="objects" :lights="lights" :selectedObject="selectedObject" @select="selectObject" />
          </div>


        </div>
      </div>

      <!-- 视口 -->
      <div class="center-viewport">
        <Viewport
          ref="viewportRef"
          :showPlaybar="waypoints.length >= 2"
          :isPlaying="isPlaying"
          :isPaused="isPaused"
          :currentIndex="currentWpIndex"
          :waypointCount="waypoints.length"
          @drop="handleFileDrop"
          @playback:play="togglePlay"
          @playback:stop="stopPath"
        />
      </div>

      <!-- 右面板 -->
      <div class="right-panel">
        <PropertyPanel
          :selectedObject="selectedObject"
          :sceneConfig="sceneConfig"
          :waypoints="waypoints"
          :materials="materials"
          :selectedMaterial="selectedMaterial"
          :materialPresets="materialPresets"
          :explodeInfo="explodeInfo"
          :postProcessing="postProcessingConfig"
          @update:background="updateBackground"
          @update:exposure="updateExposure"
          @update:grid="updateGrid"
          @update:shadows="updateShadows"
          @update:fog="updateFog"
          @focus="focusSelected"
          @delete="deleteSelected"
          @waypoint:add="addWaypoint"
          @waypoint:remove="removeWaypoint"
          @waypoint:goto="gotoWaypoint"
          @waypoint:play="togglePlay"
          @waypoint:update="updateWaypoint"
          @waypoint:autoGenerate="autoGenerateWaypoints"
          @material:select="selectMaterial"
          @material:prop="onMaterialProp"
          @material:applyPreset="onMaterialPreset"
          @material:texture="onMaterialTexture"
          @hdr:upload="handleHDRUpload"
          @postProcessing:update="onPostProcessingUpdate"
          @explode:change="onExplodeChange"
          @explode:reset="onExplodeReset"
          @explode:full="onExplodeFull"
        />
      </div>
    </div>

    <input ref="fileInput" type="file" accept=".glb,.gltf" style="display:none" @change="handleFileInput" />
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Engine } from './core/Engine';
import Toolbar from './components/Toolbar.vue';
import SceneTree from './components/SceneTree.vue';
import PresetGallery from './components/PresetGallery.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import Viewport from './components/Viewport.vue';

let engine = null;
const viewportRef = ref(null);
const fileInput = ref(null);

const objects = ref([]);
const lights = ref([]);
const selectedObject = ref(null);
const currentPreset = ref('');
const transformMode = ref('translate');
const isPlaying = ref(false);
const isPaused = ref(false);
const currentWpIndex = ref(0);
const waypoints = ref([]);
const materials = ref([]);
const selectedMaterial = ref(null);
const materialPresets = ref([]);

const explodeInfo = ref({ hasTarget: false, partCount: 0 });

const sceneConfig = reactive({ background: '#1a1a2e', exposure: 1.0, showGrid: true, shadows: true, fog: false });
const postProcessingConfig = reactive({ enabled: false, bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 }, smaa: true });

onMounted(async () => {
  await nextTick();
  const container = viewportRef.value?.canvasRef;
  if (!container) return;
  engine = new Engine(container);
  engine.applyPreset('outdoor');
  currentPreset.value = 'outdoor';
  materialPresets.value = engine.materialManager.getPresets();
  bindEvents();
});
onBeforeUnmount(() => { if (engine) { engine.dispose(); engine = null; } });

function bindEvents() {
  engine.on('sceneChanged', syncScene);
  engine.on('selectionChanged', (obj) => { selectedObject.value = obj; });
  engine.on('presetChanged', (name) => { currentPreset.value = name; });
  engine.on('loadStart', () => { viewportRef.value?.setLoading(true); });
  engine.on('loadEnd', () => { viewportRef.value?.setLoading(false); syncScene(); });
  engine.on('loadError', (err) => { viewportRef.value?.setLoading(false); ElMessage.error('加载失败: ' + (err?.message || '')); });
  engine.on('materialsChanged', (list) => {
    materials.value = list || [];
    selectedMaterial.value = null;
  });
  engine.cameraPath.on('start', () => { isPlaying.value = true; isPaused.value = false; });
  engine.cameraPath.on('stop', () => { isPlaying.value = false; isPaused.value = false; currentWpIndex.value = 0; });
  engine.cameraPath.on('stateChanged', (s) => { isPlaying.value = s.playing; isPaused.value = s.paused; });
  engine.cameraPath.on('waypointReached', (i) => { currentWpIndex.value = i; });
  engine.cameraPath.on('waypointsChanged', () => { waypoints.value = [...engine.cameraPath.waypoints]; });
}

function syncScene() {
  if (!engine) return;
  objects.value = [...engine.objects];
  lights.value = [...engine.lights];
  explodeInfo.value = {
    hasTarget: engine?.modelExploder?.hasTarget || false,
    partCount: engine?.modelExploder?.partCount || 0,
  };
}

// 导入
function triggerImport() { fileInput.value?.click(); }
function handleFileInput(e) { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }
function handleFileDrop(f) { loadFile(f); }
async function loadFile(file) { if (!engine) return; try { await engine.loadModel(file); } catch (e) {} }

// 工具栏
function setTransformMode(m) { transformMode.value = m; engine?.setTransformMode(m); }
function setCameraView(v) { engine?.setCameraView(v); }
function autoSetup() { engine?.autoSetup(); syncScene(); }
function takeScreenshot() {
  if (!engine) return;
  const url = engine.takeScreenshot();
  const a = document.createElement('a'); a.href = url; a.download = '3d-scene.png'; a.click();
}

// 场景属性
function updateBackground(c) { engine?.setBackground(c); }
function updateExposure(v) { engine?.setExposure(v); }
function updateGrid(v) { engine?.setGridVisible(v); }
function updateShadows(v) { engine?.setShadowsEnabled(v); }
function updateFog(v) { engine?.setFog(v); }

// 选择
function selectObject(obj) { engine?.selectObject(obj); }
function focusSelected() { if (selectedObject.value) engine?.focusObject(selectedObject.value); }
function deleteSelected() { if (selectedObject.value) engine?.removeObject(selectedObject.value); selectedObject.value = null; }
function applyPreset(name) { engine?.applyPreset(name); syncScene(); }

// 材质
function selectMaterial(m) { selectedMaterial.value = selectedMaterial.value?.uuid === m.uuid ? null : m; }
function onMaterialProp({ material, prop, value }) { engine?.materialManager.setProperty(material, prop, value); }
function onMaterialPreset({ material, preset }) {
  engine?.materialManager.applyPreset(material, preset);
  // 触发材质UI刷新
  selectedMaterial.value = { ...selectedMaterial.value };
}
async function onMaterialTexture({ material, file, mapType }) {
  try {
    await engine?.materialManager.applyTextureFromFile(material, file, mapType);
    ElMessage.success('贴图已应用');
  } catch (e) {
    ElMessage.error('贴图加载失败');
  }
}

// HDR 环境贴图
async function handleHDRUpload(file) {
  if (!engine) return;
  try {
    viewportRef.value?.setLoading(true);
    await engine.loadHDR(file);
    ElMessage.success('HDR 环境贴图已应用');
  } catch (e) {
    ElMessage.error('HDR 加载失败');
  } finally {
    viewportRef.value?.setLoading(false);
  }
}

// 后处理
function onPostProcessingUpdate(config) {
  Object.assign(postProcessingConfig, config);
  engine?.setPostProcessing(config);
}

// 模型分解
function onExplodeChange(factor) { engine?.modelExploder.setFactor(factor); }
function onExplodeReset() { engine?.modelExploder.animateTo(0); }
function onExplodeFull() { engine?.modelExploder.animateTo(1); }

// 相机路径
function addWaypoint() { engine?.cameraPath.addWaypoint(); waypoints.value = [...engine.cameraPath.waypoints]; }
function removeWaypoint(i) { engine?.cameraPath.removeWaypoint(i); waypoints.value = [...engine.cameraPath.waypoints]; }
function gotoWaypoint(i) { engine?.cameraPath.goToWaypoint(i); }
function updateWaypoint(data) { engine?.cameraPath.updateWaypoint(data.index, data); waypoints.value = [...engine.cameraPath.waypoints]; }
function togglePlay() {
  if (!engine) return;
  if (isPlaying.value && !isPaused.value) { engine.cameraPath.pause(); }
  else if (isPlaying.value && isPaused.value) { engine.cameraPath.resume(); }
  else { engine.cameraPath.play(); }
}
function stopPath() { engine?.cameraPath.stop(); }
function autoGenerateWaypoints() {
  engine?.cameraPath.autoGenerate(6);
  waypoints.value = [...engine.cameraPath.waypoints];
  ElMessage.success('已自动生成 6 个路径点');
}

// 快捷键
function onKeyDown(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  switch (e.key.toLowerCase()) {
    case 'w': setTransformMode('translate'); break;
    case 'e': setTransformMode('rotate'); break;
    case 'r': setTransformMode('scale'); break;
    case 'delete': case 'backspace': deleteSelected(); break;
    case 'f': focusSelected(); break;
    case ' ': e.preventDefault(); togglePlay(); break;
  }
}
onMounted(() => document.addEventListener('keydown', onKeyDown));
onBeforeUnmount(() => document.removeEventListener('keydown', onKeyDown));
</script>

<style scoped>
.engine-designer {
  width: 100%;
  height: calc(100vh - 84px);
  display: flex;
  flex-direction: column;
  background: #0a0a18;
  color: #cbd5e1;
  overflow: hidden;
}
.engine-body { flex: 1; display: flex; overflow: hidden; }

/* === 左面板（合并） === */
.left-panel {
  width: 230px;
  min-width: 230px;
  background: linear-gradient(180deg, rgba(14,14,30,0.98), rgba(10,10,22,0.99));
  border-right: 1px solid rgba(56,189,248,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.lp-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.lp-scroll::-webkit-scrollbar { width: 3px; }
.lp-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 3px; }

.lp-section {
  border-bottom: 1px solid rgba(255,255,255,0.04);
}
.lp-title {
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 10px 12px 4px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.lp-count {
  font-size: 9px;
  padding: 0 5px;
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
  border-radius: 8px;
}



/* === 中间视口 === */
.center-viewport { flex: 1; overflow: hidden; position: relative; }

/* === 右面板 === */
.right-panel {
  width: 280px;
  min-width: 280px;
  background: linear-gradient(180deg, rgba(14,14,30,0.98), rgba(10,10,22,0.99));
  border-left: 1px solid rgba(56,189,248,0.06);
  overflow: hidden;
}
</style>
