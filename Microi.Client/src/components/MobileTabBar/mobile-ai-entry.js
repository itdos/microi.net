export const MOBILE_AI_ASSISTANT_ROUTE = Object.freeze({
    path: "/mobile/ai-assistant"
});

export function isMobileAiAssistantEnabled(sysConfig) {
    const value = sysConfig && sysConfig.DisableAiAssistant;
    const disabled = value === 1 || value === "1" || value === true || String(value || "").trim().toLowerCase() === "true";
    return !disabled;
}

export function createMobileAiAssistantRoute() {
    return {
        path: MOBILE_AI_ASSISTANT_ROUTE.path
    };
}
