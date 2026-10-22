import test from 'node:test';
import assert from 'node:assert/strict';
import { createSelectedOptionHydrator, mergeResolvedOptions, selectedOptionKeys } from '../src/utils/selected-option-hydration.js';
import { getFormFieldDisplayValue } from '../src/views/form-engine/field-display-value.js';

const field = (id = 'owner', source = 'Sql') => ({ Id: id, Name: id, Component: 'MultipleSelect', Data: [], Config: { DataSource: source, SelectSaveField: 'Id', SelectLabel: 'Name', Sql: 'select Id,Name from users limit 20' } });
const ok = data => ({ Code: 1, Data: data, DataAppend: { SelectedValuesResolved: true } });
const defaults = { identity: () => 'tenant-a/user-a/session-a', sqlUrl: '/sql', engineUrl: key => '/engine/' + key, dataSourceUrl: '/source' };
function sqlResult(body) { return { Code: 1, Data: Object.entries(body._SelectedValues).map(([FieldId, values]) => ({ FieldId, Result: ok(values.map(Id => ({ Id, Name: 'Label ' + Id }))) })) }; }

test('table page dedupes IDs and batches all fields without changing stored data', async () => {
    const fields = [field('owner'), field('reviewer')];
    const rows = Array.from({ length: 50 }, (_, i) => ({ owner: JSON.stringify(['a', 'b']), reviewer: 'c' }));
    const original = JSON.stringify(rows);
    const calls = [];
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: async (_, body) => { calls.push(body); return sqlResult(body); } });
    await hydrate(fields, rows);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]._SelectedValues, { owner: ['a', 'b'], reviewer: ['c'] });
    assert.equal(getFormFieldDisplayValue(rows[0], fields[0]), 'Label a、Label b');
    assert.equal(JSON.stringify(rows), original);
    await hydrate(fields, rows);
    assert.equal(calls.length, 1);
});

test('current form options resolve outside page and survive remote search / placeholder object', async () => {
    const f = field(); f.Data = [{ Id: 'a', Name: 'Person A' }];
    const form = { owner: ['a', { Id: 'b', Name: 'b' }] };
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: async (_, b) => {
        assert.deepEqual(b._SelectedValues.owner, ['b']); return sqlResult(b);
    } });
    await hydrate([f], form, { formData: form });
    assert.equal(getFormFieldDisplayValue(form, f), 'Person A、Label b');
    assert.deepEqual(mergeResolvedOptions(f, [{ Id: 'search', Name: 'Search' }]).map(o => o.Id), ['search', 'b']);
    assert.equal(form.owner[1].Name, 'b');
});

test('static sources make zero network calls; zero and JSON stored values remain supported', async () => {
    const f = field('owner', 'KeyValue');
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: () => assert.fail('static must not request') });
    await hydrate([f], { owner: 'x' });
    assert.deepEqual(selectedOptionKeys('[0,"",null,{"Id":"x"}]', f.Config), ['0', 'x']);
});

test('saving the display field needs no lookup; duplicate resolver keys fail closed', async () => {
    const f = field(); f.Config.SelectSaveField = '';
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: () => assert.fail('display value is already stored') });
    await hydrate([f], { owner: 'Name' });
    f.Config.SelectSaveField = 'Name';
    await hydrate([f], { owner: 'Name' });
    const ambiguous = field('owner', 'ApiEngine');
    Object.assign(ambiguous.Config, { SelectedValueLookup: true, DataSourceApiEngineKey: 'lookup' });
    const duplicate = createSelectedOptionHydrator({ ...defaults, request: async () => ok([{ Id: 'x', Name: 'One' }, { Id: 'x', Name: 'Another' }]) });
    await duplicate([ambiguous], { owner: 'x' });
    assert.deepEqual(ambiguous.Data, []);
    assert.equal(ambiguous._SelectedOptionsStatus, 'ambiguous');
});

test('unknown API is opt-in and old responses cannot pretend to resolve selections', async () => {
    for (const type of ['ApiEngine', 'DataSource', 'Api']) {
        const f = field('owner', type); Object.assign(f.Config, { Api: '/api', DataSourceApiEngineKey: 'lookup', DataSourceId: 'lookup' });
        let calls = 0;
        const hydrate = createSelectedOptionHydrator({ ...defaults, request: async (_, b) => { calls++; assert.deepEqual(b._SelectedValues, ['b']); return { Code: 1, Data: [{ Id: 'first-page', Name: 'Wrong' }] }; } });
        await hydrate([f], { owner: 'b' }); assert.equal(calls, 0);
        f.Config.SelectedValueLookup = true;
        await hydrate([f], { owner: 'b' }); assert.equal(calls, 1); assert.deepEqual(f.Data, []);
    }
});

