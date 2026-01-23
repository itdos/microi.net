/**
 * Vue 3 警告修复脚本
 * 1. 移除 .native 修饰符
 * 2. 将 .sync 修饰符转换为 v-model
 * 3. 移除未使用的 index 变量
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");

// 需要处理的文件
const filesToProcess = [
    // .native 修复
    "src/views/itdos/system/sysuser-manage.vue",
    "src/views/itdos/system/sys-log.vue",
    "src/views/itdos/system/sysdept-manage.vue",
    "src/views/itdos/system/sysmenu-manage.vue",
    "src/views/itdos/system/sysrole-manage.vue",
    "src/views/diy/workflow/index.vue",
    "src/views/diy/workflow/my-work.vue",
    "src/views/diy/diy-table.vue",
    "src/views/diy/workflow/component/designer.vue",
    "src/views/diy/diy-design.vue",
    // .sync 修复
    "src/views/diy/diy-module.vue",
    // 未使用变量修复
    "src/views/diy/diy-table-rowlist.vue",
    "src/views/diy/diy-form.vue",
    "src/views/diy-home.vue",
    "src/views/diy/microi.chat/index.vue",
    "src/views/itdos/system/system-setting.vue",
    "src/layout/components/Sidebar/index.vue"
];

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
    let fileReplacements = [];

    // 1. 移除 .native 修饰符: @submit.native.prevent -> @submit.prevent
    const nativePattern = /(@\w+)\.native(\.prevent)?/g;
    let nativeCount = 0;
    content = content.replace(nativePattern, (match, event, prevent) => {
        nativeCount++;
        return event + (prevent || "");
    });
    if (nativeCount > 0) {
        fileReplacements.push(`.native 移除: ${nativeCount}处`);
    }

    // 2. 将 :xxx.sync="yyy" 转换为 v-model:xxx="yyy"
    const syncPattern = /:(\w+)\.sync="([^"]+)"/g;
    let syncCount = 0;
    content = content.replace(syncPattern, (match, prop, value) => {
        syncCount++;
        return `v-model:${prop}="${value}"`;
    });
    if (syncCount > 0) {
        fileReplacements.push(`.sync 转换: ${syncCount}处`);
    }

    // 3. 移除未使用的 index 变量 (v-for 中的)
    // (item, index) -> item 或 (item, _index)
    // 只处理明确不需要 index 的情况
    const unusedIndexPatterns = [
        // v-for="(item, index) in list" :key="item.Id" 形式，如果 key 不包含 index
        /v-for="\((\w+),\s*index\)\s+in\s+(\w+(?:\.\w+)*)"\s+:key="(?!.*index)[^"]*"/g,
    ];
    
    let indexCount = 0;
    unusedIndexPatterns.forEach(pattern => {
        content = content.replace(pattern, (match, item, list) => {
            // 检查后面是否使用了 index
            const keyMatch = match.match(/:key="([^"]+)"/);
            if (keyMatch && !keyMatch[1].includes('index')) {
                indexCount++;
                return match.replace(`(${item}, index)`, item);
            }
            return match;
        });
    });
    if (indexCount > 0) {
        fileReplacements.push(`未使用 index 移除: ${indexCount}处`);
    }

    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        const count = fileReplacements.length;
        results.push({ file: relPath, changes: fileReplacements });
        totalReplacements += nativeCount + syncCount + indexCount;
        console.log(`✓ ${relPath}: ${fileReplacements.join(", ")}`);
    } else {
        console.log(`- ${relPath}: 无需更改`);
    }
});

console.log("\n========================================");
console.log(`总计: ${results.length} 个文件被修改`);
console.log("========================================");
