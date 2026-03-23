<template>
    <el-icon :class="otherClasses" :style="iconStyle">
        <component :is="elementIcon" />
    </el-icon>
</template>

<script>
/**
 * FontAwesome 到 Element Plus 图标兼容组件
 * 支持动态 FontAwesome class 绑定，自动转换为 Element Plus 图标
 *
 * 用法：
 * <fa-icon :class="'fas fa-table'" />
 * <fa-icon :icon="someIcon" />
 * <fa-icon :class="btn.Icon || 'far fa-check-circle'" />
 */
import * as ElementPlusIcons from "@element-plus/icons-vue";

// FontAwesome 到 Element Plus 图标映射
const faToElMapping = {
    "fa-plus": "Plus",
    "fa-edit": "Edit",
    "fa-pencil": "EditPen",
    "fa-pen": "EditPen",
    "fa-trash": "Delete",
    "fa-search": "Search",
    "fa-save": "Check",
    "fa-close": "Close",
    "fa-times": "Close",
    "fa-check": "Check",
    "fa-check-circle": "CircleCheck",
    "fa-times-circle": "CircleClose",
    "fa-refresh": "Refresh",
    "fa-download": "Download",
    "fa-upload": "Upload",
    "fa-file": "Document",
    "fa-folder": "Folder",
    "fa-folder-open": "FolderOpened",
    "fa-user": "User",
    "fa-users": "UserFilled",
    "fa-cog": "Setting",
    "fa-cogs": "Setting",
    "fa-home": "House",
    "fa-list": "List",
    "fa-list-ol": "List",
    "fa-list-ul": "List",
    "fa-table": "Grid",
    "fa-eye": "View",
    "fa-eye-slash": "Hide",
    "fa-lock": "Lock",
    "fa-unlock": "Unlock",
    "fa-star": "Star",
    "fa-heart": "Cpu",
    "fa-bell": "Bell",
    "fa-calendar": "Calendar",
    "fa-clock": "Clock",
    "fa-envelope": "Message",
    "fa-phone": "Phone",
    "fa-map-marker": "Location",
    "fa-location": "Location",
    "fa-link": "Link",
    "fa-paperclip": "Paperclip",
    "fa-image": "Picture",
    "fa-camera": "Camera",
    "fa-video": "VideoCamera",
    "fa-play": "VideoPlay",
    "fa-pause": "VideoPause",
    "fa-bars": "Menu",
    "fa-ellipsis-h": "More",
    "fa-ellipsis-v": "MoreFilled",
    "fa-arrow-up": "ArrowUp",
    "fa-arrow-down": "ArrowDown",
    "fa-arrow-left": "ArrowLeft",
    "fa-arrow-right": "ArrowRight",
    "fa-chevron-up": "ArrowUp",
    "fa-chevron-down": "ArrowDown",
    "fa-chevron-left": "ArrowLeft",
    "fa-chevron-right": "ArrowRight",
    "fa-angle-up": "ArrowUp",
    "fa-angle-down": "ArrowDown",
    "fa-angle-left": "ArrowLeft",
    "fa-angle-right": "ArrowRight",
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
    "fa-circle": "CircleFilled",
    "fa-tasks": "Finished",
    "fa-filter": "Filter",
    "fa-sort": "Sort",
    "fa-copy": "CopyDocument",
    "fa-clipboard": "Document",
    "fa-paste": "Document",
    "fa-undo": "RefreshLeft",
    "fa-redo": "RefreshRight",
    "fa-print": "Printer",
    "fa-database": "Coin",
    "fa-server": "Monitor",
    "fa-code": "Document",
    "fa-terminal": "Monitor",
    "fa-key": "Key",
    "fa-shield": "Shield",
    "fa-bolt": "Lightning",
    "fa-sun": "Sunny",
    "fa-moon": "Moon",
    "fa-cloud": "Cloudy",
    "fa-minus": "Minus",
    "fa-remove": "Close",
    "fa-plus-circle": "CirclePlus",
    "fa-minus-circle": "Remove",
    "fa-sign-out": "SwitchButton",
    "fa-sign-in": "Right",
    "fa-power-off": "TurnOff",
    "fa-building": "OfficeBuilding",
    "fa-inbox": "Message",
    "fa-archive": "Box",
    "fa-bookmark": "CollectionTag",
    "fa-tag": "PriceTag",
    "fa-tags": "PriceTag",
    "fa-flag": "Flag",
    "fa-thumbs-up": "Top",
    "fa-thumbs-down": "Bottom",
    "fa-share": "Share",
    "fa-reply": "RefreshLeft",
    "fa-sitemap": "Operation",
    "fa-random": "RefreshRight",
    "fa-comments": "ChatDotRound",
    "fa-comment": "Comment",
    "fa-microphone": "Microphone",
    "fa-headphones": "Headset",
    "fa-rss": "Message",
    "fa-wifi": "Connection",
    "fa-qrcode": "Document",
    "fa-magic": "MagicStick",
    "fa-paint-brush": "Brush",
    "fa-gift": "Present",
    "fa-trophy": "Trophy",
    "fa-briefcase": "Briefcase",
    "fa-plug": "Connection",
    "fa-tachometer": "Odometer",
    "fa-file-text": "Document",
    "fa-file-pdf": "Document",
    "fa-file-word": "Document",
    "fa-file-excel": "Document",
    "fa-file-image": "Picture",
    "fa-file-video": "Film",
    "fa-file-audio": "Headset",
    "fa-file-archive": "Files",
    "fa-file-code": "Document",
    "fa-shopping-cart": "ShoppingCart",
    "fa-cart-plus": "ShoppingCart",
    "fa-credit-card": "CreditCard",
    "fa-money": "Money",
    "fa-calculator": "Cellphone",
    "fa-pie-chart": "PieChart",
    "fa-bar-chart": "Histogram",
    "fa-line-chart": "TrendCharts",
    "fa-area-chart": "DataAnalysis",
    "fa-globe": "Place",
    "fa-map": "MapLocation",
    "fa-car": "Van",
    "fa-bicycle": "Bicycle",
    "fa-bus": "Van",
    "fa-plane": "Promotion",
    "fa-rocket": "Promotion",
    "fa-book": "Reading",
    "fa-newspaper": "Tickets",
    "fa-icons": "SetUp",
    "fa-smile": "Sunny",
    "fa-smile-wink": "MagicStick",
    "fa-hand-point-up": "Top",
    "fa-hand-point-down": "Bottom",
    "fa-hand-point-left": "Back",
    "fa-hand-point-right": "Right",
    "fa-handshake": "Connection",
};

