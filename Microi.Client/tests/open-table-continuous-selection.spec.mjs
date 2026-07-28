import assert from 'node:assert/strict';
import test from 'node:test';
import selectionMixin from '../src/views/form-engine/mixins/diy-table-selection.mixin.js';

const methods = selectionMixin.methods;

function createSelectionContext(overrides = {}) {
    const context = {
        PropsTableType: 'OpenTable',
        EnableMultipleSelect: true,
        TableEnableBatch: true,
        SysMenuModel: { BatchSelectMoreBtns: [] },
        TableMultipleSelection: [],
        DiyTableRowList: [],
        cardSelection: [],
        ContinuousSelection: false,
        _selectionSyncing: false,
        $nextTick() {},
        $emit() {}
    };
    Object.assign(context, overrides);
    Object.keys(methods).forEach((name) => {
        context[name] = methods[name].bind(context);
    });
    return context;
}

test('OpenTable multi-select shows continuous selection without batch action buttons', () => {
    const context = createSelectionContext({
        TableMultipleSelection: [{ Id: 'row-1' }]
    });

    assert.equal(context.CanShowContinuousSelection(), true);
});

test('continuous selection keeps off-page rows when current results change', () => {
    const context = createSelectionContext({
        ContinuousSelection: true,
        DiyTableRowList: [{ Id: 'row-1' }, { Id: 'row-2' }],
        TableMultipleSelection: [{ Id: 'row-1' }, { Id: 'row-old-page' }]
    });

    context.TableRowSelectionChange([{ Id: 'row-2' }]);

    assert.deepEqual(
        context.TableMultipleSelection.map((row) => row.Id),
        ['row-old-page', 'row-2']
    );
});

test('page changes do not clear OpenTable selection when continuous selection is enabled', () => {
    let clearCount = 0;
    let loadCount = 0;
    const context = createSelectionContext({
        ContinuousSelection: true,
        TableMultipleSelection: [{ Id: 'row-1' }],
        ClearAllTableSelection() {
            clearCount += 1;
        },
        GetDiyTableRow() {
            loadCount += 1;
        }
    });
    context.$nextTick = () => {};

    context.DiyTableRowCurrentChange(2);

    assert.equal(clearCount, 0);
    assert.equal(loadCount, 1);
    assert.deepEqual(context.TableMultipleSelection, [{ Id: 'row-1' }]);
});
