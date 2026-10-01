import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPlan, normalizeAllMenuJson, resolveMicroServiceModuleBinding } from './advanced-tools.js';

const portableModule = {
  name: 'AI平台治理工作台',
  parentName: 'AI平台治理',
  openType: 'MicroService',
  microServiceKey: 'ai-platform-studio',
  microServiceRoutePath: '/overview',
};

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
  }, portableModule);

  assert.equal(requestedKey, 'ai-platform-studio');
  assert.deepEqual(binding, {
    IsMicroiService: 1,
    OpenType: 'MicroService',
    ComponentName: 'MicroService',
    ComponentPath: '/micro-app/host',
    Url: '/micro-app/ai-platform-studio/overview',
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
  }, codeForm);
  assert.equal(binding?.OpenType, 'CodeForm');
  assert.equal(binding?.MicroServicePageId, 'page-1');
  await assert.rejects(
    resolveMicroServiceModuleBinding({ getMicroService: async () => ({ Code: 1, Msg: 'ok', Data: {} }) }, { ...codeForm, table: '' }),
    /必须绑定真实 diy_table/,
  );
});