export default {
    name: "FaIcon",
    props: {
        icon: {
            type: String,
            default: ""
        },
        iconStyle: {
            type: [String, Object],
            default: ""
        }
    },
    computed: {
        // 解析传入的class或icon prop
        parsedIcon() {
            const iconStr = this.icon || "";
            // 提取 fa-xxx 部分
            const match = iconStr.match(/fa-[\w-]+/);
            return match ? match[0] : "";
        },
        // 获取除了 fa 图标相关的其他 class (如 mr-1, marginRight5 等)
        otherClasses() {
            const iconStr = this.icon || "";
            // 移除 fas, far, fa 和 fa-xxx 部分，保留其他class
            return iconStr
                .replace(/\b(fas?|far?)\b/g, "")
                .replace(/fa-[\w-]+/g, "")
                .trim();
        },
        // 尝试获取 Element Plus 图标组件（始终返回有效图标）
        elementIcon() {
            const faIcon = this.parsedIcon;
            if (!faIcon) {
                // 没有图标时返回默认图标
                return ElementPlusIcons.Document;
            }
            
            const elIconName = faToElMapping[faIcon];
            if (elIconName && ElementPlusIcons[elIconName]) {
                return ElementPlusIcons[elIconName];
            }
            
            // 尝试自动转换：fa-xxx-yyy -> XxxYyy
            const autoName = faIcon
                .replace("fa-", "")
                .split("-")
                .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
                .join("");
            if (ElementPlusIcons[autoName]) {
                return ElementPlusIcons[autoName];
            }
            
            // 如果没有映射，返回默认图标
            return ElementPlusIcons.Document;
        }
    }
};
</script>
