import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-v8tmpengine.vue", import.meta.url),
    "utf8"
);

test("view-mode V8 template fills its parent flex field instead of shrinking to HTML content", () => {
    // 仪表盘式模板是整行表单字段；inline span 或未指定宽度的嵌套 form-item
    // 会按内容收缩，导致四列卡片仅占左侧一小块，右侧留下大片空白。
    assert.match(source, /<el-form-item\b[^>]*class="form-item diy-v8-template-item"/u);
    assert.match(source, /<div\b[^>]*class="diy-v8-template-content"[^>]*v-safe-html:template=/u);
    assert.doesNotMatch(source, /<span\b[^>]*v-safe-html:template=/u);
    assert.match(source, /\.diy-v8-template-item,\s*\.diy-v8-template-content\s*\{[^}]*\bwidth:\s*100%;[^}]*\bmin-width:\s*0;/u);
    assert.match(source, /\.diy-v8-template-content\s*\{[^}]*\bflex:\s*1\s+1\s+100%;/u);
});
