/**
 * Microi 3D Engine V3 - 基于 Three.js 的 3D 渲染引擎
 * 新增：云层、材质管理、模型分解、相机视角修正
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { Sky } from 'three/examples/jsm/objects/Sky';
import { PRESETS } from './Presets';
import { ModelLoader } from './ModelLoader';
import { CameraPath } from './CameraPath';
import { MaterialManager } from './MaterialManager';
import { ModelExploder } from './ModelExploder';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass';

export class Engine {
  constructor(container, options = {}) {
    this.container = container;
    this.objects = [];
    this.lights = [];
    this.selectedObject = null;
    this.ground = null;
    this.sky = null;
    this.cloudLayer = null;
    this.envMap = null;
    this.animationId = null;
    this.isDisposed = false;
    this.currentPreset = null;
    this.modelLoader = new ModelLoader();
    this.cameraPath = new CameraPath(this);
    this.materialManager = new MaterialManager(this);
    this.modelExploder = new ModelExploder();
    this._callbacks = {};
    this._materialList = []; // 当前场景中所有材质
    this._postProcessing = { enabled: false, bloom: { strength: 0.5, radius: 0.4, threshold: 0.85 }, smaa: true };
    this._hdrLoader = new RGBELoader();
    this.composer = null;
    this._hdrTexture = null;

    this._initRenderer();
    this._initScene();
    this._initCamera(options);
    this._initControls(options);
    this._initRaycaster();
    this._initResizeObserver();
    this._initPostProcessing();
    this._startLoop();
  }

  // === 事件系统 ===
  on(event, cb) { (this._callbacks[event] || (this._callbacks[event] = [])).push(cb); }
  off(event, cb) { if (this._callbacks[event]) this._callbacks[event] = this._callbacks[event].filter(c => c !== cb); }
  _emit(event, data) { (this._callbacks[event] || []).forEach(cb => cb(data)); }

  // === 初始化 ===
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a1a2e);
    this.gridHelper = new THREE.GridHelper(30, 30, 0x444466, 0x333344);
    this.gridHelper.material.opacity = 0.25;
    this.gridHelper.material.transparent = true;
    this.scene.add(this.gridHelper);
  }

  _initCamera(options) {
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(options.fov || 50, aspect, 0.1, 2000);
    this.camera.position.set(8, 5, 8);
    this.camera.lookAt(0, 0, 0);
  }

  _initControls(options) {
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.08;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance = 0.5;
    this.orbitControls.maxDistance = 500;
    this.orbitControls.maxPolarAngle = Math.PI * 0.95;
    this.orbitControls.target.set(0, 0, 0);

    if (!options.readonly) {
      this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
      this.transformControls.addEventListener('dragging-changed', e => {
        this.orbitControls.enabled = !e.value;
      });
      this.transformControls.addEventListener('objectChange', () => {
        this._emit('objectChanged', this.selectedObject);
      });
      this.scene.add(this.transformControls);
    }
  }

  _initRaycaster() {
    this._raycaster = new THREE.Raycaster();
    this._mouse = new THREE.Vector2();
    this._onPointerDown = (e) => { if (e.button === 0) this._pointerDownPos = { x: e.clientX, y: e.clientY }; };
    this._onPointerUp = (e) => {
      if (e.button !== 0 || !this._pointerDownPos) return;
      const dx = e.clientX - this._pointerDownPos.x;
      const dy = e.clientY - this._pointerDownPos.y;
      if (Math.sqrt(dx * dx + dy * dy) > 3) return;
      this._handleClick(e);
    };
    this.renderer.domElement.addEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this._onPointerUp);
  }

  _handleClick(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this._raycaster.setFromCamera(this._mouse, this.camera);
    const meshes = [];
    this.objects.forEach(obj => obj.traverse(c => { if (c.isMesh) meshes.push(c); }));
    const intersects = this._raycaster.intersectObjects(meshes, false);
    if (intersects.length > 0) {
      let target = intersects[0].object;
      while (target.parent && !this.objects.includes(target)) target = target.parent;
      this.selectObject(target);
    } else {
      this.selectObject(null);
    }
  }

  _initResizeObserver() {
    this._resizeObserver = new ResizeObserver(() => {
      if (this.isDisposed) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      if (this.composer) this.composer.setSize(w, h);
    });
    this._resizeObserver.observe(this.container);
  }

  _startLoop() {
    const animate = () => {
      if (this.isDisposed) return;
      this.animationId = requestAnimationFrame(animate);
      this.orbitControls.update();
      if (this._postProcessing.enabled && this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    };
    animate();
  }

  _initPostProcessing() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.composer = new EffectComposer(this.renderer);
    this._renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this._renderPass);
    this._bloomPass = new UnrealBloomPass(
      new THREE.Vector2(w, h),
      this._postProcessing.bloom.strength,
      this._postProcessing.bloom.radius,
      this._postProcessing.bloom.threshold
    );
    this.composer.addPass(this._bloomPass);
    this._smaaPass = new SMAAPass(w, h);
    this.composer.addPass(this._smaaPass);
    this._outputPass = new OutputPass();
    this.composer.addPass(this._outputPass);
  }

  // === 模型 ===
  async loadModel(fileOrUrl, options = {}) {
    this._emit('loadStart', null);
    try {
      const model = typeof fileOrUrl === 'string'
        ? await this.modelLoader.loadFromUrl(fileOrUrl)
        : await this.modelLoader.loadFromFile(fileOrUrl);

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.position.y -= box.min.y - center.y;

      if (options.normalize !== false) {
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 20) {
          const scale = 10 / maxDim;
          model.scale.multiplyScalar(scale);
        }
      }

      model.traverse(child => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
      });

      model.userData.type = 'model';
      model.userData.name = options.name || model.name || `模型_${this.objects.length + 1}`;
      this.scene.add(model);
      this.objects.push(model);

      // 提取材质
      this._refreshMaterialList();

      // 分析模型分解
      this.modelExploder.analyze(model);

      if (options.autoSetup !== false) this.focusObject(model);
      this._emit('loadEnd', model);
      this._emit('sceneChanged', null);
      this._emit('materialsChanged', this._materialList);
      return model;
    } catch (err) {
      this._emit('loadError', err);
      throw err;
    }
  }

  /** 刷新全场景材质列表 */
  _refreshMaterialList() {
    const allMats = [];
    const seen = new Set();
    this.objects.forEach(obj => {
      const mats = this.materialManager.extractMaterials(obj);
      mats.forEach(m => {
        if (!seen.has(m.uuid)) {
          seen.add(m.uuid);
          allMats.push(m);
        }
      });
    });
    this._materialList = allMats;
  }

  getMaterialList() { return this._materialList; }

  removeObject(obj) {
    if (!obj) return;
    if (this.selectedObject === obj) this.selectObject(null);
    const idx = this.objects.indexOf(obj);
    if (idx !== -1) this.objects.splice(idx, 1);
    this.scene.remove(obj);
    this._disposeObject(obj);
    this._refreshMaterialList();
    this._emit('sceneChanged', null);
    this._emit('materialsChanged', this._materialList);
  }

  selectObject(obj) {
    if (this.selectedObject && this.selectedObject !== obj) this._setOutline(this.selectedObject, false);
    this.selectedObject = obj;
    if (obj && this.transformControls) {
      this.transformControls.attach(obj);
      this._setOutline(obj, true);
    } else if (this.transformControls) {
      this.transformControls.detach();
    }
    this._emit('selectionChanged', obj);
  }

  _setOutline(obj, on) {
    if (!obj) return;
    obj.traverse(c => {
      if (c.isMesh && c.material) {
        (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => {
          if (m.emissive) m.emissive.setHex(on ? 0x1a1a3a : 0x000000);
        });
      }
    });
  }

  focusObject(obj) {
    if (!obj) return;
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2.5;
    this._animateCamera(
      new THREE.Vector3(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.6),
      center
    );
  }

  _animateCamera(position, target) {
    const startPos = this.camera.position.clone();
    const startTarget = this.orbitControls.target.clone();
    const duration = 600;
    const startTime = performance.now();
    const step = () => {
      if (this.isDisposed) return;
      const t = Math.min((performance.now() - startTime) / duration, 1);
      const ease = t * t * (3 - 2 * t);
      this.camera.position.lerpVectors(startPos, position, ease);
      this.orbitControls.target.lerpVectors(startTarget, target, ease);
      this.orbitControls.update();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // === 预设系统 ===
  applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;
    this.currentPreset = presetName;
    this.clearLights();

    // 清理旧天空、云层、环境
    if (this.sky) { this.scene.remove(this.sky); this.sky = null; }
    if (this.cloudLayer) { this.scene.remove(this.cloudLayer); this._disposeObject(this.cloudLayer); this.cloudLayer = null; }
    if (this.envMap) { this.envMap.dispose(); this.envMap = null; }
    this.scene.environment = null;

    // === 背景 ===
    if (this.scene.background && this.scene.background.isTexture) this.scene.background.dispose();
    if (preset.background.type === 'sky') {
      this._createSky(preset.skyParams, true);
      // 天空类预设加云层
      if (preset.clouds !== false) {
        this._createCloudLayer(preset.skyParams);
      }
    } else if (preset.background.type === 'gradient') {
      this.scene.background = this._createGradientTexture(preset.background.topColor, preset.background.bottomColor);
    } else if (preset.background.type === 'color') {
      this.scene.background = new THREE.Color(preset.background.color);
    }

    // === 环境贴图 ===
    if (preset.environment === 'room') {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      pmrem.compileEquirectangularShader();
      const roomEnv = new RoomEnvironment();
      this.envMap = pmrem.fromScene(roomEnv, 0.04).texture;
      this.scene.environment = this.envMap;
      pmrem.dispose();
    }

    // === 灯光 ===
    preset.lights.forEach(def => this.addLight(def));

    // === 雾效 ===
    if (preset.fog?.enabled) {
      this.scene.fog = new THREE.Fog(preset.fog.color, preset.fog.near, preset.fog.far);
    } else {
      this.scene.fog = null;
    }

    // === 色调 ===
    this.renderer.toneMapping = THREE[preset.toneMapping] || THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = preset.exposure || 1.0;

    // === 地面 ===
    if (preset.ground?.enabled) {
      this.setGround(preset.ground);
    } else {
      this.removeGround();
    }

    this.gridHelper.visible = preset.showGrid !== false;
    this._emit('presetChanged', presetName);
    this._emit('sceneChanged', null);
  }

  _createGradientTexture(top, bottom) {
    const canvas = document.createElement('canvas');
    canvas.width = 2; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, top);
    grad.addColorStop(1, bottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    return tex;
  }

  _createSky(params = {}, useAsBackground = false) {
    this.sky = new Sky();
    this.sky.scale.setScalar(450000);
    this.scene.add(this.sky);

    const uniforms = this.sky.material.uniforms;
    uniforms['turbidity'].value = params.turbidity || 2;
    uniforms['rayleigh'].value = params.rayleigh || 1;
    uniforms['mieCoefficient'].value = params.mieCoefficient || 0.005;
    uniforms['mieDirectionalG'].value = params.mieDirectionalG || 0.7;

    const sun = new THREE.Vector3();
    const phi = THREE.MathUtils.degToRad(90 - (params.elevation || 30));
    const theta = THREE.MathUtils.degToRad(params.azimuth || 180);
    sun.setFromSphericalCoords(1, phi, theta);
    uniforms['sunPosition'].value.copy(sun);

    // 生成环境贴图（far 必须覆盖 sky sphere）
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const renderTarget = pmrem.fromScene(this.sky, 0, 0.1, 1000000);
    this.envMap = renderTarget.texture;
    this.scene.environment = this.envMap;
    if (useAsBackground) {
      this.scene.background = this.envMap;
    }
    pmrem.dispose();
  }

  /** 创建程序化云层 */
  _createCloudLayer(skyParams = {}) {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    // 生成多层 FBM 噪声作为云层
    const imageData = ctx.createImageData(size, size);
    const data = imageData.data;
    const seed = 42;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = x / size, ny = y / size;
        let val = 0, amp = 1, freq = 3, total = 0;
        for (let oct = 0; oct < 6; oct++) {
          val += _smoothNoise(nx * freq, ny * freq, seed + oct * 37) * amp;
          total += amp;
          amp *= 0.5;
          freq *= 2.1;
        }
        val /= total;

        // 阈值处理 → 云的密度
        let cloud = (val - 0.42) / 0.35;
        cloud = Math.max(0, Math.min(1, cloud));
        // 边缘圆形渐隐（避免云层方形边界）
        const dx = nx - 0.5, dy = ny - 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy) * 2;
        const fade = 1 - Math.max(0, Math.min(1, (dist - 0.6) / 0.4));
        cloud *= fade;

        const idx = (y * size + x) * 4;
        data[idx] = 255;     // R
        data[idx + 1] = 255; // G
        data[idx + 2] = 255; // B
        data[idx + 3] = Math.round(cloud * 180); // Alpha
      }
    }

    ctx.putImageData(imageData, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

    const planeSize = 600;
    const elevation = skyParams.elevation || 30;
    // 云层高度根据天空参数调整
    const cloudHeight = elevation > 20 ? 80 : 40;

    const geo = new THREE.PlaneGeometry(planeSize, planeSize);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      opacity: 0.9,
    });

    this.cloudLayer = new THREE.Mesh(geo, mat);
    this.cloudLayer.rotation.x = -Math.PI / 2;
    this.cloudLayer.position.y = cloudHeight;
    this.cloudLayer.renderOrder = -1;
    this.cloudLayer.userData = { type: 'cloud', name: '云层' };
    this.scene.add(this.cloudLayer);
  }

  // === 灯光 ===
  addLight(config) {
    let light;
    const color = new THREE.Color(config.color || 0xffffff);

    switch (config.type) {
      case 'directional': {
        light = new THREE.DirectionalLight(color, config.intensity || 1);
        light.position.set(...(config.position || [5, 10, 5]));
        if (config.target) light.target.position.set(...config.target);
        if (config.shadow !== false) {
          light.castShadow = true;
          const sz = config.shadowMapSize || 1024;
          light.shadow.mapSize.set(sz, sz);
          light.shadow.camera.near = 0.1;
          light.shadow.camera.far = 100;
          const range = config.shadowRange || 15;
          light.shadow.camera.left = -range;
          light.shadow.camera.right = range;
          light.shadow.camera.top = range;
          light.shadow.camera.bottom = -range;
          light.shadow.bias = -0.0005;
          light.shadow.normalBias = 0.02;
        }
        break;
      }
      case 'point':
        light = new THREE.PointLight(color, config.intensity || 1, config.distance || 0, config.decay || 2);
        light.position.set(...(config.position || [0, 5, 0]));
        if (config.shadow) { light.castShadow = true; const s = config.shadowMapSize || 512; light.shadow.mapSize.set(s, s); }
        break;
      case 'spot':
        light = new THREE.SpotLight(color, config.intensity || 1, config.distance || 0, config.angle || Math.PI / 6, config.penumbra || 0.5, config.decay || 2);
        light.position.set(...(config.position || [0, 8, 0]));
        if (config.target) light.target.position.set(...config.target);
        if (config.shadow !== false) { light.castShadow = true; const s = config.shadowMapSize || 1024; light.shadow.mapSize.set(s, s); light.shadow.bias = -0.0005; }
        break;
      case 'ambient':
        light = new THREE.AmbientLight(color, config.intensity || 0.3);
        break;
      case 'hemisphere':
        light = new THREE.HemisphereLight(color, new THREE.Color(config.groundColor || 0x444444), config.intensity || 0.5);
        break;
      default: return null;
    }

    light.userData = { type: 'light', lightType: config.type, name: config.name || `${config.type}_${this.lights.length + 1}` };
    this.scene.add(light);
    if (light.target && config.type !== 'ambient' && config.type !== 'hemisphere') this.scene.add(light.target);
    this.lights.push(light);
    this._emit('sceneChanged', null);
    return light;
  }

  removeLight(light) {
    const idx = this.lights.indexOf(light);
    if (idx !== -1) this.lights.splice(idx, 1);
    if (light.target) this.scene.remove(light.target);
    this.scene.remove(light);
    if (light.dispose) light.dispose();
    this._emit('sceneChanged', null);
  }

  clearLights() {
    [...this.lights].forEach(l => this.removeLight(l));
    this.lights = [];
  }

  // === 地面 ===
  setGround(config = {}) {
    this.removeGround();
    const size = config.size || 30;
    const geo = new THREE.PlaneGeometry(size, size);

    let mat;
    const groundType = config.type || 'smooth';

    if (groundType === 'grass') {
      mat = this._createPatternMaterial(config, '#5a8a3a', '#4a7a2a', 'grass');
    } else if (groundType === 'concrete') {
      mat = this._createPatternMaterial(config, '#808080', '#707070', 'concrete');
    } else if (groundType === 'reflective') {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.color || '#0e0e14'),
        metalness: config.metalness ?? 0.4, roughness: config.roughness ?? 0.3,
        envMapIntensity: 0.8,
      });
    } else {
      mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(config.color || '#333333'),
        metalness: config.metalness ?? 0.0, roughness: config.roughness ?? 0.8,
        envMapIntensity: 0.3,
      });
    }

    this.ground = new THREE.Mesh(geo, mat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.ground.userData = { type: 'ground', name: '地面' };
    this.scene.add(this.ground);
    this._emit('sceneChanged', null);
  }

  _createPatternMaterial(config, baseColor, altColor, type) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    if (type === 'concrete') {
      for (let i = 0; i < 8000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const v = Math.random() * 30 - 15;
        const r = parseInt(baseColor.slice(1, 3), 16) + v;
        const g = parseInt(baseColor.slice(3, 5), 16) + v;
        const b = parseInt(baseColor.slice(5, 7), 16) + v;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, 2, 2);
      }
      ctx.strokeStyle = altColor;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      }
    } else if (type === 'grass') {
      for (let i = 0; i < 10000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const shade = Math.random() * 40 - 20;
        const r = 90 + shade * 0.3;
        const g = 138 + shade;
        const b = 58 + shade * 0.2;
        ctx.fillStyle = `rgb(${Math.max(0, r)},${Math.max(0, g)},${Math.max(0, b)})`;
        ctx.fillRect(x, y, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(config.size ? config.size / 10 : 3, config.size ? config.size / 10 : 3);

    return new THREE.MeshStandardMaterial({
      map: tex,
      color: new THREE.Color(config.color || baseColor),
      metalness: config.metalness ?? 0.0,
      roughness: config.roughness ?? 0.85,
      envMapIntensity: 0.3,
    });
  }

  removeGround() {
    if (!this.ground) return;
    this.scene.remove(this.ground);
    this.ground.geometry.dispose();
    const mat = this.ground.material;
    if (Array.isArray(mat)) { mat.forEach(m => { this._disposeMaterial(m); }); }
    else { this._disposeMaterial(mat); }
    this.ground = null;
    this._emit('sceneChanged', null);
  }

  _disposeMaterial(m) {
    Object.keys(m).forEach(k => { if (m[k]?.isTexture) m[k].dispose(); });
    m.dispose();
  }

  // === 场景设置 ===
  setBackground(color) {
    if (this.scene.background?.isTexture) this.scene.background.dispose();
    this.scene.background = new THREE.Color(color);
  }

  setFog(enabled, opts = {}) {
    this.scene.fog = enabled ? new THREE.Fog(opts.color || 0x000000, opts.near || 10, opts.far || 100) : null;
  }

  setExposure(v) { this.renderer.toneMappingExposure = v; }

  setToneMapping(type) {
    const map = { None: THREE.NoToneMapping, Linear: THREE.LinearToneMapping, Reinhard: THREE.ReinhardToneMapping, Cineon: THREE.CineonToneMapping, ACESFilmic: THREE.ACESFilmicToneMapping, AgX: THREE.AgXToneMapping, Neutral: THREE.NeutralToneMapping };
    this.renderer.toneMapping = map[type] || THREE.ACESFilmicToneMapping;
  }

  setGridVisible(v) { this.gridHelper.visible = v; }

  setShadowsEnabled(v) {
    this.renderer.shadowMap.enabled = v;
    this.renderer.shadowMap.needsUpdate = true;
    this.scene.traverse(c => { if (c.isMesh) { c.castShadow = v; c.receiveShadow = v; } });
  }

  /** 加载 HDR 环境贴图 */
  loadHDR(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      this._hdrLoader.load(url, (texture) => {
        URL.revokeObjectURL(url);
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        const envMap = pmrem.fromEquirectangular(texture).texture;
        texture.dispose();
        pmrem.dispose();
        // 清理旧环境
        if (this.envMap) this.envMap.dispose();
        if (this.sky) { this.scene.remove(this.sky); this.sky = null; }
        if (this.cloudLayer) { this.scene.remove(this.cloudLayer); this._disposeObject(this.cloudLayer); this.cloudLayer = null; }
        this.envMap = envMap;
        this.scene.environment = envMap;
        this.scene.background = envMap;
        this._hdrTexture = envMap;
        this._emit('hdrLoaded', null);
        resolve(envMap);
      }, undefined, (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      });
    });
  }

  /** 设置后处理参数 */
  setPostProcessing(config) {
    if (config.enabled !== undefined) this._postProcessing.enabled = config.enabled;
    if (config.bloom) {
      Object.assign(this._postProcessing.bloom, config.bloom);
      if (this._bloomPass) {
        this._bloomPass.strength = this._postProcessing.bloom.strength;
        this._bloomPass.radius = this._postProcessing.bloom.radius;
        this._bloomPass.threshold = this._postProcessing.bloom.threshold;
      }
    }
    if (config.smaa !== undefined) {
      this._postProcessing.smaa = config.smaa;
      if (this._smaaPass) this._smaaPass.enabled = config.smaa;
    }
  }

  /** 获取后处理配置 */
  getPostProcessingConfig() {
    return { ...this._postProcessing, bloom: { ...this._postProcessing.bloom } };
  }

  // === 相机视角（基于模型包围盒）===
  setCameraView(view) {
    // 计算所有模型的包围盒
    const box = new THREE.Box3();
    if (this.objects.length > 0) {
      this.objects.forEach(obj => box.expandByObject(obj));
    } else {
      box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(6, 6, 6));
    }
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const d = maxDim * 2; // 距离模型足够远

    const views = {
      front:       { pos: [center.x, center.y + maxDim * 0.3, center.z + d], target: center.toArray() },
      back:        { pos: [center.x, center.y + maxDim * 0.3, center.z - d], target: center.toArray() },
      left:        { pos: [center.x - d, center.y + maxDim * 0.3, center.z], target: center.toArray() },
      right:       { pos: [center.x + d, center.y + maxDim * 0.3, center.z], target: center.toArray() },
      top:         { pos: [center.x, center.y + d, center.z + 0.01], target: center.toArray() },
      perspective: { pos: [center.x + d * 0.6, center.y + d * 0.4, center.z + d * 0.6], target: center.toArray() },
    };
    const v = views[view];
    if (v) this._animateCamera(new THREE.Vector3(...v.pos), new THREE.Vector3(...v.target));
  }

  resetCamera() { this.setCameraView('perspective'); }

  setTransformMode(mode) { if (this.transformControls) this.transformControls.setMode(mode); }

  // === 一键自动设置 ===
  autoSetup() {
    if (this.objects.length === 0) { this.applyPreset('studio'); return; }
    const box = new THREE.Box3();
    this.objects.forEach(obj => box.expandByObject(obj));
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim > 20) this.applyPreset('industrial');
    else if (maxDim > 8) this.applyPreset('outdoor');
    else this.applyPreset('studio');

    // 调整地面大小
    if (this.ground) {
      const gs = maxDim * 5;
      this.ground.geometry.dispose();
      this.ground.geometry = new THREE.PlaneGeometry(gs, gs);
      if (this.ground.material.map) {
        this.ground.material.map.repeat.set(gs / 10, gs / 10);
      }
    }

    // 调整阴影
    this.lights.forEach(l => {
      if (l.isDirectionalLight && l.castShadow) {
        const r = maxDim * 2;
        l.shadow.camera.left = -r; l.shadow.camera.right = r;
        l.shadow.camera.top = r; l.shadow.camera.bottom = -r;
        l.shadow.camera.updateProjectionMatrix();
      }
    });

    // 聚焦
    const dist = maxDim * 2.5;
    this._animateCamera(
      new THREE.Vector3(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.6),
      center
    );
  }

  // === 截图 ===
  takeScreenshot(w, h) {
    const pw = this.renderer.domElement.width;
    const ph = this.renderer.domElement.height;
    if (w && h) { this.renderer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    if (this._postProcessing.enabled && this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
    const url = this.renderer.domElement.toDataURL('image/png');
    if (w && h) { this.renderer.setSize(pw, ph); this.camera.aspect = pw / ph; this.camera.updateProjectionMatrix(); }
    return url;
  }

  // === 导出配置 ===
  getSceneConfig() {
    return {
      version: '3.0', preset: this.currentPreset,
      background: '#' + (this.scene.background?.isColor ? this.scene.background.getHexString() : '1a1a2e'),
      exposure: this.renderer.toneMappingExposure,
      fog: this.scene.fog ? { enabled: true, color: '#' + this.scene.fog.color.getHexString(), near: this.scene.fog.near, far: this.scene.fog.far } : { enabled: false },
      ground: this.ground ? { enabled: true, color: '#' + this.ground.material.color.getHexString(), metalness: this.ground.material.metalness, roughness: this.ground.material.roughness } : { enabled: false },
      lights: this.lights.map(l => ({ type: l.userData.lightType, name: l.userData.name, color: '#' + l.color.getHexString(), intensity: l.intensity, position: l.position ? [l.position.x, l.position.y, l.position.z] : undefined, castShadow: l.castShadow || false })),
      camera: { position: [this.camera.position.x, this.camera.position.y, this.camera.position.z], target: [this.orbitControls.target.x, this.orbitControls.target.y, this.orbitControls.target.z], fov: this.camera.fov },
      objects: this.objects.map(o => ({ name: o.userData.name, position: [o.position.x, o.position.y, o.position.z], rotation: [o.rotation.x, o.rotation.y, o.rotation.z], scale: [o.scale.x, o.scale.y, o.scale.z], url: o.userData.url || '' })),
      waypoints: this.cameraPath.waypoints.map(w => ({ position: [w.position.x, w.position.y, w.position.z], target: [w.target.x, w.target.y, w.target.z], name: w.name, speed: w.speed, stayDuration: w.stayDuration })),
      postProcessing: { ...this._postProcessing, bloom: { ...this._postProcessing.bloom } },
    };
  }

  // === 清理 ===
  _disposeObject(obj) {
    obj.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) {
        (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => this._disposeMaterial(m));
      }
    });
  }

  dispose() {
    if (this.isDisposed) return;
    this.isDisposed = true;
    cancelAnimationFrame(this.animationId);

    this.renderer.domElement.removeEventListener('pointerdown', this._onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this._onPointerUp);
    this._resizeObserver.disconnect();

    this.orbitControls.dispose();
    if (this.transformControls) { this.transformControls.detach(); this.transformControls.dispose(); }

    this.cameraPath.dispose();
    this.materialManager.dispose();
    this.modelExploder.dispose();

    [...this.objects].forEach(o => this._disposeObject(o));
    this.objects = [];
    this.clearLights();
    this.removeGround();

    if (this.composer) { this.composer.dispose(); this.composer = null; }
    if (this._hdrTexture) { this._hdrTexture.dispose(); this._hdrTexture = null; }
    if (this.envMap) { this.envMap.dispose(); this.envMap = null; }
    if (this.sky) { this.scene.remove(this.sky); this.sky = null; }
    if (this.cloudLayer) { this.scene.remove(this.cloudLayer); this._disposeObject(this.cloudLayer); this.cloudLayer = null; }
    this.gridHelper.geometry.dispose();
    this.gridHelper.material.dispose();
    if (this.scene.background?.isTexture) this.scene.background.dispose();

    this.renderer.dispose();
    this.renderer.forceContextLoss();
    if (this.renderer.domElement.parentNode) this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);

    this.modelLoader.dispose();
    this.scene = null; this.camera = null; this.renderer = null; this._callbacks = {};
  }
}

// === 噪声函数（用于云层生成）===
function _hash(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 113.5) * 43758.5453;
  return n - Math.floor(n);
}

function _smoothNoise(x, y, seed) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = _hash(ix, iy, seed);
  const b = _hash(ix + 1, iy, seed);
  const c = _hash(ix, iy + 1, seed);
  const d = _hash(ix + 1, iy + 1, seed);
  return a + u * (b - a) + v * (c - a) + u * v * (a - b - c + d);
}
