import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const commonSource = await readFile(
    new URL("../src/utils/diy.common.js", import.meta.url),
    "utf8"
);
const operationsSource = await readFile(
    new URL("../src/views/form-engine/mixins/diy-table-operations.mixin.js", import.meta.url),
    "utf8"
);

function getExportMethodSource() {
    const start = commonSource.indexOf("    async FormExportFileV2(");
    const end = commonSource.indexOf("    FormExportFile(", start);
    assert.ok(start > 0 && end > start, "FormExportFileV2 source should be discoverable");
    return commonSource.slice(start, end);
}

function createHarness(responseFactory) {
    const calls = [];
    const downloads = [];
    const tips = [];
    const refreshedTokens = [];
    let callbackCount = 0;
    let objectUrlIndex = 0;

    const axios = async (options) => {
        calls.push(options);
        return responseFactory(options);
    };
    const DiyCommon = {
        getToken: () => "protected-token",
        GetDid: () => "export-device",
        GetCurrentLang: () => "cn",
        GetApiBase: () => "https://api.example.com",
        GetOsClient: () => "tenant-a",
        IsNull: (value) => value === null || value === undefined || value === "",
        AttachLangParam: (param, lang) => {
            if (param && param._Lang == null) param._Lang = lang;
        },
        ApplyAuthorizationToken: (value) => refreshedTokens.push(value),
        MarkAuthRequestToken: () => {},
        Tips: (message) => tips.push(message)
    };
    const document = {
        createElement: () => ({
            setAttribute(name, value) { this[name] = value; },
            click() { downloads.push({ name: this.download, href: this.href }); }
        }),
        body: { appendChild: () => {}, removeChild: () => {} }
    };
    const window = {
        URL: {
            createObjectURL: () => `blob:test-${++objectUrlIndex}`,
            revokeObjectURL: () => {}
        }
    };
    const withRequestTenant = (headers, context) => ({
        ...headers,
        osclient: context.params?.OsClient || context.osClient
    });

    const subject = vm.runInNewContext(`({${getExportMethodSource()}})`, {
        axios,
        qs: { stringify: (value) => new URLSearchParams(value).toString() },
        DiyCommon,
        LocalStorageManager: { get: () => "export-mac" },
        withRequestTenant,
        Blob,
        Uint8Array,
        atob,
        FileReader: class {},
        document,
        window,
        console,
        setTimeout: (action) => action()
    });

    return {
        calls,
        downloads,
        tips,
        refreshedTokens,
        callback: () => { callbackCount++; },
        get callbackCount() { return callbackCount; },
        run: subject.FormExportFileV2
    };
}

function jsonBlob(payload, type = "application/json; charset=utf-8") {
    return new Blob([JSON.stringify(payload)], { type });
}

test("protected custom export sends the platform token in headers and reports the real business error", async () => {
    const harness = createHarness(async () => ({
        data: jsonBlob({ Code: 1001, Msg: "请求未携带Token，请重新登录。", Data: null }),
        headers: { "content-type": "application/json; charset=utf-8" }
    }));
    const param = { OsClient: "tenant-a", Keyword: "test" };

    const result = await harness.run(
        "https://api.example.com/apiengine/protected-export",
        param,
        harness.callback,
        "提成计算表",
        "json"
    );

    assert.equal(harness.calls[0].headers.authorization, "Bearer protected-token");
    assert.equal(harness.calls[0].headers.osclient, "tenant-a");
    assert.equal(harness.calls[0].headers["Content-Type"], "application/json");
    assert.equal(Object.hasOwn(harness.calls[0].data, "authorization"), false);
    assert.equal(Object.hasOwn(param, "authorization"), false, "export must not mutate caller parameters");
    assert.equal(result.Code, 1001);
    assert.deepEqual(harness.tips, ["请求未携带Token，请重新登录。"]);
    assert.equal(harness.downloads.length, 0);
    assert.equal(harness.callbackCount, 1);
});

test("legacy standard export keeps body token compatibility while also sending the header", async () => {
    const harness = createHarness(async () => ({
        data: new Blob(["xlsx-bytes"], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        }),
        headers: {
            "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "content-disposition": "attachment; filename*=UTF-8''%E6%A0%87%E5%87%86%E5%AF%BC%E5%87%BA.xlsx"
        }
    }));
    const param = { OsClient: "tenant-a" };

    const result = await harness.run(
        "https://api.example.com/api/FormEngine/ExportDiyTableRow",
        param,
        harness.callback,
        "fallback",
        "json"
    );

    assert.equal(harness.calls[0].headers.authorization, "Bearer protected-token");
    assert.equal(harness.calls[0].data.authorization, "Bearer protected-token");
    assert.equal(Object.hasOwn(param, "authorization"), false);
    assert.equal(result.Code, 1);
    assert.equal(harness.downloads[0].name, "标准导出.xlsx");
    assert.equal(harness.callbackCount, 1);
});

test("JSON base64 export uses server filename and MIME and refreshes the response token", async () => {
    const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    const harness = createHarness(async () => ({
        data: jsonBlob({
            Code: 1,
            Data: {
                FileName: "commission.xlsx",
                ContentType: contentType,
                FileByteBase64: Buffer.from("xlsx-bytes").toString("base64")
            }
        }),
        headers: {
            "content-type": "application/json; charset=utf-8",
            authorization: "Bearer refreshed-token"
        }
    }));

    const result = await harness.run(
        "https://api.example.com/apiengine/protected-export",
        {},
        harness.callback,
        "fallback",
        "json"
    );

    assert.equal(result.Code, 1);
    assert.equal(result.Data.FileName, "commission.xlsx");
    assert.equal(result.Data.ContentType, contentType);
    assert.equal(harness.downloads[0].name, "commission.xlsx");
    assert.deepEqual(harness.refreshedTokens, ["Bearer refreshed-token"]);
    assert.equal(harness.callbackCount, 1);
});

test("malformed JSON and transport failures both finish exactly once", async (t) => {
    await t.test("malformed JSON", async () => {
        const harness = createHarness(async () => ({
            data: new Blob(["not-json"], { type: "application/json" }),
            headers: { "content-type": "application/json" }
        }));
        const result = await harness.run("https://api.example.com/apiengine/export", {}, harness.callback, "x", "json");
        assert.equal(result.Code, 0);
        assert.equal(harness.callbackCount, 1);
        assert.equal(harness.downloads.length, 0);
    });

    await t.test("transport failure", async () => {
        const harness = createHarness(async () => { throw new Error("network down"); });
        const result = await harness.run("https://api.example.com/apiengine/export", {}, harness.callback, "x", "json");
        assert.equal(result.Code, 0);
        assert.match(result.Msg, /network down/);
        assert.equal(harness.callbackCount, 1);
    });
});

test("table export owns loading state with await/finally instead of a success-only callback", () => {
    assert.match(operationsSource, /async ExportDiyTableRow\(btn\)/);
    assert.match(
        operationsSource,
        /BtnExportLoading = true;[\s\S]*?try\s*\{[\s\S]*?await self\.DiyCommon\.FormExportFileV2\([\s\S]*?finally\s*\{\s*self\.BtnExportLoading = false;/
    );
});
