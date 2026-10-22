import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { parse } from '@vue/compiler-sfc';

const base = new URL('../src/views/form-engine/', import.meta.url);
function load(file) {
    let source = fs.readFileSync(new URL(file, base), 'utf8');
    if (file.endsWith('.vue')) source = parse(source).descriptor.script.content;
    const sandbox = {};
    vm.runInNewContext(source.replace(/^import[^\n]+\n/gm, '').replace('export default', 'globalThis.subject ='), sandbox);
    return sandbox.subject;
}
const dialog = load('mixins/diy-form-full-dialog.mixin.js').methods;
const data = load('mixins/diy-form-full-data.mixin.js').methods;
const panel = load('form-right-panel.vue').methods;

function fixture(mode = 'Add') {
    const requests = [], ticks = [], events = [];
    let completeSave;
    const c = {
        ...dialog, ...data,
        FormMode: mode, TableId: 'order-table', TableName: 'Orders', TableRowId: 'temporary-id', SysMenuId: 'order-menu',
        CurrentDiyTableModel: { Id: 'order-table', EnableDataLog: 1, EnableDataComment: 1, EnableDataVersion: 1 },
        GetCurrentUser: { RoleIds: [] }, FormRelatedCounts: { DataLog: 0, DataComment: 0, DataVersion: 0 },
        DataLogList: [], DataCommentList: [], DataVersionList: [],
        _DataLogLoadToken: 0, _DataCommentLoadToken: 0, _DataVersionLoadToken: 0,
        BtnLoading: false, ShowFieldForm: true,
        DiyApi: { AddDiyTableRow: '/add', UptDiyTableRow: '/update' },
        DiyCommon: {
            IsNull: value => value === null || value === undefined || value === '',
            Post: (url, param, callback) => requests.push({ url, param, callback }),
            GetServerPath: value => value
        },
        $nextTick: callback => ticks.push(callback),
        $emit: (...args) => events.push(args),
        DeleteCurrentDraftAfterSave: async () => {},
        Go_1: () => events.push(['back']),
        $refs: {
            fieldForm: {
                FormSubmit: (param, callback) => { completeSave = { param, callback }; },
                RefreshAllChildTable: () => {}
            }
        }
    };
    c.$refs.fieldFormPage = c.$refs.fieldForm;
    return {
        c, requests, events,
        flush: () => { while (ticks.length) ticks.shift()(); },
        saveResult: async (success, { mode = 'Edit', id = 'saved-id' } = {}) => {
            if (success) Object.assign(completeSave.param, { FormMode: mode, TableRowId: id, SaveLoading: false });
            await completeSave.callback(success, { Id: id });
        }
    };
}

for (const mode of ['Add', 'Insert']) {
    test(`${mode}: initial tab, manual refresh and counts do not read the temporary record`, () => {
        const f = fixture(mode);
        for (const [type, method] of [['DataLog', 'LoadDataLog'], ['DataComment', 'LoadDataComment'], ['DataVersion', 'LoadDataVersion']]) {
            panel.RefreshActiveTabData.call({
                formMode: mode, dataLogList: [], dataCommentList: [], dataVersionList: [],
                $emit: () => f.c[method]()
            }, type);
            f.c[method]();
        }
        f.c.LoadFormRelatedCounts();
        assert.equal(f.requests.length, 0);
        for (const type of ['DataLog', 'DataComment', 'DataVersion']) {
            assert.equal(f.c[`${type}ListLoading`], false);
            assert.equal(f.c.FormRelatedCounts[type], 0);
        }
    });

    test(`${mode}: direct related/history reads finish their callback without HTTP`, () => {
        const f = fixture(mode);
        let replies = 0;
        for (const type of ['Counts', 'DataLog', 'DataComment', 'DataVersion']) {
            f.c.GetFormRelatedData(type, result => {
                replies++;
                assert.equal(result._SkippedFormRelatedData, true);
            }, { LogId: 'old-log', VersionId: 'old-version' });
        }
        assert.equal(replies, 4);
        assert.equal(f.requests.length, 0);
    });

    test(`${mode}: save failure keeps related reads paused; successful retry refreshes all four types`, async () => {
        const f = fixture(mode);
        await f.c.SaveDiyTableCommon(false);
        await f.saveResult(false);
        f.flush();
        f.c.LoadDataLog();
        assert.equal(f.requests.length, 0);
        await f.c.SaveDiyTableCommon(false);
        await f.saveResult(true);
        f.flush();
        assert.deepEqual(f.requests.map(r => r.param.RelatedType).sort(), ['Counts', 'DataComment', 'DataLog', 'DataVersion']);
        for (const r of f.requests) {
            assert.equal(r.param.ParentTableRowId, 'saved-id');
            assert.equal(r.param.ParentFormEngineKey, 'order-table');
            assert.equal(r.param._SysMenuId, 'order-menu');
        }
    });
}

