const SERVER_DATA_SOURCES = new Set(["Sql", "Api", "DataSource", "ApiEngine"]);

export function hasServerBackedFieldData(field) {
    const config = field && field.Config;
    if (!config || !SERVER_DATA_SOURCES.has(config.DataSource)) return false;
    if (config.DataSource === "Sql") return !!config.Sql;
    if (config.DataSource === "Api") return !!config.Api;
    if (config.DataSource === "DataSource") return !!config.DataSourceId;
    return !!config.DataSourceApiEngineKey;
}

export function ensureFieldDataLoaded({ field, formData, tableChildAuth, diyCommon, now = Date.now() }) {
    if (!field || !diyCommon || typeof diyCommon.SetFieldsData !== "function") return false;
    if (!hasServerBackedFieldData(field)) return false;
    if (Array.isArray(field.Data) && field.Data.length > 0) return false;

    // A recent bulk request still owns this field. Older flags (or flags without
    // a timestamp from legacy code) are stale after a reused form is reopened.
    const startedAt = Number(field._DataLoadingStartedAt || 0);
    if (field._DataLoading === true && startedAt > 0 && now - startedAt < 2000) return false;

    field._DataLoading = false;
    field._DataLoadingStartedAt = 0;
    diyCommon.SetFieldsData([field], formData || {}, tableChildAuth || field._TableChildAuth || null);
    return true;
}
