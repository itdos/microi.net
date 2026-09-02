import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const packagePath = resolve(directory, "app.microi.store.json");
const enginePath = resolve(directory, "platform-sys-menu.js");
const previousVersion = "v7.8.5";
const targetVersion = "v7.8.6";
const releaseTime = "2026-09-02 10:20:00";
const changeContent = "platform-sys-menu 升级至 v1.0.3，新增角色权限专用 GetRolePermissionTree 动作，固定按钮权限窄投影并复用授权版本缓存与 O(n) 线性组树；配合当前平台前端对旧包精确回退 GetSysMenuStep，数千菜单的角色权限首次加载不再调用 O(n²) 通用树接口。";

function appendUnique(values, value) {
    const result = Array.isArray(values) ? values : [];
    if (!result.includes(value)) result.push(value);
    return result;
}

const packageModel = JSON.parse(await readFile(packagePath, "utf8"));
const info = packageModel.PackageInfo || (packageModel.PackageInfo = {});
if (![previousVersion, targetVersion].includes(String(info.Version || ""))) {
    throw new Error(`app.microi.store.json 当前版本为 ${info.Version || "(空)"}，只允许从 ${previousVersion} 幂等生成 ${targetVersion}`);
}

const engine = (packageModel.SysApiEngines || []).find(
    (item) => item.ApiEngineKey === "platform-sys-menu"
);
if (!engine) throw new Error("app.microi.store.json 缺少 platform-sys-menu");

const source = `${(await readFile(enginePath, "utf8")).replace(/\r\n?/g, "\n").replace(/\n*$/g, "")}\n`;
if (!/Version:\s*v1\.0\.3/.test(source) || !source.includes("GetRolePermissionTree")) {
    throw new Error("platform-sys-menu.js 尚未声明 v1.0.3 GetRolePermissionTree");
}

engine.ApiV8Code = source;
engine.Version = "v1.0.3";
const routes = String(engine.ApiRoutes || "").split(";").filter(Boolean);
const rolePermissionRoute = "/api/SysMenu/GetRolePermissionTree";
if (!routes.includes(rolePermissionRoute)) routes.push(rolePermissionRoute);
engine.ApiRoutes = routes.join(";");
const engineHistoryLine = `${releaseTime.substring(0, 10)} v1.0.3 ${changeContent}`;
engine.ChangeHistory = [
    engineHistoryLine,
    ...String(engine.ChangeHistory || "").split(/\r?\n/).filter(
        (line) => line && !line.includes(" v1.0.3 ")
    )
].join("\n");

info.Version = targetVersion;
info.ChangeLog = {
    Version: targetVersion,
    Title: "角色权限树线性缓存加载",
    ChangeType: "Optimize",
    Content: changeContent,
    ReleaseTime: releaseTime
};
const historyLine = `${releaseTime.substring(0, 10)} ${targetVersion} ${changeContent}`;
info.ChangeHistory = [
    historyLine,
    ...String(info.ChangeHistory || "").split(/\r?\n/).filter(
        (line) => line && !line.includes(` ${targetVersion} `)
    )
].join("\n") + "\n";
info.Capabilities = appendUnique(
    info.Capabilities,
    "ClientFeature:RolePermissionTreeCachedV1"
);

await writeFile(packagePath, `${JSON.stringify(packageModel, null, 2)}\n`, "utf8");
console.log(JSON.stringify({
    packageVersion: info.Version,
    engineVersion: engine.Version,
    route: rolePermissionRoute,
    capability: "ClientFeature:RolePermissionTreeCachedV1"
}));
