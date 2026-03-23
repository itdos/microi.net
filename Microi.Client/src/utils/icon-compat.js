/**
 * Element UI 到 Element Plus 图标兼容层
 * 将 el-icon-xxx 格式映射到 Element Plus 图标组件名
 * 支持 FontAwesome 图标转换
 */
import * as Icons from "@element-plus/icons-vue";

// FontAwesome 图标 -> Element Plus 图标组件名 映射表
const faIconMapping = {
    // 常用 FontAwesome 图标映射
    "fa-tasks": "List",
    "fa-table": "Grid",
    "fa-check": "Check",
    "fa-check-circle": "CircleCheck",
    "fa-times": "Close",
    "fa-times-circle": "CircleClose",
    "fa-plus": "Plus",
    "fa-plus-circle": "CirclePlus",
    "fa-minus": "Minus",
    "fa-minus-circle": "Remove",
    "fa-edit": "Edit",
    "fa-pen": "Edit",
    "fa-pencil": "EditPen",
    "fa-pencil-alt": "EditPen",
    "fa-trash": "Delete",
    "fa-trash-alt": "Delete",
    "fa-search": "Search",
    "fa-save": "DocumentChecked",
    "fa-download": "Download",
    "fa-upload": "Upload",
    "fa-file": "Document",
    "fa-file-alt": "Document",
    "fa-folder": "Folder",
    "fa-folder-open": "FolderOpened",
    "fa-user": "User",
    "fa-user-circle": "Avatar",
    "fa-users": "UserFilled",
    "fa-cog": "Setting",
    "fa-cogs": "Tools",
    "fa-wrench": "Tools",
    "fa-home": "House",
    "fa-bell": "Bell",
    "fa-envelope": "Message",
    "fa-comment": "Comment",
    "fa-comments": "ChatDotSquare",
    "fa-calendar": "Calendar",
    "fa-calendar-alt": "Calendar",
    "fa-clock": "Clock",
    "fa-history": "Timer",
    "fa-sync": "Refresh",
    "fa-sync-alt": "Refresh",
    "fa-redo": "RefreshRight",
    "fa-undo": "RefreshLeft",
    "fa-arrow-up": "ArrowUp",
    "fa-arrow-down": "ArrowDown",
    "fa-arrow-left": "ArrowLeft",
    "fa-arrow-right": "ArrowRight",
    "fa-angle-up": "ArrowUp",
    "fa-angle-down": "ArrowDown",
    "fa-angle-left": "ArrowLeft",
    "fa-angle-right": "ArrowRight",
    "fa-chevron-up": "ArrowUpBold",
    "fa-chevron-down": "ArrowDownBold",
    "fa-chevron-left": "ArrowLeftBold",
    "fa-chevron-right": "ArrowRightBold",
    "fa-sort": "Sort",
    "fa-sort-up": "SortUp",
    "fa-sort-down": "SortDown",
    "fa-filter": "Filter",
    "fa-eye": "View",
    "fa-eye-slash": "Hide",
    "fa-lock": "Lock",
    "fa-unlock": "Unlock",
    "fa-key": "Key",
    "fa-link": "Link",
    "fa-unlink": "Connection",
    "fa-copy": "CopyDocument",
    "fa-cut": "Scissors",
    "fa-paste": "DocumentCopy",
    "fa-print": "Printer",
    "fa-image": "Picture",
    "fa-images": "PictureFilled",
    "fa-camera": "Camera",
    "fa-video": "VideoCamera",
    "fa-play": "VideoPlay",
    "fa-pause": "VideoPause",
    "fa-stop": "Close",
    "fa-star": "Star",
    "fa-heart": "Star",
    "fa-bookmark": "CollectionTag",
    "fa-tag": "PriceTag",
    "fa-tags": "CollectionTag",
    "fa-share": "Share",
    "fa-share-alt": "Share",
    "fa-expand": "FullScreen",
    "fa-compress": "FullScreen",
    "fa-info": "InfoFilled",
    "fa-info-circle": "InfoFilled",
    "fa-question": "QuestionFilled",
    "fa-question-circle": "QuestionFilled",
    "fa-exclamation": "Warning",
    "fa-exclamation-circle": "WarningFilled",
    "fa-exclamation-triangle": "Warning",
    "fa-ban": "CircleClose",
    "fa-spinner": "Loading",
    "fa-circle-notch": "Loading",
    "fa-list": "List",
    "fa-list-ul": "List",
    "fa-list-ol": "List",
    "fa-th": "Grid",
    "fa-th-large": "Grid",
    "fa-th-list": "List",
    "fa-bars": "Menu",
    "fa-map-marker": "Location",
    "fa-map-marker-alt": "LocationFilled",
    "fa-globe": "MapLocation",
    "fa-phone": "Phone",
    "fa-mobile": "Cellphone",
    "fa-laptop": "Monitor",
    "fa-desktop": "Monitor",
    "fa-database": "DataAnalysis",
    "fa-chart-bar": "DataLine",
    "fa-chart-line": "TrendCharts",
    "fa-chart-pie": "PieChart",
    "fa-money-bill": "Money",
    "fa-shopping-cart": "ShoppingCart",
    "fa-building": "OfficeBuilding",
    "fa-industry": "OfficeBuilding",
    "fa-sign-out-alt": "SwitchButton",
    "fa-sign-in-alt": "Right",
    "fa-power-off": "SwitchButton"
};

