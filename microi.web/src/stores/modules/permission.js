// Pinia Store - Permission
import { defineStore } from "pinia";
import { asyncRoutes, constantRoutes } from "@/router";
import { DiyApi, DiyCommon, DiyTable, DiyMyWork, DiyFlowIndex } from "@/utils/microi.net.import";
import Layout from "@/layout";
import { DiyOsClient } from "@/utils/itdos.osclient";
import _ from "underscore";
// Vue Router 4 支持直接使用 () => import() 形式，不需要 defineAsyncComponent

/**
 * Use meta.role to determine if the current user has permission
 */
function hasPermission(roles, route) {
    if (route.meta && route.meta.roles) {
        return roles.some((role) => route.meta.roles.includes(role));
    } else {
        return true;
    }
}

// 路径映射表：服务器返回的路径 -> 实际文件路径
const pathMappings = {
    // workflow 相关映射
    "/microi.net/workflow/": "/diy/workflow/",
    "/microi/workflow/": "/diy/workflow/",
    // page-engine 相关映射
    "/microi-pageengine/page-renderer": "/page-engine/renderer",
    "/microi-pageengine/": "/page-engine/",
    // form 相关映射
    "/microi.net/diy-form-page": "/diy/diy-form-page",
    // system 相关映射
    "/itdos/system/theme-setting": "/itdos/system/system-setting"
};

// 已知不存在的组件路径（静默处理，不打印警告）
const ignoredPaths = ["/microi.printengine/", "/diy/form-designer", "/diy/form-renderer", "/page-engine/print-designer"];

function normalizeComponentPath(componentPath) {
    let normalized = componentPath;

    // 应用路径映射
    for (const [from, to] of Object.entries(pathMappings)) {
        if (normalized.includes(from)) {
            normalized = normalized.replace(from, to);
            break;
        }
    }

    return normalized;
}

// 检查是否应该忽略此路径的警告
function shouldIgnoreWarning(componentPath) {
    return ignoredPaths.some((ignoredPath) => componentPath.includes(ignoredPath));
}

function GetComponent(item) {
    if (DiyCommon.IsNull(item.ComponentPath)) {
        return null;
    }
    // 如果是微服务，也要返回 Null
    if (item.IsMicroiService) {
        return null;
    }
    // 修复老数据
    if (item.ComponentPath.indexOf("/itdos/diy/") > -1) {
        item.ComponentPath = item.ComponentPath.replace("/itdos/diy/", "/diy/");
    }
    if (item.ComponentPath.length > 7 && item.ComponentPath.substring(0, 7) == "/views/") {
        item.ComponentPath = item.ComponentPath.replace("/views/", "/");
    }
    if (item.ComponentPath.indexOf("diy-table-rowlist") > -1) {
        return DiyTable;
    }
    if (item.ComponentPath.indexOf("microi/workflow/my-work") > -1) {
        return DiyMyWork;
    }
    if (item.ComponentPath.indexOf("microi/workflow/index") > -1) {
        return DiyFlowIndex;
    }
    if (item.ComponentPath.indexOf("diy/diy-table") > -1) {
        return DiyTable;
    }

    // 标准化组件路径
    const componentPath = normalizeComponentPath(item.ComponentPath);

    // Vite: 使用 import.meta.glob 实现动态导入
    // 注意：glob 的键是相对于项目根目录的路径
    const modules = import.meta.glob("/src/views/**/*.vue");

    // 构建可能的路径
    const possiblePaths = [
        `/src/views${componentPath}.vue`,
        `/src/views${componentPath}/index.vue`,
        // 尝试移除 .vue 后缀再添加
        `/src/views${componentPath.replace(".vue", "")}.vue`,
        `/src/views${componentPath.replace(".vue", "")}/index.vue`
    ];

    for (const path of possiblePaths) {
        if (modules[path]) {
            // Vue Router 4 直接返回动态导入函数，不需要 defineAsyncComponent
            return modules[path];
        }
    }

    // 调试：打印可用的模块路径以帮助诊断
    // console.log('Available modules:', Object.keys(modules).filter(k => k.includes(componentPath.split('/').pop())));

    // 只在非忽略路径时打印警告
    if (!shouldIgnoreWarning(item.ComponentPath) && !shouldIgnoreWarning(componentPath)) {
        console.warn(`Component not found: ${item.ComponentPath} (normalized: ${componentPath})`);
    }
    return null;
}

