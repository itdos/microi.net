import {
    generateFormVue, generatedFormAppMarker, generatedFormAppShell,
    generatedFormFilePath, generatedFormRoutePath
} from "./form-codegen.js";

export const generatedFormAppKey = "microi-generated-forms";
const registryPath = "form-codegen.json";
const routesPath = "microi.routes.json";

function dataOf(result, key) {
    if (Number(result?.Code) !== 1) throw new Error(result?.Msg || `${key} 执行失败`);
    return result.Data;
}

async function sha256(value) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** 只读自己的生成应用；已有同名业务应用绝不能被设计器接管。 */
async function readFile(call, appId, path) {
    const result = await call("ai_app_get_file", { AppId: appId, FilePath: path });
    if (Number(result?.Code) === 2) return null;
    return String(dataOf(result, "ai_app_get_file")?.Content ?? "");
}

async function writeFile(call, appId, path, content) {
    dataOf(await call("ai_app_save_file", { AppId: appId, FilePath: path, Content: content }), "ai_app_save_file");
    const saved = await readFile(call, appId, path);
    if (saved !== content) throw new Error(`源码回读不一致：${path}`);
}

export async function saveGeneratedFormSource(call, table, fields) {
    const pageSource = generateFormVue(table, fields);
    const pagePath = generatedFormFilePath(table);
    const routePath = generatedFormRoutePath(table);
    // ai_app_list 的 Keyword 只搜索 Name/Description，不搜索 AppKey。
    const appList = dataOf(await call("ai_app_list", { Keyword: "表单代码工作台", _PageSize: 200 }), "ai_app_list");
    const matches = (Array.isArray(appList) ? appList : []).filter((app) => app.AppKey === generatedFormAppKey);
    if (matches.length > 1) throw new Error("生成应用出现重复 AppKey，请先修复应用元数据。 ");
    let app = matches[0];
    let created = false;
    if (!app) {
        app = dataOf(await call("ai_app_create", {
            Name: "表单代码工作台", AppKey: generatedFormAppKey, AppType: "MicroService",
            Category: "tools", Description: "由表单设计器生成并可在 AI 应用工作台继续编辑的 Vue 3 页面。",
            WithStarter: true
        }), "ai_app_create");
        if (app.Existing) throw new Error("同名应用已存在，需先确认其源码归属。 ");
        created = true;
    }
    const appId = String(app?.Id || "");
    if (!appId) throw new Error("未取得生成应用 Id。 ");

    const marker = await readFile(call, appId, registryPath);
    if (!created && !marker) throw new Error("目标微服务未标记为表单代码应用，已停止覆盖。 ");
    let registry = marker ? JSON.parse(marker) : { kind: generatedFormAppMarker, files: {} };
    if (registry.kind !== generatedFormAppMarker || !registry.files || typeof registry.files !== "object") {
        throw new Error("生成应用元数据无效，已停止覆盖。 ");
    }
    const existingShell = await readFile(call, appId, "src/App.vue");
    if (created) {
        await writeFile(call, appId, "src/App.vue", generatedFormAppShell);
        await writeFile(call, appId, registryPath, JSON.stringify(registry, null, 2) + "\n");
    } else if (!existingShell?.includes(generatedFormAppMarker)) {
        throw new Error("微服务入口已由人工修改，需先合并路由入口，已停止覆盖。 ");
    }

    const existingPage = await readFile(call, appId, pagePath);
    const expectedHash = registry.files[pagePath]?.sourceSha256;
    const actualHash = existingPage === null ? null : await sha256(existingPage);
    const incomingHash = await sha256(pageSource);
    if (existingPage !== null && actualHash !== expectedHash && actualHash !== incomingHash) {
        throw new Error(`${pagePath} 已手工修改。请在 AI 应用工作台审阅差异后手工合并，设计器不会覆盖。`);
    }
    if (expectedHash && existingPage === null) throw new Error(`${pagePath} 已被删除，请先检查当前微服务源码。`);

    const routesText = await readFile(call, appId, routesPath);
    const savedRoutes = routesText ? JSON.parse(routesText) : [];
    if (!Array.isArray(savedRoutes)) throw new Error("微服务路由清单不是数组。 ");
    // AI starter 的首页只是占位路由，没有对应 Vue 页面；首张生成表单成为实际首页。
    const routes = savedRoutes.filter((item) => !(item.path === "/" && !item.sourceFile));
    const existingRoute = routes.find((route) => route.path === routePath);
    if (existingRoute && existingRoute.sourceFile !== pagePath) {
        throw new Error(`路由 ${routePath} 已被其它页面占用。`);
    }
    const route = {
        path: routePath, name: `form-${String(table.Name).toLowerCase()}`,
        title: String(table.Label || table.Description || table.Name),
        sourceFile: pagePath, sort: 100 + routes.length,
        isHome: !routes.some((item) => item.isHome && item.sourceFile)
    };
    if (!existingRoute) routes.push(route);
    else Object.assign(existingRoute, { title: route.title, sourceFile: pagePath, isHome: route.isHome || Boolean(existingRoute.isHome) });

    // 保存源码与路由均有逐文件回读。发布仍走 Vite 与微服务正式流式发布协议。
    if (actualHash !== incomingHash) await writeFile(call, appId, pagePath, pageSource);
    const nextRoutes = JSON.stringify(routes, null, 2) + "\n";
    if (routesText !== nextRoutes) await writeFile(call, appId, routesPath, nextRoutes);
    registry.files[pagePath] = { sourceSha256: incomingHash, tableId: table.Id, routePath };
    await writeFile(call, appId, registryPath, JSON.stringify(registry, null, 2) + "\n");
    return { appId, appKey: generatedFormAppKey, pagePath, routePath, sourceSha256: incomingHash, created };
}
