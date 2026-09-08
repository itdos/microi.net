import test from "node:test";
import assert from "node:assert/strict";
import {
    findLegacyMicroAppPage,
    buildMicroAppComponentSourceInfo,
    normalizeLegacyComponentPath,
    serializeMicroAppComponentData
} from "../src/utils/microAppDevComponentResolver.js";

test("normalizes old Vue component path variants", () => {
    assert.equal(normalizeLegacyComponentPath("/loctek/BOM.vue"), "/loctek/bom");
    assert.equal(normalizeLegacyComponentPath("@/views/loctek/BOM.vue"), "/loctek/bom");
    assert.equal(normalizeLegacyComponentPath("/views/loctek/BOM/index.vue"), "/loctek/bom");
});

test("source details identify migrated components without changing legacy paths or exposing credentials", () => {
    const page = { MicroServiceKey: "loctek-custom-pages", PageKey: "inventory-counting", RoutePath: "/inventory-counting", BuildVersion: "v1.1.2", RouteMetaJson: '{"sourceFile":"src/legacy/loctek/CountingDetails.vue"}' };
    const info = buildMicroAppComponentSourceInfo(page, { MsName: "乐歌定制页面", BuildVersion: "v1.1.3", Token: "secret" }, { componentPath: "/loctek/CountingDetails.vue", apiBase: "https://api.example", osClient: "loctek", token: "secret", currentUser: { Account: "private" } });
    assert.equal(info.appName, "乐歌定制页面");
    assert.equal(info.routePath, "/inventory-counting");
    assert.equal(info.version, "v1.1.3");
    assert.equal(info.componentPath, "/loctek/CountingDetails.vue");
    assert.equal(info.sourcePath, "AI应用/loctek-custom-pages/src/legacy/loctek/CountingDetails.vue");
    assert.doesNotMatch(JSON.stringify(info), /secret|private|currentUser|Token/);
    assert.equal(page.BuildVersion, "v1.1.2");
});

test("old route manifests remain precisely identifiable without inventing a Vue filename", () => {
    const info = buildMicroAppComponentSourceInfo({ MicroServiceKey: "app-a", PageKey: "page", RoutePath: "/page", RouteMetaJson: "invalid" });
    assert.equal(info.sourcePath, "AI应用/app-a");
    assert.equal(info.sourceFile, "");
    assert.equal(buildMicroAppComponentSourceInfo({ SourceFile: "../../secret" }).sourceFile, "");
});

test("matches installed microservice page metadata by legacy component path", () => {
    const page = findLegacyMicroAppPage({
        Code: 1,
        Data: [{
            Id: "page-1",
            MicroServiceKey: "loctek-custom-pages",
            RoutePath: "/bom",
            BuildVersion: "v1.1.0",
            IsEnable: 1,
            RouteMetaJson: JSON.stringify({
                LegacyComponentPaths: ["/loctek/BOM", "@/views/loctek/BOM.vue"]
            })
        }]
    }, "/loctek/BOM.vue");
    assert.equal(page.MicroServiceKey, "loctek-custom-pages");
    assert.equal(page.RoutePath, "/bom");
    assert.equal(page.BuildVersion, "v1.1.0");
});

test("serializes component props while dropping callbacks and circular runtime objects", () => {
    const value = { DataAppend: { id: "1" }, onFormSet() {}, ParentV8: { Close() {} } };
    value.self = value;
    assert.deepEqual(serializeMicroAppComponentData(value), {
        DataAppend: { id: "1" }
    });
});
