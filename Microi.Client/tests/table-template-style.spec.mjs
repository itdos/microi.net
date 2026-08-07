import assert from "node:assert/strict";
import test from "node:test";
import { extractTemplateStyles, scopeTemplateCss } from "../src/utils/table-template-style.js";

test("extracts style and legacy styles blocks while preserving markup", () => {
    const result = extractTemplateStyles(`
        <style>.thumb:hover .overlay { opacity: 1; }</style>
        <styles>.file-link { color: #2563eb; }</styles>
        <a class="file-link" href="/a" target="_blank">文件</a>
    `);
    assert.doesNotMatch(result.html, /<styles?/i);
    assert.match(result.html, /target="_blank"/);
    assert.match(result.css, /\.thumb:hover/);
    assert.match(result.css, /\.file-link/);
});

test("scopes hover rules to one table-template cell", () => {
    const css = scopeTemplateCss(
        ".thumb:hover .overlay, .thumb:focus-within .overlay { opacity: 1; transform: translateY(0); }",
        '[data-microi-template-scope="cell-1"]'
    );
    assert.match(css, /\[data-microi-template-scope="cell-1"\] \.thumb:hover \.overlay/);
    assert.match(css, /transform: translateY\(0\)/);
    assert.doesNotMatch(css, /(^|,)\s*\.thumb:hover/);
});

test("drops global selectors, imports and URL-bearing CSS", () => {
    assert.equal(scopeTemplateCss("body { display:none; }", "[data-scope]"), "");
    assert.equal(scopeTemplateCss("@import 'https://evil.test/a.css'; .x { color:red; }", "[data-scope]"), "");
    assert.equal(scopeTemplateCss(".x { background-image:url(https://evil.test/pixel); }", "[data-scope]"), "");
});
