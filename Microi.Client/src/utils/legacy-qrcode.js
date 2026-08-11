const DEFAULT_CARD_COLOR = "#3161a6";
const DEFAULT_QR_COLOR = "#000000";
const NAMED_QR_COLORS = Object.freeze({
    black: "#000000",
    white: "#ffffff",
    red: "#ff0000",
    green: "#008000",
    blue: "#0000ff",
    orange: "#ffa500",
    purple: "#800080",
    gray: "#808080",
    grey: "#808080",
    yellow: "#ffff00"
});

let qrCodeModulePromise;
let fileSaverModulePromise;

function toDisplayText(value) {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") {
        if (value.Value !== undefined) return toDisplayText(value.Value);
        if (value.Label !== undefined) return toDisplayText(value.Label);
        try {
            return JSON.stringify(value);
        } catch (error) {
            return String(value);
        }
    }
    return String(value);
}

function normalizeCssColor(value, fallback) {
    const text = toDisplayText(value).trim();
    if (!text) return fallback;
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
    if (/^[a-z]+$/i.test(text)) return text;
    if (/^(rgb|hsl)a?\([^)]+\)$/i.test(text)) return text;
    return fallback;
}

function toHexByte(value) {
    return Math.max(0, Math.min(255, Math.round(Number(value) || 0)))
        .toString(16)
        .padStart(2, "0");
}

function normalizeQrColor(value, fallback) {
    const text = toDisplayText(value).trim().toLowerCase();
    if (!text) return fallback;
    if (/^#[0-9a-f]{3,8}$/i.test(text)) return text;
    if (NAMED_QR_COLORS[text]) return NAMED_QR_COLORS[text];

    const rgb = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+)\s*)?\)$/i);
    if (rgb) {
        const alpha = rgb[4] === undefined ? "" : toHexByte(Number(rgb[4]) * 255);
        return `#${toHexByte(rgb[1])}${toHexByte(rgb[2])}${toHexByte(rgb[3])}${alpha}`;
    }
    return fallback;
}

export function sanitizeQrCodeFileName(value) {
    const normalized = toDisplayText(value)
        .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
        .replace(/[.\s]+$/g, "")
        .trim();
    return (normalized || "qrcode").slice(0, 120);
}

export function normalizeLegacyQrCodePayload(item = {}, config = {}) {
    const sourceFields = Array.isArray(item.fields)
        ? item.fields
        : (Array.isArray(item.DataConfig) ? item.DataConfig : []);
    const fields = sourceFields.map((field) => ({
        label: toDisplayText(field?.Label ?? field?.label),
        value: toDisplayText(field?.Value ?? field?.key)
    }));
    const title = toDisplayText(item.title);
    const titleValue = toDisplayText(item.titleValue);
    const separator = title && titleValue && !/[：:]$/.test(title)
        ? toDisplayText(config.titleSeparator ?? ":")
        : "";

    return {
        code: toDisplayText(item.Code ?? item.code),
        color: normalizeQrColor(config.Color ?? config.color ?? item.Color ?? item.color, DEFAULT_QR_COLOR),
        cardColor: normalizeCssColor(config.CardColor ?? config.cardColor ?? item.CardColor, DEFAULT_CARD_COLOR),
        title,
        titleValue,
        titleText: `${title}${separator}${titleValue}`,
        fields,
        fileName: sanitizeQrCodeFileName(item.fileName ?? item.FileName ?? titleValue),
        createTime: config.createTime ?? item.createTime ?? false
    };
}

async function loadQrCodeModule() {
    if (!qrCodeModulePromise) {
        qrCodeModulePromise = import("qrcode").then((module) => module.default || module);
    }
    return qrCodeModulePromise;
}

async function loadFileSaver() {
    if (!fileSaverModulePromise) {
        fileSaverModulePromise = import("file-saver").then((module) => module.saveAs || module.default?.saveAs || module.default);
    }
    return fileSaverModulePromise;
}

