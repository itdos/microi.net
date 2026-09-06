// 目录按 API、租户与登录身份隔离；只缓存公开投影，不保存 Key、Endpoint 或生成请求。
const catalogs = new Map();
export async function loadMediaModels(diy, userId = '', force = false) {
    const key = `${diy.GetApiBase()}:${diy.GetOsClient()}:${userId}`;
    const cached = catalogs.get(key);
    if (!force && cached && Date.now() - cached.time < 15000) return cached.promise;
    const promise = (async () => {
        const token = diy.getToken();
        const response = await fetch(`${diy.GetApiBase()}/api/Ai/GetMediaModels`, {
            headers: { authorization: token ? `Bearer ${token}` : '', did: diy.GetDiyTokenHeaderDId?.() || 'MicroiMedia', OsClient: diy.GetOsClient() },
            signal: AbortSignal.timeout(12000)
        });
        diy.ApplyAuthorizationToken?.(response.headers.get('authorization'), token);
        let body;
        try { body = await response.json(); } catch { throw new Error(`媒体模型目录 HTTP ${response.status}，请更新平台 API`); }
        if (!response.ok || Number(body.Code) !== 1) throw new Error(body.Msg || '媒体模型目录读取失败');
        return Array.isArray(body.Data) ? body.Data : [];
    })();
    catalogs.set(key, { time: Date.now(), promise });
    try { return await promise; } catch (error) { catalogs.delete(key); throw error; }
}

export function requiresImageEditing(operation) {
    return ['sketch-to-image', 'upscale', 'erase', 'outpaint', 'remove-watermark', 'background-replace', 'colorize', 'restore', 'remove-background', 'product-scene', 'multi-composite', 'relight'].includes(operation);
}

export function mediaModelOptions(catalog, capability, operation = '') {
    return catalog.flatMap(engine => (engine.Models || [])
        .filter(model => model.Capability === capability && model.Supported !== false)
        .filter(model => capability !== 'image' || !requiresImageEditing(operation) || model.ReferenceMode === 'image-edit')
        .map(model => ({ ...model, AiModelId: engine.AiModelId, Model: model.Id,
            EngineName: engine.Name, IsGateway: engine.IsGateway === true,
            key: `${engine.AiModelId}:${model.Id}`, label: `${engine.Name} · ${model.Name || model.Id}` })));
}

export function selectMediaModel(options, previous, preferGateway = false) {
    if (previous?.key) return options.find(x => x.key === previous.key) || null;
    return options.find(x => x.IsGateway) || (preferGateway ? null : options[0]) || null;
}
