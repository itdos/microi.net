#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(currentDir, "app.microi.store.json");
const previousVersion = "v7.7.24";
const version = "v7.7.25";
const releaseTime = "2026-08-31 20:30:33";
const createTime = "2026-08-31T12:30:33.581Z";
const clientCapability = "ClientFeature:AppStoreNewestInstallRecordV1";
const stateCapability = "Marketplace:DeterministicInstallVersionStateV1";
const listCapability = "ApiEngine:get-microi-store@v1.4.7";
const bulkCapability = "ApiEngine:bulk-import-microi-store-packages@v1.3.9";
const changeTitle = "通知中心安装版本判定一致性修复";
const changeContent = "修复通知中心读取同一应用的历史重复安装记录时旧版本覆盖新版本、导致已是最新版仍误报待更新的问题；客户端按 UpdateTime 确定性选择最新有效记录，商城列表 v1.4.7 统一处理重复、软删除、失败和空版本状态，批量协调器 v1.3.9 按更新时间读取并在读取失败时停止安装计划。";

const packageModel = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, version].includes(String(info.Version || ""))) {
    throw new Error(`app.microi.store.json 当前版本为 ${info.Version || "(空)"}，拒绝覆盖并发发布`);
}

const engines = new Map((packageModel.SysApiEngines || []).map(engine => [engine.ApiEngineKey, engine]));
for (const [key, expectedVersion] of [
    ["get-microi-store", "v1.4.7"],
    ["bulk-import-microi-store-packages", "v1.3.9"]
]) {
    const engine = engines.get(key);
    if (!engine || engine.Version !== expectedVersion || !String(engine.ApiV8Code || "").includes(`Version: ${expectedVersion}`)) {
        throw new Error(`${key} 尚未同步到 ${expectedVersion}`);
    }
}
const listEngine = engines.get("get-microi-store");
const bulkEngine = engines.get("bulk-import-microi-store-packages");
const listHistoryLine = `${releaseTime} v1.4.7 按 UpdateTime 确定性选择最新有效安装记录，并统一处理重复、软删除、失败及空版本状态`;
const bulkHistoryLine = `${releaseTime} v1.3.9 按 UpdateTime 降序投影完整安装状态，读取失败时停止生成安装计划`;
for (const [engine, historyLine] of [[listEngine, listHistoryLine], [bulkEngine, bulkHistoryLine]]) {
    const history = String(engine.ChangeHistory || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !line.includes(` ${engine.Version} `));
    engine.ChangeHistory = `${[historyLine, ...history].join("\n")}\n`;
}

info.Version = version;
info.CreateTime = createTime;
info.ChangeLog = {
    Version: version,
    Title: changeTitle,
    ChangeType: "Fix",
    Content: changeContent,
    ReleaseTime: releaseTime
};
const historyLine = `${releaseTime.slice(0, 10)} ${version} ${changeContent}`;
const previousHistory = String(info.ChangeHistory || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith(`${releaseTime.slice(0, 10)} ${version} `));
info.ChangeHistory = `${[historyLine, ...previousHistory].join("\n")}\n`;

const required = Array.isArray(info.RequiredPlatformCapabilities)
    ? info.RequiredPlatformCapabilities
    : [];
info.RequiredPlatformCapabilities = [...new Set([
    ...required.filter(capability => capability !== "ApiEngine:bulk-import-microi-store-packages@v1.3.8"),
    clientCapability,
    stateCapability,
    listCapability,
    bulkCapability
])];
info.Capabilities = [...new Set([
    ...(Array.isArray(info.Capabilities) ? info.Capabilities : []),
    stateCapability,
    listCapability,
    bulkCapability
])];

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
    package: path.basename(packagePath),
    version,
    capabilities: [clientCapability, stateCapability, listCapability, bulkCapability]
}, null, 2)}\n`);
