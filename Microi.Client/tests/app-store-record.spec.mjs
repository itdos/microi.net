import assert from "node:assert/strict";
import test from "node:test";

import {
    buildAppStoreMap,
    getAppStoreRecordTimestamp
} from "../src/utils/app-store-record.js";

test("notification install map keeps the newest duplicate when stable ids are missing", () => {
    const newest = {
        Id: "current",
        AppName: "应用商城",
        AppVersionInstall: "v7.7.24",
        UpdateTime: "2026-08-31 19:16:01"
    };
    const legacy = {
        Id: "legacy",
        AppName: "应用商城",
        AppVersionInstall: "v6.2.1",
        UpdateTime: "2025-03-01 08:00:00"
    };

    assert.equal(buildAppStoreMap([newest, legacy])["appname:应用商城"], newest);
    assert.equal(buildAppStoreMap([legacy, newest])["appname:应用商城"], newest);
});

test("notification install map resolves each identity key to its newest record", () => {
    const latest = {
        StoreId: "store-form",
        AppId: "app.microi.form-engine",
        AppName: "表单引擎",
        AppVersionInstall: "v7.6.8",
        LastCheckTime: "2026-08-31T19:16:05.321Z"
    };
    const old = {
        StoreId: "store-form",
        AppId: "app.microi.form-engine",
        AppName: "表单引擎",
        AppVersionInstall: "v6.2.1",
        InstallTime: "2025-02-01 10:00:00"
    };
    const map = buildAppStoreMap([old, latest]);

    assert.equal(map["storeid:store-form"], latest);
    assert.equal(map["appid:app.microi.form-engine"], latest);
    assert.equal(map["appname:表单引擎"], latest);
    assert.ok(getAppStoreRecordTimestamp(latest) > getAppStoreRecordTimestamp(old));
});

test("equal or missing timestamps preserve the first source row", () => {
    const first = { Id: "first", AppName: "模块引擎" };
    const second = { Id: "second", AppName: "模块引擎" };

    assert.equal(buildAppStoreMap([first, second])["appname:模块引擎"], first);
});

test("soft-deleted install records never win the notification lookup", () => {
    const deleted = {
        Id: "deleted",
        AppName: "表单引擎",
        IsDeleted: 1,
        UpdateTime: "2026-09-01 00:00:00"
    };
    const current = {
        Id: "current",
        AppName: "表单引擎",
        UpdateTime: "2026-08-31 19:16:05"
    };

    assert.equal(buildAppStoreMap([deleted, current])["appname:表单引擎"], current);
});
