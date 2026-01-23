const fs = require("fs");
const path = require("path");
const glob = require("glob");

let totalReplacements = 0;
const filesModified = new Set();
const detailsByFile = {};

// FontAwesome 到 Element Plus 图标映射
const iconMapping = {
    "fa-plus": "Plus",
    "fa-edit": "Edit",
    "fa-trash": "Delete",
    "fa-search": "Search",
    "fa-save": "Check",
    "fa-close": "Close",
    "fa-times": "Close",
    "fa-check": "Check",
    "fa-refresh": "Refresh",
    "fa-download": "Download",
    "fa-upload": "Upload",
    "fa-file": "Document",
    "fa-folder": "Folder",
    "fa-user": "User",
    "fa-users": "UserFilled",
    "fa-cog": "Setting",
    "fa-cogs": "Setting",
    "fa-home": "House",
    "fa-list": "List",
    "fa-table": "Grid",
    "fa-eye": "View",
    "fa-eye-slash": "Hide",
    "fa-lock": "Lock",
    "fa-unlock": "Unlock",
    "fa-star": "Star",
    "fa-heart": "Heart",
    "fa-bell": "Bell",
    "fa-calendar": "Calendar",
    "fa-clock": "Clock",
    "fa-envelope": "Message",
    "fa-phone": "Phone",
    "fa-map-marker": "Location",
    "fa-link": "Link",
    "fa-unlink": "Link",
    "fa-paperclip": "Paperclip",
    "fa-image": "Picture",
    "fa-camera": "Camera",
    "fa-video": "VideoCamera",
    "fa-music": "Headset",
    "fa-play": "VideoPlay",
    "fa-pause": "VideoPause",
    "fa-stop": "VideoPlay",
    "fa-forward": "Right",
    "fa-backward": "Back",
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
    "fa-square": "Tickets",
    "fa-tasks": "Finished",
    "fa-filter": "Filter",
    "fa-sort": "Sort",
    "fa-sort-up": "SortUp",
    "fa-sort-down": "SortDown",
    "fa-copy": "CopyDocument",
    "fa-paste": "Document",
    "fa-cut": "Scissor",
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
    "fa-window-close": "Close",
    "fa-window-maximize": "FullScreen",
    "fa-window-minimize": "Minus",
    "fa-list-ol": "List",
    "fa-list-ul": "List",
    "fa-check-circle": "CircleCheck",
    "fa-times-circle": "CircleClose",
    "fa-plus-circle": "CirclePlus",
    "fa-minus-circle": "Remove",
    "fa-sign-out": "SwitchButton",
    "fa-sign-in": "Right",
    "fa-power-off": "TurnOff",
    "fa-pencil": "EditPen",
    "fa-pen": "EditPen",
    "fa-building": "OfficeBuilding",
    "fa-inbox": "Inbox",
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
    "fa-retweet": "Refresh",
    "fa-comments": "ChatDotRound",
    "fa-comment": "Comment",
    "fa-microphone": "Microphone",
    "fa-headphones": "Headset",
    "fa-rss": "Message",
    "fa-wifi": "Connection",
    "fa-qrcode": "Document",
    "fa-barcode": "Document",
    "fa-magic": "MagicStick",
    "fa-paint-brush": "Brush",
    "fa-crop": "Crop",
    "fa-gift": "Present",
    "fa-trophy": "Trophy",
    "fa-graduation-cap": "SchoolGraduate",
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
    "fa-folder-open": "FolderOpened",
    "fa-folder-close": "Folder",
    "fa-cart-plus": "ShoppingCart",
    "fa-shopping-cart": "ShoppingCart",
    "fa-credit-card": "CreditCard",
    "fa-money": "Money",
    "fa-dollar": "Money",
    "fa-euro": "Money",
    "fa-yen": "Money",
    "fa-calculator": "Cellphone",
    "fa-pie-chart": "PieChart",
    "fa-bar-chart": "Histogram",
    "fa-line-chart": "TrendCharts",
    "fa-area-chart": "DataAnalysis",
    "fa-percent": "Discount",
    "fa-cubes": "Box",
    "fa-cube": "Box",
    "fa-puzzle-piece": "SetUp",
    "fa-lightbulb": "Sunrise",
    "fa-compass": "Guide",
    "fa-globe": "Place",
    "fa-map": "MapLocation",
    "fa-adjust": "MostlyCloudy",
    "fa-tint": "Cold",
    "fa-fire": "Sunrise",
    "fa-leaf": "Cherry",
    "fa-tree": "Cherry",
    "fa-birthday-cake": "Goods",
    "fa-utensils": "Food",
    "fa-coffee": "Coffee",
    "fa-beer": "GobletFull",
    "fa-glass": "GobletFull",
    "fa-car": "Van",
    "fa-bicycle": "Bicycle",
    "fa-bus": "Van",
    "fa-plane": "Promotion",
    "fa-rocket": "Promotion",
    "fa-ship": "Ship",
    "fa-anchor": "Ship",
    "fa-ambulance": "Van",
    "fa-medkit": "FirstAidKit",
    "fa-stethoscope": "FirstAidKit",
    "fa-hospital": "OfficeBuilding",
    "fa-flask": "HotWater",
    "fa-crosshairs": "Aim",
    "fa-gavel": "Gavel",
    "fa-book": "Reading",
    "fa-newspaper": "Tickets",
    "fa-feed": "Notification",
    "fa-battery-full": "FullScreen",
    "fa-battery-empty": "Minus",
    "fa-signal": "Histogram",
    "fa-hourglass": "Timer",
    "fa-history": "Timer",
    "fa-bullhorn": "Bell",
    "fa-bullseye": "Aim",
    "fa-balance-scale": "Scale",
    "fa-life-ring": "Help",
    "fa-hand-paper": "Pointer",
    "fa-hand-pointer": "Pointer",
    "fa-mouse-pointer": "Pointer",
    "fa-i-cursor": "EditPen",
    "fa-align-left": "Document",
    "fa-align-center": "Document",
    "fa-align-right": "Document",
    "fa-align-justify": "Document",
    "fa-text-height": "Document",
    "fa-text-width": "Document",
    "fa-font": "Document",
    "fa-bold": "Document",
    "fa-italic": "Document",
    "fa-underline": "Document",
    "fa-strikethrough": "Document",
    "fa-superscript": "Document",
    "fa-subscript": "Document",
    "fa-paragraph": "Document",
    "fa-header": "Document",
    "fa-quote-left": "Document",
    "fa-quote-right": "Document",
    "fa-indent": "Document",
    "fa-outdent": "Document",
    "fa-list-alt": "List",
    "fa-th": "Grid",
    "fa-th-large": "Grid",
    "fa-th-list": "List",
    "fa-columns": "Operation",
    "fa-table": "Grid",
    "fa-image": "Picture",
    "fa-picture-o": "Picture",
    "fa-photo": "Picture",
};

