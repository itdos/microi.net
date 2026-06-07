const STORAGE_KEYS = {
  theme: 'mci-theme',
  palette: 'mci-palette',
  shape: 'mci-shape',
  motion: 'mci-motion'
};

const PALETTES = ['black', 'white', 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'];

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
  const next = theme === 'dark' ? 'dark' : 'light';
  setRootAttr('data-theme', next);
  writeStorage(STORAGE_KEYS.theme, next);
  return next;
}

export function setMciPalette(palette = 'red') {
  const next = PALETTES.includes(palette) ? palette : 'red';
  setRootAttr('data-mci-palette', next);
  writeStorage(STORAGE_KEYS.palette, next);
  return next;
}

export function setMciShape(shape = 'rounded') {
  const next = shape === 'flat' ? 'flat' : 'rounded';
  setRootAttr('data-mci-shape', next);
  writeStorage(STORAGE_KEYS.shape, next);
  return next;
}

export function setMciMotion(motion = 'full') {
  const next = motion === 'reduced' ? 'reduced' : 'full';
  setRootAttr('data-mci-motion', next);
  writeStorage(STORAGE_KEYS.motion, next);
  return next;
}

export function initMciDesign(options = {}) {
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

export default {
  initMciDesign,
  setMciPalette,
  setMciTheme,
  setMciShape,
  setMciMotion
};
