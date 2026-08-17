import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileScript, compileStyle, compileTemplate, parse } from "@vue/compiler-sfc";

const filename = new URL(
    "../src/views/form-engine/diy-components/diy-module-presentation-designer.vue",
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
    assert.ok(match, `missing ${name} presentation pane`);
    return match[0];
}

test("module presentation designer compiles and exposes every standard list/card zone", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);

    const script = compileScript(parsed.descriptor, { id: "module-presentation-designer" });
    const template = compileTemplate({
        source: parsed.descriptor.template.content,
        filename: filename.pathname,
        id: "module-presentation-designer",
        compilerOptions: { bindingMetadata: script.bindings }
    });
    const style = compileStyle({
        source: parsed.descriptor.styles[0].content,
        filename: filename.pathname,
        id: "module-presentation-designer",
        scoped: true,
        preprocessLang: "scss"
    });

    assert.deepEqual(template.errors, []);
    assert.deepEqual(style.errors, []);
    assert.match(source, /DiyModulePresentationDesigner/);
    assert.match(source, /ApiEngineKey/);
    assert.match(source, /TrailingFields/);
    for (const zone of ["StatusFields", "TopFields", "SubtitleFields", "RightFields", "Fields", "MetaFields", "BottomFields"]) {
        assert.match(source, new RegExp(zone));
    }
    assert.match(source, /defineExpose\(\{ flushPendingSync \}\)/);
    assert.match(source, /advancedJsonDirty\.value && !applyAdvancedJson/);
    assert.match(source, /仅打开表单不应修改用户数据/);
    assert.match(source, /ensureStatisticsField\(metric\.Field\)/);
    assert.match(source, /onMetricSourceChange\(metric\)/);
    assert.match(source, /metric\.Icon/);
    assert.match(source, /metricVisualDefaults/);
    assert.match(source, /每个指标应使用不同图标和语义色/);
    assert.match(source, /value: "DataCount"/);
    assert.match(source, /fieldRequestId/);
    assert.match(source, /cloneJson\(shared\)/);
    assert.match(source, /跨端视图负责字段编排，字段模板负责复杂渲染，两者可以叠加使用/);
    assert.match(source, /label="自定义表单" name="form-json"/);
    assert.match(source, /function applyCustomFormJson\s*\(/);
    assert.match(source, /currentViews\.filter\(\(view\) => !isCustomFormView\(view\)\)/);
    assert.match(source, /DEFAULT_VIEW_SCHEMA_VERSION\s*=\s*"1\.0"/);
    assert.match(source, /DEFAULT_VIEW_CONFIG_VERSION\s*=\s*1/);
    assert.match(source, /只要配置就始终生效/);
    assert.doesNotMatch(source, /\beval\s*\(|new Function\s*\(/);
});

test("module presentation designer defers every internal pane and remote-pages api engines", function () {
    const source = fs.readFileSync(filename, "utf8");
    const parsed = parse(source, { filename: filename.pathname });
    assert.deepEqual(parsed.errors, []);
    const template = parsed.descriptor.template.content;

    for (const paneName of ["hero", "list", "form-workbench", "card", "form-json", "json"]) {
        assert.match(openingTagForNamedPane(template, paneName), /\blazy\b/i);
    }

    const apiEngineSelect = template.match(/<el-select\b(?=[^>]*v-model=["']metric\.ApiEngineKey["'])[^>]*>/i)?.[0];
    assert.ok(apiEngineSelect, "missing metric api-engine selector");
    assert.match(apiEngineSelect, /\bfilterable\b/i);
    assert.match(apiEngineSelect, /\bremote\b/i);
    assert.match(apiEngineSelect, /:remote-method=["']searchApiEngines["']/i);
    assert.match(apiEngineSelect, /:loading=["']apiEnginesLoading["']/i);

    const pageSizes = Array.from(source.matchAll(/_PageSize\s*:\s*(\d+)/g), (match) => Number(match[1]));
    assert.ok(pageSizes.length > 0, "designer must bound api-engine lookup pages");
    assert.ok(pageSizes.every((pageSize) => pageSize <= 50), `unexpected oversized lookup page: ${pageSizes.join(", ")}`);
    assert.doesNotMatch(source, /_PageSize\s*:\s*10000\b/);

    const reloadBody = extractBalancedBlock(source, "async function reload()");
    assert.doesNotMatch(reloadBody, /\bloadApiEngines\s*\(/, "opening the designer must not fetch the full api-engine table");
    assert.match(reloadBody, /\bvoid\s+loadDesignerReferences\s*\(/, "reference data must not block the designer shell");
    const referenceLoaderBody = extractBalancedBlock(source, "async function loadDesignerReferences()");
    assert.match(referenceLoaderBody, /\bloadSelectedApiEngines\s*\(/, "saved api-engine keys must be restored without a full-table query");

    assert.match(source, /function selectedApiEngineKeys\s*\(/);
    assert.match(source, /function mergeApiEngineOptions\s*\(/);
    assert.match(source, /if\s*\(\s*!result\.has\(key\)\s*\)\s*result\.set\(key,/);

    const fetchBody = extractBalancedBlock(source, "async function fetchApiEngines(keyword, requestId)");
    assert.match(fetchBody, /requestId\s*!==\s*apiEngineRequestId/);
    assert.match(fetchBody, /_PageSize\s*:\s*50\b/);
});
