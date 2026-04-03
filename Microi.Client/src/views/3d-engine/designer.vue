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
      <!-- 左面板 -->
      <div class="left-panel">
        <div class="panel-tabs">
          <button class="ptab" :class="{ active: leftTab==='scene' }" @click="leftTab='scene'">场景</button>
          <button class="ptab" :class="{ active: leftTab==='preset' }" @click="leftTab='preset'">预设</button>
        </div>
        <div class="panel-body">
          <SceneTree v-show="leftTab==='scene'" :objects="objects" :lights="lights" :selectedObject="selectedObject" @select="selectObject" />
          <PresetGallery v-show="leftTab==='preset'" :currentPreset="currentPreset" @select="applyPreset" />
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
const leftTab = ref('preset');

const objects = ref([]);
const lights = ref([]);
const selectedObject = ref(null);
const currentPreset = ref('');
const transformMode = ref('translate');
const isPlaying = ref(false);
const isPaused = ref(false);
const currentWpIndex = ref(0);
const waypoints = ref([]);

const sceneConfig = reactive({ background: '#1a1a2e', exposure: 1.0, showGrid: true, shadows: true, fog: false });

onMounted(async () => {
  await nextTick();
  const container = viewportRef.value?.canvasRef;
  if (!container) return;
  engine = new Engine(container);
  engine.applyPreset('outdoor');
  currentPreset.value = 'outdoor';
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

/* === 左面板 === */
.left-panel {
  width: 220px;
  min-width: 220px;
  background: linear-gradient(180deg, rgba(14,14,30,0.98), rgba(10,10,22,0.99));
  border-right: 1px solid rgba(56,189,248,0.06);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.panel-tabs {
  display: flex;
  padding: 6px 6px 0;
  gap: 2px;
  flex-shrink: 0;
}
.ptab {
  flex: 1;
  padding: 6px 0;
  border: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: #475569;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}
.ptab:hover { color: #94a3b8; }
.ptab.active {
  color: #e2e8f0;
  background: rgba(255,255,255,0.03);
}
.ptab.active::after {
  content: '';
  position: absolute; bottom: 0; left: 20%; right: 20%;
  height: 2px;
  background: linear-gradient(90deg, #38bdf8, #8b5cf6);
  border-radius: 2px;
}
.panel-body { flex: 1; overflow: hidden; }

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