test('save and continue adding does not query the next unsaved record', async () => {
    const f = fixture();
    await f.c.SaveDiyTableCommon({ SavedType: 'Add' });
    await f.saveResult(true, { mode: 'Add', id: 'next-temporary-id' });
    f.flush();
    assert.equal(f.c.FormMode, 'Add');
    assert.equal(f.requests.length, 0);
});

test('page save uses the persisted record id and refreshes after success', async () => {
    const f = fixture();
    f.c.SaveDiyTableCommonPage(false);
    await f.saveResult(false);
    f.flush();
    assert.equal(f.requests.length, 0);
    f.c.SaveDiyTableCommonPage(false);
    await f.saveResult(true);
    f.flush();
    assert.equal(f.c.TableRowId, 'saved-id');
    assert.deepEqual(f.requests.map(r => r.param.RelatedType).sort(), ['Counts', 'DataComment', 'DataLog', 'DataVersion']);
    assert.ok(f.requests.every(r => r.param.ParentTableRowId === 'saved-id'));
});

test('save and view refreshes the saved record while features disabled skip all reads', async () => {
    for (const enabled of [true, false]) {
        const f = fixture();
        if (!enabled) Object.assign(f.c.CurrentDiyTableModel, { EnableDataLog: 0, EnableDataComment: 0, EnableDataVersion: 0 });
        await f.c.SaveDiyTableCommon({ SavedType: 'View' });
        await f.saveResult(true, { mode: 'View' });
        f.flush();
        assert.equal(f.c.FormMode, 'View');
        assert.equal(f.requests.length, enabled ? 4 : 0);
    }
});

test('save and close/back does not query a closed form', async () => {
    for (const page of [false, true]) {
        const f = fixture();
        if (page) f.c.SaveDiyTableCommonPage(true);
        else await f.c.SaveDiyTableCommon(true);
        await f.saveResult(true);
        f.flush();
        assert.equal(f.requests.length, 0);
    }
});

test('saved records keep the authorization context and permission failures visible to the caller', () => {
    const f = fixture('Edit');
    f.c.TableChildAuth = { ParentRowId: 'authorized-parent' };
    let result;
    f.c.GetFormRelatedData('DataVersion', value => { result = value; }, { VersionId: 'version-a' });
    const request = f.requests[0];
    assert.deepEqual(request.param._TableChildAuth, f.c.TableChildAuth);
    assert.equal(request.param._SysMenuId, 'order-menu');
    request.callback({ Code: 0, Msg: 'No permission' });
    assert.equal(result.Code, 0);
    assert.equal(result.Msg, 'No permission');
});

test('a missing record id never reaches the related endpoint', () => {
    const f = fixture('View');
    f.c.TableRowId = '';
    f.c.GetFormRelatedData('Counts', () => {});
    assert.equal(f.requests.length, 0);
});

test('queued post-save refresh cannot read a switched or closed form', async () => {
    for (const change of [c => { c.TableRowId = 'other-record'; }, c => { c._isDestroyed = true; }, c => { c.FormRelatedGeneration = 1; }]) {
        const f = fixture();
        await f.c.SaveDiyTableCommon(false);
        await f.saveResult(true);
        change(f.c);
        f.flush();
        assert.equal(f.requests.length, 0);
    }
});