function wrapCanvasText(context, text, maxWidth) {
    const value = toDisplayText(text);
    if (!value) return [""];
    const lines = [];
    let current = "";
    for (const char of value) {
        const candidate = current + char;
        if (current && context.measureText(candidate).width > maxWidth) {
            lines.push(current);
            current = char;
        } else {
            current = candidate;
        }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
}

function drawFittedTitle(context, text, centerX, centerY, maxWidth) {
    let fontSize = 24;
    context.font = `${fontSize}px Arial, "Microsoft YaHei", sans-serif`;
    while (fontSize > 14 && context.measureText(text).width > maxWidth) {
        fontSize -= 1;
        context.font = `${fontSize}px Arial, "Microsoft YaHei", sans-serif`;
    }
    let output = text;
    while (output.length > 1 && context.measureText(output).width > maxWidth) {
        output = `${output.slice(0, -2)}…`;
    }
    context.fillText(output, centerX, centerY);
}

export async function createLegacyQrCodeCardCanvas(item = {}, config = {}) {
    if (typeof document === "undefined") {
        throw new Error("二维码图片只能在浏览器中生成");
    }

    const payload = normalizeLegacyQrCodePayload(item, config);
    if (!payload.code) {
        throw new Error("二维码内容为空");
    }

    const width = 400;
    const headerHeight = 56;
    const qrSize = 260;
    const bodyPaddingTop = 25;
    const bodyPaddingBottom = 25;
    const textGap = payload.fields.length ? 14 : 0;
    const lineHeight = 31;
    const footerHeight = 32;
    const scale = Math.max(1, Math.min(3, Number(config.scale) || 2));

    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    measureContext.font = '20px Arial, "Microsoft YaHei", sans-serif';
    const fieldLines = payload.fields.map((field) => wrapCanvasText(
        measureContext,
        `${field.label}${field.value}`,
        width - 48
    ));
    const textHeight = fieldLines.reduce((total, lines) => total + lines.length * lineHeight, 0);
    const bodyHeight = bodyPaddingTop + qrSize + textGap + textHeight + bodyPaddingBottom;
    const height = headerHeight + bodyHeight + footerHeight;

    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    context.scale(scale, scale);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);

    context.fillStyle = payload.cardColor;
    context.fillRect(0, 0, width, headerHeight);
    context.fillStyle = "#ffffff";
    context.textAlign = "center";
    context.textBaseline = "middle";
    drawFittedTitle(context, payload.titleText, width / 2, headerHeight / 2, width - 28);

    context.strokeStyle = payload.cardColor;
    context.lineWidth = 1;
    context.strokeRect(0.5, headerHeight + 0.5, width - 1, bodyHeight - 1);

    const qrCode = await loadQrCodeModule();
    const qrCanvas = document.createElement("canvas");
    await qrCode.toCanvas(qrCanvas, payload.code, {
        width: qrSize * scale,
        margin: 1,
        errorCorrectionLevel: "H",
        color: {
            dark: payload.color,
            light: "#ffffff"
        }
    });
    context.drawImage(qrCanvas, (width - qrSize) / 2, headerHeight + bodyPaddingTop, qrSize, qrSize);

    context.fillStyle = "#202124";
    context.font = '20px Arial, "Microsoft YaHei", sans-serif';
    let textY = headerHeight + bodyPaddingTop + qrSize + textGap + lineHeight / 2;
    for (const lines of fieldLines) {
        for (const line of lines) {
            context.fillText(line, width / 2, textY);
            textY += lineHeight;
        }
    }

    context.fillStyle = payload.cardColor;
    context.fillRect(0, headerHeight + bodyHeight, width, footerHeight);
    return canvas;
}

export async function createLegacyQrCodeCardDataUrl(item = {}, config = {}) {
    const canvas = await createLegacyQrCodeCardCanvas(item, config);
    return canvas.toDataURL("image/png");
}

function canvasToPng(canvas) {
    return new Promise((resolve) => {
        if (typeof canvas.toBlob !== "function") {
            resolve(canvas.toDataURL("image/png"));
            return;
        }
        canvas.toBlob((blob) => resolve(blob || canvas.toDataURL("image/png")), "image/png");
    });
}

export async function downloadLegacyQrCode(data, config = {}) {
    const rows = Array.isArray(data) ? data.filter(Boolean) : (data ? [data] : []);
    if (!rows.length) {
        throw new Error("没有可下载的二维码数据");
    }

    const saveAs = await loadFileSaver();
    if (typeof saveAs !== "function") {
        throw new Error("二维码下载组件加载失败");
    }

    for (const item of rows) {
        const payload = normalizeLegacyQrCodePayload(item, config);
        const canvas = await createLegacyQrCodeCardCanvas(item, config);
        const image = await canvasToPng(canvas);
        const timestamp = payload.createTime ? `-${Date.now()}` : "";
        saveAs(image, `${payload.fileName}${timestamp}.png`);
    }
    return { Code: 1, Count: rows.length };
}

export function installLegacyQrCodeDownload(target = globalThis, options = {}) {
    if (!target || typeof target !== "object") return null;
    if (typeof target.downloadQRCode === "function" && target.downloadQRCode.__microiQrCodeBridge !== true) {
        return target.downloadQRCode;
    }

    const bridge = function (data, config = {}) {
        return downloadLegacyQrCode(data, config)
            .then((result) => {
                options.notify?.(`已下载 ${result.Count} 个二维码`, "success");
                return result;
            })
            .catch((error) => {
                const message = error?.message || "二维码下载失败";
                options.notify?.(message, "error");
                console.error("[Microi QRCode]", error);
                return { Code: 0, Msg: message };
            });
    };
    Object.defineProperty(bridge, "__microiQrCodeBridge", { value: true });
    target.downloadQRCode = bridge;
    return bridge;
}
