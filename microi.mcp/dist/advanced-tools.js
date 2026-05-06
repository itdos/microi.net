import { z } from 'zod';
const jsonRecordSchema = z.record(z.unknown());
function textResult(text, isError = false) {
    return { content: [{ type: 'text', text }], isError };
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function asArray(value) {
    return Array.isArray(value) ? value.map(asRecord).filter((item) => Object.keys(item).length > 0) : [];
}
function getArray(record, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (Array.isArray(value))
            return asArray(value);
    }
    return [];
}
function getString(record, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'string' && value.trim())
            return value.trim();
        if (typeof value === 'number' || typeof value === 'boolean')
            return String(value);
    }
    return '';
}
function getNumber(record, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (typeof value === 'number')
            return value;
        if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value)))
            return Number(value);
    }
    return undefined;
}
function getStringArray(record, ...keys) {
    for (const key of keys) {
        const value = record[key];
        if (Array.isArray(value)) {
            return value.map((item) => typeof item === 'string' ? item : getString(asRecord(item), 'name', 'Name', 'id', 'Id')).filter(Boolean);
        }
        if (typeof value === 'string' && value.trim())
            return value.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}
function getValue(record, ...keys) {
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(record, key))
            return record[key];
    }
    return undefined;
}
function normalizeKey(value) {
    return value.trim().toLowerCase();
}
function fieldLookupKey(tableRef, fieldRef) {
    return `${normalizeKey(tableRef)}::${normalizeKey(fieldRef)}`;
}
function isSystemFieldName(value) {
    return ['Id', 'CreateTime', 'UpdateTime', 'CreateUserId', 'CreateUserName', 'UpdateUserId', 'UpdateUserName', 'OsClient', 'IsDeleted']
        .some((name) => name.toLowerCase() === value.toLowerCase());
}
function jsonArrayOrSplit(value) {
    const trimmed = value.trim();
    if (!trimmed)
        return [];
    if (trimmed.startsWith('[')) {
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed))
                return parsed;
        }
        catch {
            // Fall through to loose splitting.
        }
    }
    return trimmed.split(/[,;\n\uFF0C\uFF1B\u3001]+/).map((item) => item.trim()).filter(Boolean);
}
function getFieldRefs(record, ...keys) {
    for (const key of keys) {
        const value = getValue(record, key);
        if (value === undefined || value === null || value === '')
            continue;
        const values = Array.isArray(value) ? value : (typeof value === 'string' ? jsonArrayOrSplit(value) : [value]);
        return values.map((item) => {
            if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') {
                return { ref: String(item).trim() };
            }
            const source = asRecord(item);
            return {
                ref: getString(source, 'field', 'Field', 'fieldName', 'FieldName', 'name', 'Name', 'id', 'Id', 'fieldId', 'FieldId'),
                asName: getString(source, 'asName', 'AsName', 'alias', 'Alias') || undefined,
                type: getString(source, 'type', 'Type') || undefined,
                displayType: getString(source, 'displayType', 'DisplayType') || undefined,
                displaySelect: typeof source.displaySelect === 'boolean'
                    ? source.displaySelect
                    : (typeof source.DisplaySelect === 'boolean' ? source.DisplaySelect : undefined),
            };
        }).filter((item) => item.ref);
    }
    return [];
}
function createFieldLookup() {
    return { byTableAndRef: new Map(), fieldsByTable: new Map() };
}
function addFieldMeta(lookup, meta) {
    const tableRefs = [meta.tableId, meta.tableName].filter(Boolean);
    const fieldRefs = [meta.id, meta.name, meta.label].filter(Boolean);
    for (const tableRef of tableRefs) {
        for (const fieldRef of fieldRefs)
            lookup.byTableAndRef.set(fieldLookupKey(tableRef, fieldRef), meta);
        const key = normalizeKey(tableRef);
        const existing = lookup.fieldsByTable.get(key) || [];
        if (!existing.some((item) => item.id === meta.id || normalizeKey(item.name) === normalizeKey(meta.name))) {
            existing.push(meta);
            lookup.fieldsByTable.set(key, existing);
        }
    }
}
function findFieldMeta(lookup, tableRef, ref) {
    if (!tableRef || !ref)
        return undefined;
    return lookup.byTableAndRef.get(fieldLookupKey(tableRef, ref));
}
function getFieldsForTable(lookup, tableRef) {
    return lookup.fieldsByTable.get(normalizeKey(tableRef)) || [];
}
function systemFieldMeta(tableId, tableName, fieldName) {
    return {
        id: fieldName,
        name: fieldName,
        label: fieldName,
        tableId,
        tableName,
        tableDescription: tableName,
        component: 'Text',
        type: 'varchar(255)',
    };
}
function compactObject(record) {
    return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined && value !== null && value !== ''));
}
function randomId() {
    const now = Date.now().toString(36).toUpperCase().padStart(10, '0');
    const random = Math.random().toString(36).slice(2, 18).toUpperCase().padEnd(16, '0');
    return `${now}${random}`.slice(0, 26);
}
function unwrapList(data) {
    if (Array.isArray(data))
        return asArray(data);
    const record = asRecord(data);
    if (Array.isArray(record.List))
        return asArray(record.List);
    if (Array.isArray(record.Data))
        return asArray(record.Data);
    return [];
}
function apiText(title, response) {
    const lines = [
        `## ${title}`,
        `- Code: ${response.Code}`,
        response.Msg ? `- Message: ${response.Msg}` : '',
        '',
        '```json',
        JSON.stringify(response.Data ?? {}, null, 2),
        '```',
    ].filter(Boolean);
    return textResult(lines.join('\n'), response.Code !== 1);
}
function parseJsonInput(value, fallback) {
    if (typeof value !== 'string')
        return value ?? fallback;
    if (!value.trim())
        return fallback;
    try {
        return JSON.parse(value);
    }
    catch {
        return value;
    }
}
function stringifyConfig(value) {
    if (value === undefined || value === null || value === '')
        return undefined;
    return typeof value === 'string' ? value : JSON.stringify(value);
}
function normalizeMenuJsonArray(fieldName, raw) {
    const errors = [];
    const warnings = [];
    if (raw === undefined || raw === null || raw === '')
        return { ok: true, value: undefined, errors, warnings };
    let arr;
    try {
        arr = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }
    catch (error) {
        return { ok: false, errors: [`${fieldName} 不是合法 JSON 数组：${error instanceof Error ? error.message : String(error)}`], warnings };
    }
    if (!Array.isArray(arr))
        return { ok: false, errors: [`${fieldName} 必须是 JSON 数组`], warnings };
    const ids = new Set();
    const normalized = arr.map((item, index) => {
        const button = asRecord(item);
        const name = getString(button, 'Name', 'name');
        if (!name)
            errors.push(`${fieldName}[${index}].Name 不能为空`);
        if (!getString(button, 'V8Code', 'v8Code') && !getString(button, 'Url', 'url')) {
            errors.push(`${fieldName}[${index}] 必须配置 V8Code 或 Url`);
        }
        const id = getString(button, 'Id', 'id') || randomId();
        if (!getString(button, 'Id', 'id'))
            warnings.push(`${fieldName}[${index}] 未传 Id，已自动生成 ${id}`);
        if (ids.has(id))
            errors.push(`${fieldName} 中存在重复 Id：${id}`);
        ids.add(id);
        const codeShow = getString(button, 'V8CodeShow', 'v8CodeShow');
        if (codeShow && !codeShow.includes('V8.Result')) {
            warnings.push(`${fieldName}[${index}].V8CodeShow 建议显式赋值 V8.Result=true/false`);
        }
        return compactObject({
            ...button,
            Id: id,
            Sort: getNumber(button, 'Sort', 'sort') ?? index * 10,
            Name: name,
            Icon: getString(button, 'Icon', 'icon') || undefined,
            BtnStyle: getString(button, 'BtnStyle', 'btnStyle') || undefined,
            IsVisible: button.IsVisible ?? button.isVisible ?? true,
            ShowRow: fieldName === 'MoreBtns' ? (button.ShowRow ?? button.showRow ?? true) : (button.ShowRow ?? button.showRow),
            V8CodeShow: codeShow || undefined,
            V8Code: getString(button, 'V8Code', 'v8Code') || undefined,
            Url: getString(button, 'Url', 'url') || undefined,
        });
    });
    return { ok: errors.length === 0, value: JSON.stringify(normalized), errors, warnings };
}
function normalizeAllMenuJson(data) {
    const result = { ...data };
    const errors = [];
    const warnings = [];
    const fieldMap = {
        MoreBtns: ['MoreBtns', 'moreBtns'],
        FormBtns: ['FormBtns', 'formBtns'],
        BatchSelectMoreBtns: ['BatchSelectMoreBtns', 'batchSelectMoreBtns'],
        PageTabs: ['PageTabs', 'pageTabs'],
        ExportMoreBtns: ['ExportMoreBtns', 'exportMoreBtns'],
        PageBtns: ['PageBtns', 'pageBtns'],
    };
    for (const [canonical, keys] of Object.entries(fieldMap)) {
        const key = keys.find((candidate) => data[candidate] !== undefined);
        if (!key)
            continue;
        const normalized = normalizeMenuJsonArray(canonical, data[key]);
        errors.push(...normalized.errors);
        warnings.push(...normalized.warnings);
        if (normalized.ok && normalized.value !== undefined)
            result[canonical] = normalized.value;
    }
    return { data: result, errors, warnings };
}
function buildFieldConfig(sourceType, options) {
    const warnings = [];
    const type = sourceType.toLowerCase();
    if (type === 'keyvalue') {
        const raw = getString(options, 'data', 'options');
        const rows = raw
            ? raw.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean).map((item) => {
                const [key, label] = item.split('|');
                return { Key: (key || '').trim(), Value: (label || key || '').trim() };
            })
            : asArray(options.items).map((item) => ({ Key: getString(item, 'Key', 'key'), Value: getString(item, 'Value', 'label', 'name') }));
        return {
            data: JSON.stringify(rows),
            config: { DataSource: 'KeyValue', SelectLabel: 'Value', SelectSaveField: 'Key', SelectSaveFormat: 'Text', EnableSearch: false, DataSourceSqlRemote: false },
            warnings,
        };
    }
    if (type === 'data') {
        const raw = getString(options, 'data', 'options');
        const rows = raw ? raw.split(/[,，;；\n]/).map((item) => item.trim()).filter(Boolean) : (Array.isArray(options.items) ? options.items : []);
        return { data: JSON.stringify(rows), config: { DataSource: 'Data', SelectSaveFormat: 'Text', EnableSearch: false, DataSourceSqlRemote: false }, warnings };
    }
    if (type === 'sql') {
        const sql = getString(options, 'sql', 'Sql');
        if (!sql)
            warnings.push('SQL 数据源缺少 sql');
        return {
            config: {
                DataSource: 'Sql', Sql: sql, SelectLabel: getString(options, 'selectLabel', 'SelectLabel') || 'Name',
                SelectSaveField: getString(options, 'selectSaveField', 'SelectSaveField') || 'Id',
                DataSourceSqlRemote: options.dataSourceSqlRemote ?? options.DataSourceSqlRemote ?? true,
                EnableSearch: options.enableSearch ?? options.EnableSearch ?? true,
            },
            warnings,
        };
    }
    if (type === 'apiengine') {
        const apiEngineKey = getString(options, 'apiEngineKey', 'DataSourceApiEngineKey');
        if (!apiEngineKey)
            warnings.push('接口引擎数据源缺少 apiEngineKey');
        return { config: { DataSource: 'ApiEngine', DataSourceApiEngineKey: apiEngineKey, SelectLabel: getString(options, 'selectLabel') || 'name', SelectSaveField: getString(options, 'selectSaveField') || 'id' }, warnings };
    }
    if (type === 'datasource') {
        const dataSourceId = getString(options, 'dataSourceId', 'DataSourceId');
        if (!dataSourceId)
            warnings.push('数据源引擎配置缺少 dataSourceId');
        return { config: { DataSource: 'DataSource', DataSourceId: dataSourceId, SelectLabel: getString(options, 'selectLabel') || 'Name', SelectSaveField: getString(options, 'selectSaveField') || 'Id' }, warnings };
    }
    if (type === 'autonumber') {
        return { config: { AutoNumberFixed: getString(options, 'prefix', 'AutoNumberFixed'), AutoNumberLength: getNumber(options, 'length', 'AutoNumberLength') ?? 4 }, warnings };
    }
    if (type === 'datetime') {
        return { config: { DateTimeType: getString(options, 'dateTimeType', 'DateTimeType') || 'datetime' }, warnings };
    }
    if (type === 'joinform') {
        return { config: { JoinForm: { TableId: getString(options, 'tableId'), TableName: getString(options, 'tableName'), JoinFieldName: getString(options, 'joinFieldName') || 'Name' } }, warnings };
    }
    warnings.push(`未知 sourceType: ${sourceType}，已返回空配置`);
    return { config: {}, warnings };
}
function toSearchFieldModel(meta, ref) {
    return compactObject({
        Id: meta.id,
        AsName: ref?.asName || '',
        Name: meta.name,
        Label: meta.label || meta.name,
        TableId: meta.tableId,
        TableName: meta.tableName,
        TableDescription: meta.tableDescription || meta.tableName,
        DisplayType: ref?.displayType || 'Out',
        DisplaySelect: ref?.displaySelect ?? false,
    });
}
function resolveFieldRefs(lookup, tableId, tableName, refs, context) {
    return refs.map((ref) => {
        const meta = findFieldMeta(lookup, tableId, ref.ref)
            || findFieldMeta(lookup, tableName, ref.ref)
            || (isSystemFieldName(ref.ref) ? systemFieldMeta(tableId, tableName, ref.ref) : undefined);
        if (!meta)
            throw new Error(`${context}: unknown field "${ref.ref}" on table "${tableName || tableId}"`);
        return { meta, ref };
    });
}
function getExplicitJsonString(record, ...keys) {
    for (const key of keys) {
        const value = getValue(record, key);
        if (value === undefined || value === null || value === '')
            continue;
        return typeof value === 'string' ? value : JSON.stringify(value);
    }
    return '';
}
function defaultListFields(fields) {
    const hidden = new Set(['Id', 'OsClient', 'IsDeleted']);
    const businessFields = fields.filter((field) => !hidden.has(field.name) && !field.component.toLowerCase().includes('hidden'));
    const source = businessFields.length ? businessFields : fields;
    return source.slice(0, Math.min(8, source.length));
}
function defaultSearchFields(fields) {
    const searchableComponents = new Set(['Text', 'Textarea', 'Select', 'MultipleSelect', 'Radio', 'Checkbox', 'DateTime', 'Date', 'NumberText', 'AutoNumber']);
    return fields.filter((field) => searchableComponents.has(field.component || 'Text')).slice(0, 4);
}
function buildDefaultOrderBy(module, lookup, tableId, tableName) {
    const canonical = getValue(module, 'DefaultOrderBy');
    if (canonical !== undefined && canonical !== null && canonical !== '') {
        return typeof canonical === 'string' ? canonical : JSON.stringify(canonical);
    }
    const natural = getValue(module, 'defaultOrderBy');
    if (natural !== undefined && natural !== null && natural !== '') {
        const refs = Array.isArray(natural) || (typeof natural === 'string' && natural.trim().startsWith('['))
            ? getFieldRefs({ value: natural }, 'value')
            : [{ ref: String(natural).trim(), type: 'DESC' }];
        return JSON.stringify(resolveFieldRefs(lookup, tableId, tableName, refs, 'module.defaultOrderBy').map(({ meta, ref }, index) => ({
            Id: meta.id,
            Name: meta.name,
            Type: ref.type || 'DESC',
            Sort: index,
        })));
    }
    const refs = getFieldRefs(module, 'orderBy', 'OrderBy', 'defaultSort', 'DefaultSort', 'sortBy', 'SortBy');
    if (!refs.length)
        return undefined;
    return JSON.stringify(resolveFieldRefs(lookup, tableId, tableName, refs, 'module.defaultOrderBy').map(({ meta, ref }, index) => ({
        Id: meta.id,
        Name: meta.name,
        Type: ref.type || 'DESC',
        Sort: index,
    })));
}
function resolveModuleFields(module, lookup, tableId, tableName) {
    if (!tableId && !tableName)
        return {};
    const tableFields = getFieldsForTable(lookup, tableId).length ? getFieldsForTable(lookup, tableId) : getFieldsForTable(lookup, tableName);
    const output = {};
    const searchRefs = getFieldRefs(module, 'searchFields', 'SearchFields', 'searchFieldNames', 'SearchFieldNames');
    const resolvedSearch = searchRefs.length
        ? resolveFieldRefs(lookup, tableId, tableName, searchRefs, 'module.searchFields')
        : defaultSearchFields(tableFields).map((meta) => ({ meta, ref: { ref: meta.name } }));
    if (!getExplicitJsonString(module, 'searchFieldIds', 'SearchFieldIds') && resolvedSearch.length) {
        output.SearchFieldIds = JSON.stringify(resolvedSearch.map(({ meta, ref }) => toSearchFieldModel(meta, ref)));
    }
    const listRefs = getFieldRefs(module, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns');
    const resolvedList = listRefs.length
        ? resolveFieldRefs(lookup, tableId, tableName, listRefs, 'module.listFields')
        : defaultListFields(tableFields).map((meta) => ({ meta, ref: { ref: meta.name } }));
    if (!getExplicitJsonString(module, 'tableDiyFieldIds', 'TableDiyFieldIds') && resolvedList.length) {
        output.TableDiyFieldIds = JSON.stringify(resolvedList.map(({ meta }) => meta.id));
    }
    if (!getExplicitJsonString(module, 'selectFields', 'SelectFields') && resolvedList.length) {
        output.SelectFields = JSON.stringify(resolvedList.map(({ meta, ref }) => toSearchFieldModel(meta, ref)));
    }
    const listFieldConfigs = [
        { canonical: 'SortFieldIds', explicitKeys: ['sortFieldIds', 'SortFieldIds'], refKeys: ['sortFields', 'SortFields'] },
        { canonical: 'NotShowFields', explicitKeys: ['notShowFields', 'NotShowFields'], refKeys: ['hiddenFields', 'HiddenFields', 'notShowFieldsByName', 'NotShowFieldsByName'] },
        { canonical: 'InTableEditFields', explicitKeys: ['inTableEditFields', 'InTableEditFields'], refKeys: ['editableFields', 'EditableFields', 'inTableEditFieldsByName', 'InTableEditFieldsByName'] },
        { canonical: 'MobileListFields', explicitKeys: ['mobileListFields', 'MobileListFields'], refKeys: ['mobileFields', 'MobileFields'], objectArray: true },
        { canonical: 'CardTitleTagFields', explicitKeys: ['cardTitleTagFields', 'CardTitleTagFields'], refKeys: ['cardTitleFields', 'CardTitleFields'], objectArray: true },
        { canonical: 'CardBottomTagFields', explicitKeys: ['cardBottomTagFields', 'CardBottomTagFields'], refKeys: ['cardBottomFields', 'CardBottomFields'], objectArray: true },
    ];
    for (const item of listFieldConfigs) {
        if (getExplicitJsonString(module, ...item.explicitKeys))
            continue;
        const refs = getFieldRefs(module, ...item.refKeys);
        if (!refs.length)
            continue;
        const resolved = resolveFieldRefs(lookup, tableId, tableName, refs, `module.${item.canonical}`);
        output[item.canonical] = JSON.stringify(item.objectArray
            ? resolved.map(({ meta, ref }) => toSearchFieldModel(meta, ref))
            : resolved.map(({ meta }) => meta.id));
    }
    const statisticsRefs = getFieldRefs(module, 'statisticsFieldNames', 'StatisticsFieldNames', 'statFields', 'StatFields');
    if (!getExplicitJsonString(module, 'statisticsFields', 'StatisticsFields') && statisticsRefs.length) {
        output.StatisticsFields = JSON.stringify(resolveFieldRefs(lookup, tableId, tableName, statisticsRefs, 'module.statisticsFields').map(({ meta, ref }) => ({
            Id: meta.id,
            Type: ref.type || 'SUM',
        })));
    }
    const defaultOrderBy = buildDefaultOrderBy(module, lookup, tableId, tableName);
    if (defaultOrderBy)
        output.DefaultOrderBy = defaultOrderBy;
    return output;
}
function populateFieldLookupFromSchema(lookup, schemaData, tableIdByName) {
    const tables = asArray(asRecord(schemaData).Tables);
    for (const table of tables) {
        const tableId = getString(table, 'Id', 'id');
        const tableName = getString(table, 'Name', 'name');
        if (!tableId || !tableName)
            continue;
        tableIdByName?.set(tableName.toLowerCase(), tableId);
        const fieldsValue = getValue(table, '_Fields', 'Fields', 'fields');
        const fields = Array.isArray(fieldsValue) ? asArray(fieldsValue) : [];
        for (const field of fields) {
            const id = getString(field, 'Id', 'id');
            const name = getString(field, 'Name', 'name');
            if (!id || !name)
                continue;
            addFieldMeta(lookup, {
                id,
                name,
                label: getString(field, 'Label', 'label') || name,
                tableId,
                tableName,
                tableDescription: getString(table, 'Description', 'description') || tableName,
                component: getString(field, 'Component', 'component') || 'Text',
                type: getString(field, 'Type', 'type') || 'varchar(255)',
            });
        }
    }
}
function buildPlan(manifest) {
    const errors = [];
    const warnings = [];
    const plan = [];
    const roles = getArray(manifest, 'roles', 'Roles');
    const tables = getArray(manifest, 'tables', 'Tables');
    const engines = getArray(manifest, 'engines', 'Engines');
    const modules = getArray(manifest, 'modules', 'Modules');
    const events = getArray(manifest, 'events', 'Events');
    const dataSources = getArray(manifest, 'dataSources', 'DataSources');
    const pages = getArray(manifest, 'pages', 'Pages');
    const printTemplates = getArray(manifest, 'printTemplates', 'PrintTemplates');
    const workflows = getArray(manifest, 'workflows', 'Workflows');
    const jobs = getArray(manifest, 'jobs', 'Jobs');
    const permissions = getArray(manifest, 'permissions', 'Permissions');
    const manifestFieldsByTable = new Map();
    if (!tables.length && !engines.length && !modules.length && !pages.length) {
        warnings.push('Manifest 未声明 tables/engines/modules/pages，可能不是完整系统计划');
    }
    roles.forEach((item) => plan.push(`save_role ${getString(item, 'name', 'Name')}`));
    tables.forEach((table, tableIndex) => {
        const name = getString(table, 'name', 'Name');
        if (!name)
            errors.push(`tables[${tableIndex}].name 不能为空`);
        plan.push(`create_table ${name || `(index ${tableIndex})`}`);
        if (name)
            manifestFieldsByTable.set(name.toLowerCase(), new Set());
        getArray(table, 'fields', 'Fields').forEach((field, fieldIndex) => {
            const fieldName = getString(field, 'name', 'Name');
            const label = getString(field, 'label', 'Label');
            if (!fieldName)
                errors.push(`tables[${tableIndex}].fields[${fieldIndex}].name 不能为空`);
            if (!label)
                errors.push(`tables[${tableIndex}].fields[${fieldIndex}].label 不能为空`);
            if (name && fieldName)
                manifestFieldsByTable.get(name.toLowerCase())?.add(fieldName.toLowerCase());
            if (name && label)
                manifestFieldsByTable.get(name.toLowerCase())?.add(label.toLowerCase());
            plan.push(`add_field ${name}.${fieldName}`);
        });
    });
    dataSources.forEach((item) => plan.push(`save_data_source ${getString(item, 'dataSourceKey', 'DataSourceKey')}`));
    engines.forEach((item) => plan.push(`upsert_engine ${getString(item, 'apiEngineKey', 'ApiEngineKey')}`));
    events.forEach((item) => plan.push(`save_event ${getString(item, 'formEngineKey', 'FormEngineKey')}/${getString(item, 'eventType', 'EventType')}`));
    modules.forEach((item) => {
        const normalized = normalizeAllMenuJson(item);
        errors.push(...normalized.errors);
        warnings.push(...normalized.warnings);
        const tableRef = getString(item, 'table', 'tableName', 'diyTableName', 'DiyTableName');
        const moduleName = getString(item, 'name', 'Name');
        if (tableRef && manifestFieldsByTable.has(tableRef.toLowerCase())) {
            const fields = manifestFieldsByTable.get(tableRef.toLowerCase()) || new Set();
            const fieldGroups = [
                ['listFields', getFieldRefs(item, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns')],
                ['searchFields', getFieldRefs(item, 'searchFields', 'SearchFields', 'searchFieldNames', 'SearchFieldNames')],
                ['sortFields', getFieldRefs(item, 'sortFields', 'SortFields')],
                ['hiddenFields', getFieldRefs(item, 'hiddenFields', 'HiddenFields', 'notShowFieldsByName', 'NotShowFieldsByName')],
                ['mobileFields', getFieldRefs(item, 'mobileFields', 'MobileFields')],
            ];
            for (const [groupName, refs] of fieldGroups) {
                for (const ref of refs) {
                    if (!fields.has(ref.ref.toLowerCase()) && !isSystemFieldName(ref.ref)) {
                        errors.push(`modules.${moduleName || tableRef}.${groupName} references unknown field "${ref.ref}" on table "${tableRef}"`);
                    }
                }
            }
        }
        if (tableRef && !getFieldRefs(item, 'listFields', 'ListFields', 'tableFields', 'TableFields', 'columns', 'Columns').length && !getExplicitJsonString(item, 'TableDiyFieldIds', 'SelectFields')) {
            warnings.push(`module ${moduleName || tableRef} has no listFields; generator will use the first business fields from ${tableRef}`);
        }
        plan.push(`create_or_update_module ${getString(item, 'name', 'Name')}`);
    });
    permissions.forEach((item) => plan.push(`set_permission ${getString(item, 'roleId', 'RoleId') || 'admin'}`));
    pages.forEach((item) => plan.push(`save_page ${getString(item, 'title', 'Title')}`));
    printTemplates.forEach((item) => plan.push(`save_print_template ${getString(item, 'title', 'Title')}`));
    workflows.forEach((item) => plan.push(`save_workflow ${getString(asRecord(item.FlowDesign ?? item.flowDesign ?? item), 'FlowName', 'flowName', 'name')}`));
    jobs.forEach((item) => plan.push(`save_job ${getString(item, 'jobName', 'JobName')}`));
    return { plan, errors, warnings };
}
async function audit(client, action, target, payload) {
    try {
        await client.writeAuditLog(action, target, JSON.stringify(payload).slice(0, 6000));
    }
    catch (error) {
        console.error('[microi-mcp] audit log failed:', error instanceof Error ? error.message : String(error));
    }
}
async function upsertEngine(client, engine) {
    const apiEngineKey = getString(engine, 'apiEngineKey', 'ApiEngineKey');
    const apiName = getString(engine, 'apiName', 'ApiName', 'name', 'Name') || apiEngineKey;
    const category = getString(engine, 'category', 'Category') || 'AI生成';
    const code = getString(engine, 'code', 'Code', 'ApiV8Code');
    const existing = await client.getEngineCode(apiEngineKey);
    if (existing.Code === 1) {
        return client.saveEngineCode(apiEngineKey, code);
    }
    return client.createEngine({ ApiEngineKey: apiEngineKey, ApiName: apiName, Category: category, Code: code });
}
function modulePayload(module, tableIdByName, moduleIdByName, fieldLookup) {
    const tableRef = getString(module, 'table', 'tableName', 'diyTableName', 'DiyTableName');
    const normalized = normalizeAllMenuJson(module);
    if (normalized.errors.length)
        throw new Error(normalized.errors.join('\n'));
    const diyTableId = getString(module, 'diyTableId', 'DiyTableId') || (tableRef ? tableIdByName.get(tableRef.toLowerCase()) : '');
    const tableName = tableRef || getString(module, 'DiyTableName', 'diyTableName');
    const resolvedFields = fieldLookup ? resolveModuleFields(module, fieldLookup, diyTableId || '', tableName) : {};
    const payload = compactObject({
        ...normalized.data,
        ...resolvedFields,
        Name: getString(module, 'name', 'Name'),
        DiyTableId: diyTableId,
        ParentId: getString(module, 'parentId', 'ParentId') || (moduleIdByName ? moduleIdByName.get(getString(module, 'parentName', 'ParentName').toLowerCase()) : undefined),
        ComponentName: getString(module, 'componentName', 'ComponentName'),
        ComponentPath: getString(module, 'componentPath', 'ComponentPath'),
        Display: getNumber(module, 'display', 'Display'),
        AppDisplay: getNumber(module, 'appDisplay', 'AppDisplay'),
        OpenType: getString(module, 'openType', 'OpenType'),
        Url: getString(module, 'url', 'Url'),
        Sort: getNumber(module, 'sort', 'Sort'),
        Icon: getString(module, 'icon', 'Icon'),
        SearchFieldIds: getExplicitJsonString(module, 'searchFieldIds', 'SearchFieldIds') || resolvedFields.SearchFieldIds,
        TableDiyFieldIds: getExplicitJsonString(module, 'tableDiyFieldIds', 'TableDiyFieldIds') || resolvedFields.TableDiyFieldIds,
        SelectFields: getExplicitJsonString(module, 'selectFields', 'SelectFields') || resolvedFields.SelectFields,
        DefaultOrderBy: getExplicitJsonString(module, 'DefaultOrderBy') || resolvedFields.DefaultOrderBy,
        SqlWhere: getString(module, 'sqlWhere', 'SqlWhere'),
        SqlJoin: getString(module, 'sqlJoin', 'SqlJoin'),
        JoinTables: getExplicitJsonString(module, 'joinTables', 'JoinTables'),
        SortFieldIds: getExplicitJsonString(module, 'sortFieldIds', 'SortFieldIds') || resolvedFields.SortFieldIds,
        NotShowFields: getExplicitJsonString(module, 'notShowFields', 'NotShowFields') || resolvedFields.NotShowFields,
        StatisticsFields: getExplicitJsonString(module, 'statisticsFields', 'StatisticsFields') || resolvedFields.StatisticsFields,
        InTableEdit: getNumber(module, 'inTableEdit', 'InTableEdit'),
        InTableEditFields: getExplicitJsonString(module, 'inTableEditFields', 'InTableEditFields') || resolvedFields.InTableEditFields,
        MobileListFields: getExplicitJsonString(module, 'mobileListFields', 'MobileListFields') || resolvedFields.MobileListFields,
        CardTitleTagFields: getExplicitJsonString(module, 'cardTitleTagFields', 'CardTitleTagFields') || resolvedFields.CardTitleTagFields,
        CardBottomTagFields: getExplicitJsonString(module, 'cardBottomTagFields', 'CardBottomTagFields') || resolvedFields.CardBottomTagFields,
        DiyConfig: stringifyConfig(module.diyConfig ?? module.DiyConfig),
    });
    return payload;
}
function rolePayload(role) {
    return compactObject({
        ...role,
        Id: getString(role, 'Id', 'roleId', 'RoleId') || undefined,
        Name: getString(role, 'Name', 'name'),
        Level: getNumber(role, 'Level', 'level'),
        Sort: getNumber(role, 'Sort', 'sort'),
        Remark: getString(role, 'Remark', 'remark', 'description'),
        DeptIds: getString(role, 'DeptIds', 'deptIds'),
        BaseLimit: getString(role, 'BaseLimit', 'baseLimit'),
    });
}
function dataSourcePayload(dataSource) {
    return compactObject({
        ...dataSource,
        Id: getString(dataSource, 'Id', 'dataSourceId', 'DataSourceId') || undefined,
        DataSourceName: getString(dataSource, 'DataSourceName', 'dataSourceName', 'name', 'Name'),
        DataSourceKey: getString(dataSource, 'DataSourceKey', 'dataSourceKey'),
        DataSourceType: getString(dataSource, 'DataSourceType', 'dataSourceType') || 'V8',
        SqlDataSource: getString(dataSource, 'SqlDataSource', 'sqlDataSource', 'sql'),
        V8DataSource: getString(dataSource, 'V8DataSource', 'v8DataSource', 'code'),
        JsonDataSource: stringifyConfig(dataSource.JsonDataSource ?? dataSource.jsonDataSource ?? dataSource.json),
        TestParam: stringifyConfig(dataSource.TestParam ?? dataSource.testParam),
        DataSourceRole: getString(dataSource, 'DataSourceRole', 'dataSourceRole'),
        AllowAnonymous: getNumber(dataSource, 'AllowAnonymous', 'allowAnonymous'),
        IsEnable: getNumber(dataSource, 'IsEnable', 'isEnable') ?? 1,
    });
}
function printTemplatePayload(template) {
    return compactObject({
        ...template,
        Id: getString(template, 'Id', 'printId', 'PrintId') || undefined,
        Title: getString(template, 'Title', 'title'),
        Number: getString(template, 'Number', 'number'),
        Desc: getString(template, 'Desc', 'desc', 'description'),
        DataApi: getString(template, 'DataApi', 'dataApi'),
        PageObj: stringifyConfig(template.PageObj ?? template.pageObj),
        PrintObj: stringifyConfig(template.PrintObj ?? template.printObj),
    });
}
function jobPayload(job) {
    return compactObject({
        ...job,
        Id: getString(job, 'Id', 'jobId', 'JobId') || undefined,
        JobName: getString(job, 'JobName', 'jobName', 'name', 'Name'),
        CronExpression: getString(job, 'CronExpression', 'cronExpression', 'cron'),
        JobType: getString(job, 'JobType', 'jobType') || '1',
        ApiEngineKey: getString(job, 'ApiEngineKey', 'apiEngineKey'),
        JobParam: stringifyConfig(job.JobParam ?? job.jobParam ?? job.params),
        JobDesc: getString(job, 'JobDesc', 'jobDesc', 'description'),
        CronDesc: getString(job, 'CronDesc', 'cronDesc'),
        DllName: getString(job, 'DllName', 'dllName'),
        JobPath: getString(job, 'JobPath', 'jobPath'),
    });
}
function manifestGuide(osClient) {
    const confirmTarget = osClient || 'EXECUTE';
    return {
        osClient,
        workflow: [
            'Call microi_get_db_schema first to inspect existing tables.',
            'Call microi_get_manifest_schema to draft a manifest from the user requirement.',
            'Call microi_plan_system with the manifest and fix all errors.',
            'Call microi_generate_system with dryRun=true.',
            `Call microi_generate_system with dryRun=false and confirmExecution="${confirmTarget}" only after the user confirms writes.`,
            'Call microi_validate_system after generation if you need an independent validation pass.',
        ],
        manifestShape: {
            name: 'System name',
            roles: [{ name: 'Admin', level: 999 }],
            tables: [{
                    name: 'Biz_Order',
                    description: 'Order main table',
                    fields: [
                        { name: 'OrderNo', label: 'Order No', type: 'varchar(50)', component: 'AutoNumber', configSource: { sourceType: 'AutoNumber', prefix: 'ORD', length: 6 }, notEmpty: 1, unique: 1, tableWidth: 160, sort: 10 },
                        { name: 'CustomerName', label: 'Customer', type: 'varchar(100)', component: 'Text', notEmpty: 1, tableWidth: 160, sort: 20 },
                        { name: 'Status', label: 'Status', type: 'varchar(50)', component: 'Select', configSource: { sourceType: 'KeyValue', items: [{ Key: 'Draft', Value: 'Draft' }, { Key: 'Submitted', Value: 'Submitted' }] }, sort: 30 },
                    ],
                }],
            engines: [{ apiEngineKey: 'biz_order_submit', apiName: 'Submit order', category: 'Biz_Order', code: "return { Code: 1, Data: V8.Param };" }],
            events: [{ formEngineKey: 'Biz_Order', eventType: 'SubmitBeforeServerV8', code: "if (!V8.Form.OrderNo) return { Code: 0, Msg: 'OrderNo required' };" }],
            modules: [{
                    name: 'Orders',
                    table: 'Biz_Order',
                    icon: 'Document',
                    listFields: ['OrderNo', 'CustomerName', 'Status', 'CreateTime'],
                    searchFields: ['OrderNo', 'CustomerName', 'Status'],
                    sortFields: ['CreateTime'],
                    defaultOrderBy: [{ field: 'CreateTime', type: 'DESC' }],
                    moreBtns: [{ Name: 'Submit', BtnStyle: 'primary', V8CodeShow: "V8.Result=V8.Form.Status=='Draft';", V8Code: "var r=await V8.ApiEngine.Run({ApiEngineKey:'biz_order_submit',Id:V8.Form.Id});V8.Result=r;" }],
                }],
            permissions: [{ roleId: 'admin', moduleNames: ['Orders'] }],
            dataSources: [],
            pages: [],
            printTemplates: [],
            workflows: [],
            jobs: [],
        },
        naturalFieldKeys: {
            modules: {
                table: 'Bind by table name. The generator resolves the table Id after create/refresh schema.',
                listFields: 'Field names/labels/ids for grid columns. Produces TableDiyFieldIds and SelectFields.',
                searchFields: 'Field names/labels/ids for search controls. Produces SearchFieldIds object array.',
                sortFields: 'Field names/labels/ids for sortable fields. Produces SortFieldIds.',
                hiddenFields: 'Field names/labels/ids to hide. Produces NotShowFields.',
                editableFields: 'Field names/labels/ids for in-table editing. Produces InTableEditFields.',
                mobileFields: 'Field names/labels/ids for mobile card list. Produces MobileListFields.',
                cardTitleFields: 'Field names/labels/ids for card title tags. Produces CardTitleTagFields.',
                cardBottomFields: 'Field names/labels/ids for card bottom tags. Produces CardBottomTagFields.',
            },
        },
        rules: [
            'Use table and field names in manifests; do not ask the user for diy_field ids.',
            'Put business logic in API engines and call them from menu button V8Code.',
            'Use parameterized V8.Db SQL or V8.FormEngine CRUD in engine/event code.',
            'Use dryRun=true until the user explicitly asks to write.',
        ],
    };
}
export function registerAdvancedTools(server, client, context) {
    const osClient = context.osClient;
    const systemConfirmTarget = osClient || 'EXECUTE';
    server.tool('microi_get_manifest_schema', 'Return the recommended full-system manifest schema for natural-language Microi generation, including field-name based module configuration.', {}, async () => textResult(JSON.stringify(manifestGuide(osClient), null, 2)));
    server.tool('microi_validate_menu_buttons', 'Validate and normalize sys_menu button/tab JSON arrays (MoreBtns/FormBtns/BatchSelectMoreBtns/PageTabs/ExportMoreBtns/PageBtns). Returns canonical JSON strings with generated Id/Sort/default visibility.', {
        moreBtns: z.unknown().optional(),
        formBtns: z.unknown().optional(),
        batchSelectMoreBtns: z.unknown().optional(),
        pageTabs: z.unknown().optional(),
        exportMoreBtns: z.unknown().optional(),
        pageBtns: z.unknown().optional(),
    }, async (input) => {
        const normalized = normalizeAllMenuJson(input);
        return textResult(JSON.stringify({ ok: normalized.errors.length === 0, ...normalized }, null, 2), normalized.errors.length > 0);
    });
    server.tool('microi_build_field_config', `Build and validate Microi diy_field Data/Config JSON for option controls, SQL/APIEngine/DataSource sources, JoinForm, AutoNumber and DateTime. OsClient: ${osClient}`, {
        sourceType: z.enum(['Data', 'KeyValue', 'Sql', 'ApiEngine', 'DataSource', 'AutoNumber', 'JoinForm', 'DateTime']).describe('Config source type'),
        options: jsonRecordSchema.optional().describe('Source options, such as data/options, sql, apiEngineKey, dataSourceId, tableId, prefix, length'),
    }, async ({ sourceType, options }) => {
        const built = buildFieldConfig(sourceType, options || {});
        return textResult(JSON.stringify({ ok: built.warnings.length === 0, ...built, configJson: JSON.stringify(built.config) }, null, 2));
    });
    server.tool('microi_plan_system', 'Create a dry-run execution plan for a full low-code system manifest. This performs local structural validation only and does not write to Microi.', { manifest: jsonRecordSchema.describe('System manifest with tables, engines, modules, permissions, pages, dataSources, printTemplates, workflows, jobs') }, async ({ manifest }) => {
        const plan = buildPlan(manifest);
        return textResult(JSON.stringify({ ok: plan.errors.length === 0, dryRun: true, ...plan }, null, 2), plan.errors.length > 0);
    });
    server.tool('microi_validate_system', `Validate that a generated low-code system exists on Microi server after generation. OsClient: ${osClient}`, { manifest: jsonRecordSchema.describe('The same manifest used by microi_generate_system') }, async ({ manifest }) => {
        try {
            const result = await client.validateLowCodeSystem(manifest);
            return apiText('Low-Code System Validation', result);
        }
        catch (error) {
            return textResult(`Error: ${error instanceof Error ? error.message : String(error)}`, true);
        }
    });
    server.tool('microi_generate_system', `Generate a complete Microi low-code system from a manifest. Supports dryRun execution plans and post-generation validation. Writes require confirmExecution="${systemConfirmTarget}". OsClient: ${osClient}`, {
        manifest: jsonRecordSchema.describe('System manifest with tables, fields, dataSources, engines, events, modules, permissions, pages, printTemplates, workflows and jobs'),
        dryRun: z.boolean().optional().describe('Default true. When true, only returns an execution plan.'),
        confirmExecution: z.string().optional().describe(`Required when dryRun=false. Must equal "${systemConfirmTarget}".`),
    }, async ({ manifest, dryRun = true, confirmExecution }) => {
        const plan = buildPlan(manifest);
        if (plan.errors.length > 0)
            return textResult(JSON.stringify({ ok: false, ...plan }, null, 2), true);
        if (dryRun)
            return textResult(JSON.stringify({ ok: true, dryRun: true, ...plan }, null, 2));
        if (confirmExecution !== systemConfirmTarget) {
            return textResult(`写入已拦截：请重新调用并传 confirmExecution="${systemConfirmTarget}"。\n\n${JSON.stringify({ plan: plan.plan, warnings: plan.warnings }, null, 2)}`, true);
        }
        const results = [];
        const tableIdByName = new Map();
        const moduleIdByName = new Map();
        const roleIdByName = new Map();
        const fieldLookup = createFieldLookup();
        try {
            await audit(client, 'microi_generate_system:start', getString(manifest, 'name', 'Name') || 'manifest', manifest);
            for (const role of getArray(manifest, 'roles', 'Roles')) {
                const payload = rolePayload(role);
                const response = await client.saveRole(payload);
                const roleName = getString(payload, 'Name');
                results.push({ step: 'saveRole', roleName, response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'saveRole', role: payload, response, results }, null, 2), true);
                const roleId = getString(asRecord(response.Data), 'Id', 'RoleId');
                if (roleName && roleId)
                    roleIdByName.set(roleName.toLowerCase(), roleId);
            }
            for (const table of getArray(manifest, 'tables', 'Tables')) {
                const tableName = getString(table, 'name', 'Name');
                const response = await client.createTable(tableName, getString(table, 'description', 'Description'), {
                    Tabs: stringifyConfig(table.tabs ?? table.Tabs),
                    IsTree: getNumber(table, 'isTree', 'IsTree'),
                    Column: getNumber(table, 'column', 'Column'),
                    FormOpenType: getString(table, 'formOpenType', 'FormOpenType'),
                    FormOpenWidth: getString(table, 'formOpenWidth', 'FormOpenWidth'),
                });
                results.push({ step: 'createTable', tableName, response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'createTable', tableName, response, results }, null, 2), true);
                const tableId = getString(asRecord(response.Data), 'TableId', 'Id');
                if (tableId)
                    tableIdByName.set(tableName.toLowerCase(), tableId);
                for (const field of getArray(table, 'fields', 'Fields')) {
                    const configSource = asRecord(field.configSource ?? field.ConfigSource);
                    const generatedConfig = getString(configSource, 'sourceType') ? buildFieldConfig(getString(configSource, 'sourceType'), configSource) : undefined;
                    const fieldPayload = compactObject({
                        TableId: tableId,
                        Name: getString(field, 'name', 'Name'),
                        Label: getString(field, 'label', 'Label'),
                        Type: getString(field, 'type', 'Type'),
                        Component: getString(field, 'component', 'Component'),
                        Visible: getNumber(field, 'visible', 'Visible'),
                        AppVisible: getNumber(field, 'appVisible', 'AppVisible'),
                        Tab: getString(field, 'tab', 'Tab'),
                        TableWidth: getNumber(field, 'tableWidth', 'TableWidth'),
                        Sort: getNumber(field, 'sort', 'Sort'),
                        Readonly: getNumber(field, 'readonly', 'Readonly'),
                        NotEmpty: getNumber(field, 'notEmpty', 'NotEmpty'),
                        Unique: getNumber(field, 'unique', 'Unique'),
                        DefaultValue: getString(field, 'defaultValue', 'DefaultValue'),
                        Placeholder: getString(field, 'placeholder', 'Placeholder'),
                        Data: generatedConfig?.data ?? getString(field, 'data', 'Data'),
                        Config: generatedConfig ? JSON.stringify(generatedConfig.config) : stringifyConfig(field.config ?? field.Config),
                        Description: getString(field, 'description', 'Description'),
                        Encrypt: getNumber(field, 'encrypt', 'Encrypt'),
                        InTableEdit: getNumber(field, 'inTableEdit', 'InTableEdit'),
                    });
                    const addResponse = await client.addField(fieldPayload);
                    results.push({ step: 'addField', tableName, fieldName: getString(field, 'name', 'Name'), response: addResponse });
                    if (addResponse.Code !== 1)
                        return textResult(JSON.stringify({ ok: false, failedAt: 'addField', tableName, field, response: addResponse, results }, null, 2), true);
                    const fieldId = getString(asRecord(addResponse.Data), 'FieldId', 'Id');
                    const fieldName = getString(fieldPayload, 'Name');
                    if (fieldId && fieldName) {
                        addFieldMeta(fieldLookup, {
                            id: fieldId,
                            name: fieldName,
                            label: getString(fieldPayload, 'Label') || fieldName,
                            tableId,
                            tableName,
                            tableDescription: getString(table, 'description', 'Description') || tableName,
                            component: getString(fieldPayload, 'Component') || 'Text',
                            type: getString(fieldPayload, 'Type') || 'varchar(255)',
                        });
                    }
                }
            }
            const schemaResponse = await client.getDbSchema();
            results.push({ step: 'refreshDbSchema', response: { Code: schemaResponse.Code, Msg: schemaResponse.Msg, Summary: asRecord(asRecord(schemaResponse.Data).Summary) } });
            if (schemaResponse.Code === 1) {
                populateFieldLookupFromSchema(fieldLookup, schemaResponse.Data, tableIdByName);
            }
            else {
                plan.warnings.push(`Could not refresh schema before module field resolution: ${schemaResponse.Msg || schemaResponse.Code}`);
            }
            for (const dataSource of getArray(manifest, 'dataSources', 'DataSources')) {
                const payload = dataSourcePayload(dataSource);
                const response = await client.saveDataSource(payload);
                results.push({ step: 'saveDataSource', key: getString(payload, 'DataSourceKey'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'saveDataSource', dataSource: payload, response, results }, null, 2), true);
            }
            for (const engine of getArray(manifest, 'engines', 'Engines')) {
                const response = await upsertEngine(client, engine);
                results.push({ step: 'upsertEngine', apiEngineKey: getString(engine, 'apiEngineKey', 'ApiEngineKey'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'upsertEngine', engine, response, results }, null, 2), true);
            }
            for (const event of getArray(manifest, 'events', 'Events')) {
                const response = await client.saveEventCode(getString(event, 'formEngineKey', 'FormEngineKey'), getString(event, 'eventType', 'EventType'), getString(event, 'code', 'Code', 'V8Code'));
                results.push({ step: 'saveEvent', event, response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'saveEvent', event, response, results }, null, 2), true);
            }
            for (const module of getArray(manifest, 'modules', 'Modules')) {
                const payload = modulePayload(module, tableIdByName, moduleIdByName, fieldLookup);
                const response = await client.createModule(payload);
                results.push({ step: 'createModule', moduleName: payload.Name, response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'createModule', module: payload, response, results }, null, 2), true);
                const moduleId = getString(asRecord(response.Data), 'ModuleId', 'Id');
                if (moduleId && typeof payload.Name === 'string')
                    moduleIdByName.set(payload.Name.toLowerCase(), moduleId);
            }
            for (const permission of getArray(manifest, 'permissions', 'Permissions')) {
                const roleName = getString(permission, 'roleName', 'RoleName', 'name', 'Name');
                const roleId = getString(permission, 'roleId', 'RoleId') || (roleName ? roleIdByName.get(roleName.toLowerCase()) : '') || 'admin';
                const explicitMenuIds = getStringArray(permission, 'menuIds', 'MenuIds');
                const moduleNames = getStringArray(permission, 'moduleNames', 'ModuleNames');
                const menuIds = explicitMenuIds.length
                    ? explicitMenuIds
                    : moduleNames.map((name) => moduleIdByName.get(name.toLowerCase()) || '').filter(Boolean);
                const response = await client.setRolePermission(roleId, menuIds);
                results.push({ step: 'setRolePermission', roleId, menuIds, response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'setRolePermission', permission, response, results }, null, 2), true);
            }
            for (const page of getArray(manifest, 'pages', 'Pages')) {
                const response = await client.savePageEngine({
                    PageId: getString(page, 'pageId', 'PageId', 'Id') || undefined,
                    Title: getString(page, 'title', 'Title'),
                    Number: getString(page, 'number', 'Number') || undefined,
                    Desc: getString(page, 'desc', 'Desc') || undefined,
                    JsonStr: stringifyConfig(page.json ?? page.JsonObj ?? page.JsonStr) || '{}',
                });
                results.push({ step: 'savePage', title: getString(page, 'title', 'Title'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'savePage', page, response, results }, null, 2), true);
            }
            for (const template of getArray(manifest, 'printTemplates', 'PrintTemplates')) {
                const payload = printTemplatePayload(template);
                const response = await client.savePrintTemplate(payload);
                results.push({ step: 'savePrintTemplate', title: getString(payload, 'Title'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'savePrintTemplate', template: payload, response, results }, null, 2), true);
            }
            for (const workflow of getArray(manifest, 'workflows', 'Workflows')) {
                const response = await client.saveWorkflowPackage(workflow);
                results.push({ step: 'saveWorkflowPackage', workflow: getString(asRecord(workflow.FlowDesign ?? workflow.flowDesign ?? workflow), 'FlowName', 'flowName'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'saveWorkflowPackage', workflow, response, results }, null, 2), true);
            }
            for (const job of getArray(manifest, 'jobs', 'Jobs')) {
                const payload = jobPayload(job);
                const response = await client.saveJob(payload);
                results.push({ step: 'saveJob', jobName: getString(payload, 'JobName'), response });
                if (response.Code !== 1)
                    return textResult(JSON.stringify({ ok: false, failedAt: 'saveJob', job: payload, response, results }, null, 2), true);
            }
            const validation = await client.validateLowCodeSystem(manifest);
            await audit(client, 'microi_generate_system:finish', getString(manifest, 'name', 'Name') || 'manifest', { results, validation });
            return textResult(JSON.stringify({ ok: validation.Code === 1, results, validation: validation.Data }, null, 2), validation.Code !== 1);
        }
        catch (error) {
            return textResult(`Error: ${error instanceof Error ? error.message : String(error)}\n\n${JSON.stringify({ results }, null, 2)}`, true);
        }
    });
    server.tool('microi_list_roles', `List roles for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Roles', await client.listRoles(keyword)));
    server.tool('microi_save_role', `Create or update a role for OsClient ${osClient}.`, { role: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ role, confirmExecution }) => {
        const payload = rolePayload(role);
        const name = getString(payload, 'Name');
        if (confirmExecution !== name && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_save_role', name, payload);
        return apiText('Save Role', await client.saveRole(payload));
    });
    server.tool('microi_list_modules', `List menu modules for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Modules', await client.listModules(keyword)));
    server.tool('microi_get_module', `Get one menu module by ModuleId for OsClient ${osClient}.`, { moduleId: z.string() }, async ({ moduleId }) => apiText('Module Detail', await client.getModule(moduleId)));
    server.tool('microi_update_module', `Incrementally update an existing menu module, including button/tab JSON. OsClient ${osClient}.`, { module: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ module, confirmExecution }) => {
        const normalized = normalizeAllMenuJson(module);
        if (normalized.errors.length)
            return textResult(JSON.stringify(normalized, null, 2), true);
        const target = getString(module, 'moduleId', 'ModuleId', 'Id') || getString(module, 'name', 'Name');
        if (confirmExecution !== target && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${target}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_update_module', target, normalized.data);
        return apiText('Update Module', await client.updateModule(normalized.data));
    });
    server.tool('microi_upsert_engine', `Create an API engine if missing, otherwise update its code. OsClient ${osClient}.`, { engine: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ engine, confirmExecution }) => {
        const key = getString(engine, 'apiEngineKey', 'ApiEngineKey');
        if (!key)
            return textResult('ApiEngineKey 不能为空', true);
        if (confirmExecution !== key && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${key}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_upsert_engine', key, engine);
        return apiText('Upsert Engine', await upsertEngine(client, engine));
    });
    server.tool('microi_list_data_sources', `List data source engines for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Data Sources', await client.listDataSources(keyword)));
    server.tool('microi_save_data_source', `Create or update sys_datasource for SQL/V8/JSON data source engines. OsClient ${osClient}.`, { dataSource: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ dataSource, confirmExecution }) => {
        const payload = dataSourcePayload(dataSource);
        const key = getString(payload, 'DataSourceKey');
        if (confirmExecution !== key && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${key}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_save_data_source', key, payload);
        return apiText('Save Data Source', await client.saveDataSource(payload));
    });
    server.tool('microi_run_data_source', `Run a sys_datasource engine for validation. May have side effects if the data source V8 writes data. OsClient ${osClient}.`, { dataSourceKey: z.string(), params: jsonRecordSchema.optional(), confirmExecution: z.string().optional() }, async ({ dataSourceKey, params, confirmExecution }) => {
        if (confirmExecution !== dataSourceKey && confirmExecution !== 'EXECUTE')
            return textResult(`执行已拦截：请传 confirmExecution="${dataSourceKey}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_run_data_source', dataSourceKey, params || {});
        return apiText('Run Data Source', await client.runDataSource(dataSourceKey, params));
    });
    server.tool('microi_list_print_templates', `List print engine templates for OsClient ${osClient}.`, { keyword: z.string().optional() }, async ({ keyword }) => apiText('Print Templates', await client.listPrintTemplates(keyword)));
    server.tool('microi_save_print_template', `Create or update a mic_print print template. OsClient ${osClient}.`, { template: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ template, confirmExecution }) => {
        const payload = printTemplatePayload(template);
        const title = getString(payload, 'Title');
        if (confirmExecution !== title && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${title}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_save_print_template', title, payload);
        return apiText('Save Print Template', await client.savePrintTemplate(payload));
    });
    server.tool('microi_save_workflow_package', `Create or update wf_flowdesign + wf_node + wf_line as one workflow package. OsClient ${osClient}.`, { workflow: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ workflow, confirmExecution }) => {
        const name = getString(asRecord(workflow.FlowDesign ?? workflow.flowDesign ?? workflow), 'FlowName', 'flowName', 'name');
        if (confirmExecution !== name && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_save_workflow_package', name, workflow);
        return apiText('Save Workflow Package', await client.saveWorkflowPackage(workflow));
    });
    server.tool('microi_save_job', `Create or update a scheduled job. For ApiEngine jobs use JobType="1" and ApiEngineKey. OsClient ${osClient}.`, { job: jsonRecordSchema, confirmExecution: z.string().optional() }, async ({ job, confirmExecution }) => {
        const payload = jobPayload(job);
        const name = getString(payload, 'JobName');
        if (confirmExecution !== name && confirmExecution !== 'EXECUTE')
            return textResult(`写入已拦截：请传 confirmExecution="${name}" 或 "EXECUTE"。`, true);
        await audit(client, 'microi_save_job', name, payload);
        return apiText('Save Job', await client.saveJob(payload));
    });
}
//# sourceMappingURL=advanced-tools.js.map