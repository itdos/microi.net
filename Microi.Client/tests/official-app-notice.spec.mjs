import assert from "node:assert/strict";
import test from "node:test";

import {
    OFFICIAL_STORE_LEGACY_LIST_PATH,
    OFFICIAL_STORE_LIST_PATH,
    consumeCompletedPlatformMaintenanceTransitions,
    createCoalescedTrailingRunner,
    normalizeInstalledVersionsForOfficialCheck,
    normalizeOfficialAppNotices,
    requestOfficialStoreList
} from "../src/utils/official-app-notice.js";

function response(data, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return JSON.stringify(data);
        }
    };
}

function textResponse(text, status) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async text() {
            return text;
        }
    };
}

test("官方商城正式地址成功时不调用旧地址或同源代理", async () => {
    const urls = [];
    let proxyCalls = 0;
    const result = await requestOfficialStoreList({ Action: "CheckPlatformApps" }, {
        fetchImpl: async (url, options) => {
            urls.push(url);
            assert.equal(options.credentials, "omit");
            assert.equal(options.headers.apiengine, "1");
            return response({ Code: 1, Data: { Notices: [] } });
        },
        proxyRequest: async () => {
            proxyCalls++;
            return { Code: 1, Data: { Notices: [] } };
        }
    });

    assert.equal(urls.length, 1);
    assert.match(urls[0], new RegExp(`${OFFICIAL_STORE_LIST_PATH}\\?`));
    assert.equal(proxyCalls, 0);
    assert.equal(result.DataAppend.MarketplaceListRouteFallback, false);
});

test("仅正式列表地址明确不存在时回退旧地址", async () => {
    const urls = [];
    const result = await requestOfficialStoreList({}, {
        fetchImpl: async (url) => {
            urls.push(url);
            if (urls.length === 1) {
                return response({ Code: 0, Msg: "NoExistData[ApiAddress]:/apiengine/get-microi-store-list" });
            }
            return response({ Code: 1, Data: { Notices: [] } });
        }
    });

    assert.equal(urls.length, 2);
    assert.match(urls[1], new RegExp(`${OFFICIAL_STORE_LEGACY_LIST_PATH}\\?`));
    assert.equal(result.DataAppend.MarketplaceListRouteFallback, true);
});

test("正式列表的 HTML 404 仍精确回退旧地址", async () => {
    const urls = [];
    const result = await requestOfficialStoreList({}, {
        fetchImpl: async (url) => {
            urls.push(url);
            return urls.length === 1
                ? textResponse("<html>not found</html>", 404)
                : response({ Code: 1, Data: { Notices: [] } });
        }
    });

    assert.equal(urls.length, 2);
    assert.match(urls[1], new RegExp(`${OFFICIAL_STORE_LEGACY_LIST_PATH}\\?`));
    assert.equal(result.DataAppend.MarketplaceListRouteFallback, true);
});

test("浏览器传输失败时使用当前租户同源代理", async () => {
    let proxyParam;
    const result = await requestOfficialStoreList({
        Action: "CheckPlatformApps",
        ApplicationType: "Platform",
        ApplicationTypes: ["Platform"],
        InstalledVersions: [{ AppId: "app.demo" }]
    }, {
        fetchImpl: async () => {
            throw new TypeError("Failed to fetch");
        },
        proxyRequest: async (param) => {
            proxyParam = param;
            return { Code: 1, Data: { Notices: [] } };
        }
    });

    assert.equal(proxyParam.Action, "Query");
    assert.equal(proxyParam.Operation, "List");
    assert.equal(proxyParam.SourceId, "official");
    assert.equal(proxyParam.ApiBase, "https://api.itdos.com");
    assert.equal(proxyParam.OsClient, "iTdos");
    assert.equal(proxyParam.Param.Action, "CheckPlatformApps");
    assert.equal(proxyParam.Param.ApplicationType, "Platform");
    assert.deepEqual(proxyParam.Param.ApplicationTypes, ["Platform"]);
    assert.deepEqual(proxyParam.Param.InstalledVersions, [{ AppId: "app.demo" }]);
    assert.equal(result.DataAppend.MarketplaceSameOriginProxyFallback, true);
});

