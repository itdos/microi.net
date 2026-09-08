// 生成只提交稳定的 RequestId；后续全部是只读状态查询。网络重试复用原始字节，
// 取消等待和页面离开不会取消服务器持久任务，也不能换 Id 再生成。
export async function generateMiniMaxMusic(options) {
    const { diy, signal, onProgress, fetchImpl = fetch, taskId: resumedTaskId } = options;
    const apiBase = String(diy.GetApiBase()).replace(/\/$/, "");
    const body = options.request ? JSON.stringify(options.request) : null;
    if (!body && !resumedTaskId) throw new Error("缺少音乐请求或已有任务号。");
    const deadline = Date.now() + (options.maxWaitMs ?? 10 * 60_000);
    let taskId = resumedTaskId || "";
    let failures = 0;
    let recover = options.recoverResult === true;

    const pause = async () => {
        if (signal?.aborted) throw new DOMException("已停止等待，后台任务继续执行。", "AbortError");
        await new Promise((resolve, reject) => {
            const timer = setTimeout(finish, options.pollIntervalMs ?? 1500);
            function finish() { signal?.removeEventListener("abort", abort); resolve(); }
            function abort() { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(new DOMException("已停止等待，后台任务继续执行。", "AbortError")); }
            signal?.addEventListener("abort", abort, { once: true });
        });
    };

    async function call(path, method, payload) {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) controller.abort();
        const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 15_000);
        const token = diy.getToken() || "";
        try {
            const response = await fetchImpl(`${apiBase}${path}`, {
                method, signal: controller.signal,
                headers: { "Content-Type": "application/json", authorization: token ? `Bearer ${token}` : "",
                    did: diy.GetDid?.() || "", osclient: diy.GetOsClient?.() || "" },
                ...(payload === null ? {} : { body: payload })
            });
            diy.ApplyAuthorizationToken?.(response.headers.get("authorization"), token);
            if (response.status >= 500) throw new Error(`音乐状态服务暂不可用（HTTP ${response.status}）`);
            let current;
            try { current = await response.json(); }
            catch { throw new Error(`音乐状态服务响应无法解析（HTTP ${response.status}）`); }
            for (let i = 0; i < 3; i += 1) {
                const nested = current?.Data ?? current?.data;
                if (nested?.Code === undefined && nested?.code === undefined) break;
                current = nested;
            }
            return current;
        } finally {
            clearTimeout(timeout);
            signal?.removeEventListener("abort", abort);
        }
    }

    while (Date.now() < deadline) {
        if (signal?.aborted) throw new DOMException("已停止等待，后台任务继续执行。", "AbortError");
        let current;
        try {
            current = recover && taskId
                ? await call(`/api/Ai/RecoverMiniMaxMusicTask?taskId=${encodeURIComponent(taskId)}`, "POST", null)
                : taskId
                ? await call(`/api/Ai/GetMiniMaxMusicTask?taskId=${encodeURIComponent(taskId)}`, "GET", null)
                : await call("/api/Ai/GenerateMiniMaxMusic", "POST", body);
            recover = false;
        } catch (error) {
            if (signal?.aborted) throw new DOMException("已停止等待，后台任务继续执行。", "AbortError");
            if (++failures >= 3) {
                error.taskId = taskId;
                throw error;
            }
            await pause();
            continue;
        }
        const code = Number(current?.Code ?? current?.code);
        const data = current?.Data ?? current?.data ?? {};
        taskId = data.TaskId || taskId;
        if (taskId) onProgress?.({ ...data, TaskId: taskId });
        if (code === 1 && data.Permanent === true && data.FileUrl) return data;
        if (data.Status === "Unavailable" && ++failures < 3) {
            await pause();
            continue;
        }
        if (code !== 2 || !taskId) {
            const error = new Error(current?.Msg || current?.msg || "音乐任务没有返回可确认的结果。");
            error.taskId = taskId;
            error.musicStatus = data.Status || "";
            error.canRecoverResult = data.CanRecoverResult === true;
            throw error;
        }
        failures = 0;
        await pause();
    }
    const error = new Error("已停止等待音乐结果，后台任务状态已保留；可回到本页继续查询。");
    error.taskId = taskId;
    throw error;
}
