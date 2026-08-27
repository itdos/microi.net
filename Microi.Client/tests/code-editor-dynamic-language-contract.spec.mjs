import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const filename = new URL("../src/views/form-engine/diy-field-component/diy-code-editor.vue", import.meta.url);
const source = fs.readFileSync(filename, "utf8");

test("ApiV8Code resolves Monaco language from DataSourceType", function () {
    assert.match(source, /props\.field\?\.Name === 'ApiV8Code' \? 'DataSourceType' : ''/);
    assert.match(source, /V8: 'javascript'/);
    assert.match(source, /SQL: 'sql'/);
    assert.match(source, /JSON: 'json'/);
    assert.match(source, /API: 'plaintext'/);
    assert.match(source, /props\.FormData\?\.\[languageField\]/);
});

test("dynamic language changes update the live editor and related viewers", function () {
    assert.match(source, /const stopLanguageWatch = watch\([\s\S]*?applyResolvedEditorLanguage/);
    assert.match(source, /monaco\.editor\.setModelLanguage\(model, language\)/);
    assert.match(source, /const openCodeDesigner = \(\) => \{\s*const language = resolveCodeEditorLanguage\(\)/);
    assert.match(source, /const getCodeVersionLanguage = \(\) => \{\s*return resolveCodeEditorLanguage\(\)/);
    assert.match(source, /:data-code-language="resolveCodeEditorLanguage\(\)"/);
});
