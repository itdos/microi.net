const STORAGE_KEYS = {
  theme: 'mci-theme',
  palette: 'mci-palette',
  shape: 'mci-shape',
  motion: 'mci-motion'
};

export const MCI_THEMES = ['light', 'dark'];
export const MCI_PALETTES = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];
export const MCI_SHAPES = ['rounded', 'flat'];
export const MCI_MOTIONS = ['full', 'reduced'];

export const MCI_PALETTE_LABELS = {
  black: '黑',
  white: '白',
  red: '红',
  orange: '橙',
  yellow: '黄',
  green: '绿',
  cyan: '青',
  blue: '蓝',
  purple: '紫'
};

function getRoot() {
  if (typeof document === 'undefined') return null;
  return document.documentElement || null;
}

function writeStorage(key, value) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.uni && globalThis.uni.setStorageSync) {
      globalThis.uni.setStorageSync(key, value);
      return;
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (error) {
    // Storage can be disabled in embedded webviews.
  }
}

function readStorage(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.uni && globalThis.uni.getStorageSync) {
      return globalThis.uni.getStorageSync(key) || '';
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (error) {
    // Storage can be disabled in embedded webviews.
  }
  return '';
}

function setRootAttr(name, value) {
  const root = getRoot();
  if (root) {
    root.setAttribute(name, value);
  }
  return value;
}

export function setMciTheme(theme = 'light') {
  const next = MCI_THEMES.includes(theme) ? theme : 'light';
  setRootAttr('data-theme', next);
  writeStorage(STORAGE_KEYS.theme, next);
  return next;
}

export function setMciPalette(palette = 'red') {
  const next = MCI_PALETTES.includes(palette) ? palette : 'red';
  setRootAttr('data-mci-palette', next);
  writeStorage(STORAGE_KEYS.palette, next);
  return next;
}

export function setMciShape(shape = 'rounded') {
  const next = MCI_SHAPES.includes(shape) ? shape : 'rounded';
  setRootAttr('data-mci-shape', next);
  writeStorage(STORAGE_KEYS.shape, next);
  return next;
}

export function setMciMotion(motion = 'full') {
  const next = MCI_MOTIONS.includes(motion) ? motion : 'full';
  setRootAttr('data-mci-motion', next);
  writeStorage(STORAGE_KEYS.motion, next);
  return next;
}

export function getMciDesign(defaults = {}) {
  return {
    theme: defaults.theme || readStorage(STORAGE_KEYS.theme) || 'light',
    palette: defaults.palette || readStorage(STORAGE_KEYS.palette) || 'red',
    shape: defaults.shape || readStorage(STORAGE_KEYS.shape) || 'rounded',
    motion: defaults.motion || readStorage(STORAGE_KEYS.motion) || 'full'
  };
}

export function applyMciDesign(options = {}) {
  const theme = options.theme || readStorage(STORAGE_KEYS.theme) || 'light';
  const palette = options.palette || readStorage(STORAGE_KEYS.palette) || 'red';
  const shape = options.shape || readStorage(STORAGE_KEYS.shape) || 'rounded';
  const motion = options.motion || readStorage(STORAGE_KEYS.motion) || 'full';

  return {
    theme: setMciTheme(theme),
    palette: setMciPalette(palette),
    shape: setMciShape(shape),
    motion: setMciMotion(motion)
  };
}

export function initMciDesign(options = {}) {
  return applyMciDesign(getMciDesign(options));
}

export function toggleMciTheme() {
  return setMciTheme(getMciDesign().theme === 'dark' ? 'light' : 'dark');
}

export default {
  MCI_THEMES,
  MCI_PALETTES,
  MCI_SHAPES,
  MCI_MOTIONS,
  MCI_PALETTE_LABELS,
  initMciDesign,
  applyMciDesign,
  getMciDesign,
  toggleMciTheme,
  setMciPalette,
  setMciTheme,
  setMciShape,
  setMciMotion
};
