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
  const nodes = payload.Nodes as Array<Record<string, unknown>>;
  assert.deepEqual(nodes.map((node) => node.PositionLeft), ['80px', '340px', '600px']);
  assert.deepEqual(nodes.map((node) => node.PositionTop), ['120px', '120px', '120px']);
  assert.equal((payload.FlowDesign as Record<string, unknown>).TableId, 'tenant-table-id');
  assert.deepEqual(JSON.parse(nodes[1].Roles as string), [{ Id: 'role-finance', Name: '财务' }]);
  assert.equal((payload.Lines as Array<Record<string, unknown>>)[0].LineName, '发起 到 财务审批');
});

test('manual approval without an assignee strategy is rejected before remote writes', () => {
  const broken = structuredClone(flow);
  delete (broken.Nodes[1] as Record<string, unknown>).Roles;
  assert.match(validateWorkflowPackage(broken).errors.join(' '), /未绑定/);
  assert.match(buildPlan({ workflows: [broken] }).errors.join(' '), /未绑定/);
});

// 安装母版必须能保持禁用且无租户人员；只有明确数字/字符串 0 放宽这一项绑定要求。
function unboundTemplate(isEnable: unknown = 0) {
  const template = structuredClone(flow) as Record<string, any>;
  template.FlowDesign.IsEnable = isEnable;
  delete template.Nodes[1].Roles;
  return template;
}

for (const disabled of [0, '0']) {
  test(`explicit disabled template ${JSON.stringify(disabled)} accepts empty bindings without enabling it`, () => {
    const template = unboundTemplate(disabled);
    assert.deepEqual(validateWorkflowPackage(template).errors, []);
    assert.deepEqual(buildPlan({ workflows: [template] }).errors, []);
    const payload = workflowPayload(template, new Map([['biz_expense', 'table-1']]));
    assert.equal((payload.FlowDesign as Record<string, unknown>).IsEnable, disabled);
    assert.equal((payload.Nodes as Array<Record<string, unknown>>)[1].Roles, '[]');
  });
}

test('enabled, omitted and coercible disabled values still require an approval strategy', () => {
  for (const value of [1, '1', false, null, '', '00', 'false', undefined]) {
    const template = unboundTemplate(value);
    if (value === undefined) delete template.FlowDesign.IsEnable;
    assert.match(validateWorkflowPackage(template).errors.join(' '), /未绑定/, String(value));
  }
  const lowerCase = unboundTemplate();
  delete lowerCase.FlowDesign.IsEnable;
  lowerCase.FlowDesign.isEnable = 0;
  assert.match(validateWorkflowPackage(lowerCase).errors.join(' '), /未绑定/);
});

test('disabled template still rejects invalid binding shape, node types and topology', () => {
  for (const mutate of [
    (template: Record<string, any>) => { template.Nodes[1].Roles = 'Finance'; },
    (template: Record<string, any>) => { template.Nodes[1].NodeType = 'FakeApprove'; },
    (template: Record<string, any>) => { template.Lines[1].FromNodeId = 'missing-node'; },
    (template: Record<string, any>) => { template.Lines.pop(); },
  ]) {
    const template = unboundTemplate();
    mutate(template);
    assert.equal(validateWorkflowPackage(template).ok, false);
  }
});

function workflowSaveHarness(read: (table: string, query: Record<string, any>) => Promise<any>) {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  const sent: Record<string, unknown>[] = [];
  registerAdvancedTools({ tool(name: string, ...args: any[]) { handlers.set(name, args.at(-1)); } } as any, {
    writeAuditLog: async () => ({ Code: 1 }),
    getDbSchema: async () => ({ Code: 1, Data: { Tables: [{ Name: 'Biz_Expense', Id: 'table-1' }] } }),
    getTableData: read,
    saveWorkflowPackage: async (payload: Record<string, unknown>) => { sent.push(payload); return { Code: 1 }; },
  } as any, { osClient: 'target-tenant' } as any);
  return { sent, save: (workflow: Record<string, any>) => handlers.get('microi_save_workflow_package')!({ workflow, confirmExecution: '费用审批' }) };
}

