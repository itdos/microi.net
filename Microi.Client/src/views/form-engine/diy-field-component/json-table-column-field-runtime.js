export function createStableJsonTableColumnFieldResolver(makeReactive = (value) => value) {
    if (typeof makeReactive !== "function") {
        throw new TypeError("makeReactive must be a function");
    }

    const cache = new Map();
    return function resolveColumnField(cacheKey, fieldModel, configSignature) {
        const normalizedKey = String(cacheKey || fieldModel?.Name || "column");
        var cachedField = cache.get(normalizedKey);
        if (!cachedField) {
            cachedField = makeReactive({
                ...fieldModel,
                _JsonTableColumnConfigSignature: configSignature
            });
            cache.set(normalizedKey, cachedField);
            return cachedField;
        }

        // 配置未变时保留 Data、_DataLoading 等异步数据源运行态。
        if (cachedField._JsonTableColumnConfigSignature === configSignature) {
            return cachedField;
        }

        Object.assign(cachedField, fieldModel, {
            _DataLoading: false,
            _DataLoadingStartedAt: 0,
            _JsonTableColumnConfigSignature: configSignature
        });
        return cachedField;
    };
}
