import { resolveLoginResourceUrl } from "./login-branding.js";

function readWallpaperField(row, names) {
    if (!row || typeof row !== "object") return "";
    for (const name of names) {
        if (Object.prototype.hasOwnProperty.call(row, name) && row[name] != null) {
            return row[name];
        }
    }
    return "";
}

export function normalizeLoginWallpapers(rows, getServerPath) {
    if (!Array.isArray(rows)) return [];

    const seen = new Set();
    const result = [];
    rows.forEach((row, index) => {
        const rawImage = readWallpaperField(row, ["ImgUrl", "imgUrl", "IMGURL", "Path", "path", "Url", "url"]);
        const url = resolveLoginResourceUrl(rawImage, getServerPath);
        if (!url || seen.has(url)) return;
        seen.add(url);
        result.push({
            Id: String(readWallpaperField(row, ["Id", "id", "ID"]) || `wallpaper-${index}`),
            Name: String(readWallpaperField(row, ["Name", "name", "NAME"]) || "随机壁纸"),
            Category: String(readWallpaperField(row, ["Category", "category", "CATEGORY"]) || ""),
            Url: url
        });
    });
    return result;
}

export function pickNextLoginWallpaper(wallpapers, currentUrl = "", random = Math.random) {
    if (!Array.isArray(wallpapers) || wallpapers.length === 0) return null;
    const candidates = wallpapers.length > 1
        ? wallpapers.filter((item) => item && item.Url !== currentUrl)
        : wallpapers.filter(Boolean);
    if (candidates.length === 0) return wallpapers[0] || null;

    const raw = Number(typeof random === "function" ? random() : Math.random());
    const normalized = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 0.999999999)) : 0;
    return candidates[Math.floor(normalized * candidates.length)] || candidates[0];
}
