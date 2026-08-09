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
    listHistory(idOrName, pageIndex = 1, pageSize = 50) {
        return call("/api/V8Engine/ListBlueprintHistory", {
            BlueprintId: idOrName,
            PageIndex: pageIndex,
            PageSize: pageSize
        });
    },
    getHistory(idOrName, historyId) {
        return call("/api/V8Engine/GetBlueprintHistory", {
            BlueprintId: idOrName,
            HistoryId: historyId
        });
    },
    compare(idOrName, leftHistoryId, rightHistoryId) {
        return call("/api/V8Engine/CompareBlueprintVersions", {
            BlueprintId: idOrName,
            LeftHistoryId: leftHistoryId || undefined,
            RightHistoryId: rightHistoryId || undefined
        });
    },
    save(blueprint) {
        return call("/api/V8Engine/SaveBlueprint", blueprint);
    },
    delete(id) {
        return call("/api/V8Engine/DeleteBlueprint", { BlueprintId: id });
    },
    rollback(idOrName, historyId, expectedCurrentHash, options = {}) {
        return call("/api/V8Engine/RollbackBlueprint", {
            BlueprintId: idOrName,
            HistoryId: historyId,
            ExpectedCurrentHash: expectedCurrentHash,
            NewVersion: options.newVersion || undefined,
            ChangeSummary: options.changeSummary || undefined
        });
    },
    validate(id) {
        return call("/api/V8Engine/ValidateBlueprint", { BlueprintId: id });
    }
};

export default BlueprintApi;
