// 匿名入口只来自框架固定路由标记；查询参数不参与选择应用、版本、源码 URL 或接口。
export function resolveSaasPublicTrialHostConfig(meta = {}) {
    if (meta.saasPublicTrial !== true) return null;
    return {
        appKey: "microi-platform-service", version: "", microRoutePath: "/saas-trial",
        microAppUrl: "", urlApiEngineId: ""
    };
}
