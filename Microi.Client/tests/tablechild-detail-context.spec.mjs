import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { parse as parseVue } from '@vue/compiler-sfc';
import { parse as parseJs } from '@babel/parser';

// 回放真实组件方法，避免只检查字段名而漏掉重复调用、切换记录和失败重试。
const sourceRoot = process.env.MICROI_TABLECHILD_BASELINE;
const fullSource = fs.readFileSync(sourceRoot
    ? `${sourceRoot}/diy-form-full.before.vue`
    : new URL('../src/views/form-engine/diy-form-full.vue', import.meta.url), 'utf8');
const dialogSource = fs.readFileSync(sourceRoot
    ? `${sourceRoot}/diy-form-full-dialog.before.js`
    : new URL('../src/views/form-engine/mixins/diy-form-full-dialog.mixin.js', import.meta.url), 'utf8');

function methodsOf(source) {
    const script = source.includes('<script>') ? parseVue(source).descriptor.script.content : source;
    const ast = parseJs(script, { sourceType: 'module' });
    const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
    const methods = component.properties.find(node => node.key?.name === 'methods').value;
    return Object.fromEntries(methods.properties.filter(node => node.type === 'ObjectMethod').map(node => {
        const text = script.slice(node.start, node.end);
        const method = new Function('normalizeFormOpenMode', 'formTrace', `return ({${text}})[${JSON.stringify(node.key.name)}];`)(
            (mode, rowId) => mode || (rowId ? 'View' : 'Add'), () => {});
        return [node.key.name, method];
    }));
}

const full = methodsOf(fullSource);
const dialog = methodsOf(dialogSource);
const tick = () => new Promise(resolve => setImmediate(resolve));
const clone = value => JSON.parse(JSON.stringify(value));
function context() {
    const requests = [], tips = [], handled = [];
    const ctx = {
        ...full, ...dialog, TableId: 'child-table', TableName: 'Child', TableRowId: 'child-row',
        SysMenuId: 'child-menu', SysMenuModel: {}, FormMode: 'View', CurrentRowModel: {},
        CurrentDiyTableModel: { Id: 'child-table', EnableDataLog: 1, EnableDataComment: 0, EnableDataVersion: 0 },
        TableChildAuth: { ParentTableId: 'parent-table', ParentSysMenuId: 'parent-menu', ParentRowId: 'parent-row', ParentFieldId: 'child-field', ParentValue: 'parent-row', ParentFormMode: 'View', Parent: null },
        DiyCommon: {
            GetApiBase: () => 'https://example.test', GetOsClient: () => 'tenant-a',
            IsNull: value => value == null || value === '' || (typeof value === 'object' && Object.keys(value).length === 0),
            Result: result => { if (result?.Code === 1) return true; tips.push(result?.Msg); return false; },
            Tips: message => tips.push(message), ForConvertSysMenu: () => {},
            PostAsync: (url, payload) => new Promise((resolve, reject) => requests.push({ url, payload: clone(payload), resolve, reject })),
            Post: (url, payload, callback, errorCallback) => requests.push({ url, payload: clone(payload), callback, errorCallback })
        },
        $emit: () => {}, $nextTick: callback => callback ? Promise.resolve().then(callback) : Promise.resolve(),
        $webosWindow: null, DefaultValues: {}, RecordNavigatorContext: {},
        HandlerBtnsAsync: async (buttons, row) => handled.push({ buttons, row }),
        OpenDetailHandler: async () => {}, ResetFormRelatedData: () => {},
        LoadFormRelatedCounts: () => {}, _clearFieldFormInitTimer: () => {}
    };
    return { ctx, requests, tips, handled };
}
const success = name => ({ Code: 1, Data: { Id: 'child-menu', Name: name, FormBtns: [] } });

test('menu lookup forwards the complete nested TableChild delegation', async () => {
    const { ctx, requests } = context();
    ctx.TableChildAuth.Parent = { ParentRowId: 'grandparent-row', ParentFieldId: 'parent-field' };
    const pending = ctx.EnsureSysMenuModel();
    assert.deepEqual(requests[0].payload._TableChildAuth, ctx.TableChildAuth);
    requests[0].resolve(success('child')); await pending;
});

