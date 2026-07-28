const ACTIVE_STATUSES = new Set(["Pending", "Running", "Retrying"]);
const TERMINAL_STATUSES = new Set(["Succeeded", "Failed", "Canceled"]);

export function isActiveBackgroundTask(task) {
    return !!task && ACTIVE_STATUSES.has(task.Status);
}

export function isTerminalBackgroundTask(task) {
    return !!task && TERMINAL_STATUSES.has(task.Status);
}

export function shouldPollBackgroundTasks(tasks) {
    return Array.isArray(tasks) && tasks.some(isActiveBackgroundTask);
}

export function getBackgroundTaskProgress(task, labels = {}) {
    const calculating = labels.calculating || "估算中";
    const waiting = labels.waiting || "排队中";
    const current = Math.max(0, Number(task?.Current || 0));
    const total = Math.max(0, Number(task?.Total || 0));
    const percentage = Math.max(0, Math.min(100, Number(task?.Progress || 0)));
    const mode = task?.ProgressMode || (total > 0 ? "Units" : "Indeterminate");
    const active = isActiveBackgroundTask(task);
    const indeterminate = active && mode === "Indeterminate";

    if (indeterminate) {
        return {
            percentage: 0,
            indeterminate: true,
            text: task?.Status === "Pending" ? waiting : calculating
        };
    }
    if (mode === "Units" && total > 0) {
        return {
            percentage,
            indeterminate: false,
            text: `${current}/${total} (${percentage}%)`
        };
    }
    return { percentage, indeterminate: false, text: `${percentage}%` };
}

export function getBackgroundTaskEta(task, labels = {}) {
    if (!isActiveBackgroundTask(task)) return "-";
    if (!task?.EstimatedEndTime || !Number(task?.RemainingSeconds || 0)) {
        return labels.calculating || "估算中";
    }
    const remaining = task.RemainingText || formatDuration(Number(task.RemainingSeconds));
    const time = formatClock(task.EstimatedEndTime);
    const confidence = labels[`confidence${task.EstimateConfidence || "None"}`] || "";
    return `${time}（${remaining}${confidence ? `，${confidence}` : ""}）`;
}

export function formatDuration(seconds) {
    seconds = Math.max(0, Math.round(Number(seconds || 0)));
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function formatClock(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    const pad = (number) => String(number).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
