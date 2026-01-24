// Vue Router 4 for Vue 3
import { createRouter, createWebHashHistory } from "vue-router";
import { DosCommon, DiyCommon, DiyFlowDesign, DiyFormPage } from "@/utils/microi.net.import";

/* Layout */
import Layout from "@/layout";

/* Router Modules */

// 插件系统已移除
// import { loadPluginRoutes } from "./plugin-routes-loader.js";
// import { pluginConfigManager } from "@/views/plugins/index.js";

/**
 * Note: sub-menu only appear when route children.length >= 1
 *
 * hidden: true                   if set true, item will not show in the sidebar(default is false)
 * alwaysShow: true               if set true, will always show the root menu
 *                                if not set alwaysShow, when item has more than one children route,
 *                                it will becomes nested mode, otherwise not show the root menu
 * redirect: noRedirect           if set noRedirect will no redirect in the breadcrumb
 * name:'router-name'             the name is used by <keep-alive> (must set!!!)
 * meta : {
  roles: ['admin','editor']    control the page roles (you can set multiple roles)
  title: 'title'               the name show in sidebar and breadcrumb (recommend set)
  icon: 'svg-name'/'el-icon-x' the icon show in the sidebar
  noCache: true                if set true, the page will no be cached(default is false)
  affix: true                  if set true, the tag will affix in the tags-view
  breadcrumb: false            if set false, the item will hidden in breadcrumb(default is true)
  activeMenu: '/example/list'  if set path, the sidebar will highlight the path you set
  }
 */

/**
 * constantRoutes
 * a base page that does not have permission requirements
 * all roles can be accessed
 */
export const constantRoutes = [
    {
        path: "/",
        component: Layout,
        redirect: "/home",
        children: [
            {
                path: "home",
                component: () => import("@/views/home.vue"),
                name: "Home",
                meta: { title: "首页", icon: "dashboard", affix: true }
            }
        ]
    },
    {
        path: "/redirect",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "/redirect/:path(.*)",
                component: () => import("@/views/redirect/index.vue")
            }
        ]
    },
    {
        path: "/login",
        component: () => import("@/views/login/index.vue"),
        hidden: true
    }
    // {
    // 	path: '/calendar',
    // 	component: () => import('@/views/diy/fullcalendar/fullcalendar.vue'),
    // 	hidden: true
    // },
    // {
    // 	path: '/401',
    // 	component: () => import('@/views/error-page/401'),
    // 	hidden: false
    // }
];

/**
 * asyncRoutes
 * the routes that need to be dynamically loaded based on user roles
 */