// 查找所有 .vue 和 .js 文件
const files = glob.sync("src/**/*.{vue,js}", {
    cwd: path.resolve(__dirname, ".."),
    absolute: true,
});

console.log(`找到 ${files.length} 个文件，开始处理...\n`);

files.forEach((filePath) => {
    let content = fs.readFileSync(filePath, "utf-8");
    let originalContent = content;
    let fileReplacements = 0;
    const replacements = [];

    // 1. 替换 el-radio 的 :label 为 :value (Element Plus 3.0+)
    // 匹配 <el-radio :label="xxx"> 或 <el-radio v-model="xxx" :label="xxx">
    const radioLabelPattern = /<el-radio([^>]*):label=/g;
    const radioLabelMatches = content.match(radioLabelPattern);
    if (radioLabelMatches) {
        content = content.replace(radioLabelPattern, "<el-radio$1:value=");
        fileReplacements += radioLabelMatches.length;
        replacements.push(`  el-radio :label → :value (${radioLabelMatches.length}次)`);
    }

    // 同时处理不带冒号的 label (静态值) - 改为 value
    const radioStaticLabelPattern = /<el-radio([^>]*)(?<![:\w])label=/g;
    const radioStaticLabelMatches = content.match(radioStaticLabelPattern);
    if (radioStaticLabelMatches) {
        content = content.replace(radioStaticLabelPattern, "<el-radio$1value=");
        fileReplacements += radioStaticLabelMatches.length;
        replacements.push(`  el-radio label → value (${radioStaticLabelMatches.length}次)`);
    }

    // 2. 替换 size="mini" 为 size="small"
    const sizePattern = /size\s*=\s*["']mini["']/gi;
    const sizeMatches = content.match(sizePattern);
    if (sizeMatches) {
        content = content.replace(sizePattern, 'size="small"');
        fileReplacements += sizeMatches.length;
        replacements.push(`  size="mini" → size="small" (${sizeMatches.length}次)`);
    }

    // 3. 替换 :size="'mini'" 为 :size="'small'"
    const dynamicSizePattern = /:size\s*=\s*["']'mini'["']/gi;
    const dynamicSizeMatches = content.match(dynamicSizePattern);
    if (dynamicSizeMatches) {
        content = content.replace(dynamicSizePattern, ":size=\"'small'\"");
        fileReplacements += dynamicSizeMatches.length;
        replacements.push(`  :size="'mini'" → :size="'small'" (${dynamicSizeMatches.length}次)`);
    }

    // 4. 修复 el-tooltip 空子节点问题 - 确保内容被包裹在 span 中
    // 这个需要更复杂的处理，这里先记录
    
    // 5. 替换 FontAwesome 类名 - 在 :icon 属性中
    // 例如: :icon="'fas fa-tasks'" 应该改为使用 Element Plus 图标
    Object.entries(iconMapping).forEach(([faIcon, elIcon]) => {
        // 处理各种格式
        const patterns = [
            // :icon="'fas fa-xxx'" or :icon="'far fa-xxx'" or :icon="'fa fa-xxx'"
            new RegExp(`:icon\\s*=\\s*["'](fas?|far?)\\s+${faIcon}["']`, "gi"),
            // icon="fas fa-xxx"
            new RegExp(`icon\\s*=\\s*["'](fas?|far?)\\s+${faIcon}["']`, "gi"),
        ];
        
        patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                // 对于 Element Plus，使用导入的图标组件
                content = content.replace(pattern, `:icon="${elIcon}"`);
                fileReplacements += matches.length;
                replacements.push(`  ${faIcon} → ${elIcon} (icon属性, ${matches.length}次)`);
            }
        });
    });

    // 6. 替换 <i class="fas fa-xxx"> 为 <el-icon><Xxx /></el-icon>
    // 这个更复杂，需要保留原有样式
    Object.entries(iconMapping).forEach(([faIcon, elIcon]) => {
        // <i class="fas fa-xxx"> 或 <i class="far fa-xxx"> 或 <i class="fa fa-xxx">
        const iTagPattern = new RegExp(`<i\\s+class\\s*=\\s*["']([^"']*\\s)?(fas?|far?)\\s+${faIcon}(\\s[^"']*)?["']([^>]*)>\\s*</i>`, "gi");
        const iTagMatches = content.match(iTagPattern);
        if (iTagMatches) {
            content = content.replace(iTagPattern, (match, prefix, faType, suffix, attrs) => {
                // 保留其他class，如 mr-1, marginRight5 等
                let otherClasses = '';
                if (prefix) otherClasses += prefix.trim();
                if (suffix) otherClasses += ' ' + suffix.trim();
                otherClasses = otherClasses.trim();
                
                if (otherClasses) {
                    return `<el-icon class="${otherClasses}"${attrs || ''}><${elIcon} /></el-icon>`;
                }
                return `<el-icon${attrs || ''}><${elIcon} /></el-icon>`;
            });
            fileReplacements += iTagMatches.length;
            replacements.push(`  <i class="${faIcon}"> → <el-icon><${elIcon} /></el-icon> (${iTagMatches.length}次)`);
        }
    });

    // 7. 处理 :class 中的 FontAwesome 图标 (动态class)
    // 这种情况比较复杂，先跳过，需要手动处理

    // 如果有修改，保存文件
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        filesModified.add(filePath);
        detailsByFile[filePath] = {
            count: fileReplacements,
            replacements: replacements,
        };
        totalReplacements += fileReplacements;
    }
});