// Element UI 图标名 -> Element Plus 图标组件名 映射表
const iconMapping = {
    // 常用图标
    "el-icon-search": "Search",
    "el-icon-edit": "Edit",
    "el-icon-delete": "Delete",
    "el-icon-close": "Close",
    "el-icon-check": "Check",
    "el-icon-plus": "Plus",
    "el-icon-minus": "Minus",
    "el-icon-loading": "Loading",
    "el-icon-refresh": "Refresh",
    "el-icon-refresh-left": "RefreshLeft",
    "el-icon-refresh-right": "RefreshRight",

    // 箭头
    "el-icon-arrow-up": "ArrowUp",
    "el-icon-arrow-down": "ArrowDown",
    "el-icon-arrow-left": "ArrowLeft",
    "el-icon-arrow-right": "ArrowRight",
    "el-icon-d-arrow-left": "DArrowLeft",
    "el-icon-d-arrow-right": "DArrowRight",
    "el-icon-caret-top": "CaretTop",
    "el-icon-caret-bottom": "CaretBottom",
    "el-icon-caret-left": "CaretLeft",
    "el-icon-caret-right": "CaretRight",

    // 文档相关
    "el-icon-document": "Document",
    "el-icon-document-add": "DocumentAdd",
    "el-icon-document-checked": "DocumentChecked",
    "el-icon-document-copy": "DocumentCopy",
    "el-icon-document-delete": "DocumentDelete",
    "el-icon-document-remove": "DocumentRemove",
    "el-icon-tickets": "Tickets",
    "el-icon-folder": "Folder",
    "el-icon-folder-add": "FolderAdd",
    "el-icon-folder-delete": "FolderDelete",
    "el-icon-folder-opened": "FolderOpened",
    "el-icon-folder-remove": "FolderRemove",

    // 用户相关
    "el-icon-user": "User",
    "el-icon-user-solid": "UserFilled",
    "el-icon-s-custom": "Avatar",
    "el-icon-avatar": "Avatar",

    // 设置/工具
    "el-icon-setting": "Setting",
    "el-icon-s-tools": "Tools",
    "el-icon-s-operation": "Operation",
    "el-icon-s-help": "QuestionFilled",
    "el-icon-s-check": "CircleCheck",
    "el-icon-s-data": "DataAnalysis",
    "el-icon-s-order": "List",
    "el-icon-s-grid": "Grid",

    // 媒体
    "el-icon-picture": "Picture",
    "el-icon-picture-outline": "PictureFilled",
    "el-icon-camera": "Camera",
    "el-icon-camera-solid": "CameraFilled",
    "el-icon-video-camera": "VideoCamera",
    "el-icon-video-camera-solid": "VideoCameraFilled",
    "el-icon-film": "Film",

    // 通知/消息
    "el-icon-message": "Message",
    "el-icon-message-solid": "MessageBox",
    "el-icon-bell": "Bell",
    "el-icon-close-notification": "BellFilled",
    "el-icon-info": "InfoFilled",
    "el-icon-warning": "Warning",
    "el-icon-warning-outline": "WarningFilled",
    "el-icon-question": "QuestionFilled",
    "el-icon-success": "SuccessFilled",
    "el-icon-error": "CircleCloseFilled",

    // 操作
    "el-icon-upload": "Upload",
    "el-icon-upload2": "UploadFilled",
    "el-icon-download": "Download",
    "el-icon-share": "Share",
    "el-icon-copy-document": "CopyDocument",
    "el-icon-view": "View",
    "el-icon-hide": "Hide",
    "el-icon-zoom-in": "ZoomIn",
    "el-icon-zoom-out": "ZoomOut",
    "el-icon-full-screen": "FullScreen",
    "el-icon-rank": "Rank",
    "el-icon-sort": "Sort",

    // 导航
    "el-icon-menu": "Menu",
    "el-icon-s-unfold": "Expand",
    "el-icon-s-fold": "Fold",
    "el-icon-location": "Location",
    "el-icon-location-outline": "LocationFilled",
    "el-icon-place": "Place",
    "el-icon-map-location": "MapLocation",
    "el-icon-link": "Link",
    "el-icon-connection": "Connection",

    // 时间/日期
    "el-icon-time": "Clock",
    "el-icon-timer": "Timer",
    "el-icon-date": "Calendar",
    "el-icon-calendar": "Calendar",

    // 其他
    "el-icon-star-on": "StarFilled",
    "el-icon-star-off": "Star",
    "el-icon-circle-plus": "CirclePlus",
    "el-icon-circle-plus-outline": "CirclePlusFilled",
    "el-icon-remove": "Remove",
    "el-icon-remove-outline": "RemoveFilled",
    "el-icon-circle-check": "CircleCheck",
    "el-icon-circle-close": "CircleClose",
    "el-icon-s-promotion": "Promotion",
    "el-icon-eleme": "Eleme",
    "el-icon-money": "Money",
    "el-icon-coin": "Coin",
    "el-icon-postcard": "Postcard",
    "el-icon-news": "Notebook",
    "el-icon-monitor": "Monitor",
    "el-icon-data-line": "DataLine",
    "el-icon-eye": "View",
    "el-icon-right": "Right"

    // 更多可以根据需要添加
};

