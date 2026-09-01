#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(currentDir, "app.microi.store.json");
const saasPackagePath = path.join(currentDir, "app.microi.saas-engine.json");
const listSourcePath = path.join(currentDir, "get-microi-store-list.js");
const version = "v7.7.31";
const previousVersion = "v7.7.30";
const saasVersion = "v7.7.20";
const releaseTime = "2026-09-01 16:53:00";
const createTime = "2026-09-01T08:53:00.000Z";
const saasReleaseTime = "2026-09-01 16:20:00";
const saasCreateTime = "2026-09-01T08:20:00.000Z";
const listVersion = "v1.4.8";
const oldListCapability = "ApiEngine:get-microi-store@v1.4.7";
const listCapability = `ApiEngine:get-microi-store@${listVersion}`;
const noticeCapability = "Marketplace:AuthoritativePlatformNoticeV2";
const sourceFallbackCapability = "MicroService:MarketplaceSourceFallbackV1.9.4";
const clientCapability = "ClientFeature:OfficialPlatformNoticeFailClosedV1";
const oldProxyCapability = "ApiEngine:platform-marketplace-source@v1.0.4";
const proxyCapability = "ApiEngine:platform-marketplace-source@v1.0.5";
const changeTitle = "通知中心与应用商城源一致性修复";
const changeContent = "通知中心与批量安装统一使用服务端权威安装状态，失败时清除错误角标并明确提示；商城列表 v1.4.8 同时返回未安装与可更新应用；platform-marketplace-source v1.0.5 开放受认证的同源 HTTP 路由且继续禁止匿名，使浏览器网络、CORS 或超时故障能够真正回退当前租户可信代理。";

const packageModel = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, version].includes(String(info.Version || ""))) {
    throw new Error(`app.microi.store.json 当前版本为 ${info.Version || "(空)"}，只允许从 ${previousVersion} 幂等生成 ${version}`);
}

const listSource = fs.readFileSync(listSourcePath, "utf8").replace(/\r\n?/g, "\n");
if (!listSource.includes(`Version: ${listVersion}`)
    || !listSource.includes("isPlatformMaintenanceNotice")
    || !listSource.includes('status === "Outdated"')) {
    throw new Error(`get-microi-store-list.js 尚未同步到 ${listVersion} 权威通知实现`);
}

const engines = new Map((packageModel.SysApiEngines || []).map((engine) => [engine.ApiEngineKey, engine]));
const listEngine = engines.get("get-microi-store");
if (!listEngine) throw new Error("应用商城包缺少 get-microi-store 接口引擎");
listEngine.ApiV8Code = listSource.endsWith("\n") ? listSource : `${listSource}\n`;
listEngine.Version = listVersion;
const listHistoryLine = `${releaseTime} ${listVersion} 统一通知中心与批量安装的权威状态计算，并同时返回未安装与可更新平台应用`;
const listHistory = String(listEngine.ChangeHistory || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.includes(` ${listVersion} `));
listEngine.ChangeHistory = `${[listHistoryLine, ...listHistory].join("\n")}\n`;

const proxyEngine = engines.get("platform-marketplace-source");
if (!proxyEngine) throw new Error("应用商城包缺少 platform-marketplace-source 接口引擎");
const proxySource = fs.readFileSync(path.join(currentDir, "platform-marketplace-source.js"), "utf8")
    .replace(/\r\n?/g, "\n");
if (!proxySource.includes("Version: v1.0.5") || !proxySource.includes("MARKETPLACE_LIST_ROUTE_FAILOVER_V2")) {
    throw new Error("platform-marketplace-source.js 尚未同步到 v1.0.5");
}
proxyEngine.ApiV8Code = proxySource.endsWith("\n") ? proxySource : `${proxySource}\n`;
proxyEngine.Version = "v1.0.5";
proxyEngine.StopHttp = 0;
proxyEngine.AllowAnonymous = 0;
const proxyHistoryLine = `${releaseTime} v1.0.5 允许受认证的当前租户同源路由调用，仍禁止匿名请求`;
proxyEngine.ChangeHistory = `${[
    proxyHistoryLine,
    ...String(proxyEngine.ChangeHistory || "").split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.includes(" v1.0.5 "))
].join("\n")}\n`;

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
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(`${releaseTime.slice(0, 10)} ${version} `));
info.ChangeHistory = `${[historyLine, ...previousHistory].join("\n")}\n`;

const required = Array.isArray(info.RequiredPlatformCapabilities)
    ? info.RequiredPlatformCapabilities
    : [];
info.RequiredPlatformCapabilities = [...new Set([
    ...required.filter((capability) => capability !== oldListCapability && capability !== oldProxyCapability),
    listCapability,
    noticeCapability,
    sourceFallbackCapability,
    clientCapability,
    proxyCapability
])];
info.Capabilities = [...new Set([
    ...(Array.isArray(info.Capabilities) ? info.Capabilities : [])
        .filter((capability) => capability !== oldListCapability && capability !== oldProxyCapability),
    listCapability,
    noticeCapability,
    sourceFallbackCapability,
    clientCapability,
    proxyCapability
])];

const saasPackageModel = JSON.parse(fs.readFileSync(saasPackagePath, "utf8"));
const saasInfo = saasPackageModel.PackageInfo || (saasPackageModel.PackageInfo = {});
if (String(saasInfo.Version || "") !== saasVersion) {
    throw new Error(`app.microi.saas-engine.json 当前版本为 ${saasInfo.Version || "(空)"}，必须先嵌入 ${saasVersion} 平台微服务运行时`);
}
const saasChangeContent = "重新嵌入 microi-platform-service v1.9.4 / CurrentVersion 47；平台官方商城正式列表地址优先，仅精确路由缺失回退旧地址，浏览器网络、CORS 或超时时使用当前租户同源可信代理，业务失败继续失败关闭。";
saasInfo.CreateTime = saasCreateTime;
saasInfo.ChangeLog = {
    Version: saasVersion,
    Title: "平台内置微服务商城源可靠性修复",
    ChangeType: "Fix",
    Content: saasChangeContent,
    ReleaseTime: saasReleaseTime
};
const saasHistoryLine = `${saasReleaseTime.slice(0, 10)} ${saasVersion} ${saasChangeContent}`;
const previousSaasHistory = String(saasInfo.ChangeHistory || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith(`${saasReleaseTime.slice(0, 10)} ${saasVersion} `));
saasInfo.ChangeHistory = `${[saasHistoryLine, ...previousSaasHistory].join("\n")}\n`;

fs.writeFileSync(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, "utf8");
fs.writeFileSync(saasPackagePath, `${JSON.stringify(saasPackageModel, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
    package: path.basename(packagePath),
    version,
    saasPackage: path.basename(saasPackagePath),
    saasVersion,
    listVersion,
    capabilities: [listCapability, noticeCapability, sourceFallbackCapability, clientCapability, proxyCapability]
}, null, 2)}\n`);
