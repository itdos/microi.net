import { DiyCommon } from "@/utils/diy.common";

function normalizeToken(value) {
    return String(value || "").replace(/^Bearer\s+/i, "").trim();
}

export function applyMicroAppToken(payload) {
    const type = String(payload?.type || payload?.Type || "").toLowerCase();
    if (type !== "micro-app:token") return false;

    const data = payload?.data ?? payload?.Data ?? payload ?? {};
    const token = normalizeToken(data?.token || data?.Token);
    const requestToken = normalizeToken(data?.requestToken || data?.RequestToken);
    if (!token || token.length > 16384 || /\s/.test(token)) return true;

    DiyCommon.ApplyAuthorizationToken(token, requestToken);
    return true;
}