test('standard save writes a disabled empty template without looking up or inventing approvers', async () => {
  const h = workflowSaveHarness(async () => { throw new Error('Empty bindings must not invent a lookup'); });
  const result = await h.save(unboundTemplate());
  assert.equal(result.isError, false, result.content[0].text);
  assert.equal(h.sent.length, 1);
  assert.equal((h.sent[0].FlowDesign as Record<string, unknown>).IsEnable, 0);
  assert.equal((h.sent[0].Nodes as Array<Record<string, unknown>>)[1].Users, '[]');
});

// 禁用不能成为绕过当前租户引用核验的开关；每类非空绑定仍查询真实注册表。
for (const [field, table] of [['Users', 'sys_user'], ['CopyUsers', 'sys_user'], ['Roles', 'sys_role'], ['Depts', 'sys_dept'], ['BindJobs', 'diy_job']]) {
  test(`disabled template rejects unavailable or cross-tenant ${field} references before any write`, async () => {
    for (const mode of ['missing', 'revoked', 'other-tenant', 'failure']) {
      const template = unboundTemplate();
      template.Nodes[1][field] = [{ Id: 'UNBOUND_' + field, Name: '尚未配置' }];
      let reads = 0;
      const h = workflowSaveHarness(async (queried, query) => {
        reads += 1;
        assert.equal(queried, table);
        assert.deepEqual(query._Where, [['Id', 'In', ['UNBOUND_' + field]]]);
        if (mode === 'failure') return { Code: 0, Msg: '查询被撤权' };
        return { Code: 1, Data: mode === 'other-tenant' ? [{ Id: 'other-tenant-user' }] : [] };
      });
      const result = await h.save(template);
      assert.equal(result.isError, true, mode);
      assert.match(result.content[0].text, /不存在|无法核对/);
      assert.equal(reads, 1);
      assert.equal(h.sent.length, 0);
    }
  });
}

test('disabled template retains and verifies a supplied real current-tenant binding', async () => {
  const template = unboundTemplate();
  template.Nodes[1].Users = [{ Id: 'tenant-user', Name: '实际人员', Password: 'must-not-leak' }];
  const h = workflowSaveHarness(async (table, query) => {
    assert.equal(table, 'sys_user');
    assert.deepEqual(query._Where, [['Id', 'In', ['tenant-user']]]);
    return { Code: 1, Data: [{ Id: 'tenant-user' }] };
  });
  const result = await h.save(template);
  assert.equal(result.isError, false, result.content[0].text);
  assert.equal(h.sent.length, 1);
  assert.deepEqual(JSON.parse((h.sent[0].Nodes as Array<Record<string, unknown>>)[1].Users as string), [{ Id: 'tenant-user', Name: '实际人员' }]);
});

test('invalid binding, overlapping layout and unreachable node fail closed', () => {
  const broken = structuredClone(flow);
  (broken.Nodes[1] as Record<string, unknown>).Roles = 'Finance';
  (broken.Nodes[1] as Record<string, unknown>).PositionLeft = '0px';
  (broken.Nodes[1] as Record<string, unknown>).PositionTop = '0px';
  (broken.Nodes[0] as Record<string, unknown>).PositionLeft = '0px';
  (broken.Nodes[0] as Record<string, unknown>).PositionTop = '0px';
  broken.Nodes.push({ Id: 'orphan', NodeName: '孤立', NodeType: 'Approve', Roles: [{ Id: 'r', Name: '审核' }] });
  assert.match(validateWorkflowPackage(broken).errors.join(' '), /Roles.*数组/);
  assert.match(validateWorkflowPackage(broken).errors.join(' '), /坐标重叠/);
  assert.match(validateWorkflowPackage(broken).errors.join(' '), /不可达/);
});

test('BackNodes keeps the Id and NodeName objects expected by the approval UI', () => {
  const withBack = structuredClone(flow);
  (withBack.Nodes[1] as Record<string, unknown>).BackNodes = ['start'];
  const payload = workflowPayload(withBack, new Map([['biz_expense', 'tenant-table-id']]));
  const nodes = payload.Nodes as Array<Record<string, unknown>>;
  assert.deepEqual(JSON.parse(nodes[1].BackNodes as string), [{ Id: 'start', NodeName: '发起' }]);
});

