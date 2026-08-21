export const MENU_CHILD_EXPAND_MODE = Object.freeze({
    DOWN: "Down",
    RIGHT: "Right"
});

const RIGHT_MODE_ALIASES = new Set([
    "right",
    "flyout",
    "horizontal",
    "向右展开"
]);

/**
 * Keep old tenants on the historical downward mode when the setting is absent
 * or contains an unsupported value.
 */
export function normalizeMenuChildExpandMode(value) {
    const normalized = String(value ?? "").trim().toLowerCase();
    return RIGHT_MODE_ALIASES.has(normalized)
        ? MENU_CHILD_EXPAND_MODE.RIGHT
        : MENU_CHILD_EXPAND_MODE.DOWN;
}

export function isRightMenuChildExpandMode(value) {
    return normalizeMenuChildExpandMode(value) === MENU_CHILD_EXPAND_MODE.RIGHT;
}
