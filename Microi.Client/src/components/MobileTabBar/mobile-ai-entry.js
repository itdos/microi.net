export const MOBILE_AI_ASSISTANT_ROUTE = Object.freeze({
    path: "/mobile/ai-assistant"
});

export function isMobileAiAssistantEnabled(sysConfig) {
    const value = sysConfig && sysConfig.IsShowAiAssistant;
    return value === 1 || value === "1" || value === true || value === "true";
}

export function createMobileAiAssistantRoute() {
    return {
        path: MOBILE_AI_ASSISTANT_ROUTE.path
    };
}
