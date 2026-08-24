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
    assert.equal((panel.match(/\$t\('Msg\.DataLog'\) \|\| '日志' : '日志'/g) || []).length, 2);
    assert.equal((panel.match(/\$t\('Msg\.DataComment'\) \|\| '评论' : '评论'/g) || []).length, 2);
    assert.equal((panel.match(/\$t\('Msg\.DataVersion'\) : '版本'/g) || []).length, 2);
    assert.match(panel, /\.el-tabs__item\s*\{\s*padding:\s*0 2px;/);
    assert.match(panel, /\.tab-label\s*\{[^}]*gap:\s*2px;/s);
    assert.match(panel, /\.mci-tab-badge\s*\{[^}]*min-width:\s*16px;[^}]*padding:\s*0 3px;/s);
});
