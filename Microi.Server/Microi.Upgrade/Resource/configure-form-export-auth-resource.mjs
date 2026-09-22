import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const packagePath = path.join(directory, "app.microi.form-engine.json");
const targetVersion = "v7.7.6";
const capability = "ClientFeature:ProtectedCustomExportAuthorizationV1";
const releaseTime = "2026-09-21 10:35:39";
const title = "受保护的自定义导出身份与状态恢复";
const content = "修复后台菜单自定义导出未通过 Authorization 请求头携带 DiyToken 的问题；接口无需开启匿名调用，业务错误、解析错误和网络错误都会可靠结束导出按钮 Loading。";

const model = JSON.parse(fs.readFileSync(packagePath, "utf8"));
const info = model.PackageInfo;
if (!info || typeof info !== "object") throw new Error("表单引擎应用包缺少 PackageInfo");

info.Version = targetVersion;
info.RequiredPlatformCapabilities = [...new Set([
    ...(Array.isArray(info.RequiredPlatformCapabilities) ? info.RequiredPlatformCapabilities : []),
    capability
])];
info.ChangeLog = {
    Version: targetVersion,
    Title: title,
    ChangeType: "Fix",
    Content: content,
    ReleaseTime: releaseTime
};

const currentHistory = String(info.ChangeHistory || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !line.startsWith(`2026-09-21 ${targetVersion} `));
info.ChangeHistory = `2026-09-21 ${targetVersion} ${content}\n${currentHistory.join("\n")}\n`;

fs.writeFileSync(packagePath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ packagePath, version: targetVersion, capability }, null, 2));
