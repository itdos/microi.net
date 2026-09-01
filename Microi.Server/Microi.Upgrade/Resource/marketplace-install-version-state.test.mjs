import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const resourceUrl = new URL("./", import.meta.url);
const listSource = await readFile(new URL("get-microi-store-list.js", resourceUrl), "utf8");
const bulkSource = await readFile(new URL("bulk-import-packages.js", resourceUrl), "utf8");

function extractNamedFunction(sourceText, name) {
    const start = sourceText.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `missing function ${name}`);
    const brace = sourceText.indexOf("{", start);
    let depth = 0;
    for (let index = brace; index < sourceText.length; index += 1) {
        if (sourceText[index] === "{") depth += 1;
        if (sourceText[index] === "}" && --depth === 0) return sourceText.slice(start, index + 1);
    }
    assert.fail(`unterminated function ${name}`);
}

const listFunctions = [
    "text",
    "trim",
    "lower",
    "toArray",
    "splitVersion",
    "compareVersion",
    "first",
    "normalizedRecordTime",
    "installedRecordTime",
    "isDeletedInstallRecord",
    "addMap",
    "installedMap",
    "findInstalled",
    "applyInstallState",
    "isPlatformMaintenanceNotice"
].map(name => extractNamedFunction(listSource, name)).join("\n");

function resolveInstallState(rows, application = {}) {
    const app = {
        Id: "store-app",
        AppId: "app.microi.store",
        AppName: "应用商城",
        AppVersion: "v7.7.25",
        ...application
    };
    const context = {
        V8: { Param: { InstalledVersions: rows } },
        application: app,
        result: null
    };
    vm.runInNewContext(
        `${listFunctions}\nvar map = installedMap([application]);\n`
            + "result = applyInstallState(application, findInstalled(map, application));",
        context
    );
    return JSON.parse(JSON.stringify(context.result));
}

test("marketplace status is independent from duplicate install-record order", () => {
    const newest = {
        Id: "newest",
        AppName: "应用商城",
        AppVersionInstall: "v7.7.25",
        InstallStatus: "Installed",
        UpdateTime: "2026-08-31 20:00:00"
    };
    const legacy = {
        Id: "legacy",
        AppName: "应用商城",
        AppVersionInstall: "v6.2.1",
        InstallStatus: "Installed",
        UpdateTime: "2025-03-01 08:00:00"
    };

    for (const rows of [[newest, legacy], [legacy, newest]]) {
        const state = resolveInstallState(rows);
        assert.equal(state.StoreInstallStatus, "Installed");
        assert.equal(state.InstalledVersion, "v7.7.25");
    }
});

test("marketplace status fails actionable for missing, deleted, failed, or blank versions", () => {
    assert.equal(resolveInstallState([]).StoreInstallStatus, "Uninstalled");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        InstallStatus: "Installed",
        UpdateTime: "2026-08-31 20:00:00"
    }]).StoreInstallStatus, "Uninstalled");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        AppVersionInstall: "v7.7.25",
        InstallStatus: "Uninstalled",
        UpdateTime: "2026-08-31 20:00:00"
    }]).StoreInstallStatus, "Uninstalled");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        PackageVersion: "v7.7.25",
        InstallStatus: "Failed",
        UpdateTime: "2026-08-31 20:00:00"
    }]).StoreInstallStatus, "Uninstalled");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        PackageVersion: "v7.7.25",
        InstallStatus: "Installed",
        IsDeleted: 1,
        UpdateTime: "2026-08-31 20:00:00"
    }]).StoreInstallStatus, "Uninstalled");
});

test("marketplace status distinguishes outdated, current, and higher local versions", () => {
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        PackageVersion: "v7.7.24",
        InstallStatus: "Installed"
    }]).StoreInstallStatus, "Outdated");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        PackageVersion: "v7.7.25",
        InstallStatus: "Succeeded"
    }]).StoreInstallStatus, "Installed");
    assert.equal(resolveInstallState([{
        AppId: "app.microi.store",
        PackageVersion: "v7.7.26",
        InstallStatus: "Failed"
    }]).StoreInstallStatus, "Abnormal");
});

test("official platform notices include missing and outdated applications without changing installed count semantics", () => {
    const context = { result: null };
    vm.runInNewContext(
        `${listFunctions}\nresult = [`
            + `isPlatformMaintenanceNotice("Uninstalled"),`
            + `isPlatformMaintenanceNotice("Outdated"),`
            + `isPlatformMaintenanceNotice("Installed"),`
            + `isPlatformMaintenanceNotice("Abnormal")];`,
        context
    );

    assert.deepEqual(JSON.parse(JSON.stringify(context.result)), [true, true, false, false]);
    assert.match(listSource, /Version:\s*v1\.4\.8/);
    assert.match(listSource, /StoreInstallStatus !== "Uninstalled"\) installedCount\+\+/);
    assert.match(listSource, /isPlatformMaintenanceNotice\(item\.StoreInstallStatus\)\) notices\.push/);
    assert.match(bulkSource, /status != 'Uninstalled' && status != 'Outdated'/);
    assert.match(bulkSource, /InstallAction:\s*status == 'Outdated'/);
});

test("bulk discovery projects deterministic install ordering and fails closed on read errors", () => {
    assert.match(bulkSource, /Version:\s*v1\.3\.9/);
    assert.match(bulkSource, /_OrderBy:\s*'UpdateTime'/);
    assert.match(bulkSource, /_OrderByType:\s*'DESC'/);
    assert.match(bulkSource, /installedVersionLoadError/);
    assert.match(bulkSource, /FailureStage:\s*'InstalledVersionRead'/);
    assert.doesNotMatch(bulkSource, /DelFormData\('sys_microistoreversion'/);
});
