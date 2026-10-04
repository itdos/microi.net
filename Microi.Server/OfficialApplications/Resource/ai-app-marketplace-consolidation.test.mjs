import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageModel = JSON.parse(await readFile(new URL("./app.microi.store.json", import.meta.url), "utf8"));
const storeMenu = packageModel.SysMenus.find((item) => item.Id === "61b7faee-35b2-4571-add2-5231a355f368");

test("应用商城包承载 AI 应用预览与开发入口", () => {
    assert.ok(storeMenu, "应用商城包缺少主菜单");
    const buttons = JSON.parse(storeMenu.MoreBtns || "[]");
    const preview = buttons.find((item) => item.Id === "01M0MARKETPREVIEW0000000001");
    const develop = buttons.find((item) => item.Id === "01M0MARKETDEVELOP0000000001");

    assert.ok(preview, "应用商城缺少预览按钮");
    assert.ok(develop, "应用商城缺少开发按钮");
    assert.match(preview.V8CodeShow, /Web','UniApp','MicroService/);
    assert.match(preview.V8CodeShow, /PreviewUrl/);
    assert.match(preview.V8Code, /V8\.Window\.Open\(previewUrl\)/);
    assert.match(develop.V8CodeShow, /Web','UniApp','MicroService/);
    assert.match(develop.V8Code, /\/mic-ai-app\//);
    assert.equal(buttons.filter((item) => item.Name === "预览").length, 1);
    assert.equal(buttons.filter((item) => item.Name === "开发").length, 1);
});

test("应用商城包保持统一主表并包含 Web、UniApp、微服务分类", () => {
    assert.equal(storeMenu.DiyTableName, "sys_microistore");
    assert.equal(storeMenu.ModuleEngineKey, "sys_microistore");
    assert.doesNotMatch(JSON.stringify(packageModel.DiyTables), /"Name":"mci_ai_app"/);
    const tabs = JSON.parse(storeMenu.PageTabs || "[]");
    const tabSource = JSON.stringify(tabs);
    assert.match(tabSource, /ApplicationType/);
    assert.match(tabSource, /UniApp/);
    assert.match(tabSource, /Web/);
    assert.match(tabSource, /MicroService/);
});
