import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const bannerSource = await readFile(
    new URL("../src/views/form-engine/form-view-blocks/standard-form-banner.vue", import.meta.url),
    "utf8"
);
const collapseSource = await readFile(
    new URL("../src/views/form-engine/diy-field-component/diy-collapse-group.vue", import.meta.url),
    "utf8"
);
const formSource = await readFile(
    new URL("../src/views/form-engine/diy-form.vue", import.meta.url),
    "utf8"
);
const formStateSource = await readFile(
    new URL("../src/views/form-engine/mixins/diy-form-state.mixin.js", import.meta.url),
    "utf8"
);
const formBaseSource = await readFile(
    new URL("../src/styles/diy-form-base.scss", import.meta.url),
    "utf8"
);

test("standard Banner stays compact, theme-aware and responsive", () => {
    assert.match(bannerSource, /--banner-accent:\s*var\(--mci-color-primary,\s*var\(--el-color-primary\)\)/u);
    assert.match(bannerSource, /min-height:\s*82px/u);
    assert.match(bannerSource, /--banner-theme-start-alpha:\s*\.56/u);
    assert.match(bannerSource, /html\[data-theme="dark"\][\s\S]*--banner-theme-start-alpha:\s*\.18/u);
    assert.match(bannerSource, /--banner-card:\s*rgba\(255,\s*255,\s*255,\s*\.11\)/u);
    assert.match(bannerSource, /loadRelatedMetrics/u);
    assert.match(bannerSource, /@media \(max-width:\s*720px\)/u);
    assert.match(bannerSource, /display:\s*none\s*!important/u);
    assert.match(formStateSource, /this\.diyStore\s*&&\s*this\.diyStore\.IsPhoneView\)\s*return false/u);
    assert.match(bannerSource, /collectFormBannerMetricApiGroups/u);
    assert.match(formSource, /:get-private-file-url="ResolveFormBannerPrivateFileUrl"/u);
    assert.match(formSource, /:run-api-engine="RunFormBannerApiEngine"/u);
    assert.match(formSource, /:load-related-metrics="LoadFormBannerRelatedMetrics"/u);
});

test("CollapseGroup uses the clean custom-form card instead of a blue outlined header", () => {
    assert.match(collapseSource, /diy-collapse-group__accent/u);
    assert.match(collapseSource, /diy-collapse-group__icon-shell/u);
    assert.match(collapseSource, /var\(--el-bg-color\)/u);
    assert.match(collapseSource, /var\(--el-border-color-light\)/u);
    assert.match(collapseSource, /diy-collapse-group__count/u);
    assert.doesNotMatch(collapseSource, /<el-tag[^>]*diy-collapse-group__count/u);
    assert.match(formBaseSource, /--collapse-group-surface/u);
    assert.match(formBaseSource, /background:\s*var\(--collapse-group-surface\)/u);
    assert.match(formBaseSource, /border-bottom-left-radius:\s*12px/u);
    assert.match(formBaseSource, /box-shadow:\s*0 10px 24px/u);
});
