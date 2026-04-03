/**
 * 场景预设模板 V3 - 中文标签 + 强视觉差异
 */

export const PRESETS = {
  outdoor: {
    label: '蓝天白云',
    category: '自然环境',
    desc: '晴朗天空，适合室外建筑/景观',
    icon: '☀️',
    background: { type: 'sky' },
    environment: 'sky',
    skyParams: { turbidity: 2, rayleigh: 1.5, mieCoefficient: 0.005, mieDirectionalG: 0.8, elevation: 45, azimuth: 160 },
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 1.0,
    showGrid: false,
    fog: { enabled: true, color: '#b8d4e8', near: 50, far: 300 },
    ground: { enabled: true, size: 200, color: '#5a8a3a', type: 'grass', metalness: 0.0, roughness: 0.95 },
    lights: [
      { type: 'directional', name: '太阳', color: '#fff8e7', intensity: 2.5, position: [15, 20, 10], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 40 },
      { type: 'hemisphere', name: '天空光', color: '#87CEEB', groundColor: '#4a6a2a', intensity: 0.6 },
      { type: 'ambient', name: '环境光', color: '#8ab4d4', intensity: 0.3 },
    ],
  },

  industrial: {
    label: '工业厂房',
    category: '自然环境',
    desc: '全景工业场景，适合工厂/设备',
    icon: '🏭',
    background: { type: 'sky' },
    environment: 'sky',
    skyParams: { turbidity: 4, rayleigh: 0.8, mieCoefficient: 0.02, mieDirectionalG: 0.9, elevation: 35, azimuth: 200 },
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 0.85,
    showGrid: false,
    fog: { enabled: true, color: '#9aacb8', near: 30, far: 200 },
    ground: { enabled: true, size: 300, color: '#808080', type: 'concrete', metalness: 0.1, roughness: 0.85 },
    lights: [
      { type: 'directional', name: '主光源', color: '#fff0d0', intensity: 2.2, position: [20, 25, 15], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 60 },
      { type: 'directional', name: '补光', color: '#c0d4e8', intensity: 0.8, position: [-15, 10, -10], target: [0, 0, 0], shadow: false },
      { type: 'hemisphere', name: '天空散射', color: '#a0b8cc', groundColor: '#606060', intensity: 0.5 },
      { type: 'ambient', name: '环境光', color: '#909090', intensity: 0.4 },
    ],
  },

  sunset: {
    label: '黄昏日落',
    category: '自然环境',
    desc: '金色暖光，适合氛围渲染',
    icon: '🌅',
    background: { type: 'sky' },
    environment: 'sky',
    skyParams: { turbidity: 6, rayleigh: 2.5, mieCoefficient: 0.015, mieDirectionalG: 0.95, elevation: 5, azimuth: 200 },
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 0.7,
    showGrid: false,
    fog: { enabled: true, color: '#5a3020', near: 20, far: 120 },
    ground: { enabled: true, size: 200, color: '#4a3828', type: 'ground', metalness: 0.0, roughness: 0.9 },
    lights: [
      { type: 'directional', name: '落日', color: '#ff8844', intensity: 3.5, position: [-15, 4, -12], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 30 },
      { type: 'hemisphere', name: '天空色', color: '#ff9966', groundColor: '#332244', intensity: 0.5 },
      { type: 'ambient', name: '环境光', color: '#2a1830', intensity: 0.2 },
    ],
  },

  studio: {
    label: '摄影棚',
    category: '影棚',
    desc: '专业三点布光，适合产品展示',
    icon: '📸',
    background: { type: 'gradient', topColor: '#1e2233', bottomColor: '#0d0f18' },
    environment: 'room',
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 1.0,
    showGrid: false,
    fog: { enabled: false },
    ground: { enabled: true, size: 30, color: '#1a1c24', type: 'reflective', metalness: 0.15, roughness: 0.6 },
    lights: [
      { type: 'directional', name: '主光', color: '#ffffff', intensity: 2.0, position: [5, 8, 3], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 15 },
      { type: 'directional', name: '补光', color: '#8eaadc', intensity: 0.8, position: [-5, 5, -3], target: [0, 0, 0], shadow: false },
      { type: 'point', name: '轮廓光', color: '#ffd4a6', intensity: 2.5, position: [-2, 4, -5], shadow: false },
      { type: 'ambient', name: '环境光', color: '#404060', intensity: 0.35 },
    ],
  },

  showroom: {
    label: '展厅',
    category: '影棚',
    desc: '暗色展厅聚光，适合高端产品',
    icon: '🏛️',
    background: { type: 'gradient', topColor: '#0a0b14', bottomColor: '#04050a' },
    environment: 'room',
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 0.9,
    showGrid: false,
    fog: { enabled: true, color: '#050510', near: 20, far: 80 },
    ground: { enabled: true, size: 40, color: '#0a0a12', type: 'reflective', metalness: 0.5, roughness: 0.2 },
    lights: [
      { type: 'spot', name: '主聚光', color: '#ffffff', intensity: 30, position: [0, 12, 0], target: [0, 0, 0], angle: 0.5, penumbra: 0.8, shadow: true, shadowMapSize: 2048 },
      { type: 'spot', name: '蓝色补光', color: '#6688cc', intensity: 12, position: [-6, 7, 5], target: [0, 0, 0], angle: 0.6, penumbra: 0.9, shadow: false },
      { type: 'spot', name: '暖色轮廓', color: '#cc8866', intensity: 8, position: [5, 6, -5], target: [0, 0, 0], angle: 0.5, penumbra: 0.7, shadow: false },
      { type: 'ambient', name: '环境光', color: '#101020', intensity: 0.15 },
    ],
  },

  product: {
    label: '产品白底',
    category: '影棚',
    desc: '干净白色背景，适合电商',
    icon: '🛍️',
    background: { type: 'gradient', topColor: '#f0f0f4', bottomColor: '#d8d8e0' },
    environment: 'room',
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 1.2,
    showGrid: false,
    fog: { enabled: false },
    ground: { enabled: true, size: 20, color: '#e0e0e6', type: 'smooth', metalness: 0.0, roughness: 0.9 },
    lights: [
      { type: 'directional', name: '主光', color: '#ffffff', intensity: 1.8, position: [3, 8, 5], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 12 },
      { type: 'directional', name: '补光', color: '#eeeeff', intensity: 1.0, position: [-5, 6, -2], target: [0, 0, 0], shadow: false },
      { type: 'ambient', name: '环境光', color: '#ffffff', intensity: 0.6 },
    ],
  },

  cyberpunk: {
    label: '赛博朋克',
    category: '艺术风格',
    desc: '霓虹灯光科幻风，适合概念展示',
    icon: '💜',
    background: { type: 'gradient', topColor: '#030308', bottomColor: '#08041a' },
    environment: null,
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 1.0,
    showGrid: false,
    fog: { enabled: true, color: '#050510', near: 12, far: 50 },
    ground: { enabled: true, size: 40, color: '#06060e', type: 'reflective', metalness: 0.6, roughness: 0.15 },
    lights: [
      { type: 'spot', name: '蓝色主光', color: '#4488ff', intensity: 25, position: [-5, 8, 3], target: [0, 0, 0], angle: 0.5, penumbra: 0.8, shadow: true, shadowMapSize: 1024 },
      { type: 'spot', name: '紫色辅光', color: '#8844ff', intensity: 15, position: [5, 6, -3], target: [0, 0, 0], angle: 0.6, penumbra: 0.9, shadow: false },
      { type: 'point', name: '红色点缀', color: '#ff4466', intensity: 4, position: [0, 3, -5], shadow: false },
      { type: 'ambient', name: '环境光', color: '#0a0a20', intensity: 0.08 },
    ],
  },

  night: {
    label: '月光夜景',
    category: '艺术风格',
    desc: '宁静月夜，适合场景漫游',
    icon: '🌙',
    background: { type: 'gradient', topColor: '#080c1a', bottomColor: '#101828' },
    environment: null,
    toneMapping: 'ACESFilmicToneMapping',
    exposure: 0.8,
    showGrid: false,
    fog: { enabled: true, color: '#0a0e18', near: 15, far: 80 },
    ground: { enabled: true, size: 100, color: '#12161e', type: 'ground', metalness: 0.0, roughness: 0.9 },
    lights: [
      { type: 'directional', name: '月光', color: '#8899cc', intensity: 1.5, position: [10, 15, -8], target: [0, 0, 0], shadow: true, shadowMapSize: 2048, shadowRange: 30 },
      { type: 'hemisphere', name: '天空光', color: '#1a2244', groundColor: '#0a0e14', intensity: 0.4 },
      { type: 'ambient', name: '环境光', color: '#0e1220', intensity: 0.15 },
    ],
  },
};

export function getPresetList() {
  return Object.entries(PRESETS).map(([key, preset]) => ({
    key, label: preset.label, icon: preset.icon, desc: preset.desc, category: preset.category,
  }));
}
