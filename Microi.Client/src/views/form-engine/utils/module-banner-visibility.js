// 老菜单没有开关字段时继续显示，兼容已安装的历史应用包。
export function isModuleBannerHidden(value) {
    return value === true || value === 1 || value === "1" || value === "true";
}
