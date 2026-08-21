import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { parse } from "@vue/compiler-sfc";

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("form designer renders diy_table physical fields without a second custom presentation editor", () => {
    const designer = read("src/views/form-engine/diy-design.vue");
    const parsed = parse(designer, { filename: "diy-design.vue" });

    assert.deepEqual(parsed.errors, []);
    assert.match(designer, /:TableName="'diy_table'"/);
    assert.doesNotMatch(designer, /<el-collapse-item[^>]+(?:工作台与分组|标题、说明与记录切换)/);
    assert.doesNotMatch(designer, /进入模块默认打开第一条记录/);
    assert.doesNotMatch(designer, /CreateDefaultFormPresentation|NormalizeFormPresentation/);
    assert.match(designer, /旧值保存时不被破坏，不再主动生成默认 JSON/);
});

test("classic tabs and modern section navigation share TabsPosition and the top default", () => {
    const state = read("src/views/form-engine/mixins/diy-form-state.mixin.js");
    const formUtils = read("src/views/form-engine/mixins/form-utils.mixin.js");

    assert.match(state, /DiyTableModel\s*&&\s*this\.DiyTableModel\.TabsPosition/);
    assert.match(state, /configured\)\s*>\s*-1\s*\?\s*configured\s*:\s*'top'/);
    assert.match(formUtils, /DiyTableModel\.TabsPosition[\s\S]{0,120}return "top"/);
});

test("opening the first record is a module setting, never a diy_table presentation setting", () => {
    const designer = read("src/views/form-engine/diy-design.vue");
    const presentation = read("src/views/form-engine/mixins/diy-table-presentation.mixin.js");

    assert.doesNotMatch(designer, /OpenFirstRecord|进入模块默认打开第一条记录/);
    assert.doesNotMatch(presentation, /FormPresentationConfig\?\.OpenFirstRecord/);
    assert.match(presentation, /const moduleForm = this\.ModuleListView\?\.Layout\?\.Form \|\| \{\}/);
    assert.match(presentation, /resolveModuleOpenFirstRecord\(this\.SysMenuModel, moduleForm\)/);
});

test("field width supports direct 1-24 input and keeps the existing plus and minus controls", () => {
    const form = read("src/views/form-engine/diy-form.vue");
    const designerMixin = read("src/views/form-engine/mixins/diy-form-designer.mixin.js");
    const styles = read("src/views/form-engine/styles/diy-form.scss");
    const theme = read("src/styles/mci-admin-theme.scss");

    assert.match(form, /<el-input-number[\s\S]*?:min="1"[\s\S]*?:max="24"[\s\S]*?@update:model-value="setFieldWidth\(field, \$event\)"/);
    assert.equal((form.match(/adjustFieldWidth\(field,\s*-?1\)/g) || []).length, 2);
    assert.match(designerMixin, /setFieldWidth\(field, value\)[\s\S]*?Math\.max\(1, Math\.min\(24, parsed\)\)[\s\S]*?CallbackFieldWidthChanged/);
    assert.match(styles, /\.width-input\s*\{[\s\S]*?width:\s*42px/);
    assert.match(form, /popper-class="diy-field-description-tooltip"/);
    assert.match(theme, /diy-field-description-tooltip[\s\S]*?clip-path:\s*polygon/);
});
