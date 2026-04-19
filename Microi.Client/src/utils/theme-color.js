/**
 * 主题色工具函数
 * 用于动态计算主题色的各种变体，兼容 360 极速浏览器
 */

/**
 * 将 HEX 颜色转换为 RGB
 * @param {string} hex - HEX 颜色值，如 #409eff
 * @returns {object} {r, g, b}
 */
export function hexToRgb(hex) {
    // 移除 # 号
    hex = hex.replace('#', '');
    
    // 转换为 RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    
    return { r, g, b };
}

/**
 * 将 RGB 转换为 HEX
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @returns {string}
 */
export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

/**
 * 将 HEX 转为 HSL
 * @param {string} hex
 * @returns {{h: number, s: number, l: number}} h: 0-360, s/l: 0-100
 */
export function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const r1 = r / 255, g1 = g / 255, b1 = b / 255;
    const max = Math.max(r1, g1, b1), min = Math.min(r1, g1, b1);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r1: h = ((g1 - b1) / d + (g1 < b1 ? 6 : 0)) / 6; break;
            case g1: h = ((b1 - r1) / d + 2) / 6; break;
            case b1: h = ((r1 - g1) / d + 4) / 6; break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * 将 HSL 转为 HEX
 * @param {number} h 0-360
 * @param {number} s 0-100
 * @param {number} l 0-100
 * @returns {string}
 */
