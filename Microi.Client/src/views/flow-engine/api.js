// 流程引擎（Flow Engine / Automation）API 封装
import { DiyCommon } from "@/utils/diy.common";

function call(url, params) {
    return new Promise((resolve, reject) => {
        try {
            DiyCommon.Post(url, params || {}, function (result) { resolve(result); });
        } catch (e) { reject(e); }
    });
}

export const FlowApi = {
    list(keyword) { return call("/api/V8Engine/ListFlows", { Keyword: keyword || "" }); },
    get(id) { return call("/api/V8Engine/GetFlow", { Id: id }); },
    save(flow) { return call("/api/V8Engine/SaveFlow", flow); },
    delete(id) { return call("/api/V8Engine/DeleteFlow", { Id: id }); },
    run(id, input) { return call("/api/V8Engine/RunFlow", { Id: id, Input: input || {} }); },
    runs(p) { return call("/api/V8Engine/GetFlowRuns", p); },
    runDetail(id) { return call("/api/V8Engine/GetFlowRunDetail", { Id: id }); }
};

export default FlowApi;
