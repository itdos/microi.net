const RENDER_SOURCE_TYPES = new Set(["microservice", "custom"]);

const WATERMARK_DIRECTIONS = {
    diagonalup: { value: "DiagonalUp", rotate: -22 },
    diagonaldown: { value: "DiagonalDown", rotate: 22 },
    horizontal: { value: "Horizontal", rotate: 0 }
};

const WATERMARK_DENSITIES = {
    compact: { value: "Compact", gap: [96, 72] },
    comfortable: { value: "Comfortable", gap: [152, 112] },
    sparse: { value: "Sparse", gap: [232, 168] }
};

function asTrimmedString(value) {
    return value == null ? "" : String(value).trim();
}

function asSafeDisplayString(value) {
    const normalized = asTrimmedString(value);
    return /^(?:undefined|null)$/i.test(normalized) ? "" : normalized;
}

function firstSafeDisplayString(...values) {
    for (const value of values) {
        const normalized = asSafeDisplayString(value);
        if (normalized) return normalized;
    }
    return "";
}

function clampPositiveNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(max, Math.max(min, parsed));
}

export function isExplicitlyEnabled(value) {
    if (value === true || value === 1) return true;
    const normalized = asTrimmedString(value).toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function normalizeRenderSourceType(value) {
    const normalized = asTrimmedString(value).toLowerCase().replace(/[\s_-]+/g, "");
    if (normalized === "microservice" || normalized === "microapp") return "microservice";
    if (normalized === "custom" || normalized === "customcomponent" || normalized === "devcomponent") return "custom";
    return "";
}

export function resolveMenuRenderSource(item = {}) {
    const explicit = normalizeRenderSourceType(item.RenderSourceType);
    if (explicit) return explicit;

    const openType = asTrimmedString(item.OpenType).toLowerCase().replace(/[\s_-]+/g, "");
    const componentPath = asTrimmedString(item.ComponentPath).replace(/\\/g, "/").toLowerCase();
    const legacyMicroService = item.IsMicroiService === true
        || item.IsMicroiService === 1
        || asTrimmedString(item.IsMicroiService).toLowerCase() === "true"
        || asTrimmedString(item.IsMicroiService) === "1";
    if (["microapp", "microservice"].includes(openType)
        || legacyMicroService
        || componentPath.includes("/micro-app/host")) {
        return "microservice";
    }

    if (["custom", "customcomponent", "devcomponent"].includes(openType)
        || componentPath.includes("/custom/")
        || componentPath.includes("/customer/")
        || componentPath.includes("/project/")
        || componentPath.includes("/tenant/")) {
        return "custom";
    }
    return "";
}

export function resolveRouteRenderSource(meta = {}) {
    const explicit = normalizeRenderSourceType(meta.RenderSourceType);
    if (explicit) return explicit;
    if (meta.microAppHost === true) return "microservice";
    return resolveMenuRenderSource(meta);
}

export function resolveDevComponentRenderSource(componentRecord = {}) {
    const explicit = normalizeRenderSourceType(componentRecord.RenderSource);
    if (explicit) return explicit;
    return asTrimmedString(componentRecord.Path) ? "custom" : "";
}

function formatDate(date, withTime) {
    const pad = value => String(value).padStart(2, "0");
    const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    if (!withTime) return day;
    return `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function renderFrameworkWatermarkContent(template, context = {}, now = new Date()) {
    const account = asSafeDisplayString(context.Account);
    const values = {
        SysTitle: asSafeDisplayString(context.SysTitle),
        SysShortTitle: asSafeDisplayString(context.SysShortTitle),
        UserName: firstSafeDisplayString(context.UserName, account),
        Account: account,
        Date: formatDate(now, false),
        DateTime: formatDate(now, true)
    };
    const source = asTrimmedString(template);
    if (!source) {
        const systemTitle = values.SysTitle || values.SysShortTitle || "Microi吾码";
        return [systemTitle, values.UserName].filter(Boolean).join(" - ").slice(0, 160);
    }
    const replaceToken = (_match, key) => values[key] || "";
    const rendered = source
        .replace(/\$(SysTitle|SysShortTitle|UserName|Account|DateTime|Date)\$/g, replaceToken)
        .replace(/\{\{\s*(SysTitle|SysShortTitle|UserName|Account|DateTime|Date)\s*\}\}/g, replaceToken)
        .replace(/[\u0000-\u001f\u007f]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/^\s*(?:[·|]|-\s)\s*|\s*(?:[·|]|\s-)\s*$/g, "")
        .trim();
    return (rendered || values.SysTitle || values.SysShortTitle || "Microi吾码").slice(0, 160);
}

export function resolveFrameworkWatermarkSettings(sysConfig = {}, context = {}, now = new Date()) {
    const directionKey = asTrimmedString(sysConfig?.FrameworkWatermarkDirection).toLowerCase().replace(/[\s_-]+/g, "");
    const densityKey = asTrimmedString(sysConfig?.FrameworkWatermarkDensity).toLowerCase();
    const direction = WATERMARK_DIRECTIONS[directionKey] || WATERMARK_DIRECTIONS.diagonalup;
    const density = WATERMARK_DENSITIES[densityKey] || WATERMARK_DENSITIES.comfortable;
    const opacityPercent = clampPositiveNumber(sysConfig?.FrameworkWatermarkOpacity, 30, 1, 100);
    const fontSize = clampPositiveNumber(sysConfig?.FrameworkWatermarkFontSize, 14, 8, 72);

    return {
        enabled: isExplicitlyEnabled(sysConfig?.FrameworkWatermarkEnabled),
        content: renderFrameworkWatermarkContent(sysConfig?.FrameworkWatermarkContent, {
            SysTitle: context.SysTitle || sysConfig?.SysTitle,
            SysShortTitle: context.SysShortTitle || sysConfig?.SysShortTitle,
            UserName: context.UserName,
            Account: context.Account
        }, now),
        direction: direction.value,
        rotate: direction.rotate,
        density: density.value,
        gap: [...density.gap],
        opacity: opacityPercent / 100,
        opacityPercent,
        fontSize
    };
}

export const FRAMEWORK_WATERMARK_DEFAULTS = Object.freeze({
    content: "$SysTitle$ - $UserName$",
    direction: "DiagonalUp",
    density: "Comfortable",
    opacity: 30,
    fontSize: 14
});

export const RENDER_SOURCE_TYPE_VALUES = Object.freeze([...RENDER_SOURCE_TYPES]);