export const asyncRoutes = [
    // 插件管理已移除
    // {
    //     path: "/plugin-management",
    //     ...
    // },
    // 动态插件路由已移除
    // ...loadPluginRoutes(),
    // microiServiceFramework,
    {
        path: "/diy/diy-design/:Id",
        component: Layout,
        children: [
            {
                path: "/diy/diy-design/:Id",
                name: "diy_field",
                component: () => import("@/views/diy/diy-design-page.vue")
            }
        ]
    },
    {
        path: "/diy/form-page",
        component: Layout,
        children: [
            {
                path: "/diy/form-page",
                name: "diy_form_page",
                // component: DiyFormPage
                component: () => import("@/views/diy/diy-form-page.vue")
            }
        ]
    },
    {
        path: "/diy/form-page/:TableId",
        component: Layout,
        children: [
            {
                path: "/diy/form-page/:TableId",
                name: "diy_form_page_add",
                // component: DiyFormPage
                component: () => import("@/views/diy/diy-form-page.vue")
            }
        ]
    },
    {
        path: "/diy/form-page/:TableId/:TableRowId",
        component: Layout,
        children: [
            {
                path: "/diy/form-page/:TableId/:TableRowId",
                name: "diy_form_page_edit",
                // component: DiyFormPage
                component: () => import("@/views/diy/diy-form-page.vue")
            }
        ]
    },
    {
        path: "/wf/flow-design/:Id",
        component: Layout,
        children: [
            {
                path: "/wf/flow-design/:Id",
                name: "wf_design_id",
                // component: DiyFlowDesign
                component: () => import("@/views/diy/workflow/flow-design.vue")
            }
        ]
    },
    {
        path: "/mic/autopage",
        component: Layout,
        children: [
            {
                path: "/mic/autopage",
                name: "mic_autopage",
                // component: DiyFlowDesign
                component: () => import("@/views/page-engine/autopage.vue")
            }
        ]
    },
    {
        path: "/mic/autopage/:Id",
        component: Layout,
        children: [
            {
                path: "/mic/autopage/:Id",
                name: "mic_autopage",
                // component: DiyFlowDesign
                component: () => import("@/views/page-engine/autopage.vue")
            }
        ]
    },
    {
        path: "/mic/renderer",
        component: Layout,
        children: [
            {
                path: "/mic/renderer",
                name: "mic_renderer",
                // component: DiyFlowDesign
                component: () => import("@/views/page-engine/renderer.vue")
            }
        ]
    },
    {
        path: "/mic/renderer/:Id",
        component: Layout,
        children: [
            {
                path: "/mic/renderer/:Id",
                name: "mic_renderer",
                // component: DiyFlowDesign
                component: () => import("@/views/page-engine/renderer.vue")
            }
        ]
    },
    {
        path: "/online-office",
        component: Layout,
        children: [
            {
                path: "/online-office",
                name: "onlyoffice",
                component: () => import("@/views/diy/onlyoffice.vue"),
                meta: {
                    title: "查看文档",
                    icon: "el-icon-s-operation"
                }
            }
        ]
    },
    {
        path: "/file-manage",
        component: Layout,
        children: [
            {
                path: "/file-manage",
                name: "file-manage",
                component: () => import("@/views/file-manage/index.vue"),
                meta: {
                    title: "文件柜",
                    icon: "el-icon-s-operation"
                }
            }
        ]
    },

    /** when your routing map is too long, you can split it into small modules **/

    // 404 page must be placed at the end !!!
    // Vue Router 4: 使用 pathMatch 替代 *
    {
        path: "/:pathMatch(.*)*",
        component: Layout,
        children: [
            {
                path: "",
                name: "page_404",
                component: () => import("@/views/error-page/404.vue")
            }
        ]
    }
];

const router = createRouter({
    history: createWebHashHistory(),
    scrollBehavior: () => ({ top: 0 }),
    routes: constantRoutes
});

// 动态添加插件路由
function addPluginRoutes() {
    const pluginRoutes = loadPluginRoutes();
    console.log("插件路由已加载:", pluginRoutes.length, "个路由");
}

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
    // Vue Router 4: 移除所有动态添加的路由
    const routeNames = router.getRoutes().map((route) => route.name);
    routeNames.forEach((name) => {
        if (name) {
            router.removeRoute(name);
        }
    });
    // 重新添加基础路由
    constantRoutes.forEach((route) => {
        router.addRoute(route);
    });
    //清除asyncRoutes by itdos.com
    for (let index = 0; index < asyncRoutes.length; index++) {
        if (!DiyCommon.IsNull(asyncRoutes[index].Id)) {
            asyncRoutes.splice(index, 1);
            index--;
        }
    }
}

// 将asyncRoutes暴露到全局，供插件管理器使用
window.asyncRoutes = asyncRoutes;

// 路由守卫：检查插件是否启用
router.beforeEach((to, from, next) => {
    // 检查是否是插件路由
    if (to.meta && to.meta.plugin) {
        const pluginName = to.meta.plugin;
        if (!pluginConfigManager.isPluginEnabled(pluginName)) {
            // 插件未启用，重定向到404页面
            console.warn(`插件 ${pluginName} 未启用，访问被拒绝`);
            next({ name: "page_404" });
            return;
        }
    }
    next();
});

export default router;
