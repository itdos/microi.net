function menuText(value, maxLength) {
    if (typeof value !== "string" && typeof value !== "number") return "";
    return String(value).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, maxLength);
}

/**
 * 占位页只展示框架已授权菜单的身份，不从 URL 读取标题、百分比或完成状态。
 * 页面本身不查询业务数据；Vue 文本插值继续负责转义标题，避免把菜单名称当作 HTML。
 */
export function resolveDevelopingMenu(route = {}) {
    return {
        title: menuText(route?.meta?.title, 160) || "当前功能",
        menuId: menuText(route?.meta?.Id, 128)
    };
}
