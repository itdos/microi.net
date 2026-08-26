function normalizeRuntimeVersion(value) {
    const text = String(value ?? "").trim();
    if (!text || text === "未知") return "v--";
    return `v${text.replace(/^v/i, "")}`;
}

export function buildRuntimeVersionText({ backendVersion, frontendVersion } = {}) {
    const apiVersion = normalizeRuntimeVersion(backendVersion);
    const webVersion = normalizeRuntimeVersion(frontendVersion);
    return `Api ${apiVersion} - Web ${webVersion}`;
}
