/** Image-only brands need the sidebar width, not a square app-icon slot. */
export function resolveSidebarLogoLayout(configuredHeight, imageOnly, collapsed) {
    const raw = String(configuredHeight ?? "").trim();
    const numeric = /^(?:\d+(?:\.\d+)?)(?:px)?$/i.test(raw) ? Number.parseFloat(raw) : 0;
    const height = numeric > 0 && Number.isFinite(numeric) ? Math.min(numeric, 240) : 40;
    const visibleHeight = collapsed ? Math.min(height, 40) : height;
    return {
        height: `${visibleHeight}px`,
        width: imageOnly && !collapsed ? "100%" : `${visibleHeight}px`,
        containerHeight: `${Math.max(63, visibleHeight + 16)}px`
    };
}
