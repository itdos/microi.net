import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from '@vue/compiler-sfc';
import { parse as parseScript } from '@babel/parser';
import { withRequestTenant } from '../src/utils/request-tenant-context.js';

const source = await readFile(new URL('../src/views/form-engine/diy-components/DiyImportDialog.vue', import.meta.url), 'utf8');
const script = parse(source).descriptor.script.content;
const component = parseScript(script, { sourceType: 'module' }).program.body.find(n => n.type === 'ExportDefaultDeclaration').declaration;
function harness() {
    const timers = new Map();
    let nextTimer = 0, requests = 0, progressCalls = 0;
    const emitted = [];
    const globals = { URL, withRequestTenant, setTimeout: fn => { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout: id => timers.delete(id) };
    globals.window = globals;
    const context = vm.createContext(globals);
    const blocks = Object.fromEntries(['computed', 'methods'].map(key => {
        const ast = component.properties.find(n => n.key.name === key).value;
        return [key, vm.runInContext(`(${script.slice(ast.start, ast.end)})`, context)];
    }));
    const state = {
        ...blocks.methods, visible: true, sysMenuModel: {}, dialogOptions: {}, selectedFile: { name: 'inventory.xlsx', size: 67810, uid: 1 },
        uploadFiles: [], activeUploadUid: null, uploadPending: false, canStartImport: true,
        importIdempotencyKey: 'same-operation', isCustomImport: false, submitting: false,
        legacyImportRunning: false, legacyProgressGeneration: 0, customSuccessEmitted: false,
        $nextTick: async () => {}, $t: value => value, $emit: (...args) => emitted.push(args),
        DiyApi: { GetImportDiyTableRowStep: '/progress' },
        DiyCommon: { GetApiBase: () => 'https://api.example.test/v2', GetOsClient: () => 'fixture',
            RepalceUrlKey: v => v.replace('$ApiBase$', 'https://api.example.test/v2'), NewGuid: () => `upload-${++nextTimer}`,
            Result: r => Number(r?.Code) === 1, Tips() {}, IsNull: v => v == null },
        getImportProgress: () => progressCalls++,
        stopBackgroundTaskPolling() {},
    };
    state.uploadFiles = [{ name: state.selectedFile.name, raw: state.selectedFile, uid: 1, status: 'ready' }];
    state.$refs = { workbookUpload: { abort() {}, submit() { requests += state.uploadFiles.filter(f => f.status === 'ready').length; state.uploadFiles.forEach(f => { f.status = 'uploading'; }); } } };
    return { state, computed: blocks.computed, timers, emitted, get requests() { return requests; }, get progressCalls() { return progressCalls; } };
}

test('relative replacement import routes use the API base including its path prefix', () => {
    const h = harness();
    for (const route of ['/apiengine/import', 'apiengine/import']) {
        h.state.sysMenuModel.ImportApi = route;
        assert.equal(h.computed.importApi.call(h.state), 'https://api.example.test/v2/apiengine/import');
    }
    h.state.sysMenuModel.ImportApi = '$ApiBase$/apiengine/import';
    assert.equal(h.computed.importApi.call(h.state), 'https://api.example.test/v2/apiengine/import');
    h.state.sysMenuModel.ImportApi = 'https://custom.example.test/import';
    assert.equal(h.computed.importApi.call(h.state), 'https://custom.example.test/import');
});

test('synchronous replacement success completes immediately without querying unrelated standard progress', () => {
    const h = harness();
    h.state.sysMenuModel.ImportApi = '/apiengine/import';
    h.state.handleUploadSuccess({ Code: 1, Msg: '完成', Data: { InputCount: 2665, UpdatedCount: 2665 } });
    assert.equal(h.state.uploadSucceeded, true);
    assert.equal(h.state.legacyImportRunning, false);
    assert.equal(h.progressCalls, 0);
    assert.equal(h.emitted.length, 1);
});

test('standard imports and replacements with a progress contract continue polling', () => {
    for (const menu of [{}, { ImportApi: '/apiengine/import', ImportProgressApi: '/apiengine/progress' }]) {
        const h = harness(); h.state.sysMenuModel = menu;
        h.state.handleUploadSuccess({ Code: 1, Data: { Status: 'Pending' } });
        assert.equal(h.state.legacyImportRunning, true);
        assert.equal(h.progressCalls, 1);
        assert.equal(h.emitted.length, 0);
    }
});

test('retry after transport or business failure actually requeues the retained file and preserves its operation key', async () => {
    const h = harness();
    await h.state.startImport();
    assert.equal(h.requests, 1);
    h.state.uploadFiles = []; // Element Plus removes a transport-failed file.
    h.state.handleUploadError({ status: 405, message: '<html><h1>405 Not Allowed</h1></html>' });
    await h.state.startImport();
    assert.equal(h.requests, 2);
    h.state.uploadFiles[0].status = 'success'; // HTTP 200 / Code=0 also cannot be resubmitted as-is.
    h.state.handleUploadSuccess({ Code: 0, Msg: '业务校验失败' });
    await h.state.startImport();
    assert.equal(h.requests, 3);
    assert.equal(h.state.importIdempotencyKey, 'same-operation');
});

test('nginx errors show an actionable status instead of raw HTML and never claim success', () => {
    const h = harness();
    h.state.handleUploadError({ status: 405, message: '<html><head><title>405 Not Allowed</title></head><body>nginx/1.13.3</body></html>' });
    assert.equal(h.state.customError, 'Msg.ImportMethodNotAllowed');
    assert.doesNotMatch(h.state.customError, /<html>|<body>/);
    assert.equal(h.emitted.length, 0);
});

test('slow pending uploads cannot be duplicated when the UI watchdog expires', async () => {
    const h = harness();
    await h.state.startImport();
    for (const fn of [...h.timers.values()]) fn();
    await h.state.startImport();
    assert.equal(h.requests, 1);
    assert.equal(h.state.customError, 'Msg.ImportStillProcessing');
});

test('upload headers keep explicit tenant routing and do not add a tenant to external services', () => {
    const h = harness();
    h.state.authHeader = 'Bearer fixture-session'; h.state.uploadData = {};
    for (const [url, tenant] of [['https://api.example.test/v2/apiengine/import', 'fixture'], ['https://api.example.test/v2/apiengine/import?OsClient=child', 'child'], ['https://files.example.test/upload', undefined]]) {
        h.state.importApi = url;
        const headers = h.computed.uploadHeaders.call(h.state);
        assert.equal(headers.osclient, tenant);
        assert.equal(headers.authorization, 'Bearer fixture-session');
    }
});

test('callbacks from an old file or closed dialog cannot complete another import', async () => {
    const h = harness(); h.state.sysMenuModel.ImportApi = '/apiengine/import';
    await h.state.startImport();
    const uid = h.state.activeUploadUid;
    h.state.handleUploadSuccess({ Code: 1 }, { uid: 'old-upload' });
    assert.equal(h.state.uploadPending, true);
    h.state.handleUploadError({ status: 405 }, { uid: 'old-upload' });
    assert.equal(h.state.uploadPending, true);
    h.state.visible = false;
    h.state.handleUploadSuccess({ Code: 1 }, { uid });
    assert.equal(h.emitted.length, 0);
    h.state.visible = true;
    h.state.handleUploadSuccess({ Code: 1 }, { uid });
    assert.equal(h.emitted.length, 1);
    assert.equal(h.state.uploadPending, false);
});
