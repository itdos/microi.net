import { mapMcpCallTrace } from "./ai-mcp-agent-result.js";

/** 网络增量按顺序消费，UTF-8/CRLF/最后一个无空行事件均不会丢失。 */
export async function readAiEvents(response, receive) {
    if (!response.body) throw new Error("建模响应缺少实时事件流，请核对后端版本；不会重发写入。");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "", event = "", lines = [];
    const dispatch = async () => {
        if (lines.length) await receive(event || "message", lines.join("\n"));
        event = ""; lines = [];
    };
    const line = async value => {
        if (!value) await dispatch();
        else if (value.startsWith("event:")) event = value.slice(6).trim();
        else if (value.startsWith("data:")) lines.push(value.slice(5).replace(/^ /, ""));
    };
    try {
        while (true) {
            const { value, done } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            let index;
            while ((index = buffer.indexOf("\n")) >= 0) {
                await line(buffer.slice(0, index).replace(/\r$/, ""));
                buffer = buffer.slice(index + 1);
            }
            if (done) { if (buffer) await line(buffer.replace(/\r$/, "")); await dispatch(); break; }
        }
    } catch (error) {
        await reader.cancel().catch(() => {});
        throw error;
    } finally { reader.releaseLock(); }
}

export async function consumeBuilderStream(response, message, options = {}) {
    const paint = options.paint || (() => new Promise(resolve => setTimeout(resolve, 16)));
    const changed = options.changed || (() => {});
    const signal = options.signal;
    let sequence = 0, sawTerminal = false;
    message.thinking = "";
    message.actions = [];
    const type = async (key, value) => {
        const chars = Array.from(value || "");
        for (let start = 0; start < chars.length; start += 32) {
            signal?.throwIfAborted();
            message[key] = (message[key] || "") + chars.slice(start, start + 32).join("");
            changed();
            await paint();
        }
    };
    try {
        await readAiEvents(response, async (event, data) => {
            signal?.throwIfAborted();
            if (event === "agent") {
                const update = JSON.parse(data);
                if (!Number.isSafeInteger(update.Sequence) || update.Sequence <= sequence) throw new Error("AI 执行事件顺序异常，请核对已有回执。");
                sequence = update.Sequence;
                if (update.CallId) {
                    let action = message.actions.find(item => item.CallId === update.CallId);
                    if (!action) {
                        action = { Action: update.Action, Title: update.Action, CallId: update.CallId, Params: {} };
                        message.actions.push(action);
                    }
                    action.State = update.State;
                    action.__loading = ["started", "waiting", "progress"].includes(update.State);
                    action.__uncertain = update.State === "uncertain";
                    action.__error = ["failed", "uncertain", "notExecuted"].includes(update.State) ? update.Message : "";
                    action.__result = update.State === "returned" ? { Code: 1 } : null;
                }
                // 心跳更新状态而不无限扩充历史；真实阶段和 DDL 摘要才进入可持久化过程。
                message.executionStatus = update.Message;
                if (update.State !== "waiting") await type("thinking", `${message.thinking ? "\n" : ""}${update.Message}`);
                changed();
            } else if (event === "message") {
                message.rawContent = (message.rawContent || "") + data;
                await type("content", data);
            } else if (event === "receipt") {
                const receipt = JSON.parse(data);
                for (const item of mapMcpCallTrace(receipt)) {
                    const old = message.actions.find(action => action.CallId && action.CallId === item.CallId);
                    if (old) Object.assign(old, item); else message.actions.push(item);
                }
                message.executionReceipt = { ErrorCode: receipt.ErrorCode || "", Readback: receipt.Readback || "" };
            } else if (event === "error") {
                message.error = data || "建模执行失败";
                throw new Error(message.error);
            } else if (event === "done") sawTerminal = true;
        });
        if (!sawTerminal) throw new Error("AI 事件流提前结束，执行结果待核对；不会自动重试写入。");
    } finally {
        for (const action of message.actions) if (action.__loading) {
            action.__loading = false;
            action.__uncertain = true;
            action.State = "uncertain";
        }
        changed();
    }
}
