export function platformEditionLabel(value) {
    if (value === undefined || value === null) return '';
    return ({ enterprise: '企业版', personal: '个人版', opensource: '开源版', '': '开源版', '企业版': '企业版', '个人版': '个人版', '开源版': '开源版' })[String(value).trim().toLowerCase()] || '';
}
export function hideSystemLicenseVersion(config = {}) {
    return [true, 1, '1', 'true'].includes(config.HideSystemLicenseVersion);
}

export function mergeLoginSysConfig(bootstrapConfig = {}, loginConfig = {}) {
    const config = { ...loginConfig };
    // 当前连接的匿名启动投影已由后端授权内核给出版本；旧登录响应缺少此运行态字段。
    // 仅保留已识别的版本，避免登录跳转后的配置覆盖让标签丢失；其它设置仍以登录响应为准。
    if (config.PlatformEdition == null && platformEditionLabel(bootstrapConfig?.PlatformEdition)) {
        config.PlatformEdition = bootstrapConfig.PlatformEdition;
    }
    return config;
}
