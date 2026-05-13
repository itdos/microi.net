// 业务架构蓝图（Blueprint）API 封装
// 说明：所有接口直接走 DiyCommon.Post，统一鉴权
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

export const BlueprintApi = {
    list(keyword) {
        return call("/api/V8Engine/ListBlueprints", { Keyword: keyword || "" });
    },
    get(idOrName) {
        return call("/api/V8Engine/GetBlueprint", { BlueprintId: idOrName });
    },
    save(blueprint) {
        return call("/api/V8Engine/SaveBlueprint", blueprint);
    },
    delete(id) {
        return call("/api/V8Engine/DeleteBlueprint", { BlueprintId: id });
    },
    validate(id) {
        return call("/api/V8Engine/ValidateBlueprint", { BlueprintId: id });
    }
};

export default BlueprintApi;