test('concurrent menu readers share one request and one permission notification', async () => {
    const { ctx, requests, tips } = context();
    const one = ctx.EnsureSysMenuModel(), two = ctx.EnsureSysMenuModel();
    assert.equal(requests.length, 1);
    requests[0].resolve({ Code: 0, Msg: 'denied' });
    await Promise.all([one, two]); assert.deepEqual(tips, ['denied']);
});

test('Init failure followed by form callback does not automatically request or notify twice; explicit retry still works', async () => {
    const { ctx, requests, tips, handled } = context();
    ctx.Init({ TableId: 'child-table', TableName: 'Child', SysMenuId: 'child-menu', Id: 'child-row', FormMode: 'View', TableChildAuth: ctx.TableChildAuth });
    await tick(); requests[0].resolve({ Code: 0, Msg: 'denied' }); await tick();
    await ctx.CallbackSetFormData({ Id: 'child-row' }); await tick();
    assert.equal(requests.length, 1); assert.deepEqual(tips, ['denied']); assert.equal(handled.length, 0);
    const retry = ctx.EnsureSysMenuModel();
    assert.equal(requests.length, 2); requests[1].resolve(success('retried')); await retry;
    assert.equal(ctx.SysMenuModel.Name, 'retried');
});

test('menu cache is scoped to the parent delegation even when hidden menu Id stays the same', async () => {
    const { ctx, requests } = context();
    const first = ctx.EnsureSysMenuModel(); requests[0].resolve(success('first')); await first;
    ctx.TableChildAuth = { ...ctx.TableChildAuth, ParentRowId: 'other-parent' };
    const second = ctx.EnsureSysMenuModel(); assert.equal(requests.length, 2);
    assert.equal(ctx.SysMenuModel.Name, undefined, 'old context must stop supplying buttons during reauthorization');
    requests[1].resolve(success('second')); await second; assert.equal(ctx.SysMenuModel.Name, 'second');
});

test('an old menu response cannot overwrite or notify after another parent context becomes current', async () => {
    const { ctx, requests, tips } = context();
    const old = ctx.EnsureSysMenuModel();
    ctx.TableChildAuth = { ...ctx.TableChildAuth, ParentRowId: 'other-parent' };
    const current = ctx.EnsureSysMenuModel(); requests[1].resolve(success('current')); await current;
    requests[0].resolve({ Code: 0, Msg: 'stale denial' }); await old;
    assert.equal(ctx.SysMenuModel.Name, 'current'); assert.deepEqual(tips, []);
});

test('nested ancestor changes invalidate menu authorization without flattening Parent', async () => {
    const { ctx, requests } = context();
    ctx.TableChildAuth.Parent = { ParentRowId: 'ancestor-a' };
    const first = ctx.EnsureSysMenuModel(); requests[0].resolve(success('first')); await first;
    ctx.TableChildAuth.Parent.ParentRowId = 'ancestor-b';
    const second = ctx.EnsureSysMenuModel(); assert.equal(requests.length, 2);
    requests[1].resolve(success('second')); await second;
});

test('record switching retries a failed menu lookup and does not reuse stale failure state', async () => {
    const { ctx, requests } = context();
    const first = ctx.EnsureSysMenuModel(); requests[0].resolve({ Code: 0, Msg: 'temporary' }); await first;
    ctx.TableRowId = 'other-child-row';
    const next = ctx.CallbackSetFormData({ Id: 'other-child-row' }); await tick();
    assert.equal(requests.length, 2); requests[1].resolve(success('switched')); await next;
});

test('closed and destroyed form instances discard pending menu responses', async () => {
    for (const close of [ctx => ctx._cancelFieldFormOpen(), ctx => { ctx._isDestroyed = true; }]) {
        const { ctx, requests, tips } = context();
        const pending = ctx.EnsureSysMenuModel(); close(ctx);
        requests[0].resolve({ Code: 0, Msg: 'stale denial' }); await pending;
        assert.deepEqual(tips, []); assert.equal(ctx.SysMenuModel.Name, undefined);
    }
});

