const UPLOAD_COMPONENTS = new Set(["ImgUpload", "FileUpload"]);

export const SPECIAL_TABLE_COMPONENTS = new Set([
    "ImgUpload",
    "FileUpload",
    "TableChild",
    "Map",
    "MapArea",
    "Qrcode",
    "FontAwesome",
    "Rate",
    "Progress",
    "Slider",
    "Switch",
    "Html",
    "RichText",
    "CodeEditor",
    "JsonTable",
    "ColorPicker",
    "OpenTable",
    "JoinTable",
    "JoinForm"
]);

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch (error) {
        return null;
    }
}

function normalizeConfig(config) {
    if (!config) return {};
    if (typeof config === "string") {
        return safeJsonParse(config) || {};
    }
    return typeof config === "object" ? config : {};
}

function fileNameFromPath(path) {
    const cleanPath = String(path || "").split(/[?#]/)[0].replace(/\\/g, "/");
    const name = cleanPath.substring(cleanPath.lastIndexOf("/") + 1);
    if (!name) return "文件";
    try {
        return decodeURIComponent(name);
    } catch (error) {
        return name;
    }
}

function normalizeUploadItem(item) {
    if (item === null || item === undefined || item === "") return null;
    if (typeof item === "string") {
        const path = item.trim();
        if (!path) return null;
        return { Path: path, Name: fileNameFromPath(path), Raw: item };
    }
    if (typeof item !== "object") return null;

    const path = item.Path || item.FilePathName || item.FullPath || item.Url || item.url || item.src || "";
    if (!path) return null;
    return {
        ...item,
        Path: String(path),
        Name: item.Name || item.FileName || item.name || fileNameFromPath(path),
        Raw: item
    };
}

/**
 * Normalize every historical upload value accepted by Microi fields:
 * plain path, JSON object, JSON array, object or array.
 */
export function normalizeUploadItems(value) {
    if (value === null || value === undefined || value === "") return [];
    if (Array.isArray(value)) {
        return value.flatMap(normalizeUploadItems).filter(Boolean);
    }
    if (typeof value === "object") {
        const normalized = normalizeUploadItem(value);
        return normalized ? [normalized] : [];
    }

    const text = String(value).trim();
    if (!text) return [];
    if (text.startsWith("[") || text.startsWith("{")) {
        const parsed = safeJsonParse(text);
        if (parsed !== null) return normalizeUploadItems(parsed);
    }
    const normalized = normalizeUploadItem(text);
    return normalized ? [normalized] : [];
}

export function getFieldConfig(field) {
    return normalizeConfig(field && field.Config);
}

export function getUploadConfig(field) {
    const config = getFieldConfig(field);
    const component = field && field.Component;
    if (!UPLOAD_COMPONENTS.has(component)) return {};
    return normalizeConfig(config[component] || config.Upload);
}

export function isPrivateUploadField(field) {
    const limit = getUploadConfig(field).Limit;
    return limit === true || limit === 1 || String(limit).toLowerCase() === "true";
}

export function isSpecialTableField(field) {
    return !!(field && SPECIAL_TABLE_COMPONENTS.has(field.Component));
}

export function getFieldValue(row, field) {
    if (!row || !field) return "";
    return row[field.AsName || field.Name];
}

export function stripHtmlText(value) {
    return String(value || "")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/\s+/g, " ")
        .trim();
}

export function getFileExtension(item) {
    const source = (item && (item.Name || item.Path)) || "";
    const clean = String(source).split(/[?#]/)[0];
    const index = clean.lastIndexOf(".");
    return index > -1 ? clean.substring(index + 1).toLowerCase() : "";
}

export function getFileIcon(item) {
    const ext = getFileExtension(item);
    if (["pdf"].includes(ext)) return "far fa-file-pdf";
    if (["doc", "docx", "rtf"].includes(ext)) return "far fa-file-word";
    if (["xls", "xlsx", "csv"].includes(ext)) return "far fa-file-excel";
    if (["ppt", "pptx"].includes(ext)) return "far fa-file-powerpoint";
    if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "far fa-file-archive";
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return "far fa-file-image";
    if (["mp3", "wav", "aac", "flac", "m4a"].includes(ext)) return "far fa-file-audio";
    if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "far fa-file-video";
    if (["js", "ts", "vue", "css", "html", "json", "xml", "cs", "java", "py"].includes(ext)) return "far fa-file-code";
    if (["txt", "md", "log"].includes(ext)) return "far fa-file-lines";
    return "far fa-file";
}

export function formatFileSize(size) {
    const bytes = Number(size);
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export function summarizeJsonValue(value) {
    if (value === null || value === undefined || value === "") return { label: "暂无数据", count: 0, pretty: "" };
    let parsed = value;
    if (typeof value === "string") {
        parsed = safeJsonParse(value);
        if (parsed === null) return { label: "JSON 数据", count: 0, pretty: value };
    }
    const count = Array.isArray(parsed) ? parsed.length : (parsed && typeof parsed === "object" ? Object.keys(parsed).length : 0);
    let pretty = "";
    try {
        pretty = JSON.stringify(parsed, null, 2);
    } catch (error) {
        pretty = String(value);
    }
    return {
        label: Array.isArray(parsed) ? `${count} 行数据` : `${count} 个字段`,
        count,
        pretty
    };
}

export function normalizePercentage(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, number));
}
