import { decodeLegacyFieldSource } from './field-source-codec.js';
// 页面级选中值补全：只改变显示选项，不写表单值，不遍历数据源所有分页。
const components = new Set(['Select', 'MultipleSelect', 'Radio', 'Checkbox', 'Autocomplete']);
const empty = v => v === null || v === undefined || v === '';
const parse = v => {
    if (typeof v !== 'string' || !/^[\[{]/.test(v.trim())) return v;
    try { return JSON.parse(v); } catch { return v; }
};
const prop = (o, key) => o && typeof o === 'object' ? o[key] ?? o[Object.keys(o).find(k => k.toLowerCase() === key.toLowerCase())] : o;
export function selectedOptionKeys(value, config = {}) {
    const key = config.SelectSaveField || config.SelectLabel || 'Id';
    const parsed = parse(value);
    return [...new Set((Array.isArray(parsed) ? parsed.flat(Infinity) : [parsed])
        .map(v => prop(v, key)).filter(v => !empty(v) && ['string', 'number', 'boolean'].includes(typeof v))
        .map(String))];
}

export function mergeResolvedOptions(field, candidates) {
    const key = field.Config?.SelectSaveField || field.Config?.SelectLabel || 'Id';
    const lookup = new Map((field._SelectedOptionLabels || []).map(o => [String(prop(o, key)), o]));
    const seen = new Set();
    const result = (Array.isArray(candidates) ? candidates : []).map(o => {
        const id = String(prop(o, key));
        seen.add(id);
        // 已有树节点保留子节点；服务端只返回键和标签。
        return lookup.has(id) ? { ...(typeof o === 'object' ? o : {}), ...lookup.get(id) } : o;
    });
    for (const [id, option] of lookup) if (!seen.has(id)) result.push(option);
    return result;
}

/** identity 仅内存比较，包含租户、用户/会话；不写日志或持久缓存。request 返回 DosResult。 */
export function createSelectedOptionHydrator({ request, identity, sqlUrl, engineUrl, dataSourceUrl, now = Date.now }) {
    const states = new WeakMap();
    let running = 0;
    const queue = [];
    const schedule = fn => new Promise(resolve => {
        queue.push(async () => { try { resolve(await fn()); } catch { resolve(null); } });
        pump();
    });
    function pump() {
        while (running < 2 && queue.length) {
            running++;
            queue.shift()().finally(() => { running--; pump(); });
        }
    }
    return async function hydrate(fields, records, context = {}) {
        const rows = Array.isArray(records) ? records : records ? [records] : [];
        const currentIdentity = identity();
        const sqlTasks = [];
        const jobs = [];
        for (const field of fields || []) {
            const cfg = field?.Config || {};
            if (!components.has(field?.Component) || !field.Id || !cfg.SelectLabel || !cfg.SelectSaveField
                || cfg.SelectSaveField === cfg.SelectLabel
                || ['Data', 'KeyValue'].includes(cfg.DataSource)) continue;
            const names = context.selectedFieldNames?.[field.Id] || [field.AsName || field.Name];
            const readSelected = () => [...new Set(rows.flatMap(row => names.flatMap(name => selectedOptionKeys(row[name], cfg))))];
            const selected = readSelected();
            const source = cfg.DataSource === 'Sql' ? decodeLegacyFieldSource(cfg.Sql || '') : '';
            const formDependencies = [...new Set([...source.matchAll(/\$V8\.Form\.([\w\u0080-\uffff]+)\$/g)].map(match => match[1]))];
            const queryContext = () => [context.menuId, context.tableChildAuth,
                cfg.DataSource === 'Sql'
                    ? formDependencies.map(name => context.formData?.[name]) : context.formData];
            const capturedContext = JSON.stringify(queryContext());
            // Loading 等 UI 状态不属于查询键，不能因搜索框刷新触发重复补查。
            const fingerprint = JSON.stringify([selected, cfg.DataSource, cfg.Sql, cfg.Api, cfg.DataSourceId,
                cfg.DataSourceApiEngineKey, cfg.SelectSaveField, cfg.SelectLabel, cfg.SelectedValueLookup, capturedContext]);
            const previous = states.get(field);
            if (previous?.identity === currentIdentity && previous.fingerprint === fingerprint && now() - previous.time < 30000) {
                if (previous.promise) jobs.push(previous.promise);
                continue;
            }
            const state = { identity: currentIdentity, fingerprint, time: now() };
            states.set(field, state);
            if (previous?.identity !== undefined && previous.identity !== currentIdentity) field.Data = [];
            const previousIds = new Set((field._SelectedOptionLabels || []).map(o => String(prop(o, cfg.SelectSaveField || cfg.SelectLabel))));
            if (previousIds.size) field.Data = (Array.isArray(field.Data) ? field.Data : []).filter(o => !previousIds.has(String(prop(o, cfg.SelectSaveField || cfg.SelectLabel))));
            field._SelectedOptionLabels = [];
            const key = cfg.SelectSaveField || cfg.SelectLabel;
            const existing = new Set((Array.isArray(field.Data) ? field.Data : [])
                .filter(o => !empty(prop(o, cfg.SelectLabel)) && String(prop(o, cfg.SelectLabel)) !== String(prop(o, key)))
                .map(o => String(prop(o, key))));
            const values = selected.filter(v => !existing.has(v));
            if (!values.length) continue;
            if (values.length > 200) { field._SelectedOptionsStatus = 'limit'; continue; }
            const isSql = cfg.DataSource === 'Sql';
            // 任意 V8/外部接口不能被推断为按 Id 查询；显式声明契约后才请求。
            if (!isSql && cfg.SelectedValueLookup !== true) { field._SelectedOptionsStatus = 'unsupported'; continue; }
            // 行依赖 SQL 不能用列表的第一行冒充其它行上下文。
            if (isSql && !context.formData && /\$V8\.Form\./.test(source)) {
                field._SelectedOptionsStatus = 'context-required'; continue;
            }
            const apply = result => {
                if (states.get(field) !== state || identity() !== currentIdentity) return;
                // 用户在请求期间改选或更换联动条件时，仅丢弃显示结果，不能复活旧选项。
                const currentSelected = readSelected();
                if (JSON.stringify(currentSelected) !== JSON.stringify(selected) || JSON.stringify(queryContext()) !== capturedContext) return;
                if (result?.Code !== 1 || result?.DataAppend?.SelectedValuesResolved !== true || !Array.isArray(result.Data)) {
                    field._SelectedOptionsStatus = 'unresolved'; return;
                }
                const requested = new Set(values);
                const labels = new Map();
                for (const option of result.Data.slice(0, 201)) {
                    const id = String(prop(option, key));
                    const label = prop(option, cfg.SelectLabel);
                    if (requested.has(id) && labels.has(id)) { field._SelectedOptionsStatus = 'ambiguous'; return; }
                    if (requested.has(id) && !empty(label)) labels.set(id, { [key]: prop(option, key), [cfg.SelectLabel]: label });
                }
                field._SelectedOptionLabels = [...labels.values()];
                field.Data = mergeResolvedOptions(field, field.Data);
                field._SelectedOptionsStatus = labels.size === values.length ? 'resolved' : 'partial';
            };
            if (isSql) sqlTasks.push({ field, values, apply, state });
            else {
                const url = cfg.DataSource === 'ApiEngine' ? engineUrl(cfg.DataSourceApiEngineKey)
                    : cfg.DataSource === 'DataSource' ? dataSourceUrl : cfg.DataSource === 'Api' ? cfg.Api : '';
                if (!url) continue;
                const promise = schedule(() => states.get(field) !== state || identity() !== currentIdentity ? null : request(url, {
                    _ResolveSelectedValues: true, _SelectedValues: values, _FieldId: field.Id,
                    _FormData: context.formData || null, _TableChildAuth: context.tableChildAuth || null,
                    _SysMenuId: context.menuId || '',
                    ...(cfg.DataSource === 'DataSource' ? { DataSourceKey: cfg.DataSourceId } : {}),
                    ...(cfg.DataSource === 'ApiEngine' ? { ApiEngineKey: cfg.DataSourceApiEngineKey } : {})
                })).then(apply);
                state.promise = promise;
                jobs.push(promise);
            }
        }
        // 同页多列合为有界批次；每列只执行一次 IN 查询，而非每行/每个 Id 请求。
        while (sqlTasks.length) {
            const batch = [];
            let count = 0;
            while (sqlTasks.length && batch.length < 20 && count + sqlTasks[0].values.length <= 500) {
                const task = sqlTasks.shift(); batch.push(task); count += task.values.length;
            }
            const promise = schedule(() => identity() !== currentIdentity || batch.every(t => states.get(t.field) !== t.state) ? null : request(sqlUrl, {
                FieldIds: batch.map(t => t.field.Id),
                _SelectedValues: Object.fromEntries(batch.map(t => [t.field.Id, t.values])),
                _FormData: context.formData || null, _TableChildAuth: context.tableChildAuth || null,
                _SysMenuId: context.menuId || ''
            })).then(result => {
                for (const task of batch) task.apply(result?.Code === 1 ? result.Data?.find(r => r.FieldId === task.field.Id)?.Result : null);
            });
            for (const task of batch) task.state.promise = promise;
            jobs.push(promise);
        }
        await Promise.all(jobs);
    };
}
