import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlan, resolveMicroServiceModuleBinding } from './advanced-tools.js';
const portableModule = {
    name: 'AI平台治理工作台',
    parentName: 'AI平台治理',
    openType: 'MicroService',
    microServiceKey: 'ai-platform-studio',
    microServiceRoutePath: '/overview',
};
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
        async getMicroService(msKey) {
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
//# sourceMappingURL=manifest-microservice-module.test.js.map