import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import zhLocale from "../src/lang/zh.js";

const panelFilename = new URL("../src/views/form-engine/form-right-panel.vue", import.meta.url);

test("form right panel uses compact Chinese log, comment and version labels", function () {
    assert.deepEqual(
        [zhLocale.Msg.DataLog, zhLocale.Msg.DataComment, zhLocale.Msg.DataVersion],
        ["日志", "评论", "版本"]
    );

    const panel = fs.readFileSync(panelFilename, "utf8");
    for (const type of ["DataLog", "DataComment", "DataVersion"]) {
        assert.equal(panel.split("GetRelatedTitle('" + type + "')").length - 1, 2);
    }
    assert.match(panel, /DataLog: "日志", DataComment: "评论", DataVersion: "版本"/);
    assert.match(panel, /\.el-tabs__item\s*\{\s*padding:\s*0 2px;/);
    assert.match(panel, /\.tab-label\s*\{[^}]*gap:\s*2px;/s);
    assert.match(panel, /\.mci-tab-badge\s*\{[^}]*min-width:\s*16px;[^}]*padding:\s*0 3px;/s);
});
