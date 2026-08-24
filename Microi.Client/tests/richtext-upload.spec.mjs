import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileScript, parse } from "@vue/compiler-sfc";

// 锁定富文本单文件上传及公私桶配置，防止回退到历史接口引擎格式。
const componentUrl = new URL(
    "../src/views/form-engine/diy-field-component/diy-richtext.vue",
    import.meta.url
);
const source = readFileSync(componentUrl, "utf8");

test("rich text editor uploads each asset through the hardened HDFS endpoint", () => {
    assert.match(source, /customUpload:\s*uploadRichTextImage/);
    assert.match(source, /customUpload:\s*uploadRichTextVideo/);
    assert.match(source, /\/api\/HDFS\/Upload/);
    assert.match(source, /formData\.append\(['"]file['"], file, file\.name\)/);
    assert.match(source, /formData\.append\(['"]Limit['"], String\(richTextConfig\.value\.Limit\)\)/);
    assert.match(source, /formData\.append\(['"]Preview['"]/);
    assert.match(source, /formData\.append\(['"]CompressMaxSize['"]/);
    assert.match(source, /formData\.append\(['"]CompressMaxWidth['"]/);
    assert.doesNotMatch(source, /server:\s*DiyCommon\.GetApiBase\(\)\s*\+\s*['"]\/apiengine\/hdfs\/upload/);
});

test("rich text upload honors configured limits and the server's effective bucket", () => {
    assert.match(source, /maxSize:\s*richTextConfig\.value\.Image\.MaxSize/);
    assert.match(source, /maxSize:\s*richTextConfig\.value\.Video\.MaxSize/);
    assert.match(source, /maxSize:\s*richTextConfig\.value\.File\.MaxSize/);
    assert.match(source, /const effectiveLimit = rawLimit === true/);
    assert.match(source, /result\?\.Msg\s*\|\|\s*result\?\.message/);
    assert.match(source, /ATTACHMENT_MENU_KEY/);
    assert.match(source, /dangerouslyInsertHtml/);
});

test("private runtime URLs are scoped to the current record and source mode restores visible DOM before syncing", () => {
    assert.match(source, /const uploadedRuntimeUrls = new Map\(\)/);
    assert.match(source, /uploadedRuntimeUrls\.forEach\(\(runtimeUrl, path\) => resolved\.set\(path, runtimeUrl\)\)/);
    assert.match(source, /value\.slice\(1\).*runtimeUrlMarkers\.clear\(\)/s);
    assert.match(source, /sourceCodeVisible\.value = false;\s*\/\/ WangEditor\/Slate[\s\S]*?await nextTick\(\);\s*try \{\s*await syncEditorFromSource\(\)/);
});

test("rich text component script compiles", () => {
    const parsed = parse(source, { filename: componentUrl.pathname });
    assert.deepEqual(parsed.errors, []);
    assert.doesNotThrow(() => compileScript(parsed.descriptor, { id: "diy-richtext" }));
});
