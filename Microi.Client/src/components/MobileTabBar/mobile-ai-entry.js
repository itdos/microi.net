export const MOBILE_AI_ASSISTANT_ROUTE = Object.freeze({
    path: "/mobile/ai-assistant"
});

export function isMobileAiAssistantEnabled(sysConfig) {
    const hasNewSetting = sysConfig
        && Object.prototype.hasOwnProperty.call(sysConfig, "DisableAiAssistant")
        && sysConfig.DisableAiAssistant !== null
        && sysConfig.DisableAiAssistant !== undefined
        && sysConfig.DisableAiAssistant !== "";
    if (!hasNewSetting && sysConfig && Object.prototype.hasOwnProperty.call(sysConfig, "IsShowAiAssistant")) {
        const legacyValue = sysConfig.IsShowAiAssistant;
        return legacyValue === 1 || legacyValue === "1" || legacyValue === true || String(legacyValue || "").trim().toLowerCase() === "true";
    }
    const value = hasNewSetting ? sysConfig.DisableAiAssistant : undefined;
    const disabled = value === 1 || value === "1" || value === true || String(value || "").trim().toLowerCase() === "true";
    return !disabled;
}

export function createMobileAiAssistantRoute() {
    return {
        path: MOBILE_AI_ASSISTANT_ROUTE.path
    };
}
