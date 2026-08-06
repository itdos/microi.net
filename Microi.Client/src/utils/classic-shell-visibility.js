const CLASSIC_SHELL_PARAMS = ["ShowClassicTop", "ShowClassicLeft"];

function safeDecode(value) {
    try {
        return decodeURIComponent(String(value).replace(/\+/g, "%20"));
    } catch {
        return String(value);
    }
}

function readParam(href, name) {
    const source = String(href || "");
    const candidates = [source];
    const decoded = safeDecode(source);
    if (decoded !== source) candidates.push(decoded);

    const pattern = new RegExp("(?:[?&;])" + name + "=([^&#;]*)", "i");
    for (const candidate of candidates) {
        const match = pattern.exec(candidate);
        if (match) return safeDecode(match[1]);
    }
    return null;
}

function isHiddenValue(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return normalized === "0" || normalized === "false";
}

export function resolveClassicShellVisibility(href) {
    const topValue = readParam(href, "ShowClassicTop");
    const leftValue = readParam(href, "ShowClassicLeft");
    return {
        ShowClassicTop: isHiddenValue(topValue) ? 0 : 1,
        ShowClassicLeft: isHiddenValue(leftValue) ? 0 : 1,
        hasClassicShellParams: topValue !== null || leftValue !== null,
        hasHiddenClassicShell: isHiddenValue(topValue) || isHiddenValue(leftValue)
    };
}

export function syncClassicShellVisibilityFromUrl(diyStore, href) {
    const visibility = resolveClassicShellVisibility(href);
    if (!diyStore || diyStore.IsTabFullScreen) return visibility;

    if (diyStore.ShowClassicTop !== visibility.ShowClassicTop) {
        diyStore.setState("ShowClassicTop", visibility.ShowClassicTop);
    }
    if (diyStore.ShowClassicLeft !== visibility.ShowClassicLeft) {
        diyStore.setState("ShowClassicLeft", visibility.ShowClassicLeft);
    }
    return visibility;
}

function deleteClassicShellParams(searchParams) {
    const keys = Array.from(searchParams.keys());
    for (const key of keys) {
        if (CLASSIC_SHELL_PARAMS.some((name) => name.toLowerCase() === key.toLowerCase())) {
            searchParams.delete(key);
        }
    }
}

export function removeClassicShellParamsFromUrl(href) {
    const source = String(href || "");
    try {
        const url = new URL(source, "http://localhost");
        deleteClassicShellParams(url.searchParams);

        const hash = url.hash || "";
        const queryIndex = hash.indexOf("?");
        if (queryIndex >= 0) {
            const hashPath = hash.slice(0, queryIndex);
            const hashParams = new URLSearchParams(hash.slice(queryIndex + 1));
            deleteClassicShellParams(hashParams);
            const nextHashQuery = hashParams.toString();
            url.hash = hashPath + (nextHashQuery ? "?" + nextHashQuery : "");
        }
        return url.href;
    } catch {
        return source;
    }
}

export function exitClassicShellUrlMode(diyStore, href, replaceUrl) {
    if (!diyStore || diyStore.IsTabFullScreen) return false;

    const visibility = resolveClassicShellVisibility(href);
    const shellIsHidden = diyStore.ShowClassicTop === 0
        || diyStore.ShowClassicLeft === 0
        || visibility.hasHiddenClassicShell;
    if (!shellIsHidden) return false;

    diyStore.setState("ShowClassicTop", 1);
    diyStore.setState("ShowClassicLeft", 1);

    const cleanUrl = removeClassicShellParamsFromUrl(href);
    if (typeof replaceUrl === "function" && cleanUrl !== String(href || "")) {
        replaceUrl(cleanUrl);
    }
    return true;
}