test('reopening the same record performs fresh authorization instead of keeping an old success forever', async () => {
    const { ctx, requests } = context();
    const first = ctx.EnsureSysMenuModel(); requests[0].resolve(success('first')); await first;
    ctx.Init({ TableId: 'child-table', SysMenuId: 'child-menu', Id: 'child-row', FormMode: 'View', TableChildAuth: ctx.TableChildAuth });
    await tick(); assert.equal(requests.length, 2); requests[1].resolve(success('reopened')); await tick();
    assert.equal(ctx.SysMenuModel.Name, 'reopened');
});

test('ordinary top-level menu lookup keeps the standard payload without invented child authorization', async () => {
    const { ctx, requests } = context(); ctx.TableChildAuth = null;
    const pending = ctx.EnsureSysMenuModel(); assert.equal(requests[0].payload._TableChildAuth, undefined);
    requests[0].resolve(success('ordinary')); await pending;
});

test('menu transport failure settles once and leaves a working retry path', async () => {
    const { ctx, requests, tips } = context();
    const first = ctx.EnsureSysMenuModel(), duplicate = ctx.EnsureSysMenuModel();
    requests[0].reject(new Error('network')); await Promise.all([first, duplicate]);
    assert.equal(tips.length, 1);
    const retry = ctx.EnsureSysMenuModel(); assert.equal(requests.length, 2);
    requests[1].resolve(success('recovered')); await retry;
});

test('Counts is skipped when logs, comments and versions are all disabled', () => {
    for (const disabled of [false, 0, '0', null, undefined]) {
        const { ctx, requests } = context();
        ctx.CurrentDiyTableModel = { EnableDataLog: disabled, EnableDataComment: disabled, EnableDataVersion: disabled };
        dialog.LoadFormRelatedCounts.call(ctx);
        assert.equal(requests.length, 0); assert.deepEqual(clone(ctx.FormRelatedCounts), { DataLog: 0, DataComment: 0, DataVersion: 0 });
    }
});

test('each enabled related-data feature still requests Counts', () => {
    for (const enabled of ['EnableDataLog', 'EnableDataComment', 'EnableDataVersion']) {
        const { ctx, requests } = context();
        ctx.CurrentDiyTableModel = { EnableDataLog: 0, EnableDataComment: 0, EnableDataVersion: 0, [enabled]: '1' };
        dialog.LoadFormRelatedCounts.call(ctx); assert.equal(requests.length, 1); assert.equal(requests[0].payload.RelatedType, 'Counts');
    }
});

test('related reads forward current nested delegation and cannot be redirected by extra request fields', () => {
    const { ctx, requests } = context();
    ctx.TableChildAuth.Parent = { ParentRowId: 'ancestor' };
    ctx.GetFormRelatedData('DataVersion', () => {}, { VersionId: 'version-a', _TableChildAuth: { ParentRowId: 'forged' }, ParentTableRowId: 'forged' });
    assert.deepEqual(requests[0].payload._TableChildAuth, ctx.TableChildAuth);
    assert.equal(requests[0].payload.ParentTableRowId, 'child-row'); assert.equal(requests[0].payload.VersionId, 'version-a');
});

test('same-context duplicate related requests share transport and settle every caller', () => {
    const { ctx, requests } = context(), replies = [];
    ctx.GetFormRelatedData('Counts', result => replies.push(result));
    ctx.GetFormRelatedData('Counts', result => replies.push(result));
    assert.equal(requests.length, 1); requests[0].callback({ Code: 1, Data: { DataLog: 1 } });
    assert.equal(replies.length, 2); assert.equal(replies[0].Data.DataLog, 1);
});

test('related-data business and transport failures are not permanently cached', () => {
    for (const fail of [request => request.callback({ Code: 0, Msg: 'denied' }), request => request.errorCallback(new Error('network'))]) {
        const { ctx, requests } = context(), replies = [];
        ctx.GetFormRelatedData('Counts', result => replies.push(result)); fail(requests[0]);
        ctx.GetFormRelatedData('Counts', result => replies.push(result)); assert.equal(requests.length, 2);
        requests[1].callback({ Code: 1, Data: {} }); assert.equal(replies.length, 2);
    }
});

