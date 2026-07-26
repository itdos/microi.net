/**
 * Microi 后台主题运行时。
 *
 * 明暗模式负责页面明度、边框和文字层级；palette 同时驱动品牌主色与低饱和表面染色。
 * 后台的亮/暗表面令牌与 microi.doc 官网 mainstream 主题保持一致，
 * 同时桥接 Element Plus、ve-plus、MCI 和历史 --color-* 变量。
 */

const DEFAULT_THEME_COLOR = "#409EFF";

export const MCI_THEME_PALETTES = Object.freeze([
    {
        key: "white",
        name: "白色",
        value: "#F8FAFC",
        swatch: "#FFFFFF",
        strong: "#E5E7EB",
        onPrimary: "#111827",
        borderGlow: "rgba(15, 23, 42, 0.18)",
        gradient: "linear-gradient(135deg, #FFFFFF 0%, #E5E7EB 100%)"
    },
    {
        key: "black",
        name: "黑色",
        value: "#111827",
        swatch: "#111827",
        strong: "#030712",
        onPrimary: "#FFFFFF",
        borderGlow: "rgba(17, 24, 39, 0.22)",
        gradient: "linear-gradient(135deg, #111827 0%, #374151 100%)"
    },
    {
        key: "graphite",
        name: "石墨",
        value: "#334155",
        swatch: "#334155",
        strong: "#1E293B",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #334155 0%, #64748B 100%)"
    },
    {
        key: "red",
        name: "红色",
        value: "#B51220",
        swatch: "#B51220",
        strong: "#8E0613",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #B51220 0%, #F04438 100%)"
    },
    {
        key: "orange",
        name: "橙色",
        value: "#EA580C",
        swatch: "#EA580C",
        strong: "#C2410C",
        onPrimary: "#000000",
        gradient: "linear-gradient(135deg, #EA580C 0%, #FB923C 100%)"
    },
    {
        key: "yellow",
        name: "黄色",
        value: "#D9A23A",
        swatch: "#D9A23A",
        strong: "#B7791F",
        onPrimary: "#3A2500",
        gradient: "linear-gradient(135deg, #D9A23A 0%, #F5C85B 100%)"
    },
    {
        key: "green",
        name: "绿色",
        value: "#16A34A",
        swatch: "#16A34A",
        strong: "#15803D",
        onPrimary: "#000000",
        gradient: "linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)"
    },
    {
        key: "teal",
        name: "青绿",
        value: "#0F766E",
        swatch: "#0F766E",
        strong: "#115E59",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #0F766E 0%, #2DD4BF 100%)"
    },
    {
        key: "cyan",
        name: "青色",
        value: "#0891B2",
        swatch: "#0891B2",
        strong: "#0E7490",
        onPrimary: "#000000",
        gradient: "linear-gradient(135deg, #0891B2 0%, #22D3EE 100%)"
    },
    {
        key: "blue",
        name: "蓝色",
        value: "#2563EB",
        swatch: "#2563EB",
        strong: "#1D4ED8",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #2563EB 0%, #60A5FA 100%)"
    },
    {
        key: "indigo",
        name: "靛蓝",
        value: "#4F46E5",
        swatch: "#4F46E5",
        strong: "#4338CA",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #4F46E5 0%, #818CF8 100%)"
    },
    {
        key: "purple",
        name: "紫色",
        value: "#7C3AED",
        swatch: "#7C3AED",
        strong: "#6D28D9",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)"
    },
    {
        key: "pink",
        name: "粉色",
        value: "#DB2777",
        swatch: "#DB2777",
        strong: "#BE185D",
        onPrimary: "#FFFFFF",
        gradient: "linear-gradient(135deg, #DB2777 0%, #F472B6 100%)"
    }
]);

const LIGHT_THEME_PALETTE_KEYS = Object.freeze([
    "white", "black", "red", "orange", "yellow", "green",
    "teal", "cyan", "blue", "indigo", "purple", "pink"
]);

const DARK_THEME_PALETTE_KEYS = Object.freeze([
    "black", "graphite", "red", "orange", "yellow", "green",
    "teal", "cyan", "blue", "indigo", "purple", "pink"
]);

/**
 * 明暗模式分别返回 12 个主题色：浅色包含白色，暗色明确排除白色。
 */
