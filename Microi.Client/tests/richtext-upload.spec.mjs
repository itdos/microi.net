import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compileScript, parse } from "@vue/compiler-sfc";

//zhy：锁定富文本单文件上传修复，防止后续回退到 WangEditor 默认 bundle 上传。
const componentUrl = new URL(
    "../src/views/form-engine/diy-field-component/diy-richtext.vue",
    import.meta.url
);
const source = readFileSync(componentUrl, "utf8");

//zhy：图片和视频必须各自使用独立 multipart 请求。
test("rich text editor uploads each media file in an isolated multipart request", () => {
    assert.match(source, /customUpload:\s*uploadRichTextImage/);
    assert.match(source, /customUpload:\s*uploadRichTextVideo/);
    assert.match(source, /formData\.append\(fieldName, file, file\.name\)/);
    assert.doesNotMatch(source, /server:\s*DiyCommon\.GetApiBase\(\)\s*\+\s*['"]\/apiengine\/hdfs\/upload/);
});

//zhy：自定义上传不能绕过原字段级大小限制，并且必须透传服务端错误。
test("rich text upload keeps client limits and surfaces the server error", () => {
    assert.match(source, /mediaType:\s*['"]image['"][\s\S]*?maxFileSize:\s*20\s*\*\s*1024\s*\*\s*1024/);
    assert.match(source, /mediaType:\s*['"]video['"][\s\S]*?maxFileSize:\s*200\s*\*\s*1024\s*\*\s*1024/);
    assert.match(source, /result\?\.message\s*\|\|\s*result\?\.Msg/);
});

//zhy：确保新增上传逻辑保持 Vue SFC 脚本可编译。
test("rich text component script compiles", () => {
    const parsed = parse(source, { filename: componentUrl.pathname });
    assert.deepEqual(parsed.errors, []);
    assert.doesNotThrow(() => compileScript(parsed.descriptor, { id: "diy-richtext" }));
});