test('related response from a different parent or record never exposes stale data', () => {
    for (const change of [ctx => { ctx.TableRowId = 'other-row'; }, ctx => { ctx.TableChildAuth.ParentRowId = 'other-parent'; }, ctx => ctx._cancelFieldFormOpen()]) {
        const { ctx, requests } = context(), replies = [];
        ctx.GetFormRelatedData('DataVersion', result => replies.push(result)); change(ctx);
        requests[0].callback({ Code: 1, Data: [{ Data: 'private old data' }] });
        assert.equal(replies.length, 1); assert.equal(replies[0].Code, 0); assert.equal(replies[0].Data, undefined);
    }
});

test('different versions, record generations and authorization contexts do not coalesce', () => {
    const { ctx, requests } = context();
    ctx.GetFormRelatedData('DataVersion', () => {}, { VersionId: 'version-a' });
    ctx.GetFormRelatedData('DataVersion', () => {}, { VersionId: 'version-b' });
    ctx.FormRelatedGeneration = 1; ctx.GetFormRelatedData('DataVersion', () => {}, { VersionId: 'version-a' });
    ctx.TableChildAuth.ParentRowId = 'other-parent'; ctx.GetFormRelatedData('DataVersion', () => {}, { VersionId: 'version-a' });
    assert.equal(requests.length, 4);
});

test('closing during Init menu await cannot reopen the old detail', async () => {
    const { ctx, requests } = context(); let opens = 0;
    ctx.OpenDetail = () => opens++;
    ctx.Init({ TableId: 'child-table', SysMenuId: 'child-menu', Id: 'child-row', FormMode: 'View', TableChildAuth: ctx.TableChildAuth });
    await tick(); ctx._cancelFieldFormOpen(); requests[0].resolve(success('closed')); await tick();
    assert.equal(opens, 0);
});

test('related Counts follows the real DiyForm order: record callback first, table metadata callback second', async () => {
    const { ctx, requests } = context();
    ctx.CurrentDiyTableModel = {};
    ctx.LoadFormRelatedCounts = dialog.LoadFormRelatedCounts;
    ctx.OpenDetail({ Id: 'child-row' }, 'View'); await tick();
    assert.equal(requests.length, 0, 'an opening shell has no authoritative feature switches yet');
    const pending = ctx.CallbackSetFormData({ Id: 'child-row' });
    assert.equal(requests.length, 1); assert.match(requests[0].url, /GetSysMenuModel$/);
    ctx.CallbackSetDiyTableModel({ Id: 'child-table', EnableDataComment: 1 });
    assert.equal(requests[1].payload.RelatedType, 'Counts');
    requests[1].callback({ Code: 1, Data: { DataComment: 4 } });
    requests[0].resolve(success('loaded')); await pending;
    assert.equal(ctx.FormRelatedCounts.DataComment, 4);
});

test('a stale form-data callback continuation cannot compute buttons against a switched record', async () => {
    const { ctx, requests, handled } = context();
    const old = ctx.CallbackSetFormData({ Id: 'child-row' });
    ctx.TableRowId = 'other-child-row';
    const current = ctx.CallbackSetFormData({ Id: 'other-child-row' });
    requests[1].resolve(success('current')); await current;
    requests[0].resolve(success('old')); await old;
    assert.deepEqual(handled.map(item => item.row.Id), ['other-child-row']);
});

test('direct Page reinitialization keeps one menu request across the record callback', async () => {
    const { ctx, requests } = context();
    ctx.$route = { params: { TableId: 'child-table', TableRowId: 'next-row' }, query: { FormMode: 'View', SysMenuId: 'child-menu' } };
    ctx.ParseRouteDefaultValues = () => ({});
    ctx.reinitPageForm(); await tick(); assert.equal(requests.length, 1);
    requests[0].resolve(success('page')); await tick();
    await ctx.CallbackSetFormData({ Id: 'next-row' });
    assert.equal(requests.length, 1); assert.equal(ctx.TableRowId, 'next-row');
});

test('a late data callback from the previous child record cannot replace the switched form', async () => {
    const { ctx, requests, handled } = context();
    ctx.TableRowId = 'new-row'; ctx.CurrentRowModel = { Id: 'new-row', Name: 'keep' };
    await ctx.CallbackSetFormData({ Id: 'old-row', Name: 'stale' });
    assert.equal(ctx.CurrentRowModel.Name, 'keep'); assert.equal(requests.length, 0); assert.equal(handled.length, 0);
});