test('WorkFlow module requires a flow and preserves the binding in a manifest', () => {
  const valid = buildPlan({ workflows: [flow], modules: [{ name: '费用申请', table: 'Biz_Expense', openType: 'WorkFlow', flowName: '费用审批' }] });
  assert.deepEqual(valid.errors, []);
  const invalid = buildPlan({ modules: [{ name: '费用申请', table: 'Biz_Expense', openType: 'WorkFlow' }] });
  assert.match(invalid.errors.join(' '), /flowName 或 flowDesignId/);
});

test('save_workflow_package sends normalized positions and binding JSON to the backend', async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  let sent: Record<string, unknown> | undefined;
  registerAdvancedTools({ tool(name: string, ...args: any[]) { handlers.set(name, args.at(-1)); } } as any, {
    writeAuditLog: async () => ({ Code: 1 }),
    getDbSchema: async () => ({ Code: 1, Data: { Tables: [{ Name: 'Biz_Expense', Id: 'table-1' }] } }),
    getTableData: async () => ({ Code: 1, Data: [{ Id: 'role-finance' }] }),
    saveWorkflowPackage: async (payload: Record<string, unknown>) => { sent = payload; return { Code: 1, Data: { FlowDesignId: 'flow-1' } }; },
  } as any, { osClient: 'test' } as any);
  const result = await handlers.get('microi_save_workflow_package')!({ workflow: flow, confirmExecution: '费用审批' });
  assert.equal(result.isError, false, result.content[0].text);
  assert.equal(((sent!.Nodes as Array<Record<string, unknown>>)[1]).PositionLeft, '340px');
  assert.equal(((sent!.Nodes as Array<Record<string, unknown>>)[1]).Roles, '[{"Id":"role-finance","Name":"财务"}]');
});

test('save_workflow_package rejects stale role IDs before writing', async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  let writes = 0;
  registerAdvancedTools({ tool(name: string, ...args: any[]) { handlers.set(name, args.at(-1)); } } as any, {
    getDbSchema: async () => ({ Code: 1, Data: { Tables: [{ Name: 'Biz_Expense', Id: 'table-1' }] } }),
    getTableData: async () => ({ Code: 1, Data: [] }),
    saveWorkflowPackage: async () => { writes += 1; return { Code: 1 }; },
  } as any, { osClient: 'test' } as any);
  const result = await handlers.get('microi_save_workflow_package')!({ workflow: flow, confirmExecution: '费用审批' });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /role-finance/);
  assert.equal(writes, 0);
});

test('generate_system links a WorkFlow module to the workflow saved in the same manifest', async () => {
  const handlers = new Map<string, (...args: any[]) => Promise<any>>();
  const updates: Record<string, unknown>[] = [];
  registerAdvancedTools({ tool(name: string, ...args: any[]) { handlers.set(name, args.at(-1)); } } as any, {
    writeAuditLog: async () => ({ Code: 1 }),
    createModule: async () => ({ Code: 1, Data: { ModuleId: 'menu-1' } }),
    getDbSchema: async () => ({ Code: 1, Data: { Tables: [] } }),
    getTableData: async () => ({ Code: 1, Data: [{ Id: 'role-finance' }] }),
    saveWorkflowPackage: async () => ({ Code: 1, Data: { FlowDesignId: 'flow-1' } }),
    updateModule: async (module: Record<string, unknown>) => { updates.push(module); return { Code: 1 }; },
    validateLowCodeSystem: async () => ({ Code: 1, Data: { Passed: true, Errors: [] } }),
  } as any, { osClient: 'test' } as any);
  const manifest = {
    workflows: [{ ...flow, FlowDesign: { FlowName: '费用审批', TableId: 'table-1', IsEnable: 1 } }],
    modules: [{ name: '费用申请', diyTableId: 'table-1', openType: 'WorkFlow', flowName: '费用审批' }],
  };
  const result = await handlers.get('microi_generate_system')!({ manifest, dryRun: false, confirmExecution: 'test' });
  assert.equal(result.isError, false, result.content[0].text);
  assert.deepEqual(updates, [{ ModuleId: 'menu-1', OpenType: 'WorkFlow', FlowDesignId: 'flow-1' }]);
});
