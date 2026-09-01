const asTrimmedString = value => String(value ?? "").trim();

/**
 * 流程设计入口只信任当前 sys_menu 的正式绑定，避免仅凭路由参数或残留流程 Id 暴露错误入口。
 */
export function getBoundWorkflowDesignId(menuModel = {}) {
    if (asTrimmedString(menuModel.OpenType) !== "WorkFlow") return "";
    return asTrimmedString(menuModel.FlowDesignId);
}

export function isWorkflowMenuBinding(menuModel = {}) {
    return !!getBoundWorkflowDesignId(menuModel);
}

export function getWorkflowDesignPath(menuModel = {}) {
    const flowDesignId = getBoundWorkflowDesignId(menuModel);
    return flowDesignId ? `/wf/flow-design/${encodeURIComponent(flowDesignId)}` : "";
}