/**
 * 递归生成左侧菜单模块  --by itdos.com
 */
function MenuBuild(result, data, isFater) {
    data.forEach((item) => {
        try {
            // 如果有子菜单，即使没有 Url 也要处理（作为父级文件夹）
            const hasChildren = item._Child && item._Child.length > 0;

            // 如果没有 Url 且没有子菜单，跳过
            if (DiyCommon.IsNull(item.Url) && !hasChildren) {
                return;
            }

            // 如果有 Url，处理 Url
            if (!DiyCommon.IsNull(item.Url)) {
                item.Url = item.Url.trim();

                // 跳过外部链接（http/https 开头的 URL 不应该添加为路由）
                if (item.Url.startsWith("http://") || item.Url.startsWith("https://")) {
                    // 外部链接不需要添加为路由，直接跳过
                    return;
                }
            } else {
                // 父级文件夹没有 Url，生成一个虚拟路径
                item.Url = "/folder-" + DiyCommon.GuidRemoveSing(item.Id);
            }

            if (item.ComponentPath) {
                item.ComponentPath = item.ComponentPath.trim();
                if (item.ComponentPath.indexOf("?") > -1) {
                    item.UrlParam = item.ComponentPath.split("?")[1];
                    item.ComponentPath = item.ComponentPath.replace(/\?.*/, "");
                }
            }
            if (item.Url.startsWith("/iframe/")) {
                item.ComponentPath = "/diy/iframe";
                if (item.UrlApiEngineId) {
                    item.Url = "/iframe/" + item.UrlApiEngineId;
                } else {
                    item.Url = "/iframe/" + encodeURIComponent(item.Url.replace("/iframe/", ""));
                }
            } else {
                if (item.Url.indexOf("?") > -1) {
                    item.UrlParam = item.Url.split("?")[1];
                    item.Url = item.Url.replace(/\?.*/, "");
                }
            }

            // 将 _Child 下为空的 Url 干掉
            if (item._Child && item._Child.length > 0) {
                item._Child = _.filter(item._Child, function (child) {
                    return !DiyCommon.IsNull(child.Url);
                });
            }

            var component = null;
            var menu = {};

            // 定义 component
            if (isFater) {
                component = Layout;
                menu = {
                    Id: item.Id,
                    Display: item.Display,
                    UrlParam: item.UrlParam,
                    Link: item.Link,
                    name: "parent_menu_" + DiyCommon.GuidRemoveSing(item.Id),
                    path: item.Url,
                    component: component,
                    meta: {
                        Id: item.Id,
                        DiyTableId: item.DiyTableId,
                        Display: item.Display,
                        UrlParam: item.UrlParam,
                        title: item.Name,
                        icon: item.IconClass ? item.IconClass : ""
                    },
                    children: []
                };

                // 如果没有下级，或只有一个下级
                if (DiyCommon.IsNull(item._Child) || item._Child.length == 0) {
                    var coopyItem = DiyCommon.IsNull(item._Child) || item._Child.length == 0 ? item : item._Child[0];
                    menu.children = [
                        {
                            Id: coopyItem.Id,
                            Display: coopyItem.Display,
                            UrlParam: coopyItem.UrlParam,
                            Link: coopyItem.Link,
                            path: coopyItem.Url,
                            component: GetComponent(coopyItem),
                            name: "menu_" + DiyCommon.GuidRemoveSing(coopyItem.Id),
                            meta: {
                                Id: coopyItem.Id,
                                DiyTableId: coopyItem.DiyTableId,
                                Display: coopyItem.Display,
                                UrlParam: coopyItem.UrlParam,
                                title: coopyItem.Name,
                                icon: coopyItem.IconClass ? coopyItem.IconClass : ""
                            }
                        }
                    ];
                    if (item._Child && item._Child.length == 1) {
                        menu.alwaysShow = true;
                    }
                    result.push(menu);
                }
                // 如果有多个下级
                else if (item._Child && item._Child.length > 0) {
                    menu.alwaysShow = true;
                    MenuBuild(menu.children, item._Child, false);
                    result.push(menu);
                }
            }
            // 如果不是第一级
            else {
                // 如果没有下级
                if (DiyCommon.IsNull(item._Child) || item._Child.length == 0) {
                    component = GetComponent(item);
                    var coopyItem = DiyCommon.IsNull(item._Child) || item._Child.length == 0 ? item : item._Child[0];
                    menu = {
                        Id: coopyItem.Id,
                        Display: coopyItem.Display,
                        UrlParam: coopyItem.UrlParam,
                        Link: coopyItem.Link,
                        path: coopyItem.Url,
                        name: "menu_" + DiyCommon.GuidRemoveSing(coopyItem.Id),
                        meta: {
                            Id: coopyItem.Id,
                            DiyTableId: coopyItem.DiyTableId,
                            Display: coopyItem.Display,
                            UrlParam: coopyItem.UrlParam,
                            title: coopyItem.Name,
                            icon: coopyItem.IconClass ? coopyItem.IconClass : ""
                        }
                    };
                    if (component != null) {
                        menu.component = component;
                    }
                    result.push(menu);
                } else if (item._Child && item._Child.length > 0) {
                    // Vite 动态导入 - Vue Router 4 直接使用动态导入函数
                    component = () => import("@/views/index.vue");
                    menu = {
                        Id: item.Id,
                        Display: item.Display,
                        UrlParam: item.UrlParam,
                        Link: item.Link,
                        alwaysShow: true,
                        path: item.Url,
                        component: component,
                        name: "parent_menu_" + DiyCommon.GuidRemoveSing(item.Id),
                        meta: {
                            Id: item.Id,
                            DiyTableId: item.DiyTableId,
                            Display: item.Display,
                            UrlParam: item.UrlParam,
                            title: item.Name,
                            icon: item.IconClass ? item.IconClass : ""
                        },
                        children: []
                    };
                    MenuBuild(menu.children, item._Child, false);
                    result.push(menu);
                }
            }
        } catch (error) {
            console.log("MenuBuild Error：");
            console.log(error);
        }
    });
}

