import assert from "node:assert/strict";
import test from "node:test";

import {
    buildRichTextPrivateAssetMarker,
    canonicalizeRichTextAssetUrls,
    collectRichTextPrivateAssetPaths,
    getRichTextPrivateAssetPath,
    hydrateRichTextPrivateAssetUrls,
    normalizeRichTextConfig
} from "../src/views/form-engine/diy-field-component/richtext-assets.js";

test("legacy rich text fields safely default to private storage and compression", () => {
    const config = normalizeRichTextConfig({ EditorProduct: "WangEditor" });

    assert.equal(config.Limit, true);
    assert.equal(config.Image.Preview, true);
    assert.equal(config.Image.CompressMaxSize, 500);
    assert.equal(config.Image.CompressMaxWidth, 1920);
    assert.equal(config.Video.MaxSize, 200);
    assert.equal(config.File.MaxSize, 100);
});

test("explicit public storage and per-media limits are preserved", () => {
    const config = normalizeRichTextConfig({
        Limit: false,
        Image: { MaxSize: 8, MaxCount: 2, Preview: false },
        Video: { Enabled: false },
        File: { MaxSize: 32, Accept: ".pdf,.docx" }
    });

    assert.equal(config.Limit, false);
    assert.equal(config.Image.MaxSize, 8);
    assert.equal(config.Image.MaxCount, 2);
    assert.equal(config.Image.Preview, false);
    assert.equal(config.Video.Enabled, false);
    assert.equal(config.File.MaxSize, 32);
    assert.equal(config.File.Accept, ".pdf,.docx");
});

test("private markers round trip unicode object paths without persisting tickets", () => {
    const path = "iTdos/editor/2026/公告 图片.png";
    const marker = buildRichTextPrivateAssetMarker(path);
    const temporaryUrl = "/api/HDFS/OpenPrivateFile/ticket-secret/公告.png?Token=must-not-persist";
    const canonical = `<p><img src="${marker}"><a href='${marker}'>附件</a></p>`;
    const hydrated = hydrateRichTextPrivateAssetUrls(canonical, new Map([[path, temporaryUrl]]));
    const restored = canonicalizeRichTextAssetUrls(hydrated, new Map([[temporaryUrl, marker]]));

    assert.equal(getRichTextPrivateAssetPath(marker), path);
    assert.deepEqual(collectRichTextPrivateAssetPaths(canonical), [path]);
    assert.match(hydrated, /ticket-secret/);
    assert.equal(restored, canonical);
    assert.doesNotMatch(restored, /ticket-secret|Token=/);
});

test("only exact src or href attributes on supported media tags grant a reference", () => {
    const marker = buildRichTextPrivateAssetMarker("iTdos/editor/allowed.png");
    const html = [
        `<p>${marker}</p>`,
        `<div data-href="${marker}"></div>`,
        `<script src="${marker}"></script>`,
        `<img data-src="${marker}">`,
        `<img src="${marker}">`
    ].join("");

    assert.deepEqual(collectRichTextPrivateAssetPaths(html), ["iTdos/editor/allowed.png"]);
});
