import { DiyCommon } from "@/utils/diy.common";

function call(url, params) {
    return new Promise((resolve, reject) => {
        try {
            DiyCommon.Post(url, params || {}, function (result) {
                resolve(result);
            });
        } catch (e) {
            reject(e);
        }
    });
}

export const AiWorkFlowApi = {
    overview(params) {
        return call("/api/AIWorkFlow/GetOverview", params || {});
    },
    nodeDetail(params) {
        return call("/api/AIWorkFlow/GetNodeDetail", params || {});
    },
    generateFromPrompt(params) {
        return call("/api/AIWorkFlow/GenerateFromPrompt", params || {});
    },
    list(keyword) {
        return call("/api/AIWorkFlow/ListAIWorkFlows", { Keyword: keyword || "" });
    },
    get(id) {
        return call("/api/AIWorkFlow/GetAIWorkFlow", { Id: id });
    },
    save(params) {
        return call("/api/AIWorkFlow/SaveAIWorkFlow", params || {});
    },
    delete(id) {
        return call("/api/AIWorkFlow/DeleteAIWorkFlow", { Id: id });
    }
};

export default AiWorkFlowApi;
