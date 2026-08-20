function hasConfiguredValue(config, key) {
    if (!config || typeof config !== "object" || !Object.prototype.hasOwnProperty.call(config, key)) return false;
    const value = config[key];
    return value !== null
        && value !== undefined
        && (typeof value !== "string" || value.trim() !== "");
}

function isEnabledSwitchValue(value) {
    if (value === true || value === 1) return true;
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return normalized === "1" || normalized === "true";
}

/**
 * 新字段 FormMaskBlur 使用正向语义且默认关闭。
 * 旧租户只有 DisableFormMaskBlur 时继续按旧语义回退，避免升级后视觉状态突变。
 */
export function isFormMaskBlurEnabled(sysConfig) {
    if (hasConfiguredValue(sysConfig, "FormMaskBlur")) {
        return isEnabledSwitchValue(sysConfig.FormMaskBlur);
    }
    if (hasConfiguredValue(sysConfig, "DisableFormMaskBlur")) {
        return !isEnabledSwitchValue(sysConfig.DisableFormMaskBlur);
    }
    return false;
}

export function isFormMaskBlurDisabled(sysConfig) {
    return !isFormMaskBlurEnabled(sysConfig);
}
