import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
    MAP_PROVIDER,
    MapRuntimeError,
    classifyMapRuntimeError,
    normalizeMapProvider,
    sanitizeMapErrorDetail
} from "../src/views/form-engine/diy-field-component/map-runtime.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(here, "../src/views/form-engine/diy-field-component/diy-map.vue");
const componentSource = fs.readFileSync(componentPath, "utf8");
const runtimeSource = fs.readFileSync(
    path.resolve(here, "../src/views/form-engine/diy-field-component/map-runtime.js"),
    "utf8"
);

test("map provider aliases normalize to the three supported runtime providers", () => {
    assert.equal(normalizeMapProvider("gaode"), MAP_PROVIDER.AMAP);
    assert.equal(normalizeMapProvider("BMap"), MAP_PROVIDER.BAIDU);
    assert.equal(normalizeMapProvider("qqmap"), MAP_PROVIDER.TENCENT);
    assert.equal(normalizeMapProvider(""), MAP_PROVIDER.SYSTEM);
});

test("provider errors become actionable reason codes without leaking map keys", () => {
    const detail = sanitizeMapErrorDetail(
        'GET https://example.test/sdk?key=plain-secret&ak=other failed {"clientKey":"json-secret"} securityJsCode=text-secret token=token-secret'
    );
    assert.doesNotMatch(detail, /plain-secret|other|json-secret|text-secret|token-secret/);
    assert.match(detail, /key=\*\*\*/);

    assert.equal(classifyMapRuntimeError(new Error("INVALID_USER_DOMAIN"), "AMap").code, "MAP_DOMAIN_NOT_ALLOWED");
    assert.equal(classifyMapRuntimeError(new Error("INVALID_USER_KEY"), "AMap").code, "MAP_KEY_INVALID");
    assert.equal(
        classifyMapRuntimeError(new MapRuntimeError("MAP_KEY_MISSING", "missing", "Tencent")).code,
        "MAP_KEY_MISSING"
    );
});

test("map component uses the tenant-safe runtime endpoint and never reads public SysConfig credentials", () => {
    assert.match(runtimeSource, /TenantSystemSettings\/GetMapRuntime/);
    assert.doesNotMatch(componentSource, /SysConfig(?:\.value)?\.(?:AMapKey|AMapSecret|BaiduAK|TencentMapKey)/);
    assert.doesNotMatch(componentSource, /useDiyStore/);
    assert.match(componentSource, /serviceHost:\s*runtime\.ServiceHost/);
    assert.match(componentSource, /securityJsCode:\s*runtime\.SecurityJsCode/);
    assert.match(componentSource, /LEGACY_FIELD_CREDENTIAL_KEYS/);
    assert.match(componentSource, /delete props\.field\.Config\[key\]/);
});

test("map component renders loading, visible error reason, retry, and all three providers", () => {
    for (const provider of ["AMap", "Baidu", "Tencent"]) {
        assert.match(componentSource, new RegExp(`value=\\"${provider}\\"`));
    }
    assert.match(componentSource, /data-testid="microi-map-loading"/);
    assert.match(componentSource, /data-testid="microi-map-error"/);
    assert.match(componentSource, /data-testid="microi-map-retry"/);
    assert.match(componentSource, /mapError\.code/);
    assert.match(componentSource, /系统设置 → 安全与服务接入/);
    assert.match(componentSource, /MAP_SDK_RENDER_TIMEOUT/);
});

test("Tencent implementation covers map, marker, label, search, reverse geocoding, and area paths", () => {
    assert.match(componentSource, /map\.qq\.com\/api\/gljs/);
    assert.match(componentSource, /new TMapInstance\.Map/);
    assert.match(componentSource, /new TMapInstance\.MultiMarker/);
    assert.match(componentSource, /new TMapInstance\.MultiLabel/);
    assert.match(componentSource, /new TMapInstance\.MultiPolyline/);
    assert.match(componentSource, /service\?\.Geocoder/);
    assert.match(componentSource, /service\?\.Suggestion/);
});
