import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileTemplate, parse } from "@vue/compiler-sfc";

const filename = new URL(
    "../src/views/form-engine/diy-components/diy-data-permission-designer.vue",
    import.meta.url
);

function extractBalancedBlock(source, marker) {
    const markerIndex = source.indexOf(marker);
    assert.notEqual(markerIndex, -1, `missing source marker: ${marker}`);
    const blockStart = source.indexOf("{", markerIndex + marker.length);
    assert.notEqual(blockStart, -1, `missing block after source marker: ${marker}`);

    let depth = 0;
    let quote = "";
    let escaped = false;
    for (let index = blockStart; index < source.length; index += 1) {
        const character = source[index];
        if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = "";
            continue;
        }
        if (character === '"' || character === "'" || character === "`") {
            quote = character;
            continue;
        }
        if (character === "{") depth += 1;
        if (character === "}") {
            depth -= 1;
            if (depth === 0) return source.slice(blockStart + 1, index);
        }
    }
    assert.fail(`unterminated block after source marker: ${marker}`);
}

function openingTagForNamedPane(template, name) {
    const match = template.match(new RegExp(`<el-tab-pane\\b[^>]*\\bname=["']${name}["'][^>]*>`, "i"));
    assert.ok(match, `missing ${name} data-permission pane`);
    return match[0];
}

function openingSelectForRemoteMethod(template, method) {
    const match = template.match(new RegExp(`<el-select\\b(?=[^>]*:remote-method=["']${method}["'])[^>]*>`, "i"));
    assert.ok(match, `missing remote selector: ${method}`);
    return match[0];
}

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
    assert.match(source, /resolveDataPermissionSqlShape/);
    assert.doesNotMatch(source, /请填写最终数据权限条件/);
    assert.doesNotMatch(source, /默认拒绝：尚未配置任何放行规则/);
    assert.doesNotMatch(source, /"1 = 0"/);
    assert.match(source, /legacyMode\.value = !markerState && !!raw\.sqlWhere\.trim\(\)/);
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

test("data permission reference dictionaries are lazy, remote-paged and non-blocking", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);
    const template = parsed.descriptor.template.content;

    for (const paneName of ["scope", "joins"]) {
        assert.match(openingTagForNamedPane(template, paneName), /\blazy\b/i);
    }

    for (const method of ["searchRolesRemote", "searchDepartmentsRemote", "searchTablesRemote"]) {
        const selectTag = openingSelectForRemoteMethod(template, method);
        assert.match(selectTag, /\bfilterable\b/i);
        assert.match(selectTag, /\bremote\b/i);
        assert.match(selectTag, /:loading=["'][^"']+["']/i);
    }

    assert.match(source, /\bshallowRef\s*\(/);
    for (const collection of ["tables", "roles", "departments"]) {
        assert.match(source, new RegExp(`const\\s+${collection}\\s*=\\s*shallowRef\\(\\[\\]\\)`));
    }

    const pageSizes = Array.from(source.matchAll(/_PageSize\s*:\s*(\d+)/g), (match) => Number(match[1]));
    assert.ok(pageSizes.length > 0, "designer must bound remote reference pages");
    assert.ok(pageSizes.every((pageSize) => pageSize <= 50), `unexpected oversized reference page: ${pageSizes.join(", ")}`);
    assert.doesNotMatch(source, /_PageSize\s*:\s*(?:5000|10000)\b/);

    const reloadBody = extractBalancedBlock(source, "async function reload()");
    assert.match(reloadBody, /loading\.value\s*=\s*false[\s\S]*await\s+nextTick\s*\(\)/);
    assert.match(reloadBody, /\bvoid\s+loadBackgroundReferences\s*\(/);
    assert.doesNotMatch(reloadBody, /await\s+loadBackgroundReferences\s*\(/);
    assert.doesNotMatch(reloadBody, /\bloadViewerOptions\s*\(/);

    const backgroundBody = extractBalancedBlock(source, "async function loadBackgroundReferences()");
    assert.match(backgroundBody, /\bvoid\s+loadViewerOptions\s*\(/);
    assert.match(source, /requestId\s*!==\s*tableSearchRequestId/);
    assert.match(source, /defineExpose\(\{ flushPendingSync \}\)/);
});
