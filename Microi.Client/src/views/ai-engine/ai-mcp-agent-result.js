export function mapMcpCallTrace(dataAppend) {
    const calls = dataAppend?.McpCalls || dataAppend?.mcpCalls;
    if (!Array.isArray(calls)) return [];
    return calls.map(item => {
        const action = String(item?.Action || item?.action || "microi_codex");
        const failed = item?.IsError === true || item?.isError === true;
        return {
            Action: action,
            Title: action,
            Params: {},
            __result: failed ? null : { Code: 1 },
            __error: failed ? "工具返回错误，详情见 AI 回复" : ""
        };
    });
}
