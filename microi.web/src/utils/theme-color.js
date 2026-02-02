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
 * @param {string} primaryColor - HEX 主题色
 */
export function setThemeColor(primaryColor) {
    const root = document.documentElement;
    const { r, g, b } = hexToRgb(primaryColor);
    
    // 设置主色
    root.style.setProperty('--color-primary', primaryColor);
    root.style.setProperty('--color-primary-rgb', `${r}, ${g}, ${b}`);
    
    // 计算并设置浅色变体（用于渐变）
    // 相当于 85% 主题色 + 15% 白色
    const lightColor = lighten(primaryColor, 15);
    root.style.setProperty('--color-primary-light', lightColor);
    
    // 计算并设置深色变体（用于渐变）
    // 相当于 70% 主题色 + 30% 黑色
    const darkColor = darken(primaryColor, 30);
    root.style.setProperty('--color-primary-dark', darkColor);
    
    console.log('[主题色] 已更新:', {
        primary: primaryColor,
        rgb: `${r}, ${g}, ${b}`,
        light: lightColor,
        dark: darkColor
    });
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