// 默认图标（当找不到映射时使用）
const DEFAULT_ICON = "Document";

/**
 * 将旧的 el-icon-xxx 或 FontAwesome 格式转换为 Element Plus 图标组件名
 * @param {string} oldIconName - 旧格式图标名，如 "el-icon-search", "fas fa-tasks", "fa-edit"
 * @returns {string} Element Plus 图标组件名，如 "Search"
 */
export function convertIconName(oldIconName) {
    if (!oldIconName) return DEFAULT_ICON;

    // 如果是 FontAwesome 格式: "fas fa-xxx", "far fa-xxx", "fa fa-xxx", "fal fa-xxx", "fab fa-xxx"
    if (oldIconName.includes("fa-") || /^fa[srlb]?\s/.test(oldIconName)) {
        // 提取 fa-xxx 部分
        const match = oldIconName.match(/fa-[\w-]+/);
        if (match) {
            const faIconName = match[0];
            // 查找 FontAwesome 映射
            if (faIconMapping[faIconName]) {
                return faIconMapping[faIconName];
            }
            // 如果没有映射，尝试自动转换：fa-xxx-yyy -> XxxYyy
            const autoName = faIconName
                .replace("fa-", "")
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join("");
            if (Icons[autoName]) {
                return autoName;
            }
            // 返回默认图标
            // console.warn(`FontAwesome icon not mapped: ${oldIconName}, tried: ${autoName}`);
            return DEFAULT_ICON;
        }
    }

    // 如果已经是 Element Plus 格式（PascalCase），直接检查是否存在
    if (/^[A-Z][a-zA-Z]*$/.test(oldIconName)) {
        if (Icons[oldIconName]) {
            return oldIconName;
        }
        return DEFAULT_ICON;
    }

    // 如果是 el-icon-xxx 格式
    if (oldIconName.startsWith("el-icon-")) {
        // 查找映射
        if (iconMapping[oldIconName]) {
            return iconMapping[oldIconName];
        }

        // 尝试自动转换：el-icon-xxx-yyy -> XxxYyy
        const name = oldIconName
            .replace("el-icon-", "")
            .split("-")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join("");

        // 检查是否存在该图标
        if (Icons[name]) {
            return name;
        }

        // console.warn(`Icon not found: ${oldIconName}, tried: ${name}`);
        return DEFAULT_ICON;
    }

    // 简短格式，如 "search", "edit", "s-help" 等
    // 先尝试直接使用带前缀的映射
    const withPrefix = "el-icon-" + oldIconName;
    if (iconMapping[withPrefix]) {
        return iconMapping[withPrefix];
    }

    // 尝试自动转换：xxx-yyy -> XxxYyy
    const name = oldIconName
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");

    if (Icons[name]) {
        return name;
    }

    // console.warn(`Icon not found: ${oldIconName}, tried: ${name}`);
    return DEFAULT_ICON;
}

/**
 * 获取图标组件
 * @param {string} iconName - 图标名（支持新旧格式）
 * @returns {Component} 图标组件（始终返回有效组件，不会返回null）
 */
export function getIconComponent(iconName) {
    const name = convertIconName(iconName);
    return Icons[name] || Icons[DEFAULT_ICON];
}

// 导出所有图标用于全局注册
export { Icons };

// 导出默认图标名
export const defaultIconName = DEFAULT_ICON;

export default {
    iconMapping,
    faIconMapping,
    convertIconName,
    getIconComponent,
    Icons,
    defaultIconName
};
