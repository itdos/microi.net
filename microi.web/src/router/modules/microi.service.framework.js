// 子应用到菜单
import Layout from "@/layout";
const appRouter = {
    path: "/servicename",
    component: Layout,
    redirect: "doc1",
    name: "servicename",
    meta: {
        title: "Microi微服务",
        icon: "Setting"
    },
    children: [
        {
            path: "dashboard",
            name: "dashboard",
            meta: { title: "Microi微服务", icon: "Setting" }
        }
    ]
};
export default appRouter;