test('late response never overwrites a new record or a different session', async () => {
    let user = 'user-a'; const pending = [];
    const hydrate = createSelectedOptionHydrator({ ...defaults, identity: () => user, request: (_, body) => new Promise(resolve => pending.push(() => resolve(sqlResult(body)))) });
    const f = field();
    const first = hydrate([f], { owner: 'old' });
    const next = hydrate([f], { owner: 'new' });
    pending[1](); await next; pending[0](); await first;
    assert.deepEqual(f.Data.map(o => o.Id), ['new']);
    const late = hydrate([f], { owner: 'other' }); user = 'user-b'; pending[2](); await late;
    assert.ok(!f.Data.some(o => o.Id === 'other'));
});

test('concurrent duplicate loads share one request; batches and parallelism have limits', async () => {
    let active = 0, peak = 0, calls = 0;
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: async (_, body) => {
        calls++; peak = Math.max(peak, ++active);
        assert.ok(body.FieldIds.length <= 20);
        assert.ok(Object.values(body._SelectedValues).flat().length <= 500);
        await new Promise(r => setTimeout(r, 3)); active--; return sqlResult(body);
    } });
    const fields = Array.from({ length: 55 }, (_, i) => field('f' + i));
    const row = Object.fromEntries(fields.map(f => [f.Name, ['a', 'b']]));
    await Promise.all([hydrate(fields, row), hydrate(fields, row)]);
    assert.equal(calls, 3); assert.equal(peak, 2);
});

test('errors, unsupported row-dependent SQL and oversized values retain IDs', async () => {
    const f = field();
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: async () => { throw Error('offline'); } });
    const form = { owner: 'unknown' }; await hydrate([f], form);
    assert.equal(getFormFieldDisplayValue(form, f), 'unknown');
    f.Config.Sql = Buffer.from("select Id,Name from t where Parent='$V8.Form.Parent$' limit 20").toString('base64');
    await hydrate([f], form); assert.equal(f._SelectedOptionsStatus, 'context-required');
    await hydrate([f], { owner: Array.from({ length: 201 }, (_, i) => String(i)) });
    assert.equal(f._SelectedOptionsStatus, 'limit');
});

test('explicit engine contract resolves only requested labels and ignores volatile loading flags', async () => {
    const f = field('owner', 'ApiEngine'); Object.assign(f.Config, { SelectedValueLookup: true, DataSourceApiEngineKey: 'lookup' });
    let calls = 0;
    const hydrate = createSelectedOptionHydrator({ ...defaults, request: async () => { calls++; return ok([{ Id: 'a', Name: 'Alice', PrivateField: 'never retained' }, { Id: 'other', Name: 'unrequested' }]); } });
    await hydrate([f], { owner: 'a' });
    f.Config.Loading = true;
    await hydrate([f], { owner: 'a' });
    assert.equal(calls, 1);
    assert.deepEqual(f._SelectedOptionLabels, [{ Id: 'a', Name: 'Alice' }]);
});

test('joined field alias and tenant changes cannot reuse labels from the previous actor', async () => {
    const f = field(); f.AsName = 'joined_owner'; let actor = 'a';
    const hydrate = createSelectedOptionHydrator({ ...defaults, identity: () => actor, request: async (_, b) => actor === 'a' ? sqlResult(b) : { Code: 0 } });
    await hydrate([f], { joined_owner: 'saved' }); assert.equal(f.Data[0].Name, 'Label saved');
    actor = 'b'; await hydrate([f], { joined_owner: 'saved' });
    assert.deepEqual(f.Data, []);
});

test('changing a selection or a SQL form dependency while fetching drops the late labels', async () => {
    for (const changed of ['owner', 'Parent']) {
        const f = field(); f.Config.Sql = "select Id,Name from t where Parent='$V8.Form.Parent$' limit 20";
        const form = { owner: 'old', Parent: 'department-a' }; let finish;
        const hydrate = createSelectedOptionHydrator({ ...defaults, request: (_, b) => new Promise(resolve => { finish = () => resolve(sqlResult(b)); }) });
        const pending = hydrate([f], form, { formData: form }); form[changed] = 'new'; finish(); await pending;
        assert.deepEqual(f.Data, []);
    }
});
