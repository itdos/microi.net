import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [docs, uiSkill, designSkill, microserviceSkill] = await Promise.all([
    readFile(new URL("../../microi.doc/docs/doc/system-engine/microi-ui.md", import.meta.url), "utf8"),
    readFile(new URL("../../microi.skills/microi-ui/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../../microi.skills/ui-design/SKILL.md", import.meta.url), "utf8"),
    readFile(new URL("../../microi.skills/microi-microservice/SKILL.md", import.meta.url), "utf8")
]);

test("official Microi.UI docs and skills share the clear themed visual baseline", () => {
    for (const source of [docs, uiSkill, designSkill]) {
        assert.match(source, /清爽、清新/);
        assert.match(source, /租户主题色/);
        assert.match(source, /亮色[、/]暗色|亮色、暗色/);
    }

    assert.match(docs, /减少不服务于信息层级的装饰/);
    assert.match(uiSkill, /禁止把某一种主色、白色表面或深色背景写成唯一正确外观/);
    assert.match(designSkill, /至少选择浅色、暗色及一个非默认租户主题色/);
    assert.match(microserviceSkill, /平台主题、明暗模式与租户主色（强制）/);
    assert.match(microserviceSkill, /themeMode.*themeColor.*themePalette.*themeTokens/s);
    assert.match(microserviceSkill, /浅色 \+ 深色 \+ 一个非默认租户主题色/);
    assert.match(microserviceSkill, /data-mci-ui-root="\{AppKey\}".*data-theme.*data-mci-palette/s);
});
