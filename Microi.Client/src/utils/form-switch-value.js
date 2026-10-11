/**
 * 把开关值投影为 Element Plus 使用的 0/1。仅字段显式声明
 * Config.Switch.NullValue=1 时，空值在界面显示为开启；这里不写回表单模型，
 * 以免用户只打开/保存表单就把旧租户的 NULL 持久化为 1。
 */
function isEmptySwitchValue(value) {
    return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

export function hasSwitchNullValueEnabled(field) {
    let config = field?.Config;
    if (typeof config === "string") {
        try { config = JSON.parse(config); } catch (_error) { return false; }
    }
    const nullValue = config?.Switch?.NullValue;
    return nullValue === 1 || nullValue === "1";
}

export function normalizeFormSwitchValue(value, field) {
    if (isEmptySwitchValue(value)) return hasSwitchNullValueEnabled(field) ? 1 : 0;
    if (value === true || value === 1) return 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return normalized === "1" || normalized === "true" ? 1 : 0;
    }
    return 0;
}

/**
 * 加载表单数据时仅保留明确配置了空值继承的原值；显示层另行投影为 1。
 * 其它 Switch 仍按旧规则把空值写入表单模型为 0。
 */
export function prepareFormSwitchModelValue(value, field) {
    if (isEmptySwitchValue(value) && hasSwitchNullValueEnabled(field)) return value;
    return normalizeFormSwitchValue(value);
}

export default normalizeFormSwitchValue;