test("商城业务失败不宽泛降级到同源代理", async () => {
    let proxyCalls = 0;
    await assert.rejects(
        requestOfficialStoreList({}, {
            fetchImpl: async () => response({ Code: 0, Msg: "应用发布状态校验失败" }),
            proxyRequest: async () => {
                proxyCalls++;
                return { Code: 1, Data: [] };
            }
        }),
        /应用发布状态校验失败/
    );
    assert.equal(proxyCalls, 0);
});

test("非路由 HTTP 失败和无效 JSON 都失败关闭", async () => {
    for (const fetchImpl of [
        async () => response({ Code: 0, Msg: "upstream unavailable" }, 503),
        async () => textResponse("gateway html", 200)
    ]) {
        let proxyCalls = 0;
        await assert.rejects(requestOfficialStoreList({}, {
            fetchImpl,
            proxyRequest: async () => {
                proxyCalls++;
                return { Code: 1, Data: [] };
            }
        }));
        assert.equal(proxyCalls, 0);
    }
});

test("通知只接受权威未安装和可更新状态，响应缺失时失败关闭", () => {
    const rows = normalizeOfficialAppNotices({
        Code: 1,
        Data: {
            Notices: [
                { StoreId: "store-a", AppId: "a", AppVersion: "2.0.0", Status: "Uninstalled", ApplicationType: "Platform" },
                { StoreId: "store-b", AppId: "b", AppVersion: "2.0.0", Status: "Outdated", InstalledVersion: "1.0.0", ApplicationType: "Platform" },
                { AppId: "c", Status: "Installed", ApplicationType: "Platform" },
                { AppId: "d", Status: "Uninstalled", ApplicationType: "Web" }
            ]
        }
    });
    assert.deepEqual(rows.map((item) => item.AppId), ["a", "b"]);
    assert.deepEqual(
        { StoreId: rows[0].StoreId, AppId: rows[0].AppId, AppVersion: rows[0].AppVersion },
        { StoreId: "store-a", AppId: "a", AppVersion: "2.0.0" }
    );
    assert.equal(rows[1].AppVersionInstall, "1.0.0");
    assert.throws(() => normalizeOfficialAppNotices({ Code: 1, Data: {} }), /未返回可验证/);
    assert.throws(
        () => normalizeOfficialAppNotices({ Code: 1, Data: {}, DataAppend: { Notices: [] } }),
        /未返回可验证/
    );
    assert.throws(
        () => normalizeOfficialAppNotices({
            Code: 1,
            Data: { Notices: [{ AppId: "broken", Status: "Uninstalled", ApplicationType: "Platform" }] }
        }),
        /缺少 StoreId 或稳定应用标识/
    );
});

test("单条商城历史脏数据按 StoreId 隔离且缺版本时显式标记异常", () => {
    const rows = normalizeOfficialAppNotices({
        Code: 1,
        Data: {
            Notices: [
                { StoreId: "store-key", AppKey: "app.key", AppVersion: "v1.0.3", Status: "Uninstalled", ApplicationType: "Platform" },
                { StoreId: "store-only", AppName: "历史应用", Status: "Uninstalled", ApplicationType: "Platform" },
                { StoreId: "store-good", AppId: "app.good", AppVersion: "v2.0.0", Status: "Outdated", ApplicationType: "Platform" }
            ]
        }
    });

    assert.equal(rows.length, 3);
    assert.equal(rows[0].AppId, "app.key");
    assert.equal(rows[1].AppId, "store:store-only");
    assert.equal(rows[1].Status, "Abnormal");
    assert.equal(rows[1].DataIntegrityIssue, "MissingAppVersion");
    assert.equal(rows[2].Status, "Outdated");
});

