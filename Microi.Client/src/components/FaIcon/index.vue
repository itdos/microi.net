<template>
    <!-- Element Plus 图标模式 -->
    <el-icon v-if="isElementPlusIcon" :class="otherClasses" :style="iconStyle">
        <component :is="elementIcon" />
    </el-icon>
    <!-- FontAwesome 图标模式 -->
    <font-awesome-icon v-else-if="faIconDef" :icon="faIconDef" :class="otherClasses" :style="iconStyle" />
    <!-- 兜底：Element Plus 默认图标 -->
    <el-icon v-else :class="otherClasses" :style="iconStyle">
        <component :is="fallbackIcon" />
    </el-icon>
</template>

<script>
/**
 * 通用图标兼容组件 — 同时支持 FontAwesome 和 Element Plus 图标
 *
 * 识别规则（按优先级）：
 *   1. 直接匹配 Element Plus 图标名（如 "Search", "Edit"）→ 渲染 <el-icon>
 *   2. FontAwesome 格式（如 "fas fa-table", "far fa-check-circle"）→ 渲染 <font-awesome-icon>
 *   3. 都不匹配 → 渲染 Element Plus Document 图标作为兜底
 *
 * 用法：
 * <fa-icon :icon="'fas fa-table'" />               FontAwesome 图标
 * <fa-icon :icon="'Search'" />                     Element Plus 图标
 * <fa-icon :icon="btn.Icon || 'far fa-check-circle'" />
 */
import * as ElementPlusIcons from "@element-plus/icons-vue";
import { library } from "@fortawesome/fontawesome-svg-core";

// Element Plus 图标名集合（用于快速判断）
const elIconNames = new Set(Object.keys(ElementPlusIcons));

// FontAwesome 到 Element Plus 图标映射（供数据库中存的旧 FA 名称也能用 EP 显示；但现在优先用真实 FA 渲染）
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
        // 清理后的图标字符串
        _iconStr() {
            return (this.icon || "").trim();
        },
        // 获取除了 fa 图标相关和 Element Plus 图标名的其他 class (如 mr-1, marginRight5, more-btn 等)
        otherClasses() {
            const s = this._iconStr;
            return s
                .replace(/\b(fas?|far?|fab?)\b/g, "")
                .replace(/fa-[\w-]+/g, "")
                .replace(/\b[A-Z][a-zA-Z]+\b/g, "")   // 去掉 PascalCase 的 EP 图标名
                .trim();
        },
        // 判断是否为 Element Plus 图标（直接以 PascalCase 名称传入，如 "Search"、"Edit"）
        _epIconName() {
            const s = this._iconStr;
            // 取出第一个 PascalCase 单词
            const parts = s.split(/\s+/);
            for (const p of parts) {
                if (elIconNames.has(p)) return p;
            }
            return null;
        },
        // 是否为 Element Plus 图标
        isElementPlusIcon() {
            return !!this._epIconName && !this._hasFaPrefix;
        },
        // 是否含 fa- 前缀
        _hasFaPrefix() {
            return /\bfa[srb]?\s+fa-/.test(this._iconStr) || /\bfa-[\w-]+/.test(this._iconStr);
        },
        // Element Plus 图标组件
        elementIcon() {
            const name = this._epIconName;
            return name ? ElementPlusIcons[name] : null;
        },
        // FontAwesome 图标定义（prefix + iconName 数组，如 ["fas", "table"]）
        faIconDef() {
            if (!this._hasFaPrefix) return null;
            const s = this._iconStr;
            // 提取前缀 fas/far/fab，默认 fas
            let prefix = "fas";
            if (/\bfar\b/.test(s)) prefix = "far";
            else if (/\bfab\b/.test(s)) prefix = "fab";
            // 提取 fa-xxx 图标名
            const match = s.match(/fa-([\w-]+)/);
            if (!match) return null;
            const iconName = match[1];
            // 检查该图标是否在 FontAwesome 库中已注册
            const def = library.definitions[prefix] && library.definitions[prefix][iconName];
            if (def) return [prefix, iconName];
            // 尝试在其他前缀中查找
            for (const tryPrefix of ["fas", "far", "fab"]) {
                if (library.definitions[tryPrefix] && library.definitions[tryPrefix][iconName]) {
                    return [tryPrefix, iconName];
                }
            }
            return null;
        },
        // 兜底图标
        fallbackIcon() {
            // 如果是 fa- 格式但 FA 库没找到，尝试映射到 EP 图标
            if (this._hasFaPrefix) {
                const match = this._iconStr.match(/fa-([\w-]+)/);
                if (match) {
                    const faKey = "fa-" + match[1];
                    const elName = faToElMapping[faKey];
                    if (elName && ElementPlusIcons[elName]) return ElementPlusIcons[elName];
                    // 自动转换
                    const autoName = match[1].split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
                    if (ElementPlusIcons[autoName]) return ElementPlusIcons[autoName];
                }
            }
            return ElementPlusIcons.Document;
        }
    }
};
</script>
