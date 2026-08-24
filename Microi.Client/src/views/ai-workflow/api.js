import { DiyCommon } from "@/utils/diy.common";

const API_URL = "/apiengine/platform-ai-workflow";

function call(action, params) {
    return new Promise((resolve, reject) => {
        try {
            DiyCommon.Post(API_URL, { ...(params || {}), Action: action }, function (result) {
                resolve(result);
            });
        } catch (e) {
            reject(e);
        }
    });
}

export const AiWorkFlowApi = {
    overview(params) {
        return call("Overview", params || {});
    },
    nodeDetail(params) {
        return call("NodeDetail", params || {});
    },
    generateFromPrompt(params) {
        return call("GenerateFromPrompt", params || {});
    },
    list(keyword) {
        return call("List", { Keyword: keyword || "" });
    },
    get(id) {
        return call("Get", { Id: id });
    },
    save(params) {
        return call("Save", params || {});
    },
    delete(id) {
        return call("Delete", { Id: id });
    }
};

export default AiWorkFlowApi;
