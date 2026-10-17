export function mapMcpCallTrace(dataAppend) {
    const calls = dataAppend?.McpCalls || dataAppend?.mcpCalls;
    if (!Array.isArray(calls)) return [];
    return calls.map(item => {
        const action = String(item?.Action || item?.action || "microi_codex");
        const failed = item?.IsError === true || item?.isError === true;
        const state = String(item?.State || item?.state || (failed ? "uncertain" : "returned"));
        return {
            Action: action,
            Title: action,
            Params: {},
            CallId: String(item?.CallId || item?.callId || ""),
            State: state,
            __loading: false,
            __uncertain: state === "uncertain",
            __result: failed || state !== "returned" ? null : { Code: 1 },
            __error: failed ? String(item?.Message || item?.message || "工具返回错误，请核对执行回执") : ""
        };
    });
}
