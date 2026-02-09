// 子应用到菜单
import Layout from "@/layout";
const appRouter = {
    path: "/servicename",
    component: Layout,
    redirect: "doc1",
    name: "servicename",
    meta: {
        title: "Microi微服务",
        icon: "fas fa-cog"
    },
    children: [
        {
            path: "dashboard",
            name: "dashboard",
            meta: { title: "Microi微服务", icon: "fas fa-cog" }
        }
    ]
};
export default appRouter;
