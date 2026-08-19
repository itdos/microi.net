import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(testDir, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

test("low-code role permission field uses FormEngine data and emits a virtual JSON payload", () => {
    const source = read("src/views/system/components/sysrole-permission-field.vue");
    const devComponentSource = read("src/views/form-engine/diy-field-component/diy-devcomponent.vue");
    const runtimeTemplate = devComponentSource.slice(0, devComponentSource.indexOf("<!-- 配置弹窗"));

    assert.match(source, /FormEngine\.GetTableData\("sys_rolelimit"/);
    assert.match(source, /TableName:\s*"Sys_Menu"/);
    assert.match(source, /JSON\.stringify\(\{ Menu:/);
    assert.match(source, /flushPendingSync/);
    assert.match(source, /parent\.Permission\.includes\("Read"\)/);
    assert.doesNotMatch(source, /NoDetail|NoSearch/);
    assert.doesNotMatch(source, /\/api\/SysRole\/(?:Add|Upt|Del)SysRole/);
    assert.match(runtimeTemplate, /<div[^>]+diy-devcomponent-form-item/);
    assert.doesNotMatch(runtimeTemplate, /<el-form-item/);
});

test("role module row action restores the AI data policy editor", () => {
    const imports = read("src/utils/microi.net.import.js");
    const panel = read("src/views/system/components/sysrole-ai-policy-panel.vue");

    assert.match(imports, /SysroleAiPolicyPanel/);
    assert.match(panel, /mci_ai_role_policy/);
    assert.match(panel, /GetNl2SqlPolicyTableOptions/);
    assert.match(panel, /保存策略/);
});

test("field label alignment and left tree leaf semantics respect positive configuration", () => {
    const common = read("src/views/form-engine/mixins/diy-common.mixin.js");
    const leftTree = read("src/views/form-engine/left-right/LeftView.vue");
    const leftRight = read("src/views/form-engine/left-right/LeftTreeJoinRightForm.vue");
    const styles = read("src/views/form-engine/styles/diy-form.scss");

    assert.match(common, /field\.FormLabelPosition/);
    assert.match(common, /\["left", "right", "top"\]\.includes/);
    const explicitPosition = common.indexOf("if (!self.DiyCommon.IsNull(field.FormLabelPosition))");
    const specialComponentDefault = common.indexOf('if (field.Component == "CodeEditor"', explicitPosition);
    assert.ok(explicitPosition >= 0 && specialComponentDefault > explicitPosition);
    assert.match(leftTree, /isLeaf:\s*"_IsLeaf"/);
    assert.match(leftTree, /item\._IsLeaf\s*=\s*!item\._HasChild/);
    assert.match(leftRight, /LastClickNode:\s*\{ _IsAllCategory: true \}/);
    const allCategoryStart = leftRight.indexOf("if (data && data._IsAllCategory === true)");
    const allCategoryEnd = leftRight.indexOf("if(self.LastClickNode.Id == data.Id)", allCategoryStart);
    const allCategoryBranch = allCategoryStart >= 0 && allCategoryEnd > allCategoryStart
        ? leftRight.slice(allCategoryStart, allCategoryEnd)
        : "";
    assert.notEqual(allCategoryBranch, "");
    assert.doesNotMatch(allCategoryBranch, /ref_RightDiyTable\.DiyTableRowList\s*=\s*\[\]/);
    assert.match(styles, /diy-field-label__text[\s\S]*?flex:\s*0 0 auto/);
    assert.match(styles, /diy-field-description--inline[\s\S]*?text-overflow:\s*ellipsis/);
});

test("the legacy custom role manager remains in the source tree", () => {
    assert.equal(fs.existsSync(path.join(clientRoot, "src/views/system/sysrole-manage.vue")), true);
});

test("frontend V8 FormEngine tree calls map to the real tree endpoint", () => {
    const api = read("src/utils/api.itdos.js");
    const common = read("src/utils/diy.common.js");

    assert.match(api, /FormEngine:\s*\{[\s\S]*?GetTableTree:\s*"\/api\/FormEngine\/GetTableDataTree"/);
    assert.match(common, /GetTableTree\(paramOrKey, callbackOrParam, callback\)[\s\S]*?DiyApi\.FormEngine\.GetTableTree/);
});
