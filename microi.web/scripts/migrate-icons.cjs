/**
 * Element Plus 图标迁移脚本
 * 将 Element UI 的图标语法转换为 Element Plus 语法
 * 
 * 用法: node scripts/migrate-icons.js [--dry-run] [--file=<path>]
 * 
 * --dry-run: 仅显示将要修改的内容，不实际修改文件
 * --file=<path>: 只处理指定的文件
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 图标名称映射表
const iconMapping = {
    "search": "Search",
    "edit": "Edit",
    "delete": "Delete",
    "close": "Close",
    "check": "Check",
    "plus": "Plus",
    "minus": "Minus",
    "loading": "Loading",
    "refresh": "Refresh",
    "refresh-left": "RefreshLeft",
    "refresh-right": "RefreshRight",
    "arrow-up": "ArrowUp",
    "arrow-down": "ArrowDown",
    "arrow-left": "ArrowLeft",
    "arrow-right": "ArrowRight",
    "d-arrow-left": "DArrowLeft",
    "d-arrow-right": "DArrowRight",
    "caret-top": "CaretTop",
    "caret-bottom": "CaretBottom",
    "caret-left": "CaretLeft",
    "caret-right": "CaretRight",
    "document": "Document",
    "document-add": "DocumentAdd",
    "document-checked": "DocumentChecked",
    "document-copy": "DocumentCopy",
    "document-delete": "DocumentDelete",
    "document-remove": "DocumentRemove",
    "tickets": "Tickets",
    "folder": "Folder",
    "folder-add": "FolderAdd",
    "folder-delete": "FolderDelete",
    "folder-opened": "FolderOpened",
    "folder-remove": "FolderRemove",
    "user": "User",
    "user-solid": "UserFilled",
    "s-custom": "Avatar",
    "avatar": "Avatar",
    "setting": "Setting",
    "s-tools": "Tools",
    "s-operation": "Operation",
    "s-help": "QuestionFilled",
    "s-check": "CircleCheck",
    "s-data": "DataAnalysis",
    "s-order": "List",
    "s-grid": "Grid",
    "picture": "Picture",
    "picture-outline": "PictureFilled",
    "camera": "Camera",
    "camera-solid": "CameraFilled",
    "video-camera": "VideoCamera",
    "video-camera-solid": "VideoCameraFilled",
    "film": "Film",
    "message": "Message",
    "message-solid": "MessageBox",
    "bell": "Bell",
    "close-notification": "BellFilled",
    "info": "InfoFilled",
    "warning": "Warning",
    "warning-outline": "WarningFilled",
    "question": "QuestionFilled",
    "success": "SuccessFilled",
    "error": "CircleCloseFilled",
    "upload": "Upload",
    "upload2": "UploadFilled",
    "download": "Download",
    "share": "Share",
    "copy-document": "CopyDocument",
    "view": "View",
    "hide": "Hide",
    "zoom-in": "ZoomIn",
    "zoom-out": "ZoomOut",
    "full-screen": "FullScreen",
    "rank": "Rank",
    "sort": "Sort",
    "menu": "Menu",
    "s-unfold": "Expand",
    "s-fold": "Fold",
    "location": "Location",
    "location-outline": "LocationFilled",
    "place": "Place",
    "map-location": "MapLocation",
    "link": "Link",
    "connection": "Connection",
    "time": "Clock",
    "timer": "Timer",
    "date": "Calendar",
    "calendar": "Calendar",
    "star-on": "StarFilled",
    "star-off": "Star",
    "circle-plus": "CirclePlus",
    "circle-plus-outline": "CirclePlusFilled",
    "remove": "Remove",
    "remove-outline": "RemoveFilled",
    "circle-check": "CircleCheck",
    "circle-close": "CircleClose",
    "s-promotion": "Promotion",
    "eleme": "Eleme",
    "money": "Money",
    "coin": "Coin",
    "postcard": "Postcard",
    "news": "Notebook",
    "monitor": "Monitor",
    "data-line": "DataLine",
    "eye": "View",
    "right": "Right",
    "back": "Back",
};

// 将 el-icon-xxx 转换为 PascalCase 图标组件名
function convertIconName(iconName) {
    // 移除 el-icon- 前缀
    const name = iconName.replace('el-icon-', '');
    
    // 查找映射
    if (iconMapping[name]) {
        return iconMapping[name];
    }
    
    // 自动转换：xxx-yyy -> XxxYyy
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join('');
}

// 处理 icon="el-icon-xxx" 属性 -> :icon="IconName"
function processIconAttribute(content) {
    // 匹配 icon="el-icon-xxx"
    return content.replace(/icon="(el-icon-[a-z0-9-]+)"/gi, (match, iconName) => {
        const componentName = convertIconName(iconName);
        return `:icon="${componentName}"`;
    });
}

// 处理 <i class="el-icon-xxx"> -> <el-icon><IconName /></el-icon>
function processIconElement(content) {
    // 匹配 <i class="el-icon-xxx"></i> 或 <i class="el-icon-xxx" />
    const regex = /<i\s+class="(el-icon-[a-z0-9-]+)"(\s*[^>]*)?\s*(?:\/>|><\/i>)/gi;
    return content.replace(regex, (match, iconName, extraAttrs) => {
        const componentName = convertIconName(iconName);
        const attrs = extraAttrs ? extraAttrs.trim() : '';
        if (attrs) {
            return `<el-icon ${attrs}><${componentName} /></el-icon>`;
        }
        return `<el-icon><${componentName} /></el-icon>`;
    });
}

// 处理包含文本的 <i class="el-icon-xxx">text</i>
function processIconElementWithText(content) {
    // 这种情况比较复杂，先跳过
    return content;
}

// 处理 prefix-icon="el-icon-xxx" -> :prefix-icon="IconName"
function processPrefixSuffixIcon(content) {
    // 匹配 prefix-icon="el-icon-xxx" 或 suffix-icon="el-icon-xxx"
    return content.replace(/(prefix-icon|suffix-icon)="(el-icon-[a-z0-9-]+)"/gi, (match, attrName, iconName) => {
        const componentName = convertIconName(iconName);
        return `:${attrName}="${componentName}"`;
    });
}

// 处理 <i class="el-icon-xxx el-icon--right"> 等带有多个 class 的情况
function processIconWithMultipleClasses(content) {
    // 匹配 class="el-icon-xxx ..." 或 class="... el-icon-xxx"
    const regex = /<i\s+class="([^"]*el-icon-[a-z0-9-]+[^"]*)"\s*(?:\/>|><\/i>)/gi;
    return content.replace(regex, (match, classValue) => {
        // 提取 el-icon-xxx
        const iconMatch = classValue.match(/el-icon-[a-z0-9-]+/i);
        if (!iconMatch) return match;
        
        const iconName = iconMatch[0];
        const componentName = convertIconName(iconName);
        
        // 提取其他 class
        const otherClasses = classValue
            .replace(iconName, '')
            .replace(/\s+/g, ' ')
            .trim();
        
        if (otherClasses) {
            return `<el-icon class="${otherClasses}"><${componentName} /></el-icon>`;
        }
        return `<el-icon><${componentName} /></el-icon>`;
    });
}

// 为文件添加图标导入
function addIconImports(content, usedIcons) {
    if (usedIcons.size === 0) return content;
    
    // 检查是否已有 setup 语法
    const hasSetup = /<script[^>]*setup[^>]*>/i.test(content);
    
    // 生成导入语句
    const iconImport = `import { ${Array.from(usedIcons).join(', ')} } from '@element-plus/icons-vue'`;
    
    if (hasSetup) {
        // 在 <script setup> 后添加导入
        return content.replace(/(<script[^>]*setup[^>]*>)/i, `$1\n${iconImport}`);
    } else {
        // 在普通 script 的 import 区域添加
        const importRegex = /(<script[^>]*>[\s\S]*?)(import\s)/i;
        if (importRegex.test(content)) {
            return content.replace(importRegex, `$1${iconImport}\n$2`);
        }
    }
    
    return content;
}

// 收集文件中使用的图标
function collectUsedIcons(content) {
    const icons = new Set();
    
    // 收集 :icon="IconName" 中的图标
    const iconAttrRegex = /:icon="([A-Z][a-zA-Z]+)"/g;
    let match;
    while ((match = iconAttrRegex.exec(content)) !== null) {
        icons.add(match[1]);
    }
    
    // 收集 <IconName /> 中的图标（在 el-icon 内）
    const iconCompRegex = /<el-icon[^>]*><([A-Z][a-zA-Z]+)\s*\/><\/el-icon>/g;
    while ((match = iconCompRegex.exec(content)) !== null) {
        icons.add(match[1]);
    }
    
    return icons;
}

// 处理单个文件
function processFile(filePath, dryRun = false) {
    let content = fs.readFileSync(filePath, 'utf-8');
    const originalContent = content;
    
    // 依次处理不同的图标用法
    content = processIconAttribute(content);
    content = processPrefixSuffixIcon(content);
    content = processIconWithMultipleClasses(content);
    content = processIconElement(content);
    
    // 收集使用的图标
    const usedIcons = collectUsedIcons(content);
    
    // 注意：这里不自动添加导入，因为全局注册了所有图标
    // content = addIconImports(content, usedIcons);
    
    if (content !== originalContent) {
        if (dryRun) {
            console.log(`\n[DRY RUN] Would modify: ${filePath}`);
            console.log('Used icons:', Array.from(usedIcons).join(', '));
        } else {
            fs.writeFileSync(filePath, content, 'utf-8');
            console.log(`Modified: ${filePath}`);
            console.log('  Used icons:', Array.from(usedIcons).join(', '));
        }
        return true;
    }
    return false;
}

// 主函数
function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const fileArg = args.find(arg => arg.startsWith('--file='));
    
    let files = [];
    
    if (fileArg) {
        files = [fileArg.replace('--file=', '')];
    } else {
        // 默认处理 src 目录下所有 .vue 文件
        files = glob.sync('src/**/*.vue', { cwd: process.cwd() });
    }
    
    console.log(`Processing ${files.length} files...`);
    if (dryRun) {
        console.log('[DRY RUN MODE]');
    }
    
    let modifiedCount = 0;
    for (const file of files) {
        const filePath = path.resolve(process.cwd(), file);
        if (processFile(filePath, dryRun)) {
            modifiedCount++;
        }
    }
    
    console.log(`\nTotal: ${modifiedCount} files ${dryRun ? 'would be ' : ''}modified`);
}

main();
