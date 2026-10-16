import { registerAdvancedTools } from './advanced-tools.js';

export const engineManifest = { name: '业务局部修改', engines: [{ apiEngineKey: 'biz-check', code: 'return { Code: 1, Data: "准确结果" };' }] };
export const toolJson = (result: any) => JSON.parse(result.content[0].text);

export function harness(options: { identity?: string; legacy?: boolean; failedValidation?: boolean; failWrite?: boolean; unknownWrite?: boolean; missingBanner?: boolean; switchIdentityAt?: string } = {}) {
  const handlers = new Map<string, (input: any) => Promise<any>>();
  const calls: Array<{ method: string; value: any }> = [];
  const tables: any[] = [];
  const fields: any[] = [];
  const state = { identity: options.identity ?? 'identity:api:tenant:user:token' };
  const success = (method: string, value: any, data: any = {}) => {
    calls.push({ method, value });
    if (options.switchIdentityAt === method) state.identity = 'changed-identity';
    return { Code: 1, Msg: 'ok', Data: data };
  };
  const client: any = {
    ...(!options.legacy ? { getContextIdentity: () => state.identity } : {}),
    writeAuditLog: async () => ({ Code: 1 }),
    getEngineCode: async (key: string) => success('getEngineCode', key, { ApiEngineKey: key }),
    saveEngineCode: async (key: string, code: string) => {
      calls.push({ method: 'saveEngineCode', value: { key, code } });
      if (options.unknownWrite) throw new Error('transport timeout; write may have completed');
      if (options.failWrite) return { Code: 0, Msg: '权限拒绝', Data: { Errors: ['deny'], RemoteVersion: 'newer' } };
      return { Code: 1, Msg: 'saved', Data: { Id: 'e1', ApiEngineKey: key, ApiV8Code: code, Version: 4, Skipped: false, OtherBusinessState: 'retained' } };
    },
    createTable: async (name: string, description: string, config: any) => {
      const row = { Id: `table:${name}`, Name: name, Description: description, ...config };
      tables.push(row);
      return success('createTable', row, row);
    },
    addField: async (field: any) => {
      const saved = { ...field, Id: `field:${field.TableId}:${field.Name}` };
      fields.push(saved);
      return success('addField', saved, saved);
    },
    createTableIndex: async (value: any) => success('createTableIndex', value, value),
    updateTable: async (value: any) => {
      Object.assign(tables.find(row => row.Id === value.Id), value);
      return success('updateTable', value, value);
    },
    getDbSchema: async () => success('getDbSchema', {}, { Tables: tables.map(table => ({ ...table, _Fields: fields.filter(field => field.TableId === table.Id) })) }),
    getMicroService: async (key: string) => success('getMicroService', key, { Service: { Id: `service:${key}`, MsKey: key }, Pages: [{ Id: `page:${key}:overview`, RoutePath: '/overview' }] }),
    saveRole: async (value: any) => success('saveRole', value, { ...value, Id: `role:${value.Name}` }),
    createModule: async (value: any) => success('createModule', value, { ...value, Id: `module:${value.Name}` }),
    setRolePermission: async (roleId: string, menuIds: string[]) => success('setRolePermission', { roleId, menuIds }),
    saveDataSource: async (value: any) => success('saveDataSource', value, value),
    saveEventCode: async (formEngineKey: string, eventType: string, code: string) => success('saveEventCode', { formEngineKey, eventType, code }),
    savePageEngine: async (value: any) => success('savePageEngine', value, { ...value, Id: 'page:overview' }),
    savePrintTemplate: async (value: any) => success('savePrintTemplate', value, { ...value, Id: 'print:order' }),
    saveWorkflowPackage: async (value: any) => success('saveWorkflowPackage', value, { FlowDesignId: 'flow:order' }),
    saveJob: async (value: any) => success('saveJob', value, { ...value, Id: 'job:daily' }),
    validateLowCodeSystem: async (manifest: any) => success('validateLowCodeSystem', manifest, { Passed: !options.failedValidation, Errors: options.failedValidation ? ['真实验收不通过'] : [], Warnings: ['验收警告须保留'] }),
    getTableData: async (name: string, query: any) => success('getTableData', { name, query }, options.missingBanner ? tables.map(({ Id, Name }) => ({ Id, Name })) : tables),
  };
  registerAdvancedTools({ tool(name: string, ...args: any[]) { handlers.set(name, args.at(-1)); } } as any, client, { osClient: 'tenant' } as any);
  const call = (name: string, input: any) => handlers.get(name)!(input);
  return { call, calls, state, tables, fields };
}

export const completeManifest = {
  name: '完整业务系统',
  roles: [{ name: '业务角色' }],
  tables: [
    { name: 'Biz_Order', fields: [
      { name: 'Name', label: '单据名称', component: 'Text', type: 'varchar(100)' },
      { name: 'Items', label: '明细', component: 'TableChild', relation: { cardinality: '1:N', targetTable: 'Biz_Item', childForeignKey: 'OrderId', childModule: '明细载体' } },
    ] },
    { name: 'Biz_Item', fields: [
      { name: 'OrderId', label: '单据Id', component: 'Text', type: 'varchar(100)' },
      { name: 'Name', label: '商品名称', component: 'Text', type: 'varchar(100)' },
    ], indexes: [{ name: 'idx_order', columns: ['OrderId'] }] },
  ],
  modules: [
    { name: '业务管理', openType: 'SecondMenu' },
    { name: '订单', table: 'Biz_Order', parentName: '业务管理', listFields: ['Name'] },
    { name: '明细载体', table: 'Biz_Item', display: 0, appDisplay: 0, hasChild: 0 },
  ],
  engines: engineManifest.engines,
  events: [{ formEngineKey: 'Biz_Order', eventType: 'SubmitBeforeServerV8', code: 'return { Code: 1 };' }],
  dataSources: [{ dataSourceKey: 'biz-options', sourceType: 'JSON', json: '[{"Key":"Open","Value":"待处理"}]' }],
  permissions: [{ roleName: '业务角色', moduleNames: ['业务管理', '订单'] }],
  pages: [{ title: '业务看板', json: { formConfig: {}, wrapperList: [] } }],
  printTemplates: [{ title: '业务单据', PageObj: { panels: [{ index: 0, height: 297, width: 210, printElements: [] }] }, PrintObj: {} }],
  workflows: [{ FlowDesign: { FlowName: '自动流程', table: 'Biz_Order' }, Nodes: [
    { Id: 'start', NodeName: '开始', NodeType: 'Start' }, { Id: 'end', NodeName: '结束', NodeType: 'AutoEnd' },
  ], Lines: [{ FromNodeId: 'start', ToNodeId: 'end', LineName: '开始 到 结束' }] }],
  jobs: [{ jobName: '每日业务任务', apiEngineKey: 'biz-check', cron: '0 0 1 * * ?' }],
};
