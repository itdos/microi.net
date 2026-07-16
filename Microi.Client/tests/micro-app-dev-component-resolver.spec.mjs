import test from "node:test";
import assert from "node:assert/strict";
import {
    findLegacyMicroAppPage,
    normalizeLegacyComponentPath,
    serializeMicroAppComponentData
} from "../src/utils/microAppDevComponentResolver.js";

test("normalizes old Vue component path variants", () => {
    assert.equal(normalizeLegacyComponentPath("/loctek/BOM.vue"), "/loctek/bom");
    assert.equal(normalizeLegacyComponentPath("@/views/loctek/BOM.vue"), "/loctek/bom");
    assert.equal(normalizeLegacyComponentPath("/views/loctek/BOM/index.vue"), "/loctek/bom");
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