export function getThemePalettes(mode = "light") {
    const keys = mode === "dark" ? DARK_THEME_PALETTE_KEYS : LIGHT_THEME_PALETTE_KEYS;
    return keys.map(key => MCI_THEME_PALETTES.find(item => item.key === key)).filter(Boolean);
}

function clampChannel(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)));
}

/**
 * 规范化 3/6 位 HEX；无法识别时返回空字符串。
 */
export function normalizeHexColor(color) {
    if (typeof color !== "string") return "";
    let value = color.trim();
    if (!value) return "";
    if (value.charAt(0) !== "#") value = `#${value}`;
    if (/^#[0-9a-fA-F]{3}$/.test(value)) {
        value = `#${value.charAt(1)}${value.charAt(1)}${value.charAt(2)}${value.charAt(2)}${value.charAt(3)}${value.charAt(3)}`;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return "";
    return value.toUpperCase();
}

/**
 * 根据颜色识别标准 palette；自定义颜色返回 null。
 */
export function resolveThemePalette(color) {
    const normalized = normalizeHexColor(color);
    return MCI_THEME_PALETTES.find(item => item.value === normalized) || null;
}

/**
 * 将 HEX 颜色转换为 RGB。
 */
export function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex) || DEFAULT_THEME_COLOR;
    return {
        r: parseInt(normalized.substring(1, 3), 16),
        g: parseInt(normalized.substring(3, 5), 16),
        b: parseInt(normalized.substring(5, 7), 16)
    };
}

/**
 * 将 RGB 转换为 HEX。
 */
