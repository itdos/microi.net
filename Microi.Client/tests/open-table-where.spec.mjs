import assert from 'node:assert/strict';
import test from 'node:test';
import {
    arrayWhereToLegacy,
    buildSearchWhere,
    cloneWhereList,
    composeTableWhere,
    whereListHasField
} from '../src/views/form-engine/utils/diy-table-where.js';
import { scheduleTableInit } from '../src/views/form-engine/utils/diy-table-init.js';

test('OpenTable fixed where remains after advanced column filters', () => {
    const fixedWhere = [
        { Name: 'KehuBM', Value: 'B0077', Type: '=' },
        { Name: 'FBusinessType', Value: '寄售', Type: '=' }
    ];
    const advancedWhere = [
        Object.assign(['(', 'FBillNo', 'Like', 'O26071600541'], { IsColMenuFilter: true }),
        Object.assign(['OR', 'FBillNo', 'Like', 'O26071600540', ')'], { IsColMenuFilter: true })
    ];

    const result = composeTableWhere([], advancedWhere, fixedWhere);

    assert.deepEqual(result.slice(-2), fixedWhere);
    assert.equal(result[0].IsColMenuFilter, true);
    assert.equal(result[1].IsColMenuFilter, true);
    assert.deepEqual(result.slice(0, 2), [
        {
            GroupStart: true,
            Name: 'FBillNo',
            Type: 'Like',
            Value: 'O26071600541',
            IsColMenuFilter: true
        },
        {
            AndOr: 'OR',
            Name: 'FBillNo',
            Type: 'Like',
            Value: 'O26071600540',
            GroupEnd: true,
            IsColMenuFilter: true
        }
    ]);
});

test('OpenTable fixed where cannot be overwritten by a same-field runtime filter', () => {
    const runtimeWhere = [{ Name: 'KehuBM', Value: 'OTHER', Type: '=' }];
    const fixedWhere = [{ Name: 'KehuBM', Value: 'B0077', Type: '=' }];

    const result = composeTableWhere([], runtimeWhere, fixedWhere);

    assert.deepEqual(result, [
        { Name: 'KehuBM', Value: 'OTHER', Type: '=' },
        { Name: 'KehuBM', Value: 'B0077', Type: '=' }
    ]);
});

test('where composition clones fixed and advanced conditions', () => {
    const advanced = [Object.assign(['FBillNo', 'Like', 'O26'], { IsColMenuFilter: true })];
    const fixed = [{ Name: 'KehuBM', Value: 'B0077', Type: '=' }];
    const result = composeTableWhere([], advanced, fixed);

    result[0].Value = 'changed';
    result[0].IsColMenuFilter = false;
    result[1].Value = 'changed';

    assert.deepEqual(cloneWhereList(advanced)[0].slice(), ['FBillNo', 'Like', 'O26']);
    assert.equal(advanced[0].IsColMenuFilter, true);
    assert.equal(fixed[0].Value, 'B0077');
});

test('new where groups convert to legacy AND/OR parentheses without changing semantics', () => {
    assert.deepEqual(
        arrayWhereToLegacy(['AND', '(', 'Age', '>', 18]),
        { AndOr: 'AND', GroupStart: true, Name: 'Age', Type: '>', Value: 18 }
    );
    assert.deepEqual(
        arrayWhereToLegacy(['OR', 'Status', '=', 'active', ')']),
        { AndOr: 'OR', Name: 'Status', Type: '=', Value: 'active', GroupEnd: true }
    );
});

test('empty tree relation and empty checkbox do not create filters', () => {
    assert.deepEqual(
        buildSearchWhere({ ProjectId: '' }, { ApprovalStatus: [], ExecutionStatus: [] }),
        []
    );
});

test('exact and checkbox searches are represented only as _Where conditions', () => {
    assert.deepEqual(
        buildSearchWhere(
            { ProjectId: '01M09M3QBV88TCHXQEGC274566', Enabled: false, Count: 0 },
            { ApprovalStatus: ['Draft', 'Approved'], Empty: [] }
        ),
        [
            { Name: 'ProjectId', Value: '01M09M3QBV88TCHXQEGC274566', Type: '=' },
            { Name: 'Enabled', Value: false, Type: '=' },
            { Name: 'Count', Value: 0, Type: '=' },
            { Name: 'ApprovalStatus', Value: ['Draft', 'Approved'], Type: 'In' }
        ]
    );
});

test('an explicit relation in _Where suppresses the redundant exact relation filter', () => {
    assert.equal(whereListHasField([{ Name: 'ProjectId', Value: 'P1', Type: '=' }], 'ProjectId'), true);
    assert.equal(whereListHasField([['DeptIds', 'Like', 'D1']], 'DeptIds'), true);
    assert.equal(whereListHasField([], 'ProjectId'), false);
});

test('same-tick table prop changes coalesce into one initialization', async () => {
    let initCount = 0;
    const pendingTicks = [];
    const context = {
        ParentFormLoadFinish: null,
        Init() {
            initCount += 1;
        },
        $nextTick(callback) {
            const promise = Promise.resolve().then(callback);
            pendingTicks.push(promise);
            return promise;
        }
    };

    scheduleTableInit(context, []);
    scheduleTableInit(context, []);
    await Promise.all(pendingTicks);

    assert.equal(initCount, 1);
});
