// 状态机（State Machine）API 封装
import { DiyCommon } from "@/utils/diy.common";

function call(url, params) {
    return new Promise((resolve, reject) => {
        try {
            DiyCommon.Post(url, params || {}, function (result) { resolve(result); });
        } catch (e) { reject(e); }
    });
}

export const StateMachineApi = {
    list(keyword) { return call("/api/V8Engine/ListStateMachines", { Keyword: keyword || "" }); },
    get(id) { return call("/api/V8Engine/GetStateMachine", { Id: id }); },
    save(sm) { return call("/api/V8Engine/SaveStateMachine", sm); },
    delete(id) { return call("/api/V8Engine/DeleteStateMachine", { Id: id }); },
    transition(p) { return call("/api/V8Engine/TransitionState", p); },
    history(p) { return call("/api/V8Engine/GetStateHistory", p); }
};

export default StateMachineApi;