export function rgbToHex(r, g, b) {
    return `#${[r, g, b].map(channel => clampChannel(channel).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/**
 * 将 HEX 转为 HSL。
 */
export function hexToHsl(hex) {
    const { r, g, b } = hexToRgb(hex);
    const r1 = r / 255;
    const g1 = g / 255;
    const b1 = b / 255;
    const max = Math.max(r1, g1, b1);
    const min = Math.min(r1, g1, b1);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
        const delta = max - min;
        s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
        switch (max) {
            case r1:
                h = ((g1 - b1) / delta + (g1 < b1 ? 6 : 0)) / 6;
                break;
            case g1:
                h = ((b1 - r1) / delta + 2) / 6;
                break;
            default:
                h = ((r1 - g1) / delta + 4) / 6;
                break;
        }
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
}

/**
 * 将 HSL 转为 HEX。
 */
export function hslToHex(h, s, l) {
    let hue = h / 360;
    const saturation = s / 100;
    const lightness = l / 100;
    let r;
    let g;
    let b;
    if (saturation === 0) {
        r = g = b = lightness;
    } else {
        const hue2rgb = (p, q, t) => {
            let next = t;
            if (next < 0) next += 1;
            if (next > 1) next -= 1;
            if (next < 1 / 6) return p + (q - p) * 6 * next;
            if (next < 1 / 2) return q;
            if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
            return p;
        };
        const q = lightness < 0.5
            ? lightness * (1 + saturation)
            : lightness + saturation - lightness * saturation;
        const p = 2 * lightness - q;
        r = hue2rgb(p, q, hue + 1 / 3);
        g = hue2rgb(p, q, hue);
        b = hue2rgb(p, q, hue - 1 / 3);
    }
    return rgbToHex(r * 255, g * 255, b * 255);
}

/** 混合白色生成浅色阶。 */
export function lighten(color, percent) {
    const { r, g, b } = hexToRgb(color);
    const amount = Math.max(0, Math.min(100, percent)) / 100;
    return rgbToHex(
        r + (255 - r) * amount,
        g + (255 - g) * amount,
        b + (255 - b) * amount
    );
}

/** 混合黑色生成深色阶。 */
export function darken(color, percent) {
    const { r, g, b } = hexToRgb(color);
    const amount = Math.max(0, Math.min(100, percent)) / 100;
    return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

/**
 * 将颜色按权重混合。weight=0 返回 base，weight=1 返回 tint。
 * 暗色主题用它在稳定明度骨架上叠加低饱和主题倾向，避免整页变成高饱和色块。
 */
export function mixColors(baseColor, tintColor, weight) {
    const base = hexToRgb(baseColor);
    const tint = hexToRgb(tintColor);
    const amount = Math.max(0, Math.min(1, Number(weight) || 0));
    return rgbToHex(
        base.r + (tint.r - base.r) * amount,
        base.g + (tint.g - base.g) * amount,
        base.b + (tint.b - base.b) * amount
    );
}

function getRelativeLuminance(color) {
    const { r, g, b } = hexToRgb(color);
    const channels = [r, g, b].map(channel => {
        const value = channel / 255;
        return value <= 0.03928
            ? value / 12.92
            : Math.pow((value + 0.055) / 1.055, 2.4);
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function getContrastRatio(foreground, background) {
    const first = getRelativeLuminance(foreground);
    const second = getRelativeLuminance(background);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
}

function getReadableText(background) {
    // 纯黑/纯白二选一可保证任意实色背景至少达到 WCAG AA 的 4.5:1。
    const light = "#FFFFFF";
    const dark = "#000000";
    return getContrastRatio(light, background) >= getContrastRatio(dark, background)
        ? light
        : dark;
}

function getReadableAccent(color, background) {
    const primary = normalizeHexColor(color) || DEFAULT_THEME_COLOR;
    if (getContrastRatio(primary, background) >= 4.5) return primary;

    const { h, s, l } = hexToHsl(primary);
    const saturation = Math.max(18, Math.min(78, s));
    for (let lightness = Math.max(58, l); lightness <= 92; lightness += 3) {
        const candidate = hslToHex(h, saturation, lightness);
        if (getContrastRatio(candidate, background) >= 4.5) return candidate;
    }
    return "#F8FAFC";
}

function createDarkSurfaceTint(profile) {
    if (profile.key === "black") return "#2B3544";
    const { h, s } = hexToHsl(profile.value);
    if (s < 8) return hslToHex(220, 8, 42);
    const saturation = profile.key === "graphite"
        ? 18
        : Math.max(28, Math.min(48, s * 0.52));
    return hslToHex(h, saturation, 46);
}

function getBrightness(color) {
    const { r, g, b } = hexToRgb(color);
    return (r * 299 + g * 587 + b * 114) / 1000;
}

function createPaletteProfile(color) {
    const primary = normalizeHexColor(color) || DEFAULT_THEME_COLOR;
    const preset = resolveThemePalette(primary);
    if (preset) return preset;
    const { r, g, b } = hexToRgb(primary);
    const onPrimary = getReadableText(primary);
    return {
        key: "custom",
        name: "自定义",
        value: primary,
        swatch: primary,
        strong: darken(primary, 20),
        onPrimary,
        borderGlow: `rgba(${r}, ${g}, ${b}, 0.24)`,
        gradient: `linear-gradient(135deg, ${primary} 0%, ${lighten(primary, 24)} 100%)`
    };
}

function setProperties(root, properties) {
    Object.keys(properties).forEach(name => root.style.setProperty(name, properties[name]));
}

function applyVePlusVars(profile, surface) {
    setProperties(document.documentElement, {
        "--color-primary": profile.value,
        "--primary-hover-color": profile.strong,
        "--primary-active-color": profile.strong,
        "--primary-disabled-color": lighten(profile.value, 45),
        "--primary-outline-color": surface.primarySoft,
        "--color-text-primary": surface.ink,
        "--color-text-regular": surface.text,
        "--color-text-secondary": surface.muted,
        "--color-text-placeholder": surface.placeholder,
        "--border-color-base": surface.borderStrong,
        "--border-color-light": surface.border,
        "--border-color-lighter": surface.borderLight,
        "--border-color-extra-light": surface.soft,
        "--border-color-hover": surface.borderHover,
        "--background-color-base": surface.soft,
        "--button-default-font-color": surface.text,
        "--button-default-border-color": surface.borderStrong,
        "--button-default-background-color": surface.surface,
        "--button-default-hover-color": surface.primarySoft,
        "--button-default-hover-border": surface.borderHover,
        "--button-primary-font-color": profile.onPrimary,
        "--button-primary-border-color": profile.value,
        "--button-primary-background-color": profile.value,
        "--button-primary-hover-color": profile.strong,
        "--button-primary-active-color": profile.strong,
        "--input-font-color": surface.text,
        "--input-background-color": surface.surface,
        "--input-fill-color": surface.soft,
        "--input-icon-color": surface.muted,
        "--input-border-color": surface.border,
        "--input-border-color-hover": surface.borderHover,
        "--input-disabled-fill": surface.pageAlt,
        "--input-disabled-color": surface.muted,
        "--checkbox-font-color": surface.text,
        "--checkbox-background-color": surface.surface,
        "--radio-font-color": surface.text,
        "--radio-background-color": surface.surface,
        "--select-option-color": surface.text,
        "--select-option-hover-background": surface.soft,
        "--select-option-selected-background": surface.primarySoft,
        "--select-option-disabled-background": surface.pageAlt,
        "--menu-font-color": surface.text,
        "--menu-border-color": surface.border,
        "--menu-hover-background": surface.soft,
        "--menu-active-background": surface.primarySoft,
        "--tab-font-color": surface.ink,
        "--tab-bar-color": surface.border,
        "--tab-close-color": surface.muted,
        "--card-font-color": surface.ink,
        "--card-border-color": surface.border,
        "--pagination-font-color": surface.ink,
        "--pagination-background-color": surface.soft,
        "--pagination-background-font-color": surface.text
    });
}

function applySurfaceVars(profile, mode) {
    const root = document.documentElement;
    const { r, g, b } = hexToRgb(profile.value);
    const isDark = mode === "dark";
    let surface;
    if (isDark) {
        const tint = createDarkSurfaceTint(profile);
        const tintRgb = hexToRgb(tint);
        const sidebar = mixColors("#0B1526", tint, 0.15);
        surface = {
            tint,
            page: mixColors("#080D18", tint, 0.06),
            pageAlt: mixColors("#0B1220", tint, 0.075),
            surface: mixColors("#101827", tint, 0.09),
            header: mixColors("#0F1828", tint, 0.10),
            soft: mixColors("#152033", tint, 0.11),
            overlay: mixColors("#1B2638", tint, 0.13),
            fill: mixColors("#1D293B", tint, 0.14),
            sidebar,
            cardHover: mixColors("#172033", tint, 0.13),
            ink: "#F8FAFC",
            text: "#CBD5E1",
            muted: "#94A3B8",
            placeholder: "#718096",
            border: `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.20)`,
            borderLight: `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.10)`,
            borderStrong: `rgba(${tintRgb.r}, ${tintRgb.g}, ${tintRgb.b}, 0.30)`,
            borderHover: getReadableAccent(profile.value, sidebar),
            tooltip: mixColors("#202A3C", tint, 0.12),
            tooltipText: "#F8FAFC",
            primarySoft: `rgba(${r}, ${g}, ${b}, 0.18)`
        };
    } else {
        surface = {
            tint: profile.value,
            page: "#F7F9FC",
            pageAlt: "#EEF2F7",
            surface: "#FFFFFF",
            header: "#FFFFFF",
            soft: "#F1F5F9",
            overlay: "#FFFFFF",
            fill: "#E2E8F0",
            sidebar: profile.value,
            cardHover: "#F1F5F9",
            ink: "#0F172A",
            text: "#334155",
            muted: "#64748B",
            placeholder: "#94A3B8",
            border: "#E2E8F0",
            borderLight: "#EEF2F7",
            borderStrong: "#CBD5E1",
            borderHover: "#B9CCF8",
            tooltip: "#1E293B",
            tooltipText: "#F8FAFC",
            primarySoft: `rgba(${r}, ${g}, ${b}, 0.10)`
        };
    }

    const surfaceRgb = hexToRgb(surface.surface);
    const footerTint = isDark && profile.key === "black" ? profile.value : surface.tint;
    const footerWave = isDark
        ? mixColors(surface.sidebar, footerTint, 0.42)
        : getBrightness(profile.value) > 180
            ? mixColors(profile.value, "#0F172A", 0.18)
            : mixColors(profile.value, "#FFFFFF", 0.22);
    const footerText = getReadableText(footerWave);
    const sidebarGradient = isDark
        ? `linear-gradient(180deg, ${surface.sidebar} 0%, ${mixColors(surface.sidebar, surface.tint, 0.08)} 100%)`
        : `linear-gradient(180deg, ${profile.value} 0%, ${profile.strong} 100%)`;

    setProperties(root, {
        "--el-bg-color-page": surface.page,
        "--el-bg-color": surface.surface,
        "--el-bg-color-overlay": surface.overlay,
        "--el-fill-color-blank": surface.surface,
        "--el-fill-color-extra-light": surface.pageAlt,
        "--el-fill-color-lighter": surface.pageAlt,
        "--el-fill-color-light": surface.soft,
        "--el-fill-color": surface.fill,
        "--el-fill-color-dark": isDark ? surface.pageAlt : surface.border,
        "--el-fill-color-darker": isDark ? surface.page : surface.borderStrong,
        "--el-border-color": surface.border,
        "--el-border-color-light": surface.border,
        "--el-border-color-lighter": surface.borderLight,
        "--el-border-color-extra-light": surface.borderLight,
        "--el-border-color-dark": surface.borderStrong,
        "--el-border-color-darker": surface.borderHover,
        "--el-text-color-primary": surface.ink,
        "--el-text-color-regular": surface.text,
        "--el-text-color-secondary": surface.muted,
        "--el-text-color-placeholder": surface.placeholder,
        "--el-text-color-disabled": isDark ? "#526079" : "#A8B3C4",
        "--el-drawer-bg-color": surface.surface,
        "--el-dialog-bg-color": surface.surface,
        "--el-card-bg-color": surface.surface,
        "--el-mask-color": isDark ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.42)",
        "--el-input-bg-color": surface.surface,
        "--el-input-text-color": surface.text,
        "--el-input-border-color": surface.border,
        "--el-disabled-bg-color": surface.pageAlt,
        "--el-table-bg-color": surface.surface,
        "--el-table-tr-bg-color": surface.surface,
        "--el-table-header-bg-color": surface.soft,
        "--el-table-row-hover-bg-color": surface.primarySoft,
        "--el-table-current-row-bg-color": surface.primarySoft,
        "--el-table-border-color": surface.border,
        "--el-table-text-color": surface.text,
        "--el-table-header-text-color": surface.ink,
        "--mci-bg-base": surface.page,
        "--mci-bg-page": surface.page,
        "--mci-bg-page-alt": surface.pageAlt,
        "--mci-bg-elevated": surface.surface,
        "--mci-bg-header": surface.header,
        "--mci-bg-content": surface.surface,
        "--mci-bg-sidebar": surface.sidebar,
        "--mci-bg-overlay": surface.overlay,
        "--mci-bg-surface": surface.soft,
        "--mci-bg-soft": surface.soft,
        "--mci-bg-card": surface.surface,
        "--mci-bg-card-hover": surface.cardHover,
        "--mci-bg-primary-soft": surface.primarySoft,
        "--mci-bg-color-page": surface.page,
        "--mci-surface-rgb": `${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}`,
        "--mci-bg-glass": `rgba(${surfaceRgb.r}, ${surfaceRgb.g}, ${surfaceRgb.b}, 0.94)`,
        "--mci-bg-glass-border": surface.border,
        "--mci-bg-mask": isDark ? "rgba(2, 6, 23, 0.72)" : "rgba(15, 23, 42, 0.42)",
        "--mci-text-primary": surface.ink,
        "--mci-text-secondary": surface.text,
        "--mci-text-tertiary": surface.muted,
        "--mci-text-color": surface.ink,
        "--mci-text-color-secondary": surface.text,
        "--mci-text-disabled": isDark ? "#526079" : "#A8B3C4",
        "--mci-border-color": surface.border,
        "--mci-border-subtle": surface.borderLight,
        "--mci-divider-color": surface.borderLight,
        "--mci-border-color-hover": surface.borderHover,
        "--mci-border-strong": surface.borderStrong,
        "--mci-tooltip-bg": surface.tooltip,
        "--mci-tooltip-text": surface.tooltipText,
        "--mci-primary-color": profile.value,
        "--mci-primary-rgb": `${r}, ${g}, ${b}`,
        "--mci-gradient-surface": `linear-gradient(180deg, ${surface.surface} 0%, ${surface.pageAlt} 100%)`,
        "--mci-gradient-bg": `linear-gradient(180deg, ${surface.page} 0%, ${surface.pageAlt} 100%)`,
        "--sidebar-bg-gradient": sidebarGradient,
        "--sidebar-footer-wave-bg": footerWave,
        "--sidebar-footer-text-color": footerText,
        "--mci-shadow-card": isDark
            ? "0 12px 34px rgba(0, 0, 0, 0.28)"
            : "0 10px 30px rgba(15, 23, 42, 0.07)",
        "--mci-shadow-card-hover": isDark
            ? "0 20px 48px rgba(0, 0, 0, 0.38)"
            : "0 18px 44px rgba(15, 23, 42, 0.11)",
        "--mci-shadow-dialog": isDark
            ? "0 24px 72px rgba(0, 0, 0, 0.48)"
            : "0 24px 72px rgba(15, 23, 42, 0.18)",
        "--mci-shadow-dropdown": isDark
            ? "0 16px 42px rgba(0, 0, 0, 0.36)"
            : "0 14px 38px rgba(15, 23, 42, 0.14)"
    });

    if (isDark) {
        const sidebarHover = mixColors(surface.sidebar, surface.tint, 0.12);
        const sidebarParentActive = mixColors(surface.sidebar, surface.tint, 0.18);
        const sidebarActive = mixColors(surface.sidebar, surface.tint, 0.28);
        setProperties(root, {
            "--sidebar-bg-color": surface.sidebar,
            "--sidebar-text-color": surface.text,
            "--sidebar-hover-bg": sidebarHover,
            "--sidebar-active-bg": sidebarActive,
            "--sidebar-parent-active-bg": sidebarParentActive,
            "--sidebar-active-text-color": getReadableAccent(profile.value, sidebarActive),
            "--sidebar-opened-title-bg": "transparent",
            "--sidebar-submenu-item-bg": "transparent",
            "--sidebar-submenu-hover-bg": sidebarHover,
            "--sidebar-submenu-active-bg": sidebarActive
        });
    } else {
        setProperties(root, {
            "--sidebar-bg-color": profile.value,
            "--sidebar-text-color": profile.onPrimary,
            "--sidebar-hover-bg": getBrightness(profile.value) > 180
                ? "rgba(15, 23, 42, 0.06)"
                : "rgba(255, 255, 255, 0.15)",
            "--sidebar-parent-active-bg": getBrightness(profile.value) > 180
                ? "rgba(15, 23, 42, 0.06)"
                : "rgba(255, 255, 255, 0.12)",
            "--sidebar-active-bg": getBrightness(profile.value) > 180
                ? "rgba(15, 23, 42, 0.10)"
                : "rgba(255, 255, 255, 0.24)",
            "--sidebar-active-text-color": profile.onPrimary,
            "--sidebar-opened-title-bg": "transparent",
            "--sidebar-submenu-item-bg": "transparent",
            "--sidebar-submenu-hover-bg": getBrightness(profile.value) > 180
                ? "rgba(15, 23, 42, 0.06)"
                : "rgba(255, 255, 255, 0.15)",
            "--sidebar-submenu-active-bg": getBrightness(profile.value) > 180
                ? "rgba(15, 23, 42, 0.10)"
                : "rgba(255, 255, 255, 0.24)"
        });
    }

    applyVePlusVars(profile, surface);
}

/**
 * 设置主题色并更新所有 CSS 变量。
 */
export function setThemeColor(primaryColor) {
    const root = document.documentElement;
    const requestedProfile = createPaletteProfile(primaryColor);
    const mode = getThemeMode();
    // 暗色模式不接受白色或近白自定义主色，避免重新制造白色按钮和高亮块。
    const isNearWhiteCustom = requestedProfile.key === "custom"
        && getBrightness(requestedProfile.value) >= 245;
    const selectedProfile = mode === "dark"
        && (requestedProfile.key === "white" || isNearWhiteCustom)
        ? MCI_THEME_PALETTES.find(item => item.key === "blue")
        : requestedProfile;
    // 黑色及近黑自定义色在暗底上不可见；保留用户选择值，但将实际交互色提升为中性石板灰。
    const isNearBlackCustom = selectedProfile.key === "custom"
        && getBrightness(selectedProfile.value) <= 32;
    const useNeutralDarkAccent = mode === "dark"
        && (selectedProfile.key === "black" || isNearBlackCustom);
    const renderedProfile = useNeutralDarkAccent
        ? {
            ...selectedProfile,
            key: "black",
            value: "#64748B",
            strong: "#475569",
            borderGlow: "rgba(100, 116, 139, 0.34)",
            gradient: "linear-gradient(135deg, #64748B 0%, #475569 100%)"
        }
        : selectedProfile;
    const profile = {
        ...renderedProfile,
        onPrimary: getReadableText(renderedProfile.value)
    };
    const primary = profile.value;
    const { r, g, b } = hexToRgb(primary);
    const isDark = mode === "dark";

    // 保证 data-theme、Element Plus 的 html.dark 与令牌永远处于同一状态。
    // 首屏 Loading、HMR 或租户初始化重复应用主题色时也能自行修复类名漂移。
    root.setAttribute("data-theme", mode);
    if (isDark) {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
    root.setAttribute("data-mci-palette", selectedProfile.key);

    setProperties(root, {
        "--color-primary": primary,
        "--mci-palette-value": selectedProfile.value,
        "--color-primary-rgb": `${r}, ${g}, ${b}`,
        "--color-primary-light": lighten(primary, 15),
        "--color-primary-dark": profile.strong,
        "--color-primary-text": profile.onPrimary,
        "--theme-color": primary,
        "--el-color-primary": primary,
        "--el-color-primary-rgb": `${r}, ${g}, ${b}`,
        "--el-color-primary-dark-2": profile.strong,
        "--mci-color-primary": primary,
        "--mci-color-primary-rgb": `${r}, ${g}, ${b}`,
        "--mci-color-primary-light": lighten(primary, 25),
        "--mci-color-primary-dark": profile.strong,
        "--mci-color-primary-strong": profile.strong,
        "--mci-color-primary-glow": `rgba(${r}, ${g}, ${b}, 0.22)`,
        "--mci-text-on-primary": profile.onPrimary,
        "--mci-border-glow": profile.borderGlow || `rgba(${r}, ${g}, ${b}, 0.24)`,
        "--mci-gradient-primary": profile.gradient,
        "--mci-shadow-button": `0 10px 22px rgba(${r}, ${g}, ${b}, 0.18)`,
        "--mci-shadow-button-hover": `0 16px 34px rgba(${r}, ${g}, ${b}, 0.26)`,
        "--mci-glow-primary": `0 0 16px rgba(${r}, ${g}, ${b}, 0.22), 0 0 36px rgba(${r}, ${g}, ${b}, 0.12)`
    });

    if (isDark) {
        const { h } = hexToHsl(primary);
        setProperties(root, {
            "--el-color-primary-light-3": hslToHex(h, 42, 44),
            "--el-color-primary-light-5": hslToHex(h, 34, 32),
            "--el-color-primary-light-7": hslToHex(h, 26, 24),
            "--el-color-primary-light-8": hslToHex(h, 22, 20),
            "--el-color-primary-light-9": `rgba(${r}, ${g}, ${b}, 0.16)`
        });
    } else {
        setProperties(root, {
            "--el-color-primary-light-3": lighten(primary, 30),
            "--el-color-primary-light-5": lighten(primary, 50),
            "--el-color-primary-light-7": lighten(primary, 70),
            "--el-color-primary-light-8": lighten(primary, 80),
            "--el-color-primary-light-9": lighten(primary, 90)
        });
    }

    applySurfaceVars(profile, mode);
    return selectedProfile.value;
}

/** 切换浅色/暗色显示模式。 */
export function setThemeMode(mode) {
    const root = document.documentElement;
    const next = mode === "dark" ? "dark" : "light";
    try {
        localStorage.setItem("mci-theme", next);
    } catch (e) {}
    root.setAttribute("data-theme", next);
    if (next === "dark") {
        root.classList.add("dark");
    } else {
        root.classList.remove("dark");
    }
    return setThemeColor(getThemeColor());
}

/** 获取当前 MCI 主题模式。 */
export function getThemeMode() {
    try {
        const saved = localStorage.getItem("mci-theme");
        if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/** 获取当前主题色。 */
export function getThemeColor() {
    return normalizeHexColor(
        getComputedStyle(document.documentElement).getPropertyValue("--mci-palette-value").trim()
    ) || normalizeHexColor(
        getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim()
    ) || DEFAULT_THEME_COLOR;
}

/** 初始化主题色系统。 */
export function initThemeColor() {
    setThemeColor(getThemeColor());
}