export function hslToHex(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

/**
 * 计算主题色的浅色变体（混合白色）
 * @param {string} color - HEX 颜色值
 * @param {number} percent - 白色混合比例 (0-100)
 * @returns {string} HEX 颜色值
 */
export function lighten(color, percent) {
    const { r, g, b } = hexToRgb(color);
    const amount = percent / 100;
    
    const newR = r + (255 - r) * amount;
    const newG = g + (255 - g) * amount;
    const newB = b + (255 - b) * amount;
    
    return rgbToHex(newR, newG, newB);
}

/**
 * 计算主题色的深色变体（混合黑色）
 * @param {string} color - HEX 颜色值
 * @param {number} percent - 黑色混合比例 (0-100)
 * @returns {string} HEX 颜色值
 */
export function darken(color, percent) {
    const { r, g, b } = hexToRgb(color);
    const amount = percent / 100;
    
    const newR = r * (1 - amount);
    const newG = g * (1 - amount);
    const newB = b * (1 - amount);
    
    return rgbToHex(newR, newG, newB);
}

/**
 * 设置主题色并更新所有 CSS 变量
 * 同步驱动：旧版 --color-primary、Element Plus --el-color-primary、MCI 设计系统 --mci-color-primary*
 * @param {string} primaryColor - HEX 主题色
 */
export function setThemeColor(primaryColor) {
    const root = document.documentElement;
    const { r, g, b } = hexToRgb(primaryColor);

    // === 旧版变量（兼容现有页面） ===
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--theme-color', primaryColor);
    root.style.setProperty('--sidebar-bg-color', primaryColor);

    // 计算并设置浅色变体（用于渐变）
    const lightColor = lighten(primaryColor, 15);
    root.style.setProperty('--color-primary-light', lightColor);

    // 计算并设置深色变体（用于渐变）
    const darkColor = darken(primaryColor, 30);
    root.style.setProperty('--color-primary-dark', darkColor);

    // === Element Plus 主题（含 light-3..9 / dark-2 阶梯） ===
    root.style.setProperty('--el-color-primary', primaryColor);

    // 暗色模式下 light-N 应混合暗色背景（而非白色），否则表格/组件出现浅亮色块
    const isDark = getThemeMode() === 'dark';
    if (isDark) {
        // 暗色模式：light-N 用主题色与暗色背景混合（降低亮度和饱和度）
        const { h } = hexToHsl(primaryColor);
        root.style.setProperty('--el-color-primary-light-3', hslToHex(h, 35, 35));
        root.style.setProperty('--el-color-primary-light-5', hslToHex(h, 25, 25));
        root.style.setProperty('--el-color-primary-light-7', hslToHex(h, 18, 18));
        root.style.setProperty('--el-color-primary-light-8', hslToHex(h, 14, 14));
        root.style.setProperty('--el-color-primary-light-9', hslToHex(h, 10, 11));
    } else {
        root.style.setProperty('--el-color-primary-light-3', lighten(primaryColor, 30));
        root.style.setProperty('--el-color-primary-light-5', lighten(primaryColor, 50));
        root.style.setProperty('--el-color-primary-light-7', lighten(primaryColor, 70));
        root.style.setProperty('--el-color-primary-light-8', lighten(primaryColor, 80));
        root.style.setProperty('--el-color-primary-light-9', lighten(primaryColor, 90));
    }
    root.style.setProperty('--el-color-primary-dark-2', darken(primaryColor, 20));

    // === MCI 设计系统令牌 ===
    const mciLight = lighten(primaryColor, 25);
    const mciDark = darken(primaryColor, 20);
    const glow = `rgba(${r}, ${g}, ${b}, 0.20)`;
    const glowStrong = `rgba(${r}, ${g}, ${b}, 0.35)`;
    root.style.setProperty('--mci-color-primary', primaryColor);
    root.style.setProperty('--mci-color-primary-light', mciLight);
    root.style.setProperty('--mci-color-primary-dark', mciDark);
    root.style.setProperty('--mci-color-primary-glow', glow);
    root.style.setProperty('--mci-border-glow', glow);
    root.style.setProperty('--mci-shadow-button', `0 4px 14px ${glow}`);
    root.style.setProperty('--mci-shadow-button-hover', `0 8px 22px ${glowStrong}`);
    root.style.setProperty('--mci-glow-primary', `0 0 16px ${glow}, 0 0 36px ${glow}`);
    // 主渐变：当前主题色 → MCI 蓝（保持设计系统的科技感双色调）
    root.style.setProperty('--mci-gradient-primary',
        `linear-gradient(135deg, ${primaryColor} 0%, #2196F3 100%)`);

    // === 侧边栏文字与悬浮态：根据主题色亮度自动选择 ===
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    if (brightness > 180) {
        root.style.setProperty('--color-primary-text', '#303133');
        root.style.setProperty('--sidebar-text-color', 'rgba(48, 49, 51, 0.9)');
        root.style.setProperty('--sidebar-hover-bg', 'rgba(0, 0, 0, 0.08)');
        root.style.setProperty('--sidebar-active-bg', 'rgba(0, 0, 0, 0.12)');
    } else {
        root.style.setProperty('--color-primary-text', '#ffffff');
        root.style.setProperty('--sidebar-text-color', 'rgba(255, 255, 255, 0.9)');
        root.style.setProperty('--sidebar-hover-bg', 'rgba(255, 255, 255, 0.15)');
        root.style.setProperty('--sidebar-active-bg', 'rgba(255, 255, 255, 0.25)');
    }

    // 当前若为暗色模式，重新计算并应用基于主题色的暗色调色板
    if (getThemeMode() === 'dark') {
        applyDarkTintedVars(primaryColor);
    }

    console.log('[主题色] 已更新 (含 MCI 令牌):', primaryColor);
}

/**
 * 计算并应用基于主题色色相的暗色调色板
 *
 * 设计要点：
 *   - 取主题色的 HUE（色相），而非 RGB 直接混合 → 避免暖色系产生脏/泥色
 *   - 饱和度限制 8-15%，只保留微弱色调，不会太彩
 *   - 用三档亮度梯度构建层级：页面(最暗) → 容器(中) → 卡片/弹层(最亮)
 *   - 侧边栏保持主题色深色变体，维持品牌识别感
 *
 * @param {string} primaryColor - HEX 主题色
 */
function applyDarkTintedVars(primaryColor) {
    const root = document.documentElement;
    const { r, g, b } = hexToRgb(primaryColor);
    const { h } = hexToHsl(primaryColor);

    // 用主题色色相 + 中等饱和度 + 不同亮度生成暗色阶梯
    // 拉高饱和度让背景明显带主题色（而非看起来像纯黑）
    const tint = (s, l) => hslToHex(h, s, l);

    // === 三层暗色背景（核心层级）===
    const bgPage    = tint(35, 11);   // L11 — 最深，页面底层（带明显主题色）
    const bgColor   = tint(38, 14);   // L14 — 容器（侧边栏/导航/表格主体）
    const bgOverlay = tint(40, 17);   // L17 — 卡片/弹层/对话框（视觉提升一档）

    // === Fill 层级（EP 组件内部使用）===
    const fillBlank      = tint(35, 14);
    const fillExtraLight = tint(32, 18);
    const fillLight      = tint(30, 21);
    const fill           = tint(28, 25);
    const fillDark       = tint(35, 15);
    const fillDarker     = tint(38, 12);

    // === 写入 Element Plus 背景变量 ===
    root.style.setProperty('--el-bg-color-page', bgPage);
    root.style.setProperty('--el-bg-color', bgColor);
    root.style.setProperty('--el-bg-color-overlay', bgOverlay);
    root.style.setProperty('--el-fill-color-blank', fillBlank);
    root.style.setProperty('--el-fill-color-extra-light', fillExtraLight);
    root.style.setProperty('--el-fill-color-light', fillLight);
    root.style.setProperty('--el-fill-color', fill);
    root.style.setProperty('--el-fill-color-dark', fillDark);
    root.style.setProperty('--el-fill-color-darker', fillDarker);

    // === Element Plus 组件级背景变量 ===
    root.style.setProperty('--el-drawer-bg-color', bgOverlay);
    root.style.setProperty('--el-dialog-bg-color', bgOverlay);
    root.style.setProperty('--el-mask-color', 'rgba(0, 0, 0, 0.6)');
    root.style.setProperty('--el-input-bg-color', fillBlank);
    root.style.setProperty('--el-input-text-color', '#E5E5ED');
    root.style.setProperty('--el-input-border-color', tint(20, 28));
    root.style.setProperty('--el-disabled-bg-color', fillDarker);

    // === 边框：白色低透明度 + 适度主题色相 ===
    root.style.setProperty('--el-border-color',             tint(20, 28));
    root.style.setProperty('--el-border-color-light',       tint(18, 24));
    root.style.setProperty('--el-border-color-lighter',     tint(15, 21));
    root.style.setProperty('--el-border-color-extra-light', tint(12, 18));
    root.style.setProperty('--el-border-color-dark',        tint(22, 32));
    root.style.setProperty('--el-border-color-darker',      tint(25, 36));

    // === 文字：柔和近白（不刺眼）===
    root.style.setProperty('--el-text-color-primary',     '#E5E5ED');
    root.style.setProperty('--el-text-color-regular',     '#B8B8C8');
    root.style.setProperty('--el-text-color-secondary',   '#8E8EA0');
    root.style.setProperty('--el-text-color-placeholder', '#5C5C6E');
    root.style.setProperty('--el-text-color-disabled',    '#484858');

    // === MCI 设计系统令牌 ===
    root.style.setProperty('--mci-bg-base', bgPage);
    root.style.setProperty('--mci-bg-elevated', bgColor);
    root.style.setProperty('--mci-bg-surface', bgOverlay);
    root.style.setProperty('--mci-bg-card', bgOverlay);
    root.style.setProperty('--mci-bg-card-hover', fillLight);
    root.style.setProperty('--mci-bg-glass', `rgba(${r}, ${g}, ${b}, 0.05)`);
    root.style.setProperty('--mci-bg-glass-border', `rgba(${r}, ${g}, ${b}, 0.10)`);
    root.style.setProperty('--mci-border-color', tint(5, 19));
    root.style.setProperty('--mci-border-color-hover', tint(6, 26));
    root.style.setProperty('--mci-text-primary', '#E5E5ED');
    root.style.setProperty('--mci-text-secondary', '#8E8EA0');
    root.style.setProperty('--mci-text-tertiary', '#5C5C6E');

    // === 侧边栏：保持主题色深色变体（维持品牌识别）===
    const sidebarBg = tint(Math.min(30, 30), 13); // 稍高饱和度 + 略亮于底层
    root.style.setProperty('--sidebar-bg-color', sidebarBg);
    root.style.setProperty('--sidebar-text-color', '#C4C4D4');
    root.style.setProperty('--sidebar-hover-bg', tint(12, 18));
    root.style.setProperty('--sidebar-active-bg', `rgba(${r}, ${g}, ${b}, 0.20)`);
}

/**
 * 清除暗色模式自定义变量，回到亮色默认值
 */
function clearDarkTintedVars() {
    const root = document.documentElement;
    const props = [
        '--el-bg-color-page', '--el-bg-color', '--el-bg-color-overlay',
        '--el-fill-color-blank', '--el-fill-color-extra-light', '--el-fill-color-light',
        '--el-fill-color', '--el-fill-color-dark', '--el-fill-color-darker',
        '--el-border-color', '--el-border-color-light', '--el-border-color-lighter',
        '--el-border-color-extra-light', '--el-border-color-dark', '--el-border-color-darker',
        '--el-text-color-primary', '--el-text-color-regular', '--el-text-color-secondary',
        '--el-text-color-placeholder', '--el-text-color-disabled',
        '--el-color-primary-light-3', '--el-color-primary-light-5',
        '--el-color-primary-light-7', '--el-color-primary-light-8', '--el-color-primary-light-9',
        '--el-drawer-bg-color', '--el-dialog-bg-color', '--el-mask-color',
        '--el-input-bg-color', '--el-input-text-color', '--el-input-border-color',
        '--el-disabled-bg-color',
        '--mci-bg-base', '--mci-bg-elevated', '--mci-bg-surface',
        '--mci-bg-card', '--mci-bg-card-hover', '--mci-bg-glass', '--mci-bg-glass-border',
        '--mci-border-color', '--mci-border-color-hover',
        '--mci-text-primary', '--mci-text-secondary', '--mci-text-tertiary',
    ];
    props.forEach(p => root.style.removeProperty(p));
    // sidebar 由 setThemeColor 重设，无需在此清理
}

/**
 * 切换 MCI 设计系统的明/暗主题
 * @param {'light' | 'dark'} mode
 */
export function setThemeMode(mode) {
    const root = document.documentElement;
    const next = mode === 'dark' ? 'dark' : 'light';
    // 先写 localStorage，确保后续 getThemeMode() 读到最新值
    try { localStorage.setItem('mci-theme', next); } catch (e) {}
    root.setAttribute('data-theme', next);
    if (next === 'dark') {
        root.classList.add('dark');
        applyDarkTintedVars(getThemeColor());
    } else {
        root.classList.remove('dark');
        clearDarkTintedVars();
        // 重新应用主题色，恢复亮色侧边栏（实色主题色）
        setThemeColor(getThemeColor());
    }
}

/**
 * 获取当前 MCI 主题模式
 */
export function getThemeMode() {
    try {
        const saved = localStorage.getItem('mci-theme');
        if (saved === 'light' || saved === 'dark') return saved;
    } catch (e) {}
    return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * 获取当前主题色
 * @returns {string} HEX 颜色值
 */
export function getThemeColor() {
    return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#409eff';
}

/**
 * 初始化主题色系统
 * 确保所有 CSS 变量都正确设置
 */
export function initThemeColor() {
    const currentColor = getThemeColor();
    setThemeColor(currentColor);
}
