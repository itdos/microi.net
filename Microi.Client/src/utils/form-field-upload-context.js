function firstNonEmpty(...values) {
    for (const value of values) {
        const text = value === undefined || value === null ? '' : String(value).trim();
        if (text) return text;
    }
    return '';
}

/**
 * 构造表单字段上传的授权线索。Limit/Path 仍会随组件请求发送，但后端只以
 * 当前租户 diy_field.Config 和 FormEngine 权限回查结果决定实际公私桶与目录。
 */
export function buildFormFieldUploadContext({
    field,
    diyTableModel,
    formData,
    tableName,
    tableRowId,
    sysMenuId,
    tableChildAuth
} = {}) {
    const context = {
        FormEngineKey: firstNonEmpty(
            diyTableModel?.Name,
            tableName,
            diyTableModel?.Id,
            field?.TableId
        ),
        FieldId: firstNonEmpty(field?.Id, field?.Name),
        FormDataId: firstNonEmpty(tableRowId, formData?.Id),
        SysMenuId: firstNonEmpty(sysMenuId)
    };

    if (tableChildAuth && typeof tableChildAuth === 'object') {
        context._TableChildAuth = JSON.stringify(tableChildAuth);
    }
    return context;
}

export function appendFormFieldUploadContext(formData, options) {
    if (!formData || typeof formData.append !== 'function') {
        throw new TypeError('formData.append is required');
    }
    const context = buildFormFieldUploadContext(options);
    Object.entries(context).forEach(([name, value]) => {
        if (value !== '') formData.append(name, value);
    });
    return context;
}
