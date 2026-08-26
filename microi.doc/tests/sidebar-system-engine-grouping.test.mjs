import assert from "node:assert/strict";
import test from "node:test";
import {
    relocateSystemEngineDocs,
    SYSTEM_ENGINE_RELOCATED_LINKS
} from "../docs/guide/sidebar-relocation.mjs";

const makeSidebar = () => [
    {
        text: "系统引擎",
        items: [{ text: "文件柜", link: "/doc/system-engine/file-manage" }]
    },
    {
        text: "更多文档",
        items: [
            { text: "分布式存储", link: "/doc/more/hdfs" },
            { text: "Dos.ORM", link: "/doc/more/dos-orm" },
            { text: "Office在线编辑", link: "/doc/more/office" },
            { text: "SSO身份联邦", link: "/doc/more/sso" },
            { text: "Passkey与人脸验证", link: "/doc/more/identity-verification" },
            { text: "平台安全", link: "/doc/more/security" }
        ]
    }
];

test("selected documents move under system engine without changing their URLs", () => {
    const sidebar = relocateSystemEngineDocs(makeSidebar(), "/doc");
    const systemLinks = sidebar[0].items.map((item) => item.link);
    const moreLinks = sidebar[1].items.map((item) => item.link);

    assert.deepEqual(systemLinks.slice(-5), SYSTEM_ENGINE_RELOCATED_LINKS);
    assert.deepEqual(moreLinks, ["/doc/more/security"]);
});

test("non-Chinese-doc sidebars are not changed", () => {
    const sidebar = makeSidebar();
    const snapshot = structuredClone(sidebar);

    assert.deepEqual(relocateSystemEngineDocs(sidebar, "/en/doc"), snapshot);
});