/**
 * Filter asynchronous routing tables by recursion
 */
export function filterAsyncRoutes(routes, roles) {
    const res = [];

    routes.forEach((route) => {
        const tmp = { ...route };
        if (hasPermission(roles, tmp)) {
            if (tmp.children) {
                tmp.children = filterAsyncRoutes(tmp.children, roles);
            }
            res.push(tmp);
        }
    });

    return res;
}

export const usePermissionStore = defineStore("permission", {
    state: () => ({
        routes: [],
        addRoutes: []
    }),

    actions: {
        setRoutes(routes) {
            this.addRoutes = routes;
            this.routes = constantRoutes.concat(routes);
        },

        generateRoutes(roles) {
            return new Promise((resolve) => {
                // 从服务器端查询自定义功能模块
                var osClient = DiyOsClient.GetOsClient();
                var reg190317 = new RegExp("(^|&)" + "ChildSystemId" + "=([^&]*)(&|$)");
                var r190317 = window.location.search.substr(1).match(reg190317);
                var childSystemId = r190317 != null ? r190317[2] : null;

                DiyCommon.Post(
                    DiyApi.GetSysMenuStep(),
                    {
                        OsClient: osClient,
                        TableName: "Sys_Menu",
                        _OrderBy: "Sort",
                        _OrderByType: "ASC",
                        _ChildSystemId: childSystemId
                    },
                    (result) => {
                        if (DiyCommon.Result(result)) {
                            var menuArr = [];
                            MenuBuild(menuArr, result.Data, true);

                            menuArr.forEach((element) => {
                                asyncRoutes.splice(asyncRoutes.length - 1, 0, element);
                            });

                            var fixedComponents = [];

                            fixedComponents.forEach((element) => {
                                asyncRoutes.splice(asyncRoutes.length - 1, 0, element);
                            });

                            // 以下为默认代码
                            let accessedRoutes;
                            if (roles.includes("admin")) {
                                accessedRoutes = asyncRoutes || [];
                            } else {
                                accessedRoutes = filterAsyncRoutes(asyncRoutes, roles);
                            }
                            this.setRoutes(accessedRoutes);
                            resolve(accessedRoutes);
                        }
                    }
                );
            });
        }
    }
});
