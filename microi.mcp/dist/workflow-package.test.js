import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan, registerAdvancedTools, validateWorkflowPackage, workflowPayload } from './advanced-tools.js';
const flow = {
    FlowDesign: { FlowName: '费用审批', table: 'Biz_Expense', IsEnable: 1 },
    Nodes: [
        { Id: 'start', NodeName: '发起', NodeType: 'Start' },
        { Id: 'audit', NodeName: '财务审批', NodeType: 'Approve', Roles: [{ Id: 'role-finance', Name: '财务' }] },
        { Id: 'end', NodeName: '完成', NodeType: 'AutoEnd' },
    ],
    Lines: [
        { Id: 'l1', FromNodeId: 'start', ToNodeId: 'audit' },
        { Id: 'l2', FromNodeId: 'audit', ToNodeId: 'end' },
    ],
};
test('workflow package spreads nodes, uses CSS pixels and serializes IdName bindings', () => {
    const check = validateWorkflowPackage(flow);
    assert.deepEqual(check.errors, []);
    const payload = workflowPayload(flow, new Map([['biz_expense', 'tenant-table-id']]));
    const nodes = payload.Nodes;
    assert.deepEqual(nodes.map((node) => node.PositionLeft), ['80px', '340px', '600px']);
    assert.deepEqual(nodes.map((node) => node.PositionTop), ['120px', '120px', '120px']);
    assert.equal(payload.FlowDesign.TableId, 'tenant-table-id');
    assert.deepEqual(JSON.parse(nodes[1].Roles), [{ Id: 'role-finance', Name: '财务' }]);
    assert.equal(payload.Lines[0].LineName, '发起 到 财务审批');
});
test('manual approval without an assignee strategy is rejected before remote writes', () => {
    const broken = structuredClone(flow);
    delete broken.Nodes[1].Roles;
    assert.match(validateWorkflowPackage(broken).errors.join(' '), /未绑定/);
    assert.match(buildPlan({ workflows: [broken] }).errors.join(' '), /未绑定/);
});
test('invalid binding, overlapping layout and unreachable node fail closed', () => {
    const broken = structuredClone(flow);
    broken.Nodes[1].Roles = 'Finance';
    broken.Nodes[1].PositionLeft = '0px';
    broken.Nodes[1].PositionTop = '0px';
    broken.Nodes[0].PositionLeft = '0px';
    broken.Nodes[0].PositionTop = '0px';
    broken.Nodes.push({ Id: 'orphan', NodeName: '孤立', NodeType: 'Approve', Roles: [{ Id: 'r', Name: '审核' }] });
    assert.match(validateWorkflowPackage(broken).errors.join(' '), /Roles.*数组/);
    assert.match(validateWorkflowPackage(broken).errors.join(' '), /坐标重叠/);
    assert.match(validateWorkflowPackage(broken).errors.join(' '), /不可达/);
});
test('BackNodes keeps the Id and NodeName objects expected by the approval UI', () => {
    const withBack = structuredClone(flow);
    withBack.Nodes[1].BackNodes = ['start'];
    const payload = workflowPayload(withBack, new Map([['biz_expense', 'tenant-table-id']]));
    const nodes = payload.Nodes;
    assert.deepEqual(JSON.parse(nodes[1].BackNodes), [{ Id: 'start', NodeName: '发起' }]);
});
test('WorkFlow module requires a flow and preserves the binding in a manifest', () => {
    const valid = buildPlan({ workflows: [flow], modules: [{ name: '费用申请', table: 'Biz_Expense', openType: 'WorkFlow', flowName: '费用审批' }] });
    assert.deepEqual(valid.errors, []);
    const invalid = buildPlan({ modules: [{ name: '费用申请', table: 'Biz_Expense', openType: 'WorkFlow' }] });
    assert.match(invalid.errors.join(' '), /flowName 或 flowDesignId/);
});
test('save_workflow_package sends normalized positions and binding JSON to the backend', async () => {
    const handlers = new Map();
    let sent;
    registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
        writeAuditLog: async () => ({ Code: 1 }),
        getDbSchema: async () => ({ Code: 1, Data: { Tables: [{ Name: 'Biz_Expense', Id: 'table-1' }] } }),
        getTableData: async () => ({ Code: 1, Data: [{ Id: 'role-finance' }] }),
        saveWorkflowPackage: async (payload) => { sent = payload; return { Code: 1, Data: { FlowDesignId: 'flow-1' } }; },
    }, { osClient: 'test' });
    const result = await handlers.get('microi_save_workflow_package')({ workflow: flow, confirmExecution: '费用审批' });
    assert.equal(result.isError, false, result.content[0].text);
    assert.equal((sent.Nodes[1]).PositionLeft, '340px');
    assert.equal((sent.Nodes[1]).Roles, '[{"Id":"role-finance","Name":"财务"}]');
});
test('save_workflow_package rejects stale role IDs before writing', async () => {
    const handlers = new Map();
    let writes = 0;
    registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
        getDbSchema: async () => ({ Code: 1, Data: { Tables: [{ Name: 'Biz_Expense', Id: 'table-1' }] } }),
        getTableData: async () => ({ Code: 1, Data: [] }),
        saveWorkflowPackage: async () => { writes += 1; return { Code: 1 }; },
    }, { osClient: 'test' });
    const result = await handlers.get('microi_save_workflow_package')({ workflow: flow, confirmExecution: '费用审批' });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /role-finance/);
    assert.equal(writes, 0);
});
test('generate_system links a WorkFlow module to the workflow saved in the same manifest', async () => {
    const handlers = new Map();
    const updates = [];
    registerAdvancedTools({ tool(name, ...args) { handlers.set(name, args.at(-1)); } }, {
        writeAuditLog: async () => ({ Code: 1 }),
        createModule: async () => ({ Code: 1, Data: { ModuleId: 'menu-1' } }),
        getDbSchema: async () => ({ Code: 1, Data: { Tables: [] } }),
        getTableData: async () => ({ Code: 1, Data: [{ Id: 'role-finance' }] }),
        saveWorkflowPackage: async () => ({ Code: 1, Data: { FlowDesignId: 'flow-1' } }),
        updateModule: async (module) => { updates.push(module); return { Code: 1 }; },
        validateLowCodeSystem: async () => ({ Code: 1, Data: { Passed: true, Errors: [] } }),
    }, { osClient: 'test' });
    const manifest = {
        workflows: [{ ...flow, FlowDesign: { FlowName: '费用审批', TableId: 'table-1', IsEnable: 1 } }],
        modules: [{ name: '费用申请', diyTableId: 'table-1', openType: 'WorkFlow', flowName: '费用审批' }],
    };
    const result = await handlers.get('microi_generate_system')({ manifest, dryRun: false, confirmExecution: 'test' });
    assert.equal(result.isError, false, result.content[0].text);
    assert.deepEqual(updates, [{ ModuleId: 'menu-1', OpenType: 'WorkFlow', FlowDesignId: 'flow-1' }]);
});
//# sourceMappingURL=workflow-package.test.js.map