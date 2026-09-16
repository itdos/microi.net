import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse } from '@babel/parser';

const filename = new URL('../src/views/form-engine/diy-design.vue', import.meta.url);
const code = parseSfc(fs.readFileSync(filename, 'utf8')).descriptor.script.content;
const ast = parse(code, { sourceType: 'module' });
const component = ast.program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
const methods = component.properties.find(node => node.key.name === 'methods').value.properties;
for (const name of ['UptDiyTable', 'SaveAllDiyField']) {
    test(`${name} 不使用迁移表定义中的旧租户作为会话路由`, () => {
        const node = methods.find(node => node.key.name === name);
        const method = vm.runInNewContext(`({${code.slice(node.start, node.end)}})`, { lodash: { cloneDeep: structuredClone }, persistFieldValueChangeV8() {} })[name];
        const sent = [], original = { Id: 'table-id', Name: 'projects', OsClient: 'old-tenant' };
        const ctx = {
            CurrentDiyTableModel: original, DiyFieldList: [{ Id: 'field-id', Name: 'Name', OsClient: 'old-tenant' }], $refs: {},
            $route: { params: { Id: original.Id } }, DiyApi: { FormEngine: { UptFormData: '/table' }, UptDiyFieldList: '/fields' },
            DiyCommon: { GetOsClient: () => 'current-tenant', Base64EncodeDiyTable() {}, Base64EncodeDiyField() {}, Post(url, data) { sent.push({ url, data }); } },
            DiyTableJsonToStr() {}, DiyFieldJsonToStr() {}, NormalizeLegacyFieldTabs() {}
        };
        method.call(ctx);
        assert.equal(sent[0].data.OsClient, 'current-tenant');
        assert.equal(sent[0].data.FormEngineKey, 'Diy_Table');
        assert.equal(original.OsClient, 'old-tenant', '不得改写读取到的元数据对象');
        if (name === 'SaveAllDiyField') assert.equal(sent[1].data.FieldList[0].OsClient, '');
    });
}