test("已安装版本投影去重并保留最新软删除记录", () => {
    const rows = normalizeInstalledVersionsForOfficialCheck([
        {
            Id: "new",
            StoreId: "store-a",
            AppId: "app.a",
            AppName: "应用A",
            AppVersionInstall: "v2.0.0",
            IsDeleted: 1,
            UpdateTime: "2026-09-04 10:00:00",
            UntrustedLargeField: "must-not-cross-boundary"
        },
        {
            Id: "old",
            StoreId: "store-a",
            AppId: "app.a",
            AppName: "应用A",
            AppVersionInstall: "v1.0.0",
            IsDeleted: 0,
            UpdateTime: "2026-09-03 10:00:00"
        },
        {
            Id: "other",
            StoreId: "store-b",
            AppId: "app.b",
            AppVersionInstall: "v1.0.0",
            UpdateTime: "2026-09-02 10:00:00"
        }
    ]);

    assert.deepEqual(rows.map((row) => row.Id), ["new", "other"]);
    assert.equal(rows[0].IsDeleted, 1);
    assert.equal(Object.prototype.hasOwnProperty.call(rows[0], "UntrustedLargeField"), false);
});

test("平台维护任务的首次终态与正常迁移都只消费一次", () => {
    const terminal = (item) => item.Status === "Succeeded" || item.Status === "Failed";
    const maintenance = (item) => item.Type === "PlatformApps";
    const registered = { fast: true };

    const fast = consumeCompletedPlatformMaintenanceTransitions({
        rows: [{ Id: "fast", Type: "PlatformApps", Status: "Succeeded" }],
        previousRows: [],
        registeredTaskIds: registered,
        isTerminalTask: terminal,
        isMaintenanceTask: maintenance
    });
    assert.deepEqual(fast, ["fast"]);
    assert.equal(registered.fast, undefined);

    const transitioned = consumeCompletedPlatformMaintenanceTransitions({
        rows: [{ Id: "normal", Type: "PlatformApps", Status: "Succeeded" }],
        previousRows: [{ Id: "normal", Type: "PlatformApps", Status: "Running" }],
        registeredTaskIds: registered,
        isTerminalTask: terminal,
        isMaintenanceTask: maintenance
    });
    assert.deepEqual(transitioned, ["normal"]);

    const historical = consumeCompletedPlatformMaintenanceTransitions({
        rows: [{ Id: "history", Type: "PlatformApps", Status: "Succeeded" }],
        previousRows: [],
        registeredTaskIds: registered,
        isTerminalTask: terminal,
        isMaintenanceTask: maintenance
    });
    assert.deepEqual(historical, []);

    const duplicate = consumeCompletedPlatformMaintenanceTransitions({
        rows: [{ Id: "fast", Type: "PlatformApps", Status: "Succeeded" }],
        previousRows: [],
        registeredTaskIds: registered,
        isTerminalTask: terminal,
        isMaintenanceTask: maintenance
    });
    assert.deepEqual(duplicate, []);
});

test("进行中的商城检查会合并并保留任务完成后的尾随强制刷新", async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
    });
    const calls = [];
    const runner = createCoalescedTrailingRunner(async (force) => {
        calls.push(force);
        if (calls.length === 1) await firstGate;
    }, (pendingForce, requestedForce) => Boolean(pendingForce || requestedForce));

    const active = runner(false);
    assert.equal(runner(false), active);
    assert.equal(runner(true), active);
    assert.equal(runner(false), active);
    releaseFirst();
    await active;

    assert.deepEqual(calls, [false, true]);
});

test("商城检查落定与清理之间的微任务请求仍会继续执行", async () => {
    const calls = [];
    let runner;
    runner = createCoalescedTrailingRunner(async (value) => {
        calls.push(value);
    });

    const active = runner(1);
    queueMicrotask(() => runner(2));
    await active;

    assert.deepEqual(calls, [1, 2]);
});

test("第二个维护任务在第一次刷新期间完成时不会丢失刷新", async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => {
        releaseFirst = resolve;
    });
    const snapshots = [];
    let installedVersion = "1.0.0";
    const runner = createCoalescedTrailingRunner(async () => {
        snapshots.push(installedVersion);
        if (snapshots.length === 1) await firstGate;
    });

    const active = runner();
    installedVersion = "2.0.0";
    assert.equal(runner(), active);
    releaseFirst();
    await active;

    assert.deepEqual(snapshots, ["1.0.0", "2.0.0"]);
});
