/**
 * 材质管理系统
 * - 提取模型材质列表
 * - 内置预设材质（金属、石材、木材、布料、玻璃、地面）
 * - 支持上传贴图替换
 */
import * as THREE from 'three';

/** 内置材质预设 */
const MATERIAL_PRESETS = {
  metal: {
    label: '金属', icon: '🔩',
    color: '#b0b0b0', metalness: 0.95, roughness: 0.12,
    envMapIntensity: 1.2,
  },
  chrome: {
    label: '铬合金', icon: '⚙️',
    color: '#e8e8e8', metalness: 1.0, roughness: 0.05,
    envMapIntensity: 1.5,
  },
  stone: {
    label: '石材', icon: '🪨',
    color: '#8a8a7a', metalness: 0.0, roughness: 0.88,
    envMapIntensity: 0.3,
    texture: 'stone',
  },
  wood: {
    label: '木材', icon: '🪵',
    color: '#9a7040', metalness: 0.0, roughness: 0.72,
    envMapIntensity: 0.25,
    texture: 'wood',
  },
  fabric: {
    label: '布料', icon: '🧵',
    color: '#7a6a88', metalness: 0.0, roughness: 0.96,
    envMapIntensity: 0.15,
    texture: 'fabric',
  },
  glass: {
    label: '玻璃', icon: '🪟',
    color: '#ddeeff', metalness: 0.1, roughness: 0.02,
    envMapIntensity: 1.5, opacity: 0.35, transparent: true,
  },
  ground: {
    label: '地面', icon: '🟫',
    color: '#6a5a4a', metalness: 0.0, roughness: 0.9,
    envMapIntensity: 0.2,
    texture: 'ground',
  },
  rubber: {
    label: '橡胶', icon: '⚫',
    color: '#2a2a2a', metalness: 0.0, roughness: 0.95,
    envMapIntensity: 0.1,
  },
};

export class MaterialManager {
  constructor(engine) {
    this.engine = engine;
    this._textureCache = new Map();
  }

  /** 从模型中提取所有唯一材质 */
  extractMaterials(model) {
    const materials = [];
    const seen = new Set();
    model.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        if (seen.has(m.uuid)) return;
        seen.add(m.uuid);
        materials.push({
          uuid: m.uuid,
          name: m.name || `材质_${materials.length + 1}`,
          material: m,
          meshes: [],
        });
      });
    });
    // 收集每个材质关联的 mesh
    model.traverse(child => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach(m => {
        const entry = materials.find(e => e.uuid === m.uuid);
        if (entry) entry.meshes.push(child);
      });
    });
    return materials;
  }

  /** 获取预设列表 */
  getPresets() {
    return Object.entries(MATERIAL_PRESETS).map(([key, p]) => ({
      key, label: p.label, icon: p.icon,
    }));
  }

  /** 将预设应用到指定材质 */
  applyPreset(material, presetKey) {
    const preset = MATERIAL_PRESETS[presetKey];
    if (!material || !preset) return;

    material.color.set(preset.color);
    material.metalness = preset.metalness;
    material.roughness = preset.roughness;
    if (preset.envMapIntensity !== undefined) material.envMapIntensity = preset.envMapIntensity;

    if (preset.transparent) {
      material.transparent = true;
      material.opacity = preset.opacity ?? 0.5;
    } else {
      material.transparent = false;
      material.opacity = 1.0;
    }

    // 清除旧贴图
    if (material.map) { material.map.dispose(); material.map = null; }
    if (material.normalMap) { material.normalMap.dispose(); material.normalMap = null; }

    // 应用程序纹理
    if (preset.texture) {
      const tex = this._generateProceduralTexture(preset.texture, preset.color);
      material.map = tex;
    }

    material.needsUpdate = true;
  }

  /** 从文件加载贴图并应用到材质 */
  applyTextureFromFile(material, file, mapType = 'map') {
    return new Promise((resolve, reject) => {
      if (!material) { reject(new Error('No material')); return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.colorSpace = mapType === 'map' ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
          tex.needsUpdate = true;

          // 清除旧贴图
          if (material[mapType]) material[mapType].dispose();
          material[mapType] = tex;
          material.needsUpdate = true;
          resolve(tex);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /** 设置材质单项属性 */
  setProperty(material, prop, value) {
    if (!material) return;
    switch (prop) {
      case 'color': material.color.set(value); break;
      case 'metalness': material.metalness = value; break;
      case 'roughness': material.roughness = value; break;
      case 'opacity':
        material.opacity = value;
        material.transparent = value < 1.0;
        break;
      case 'envMapIntensity': material.envMapIntensity = value; break;
      case 'wireframe': material.wireframe = value; break;
    }
    material.needsUpdate = true;
  }

  /** 生成程序化纹理 */
  _generateProceduralTexture(type, baseColor) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d');
    const c = new THREE.Color(baseColor);
    const r = Math.round(c.r * 255), g = Math.round(c.g * 255), b = Math.round(c.b * 255);

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    if (type === 'stone') {
      for (let i = 0; i < 12000; i++) {
        const px = Math.random() * size, py = Math.random() * size;
        const v = (Math.random() - 0.5) * 40;
        ctx.fillStyle = `rgb(${clamp(r + v)},${clamp(g + v)},${clamp(b + v)})`;
        ctx.fillRect(px, py, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
      ctx.strokeStyle = `rgba(${r - 20},${g - 20},${b - 20},0.3)`;
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 15; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * size, Math.random() * size);
        ctx.lineTo(Math.random() * size, Math.random() * size);
        ctx.stroke();
      }
    } else if (type === 'wood') {
      for (let y = 0; y < size; y++) {
        const lineV = Math.sin(y * 0.15) * 10 + Math.sin(y * 0.05 + 1.3) * 15;
        ctx.fillStyle = `rgb(${clamp(r + lineV)},${clamp(g + lineV * 0.7)},${clamp(b + lineV * 0.3)})`;
        ctx.fillRect(0, y, size, 1);
      }
      for (let i = 0; i < 5000; i++) {
        const px = Math.random() * size, py = Math.random() * size;
        const v = (Math.random() - 0.5) * 15;
        ctx.fillStyle = `rgba(${clamp(r + v)},${clamp(g + v)},${clamp(b + v)},0.4)`;
        ctx.fillRect(px, py, Math.random() * 2, 1);
      }
    } else if (type === 'fabric') {
      for (let x = 0; x < size; x += 2) {
        for (let y = 0; y < size; y += 2) {
          const v = ((x + y) % 4 === 0 ? 8 : -8) + (Math.random() - 0.5) * 10;
          ctx.fillStyle = `rgb(${clamp(r + v)},${clamp(g + v)},${clamp(b + v)})`;
          ctx.fillRect(x, y, 2, 2);
        }
      }
    } else if (type === 'ground') {
      for (let i = 0; i < 15000; i++) {
        const px = Math.random() * size, py = Math.random() * size;
        const v = (Math.random() - 0.5) * 50;
        ctx.fillStyle = `rgb(${clamp(r + v)},${clamp(g + v * 0.8)},${clamp(b + v * 0.5)})`;
        ctx.fillRect(px, py, 1 + Math.random() * 4, 1 + Math.random() * 4);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(3, 3);
    return tex;
  }

  dispose() {
    this._textureCache.forEach(t => t.dispose());
    this._textureCache.clear();
    this.engine = null;
  }
}

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }
