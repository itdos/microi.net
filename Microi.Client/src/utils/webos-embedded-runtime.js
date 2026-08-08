export const WEBOS_WINDOW_RUNTIME_NAME_PREFIX = 'microi-webos-window:';

export function isEmbeddedWebosWindowRuntime(browserWindow = typeof window === 'undefined' ? null : window) {
    if (!browserWindow) return false;
    const name = String(browserWindow?.name || '');
    const nonce = name.startsWith(WEBOS_WINDOW_RUNTIME_NAME_PREFIX)
        ? name.slice(WEBOS_WINDOW_RUNTIME_NAME_PREFIX.length)
        : '';
    if (!/^[a-f0-9]{32}$/.test(nonce) || browserWindow.self === browserWindow.top) return false;
    try {
        return browserWindow.parent.location.origin === browserWindow.location.origin;
    } catch (error) {
        return false;
    }
}
