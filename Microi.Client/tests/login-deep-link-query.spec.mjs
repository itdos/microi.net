import fs from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouter, createMemoryHistory } from 'vue-router';
const source = await fs.readFile(new URL('../src/views/login/index.vue', import.meta.url), 'utf8');
const start = source.indexOf('                var useDefaultTarget =');
const end = source.indexOf('                if (navigationFailure) throw navigationFailure;', start);
const act = vm.runInNewContext(`(async function(self, url, fallbackUrl, normalizeMenuRoutePath, isRegisteredRoute) { ${source.slice(start, end)} })`);

test('首次登录返回深链接时保留询价Id、编号及重复/编码参数', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/micro-app/test/create', component: {} }] });
    const redirect = '/micro-app/test/create?InquiryId=abc&InquiryNo=XJ123&name=%E6%B5%8B%E8%AF%95&tag=a&tag=b#section';
    await act({ redirect, otherQuery: {}, DiyCommon: { IsNull: v => !v }, $router: router }, '/', '/', value => value, () => true);
    assert.equal(router.currentRoute.value.query.InquiryId, 'abc');
    assert.equal(router.currentRoute.value.query.InquiryNo, 'XJ123');
    assert.equal(router.currentRoute.value.query.name, '测试');
    assert.deepEqual(router.currentRoute.value.query.tag, ['a', 'b']);
    assert.equal(router.currentRoute.value.hash, '#section');
});
