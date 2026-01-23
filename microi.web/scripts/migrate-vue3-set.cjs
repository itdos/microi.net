/**
 * Vue 3 迁移脚本：将 $set 替换为直接赋值
 * Vue 3 中 $set 已被移除，因为 Proxy 可以自动检测属性的添加/删除
 * 
 * 替换规则：
 * - self.$set(obj, key, value) → obj[key] = value
 * - this.$set(obj, key, value) → obj[key] = value
 * - self.$set(obj, 'key', value) → obj['key'] = value
 * - self.$set(array, index, value) → array[index] = value
 */

const fs = require('fs');
const path = require('path');

// 需要处理的目录
const srcDir = path.join(__dirname, '../src');

// 匹配 $set 调用的正则表达式
// 匹配: self.$set(obj, key, value) 或 this.$set(obj, key, value)
const setPattern = /(\bself|\bthis)\.\$set\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.+?)\s*\)(\s*;?\s*(?:\/\/.*)?$)/gm;

// 用于匹配被注释的行
const commentPattern = /^\s*\/\//;

// 统计信息
let totalReplacements = 0;
let filesModified = 0;
const modifiedFiles = [];

function processFile(filePath) {
    const ext = path.extname(filePath);
    if (!['.vue', '.js', '.ts'].includes(ext)) {
        return;
    }

    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;
    let fileReplacements = 0;

    // 逐行处理，避免替换注释中的代码
    const lines = content.split('\n');
    const newLines = lines.map((line, index) => {
        // 跳过注释行
        if (commentPattern.test(line)) {
            return line;
        }

        // 替换 $set 调用
        const newLine = line.replace(
            /(\bself|\bthis)\.\$set\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*(.+?)\s*\)(\s*;?\s*(?:\/\/.*)?$)/g,
            (match, context, obj, key, value, trailing) => {
                fileReplacements++;
                totalReplacements++;
                modified = true;
                // 返回直接赋值的形式
                return `${obj}[${key}] = ${value}${trailing}`;
            }
        );

        return newLine;
    });

    if (modified) {
        const newContent = newLines.join('\n');
        fs.writeFileSync(filePath, newContent, 'utf-8');
        filesModified++;
        modifiedFiles.push({ file: filePath.replace(srcDir, 'src'), count: fileReplacements });
        console.log(`✅ ${filePath.replace(srcDir, 'src')} - ${fileReplacements} 处替换`);
    }
}

function walkDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            // 跳过 node_modules 和隐藏目录
            if (file !== 'node_modules' && !file.startsWith('.')) {
                walkDir(filePath);
            }
        } else {
            processFile(filePath);
        }
    }
}

console.log('🚀 开始迁移 Vue 3 $set...\n');
console.log('替换规则: self.$set(obj, key, value) → obj[key] = value\n');

walkDir(srcDir);

console.log('\n📊 迁移完成统计:');
console.log(`   修改文件数: ${filesModified}`);
console.log(`   总替换次数: ${totalReplacements}`);
console.log('\n📝 修改的文件:');
modifiedFiles.forEach(({ file, count }) => {
    console.log(`   ${file} (${count} 处)`);
});
