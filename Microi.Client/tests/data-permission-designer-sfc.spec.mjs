import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const filename = new URL(
    "../src/views/form-engine/diy-components/diy-data-permission-designer.vue",
    import.meta.url
);

test("data permission designer compiles with one always-editable SqlWhere mode", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);

    const script = compileScript(parsed.descriptor, { id: "data-permission-designer" });
    const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "data-permission-designer",
        compilerOptions: { bindingMetadata: script.bindings }
    });

    assert.deepEqual(template.errors, []);
    assert.doesNotMatch(source, /whereMode|高级手写/);
    assert.match(source, /:FieldReadonly="readonly"/);
    assert.match(source, /@update:modelValue="setFinalSql"/);
    assert.match(source, /defineExpose\(\{ flushPendingSync \}\)/);
    assert.match(source, /void autoSyncToForm\(requestId, false\)/);
});

test("module save flushes pending DevComponent values before taking the form snapshot", function () {
    const formSource = fs.readFileSync(
        new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
        "utf8"
    );
    const devComponentSource = fs.readFileSync(
        new URL("../src/views/form-engine/diy-field-component/diy-devcomponent.vue", import.meta.url),
        "utf8"
    );

    assert.match(devComponentSource, /ref="devComponentRef"/);
    assert.match(devComponentSource, /FlushPendingValue/);
    assert.match(formSource, /await self\.FlushPendingFieldValues\(\)/);
    assert.ok(
        formSource.indexOf("await self.FlushPendingFieldValues()") < formSource.indexOf("self.GetFormDataAndCheck"),
        "pending values must flush before GetFormDataAndCheck builds the submit snapshot"
    );
});
