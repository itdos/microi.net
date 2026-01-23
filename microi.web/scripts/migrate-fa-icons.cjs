/**
 * FontAwesome 图标迁移脚本
 * 将 <i :class="...fa-..."> 替换为 <fa-icon :icon="...">
 */
const fs = require("fs");
const path = require("path");

// 需要处理的文件列表
const filesToProcess = [
    "src/views/diy/diy-table-rowlist.vue",
    "src/views/diy/diy-form.vue",
    "src/views/diy/diy-form-dialog.vue",
    "src/views/diy/diy-form-page.vue",
    "src/views/diy/diy-module.vue",
    "src/views/diy/diy-design.vue",
    "src/views/diy/left-right/RightForm.vue",
    "src/views/diy/left-right/LeftView.vue",
    "src/views/diy/workflow/my-work.vue",
    "src/views/fullcalendar/fullcalendar.vue",
    "src/views/diy-home.vue",
    "src/views/diy/diy-field-component/diy-fontawesome.vue"
];

const rootDir = path.resolve(__dirname, "..");

let totalReplacements = 0;
const results = [];

filesToProcess.forEach((relPath) => {
    const filePath = path.join(rootDir, relPath);
    if (!fs.existsSync(filePath)) {
        console.log(`跳过不存在的文件: ${relPath}`);
        return;
    }

    let content = fs.readFileSync(filePath, "utf-8");
    const originalContent = content;
    let fileReplacements = 0;

    // 模式1: <i :class="'fas fa-xxx'" /> 或 <i :class="'far fa-xxx'" />
    // 替换为: <fa-icon :icon="'fas fa-xxx'" />
    const pattern1 = /<i\s+:class="(['"](?:fas?|far?|fab?|fal?)\s+fa-[\w-]+['"])"\s*(style="[^"]*")?\s*\/?>/gi;
    content = content.replace(pattern1, (match, classValue, styleAttr) => {
        fileReplacements++;
        const style = styleAttr ? ` ${styleAttr}` : "";
        return `<fa-icon :icon="${classValue}"${style} />`;
    });

    // 模式2: <i :class="'fas fa-xxx'"></i>
    // 替换为: <fa-icon :icon="'fas fa-xxx'" />
    const pattern2 = /<i\s+:class="(['"](?:fas?|far?|fab?|fal?)\s+fa-[\w-]+['"])"\s*(style="[^"]*")?><\/i>/gi;
    content = content.replace(pattern2, (match, classValue, styleAttr) => {
        fileReplacements++;
        const style = styleAttr ? ` ${styleAttr}` : "";
        return `<fa-icon :icon="${classValue}"${style} />`;
    });

    // 模式3: <i :class="expression ? 'fa-xxx' : 'fa-yyy'"></i>
    // 保持表达式格式
    const pattern3 = /<i\s+:class="([^"]*fa-[^"]+)"\s*(style="[^"]*")?\s*\/?><\/i>|<i\s+:class="([^"]*fa-[^"]+)"\s*(style="[^"]*")?\s*\/>/gi;
    content = content.replace(pattern3, (match, expr1, style1, expr2, style2) => {
        const expr = expr1 || expr2;
        const styleAttr = style1 || style2;
        if (!expr) return match;
        fileReplacements++;
        const style = styleAttr ? ` ${styleAttr}` : "";
        return `<fa-icon :icon="${expr}"${style} />`;
    });

    // 模式4: <i :class="DiyCommon.IsNull(xxx) ? 'fa-xxx' : yyy"></i>
    // 更宽松的匹配
    const pattern4 = /<i\s+:class="([^"]*(?:fa-[\w-]+|\.Icon)[^"]*)"\s*(style="[^"]*")?><\/i>/gi;
    content = content.replace(pattern4, (match, expr, styleAttr) => {
        // 检查是否包含 fa- 相关的内容
        if (!expr.includes("fa-") && !expr.includes(".Icon")) {
            return match;
        }
        // 避免重复替换
        if (match.includes("<fa-icon")) {
            return match;
        }
        fileReplacements++;
        const style = styleAttr ? ` ${styleAttr}` : "";
        return `<fa-icon :icon="${expr}"${style} />`;
    });

    // 模式5: <i :class="xxx" style="..."></i> (带 style 的更通用匹配)
    const pattern5 = /<i\s+:class="([^"]*(?:fa-[\w-]+)[^"]*)"\s+style="([^"]*)"(?:\s*\/)?>(?:<\/i>)?/gi;
    content = content.replace(pattern5, (match, expr, styleValue) => {
        if (match.includes("<fa-icon")) {
            return match;
        }
        fileReplacements++;
        return `<fa-icon :icon="${expr}" style="${styleValue}" />`;
    });

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        results.push({ file: relPath, count: fileReplacements });
        totalReplacements += fileReplacements;
        console.log(`✓ ${relPath}: ${fileReplacements} 处替换`);
    } else {
        console.log(`- ${relPath}: 无需更改`);
    }
});

console.log("\n========================================");
console.log(`总计: ${results.length} 个文件, ${totalReplacements} 处替换`);
console.log("========================================");

if (results.length > 0) {
    console.log("\n详细结果:");
    results.forEach((r) => {
        console.log(`  ${r.file}: ${r.count}`);
    });
}
