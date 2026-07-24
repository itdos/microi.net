export const legacySysMenuConfigFields = Object.freeze([
    "SelectApi",
    "AddBtnText",
    "SaveBtnText",
    "AddBtnType",
    "SaveType",
    "HiddenIndex",
    "GeneralSeaarch",
    "ImportApi",
    "ImportProgressApi",
    "ExportApi"
]);

function hasValue(value) {
    return value !== null && value !== undefined && !(typeof value === "string" && value.trim() === "");
}

export function applyLegacySysMenuConfigFallback(menu) {
    if (!menu || typeof menu !== "object") return menu;

    let config = menu.DiyConfig;
    if (typeof config === "string") {
        if (!config.trim()) return menu;
        try {
            config = JSON.parse(config);
        } catch (error) {
            console.warn("sys_menu.DiyConfig 不是合法JSON，已保留物理字段值。", error);
            return menu;
        }
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) return menu;

    legacySysMenuConfigFields.forEach(function (field) {
        if (!hasValue(menu[field]) && hasValue(config[field])) {
            menu[field] = config[field];
        }
    });
    return menu;
}
