import assert from 'node:assert/strict';
import test from 'node:test';
import { workflowNodePosition } from '../src/utils/workflow-node-position.js';

test('workflow nodes render legacy unitless coordinates as pixels', () => {
    assert.deepEqual(workflowNodePosition({ PositionLeft: '160', PositionTop: 180 }), { left: '160px', top: '180px' });
    assert.deepEqual(workflowNodePosition({ PositionLeft: '210px', PositionTop: '356px' }), { left: '210px', top: '356px' });
});

test('workflow nodes without coordinates receive distinct visible positions', () => {
    assert.deepEqual(workflowNodePosition({}, 0), { left: '80px', top: '160px' });
    assert.deepEqual(workflowNodePosition({}, 1), { left: '320px', top: '160px' });
});
