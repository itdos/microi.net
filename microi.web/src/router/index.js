import Vue from "vue";
import Router from "vue-router";
import { DosCommon, DiyCommon, DiyFlowDesign, DiyFormPage } from "@/utils/microi.net.import";
Vue.use(Router);

/* Layout */
import Layout from "@/layout";

/* Router Modules */
import microiServiceFramework from "./modules/microi.service.framework.js";

/* Plugin Routes Loader */
import { loadPluginRoutes } from "./plugin-routes-loader.js";
import { pluginConfigManager } from "@/views/plugins/index.js";

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
        path: "/redirect",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "/redirect/:path(.*)",
                component: () => import("@/views/redirect/index")
            }
        ]
    },
    {
        path: "/login",
        component: () => import("@/views/login/index"),
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
    // 插件管理页面
    {
        path: "/plugin-management",
        component: Layout,
        children: [
            {
                path: "/plugin-management",
                name: "plugin-management",
                component: () => import("@/views/plugin-management/index"),
                meta: {
                    title: "插件管理",
                    icon: "el-icon-s-operation",
                    roles: ["admin"] // 只有管理员可以访问
                }
            }
        ]
    },
    // 动态加载的插件路由
    ...loadPluginRoutes(),
    // microiServiceFramework,
    {
        path: "/diy/diy-design/:Id",
        component: Layout,
        children: [
            {
                path: "/diy/diy-design/:Id",
                name: "diy_field",
                component: () => import("@/views/diy/diy-design-page")
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
                component: () => import("@/views/diy/diy-form-page")
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
                component: () => import("@/views/diy/diy-form-page")
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
                component: () => import("@/views/diy/diy-form-page")
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
                component: () => import("@/views/diy/workflow/flow-design")
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
                component: () => import("@/views/page-engine/autopage")
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
                component: () => import("@/views/page-engine/autopage")
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
                component: () => import("@/views/page-engine/renderer")
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
                component: () => import("@/views/page-engine/renderer")
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
                component: () => import("@/views/diy/onlyoffice"),
                meta: {
                    title: "查看文档",
                    icon: "el-icon-s-operation"
                }
            }
        ]
    },

    /** when your routing map is too long, you can split it into small modules **/

    // 404 page must be placed at the end !!!
    {
        path: "*",
        component: Layout,
        children: [
            {
                path: "*",
                name: "page_404",
                component: () => import("@/views/error-page/404")
            }
        ]
    }
];

const createRouter = () =>
    new Router({
        // mode: 'history', // require service support
        scrollBehavior: () => ({ y: 0 }),
        routes: constantRoutes
    });

const router = createRouter();

// 动态添加插件路由（Vue Router 3.0.2 兼容方式）
function addPluginRoutes() {
    const pluginRoutes = loadPluginRoutes();
    // 在 Vue Router 3.0.2 中，路由需要在创建时定义
    // 这里只是记录日志，实际路由已经在 asyncRoutes 中通过 loadPluginRoutes() 加载
    console.log("插件路由已加载:", pluginRoutes.length, "个路由");
}

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
    const newRouter = createRouter();
    router.matcher = newRouter.matcher; // reset router
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
