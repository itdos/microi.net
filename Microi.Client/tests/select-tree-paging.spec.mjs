import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parse, compileTemplate } from '@vue/compiler-sfc';
import { isPagedSelectTree, selectTreeKeys, mergeTreePage } from '../src/views/form-engine/diy-field-component/select-tree-paging.js';
import { normalizeFormOpenMode } from '../src/views/form-engine/form-open-mode.js';

const path = new URL('../src/views/form-engine/diy-field-component/paged-select-tree.vue', import.meta.url);
const source = fs.readFileSync(path, 'utf8');
const { descriptor, errors } = parse(source);
assert.deepEqual(errors, []);
const options = new Function('markRaw', 'mergeTreePage', 'selectTreeKeys', descriptor.script.content.replace(/^import .*;$/mg, '').replace('export default', 'return'))(value => value, mergeTreePage, selectTreeKeys);
function instance() {
    const requests = [];
    const vm = {
        field: { Id: 'field', Component: 'SelectTree', Config: { DataSource: 'Sql', Sql: 'select * from categories', SelectSaveField: 'Code', SelectLabel: 'Title', SelectTree: { Lazy: true, PageSize: 50, ParentField: 'ParentCode' } } },
        formData: {}, modelValue: null, $refs: {}, $emit: (...args) => vm.events.push(args), events: [],
        DiyCommon: { Tips() {} }, $t: key => key
    };
    Object.assign(vm, options.data.call(vm));
    for (const [key, method] of Object.entries(options.methods)) vm[key] = method.bind(vm);
    for (const [key, getter] of Object.entries(options.computed)) Object.defineProperty(vm, key, { get: () => getter.call(vm) });
    vm.request = params => new Promise((resolve, reject) => requests.push({ params, resolve, reject }));
    return { vm, requests };
}
const page = (rows, more = false) => ({ Code: 1, Data: rows, DataAppend: { HasMore: more } });

test('paged tree and legacy component templates compile', () => {
    for (const file of [path, new URL('../src/views/form-engine/diy-field-component/diy-select-tree.vue', import.meta.url)]) {
        const { descriptor } = parse(fs.readFileSync(file, 'utf8'));
        assert.deepEqual(compileTemplate({ source: descriptor.template.content, filename: file.pathname, id: 'select-tree' }).errors, []);
    }
});

test('paging is opt-in and respects custom callbacks and data source types', () => {
    const { vm } = instance();
    assert.equal(isPagedSelectTree(vm.field), true);
    vm.field.Config.SelectTree.PageSize = 0;
    assert.equal(isPagedSelectTree(vm.field), false);
    vm.field.Config.SelectTree.PageSize = 50;
    vm.field.Config.SelectTree.LazyLoad = () => {};
    assert.equal(isPagedSelectTree(vm.field), false);
    delete vm.field.Config.SelectTree.LazyLoad;
    vm.field.Config.DataSource = 'Data';
    assert.equal(isPagedSelectTree(vm.field), false);
});

test('root pages replace rows and a late previous page cannot overwrite the latest page', async () => {
    const { vm, requests } = instance();
    const first = vm.loadRoots(1), second = vm.loadRoots(2);
    requests[1].resolve(page([{ Code: 'page2', Title: 'Second' }], true));
    await second;
    requests[0].resolve(page(Array.from({ length: 50 }, (_, i) => ({ Code: `old${i}` }))));
    await first;
    assert.equal(vm.roots.length, 1);
    assert.equal(vm.roots[0].Code, 'page2');
    assert.equal(vm.pageIndex, 2);
    assert.equal(vm.busy, false);
    assert.equal(vm.rowsByKey.size, 1);
});

test('off-page selected values hydrate without changing the form or becoming roots', async () => {
    const { vm, requests } = instance();
    vm.modelValue = 'unloaded-child';
    const hydration = vm.hydrateSelection();
    assert.deepEqual(requests[0].params._SelectTreeValues, ['unloaded-child']);
    requests[0].resolve(page([{ Code: 'unloaded-child', Title: 'Selected child' }]));
    await hydration;
    assert.equal(vm.selectedRows[0].Title, 'Selected child');
    assert.equal(vm.roots.length, 0);
    assert.deepEqual(vm.events, []);
    vm.select('unloaded-child');
    assert.equal(vm.events[0][1].Title, 'Selected child');
});

test('failed expansion remains retryable and duplicate branch requests are shared', async () => {
    const { vm, requests } = instance();
    let rejected = 0, resolved;
    const node = { level: 1, data: { Code: 'parent' } };
    const first = vm.loadChildren(node, value => { resolved = value; }, () => rejected++);
    requests[0].reject(new Error('offline'));
    await first;
    assert.equal(rejected, 1);
    assert.equal(resolved, undefined);
    const retry = vm.loadChildren(node, value => { resolved = value; }, () => rejected++);
    const duplicate = vm.pageChildren('parent', 1);
    assert.equal(requests.length, 2);
    requests[1].resolve(page([{ Code: 'child', Title: 'Child' }], true));
    await Promise.all([retry, duplicate]);
    assert.equal(resolved.length, 2);
    assert.equal(resolved[1]._mciTreeMore.page, 2);
    vm.select('child');
    assert.equal(vm.events[0][1].Title, 'Child');
});

test('disposing a form ignores lookup and page results', async () => {
    const { vm, requests } = instance();
    vm.modelValue = 'X';
    const lookup = vm.hydrateSelection(), roots = vm.loadRoots(1);
    options.beforeUnmount.call(vm);
    for (const req of requests) req.resolve(page([{ Code: 'X', Title: 'late' }]));
    await Promise.all([lookup, roots]);
    assert.deepEqual(vm.selectedRows, []);
    assert.deepEqual(vm.roots, []);
});

test('storage mapping preserves string IDs, object values, numeric zero and multi selections', () => {
    assert.deepEqual(selectTreeKeys('001', 'Code'), ['001']);
    assert.deepEqual(selectTreeKeys('[{"Code":"A"},{"Code":"B"}]', 'Code'), ['A', 'B']);
    assert.deepEqual(selectTreeKeys([0, '', null, 0], 'Code'), [0]);
    assert.deepEqual(mergeTreePage([{ Code: 'A' }], [{ Code: 'A', Title: 'new' }, { Code: 'B' }], 'Code'), [{ Code: 'A', Title: 'new' }, { Code: 'B' }]);
});

test('missing form mode is resolved before allocating IDs; valid modes are preserved', () => {
    assert.equal(normalizeFormOpenMode('', ''), 'Add');
    assert.equal(normalizeFormOpenMode(undefined, 'existing'), 'Edit');
    assert.equal(normalizeFormOpenMode('Add', 'allocated-id'), 'Add');
    assert.equal(normalizeFormOpenMode('View', 'existing'), 'View');
    assert.equal(normalizeFormOpenMode('Insert', 'allocated-id'), 'Insert');
});
