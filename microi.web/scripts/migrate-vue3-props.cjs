const fs = require("fs");
const path = require("path");
const glob = require("glob");

// kebab-case 到 PascalCase 的映射
const propsMapping = {
    "table-id": "TableId",
    "form-mode": "FormMode",
    "table-child-form-mode": "TableChildFormMode",
    "table-name": "TableName",
    "table-row-id": "TableRowId",
    "default-values": "DefaultValues",
    "select-fields": "SelectFields",
    "fixed-tabs": "FixedTabs",
    "hide-fields": "HideFields",
    "parent-form": "ParentForm",
    "parent-v8": "ParentV8",
    "current-table-data": "CurrentTableData",
    "active-diy-table-tab": "ActiveDiyTableTab",
    "show-hide-field": "ShowHideField",
    "props-table-id": "PropsTableId",
    "props-sys-menu-id": "PropsSysMenuId",
    "props-where": "PropsWhere",
    "table-child-field": "TableChildField",
    "table-child-field-label": "TableChildFieldLabel",
    "table-child-table-id": "TableChildTableId",
    "table-child-sys-menu-id": "TableChildSysMenuId",
    "table-child-fk-field-name": "TableChildFkFieldName",
    "father-form-model": "FatherFormModel",
    "form-default-values": "FormDefaultValues",
    "parent-form-load-finish": "ParentFormLoadFinish",
    "enable-multiple-select": "EnableMultipleSelect",
    "field-readonly": "FieldReadonly",
    "readonly-fields": "ReadonlyFields",
    "form-diy-table-model": "FormDiyTableModel",
    "api-replace": "ApiReplace",
    "diy-table-model": "DiyTableModel",
    "diy-field-list": "DiyFieldList",
    "table-in-edit": "TableInEdit",
    "load-type": "LoadType",
    "form-wf": "FormWF",
    "load-mode": "LoadMode",
};

let totalReplacements = 0;
const filesModified = new Set();
const detailsByFile = {};

// 查找所有 .vue 文件
const vueFiles = glob.sync("src/**/*.vue", {
    cwd: path.resolve(__dirname, ".."),
    absolute: true,
});

console.log(`找到 ${vueFiles.length} 个 Vue 文件，开始处理...\n`);

vueFiles.forEach((filePath) => {
    let content = fs.readFileSync(filePath, "utf-8");
    let originalContent = content;
    let fileReplacements = 0;
    const replacements = [];

    // 对每个映射进行替换
    Object.entries(propsMapping).forEach(([kebabCase, pascalCase]) => {
        // 匹配 :kebab-case="xxx" 或 :kebab-case.modifier="xxx"
        const pattern = new RegExp(`:${kebabCase}(\\.[a-zA-Z]+)?=`, "g");
        const matches = content.match(pattern);

        if (matches) {
            content = content.replace(pattern, `:${pascalCase}$1=`);
            const count = matches.length;
            fileReplacements += count;
            totalReplacements += count;
            replacements.push(`  :${kebabCase} → :${pascalCase} (${count}次)`);
        }
    });

    // 如果有修改，保存文件
    if (content !== originalContent) {
        fs.writeFileSync(filePath, content, "utf-8");
        filesModified.add(filePath);
        detailsByFile[filePath] = {
            count: fileReplacements,
            replacements: replacements,
        };
    }
});

// 输出统计信息
console.log("=".repeat(60));
console.log("Vue 3 Props 命名迁移完成！");
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

console.log("✅ 迁移完成！所有kebab-case props已转换为PascalCase。");
