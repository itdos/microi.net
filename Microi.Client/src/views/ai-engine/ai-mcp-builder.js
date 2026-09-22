export function canUseBuilderMcp(user) {
    return Number(user?.Level || 0) >= 9999;
}

export function chooseConversationalModel(models) {
    const items = Array.isArray(models) ? models : [];
    const conversations = items.filter(item => !/(image|music|video|speech|图像|音乐|视频|语音)/i.test(
        `${item?.ModelType || ""} ${item?.AiModel || ""} ${item?.Name || ""}`
    ));
    return conversations.find(item => !/中转站/i.test(`${item?.Name || ""} ${item?.AiModel || ""}`))
        || conversations[0] || items[0] || null;
}