// 输出统计信息
console.log("=".repeat(60));
console.log("Element Plus 兼容性迁移完成！");
console.log("=".repeat(60));
console.log(`\n📊 总体统计:`);
console.log(`   - 修改文件数: ${filesModified.size}`);
console.log(`   - 总替换次数: ${totalReplacements}`);

if (filesModified.size > 0) {
    console.log(`\n📁 修改的文件详情:\n`);

    // 按替换次数排序
    const sortedFiles = Array.from(filesModified).sort((a, b) => {
        return detailsByFile[b].count - detailsByFile[a].count;
    });

    sortedFiles.forEach((filePath) => {
        const relPath = path.relative(path.resolve(__dirname, ".."), filePath);
        const details = detailsByFile[filePath];
        console.log(`${relPath} (${details.count}次替换):`);
        details.replacements.forEach((r) => console.log(r));
        console.log("");
    });
}

console.log("\n⚠️  注意事项:");
console.log("1. 部分动态图标 (:class绑定) 可能需要手动检查和替换");
console.log("2. el-tooltip/el-popover 空子节点问题需要手动检查v-if条件");
console.log("3. 确保已在main.js中全局注册Element Plus图标");
console.log("4. 运行后请检查控制台是否还有其他警告");

console.log("\n✅ 迁移完成！");
