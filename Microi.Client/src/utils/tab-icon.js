const DEFAULT_TAB_ICONS = Object.freeze([
    "far fa-folder-open",
    "fas fa-layer-group",
    "far fa-file-lines",
    "fas fa-table-cells-large",
    "fas fa-chart-line",
    "fas fa-sliders",
    "fas fa-link",
    "fas fa-shield-halved",
    "fas fa-clock-rotate-left",
    "fas fa-ellipsis"
]);

/**
 * Resolve a configured tab icon while keeping icon-less tabs visually distinct.
 * The index is stable for a rendered tab collection and cycles after ten items.
 */
export function resolveTabIcon(icon, index = 0) {
    const configured = String(icon || "").trim();
    if (configured) return configured;
    const normalizedIndex = Math.max(0, Number(index) || 0) % DEFAULT_TAB_ICONS.length;
    return DEFAULT_TAB_ICONS[normalizedIndex];
}

export { DEFAULT_TAB_ICONS };
