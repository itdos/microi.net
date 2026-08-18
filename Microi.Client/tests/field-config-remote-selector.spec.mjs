import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, "..");
const read = (relativePath) => fs.readFileSync(path.join(clientRoot, relativePath), "utf8");

const remoteConfigFiles = [
    "src/views/form-engine/diy-field-component/diy-joinform.vue",
    "src/views/form-engine/diy-field-component/diy-cascader.vue",
    "src/views/form-engine/diy-field-component/diy-select-tree.vue",
    "src/views/form-engine/diy-field-component/shared/DiyDataSourceConfig.vue",
    "src/views/form-engine/diy-components/diy-code-design.vue",
    "src/views/form-engine/diy-components/diy-DataLinkage.vue"
];

test("large form, datasource and API selectors use bounded server-side search", () => {
    for (const relativePath of remoteConfigFiles) {
        const source = read(relativePath);
        assert.match(source, /\bremote\b/, `${relativePath} must enable Element Plus remote search`);
        assert.match(source, /remote-method/, `${relativePath} must bind a remote search method`);
        assert.match(source, /_PageIndex\s*:\s*1/, `${relativePath} must start from page one`);
        assert.match(source, /_PageSize\s*:\s*20/, `${relativePath} must limit results to 20`);
    }
});

test("remote selectors debounce requests and retain a selected option", () => {
    for (const relativePath of remoteConfigFiles) {
        const source = read(relativePath);
        assert.match(source, /setTimeout\([\s\S]{0,160}220\)/, `${relativePath} must debounce by 220ms`);
        assert.match(source, /selected/, `${relativePath} must preserve the selected row when search results change`);
    }
});

test("legacy datasource loaders are bounded even when reused by an older control", () => {
    const mixin = read("src/views/form-engine/diy-field-component/shared/dataSourceConfigMixin.js");
    const checkbox = read("src/views/form-engine/diy-field-component/diy-checkbox.vue");
    for (const source of [mixin, checkbox]) {
        const pageSizeMatches = source.match(/_PageSize\s*:\s*20/g) || [];
        assert.ok(pageSizeMatches.length >= 2, "both datasource and API requests must be capped at 20 rows");
    }
});
