// Vue Router 4 for Vue 3
import { createRouter, createWebHashHistory } from "vue-router";
// 只导入轻量级的工具函数，不导入组件
import { DiyCommon } from "@/utils/diy.common";
import { hasWebOS, loadDesktop } from "@/utils/webos-detect.js";
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
    },
    // WebOS 桌面路由（全屏，无经典传统 Layout 包裹，仅在 webos 模块存在时注册）
    ...(hasWebOS ? [{
        path: "/os",
        name: "webos_desktop",
        component: loadDesktop,
        hidden: true
    }] : []),
    // 移动端路由
    {
        path: "/mobile/home",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "",
                name: "mobile_home",
                component: () => import("@/views/mobile/home.vue"),
                meta: { title: "首页", keepAlive: true }
            }
        ]
    },
    {
        path: "/mobile/workspace",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "",
                name: "mobile_workspace",
                component: () => import("@/views/mobile/workspace.vue"),
                meta: { title: "工作台", keepAlive: true }
            }
        ]
    },
    {
        path: "/mobile/message",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "",
                name: "mobile_message",
                component: () => import("@/views/mobile/message.vue"),
                meta: { title: "消息", keepAlive: true }
            }
        ]
    },
    {
        path: "/mobile/chat",
        component: () => import("@/views/mobile/chat.vue"),
        hidden: true,
        meta: { title: "聊天" }
    },
    {
        path: "/mobile/profile",
        component: Layout,
        hidden: true,
        children: [
            {
                path: "",
                name: "mobile_profile",
                component: () => import("@/views/mobile/profile.vue"),
                meta: { title: "我的", keepAlive: true }
            }
        ]
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
                component: () => import("@/views/form-engine/diy-design-page.vue")
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
                component: () => import("@/views/form-engine/diy-form-full.vue"),
                // meta: { keepAlive: false }
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
                component: () => import("@/views/form-engine/diy-form-full.vue"),
                // meta: { keepAlive: false }
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
                component: () => import("@/views/form-engine/diy-form-full.vue"),
                // meta: { keepAlive: false }
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
                name: "mic_autopage_id",
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
                name: "mic_renderer_id",
                component: () => import("@/views/page-engine/renderer.vue")
            }
        ]
    },
    {
        path: "/mic/autoprint",
        component: Layout,
        children: [
            {
                path: "/mic/autoprint",
                name: "mic_autoprint",
                component: () => import("@/views/print-engine/autoprint.vue")
            }
        ]
    },
    // GoView 大屏设计器
    {
        path: "/mic/data-dashboard/design/:Id",
        component: Layout,
        children: [
            {
                path: "/mic/data-dashboard/design/:Id",
                name: "mic_data_dashboard_design",
                component: () => import("@/views/go-view/editor.vue")
            }
        ]
    },
    // GoView 大屏预览
    {
        path: "/mic/data-dashboard/preview/:Id",
        component: Layout,
        children: [
            {
                path: "/mic/data-dashboard/preview/:Id",
                name: "mic_data_dashboard_preview",
                component: () => import("@/views/go-view/preview.vue")
            }
        ]
    },
    // {
    //     path: "/file-manage",
    //     component: Layout,
    //     children: [
    //         {
    //             path: "/file-manage",
    //             name: "file-manage",
    //             component: () => import("@/views/file-manage/index.vue"),
    //             meta: {
    //                 title: "文件柜",
    //                 icon: "el-icon-s-operation"
    //             }
    //         }
    //     ]
    // },
    {
        path: "/mic/cad-preview",
        name: "mic_cad_preview",
        component: () => import("@/views/cad-preview/index.vue")
    },
    // OpenClaw 管理系统（使用主框架 Layout，菜单由后端或侧边栏统一管理）
    {
        path: "/openclaw",
        component: Layout,
        hidden: true,
        redirect: "/openclaw/dashboard",
        meta: { title: "OpenClaw", icon: "Monitor" },
        children: [
            { path: "dashboard", name: "openclaw_dashboard", component: () => import("@/views/openclaw/dashboard/index.vue"), meta: { title: "OpenClaw 仪表盘" } },
            { path: "tasks", name: "openclaw_tasks", component: () => import("@/views/openclaw/tasks/index.vue"), meta: { title: "任务中心" } },
            { path: "articles", name: "openclaw_articles", component: () => import("@/views/openclaw/articles/index.vue"), meta: { title: "文章管理" } },
            { path: "accounts", name: "openclaw_accounts", component: () => import("@/views/openclaw/accounts/index.vue"), meta: { title: "平台账号" } },
            { path: "interact", name: "openclaw_interact", component: () => import("@/views/openclaw/interact/index.vue"), meta: { title: "互评记录" } },
            { path: "nodes", name: "openclaw_nodes", component: () => import("@/views/openclaw/nodes/index.vue"), meta: { title: "节点管理" } },
            { path: "llm", name: "openclaw_llm", component: () => import("@/views/openclaw/llm/index.vue"), meta: { title: "AI模型配置" } },
            { path: "settings", name: "openclaw_settings", component: () => import("@/views/openclaw/settings/index.vue"), meta: { title: "系统设置" } }
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
    scrollBehavior(to, from, savedPosition) {
        // 🔥 如果有保存的位置（浏览器前进/后退），使用保存的位置
        // 这对 keep-alive 缓存的页面特别重要
        if (savedPosition) {
            return savedPosition;
        }
        // 🔥 如果是相同的路由（只是参数变化），保持当前滚动位置
        // 这对于移动端无限滚动加载更多数据的场景很重要
        if (to.path === from.path) {
            return false; // 返回 false 表示不改变滚动位置
        }
        // 🔥 其他情况（新页面）滚动到顶部
        return { top: 0 };
    },
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