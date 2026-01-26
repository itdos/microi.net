// Vue Router 4 for Vue 3
import { createRouter, createWebHashHistory } from "vue-router";
import { DosCommon, DiyCommon, DiyFlowDesign, DiyFormPage } from "@/utils/microi.net.import";
/* Layout */
import Layout from "@/layout";
export const constantRoutes = [
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
];
export const asyncRoutes = [
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
                component: () => import("@/views/workflow/flow-design.vue")
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
                component: () => import("@/views/page-engine/renderer.vue")
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
    // Vue Router 4: 使用 pathMatch 替代 * ，此路由放到最后
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
    next();
});
export default router;