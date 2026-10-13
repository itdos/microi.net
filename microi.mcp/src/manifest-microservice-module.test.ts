import assert from 'node:assert/strict';
import test from 'node:test';

import { buildMicroServiceMenuUrl, buildPlan, normalizeAllMenuJson, resolveMicroServiceModuleBinding } from './advanced-tools.js';

const portableModule = {
  name: 'AI平台治理工作台',
  parentName: 'AI平台治理',
  openType: 'MicroService',
  microServiceKey: 'ai-platform-studio',
  microServiceRoutePath: '/overview',
};

test('module field permissions preserve identity groups and tree ordering settings', () => {
  const policy = {Version:1,Enabled:true,DefaultVisible:true,DefaultEditable:false,Rules:[{Users:['user'],Roles:['role'],Departments:['dept'],Jobs:['job'],Fields:[{Name:'Salary',Visible:false,Editable:false}]}]};
  const normalized = normalizeAllMenuJson({fieldPermissions:policy,treeDragSortEnabled:true,treeDragSortField:'Sort'});
  assert.deepEqual(normalized.errors,[]);
  const storedPolicy = normalized.data.FieldPermissions;
  assert.ok(typeof storedPolicy === 'string', 'FieldPermissions must be stored as JSON text');
  assert.deepEqual(JSON.parse(storedPolicy),policy);
  assert.equal(normalized.data.TreeDragSortEnabled,1);assert.equal(normalized.data.TreeDragSortField,'Sort');
  assert.ok(normalizeAllMenuJson({fieldPermissions:'{invalid'}).errors.length);
  assert.ok(normalizeAllMenuJson({fieldPermissions:{Version:2,Enabled:true,Rules:[]}}).errors.length);
  assert.ok(normalizeAllMenuJson({fieldPermissions:{Version:1,Enabled:true,Rules:Array(201).fill({})}}).errors.length);
});

test('module manifest accepts grouped headers and independent banner switches', () => {
  const normalized = normalizeAllMenuJson({
    tableHeaders: [{ Label: '人数', Fields: ['Total', 'Male', 'Female'] }],
    hideTableBanner: true,
    hideFormBanner: false,
  });
  assert.deepEqual(normalized.errors, []);
  assert.equal(normalized.data.TableHeaders, '[{"Label":"人数","Fields":["Total","Male","Female"]}]');
  assert.equal(normalized.data.HideTableBanner, 1);
  assert.equal(normalized.data.HideFormBanner, 0);
  assert.ok(normalizeAllMenuJson({ tableHeaders: '{invalid' }).errors.length);
  assert.ok(normalizeAllMenuJson({ tableHeaders: [{ Label: '无字段', Fields: [] }] }).errors.length);
  assert.ok(normalizeAllMenuJson({ tableHeaders: [{ Label: '错误嵌套', Children: [{ Label: '', Fields: ['Total'] }] }] }).errors.length);
});

test('Manifest accepts portable MicroService menu references without tenant ids', () => {
  const plan = buildPlan({ modules: [portableModule] });
  assert.deepEqual(plan.errors, []);
  assert.ok(plan.plan.includes('resolve_microservice_binding ai-platform-studio/overview'));
});

test('Manifest rejects an incomplete MicroService menu before generation', () => {
  const plan = buildPlan({
    modules: [{ name: '错误入口', openType: 'MicroService', microServiceKey: 'ai-platform-studio' }],
  });
  assert.ok(plan.errors.some((item) => item.includes('microServiceRoutePath')));
});

test('portable MicroService menu resolves tenant-specific service and page ids', async () => {
  let requestedKey = '';
  const binding = await resolveMicroServiceModuleBinding({
    async getMicroService(msKey: string) {
      requestedKey = msKey;
      return {
        Code: 1,
        Msg: 'ok',
        Data: {
          Service: { Id: 'service-current-tenant', MsKey: 'ai-platform-studio' },
          Pages: [
            { Id: 'page-overview-current-tenant', RoutePath: '/overview' },
            { Id: 'page-portal-current-tenant', RoutePath: '/portal' },
          ],
        },
      };
    },
  }, { ...portableModule, osClient: 'untrusted-manifest-tenant' }, 'loctek');

  assert.equal(requestedKey, 'ai-platform-studio');
  assert.deepEqual(binding, {
    IsMicroiService: 1,
    OpenType: 'MicroService',
    ComponentName: 'MicroService',
    ComponentPath: '/micro-app/host',
    Url: '/micro-app/loctek/ai-platform-studio/overview',
    MicroServiceId: 'service-current-tenant',
    MicroServicePageId: 'page-overview-current-tenant',
    MicroServiceRoutePath: '/overview',
    MicroServiceKey: 'ai-platform-studio',
  });
});

test('CodeForm menu keeps its table binding and resolves a published Vue page', async () => {
  const codeForm = {
    name: '订单代码页', table: 'Biz_Order', openType: 'CodeForm',
    microServiceKey: 'microi-generated-forms', microServiceRoutePath: '/forms/biz_order',
  };
  const plan = buildPlan({ modules: [codeForm] });
  assert.deepEqual(plan.errors, []);
  const binding = await resolveMicroServiceModuleBinding({
    async getMicroService() {
      return { Code: 1, Msg: 'ok', Data: {
        Service: { Id: 'service-1', MsKey: 'microi-generated-forms' },
        Pages: [{ Id: 'page-1', RoutePath: '/forms/biz_order' }],
      } };
    },
  }, codeForm, 'iTdos');
  assert.equal(binding?.OpenType, 'CodeForm');
  assert.equal(binding?.MicroServicePageId, 'page-1');
  await assert.rejects(
    resolveMicroServiceModuleBinding({ getMicroService: async () => ({ Code: 1, Msg: 'ok', Data: {} }) }, { ...codeForm, table: '' }, 'iTdos'),
    /必须绑定真实 diy_table/,
  );
});

test('MicroService default menu routes require the selected tenant and preserve nested paths', () => {
  assert.equal(buildMicroServiceMenuUrl('iTdos', 'microi-platform-service', '/'), '/micro-app/iTdos/microi-platform-service');
  assert.equal(buildMicroServiceMenuUrl('loctek', 'loctek-custom-pages', '/orders/edit'), '/micro-app/loctek/loctek-custom-pages/orders/edit');
  assert.throws(() => buildMicroServiceMenuUrl('', 'demo', '/'), /合法 OsClient/);
  assert.throws(() => buildMicroServiceMenuUrl('loctek/other', 'demo', '/'), /合法 OsClient/);
});

test('Manifest MicroService binding keeps an explicitly supplied legacy URL', async () => {
  const client = { getMicroService: async () => ({ Code: 1, Msg: 'ok', Data: {
    Service: { Id: 'service-1', MsKey: 'ai-platform-studio' },
    Pages: [{ Id: 'page-1', RoutePath: '/overview' }],
  } }) };
  for (const urlField of ['url', 'Url']) {
    const binding = await resolveMicroServiceModuleBinding(client, {
      ...portableModule, [urlField]: '/micro-app/ai-platform-studio/overview',
    }, 'loctek');
    assert.equal(binding?.Url, '/micro-app/ai-platform-studio/overview');
  }
});
