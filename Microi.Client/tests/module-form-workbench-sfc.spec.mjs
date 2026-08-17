import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileStyle, compileTemplate, parse } from "@vue/compiler-sfc";

const filename = new URL(
    "../src/views/form-engine/diy-components/module-form-workbench.vue",
    import.meta.url
);
const tableFilename = new URL("../src/views/form-engine/diy-table.vue", import.meta.url);
const presentationMixinFilename = new URL(
    "../src/views/form-engine/mixins/diy-table-presentation.mixin.js",
    import.meta.url
);

test("module form workbench compiles and preserves the actual DiyForm and dynamic action chain", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);

    const script = compileScript(parsed.descriptor, { id: "module-form-workbench" });
    const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "module-form-workbench",
        compilerOptions: { bindingMetadata: script.bindings }
    });
    const style = compileStyle({
        source: parsed.descriptor.styles[0].content,
        filename: filename.pathname,
        id: "module-form-workbench",
        scoped: true,
        preprocessLang: "scss"
    });

    assert.deepEqual(template.errors, []);
    assert.deepEqual(style.errors, []);
    assert.match(source, /import\("@\/views\/form-engine\/diy-form\.vue"\)/);
    assert.match(source, /\.FormSubmit\(formParam/);
    assert.match(source, /_RowMoreBtnsOut/);
    assert.match(source, /_RowMoreBtnsIn/);
    assert.match(source, /pageButtons/);
    assert.match(source, /formButtons/);
    assert.match(source, /_WorkbenchScope: "Form"/);
    assert.match(source, /form-ready/);
    assert.match(source, /FormDiyTableModel/);
    assert.match(source, /经典表格/);
    assert.match(source, /RecordSelector/);
    assert.doesNotMatch(source, /\beval\s*\(|new Function\s*\(/);
});

test("classic table mode keeps a visible return path to the configured form workbench", function () {
    const tableSource = fs.readFileSync(tableFilename, "utf8");
    const mixinSource = fs.readFileSync(presentationMixinFilename, "utf8");

    assert.match(tableSource, /ModuleFormWorkbenchClassicEnabled/);
    assert.match(tableSource, /返回表单工作台/);
    assert.match(tableSource, /SwitchClassicToModuleWorkbench/);
    assert.match(mixinSource, /requestedMode === "table"/);
    assert.match(mixinSource, /delete query\.ViewMode/);
    assert.match(mixinSource, /delete query\.viewMode/);
});
