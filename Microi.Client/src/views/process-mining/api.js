// 过程挖掘（Process Mining）API
import { DiyCommon } from "@/utils/diy.common";

function call(url, params) {
    return new Promise((resolve, reject) => {
        try { DiyCommon.Post(url, params || {}, function (r) { resolve(r); }); } catch (e) { reject(e); }
    });
}

export const PmApi = {
    overview(p) { return call("/api/V8Engine/GetWorkflowOverview", p); },
    analyze(p) { return call("/api/V8Engine/AnalyzeWorkflow", p); },
    hotPaths(p) { return call("/api/V8Engine/GetHotPaths", p); },
    slaViolations(p) { return call("/api/V8Engine/GetSlaViolations", p); },
    bottlenecks(p) { return call("/api/V8Engine/GetBottlenecks", p); }
};

export default PmApi;
