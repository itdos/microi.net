import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

export async function prepareRichTextFixture(request, { apiBase, osClient, account, password, bindApiBase = false }) {
    apiBase = String(apiBase).replace(/\/+$/u, '');
    const apiUrl = new URL(apiBase);
    if (!['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname) || !['http:', 'https:'].includes(apiUrl.protocol) || apiUrl.username || apiUrl.password || apiUrl.search || apiUrl.hash) throw new Error('Rich-text fixtures require the explicitly configured local test API.');
    if (process.env.MICROI_TEST_ALLOW_WRITES !== 'YES') throw new Error('Rich-text fixture requires explicit MICROI_TEST_ALLOW_WRITES=YES.');
    const config = process.env.PW_RICHTEXT_FIXTURE_CONFIG;
    const python = process.env.MICROI_GATE_TEST_MYSQL_NATIVE_PYTHON;
    if (!config || !python) throw new Error('Rich-text fixture requires its owned database configuration and native Python client.');
    const native = (action, fixture) => {
        const result = spawnSync(python, ['-X', 'utf8', '-B', fileURLToPath(new URL('./richtext-fixture.py', import.meta.url))], {
            input: JSON.stringify({ config, osClient, action, fixture }), encoding: 'utf8', timeout: 30000, windowsHide: true
        });
        if (result.status !== 0) throw new Error(`Rich-text fixture ${action} failed: ${result.stdout?.trim() || 'native-client-failed'}`);
        return JSON.parse(result.stdout);
    };
    native('verify');
    const nonce = randomUUID().replaceAll('-', '').slice(0, 16);
    const did = `E2E:richtext:${nonce}`;
    const fixture = { nonce, owner: `microi-richtext-e2e:${nonce}`, tableId: randomUUID(), tableName: `mci_e2e_richtext_${nonce}`, menuId: randomUUID(), recordId: randomUUID(), route: `/mci-richtext-${nonce}`, recordTitle: `富文本回读验收-${nonce}`, uploads: [] };
    const evidence = path.join(path.dirname(config), `richtext-${nonce}.json`);
    const record = (state, extra = {}) => {
        const events = fs.existsSync(evidence) ? JSON.parse(fs.readFileSync(evidence, 'utf8')).events || [] : [];
        events.push({ state, at: new Date().toISOString(), ...extra });
        fs.writeFileSync(evidence, JSON.stringify({ state, owner: fixture.owner, nonce, tableId: fixture.tableId, tableName: fixture.tableName, menuId: fixture.menuId, recordId: fixture.recordId, route: fixture.route, events, ...extra }, null, 2) + '\n');
    };
    record('Preparing');
    let token;
    const call = async (action, data, form = /\/(?:AddDiyTable|UptDiyTable|DelDiyTable|UptDiyField|DelDiyField)$/u.test(action)) => {
        const response = await request.post(`${apiBase}/api/${action}`, {
            headers: { authorization: `Bearer ${token}`, OsClient: osClient, did },
            ...(form ? { form: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value && typeof value === 'object' ? JSON.stringify(value) : String(value)])) } : { data }), ignoreHTTPSErrors: true
        });
        const result = await response.json();
        if (!response.ok() || Number(result.Code) !== 1) {
            record('ApiFailure', { action, httpStatus: response.status(), code: result.Code, message: String(result.Msg || '') });
            throw new Error(`Rich-text fixture ${action} failed (HTTP ${response.status()}, Code ${result.Code}).`);
        }
        return result.Data;
    };
    fixture.call = call;
    const authenticate = async () => {
        const response = await request.post(`${apiBase}/api/SysUser/Login`, { headers: { OsClient: osClient, did }, data: { Account: account, Pwd: password, OsClient: osClient, Did: did, _AutomationTestLogin: true }, ignoreHTTPSErrors: true });
        const login = await response.json();
        if (Number(login.Code) !== 1) throw new Error('Rich-text fixture real credential login failed.');
        token = String(response.headers().authorization || login.Data?.Token || login.Token || login.DataAppend?.Token || '').replace(/^Bearer\s+/i, '');
        if (!token) throw new Error('Rich-text fixture login did not return a token.');
    };
    fixture.cleanup = async () => {
        const failures = [];
        if (fixture.tableCreated || fixture.apiBaseBinding) {
            try { await authenticate(); } catch (error) { failures.push(error); }
        }
        for (const filePath of fixture.uploads) {
            try { await call('HDFS/DeleteObject', { FilePathName: filePath, Limit: true }); } catch (error) { failures.push(error); }
        }
        // API logical deletes invalidate runtime caches before the owner-checked physical cleanup.
        try { if (fixture.menuCreated) await call('FormEngine/DelFormData', { FormEngineKey: 'sys_menu', Id: fixture.menuId }); } catch (error) { failures.push(error); }
        try { if (fixture.tableCreated) await call('FormEngine/DelDiyTable', { Id: fixture.tableId }, true); } catch (error) { failures.push(error); }
        if (fixture.apiBaseBinding) {
            try {
                const binding = fixture.apiBaseBinding;
                const current = await call('FormEngine/GetFormData', { FormEngineKey: 'sys_config', Id: binding.id, _SelectFields: ['Id', 'ApiBase'] });
                if (current.ApiBase !== apiBase && current.ApiBase !== binding.original) throw new Error('Rich-text fixture ApiBase changed concurrently; refusing to overwrite it.');
                if (current.ApiBase === apiBase) await call('FormEngine/UptFormData', { FormEngineKey: 'sys_config', Id: binding.id, _FormData: { ApiBase: binding.original } });
                const restored = await call('FormEngine/GetFormData', { FormEngineKey: 'sys_config', Id: binding.id, _SelectFields: ['Id', 'ApiBase'] });
                if (restored.ApiBase !== binding.original) throw new Error('Rich-text fixture ApiBase restoration readback differs.');
                record('ApiBaseRestored', { configId: binding.id });
                fixture.apiBaseBinding = null;
            } catch (error) { failures.push(error); }
        }
        try { fixture.cleanupReceipt = native('cleanup', fixture); record(failures.length ? 'CleanupFailed' : 'Cleaned', { cleanup: fixture.cleanupReceipt }); } catch (error) { failures.push(error); record('CleanupFailed'); }
        if (failures.length) throw new AggregateError(failures, 'Rich-text fixture cleanup failed.');
    };
    try {
        await authenticate();
        if (bindApiBase) {
            const configs = await call('FormEngine/GetTableData', { FormEngineKey: 'sys_config', _PageSize: 2, _SelectFields: ['Id', 'ApiBase'] });
            if (!Array.isArray(configs) || configs.length !== 1 || !configs[0].Id) throw new Error('Rich-text fixture requires exactly one existing system configuration.');
            fixture.apiBaseBinding = { id: configs[0].Id, original: configs[0].ApiBase ?? null };
            record('ApiBaseBindingSaved', { configId: fixture.apiBaseBinding.id, originalApiBase: fixture.apiBaseBinding.original });
            await call('FormEngine/UptFormData', { FormEngineKey: 'sys_config', Id: fixture.apiBaseBinding.id, _FormData: { ApiBase: apiBase } });
            const bound = await call('FormEngine/GetFormData', { FormEngineKey: 'sys_config', Id: fixture.apiBaseBinding.id, _SelectFields: ['Id', 'ApiBase'] });
            if (bound.ApiBase !== apiBase) throw new Error('Rich-text fixture ApiBase binding readback differs.');
        }
        await call('FormEngine/AddDiyTable', { Id: fixture.tableId, Name: fixture.tableName, Description: fixture.owner }, true);
        fixture.tableCreated = true;
        const fields = [];
        const selectFields = [];
        fixture.fields = fields;
        for (const field of [
            { Name: 'Biaoti', Label: '标题', Component: 'Text', Type: 'varchar(200)', Sort: 1 },
            { Name: 'Neirong', Label: '富文本', Component: 'RichText', Type: 'longtext', Sort: 2, FormWidth: 24, Config: { RichText: { Limit: true, Image: { MaxSize: 20, Preview: true, CompressMaxSize: 500 }, Video: { MaxSize: 200 }, File: { MaxSize: 100 } } } }
        ]) {
            const value = await call('FormEngine/AddDiyFieldFromBody', { ...field, TableId: fixture.tableId, Visible: 1, AppVisible: 1, NameConfirm: 1 });
            fields.push(value?.Id || value?.Data?.Id);
            selectFields.push({ Id: value?.Id || value?.Data?.Id, Name: field.Name, Label: field.Label, TableId: fixture.tableId });
        }
        await call('FormEngine/AddFormData', { FormEngineKey: fixture.tableName, Id: fixture.recordId, _FormData: { Biaoti: fixture.recordTitle, Neirong: '<p>owned rich-text fixture</p>' } });
        await call('FormEngine/AddFormData', { FormEngineKey: 'sys_menu', Id: fixture.menuId, _FormData: { Name: fixture.recordTitle, Description: fixture.owner, Url: fixture.route, DiyTableId: fixture.tableId, DiyTableName: fixture.tableName, Display: 1, AppDisplay: 1, OpenType: 'Diy', ComponentName: `RichtextFixture${nonce}`, ComponentPath: '/views/diy/diy-table', TableDiyFieldIds: JSON.stringify(fields.filter(Boolean)), SelectFields: JSON.stringify(selectFields), SearchFieldIds: JSON.stringify(fields.slice(0, 1).filter(Boolean)), NotShowFields: JSON.stringify(['Id', 'CreateTime', 'UpdateTime', 'UserId', 'UserName', 'IsDeleted']), Sort: 9999 } });
        fixture.menuCreated = true;
        const menu = await call('FormEngine/GetFormData', { FormEngineKey: 'sys_menu', Id: fixture.menuId });
        if (menu.Description !== fixture.owner || menu.DiyTableId !== fixture.tableId) throw new Error('Rich-text menu readback differs from this fixture.');
        const saved = await call('FormEngine/GetFormData', { FormEngineKey: fixture.tableName, Id: fixture.recordId });
        if (saved.Biaoti !== fixture.recordTitle) throw new Error('Rich-text record readback differs from this fixture.');
        record('Prepared');
        return fixture;
    } catch (error) {
        try { await fixture.cleanup(); } catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Rich-text fixture setup and cleanup failed.'); }
        throw error;
    }
}
